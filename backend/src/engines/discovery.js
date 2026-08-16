'use strict';

const { createClient } = require('@supabase/supabase-js');

/**
 * Discovers gaps in current data matrix (States x Categories)
 * Uses Supabase JS SDK directly to avoid SQL adapter limitations
 */
async function discoverMissingJobs() {
  const sb = createClient(
    process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  
  const STATES = ['Maharashtra', 'Uttar Pradesh', 'Tamil Nadu', 'Karnataka', 'Gujarat', 
    'West Bengal', 'Bihar', 'Rajasthan', 'Andhra Pradesh', 'Madhya Pradesh', 'Odisha',
    'Kerala', 'Punjab', 'Haryana', 'Jharkhand', 'Chhattisgarh', 'Telangana',
    'Uttarakhand', 'Himachal Pradesh', 'Assam', 'Goa', 'Tripura', 'Manipur',
    'Meghalaya', 'Nagaland', 'Mizoram', 'Arunachal Pradesh', 'Sikkim', 'Delhi', 'J&K'];
  const CATEGORIES = ['Police', 'Healthcare', 'Teaching', 'Judiciary', 'Agriculture', 
    'Engineering', 'State PSCs', 'Panchayat', 'Banking', 'Defence', 'Railways'];
  
  // Fetch active jobs
  const { data: activeJobs, error } = await sb.from('jobs')
    .select('job_category, organization, job_name')
    .in('form_status', ['LIVE', 'UPCOMING']);

  if (error) throw new Error(`Discovery query failed: ${error.message}`);
  
  const missingMatrix = [];
  
  for (const state of STATES) {
    for (const cat of CATEGORIES) {
      const found = (activeJobs || []).some(job => 
        ((job.organization || '').includes(state) || (job.job_name || '').includes(state)) &&
        job.job_category === cat
      );
      
      if (!found) {
        missingMatrix.push({ state, category: cat, status: 'Missing' });
      }
    }
  }
  
  return missingMatrix;
}

module.exports = { discoverMissingJobs };
