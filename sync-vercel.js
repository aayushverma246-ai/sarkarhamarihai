const cp = require('child_process');
const fs = require('fs');
const path = require('path');

// Locate .env in the backend folder relative to this script
const envFile = path.resolve(__dirname, 'backend', '.env');
if (!fs.existsSync(envFile)) {
    console.error(`Error: .env not found at ${envFile}`);
    process.exit(1);
}

const content = fs.readFileSync(envFile, 'utf-8');
const envs = {};
content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...rest] = trimmed.split('=');
        if (key && rest.length) {
            envs[key.trim()] = rest.join('=').trim();
        }
    }
});

// We'll sync only the critical DB and API keys
const keysToSync = ['TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'JWT_SECRET', 'GEMINI_API_KEY_NEW'];

console.log('--- Syncing Vercel Environment Variables ---');
for (const key of keysToSync) {
    const val = envs[key];
    if (!val) {
        console.warn(`Warning: Key ${key} not found in .env`);
        continue;
    }

    console.log(`Updating ${key}...`);
    try {
        // Remove existing first to handle any type changes (prod/preview)
        // This is safe to fail if it doesn't exist
        try {
            cp.execSync(`npx vercel env rm ${key} production --yes`, { stdio: 'ignore' });
        } catch (e) {}

        // Add the new one
        const addCmd = cp.spawn('npx', ['vercel', 'env', 'add', key, 'production']);
        addCmd.stdin.write(val);
        addCmd.stdin.end();
        
        // Wait for it to finish
        const status = cp.spawnSync('npx', ['vercel', 'env', 'add', key, 'production'], {
            input: val,
            stdio: ['pipe', 'inherit', 'inherit']
        });

        if (status.status !== 0) {
            console.error(`Failed to set ${key}`);
        }
    } catch (e) {
        console.error(`Critical error setting ${key}: ${e.message}`);
    }
}

console.log('--- Sync Complete ---');
console.log('NOTE: You must re-deploy for these changes to take effect.');
