const http = require('http');

async function main() {
    const fetch = (await import('node-fetch')).default;
    const body = { appliedExams: [{id: '123', job_name: 'test', syllabus: 'test test test', job_category: 'test'}]};
    console.log("Testing Recommendations...");
    const res = await fetch('http://localhost:3001/api/ai/recommendations', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + 'dummy_token_if_needed' // We can skip auth if we bypass DB or stub it
        },
        body: JSON.stringify(body)
    });
    console.log(res.status);
    console.log(await res.text());
}
main();
