'use strict';
/**
 * fix-district-dedup.js — Fix district job duplicates and wrong states
 * 
 * Problem: make-district-data-genuine.js created multiple copies of the same 
 * district job with random state assignments. This script:
 * 1. Groups district jobs by name+org
 * 2. Keeps the best record (with correct state derived from district name)
 * 3. Deletes all true duplicates
 * 4. Fixes wrong state assignments on the kept records
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../backend/.env') });
const { createClient } = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ── DISTRICT → STATE mapping (comprehensive) ──
const DISTRICT_STATE_MAP = {
  // Andaman & Nicobar
  'south andaman': 'Andaman & Nicobar Islands',
  'north & middle andaman': 'Andaman & Nicobar Islands',
  'nicobar': 'Andaman & Nicobar Islands',
  // Andhra Pradesh
  'anantapur': 'Andhra Pradesh', 'chittoor': 'Andhra Pradesh', 'east godavari': 'Andhra Pradesh',
  'guntur': 'Andhra Pradesh', 'krishna': 'Andhra Pradesh', 'kurnool': 'Andhra Pradesh',
  'nellore': 'Andhra Pradesh', 'prakasam': 'Andhra Pradesh', 'srikakulam': 'Andhra Pradesh',
  'visakhapatnam': 'Andhra Pradesh', 'vizianagaram': 'Andhra Pradesh', 'west godavari': 'Andhra Pradesh',
  'kadapa': 'Andhra Pradesh', 'tirupati': 'Andhra Pradesh', 'kakinada': 'Andhra Pradesh',
  'ntr': 'Andhra Pradesh', 'palnadu': 'Andhra Pradesh', 'anakapalli': 'Andhra Pradesh',
  'alluri sitharama raju': 'Andhra Pradesh', 'konaseema': 'Andhra Pradesh',
  'eluru': 'Andhra Pradesh', 'bapatla': 'Andhra Pradesh', 'sri sathya sai': 'Andhra Pradesh',
  'annamayya': 'Andhra Pradesh',
  // Arunachal Pradesh
  'itanagar': 'Arunachal Pradesh', 'tawang': 'Arunachal Pradesh', 'west kameng': 'Arunachal Pradesh',
  'east kameng': 'Arunachal Pradesh', 'papum pare': 'Arunachal Pradesh',
  'lower subansiri': 'Arunachal Pradesh', 'upper subansiri': 'Arunachal Pradesh',
  'west siang': 'Arunachal Pradesh', 'east siang': 'Arunachal Pradesh',
  'upper siang': 'Arunachal Pradesh', 'changlang': 'Arunachal Pradesh',
  'tirap': 'Arunachal Pradesh', 'lohit': 'Arunachal Pradesh', 'anjaw': 'Arunachal Pradesh',
  'longding': 'Arunachal Pradesh', 'namsai': 'Arunachal Pradesh',
  // Assam
  'kamrup': 'Assam', 'guwahati': 'Assam', 'nagaon': 'Assam', 'sonitpur': 'Assam',
  'dibrugarh': 'Assam', 'jorhat': 'Assam', 'tinsukia': 'Assam', 'cachar': 'Assam',
  'barpeta': 'Assam', 'goalpara': 'Assam', 'dhubri': 'Assam', 'kokrajhar': 'Assam',
  'darrang': 'Assam', 'lakhimpur': 'Assam', 'sivasagar': 'Assam', 'golaghat': 'Assam',
  // Bihar
  'patna': 'Bihar', 'gaya': 'Bihar', 'bhagalpur': 'Bihar', 'muzaffarpur': 'Bihar',
  'darbhanga': 'Bihar', 'purnia': 'Bihar', 'begusarai': 'Bihar', 'samastipur': 'Bihar',
  'munger': 'Bihar', 'nalanda': 'Bihar', 'vaishali': 'Bihar', 'arrah': 'Bihar',
  'saran': 'Bihar', 'madhubani': 'Bihar', 'sitamarhi': 'Bihar', 'aurangabad bihar': 'Bihar',
  // Chhattisgarh
  'raipur': 'Chhattisgarh', 'bilaspur cg': 'Chhattisgarh', 'durg': 'Chhattisgarh',
  'rajnandgaon': 'Chhattisgarh', 'korba': 'Chhattisgarh', 'jagdalpur': 'Chhattisgarh',
  'bastar': 'Chhattisgarh', 'surguja': 'Chhattisgarh', 'janjgir-champa': 'Chhattisgarh',
  'raigarh cg': 'Chhattisgarh', 'mahasamund': 'Chhattisgarh', 'kanker': 'Chhattisgarh',
  // Delhi
  'new delhi': 'Delhi', 'central delhi': 'Delhi', 'north delhi': 'Delhi',
  'south delhi': 'Delhi', 'east delhi': 'Delhi', 'west delhi': 'Delhi',
  'north east delhi': 'Delhi', 'north west delhi': 'Delhi', 'south east delhi': 'Delhi',
  'south west delhi': 'Delhi', 'shahdara': 'Delhi',
  // Goa
  'north goa': 'Goa', 'south goa': 'Goa',
  // Gujarat
  'ahmedabad': 'Gujarat', 'surat': 'Gujarat', 'vadodara': 'Gujarat', 'rajkot': 'Gujarat',
  'bhavnagar': 'Gujarat', 'jamnagar': 'Gujarat', 'junagadh': 'Gujarat', 'gandhinagar': 'Gujarat',
  'anand': 'Gujarat', 'kheda': 'Gujarat', 'mehsana': 'Gujarat', 'patan': 'Gujarat',
  'banaskantha': 'Gujarat', 'sabarkantha': 'Gujarat', 'kutch': 'Gujarat', 'surendranagar': 'Gujarat',
  'bharuch': 'Gujarat', 'narmada': 'Gujarat', 'navsari': 'Gujarat', 'valsad': 'Gujarat',
  // Haryana
  'faridabad': 'Haryana', 'gurugram': 'Haryana', 'gurgaon': 'Haryana', 'hisar': 'Haryana',
  'rohtak': 'Haryana', 'panipat': 'Haryana', 'karnal': 'Haryana', 'sonipat': 'Haryana',
  'ambala': 'Haryana', 'yamunanagar': 'Haryana', 'sirsa': 'Haryana', 'jind': 'Haryana',
  'bhiwani': 'Haryana', 'rewari': 'Haryana', 'mahendragarh': 'Haryana',
  'kurukshetra': 'Haryana', 'kaithal': 'Haryana', 'panchkula': 'Haryana',
  // Himachal Pradesh
  'shimla': 'Himachal Pradesh', 'kangra': 'Himachal Pradesh', 'mandi': 'Himachal Pradesh',
  'kullu': 'Himachal Pradesh', 'solan': 'Himachal Pradesh', 'hamirpur hp': 'Himachal Pradesh',
  'una': 'Himachal Pradesh', 'sirmaur': 'Himachal Pradesh', 'chamba': 'Himachal Pradesh',
  'bilaspur hp': 'Himachal Pradesh', 'kinnaur': 'Himachal Pradesh', 'lahaul & spiti': 'Himachal Pradesh',
  // Jharkhand
  'ranchi': 'Jharkhand', 'jamshedpur': 'Jharkhand', 'dhanbad': 'Jharkhand',
  'bokaro': 'Jharkhand', 'hazaribagh': 'Jharkhand', 'deoghar': 'Jharkhand',
  'giridih': 'Jharkhand', 'dumka': 'Jharkhand', 'palamu': 'Jharkhand',
  // Karnataka
  'bengaluru': 'Karnataka', 'bangalore': 'Karnataka', 'mysuru': 'Karnataka', 'mysore': 'Karnataka',
  'hubli': 'Karnataka', 'mangaluru': 'Karnataka', 'mangalore': 'Karnataka',
  'belagavi': 'Karnataka', 'belgaum': 'Karnataka', 'davangere': 'Karnataka',
  'bellary': 'Karnataka', 'ballari': 'Karnataka', 'shimoga': 'Karnataka',
  'tumkur': 'Karnataka', 'raichur': 'Karnataka', 'bidar': 'Karnataka',
  'gulbarga': 'Karnataka', 'kalaburagi': 'Karnataka', 'hassan': 'Karnataka',
  'chitradurga': 'Karnataka', 'udupi': 'Karnataka', 'dharwad': 'Karnataka',
  // Kerala
  'thiruvananthapuram': 'Kerala', 'kochi': 'Kerala', 'ernakulam': 'Kerala',
  'kozhikode': 'Kerala', 'thrissur': 'Kerala', 'kollam': 'Kerala',
  'palakkad': 'Kerala', 'malappuram': 'Kerala', 'alappuzha': 'Kerala',
  'kannur': 'Kerala', 'kottayam': 'Kerala', 'idukki': 'Kerala',
  'wayanad': 'Kerala', 'pathanamthitta': 'Kerala', 'kasaragod': 'Kerala',
  // Madhya Pradesh
  'bhopal': 'Madhya Pradesh', 'indore': 'Madhya Pradesh', 'jabalpur': 'Madhya Pradesh',
  'gwalior': 'Madhya Pradesh', 'ujjain': 'Madhya Pradesh', 'sagar': 'Madhya Pradesh',
  'dewas': 'Madhya Pradesh', 'satna': 'Madhya Pradesh', 'ratlam': 'Madhya Pradesh',
  'rewa': 'Madhya Pradesh', 'chhindwara': 'Madhya Pradesh', 'betul': 'Madhya Pradesh',
  'hoshangabad': 'Madhya Pradesh', 'vidisha': 'Madhya Pradesh',
  // Maharashtra
  'mumbai': 'Maharashtra', 'pune': 'Maharashtra', 'nagpur': 'Maharashtra',
  'thane': 'Maharashtra', 'nashik': 'Maharashtra', 'aurangabad mh': 'Maharashtra',
  'solapur': 'Maharashtra', 'kolhapur': 'Maharashtra', 'sangli': 'Maharashtra',
  'satara': 'Maharashtra', 'ratnagiri': 'Maharashtra', 'sindhudurg': 'Maharashtra',
  'ahmednagar': 'Maharashtra', 'jalgaon': 'Maharashtra', 'dhule': 'Maharashtra',
  'nanded': 'Maharashtra', 'latur': 'Maharashtra', 'osmanabad': 'Maharashtra',
  'beed': 'Maharashtra', 'parbhani': 'Maharashtra', 'amravati': 'Maharashtra',
  'akola': 'Maharashtra', 'buldhana': 'Maharashtra', 'washim': 'Maharashtra',
  'yavatmal': 'Maharashtra', 'wardha': 'Maharashtra', 'chandrapur': 'Maharashtra',
  'gadchiroli': 'Maharashtra', 'gondia': 'Maharashtra', 'bhandara': 'Maharashtra',
  'raigad': 'Maharashtra', 'palghar': 'Maharashtra',
  // Manipur
  'imphal': 'Manipur', 'imphal west': 'Manipur', 'imphal east': 'Manipur',
  'thoubal': 'Manipur', 'bishnupur': 'Manipur', 'churachandpur': 'Manipur',
  // Meghalaya
  'shillong': 'Meghalaya', 'east khasi hills': 'Meghalaya', 'west garo hills': 'Meghalaya',
  'ri bhoi': 'Meghalaya', 'jaintia hills': 'Meghalaya',
  // Mizoram
  'aizawl': 'Mizoram', 'lunglei': 'Mizoram', 'champhai': 'Mizoram',
  // Nagaland
  'kohima': 'Nagaland', 'dimapur': 'Nagaland', 'mokokchung': 'Nagaland',
  // Odisha
  'bhubaneswar': 'Odisha', 'cuttack': 'Odisha', 'berhampur': 'Odisha',
  'rourkela': 'Odisha', 'sambalpur': 'Odisha', 'balasore': 'Odisha',
  'puri': 'Odisha', 'khurda': 'Odisha', 'ganjam': 'Odisha',
  'koraput': 'Odisha', 'mayurbhanj': 'Odisha', 'sundargarh': 'Odisha',
  'kalahandi': 'Odisha', 'bolangir': 'Odisha', 'kendrapara': 'Odisha',
  'jagatsinghpur': 'Odisha', 'jajpur': 'Odisha', 'dhenkanal': 'Odisha',
  // Punjab
  'ludhiana': 'Punjab', 'amritsar': 'Punjab', 'jalandhar': 'Punjab',
  'patiala': 'Punjab', 'bathinda': 'Punjab', 'mohali': 'Punjab',
  'pathankot': 'Punjab', 'hoshiarpur': 'Punjab', 'moga': 'Punjab',
  'firozpur': 'Punjab', 'sangrur': 'Punjab', 'kapurthala': 'Punjab',
  'barnala': 'Punjab', 'muktsar': 'Punjab', 'fatehgarh sahib': 'Punjab',
  'gurdaspur': 'Punjab', 'nawanshahr': 'Punjab', 'mansa': 'Punjab',
  'rupnagar': 'Punjab', 'faridkot': 'Punjab', 'tarn taran': 'Punjab',
  // Rajasthan
  'jaipur': 'Rajasthan', 'jodhpur': 'Rajasthan', 'udaipur': 'Rajasthan',
  'kota': 'Rajasthan', 'ajmer': 'Rajasthan', 'bikaner': 'Rajasthan',
  'bhilwara': 'Rajasthan', 'alwar': 'Rajasthan', 'sikar': 'Rajasthan',
  'bharatpur': 'Rajasthan', 'pali': 'Rajasthan', 'nagaur': 'Rajasthan',
  'tonk': 'Rajasthan', 'chittorgarh': 'Rajasthan', 'jhunjhunu': 'Rajasthan',
  'churu': 'Rajasthan', 'barmer': 'Rajasthan', 'jaisalmer': 'Rajasthan',
  'banswara': 'Rajasthan', 'dungarpur': 'Rajasthan', 'bundi': 'Rajasthan',
  'jhalawar': 'Rajasthan', 'sawai madhopur': 'Rajasthan', 'dausa': 'Rajasthan',
  'dholpur': 'Rajasthan', 'karauli': 'Rajasthan', 'pratapgarh rj': 'Rajasthan',
  'rajsamand': 'Rajasthan', 'hanumangarh': 'Rajasthan', 'sri ganganagar': 'Rajasthan',
  // Sikkim
  'gangtok': 'Sikkim', 'east sikkim': 'Sikkim', 'west sikkim': 'Sikkim',
  'north sikkim': 'Sikkim', 'south sikkim': 'Sikkim',
  // Tamil Nadu
  'chennai': 'Tamil Nadu', 'coimbatore': 'Tamil Nadu', 'madurai': 'Tamil Nadu',
  'tiruchirappalli': 'Tamil Nadu', 'trichy': 'Tamil Nadu', 'salem': 'Tamil Nadu',
  'tirunelveli': 'Tamil Nadu', 'vellore': 'Tamil Nadu', 'erode': 'Tamil Nadu',
  'thanjavur': 'Tamil Nadu', 'dindigul': 'Tamil Nadu', 'kanchipuram': 'Tamil Nadu',
  'tiruvannamalai': 'Tamil Nadu', 'cuddalore': 'Tamil Nadu', 'villupuram': 'Tamil Nadu',
  'nagapattinam': 'Tamil Nadu', 'sivaganga': 'Tamil Nadu', 'ramanathapuram': 'Tamil Nadu',
  'theni': 'Tamil Nadu', 'virudhunagar': 'Tamil Nadu', 'thoothukudi': 'Tamil Nadu',
  'tiruppur': 'Tamil Nadu', 'karur': 'Tamil Nadu', 'namakkal': 'Tamil Nadu',
  'perambalur': 'Tamil Nadu', 'ariyalur': 'Tamil Nadu', 'krishnagiri': 'Tamil Nadu',
  'dharmapuri': 'Tamil Nadu', 'nilgiris': 'Tamil Nadu', 'the nilgiris': 'Tamil Nadu',
  // Telangana
  'hyderabad': 'Telangana', 'warangal': 'Telangana', 'karimnagar': 'Telangana',
  'khammam': 'Telangana', 'nizamabad': 'Telangana', 'nalgonda': 'Telangana',
  'adilabad': 'Telangana', 'mahabubnagar': 'Telangana', 'medak': 'Telangana',
  'rangareddy': 'Telangana', 'sangareddy': 'Telangana', 'siddipet': 'Telangana',
  'suryapet': 'Telangana', 'jagitial': 'Telangana', 'mancherial': 'Telangana',
  // Tripura
  'agartala': 'Tripura', 'west tripura': 'Tripura', 'south tripura': 'Tripura',
  'north tripura': 'Tripura', 'dhalai': 'Tripura', 'gomati': 'Tripura',
  'khowai': 'Tripura', 'sepahijala': 'Tripura', 'unakoti': 'Tripura',
  // Uttar Pradesh
  'lucknow': 'Uttar Pradesh', 'kanpur': 'Uttar Pradesh', 'agra': 'Uttar Pradesh',
  'varanasi': 'Uttar Pradesh', 'meerut': 'Uttar Pradesh', 'allahabad': 'Uttar Pradesh',
  'prayagraj': 'Uttar Pradesh', 'bareilly': 'Uttar Pradesh', 'moradabad': 'Uttar Pradesh',
  'aligarh': 'Uttar Pradesh', 'gorakhpur': 'Uttar Pradesh', 'jhansi': 'Uttar Pradesh',
  'saharanpur': 'Uttar Pradesh', 'mathura': 'Uttar Pradesh', 'firozabad': 'Uttar Pradesh',
  'noida': 'Uttar Pradesh', 'ghaziabad': 'Uttar Pradesh', 'muzaffarnagar': 'Uttar Pradesh',
  'shahjahanpur': 'Uttar Pradesh', 'rampur': 'Uttar Pradesh', 'lakhimpur kheri': 'Uttar Pradesh',
  'etawah': 'Uttar Pradesh', 'mainpuri': 'Uttar Pradesh', 'budaun': 'Uttar Pradesh',
  'farrukhabad': 'Uttar Pradesh', 'rae bareli': 'Uttar Pradesh', 'sultanpur': 'Uttar Pradesh',
  'ayodhya': 'Uttar Pradesh', 'faizabad': 'Uttar Pradesh', 'barabanki': 'Uttar Pradesh',
  'unnao': 'Uttar Pradesh', 'hardoi': 'Uttar Pradesh', 'sitapur': 'Uttar Pradesh',
  'basti': 'Uttar Pradesh', 'deoria': 'Uttar Pradesh', 'ballia': 'Uttar Pradesh',
  'azamgarh': 'Uttar Pradesh', 'jaunpur': 'Uttar Pradesh', 'mirzapur': 'Uttar Pradesh',
  'sonbhadra': 'Uttar Pradesh', 'chandauli': 'Uttar Pradesh', 'ghazipur': 'Uttar Pradesh',
  'pratapgarh up': 'Uttar Pradesh', 'fatehpur': 'Uttar Pradesh', 'hamirpur up': 'Uttar Pradesh',
  'banda': 'Uttar Pradesh', 'chitrakoot': 'Uttar Pradesh', 'mahoba': 'Uttar Pradesh',
  'lalitpur': 'Uttar Pradesh', 'etah': 'Uttar Pradesh', 'kasganj': 'Uttar Pradesh',
  'hathras': 'Uttar Pradesh', 'sambhal': 'Uttar Pradesh', 'amroha': 'Uttar Pradesh',
  'bijnor': 'Uttar Pradesh', 'bulandshahr': 'Uttar Pradesh', 'hapur': 'Uttar Pradesh',
  'shamli': 'Uttar Pradesh', 'baghpat': 'Uttar Pradesh', 'gautam buddha nagar': 'Uttar Pradesh',
  // Uttarakhand
  'dehradun': 'Uttarakhand', 'haridwar': 'Uttarakhand', 'nainital': 'Uttarakhand',
  'udham singh nagar': 'Uttarakhand', 'almora': 'Uttarakhand', 'pithoragarh': 'Uttarakhand',
  'chamoli': 'Uttarakhand', 'tehri garhwal': 'Uttarakhand', 'uttarkashi': 'Uttarakhand',
  'pauri garhwal': 'Uttarakhand', 'champawat': 'Uttarakhand', 'bageshwar': 'Uttarakhand',
  'rudraprayag': 'Uttarakhand',
  // West Bengal
  'kolkata': 'West Bengal', 'howrah': 'West Bengal', 'hooghly': 'West Bengal',
  'north 24 parganas': 'West Bengal', 'south 24 parganas': 'West Bengal',
  'nadia': 'West Bengal', 'murshidabad': 'West Bengal', 'bardhaman': 'West Bengal',
  'burdwan': 'West Bengal', 'east burdwan': 'West Bengal', 'west burdwan': 'West Bengal',
  'bankura': 'West Bengal', 'purulia': 'West Bengal', 'birbhum': 'West Bengal',
  'midnapore': 'West Bengal', 'paschim medinipur': 'West Bengal', 'purba medinipur': 'West Bengal',
  'west midnapore': 'West Bengal', 'east midnapore': 'West Bengal',
  'darjeeling': 'West Bengal', 'jalpaiguri': 'West Bengal', 'cooch behar': 'West Bengal',
  'alipurduar': 'West Bengal', 'siliguri': 'West Bengal', 'malda': 'West Bengal',
  'dinajpur': 'West Bengal', 'uttar dinajpur': 'West Bengal', 'dakshin dinajpur': 'West Bengal',
  // J&K
  'srinagar': 'Jammu & Kashmir', 'jammu': 'Jammu & Kashmir', 'anantnag': 'Jammu & Kashmir',
  'baramulla': 'Jammu & Kashmir', 'budgam': 'Jammu & Kashmir', 'pulwama': 'Jammu & Kashmir',
  'kupwara': 'Jammu & Kashmir', 'shopian': 'Jammu & Kashmir', 'kulgam': 'Jammu & Kashmir',
  'bandipora': 'Jammu & Kashmir', 'ganderbal': 'Jammu & Kashmir',
  'kathua': 'Jammu & Kashmir', 'udhampur': 'Jammu & Kashmir', 'doda': 'Jammu & Kashmir',
  'rajouri': 'Jammu & Kashmir', 'poonch': 'Jammu & Kashmir', 'kishtwar': 'Jammu & Kashmir',
  'ramban': 'Jammu & Kashmir', 'reasi': 'Jammu & Kashmir', 'samba': 'Jammu & Kashmir',
  // Ladakh
  'leh': 'Ladakh', 'kargil': 'Ladakh',
  // Chandigarh
  'chandigarh': 'Chandigarh',
  // Puducherry
  'puducherry': 'Puducherry', 'pondicherry': 'Puducherry',
  'karaikal': 'Puducherry', 'mahe': 'Puducherry', 'yanam': 'Puducherry',
  // Dadra & Nagar Haveli / Daman & Diu
  'dadra': 'Dadra & Nagar Haveli and Daman & Diu',
  'silvassa': 'Dadra & Nagar Haveli and Daman & Diu',
  'daman': 'Dadra & Nagar Haveli and Daman & Diu',
  'diu': 'Dadra & Nagar Haveli and Daman & Diu',
  // Lakshadweep
  'lakshadweep': 'Lakshadweep', 'kavaratti': 'Lakshadweep',
};

function deriveStateFromDistrictName(jobName) {
  // Extract district name from "DistrictName District - ..." format
  const distPart = jobName.split(' District')[0].trim().toLowerCase();
  
  // Try exact match first
  if (DISTRICT_STATE_MAP[distPart]) return DISTRICT_STATE_MAP[distPart];
  
  // Try matching the first word of the district
  for (const [key, state] of Object.entries(DISTRICT_STATE_MAP)) {
    if (distPart.includes(key) || key.includes(distPart)) {
      return state;
    }
  }
  
  return null;
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║     FIX DISTRICT DUPLICATES & WRONG STATES                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // Fetch all district admin jobs
  let allDistrict = [];
  for (let p = 0; p < 20; p++) {
    const { data, error } = await sb.from('jobs')
      .select('id,job_name,organization,state,official_website_link,salary_min,salary_max,application_start_date,application_end_date,form_status')
      .ilike('organization', '%District Administration%')
      .range(p * 1000, (p + 1) * 1000 - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allDistrict.push(...data);
    console.log(`  Fetched page ${p + 1}: ${allDistrict.length} records...`);
    if (data.length < 1000) break;
  }
  
  console.log(`\nTotal district admin jobs: ${allDistrict.length}`);

  // Group by name+org
  const groups = new Map();
  for (const job of allDistrict) {
    const key = (job.job_name || '').toLowerCase().trim() + '|' + (job.organization || '').toLowerCase().trim();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(job);
  }

  console.log(`Unique district job types: ${groups.size}`);
  
  const toDelete = [];
  const toUpdate = [];
  let stateFixed = 0;

  for (const [key, records] of groups) {
    // Derive the correct state from the district name
    const sampleName = records[0].job_name;
    const correctState = deriveStateFromDistrictName(sampleName);
    
    // Keep the first record, delete the rest
    const keeper = records[0];
    
    // Fix state if wrong
    if (correctState && keeper.state !== correctState) {
      toUpdate.push({ id: keeper.id, state: correctState });
      stateFixed++;
    }
    
    // Delete duplicates
    for (let i = 1; i < records.length; i++) {
      toDelete.push(records[i].id);
    }
  }

  console.log(`\nRecords to keep: ${groups.size}`);
  console.log(`Duplicates to delete: ${toDelete.length}`);
  console.log(`States to fix: ${stateFixed}`);

  // Phase 1: Fix states
  console.log('\n── Phase 1: Fixing states ──');
  let updatedCount = 0;
  for (let i = 0; i < toUpdate.length; i += 25) {
    const batch = toUpdate.slice(i, i + 25);
    await Promise.all(batch.map(async (upd) => {
      const { error } = await sb.from('jobs').update({ state: upd.state }).eq('id', upd.id);
      if (error) console.error('  Update error:', upd.id, error.message);
      else updatedCount++;
    }));
    if ((i + 25) % 250 === 0) console.log(`  Updated ${Math.min(i + 25, toUpdate.length)}/${toUpdate.length}...`);
  }
  console.log(`  ✅ Fixed ${updatedCount} state assignments`);

  // Phase 2: Delete duplicates
  console.log('\n── Phase 2: Deleting duplicates ──');
  let deletedCount = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error } = await sb.from('jobs').delete().in('id', batch);
    if (error) console.error('  Delete error:', error.message);
    else deletedCount += batch.length;
    if ((i + 100) % 1000 === 0) console.log(`  Deleted ${Math.min(i + 100, toDelete.length)}/${toDelete.length}...`);
  }
  console.log(`  ✅ Deleted ${deletedCount} duplicate records`);

  // Final count
  const { count } = await sb.from('jobs').select('*', { count: 'exact', head: true });
  console.log(`\n═══════════════════════════════════════════`);
  console.log(`  Final total jobs in database: ${count}`);
  console.log(`═══════════════════════════════════════════`);

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
