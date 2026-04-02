const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const projectDir = __dirname;

console.log('=== SarkarHamariHai Vercel Deployment ===\n');
console.log('Project: sarkar-hamari-hai');
console.log('Target: sarkarhamarihai.vercel.app');
console.log('Directory:', projectDir);
console.log('');

try {
    // Step 1: Verify configuration
    console.log('✓ Step 1: Verifying Vercel configuration...');
    const vercelConfig = JSON.parse(fs.readFileSync(path.join(projectDir, '.vercel/project.json'), 'utf8'));
    console.log(`  Project ID: ${vercelConfig.projectId}`);
    console.log(`  Project Name: ${vercelConfig.projectName}\n`);

    // Step 2: Install dependencies
    console.log('⏳ Step 2: Installing dependencies...');
    execSync('npm install --prefer-offline --no-audit', { 
        stdio: 'inherit', 
        cwd: projectDir,
        shell: true
    });
    console.log('✓ Dependencies installed\n');

    // Step 3: Build the project
    console.log('⏳ Step 3: Building with Vite...');
    execSync('npm run build', { 
        stdio: 'inherit', 
        cwd: projectDir,
        shell: true
    });
    console.log('✓ Build completed successfully\n');

    // Step 4: Deploy to Vercel
    console.log('⏳ Step 4: Deploying to Vercel production...');
    try {
        const token = fs.readFileSync(path.join(projectDir, 'token.txt'), 'utf8').trim();
        execSync(`npx vercel deploy --prod --yes --token ${token}`, { 
            stdio: 'inherit', 
            cwd: projectDir,
            shell: true
        });
    } catch (e) {
        // Token might not be Vercel token, try without it
        console.log('  Note: Token may not be valid, attempting deployment without token...');
        execSync('npx vercel deploy --prod --yes', { 
            stdio: 'inherit', 
            cwd: projectDir,
            shell: true
        });
    }
    
    console.log('\n✓ Deployment completed successfully\n');

    console.log('=== Deployment Summary ===');
    console.log('✅ Status: SUCCESS');
    console.log('🌐 Project: sarkar-hamari-hai');
    console.log('📦 URL: https://sarkarhamarihai.vercel.app');
    console.log('API: https://sarkarhamarihai.vercel.app/api');
    console.log('\n✨ Your application is now live on Vercel!');

} catch (error) {
    console.error('\n❌ Deployment failed:');
    console.error(error.message);
    if (error.stdout) console.log('\nStdout:', error.stdout.toString());
    if (error.stderr) console.log('\nStderr:', error.stderr.toString());
    console.error('\n📋 Troubleshooting:');
    console.error('1. Ensure you are logged in to Vercel: npx vercel login');
    console.error('2. Check your internet connection');
    console.error('3. Verify npm is installed: npm --version');
    process.exit(1);
}
