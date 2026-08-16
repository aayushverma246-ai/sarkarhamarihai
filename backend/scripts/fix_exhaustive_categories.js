const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCategories() {
    console.log("Restoring exhaustive category mappings...");
    
    // Map State PSCs
    let { data, error } = await supabase.from('jobs').select('id')
        .or('job_name.ilike.%psc%,organization.ilike.%psc%,job_name.ilike.%public service commission%')
        .neq('job_category', 'UPSC');
    
    if (data && data.length > 0) {
        const ids = data.map(j => j.id);
        // Process in batches of 200 to avoid URL length / query payload limits
        const BATCH = 200;
        for (let i = 0; i < ids.length; i += BATCH) {
            await supabase.from('jobs').update({ job_category: 'State PSCs' }).in('id', ids.slice(i, i + BATCH));
        }
        console.log(`Mapped ${data.length} to State PSCs`);
    }

    // Map PSU
    let { data: d2 } = await supabase.from('jobs').select('id')
        .or('organization.ilike.%psu%,job_name.ilike.%psu%,organization.ilike.%bhel%,organization.ilike.%ongc%,organization.ilike.%sail%,organization.ilike.%ntpc%,organization.ilike.%gail%,organization.ilike.%coal india%');
    
    if (d2 && d2.length > 0) {
        const ids = d2.map(j => j.id);
        const BATCH = 200;
        for (let i = 0; i < ids.length; i += BATCH) {
            await supabase.from('jobs').update({ job_category: 'PSU' }).in('id', ids.slice(i, i + BATCH));
        }
        console.log(`Mapped ${d2.length} to PSU`);
    }
    
    // Medical
    let { data: d3 } = await supabase.from('jobs').select('id').or('job_name.ilike.%nurse%,job_name.ilike.%medical%,job_name.ilike.%doctor%');
    if (d3 && d3.length > 0) {
        const ids = d3.map(j => j.id);
        const BATCH = 200;
        for (let i = 0; i < ids.length; i += BATCH) {
            await supabase.from('jobs').update({ job_category: 'Medical' }).in('id', ids.slice(i, i + BATCH));
        }
        console.log(`Mapped ${d3.length} to Medical`);
    }

    // Update old "Defense" spelling to "Defence" consistently as requested in standard Indian English
    let { data: d4 } = await supabase.from('jobs').select('id').eq('job_category', 'Defense');
    if (d4 && d4.length > 0) {
        const ids = d4.map(j => j.id);
        const BATCH = 200;
        for (let i = 0; i < ids.length; i += BATCH) {
            await supabase.from('jobs').update({ job_category: 'Defence' }).in('id', ids.slice(i, i + BATCH));
        }
        console.log(`Mapped ${d4.length} Defense to Defence`);
    }
}
fixCategories();
