const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const source = __dirname;
// Use a truly temporary folder for a clean slate
const target = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'sarkar-deploy-' + Date.now());

console.log('--- DEPLOYMENT START ---');
console.log('Source:', source);
console.log('Target:', target);

function copyRecursiveSync(src, dest) {
    if (path.basename(src) === 'node_modules' || path.basename(src) === '.git' || path.basename(src) === '.next' || path.basename(src) === '.vite') return;

    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();

    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach((child) => copyRecursiveSync(path.join(src, child), path.join(dest, child)));
    } else {
        fs.copyFileSync(src, dest);
    }
}

try {
    console.log('1. Copying to safe folder...');
    copyRecursiveSync(source, target);

    console.log('2. Deploying to Vercel...');
    // We use --prod to target the main domain
    // We use --force to bypass any remote build cache
    const cmd = 'npx vercel --prod --force --yes';
    console.log(`Running: ${cmd}`);

    // Use inherit to see full output in real-time if possible, but for our logs we want capture
    const output = execSync(`${cmd} 2>&1`, {
        cwd: target,
        shell: 'powershell.exe'
    });

    console.log('--- VERCEL OUTPUT ---');
    console.log(output.toString());
    console.log('--- END VERCEL OUTPUT ---');

    const logFile = path.join(source, 'vercel_deploy.log');
    fs.writeFileSync(logFile, output.toString());

    console.log('Deployment SUCCESS!');
} catch (e) {
    console.error('Deployment FAILED!');
    console.error('Error:', e.message);
    if (e.stdout) console.error('STDOUT:', e.stdout.toString());
    if (e.stderr) console.error('STDERR:', e.stderr.toString());

    const logFile = path.join(source, 'vercel_deploy.log');
    const errorLog = (e.stdout ? e.stdout.toString() : '') + '\n' + (e.stderr ? e.stderr.toString() : '') + '\n' + e.message;
    fs.writeFileSync(logFile, errorLog);
} finally {
    // Cleanup
    try {
        console.log('3. Cleaning up temporary folder...');
        fs.rmSync(target, { recursive: true, force: true });
    } catch (err) {
        console.warn('Warning: Could not delete temp folder:', target);
    }
}
