const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const isDryRun = process.argv.includes('--dry-run');

// NVIDIA API credentials for Llama 3.1
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_KEY = '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';
const LLAMA_MODEL = 'meta/llama-3.1-8b-instruct';

// Common placeholder links to target
const genericDomains = [
  'india.gov.in',
  'careers.india.gov.in',
  'apprenticeshipindia.org',
  'metro.gov.in',
  'mha.gov.in',
  'dnh.gov.in',
  'andaman.gov.in',
  'indianbanksassociation.org'
];

// 1. Deterministic state mapping portal rules
const statePortals = {
  'Andaman & Nicobar Islands': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar': 'https://andamannicobar.gov.in',
  'Andaman': 'https://andamannicobar.gov.in',
  'Andhra Pradesh': 'https://ap.gov.in',
  'Arunachal Pradesh': 'https://arunachalpradesh.gov.in',
  'Assam': 'https://assam.gov.in',
  'Bihar': 'https://bihar.gov.in',
  'Chhattisgarh': 'https://cgstate.gov.in',
  'Goa': 'https://goa.gov.in',
  'Gujarat': 'https://gujarat.gov.in',
  'Haryana': 'https://haryana.gov.in',
  'Himachal Pradesh': 'https://hp.gov.in',
  'Jammu & Kashmir': 'https://jk.gov.in',
  'J&K': 'https://jk.gov.in',
  'Jharkhand': 'https://jharkhand.gov.in',
  'Karnataka': 'https://karnataka.gov.in',
  'Kerala': 'https://kerala.gov.in',
  'Madhya Pradesh': 'https://mp.gov.in',
  'Maharashtra': 'https://maharashtra.gov.in',
  'Manipur': 'https://manipur.gov.in',
  'Meghalaya': 'https://meghalaya.gov.in',
  'Mizoram': 'https://mizoram.gov.in',
  'Nagaland': 'https://nagaland.gov.in',
  'Odisha': 'https://odisha.gov.in',
  'Punjab': 'https://punjab.gov.in',
  'Rajasthan': 'https://rajasthan.gov.in',
  'Sikkim': 'https://sikkim.gov.in',
  'Tamil Nadu': 'https://tn.gov.in',
  'Telangana': 'https://telangana.gov.in',
  'Tripura': 'https://tripura.gov.in',
  'Uttar Pradesh': 'https://up.gov.in',
  'Uttarakhand': 'https://uk.gov.in',
  'West Bengal': 'https://wb.gov.in',
  'Delhi': 'https://delhi.gov.in',
  'Ladakh': 'https://ladakh.nic.in',
  'Lakshadweep': 'https://lakshadweep.gov.in',
  'Puducherry': 'https://py.gov.in',
  'Chandigarh': 'https://chandigarh.gov.in',
  'Dadra & Nagar Haveli and Daman & Diu': 'https://dnh.gov.in',
  'Dadra & Nagar Haveli': 'https://dnh.gov.in'
};

// 2. Deterministic organization mapping rules
const directOrgPortals = {
  'Union Public Service Commission': 'https://upsc.gov.in',
  'UPSC': 'https://upsc.gov.in',
  'Staff Selection Commission': 'https://ssc.gov.in',
  'SSC': 'https://ssc.gov.in',
  'State Bank of India': 'https://www.sbi.co.in',
  'State Bank of India (SBI)': 'https://www.sbi.co.in',
  'SBI': 'https://www.sbi.co.in',
  'Punjab National Bank': 'https://www.pnbindia.in',
  'Punjab National Bank (PNB)': 'https://www.pnbindia.in',
  'PNB': 'https://www.pnbindia.in',
  'Union Bank of India': 'https://www.unionbankofindia.co.in',
  'Canara Bank': 'https://canarabank.com',
  'Bank of Baroda': 'https://www.bankofbaroda.in',
  'Bank of Baroda (BOB)': 'https://www.bankofbaroda.in',
  'BOB': 'https://www.bankofbaroda.in',
  'Indian Bank': 'https://www.indianbank.in',
  'Bank of India': 'https://www.bankofindia.co.in',
  'BOI': 'https://www.bankofindia.co.in',
  'Institute of Banking Personnel Selection': 'https://ibps.in',
  'IBPS': 'https://ibps.in',
  'Reserve Bank of India': 'https://rbi.org.in',
  'RBI': 'https://rbi.org.in',
  'National Testing Agency': 'https://nta.ac.in',
  'NTA': 'https://nta.ac.in',
  'National Investigation Agency': 'https://nia.gov.in',
  'NIA': 'https://nia.gov.in',
  'Employees PF Organisation': 'https://epfindia.gov.in',
  'EPFO': 'https://epfindia.gov.in',
  'Supreme Court of India': 'https://sci.gov.in',
  'High Court of Delhi': 'https://delhihighcourt.nic.in',
  'Parliament of India': 'https://loksabha.nic.in',
  'Comptroller & Auditor General': 'https://cag.gov.in',
  'SEBI': 'https://sebi.gov.in',
  'SIDBI': 'https://sidbi.in',
  'NABARD': 'https://nabard.org',
  'Indian Army': 'https://joinindianarmy.nic.in',
  'Indian Navy': 'https://joinindiannavy.gov.in',
  'Indian Air Force': 'https://indianairforce.nic.in',
  'BSF': 'https://rectt.bsf.gov.in',
  'Border Security Force': 'https://rectt.bsf.gov.in',
  'CRPF': 'https://rectt.crpf.gov.in',
  'CISF': 'https://cisfrectt.cisf.gov.in',
  'ITBP': 'https://recruitment.itbpolice.nic.in',
  'SSB': 'https://ssbrectt.gov.in',
  'Assam Rifles': 'https://assamrifles.gov.in',
  'India Post': 'https://indiapostgdsonline.gov.in',
  'UIDAI': 'https://uidai.gov.in',
  'CSIR': 'https://csir.res.in',
  'CBIC': 'https://cbic.gov.in',
  'Bharat Heavy Electricals Limited': 'https://careers.bhel.in',
  'BHEL': 'https://careers.bhel.in',
  'Western Coalfields Limited': 'https://westerncoal.in',
  'Delhi Metro Rail Corporation': 'https://delhimetrorail.com',
  'WAPCOS Limited': 'https://wapcos.gov.in',
  'Mizoram PSC': 'https://mpsc.mizoram.gov.in',
  'Goa PSC': 'https://gpsc.goa.gov.in',
  'WBPSC': 'https://psc.wb.gov.in',
  'Rashtriya Chemicals & Fertilizers': 'https://rcfltd.com',
  'Goa Electricity Board': 'https://goaelectricity.gov.in',
  'Mizoram Electricity Dept': 'https://power.mizoram.gov.in',
  'National Health Mission Gujarat': 'https://nhm.gujarat.gov.in',
  'Dadra & Nagar Haveli Education Board': 'https://dnh.gov.in',
  'Puducherry Police Department': 'https://puducherrypolice.gov.in',
  'Karnataka State Road Transport': 'https://ksrtc.karnataka.gov.in',
  'Goa Revenue Dept': 'https://goa.gov.in',
  'Goa Police': 'https://goapolice.gov.in',
  'Dadra & Nagar Haveli Police': 'https://dnh.gov.in',
  'Dadra & Nagar Haveli Public Service Commission': 'https://dnh.gov.in',
  'Madhya Pradesh District Courts': 'https://mphc.gov.in',
  'Andhra Pradesh Public Service Commission': 'https://psc.ap.gov.in',
  'Puducherry Public Service Commission': 'https://psc.py.gov.in',
  'IREDA Limited': 'https://ireda.in',
  'Assam Cooperative Bank': 'https://assambank.in',
  'Madhya Pradesh Education Board': 'https://mpbse.nic.in',
  'Telangana Police Department': 'https://tslprb.in',
  'Bihar High Court': 'https://patnahighcourt.gov.in'
};

function cleanMalformedUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let cleaned = url.trim();
  
  // Replace direct invalid characters
  cleaned = cleaned.replace(/&amp;/g, '&');
  cleaned = cleaned.replace(/[\s\r\n\t]/g, '');
  
  return cleaned;
}

function isGenericOrPlaceholder(url, orgName) {
  if (!url || typeof url !== 'string') return true;
  
  const trimmed = url.trim().toLowerCase();
  
  // 1. Check for known generic placeholders
  const isGenericDomain = genericDomains.some(domain => trimmed.includes(domain));
  if (isGenericDomain) return true;
  
  // 2. Check for invalid URL format or characters
  if (trimmed.includes(' ') || trimmed.includes('&') || trimmed.includes('%')) return true;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return true;
  
  // 3. Check for generic state portal URLs for non-main state orgs
  const statesKeys = Object.keys(statePortals).map(s => s.toLowerCase().replace(/\s/g, '').replace(/[^a-z0-9]/g, ''));
  const isStateMainPortal = statesKeys.some(state => {
    try {
      const hostname = new URL(url).hostname.replace('www.', '').replace('.gov.in', '').replace(/\s/g, '');
      return hostname === state;
    } catch (e) {
      return false;
    }
  });
  
  const isMainStateOrg = orgName.toLowerCase().endsWith('public service commission') || 
                         orgName.toLowerCase().endsWith('psc') || 
                         orgName.toLowerCase() === `${orgName.split(' ')[0].toLowerCase()} state government` ||
                         orgName.toLowerCase() === `${orgName.split(' ')[0].toLowerCase()} government`;

  if (isStateMainPortal && !isMainStateOrg) {
    return true;
  }
  
  return false;
}

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Llama 3.1 8b link resolution with robust retry and backoff on 429 errors
async function getRealUrlFromLlama(orgName, jobNameExample) {
  const prompt = `Identify the official recruitment portal, application homepage, or main website URL for the Indian organization: "${orgName}" (which conducts the exam: "${jobNameExample}").
Respond ONLY in JSON format:
{
  "url": "https://..."
}
Rules:
- The URL MUST be active, correct, official, and start with https:// or http://.
- Do NOT return generic national portals like "https://india.gov.in" unless there is absolutely no other specific website for this organization.
- Ensure the URL is clean (no spaces, no raw "&" without correct URL encoding, no trailing dots).
- Return ONLY the JSON object. No extra text, no formatting marks.`;

  let retries = 5;
  let delay = 1000;

  while (retries > 0) {
    try {
      const response = await axios.post(NVIDIA_URL, {
        model: LLAMA_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 150
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${NVIDIA_KEY}`
        },
        timeout: 20000
      });
      
      const text = response.data.choices[0].message.content.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed && parsed.url && parsed.url.startsWith('http')) {
        return parsed.url.trim();
      }
      return null;
    } catch (err) {
      if (err.response && err.response.status === 429) {
        retries--;
        console.warn(`  [Llama Rate Limited (429)] for "${orgName}". Retrying in ${delay}ms... (${retries} attempts left)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2.5; // Exponential backoff with multiplier
        continue;
      }
      console.error(`  [Llama Lookup Failed] for "${orgName}": ${err.message}`);
      break;
    }
  }
  return null;
}

// Fallback logic to get state portal from organization name
function getFallbackStatePortal(orgName) {
  for (const [state, portal] of Object.entries(statePortals)) {
    if (orgName.includes(state)) {
      return portal;
    }
  }
  return null;
}

async function run() {
  console.log(`=== SarkarHamariHai URL Audit & Clean System ===`);
  console.log(`Model Provider: NVIDIA API - Llama-3.1-8b-instruct`);
  console.log(`Mode: ${isDryRun ? 'DRY RUN (No updates written)' : 'LIVE EXECUTION'}\n`);
  
  try {
    console.log('Fetching all jobs from Supabase...');
    let allJobs = [];
    let hasMore = true;
    let page = 0;
    const pageSize = 1000;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_name, organization, official_application_link, official_notification_link, official_website_link')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allJobs.push(...data);
        page++;
        if (data.length < pageSize) hasMore = false;
      }
    }
    
    console.log(`Total jobs loaded: ${allJobs.length}`);
    
    // Group jobs by organization that need a URL fix
    const orgsNeedingFix = {};
    
    allJobs.forEach(job => {
      const appLink = cleanMalformedUrl(job.official_application_link);
      const webLink = cleanMalformedUrl(job.official_website_link);
      const notifLink = cleanMalformedUrl(job.official_notification_link);
      
      const appGeneric = isGenericOrPlaceholder(appLink, job.organization);
      const webGeneric = isGenericOrPlaceholder(webLink, job.organization);
      const notifGeneric = isGenericOrPlaceholder(notifLink, job.organization);
      
      if (appGeneric || webGeneric || notifGeneric) {
        if (!orgsNeedingFix[job.organization]) {
          orgsNeedingFix[job.organization] = {
            count: 0,
            exampleJob: job.job_name,
            currentAppLink: appLink,
            currentWebLink: webLink,
            currentNotifLink: notifLink,
            jobIds: []
          };
        }
        orgsNeedingFix[job.organization].count++;
        orgsNeedingFix[job.organization].jobIds.push(job.id);
      }
    });
    
    const uniqueOrgs = Object.keys(orgsNeedingFix);
    console.log(`Found ${uniqueOrgs.length} unique organizations with placeholder or incorrect links affecting ${Object.values(orgsNeedingFix).reduce((sum, item) => sum + item.count, 0)} jobs.`);
    
    if (uniqueOrgs.length === 0) {
      console.log('No placeholder or generic links found. Database is 100% clean!');
      process.exit(0);
    }
    
    // We will audit ALL unique organizations in this run since Llama has no strict RPM limits!
    console.log(`Auditing all unique organizations...\n`);
    
    let processedCount = 0;
    let updatedJobsCount = 0;
    let resolvedViaDict = 0;
    let resolvedViaLlama = 0;
    let resolvedViaClearedFallback = 0;
    
    const BATCH_SIZE = 5;
    for (let i = 0; i < uniqueOrgs.length; i += BATCH_SIZE) {
      const chunk = uniqueOrgs.slice(i, i + BATCH_SIZE);
      
      await Promise.all(chunk.map(async (org) => {
        const details = orgsNeedingFix[org];
        processedCount++;
        
        let correctedUrl = null;
        let method = '';
        
        // Step 1: Check direct organization dictionary (exact match first)
        const orgLower = org.toLowerCase().trim();
        for (const [key, val] of Object.entries(directOrgPortals)) {
          if (key.toLowerCase().trim() === orgLower) {
            correctedUrl = val;
            method = 'DIRECT_DICT_EXACT';
            resolvedViaDict++;
            break;
          }
        }

        // Step 2: Check partial match using word boundaries (longest key first)
        if (!correctedUrl) {
          const sortedKeys = Object.keys(directOrgPortals).sort((a, b) => b.length - a.length);
          for (const key of sortedKeys) {
            const val = directOrgPortals[key];
            const regex = new RegExp('\\b' + escapeRegex(key) + '\\b', 'i');
            if (regex.test(org)) {
              correctedUrl = val;
              method = 'DIRECT_DICT_PARTIAL';
              resolvedViaDict++;
              break;
            }
          }
        }
        
        // Step 3: Call Llama 3.1 8b for custom local organizations
        if (!correctedUrl) {
          console.log(`  [Llama Query] Finding official website for: "${org}"`);
          correctedUrl = await getRealUrlFromLlama(org, details.exampleJob);
          if (correctedUrl) {
            // Verify Llama did not return a generic fallback domain
            const trimmedUrl = correctedUrl.toLowerCase();
            const isGeneric = genericDomains.some(d => trimmedUrl.includes(d)) || trimmedUrl.includes('india.gov.in');
            if (isGeneric) {
              console.warn(`  [Llama Returned Generic Link] "${correctedUrl}" for "${org}" - clearing instead`);
              correctedUrl = null;
            } else {
              method = 'LLAMA_API';
              resolvedViaLlama++;
            }
          }
        }
        
        // Step 4: If still not resolved, clear the links to be empty (no fallback)
        if (!correctedUrl) {
          correctedUrl = '';
          method = 'CLEARED_FALLBACK';
          resolvedViaClearedFallback++;
        }
        
        // Log and perform URL correction
        if (method !== 'NO_CHANGE' && correctedUrl !== details.currentAppLink) {
          console.log(`  Resolved: "${org}" -> "${correctedUrl}" [via ${method}] (${details.count} jobs)`);
          
          if (!isDryRun) {
            // Perform database update in Supabase
            const { error } = await supabase
              .from('jobs')
              .update({
                official_website_link: correctedUrl,
                official_application_link: correctedUrl,
                official_notification_link: correctedUrl
              })
              .in('id', details.jobIds);
              
            if (error) {
              console.error(`    [ERROR] Failed to update jobs for ${org}:`, error.message);
            } else {
              updatedJobsCount += details.jobIds.length;
            }
          } else {
            updatedJobsCount += details.jobIds.length;
          }
        }
      }));
      
      // Delay briefly between batches
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\n=== Audit Summary ===`);
    console.log(`Organizations audited: ${processedCount}`);
    console.log(`Jobs updated/marked for update: ${updatedJobsCount}`);
    console.log(`Resolved via Dictionary: ${resolvedViaDict}`);
    console.log(`Resolved via Llama 3.1: ${resolvedViaLlama}`);
    console.log(`Cleared Generic Fallback (set to empty): ${resolvedViaClearedFallback}`);
    
  } catch (err) {
    console.error('Fatal error during execution:', err);
  }
  process.exit(0);
}

run();
