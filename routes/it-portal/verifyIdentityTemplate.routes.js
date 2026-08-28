const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");

router.post("/it-portal/verifyIdentity", requireAuth, async (req, res) => {
  console.log("Verified user:", req.user.upn);
  return res.json({ received: true, upn: req.user.upn });
});

module.exports = router;
