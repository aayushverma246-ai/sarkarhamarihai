const { getDb } = require('./src/db');

async function main() {
  const db = getDb();
  try {
    const r1 = await db.execute("SELECT COUNT(*) as cnt FROM jobs");
    const total = r1.rows[0]?.cnt || 0;
    
    const r2 = await db.execute("SELECT COUNT(*) as cnt FROM jobs WHERE exam_name_hi IS NOT NULL AND exam_name_hi != ''");
    const hiCount = r2.rows[0]?.cnt || 0;
    
    const r3 = await db.execute("SELECT COUNT(*) as cnt FROM jobs WHERE exam_name_ta IS NOT NULL AND exam_name_ta != ''");
    const taCount = r3.rows[0]?.cnt || 0;
    
    const r4 = await db.execute("SELECT COUNT(*) as cnt FROM jobs WHERE exam_name_bn IS NOT NULL AND exam_name_bn != ''");
    const bnCount = r4.rows[0]?.cnt || 0;
    
    console.log(`Total Jobs: ${total}`);
    console.log(`Jobs with Hindi Name: ${hiCount}`);
    console.log(`Jobs with Tamil Name: ${taCount}`);
    console.log(`Jobs with Bengali Name: ${bnCount}`);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();
