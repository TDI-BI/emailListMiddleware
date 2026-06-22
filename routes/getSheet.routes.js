const express = require('express');
const router = express.Router();

const VESSEL_MAP = {
  'Brooks McCall': 'BMCC',
  'Emma McCall': 'EMMA',
};

const SHEET_ID = 'gCC5PV5qGg66HjPcqWxGxCfrWxHX53QjC3wwH9J1';

/**
 * GET /getSheet
 * Returns project rows from the scheduling Smartsheet.
 * Query params:
 *   - inVessel: vessel display name or code (optional)
 *   - windowStart: ISO date — exclude projects that end before this (optional)
 *   - windowEnd: ISO date — exclude projects that start after this (optional)
 */

router.get('/getSheet', async (req, res) => {
  try {
    const { inVessel, windowStart, windowEnd } = req.query;

    const vesselFilter = VESSEL_MAP[inVessel] ?? inVessel;

    const query = new URLSearchParams({
      accessApiLevel: '0',
      level: '0',
    }).toString();

    const resp = await fetch(
      `https://api.smartsheet.com/2.0/sheets/${SHEET_ID}?${query}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${process.env.SS_TOK}`,
          'smartsheet-integration-source': 'AI,SampleOrg,My-AI-Connector-v2',
          Accept: 'string',
        },
      }
    );

    if (!resp.ok) {
      throw new Error(`Smartsheet API error: ${resp.status} ${resp.statusText}`);
    }

    const data = await resp.json();
    const cols = data.columns;
    const idx = (title) => cols.findIndex((col) => col.title === title);

    const proposedVessel  = idx('Proposed Vessel');
    const anticipatedStart = idx('Anticipated Start Date (Calendar)');
    const anticipatedEnd  = idx('Anticipated End Date');
    const actualVessel    = idx('Actual Vessel');
    const actualStart     = idx('Start Date');
    const actualEnd       = idx('Survey End Date');
    const region          = idx('Region');
    const location        = idx('Project Location');
    const client          = idx('Client');
    const projectName     = idx('Project Name');

    const cells = data.rows
      .map((item) => {
        const c = item.cells;

        const vessel    = c[actualVessel]?.value  || c[proposedVessel]?.value;
        const startDate = c[actualStart]?.value   || c[anticipatedStart]?.value;
        const endDate   = c[actualEnd]?.value     || c[anticipatedEnd]?.value;

        if (!vessel || !startDate || !endDate) return null;
        if (vesselFilter && vessel !== vesselFilter) return null;
        if (windowStart && new Date(endDate)   < new Date(windowStart)) return null;
        if (windowEnd   && new Date(startDate) > new Date(windowEnd))   return null;

        return {
          title:         `${c[client]?.value} - ${c[projectName]?.value}`,
          titleDetailed: `${c[client]?.value} - ${c[projectName]?.value} (${c[region]?.value}, ${c[location]?.value})`,
          startDate,
          endDate,
          vessel,
          isProposal: !c[actualVessel]?.value,
        };
      })
      .filter(Boolean);

    res.json(cells);
  } catch (err) {
    console.error('Error in getSheet:', err);
    res.status(500).json({ msg: 'there is an error', err: err.message });
  }
});

module.exports = router;
