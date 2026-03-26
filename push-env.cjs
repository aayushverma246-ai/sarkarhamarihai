const cp = require('child_process');
const fs = require('fs');

const envFile = 'c:\\Users\\aayus\\Downloads\\build-govguide-ai-app (1)\\backend\\.env';
const content = fs.readFileSync(envFile, 'utf-8');

const envs = {};
content.split('\n').forEach(line => {
    if (line.trim() && !line.startsWith('#')) {
        const [key, ...rest] = line.split('=');
        if (key && rest.length) {
            envs[key.trim()] = rest.join('=').trim();
        }
    }
});

const target = 'C:\\sarkar-app';

for (const [key, val] of Object.entries(envs)) {
    console.log(`Setting ${key}...`);
    try {
        // Remove existing first to avoid prompts
        cp.execSync(`npx vercel env rm ${key} production --yes`, { cwd: target, stdio: 'ignore' });
    } catch (e) { }

    // Add the new one securely
    try {
        cp.execSync(`npx vercel env add ${key} production`, {
            cwd: target,
            input: val,
            stdio: ['pipe', 'inherit', 'inherit']
        });
    } catch (e) {
        console.error(`Failed to set ${key}: ${e.message}`);
    }
}
console.log('Environment variables successfully pushed to Vercel!');
