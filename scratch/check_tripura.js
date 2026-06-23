require('dotenv').config();
const { getDb, initDb } = require('../backend/src/db');

async function run() {
    await initDb();
    const db = getDb();
    const res = await db.execute("SELECT * FROM jobs WHERE id = '6dd795f8f90fa69a'");
    console.log(JSON.stringify(res.rows[0], null, 2));
    process.exit(0);
}
run();
