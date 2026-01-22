const express = require("express");
const router = express.Router();

const { getGroupMembers } = require("../utils/graphGroups");

router.get("/getGroupById", async (req, res) => {
    try {
        const { id } = req.query;

        if (!id) {
            return res.status(400).json({
                error: "Missing required query parameter: id",
            });
        }

        const groupById = await getGroupMembers(id);

        if (!groupById) {
            return res.status(500).json({
                error: "Failed to fetch group members",
            });
        }

        return res.json({ groupById });
    } catch (err) {
        console.error("getGroupById error:", err);
        return res.status(500).json({
            error: "Internal server error",
        });
    }
});

module.exports = router;
