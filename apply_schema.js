const { getDb, initDb } = require('./backend/src/db');

async function apply(isProduction = false) {
    if (isProduction) {
        process.env.TURSO_DATABASE_URL = "libsql://sarkar-new-aayush-verma-19.aws-ap-south-1.turso.io";
        process.env.TURSO_AUTH_TOKEN = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE3MDcyNjAsImlkIjoiM2FjMWU2YjMtYWEyNy00MDY3LWE0MzEtOTg5YmEzMWMwOWExIiwicmlkIjoiOGE5YzIzN2ItOTNjYy00MDg0LWJjZjEtMmI4MWUxNzhhMzViIn0.zmaDuYEhY6p4UCucqnw24RmC6g6KbPBTD5zOvIsYTtLsziBTQRzbiidB4P_WnDpb4kWQKotYp2Ig6x_L04wHAA";
    } else {
        process.env.TURSO_DATABASE_URL = "";
    }

    await initDb();
    const db = getDb();
    
    console.log(`Applying schema to ${isProduction ? 'PRODUCTION' : 'LOCAL'} database...`);
    
    const columns = [
        'structured_syllabus_json TEXT DEFAULT ""',
        'embeddings_json TEXT DEFAULT ""',
        'exam_type TEXT DEFAULT ""'
    ];

    for (const col of columns) {
        try {
            await db.execute(`ALTER TABLE jobs ADD COLUMN ${col}`);
            console.log(`  ✅ Added ${col.split(' ')[0]}`);
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log(`  ℹ️ ${col.split(' ')[0]} already exists.`);
            } else {
                console.error(`  ❌ Error adding ${col.split(' ')[0]}: ${e.message}`);
            }
        }
    }
}

async function main() {
    await apply(false); // Local
    await apply(true);  // Production
    console.log("Schema update complete!");
    process.exit(0);
}

main().catch(console.error);
