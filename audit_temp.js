const { getDb } = require('./backend/src/db');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env' });

async function audit() {
    try {
        const db = getDb();
        let output = '';
        
        // 1. Get total jobs
        const jobs = (await db.execute('SELECT * FROM jobs')).rows;
        output += `Total Jobs in DB: ${jobs.length}\n`;
        
        // 2. Compute statuses as per backend logic
        const today = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(today.getTime() + istOffset);
        const todayStr = istDate.toISOString().split('T')[0];
        
        const stats = {
            UPCOMING: 0,
            LIVE: 0,
            RECENTLY_CLOSED: 0,
            CLOSED: 0,
            TotalComputed: 0
        };
        
        jobs.forEach(job => {
            const start = job.application_start_date;
            const end = job.application_end_date;
            let status;
            
            if (todayStr < start) status = 'UPCOMING';
            else if (todayStr <= end) status = 'LIVE';
            else {
                const endDate = new Date(end + 'T00:00:00Z');
                const istMidnight = new Date(istDate.toISOString().split('T')[0] + 'T00:00:00Z');
                const diffDays = Math.round((istMidnight.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays <= 30) status = 'RECENTLY_CLOSED';
                else status = 'CLOSED';
            }
            stats[status]++;
            stats.TotalComputed++;
        });
        
        output += '--- Computed Status Counts (IST) ---\n';
        output += JSON.stringify(stats, null, 2) + '\n';
        
        // 3. Check for specific states
        const statesCount = {};
        jobs.forEach(j => {
            const s = j.state || 'All India';
            statesCount[s] = (statesCount[s] || 0) + 1;
        });
        output += '--- Jobs by State ---\n';
        // Only list top states or some variety
        output += JSON.stringify(statesCount, null, 2) + '\n';

        // 4. Check closed count in last 30 days
        const thirtyDaysAgo = new Date(istDate);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        const closedLast30 = jobs.filter(j => {
            return j.application_end_date < todayStr && j.application_end_date >= thirtyDaysAgoStr;
        }).length;
        output += `--- Closed Exams in Last 30 Days: ${closedLast30} ---\n`;

        fs.writeFileSync('audit_results.txt', output);
        process.exit(0);
    } catch (e) {
        fs.writeFileSync('audit_results.txt', 'Error: ' + e.message + '\n' + e.stack);
        process.exit(1);
    }
}

audit();
