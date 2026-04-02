const { normalizeSyllabus } = require('./lyzr');

/**
 * Normalizes syllabus text into a standard structure.
 * Returns the normalized JSON object or a default structure on failure.
 */
async function getNormalizedSyllabus(rawText) {
    if (!rawText || rawText.length < 10) {
        return [{
            subject: "General Studies",
            topics: [
                { topic: "General Knowledge", subtopics: ["Current Affairs"], weightage: 100 }
            ]
        }];
    }

    try {
        const normalized = await normalizeSyllabus(rawText);
        if (Array.isArray(normalized) && normalized.length > 0) {
            return normalized;
        }
    } catch (err) {
        console.error('Normalization service error:', err.message);
    }

    // Fallback: simple parsing if Lyzr fails or returns invalid
    return [{
        subject: "General",
        topics: [
            { topic: "Aptitude", subtopics: [], weightage: 50 },
            { topic: "Reasoning", subtopics: [], weightage: 50 }
        ]
    }];
}

module.exports = { getNormalizedSyllabus };
