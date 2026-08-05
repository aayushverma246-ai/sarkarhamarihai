'use strict';
/**
 * heal-bank-links.js — Correct official websites of PSU banks
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BANK_WEBSITES = {
  'state bank of india': 'https://www.sbi.co.in',
  'sbi': 'https://www.sbi.co.in',
  'punjab national bank': 'https://www.pnbindia.in',
  'pnb': 'https://www.pnbindia.in',
  'union bank of india': 'https://www.unionbankofindia.co.in',
  'canara bank': 'https://canarabank.com',
  'bank of baroda': 'https://www.bankofbaroda.in',
  'bob': 'https://www.bankofbaroda.in',
  'indian bank': 'https://www.indianbank.in',
  'bank of india': 'https://www.bankofindia.co.in',
  'boi': 'https://www.bankofindia.co.in',
  'uco bank': 'https://www.ucobank.com',
  'central bank of india': 'https://www.centralbankofindia.co.in',
  'indian overseas bank': 'https://www.iob.in',
  'iob': 'https://www.iob.in',
  'bank of maharashtra': 'https://bankofmaharashtra.in',
  'punjab & sind bank': 'https://punjabandsindbank.co.in',
};

function getCorrectBankUrl(name, org) {
  const text = `${name} ${org}`.toLowerCase();
  for (const [key, url] of Object.entries(BANK_WEBSITES)) {
    if (text.includes(key)) {
      return url;
    }
  }
  return null;
}

async function run() {
  console.log('Fetching bank jobs with generic association links...');
  const { data, error } = await sb.from('jobs')
    .select('id, job_name, organization, official_website_link, official_application_link, official_notification_link')
    .or('official_website_link.ilike.%indianbanksassociation.org%,official_application_link.ilike.%indianbanksassociation.org%,official_notification_link.ilike.%indianbanksassociation.org%');

  if (error) {
    console.error('Fetch error:', error.message);
    process.exit(1);
  }

  console.log(`Found ${data.length} bank jobs with generic links.\n`);

  let healedCount = 0;
  for (const job of data) {
    const correctUrl = getCorrectBankUrl(job.job_name, job.organization);
    if (correctUrl) {
      const updateData = {};
      if (job.official_website_link?.includes('indianbanksassociation.org')) {
        updateData.official_website_link = correctUrl;
      }
      if (job.official_application_link?.includes('indianbanksassociation.org')) {
        updateData.official_application_link = `${correctUrl}/careers`; // Careers page standard
      }
      if (job.official_notification_link?.includes('indianbanksassociation.org')) {
        updateData.official_notification_link = `${correctUrl}/careers`;
      }

      const { error: updErr } = await sb.from('jobs').update(updateData).eq('id', job.id);
      if (updErr) {
        console.error(`Error updating ${job.job_name}:`, updErr.message);
      } else {
        console.log(`✅ Healed: "${job.job_name}" -> ${correctUrl}`);
        healedCount++;
      }
    } else {
      console.log(`⚠️ Could not resolve bank for: "${job.job_name}"`);
    }
  }

  console.log(`\nSuccess: Healed ${healedCount}/${data.length} jobs.`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
