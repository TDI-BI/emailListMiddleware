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

if (process.env.PROD != "true") {
    //we need this when running local dev env :p
    const cors = require("cors");
    app.use(cors());
}

//lets me pass extra stuff in posts
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/favicon.ico", (req, res) => res.status(204).end()); // make my browser shut the fuck up

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
        console.error("error gaining access token:", e.response?.data || e.message);
        return null;
    }
};


app.get("/getAll", async (req, res) => {
    const groups = await getGroups();
    const allInf = groups.filter(item => item.displayName === 'All Users')[0];
    if (process.env.PROD === 'true') return;
    const allId = allInf.id
    const allGroup = await getGroupMembers(allId);
    res.json({
        allGroup
    });
});
const getAllUserEmails = async () => {
    const token = await getAccessToken();
    if (!token) return null;

    try {
        //i dont remember how to use graph to get groupId, but I need to do it for all

        const allid = 'placeholder';
        //literally why am i using axios??

        const allGroups = await getGroups();
        //filter for all
        const allId = 'placeholder xdd'; // allGroups.all.ID

        return getGroupMembers(allid);


    } catch (e) {
        console.error("error fetching data", e)
    }
}

const getGroupMembers = async (groupId) => {
    const token = await getAccessToken();
    if (!token) return null;

    try {
        const response = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: {Authorization: `Bearer ${token}`},
            },
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
        const response = await axios.get(`${process.env.GRAPH_API_URL}/groups`, {
            headers: {Authorization: `Bearer ${token}`},
        });
        return response.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

app.get("/", (req, res) => {
    res.send(
        "haiii<br>to see email groups use ./group<br>to see all groups use ./groups",
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
            },
        );
        if (responseG.data.value == null) console.error("no such group exists");
        const groupId = responseG.data.value[0].id;

        const responseM = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: {Authorization: `Bearer ${token}`},
            },
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
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
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
        throw new Error("Unexpected buffer type received from generatePdfBuffer");
    }
};
const uploadPdf = async (buff, accessToken, title, spSiteName) => {
    const libName = "Spr Reports";
    console.log("Target SharePoint site:", spSiteName);

    try {
        if (!buff || !accessToken || !title || !spSiteName) {
            throw new Error("Missing required arguments for uploadPdf()");
        }

        // Step 1: Find the site
        const siteRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(spSiteName)}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const siteText = await siteRes.text();
        let siteData;
        try {
            siteData = JSON.parse(siteText);
        } catch (err) {
            throw new Error(`Failed to parse site search response: ${siteText}`);
        }

        if (!siteRes.ok || !siteData?.value?.length) {
            throw new Error(
                `Could not find site "${spSiteName}" (HTTP ${siteRes.status}): ${JSON.stringify(siteData)}`
            );
        }

        const siteId = siteData.value[0].id;

        // Step 2: Get drives/libraries for that site
        const drivesRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const drivesText = await drivesRes.text();
        let drivesData;
        try {
            drivesData = JSON.parse(drivesText);
        } catch (err) {
            throw new Error(`Failed to parse drives response: ${drivesText}`);
        }

        if (!drivesRes.ok || !drivesData?.value?.length) {
            throw new Error(
                `No drives found for site ${spSiteName} (HTTP ${drivesRes.status}): ${JSON.stringify(drivesData)}`
            );
        }

        const drive = drivesData.value.find((d) => d.name === libName);
        if (!drive) {
            throw new Error(`Drive "${libName}" not found in site "${spSiteName}"`);
        }

        const driveId = drive.id;

        // Step 3: Upload the file
        console.log(`Uploading PDF to SharePoint: ${title}.pdf`);
        const uploadRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(title)}.pdf:/content`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/pdf",
                },
                body: buff,
            }
        );

        const uploadText = await uploadRes.text();
        let uploadData;
        try {
            uploadData = JSON.parse(uploadText);
        } catch {
            uploadData = {raw: uploadText};
        }

        if (!uploadRes.ok) {
            throw new Error(
                `Upload failed (HTTP ${uploadRes.status}): ${JSON.stringify(uploadData)}`
            );
        }

        console.log("Upload successful:", uploadData?.name || `${title}.pdf`);
        return uploadData;
    } catch (err) {
        console.error("uploadPdf error:", err.message);
        throw new Error(`uploadPdf failed for site "${spSiteName}": ${err.message}`);
    }
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
                headers: {"Content-Type": "application/x-www-form-urlencoded"},
                body: params.toString(),
            }
        );

        const data = await response.json();
        if (!response.ok) {
            const message = `Token request failed (${response.status}): ${JSON.stringify(data)}`;
            throw new Error(message);
        }

        if (!data.access_token) {
            throw new Error("No access token received from Microsoft Graph.");
        }

        return data.access_token;
    };

    // ship-specific config
    let actuallyFrom;
    let extra;
    switch (ship) {
        case "Gyre":
            actuallyFrom = "gyre@tdi-bi.com";
            extra = ["mastergyre@tdi-bi.com"];
            break;
        case "Brooks McCall":
            actuallyFrom = "bmcc@tdi-bi.com";
            extra = ["masterbmcc@tdi-bi.com"];
            break;
        case "Proteus":
            actuallyFrom = "proteus@tdi-bi.com";
            extra = ["masterproteus@tdi-bi.com"];
            break;
        case "Nautilus":
            actuallyFrom = "nautilus@tdi-bi.com";
            extra = [
                "masternautilus@tdi-bi.com",
                "engineernautilus@tdi-bi.com",
                "nautilus@tdi-bi.com",
            ];
            break;
        default:
            actuallyFrom = "no-reply@tdi-bi.com";
            extra = ["parkerseeley@tdi-bi.com"];
    }

    const sendEmail = async (accessToken, fromUserEmail, toAddress, body, siteId) => {
        const attachmentBuffer = await generatePdfBuffer(body);
        if (!attachmentBuffer) {
            throw new Error("Failed to generate PDF buffer.");
        }

        const title = `${ship}-SPR-${new Date().toISOString().slice(0, 10)}`;

        const uploadResponse = await uploadPdf(attachmentBuffer, accessToken, title, siteId);
        if (!uploadResponse || uploadResponse.error) {
            throw new Error(`PDF upload failed: ${JSON.stringify(uploadResponse)}`);
        }
        console.log("PDF uploaded successfully:", uploadResponse);

        const base64Attachment = attachmentBuffer.toString("base64");
        const emailBody = {
            message: {
                subject: title,
                body: {contentType: "HTML", content: body},
                toRecipients: toAddress.map((address) => ({
                    emailAddress: {address},
                })),
                // attachments optional — uncomment if needed
                /*
                attachments: [
                    {
                        "@odata.type": "#microsoft.graph.fileAttachment",
                        name: `${title}.pdf`,
                        contentType: "application/pdf",
                        contentBytes: base64Attachment,
                    },
                ],
                */
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

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                `Send mail failed (${response.status}): ${JSON.stringify(errorData)}`
            );
        }

        console.log("Email sent successfully!");
    };

    // top-level try/catch that bubbles errors up
    const token = await getAccessToken();
    await sendEmail(token, from, [toAddress].concat(extra), body, siteId);
};


app.post("/testEmail", async (req, res) => {
    console.log("___________________________________________________________________________________");
    console.log("Starting email process...");

    try {
        const key = req.body.secretKey;
        if (key !== process.env.TOP_SECRET_KEY) {
            console.error("Invalid secret key");
            return res.status(403).json({
                success: false,
                message: "Invalid secret key",
            });
        }

        const {from, body, to, site, ship} = req.body;

        if (!from || !body || !to || !site || !ship) {
            return res.status(400).json({
                success: false,
                message: `Missing required parameters - ${!from ? 'from, ' : ''}${!body ? 'body, ' : ''}${!to ? 'to, ' : ''}${!site ? 'site, ' : ''}${!ship ? 'ship' : ''}`,
            });
        }

        console.log(`Writing for ${ship} @ ${new Date().toISOString()}`);

        await mkEmail(from, body, to, site, ship);

        return res.status(200).json({
            success: true,
            message: "Email successfully queued/sent.",
        });

    } catch (err) {
        console.error("Error during email send:", err);
        return res.status(500).json({
            success: false,
            message: "Internal error while sending email - contact IT",
            error: err.message,
        });
    }
});

app.get("/testroute1", async (req, res) => {
    res.json({msg: "madeit!"});
});

app.listen(1902);
