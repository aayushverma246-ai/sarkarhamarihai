const axios = require('axios');

async function testNetwork() {
  const urls = [
    { name: 'Google', url: 'https://www.google.com' },
    { name: 'GitHub API', url: 'https://api.github.com' },
    { name: 'Gemini API', url: 'https://generativelanguage.googleapis.com' },
    { name: 'NVIDIA API', url: 'https://integrate.api.nvidia.com/v1/models' }
  ];

  for (const item of urls) {
    console.log(`Testing ${item.name} (${item.url})...`);
    const start = Date.now();
    try {
      const res = await axios.get(item.url, { timeout: 5000 });
      console.log(`  Success! Status: ${res.status} (${Date.now() - start}ms)`);
    } catch (err) {
      console.log(`  Failed: ${err.message} (${Date.now() - start}ms)`);
    }
  }
}

testNetwork();
