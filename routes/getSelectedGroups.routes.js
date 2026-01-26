const express = require('express');
const router = express.Router();

const { getGroups } = require('../utils/graphGroups');
const weCareAbout = [
  'Marine',
  'Travel',
  'Designated Person Ashore',
  'Tech',
  'Daily Progress Report',
  'Operations',
  'Acctspayable',
  'Survey Processing',
  'Movements',
  'IT',
  'Logistics',
  'Accounts Payable',
  'Survey Technical',
  'Resupply',
  'Marketing',
  'Crew Documentation',
  'Information Technology',
];

router.get('/getSelectedGroups', async (req, res) => {
  try {
    const groups = await getGroups();

    if (!Array.isArray(groups)) {
      return res.status(500).json({
        error: 'Failed to fetch groups',
      });
    }

    const ret = groups
      .filter(g => weCareAbout.includes(g.displayName))
      .map(g => ({
        id: g.id,
        desc: g.displayName,
        mail: g.mail,
      }));

    return res.json({ ret });
  } catch (err) {
    console.error('groups route error:', err.message);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
});

module.exports = router;
