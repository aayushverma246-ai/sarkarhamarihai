const { spawnSync } = require('child_process');
const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE3MDcyNjAsImlkIjoiM2FjMWU2YjMtYWEyNy00MDY3LWE0MzEtOTg5YmEzMWMwOWExIiwicmlkIjoiOGE5YzIzN2ItOTNjYy00MDg0LWJjZjEtMmI4MWUxNzhhMzViIn0.zmaDuYEhY6p4UCucqnw24RmC6g6KbPBTD5zOvIsYTtLsziBTQRzbiidB4P_WnDpb4kWQKotYp2Ig6x_L04wHAA';

console.log('--- FIXED DIRECT DEPLOYMENT ---');
console.log('Token Length:', token.length);

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = ['vercel', 'deploy', './dist', '--prod', '--force', '--yes', '--token', token];

console.log('Running: ' + npxCmd + ' vercel deploy ./dist --prod --force --yes --token [MASKED]');

const result = spawnSync(npxCmd, args, {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
});

if (result.status === 0) {
    console.log('DEPLOYMENT SUCCESS!');
} else {
    console.error('DEPLOYMENT FAILED with status:', result.status);
    process.exit(1);
}
