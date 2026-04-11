const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
});

const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function run() {
    try {
        console.log('Starting state normalization...');

        let off = 0;
        const limit = 1000;
        let hasMore = true;
        let updatedCount = 0;

        while (hasMore) {
            const { data: jobs, error } = await sb.from('jobs')
                .select('*')
                .range(off, off + limit - 1);
            
            if (error) throw error;
            if (jobs.length === 0) {
                hasMore = false;
                break;
            }

            console.log(`Fetched ${jobs.length} jobs, processing offset: ${off}`);

            const updates = [];
            
            for (const job of jobs) {
                const textToSearch = `${job.job_name || ''} ${job.organization || ''}`.toLowerCase();
                
                const mentionedStates = indianStates.filter(state => {
                    const regex = new RegExp(`(?:^|\\s|,)${escapeRegex(state.toLowerCase())}(?:\\s|,|$)`, 'i');
                    return regex.test(textToSearch);
                });

                let primaryState = 'All India';
                let allStates = [];

                if (mentionedStates.length > 0) {
                    primaryState = mentionedStates[0];
                    allStates = mentionedStates;
                }

                job.state = primaryState;
                job.states = JSON.stringify(allStates);
                updates.push(job);
            }

            // Update concurrently, 50 at a time
            const BATCH_CONCURRENCY = 50;
            for (let i = 0; i < updates.length; i += BATCH_CONCURRENCY) {
                const chunk = updates.slice(i, i + BATCH_CONCURRENCY);
                const promises = chunk.map(u => 
                    sb.from('jobs').update({ state: u.state, states: u.states }).eq('id', u.id)
                );
                await Promise.all(promises);
                updatedCount += chunk.length;
                if (updatedCount % 500 === 0) {
                    console.log(`Updated ${updatedCount} rows...`);
                }
            }

            off += limit;
        }

        console.log(`Done! Synchronized state filter data for ${updatedCount} exams.`);
        process.exit(0);

    } catch (err) {
        console.error('State normalization error:', err);
        process.exit(1);
    }
}

run();
