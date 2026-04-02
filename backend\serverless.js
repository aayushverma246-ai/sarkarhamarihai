const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');

// Import routes relative to backend structure
const db = require('./src/db');
require('./src/seed');

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/jobs', require('./src/routes/jobs'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/roadmap', require('./src/routes/roadmap'));
app.use('/api/ai', require('./src/routes/ai')); // Added AI reconstruct route
app.use('/api/apply', require('./src/routes/apply'));
app.use('/api/syllabus', require('./src/routes/syllabus'));
app.use('/api/tracker', require('./src/routes/tracker'));

app.get('/api/health', (req, res) => res.json({ status: 'serverless ok', ts: new Date().toISOString() }));

module.exports.handler = serverless(app);
