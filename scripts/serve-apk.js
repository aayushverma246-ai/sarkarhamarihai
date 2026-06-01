const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Terminal ANSI styling helper
const style = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    magenta: '\x1b[35m',
    bgBlue: '\x1b[44m',
    bgGreen: '\x1b[42m',
    fgWhite: '\x1b[37m',
    fgBlack: '\x1b[30m'
};

function printBanner() {
    console.clear();
    console.log(`${style.bright}${style.magenta}=============================================================`);
    console.log(`               GOVGUIDE MOBILE APK DEPLOYER                  `);
    console.log(`=============================================================${style.reset}\n`);
}

// 1. Get the local network IP address
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Skip internal (loopback) and non-IPv4 addresses
            if (iface.family === 'IPv4' && !iface.internal) {
                // Return the first viable local network IP (usually 192.168.x.x or 10.x.x.x)
                if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.') || iface.address.startsWith('172.')) {
                    return iface.address;
                }
            }
        }
    }
    // Fallback search
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const PORT = 8082;
const localIp = getLocalIp();
const apkPath = path.join(__dirname, '../android/app/build/outputs/apk/debug/app-debug.apk');
const downloadUrl = `http://${localIp}:${PORT}/app-debug.apk`;
const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(downloadUrl)}`;

// 2. Start the HTTP server
const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/app-debug.apk' || req.url === '/download') {
        if (!fs.existsSync(apkPath)) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Error: app-debug.apk not found. Run "npm run cap:apk" to build it first.');
            console.log(`${style.yellow}[Server] Download request received, but APK was not found at expected path.${style.reset}`);
            return;
        }

        const stat = fs.statSync(apkPath);
        console.log(`${style.green}[Server] Sending app-debug.apk (${(stat.size / (1024 * 1024)).toFixed(2)} MB) to device...${style.reset}`);
        
        res.writeHead(200, {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Length': stat.size,
            'Content-Disposition': 'attachment; filename=GovGuide-Debug.apk'
        });

        const stream = fs.createReadStream(apkPath);
        stream.pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    printBanner();
    
    // Check if APK exists
    const exists = fs.existsSync(apkPath);
    if (!exists) {
        console.log(`${style.yellow}${style.bright}[WARNING] app-debug.apk has not been built yet!`);
        console.log(`Please run ${style.cyan}npm run cap:apk${style.yellow} in another terminal to compile it.${style.reset}\n`);
    } else {
        const stat = fs.statSync(apkPath);
        console.log(`${style.green}${style.bright}✔ APK is ready for deployment!`);
        console.log(`  File size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
        console.log(`  Path: ${apkPath}${style.reset}\n`);
    }

    console.log(`${style.bright}${style.cyan}--- HOW TO DEPLOY TO YOUR PHONE ---${style.reset}\n`);
    console.log(`${style.bright}1. Connect both your phone and PC to the same Wi-Fi network.${style.reset}`);
    console.log(`${style.bright}2. Open your phone's browser or camera and scan this QR code to download:${style.reset}`);
    console.log(`   👉 ${style.bright}${style.green}${qrCodeUrl}${style.reset}`);
    console.log(`   (Hold Ctrl/Cmd and click the link above to view the QR code in your browser, then scan it!)\n`);
    
    console.log(`${style.bright}3. Or type this URL directly into your phone's browser:${style.reset}`);
    console.log(`   👉 ${style.bright}${style.yellow}${downloadUrl}${style.reset}\n`);

    console.log(`${style.bright}4. Or if you have a phone connected via USB with Developer Mode enabled:${style.reset}`);
    console.log(`   Run: ${style.cyan}adb install -r android/app/build/outputs/apk/debug/app-debug.apk${style.reset}\n`);

    console.log(`${style.bright}${style.magenta}=============================================================${style.reset}`);
    console.log(`${style.yellow}Listening for incoming connections on port ${PORT}... (Press Ctrl+C to stop)${style.reset}`);
});
