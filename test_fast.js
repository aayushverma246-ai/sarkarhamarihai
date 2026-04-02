const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { getDb } = require('./backend/src/db.js');
const { updateStatuses, sendNotifications } = require('./backend/src/routes/cron.js');

async function main() {
  const db = getDb();
  console.time('updateStatuses');
  const uc = await updateStatuses(db);
  console.timeEnd('updateStatuses');
  console.log('Updated statuses:', uc);

  console.time('sendNotifications');
  const sc = await sendNotifications(db);
  console.timeEnd('sendNotifications');
  console.log('Sent notifs:', sc);
}

main().catch(console.error);
