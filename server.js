const express = require("express");
require("dotenv").config();
const axios = require("axios");
const apicache = require('apicache');
const app = express();
const cache = apicache.middleware;

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

app.get("/", (req, res) => {
    console.log("root url");
    res.send(
        "haiii<br></br>to see email groups use ./group<br></br>to see all groups use ./groups"
    );
});

app.get("/group", cache('1 hour'), async (req, res) => {

    const inid = req.query.id

    const groupById = await getGroupMembers(
        inid
    ); // need to actually pull user infoge

    if(groupById==null){ res.status(500); return;}

    res.json({
        groupById,
    });
});

app.get("/groups", cache('1 hour'), async (req, res) => {
    const groups = await getGroups();
    const ret = groups.map((e) => {
        return { id: e.id, desc: e.displayName, mail: e.mail };
    });

    if(ret==null){ res.status(500); return;}

    res.json({
        ret,
    });
});

app.listen(1902);
