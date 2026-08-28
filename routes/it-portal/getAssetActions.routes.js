const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getListItems } = require("../../utils/getItemsByIds");
const { getSiteId, getSiteUserId } = require("../../utils/graphSites");
const { verifyItemAccess } = require("../../utils/verifyItemAccess");

router.post("/it-portal/getAssetActions", requireAuth, async (req, res) => {
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

    // Secondary auth: the user must have an AssetAssignment tying them to this asset before
    // we hand back any of its action history.
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

    // Graph's SharePoint /items endpoint can't $filter on a lookup-id column (returns 400),
    // so pull the rows and filter on AssetLookupId in JS.
    const rows = await getListItems({
      token: accessToken,
      siteId,
      listName: "AssetAction",
    });

    const actions = rows
      .filter((fields) => String(fields.AssetLookupId) === String(assetId))
      .map(({ Action, Description, Date, Cost }) => ({
        Action,
        Description,
        Date,
        Cost,
      }));
    //    console.log(actions);

    return res.json({ actions, requests: [] });
  } catch (err) {
    console.error("getAssetActions error:", err);
    return res.status(500).json({ error: "Failed to fetch asset actions" });
  }
});

module.exports = router;
