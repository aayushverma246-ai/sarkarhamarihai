const { getDb, initDb } = require('./backend/src/db');
async function check() {
    process.env.TURSO_DATABASE_URL = ""; // Local
    await initDb();
    const db = getDb();
    try {
        const res = await db.execute('SELECT * FROM jobs LIMIT 1');
        console.log('Columns:', Object.keys(res.rows[0]));
    } catch(e) {
        console.error(e);
    }
    process.exit(0);
}
check();
