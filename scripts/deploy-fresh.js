const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const style = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    magenta: '\x1b[35m'
};

function runCmd(command, cwd = process.cwd()) {
    console.log(`\n${style.bright}${style.cyan}➔ Running: ${command}${style.reset}`);
    try {
        execSync(command, { cwd, stdio: 'inherit' });
        return true;
    } catch (error) {
        console.error(`${style.red}✖ Command failed: ${command}${style.reset}`);
        return false;
    }
}

console.log(`${style.bright}${style.magenta}=============================================================`);
console.log(`               CLEAN DEPLOY TO MOBILE DEVICE                 `);
console.log(`=============================================================${style.reset}`);

// 1. Build mobile React/Vite assets
if (!runCmd('npx vite build --mode mobile')) {
    console.log(`${style.red}Aborting: Web build failed.${style.reset}`);
    process.exit(1);
}

// 2. Sync to Android project
if (!runCmd('npx cap sync android')) {
    console.log(`${style.red}Aborting: Capacitor sync failed.${style.reset}`);
    process.exit(1);
}

// 3. Clean Gradle & Compile fresh APK
const androidDir = path.join(__dirname, '../android');
console.log(`\n${style.bright}${style.cyan}➔ Cleaning and compiling Android build...${style.reset}`);
if (!runCmd('gradlew.bat clean assembleDebug', androidDir)) {
    console.log(`${style.red}Aborting: Gradle compilation failed.${style.reset}`);
    process.exit(1);
}

// 4. Force-uninstall old package on device to clear web caches
console.log(`\n${style.bright}${style.cyan}➔ Uninstalling existing app version (to clear caches)...${style.reset}`);
try {
    execSync('adb uninstall com.sarkarhamarihai.app', { stdio: 'ignore' });
    console.log(`${style.green}✔ Stale app uninstalled successfully (or wasn't present).${style.reset}`);
} catch (e) {
    console.log(`${style.yellow}⚠ ADB uninstall skipped (device might not be connected).${style.reset}`);
}

// 5. Install fresh APK
console.log(`\n${style.bright}${style.cyan}➔ Installing fresh APK to your device...${style.reset}`);
const apkPath = 'android/app/build/outputs/apk/debug/app-debug.apk';
try {
    execSync(`adb install -r ${apkPath}`, { stdio: 'inherit' });
    console.log(`\n${style.green}${style.bright}🎉 SUCCESS! Freshly compiled app has been deployed and opened on your phone.${style.reset}`);
} catch (e) {
    console.log(`\n${style.yellow}⚠ Could not install APK automatically via ADB.`);
    console.log(`Please make sure your phone is connected with USB Debugging enabled, or transfer the fresh APK manually from:${style.reset}`);
    console.log(`👉 ${path.resolve(apkPath)}\n`);
}
