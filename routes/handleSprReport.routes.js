const express = require('express');
//const fetch = require('node-fetch'); // only needed if you're not on Node 18+ with global fetch
const router = express.Router();

const { getAccessToken365 } = require('../utils/getTokens');
const { mkPdfBuffer } = require('../utils/mkPdfBuffer');
const { sendEmail } = require('../utils/sendEmail');

/**
 * Upload a PDF buffer to SharePoint
 * @param {Buffer} buff - PDF buffer
 * @param {string} accessToken - Access token
 * @param {string} title - File title (without extension)
 * @param {string} siteName - SharePoint site name (e.g., "ShipDash_DevEnv")
 */
const uploadPdf = async (buff, accessToken, title, siteName) => {
  const libName = 'Spr Reports';
  const hostname = 'tdibrooks.sharepoint.com';
  const sitePath = `/sites/${siteName}`;

  console.log('Target SharePoint site:', siteName);

  try {
    if (!buff || !accessToken || !title || !siteName) {
      throw new Error('Missing required arguments for uploadPdf()');
    }

    // Step 1: Get site using direct path instead of search
    const siteUrl = `https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`;
    console.log('Getting site:', siteUrl);

    const siteRes = await fetch(siteUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const siteText = await siteRes.text();
    let siteData;
    try {
      siteData = JSON.parse(siteText);
    } catch {
      throw new Error(`Failed to parse site response: ${siteText}`);
    }

    if (!siteRes.ok || siteData.error) {
      throw new Error(
        `Could not access site "${siteName}" (HTTP ${siteRes.status}): ${JSON.stringify(siteData)}`
      );
    }

    const siteId = siteData.id;
    console.log('Site ID:', siteId);

    // Step 2: Get drives/libraries
    const drivesRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const drivesText = await drivesRes.text();
    let drivesData;
    try {
      drivesData = JSON.parse(drivesText);
    } catch {
      throw new Error(`Failed to parse drives response: ${drivesText}`);
    }

    if (!drivesRes.ok || !drivesData?.value?.length) {
      throw new Error(
        `No drives found for site ${siteName} (HTTP ${drivesRes.status}): ${JSON.stringify(drivesData)}`
      );
    }

    const drive = drivesData.value.find(d => d.name === libName);
    if (!drive) {
      const availableDrives = drivesData.value.map(d => d.name).join(', ');
      throw new Error(
        `Drive "${libName}" not found in site "${siteName}". Available drives: ${availableDrives}`
      );
    }

    const driveId = drive.id;
    console.log('Drive ID:', driveId);

    // Step 3: Upload file
    console.log(`Uploading PDF to SharePoint: ${title}.pdf`);

    const uploadRes = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(title)}.pdf:/content`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/pdf',
        },
        body: buff,
      }
    );

    const uploadText = await uploadRes.text();
    let uploadData;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      uploadData = { raw: uploadText };
    }

    if (!uploadRes.ok) {
      throw new Error(
        `Upload failed (HTTP ${uploadRes.status}): ${JSON.stringify(uploadData)}`
      );
    }

    console.log('Upload successful:', uploadData?.name || `${title}.pdf`);
    return uploadData;
  } catch (err) {
    console.error('uploadPdf error:', err.message);
    throw new Error(`uploadPdf failed for site "${siteName}": ${err.message}`);
  }
};

/**
 * Full SPR distribution pipeline:
 *  - get token
 *  - make PDF
 *  - upload to SharePoint
 *  - send email
 */
const handleSprDistribution = async (htmlBody, toAddress, siteId, vessel) => {
  // Token
  const accessToken = await getAccessToken365();

  // PDF
  const pdfBuffer = await mkPdfBuffer(htmlBody);
  if (!pdfBuffer) {
    throw new Error('Failed to generate PDF buffer.');
  }

  const title = `SPR-${new Date().toISOString().slice(0, 10)}`;

  // Upload
  const uploadResponse = await uploadPdf(pdfBuffer, accessToken, title, siteId);
  if (!uploadResponse || uploadResponse.error) {
    throw new Error(`PDF upload failed: ${JSON.stringify(uploadResponse)}`);
  }

  console.log('PDF uploaded successfully:', uploadResponse.name || title);

  // Vessel routing
  let fromEmail;
  let extraRecipients = [];

  switch (vessel) {
    case 'Gyre':
      fromEmail = 'gyre@tdi-bi.com';
      extraRecipients = ['mastergyre@tdi-bi.com'];
      break;
    case 'Brooks McCall':
      fromEmail = 'bmcc@tdi-bi.com';
      extraRecipients = ['masterbmcc@tdi-bi.com'];
      break;
    case 'Proteus':
      fromEmail = 'proteus@tdi-bi.com';
      extraRecipients = ['masterproteus@tdi-bi.com'];
      break;
    case 'Nautilus':
      fromEmail = 'nautilus@tdi-bi.com';
      extraRecipients = [
        'masternautilus@tdi-bi.com',
        'engineernautilus@tdi-bi.com',
        'nautilus@tdi-bi.com',
      ];
      break;
    case 'EMCC':
      fromEmail = 'emcc@tdi-bi.com';
      extraRecipients = ['masteremcc@tdi-bi.com'];
      break;
    case '3RD':
      fromEmail = 'thirdparty@tdi-bi.com';
      extraRecipients = [];
      break;
    default:
      fromEmail = 'no-reply@tdi-bi.com';
      extraRecipients = ['parkerseeley@tdi-bi.com'];
  }

  const allRecipients = [toAddress, ...extraRecipients];

  // Send email (no attachment — PDF already in SharePoint)
  await sendEmail(accessToken, fromEmail, allRecipients, title, htmlBody, null);

  console.log('SPR distribution completed successfully!');
};

/**
 * POST /testEmail
 */
router.post('/handleSprReport', async (req, res) => {
  console.log(
    '___________________________________________________________________________________'
  );
  console.log('Starting SPR email process...');

  try {
    const key = req.body.secretKey;
    if (key !== process.env.TOP_SECRET_KEY) {
      console.error('Invalid secret key');
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key',
      });
    }

    const { from, body, to, site, ship } = req.body;

    if (!from || !body || !to || !site || !ship) {
      return res.status(400).json({
        success: false,
        message: `Missing required parameters - ${!from ? 'from, ' : ''}${!body ? 'body, ' : ''}${!to ? 'to, ' : ''}${!site ? 'site, ' : ''}${!ship ? 'ship' : ''}`,
      });
    }

    console.log(`Writing SPR for ${ship} @ ${new Date().toISOString()}`);

    await handleSprDistribution(body, to, site, ship);

    return res.status(200).json({
      success: true,
      message: 'SPR email successfully processed.',
    });
  } catch (err) {
    console.error('Error during SPR send:', err);

    return res.status(500).json({
      success: false,
      message: 'Internal error while sending SPR - contact IT',
      error: err.message,
    });
  }
});

module.exports = router;
