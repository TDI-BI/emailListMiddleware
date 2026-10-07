const express = require("express");
const router = express.Router();

const {requireAuth} = require("../../utils/getAuth");
const {authForSite} = require("../../utils/authForSite");
const {getAccessTokenTdiApi} = require("../../utils/getTokens");
const {sendEmail} = require("../../utils/sendEmail");
const {getSprString} = require("../../utils/getSprString");
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


    const recipients = isDev
        ? ["parkerseeley@tdi-bi.com"] //this is the local list
        : reportData.notificationList;

    const accessToken = await getAccessTokenTdiApi();
    const htmlBody = getSprString(reportData, vesselName);
    await sendEmail(
        accessToken,
        "no-reply@tdi-bi.com",
        recipients,
        `${isDev ? 'FROM DEV MODE - NOT REAL REPORT - ' : ''}SPR Report`,
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
