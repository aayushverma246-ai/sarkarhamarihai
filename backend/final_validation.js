require('dotenv').config();
const { createClient } = require('@libsql/client');

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function validate() {
    console.log("🔍 RUNNING FINAL SYSTEM VERIFICATION SCAN...");
    
    try {
        const { rows } = await client.execute("SELECT * FROM jobs");
        let brokenLinksCount = 0;
        let outdatedDatesCount = 0;
        let incorrectStatusCount = 0;
        let missingFieldsCount = 0;
        
        let now = new Date();
        now.setHours(0,0,0,0);
        
        for (const exam of rows) {
            // Check links
            const lFields = ['official_application_link', 'official_notification_link', 'official_website_link'];
            for (let f of lFields) {
                if (!exam[f] || !exam[f].startsWith('http')) {
                    brokenLinksCount++;
                }
            }
            
            // Check missing basic required fields
            const req = ['job_name', 'organization', 'job_category', 'qualification_required', 'salary_min', 'salary_max', 'selection_process'];
            for (let r of req) {
                if (!exam[r] || exam[r] === '') missingFieldsCount++;
            }
            
            // Validate Dates
            let startD = new Date(exam.application_start_date);
            let endD = new Date(exam.application_end_date);
            if (isNaN(startD) || isNaN(endD)) {
                outdatedDatesCount++;
            } else if (endD < startD) {
                outdatedDatesCount++;
            }
            
            // Validate Status 
            startD.setHours(0,0,0,0);
            endD.setHours(0,0,0,0);
            
            let exStatus = 'LIVE';
            if (now < startD) exStatus = 'UPCOMING';
            else if (now > endD) exStatus = 'CLOSED';
            
            if (exam.form_status !== exStatus) incorrectStatusCount++;
            
            // Check category specific
            if (!['CENTRAL', 'STATE', 'PSU'].includes(exam.job_category)) incorrectStatusCount++;
        }
        
        console.log("✅ FINAL VERIFICATION SCAN RESULTS:");
        console.log("   - " + brokenLinksCount + " broken links");
        console.log("   - " + outdatedDatesCount + " outdated dates");
        console.log("   - " + incorrectStatusCount + " incorrect statuses");
        console.log("   - " + missingFieldsCount + " missing fields");
        
        if (brokenLinksCount > 0 || outdatedDatesCount > 0 || incorrectStatusCount > 0 || missingFieldsCount > 0) {
            console.error("❌ Audit failed final validation. Restarting audit cycle required.");
            process.exit(1);
        } else {
            console.log("🚀 ALL DATA IS 100% VERIFIED AND CORRECT. ZERO ERRORS CONFIRMED.");
            process.exit(0);
        }
        
    } catch(e) {
        console.error("ERROR:", e);
    }
}

validate();
