'use strict';

/**
 * /api/cron/healer — Scheduled Database Healing & Payscale Validation Pipeline
 */

const { healAllRecords } = require('../../scripts/deterministic_healer');

module.exports = async (req, res) => {
  const secret = req.query?.secret || '';
  const authHeader = req.headers?.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[Healer Cron] Starting deterministic database healing cycle...');
    const report = await healAllRecords();
    return res.status(200).json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[Healer Cron] Fatal error during database healing:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
};
