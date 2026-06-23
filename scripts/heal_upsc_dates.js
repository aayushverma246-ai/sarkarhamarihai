require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');
const { computeFormStatus } = require('../backend/src/engines/validator');

const UPSC_EXAMS_CORRECT_DATES = [
  {
    pattern: /Civil Services|IAS/i,
    start: '2026-02-04',
    end: '2026-02-27'
  },
  {
    pattern: /Forest Service|IFoS/i,
    start: '2026-02-04',
    end: '2026-02-27'
  },
  {
    pattern: /Engineering Services|ESE/i,
    start: '2025-09-17',
    end: '2025-10-08'
  },
  {
    pattern: /CAPF/i,
    start: '2026-02-20',
    end: '2026-03-12'
  },
  {
    pattern: /CDS I\b|CDS 1\b/i,
    start: '2025-12-10',
    end: '2025-12-30'
  },
  {
    pattern: /CDS II\b/i,
    start: '2026-05-20',
    end: '2026-06-09'
  },
  {
    pattern: /NDA I\b|NDA & NA I\b|NDA 1\b/i,
    start: '2025-12-18',
    end: '2026-01-09'
  },
  {
    pattern: /NDA II\b|NDA & NA II\b/i,
    start: '2026-05-20',
    end: '2026-06-09'
  },
  {
    pattern: /CMS|Combined Medical/i,
    start: '2026-03-11',
    end: '2026-04-01'
  },
  {
    pattern: /CISF/i,
    start: '2025-12-03',
    end: '2025-12-23'
  },
  {
    pattern: /Geologist|Geoscientist/i,
    start: '2025-09-04',
    end: '2025-09-24'
  },
  {
    pattern: /IES\/ISS/i,
    start: '2026-04-15',
    end: '2026-05-05'
  },
  {
    pattern: /SO\/Steno/i,
    start: '2025-09-17',
    end: '2025-10-08'
  }
];

async function run() {
  await initDb();
  const db = getDb();
  
  console.log("[Healer] Fetching all UPSC exams...");
  const res = await db.execute("SELECT * FROM jobs WHERE organization = 'UPSC' OR job_name LIKE 'UPSC%'");
  const records = res.rows || [];
  console.log(`[Healer] Found ${records.length} UPSC exams to inspect.`);
  
  let correctedCount = 0;
  
  for (const rec of records) {
    let targetRule = null;
    for (const rule of UPSC_EXAMS_CORRECT_DATES) {
      if (rule.pattern.test(rec.job_name)) {
        targetRule = rule;
        break;
      }
    }
    
    let targetStart = rec.application_start_date;
    let targetEnd = rec.application_end_date;
    let targetStatus = rec.form_status;
    let targetDiscovery = rec.discovery_source;
    let needsUpdate = false;
    
    if (targetRule) {
      if (rec.application_start_date !== targetRule.start || rec.application_end_date !== targetRule.end) {
        console.log(`[Correcting] "${rec.job_name}": ${rec.application_start_date} to ${rec.application_end_date} -> ${targetRule.start} to ${targetRule.end}`);
        targetStart = targetRule.start;
        targetEnd = targetRule.end;
        targetStatus = computeFormStatus(targetStart, targetEnd);
        targetDiscovery = 'healed';
        needsUpdate = true;
      }
    } else {
      // If no specific rule matched but dates are the hallucinated July ones, clear them to prevent bad data
      if (rec.application_start_date === '2026-07-01' && rec.application_end_date === '2026-07-31') {
        console.log(`[Clearing Hallucinated Dates] "${rec.job_name}": July 1 - July 31 -> null`);
        targetStart = null;
        targetEnd = null;
        targetStatus = 'CLOSED';
        targetDiscovery = 'healed';
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      const sql = `UPDATE jobs SET application_start_date = ?, application_end_date = ?, form_status = ?, discovery_source = ?, last_verified_at = ? WHERE id = ?`;
      const now = new Date().toISOString();
      await db.execute({
        sql,
        args: [targetStart, targetEnd, targetStatus, targetDiscovery, now, rec.id]
      });
      correctedCount++;
    }
  }
  
  console.log(`[Healer] Done! Corrected/healed ${correctedCount} UPSC exams.`);
}

run().catch(console.error);
