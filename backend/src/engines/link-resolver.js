'use strict';

const GENERIC_DOMAINS = [
  'india.gov.in', 'careers.india.gov.in', 'apprenticeshipindia.org',
  'metro.gov.in', 'mha.gov.in', 'andaman.gov.in', 'indianbanksassociation.org'
];

const directOrgPortals = {
  'Union Public Service Commission': 'https://upsc.gov.in',
  'UPSC': 'https://upsc.gov.in',
  'Staff Selection Commission': 'https://ssc.gov.in',
  'SSC': 'https://ssc.gov.in',
  'State Bank of India': 'https://www.sbi.co.in/web/careers',
  'State Bank of India (SBI)': 'https://www.sbi.co.in/web/careers',
  'SBI': 'https://www.sbi.co.in/web/careers',
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
  'Dadra & Nagar Haveli Education Board': 'https://dnh.nic.in',
  'Puducherry Police Department': 'https://puducherrypolice.gov.in',
  'Karnataka State Road Transport': 'https://ksrtc.karnataka.gov.in',
  'Goa Revenue Dept': 'https://goa.gov.in',
  'Goa Police': 'https://goapolice.gov.in',
  'Dadra & Nagar Haveli Police': 'https://dnh.nic.in',
  'Dadra & Nagar Haveli Public Service Commission': 'https://dnh.nic.in',
  'Madhya Pradesh District Courts': 'https://mphc.gov.in',
  'Andhra Pradesh Public Service Commission': 'https://psc.ap.gov.in',
  'Puducherry Public Service Commission': 'https://psc.py.gov.in',
  'IREDA Limited': 'https://ireda.in',
  'Assam Cooperative Bank': 'https://assambank.in',
  'Madhya Pradesh Education Board': 'https://mpbse.nic.in',
  'Telangana Police Department': 'https://tslprb.in',
  'Bihar High Court': 'https://patnahighcourt.gov.in',
  'HAL': 'https://hal-india.co.in',
  'Hindustan Aeronautics Limited': 'https://hal-india.co.in',
  'BEL': 'https://bel-india.in',
  'Bharat Electronics Limited': 'https://bel-india.in',
  'LIC': 'https://licindia.in',
  'Life Insurance Corporation': 'https://licindia.in',
  'Rajya Sabha Secretariat': 'https://rajyasabha.nic.in',
  'DRDO-ARDE': 'https://drdo.gov.in',
  'DRDO-SSPL': 'https://drdo.gov.in',
  'ICAR-NDRI': 'https://ndri.res.in',
  'DRDO-DEBEL': 'https://drdo.gov.in',
  'MP High Court': 'https://mphc.gov.in',
  'SJVN': 'https://sjvn.nic.in',
  'Heavy Engineering Corporation': 'https://hecltd.com',
  'NBCC India Limited': 'https://nbccindia.gov.in',
  'ECIL': 'https://ecil.co.in',
  'NMDC Limited': 'https://nmdc.co.in',
  'GAIL': 'https://gailonline.com',
  'NPCIL': 'https://npcil.nic.in',
  'NTPC': 'https://ntpc.co.in',
  'HPCL': 'https://hindustanpetroleum.com',
  'THDC India': 'https://thdc.co.in',
  'Housing & Urban Development Corporation': 'https://hudco.org',
  'AIIMS': 'https://aiims.edu',
  'Hindustan Petroleum': 'https://hindustanpetroleum.com',
  'SAIL': 'https://sail.co.in',
  'Hindustan Copper Limited': 'https://hindustancopper.com',
  'NHPC': 'https://nhpcindia.com',
  'IRCTC Limited': 'https://irctc.co.in',
  'MMTC Limited': 'https://mmtclimited.com',
  'MSTC Limited': 'https://mstcindia.co.in',
  'ONGC': 'https://ongcindia.com',
  'BPCL': 'https://bharatpetroleum.in',
  'Narcotics Control Bureau': 'https://narcoticsindia.nic.in',
  'CBDT': 'https://incometaxindia.gov.in',
  'ICAR': 'https://icar.org.in',
  'RGI': 'https://censusindia.gov.in',
  'Invest India': 'https://investindia.gov.in',
  'Survey of India': 'https://surveyofindia.gov.in',
  'CIC': 'https://cic.gov.in',
  'Andaman & Nicobar Islands Public Service Commission': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar Public Service Commission': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar Islands Police Department': 'https://police.andaman.nic.in',
  'Andaman & Nicobar Traffic Police': 'https://police.andaman.nic.in',
  'Andaman & Nicobar Islands Electricity Dept': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar Islands Electricity Board': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar Electricity Dept': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar Islands State Pollution Control Board': 'https://andamannicobar.gov.in',
  'Andaman & Nicobar State Pollution Control Board': 'https://andamannicobar.gov.in',
  'Intelligence Bureau': 'https://mha.nic.in',
  'District Court': 'https://districts.ecourts.gov.in',
  // High Courts
  'Allahabad High Court': 'https://allahabadhighcourt.in',
  'Bombay High Court': 'https://bombayhighcourt.nic.in',
  'Calcutta High Court': 'https://calcuttahighcourt.gov.in',
  'Madras High Court': 'https://hcmadras.tn.gov.in',
  'Gauhati High Court': 'https://ghconline.gov.in',
  'Gujarat High Court': 'https://gujarathighcourt.nic.in',
  'Himachal Pradesh High Court': 'https://hphighcourt.nic.in',
  'Jharkhand High Court': 'https://jharkhandhighcourt.nic.in',
  'Karnataka High Court': 'https://karnatakajudiciary.kar.nic.in',
  'Kerala High Court': 'https://highcourtofkerala.nic.in',
  'Manipur High Court': 'https://hcm.nic.in',
  'Meghalaya High Court': 'https://meghalayahighcourt.nic.in',
  'Orissa High Court': 'https://orissahighcourt.nic.in',
  'Patna High Court': 'https://patnahighcourt.gov.in',
  'Punjab & Haryana High Court': 'https://highcourtchd.gov.in',
  'Rajasthan High Court': 'https://hcraj.nic.in',
  'Sikkim High Court': 'https://hcs.gov.in',
  'Telangana High Court': 'https://tshc.gov.in',
  'Tripura High Court': 'https://thc.nic.in',
  'Uttarakhand High Court': 'https://highcourtofuttarakhand.gov.in',
  'Chhattisgarh High Court': 'https://highcourt.cg.gov.in',
  'Jammu & Kashmir High Court': 'https://jkhc.nic.in',
  'Andhra Pradesh High Court': 'https://aphc.gov.in',
  // Specific CSIR Labs
  'CSIR-NPL Delhi': 'https://nplindia.org',
  'CSIR-NCL Pune': 'https://ncl-india.org',
  'CSIR-NAL Bangalore': 'https://nal.res.in',
  'CSIR-CDRI Lucknow': 'https://cdri.res.in',
  'CSIR-IIP Dehradun': 'https://iip.res.in',
  // Specific Metros
  'DMRC': 'https://delhimetrorail.com',
  'BMRCL': 'https://english.bmrc.co.in',
  'CMRL': 'https://chennaimetrorail.org',
  'KMRCL': 'https://www.kmrc.in',
  'JMRC': 'https://transport.rajasthan.gov.in/jmrc',
  'Kochi Metro': 'https://kochimetro.org',
  'GMRC': 'https://www.gujaratmetrorail.com',
  'UPMRC': 'https://lmrcl.com',
  'HMRL': 'https://hmr.telangana.gov.in'
};

const STATE_PORTALS = {
  'andaman & nicobar islands': 'https://andamannicobar.gov.in',
  'andaman & nicobar': 'https://andamannicobar.gov.in',
  'andaman': 'https://andamannicobar.gov.in',
  'andhra pradesh': 'https://ap.gov.in',
  'arunachal pradesh': 'https://arunachalpradesh.gov.in',
  'assam': 'https://assam.gov.in',
  'bihar': 'https://bihar.gov.in',
  'chhattisgarh': 'https://cgstate.gov.in',
  'goa': 'https://goa.gov.in',
  'gujarat': 'https://gujarat.gov.in',
  'haryana': 'https://haryana.gov.in',
  'himachal pradesh': 'https://hp.gov.in',
  'jammu & kashmir': 'https://jk.gov.in',
  'j&k': 'https://jk.gov.in',
  'jharkhand': 'https://jharkhand.gov.in',
  'karnataka': 'https://karnataka.gov.in',
  'kerala': 'https://kerala.gov.in',
  'madhya pradesh': 'https://mp.gov.in',
  'maharashtra': 'https://maharashtra.gov.in',
  'manipur': 'https://manipur.gov.in',
  'meghalaya': 'https://meghalaya.gov.in',
  'mizoram': 'https://mizoram.gov.in',
  'nagaland': 'https://nagaland.gov.in',
  'odisha': 'https://odisha.gov.in',
  'punjab': 'https://punjab.gov.in',
  'rajasthan': 'https://rajasthan.gov.in',
  'sikkim': 'https://sikkim.gov.in',
  'tamil nadu': 'https://tn.gov.in',
  'telangana': 'https://telangana.gov.in',
  'tripura': 'https://tripura.gov.in',
  'uttar pradesh': 'https://up.gov.in',
  'uttarakhand': 'https://uk.gov.in',
  'west bengal': 'https://wb.gov.in',
  'delhi': 'https://delhi.gov.in',
  'ladakh': 'https://ladakh.nic.in',
  'lakshadweep': 'https://lakshadweep.gov.in',
  'puducherry': 'https://py.gov.in',
  'chandigarh': 'https://chandigarh.gov.in',
  'dadra & nagar haveli and daman & diu': 'https://dnh.gov.in',
  'dadra & nagar haveli': 'https://dnh.gov.in',
  'daman & diu': 'https://dnh.gov.in'
};

const STATE_PSC_PORTALS = {
  'andhra pradesh': 'https://psc.ap.gov.in',
  'arunachal pradesh': 'https://appsc.gov.in',
  'assam': 'https://apsc.nic.in',
  'bihar': 'https://bpsc.bih.nic.in',
  'chhattisgarh': 'https://psc.cg.gov.in',
  'goa': 'https://gpsc.goa.gov.in',
  'gujarat': 'https://gpsc.gujarat.gov.in',
  'haryana': 'https://hpsc.gov.in',
  'himachal pradesh': 'https://hppsc.hp.gov.in',
  'jharkhand': 'https://jpsc.gov.in',
  'karnataka': 'https://kpsc.kar.nic.in',
  'kerala': 'https://keralapsc.gov.in',
  'madhya pradesh': 'https://mppsc.mp.gov.in',
  'maharashtra': 'https://mpsc.gov.in',
  'manipur': 'https://mpscmanipur.gov.in',
  'meghalaya': 'https://mpsc.meghalaya.gov.in',
  'mizoram': 'https://mpsc.mizoram.gov.in',
  'nagaland': 'https://npsc.nagaland.gov.in',
  'odisha': 'https://opsc.gov.in',
  'punjab': 'https://ppsc.gov.in',
  'rajasthan': 'https://rpsc.rajasthan.gov.in',
  'sikkim': 'https://spsc.sikkim.gov.in',
  'tamil nadu': 'https://tnpsc.gov.in',
  'telangana': 'https://tspsc.gov.in',
  'tripura': 'https://tpsc.tripura.gov.in',
  'uttar pradesh': 'https://uppsc.up.nic.in',
  'uttarakhand': 'https://ukpsc.gov.in',
  'west bengal': 'https://wbpsc.gov.in',
  'jammu & kashmir': 'https://jkpsc.nic.in',
  'j&k': 'https://jkpsc.nic.in',
  'puducherry': 'https://recruitment.puducherry.gov.in',
  'delhi': 'https://dsssb.delhi.gov.in'
};

function escapeRegex(string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function isGenericUrl(url) {
  if (!url) return true;
  const trimmed = url.trim().toLowerCase();
  
  // Exclude whitelisted domains (legitimate domains containing 'india.gov.in' substring)
  const whitelist = [
    'epfindia.gov.in', 'airindia.gov.in', 'coalindia.in',
    'nbccindia.gov.in', 'surveyofindia.gov.in', 'incometaxindia.gov.in',
    'censusindia.gov.in', 'investindia.gov.in'
  ];
  if (whitelist.some(w => trimmed.includes(w))) {
    return false;
  }
  
  return GENERIC_DOMAINS.some(domain => trimmed.includes(domain));
}

function resolveLink(orgName, jobName, state) {
  const o = (orgName || '').toLowerCase().trim();
  const j = (jobName || '').toLowerCase().trim();
  const s = (state || '').toLowerCase().trim();
  const combined = `${j} ${o}`;

  // Special Check: Handle Railway Recruitment Board (RRB) zones dynamically
  if (o.includes('rrb') || o.includes('railway recruitment board') || o.includes('indian railways')) {
    const zones = {
      'ahmedabad': 'ahmedabad', 'ajmer': 'ajmer', 'allahabad': 'allahabad', 'prayagraj': 'allahabad',
      'bangalore': 'bengaluru', 'bengaluru': 'bengaluru', 'bhopal': 'bhopal',
      'bhubaneswar': 'bhubaneswar', 'bilaspur': 'bilaspur', 'chandigarh': 'chandigarh',
      'chennai': 'chennai', 'gorakhpur': 'gorakhpur', 'guwahati': 'guwahati',
      'jammu': 'jammu', 'kolkata': 'kolkata', 'malda': 'malda',
      'mumbai': 'mumbai', 'muzaffarpur': 'muzaffarpur', 'patna': 'patna',
      'ranchi': 'ranchi', 'secunderabad': 'secunderabad', 'siliguri': 'siliguri',
      'thiruvananthapuram': 'trivandrum', 'trivandrum': 'trivandrum'
    };
    for (const [zone, code] of Object.entries(zones)) {
      if (o.includes(zone) || j.includes(zone)) {
        return `https://rrb${code}.gov.in`;
      }
    }
    return 'https://indianrailways.gov.in'; // Default fallback
  }

  // 1. Check exact matches in directOrgPortals first
  for (const [key, url] of Object.entries(directOrgPortals)) {
    if (o === key.toLowerCase().trim()) {
      return url;
    }
  }

  // 2. Check word-boundary matches in directOrgPortals (longest key first)
  const sortedKeys = Object.keys(directOrgPortals).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    const regex = new RegExp('\\b' + escapeRegex(key) + '\\b', 'i');
    if (regex.test(combined)) {
      return directOrgPortals[key];
    }
  }

  // 3. If it's a PSC or Staff Selection or Education Board, try STATE_PSC_PORTALS
  const isPsc = /psc|\bpublic\s+service\b|staff\s+selection|education\s+board|school\s+education|subordinate\s+services/i.test(combined);
  if (isPsc) {
    for (const [key, url] of Object.entries(STATE_PSC_PORTALS)) {
      if (s.includes(key.toLowerCase()) || combined.includes(key.toLowerCase())) {
        return url;
      }
    }
  }

  // 4. Try normal state portals
  for (const [key, url] of Object.entries(STATE_PORTALS)) {
    if (s.includes(key.toLowerCase()) || combined.includes(key.toLowerCase())) {
      return url;
    }
  }

  return '';
}

module.exports = {
  resolveLink,
  isGenericUrl,
  directOrgPortals,
  STATE_PORTALS,
  STATE_PSC_PORTALS
};
