const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getSiteId, getSiteUserId } = require("../../utils/graphSites");
const { getListItems } = require("../../utils/getItemsByIds");
const { verifyItemAccess } = require("../../utils/verifyItemAccess");
const { stripMetadata } = require("../../utils/stripMetadata");

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

    const assetResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/Asset/items/${assetId}?$expand=fields($select=Tag,ModelLookupId,SerialNumber,Id,ClassificationLevel)`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    const assetData = await assetResponse.json();
    if (!assetData.fields) {
      console.error("Asset fetch failed:", assetData);
      return res.status(502).json({ error: "Failed to fetch asset" });
    }
    const { Tag, ModelLookupId, SerialNumber, Id, ClassificationLevel } =
      assetData.fields;

    // Model is a lookup on Asset — resolve the referenced Model list item by its id.
    let model = null;
    if (ModelLookupId) {
      const modelResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/Model/items/${ModelLookupId}?$expand=fields($select=Title,Year,Make,Classification)`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        },
      );
      const modelData = await modelResponse.json();
      if (modelData.fields) {
        const { Title, Year, Make, Classification } = modelData.fields;
        model = { Id: ModelLookupId, Title, Year, Make, Classification };
      } else {
        console.error("Model fetch failed:", modelData);
      }
    }

    let details = null;
    const classification = model?.Classification;
    if (classification) {
      const detailRows = await getListItems({
        token: accessToken,
        siteId,
        listName: `${classification}Detail`,
        filter: `fields/AssetLookupId eq ${assetId}`,
      });
      console.log(detailRows);
      details = detailRows[0] ? stripMetadata(detailRows[0]) : null;
    }

    return res.json({
      asset: { Tag, SerialNumber, Id, ClassificationLevel, ModelLookupId },
      model,
      details,
    });
  } catch (err) {
    console.error("getMyAssetInfo error:", err);
    return res.status(500).json({ error: "Failed to fetch asset info" });
  }
});

module.exports = router;
