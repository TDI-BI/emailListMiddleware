const express = require("express");
const router = express.Router();

const {requireAuth} = require("../../utils/getAuth");
const {getAccessTokenTdiApi} = require("../../utils/getTokens");
const {getDirectReportEmails} = require("../../utils/graphUsers");
const {getSiteId, getSiteUserIds} = require("../../utils/graphSites");
const {getListItems, getItemsByIds} = require("../../utils/getItemsByIds");

// Step 1 of "get an employee's child's assets": resolve who a user manages.
// Start point is the verified caller (req.user.upn) — no client-supplied identity.
router.post("/it-portal/getEmployeeItems", requireAuth, async (req, res) => {
    try {
        const manager = req.user.upn;
        console.log("Verified user:", manager);

        const accessToken = await getAccessTokenTdiApi();
        const employeeEmails = await getDirectReportEmails({
            token: accessToken,
            user: manager,
        });

        // Convert the employee email list to SharePoint site user ids — the integers that
        // AssetAssignment's PersonLookupId points at. One batched request against the
        // site's User Information List.
        const siteId = await getSiteId({
            token: accessToken,
            hostname: "tdibrooks.sharepoint.com",
            path: "/sites/informationtechnology",
        });

        const resolved = await getSiteUserIds({
            token: accessToken,
            siteId,
            emails: employeeEmails,
        });

        const employeeLookupIds = resolved
            .filter((r) => r.id != null)
            .map((r) => r.id);
        const unresolved = resolved
            .filter((r) => r.id == null)
            .map((r) => r.email);
        console.log("employeeLookupIds:", employeeLookupIds, "unresolved:", unresolved);

        // Active AssetAssignment rows for those people. PersonLookupId is numeric, so no quotes,
        // and `in` isn't supported on this endpoint — OR-chain it (same ~15 ceiling as getItemsByIds).
        let assignments = [];
        if (employeeLookupIds.length > 0) {
            const personFilter = employeeLookupIds
                .map((id) => `fields/PersonLookupId eq ${id}`)
                .join(" or ");
            assignments = await getListItems({
                token: accessToken,
                siteId,
                listName: "AssetAssignment",
                select: ["Asset", "StartDate", "PersonLookupId"],
                filter: `fields/EndDate eq null and (${personFilter})`,
            });
        }

        // Which employee each assignment belongs to, keyed by their site user id.
        const emailByLookupId = new Map(
            resolved
                .filter((r) => r.id != null)
                .map((r) => [String(r.id), r.email]),
        );

        // From here down this mirrors getMyItems: hydrate Asset by Tag, then Model by Title.
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
                email: emailByLookupId.get(String(assignment.PersonLookupId)) ?? null,
                asset,
                model,
                startDate: assignment.StartDate,
            };
        });

        return res.json({manager, items, unresolved});
    } catch (err) {
        console.error("getEmployeeItems error:", err);
        return res.status(500).json({error: "Failed to fetch employee items"});
    }
});

module.exports = router;
