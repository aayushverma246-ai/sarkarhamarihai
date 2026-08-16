const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { initDb } = require('./db');
const { seedDatabase } = require('./seed');

async function run() {
  console.log('Initializing DB for manual seeding...');
  await initDb();
  console.log('Running seedDatabase...');
  await seedDatabase();
  console.log('Manual seeding completed.');
  process.exit(0);
}

run().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
