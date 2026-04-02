const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// Mappings from user instructions
const getSelectionProcedure = (category, jobName, existingProc) => {
    // If the database actually has a good array already, try to preserve it
    let currentArr = [];
    if (existingProc && existingProc.startsWith('[')) {
        try {
            currentArr = JSON.parse(existingProc);
            if (Array.isArray(currentArr) && currentArr.length > 0) {
                return JSON.stringify(currentArr);
            }
        } catch (_) {}
    }

    const cat = (category || '').toUpperCase();
    const jn = (jobName || '').toUpperCase();

    // Mapping Rules
    if (cat.includes('UPSC') || cat.includes('PSC') || jn.includes('CIVIL SERVICES')) {
        return JSON.stringify(["Prelims", "Mains", "Interview", "Document Verification"]);
    }
    if (cat.includes('SSC') || jn.includes('STAFF SELECTION')) {
        return JSON.stringify(["Tier 1", "Tier 2", "Skill Test/Typing"]);
    }
    if (cat.includes('BANK') || cat.includes('IBPS') || cat.includes('SBI')) {
        return JSON.stringify(["Prelims", "Mains", "Interview"]);
    }
    if (cat.includes('DEFENCE') || cat.includes('NDA') || cat.includes('ARMY')) {
        return JSON.stringify(["Written Exam", "SSB / Interview", "Medical Fitness Test"]);
    }
    if (cat.includes('RAILWAY') || cat.includes('RRB')) {
        return JSON.stringify(["CBT 1", "CBT 2", "Medical Examination"]);
    }
    if (cat.includes('POLICE') || jn.includes('POLICE')) {
        return JSON.stringify(["Written Test", "Physical Efficiency Test (PET)", "Medical Test"]);
    }

    // Default structure for unknown or generic categories
    return JSON.stringify(["Written Test", "Interview / Skill Test", "Document Verification"]);
};

async function runAudit() {
    console.log('[Audit] Starting Selection Procedure Audit...');
    let offset = 0;
    const limit = 1000;
    let fixedCount = 0;

    while (true) {
        console.log(`[Audit] Fetching batch (Offset: ${offset})...`);
        const { data: jobs, error } = await sb.from('jobs')
            .select('id, job_name, job_category, selection_process')
            .range(offset, offset + limit - 1);
            
        if (error) {
            console.error('Fetch Error:', error.message);
            break;
        }

        if (!jobs || jobs.length === 0) break;

        const updates = [];
        for (const job of jobs) {
            const correctJson = getSelectionProcedure(job.job_category, job.job_name, job.selection_process);
            
            // Only update if it's missing or fundamentally incorrect/not JSON
            if (job.selection_process !== correctJson) {
                updates.push({ id: job.id, selection_process: correctJson });
            }
        }

        if (updates.length > 0) {
            console.log(`[Audit] Found ${updates.length} exams needing fixes in this batch... applying.`);
            
            // Safe batching of individual updates to avoid overwriting other columns (which bulk Upsert might do)
            const chunkSize = 50; 
            for (let i = 0; i < updates.length; i += chunkSize) {
                const chunk = updates.slice(i, i + chunkSize);
                await Promise.all(chunk.map(u => 
                    sb.from('jobs').update({ selection_process: u.selection_process }).eq('id', u.id)
                ));
            }
            fixedCount += updates.length;
        } else {
            console.log(`[Audit] All perfectly formatted in this batch!`);
        }

        if (jobs.length < limit) {
             break;
        }
        offset += limit;
    }

    console.log(`[Audit] FINISHED. Total Procedures Fixed & Standardized: ${fixedCount}`);
}

runAudit().catch(e => {
    console.error('Fatal Error:', e);
    process.exit(1);
});
