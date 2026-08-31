const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getSiteId, getSiteUserId } = require("../../utils/graphSites");
const { getListItems } = require("../../utils/getItemsByIds");
const { verifyItemAccess } = require("../../utils/verifyItemAccess");

router.post("/it-portal/getFileLinks", requireAuth, async (req, res) => {
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
      publicWhen: {
        list: "Asset",
        field: "ClassificationLevel",
        value: "Public",
      },
    });
    if (!authorized) {
      return res.status(403).json({ error: "Not authorized for this asset" });
    }

    // AssetAttachments is a document library — still a list, so the Asset lookup lands as
    // AssetLookupId on each item's fields.
    const rows = await getListItems({
      token: accessToken,
      siteId,
      listName: "AssetAttachments",
      filter: `fields/AssetLookupId eq ${assetId}`,
    });

    // Turn each into an org-scoped, 1-hour view link off its driveItem.
    const expirationDateTime = new Date(
      Date.now() + 60 * 60 * 1000,
    ).toISOString();
    const files = await Promise.all(
      rows.map(async (fields) => {
        const linkResponse = await fetch(
          `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/AssetAttachments/items/${fields.id}/driveItem/createLink`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              type: "view",
              scope: "organization",
              expirationDateTime,
            }),
          },
        );
        const linkData = await linkResponse.json();
        if (!linkResponse.ok) {
          console.error("createLink failed:", linkData);
        }
        return {
          name: fields.FileLeafRef,
          size: Number(fields.FileSizeDisplay) || null,
          url: linkData?.link?.webUrl ?? null,
          expiresAt: expirationDateTime,
        };
      }),
    );
    //console.log(files);

    return res.json({ files });
  } catch (err) {
    console.error("getFileLinks error:", err);
    return res.status(500).json({ error: "Failed to fetch file links" });
  }
});

module.exports = router;
