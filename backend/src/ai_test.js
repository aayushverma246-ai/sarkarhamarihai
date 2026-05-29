const { getDb, initDb } = require('./db');

const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
    'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
    'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
    'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli',
    'Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

function escapeRegex(str) { return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function meetsStateCriteria(user, job) {
    if (!user) return true;
    const textToSearch = (job.job_name + ' ' + (job.organization || ''));
    const userState = (user.state || '').toLowerCase();
    const mentionedStates = indianStates.filter(s => new RegExp(`(?:^|\\s|,)${escapeRegex(s)}(?:\\s|,|$)`, 'i').test(textToSearch));
    if (mentionedStates.length === 0 || !userState) return true;
    return mentionedStates.some(s => s.toLowerCase() === userState);
}


function isStrictlyEligible(user, job) {
    if (!user) return true; // Cannot eliminate if no profile

    // 1. Age Validation
    const userAge = parseInt(user.age, 10);
    if (userAge > 0 && job.minimum_age != null && job.maximum_age != null) {
        if (userAge < job.minimum_age || userAge > job.maximum_age) {
            return false; // Age criteria not satisfied
        }
    }

    // 2. Qualification Validation
    const qualOrder = ['Class 10', 'Class 12', 'Diploma', 'Graduation', 'Post Graduation', 'PhD'];
    const uq = qualOrder.indexOf(user.qualification_type || '');
    let jq = qualOrder.indexOf(job.qualification_required || '');

    // Handle edge case where backend stores Graduation but array didn't match perfectly
    if (jq === -1 && job.qualification_required) {
        if (job.qualification_required.toLowerCase().includes('grad')) jq = 3;
        else if (job.qualification_required.toLowerCase().includes('12')) jq = 1;
        else if (job.qualification_required.toLowerCase().includes('10')) jq = 0;
    }

    if (uq >= 0 && jq >= 0) {
        if (uq < jq) return false; // User qualification is lower than required -> Strictly remove
    } else if (user.qualification_type && job.qualification_required) {
        if (uq === -1 && jq > 0) return false; // If user has unknown qual and job requires something high, assume ineligible to be strict
    }

    return true; // All required conditions met
}

// ── LAYER 1: EXAM TYPE CLASSIFICATION ──
function getExamType(job) {
    const text = ((job.job_name || '') + ' ' + (job.job_category || '')).toLowerCase();

    if (/(neet|aiims|medical|mbbs|nursing|doctor|pharmacist|health)/.test(text)) {
        return 'Medical';
    }
    if (/(jee|gate|engineering|b\.tech|m\.tech|civil|mechanical|electrical|technical)/.test(text)) {
        return 'Technical / Engineering';
    }
    if (/(bank|finance|ibps|sbi|po|clerk|rbi)/.test(text)) {
        return 'Banking / Finance';
    }
    if (/(defence|nda|cds|afcat|army|navy|air force|capf)/.test(text)) {
        // According to strict user rules, CAPF belongs to General Studies
        if (text.includes('capf')) return 'General Studies / Administrative';
        return 'Defence';
    }

    // Default for UPSC, State PSC, SSC, etc.
    return 'General Studies / Administrative';
}

function isTypeCompatible(sourceType, targetType) {
    if (sourceType === targetType) return true;

    // STRICTLY BLOCK Completely unrelated domains based on the Prompt Directives
    // "General Studies <-> Medical" MUST BE BLOCKED
    const strictBlocks = [
        ['General Studies / Administrative', 'Medical'],
        ['Medical', 'General Studies / Administrative'],
        ['Technical / Engineering', 'Medical'],
        ['Medical', 'Technical / Engineering'],
        ['General Studies / Administrative', 'Technical / Engineering'],
        ['Technical / Engineering', 'General Studies / Administrative']
    ];

    for (const [st, tt] of strictBlocks) {
        if (sourceType === st && targetType === tt) return false;
    }

    return true;
}

function getSubjects(job) {
    try {
        if (job.structured_syllabus_json) {
            const parsed = JSON.parse(job.structured_syllabus_json);
            if (parsed.subjects && Array.isArray(parsed.subjects)) {
                return parsed.subjects.map(s => s.name.toLowerCase().trim());
            }
        }
    } catch (e) { }

    const text = (job.syllabus || job.job_name).toLowerCase();
    const commonSubjects = ['physics', 'chemistry', 'mathematics', 'polity', 'history', 'geography', 'economy', 'environment', 'current affairs', 'biology', 'reasoning', 'aptitude', 'english', 'general awareness', 'quantitative', 'technical', 'clinical'];
    const found = commonSubjects.filter(s => text.includes(s));
    return found.length > 0 ? found : ['general']; // fallback to allow same-type matches if empty
}

function calculateDomainOverlap(sourceJob, targetJob) {
    const sourceSubjects = getSubjects(sourceJob);
    const targetSubjects = getSubjects(targetJob);

    if (sourceSubjects.length === 1 && sourceSubjects[0] === 'general' && targetSubjects.length === 1 && targetSubjects[0] === 'general') {
        return 1.0;
    }

    let matches = 0;
    for (const ts of targetSubjects) {
        if (sourceSubjects.some(ss => ss.includes(ts) || ts.includes(ss))) {
            matches++;
        }
    }

    return targetSubjects.length === 0 ? 0 : (matches / targetSubjects.length);
}

function failsHardBlockList(sourceJob, targetJob) {
    const srcName = ((sourceJob.job_name || '') + ' ' + (sourceJob.organization || '')).toUpperCase();
    const tgtName = ((targetJob.job_name || '') + ' ' + (targetJob.organization || '')).toUpperCase();

    const gsKeywords = ['UPSC', 'SSC', 'PSC', 'CAPF', 'CIVIL SERVICES', 'ADMINISTRATIVE'];
    const techKeywords = ['JEE', 'NEET', 'GATE', 'BITSAT', 'B.TECH', 'M.TECH', 'MBBS', 'AIIMS'];

    const isSourceGS = gsKeywords.some(k => srcName.includes(k));
    const isTargetTech = techKeywords.some(k => tgtName.includes(k));
    if (isSourceGS && isTargetTech) return true;

    const isSourceTech = techKeywords.some(k => srcName.includes(k));
    const isTargetGS = gsKeywords.some(k => tgtName.includes(k));
    if (isSourceTech && isTargetGS) return true;

    return false;
}

async function testFilter() {
    await initDb();
    const db = getDb();
    const allJobs = (await db.execute('SELECT * FROM jobs')).rows;

    const sourceJob = allJobs.find(j => j.job_name && (j.job_name.includes('UPSC') || j.job_name.includes('Goa') || j.job_name.includes('Tamil'))) || allJobs[0];
    const user = { id: 1, age: 25, qualification_type: 'Graduation', category: 'General', state: '' };

    let stats = {
        total: allJobs.length,
        statePassed: 0,
        eligiblePassed: 0,
        typePassed: 0,
        blockPassed: 0,
        domainPassed: 0
    };

    const sourceType = getExamType(sourceJob);

    for (const j of allJobs) {
        if (j.id === sourceJob.id) continue;

        if (!meetsStateCriteria(user, j)) continue;
        stats.statePassed++;

        if (!isStrictlyEligible(user, j)) continue;
        stats.eligiblePassed++;

        if (!isTypeCompatible(sourceType, getExamType(j))) continue;
        stats.typePassed++;

        if (failsHardBlockList(sourceJob, j)) continue;
        stats.blockPassed++;

        if (calculateDomainOverlap(sourceJob, j) < 0.5) continue;
        stats.domainPassed++;
    }

    console.log(stats);
}

testFilter().catch(console.error);
