const express = require("express");
require("dotenv").config();
const axios = require("axios");
const apicache = require("apicache");

const app = express();
const cache = apicache.middleware;

//this requires some version of cromium running on your system
//if you are on computer just install chrome ez, but if you are on linux
//you have to manually download a bunch of dependencies, you can look them up
const puppeteer = require("puppeteer");

if (process.env.PROD != "true") {
    //we need this when running local dev env :p
    const cors = require("cors");
    app.use(cors());
}

//lets me pass extra stuff in posts
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.get("/favicon.ico", (req, res) => res.status(204).end()); // make my browser shut the fuck up

//helper functions
//i should go through and just make this into one global access token probs
const getAccessTokenLists = async () => {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.TENANT_ID}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
        client_id: process.env.APP_ID,
        client_secret: process.env.SECRET_VAL,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
    });
    try {
        const response = await axios.post(tokenUrl, params, {
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
        });
        return response.data.access_token;
    } catch (e) {
        console.error("error gaining access token:", e.response?.data || e.message);
        return null;
    }
};
const getAccessTokenm365 = async () => {
    const params = new URLSearchParams();
    params.append("grant_type", "client_credentials");
    params.append("client_id", process.env.CLIENTID);
    params.append("client_secret", process.env.CLIENTSECRET);
    params.append("scope", "https://graph.microsoft.com/.default");

    const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${process.env.TENANTID}/oauth2/v2.0/token`,
        {
            method: "POST",
            headers: {"Content-Type": "application/x-www-form-urlencoded"},
            body: params.toString(),
        }
    );

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
        const message = `Token request failed (${tokenResponse.status}): ${JSON.stringify(tokenData)}`;
        throw new Error(message);
    }

    if (!tokenData.access_token) {
        throw new Error("No access token received from Microsoft Graph.");
    }

    return tokenData.access_token;
};


app.get("/getAll", async (req, res) => {
    const groups = await getGroups();
    const allInf = groups.filter(item => item.displayName === 'All Users')[0];
    if (process.env.PROD === 'true') return;
    const allId = allInf.id
    const allGroup = await getGroupMembers(allId);
    res.json({
        allGroup
    });
});
const getAllUserEmails = async () => {
    const token = await getAccessTokenLists();
    if (!token) return null;

    try {
        //i dont remember how to use graph to get groupId, but I need to do it for all

        const allid = 'placeholder';
        //literally why am i using axios??

        const allGroups = await getGroups();
        //filter for all
        const allId = 'placeholder xdd'; // allGroups.all.ID

        return getGroupMembers(allid);


    } catch (e) {
        console.error("error fetching data", e)
    }
}

const getGroupMembers = async (groupId) => {
    const token = await getAccessTokenLists(); // old
    if (!token) return null;

    try {
        const response = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: {Authorization: `Bearer ${token}`},
            },
        );
        return response.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

const getGroups = async () => {
    // throws error but who cares, connection clearly established
    const token = await getAccessTokenLists(); // old
    if (!token) return null;
    try {
        const response = await axios.get(`${process.env.GRAPH_API_URL}/groups`, {
            headers: {Authorization: `Bearer ${token}`},
        });
        return response.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

app.get("/", (req, res) => {
    res.send(
        "haiii<br>to see email groups use ./group<br>to see all groups use ./groups",
    );
});

app.get("/group", cache("1 hour"), async (req, res) => {
    const inid = req.query.id;

    const groupById = await getGroupMembers(inid); // need to actually pull user infoge

    if (groupById == null) {
        res.status(500);
        return;
    }

    res.json({
        groupById,
    });
});

app.get("/groups", cache("1 hour"), async (req, res) => {
    const WECAREABOUT = [
        "Marine",
        "Travel",
        "Designated Person Ashore",
        "Tech",
        "Daily Progress Report",
        "Operations",
        "Acctspayable",
        "Survey Processing",
        "Movements",
        "IT",
        "Logistics",
        "Accounts Payable",
        "Survey Technical",
        "Resupply",
        "Marketing",
        "Crew Documentation",
        "Information Technology",
    ];

    const groups = await getGroups();
    const ret = groups
        .filter((itm) => WECAREABOUT.includes(itm.displayName))
        .map((e) => ({id: e.id, desc: e.displayName, mail: e.mail}));

    if (ret == null) {
        res.status(500);
        return;
    }

    res.json({
        ret,
    });
});

const getGroupByName = async (maillistName) => {
    // throws error but who cares, connection clearly established
    const token = await getAccessTokenLists(); // old
    if (!token) return null;

    try {
        const responseG = await axios.get(
            `${process.env.GRAPH_API_URL}/groups?$filter=mail eq '${maillistName}@tdi-bi.com'`,
            {
                headers: {Authorization: `Bearer ${token}`},
            },
        );
        if (responseG.data.value == null) console.error("no such group exists");
        const groupId = responseG.data.value[0].id;

        const responseM = await axios.get(
            `${process.env.GRAPH_API_URL}/groups/${groupId}/members`,
            {
                headers: {Authorization: `Bearer ${token}`},
            },
        );

        return responseM.data.value;
    } catch (e) {
        console.error("error fetching data:", e.response?.data || e.message);
        return null;
    }
};

app.get("/groupByName", async (req, res) => {
    const name = req.query.name;

    const group = await getGroupByName(name);

    if (group == null) {
        res.status(500);
        return;
    }

    res.json({
        group,
    });
});

//pdf maker
const generatePdfBuffer = async (htmlStr) => {
    const browser = await puppeteer.launch({
        headless: "new", // Use "new" in Puppeteer v20+ / Node 20+
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    await page.setContent(htmlStr, {
        waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
    });

    await browser.close();

    // Ensure we return a real Buffer
    if (Buffer.isBuffer(pdfBuffer)) {
        return pdfBuffer;
    } else if (pdfBuffer instanceof Uint8Array) {
        return Buffer.from(pdfBuffer);
    } else {
        throw new Error("Unexpected buffer type received from generatePdfBuffer");
    }
};

const uploadPdf = async (buff, accessToken, title, spSiteName) => {
    const libName = "Spr Reports";
    console.log("Target SharePoint site:", spSiteName);

    try {
        if (!buff || !accessToken || !title || !spSiteName) {
            throw new Error("Missing required arguments for uploadPdf()");
        }

        // Step 1: Find the site
        const siteRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites?search=${encodeURIComponent(spSiteName)}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const siteText = await siteRes.text();
        let siteData;
        try {
            siteData = JSON.parse(siteText);
        } catch (err) {
            throw new Error(`Failed to parse site search response: ${siteText}`);
        }

        if (!siteRes.ok || !siteData?.value?.length) {
            throw new Error(
                `Could not find site "${spSiteName}" (HTTP ${siteRes.status}): ${JSON.stringify(siteData)}`
            );
        }

        const siteId = siteData.value[0].id;

        // Step 2: Get drives/libraries for that site
        const drivesRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const drivesText = await drivesRes.text();
        let drivesData;
        try {
            drivesData = JSON.parse(drivesText);
        } catch (err) {
            throw new Error(`Failed to parse drives response: ${drivesText}`);
        }

        if (!drivesRes.ok || !drivesData?.value?.length) {
            throw new Error(
                `No drives found for site ${spSiteName} (HTTP ${drivesRes.status}): ${JSON.stringify(drivesData)}`
            );
        }

        const drive = drivesData.value.find((d) => d.name === libName);
        if (!drive) {
            throw new Error(`Drive "${libName}" not found in site "${spSiteName}"`);
        }

        const driveId = drive.id;

        // Step 3: Upload the file
        console.log(`Uploading PDF to SharePoint: ${title}.pdf`);
        const uploadRes = await fetch(
            `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(title)}.pdf:/content`,
            {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/pdf",
                },
                body: buff,
            }
        );

        const uploadText = await uploadRes.text();
        let uploadData;
        try {
            uploadData = JSON.parse(uploadText);
        } catch {
            uploadData = {raw: uploadText};
        }

        if (!uploadRes.ok) {
            throw new Error(
                `Upload failed (HTTP ${uploadRes.status}): ${JSON.stringify(uploadData)}`
            );
        }

        console.log("Upload successful:", uploadData?.name || `${title}.pdf`);
        return uploadData;
    } catch (err) {
        console.error("uploadPdf error:", err.message);
        throw new Error(`uploadPdf failed for site "${spSiteName}": ${err.message}`);
    }
};



const sendEmail = async (accessToken, fromUserEmail, toAddress, subject, body, pdfBuffer = null) => {
    const emailBody = {
        message: {
            subject: subject,
            body: {contentType: "HTML", content: body},
            toRecipients: toAddress.map((address) => ({
                emailAddress: {address},
            })),
        },
        saveToSentItems: false,
    };

    // Only add attachments if pdfBuffer is provided
    if (pdfBuffer && Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 0) {
        const base64Attachment = pdfBuffer.toString("base64");
        emailBody.message.attachments = [
            {
                "@odata.type": "#microsoft.graph.fileAttachment",
                name: `${subject}.pdf`,
                contentType: "application/pdf",
                contentBytes: base64Attachment,
            },
        ];
    }

    // Send email
    const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${fromUserEmail}/sendMail`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(emailBody),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
            `Send mail failed (${response.status}): ${JSON.stringify(errorData)}`
        );
    }

    console.log("Email sent successfully!");
};


const handleSprDistribution = async (htmlBody, toAddress, siteId, shipmentData) => {
    // Generate access token
    const accessToken = await getAccessTokenm365(); // new

    // Generate PDF
    const pdfBuffer = await generatePdfBuffer(htmlBody);
    if (!pdfBuffer) {
        throw new Error("Failed to generate PDF buffer.");
    }

    const title = `SPR-${new Date().toISOString().slice(0, 10)}`;

    // Upload PDF to SharePoint
    const uploadResponse = await uploadPdf(pdfBuffer, accessToken, title, siteId);
    if (!uploadResponse || uploadResponse.error) {
        throw new Error(`PDF upload failed: ${JSON.stringify(uploadResponse)}`);
    }
    console.log("PDF uploaded successfully:", uploadResponse);

    // Determine unique vessels in the shipment data
    const vessels = [...new Set(shipmentData.map(item => item.Vessel))];

    // Send email for each vessel with ship-specific config
    for (const vessel of vessels) {
        let fromEmail;
        let extraRecipients = [];

        switch (vessel) {
            case "GYRE":
                fromEmail = "gyre@tdi-bi.com";
                extraRecipients = ["mastergyre@tdi-bi.com"];
                break;
            case "BMCC":
                fromEmail = "bmcc@tdi-bi.com";
                extraRecipients = ["masterbmcc@tdi-bi.com"];
                break;
            case "PROT":
                fromEmail = "proteus@tdi-bi.com";
                extraRecipients = ["masterproteus@tdi-bi.com"];
                break;
            case "NAUT":
                fromEmail = "nautilus@tdi-bi.com";
                extraRecipients = [
                    "masternautilus@tdi-bi.com",
                    "engineernautilus@tdi-bi.com",
                    "nautilus@tdi-bi.com",
                ];
                break;
            case "EMCC":
                fromEmail = "emcc@tdi-bi.com";
                extraRecipients = ["masteremcc@tdi-bi.com"];
                break;
            case "3RD":
                fromEmail = "thirdparty@tdi-bi.com";
                extraRecipients = [];
                break;
            default:
                fromEmail = "no-reply@tdi-bi.com";
                extraRecipients = ["parkerseeley@tdi-bi.com"];
        }

        const allRecipients = [toAddress, ...extraRecipients];

        // Send email WITHOUT pdf attachment (empty buffer)
        await sendEmail(accessToken, fromEmail, allRecipients, title, htmlBody, null);
    }

    console.log("SPR distribution completed successfully!");
};


app.post("/testEmail", async (req, res) => {
    console.log("___________________________________________________________________________________");
    console.log("Starting email process...");

    try {
        const key = req.body.secretKey;
        if (key !== process.env.TOP_SECRET_KEY) {
            console.error("Invalid secret key");
            return res.status(403).json({
                success: false,
                message: "Invalid secret key",
            });
        }

        const {from, body, to, site, ship} = req.body;

        if (!from || !body || !to || !site || !ship) {
            return res.status(400).json({
                success: false,
                message: `Missing required parameters - ${!from ? 'from, ' : ''}${!body ? 'body, ' : ''}${!to ? 'to, ' : ''}${!site ? 'site, ' : ''}${!ship ? 'ship' : ''}`,
            });
        }

        console.log(`Writing for ${ship} @ ${new Date().toISOString()}`);

        await handleSprDistribution(from, body, to, site, ship);

        return res.status(200).json({
            success: true,
            message: "Email successfully queued/sent.",
        });

    } catch (err) {
        console.error("Error during email send:", err);
        return res.status(500).json({
            success: false,
            message: "Internal error while sending email - contact IT",
            error: err.message,
        });
    }
});

const mkShipmentReportHtml = (shipmentItems) => {
    // Vessel color mapping
    const vesselColors = {
        'NAUT': '#2c5aa0',
        'PROT': '#27ae60',
        'BMCC': '#ffc107',
        'EMCC': '#8b0000',
        'GYRE': '#e85d75',
        '3RD': '#20c997'
    };

    // Status color mapping
    const statusColors = {
        'In Transit': '#28a745',
        'On Vessel': '#007bff',
        'In Country': '#17a2b8',
        'Pending': '#fd7e14',
        'Delayed': '#ffc107',
        'Cancelled': '#6c757d',
        'Lost': '#dc3545'
    };

    // Group shipments by vessel
    const groupedByVessel = shipmentItems.reduce((acc, item) => {
        const vessel = item.Vessel || 'UNKNOWN';
        if (!acc[vessel]) {
            acc[vessel] = [];
        }
        acc[vessel].push(item);
        return acc;
    }, {});

    // Helper function to check if overdue (not for In Country)
    const isOverdue = (etaString, status) => {
        if (!etaString || status === 'On Vessel' || status === 'Cancelled' || status === 'Lost' || status === 'In Country') return false;
        const eta = new Date(etaString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return eta < today;
    };

    // Helper function to format date
    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    };

    // Helper function to get border color (overdue takes priority)
    const getBorderColor = (status, etaString) => {
        const overdue = isOverdue(etaString, status);
        if (overdue) {
            return '#dc3545'; // Red for overdue (not In Country)
        }
        return statusColors[status] || '#6c757d';
    };

    // Get current date for header
    const currentDate = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    // Build HTML
    let html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Shipment Report</title>
  <style>
      @media print {
        .vessel-section {
          page-break-inside: avoid;
        }
      }
    </style>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
  
  <!-- Global Header -->
  <div style="background-color: white; border: 1px solid #ddd; border-radius: 6px; padding: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="font-size: 24px; font-weight: bold; color: #1a1a1a;">Shipments Report</div>
    <div style="font-size: 14px; color: #666;">${currentDate}</div>
  </div>
`;

    // Iterate through each vessel
    for (const [vessel, shipments] of Object.entries(groupedByVessel)) {
        const vesselColor = vesselColors[vessel] || '#6c757d';
        const trackingInfo = shipments[0].TrackingInfo || 'No tracking info';

        html += `
  <!-- ${vessel} Ship Section -->
  <div style="margin-bottom: 24px;">
    <!-- Ship Header -->
    <div style="background-color: ${vesselColor}; color: white; padding: 14px 20px; border-radius: 6px 6px 0 0; margin-bottom: 0;">
      <div style="font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">${vessel}</div>
      <div style="font-size: 13px; opacity: 0.9; margin-top: 4px;">Tracking: ${trackingInfo}</div>
    </div>
    
    <!-- Shipment Items Container -->
    <div style="background-color: white; border: 1px solid #ddd; border-top: none; border-radius: 0 0 6px 6px; padding: 16px;">
`;

        // Iterate through each shipment for this vessel
        shipments.forEach((shipment, index) => {
            const borderColor = getBorderColor(shipment.Status, shipment.ETA);
            const statusColor = statusColors[shipment.Status] || '#6c757d';
            const overdue = isOverdue(shipment.ETA, shipment.Status);
            const marginBottom = index < shipments.length - 1 ? 'margin-bottom: 16px;' : '';

            html += `
      <!-- Shipment ${index + 1} -->
      <div style="padding: 16px; ${marginBottom} background-color: #fafafa; border-left: 4px solid ${borderColor}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 16px; font-weight: 600; color: #1a1a1a;">Shipment #${index + 1}</div>
          <div style="display: flex; gap: 8px;">
            <div style="background-color: ${statusColor}; color: white; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: bold;">
              ${shipment.Status.toUpperCase()}
            </div>
`;

            if (overdue) {
                html += `
            <div style="background-color: #dc3545; color: white; padding: 5px 12px; border-radius: 4px; font-size: 11px; font-weight: bold;">
              OVERDUE
            </div>
`;
            }

            html += `
          </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
`;

            // Location
            if (shipment.Location) {
                html += `
          <div>
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Location</div>
            <div style="font-size: 14px; color: #333; font-weight: 500;">${shipment.Location}</div>
          </div>
`;
            }

            // Agent
            if (shipment.Agents) {
                html += `
          <div>
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Agent</div>
            <div style="font-size: 14px; color: #333; font-weight: 500;">${shipment.Agents}</div>
          </div>
`;
            }

            // ETD
            html += `
          <div>
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px;">ETD</div>
            <div style="font-size: 14px; color: #333;">${formatDate(shipment.ETD)}</div>
          </div>
`;

            // ETA
            const etaColor = overdue ? '#dc3545' : '#333';
            const etaWeight = overdue ? 'font-weight: 600;' : '';
            html += `
          <div>
            <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px;">ETA</div>
            <div style="font-size: 14px; color: ${etaColor}; ${etaWeight}">${formatDate(shipment.ETA)}</div>
          </div>
`;

            html += `
        </div>
`;

            // Shipment description
            if (shipment.Shipment) {
                html += `
        <div style="margin-bottom: ${shipment.Notes ? '12px' : '0'};">
          <div style="font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 4px;">Shipment</div>
          <div style="font-size: 14px; color: #333;">${shipment.Shipment}</div>
        </div>
`;
            }

            // Notes
            if (shipment.Notes) {
                html += `
        <div style="background-color: #fff9e6; border-left: 3px solid #ffc107; padding: 10px; border-radius: 3px;">
          <div style="font-size: 11px; color: #856404; text-transform: uppercase; margin-bottom: 4px; font-weight: bold;">Notes</div>
          <div style="font-size: 13px; color: #856404;">${shipment.Notes}</div>
        </div>
`;
            }

            html += `
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


app.get("/mkShipmentReport", async (req, res) => {

    const shipmentRecords = [
        {
            "Vessel": "GYRE",
            "TrackingInfo": "BOL 10890846",
            "Location": "POS",
            "Shipment": "Resupply crates with emergent engineering parts - LP",
            "ETD": "2025-06-26",
            "ETA": "2025-08-03",
            "Status": "In Country",
            "Notes": "",
            "Agents": ""
        },
        {
            "Vessel": "PROT",
            "TrackingInfo": "S00228904",
            "Location": "Lagos",
            "Shipment": "Multiple crates of general resupply - 40' container TEMA",
            "ETD": "2025-07-01",
            "ETA": "2025-09-12",
            "Status": "In Country",
            "Notes": "",
            "Agents": ""
        },
        {
            "Vessel": "PROT",
            "TrackingInfo": "",
            "Location": "Lagos",
            "Shipment": "2 containers of seismic gear for Nautilus (Loaded and off the Proteus staged in Lagos)",
            "ETD": "",
            "ETA": "",
            "Status": "Pending",
            "Notes": "",
            "Agents": ""
        },
        {
            "Vessel": "PROT",
            "TrackingInfo": "",
            "Location": "Lagos",
            "Shipment": "Resupply crate to Lagos",
            "ETD": "2025-12-18",
            "ETA": "2025-12-25",
            "Status": "In Country",
            "Notes": "",
            "Agents": ""
        },
        {
            "Vessel": "3RD",
            "TrackingInfo": "",
            "Location": "",
            "Shipment": "Ocean Infinity: 1 - 10' and 2 - 40' containers to Trinidad",
            "ETD": "2025-12-02",
            "ETA": "2025-12-26",
            "Status": "In Country",
            "Notes": "",
            "Agents": ""
        },
        {
            "Vessel": "3RD",
            "TrackingInfo": "",
            "Location": "",
            "Shipment": "Ocean Infinity Sample Crates",
            "ETD": "2026-01-08",
            "ETA": "2026-01-11",
            "Status": "In Country",
            "Notes": "",
            "Agents": ""
        }
    ];

    try {
        // Generate the report HTML
        const reportHtml = mkShipmentReportHtml(shipmentRecords);

        // Generate PDF buffer
        const reportPdf = await generatePdfBuffer(reportHtml);

        // Get access token
        const accessToken = await getAccessTokenm365(); // new

        // Email details
        const fromEmail = "no-reply@tdi-bi.com";
        const toEmail = ["parkerseeley@tdi-bi.com"];
        const subject = `Weekly Shipment Report - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        const emailBody = `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px;">
                    <p>Hello,</p>
                    <p>Attached is your weekly shipment report.</p>
                    <p>Best regards,<br/>TDI Logistics</p>
                </body>
            </html>
        `;

        // Send email with PDF attachment
        await sendEmail(accessToken, fromEmail, toEmail, subject, emailBody, reportPdf);

        console.log("Report generated and emailed successfully!");

        // Return the HTML for browser viewing
        res.setHeader('Content-Type', 'text/html');
        res.send(reportHtml);

    } catch (error) {
        console.error("Error generating/sending report:", error);
        res.status(500).json({ error: "Failed to generate or send report", details: error.message });
    }
});

app.get("/testroute1", async (req, res) => {
    res.json({msg: "madeit!"});
});

app.listen(1902);
