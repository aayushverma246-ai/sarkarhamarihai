const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectDir = 'D:\\build-govguide-ai-app (2)\\build-govguide-ai-app (1)';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  🚀 SarkarHamariHai Vercel Deployment Starting...            ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

async function deployToVercel() {
  try {
    console.log('📍 Step 1: Preparing build environment...');
    process.chdir(projectDir);
    console.log(`✓ Working directory: ${process.cwd()}\n`);

    console.log('📥 Step 2: Installing dependencies (npm install)...');
    try {
      execSync('npm install --prefer-offline --no-audit --loglevel=error', {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
      console.log('✓ Dependencies installed\n');
    } catch (e) {
      console.log('⚠️  npm install had warnings, continuing...\n');
    }

    console.log('🔨 Step 3: Building project (npm run build)...');
    try {
      execSync('npm run build', {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });
      console.log('✓ Build completed successfully\n');
    } catch (e) {
      console.error('❌ Build failed. Check errors above.');
      process.exit(1);
    }

    console.log('🌐 Step 4: Deploying to Vercel (npx vercel deploy --prod)...\n');
    
    try {
      // Try with token first
      const tokenPath = path.join(projectDir, 'token.txt');
      let token = '';
      
      if (fs.existsSync(tokenPath)) {
        token = fs.readFileSync(tokenPath, 'utf8').trim();
      }

      let deployCmd = 'npx vercel deploy --prod --yes';
      if (token && !token.startsWith('libsql://')) {
        // Only use token if it looks like a Vercel token (not Turso token)
        deployCmd = `npx vercel deploy --prod --yes --token ${token}`;
      }

      console.log(`Executing: ${deployCmd.replace(/--token [^ ]+/, '--token [REDACTED]')}\n`);
      
      const output = execSync(deployCmd, {
        stdio: 'inherit',
        shell: true
      });

      console.log('\n');
      console.log('╔════════════════════════════════════════════════════════════════╗');
      console.log('║  ✅ DEPLOYMENT SUCCESSFUL!                                    ║');
      console.log('╚════════════════════════════════════════════════════════════════╝\n');

      console.log('🌐 Your application is now LIVE:\n');
      console.log('   📍 https://sarkarhamarihai.vercel.app');
      console.log('   📍 https://sarkarhamarihai.vercel.app/api/health\n');

      console.log('✨ Next steps:');
      console.log('   1. Visit your live site');
      console.log('   2. Test user signup/login');
      console.log('   3. Browse job listings');
      console.log('   4. Try AI features\n');

      console.log('📊 Dashboard: https://vercel.com/dashboard/sarkar-hamari-hai\n');

    } catch (deployError) {
      console.log('\n⚠️  Deployment command output above ^\n');
      console.error('Error:', deployError.message);
      
      console.log('\n📋 Troubleshooting:');
      console.log('   1. If "not authenticated": Run: npx vercel login');
      console.log('   2. If build errors: Check npm run build locally');
      console.log('   3. If token error: Token file may not be Vercel token\n');
      
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Run deployment
deployToVercel().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
