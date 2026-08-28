const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getSiteId, getSiteUserId } = require("../../utils/graphSites");
const { verifyItemAccess } = require("../../utils/verifyItemAccess");

router.post("/it-portal/getMyAssetInfo", requireAuth, async (req, res) => {
  try {
    const { assetId } = req.body;
    if (!assetId) {
      return res.status(400).json({ error: "assetId is required" });
    }

    const accessToken = await getAccessTokenTdiApi();

    const siteId = await getSiteId({
      token: accessToken,
      hostname: "tdibrooks.sharepoint.com",
      path: "/sites/informationtechnology",
    });

    const siteUserId = await getSiteUserId({
      token: accessToken,
      siteId,
      email: req.user.upn,
    });

    const authorized = await verifyItemAccess({
      token: accessToken,
      siteId,
      listName: "AssetAssignment",
      itemColumn: "Asset",
      itemId: assetId,
      personColumn: "Person",
      userId: siteUserId,
    });
    if (!authorized) {
      return res.status(403).json({ error: "Not authorized for this asset" });
    }

    return res.json({ authorized: true, assetId });
  } catch (err) {
    console.error("getMyAssetInfo error:", err);
    return res.status(500).json({ error: "Failed to fetch asset info" });
  }
});

module.exports = router;
