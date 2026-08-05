const axios = require('axios');

async function testLlamaLinks() {
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  const apiKey = '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';
  
  console.log('Querying Llama-3.1-8b-instruct to find official website URL...');
  const start = Date.now();
  
  try {
    const response = await axios.post(url, {
      model: 'meta/llama-3.1-8b-instruct',
      messages: [
        { 
          role: 'user', 
          content: 'Identify the official recruitment portal or website URL for: "Andhra Pradesh Public Service Commission" which conducts the exam: "Andhra Pradesh PSC State Civil Services 2026". Respond ONLY in JSON format: { "url": "https://..." }' 
        }
      ],
      temperature: 0.1,
      max_tokens: 150
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 10000
    });
    
    console.log(`Success! Status: ${response.status} (${Date.now() - start}ms)`);
    console.log('Raw Response:', response.data.choices[0].message.content.trim());
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testLlamaLinks();
