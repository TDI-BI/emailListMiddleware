const express = require("express");
require('dotenv').config();
const axios = require('axios');
const app = express();


//helper functions
const getAccessToken = async () => {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`
    const params = new URLSearchParams({
        client_id: process.env.APP_ID,
        client_secret: process.env.SECRET_VAL,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    })
    try{
        const response = await axios.post(tokenUrl,params, {
            headers:{'Content-Type': 'application/x-www-form-urlencoded'}
        });
        return response.data.access_token
    }
    catch(e){
        console.error('error gaining access token:',e.response?.data || e.message)
        return null
    }
}

const getGroupMembers = async (groupId) => {
    const token = await getAccessToken();
    if(!token) return null;

    try{
        const response = await axios.get(`${process.env.GRAPH_API_URL}/groups/${groupId}/members`,{
            headers:{Authorization:`Bearer ${token}`}
        })
        return response.data.value;
    }catch(e){
        console.error('error fetching data:',e.response?.data || e.message)
        return null;
    }
}

const testResponse = async () => { // throws error but who cares, connection clearly established 
    const token = await getAccessToken();
    if(!token) return null;

    try{
        const response = await axios.get(`${process.env.GRAPH_API_URL}/users`,{
            headers:{Authorization:`Bearer ${token}`}
        })
        return response.data.value;
    }catch(e){
        console.error('error fetching data:',e.response?.data || e.message)
        return null;
    }
}

app.get("/", (req, res) => { 
    console.log("root url");
    res.send('haiii<br></br>to see email groups use ./group<br></br>to see all groups use ./groups');
});

app.get("/group", async (req, res) => { 
    const groupById = await getGroupMembers('72592f8f-6cd5-45b4-9a6f-d23ffb859ec4'); // need to actually pull user infoge

    res.json({
        groupById
    });
});

app.get("/groups", async (req, res) => {
	const token = await getAccessToken();
	if (!token) return res.status(500).json({ error: "Failed to get access token" });

	try {
    	const response = await axios.get(`${process.env.GRAPH_API_URL}/groups`, {
        	headers: { Authorization: `Bearer ${token}` },
    	});
    	res.json(response.data.value); // List of groups
	} catch (error) {
    	console.error("Error fetching groups:", error.response?.data || error.message);
    	res.status(500).json({ error: "Failed to fetch groups" });
	}
});


app.listen(1902);
