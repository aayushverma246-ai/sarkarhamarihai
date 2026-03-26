const { getDb } = require('./db');

async function seedSyllabus() {
    const db = getDb();
    console.log('Seeding syllabus data...');

    try {
        // Drop and recreate for clean migration
        await db.execute(`DROP TABLE IF EXISTS exam_syllabus`);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS exam_syllabus (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name_pattern TEXT UNIQUE NOT NULL,
                subjects TEXT NOT NULL,
                topics TEXT NOT NULL
            )
        `);


        const syllabi = [
            {
                pattern: 'SSC',
                subjects: ['Quantitative Aptitude', 'Reasoning', 'English', 'General Awareness'],
                topics: ['Mathematics', 'Logic', 'Grammar', 'Current Affairs', 'Polity', 'History']
            },
            {
                pattern: 'PSC',
                subjects: ['General Studies', 'State GK', 'Language', 'Aptitude'],
                topics: ['History', 'Geography', 'Economy', 'Public Administration', 'Local Culture']
            },
            {
                pattern: 'Teaching',
                subjects: ['Pedagogy', 'Subject Knowledge', 'General Intelligence', 'Language'],
                topics: ['CDP', 'Teaching Methods', 'Psychology', 'Core Subject', 'Current Affairs']
            },
            {
                pattern: 'Engineering',
                subjects: ['Mathematics', 'General Aptitude', 'Core Engineering Content', 'Reasoning'],
                topics: ['Engineering Math', 'Numerical Ability', 'Verbal Ability', 'Technical Fundamentals']
            },
            {
                pattern: 'Graduate',
                subjects: ['Numerical Ability', 'Reasoning', 'General Awareness', 'English'],
                topics: ['Basic Math', 'Logical Reasoning', 'Comprehension', 'GK']
            }
        ];

        for (const s of syllabi) {
            await db.execute({
                sql: `INSERT OR REPLACE INTO exam_syllabus (name_pattern, subjects, topics) VALUES (?, ?, ?)`,
                args: [s.pattern, JSON.stringify(s.subjects), JSON.stringify(s.topics)]
            });
        }

        console.log('Syllabus seeding completed successfully.');
    } catch (error) {
        console.error('Error seeding syllabus:', error);
    }
}

module.exports = { seedSyllabus };

