const express = require('express');
const router = express.Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

function containsPlaceholder(text) {
    if (!text) return true;
    const lower = text.toLowerCase();
    const placeholders = [
        'placeholder', 'dummy', 'lorem', 'lorem ipsum', 'mock', 'test-exam',
        'sample exam', 'tba', 'tbd', 'to be announced', 'to be decided', 'n/a', 'na', 'null'
    ];
    return placeholders.some(p => lower.includes(p));
}

const categoryConfig = {
    'UPSC': {
        subjects: ['Indian Polity & Constitution', 'History of India & National Movement', 'Geography (World & India)', 'Economy & Social Development', 'General Science & Environment', 'Current Affairs & CSAT'],
        resources: [
            { type: "Book", name: "M. Laxmikanth - Indian Polity", purpose: "Polity & Constitution" },
            { type: "Book", name: "Spectrum - Modern India (Rajiv Ahir)", purpose: "History of India & National Movement" },
            { type: "Book", name: "Ramesh Singh - Indian Economy", purpose: "Economy" },
            { type: "Platform", name: "InsightsIAS / VisionIAS Mock Series", purpose: "Simulated Testing & PYQs" },
            { type: "Resource", name: "The Hindu Newspaper", purpose: "Current Affairs & Editorial Analysis" }
        ],
        milestones: {
            m1: "Complete basic NCERT textbooks (Class 6-12) & Polity basics",
            m2: "Achieve 65%+ in Sectional GS Mocks & master Modern History",
            m3: "Attempt at least 15 Full-Length UPSC GS & CSAT Mocks",
            m4: "Revise 12 months Current Affairs & do final Mock drill"
        }
    },
    'SSC': {
        subjects: ['Quantitative Aptitude', 'General Intelligence & Reasoning', 'English Comprehension', 'General Awareness'],
        resources: [
            { type: "Book", name: "R.S. Aggarwal - Quantitative Aptitude", purpose: "Quantitative Aptitude" },
            { type: "Book", name: "R.S. Aggarwal - Verbal & Non-Verbal Reasoning", purpose: "General Intelligence & Reasoning" },
            { type: "Book", name: "S.P. Bakshi - Objective General English", purpose: "English Comprehension" },
            { type: "Book", name: "Lucent's General Knowledge", purpose: "General Awareness" },
            { type: "Platform", name: "Testbook Mock Test Series", purpose: "Simulated Testing & Speed Improvement" }
        ],
        milestones: {
            m1: "Master basic Arithmetic concepts & English grammar rules",
            m2: "Score 70%+ in SSC Sectional tests & memorize static GK facts",
            m3: "Complete 20 Full-Length SSC Mocks with 80%+ accuracy",
            m4: "Revise last 6 months current affairs & formula sheets"
        }
    },
    'Banking': {
        subjects: ['Reasoning Ability', 'Quantitative Aptitude / Data Interpretation', 'English Language', 'General & Financial Awareness'],
        resources: [
            { type: "Book", name: "M.K. Pandey - Analytical Reasoning", purpose: "Reasoning Ability" },
            { type: "Book", name: "Fast Track Objective Arithmetic - Rajesh Verma", purpose: "Quantitative Aptitude" },
            { type: "Book", name: "Pratiyogita Darpan / BankersAdda Capsule", purpose: "Banking & Financial Awareness" },
            { type: "Platform", name: "Adda247 / Testbook Mock Test Series", purpose: "Simulated Mock Tests" }
        ],
        milestones: {
            m1: "Understand all basic reasoning puzzle types & arithmetic shortcuts",
            m2: "Solve sectional mock tests under strict timing constraints",
            m3: "Attempt 25 banking mocks & analyze speed bottlenecks",
            m4: "Revise general banking awareness capsules & static financial terms"
        }
    },
    'Railways': {
        subjects: ['Mathematics', 'General Intelligence & Reasoning', 'General Science', 'General Awareness (Current Affairs)'],
        resources: [
            { type: "Book", name: "Fast Track Objective Arithmetic - Rajesh Verma", purpose: "Mathematics" },
            { type: "Book", name: "Verbal & Non-Verbal Reasoning - Kiran Publication", purpose: "General Intelligence & Reasoning" },
            { type: "Book", name: "Lucent's General Science", purpose: "General Science Concepts" },
            { type: "Platform", name: "Testbook Online Mock Test Series", purpose: "Simulated Testing" }
        ],
        milestones: {
            m1: "Learn core general science concepts & fast arithmetic calculation",
            m2: "Achieve consistently 70%+ score in general intelligence practice sets",
            m3: "Complete 15 full-length Railway simulated mocks",
            m4: "Polish current affairs & attempt past 5 years official papers"
        }
    },
    'State PSCs': {
        subjects: ['State History, Culture & Heritage', 'State Geography & Economy', 'Indian Polity & Constitution', 'General Studies & Mental Ability'],
        resources: [
            { type: "Book", name: "M. Laxmikanth - Indian Polity", purpose: "Polity & Constitution" },
            { type: "Book", name: "State Board Textbooks (Class VI to XII)", purpose: "State History, Geography & Culture" },
            { type: "Book", name: "Lucent's General Knowledge", purpose: "General Studies" },
            { type: "Platform", name: "Testbook / State PSC Specific Mock Series", purpose: "Simulated Testing" }
        ],
        milestones: {
            m1: "Acquire basic state history, culture, and geographic concepts",
            m2: "Score 60%+ in sectional mocks covering state administrative policies",
            m3: "Complete 10 state PSC state-specific GK mock modules",
            m4: "Review latest state budget, economic surveys, and welfare schemes"
        }
    },
    'Defence': {
        subjects: ['Mathematics', 'General Knowledge & Current Affairs', 'English Comprehension', 'General Science'],
        resources: [
            { type: "Book", name: "Pathfinder NDA/CDS - Arihant Publications", purpose: "Mathematics & Core Subjects" },
            { type: "Book", name: "S.P. Bakshi - Objective General English", purpose: "English Language" },
            { type: "Book", name: "Lucent's General Science & GK", purpose: "General Knowledge & Science" },
            { type: "Platform", name: "Testbook Defence Mock Series", purpose: "Simulated Testing" }
        ],
        milestones: {
            m1: "Revise core mathematics syllabus & build daily physical conditioning",
            m2: "Achieve 65%+ in CDS/NDA sectional mock questionnaires",
            m3: "Complete 12 full-length simulated defence paper tests",
            m4: "Revise current events & brush up english grammar templates"
        }
    },
    'Police': {
        subjects: ['General Knowledge & Science', 'Reasoning & Mental Ability', 'Numerical Ability', 'Current Affairs & State Laws'],
        resources: [
            { type: "Book", name: "Kiran Publication Police SI/Constable Guide", purpose: "Numerical & Reasoning Ability" },
            { type: "Book", name: "Lucent's General Knowledge", purpose: "General Knowledge & Science" },
            { type: "Platform", name: "Testbook Police Exam Mock Series", purpose: "Simulated Testing" }
        ],
        milestones: {
            m1: "Learn basic logical reasoning & solve general arithmetic formulas",
            m2: "Achieve 70%+ in SI/Constable local mock tests",
            m3: "Complete 15 full SI/Constable mock papers under exam conditions",
            m4: "Review local law guidelines, states GK, and recent current affairs"
        }
    },
    'Judiciary': {
        subjects: ['Constitutional & Administrative Law', 'Code of Civil Procedure & Law of Evidence', 'Code of Criminal Procedure & Indian Penal Code', 'State Local Laws & General Knowledge'],
        resources: [
            { type: "Book", name: "Bare Acts (IPC, CrPC, CPC, Evidence)", purpose: "Statutes and Section-wise mastery" },
            { type: "Book", name: "Constitutional Law of India - Dr. J.N. Pandey", purpose: "Constitution" },
            { type: "Book", name: "Singhal's Law Guide for Judicial Services", purpose: "Objective Law prep" },
            { type: "Platform", name: "LiveLaw / Bar & Bench", purpose: "Landmark Judgments and Legal News" }
        ],
        milestones: {
            m1: "Achieve deep familiarity with IPC, CrPC, and Bare Act structures",
            m2: "Score 65%+ in Law sectional tests & draft model answers",
            m3: "Attempt 10 full length Judicial Services Preliminary Mocks",
            m4: "Revise state local acts, land laws & latest supreme court rulings"
        }
    },
    'Teaching': {
        subjects: ['Child Development & Pedagogy', 'Teaching Methodology & Aptitude', 'Language Comprehension (English/Hindi)', 'Core Subject Content (Maths/Science/Social Study)'],
        resources: [
            { type: "Book", name: "CDP & Pedagogy - Sandeep Kumar", purpose: "Child Development theories" },
            { type: "Book", name: "NCERT Content Books (Class 6th to 10th)", purpose: "Subject knowledge validation" },
            { type: "Platform", name: "Testbook Teaching Mock Series (CTET/TET)", purpose: "Simulated mock testing" }
        ],
        milestones: {
            m1: "Cover child development theories (Piaget, Vygotsky) & pedagogy concepts",
            m2: "Complete subject-matter study from NCERT textbooks up to Class 10",
            m3: "Attempt 15 teaching mock tests with 75%+ accuracy score",
            m4: "Revise previous year questions and practice teaching aptitude scenarios"
        }
    },
    'Healthcare': {
        subjects: ['Anatomy & Physiology', 'Pharmacology & Biochemistry', 'Community Health & Clinical Medicine', 'General Studies & General Intelligence'],
        resources: [
            { type: "Book", name: "Target High - Nursing & Health Guide", purpose: "Core subject study" },
            { type: "Book", name: "NCERT Biology & Science Textbooks", purpose: "Basic sciences" },
            { type: "Platform", name: "Testbook Nursing/Medical Mock Series", purpose: "Simulated exam testing" }
        ],
        milestones: {
            m1: "Master basic anatomy, physiology, and general health guidelines",
            m2: "Review pharmacology classifications & clinical nursing foundations",
            m3: "Complete 10 full length medical mock papers with 70%+ accuracy",
            m4: "Revise core drug categories, health schemes & local medical rules"
        }
    },
    'Engineering': {
        subjects: ['Engineering Mathematics', 'General Aptitude & Reasoning', 'Core Engineering Domain (Civil/Mech/Electrical/CS)', 'Technical English & General Awareness'],
        resources: [
            { type: "Book", name: "Made Easy Handbook of Core Engineering", purpose: "Technical summaries" },
            { type: "Book", name: "GATE/ESE Previous Year Solved Papers", purpose: "Technical numericals" },
            { type: "Platform", name: "Testbook Technical/GATE Mock Series", purpose: "Simulated technical tests" }
        ],
        milestones: {
            m1: "Complete engineering math and revision of core technical concepts",
            m2: "Score 60%+ in technical sectional tests & practice formulas daily",
            m3: "Attempt 10 full length technical/PSU engineering mock tests",
            m4: "Revise formula notebooks, shortcut rules & practice mock speed"
        }
    },
    'Agriculture': {
        subjects: ['Agronomy & Crop Production', 'Soil Science & Soil Fertility', 'Horticulture & Agricultural Economics', 'General Studies & Mental Ability'],
        resources: [
            { type: "Book", name: "Nem Raj Sunda - An Outline of Agriculture", purpose: "Core agricultural concepts" },
            { type: "Book", name: "Arun Katyayan - Fundamentals of Agriculture", purpose: "Detailed subjects" },
            { type: "Platform", name: "Testbook Agriculture Exams Mock Series", purpose: "Simulated tests" }
        ],
        milestones: {
            m1: "Complete agronomy, soil chemistry, and basic seed types",
            m2: "Learn agricultural policies, state cropping patterns & horticultures",
            m3: "Attempt 12 full length agricultural officer mocks with 70%+ score",
            m4: "Revise latest state schemes, crop data, and fertilizer indices"
        }
    },
    'Forest & Environment': {
        subjects: ['Environmental Science & Ecology', 'Forestry & Silviculture', 'General Science & Geography', 'Aptitude & Logical Reasoning'],
        resources: [
            { type: "Book", name: "Shankar IAS - Environmental Studies", purpose: "Ecology & Climate change" },
            { type: "Book", name: "Indian Forestry - Manikandan & Prabhu", purpose: "Forestry concepts" },
            { type: "Platform", name: "Testbook Forest/Ranger Mock Series", purpose: "Simulated mocks" }
        ],
        milestones: {
            m1: "Master biodiversity indices, food webs & forest classifications",
            m2: "Study silviculture principles, wildlife protection laws & ecology policies",
            m3: "Complete 10 forest ranger full-length mock examinations",
            m4: "Revise latest environment treaties, carbon codes, and state forest covers"
        }
    },
    'Research & Science': {
        subjects: ['Core Scientific Domain (Physics/Chemistry/Bio)', 'Research Methodology & Statistics', 'Aptitude & Data Interpretation', 'English Language'],
        resources: [
            { type: "Book", name: "CSIR NET Domain Specific Guides - Pathfinder", purpose: "Scientific topics" },
            { type: "Book", name: "NCERT Biology/Chemistry/Physics (Class XI-XII)", purpose: "Science fundamentals" },
            { type: "Platform", name: "Testbook Scientific Officer Mock Series", purpose: "Practice tests" }
        ],
        milestones: {
            m1: "Clear core scientific principles & laboratory techniques",
            m2: "Study research methodology, statistics & quantitative analysis",
            m3: "Complete 10 scientific officer mock questionnaires under time limits",
            m4: "Revise formula booklets, research publications & data trends"
        }
    },
    'Entrance Exam': {
        subjects: ['Quantitative Aptitude & Numerical Ability', 'Logical & Analytical Reasoning', 'English Language & Comprehension', 'General Awareness & Current Affairs'],
        resources: [
            { type: "Book", name: "R.S. Aggarwal - Quantitative Aptitude", purpose: "Numerical Ability" },
            { type: "Book", name: "R.S. Aggarwal - Verbal & Non-Verbal Reasoning", purpose: "Logical Reasoning" },
            { type: "Book", name: "S.P. Bakshi - Objective General English", purpose: "Language Proficiency" },
            { type: "Platform", name: "Testbook CUET/Entrance Mock Series", purpose: "Simulated practice tests" }
        ],
        milestones: {
            m1: "Master basic arithmetic rules, verbal logic & English grammar guidelines",
            m2: "Score 70%+ in mock entrance tests and domain subjects study",
            m3: "Complete 15 full length mock examinations under time limits",
            m4: "Revise last 6 months current affairs & formula notebooks"
        }
    }
};

function getNormalizedCategory(category, jobName, state) {
    let finalCategory = category || 'SSC';
    const nameLower = (jobName || '').toLowerCase();
    
    // Check specific exam names first
    if (/(bank|sbi|ibps|clerk|po|financial|insurance|lic|gici|cooperative)/i.test(nameLower)) {
        return 'Banking';
    }
    if (/(railway|rrb|ntpc|loco pilot|alp|group d|station master)/i.test(nameLower)) {
        return 'Railways';
    }
    if (/(teacher|teaching|tet|ctet|pedagogy|school|pgt|tgt|prt|kvs|nvs|ugc net|csir net)/i.test(nameLower)) {
        return 'Teaching';
    }
    if (/(police|sub inspector|si|constable|jail warder|home guard)/i.test(nameLower)) {
        return 'Police';
    }
    if (/(defence|nda|cds|army|navy|air force|afcat|capf|bsf|crpf|itbp|cisf|ssb)/i.test(nameLower)) {
        return 'Defence';
    }
    if (/(gate|engineering|junior engineer|je|assistant engineer|ae|civil engineer|mechanical engineer|electrical engineer|telecom)/i.test(nameLower)) {
        return 'Engineering';
    }
    if (/(neet|medical|mbbs|nursing|nurse|pharmacist|health|doctor|clinical|hospital|veterinary)/i.test(nameLower)) {
        return 'Healthcare';
    }
    if (/(judge|magistrate|judiciary|law officer|legal advisor|civil judge|court peon|stenographer)/i.test(nameLower)) {
        return 'Judiciary';
    }
    if (/(agriculture|farming|agrison|horticulture|forestry|forest|ranger|wildlife)/i.test(nameLower)) {
        if (/(forest|ranger|wildlife)/i.test(nameLower)) {
            return 'Forest & Environment';
        }
        return 'Agriculture';
    }
    
    // Fall back to category field mappings
    if (finalCategory === 'State Government') {
        if (state && state !== 'All India') {
            return 'State PSCs';
        }
        return 'SSC';
    }
    if (finalCategory === 'Central Government') {
        return 'SSC';
    }
    if (finalCategory === 'PSU' || finalCategory === 'Shipping & Ports' || finalCategory === 'Telecom') {
        return 'Engineering';
    }
    if (finalCategory === 'Cooperative' || finalCategory === 'Insurance') {
        return 'Banking';
    }
    if (finalCategory === 'Entrance Exam') {
        if (/gate/i.test(nameLower)) return 'Engineering';
        if (/neet/i.test(nameLower)) return 'Healthcare';
        if (/clat/i.test(nameLower)) return 'Judiciary';
        return 'Entrance Exam';
    }
    
    // Explicit direct matches
    if (categoryConfig[finalCategory]) {
        return finalCategory;
    }
    
    return 'SSC';
}

function generateDeterministicRoadmap(user, job) {
    const normCategory = getNormalizedCategory(job.job_category, job.job_name, job.state);
    const config = categoryConfig[normCategory] || categoryConfig['SSC'];
    
    const nameLower = (job.job_name || '').toLowerCase();
    const isPeonOrMTS = /(peon|helper|mts|multitasking|safai|chowkidar|driver|cleaner|attendant|sweeper|gardener)/i.test(nameLower);
    const isClerical = /(clerk|assistant|typist|steno|computer operator|operator|ldc|udc|stenographer|record keeper|accountant)/i.test(nameLower);
    const isConstable = /(constable|guard|sipoy|sepoy|jail warder|home guard)/i.test(nameLower);
    
    let subjects = [...config.subjects];
    let resources = [...config.resources];
    let milestones = {...config.milestones};
    
    if (isPeonOrMTS) {
        subjects = ['General Awareness & GK', 'Elementary Mathematics', 'Basic English / regional language', 'Simple Reasoning'];
        resources = [
            { type: "Book", name: "Lucent's General Knowledge (Simplified)", purpose: "General Awareness" },
            { type: "Book", name: "Class 8th & 10th State Board Mathematics", purpose: "Elementary Mathematics" },
            { type: "Book", name: "Lucent's High School Grammar & Vocabulary", purpose: "Basic Language Skills" },
            { type: "Platform", name: "Testbook MTS/Peon Online Mock Test Series", purpose: "Simulated Practice & Time Management" }
        ];
        milestones = {
            m1: "Complete basic arithmetic calculations and elementary grammar rules",
            m2: "Achieve 75%+ score in simple GK and reasoning sectional quizzes",
            m3: "Attempt 10 full length Peon/MTS mock tests with high accuracy",
            m4: "Revise state facts, basic static GK & attempt previous year questions"
        };
    } else if (isClerical) {
        subjects = ['Quantitative Aptitude', 'Reasoning Ability', 'English / Hindi Language', 'Computer Awareness & General Studies'];
        resources = [
            { type: "Book", name: "Fast Track Objective Arithmetic - Rajesh Verma", purpose: "Quantitative Aptitude" },
            { type: "Book", name: "Kiran Verbal & Non-Verbal Reasoning Guide", purpose: "Reasoning Ability" },
            { type: "Book", name: "S.P. Bakshi - Objective General English", purpose: "English Language" },
            { type: "Book", name: "Arihant Computer Awareness handbook", purpose: "Computer Literacy" },
            { type: "Platform", name: "Testbook Clerical Exam Mock Series", purpose: "Simulated testing" }
        ];
        milestones = {
            m1: "Master basic arithmetic rules, verbal logic & English grammar guidelines",
            m2: "Score 70%+ in sectional computer awareness and clerical aptitude tests",
            m3: "Complete 15 full length Clerical/Assistant mock examinations",
            m4: "Practice typing speed, review computer shortcut keys & final revisions"
        };
    } else if (isConstable) {
        subjects = ['General Knowledge & Science', 'Numerical Ability', 'Reasoning & Mental Aptitude', 'State General Knowledge & General Awareness'];
        resources = [
            { type: "Book", name: "Lucent's General Knowledge", purpose: "General Awareness & Science" },
            { type: "Book", name: "R.S. Aggarwal - Quantitative Aptitude", purpose: "Numerical Ability" },
            { type: "Book", name: "Kiran Police Exams Practice Workbook", purpose: "Reasoning & Practice Sets" },
            { type: "Platform", name: "Testbook Constable Exam Mock Series", purpose: "Simulated test sets" }
        ];
        milestones = {
            m1: "Acquire basic concept clarity in math & start daily physical drill",
            m2: "Consistently score 70%+ in police mental aptitude sectional tests",
            m3: "Attempt 15 full length SI/Constable mock test questionnaires",
            m4: "Revise state budget, police manuals GK & carry out final mock run"
        };
    }
    
    const isSyllabusValid = job.syllabus && job.syllabus.trim().length > 10 && !containsPlaceholder(job.syllabus);
    if (isSyllabusValid) {
        const parsedSyllabus = job.syllabus.split(/[,\n]/).map(k => k.trim()).filter(k => k.length > 3);
        if (parsedSyllabus.length >= 3) {
            subjects = parsedSyllabus;
        }
    }
    
    const chunkSize = Math.max(1, Math.ceil(subjects.length / 4));
    const p1 = subjects.slice(0, chunkSize);
    const p2 = subjects.slice(chunkSize, chunkSize * 2).length ? subjects.slice(chunkSize, chunkSize * 2) : [subjects[0] + " (Advanced)"];
    const p3 = subjects.slice(chunkSize * 2, chunkSize * 3).length ? subjects.slice(chunkSize * 2, chunkSize * 3) : ["Mock Tests & Revision"];
    const p4 = subjects.slice(chunkSize * 3).length ? subjects.slice(chunkSize * 3) : ["Current Affairs & Final Polish"];
    
    const studyHours = user.study_hours || 4;
    const isQualifying = user.qualification_status === 'Pursuing';
    
    const keyInsight = isQualifying 
        ? `Balancing ${job.job_category || normCategory} preparation with current studies requires strict time management. Dedicate ${studyHours}h/day.`
        : `Full-time prep advantage: Utilize ${studyHours}h/day systematically with 60% focus on ${p1[0] || 'core subjects'}.`;
        
    let readinessScore = 45;
    if (user) {
        readinessScore = 40 + (studyHours * 4);
        if (user.qualification_status === 'Completed') readinessScore += 10;
        
        const qualOrder = ['Class 10', 'Class 12', 'Diploma', 'Graduation', 'Post Graduation', 'PhD'];
        const uq = qualOrder.indexOf(user.qualification_type || '');
        const jq = qualOrder.indexOf(job.qualification_required || '');
        if (uq >= 0 && jq >= 0 && uq > jq) {
            readinessScore += 10;
        }
        if (job.state && job.state !== 'All India' && user.state && job.state.toLowerCase() === user.state.toLowerCase()) {
            readinessScore += 10;
        }
        readinessScore = Math.max(15, Math.min(95, readinessScore));
    }
    
    let daysRemaining = 120;
    if (job.application_end_date) {
        const diff = new Date(job.application_end_date).getTime() - Date.now();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        if (days > 0) {
            daysRemaining = days + 45;
        } else {
            daysRemaining = 30;
        }
    }
    
    let feasibilityStatus = "Achievable";
    if (readinessScore >= 75) feasibilityStatus = "Highly Feasible";
    else if (readinessScore >= 55) feasibilityStatus = "Achievable";
    else if (readinessScore >= 35) feasibilityStatus = "Challenging";
    else feasibilityStatus = "Risky (Needs Intensive Prep)";
    
    return {
        overview: {
            exam_name: job.job_name,
            readiness_score: readinessScore,
            feasibility_status: feasibilityStatus,
            recommended_daily_hours: studyHours,
            days_remaining: daysRemaining,
            key_insight: keyInsight,
            is_ready: true
        },
        syllabus_breakdown: [
            { subject: p1[0] || "Core Fundamentals", topics: p1, weightage: "High (35%)", priority_order: 1 },
            { subject: p2[0] || "Advanced Concepts", topics: p2, weightage: "High (30%)", priority_order: 2 },
            { subject: p3[0] || "Problem Solving", topics: p3, weightage: "Medium (20%)", priority_order: 3 },
            { subject: p4[0] || "Current Affairs", topics: p4, weightage: "Medium (15%)", priority_order: 4 }
        ],
        phase_plan: [
            { phase_name: "Phase 1: Foundation Building", duration: `Day 1 - Day ${Math.round(daysRemaining * 0.3)}`, focus: "Concept clarity without timing pressure", daily_targets: p1.slice(0, 3).map(i => "Master " + i), milestone: milestones.m1 },
            { phase_name: "Phase 2: Core Mastery", duration: `Day ${Math.round(daysRemaining * 0.3) + 1} - Day ${Math.round(daysRemaining * 0.6)}`, focus: "Sectional practice and short notes", daily_targets: p2.slice(0, 3).map(i => "Practice " + i), milestone: milestones.m2 },
            { phase_name: "Phase 3: Speed & Accuracy", duration: `Day ${Math.round(daysRemaining * 0.6) + 1} - Day ${Math.round(daysRemaining * 0.85)}`, focus: "Full length mocks and time limits", daily_targets: p3.slice(0, 3).map(i => "Revise " + i), milestone: milestones.m3 },
            { phase_name: "Phase 4: Final Polish", duration: `Day ${Math.round(daysRemaining * 0.85) + 1} - Day ${daysRemaining}`, focus: "Current affairs and weak areas", daily_targets: ["Daily Current Affairs", "1 Mock Test Daily"], milestone: milestones.m4 }
        ],
        daily_strategy: {
            morning: { duration: `${Math.ceil(studyHours * 0.4)} hours`, activities: [`Fresh mind concept studying: ${p1[0] || "Core Subject"}`, "Note-making and formula sheets"] },
            afternoon: { duration: `${Math.ceil(studyHours * 0.4)} hours`, activities: [`Tackle practice questions on: ${p2[0] || "Advanced Concepts"}`, "Solve 50+ MCQs"] },
            evening: { duration: `${Math.ceil(studyHours * 0.2)} hours`, activities: ["Daily current affairs digest", "Error log review & revision"] }
        },
        weekly_strategy: {
            weekdays: `Focus heavily on ${normCategory} static syllabus progression`,
            saturday: "Attempt 1 Full Mock Paper in strict exam conditions",
            sunday: "Consolidated revision of the week + Error book maintenance"
        },
        resources: resources,
        revision_plan: {
            method: "Active Recall + 1/3/7/28 Spaced Repetition",
            cycles: ["Cycle 1: Immediate weekend", "Cycle 2: End of month", "Cycle 3: Pre-exam mega sweep"],
            spaced_repetition: "Create an error log notebook and revise it every Sunday."
        },
        mock_test_strategy: {
            start_after: "Syllabus 50% completion",
            frequency: "1/week (Phase 2) -> 2/week (Phase 3) -> Daily (Phase 4)",
            analysis_method: "Post-test error log: categorize mistakes as Conceptual, Silly, or Unattempted",
            recommended_sources: ["Official Previous Year Papers", "Testbook Mock Series"]
        },
        weak_area_plan: {
            identification_method: "Identify topics scoring <50% in three consecutive mock tests",
            improvement_tactics: ["Re-watch foundational lectures", "Solve 100 dedicated questions on the weak topic"],
            time_allocation: "Allocate first 1 hour of the day exclusively to the weakest topic"
        },
        final_month_strategy: {
            last_30_days: "No new textbooks. Rely entirely on self-made short notes and mocks.",
            last_7_days: "One full-length mock alternate day. Fix sleep cycle to match exam timing.",
            exam_day: "Hydrate, carry admit card, read instructions. Use 3-pass attempt strategy.",
            mental_preparation: "Visualize success. Accept that 100% syllabus completion is a myth."
        },
        warnings: [
            "Do not chase multiple new resources in the last 30 days.",
            "Avoid skipping Mock Test analysis (Analysis > Giving Mocks).",
            "Do not ignore previous year question (PYQ) trends."
        ],
        success_formula: [
            "Consistency beats intensity.",
            "Revision > Reading new material.",
            "Exam temperament is 50% of the game."
        ],
        is_ready: true,
        is_permanent: true,
        tier: 1
    };
}

// GET /api/roadmap/:id/roadmap
router.get('/:id/roadmap', auth, async (req, res) => {
    const db = getDb();
    try {
        const roadmap = (await db.execute({
            sql: 'SELECT * FROM roadmaps WHERE user_id = ? AND job_id = ?',
            args: [req.user.id, req.params.id]
        })).rows[0];
        if (!roadmap) return res.status(404).json({ error: 'No roadmap found' });

        // Roadmaps are stored as JSON strings
        const content = typeof roadmap.roadmap_content === 'string' ? JSON.parse(roadmap.roadmap_content) : roadmap.roadmap_content;
        return res.json({ ...roadmap, roadmap_content: content });
    } catch (e) {
        return res.status(500).json({ error: 'Failed to parse roadmap' });
    }
});

// POST /api/roadmap/:id/roadmap
router.post('/:id/roadmap', auth, async (req, res) => {
    let jobId, userId, db;
    try {
        jobId = req.params.id;
        userId = req.user.id;
        db = getDb();

        const userRow = (await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [userId] })).rows[0] || req.user;
        const jobRow = (await db.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [jobId] })).rows[0];

        if (!jobRow) return res.status(404).json({ error: 'Exam not found' });

        // Rule 1: ONE-SHOT ONLY — no regeneration (unless it is the old generic fallback)
        const existing = await db.execute({
            sql: 'SELECT * FROM roadmaps WHERE user_id = ? AND job_id = ?',
            args: [userId, jobId]
        });

        if (existing.rows && existing.rows.length > 0) {
            const row = existing.rows[0];
            const content = typeof row.roadmap_content === 'string'
                ? JSON.parse(row.roadmap_content)
                : row.roadmap_content;
            
            // Check if this is the old generic fallback (which had readiness_score: 15 and days_remaining: 120)
            if (content && content.overview && content.overview.readiness_score === 15 && content.overview.days_remaining === 120) {
                console.log(`[Roadmap Router] Detected old generic fallback for user ${userId} / job ${jobId}. Allowing upgrade/regeneration.`);
                // Delete existing row so INSERT works cleanly
                await db.execute({
                    sql: 'DELETE FROM roadmaps WHERE id = ?',
                    args: [row.id]
                });
            } else {
                console.log(`[V14 MASTER GUIDE] Blocking regeneration for ${userId} @ ${jobId}`);
                return res.status(200).json({
                    ...row,
                    roadmap_content: content,
                    is_ready: true,
                    is_permanent: true
                });
            }
        }

        // Fetch target exams for personalization (e.g. from user's liked jobs)
        let targets = [];
        try {
            const likedJobsRes = await db.execute({
                sql: 'SELECT j.job_name FROM liked_jobs l JOIN jobs j ON l.job_id = j.id WHERE l.user_id = ?',
                args: [userId]
            });
            targets = (likedJobsRes.rows || []).map(r => r.job_name);
        } catch (err) {
            // Ignore failure fetching targets
        }

        // Generate High-Quality Structured Premium AI Roadmap using Gemini
        const { generatePremiumRoadmapV9, isGeminiHealthy, tripCircuitBreaker } = require('../services/gemini');
        let finalData;
        if (!isGeminiHealthy()) {
            console.warn(`[AI Roadmap] Circuit breaker is active. Bypassing Gemini API and using deterministic fallback immediately.`);
            finalData = generateDeterministicRoadmap(userRow, jobRow);
        } else {
            try {
                finalData = await generatePremiumRoadmapV9(userRow, jobRow, jobRow.syllabus || jobRow.job_name || '', targets);
            } catch (err) {
                console.warn(`[AI Roadmap] Generation failed, falling back to deterministic: ${err.message}`);
                const msg = (err.message || '').toLowerCase();
                if (msg.includes('429') || msg.includes('quota') || msg.includes('rate limit') || msg.includes('resource exhausted')) {
                    tripCircuitBreaker(30000);
                }
                finalData = generateDeterministicRoadmap(userRow, jobRow);
            }
        }

        const responseData = { id: uuidv4(), job_id: jobId, roadmap_content: finalData, is_ready: true, is_permanent: true };

        await db.execute({
            sql: 'INSERT INTO roadmaps (id, user_id, job_id, roadmap_content) VALUES (?, ?, ?, ?)',
            args: [responseData.id, userId, jobId, JSON.stringify(finalData)]
        });

        // Generate a notification for the newly created roadmap
        const notifId = uuidv4();
        await db.execute({
            sql: 'INSERT INTO notifications (id, user_id, job_id, message) VALUES (?, ?, ?, ?)',
            args: [notifId, userId, jobId, `✨ Your AI Master Roadmap for ${jobRow.job_name} is ready!`]
        });

        return res.status(200).json(responseData);
    } catch (e) {
        console.error('Roadmap DB Error:', e);
        return res.status(500).json({ error: 'Failed to generate roadmap' });
    }
});

module.exports = router;
