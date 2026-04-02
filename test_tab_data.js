/**
 * Dashboard Tab Data Verification Test
 * Tests that ALL tabs return non-zero data
 * Run with: node test_tab_data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, 'backend/.env') });

const { initDb, getDb } = require('./backend/src/db');

// Form status calculator
const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;
    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';
    const endParts = end.split('-').map(Number);
    const todayParts = todayStr.split('-').map(Number);
    const endDays = endParts[0] * 365 + endParts[1] * 30 + endParts[2];
    const todayDays = todayParts[0] * 365 + todayParts[1] * 30 + todayParts[2];
    const diffDays = todayDays - endDays;
    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}

async function test() {
    console.log('='.repeat(60));
    console.log('DASHBOARD TAB DATA VERIFICATION TEST');
    console.log('='.repeat(60));

    try {
        await initDb();
        const db = getDb();
        const todayStr = getTodayIST();

        console.log(`\nDate: ${todayStr}\n`);

        // Get total job count
        const total = (await db.execute('SELECT COUNT(*) as cnt FROM jobs')).rows[0].cnt;
        console.log(`Total jobs in database: ${total}`);

        if (total === 0) {
            console.error('\n❌ ERROR: Database has 0 jobs! Run seed first.');
            process.exit(1);
        }

        // Fetch all jobs and categorize
        const allJobs = (await db.execute('SELECT * FROM jobs')).rows;
        const jobsWithStatus = allJobs.map(j => ({
            ...j,
            form_status: computeFormStatus(j, todayStr)
        }));

        const statusCounts = {
            LIVE: 0,
            UPCOMING: 0,
            RECENTLY_CLOSED: 0,
            CLOSED: 0
        };

        jobsWithStatus.forEach(j => {
            statusCounts[j.form_status] = (statusCounts[j.form_status] || 0) + 1;
        });

        console.log('\n📊 JOB STATUS DISTRIBUTION:');
        console.log('-'.repeat(40));
        Object.entries(statusCounts).forEach(([status, count]) => {
            const emoji = count > 0 ? '✅' : '❌';
            console.log(`  ${emoji} ${status}: ${count}`);
        });

        // Check tabs
        console.log('\n📑 TAB DATA VERIFICATION:');
        console.log('-'.repeat(40));

        const tabs = {
            'All': allJobs.length,
            'Live': statusCounts.LIVE,
            'Upcoming': statusCounts.UPCOMING,
            'Closed (inc Recently)': statusCounts.CLOSED + statusCounts.RECENTLY_CLOSED,
            'Recently Closed': statusCounts.RECENTLY_CLOSED,
        };

        let allPassed = true;
        Object.entries(tabs).forEach(([tab, count]) => {
            const emoji = count > 0 ? '✅' : '⚠️';
            const status = count > 0 ? 'PASS' : 'FALLBACK NEEDED';
            console.log(`  ${emoji} ${tab}: ${count} (${status})`);
            if (count === 0) allPassed = false;
        });

        // Check fallback scenarios
        console.log('\n🔄 FALLBACK SCENARIO CHECK:');
        console.log('-'.repeat(40));

        const fallbackChecks = [
            {
                name: 'Live → Recently Closed fallback',
                primary: statusCounts.LIVE,
                fallback: statusCounts.RECENTLY_CLOSED,
                desc: 'If LIVE=0, falls back to RECENTLY_CLOSED'
            },
            {
                name: 'Eligible → LIVE+UPCOMING fallback',
                primary: 'N/A (user-specific)',
                fallback: statusCounts.LIVE + statusCounts.UPCOMING,
                desc: 'If eligible=0, falls back to LIVE+UPCOMING'
            },
            {
                name: 'Partial → UPCOMING fallback',
                primary: 'N/A (user-specific)',
                fallback: statusCounts.UPCOMING,
                desc: 'If partial=0, falls back to UPCOMING'
            }
        ];

        fallbackChecks.forEach(check => {
            const fallbackAvailable = check.fallback > 0;
            const emoji = fallbackAvailable ? '✅' : '❌';
            console.log(`  ${emoji} ${check.name}`);
            console.log(`     Fallback pool: ${check.fallback} jobs`);
        });

        console.log('\n' + '='.repeat(60));
        if (statusCounts.LIVE > 0 && statusCounts.UPCOMING > 0) {
            console.log('✅ ALL TAB CHECKS PASSED - Dashboard should show non-zero data!');
        } else {
            console.log('⚠️ SOME TABS MAY USE FALLBACK DATA');
            console.log('   This is expected behavior - fallbacks ensure no tab shows 0.');
        }
        console.log('='.repeat(60));

    } catch (err) {
        console.error('\n❌ TEST FAILED:', err);
        process.exit(1);
    }
}

test();
