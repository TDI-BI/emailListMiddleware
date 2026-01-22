const express = require('express');
const router = express.Router();

const { mkPdfBuffer } = require('../utils/mkPdfBuffer');
const { sendEmail } = require('../utils/sendEmail');
const { getAccessToken365 } = require('../utils/getTokens');

/**
 * Fetch shipment records from SharePoint list
 * @param {string} accessToken - Microsoft 365 access token
 * @returns {Promise<Array>} Array of shipment records
 */
const fetchShipmentRecords = async accessToken => {
  try {
    // SharePoint site and list info
    const siteUrl = 'tdibrooks.sharepoint.com';
    const sitePath = '/sites/Tech';
    const listName = 'Shipments';

    // Get site ID first
    const siteResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteUrl}:${sitePath}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!siteResponse.ok) {
      throw new Error(`Failed to get site: ${siteResponse.statusText}`);
    }

    const siteData = await siteResponse.json();
    const siteId = siteData.id;

    // Get list items
    const listResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items?expand=fields`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Failed to get list items: ${listResponse.statusText}`);
    }

    const listData = await listResponse.json();

    // Map SharePoint fields to our expected format
    const shipmentRecords = listData.value.map(item => ({
      Vessel: item.fields.Vessel || '',
      TrackingInfo: item.fields.TrackingInfo || '',
      Location: item.fields.Location || '',
      Shipment: item.fields.Shipment || '',
      ETD: item.fields.ETD || '',
      ETA: item.fields.ETA || '',
      Status: item.fields.Status || '',
      Notes: item.fields.Notes || '',
      Agents: item.fields.Agents || '',
    }));

    return shipmentRecords;
  } catch (error) {
    console.error('Error fetching shipment records from SharePoint:', error);
    throw error;
  }
};

/**
 * Build shipment report HTML
 */
const mkShipmentReportHtml = shipmentItems => {
  // Vessel color mapping
  const vesselColors = {
    NAUT: '#2c5aa0',
    PROT: '#27ae60',
    BMCC: '#ffc107',
    EMCC: '#8b0000',
    GYRE: '#e85d75',
    '3RD': '#20c997',
  };

  // Status color mapping
  const statusColors = {
    'In Transit': '#28a745',
    'On Vessel': '#007bff',
    'In Country': '#17a2b8',
    Pending: '#fd7e14',
    Delayed: '#ffc107',
    Cancelled: '#6c757d',
    Lost: '#dc3545',
  };

  // Group by vessel
  const groupedByVessel = shipmentItems.reduce((acc, item) => {
    const vessel = item.Vessel || 'UNKNOWN';
    if (!acc[vessel]) acc[vessel] = [];
    acc[vessel].push(item);
    return acc;
  }, {});

  const isOverdue = (etaString, status) => {
    if (
      !etaString ||
      status === 'On Vessel' ||
      status === 'Cancelled' ||
      status === 'Lost' ||
      status === 'In Country'
    )
      return false;

    const eta = new Date(etaString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eta < today;
  };

  const formatDate = dateString => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getBorderColor = (status, etaString) => {
    const overdue = isOverdue(etaString, status);
    if (overdue) return '#dc3545';
    return statusColors[status] || '#6c757d';
  };

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let html = `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Weekly Shipment Report</title>
<style>
  @media print {
    .vessel-section { page-break-inside: avoid; }
  }
</style>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">

<div style="background-color: white; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
  <div style="font-size: 24px; font-weight: bold;">Shipments Report</div>
  <div style="font-size: 14px; color: #666;">${currentDate}</div>
</div>
`;

  for (const [vessel, shipments] of Object.entries(groupedByVessel)) {
    const vesselColor = vesselColors[vessel] || '#6c757d';
    const trackingInfo = shipments[0].TrackingInfo || 'No tracking info';

    html += `
<div style="margin-bottom: 24px;">
  <div style="background-color: ${vesselColor}; color: white; padding: 14px 20px; border-radius: 6px 6px 0 0;">
    <div style="font-size: 20px; font-weight: bold;">${vessel}</div>
    <div style="font-size: 13px;">Tracking: ${trackingInfo}</div>
  </div>

  <div style="background-color: white; border: 1px solid #ddd; border-top: none; border-radius: 0 0 6px 6px; padding: 16px;">
`;

    shipments.forEach((shipment, index) => {
      const borderColor = getBorderColor(shipment.Status, shipment.ETA);
      const statusColor = statusColors[shipment.Status] || '#6c757d';
      const overdue = isOverdue(shipment.ETA, shipment.Status);

      html += `
<div style="padding: 16px; margin-bottom: 16px; background-color: #fafafa; border-left: 4px solid ${borderColor}; border-radius: 4px;">
  <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
    <div style="font-size: 16px; font-weight: 600;">Shipment #${index + 1}</div>
    <div style="display: flex; gap: 8px;">
      <div style="background-color: ${statusColor}; color: white; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: bold;">
        ${shipment.Status.toUpperCase()}
      </div>
      ${overdue ? `<div style="background-color:#dc3545;color:white;padding:5px 12px;border-radius:4px;font-size:11px;font-weight:bold;">OVERDUE</div>` : ''}
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
    <div><strong>Location:</strong> ${shipment.Location || '—'}</div>
    <div><strong>Agent:</strong> ${shipment.Agents || '—'}</div>
    <div><strong>ETD:</strong> ${formatDate(shipment.ETD)}</div>
    <div><strong>ETA:</strong> ${formatDate(shipment.ETA)}</div>
  </div>

  ${shipment.Shipment ? `<p><strong>Shipment:</strong> ${shipment.Shipment}</p>` : ''}
  ${shipment.Notes ? `<div style="background:#fff9e6;padding:10px;border-left:3px solid #ffc107;"><strong>Notes:</strong> ${shipment.Notes}</div>` : ''}
</div>
`;
    });

    html += `
  </div>
</div>
`;
  }

  html += `
</body>
</html>
`;

  return html;
};

/**
 * GET /mkShipmentReport
 */
router.get('/mkShipmentReport', async (req, res) => {
  try {
    // Token
    const accessToken = await getAccessToken365();

    // Get data
    const shipmentRecords = await fetchShipmentRecords(accessToken);

    // Build HTML
    const reportHtml = mkShipmentReportHtml(shipmentRecords);

    // Make PDF
    const reportPdf = await mkPdfBuffer(reportHtml);

    // Email
    const fromEmail = 'no-reply@tdi-bi.com';
    const toEmail = ['parkerseeley@tdi-bi.com'];
    const subject = `Weekly Shipment Report - ${new Date().toLocaleDateString(
      'en-US',
      {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }
    )}`;

    const emailBody = `
            <html>
              <body style="font-family: Arial, sans-serif; padding: 20px;">
                <p>Hello,</p>
                <p>Attached is your weekly shipment report.</p>
                <p>Best regards,<br/>TDI Logistics</p>
              </body>
            </html>
        `;

    await sendEmail(
      accessToken,
      fromEmail,
      toEmail,
      subject,
      emailBody,
      reportPdf
    );

    console.log('Shipment report generated and emailed successfully');

    // Return HTML for browser preview
    res.setHeader('Content-Type', 'text/html');
    res.send(reportHtml);
  } catch (error) {
    console.error('Shipment report error:', error);

    res.status(500).json({
      error: 'Failed to generate or send shipment report',
      details: error.message,
    });
  }
});

module.exports = router;
