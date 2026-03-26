// Temporary script to test seed jobs count
const getDb = () => null;
let _id = 1;
const jobs = [];

function J(name, org, qual, fy, minA, maxA, s, e, sMin, sMax, cat, link) {
    jobs.push({
        id: String(_id++),
        job_name: name, organization: org,
        qualification_required: qual,
        allows_final_year_students: fy ? 1 : 0,
        minimum_age: minA, maximum_age: maxA,
        application_start_date: s, application_end_date: e,
        salary_min: sMin, salary_max: sMax,
        job_category: cat,
        official_application_link: link || 'https://india.gov.in',
        official_notification_link: link || 'https://india.gov.in',
        official_website_link: link || 'https://india.gov.in',
    });
}

// Read the seed file and extract everything before seedDatabase function
const fs = require('fs');
const code = fs.readFileSync('backend/src/seed.js', 'utf8');
const seedPart = code.split('async function seedDatabase')[0];
// Remove the require line and J function definition (we defined them above)
const cleanedCode = seedPart
    .replace(/const \{ getDb \}.*\n/, '')
    .replace(/let _id.*\n/, '')
    .replace(/const jobs.*\n/, '')
    .replace(/function J\(.*?\n[\s\S]*?^\}/m, '');

eval(cleanedCode);

console.log('Total jobs.length:', jobs.length);
const cats = {};
jobs.forEach(j => { cats[j.job_category] = (cats[j.job_category] || 0) + 1; });
const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
sorted.forEach(([k, v]) => console.log(`  ${k}: ${v}`));
