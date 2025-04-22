const express = require("express");
require("dotenv").config();
const axios = require("axios");
const apicache = require("apicache");
const app = express();
const cache = apicache.middleware;
const cors = require("cors");

app.use(
    cors({
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);
//lets me pass extra stuff in posts
app.use(express.json());
app.use(express.urlencoded({extended:true}));

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
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
                headers: { Authorization: `Bearer ${token}` },
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
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        return response.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

//WE ARE TESTING THIS RN
//this is a little weird because i just copied it out of a typescript file, thats why (for now) there are some repeat functions. I will want to rewrite all this before deploying to clean up the express app
const mkEmail = async (from, body) => {
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

    const sendEmail = async (accessToken, fromUserEmail, toAddress) => {
        const emailBody = {
            message: {
                subject: "SPR Email Format Demo Correction",
                body: {
                    contentType: "HTML",
                    content: body,
                },
                toRecipients: toAddress.map(address => ({
                    emailAddress: {
                        address: address,
                    },
                })),
            },
            saveToSentItems: false,
        };

        const response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${from}/sendMail`,
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
            const error = await response.json();
            throw new Error(`Send mail failed: ${JSON.stringify(error)}`);
        }

        console.log("Email sent successfully!");
    };
    try {
        const token = await getAccessToken();
        await sendEmail(
            token,
            from,
            ["parkerseeley@tdi-bi.com"]//, "kevindavis@tdi-bi.com",'danvitale@tdi-bi.com']
        );
    } catch (err) {
        console.error("Error:", err);
    }
};

app.get("/", (req, res) => {
    res.send(
        "haiii<br></br>to see email groups use ./group<br></br>to see all groups use ./groups"
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
        .map((e) => ({ id: e.id, desc: e.displayName, mail: e.mail }));

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
                headers: { Authorization: `Bearer ${token}` },
            }
        );
        if (responseG.data.value == null) console.error( "no such group exists");
        const groupId = responseG.data.value[0].id;

        const responseM = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: { Authorization: `Bearer ${token}` },
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

app.post("/testEmail", async (req, res) => {
    console.log("opening script");
    const from = req.body.from;
    const body = req.body.body
    //debugging lines
    //console.log(from);
    //console.log(body);  
    /*
    mkEmail(
        "parkerseeley@tdi-bi.com",
        "this is my new test body passed as a parameter"
    );
    */
    await mkEmail(from, body); // fire off email
    res.send("haiii<br></br>sending youre email...");
});

// we are gonna transition cache to 24 hours,
// then we are going to create this as a route to clear cache and regenerate at like 12pm every day?
// call via crom task with some auth password or something
app.get("/mkcache", async (req, res) => {
    //gets all groups then gets all /group
});

app.listen(1902);
