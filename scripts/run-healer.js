const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { healAllRecords } = require('../backend/src/engines/deterministic-healer');

(async () => {
  console.log('Starting deterministic database healer...');
  const report = await healAllRecords();
  console.log('Healing complete! Report:', report);
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(1);
});
