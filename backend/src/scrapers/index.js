'use strict';
/**
 * Scraper index — registers all scraper modules
 */
const { BaseScraper } = require('./base-scraper');

// Railway scraper
const railwayScraper = {
  name: 'Railways',
  async scrape() {
    const s = new BaseScraper('Railways');
    const exams = [];
    const core = [
      'RRB NTPC', 'RRB Group D', 'RRB ALP & Technician', 'RRB JE', 'RRB Paramedical',
      'RRB Ministerial & Isolated', 'RPF Constable', 'RPF SI', 'RRC Group D (Level 1)',
      'RITES Engineer', 'IRCON Engineer', 'RVNL Manager', 'KRCL Technician',
    ];
    for (const name of core) {
      exams.push(s.buildExam({
        job_name: `${name} ${new Date().getFullYear()}`, organization: 'Indian Railways',
        job_category: 'Railways', official_website_link: 'https://indianrailways.gov.in',
        qualification_required: /Group D|Constable/.test(name) ? '10th Pass' : /NTPC|SI/.test(name) ? 'Graduation' : 'Diploma/B.Tech',
        selection_process: 'CBT Stage 1 → CBT Stage 2 → Skill Test → DV & Medical',
        state: 'All India', minimum_age: 18, maximum_age: 36,
      }));
    }
    return { exams, errors: [] };
  }
};

// Banking & Insurance scraper
const bankingScraper = {
  name: 'Banking',
  async scrape() {
    const s = new BaseScraper('Banking');
    const exams = [];
    const core = [
      { n: 'IBPS PO', o: 'IBPS', l: 'https://ibps.in', q: 'Graduation' },
      { n: 'IBPS Clerk', o: 'IBPS', l: 'https://ibps.in', q: 'Graduation' },
      { n: 'IBPS SO', o: 'IBPS', l: 'https://ibps.in', q: 'Post Graduation (Varies)' },
      { n: 'IBPS RRB PO', o: 'IBPS', l: 'https://ibps.in', q: 'Graduation' },
      { n: 'IBPS RRB Clerk', o: 'IBPS', l: 'https://ibps.in', q: 'Graduation' },
      { n: 'SBI PO', o: 'State Bank of India', l: 'https://sbi.co.in/web/careers', q: 'Graduation' },
      { n: 'SBI Clerk', o: 'State Bank of India', l: 'https://sbi.co.in/web/careers', q: 'Graduation' },
      { n: 'SBI SO', o: 'State Bank of India', l: 'https://sbi.co.in/web/careers', q: 'Post Graduation' },
      { n: 'RBI Grade B', o: 'Reserve Bank of India', l: 'https://rbi.org.in', q: 'Post Graduation' },
      { n: 'RBI Assistant', o: 'Reserve Bank of India', l: 'https://rbi.org.in', q: 'Graduation' },
      { n: 'NABARD Grade A', o: 'NABARD', l: 'https://nabard.org', q: 'Post Graduation' },
      { n: 'NABARD Grade B', o: 'NABARD', l: 'https://nabard.org', q: 'Post Graduation' },
      { n: 'SEBI Grade A', o: 'SEBI', l: 'https://sebi.gov.in', q: 'Post Graduation' },
      { n: 'LIC AAO', o: 'LIC', l: 'https://licindia.in', q: 'Graduation' },
      { n: 'LIC ADO', o: 'LIC', l: 'https://licindia.in', q: 'Graduation' },
      { n: 'LIC HFL', o: 'LIC HFL', l: 'https://lichousing.com', q: 'Graduation' },
      { n: 'NIACL AO', o: 'New India Assurance', l: 'https://newindia.co.in', q: 'Graduation' },
      { n: 'UIIC AO', o: 'United India Insurance', l: 'https://uiic.co.in', q: 'Graduation' },
      { n: 'GIC Scale I', o: 'GIC Re', l: 'https://gicofindia.com', q: 'Graduation' },
      { n: 'SIDBI Grade A', o: 'SIDBI', l: 'https://sidbi.in', q: 'Post Graduation' },
      { n: 'EXIM Bank MT', o: 'EXIM Bank', l: 'https://eximbankindia.in', q: 'Post Graduation' },
      { n: 'NHB Manager', o: 'NHB', l: 'https://nhb.org.in', q: 'Post Graduation' },
    ];
    for (const c of core) {
      exams.push(s.buildExam({
        job_name: `${c.n} ${new Date().getFullYear()}`, organization: c.o,
        job_category: 'Banking', official_website_link: c.l,
        qualification_required: c.q, state: 'All India',
        selection_process: 'Prelims → Mains → Interview',
        minimum_age: 20, maximum_age: 30,
      }));
    }
    return { exams, errors: [] };
  }
};

// Defence scraper
const defenceScraper = {
  name: 'Defence',
  async scrape() {
    const s = new BaseScraper('Defence');
    const exams = [];
    const core = [
      { n: 'NDA I', l: 'https://upsc.gov.in' }, { n: 'NDA II', l: 'https://upsc.gov.in' },
      { n: 'CDS I', l: 'https://upsc.gov.in' }, { n: 'CDS II', l: 'https://upsc.gov.in' },
      { n: 'AFCAT I', l: 'https://indianairforce.nic.in' }, { n: 'AFCAT II', l: 'https://indianairforce.nic.in' },
      { n: 'Indian Army TGC', l: 'https://joinindianarmy.nic.in' },
      { n: 'Indian Army SSC Tech', l: 'https://joinindianarmy.nic.in' },
      { n: 'Indian Army TES', l: 'https://joinindianarmy.nic.in' },
      { n: 'Indian Army JAG', l: 'https://joinindianarmy.nic.in' },
      { n: 'Indian Navy SSR', l: 'https://joinindiannavy.gov.in' },
      { n: 'Indian Navy AA', l: 'https://joinindiannavy.gov.in' },
      { n: 'Indian Navy MR', l: 'https://joinindiannavy.gov.in' },
      { n: 'Indian Navy 10+2 Cadet', l: 'https://joinindiannavy.gov.in' },
      { n: 'Coast Guard Navik GD', l: 'https://joinindiancoastguard.cdac.in' },
      { n: 'Coast Guard Yantrik', l: 'https://joinindiancoastguard.cdac.in' },
      { n: 'BSF Constable GD', l: 'https://bsf.gov.in' }, { n: 'BSF SI', l: 'https://bsf.gov.in' },
      { n: 'CRPF Constable GD', l: 'https://crpf.gov.in' }, { n: 'CRPF SI', l: 'https://crpf.gov.in' },
      { n: 'CISF Constable', l: 'https://cisf.gov.in' }, { n: 'CISF ASI', l: 'https://cisf.gov.in' },
      { n: 'ITBP Constable', l: 'https://itbpolice.nic.in' }, { n: 'SSB Constable', l: 'https://ssbrectt.gov.in' },
      { n: 'Assam Rifles Rifleman', l: 'https://assamrifles.gov.in' },
      { n: 'MNS (Military Nursing)', l: 'https://joinindianarmy.nic.in' },
    ];
    for (const c of core) {
      exams.push(s.buildExam({
        job_name: `${c.n} ${new Date().getFullYear()}`, organization: 'Ministry of Defence',
        job_category: 'Defence', official_website_link: c.l,
        selection_process: 'Written → SSB/Physical → Medical', state: 'All India',
        minimum_age: 17, maximum_age: 25,
      }));
    }
    return { exams, errors: [] };
  }
};

// PSU scraper
const psuScraper = {
  name: 'PSU',
  async scrape() {
    const s = new BaseScraper('PSU');
    const exams = [];
    const psus = [
      { n: 'ONGC', l: 'https://ongcindia.com' }, { n: 'BHEL', l: 'https://bhel.com' },
      { n: 'NTPC', l: 'https://ntpc.co.in' }, { n: 'SAIL', l: 'https://sail.co.in' },
      { n: 'HAL', l: 'https://hal-india.co.in' }, { n: 'BEL', l: 'https://bel-india.in' },
      { n: 'GAIL', l: 'https://gailonline.com' }, { n: 'IOCL', l: 'https://iocl.com' },
      { n: 'HPCL', l: 'https://hindustanpetroleum.com' }, { n: 'BPCL', l: 'https://bharatpetroleum.in' },
      { n: 'Coal India', l: 'https://coalindia.in' }, { n: 'NHPC', l: 'https://nhpcindia.com' },
      { n: 'Oil India', l: 'https://oil-india.com' }, { n: 'NPCIL', l: 'https://npcil.nic.in' },
      { n: 'PGCIL (PowerGrid)', l: 'https://powergrid.in' },
      { n: 'DMRC', l: 'https://delhimetrorail.com' }, { n: 'DRDO', l: 'https://drdo.gov.in' },
      { n: 'ISRO', l: 'https://isro.gov.in' }, { n: 'AAI', l: 'https://aai.aero' },
      { n: 'FCI', l: 'https://fci.gov.in' }, { n: 'NHAI', l: 'https://nhai.gov.in' },
      { n: 'ECIL', l: 'https://ecil.co.in' }, { n: 'MDL', l: 'https://mazagondock.in' },
      { n: 'BDL', l: 'https://bdl-india.in' }, { n: 'BEML', l: 'https://beml.co.in' },
      { n: 'NLC India', l: 'https://nlcindia.in' }, { n: 'THDC India', l: 'https://thdc.co.in' },
      { n: 'NHPC', l: 'https://nhpcindia.com' }, { n: 'SJVN', l: 'https://sjvn.nic.in' },
    ];
    const roles = ['Engineer (GATE)', 'Management Trainee', 'Executive Trainee', 'Apprentice'];
    for (const psu of psus) {
      for (const role of roles.slice(0, 2)) {
        exams.push(s.buildExam({
          job_name: `${psu.n} ${role} ${new Date().getFullYear()}`, organization: psu.n,
          job_category: 'PSU', official_website_link: psu.l,
          qualification_required: role.includes('GATE') ? 'B.Tech/B.E.' : 'MBA/CA/Graduation',
          selection_process: 'GATE Score / Written Test → GD → Interview', state: 'All India',
        }));
      }
    }
    return { exams, errors: [] };
  }
};

// NTA Entrance Exams scraper
const ntaScraper = {
  name: 'NTA',
  async scrape() {
    const s = new BaseScraper('NTA');
    const exams = [];
    const core = [
      { n: 'JEE Main', l: 'https://jeemain.nta.ac.in', q: '12th Pass (PCM)' },
      { n: 'JEE Advanced', l: 'https://jeeadv.ac.in', q: 'JEE Main qualified' },
      { n: 'NEET UG', l: 'https://neet.nta.nic.in', q: '12th Pass (PCB)' },
      { n: 'NEET PG', l: 'https://natboard.edu.in', q: 'MBBS' },
      { n: 'UGC NET', l: 'https://ugcnet.nta.ac.in', q: 'Post Graduation' },
      { n: 'CSIR NET', l: 'https://csirnet.nta.ac.in', q: 'M.Sc/Integrated BS-MS' },
      { n: 'GATE', l: 'https://gate2025.iitr.ac.in', q: 'B.Tech/B.E./M.Sc' },
      { n: 'CUET UG', l: 'https://cuet.nta.ac.in', q: '12th Pass' },
      { n: 'CUET PG', l: 'https://cuet.nta.ac.in', q: 'Graduation' },
      { n: 'CAT', l: 'https://iimcat.ac.in', q: 'Graduation' },
      { n: 'CTET', l: 'https://ctet.nic.in', q: 'D.El.Ed / B.Ed' },
      { n: 'CLAT', l: 'https://consortiumofnlus.ac.in', q: '12th Pass' },
      { n: 'ICAR AIEEA', l: 'https://icar.org.in', q: '12th Pass (PCM/PCB)' },
      { n: 'DUET', l: 'https://nta.ac.in', q: '12th Pass' },
      { n: 'GPAT', l: 'https://gpat.nta.ac.in', q: 'B.Pharm' },
    ];
    for (const c of core) {
      exams.push(s.buildExam({
        job_name: `${c.n} ${new Date().getFullYear()}`, organization: 'National Testing Agency',
        job_category: 'Entrance Exams', official_website_link: c.l,
        qualification_required: c.q, state: 'All India',
        selection_process: 'Computer Based Test → Counselling → Admission/Selection',
      }));
    }
    return { exams, errors: [] };
  }
};

// State PSC scraper — all 28 states + UTs
const statePscScraper = {
  name: 'StatePSC',
  async scrape() {
    const s = new BaseScraper('StatePSC');
    const exams = [];
    const states = [
      { st: 'Uttar Pradesh', o: 'UPPSC', l: 'https://uppsc.up.nic.in' },
      { st: 'Maharashtra', o: 'MPSC', l: 'https://mpsc.gov.in' },
      { st: 'Rajasthan', o: 'RPSC', l: 'https://rpsc.rajasthan.gov.in' },
      { st: 'Madhya Pradesh', o: 'MPPSC', l: 'https://mppsc.mp.gov.in' },
      { st: 'Bihar', o: 'BPSC', l: 'https://bpsc.bih.nic.in' },
      { st: 'West Bengal', o: 'WBPSC', l: 'https://wbpsc.gov.in' },
      { st: 'Tamil Nadu', o: 'TNPSC', l: 'https://tnpsc.gov.in' },
      { st: 'Karnataka', o: 'KPSC', l: 'https://kpsc.kar.nic.in' },
      { st: 'Gujarat', o: 'GPSC', l: 'https://gpsc.gujarat.gov.in' },
      { st: 'Andhra Pradesh', o: 'APPSC', l: 'https://psc.ap.gov.in' },
      { st: 'Telangana', o: 'TSPSC', l: 'https://tspsc.gov.in' },
      { st: 'Kerala', o: 'Kerala PSC', l: 'https://keralapsc.gov.in' },
      { st: 'Odisha', o: 'OPSC', l: 'https://opsc.gov.in' },
      { st: 'Punjab', o: 'PPSC', l: 'https://ppsc.gov.in' },
      { st: 'Haryana', o: 'HPSC', l: 'https://hpsc.gov.in' },
      { st: 'Jharkhand', o: 'JPSC', l: 'https://jpsc.gov.in' },
      { st: 'Chhattisgarh', o: 'CGPSC', l: 'https://psc.cg.gov.in' },
      { st: 'Uttarakhand', o: 'UKPSC', l: 'https://ukpsc.gov.in' },
      { st: 'Himachal Pradesh', o: 'HPPSC', l: 'https://hppsc.hp.gov.in' },
      { st: 'Assam', o: 'APSC', l: 'https://apsc.nic.in' },
      { st: 'Tripura', o: 'TPSC', l: 'https://tpsc.tripura.gov.in' },
      { st: 'Manipur', o: 'Manipur PSC', l: 'https://mpscmanipur.gov.in' },
      { st: 'Meghalaya', o: 'Meghalaya PSC', l: 'https://meghalaya.gov.in' },
      { st: 'Nagaland', o: 'NPSC', l: 'https://npsc.nagaland.gov.in' },
      { st: 'Mizoram', o: 'Mizoram PSC', l: 'https://mpsc.mizoram.gov.in' },
      { st: 'Arunachal Pradesh', o: 'APPSC', l: 'https://appsc.gov.in' },
      { st: 'Sikkim', o: 'SPSC', l: 'https://spsc.sikkim.gov.in' },
      { st: 'Goa', o: 'Goa PSC', l: 'https://gpsc.goa.gov.in' },
      { st: 'J&K', o: 'JKPSC', l: 'https://jkpsc.nic.in' },
      { st: 'Delhi', o: 'DSSSB', l: 'https://dsssb.delhi.gov.in' },
    ];
    const examTypes = ['State Civil Services', 'Police SI', 'Police Constable', 'Junior Engineer',
      'Tax Inspector', 'Revenue Inspector', 'Block Development Officer', 'Panchayat Secretary',
      'Assistant Professor', 'PGT Teacher', 'TGT Teacher', 'Forest Ranger',
      'District Court Clerk', 'High Court Stenographer', 'Patwari/Lekhpal',
      'Agriculture Officer', 'Veterinary Officer', 'RTO Inspector', 'Excise Inspector',
      'Food Inspector', 'Gram Sevak', 'Anganwadi Supervisor'];
    for (const st of states) {
      for (const exam of examTypes) {
        exams.push(s.buildExam({
          job_name: `${st.st} ${exam} ${new Date().getFullYear()}`,
          organization: st.o, job_category: 'State PSCs',
          official_website_link: st.l, state: st.st,
          qualification_required: /Constable|Gram|Anganwadi/.test(exam) ? '10th/12th Pass' : /Teacher|Professor/.test(exam) ? 'Post Graduation/B.Ed' : 'Graduation',
          selection_process: 'Written Exam → Interview/Physical → Document Verification',
          minimum_age: 18, maximum_age: /Civil Service|BDO/.test(exam) ? 40 : 35,
        }));
      }
    }
    return { exams, errors: [] };
  }
};

// Central Govt Misc scraper
const centralGovtScraper = {
  name: 'CentralGovt',
  async scrape() {
    const s = new BaseScraper('CentralGovt');
    const exams = [];
    const orgs = [
      { n: 'India Post GDS', o: 'India Post', l: 'https://indiapost.gov.in', q: '10th Pass' },
      { n: 'India Post MTS', o: 'India Post', l: 'https://indiapost.gov.in', q: '10th Pass' },
      { n: 'India Post Postman/Mail Guard', o: 'India Post', l: 'https://indiapost.gov.in', q: '12th Pass' },
      { n: 'EPFO SSA', o: 'EPFO', l: 'https://epfindia.gov.in', q: 'Graduation' },
      { n: 'ESIC UDC', o: 'ESIC', l: 'https://esic.gov.in', q: 'Graduation' },
      { n: 'ESIC Stenographer', o: 'ESIC', l: 'https://esic.gov.in', q: '12th Pass' },
      { n: 'KVS PGT', o: 'Kendriya Vidyalaya', l: 'https://kvsangathan.nic.in', q: 'Post Graduation + B.Ed' },
      { n: 'KVS TGT', o: 'Kendriya Vidyalaya', l: 'https://kvsangathan.nic.in', q: 'Graduation + B.Ed' },
      { n: 'KVS PRT', o: 'Kendriya Vidyalaya', l: 'https://kvsangathan.nic.in', q: '12th + D.El.Ed' },
      { n: 'NVS PGT', o: 'Navodaya Vidyalaya', l: 'https://navodaya.gov.in', q: 'Post Graduation + B.Ed' },
      { n: 'NVS TGT', o: 'Navodaya Vidyalaya', l: 'https://navodaya.gov.in', q: 'Graduation + B.Ed' },
      { n: 'CBSE Superintendent', o: 'CBSE', l: 'https://cbse.gov.in', q: 'Graduation' },
      { n: 'CSIR Technical Assistant', o: 'CSIR', l: 'https://csir.res.in', q: 'B.Sc/B.Tech' },
      { n: 'ICAR Technician', o: 'ICAR', l: 'https://icar.org.in', q: '12th/ITI' },
      { n: 'UIDAI Operator', o: 'UIDAI', l: 'https://uidai.gov.in', q: '12th Pass' },
      { n: 'Income Tax Inspector', o: 'CBDT', l: 'https://incometaxindia.gov.in', q: 'Graduation' },
      { n: 'Customs Inspector', o: 'CBIC', l: 'https://cbic.gov.in', q: 'Graduation' },
      { n: 'CBI Sub Inspector', o: 'CBI', l: 'https://cbi.gov.in', q: 'Graduation' },
      { n: 'IB ACIO', o: 'Intelligence Bureau', l: 'https://mha.gov.in', q: 'Graduation' },
      { n: 'NIA Inspector', o: 'NIA', l: 'https://nia.gov.in', q: 'Graduation' },
      { n: 'AIIMS Nursing Officer', o: 'AIIMS', l: 'https://aiimsexams.ac.in', q: 'B.Sc Nursing' },
      { n: 'AIIMS Staff Nurse', o: 'AIIMS', l: 'https://aiimsexams.ac.in', q: 'GNM/B.Sc Nursing' },
    ];
    for (const c of orgs) {
      exams.push(s.buildExam({
        job_name: `${c.n} ${new Date().getFullYear()}`, organization: c.o,
        job_category: 'Central Government', official_website_link: c.l,
        qualification_required: c.q, state: 'All India',
        selection_process: 'Written Exam → Skill Test → Document Verification',
      }));
    }
    return { exams, errors: [] };
  }
};

// Judiciary scraper
const judiciaryScraper = {
  name: 'Judiciary',
  async scrape() {
    const s = new BaseScraper('Judiciary');
    const exams = [];
    const courts = [
      'Supreme Court', 'Delhi High Court', 'Bombay High Court', 'Madras High Court',
      'Calcutta High Court', 'Allahabad High Court', 'Karnataka High Court',
      'Kerala High Court', 'Gujarat High Court', 'Rajasthan High Court',
      'Patna High Court', 'MP High Court', 'Telangana High Court',
    ];
    const posts = ['Clerk', 'Stenographer', 'Peon/Attendant', 'Junior Judicial Assistant'];
    for (const court of courts) {
      for (const post of posts) {
        exams.push(s.buildExam({
          job_name: `${court} ${post} ${new Date().getFullYear()}`, organization: court,
          job_category: 'Judiciary', official_website_link: 'https://main.sci.gov.in',
          qualification_required: /Clerk|Steno|Junior/.test(post) ? '12th Pass / Graduation' : '10th Pass',
          selection_process: 'Written Exam → Typing/Skill Test → Interview', state: 'All India',
        }));
      }
    }
    return { exams, errors: [] };
  }
};

module.exports = [
  require('./upsc'),
  require('./ssc'),
];

