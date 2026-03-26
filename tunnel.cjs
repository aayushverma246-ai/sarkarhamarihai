const localtunnel = require('localtunnel');
const app = require('./server.cjs'); // Start the server

(async () => {
    const tunnel = await localtunnel({ port: 3000, subdomain: 'sarkarhamarhai-pro' });
    console.log(`\n\n✅ BOOM! YOUR APP IS LIVE AT: ${tunnel.url}\n\n`);

    tunnel.on('close', () => {
        console.log('Tunnel closed.');
    });
})();
