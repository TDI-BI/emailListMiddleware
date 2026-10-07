const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getListItems, getItemsByIds } = require("../../utils/getItemsByIds");
const { getSiteId, getSiteUserId } = require("../../utils/graphSites");

router.post("/it-portal/getMyItems", requireAuth, async (req, res) => {
  try {
    const username = req.user.upn;
    const accessToken = await getAccessTokenTdiApi();

    const siteId = await getSiteId({
      token: accessToken,
      hostname: "tdibrooks.sharepoint.com",
      path: "/sites/informationtechnology",
    });

    const siteUserId = await getSiteUserId({
      token: accessToken,
      siteId,
      email: username,
    });
    console.log("resolved SharePoint site user id:", siteUserId);

    // the expand $select lets us read the sharepoint display name (an index-able tag) rather than a raw ID
    const assignments = await getListItems({
      token: accessToken,
      siteId,
      listName: "AssetAssignment",
      select: ["Asset", "StartDate"],
      filter: `fields/EndDate eq null and fields/PersonLookupId eq ${siteUserId}`,
    });
    const assetTags = [
      ...new Set(assignments.map((a) => a.Asset).filter(Boolean)),
    ];

    const assetItems = await getItemsByIds({
      token: accessToken,
      siteId,
      listName: "Asset",
      ids: assetTags,
      field: "Tag",
      select: ["Id", "Tag", "Model", "SerialNumber", "ClassificationLevel"],
    });
    const assetById = new Map(assetItems.map((fields) => [fields.Tag, fields]));

    // Model is a lookup field on Asset projecting the Model list's Title (indexed) — same
    // trick as Tag, one more hop to pull Year/Make/Classification for each distinct model.
    const modelTitles = [
      ...new Set([...assetById.values()].map((a) => a.Model).filter(Boolean)),
    ];

    const modelItems = await getItemsByIds({
      token: accessToken,
      siteId,
      listName: "Model",
      ids: modelTitles,
      field: "Title",
      select: ["Year", "Make", "Classification", "Title"],
    });
    const modelByTitle = new Map(
      modelItems.map((fields) => [fields.Title, fields]),
    );

    const items = assignments.map((assignment) => {
      const asset = assetById.get(assignment.Asset) ?? null;
      const model = asset ? (modelByTitle.get(asset.Model) ?? null) : null;
      return {
        asset,
        model,
        startDate: assignment.StartDate,
      };
    });

    return res.json({ upn: username, items });
  } catch (err) {
    console.error("getMyItems error:", err);
    return res.status(500).json({ error: "Failed to fetch items" });
  }
});

module.exports = router;
