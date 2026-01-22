const express = require("express");
const {getGroups, getGroupMembers} = require("../utils/graphGroups");
const router = express.Router();

router.get("/getAll", async (req, res) => {
    try {
        const groups = await getGroups();

        const allInf = groups.find(
            (item) => item.displayName === "All Users"
        );

        if (!allInf) {
            return res.status(404).json({error: "All Users group not found"});
        }

        if (process.env.PROD === "true") {
            return res.status(403).json({error: "Route disabled in production"});
        }

        const allGroup = await getGroupMembers(allInf.id);

        res.json({allGroup});
    } catch (err) {
        console.error("getAll route error:", err);
        res.status(500).json({error: "Internal server error"});
    }
});

module.exports = router;
