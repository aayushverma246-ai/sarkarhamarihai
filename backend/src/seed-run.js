const { initDb } = require('./db');
const { seedDatabase } = require('./seed');

async function run() {
    try {
        console.log('Initializing database tables...');
        await initDb();
        const { seedSyllabus } = require('./seed-syllabus');
        console.log('Seeding syllabus data...');
        await seedSyllabus();
        
        console.log('Seeding database with job data...');
        await seedDatabase();
        console.log('Done.');
        process.exit(0);
    } catch (e) {
        console.error('Seed error:', e);
        process.exit(1);
    }
}

run();
