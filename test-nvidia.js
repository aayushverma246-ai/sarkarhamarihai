require('dotenv').config({ path: 'd:/build-govguide-ai-app (2)/build-govguide-ai-app (1)/.env' });
const { batchSyllabusMatchNVIDIA } = require('./backend/src/services/nvidia');

async function test() {
    process.env.NVIDIA_NIM_API_KEY = process.env.NVIDIA_API_KEY || process.env.NVIDIA_NIM_API_KEY;
    console.log("Using API Key starting with:", process.env.NVIDIA_NIM_API_KEY ? process.env.NVIDIA_NIM_API_KEY.substring(0, 5) : 'NONE');

    const source = `
Mathematics: Algebra, Geometry, Calculus, Statistics.
Reasoning: Puzzles, Spatial Reasoning, Logical Deduction.
`;

    const targets = [
        {
            id: 'exam1',
            job_name: 'Math Teacher Exam',
            syllabus: 'Algebra, Geometry, Calculus, Basic Arithmetic, Logic Puzzles.'
        },
        {
            id: 'exam2',
            job_name: 'History Clerk',
            syllabus: 'Indian History, World War 2, Geography, Polity.'
        }
    ];

    try {
        console.log("Calling batchSyllabusMatchNVIDIA...");
        const results = await batchSyllabusMatchNVIDIA(source, targets);
        console.log("Validation Results:", JSON.stringify(results, null, 2));
    } catch (err) {
        console.error("Test failed:", err);
    }
}

test();
