const fs = require('fs');
const dotenv = require('dotenv');

const envConfig = dotenv.parse(fs.readFileSync('.env.vercel.pulled.prod'));
const key1 = envConfig.GEMINI_API_KEY;
const key2 = envConfig.GEMINI_API_KEY_NEW;

console.log('Key 1 length:', key1.length);
console.log('Key 1 character codes:');
for (let i = 0; i < key1.length; i++) {
    console.log(`${i}: ${key1[i]} (${key1.charCodeAt(i)})`);
}

console.log('\nKey 2 length:', key2.length);
console.log('Key 2 character codes:');
for (let i = 0; i < key2.length; i++) {
    console.log(`${i}: ${key2[i]} (${key2.charCodeAt(i)})`);
}
