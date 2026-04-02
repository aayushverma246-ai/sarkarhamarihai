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
    const tokenFile = path.join(source, 'token.txt');
    let token = fs.existsSync(tokenFile) ? fs.readFileSync(tokenFile, 'utf8').trim() : '';
    
    // Aggressive cleanup: only allow valid JWT characters (A-Z, a-z, 0-9, ., -, _)
    token = token.replace(/[^A-Za-z0-9._-]/g, '');
    
    console.log(`Token Length: ${token.length}`);
    console.log(`Token Hex (First 10 chars): ${Buffer.from(token.substring(0, 10)).toString('hex')}`);
    
    const { spawnSync } = require('child_process');
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    
    // Use environment variable version first as it's cleaner for spawn
    console.log('Running: npx vercel --prod --force --yes (via environment VERCEL_TOKEN)');
    
    const result = spawnSync(npxCmd, ['vercel', '--prod', '--force', '--yes'], {
        cwd: target,
        env: { ...process.env, VERCEL_TOKEN: token },
        shell: true,
        encoding: 'utf8'
    });
    
    const output = (result.stdout || '') + (result.stderr || '');
    if (result.status !== 0) {
        throw new Error(`Command failed with status ${result.status}\n${output}`);
    }

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
