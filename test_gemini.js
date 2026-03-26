const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: './backend/.env' });

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;

if (!apiKey) {
    console.error("No API key found in backend/.env!");
    process.exit(1);
}

async function test() {
    try {
        console.log("Manual v1 Fetch Test...");
        const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "Hi" }] }] })
        });
        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch Error:", err.message);
    }
}

test();
