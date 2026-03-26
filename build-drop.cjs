const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('1. Building Frontend...');
execSync('npm run build', { stdio: 'inherit', shell: true });

console.log('2. Bundling Backend (Serverless) using esbuild...');
const distDir = path.join(__dirname, 'dist');
const distNetlifyFnDir = path.join(distDir, 'netlify', 'functions');

if (!fs.existsSync(distNetlifyFnDir)) {
    fs.mkdirSync(distNetlifyFnDir, { recursive: true });
}

// Bundle backend
execSync('npx esbuild netlify/functions/api.js --bundle --platform=node --target=node20 --external:node:sqlite --outfile=dist/netlify/functions/api.js', { stdio: 'inherit', shell: true });

console.log('3. Writing _redirects...');
// _redirects ensures all /api/* requests hit the bundled lambda!
fs.writeFileSync(path.join(distDir, '_redirects'), '/api/* /.netlify/functions/api/:splat 200\n/* /index.html 200\n');

console.log('4. Zipping the payload for Netlify Drop...');
const zipPath = path.join(__dirname, 'SarkarHamariHai-Universal.zip');
try {
    if (fs.existsSync(zipPath)) {
        fs.unlinkSync(zipPath);
    }
    // Zip the contents of dist
    execSync(`powershell.exe -Command "Compress-Archive -Path dist\\* -DestinationPath '${zipPath}' -Force"`, { stdio: 'inherit', shell: true });
    console.log('\n✅ Done! The file SarkarHamariHai-Universal.zip is exactly what you drag and drop into Netlify.');
} catch (e) {
    console.error('Failed to zip:', e.message);
}
