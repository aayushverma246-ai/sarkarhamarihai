require('dotenv').config({path: 'backend/.env'});
const { createClient } = require('@libsql/client');

async function main() {
    console.log("Connecting...");
    const db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
    });

    try {
        console.log("Executing INSERT...");
        const res = await db.execute(`INSERT INTO users (id, email, password_hash) VALUES ('test_new_123', 'test_new_123@abc.com', 'pwd_hash')`);
        console.log("INSERT success!", res);
    } catch (err) {
        console.error("INSERT Error:", err);
    } finally {
        process.exit(0);
    }
}
main();
