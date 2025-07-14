const express = require("express");
require("dotenv").config();
const axios = require("axios");
const apicache = require("apicache");

const app = express();
const cache = apicache.middleware;

//this requires some version of cromium running on your system
//if you are on computer just install chrome ez, but if you are on linux
//you have to manually download a bunch of dependencies, you can look them up
const puppeteer = require("puppeteer");

if (process.env.PROD != 'true') {
//we need this when running local dev env :p
    const cors = require("cors");
    app.use(cors())
}

//lets me pass extra stuff in posts
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get('/favicon.ico', (req, res) => res.status(204).end()); // make my browser shut the fuck up

//helper functions
const getAccessToken = async () => {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: process.env.APP_ID,
        client_secret: process.env.SECRET_VAL,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    });
    try {
        const response = await axios.post(tokenUrl, params, {
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
        });
        return response.data.access_token;
    } catch (e) {
        console.error(
            "error gaining access token:",
            e.response?.data || e.message
        );
        return null;
    }
};

const getGroupMembers = async (groupId) => {
    const token = await getAccessToken();
    if (!token) return null;

    try {
        const response = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: {Authorization: `Bearer ${token}`},
            }
        );
        return response.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

const getGroups = async () => {
    // throws error but who cares, connection clearly established
    const token = await getAccessToken();
    if (!token) return null;

    try {
        const response = await axios.get(
            `${process.env.GRAPH_API_URL}/groups`,
            {
                headers: {Authorization: `Bearer ${token}`},
            }
        );
        return response.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

app.get("/", (req, res) => {
    res.send(
        "haiii<br>to see email groups use ./group<br>to see all groups use ./groups"
    );
});

app.get("/group", cache("1 hour"), async (req, res) => {
    const inid = req.query.id;

    const groupById = await getGroupMembers(inid); // need to actually pull user infoge

    if (groupById == null) {
        res.status(500);
        return;
    }

    res.json({
        groupById,
    });
});

app.get("/groups", cache("1 hour"), async (req, res) => {
    const WECAREABOUT = [
        "Marine",
        "Travel",
        "Designated Person Ashore",
        "Tech",
        "Daily Progress Report",
        "Operations",
        "Acctspayable",
        "Survey Processing",
        "Movements",
        "IT",
        "Logistics",
        "Accounts Payable",
        "Survey Technical",
        "Resupply",
        "Marketing",
        "Crew Documentation",
        "Information Technology",
    ];

    const groups = await getGroups();
    const ret = groups
        .filter((itm) => WECAREABOUT.includes(itm.displayName))
        .map((e) => ({id: e.id, desc: e.displayName, mail: e.mail}));

    if (ret == null) {
        res.status(500);
        return;
    }

    res.json({
        ret,
    });
});

const getGroupByName = async (maillistName) => {
    // throws error but who cares, connection clearly established
    const token = await getAccessToken();
    if (!token) return null;

    try {
        const responseG = await axios.get(
            `${process.env.GRAPH_API_URL}/groups?$filter=mail eq '${maillistName}@tdi-bi.com'`,
            {
                headers: {Authorization: `Bearer ${token}`},
            }
        );
        if (responseG.data.value == null) console.error("no such group exists");
        const groupId = responseG.data.value[0].id;

        const responseM = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: {Authorization: `Bearer ${token}`},
            }
        );

        return responseM.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

app.get("/groupByName", async (req, res) => {
    const name = req.query.name;

    const group = await getGroupByName(name);

    if (group == null) {
        res.status(500);
        return;
    }

    res.json({
        group,
    });
});

//pdf maker
const generatePdfBuffer = async (htmlStr) => {
    const browser = await puppeteer.launch({
        headless: "new", // Use "new" in Puppeteer v20+ / Node 20+
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    });
    const page = await browser.newPage();

    await page.setContent(htmlStr, {
        waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
    });

    await browser.close();

    // Ensure we return a real Buffer
    if (Buffer.isBuffer(pdfBuffer)) {
        return pdfBuffer;
    } else if (pdfBuffer instanceof Uint8Array) {
        return Buffer.from(pdfBuffer);
    } else {
        throw new Error('Unexpected buffer type received from generatePdfBuffer');
    }
}

const uploadPdf = async (buff, accessToken, title, spSiteName) => {
    const libName = 'Spr Reports';
    console.log('OUR TARGET SITE ', spSiteName);
    const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(spSiteName)}`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    const siteData = await siteRes.json();
    if (!siteRes.ok || !siteData.value || siteData.value.length === 0) {
        throw new Error(`Could not find site with title "${spSiteName}": ${JSON.stringify(siteData)}`);
    }

    const siteId = siteData.value[0].id;

    const drivesRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives`, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
    });

    const drivesData = await drivesRes.json();
    const drive = drivesData.value.find(d => d.name === libName);
    if (!drive) {
        throw new Error(`Drive "${libName}" not found in site ${spSiteName}`);
    }

    const driveId = drive.id;

    // Step 3: Upload the file to the root of the document library
    const uploadRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${title}.pdf:/content`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/pdf",
        },
        body: buff,
    });

    if (!uploadRes.ok) {
        const error = await uploadRes.text();
        throw new Error(`Upload failed: ${uploadRes.status} ${error}`);
    }

    const uploadedFile = await uploadRes.json();
    return uploadedFile;
};


const mkEmail = async (from, body, toAddress, siteId, ship) => {
    const getAccessToken = async () => {
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");
        params.append("client_id", process.env.CLIENTID);
        params.append("client_secret", process.env.CLIENTSECRET);
        params.append("scope", "https://graph.microsoft.com/.default");
        const response = await fetch(
            `https://login.microsoftonline.com/${process.env.TENANTID}/oauth2/v2.0/token`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: params.toString(),
            }
        );

        const data = await response.json();
        if (!response.ok) {
            throw new Error(`Token request failed: ${JSON.stringify(data)}`);
        }

        return data.access_token;
    };

    //setup stuff for email
    let actuallyFrom // ship account
    let master // master account to copy email to
    switch (ship) {
        case 'Gyre':
            actuallyFrom = 'gyre@tdi-bi.com';
            master = 'mastergyre@tdi-bi.com'
            break;
        case 'Brooks McCall':
            actuallyFrom = 'bmcc@tdi-bi.com';
            master = 'masterbmcc@tdi-bi.com'
            break;
        case 'Proteus':
            actuallyFrom = 'proteus@tdi-bi.com';
            master = 'masterproteus@tdi-bi.com'
            break;
        case 'Nautilus':
            actuallyFrom = 'nautilus@tdi-bi.com';
            master = 'masternautilus@tdi-bi.com'
            break;
        default: // dev env
            actuallyFrom = 'no-reply@tdi-bi.com';
            master = 'parkerseeley@tdi-bi.com'
    }

    const sendEmail = async (accessToken, fromUserEmail, toAddress, body, siteId) => {
        const attachmentBuffer = await generatePdfBuffer(body);
        const title = `${ship}-SPR-${new Date().toISOString().slice(0, 10)}`


        const resp = await uploadPdf(attachmentBuffer, accessToken, title, siteId);
        console.log('pdf upload', resp)

        //cast to base64 so i can email it document
        const base64Attachment = attachmentBuffer.toString("base64");

        const emailBody = {
            message: {
                subject: title,
                body: {
                    contentType: "HTML",
                    content: body,
                },
                toRecipients: toAddress.map(address => ({
                    emailAddress: {
                        address: address,
                    },
                }))
            },
            saveToSentItems: false,
        };
        const response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${actuallyFrom}/sendMail`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(emailBody),
            }
        );
        console.log('Response:', response);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Send mail failed: ${JSON.stringify(error)}`);
        }

        console.log("Email with PDF attachment sent successfully!");
    };

    try { // call our functions
        const token = await getAccessToken();
        await sendEmail(
            token,
            from,
            [toAddress, master],//, GROUPS WORK!
            body,
            siteId,
        );
    } catch (err) {
        console.error("Error:", err);
    }
};


app.post("/testEmail", async (req, res) => {
    console.log("fewhhhh we are local :D");
    const from = req.body.from;
    const body = req.body.body; // err here?
    const to = req.body.to;
    const siteId = req.body.site;
    const ship = req.body.ship;
    await mkEmail(from, body, to, siteId, ship); // fire off email
    res.send("haiii<br></br>sending your email...");
});

app.get("/testroute1", async (req, res) => {
    res.json({'msg': 'madeit!'})
});

app.listen(1902);
