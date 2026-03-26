const http = require('http');
const fs = require('fs');

const server = http.createServer((req, res) => {
    // Enable CORS for everything
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
    res.setHeader('Access-Control-Allow-Headers', '*');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const fileName = req.url.split('/')[1];
            fs.writeFileSync('C:/Users/aayus/Downloads/build-govguide-ai-app (1)/' + fileName + '.txt', body);
            console.log('Saved FLAWLESS text to', fileName + '.txt');
            res.writeHead(200);
            res.end('OK');
        });
    } else {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <textarea id="url"></textarea><br/>
            <textarea id="token"></textarea><br/>
            <script>
                document.getElementById('url').addEventListener('input', e => fetch('http://localhost:3005/url', { method: 'POST', body: e.target.value.trim() }));
                document.getElementById('token').addEventListener('input', e => fetch('http://localhost:3005/token', { method: 'POST', body: e.target.value.trim() }));
            </script>
        `);
    }
});

server.listen(3005, () => console.log('Capture Server Live on 3005'));
