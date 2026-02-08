const express = require('express');
const router = express.Router();

const { getAccessToken365 } = require('../utils/getTokens');

/**
 * Fetch position records from SharePoint list
 * @param {string} accessToken - Microsoft 365 access token
 * @param {string} site - Site name (e.g., 'Tech', 'Ops')
 * @param {number} daysBack - Number of days to look back
 * @returns {Promise<Array>} Array of position records
 */
const fetchPositionRecords = async (accessToken, site, daysBack = 7) => {
  try {
    const siteUrl = 'tdibrooks.sharepoint.com';
    const sitePath = `/sites/${site}`;
    const listName = 'Positions';

    // Get site ID
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

    // Get list items sorted newest → oldest, limit 1000
    const listResponse = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${siteId}/lists/${listName}/items?$expand=fields&$orderby=fields/Date desc&?top=${daysBack * 25}`,
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

    const listJson = await listResponse.json();
    const listData = listJson.value;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);

    // Map and filter by date
    const positionRecords = listData
      .map(item => ({
        Latitude: item.fields.Latitude || null,
        Longitude: item.fields.Longitude || null,
        Date: item.fields.Date || null,
      }))
      .filter(record => {
        if (!record.Date) return false;
        const recordDate = new Date(record.Date);
        return recordDate >= cutoffDate;
      })
      .sort((a, b) => new Date(a.Date) - new Date(b.Date)); // Sort ascending (oldest to newest)

    return positionRecords;
  } catch (error) {
    console.error('Error fetching position records from SharePoint:', error);
    throw error;
  }
};

/**
 * GET /getPositions
 * Returns multiple position records from the last N days
 * Query params:
 *   - site: SharePoint site name (required)
 *   - days: Number of days to look back (default: 7)
 */
router.get('/getPositions', async (req, res) => {
  try {
    const { site, days } = req.query;

    // Validate site parameter
    if (!site) {
      return res.status(400).json({
        error: 'Missing required parameter: site',
      });
    }

    // Parse days parameter, default to 7
    const daysBack = days ? parseInt(days, 10) : 7;

    if (isNaN(daysBack) || daysBack < 1) {
      return res.status(400).json({
        error: 'Invalid days parameter: must be a positive number',
      });
    }

    // Get access token
    const accessToken = await getAccessToken365();

    // Fetch position records
    const positionRecords = await fetchPositionRecords(
      accessToken,
      site,
      daysBack
    );

    res.status(200).json({
      success: true,
      site,
      daysBack,
      count: positionRecords.length,
      positions: positionRecords,
    });
  } catch (error) {
    console.error('Error in getPositions:', error);

    res.status(500).json({
      error: 'Failed to fetch position records',
      details: error.message,
    });
  }
});

/**
 * GET /getPosition
 * Returns the most recent position record
 * Query params:
 *   - site: SharePoint site name (required)
 */
router.get('/getPosition', async (req, res) => {
  try {
    const { site } = req.query;

    // Validate site parameter
    if (!site) {
      return res.status(400).json({
        error: 'Missing required parameter: site',
      });
    }

    // Get access token
    const accessToken = await getAccessToken365();

    // Fetch position records (just last day to get most recent)
    const positionRecords = await fetchPositionRecords(accessToken, site, 1);

    if (positionRecords.length === 0) {
      return res.status(404).json({
        error: 'No position records found',
        site,
      });
    }

    // Get the most recent position (last item in sorted array)
    const mostRecentPosition = positionRecords[positionRecords.length - 1];

    res.status(200).json({
      success: true,
      site,
      position: mostRecentPosition,
    });
  } catch (error) {
    console.error('Error in getPosition:', error);

    res.status(500).json({
      error: 'Failed to fetch position record',
      details: error.message,
    });
  }
});

module.exports = router;
