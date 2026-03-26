const jwt = require('jsonwebtoken');
const token = jwt.sign({ id: 'faker123', email: 'test@example.com' }, 'sarkarhamarhai_super_secret_jwt_key_2024_prod');

fetch('http://localhost:3001/api/tracker/plan/generate', {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        wake_time: '06:00',
        sleep_time: '22:00',
        planned_hours: 6,
        subjects: ['Maths'],
        preferences: {}
    })
}).then(async r => {
    const text = await r.text();
    try {
        console.log(JSON.parse(text));
    } catch (e) {
        console.log("RAW TEXT RESPONSE:", text);
        throw e;
    }
}).catch(console.error);
