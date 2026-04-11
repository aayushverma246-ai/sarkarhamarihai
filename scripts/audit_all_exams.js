const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp0Ymd1bmFydGtudHJxeHhzZHBjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTEzNDgyNywiZXhwIjoyMDkwNzEwODI3fQ.wbX4lhJKE8OtzIl2RJamsFA71DRwo-B7QCL4UzAsr9A';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function standardizeSelection(raw) {
  if (!raw || !raw.trim()) return '[]';
  const val = raw.trim();
  
  if (val.startsWith('[') && val.endsWith(']')) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return JSON.stringify(parsed);
    } catch(e) {}
  }
  
  if (val.includes('|')) return JSON.stringify(val.split('|').map(s=>s.trim()).filter(Boolean));
  if (val.includes('→')) return JSON.stringify(val.split('→').map(s=>s.trim()).filter(Boolean));
  if (val.includes('=>')) return JSON.stringify(val.split('=>').map(s=>s.trim()).filter(Boolean));
  if (val.includes('->')) return JSON.stringify(val.split('->').map(s=>s.trim()).filter(Boolean));
  
  if (/^\d+\./.test(val)) return JSON.stringify(val.split(/(?=\d+\.)/).map(s=>s.trim()).filter(Boolean));
  
  if (val.split(',').length >= 3 && val.length < 150) return JSON.stringify(val.split(',').map(s=>s.trim()).filter(Boolean));
  
  return JSON.stringify([val]);
}

async function run() {
  console.log('Fetching all jobs for audit...');
  let hasMore = true;
  let offset = 0;
  const limit = 1000;
  let updates = 0;

  while(hasMore) {
    const { data, error } = await supabase.from('jobs').select('id, selection_process, minimum_age, maximum_age').range(offset, offset + limit - 1);
    if (error) {
      console.error('Error fetching jobs:', error);
      process.exit(1);
    }
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Auditing ${data.length} jobs (offset ${offset})...`);
    for (const job of data) {
      let needsUpdate = false;
      const updateObj = {};
      
      const standardSel = standardizeSelection(job.selection_process);
      if (job.selection_process !== standardSel) {
        updateObj.selection_process = standardSel;
        needsUpdate = true;
      }
      
      let minAge = Number(job.minimum_age);
      let maxAge = Number(job.maximum_age);
      if (isNaN(minAge) || minAge < 0) minAge = 18;
      if (isNaN(maxAge) || maxAge < 0) maxAge = 40;
      
      if (minAge !== job.minimum_age) {
        updateObj.minimum_age = minAge;
        needsUpdate = true;
      }
      if (maxAge !== job.maximum_age) {
        updateObj.maximum_age = maxAge;
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        const { error: uErr } = await supabase.from('jobs').update(updateObj).eq('id', job.id);
        if (!uErr) updates++;
        if (updates > 0 && updates % 100 === 0) console.log(`Updated ${updates} jobs...`);
      }
    }
    offset += limit;
  }
  
  console.log(`Audit complete. Total updated: ${updates}`);
}

run();
