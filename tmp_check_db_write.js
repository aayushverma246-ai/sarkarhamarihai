const { createClient } = require('@libsql/client');
require('dotenv').config({ path: '.env.prod.vercel' });

const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
});

async function run() {
    try {
        console.log('Testing connection...');
        await client.execute('SELECT 1 FROM jobs LIMIT 1');
        console.log('Connection OK! Testing write...');
        
        const timestamp = Date.now();
        const guestEmail = `test_${timestamp}@test.com`;
        
        await client.execute({
            sql: `INSERT INTO users (id, email, password_hash, full_name, age, category, state, qualification_type, qualification_status, current_year, current_semester, expected_graduation_year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [`test_${timestamp}`, guestEmail, 'hash', 'Test', 20, 'Gen', 'State', 'Grad', 'Completed', 0, 0, 0]
        });
        
        console.log('Write OK!');
        process.exit(0);
    } catch (e) {
        console.error('FAILED:', e);
        process.exit(1);
    }
}
run();
