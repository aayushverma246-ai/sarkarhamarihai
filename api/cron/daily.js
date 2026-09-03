'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const cronMod = require('../../backend/src/routes/cron');
const { initDb } = require('../../backend/src/db');

let dbInitialized = false;

module.exports = async (req, res) => {
    if (!dbInitialized) {
        await initDb();
        dbInitialized = true;
    }
    return cronMod.dailyTask(req, res);
};
