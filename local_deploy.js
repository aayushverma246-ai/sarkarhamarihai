const { spawnSync } = require('child_process');
const path = require('path');
const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NzE3MDcyNjAsImlkIjoiM2FjMWU2YjMtYWEyNy00MDY3LWE0MzEtOTg5YmEzMWMwOWExIiwicmlkIjoiOGE5YzIzN2ItOTNjYy00MDg0LWJjZjEtMmI4MWUxNzhhMzViIn0.zmaDuYEhY6p4UCucqnw24RmC6g6KbPBTD5zOvIsYTtLsziBTQRzbiidB4P_WnDpb4kWQKotYp2Ig6x_L04wHAA';

console.log('--- LOCAL BINARY DEPLOYMENT ---');
const vercelBin = `"${path.join(__dirname, 'node_modules', '.bin', 'vercel.cmd')}"`;

const args = ['--prod', '--force', '--yes'];

console.log('Running: ' + vercelBin + ' ' + args.join(' ') + ' (via VERCEL_TOKEN)');

const result = spawnSync(vercelBin, args, {
    cwd: __dirname,
    env: { ...process.env, VERCEL_TOKEN: token },
    stdio: 'inherit',
    shell: true
});

if (result.status === 0) {
    console.log('DEPLOYMENT SUCCESS!');
} else {
    console.error('DEPLOYMENT FAILED with status:', result.status);
    process.exit(1);
}
