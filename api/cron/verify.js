'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../backend/.env') });

const verificationCron = require('./verification-cron');

module.exports = async (req, res) => {
    return verificationCron(req, res);
};
