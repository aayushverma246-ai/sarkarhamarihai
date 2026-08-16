const { getDb, initDb } = require('./db');
const axios = require('axios');

const NV_API_KEY = "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";

// ══════════════════════════════════════════════════════════════════════
// COMPREHENSIVE DOMAIN SYLLABUS MAP — Expert-curated, no API needed
// ══════════════════════════════════════════════════════════════════════
const DOMAIN_SYLLABI = {
    'UPSC': {
        subjects: [
            { name: "Indian Polity & Governance", topics: [
                { name: "Constitution of India", subtopics: ["Preamble", "Fundamental Rights", "Directive Principles", "Amendment Process"] },
                { name: "Parliament & Legislature", subtopics: ["Lok Sabha", "Rajya Sabha", "Legislative Process", "Parliamentary Committees"] },
                { name: "Executive & Judiciary", subtopics: ["President", "Prime Minister", "Supreme Court", "High Courts"] },
                { name: "Federalism", subtopics: ["Centre-State Relations", "Inter-State Relations", "Local Government", "Panchayati Raj"] }
            ]},
            { name: "History", topics: [
                { name: "Ancient India", subtopics: ["Indus Valley", "Vedic Period", "Mauryan Empire", "Gupta Dynasty"] },
                { name: "Medieval India", subtopics: ["Delhi Sultanate", "Mughal Empire", "Bhakti Movement", "Regional Kingdoms"] },
                { name: "Modern India", subtopics: ["British Rule", "Indian National Movement", "Social Reform", "Post-Independence"] }
            ]},
            { name: "Geography", topics: [
                { name: "Physical Geography", subtopics: ["Geomorphology", "Climatology", "Oceanography", "Biogeography"] },
                { name: "Indian Geography", subtopics: ["Physiographic Divisions", "Drainage Systems", "Climate Patterns", "Natural Resources"] },
                { name: "Human Geography", subtopics: ["Population", "Urbanization", "Migration", "Settlement Patterns"] }
            ]},
            { name: "Economics", topics: [
                { name: "Indian Economy", subtopics: ["GDP & Growth", "Fiscal Policy", "Monetary Policy", "Banking System"] },
                { name: "Economic Planning", subtopics: ["Five Year Plans", "NITI Aayog", "Poverty Alleviation", "Employment Schemes"] },
                { name: "International Economics", subtopics: ["WTO", "IMF", "World Bank", "Trade Agreements"] }
            ]},
            { name: "Environment & Ecology", topics: [
                { name: "Biodiversity", subtopics: ["Flora & Fauna", "Endangered Species", "Conservation", "National Parks"] },
                { name: "Climate Change", subtopics: ["Global Warming", "Paris Agreement", "Carbon Emissions", "Renewable Energy"] },
                { name: "Environmental Laws", subtopics: ["EPA", "Forest Conservation Act", "Wildlife Protection Act", "EIA"] }
            ]},
            { name: "Current Affairs", topics: [
                { name: "National Events", subtopics: ["Government Policies", "Schemes", "Awards", "Appointments"] },
                { name: "International Affairs", subtopics: ["Bilateral Relations", "UN Resolutions", "Global Summits", "Geopolitics"] }
            ]},
            { name: "General Science", topics: [
                { name: "Physics Basics", subtopics: ["Mechanics", "Optics", "Electricity", "Modern Physics"] },
                { name: "Chemistry Basics", subtopics: ["Periodic Table", "Chemical Reactions", "Organic Chemistry", "Biochemistry"] },
                { name: "Biology Basics", subtopics: ["Cell Biology", "Genetics", "Human Physiology", "Diseases"] }
            ]},
            { name: "Ethics & Integrity", topics: [
                { name: "Ethics in Governance", subtopics: ["Public Service Values", "Probity", "Accountability", "Transparency"] },
                { name: "Aptitude & Integrity", subtopics: ["Emotional Intelligence", "Moral Thinkers", "Case Studies", "Ethical Dilemmas"] }
            ]}
        ]
    },
    'SSC': {
        subjects: [
            { name: "Quantitative Aptitude", topics: [
                { name: "Number System", subtopics: ["HCF/LCM", "Fractions", "Decimals", "Simplification"] },
                { name: "Arithmetic", subtopics: ["Percentage", "Profit & Loss", "Simple & Compound Interest", "Ratio & Proportion"] },
                { name: "Algebra", subtopics: ["Linear Equations", "Quadratic Equations", "Polynomials", "Inequalities"] },
                { name: "Geometry & Mensuration", subtopics: ["Triangles", "Circles", "Surface Area", "Volume"] },
                { name: "Data Interpretation", subtopics: ["Bar Graphs", "Pie Charts", "Tables", "Line Graphs"] }
            ]},
            { name: "English Language", topics: [
                { name: "Grammar", subtopics: ["Tenses", "Voice", "Narration", "Subject-Verb Agreement"] },
                { name: "Vocabulary", subtopics: ["Synonyms", "Antonyms", "Idioms", "One Word Substitution"] },
                { name: "Comprehension", subtopics: ["Reading Passages", "Cloze Test", "Para Jumbles", "Error Detection"] }
            ]},
            { name: "General Intelligence & Reasoning", topics: [
                { name: "Verbal Reasoning", subtopics: ["Analogy", "Classification", "Series", "Coding-Decoding"] },
                { name: "Non-Verbal Reasoning", subtopics: ["Pattern Completion", "Mirror Image", "Paper Folding", "Embedded Figures"] },
                { name: "Logical Reasoning", subtopics: ["Syllogism", "Blood Relations", "Direction Sense", "Inequalities"] }
            ]},
            { name: "General Awareness", topics: [
                { name: "Static GK", subtopics: ["History", "Geography", "Polity", "Economics"] },
                { name: "Current Affairs", subtopics: ["National Events", "International Events", "Sports", "Awards"] },
                { name: "Science", subtopics: ["Physics Basics", "Chemistry Basics", "Biology Basics", "Technology"] }
            ]}
        ]
    },
    'BANKING': {
        subjects: [
            { name: "Quantitative Aptitude", topics: [
                { name: "Number Series", subtopics: ["Missing Number", "Wrong Number", "Pattern Recognition"] },
                { name: "Data Interpretation", subtopics: ["Tables", "Bar Graphs", "Pie Charts", "Caselet"] },
                { name: "Arithmetic", subtopics: ["Percentage", "Profit & Loss", "SI/CI", "Time & Work"] },
                { name: "Data Sufficiency", subtopics: ["Statement Analysis", "Quantity Comparison"] }
            ]},
            { name: "Reasoning Ability", topics: [
                { name: "Puzzles & Seating", subtopics: ["Linear", "Circular", "Floor-based", "Complex Puzzles"] },
                { name: "Coding-Decoding", subtopics: ["Letter Coding", "Number Coding", "Mixed Coding"] },
                { name: "Syllogism", subtopics: ["Possibility", "Definite Conclusions", "Reverse Syllogism"] },
                { name: "Blood Relations & Direction", subtopics: ["Family Tree", "Coded Relations", "Direction Sense"] }
            ]},
            { name: "English Language", topics: [
                { name: "Reading Comprehension", subtopics: ["Passage Analysis", "Inference", "Vocabulary in Context"] },
                { name: "Grammar", subtopics: ["Error Detection", "Sentence Correction", "Fill in the Blanks"] },
                { name: "Verbal Ability", subtopics: ["Para Jumbles", "Cloze Test", "Sentence Completion"] }
            ]},
            { name: "General/Financial Awareness", topics: [
                { name: "Banking Awareness", subtopics: ["RBI Policies", "NABARD", "SEBI", "Banking Terms"] },
                { name: "Financial Knowledge", subtopics: ["Budget", "Fiscal Policy", "Monetary Policy", "Insurance"] },
                { name: "Current Affairs", subtopics: ["Economy News", "Government Schemes", "International Finance"] }
            ]},
            { name: "Computer Knowledge", topics: [
                { name: "Basics", subtopics: ["Hardware", "Software", "Operating Systems", "Networking"] },
                { name: "MS Office", subtopics: ["Word", "Excel", "PowerPoint", "Internet"] }
            ]}
        ]
    },
    'ENGINEERING': {
        subjects: [
            { name: "Physics", topics: [
                { name: "Mechanics", subtopics: ["Newton's Laws", "Work Energy Theorem", "Rotational Motion", "Gravitation"] },
                { name: "Electrodynamics", subtopics: ["Coulomb's Law", "Electric Field", "Capacitance", "Current Electricity"] },
                { name: "Optics", subtopics: ["Reflection", "Refraction", "Wave Optics", "Modern Physics"] },
                { name: "Thermodynamics", subtopics: ["Laws of Thermodynamics", "Kinetic Theory", "Heat Transfer"] }
            ]},
            { name: "Chemistry", topics: [
                { name: "Physical Chemistry", subtopics: ["Atomic Structure", "Chemical Bonding", "Thermodynamics", "Equilibrium"] },
                { name: "Organic Chemistry", subtopics: ["Hydrocarbons", "Alcohols & Ethers", "Aldehydes & Ketones", "Amines"] },
                { name: "Inorganic Chemistry", subtopics: ["Periodic Table", "Coordination Compounds", "Metallurgy", "p-Block Elements"] }
            ]},
            { name: "Mathematics", topics: [
                { name: "Calculus", subtopics: ["Limits", "Derivatives", "Integrals", "Differential Equations"] },
                { name: "Algebra", subtopics: ["Matrices", "Determinants", "Complex Numbers", "Quadratic Equations"] },
                { name: "Coordinate Geometry", subtopics: ["Straight Lines", "Circles", "Conics", "3D Geometry"] },
                { name: "Trigonometry & Statistics", subtopics: ["Trigonometric Functions", "Probability", "Statistics", "Mathematical Reasoning"] }
            ]}
        ]
    },
    'MEDICAL': {
        subjects: [
            { name: "Physics", topics: [
                { name: "Mechanics", subtopics: ["Newton's Laws", "Work Energy", "Rotational Motion", "Gravitation"] },
                { name: "Electrodynamics", subtopics: ["Electric Field", "Capacitance", "Current", "Magnetism"] },
                { name: "Optics & Modern Physics", subtopics: ["Wave Optics", "Photoelectric Effect", "Atomic Models", "Nuclear Physics"] }
            ]},
            { name: "Chemistry", topics: [
                { name: "Physical Chemistry", subtopics: ["Atomic Structure", "Chemical Equilibrium", "Thermodynamics", "Electrochemistry"] },
                { name: "Organic Chemistry", subtopics: ["GOC", "Hydrocarbons", "Biomolecules", "Polymers"] },
                { name: "Inorganic Chemistry", subtopics: ["Periodic Table", "Chemical Bonding", "Coordination Compounds", "Metallurgy"] }
            ]},
            { name: "Biology", topics: [
                { name: "Botany", subtopics: ["Plant Morphology", "Plant Physiology", "Cell Biology", "Genetics"] },
                { name: "Zoology", subtopics: ["Animal Physiology", "Human Reproduction", "Evolution", "Ecology"] },
                { name: "Clinical Sciences", subtopics: ["Diseases", "Immunology", "Biotechnology", "Microbiology"] }
            ]}
        ]
    },
    'DEFENCE': {
        subjects: [
            { name: "Mathematics", topics: [
                { name: "Algebra", subtopics: ["Sets", "Functions", "Complex Numbers", "Quadratic Equations"] },
                { name: "Calculus", subtopics: ["Limits", "Differentiation", "Integration", "Applications"] },
                { name: "Trigonometry", subtopics: ["Trigonometric Ratios", "Heights & Distances", "Inverse Functions"] },
                { name: "Statistics & Probability", subtopics: ["Mean", "Variance", "Probability", "Distributions"] }
            ]},
            { name: "General Ability", topics: [
                { name: "English", subtopics: ["Grammar", "Vocabulary", "Comprehension", "Usage"] },
                { name: "General Knowledge", subtopics: ["History", "Geography", "Polity", "Current Affairs"] },
                { name: "Physics", subtopics: ["Mechanics", "Heat", "Light", "Electricity"] },
                { name: "Chemistry", subtopics: ["Physical Chemistry", "Organic Chemistry", "Inorganic Chemistry"] }
            ]},
            { name: "General Intelligence", topics: [
                { name: "Reasoning", subtopics: ["Analogy", "Series", "Coding-Decoding", "Spatial Reasoning"] }
            ]}
        ]
    },
    'RAILWAY': {
        subjects: [
            { name: "Mathematics", topics: [
                { name: "Arithmetic", subtopics: ["Number System", "Percentage", "Ratio & Proportion", "Time & Work"] },
                { name: "Algebra & Geometry", subtopics: ["Linear Equations", "Triangles", "Circles", "Mensuration"] }
            ]},
            { name: "General Intelligence & Reasoning", topics: [
                { name: "Reasoning", subtopics: ["Analogy", "Series", "Coding-Decoding", "Syllogism"] },
                { name: "Non-Verbal", subtopics: ["Pattern", "Mirror Image", "Paper Folding", "Embedded Figures"] }
            ]},
            { name: "General Science", topics: [
                { name: "Physics", subtopics: ["Mechanics", "Heat", "Light", "Electricity"] },
                { name: "Chemistry", subtopics: ["Elements", "Compounds", "Chemical Reactions", "Everyday Chemistry"] },
                { name: "Biology", subtopics: ["Human Body", "Diseases", "Nutrition", "Environment"] }
            ]},
            { name: "General Awareness", topics: [
                { name: "Current Affairs", subtopics: ["National Events", "International Events", "Sports", "Awards"] },
                { name: "Static GK", subtopics: ["History", "Geography", "Polity", "Economics"] }
            ]}
        ]
    },
    'POLICE': {
        subjects: [
            { name: "General Knowledge & Awareness", topics: [
                { name: "Indian History", subtopics: ["Ancient", "Medieval", "Modern", "Freedom Movement"] },
                { name: "Geography", subtopics: ["Indian Geography", "World Geography", "Physical Features"] },
                { name: "Polity", subtopics: ["Indian Constitution", "Government Structure", "Law & Order"] },
                { name: "Current Affairs", subtopics: ["National", "International", "Sports", "Science & Technology"] }
            ]},
            { name: "Reasoning & Mental Ability", topics: [
                { name: "Logical Reasoning", subtopics: ["Analogy", "Classification", "Series", "Coding-Decoding"] },
                { name: "Analytical Ability", subtopics: ["Syllogism", "Blood Relations", "Direction", "Puzzles"] }
            ]},
            { name: "Quantitative Aptitude", topics: [
                { name: "Arithmetic", subtopics: ["Number System", "Percentage", "Time & Distance", "Profit & Loss"] }
            ]},
            { name: "English/Hindi Language", topics: [
                { name: "Language Skills", subtopics: ["Grammar", "Vocabulary", "Comprehension", "Error Detection"] }
            ]}
        ]
    },
    'HEALTHCARE': {
        subjects: [
            { name: "Medical Sciences", topics: [
                { name: "Anatomy", subtopics: ["Human Body Systems", "Organ Structure", "Cell Biology"] },
                { name: "Physiology", subtopics: ["Cardiovascular", "Respiratory", "Nervous System", "Endocrine"] },
                { name: "Pharmacology", subtopics: ["Drug Classification", "Pharmacokinetics", "Pharmacodynamics"] },
                { name: "Pathology", subtopics: ["General Pathology", "Systemic Pathology", "Clinical Pathology"] }
            ]},
            { name: "Community Medicine", topics: [
                { name: "Public Health", subtopics: ["Epidemiology", "Biostatistics", "Health Programs", "Nutrition"] },
                { name: "Preventive Medicine", subtopics: ["Vaccination", "Disease Prevention", "Environmental Health"] }
            ]},
            { name: "General Knowledge", topics: [
                { name: "Current Affairs", subtopics: ["Health Policies", "Medical Breakthroughs", "WHO Guidelines"] }
            ]}
        ]
    },
    'JUDICIARY': {
        subjects: [
            { name: "Constitutional Law", topics: [
                { name: "Fundamental Rights", subtopics: ["Article 14-32", "Right to Equality", "Freedom of Speech"] },
                { name: "State Structure", subtopics: ["Legislature", "Executive", "Judiciary", "Federalism"] }
            ]},
            { name: "Criminal Law", topics: [
                { name: "IPC", subtopics: ["General Exceptions", "Offences", "Abetment", "Criminal Conspiracy"] },
                { name: "CrPC", subtopics: ["FIR", "Investigation", "Trial Process", "Bail"] }
            ]},
            { name: "Civil Law", topics: [
                { name: "CPC", subtopics: ["Jurisdiction", "Suits", "Appeals", "Execution"] },
                { name: "Evidence Act", subtopics: ["Relevance", "Admission", "Burden of Proof", "Witnesses"] }
            ]},
            { name: "General Knowledge", topics: [
                { name: "Legal Awareness", subtopics: ["Landmark Judgments", "Legal Reforms", "Current Legal Issues"] }
            ]}
        ]
    },
    'TEACHING': {
        subjects: [
            { name: "Child Development & Pedagogy", topics: [
                { name: "Child Psychology", subtopics: ["Piaget", "Vygotsky", "Kohlberg", "Learning Theories"] },
                { name: "Inclusive Education", subtopics: ["Special Needs", "Gifted Children", "Learning Disabilities"] }
            ]},
            { name: "Language", topics: [
                { name: "English/Hindi", subtopics: ["Grammar", "Comprehension", "Teaching Methods", "Language Acquisition"] }
            ]},
            { name: "Mathematics", topics: [
                { name: "Content Knowledge", subtopics: ["Number System", "Geometry", "Algebra", "Data Handling"] },
                { name: "Pedagogical Issues", subtopics: ["Teaching Methods", "Assessment", "Curriculum Design"] }
            ]},
            { name: "Environmental Studies / Social Science", topics: [
                { name: "EVS", subtopics: ["Family & Friends", "Food & Shelter", "Water", "Nature"] }
            ]}
        ]
    }
};

// Fallback for categories not in the map
const GENERIC_SYLLABUS = {
    subjects: [
        { name: "General Knowledge", topics: [
            { name: "Current Affairs", subtopics: ["National Events", "International Events", "Awards"] },
            { name: "Static GK", subtopics: ["History", "Geography", "Polity", "Science"] }
        ]},
        { name: "Reasoning", topics: [
            { name: "Logical Reasoning", subtopics: ["Analogy", "Classification", "Series", "Coding-Decoding"] }
        ]},
        { name: "Quantitative Aptitude", topics: [
            { name: "Arithmetic", subtopics: ["Number System", "Percentage", "Profit & Loss", "Time & Work"] }
        ]},
        { name: "English Language", topics: [
            { name: "Grammar & Vocabulary", subtopics: ["Tenses", "Synonyms", "Antonyms", "Comprehension"] }
        ]}
    ]
};

function getExamType(text) {
    if (/(neet|aiims|medical|mbbs|nursing|doctor|pharmacist|health)/i.test(text)) return 'MEDICAL';
    if (/(jee|gate|engineering|b\.tech|m\.tech|civil|mechanical|electrical|technical)/i.test(text)) return 'ENGINEERING';
    if (/(bank|finance|ibps|sbi|po|clerk|rbi)/i.test(text)) return 'BANKING';
    if (/(defence|nda|cds|afcat|army|navy|air force|capf)/i.test(text)) {
        if (/capf/i.test(text)) return 'GENERAL_STUDIES';
        return 'DEFENCE';
    }
    return 'GENERAL_STUDIES';
}

function getSyllabusForCategory(cat) {
    const catUpper = (cat || '').toUpperCase();
    for (const [key, val] of Object.entries(DOMAIN_SYLLABI)) {
        if (catUpper.includes(key)) return val;
    }
    // Map common categories
    if (/PSC|STATE|CIVIL/i.test(catUpper)) return DOMAIN_SYLLABI['UPSC'];
    if (/FOREST|AGRICULTURE|ENVIRONMENT/i.test(catUpper)) return DOMAIN_SYLLABI['UPSC'];
    if (/INSURANCE/i.test(catUpper)) return DOMAIN_SYLLABI['BANKING'];
    if (/RESEARCH|SCIENTIFIC/i.test(catUpper)) return DOMAIN_SYLLABI['ENGINEERING'];
    return GENERIC_SYLLABUS;
}

function getArchetype(cat, qual) {
    return (cat + '_' + qual).replace(/\s+/g, '_').toUpperCase();
}

async function getEmbeddings(texts) {
    for (let attempts = 1; attempts <= 5; attempts++) {
        try {
            const resp = await axios.post("https://integrate.api.nvidia.com/v1/embeddings", {
                input: texts,
                model: "nvidia/nv-embedqa-e5-v5",
                input_type: "query",
                encoding_format: "float",
                truncate: "NONE"
            }, {
                headers: {
                    Authorization: 'Bearer ' + NV_API_KEY,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            return resp.data.data;
        } catch (e) {
            console.log('  Embeddings retry ' + attempts + ': ' + e.message);
            await new Promise(r => setTimeout(r, 2000 * attempts));
        }
    }
    return texts.map(() => ({ embedding: [] }));
}

async function main() {
    await initDb();
    const db = getDb();
    console.log("Fetching distinct archetypes needing AI data...");
    
    // Fetch only unique archetypes that need updates
    const archetypes = (await db.execute(`
        SELECT DISTINCT job_category, qualification_required 
        FROM jobs 
        WHERE (structured_syllabus_json IS NULL OR structured_syllabus_json = '')
           OR (embeddings_json IS NULL OR embeddings_json = '')
    `)).rows;

    console.log('Found ' + archetypes.length + ' archetypes to process.');

    if (archetypes.length === 0) {
        console.log("All jobs already populated. Done!");
        process.exit(0);
    }

    let totalUpdated = 0;

    for (let i = 0; i < archetypes.length; i++) {
        const row = archetypes[i];
        const cat = row.job_category || 'General';
        const qual = row.qualification_required || 'Any';
        const archName = getArchetype(cat, qual);

        try {
            console.log('[' + (i + 1) + '/' + archetypes.length + '] Processing: ' + archName + '...');

            const type = getExamType(cat);

            // Get syllabus from local expert map (INSTANT, no API)
            const syllabusTemplate = getSyllabusForCategory(cat);
            const parsed = {
                exam_name: 'Standard ' + cat + ' Exam (' + qual + ')',
                type: type,
                subjects: syllabusTemplate.subjects
            };

            // Build texts for embeddings
            const textsToEmbed = [];
            for (const sub of parsed.subjects) {
                for (const top of sub.topics) {
                    textsToEmbed.push('Subject: ' + sub.name + ' | Topic: ' + top.name + ' | Subtopics: ' + (top.subtopics || []).join(', '));
                }
            }

            // Get embeddings via Embed VL API (fast — vector computation, not LLM)
            const allEmbeds = [];
            for (let k = 0; k < textsToEmbed.length; k += 50) {
                const chunk = textsToEmbed.slice(k, k + 50);
                const embs = await getEmbeddings(chunk);
                allEmbeds.push(...embs);
            }

            const syllabusJson = JSON.stringify(parsed);
            const embeddingJson = JSON.stringify(allEmbeds.map((e, idx) => ({
                text: textsToEmbed[idx],
                vector: e.embedding
            })));

            // BATCH DB WRITE
            const result = await db.execute({
                sql: 'UPDATE jobs SET structured_syllabus_json = ?, embeddings_json = ?, exam_type = ? WHERE job_category = ? AND qualification_required = ?',
                args: [syllabusJson, embeddingJson, type, row.job_category, row.qualification_required]
            });
            
            const affected = result.rowsAffected || 0;
            totalUpdated += affected;

            console.log('  ✅ Updated ' + affected + ' jobs (total: ' + totalUpdated + ')');

            // Tiny cooldown between embed batches
            await new Promise(r => setTimeout(r, 500));

        } catch (err) {
            console.error('  ❌ Failed ' + archName + ': ' + err.message);
        }
    }

    console.log('🎉 Done! Updated ' + totalUpdated + ' jobs total.');
    process.exit(0);
}

main().catch(console.error);
