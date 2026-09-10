const express = require("express");
const router = express.Router();

const {requireAuth} = require("../../utils/getAuth");
const {getAccessTokenTdiApi} = require("../../utils/getTokens");
const {getDirectReportEmails} = require("../../utils/graphUsers");

// Step 1 of "get an employee's child's assets": resolve who a user manages.
// Start point is the verified caller (req.user.upn) — no client-supplied identity.
router.post("/it-portal/testMyEmployees", requireAuth, async (req, res) => {
    try {
        const manager = req.user.upn;
        console.log("Verified user:", manager);

        const accessToken = await getAccessTokenTdiApi();
        const employees = await getDirectReportEmails({
            token: accessToken,
            user: manager,
        });

        console.log(employees);

        return res.json({manager, count: employees.length, employees});
    } catch (err) {
        console.error("testMyEmployees error:", err);
        return res.status(500).json({error: "Failed to fetch direct reports"});
    }
});

module.exports = router;
