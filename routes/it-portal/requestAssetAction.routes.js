const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getSiteId, getSiteUserId } = require("../../utils/graphSites");
const { verifyItemAccess } = require("../../utils/verifyItemAccess");

const SITE_HOSTNAME = "tdibrooks.sharepoint.com";
const SITE_PATH = "/sites/informationtechnology";

router.post("/it-portal/requestAssetAction", requireAuth, async (req, res) => {
  try {
    const { assetId, assetTag, title, description, priority } = req.body;
    if (!assetId) {
      return res.status(400).json({ error: "assetId is required" });
    }
    if (!title?.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    if (!priority?.trim()) {
      return res.status(400).json({ error: "priority is required" });
    }
    const accessToken = await getAccessTokenTdiApi();
    const siteId = await getSiteId({
      token: accessToken,
      hostname: SITE_HOSTNAME,
      path: SITE_PATH,
    });

    //we probably dont need this right?
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
      publicWhen: {
        list: "Asset",
        field: "ClassificationLevel",
        value: "Public",
      },
    });
    if (!authorized) {
      return res.status(403).json({ error: "Not authorized for this asset" });
    }

    //bit scuffed, but its too complex to properly wire in user-ensuring
    const openedBy = req.user.upn;

    const createResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/ActionRequests/items`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            Title: title.trim(),
            Description: description?.trim() ?? "",
            Priority: priority.trim(),
            AssetLookupId: assetId,
            OpenedBy: openedBy,
          },
        }),
      },
    );

    if (!createResponse.ok) {
      const errorBody = await createResponse.json().catch(() => ({}));
      console.error(
        "ActionRequests create failed:",
        createResponse.status,
        errorBody,
      );
      return res.status(502).json({ error: "Failed to create action request" });
    }

    const created = await createResponse.json();

    return res.json({ ok: true, id: created.id });
  } catch (err) {
    console.error("requestAssetAction error:", err);
    return res
      .status(500)
      .json({ error: "Failed to submit asset action request" });
  }
});

module.exports = router;
