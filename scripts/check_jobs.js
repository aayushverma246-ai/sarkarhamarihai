'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const { getDb } = require('../backend/src/db');

function isJobVerified(job) {
  if (!job) return false;
  if (!job.job_name || !job.organization || !job.official_application_link) return false;
  if (job.official_application_link.trim().length <= 5) return false;

  const textToVerify = (job.job_name + ' ' + job.organization + ' ' + job.official_application_link).toLowerCase();
  const placeholders = [
    'placeholder', 'dummy', 'lorem ipsum', 'test-job', 'test-org', 'test-exam',
    'sample exam', 'tba', 'tbd', 'to be announced', 'to be decided', 'n/a', 'null'
  ];
  if (placeholders.some(p => textToVerify.includes(p))) return false;

  return true;
}

(async () => {
    try {
        const db = getDb();
        console.log('Querying database...');
        const res = await db.execute('SELECT id, job_name, organization, official_application_link FROM jobs');
        const rows = res.rows || [];
        console.log('Total jobs in database:', rows.length);
        
        let verifiedCount = 0;
        let missingLink = 0;
        let shortLink = 0;
        let placeholderMatch = 0;
        
        for (const row of rows) {
            if (!row.official_application_link) {
                missingLink++;
            } else if (row.official_application_link.trim().length <= 5) {
                shortLink++;
            } else {
                const textToVerify = (row.job_name + ' ' + row.organization + ' ' + row.official_application_link).toLowerCase();
                const placeholders = [
                    'placeholder', 'dummy', 'lorem ipsum', 'test-job', 'test-org', 'test-exam',
                    'sample exam', 'tba', 'tbd', 'to be announced', 'to be decided', 'n/a', 'null'
                ];
                if (placeholders.some(p => textToVerify.includes(p))) {
                    placeholderMatch++;
                } else {
                    verifiedCount++;
                }
            }
        }
        
        console.log('--- DB Check Stats ---');
        console.log('Verified count:', verifiedCount);
        console.log('Missing link count:', missingLink);
        console.log('Short link count:', shortLink);
        console.log('Placeholder match count:', placeholderMatch);
        console.log('----------------------');
        process.exit(0);
    } catch (e) {
        console.error('Error in script:', e);
        process.exit(1);
    }
})();
