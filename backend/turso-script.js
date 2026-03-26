const https = require('https');

function request(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

const token = process.env.TURSO_API_TOKEN;
if (!token) {
    console.error('Missing TURSO_API_TOKEN environment variable!');
    process.exit(1);
}
const headers = { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' };

async function run() {
    console.log('1. Fetching Organizations...');
    const orgs = await request('https://api.turso.tech/v1/organizations', { headers });
    console.log('Orgs Payload:', JSON.stringify(orgs, null, 2));
    if (!Array.isArray(orgs)) {
        console.error('Failed to authenticate or fetch orgs! Exiting.');
        return;
    }
    const org = orgs[0].slug;

    console.log('2. Fetching Databases for', org);
    const dbs = await request(`https://api.turso.tech/v1/organizations/${org}/databases`, { headers });
    console.log('DBs:', dbs);

    let dbName = null;
    let host = null;

    if (!dbs.databases || dbs.databases.length === 0) {
        console.log('No DBs found! Creating sarkar-db-prod...');
        const createDb = await request(`https://api.turso.tech/v1/organizations/${org}/databases`, { method: 'POST', headers }, { name: 'sarkar-db-prod', group: 'default' });
        console.log('Created!', createDb);
        dbName = createDb.database.Name;
        host = createDb.database.Hostname;
    } else {
        dbName = dbs.databases[0].Name;
        host = dbs.databases[0].Hostname;
    }

    console.log('3. Creating Token for', dbName);
    const tokenRes = await request(`https://api.turso.tech/v1/organizations/${org}/databases/${dbName}/auth/tokens`, { method: 'POST', headers }, { expiration: 'none' });

    require('fs').writeFileSync('.env', `PORT=3001\nJWT_SECRET=sarkarhamarhai_super_secret_jwt_key_2024_prod\nTURSO_DATABASE_URL=libsql://${host}\nTURSO_AUTH_TOKEN=${tokenRes.jwt}`);

    console.log('--- OUTPUT ---');
    console.log('URL: libsql://' + host);
    console.log('TOKEN SUCCESSFULLY SAVED TO .ENV');
}
run().catch(console.error);
