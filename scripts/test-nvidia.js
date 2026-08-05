const axios = require('axios');

async function testNvidiaStreaming() {
  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  const apiKey = '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';
  
  console.log('Sending streaming chat completion request for z-ai/glm-5.2...');
  
  try {
    const response = await axios.post(url, {
      model: 'z-ai/glm-5.2',
      messages: [
        { role: 'user', content: 'Say hello in 5 words!' }
      ],
      temperature: 0.7,
      max_tokens: 100,
      stream: true
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      responseType: 'stream',
      timeout: 15000
    });
    
    console.log('Stream connection established. Reading chunks...');
    
    response.data.on('data', chunk => {
      const text = chunk.toString();
      // OpenAI streaming events are prefixed with "data: "
      const lines = text.split('\n');
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned || cleaned === 'data: [DONE]') continue;
        if (cleaned.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(cleaned.substring(6));
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
            }
          } catch (e) {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
    });

    response.data.on('end', () => {
      console.log('\n\nStream finished.');
    });

  } catch (err) {
    if (err.response) {
      console.error('Error Status:', err.response.status);
    } else {
      console.error('Error:', err.message);
    }
  }
}

testNvidiaStreaming();
