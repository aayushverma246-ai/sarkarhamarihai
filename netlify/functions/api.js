const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { initDb } = require('../../backend/src/db');
const { seedDatabase } = require('../../backend/src/seed');

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

app.use('/api/auth', require('../../backend/src/routes/auth'));
app.use('/api/jobs', require('../../backend/src/routes/jobs'));
app.use('/api/notifications', require('../../backend/src/routes/notifications'));
app.use('/api/jobs', require('../../backend/src/routes/roadmap'));

app.get('/api/health', (req, res) => res.json({ status: 'serverless ok', ts: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

let initialized = false;
const serverlessHandler = serverless(app);

module.exports.handler = async (event, context) => {
    if (!initialized) {
        await initDb();
        await seedDatabase();
        initialized = true;
    }
    return serverlessHandler(event, context);
};
