const { createClient } = require('@libsql/client/http');

const url = "https://sarkar-new-aayush-verma-19.aws-ap-south-1.turso.io";
const authToken = "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE3MDcyNjAsImlkIjoiM2FjMWU2YjMtYWEyNy00MDY3LWE0MzEtOTg5YmEzMWMwOWExIiwicmlkIjoiOGE5YzIzN2ItOTNjYy00MDg0LWJjZjEtMmI4MWUxNzhhMzViIn0.zmaDuYEhY6p4UCucqnw24RmC6g6KbPBTD5zOvIsYTtLsziBTQRzbiidB4P_WnDpb4kWQKotYp2Ig6x_L04wHAA";

const db = createClient({ url, authToken });

async function run() {
    const email = 'aayushverma246@gmail.com';
    console.log(`Checking interactions for: ${email}`);

    const users = (await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] })).rows;
    console.log('Users:', JSON.stringify(users, null, 2));

    for (const user of users) {
        console.log(`\n--- Inspecting User ID: ${user.id} ---`);
        const liked = (await db.execute({ sql: 'SELECT * FROM liked_jobs WHERE user_id = ?', args: [user.id] })).rows;
        const applied = (await db.execute({ sql: 'SELECT * FROM applied_jobs WHERE user_id = ?', args: [user.id] })).rows;
        const notifs = (await db.execute({ sql: 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 10', args: [user.id] })).rows;

        console.log(`Liked Count: ${liked.length}`);
        console.log(`Applied Count: ${applied.length}`);
        console.log(`Notifications Count: ${notifs.length}`);
        console.log('Sample Notifications:', JSON.stringify(notifs.slice(0, 3), null, 2));
    }
}

run().catch(console.error);
