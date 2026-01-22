const express = require("express");
const axios = require("axios");
const router = express.Router();

const { getAccessTokenLists } = require("../utils/getTokens");

router.get("/getGroupByName", async (req, res) => {
    try {
        const { name } = req.query;

        if (!name) {
            return res.status(400).json({
                error: "Missing required query parameter: name",
            });
        }

        const token = await getAccessTokenLists();
        if (!token) {
            return res.status(500).json({
                error: "Failed to acquire access token",
            });
        }

        // Get group by mail name
        const groupRes = await axios.get(
            `${process.env.GRAPH_API_URL}/groups`,
            {
                headers: { Authorization: `Bearer ${token}` },
                params: {
                    $filter: `mail eq '${name}@tdi-bi.com'`,
                },
            }
        );

        const group = groupRes.data?.value?.[0];
        if (!group) {
            return res.status(404).json({
                error: `Group "${name}" not found`,
            });
        }

        // Get members
        const membersRes = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${group.id}/members`,
            {
                headers: { Authorization: `Bearer ${token}` },
            }
        );

        return res.json({
            groupId: group.id,
            members: membersRes.data.value,
        });

    } catch (err) {
        console.error("groupByName error:", err.response?.data || err.message);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;
