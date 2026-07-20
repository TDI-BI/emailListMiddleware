const express = require('express');
const {getAccessToken365} = require("../utils/getTokens");
const {sendEmail} = require("../utils/sendEmail");
const router = express.Router();

router.get('/weeklyTaskReport', async (req, res) => {


    const siteUrl = 'tdibrooks.sharepoint.com';
    const sitePath = '/sites/Marine';
    const listName = "Scheduled Task"

    const accessToken = await getAccessToken365();


    const siteResponse = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteUrl}:${sitePath}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    );

    const siteData = await siteResponse.json();
    const siteId = siteData.id;

    const today = new Date();
    const ninetyDaysOut = new Date();
    ninetyDaysOut.setDate(today.getDate() + 90);

    const startDateFilter = `fields/StartDate le '${ninetyDaysOut.toISOString()}'`;

    const TasksListFromSharepoint = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items?$expand=fields&$filter=${encodeURIComponent(startDateFilter)}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly',
            },
        }
    );
    const ScheduledTasksRaw = await TasksListFromSharepoint.json();
    const ScheduledTasks = ScheduledTasksRaw.value.map(e => e.fields);

    const LocationsListFromSharepoint = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/Locations/items?expand=fields`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    ); //grab all of theses
    const LocationsListRaw = await LocationsListFromSharepoint.json();
    const Locations = LocationsListRaw.value.map(e => e.fields)

    //we search over "Start Date"
    const TaskClassesFromSharepoint = await fetch(
        `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/Task Class/items?expand=fields`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        }
    ); //grab all of thses
    const TaskClassesRaw = await TaskClassesFromSharepoint.json();
    const TaskClasses = TaskClassesRaw.value.map(e => e.fields)

    const classById = new Map(TaskClasses.map((c) => [String(c.id), c]));
    const locationById = new Map(Locations.map((l) => [String(l.id), l]));

    const formatDate = (isoString) => new Date(isoString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });

    const msPerDay = 1000 * 60 * 60 * 24;

    const within30 = [];
    const within60 = [];
    const within90 = [];

    for (const scheduledTask of ScheduledTasks) {
        const startDate = new Date(scheduledTask.StartDate);
        const daysOut = Math.ceil((startDate - today) / msPerDay);

        if (daysOut < 0 || daysOut > 90) continue;

        const item = {
            task: classById.get(String(scheduledTask.ClassLookupId))?.Title ?? 'Unknown Task',
            location: locationById.get(String(scheduledTask.LocationLookupId))?.Title ?? 'Unknown Location',
            startDate: formatDate(scheduledTask.StartDate),
        };

        if (daysOut <= 30) within30.push(item);
        else if (daysOut <= 60) within60.push(item);
        else within90.push(item);
    }

    const total = within30.length + within60.length + within90.length;

    const renderRows = (items) => {
        const sorted = [...items].sort((a, b) => a.location.localeCompare(b.location));

        const locationCounts = sorted.reduce((counts, item) => {
            counts[item.location] = (counts[item.location] || 0) + 1;
            return counts;
        }, {});

        let lastLocation = null;

        return sorted.map((item) => {
            const locationRibbon = item.location === lastLocation ? '' : `
                            <tr style="display: table-row !important;">
                                <td colspan="3" style="display: table-cell !important; padding: 8px 14px; background: rgb(243, 244, 246); border-bottom: 1px solid rgb(229, 229, 229);">
                                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">
                                        <tr style="display: table-row !important;">
                                            <td style="display: table-cell !important; white-space: nowrap; font-size: 11px; font-weight: 700; color: rgb(107, 114, 128); text-transform: uppercase; letter-spacing: 0.06em;">${item.location}</td>
                                            <td align="right" style="display: table-cell !important; text-align: right;">
                                                <span style="font-size: 11px; font-weight: 600; color: rgb(107, 114, 128); background: rgb(243, 244, 246); border: 1.5px solid rgb(107, 114, 128); border-radius: 20px; padding: 1px 9px;">${locationCounts[item.location]}</span>
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>`;
            lastLocation = item.location;

            return `${locationRibbon}
                            <tr style="display: table-row !important;">
                                <td style="display: table-cell !important; max-width: 300px; padding: 10px 14px; border-bottom: 1px solid rgb(235, 235, 235); font-size: 14px; color: rgb(26, 26, 26); font-weight: 500; word-break: break-word;">${item.task}</td>
                                <td style="display: table-cell !important; padding: 10px 14px; border-bottom: 1px solid rgb(235, 235, 235); font-size: 13px; color: rgb(85, 85, 85);">${item.startDate}</td>
                                <td style="display: table-cell !important; padding: 10px 14px; border-bottom: 1px solid rgb(235, 235, 235);">&nbsp;</td>
                            </tr>`;
        }).join('');
    };

    const renderSection = (items, label, {bg, accent, text}) => {
        if (items.length === 0) return '';

        return `
                        <tr style="display: table-row !important;">
                            <td style="display: table-cell !important; padding-bottom: 28px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse; margin-bottom: 8px;">
                                    <tr style="display: table-row !important;">
                                        <td style="display: table-cell !important; background: ${bg}; border-left: 3px solid ${accent}; padding: 7px 14px; font-size: 13px; font-weight: 700; color: ${text}; letter-spacing: 0.05em; text-transform: uppercase;">${label}</td>
                                        <td align="right" style="display: table-cell !important; background: ${bg}; border-radius: 0px 4px 4px 0px; padding: 7px 14px; text-align: right;">
                                            <span style="font-size: 12px; font-weight: 600; color: ${text}; background: ${bg}; border: 1.5px solid ${text}; border-radius: 20px; padding: 1px 9px;">${items.length}</span>
                                        </td>
                                    </tr>
                                </table>
                                <table style="display: table !important; width: 100%; border-collapse: collapse; table-layout: fixed;">
                                    <thead>
                                        <tr style="display: table-row !important;">
                                            <th width="60%" style="display: table-cell !important; width: 60%; max-width: 300px; padding: 6px 14px; text-align: left; font-size: 11px; font-weight: 600; color: rgb(153, 153, 153); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid rgb(229, 229, 229);">Task</th>
                                            <th width="25%" style="display: table-cell !important; width: 25%; padding: 6px 14px; text-align: left; font-size: 11px; font-weight: 600; color: rgb(153, 153, 153); text-transform: uppercase; letter-spacing: 0.06em; border-bottom: 1px solid rgb(229, 229, 229);">Start Date</th>
                                            <th style="display: table-cell !important; padding: 6px 14px; border-bottom: 1px solid rgb(229, 229, 229);">&nbsp;</th>
                                        </tr>
                                    </thead>
                                    <tbody>${renderRows(items)}
                                    </tbody>
                                </table>
                            </td>
                        </tr>`;
    };

    const html = `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F7F8FC" style="display: table !important; background-color: rgb(247, 248, 252); border-collapse: collapse; font-family: Inter, 'Segoe UI', system-ui, sans-serif;">
            <tr style="display: table-row !important;">
                <td style="display: table-cell !important; padding: 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#4F46E5" style="display: table !important; background-color: rgb(79, 70, 229); border-collapse: collapse;">
                        <tr style="display: table-row !important;">
                            <td style="display: table-cell !important; padding: 28px 32px 24px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">
                                    <tr style="display: table-row !important;">
                                        <td valign="top" align="left">
                                            <div style="font-size: 22px; font-weight: 700; color: rgb(255, 255, 255); line-height: 1.2;">Upcoming Tasks</div>
                                            <div style="font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.9); margin-top: 2px;">July 8, 2026</div>
                                        </td>
                                    </tr>
                                </table>
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">
                                    <tr style="display: table-row !important;">
                                        <td style="display: table-cell !important; padding-top: 20px;">
                                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">
                                                <tr style="display: table-row !important;">
                                                    <td style="display: table-cell !important; border-top: 1px solid rgba(255, 255, 255, 0.15); padding-top: 16px;">
                                                        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">
                                                            <tr style="display: table-row !important;">
                                                                <td valign="top" align="left" style="display: table-cell !important; padding-right: 24px;">
                                                                    <div style="font-size: 20px; font-weight: 700; color: rgb(255, 82, 82);">${within30.length}</div>
                                                                    <div style="width: 40px; font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">30 Days</div>
                                                                </td>
                                                                <td valign="top" align="left" style="display: table-cell !important; padding-right: 24px;">
                                                                    <div style="font-size: 20px; font-weight: 700; color: rgb(232, 150, 45);">${within60.length}</div>
                                                                    <div style="width: 40px;  font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">31 - 60 Days</div>
                                                                </td>
                                                                <td valign="top" align="left" style="display: table-cell !important; padding-right: 24px;">
                                                                    <div style="font-size: 20px; font-weight: 700; color: rgba(255, 255, 255, 0.95);">${within90.length}</div>
                                                                    <div style="width: 40px;  font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">61 - 90 Days</div>
                                                                </td>
                                                                <td valign="top" align="right" width="100%" style="display: table-cell !important; text-align: right;">
                                                                    <div style="font-size: 20px; font-weight: 700; color: rgb(255, 255, 255);">${total}</div>
                                                                    <div style="font-size: 11px; color: rgba(255, 255, 255, 0.6); margin-top: 2px;">Total</div>
                                                                </td>
                                                            </tr>
                                                        </table>
                                                    </td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">
                        <tr style="display: table-row !important;">
                            <td style="display: table-cell !important; padding: 28px 10px 10px;">
                                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="display: table !important; border-collapse: collapse;">${renderSection(within30, 'Within 30 Days', {
        bg: 'rgb(255, 240, 240)',
        accent: 'rgb(255, 82, 82)',
        text: 'rgb(220, 38, 38)'
    })}${renderSection(within60, '31 - 60 Days', {
        bg: 'rgb(255, 247, 237)',
        accent: 'rgb(232, 150, 45)',
        text: 'rgb(180, 95, 6)'
    })}${renderSection(within90, '61 - 90 Days', {
        bg: 'rgb(240, 241, 255)',
        accent: 'rgb(79, 70, 229)',
        text: 'rgb(79, 70, 229)'
    })}
                                </table>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    `;


    const resp = await sendEmail(
        accessToken,
        'parkerseeley@tdi-bi.com',
        ['parkerseeley@tdi-bi.com', 'parseeley01@aol.com', 'frankfeurtado@tdi-bi.com'],
        'test report',
        html,
    );

    res.send(html);
});

module.exports = router;
