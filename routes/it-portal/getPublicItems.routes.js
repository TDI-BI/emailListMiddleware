const express = require("express");
const router = express.Router();

const { requireAuth } = require("../../utils/getAuth");
const { getAccessTokenTdiApi } = require("../../utils/getTokens");
const { getListItems, getItemsByIds } = require("../../utils/getItemsByIds");
const { getSiteId } = require("../../utils/graphSites");

router.post("/it-portal/getPublicItems", requireAuth, async (req, res) => {
  try {
    const username = req.user.upn;
    const accessToken = await getAccessTokenTdiApi();

    const siteId = await getSiteId({
      token: accessToken,
      hostname: "tdibrooks.sharepoint.com",
      path: "/sites/informationtechnology",
    });

    // No assignment hop here — public assets aren't tied to a person. Filter the Asset list
    // straight to ClassificationLevel 'Public' and expand the fields we care about.
    const assets = await getListItems({
      token: accessToken,
      siteId,
      listName: "Asset",
      select: ["Id", "Tag", "Model", "SerialNumber", "ClassificationLevel"],
      filter: `fields/ClassificationLevel eq 'Public'`,
    });

    // Model is a lookup field on Asset projecting the Model list's Title (indexed) — one more
    // hop to pull Year/Make/Classification for each distinct model.
    const modelTitles = [
      ...new Set(assets.map((a) => a.Model).filter(Boolean)),
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

    const items = assets.map((asset) => ({
      asset,
      model: modelByTitle.get(asset.Model) ?? null,
    }));

    return res.json({ upn: username, items });
  } catch (err) {
    console.error("getPublicItems error:", err);
    return res.status(500).json({ error: "Failed to fetch items" });
  }
});

module.exports = router;
