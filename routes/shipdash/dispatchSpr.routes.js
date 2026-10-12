const express = require("express");
const router = express.Router();

const {requireAuth} = require("../../utils/getAuth");
const {authForSite} = require("../../utils/authForSite");
const {getAccessTokenTdiApi} = require("../../utils/getTokens");
const {sendEmail} = require("../../utils/sendEmail");
const {getSprString, cleanRecipients} = require("../../utils/getSprString");
const {getVesselName} = require("../../utils/getVesselName");

router.post("/shipdash/dispatchSpr", requireAuth, async (req, res) => {
    console.log("Verified user:", req.user.upn);

    let reportData;
    try {
        reportData = JSON.parse(req.headers["x-report-data"]);
    } catch (err) {
        return res.status(400).json({error: "Invalid X-Report-Data header"});
    }
    //console.log("Report data:", reportData);

    const siteOrigin = req.headers["origin"] || req.headers["referer"];
    console.log("Site origin:", siteOrigin);

    const {siteName} = reportData?.siteConfig || {};
    console.log("Site name:", siteName);

    const isDev = process.env.PROD !== "true";

    if (!isDev && !authForSite(req.user.upn, siteName)) {
        return res.status(401).json({error: "Unauthorized"});
    }

    const vesselName = getVesselName(siteName);


    // every SPR also goes to the submitter and the DPR inbox (DPR inbox skipped in dev to keep test mail out of it)
    const recipients = [...new Map(
        [
            ...(isDev
                ? ["parkerseeley@tdi-bi.com"] //this is the local list
                : cleanRecipients(reportData?.notificationList)),
            req.user.upn,
            ...(isDev ? [] : ["dpr@tdi-bi.com"]),
        ]
            .filter(Boolean)
            .map((address) => [address.toLowerCase(), address])
    ).values()];

    const accessToken = await getAccessTokenTdiApi();
    const htmlBody = getSprString(reportData, vesselName);

    // reportDate is client-supplied (YYYY-MM-DD); fall back to today if it's missing or malformed
    const parsedReportDate = new Date(`${reportData?.reportDate}T00:00:00`);
    const subjectDate = (Number.isNaN(parsedReportDate.getTime()) ? new Date() : parsedReportDate)
        .toLocaleDateString("en-US", {month: "long", day: "numeric"});

    await sendEmail(
        accessToken,
        "no-reply@tdi-bi.com",
        recipients,
        `${isDev ? 'FROM DEV MODE - NOT REAL REPORT - ' : ''}${vesselName} SPR ${subjectDate}`,
        htmlBody,
        null,
    );

    return res.json({
        received: true,
        upn: req.user.upn,
        reportData,
        siteOrigin,
        siteName,
    });
});

module.exports = router;
