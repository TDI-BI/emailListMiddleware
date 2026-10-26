const express = require('express');
const router = express.Router();

const { requireAuth } = require('../../utils/getAuth');
const { authForSite } = require('../../utils/authForSite');
const { getAccessTokenTdiApi } = require('../../utils/getTokens');
const { sendEmail } = require('../../utils/sendEmail');
const { getSprString, cleanRecipients } = require('../../utils/getSprString');
const { getVesselName } = require('../../utils/getVesselName');

const TEST_SITES = ['shipdash_devenv'];

router.post('/shipdash/dispatchSpr', requireAuth, async (req, res) => {
  console.log('Verified user:', req.user.upn);

  // report now arrives as the JSON body; X-Report-Data header kept as a fallback until every site's frontend is updated
  let reportData = req.body;
  if (!reportData || typeof reportData !== 'object' || Object.keys(reportData).length === 0) {
    try {
      reportData = JSON.parse(req.headers['x-report-data']);
    } catch (err) {
      return res.status(400).json({ error: 'Missing or invalid report data' });
    }
  }
  //console.log("Report data:", reportData);

  const siteOrigin = req.headers['origin'] || req.headers['referer'];
  console.log('Site origin:', siteOrigin);

  const { siteName } = reportData?.siteConfig || {};
  console.log('Site name:', siteName);

  const isDev = process.env.PROD !== 'true';

  if (!isDev && !authForSite(req.user.upn, siteName)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const vesselName = getVesselName(siteName);

  // dispatch from the vessel's own mailbox and copy its crew inboxes; dev env and unknown sites fall back to no-reply
  let fromEmail;
  let vesselRecipients = [];
  switch (vesselName) {
    case 'Gyre':
      fromEmail = 'gyre@tdi-bi.com';
      vesselRecipients = ['mastergyre@tdi-bi.com'];
      break;
    case 'Brooks McCall':
      fromEmail = 'brooksmccall@tdi-bi.com';
      vesselRecipients = ['masterbmcc@tdi-bi.com'];
      break;
    case 'Proteus':
      fromEmail = 'proteus@tdi-bi.com';
      vesselRecipients = ['masterproteus@tdi-bi.com'];
      break;
    case 'Nautilus':
      fromEmail = 'nautilus@tdi-bi.com';
      vesselRecipients = [
        'masternautilus@tdi-bi.com',
        'engineernautilus@tdi-bi.com',
        'nautilus@tdi-bi.com',
      ];
      break;
    case 'Emma McCall':
      fromEmail = 'emmamccall@tdi-bi.com';
      vesselRecipients = ['masteremma@tdi-bi.com'];
      break;
    default:
      fromEmail = 'no-reply@tdi-bi.com';
  }

  // mock vessel sites act as a debug mode in prod: mail only the notificationList, never the submitter or DPR inbox
  const isTestSite = TEST_SITES.includes(siteName?.toLowerCase());

  // every real SPR also goes to the submitter, the vessel's crew inboxes and the DPR inbox (crew and DPR inboxes skipped in dev to keep test mail out of them)
  const recipients = [
    ...new Map(
      [
        ...(isDev
          ? ['parkerseeley@tdi-bi.com'] //this is the local list
          : cleanRecipients(reportData?.notificationList)),
        ...(isTestSite ? [] : [req.user.upn]),
        ...(isDev || isTestSite ? [] : vesselRecipients),
        ...(isDev || isTestSite ? [] : ['dpr@tdi-bi.com']),
      ]
        .filter(Boolean)
        .map(address => [address.toLowerCase(), address])
    ).values(),
  ];

  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients in notificationList' });
  }

  const accessToken = await getAccessTokenTdiApi();
  const htmlBody = getSprString(reportData, vesselName);

  // reportDate is client-supplied (YYYY-MM-DD); fall back to today if it's missing or malformed
  const parsedReportDate = new Date(`${reportData?.reportDate}T00:00:00`);
  const subjectDate = (
    Number.isNaN(parsedReportDate.getTime()) ? new Date() : parsedReportDate
  ).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

  await sendEmail(
    accessToken,
    fromEmail,
    recipients,
    `${isDev ? 'FROM DEV MODE - NOT REAL REPORT - ' : ''}${vesselName} SPR ${subjectDate}`,
    htmlBody,
    null
  );

  return res.json({
    received: true,
    upn: req.user.upn,
    siteOrigin,
    siteName,
  });
});

module.exports = router;
