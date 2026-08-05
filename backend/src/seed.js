const { getDb, getSupabase } = require('./db');
const crypto = require('crypto');

const jobs = [];

const SP_UPSC = "Stage 1: Preliminary Exam → GS I & CSAT (Objective) Stage 2: Main Exam → 9 Descriptive Papers Stage 3: Interview → Personality Test Final Stage: Final Merit based on Mains + Interview.";
const SP_SSC_CGL = "Stage 1: Tier I → Computer Based Exam (Qualifying) Stage 2: Tier II → Quantitative, Reasoning, English, GA & Computer/DEST Final Stage: Merit based on Tier II scores.";
const SP_SSC_OTHER = "Stage 1: Tier I → Computer Based Exam Stage 2: Skill Test → Typing/Stenography (Qualifying) Final Stage: Merit based on Tier I performance. No Interview.";
const SP_BANK_PO = "Stage 1: Preliminary Exam → Quantitative, Reasoning, English Stage 2: Main Exam → Objective + Descriptive Stage 3: Group Exercise & Interview Final Stage: Final Merit (Mains + Interview).";
const SP_BANK_CLERK = "Stage 1: Preliminary Exam → Objective (Qualifying) Stage 2: Main Exam → Composite Objective Paper Final Stage: Merit based on Mains marks. No Interview.";
const SP_DEFENCE_OFFICER = "Stage 1: Written Exam → General Knowledge & Aptitude (Post Specific) Stage 2: SSB Interview → 5-Day Personality Assessment Stage 3: Medical Exam → Physical Fitness Final Stage: Final Merit List.";
const SP_DEFENCE_AGNIVEER = "Stage 1: Online CEE → Computer Based Common Entrance Stage 2: Recruitment Rally → Physical Test (PET/PMT) Stage 3: Medical Test Final Stage: Final Selections.";
const SP_RAILWAY = "Stage 1: CBT 1 → Screening Stage 2: CBT 2 → Core Subject Mastery Stage 3: Skill Test → Typing/Aptitude (if applicable) Final Stage: DV & Medical.";
const SP_TEACHING_CTET = "Stage 1: Written Exam → Paper I (Primary) / Paper II (Upper Primary) Final Stage: Eligibility Certificate (60% marks required). No Interview.";
const SP_TEACHING = "Stage 1: Written Exam → Pedagogical & Subject Knowledge Stage 2: Interview / Demo Class (if applicable) Final Stage: Selection based on merit score.";
const SP_PSU = "Stage 1: GATE Score / Written Test → Academic/Technical excellence Stage 2: Group Discussion → Interpersonal skills Stage 3: Personal Interview → Core competency Final Stage: Final Merit list based on all rounds.";
const SP_PSU_SKILL = "Stage 1: Written Test → Trade/Skill knowledge Stage 2: Skill Test → Practical demonstration (Qualifying) Final Stage: Merit list based on Written score. No Interview.";
const SP_PARA = "Stage 1: CBT → General Awareness & Aptitude Stage 2: PET/PST → Physical Efficiency & Standards Stage 3: Medical Exam Final Stage: Final Selection List.";
const SP_POLICE = "Stage 1: Written Exam → Law & Reasoning Stage 2: Physical Measurement Test Stage 3: Personal Interview (for higher ranks) Final Stage: Merit list based on all rounds.";
const SP_RESEARCH = "Stage 1: Written Exam → Advanced Technical/Subject Domain Stage 2: Personal Interview → Research Aptitude Final Stage: Final Merit based on Interview (and Written if specified).";
const SP_HEALTH = "Stage 1: Computer Based Test (CBT) → Nursing/Medical Standards Stage 2: Document Verification Final Stage: Medical fitness and final selection. No Interview.";
const SP_ENTRANCE = "Stage 1: Entrance Exam → Objective MCQ (Physics, Chemistry, Maths/Biology) Stage 2: Counselling → Seat Allotment based on Rank Stage 3: Document Verification → Certificate Check Final Stage: Admission to Institute based on Rank + Preference.";
const SP_CENTRAL = "Stage 1: Written Exam / Screening Test → Objective or Descriptive (Post Specific) Stage 2: Skill Test / Document Verification → As per post requirement Stage 3: Personal Interview → (if applicable) Final Stage: Final Merit based on Written + Interview (or Written only for non-interview posts).";
const SP_JUDICIARY = "Stage 1: Preliminary Exam → Law & General Knowledge Stage 2: Main Exam → Descriptive Law Papers Stage 3: Interview → Viva-voce Final Stage: Merit list based on Mains + Interview.";
const SP_STATE_CIVIL = "Stage 1: Preliminary Exam → Objective screening Stage 2: Main Exam → Descriptive papers Stage 3: Interview → Personality assessment Final Stage: Final selection based on Mains + Interview.";

const MASTER_CATEGORIES = [
  'Agriculture', 'Apprenticeships', 'Banking', 'Central Government',
  'Cooperative', 'Defence', 'Engineering', 'Entrance Exams',
  'Forest & Environment', 'Healthcare', 'Insurance', 'Judiciary',
  'Law', 'Others', 'PSU', 'Police', 'Railways',
  'Research & Science', 'SSC', 'Scholarships', 'Shipping & Ports',
  'State PSCs', 'Teaching', 'Telecom', 'UPSC'
];

const CATEGORY_MAP = {
  'Agriculture': 'Agriculture', 'Banking': 'Banking',
  'Central Government': 'Central Government', 'Central Govt': 'Central Government',
  'CENTRAL': 'Central Government',
  'Cooperative': 'Cooperative', 'Defence': 'Defence',
  'Entrance Exam': 'Entrance Exam', 'Entrance Exams': 'Entrance Exam',
  'Forest & Environment': 'Forest & Environment', 'Forest': 'Forest & Environment',
  'Healthcare': 'Healthcare', 'Medical': 'Healthcare',
  'Insurance': 'Insurance', 'Judiciary & Law': 'Judiciary',
  'Judiciary': 'Judiciary', 'Law': 'Judiciary',
  'Police & Security': 'Police', 'Police': 'Police',
  'PSU': 'PSU', 'Railway': 'Railways', 'Railways': 'Railways',
  'Research & Science': 'Research & Science', 'Research': 'Research & Science',
  'Shipping & Ports': 'Shipping & Ports', 'Shipping': 'Shipping & Ports',
  'SSC': 'SSC', 'State Government': 'State Government',
  'STATE': 'State Government',
  'State Services': 'State PSCs', 'State PSCs': 'State PSCs',
  'Teaching & Education': 'Teaching', 'Teaching': 'Teaching',
  'Telecom': 'Telecom', 'UPSC': 'UPSC',
  'Others': 'Central Government', 'Engineering': 'Engineering', 'Medical': 'Healthcare', 'Law': 'Judiciary',
  'Scholarships': 'Central Government', 'Apprenticeships': 'Central Government'
};

function normalizeCategory(cat) {
  if (CATEGORY_MAP[cat]) return CATEGORY_MAP[cat];
  const lower = (cat || '').toLowerCase();
  if (lower.includes('bank')) return 'Banking';
  if (lower.includes('rail') || lower.includes('metro')) return 'Railways';
  if (lower.includes('police') || lower.includes('security') || lower.includes('constable')) return 'Police';
  if (lower.includes('defence') || lower.includes('army') || lower.includes('navy')) return 'Defence';
  if (lower.includes('teach') || lower.includes('education') || lower.includes('professor')) return 'Teaching';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('nursing') || lower.includes('doctor') || lower.includes('hospital')) return 'Healthcare';
  if (lower.includes('research') || lower.includes('science') || lower.includes('csir') || lower.includes('icar')) return 'Research & Science';
  if (lower.includes('court') || lower.includes('judici') || lower.includes('magistrate')) return 'Judiciary';
  if (lower.includes('law') || lower.includes('legal') || lower.includes('advocate')) return 'Judiciary';
  if (lower.includes('engineer') || lower.includes('tech')) return 'Engineering';
  if (lower.includes('telecom') || lower.includes('bsnl') || lower.includes('mtnl')) return 'Telecom';
  if (lower.includes('shipping') || lower.includes('port') || lower.includes('shipyard')) return 'Shipping & Ports';
  if (lower.includes('forest') || lower.includes('wildlife') || lower.includes('environment')) return 'Forest & Environment';
  if (lower.includes('agriculture') || lower.includes('dairy') || lower.includes('cooperative') || lower.includes('nabard')) return 'Agriculture';
  if (lower.includes('insur')) return 'Insurance';
  if (lower.includes('psu') || lower.includes('corporation')) return 'PSU';
  if (lower.includes('ssc')) return 'SSC';
  if (lower.includes('upsc')) return 'UPSC';
  if (lower.includes('state') || lower.includes('psc')) return 'State PSCs';
  if (lower.includes('entrance') || lower.includes('cet') || lower.includes('jee') || lower.includes('neet')) return 'Entrance Exam';
  return 'Central Government';
}

const getTodayStr = () => {
  const n = new Date();
  const ist = new Date(n.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
};

function computeFormStatus(startDate, endDate) {
  if (!startDate || !endDate) return 'CLOSED';
  const today = getTodayStr();
  if (today < startDate) return 'UPCOMING';
  if (today >= startDate && today <= endDate) return 'LIVE';
  
  const endMs = new Date(endDate).getTime();
  const todayMs = new Date(today).getTime();
  const daysSinceClosed = (todayMs - endMs) / (1000 * 60 * 60 * 24);
  if (daysSinceClosed <= 30) return 'RECENTLY_CLOSED';
  if (daysSinceClosed > 90) return 'ARCHIVED';
  return 'CLOSED';
}

const VERIFIED_UPSC_EXAMS = {
  'civil services': {
    id: 'c6dd639b3d748309',
    job_name: 'UPSC Civil Services (IAS/IPS/IFS) 2026',
    application_start_date: '2026-02-04',
    application_end_date: '2026-02-27',
  },
  'capf': {
    id: '4e9b4fa6fcdba5ca',
    job_name: 'UPSC CAPF Assistant Commandant 2026',
    application_start_date: '2026-02-20',
    application_end_date: '2026-03-12',
  },
  'cds i': {
    id: '561c37adabf30c77',
    job_name: 'UPSC CDS I 2026',
    application_start_date: '2025-12-10',
    application_end_date: '2025-12-30',
  },
  'cds ii': {
    id: 'e6a617de08806874',
    job_name: 'UPSC CDS II 2026',
    application_start_date: '2026-05-20',
    application_end_date: '2026-06-09',
  },
  'cisf ac': {
    id: '8cae9a2c4f3bd582',
    job_name: 'UPSC CISF AC (LDCE) 2026',
    application_start_date: '2025-12-03',
    application_end_date: '2025-12-23',
  },
  'medical services': {
    id: '4a422dd21dccf807',
    job_name: 'UPSC Combined Medical Services CMS 2026',
    application_start_date: '2026-03-11',
    application_end_date: '2026-04-01',
  },
  'drug inspector': {
    id: 'f953afb06f9b5880',
    job_name: 'UPSC Drug Inspector 2026',
    application_start_date: '2026-05-12',
    application_end_date: '2026-06-04',
  },
  'enforcement officer': {
    id: '99c141a19c6162f2',
    job_name: 'UPSC Enforcement Officer/Accounts Officer 2026',
    application_start_date: '2026-10-29',
    application_end_date: '2026-11-28',
  },
  'engineering services': {
    id: 'd7a743d2769b9897',
    job_name: 'UPSC Engineering Services (ESE) 2026',
    application_start_date: '2025-09-17',
    application_end_date: '2025-10-08',
  },
  'epfo eo/ao': {
    id: '3bb30e9fd1b8558f',
    job_name: 'UPSC EPFO EO/AO 2026',
    application_start_date: '2026-05-23',
    application_end_date: '2026-06-22',
  },
  'geologist': {
    id: 'f7a2862b01847a32',
    job_name: 'UPSC Geologist/Geoscientist 2026',
    application_start_date: '2025-09-04',
    application_end_date: '2025-09-24',
  },
  'ies/iss': {
    id: '4dd9f9c2cc0d1912',
    job_name: 'UPSC IES/ISS Economics Statistics 2026',
    application_start_date: '2026-04-15',
    application_end_date: '2026-05-05',
  },
  'forest service': {
    id: 'fa524fe74694258c',
    job_name: 'UPSC Indian Forest Service IFoS 2026',
    application_start_date: '2026-02-04',
    application_end_date: '2026-02-27',
  },
  'nda & na i': {
    id: '3106e9bf46d6dadc',
    job_name: 'UPSC NDA & NA I 2026',
    application_start_date: '2025-12-18',
    application_end_date: '2026-01-09',
  },
  'nda & na ii': {
    id: 'c93433cec69658a1',
    job_name: 'UPSC NDA & NA II 2026',
    application_start_date: '2026-05-20',
    application_end_date: '2026-06-09',
  },
  'nda iii': {
    id: '163368cdd871895d',
    job_name: 'UPSC NDA III 2026',
    application_start_date: '2026-06-06',
    application_end_date: '2026-07-06',
  },
  'so/steno': {
    id: '8882fc576e3ac7fd',
    job_name: 'UPSC SO/Steno Grade D CSSS 2026',
    application_start_date: '2025-09-17',
    application_end_date: '2025-10-08',
  },
  'scientific officer': {
    id: 'adb3209175e4394f',
    job_name: 'UPSC Assistant Director Scientific Officer 2026',
    application_start_date: '2026-05-30',
    application_end_date: '2026-06-26',
  },
  'cost accounts': {
    id: '9355acd4df005ced',
    job_name: 'UPSC Assistant Director Cost Accounts 2026',
    application_start_date: '2026-05-17',
    application_end_date: '2026-06-11',
  }
};

function J(name, org, qual, fy, minA, maxA, s, e, sMin, sMax, cat, link, hi = '', syl = '', sel = '', ta = '', bn = '', state = 'All India', states = []) {
  let hash = crypto.createHash('sha256').update(`${name}-${org}`).digest('hex').slice(0, 16);
  let finalName = name;
  let finalCat = normalizeCategory(cat);
  let finalStart = s;
  let finalEnd = e;

  if (org === 'UPSC' || name.toLowerCase().includes('upsc') || finalCat === 'UPSC') {
    finalCat = 'UPSC';
    const nameLower = name.toLowerCase();
    for (const [key, details] of Object.entries(VERIFIED_UPSC_EXAMS)) {
      if (nameLower.includes(key)) {
        hash = details.id;
        finalName = details.job_name;
        finalStart = details.application_start_date;
        finalEnd = details.application_end_date;
        break;
      }
    }
  }

  const status = computeFormStatus(finalStart, finalEnd);

  jobs.push({
    id: hash,
    job_name: finalName, organization: org,
    qualification_required: qual,
    allows_final_year_students: fy ? 1 : 0,
    minimum_age: minA, maximum_age: maxA,
    application_start_date: finalStart, application_end_date: finalEnd,
    salary_min: sMin, salary_max: sMax,
    job_category: finalCat,
    official_application_link: link || 'https://india.gov.in',
    official_notification_link: link || 'https://india.gov.in',
    official_website_link: link || 'https://india.gov.in',
    exam_name_hi: hi,
    exam_name_ta: ta,
    exam_name_bn: bn,
    syllabus: syl,
    selection_process: sel || '',
    state: state,
    states: states,
    form_status: status
  });
}

const now = new Date();
const d = (offsetDays) => {
  const date = new Date(now);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split('T')[0];
};

const TL = [
  [d(-120), d(-60)],
  [d(-90), d(-30)],
  [d(-60), d(-10)],
  [d(-45), d(-5)],
  [d(-30), d(-2)],
  [d(-20), d(3)],
  [d(-15), d(10)],
  [d(-5), d(20)],
  [d(-2), d(25)],
  [d(5), d(35)],
  [d(15), d(45)],
  [d(30), d(60)],
  [d(45), d(75)],
  [d(60), d(90)],
  [d(90), d(120)],
  [d(120), d(150)],
];
const tl = i => TL[((i % TL.length) + TL.length) % TL.length];

// 1. UPSC Exams
const upsc = [
  ['UPSC Civil Services (IAS/IPS/IFS) 2026', 'UPSC', 'Graduation', 21, 32, 56100, 177500, 'UPSC', 'यूपीएससी सिविल सेवा परीक्षा (IAS/IPS/IFS) 2026', 'GS Paper I & CSAT. Mains: General Studies 1-4, Essay, Optionals.'],
  ['UPSC CAPF Assistant Commandant 2026', 'UPSC', 'Graduation', 20, 25, 56100, 177500, 'UPSC', 'यूपीएससी सीएपीएफ सहायक कमांडेंट 2026', 'Paper I: General Ability. Paper II: General Studies & Essay.'],
  ['UPSC CDS I 2026', 'UPSC', 'Graduation', 19, 25, 56100, 177500, 'UPSC', 'यूपीएससी सीडीएस I 2026', 'English, GK, Elementary Mathematics.'],
  ['UPSC CDS II 2026', 'UPSC', 'Graduation', 19, 25, 56100, 177500, 'UPSC', 'यूपीएससी सीडीएस II 2026', 'English, GK, Elementary Mathematics.'],
  ['UPSC CISF AC (LDCE) 2026', 'UPSC', 'Graduation', 21, 35, 56100, 177500, 'UPSC', 'यूपीएससी सीआईएसएफ एसी (एलडीसीई) 2026', 'Professional Skills, Essay & Comprehension.'],
  ['UPSC Combined Medical Services CMS 2026', 'UPSC', 'MBBS', 21, 32, 56100, 177500, 'UPSC', 'यूपीएससी कंबाइंड मेडिकल सर्विसेज 2026', 'Medicine, Surgery, Gynaecology.'],
  ['UPSC Drug Inspector 2026', 'UPSC', 'Graduation', 21, 30, 44900, 142400, 'UPSC', 'यूपीएससी ड्रग इंस्पेक्टर 2026', 'Pharmacy & General Knowledge.'],
  ['UPSC Enforcement Officer/Accounts Officer 2026', 'UPSC', 'Graduation', 21, 30, 47600, 151100, 'UPSC', 'यूपीएससी प्रवर्तन अधिकारी/लेखा अधिकारी 2026', 'English, Polity, Accountancy, Industrial Relations.'],
  ['UPSC Engineering Services (ESE) 2026', 'UPSC', 'Engineering Graduation', 21, 30, 56100, 177500, 'UPSC', 'यूपीएससी इंजीनियरिंग सेवा (ESE) 2026', 'Stage 1: GS and Engineering Aptitude. Stage 2: Core Engineering Discipline.'],
  ['UPSC EPFO EO/AO 2026', 'UPSC', 'Graduation', 21, 30, 47600, 151100, 'UPSC', 'यूपीएससी ईपीएफओ ईओ/एओ 2026', 'Polity, Economy, Social Security, Accounting.'],
  ['UPSC Geologist/Geoscientist 2026', 'UPSC', 'Post Graduation', 21, 32, 56100, 177500, 'UPSC', 'यूपीएससी भूवैज्ञानिक परीक्षा 2026', 'Geology, Geophysics, Chemistry.'],
  ['UPSC IES/ISS Economics Statistics 2026', 'UPSC', 'Post Graduation', 21, 30, 56100, 177500, 'UPSC', 'यूपीएससी आईईएस/आईएसएस परीक्षा 2026', 'Economics or Statistics core papers.'],
  ['UPSC Indian Forest Service IFoS 2026', 'UPSC', 'Graduation', 21, 32, 56100, 177500, 'UPSC', 'यूपीएससी भारतीय वन सेवा (IFoS) 2026', 'Civil Services Prelims + IFoS Written Mains.'],
  ['UPSC NDA & NA I 2026', 'UPSC', 'Class 12', 16, 19, 56100, 94100, 'UPSC', 'यूपीएससी एनडीए और एनए I 2026', 'Mathematics and General Ability Test.'],
  ['UPSC NDA & NA II 2026', 'UPSC', 'Class 12', 16, 19, 56100, 94100, 'UPSC', 'यूपीएससी एनडीए और एनए II 2026', 'Mathematics and General Ability Test.'],
  ['UPSC NDA III 2026', 'UPSC', 'Class 12', 16, 19, 56100, 94100, 'UPSC', 'यूपीएससी एनडीए III 2026', 'Mathematics and General Ability Test.'],
  ['UPSC SO/Steno Grade D CSSS 2026', 'UPSC', 'Graduation', 21, 50, 47600, 151100, 'UPSC', 'यूपीएससी एसओ/स्टेनो परीक्षा 2026', 'Office procedures, General English & Shorthand test.'],
  ['UPSC Assistant Director Scientific Officer 2026', 'UPSC', 'Post Graduation', 21, 35, 47600, 151100, 'UPSC', 'यूपीएससी सहायक निदेशक वैज्ञानिक अधिकारी 2026', 'Scientific domain syllabus.'],
  ['UPSC Assistant Director Cost Accounts 2026', 'UPSC', 'Graduation', 21, 30, 47600, 151100, 'UPSC', 'यूपीएससी सहायक निदेशक लागत लेखा 2026', 'Cost Accountancy & Auditing.']
];
upsc.forEach(([n, org, q, mn, mx, s1, s2, c, hi, syl]) => {
  const nameLower = n.toLowerCase();
  let lookup = null;
  for (const [key, details] of Object.entries(VERIFIED_UPSC_EXAMS)) {
    if (nameLower.includes(key)) {
      lookup = details;
      break;
    }
  }
  const start = lookup ? lookup.application_start_date : '2026-05-01';
  const end = lookup ? lookup.application_end_date : '2026-05-30';
  J(n, org, q, true, mn, mx, start, end, s1, s2, c, 'https://upsconline.nic.in', hi, syl, SP_UPSC);
});

// 2. SSC Exams
const ssc = [
  ['SSC CGL Grade B & C 2026', 'Staff Selection Commission', 'Graduation', 18, 32, 25500, 151100, 'SSC', 'एसएससी सीजीएल (CGL) 2026', 'Tier I & Tier II computer based tests.'],
  ['SSC CHSL 10+2 Level 2026', 'Staff Selection Commission', 'Class 12', 18, 27, 19900, 81100, 'SSC', 'एसएससी सीएचएसएल (CHSL) 2026'],
  ['SSC MTS & Havaldar 2026', 'Staff Selection Commission', 'Class 10', 18, 25, 18000, 56900, 'SSC'],
  ['SSC GD Constable 2026', 'Staff Selection Commission', 'Class 10', 18, 23, 21700, 69100, 'SSC'],
  ['SSC CPO SI/ASI 2026', 'Staff Selection Commission', 'Graduation', 20, 25, 35400, 112400, 'Police'],
  ['SSC JE Civil Mechanical Electrical 2026', 'Staff Selection Commission', 'Graduation', 18, 32, 35400, 112400, 'SSC'],
  ['SSC Stenographer Grade C & D 2026', 'Staff Selection Commission', 'Class 12', 18, 30, 25500, 81100, 'SSC'],
  ['SSC Selection Post Phase XIV 2026', 'Staff Selection Commission', 'Class 10', 18, 30, 18000, 92300, 'SSC'],
  ['SSC Scientific Assistant IMD 2026', 'Staff Selection Commission', 'Graduation', 18, 30, 35400, 112400, 'Research', 'IMD Scientific domain syllabus.']
];
ssc.forEach(([n, org, q, mn, mx, s1, s2, c, hi, syl], i) => { 
  const [s, e] = tl(i * 4 + 1); 
  J(n, org, q, i > 0, mn, mx, s, e, s1, s2, c, 'https://ssc.gov.in', hi, syl, n.includes('CGL') ? SP_SSC_CGL : SP_SSC_OTHER); 
});

// 3. Banking & Insurance Exams
const banking = [
  ['SBI Probationary Officer PO 2026', 'State Bank of India', 'Graduation', 21, 30, 41960, 67390, 'Banking', 'https://www.sbi.co.in/careers'],
  ['SBI Clerk Junior Associate 2026', 'State Bank of India', 'Graduation', 20, 28, 22405, 45210, 'Banking', 'https://www.sbi.co.in/careers'],
  ['SBI Specialist Officer SO 2026', 'State Bank of India', 'Graduation', 21, 35, 42020, 89890, 'Banking', 'https://www.sbi.co.in/careers'],
  ['IBPS PO Probationary Officer 2026', 'IBPS', 'Graduation', 20, 30, 36000, 63840, 'Banking', 'https://ibps.in'],
  ['IBPS Clerk 2026', 'IBPS', 'Graduation', 20, 28, 19900, 47920, 'Banking', 'https://ibps.in'],
  ['IBPS SO 2026', 'IBPS', 'Graduation', 20, 30, 36000, 63840, 'Banking', 'https://ibps.in'],
  ['IBPS RRB PO 2026', 'IBPS', 'Graduation', 18, 30, 36000, 63840, 'Banking', 'https://ibps.in'],
  ['IBPS RRB Officer Scale II III 2026', 'IBPS', 'Post Graduation', 21, 32, 48170, 69810, 'Banking', 'https://ibps.in'],
  ['IBPS RRB Office Assistant 2026', 'IBPS', 'Graduation', 18, 28, 15000, 35000, 'Banking', 'https://ibps.in'],
  ['RBI Grade B Officer 2026', 'Reserve Bank of India', 'Post Graduation', 21, 30, 55200, 118000, 'Banking', 'https://www.rbi.org.in'],
  ['RBI Assistant 2026', 'Reserve Bank of India', 'Graduation', 20, 28, 20700, 55700, 'Banking', 'https://www.rbi.org.in'],
  ['NABARD Grade A 2026', 'NABARD', 'Post Graduation', 21, 30, 44500, 89150, 'Agriculture', 'https://nabard.org'],
  ['NABARD Grade B 2026', 'NABARD', 'Post Graduation', 25, 35, 51490, 115240, 'Agriculture', 'https://nabard.org'],
  ['LIC AAO 2026', 'LIC', 'Graduation', 21, 30, 38500, 67370, 'Insurance', 'https://licindia.in'],
  ['LIC ADO 2026', 'LIC', 'Graduation', 21, 30, 19350, 42000, 'Insurance', 'https://licindia.in'],
  ['NIACL AO 2026', 'New India Assurance', 'Graduation', 21, 30, 40000, 85000, 'Insurance', 'https://newindia.co.in'],
  ['NIACL Assistant 2026', 'New India Assurance', 'Graduation', 18, 30, 20000, 49000, 'Insurance', 'https://newindia.co.in'],
  ['GIC Scale I Officer 2026', 'General Insurance Corporation', 'Graduation', 21, 30, 40000, 85000, 'Insurance', 'https://gicofindia.com'],
  ['UIIC Assistant 2026', 'United India Insurance', 'Graduation', 18, 30, 20000, 46000, 'Insurance', 'https://uiic.co.in'],
  ['ECGC PO 2026', 'Export Credit Guarantee Corporation', 'Post Graduation', 21, 30, 40000, 85000, 'Banking', 'https://ecgc.in'],
  ['NHB Resident Officer 2026', 'National Housing Bank', 'Post Graduation', 21, 30, 44500, 89150, 'Banking', 'https://nhb.org.in'],
  ['SEBI Grade A 2026', 'SEBI', 'Post Graduation', 21, 30, 56700, 140000, 'Banking', 'https://sebi.gov.in'],
  ['SIDBI Grade A 2026', 'SIDBI', 'Post Graduation', 21, 30, 40000, 85000, 'Banking', 'https://sidbi.in'],
  ['LIC HFL 2026', 'LIC HFL', 'Graduation', 21, 28, 25000, 50000, 'Insurance', 'https://licindia.in']
];
banking.forEach(([n, org, q, mn, mx, s1, s2, c, l], i) => { 
  const [s, e] = tl(i * 2 + 2); 
  J(n, org, q, true, mn, mx, s, e, s1, s2, c, l, '', '', n.includes('PO') || n.includes('Officer') ? SP_BANK_PO : SP_BANK_CLERK); 
});

// 4. Defence Exams
const defence = [
  ['AFCAT Flying Technical Ground Duty 2026', 'Indian Air Force', 'Graduation', 20, 24, 56100, 177500, 'Defence', 'https://afcat.cdac.in'],
  ['Army Agniveer GD General Duty 2026', 'Indian Army', 'Class 10', 17, 21, 30000, 40000, 'Defence', 'https://joinindianarmy.nic.in'],
  ['Army Agniveer Technical 2026', 'Indian Army', 'Class 12', 17, 21, 30000, 40000, 'Defence', 'https://joinindianarmy.nic.in'],
  ['Navy Agniveer Sailor 2026', 'Indian Navy', 'Class 12', 17, 21, 30000, 40000, 'Defence', 'https://joinindiannavy.gov.in'],
  ['Air Force Agniveer Vayu 2026', 'Indian Air Force', 'Class 12', 17, 21, 30000, 40000, 'Defence', 'https://agnipathvayu.cdac.in'],
  ['Coast Guard Navik GD 2026', 'Indian Coast Guard', 'Class 12', 18, 22, 21700, 69100, 'Defence', 'https://joincoastguard.gov.in'],
  ['Coast Guard Navik Domestic Branch 2026', 'Indian Coast Guard', 'Class 10', 18, 22, 21700, 69100, 'Defence', 'https://joincoastguard.gov.in'],
  ['Coast Guard Yantrik 2026', 'Indian Coast Guard', 'Class 12', 18, 22, 29200, 92300, 'Defence', 'https://joincoastguard.gov.in'],
  ['Coast Guard Assistant Commandant 2026', 'Indian Coast Guard', 'Graduation', 21, 25, 56100, 177500, 'Defence', 'https://joincoastguard.gov.in'],
  ['AFCAT I 2026', 'Ministry of Defence', 'Graduation', 20, 24, 56100, 177500, 'Defence', 'https://afcat.cdac.in'],
  ['AFCAT II 2026', 'Ministry of Defence', 'Graduation', 20, 24, 56100, 177500, 'Defence', 'https://afcat.cdac.in']
];
defence.forEach(([n, org, q, mn, mx, s1, s2, c, l], i) => { 
  const [s, e] = tl(i * 3 + 5); 
  J(n, org, q, i > 3, mn, mx, s, e, s1, s2, c, l, '', '', n.includes('Agniveer') ? SP_DEFENCE_AGNIVEER : SP_DEFENCE_OFFICER); 
});

// 5. Core Railway Exams (National Level)
const railways = [
  ['RRB NTPC Graduate 2026', 'Indian Railways', 'Graduation', 18, 33, 19900, 35400, 'Railways', 'https://indianrailways.gov.in'],
  ['RRB NTPC 12th Level 2026', 'Indian Railways', 'Class 12', 18, 33, 19900, 29200, 'Railways', 'https://indianrailways.gov.in'],
  ['RRB Group D 10th Level 2026', 'Indian Railways', 'Class 10', 18, 33, 18000, 25380, 'Railways', 'https://indianrailways.gov.in'],
  ['RRB Junior Engineer JE 2026', 'Indian Railways', 'Graduation', 18, 33, 35400, 112400, 'Railways', 'https://indianrailways.gov.in'],
  ['RRB Assistant Loco Pilot ALP 2026', 'Indian Railways', 'Class 10', 18, 30, 19900, 35400, 'Railways', 'https://indianrailways.gov.in']
];
railways.forEach(([n, org, q, mn, mx, s1, s2, c, l], i) => {
  const [s, e] = tl(i * 2);
  J(n, org, q, true, mn, mx, s, e, s1, s2, c, l, '', '', SP_RAILWAY);
});

// 6. NTA & Entrance Exams
const entrances = [
  ['JEE Main 2026', 'NTA', 'Class 12', 17, 25, 0, 0, 'Entrance Exam', 'https://jeemain.nta.nic.in'],
  ['JEE Advanced 2026', 'National Testing Agency', 'Class 12', 17, 25, 0, 0, 'Entrance Exam', 'https://jeeadv.ac.in'],
  ['NEET UG 2026', 'NTA', 'Class 12', 17, 25, 0, 0, 'Entrance Exam', 'https://neet.nta.nic.in'],
  ['NEET PG 2026', 'NBE', 'Post Graduation', 21, 40, 0, 0, 'Entrance Exam', 'https://nbe.edu.in'],
  ['GATE 2026', 'National Testing Agency', 'Graduation', 18, 35, 0, 0, 'Entrance Exam', 'https://gate.iitk.ac.in'],
  ['CAT 2026', 'National Testing Agency', 'Graduation', 20, 40, 0, 0, 'Entrance Exam', 'https://iimcat.ac.in'],
  ['CMAT 2026', 'National Testing Agency', 'Graduation', 20, 40, 0, 0, 'Entrance Exam', 'https://cmat.nta.nic.in'],
  ['UGC NET 2026', 'National Testing Agency', 'Post Graduation', 21, 40, 0, 0, 'Entrance Exam', 'https://ugcnet.nta.nic.in'],
  ['CSIR NET 2026', 'National Testing Agency', 'Post Graduation', 21, 28, 0, 0, 'Entrance Exam', 'https://csirnet.nta.nic.in'],
  ['CTET 2026', 'National Testing Agency', 'Graduation', 18, 45, 0, 0, 'Entrance Exam', 'https://ctet.nic.in'],
  ['CLAT 2026', 'Consortium of NLUs', 'Class 12', 17, 25, 0, 0, 'Entrance Exam', 'https://consortiumofnlus.ac.in'],
  ['NEST National Entrance Screening 2026', 'NISER/CEBS', 'Class 12', 17, 22, 0, 0, 'Entrance Exam', 'https://nestexam.in'],
  ['CTET Primary Level I 2026', 'CBSE', 'Graduation', 18, 45, 0, 0, 'Entrance Exam', 'https://ctet.nic.in'],
  ['CTET Upper Primary Level II 2026', 'CBSE', 'Graduation', 18, 45, 0, 0, 'Entrance Exam', 'https://ctet.nic.in']
];
entrances.forEach(([n, org, q, mn, mx, s1, s2, c, l], i) => { 
  const [s, e] = tl(i * 2 + 1); 
  J(n, org, q, true, mn, mx, s, e, s1, s2, c, l, '', '', SP_ENTRANCE); 
});

// 7. Core National & Apex Bodies
const apex = [
  ['IB ACIO Grade II 2026', 'Intelligence Bureau', 'Graduation', 18, 27, 44900, 142400, 'Central Government', 'https://mha.gov.in'],
  ['SEBI IT Officer Grade A 2026', 'SEBI', 'Post Graduation', 21, 30, 56700, 140000, 'Banking', 'https://sebi.gov.in']
];
apex.forEach(([n, org, q, mn, mx, s1, s2, c, l], i) => { 
  const [s, e] = tl(i * 3 + 2); 
  J(n, org, q, false, mn, mx, s, e, s1, s2, c, l, '', '', n.includes('Court') ? SP_JUDICIARY : SP_CENTRAL); 
});

// 8. Genuine State PSC Civil Services (mapped to correct specific portals)
const STATE_PSC_MAPPING = {
  'Andhra Pradesh': { org: 'APPSC', url: 'https://psc.ap.gov.in' },
  'Arunachal Pradesh': { org: 'APPSC', url: 'https://appsc.gov.in' },
  'Assam': { org: 'APSC', url: 'https://apsc.nic.in' },
  'Bihar': { org: 'BPSC', url: 'https://bpsc.bih.nic.in' },
  'Chhattisgarh': { org: 'CGPSC', url: 'https://psc.cg.gov.in' },
  'Goa': { org: 'Goa PSC', url: 'https://gpsc.goa.gov.in' },
  'Gujarat': { org: 'GPSC', url: 'https://gpsc.gujarat.gov.in' },
  'Haryana': { org: 'HPSC', url: 'https://hpsc.gov.in' },
  'Himachal Pradesh': { org: 'HPPSC', url: 'https://hppsc.hp.gov.in' },
  'Jharkhand': { org: 'JPSC', url: 'https://jpsc.gov.in' },
  'Karnataka': { org: 'KPSC', url: 'https://kpsc.kar.nic.in' },
  'Kerala': { org: 'Kerala PSC', url: 'https://keralapsc.gov.in' },
  'Madhya Pradesh': { org: 'MPPSC', url: 'https://mppsc.mp.gov.in' },
  'Maharashtra': { org: 'MPSC', url: 'https://mpsc.gov.in' },
  'Manipur': { org: 'Manipur PSC', url: 'https://mpscmanipur.gov.in' },
  'Meghalaya': { org: 'Meghalaya PSC', url: 'https://mpsc.meghalaya.gov.in' },
  'Mizoram': { org: 'Mizoram PSC', url: 'https://mpsc.mizoram.gov.in' },
  'Nagaland': { org: 'NPSC', url: 'https://npsc.nagaland.gov.in' },
  'Odisha': { org: 'OPSC', url: 'https://opsc.gov.in' },
  'Punjab': { org: 'PPSC', url: 'https://ppsc.gov.in' },
  'Rajasthan': { org: 'RPSC', url: 'https://rpsc.rajasthan.gov.in' },
  'Sikkim': { org: 'SPSC', url: 'https://spsc.sikkim.gov.in' },
  'Tamil Nadu': { org: 'TNPSC', url: 'https://tnpsc.gov.in' },
  'Telangana': { org: 'TSPSC', url: 'https://tspsc.gov.in' },
  'Tripura': { org: 'TPSC', url: 'https://tpsc.tripura.gov.in' },
  'Uttar Pradesh': { org: 'UPPSC', url: 'https://uppsc.up.nic.in' },
  'Uttarakhand': { org: 'UKPSC', url: 'https://ukpsc.gov.in' },
  'West Bengal': { org: 'WBPSC', url: 'https://wbpsc.gov.in' },
  'Jammu & Kashmir': { org: 'JKPSC', url: 'https://jkpsc.nic.in' },
  'Delhi': { org: 'DSSSB', url: 'https://dsssb.delhi.gov.in' }
};

Object.entries(STATE_PSC_MAPPING).forEach(([state, config], i) => {
  const [s, e] = tl(i);
  J(
    `${config.org} Civil Services Examination 2026`,
    config.org,
    'Graduation',
    true,
    21,
    40,
    s,
    e,
    56100,
    177500,
    'State PSCs',
    config.url,
    '',
    '',
    SP_STATE_CIVIL,
    '',
    '',
    state
  );
});

// 9. Real Central & Apex Bodies
const missingCentral = [
  ['NIA Inspector/Sub-Inspector 2026', 'National Investigation Agency', 'Graduation', 21, 30, 44900, 142400, 'Police'],
  ['NCB Intelligence Officer 2026', 'Narcotics Control Bureau', 'Graduation', 20, 27, 44900, 142400, 'Police'],
  ['PM Lateral Entry Joint Secretary 2026', 'DoPT', 'Post Graduation', 35, 50, 144200, 218200, 'Central Government'],
  ['IRDAI Assistant Manager 2026', 'IRDAI', 'Graduation', 21, 30, 44500, 89150, 'Insurance'],
  ['PFRDA Officer Grade A 2026', 'PFRDA', 'Post Graduation', 21, 30, 44500, 89150, 'Banking'],
  ['Central Information Commission Officer 2026', 'CIC', 'Graduation', 21, 35, 44900, 142400, 'Central Government']
];

missingCentral.forEach(([name, org, qual, minA, maxA, minS, maxS, cat], i) => {
  let [s, e] = tl(i);
  J(name, org, qual, false, minA, maxA, s, e, minS, maxS, cat, 'https://india.gov.in', '', '', SP_CENTRAL, '', '', 'All India');
});

// ── ASYNC SEED ─────────────────────────────────────────────────────────────
async function seedDatabase() {
  const db = getDb();

  const SEED_VERSION = 24; // Bumping seed version to clear any stale structures
  try { await db.execute('CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT)'); } catch (_) { }
  let currentVersion = 0;
  try {
    const row = (await db.execute("SELECT value FROM seed_meta WHERE key='seed_version'")).rows[0];
    if (row) currentVersion = Number(row.value);
  } catch (_) { }

  if (currentVersion >= SEED_VERSION) {
    const count = Number((await db.execute('SELECT COUNT(*) as cnt FROM jobs')).rows[0].cnt);
    console.log(`  DB seed v${currentVersion}, ${count} jobs — up to date, skipping.`);
    return;
  }

  console.log(`  Seed version ${currentVersion} → ${SEED_VERSION}. Upserting jobs in bulk...`);

  // DEDUPLICATE JOBS BY ID BEFORE SEEDING
  const uniqueJobsMap = new Map();
  for (const job of jobs) {
    uniqueJobsMap.set(job.id, job);
  }
  const uniqueJobsList = Array.from(uniqueJobsMap.values());
  console.log(`  Deduplicated: ${jobs.length} jobs reduced to ${uniqueJobsList.length} unique jobs...`);

  // Direct Supabase Client Bulk Upsert
  const sb = getSupabase();
  if (sb) {
    console.log('  Using high-speed Supabase client bulk upsert...');
    const BATCH_SIZE = 100;
    for (let i = 0; i < uniqueJobsList.length; i += BATCH_SIZE) {
      const chunk = uniqueJobsList.slice(i, i + BATCH_SIZE).map(j => ({
        id: j.id,
        job_name: j.job_name,
        organization: j.organization,
        qualification_required: j.qualification_required,
        allows_final_year_students: j.allows_final_year_students,
        minimum_age: j.minimum_age,
        maximum_age: j.maximum_age,
        application_start_date: j.application_start_date,
        application_end_date: j.application_end_date,
        salary_min: j.salary_min,
        salary_max: j.salary_max,
        job_category: j.job_category,
        official_application_link: j.official_application_link,
        official_notification_link: j.official_notification_link,
        official_website_link: j.official_website_link,
        syllabus: j.syllabus || '',
        selection_process: j.selection_process || '',
        exam_name_hi: j.exam_name_hi || '',
        exam_name_ta: j.exam_name_ta || '',
        exam_name_bn: j.exam_name_bn || '',
        state: j.state || 'All India',
        states: j.states || [],
        form_status: j.form_status
      }));

      let retries = 3;
      while (retries > 0) {
        try {
          const { error } = await sb.from('jobs').upsert(chunk, { onConflict: 'id' });
          if (error) throw error;
          console.log(`  Progress: ${Math.min(i + BATCH_SIZE, uniqueJobsList.length)}/${uniqueJobsList.length} jobs bulk seeded...`);
          break;
        } catch (err) {
          retries--;
          console.error(`  Bulk batch ${i}-${i + BATCH_SIZE} failed (retries left: ${retries}):`, err.message);
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }
  }

  // Save seed version
  try {
    await db.execute({ sql: "INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('seed_version', ?)", args: [String(SEED_VERSION)] });
  } catch (_) { }

  console.log(`✓ Seeded ${uniqueJobsList.length} jobs successfully in bulk!`);
}

// Minimal placeholder implementation for backward compatibility
const INSERT_SQL = `INSERT OR REPLACE INTO jobs (
  id, job_name, organization, qualification_required, allows_final_year_students,
  minimum_age, maximum_age, application_start_date, application_end_date,
  salary_min, salary_max, job_category,
  official_application_link, official_notification_link, official_website_link,
  syllabus, selection_process, exam_name_hi, exam_name_ta, exam_name_bn, state, states, form_status
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

function mapJobToArgs(j) {
  return [
    j.id, j.job_name, j.organization, j.qualification_required,
    j.allows_final_year_students, j.minimum_age, j.maximum_age,
    j.application_start_date, j.application_end_date,
    j.salary_min, j.salary_max, j.job_category,
    j.official_application_link, j.official_notification_link, j.official_website_link,
    j.syllabus || '', j.selection_process || '',
    j.exam_name_hi || '', j.exam_name_ta || '', j.exam_name_bn || '',
    j.state || 'All India', JSON.stringify(j.states || []),
    j.form_status
  ];
}

async function seedInit() {
  const db = getDb();
  try { await db.execute('CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT)'); } catch (_) { }
  const before = Number((await db.execute('SELECT COUNT(*) as cnt FROM jobs')).rows[0].cnt);
  const CHUNK = 2000;
  let deleted = 0;
  while (true) {
    const r = await db.execute(`DELETE FROM jobs WHERE id IN (SELECT id FROM jobs LIMIT ${CHUNK})`);
    deleted += r.rowsAffected;
    const remaining = Number((await db.execute('SELECT COUNT(*) as cnt FROM jobs')).rows[0].cnt);
    console.log(`  [seed-init] Deleted chunk: ${r.rowsAffected}, remaining: ${remaining}`);
    if (remaining === 0 || r.rowsAffected === 0) break;
  }
  return { totalJobs: jobs.length, deleted, before, message: 'Jobs purged. Call seed-batch with offset=0 next.' };
}

async function seedBatch(offset, limit) {
  const db = getDb();
  const chunk = jobs.slice(offset, offset + limit);
  if (chunk.length === 0) return { inserted: 0, offset, total: jobs.length, done: true };

  const stmts = chunk.map(j => ({ sql: INSERT_SQL, args: mapJobToArgs(j) }));
  for (let i = 0; i < stmts.length; i += 100) {
    await db.batch(stmts.slice(i, i + 100), 'write');
  }
  const done = offset + limit >= jobs.length;
  console.log(`  [seed-batch] Inserted ${chunk.length} jobs (offset=${offset}, total=${jobs.length}, done=${done})`);
  return { inserted: chunk.length, offset, nextOffset: offset + limit, total: jobs.length, done };
}

async function seedFinalize() {
  const db = getDb();
  const SEED_VERSION = 24;
  await db.execute({ sql: "INSERT OR REPLACE INTO seed_meta (key, value) VALUES ('seed_version', ?)", args: [String(SEED_VERSION)] });
  const count = Number((await db.execute('SELECT COUNT(*) as cnt FROM jobs')).rows[0].cnt);
  console.log(`  [seed-finalize] Version set to ${SEED_VERSION}. Total jobs in DB: ${count}`);
  return { version: SEED_VERSION, totalJobs: count };
}

module.exports = { seedDatabase, seedInit, seedBatch, seedFinalize, getJobCount: () => jobs.length, jobs };
