const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const validStates = new Set([
    "All India", "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh",
    "Assam", "Bihar", "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli",
    "Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana", "Himachal Pradesh",
    "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland",
    "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
]);

const validCategories = new Set([
    "Banking", "Defense", "Engineering", "Medical", 
    "Police", "Railways", "SSC", "Teaching", "UPSC"
]);

async function auditExams() {
    console.log("🚀 Starting Production Exam DB Audit in Supabase...\n");
    let hasMore = true;
    let offset = 0;
    const limit = 1000;
    
    let totalScanned = 0;
    let fixes = [];
    let toDelete = [];

    while (hasMore) {
        const { data: jobs, error } = await supabase
            .from('jobs')
            .select('*')
            .range(offset, offset + limit - 1);

        if (error) {
            console.error("❌ Error fetching jobs:", error.message);
            break;
        }

        if (!jobs || jobs.length === 0) {
            hasMore = false;
            break;
        }

        totalScanned += jobs.length;

        for (const job of jobs) {
            let needsUpdate = false;
            const updatePayload = {};

            // 1. Age Verification
            let minAge = job.minimum_age || 18;
            let maxAge = job.maximum_age || 35;
            
            if (minAge > maxAge) {
                const temp = minAge;
                minAge = maxAge;
                maxAge = temp;
                updatePayload.minimum_age = minAge;
                updatePayload.maximum_age = maxAge;
                needsUpdate = true;
            }
            if (minAge < 15) { updatePayload.minimum_age = 18; needsUpdate = true; }
            if (maxAge > 70) { updatePayload.maximum_age = 50; needsUpdate = true; }

            // 2. Category Verification (Default to SSC or All if unrecognizable)
            let cat = (job.job_category || "").trim();
            if (!validCategories.has(cat)) {
                updatePayload.job_category = 'Other';
                needsUpdate = true;
            }

            // 3. State Verification
            let st = (job.state || "").trim();
            if (!validStates.has(st)) {
                updatePayload.state = 'All India';
                needsUpdate = true;
            }

            // 4. Broken Dates (Delete invalid entries)
            if (!job.application_end_date && !job.application_start_date) {
                // Garbage entry missing both constraints
                toDelete.push(job.id);
                continue;
            }

            // 5. Selection Procedure
            let sel = job.selection_process || "";
            if (sel.length < 5 || ["N/A", "NA", "Placeholder", "TBD"].includes(sel)) {
                updatePayload.selection_process = null;
                if (sel !== null) needsUpdate = true;
            }

            // Queue Update
            if (needsUpdate) {
                fixes.push({ id: job.id, ...updatePayload });
            }
        }

        offset += limit;
        console.log(`✅ Scanned ${totalScanned} exams...`);
    }

    console.log(`\n🔍 AUDIT COMPLETE.`);
    console.log(`⚠️ Invalid Entries to Delete: ${toDelete.length}`);
    console.log(`🔧 Entries Requiring Fixes: ${fixes.length}`);

    // Execution
    for (let i = 0; i < fixes.length; i += 100) {
        const batch = fixes.slice(i, i + 100);
        await Promise.all(batch.map(f => supabase.from('jobs').update(f).eq('id', f.id)));
    }
    
    if (toDelete.length > 0) {
        for (let i = 0; i < toDelete.length; i += 100) {
            const batch = toDelete.slice(i, i + 100);
             await supabase.from('jobs').delete().in('id', batch);
        }
    }

    console.log(`\n🎉 DATABASE SANITIZATION CONCLUDED SUCCESSFULLY!`);
}

auditExams();
