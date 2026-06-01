const { discoverMissingJobs } = require('../../backend/src/engines/discovery');

module.exports = async (req, res) => {
  const secret = req.query?.secret || '';
  const authHeader = req.headers?.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && secret !== (process.env.CRON_SECRET || 'sarkar_cron_key_v1')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const missingMatrix = await discoverMissingJobs();
    
    // In a real system, we'd write this to a 'discovery_queue' table in Supabase
    // Since we can't alter schema, we just return the report for the admins to see 
    // and manually trigger scrapers/seed additions.
    return res.status(200).json({ 
      success: true, 
      missing_count: missingMatrix.length, 
      gaps: missingMatrix 
    });
  } catch (err) {
    console.error('Discovery Error:', err);
    return res.status(500).json({ error: 'Discovery failed', details: err.message });
  }
};
