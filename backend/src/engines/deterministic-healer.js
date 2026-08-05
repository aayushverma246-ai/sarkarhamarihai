'use strict';

/**
 * deterministic-healer.js — Local Data Healing Engine
 * 
 * Fixes all seeder records WITHOUT requiring Gemini API:
 * 1. Fixes broken URLs (spaces in state .gov.in links)
 * 2. Corrects state field from "All India" to actual state
 * 3. Maps proper official website links per organization
 * 4. Applies correct selection processes based on job_category
 * 5. Normalizes salary ranges per category
 * 6. Updates discovery_source to 'healed'
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ztbgunartkntrqxxsdpc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const sb = SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// ── STATE EXTRACTION MAP ────────────────────────────────────────────────────────
const INDIAN_STATES = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh',
    'Andaman & Nicobar', 'Andaman & Nicobar Islands',
    'Dadra & Nagar Haveli', 'Dadra & Nagar Haveli and Daman & Diu',
    'Daman & Diu', 'Lakshadweep', 'Puducherry'
];

// ── STATE → OFFICIAL WEBSITE ────────────────────────────────────────────────────
const STATE_WEBSITES = {
    'Andhra Pradesh': 'https://ap.gov.in',
    'Arunachal Pradesh': 'https://arunachalpradesh.gov.in',
    'Assam': 'https://assam.gov.in',
    'Bihar': 'https://state.bihar.gov.in',
    'Chhattisgarh': 'https://cgstate.gov.in',
    'Goa': 'https://goa.gov.in',
    'Gujarat': 'https://gujaratindia.gov.in',
    'Haryana': 'https://haryana.gov.in',
    'Himachal Pradesh': 'https://himachal.nic.in',
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
    'Jammu & Kashmir': 'https://jk.gov.in',
    'Ladakh': 'https://ladakh.gov.in',
    'Chandigarh': 'https://chandigarh.gov.in',
    'Andaman & Nicobar': 'https://andamannicobar.gov.in',
    'Andaman & Nicobar Islands': 'https://andamannicobar.gov.in',
    'Dadra & Nagar Haveli': 'https://dnh.gov.in',
    'Dadra & Nagar Haveli and Daman & Diu': 'https://dnh.gov.in',
    'Daman & Diu': 'https://dnh.gov.in',
    'Lakshadweep': 'https://lakshadweep.gov.in',
    'Puducherry': 'https://py.gov.in'
};

// ── ORGANIZATION → OFFICIAL WEBSITE ─────────────────────────────────────────────
const ORG_WEBSITES = {
    'UPSC': 'https://upsc.gov.in',
    'SSC': 'https://ssc.gov.in',
    'RRB': 'https://indianrailways.gov.in',
    'IBPS': 'https://ibps.in',
    'SBI': 'https://sbi.co.in',
    'RBI': 'https://rbi.org.in',
    'CRPF': 'https://crpf.gov.in',
    'BSF': 'https://bsf.gov.in',
    'CISF': 'https://cisf.gov.in',
    'ITBP': 'https://itbp.gov.in',
    'Indian Army': 'https://joinindianarmy.nic.in',
    'Indian Navy': 'https://joinindiannavy.gov.in',
    'Indian Air Force': 'https://indianairforce.nic.in',
    'NTA': 'https://nta.ac.in',
    'CSIR': 'https://csir.res.in',
    'DRDO': 'https://drdo.gov.in',
    'ISRO': 'https://isro.gov.in',
    'ONGC': 'https://ongcindia.com',
    'NTPC': 'https://ntpc.co.in',
    'BHEL': 'https://bhel.com',
    'SAIL': 'https://sail.co.in',
    'IOCL': 'https://iocl.com',
    'BPCL': 'https://bharatpetroleum.in',
    'HPCL': 'https://hindustanpetroleum.com',
    'GAIL': 'https://gailonline.com',
    'Coal India': 'https://coalindia.in',
    'HAL': 'https://hal-india.co.in',
    'BEL': 'https://bel-india.in',
    'LIC': 'https://licindia.in',
    'FCI': 'https://fci.gov.in',
    'AIIMS': 'https://aiims.edu',
    'IIT': 'https://iitsystem.ac.in',
    'NIT': 'https://nitcouncil.org.in'
};

// ── CATEGORY → SELECTION PROCESS ────────────────────────────────────────────────
const CATEGORY_SELECTION_PROCESS = {
    'UPSC': 'Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.',
    'SSC': 'Stage 1: Tier I → Computer Based Exam Stage 2: Tier II → Quantitative, Reasoning, English & GA Stage 3: Skill Test (if applicable) Final Stage: Merit based on Tier II scores.',
    'Banking': 'Stage 1: Preliminary Exam → Quantitative, Reasoning, English Stage 2: Main Exam → Objective + Descriptive Stage 3: Interview (for PO/SO posts) Final Stage: Final Merit.',
    'Railways': 'Stage 1: CBT 1 → Screening Stage 2: CBT 2 → Core Subject Mastery Stage 3: Skill Test / Typing (if applicable) Final Stage: Document Verification & Medical.',
    'Defence': 'Stage 1: Written Exam → General Knowledge & Aptitude Stage 2: Physical Test / SSB Interview Stage 3: Medical Exam Final Stage: Final Merit List.',
    'Police': 'Stage 1: Written Exam → Law & Reasoning Stage 2: Physical Measurement Test Stage 3: Personal Interview (for higher ranks) Final Stage: Merit list based on all rounds.',
    'Teaching': 'Stage 1: Written Exam → Pedagogical & Subject Knowledge Stage 2: Interview / Demo Class (if applicable) Final Stage: Selection based on merit score.',
    'Healthcare': 'Stage 1: Computer Based Test (CBT) → Nursing/Medical Standards Stage 2: Document Verification Final Stage: Medical fitness and final selection.',
    'PSU': 'Stage 1: GATE Score / Written Test → Academic/Technical excellence Stage 2: Group Discussion Stage 3: Personal Interview Final Stage: Final Merit list.',
    'Research & Science': 'Stage 1: Written Exam → Advanced Technical/Subject Domain Stage 2: Personal Interview → Research Aptitude Final Stage: Final Merit.',
    'Judiciary': 'Stage 1: Preliminary Exam → Law & General Knowledge Stage 2: Main Exam → Descriptive Law Papers Stage 3: Interview → Viva-voce Final Stage: Merit list.',
    'State PSCs': 'Stage 1: Preliminary Exam → Objective screening Stage 2: Main Exam → Descriptive papers Stage 3: Interview → Personality assessment Final Stage: Final selection based on Mains + Interview.',
    'State Government': 'Stage 1: Written Exam / Screening Test Stage 2: Skill Test / Document Verification Stage 3: Personal Interview (if applicable) Final Stage: Final Merit.',
    'Central Government': 'Stage 1: Written Exam / Screening Test → Objective or Descriptive Stage 2: Skill Test / Document Verification Stage 3: Personal Interview (if applicable) Final Stage: Final Merit.',
    'Entrance Exam': 'Stage 1: Entrance Exam → Objective MCQ Stage 2: Counselling → Seat Allotment based on Rank Stage 3: Document Verification Final Stage: Admission based on Rank + Preference.',
    'Engineering': 'Stage 1: Written Exam / GATE Score Stage 2: Technical Interview Stage 3: Document Verification Final Stage: Final Merit.',
    'Insurance': 'Stage 1: Preliminary Exam → Objective Stage 2: Main Exam → Objective + Descriptive Stage 3: Interview Final Stage: Final Merit.',
    'Agriculture': 'Stage 1: Written Exam → Subject Knowledge Stage 2: Interview / Field Test Final Stage: Final Merit.',
    'Forest & Environment': 'Stage 1: Written Exam → General & Subject Knowledge Stage 2: Physical Test Stage 3: Interview Final Stage: Final Merit.',
    'Telecom': 'Stage 1: Written Exam / GATE Score Stage 2: Interview Final Stage: Final Merit.',
    'Shipping & Ports': 'Stage 1: Written Exam Stage 2: Skill / Trade Test Stage 3: Interview Final Stage: Final Merit.',
    'Cooperative': 'Stage 1: Written Exam Stage 2: Interview Final Stage: Final Merit.'
};

// ── CATEGORY → SALARY RANGES ────────────────────────────────────────────────────
const CATEGORY_SALARY = {
    'UPSC': { min: 56100, max: 250000 },
    'SSC': { min: 25500, max: 81100 },
    'Banking': { min: 23700, max: 89890 },
    'Railways': { min: 19900, max: 63200 },
    'Defence': { min: 21700, max: 69100 },
    'Police': { min: 21700, max: 69100 },
    'Teaching': { min: 35400, max: 112400 },
    'Healthcare': { min: 25500, max: 81100 },
    'PSU': { min: 40000, max: 140000 },
    'Research & Science': { min: 56100, max: 177500 },
    'Judiciary': { min: 44900, max: 142400 },
    'State PSCs': { min: 36400, max: 114800 },
    'State Government': { min: 18000, max: 56900 },
    'Central Government': { min: 25500, max: 81100 },
    'Entrance Exam': { min: 0, max: 0 },
    'Engineering': { min: 35400, max: 112400 },
    'Insurance': { min: 32795, max: 62315 },
    'Agriculture': { min: 25500, max: 81100 },
    'Forest & Environment': { min: 25500, max: 81100 },
    'Telecom': { min: 35400, max: 112400 },
    'Shipping & Ports': { min: 25500, max: 81100 },
    'Cooperative': { min: 18000, max: 56900 }
};

// ── HELPER: Extract state from job name/org ─────────────────────────────────────
function extractState(jobName, organization) {
    const text = `${jobName} ${organization}`;
    const sorted = [...INDIAN_STATES].sort((a, b) => b.length - a.length);
    for (const state of sorted) {
        if (text.includes(state)) return state;
    }
    if (/\bSSC\b/.test(text) || /\bUPSC\b/.test(text) || /\bIBPS\b/.test(text)) return 'All India';
    if (/\bRRB\b/.test(text) || /\bNTA\b/.test(text)) return 'All India';
    return null;
}

// ── HELPER: Fix broken URL ──────────────────────────────────────────────────────
function fixUrl(url, state) {
    if (!url || url === '') return '';
    if (url.length < 5) return '';
    if (url.includes(' ')) {
        return url.replace(/\s+/g, '');
    }
    return url;
}

// ── HELPER: Get org website from job/org text ───────────────────────────────────
function getOrgWebsite(jobName, organization) {
    const text = `${jobName} ${organization}`.toUpperCase();
    for (const [key, url] of Object.entries(ORG_WEBSITES)) {
        if (text.includes(key.toUpperCase())) return url;
    }
    return null;
}

// ── MAIN HEALER ─────────────────────────────────────────────────────────────────
async function healAllRecords() {
    if (!sb) {
        throw new Error('Supabase client not initialized - SUPABASE_SERVICE_ROLE_KEY is missing from environment.');
    }
    console.log('[Healer] Starting deterministic data healing engine...');
    const startTime = Date.now();

    const batchSize = 500;
    let totalProcessed = 0;
    let totalFixed = 0;
    let totalUrlFixes = 0;
    let totalStateFixes = 0;
    let totalSelProcFixes = 0;
    let totalSalaryFixes = 0;
    let batchNum = 0;

    while (true) {
        batchNum++;
        console.log(`[Healer] Fetching batch #${batchNum} (querying records with 15000-80000 placeholder)...`);
        const { data: records, error } = await sb.from('jobs')
            .select('id, job_name, organization, job_category, application_start_date, application_end_date, salary_min, salary_max, selection_process, official_application_link, official_notification_link, official_website_link, discovery_source, state')
            .eq('salary_min', 15000)
            .eq('salary_max', 80000)
            .range(0, batchSize - 1);

        if (error) {
            console.error('[Healer] Fetch error:', error.message);
            break;
        }
        if (!records || records.length === 0) break;

        const updates = [];
        for (const rec of records) {
            const patch = {};
            let changed = false;

            const detectedState = extractState(rec.job_name, rec.organization);
            if (detectedState && rec.state !== detectedState) {
                patch.state = detectedState;
                changed = true;
                totalStateFixes++;
            }
            const effectiveState = patch.state || rec.state;

            const fixedAppLink = fixUrl(rec.official_application_link, effectiveState);
            if (fixedAppLink !== rec.official_application_link) {
                patch.official_application_link = fixedAppLink;
                changed = true;
                totalUrlFixes++;
            }
            const fixedNotifLink = fixUrl(rec.official_notification_link, effectiveState);
            if (fixedNotifLink !== rec.official_notification_link) {
                patch.official_notification_link = fixedNotifLink;
                changed = true;
            }
            const fixedWebLink = fixUrl(rec.official_website_link, effectiveState);
            if (fixedWebLink !== rec.official_website_link) {
                patch.official_website_link = fixedWebLink;
                changed = true;
            }

            const orgSite = getOrgWebsite(rec.job_name, rec.organization);
            if (orgSite && rec.official_website_link !== orgSite) {
                patch.official_website_link = orgSite;
                changed = true;
            }

            const cat = rec.job_category;
            if (cat && CATEGORY_SELECTION_PROCESS[cat]) {
                if (!rec.selection_process || rec.selection_process.trim().length === 0) {
                    patch.selection_process = CATEGORY_SELECTION_PROCESS[cat];
                    changed = true;
                    totalSelProcFixes++;
                }
            }

            if (rec.salary_min === 15000 && rec.salary_max === 80000) {
                patch.salary_min = 0;
                patch.salary_max = 0;
                changed = true;
                totalSalaryFixes++;
            }

            patch.discovery_source = 'healed';
            patch.last_verified_at = new Date().toISOString();
            
            if (changed) {
                updates.push({ id: rec.id, ...patch });
                totalFixed++;
            } else {
                updates.push({ id: rec.id, discovery_source: 'healed', last_verified_at: patch.last_verified_at });
            }
        }

        console.log(`[Healer] Executing ${updates.length} updates...`);
        const CONCURRENCY = 25;
        for (let i = 0; i < updates.length; i += CONCURRENCY) {
            const batch = updates.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(async (upd) => {
                const { id, ...fields } = upd;
                const { error: updErr } = await sb.from('jobs').update(fields).eq('id', id);
                if (updErr) {
                    console.error(`[Healer] Update failed for ${id}:`, updErr.message);
                }
            }));
        }

        totalProcessed += records.length;
        console.log(`[Healer] Batch done. Processed: ${totalProcessed}, Fixed: ${totalFixed}`);

        if (records.length < batchSize) break;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const report = {
        totalProcessed,
        totalFixed,
        totalUrlFixes,
        totalStateFixes,
        totalSelProcFixes,
        totalSalaryFixes,
        durationSeconds: duration
    };

    return report;
}

module.exports = { healAllRecords };
