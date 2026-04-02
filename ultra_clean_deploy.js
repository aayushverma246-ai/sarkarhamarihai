const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE3MDcyNjAsImlkIjoiM2FjMWU2YjMtYWEyNy00MDY3LWE0MzEtOTg5YmEzMWMwOWExIiwicmlkIjoiOGE5YzIzN2ItOTNjYy00MDg0LWJjZjEtMmI4MWUxNzhhMzViIn0.zmaDuYEhY6p4UCucqnw24RmC6g6KbPBTD5zOvIsYTtLsziBTQRzbiidB4P_WnDpb4kWQKotYp2Ig6x_L04wHAA';

console.log('--- ULTRA-CLEAN ENVIROMENT DEPLOYMENT ---');

// SCRUB ENTIRE ENVIRONMENT
const cleanEnv = {};
const essentialKeys = ['PATH', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'SystemRoot', 'TEMP', 'TMP', 'ComSpec', 'PATHEXT'];

essentialKeys.forEach(key => {
    if (process.env[key]) {
        cleanEnv[key] = process.env[key];
    }
});

// Set MUST-HAVE Vercel token
cleanEnv.VERCEL_TOKEN = token;

const vercelBin = `"${path.join(__dirname, 'node_modules', '.bin', 'vercel.cmd')}"`;
const args = ['--prod', '--force', '--yes'];

console.log('Target Binary:', vercelBin);
console.log('Running with scrubbed environment (VERCEL_TOKEN explicitly set)...');

// Use spawnSync WITHOUT shell: true if possible to avoid cmd.exe quoting
// But vercel.cmd REQUIRES a shell. 
// So I'll use shell: true but I'm confident my clean env will bypass the system-level quote corruption.

const result = spawnSync(vercelBin, args, {
    cwd: __dirname,
    env: cleanEnv,
    stdio: 'inherit',
    shell: true
});

if (result.status === 0) {
    console.log('DEPLOYMENT SUCCESS!');
} else {
    console.error('DEPLOYMENT FAILED with status:', result.status);
    process.exit(1);
}
