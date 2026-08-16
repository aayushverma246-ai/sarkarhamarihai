'use strict';

/**
 * scraper.js — Real-Time AI-Powered Government Exam Scraper
 * 
 * Fetches official government links, extracts core contents, 
 * and parses dates, payscales, and selection procedures using Gemini AI.
 * Includes a robust search fallback for blocked/offline sites.
 */

const axios = require('axios');
const { generateContentDynamic } = require('./gemini');

// Simulated browser headers to prevent Cloudflare/IPS blocking
const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
};

const sleep = ms => new Promise(res => setTimeout(res, ms));

/**
 * Extract clean visible text from HTML source by stripping scripts, styles, and tags
 */
function extractCleanText(html) {
    if (!html) return '';
    // Remove script and style chunks
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
    // Replace HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, ' ');
    // Convert basic block elements to spaces/newlines
    text = text.replace(/<\/p>|<\/div>|<br\s*\/?>/gi, '\n');
    // Strip remaining tags
    text = text.replace(/<[^>]+>/g, ' ');
    // Normalize whitespaces
    text = text.replace(/\s+/g, ' ');
    return text.trim();
}

/**
 * Scrapes a single exam's official landing page and returns structured parsed fields.
 * If the live fetch fails, it automatically enters AI Knowledge/Search retrieval mode.
 */
async function scrapeExamData(jobName, organization, officialLink) {
    const result = {
        scraped_successfully: false,
        mode: 'direct_scrape',
        application_start_date: null,
        application_end_date: null,
        salary_min: null,
        salary_max: null,
        minimum_age: null,
        maximum_age: null,
        vacancies: null,
        qualification_required: null,
        job_category: null,
        state: null,
        selection_process: null,
        official_website_link: null,
        official_application_link: officialLink || null,
        error: null,
        logs: []
    };

    result.logs.push(`[Scraper] Initializing crawl for: ${jobName} (${organization})`);

    let pageText = '';

    if (officialLink && officialLink.startsWith('http')) {
        result.logs.push(`[Scraper] Attempting connection to: ${officialLink}`);
        try {
            const response = await axios.get(officialLink, {
                headers: DEFAULT_HEADERS,
                timeout: 10000,
                validateStatus: false // Allow checking non-200 responses
            });

            if (response.status === 200) {
                result.logs.push(`[Scraper] Connection successful. Status 200. Capturing HTML source...`);
                const cleanText = extractCleanText(response.data);
                pageText = cleanText.substring(0, 5000); // Send robust first 5k characters to keep cost/time low
                result.logs.push(`[Scraper] Successfully extracted ${pageText.length} characters of visible page content.`);
            } else {
                throw new Error(`HTTP status code returned: ${response.status}`);
            }
        } catch (err) {
            result.logs.push(`[Scraper] Direct HTTP request failed: ${err.message}`);
            result.logs.push(`[Scraper] Switching to AI augmented crawler fallback.`);
            result.mode = 'ai_augmented';
        }
    } else {
        result.logs.push(`[Scraper] Invalid or missing URL. Defaulting to AI augmented crawler mode.`);
        result.mode = 'ai_augmented';
    }

    // Define prompt for structured JSON extraction
    let prompt = '';
    const targetStructureDesc = `
TARGET STRUCTURE (STRICT JSON ONLY):
{
  "application_start_date": "YYYY-MM-DD (or null if not found)",
  "application_end_date": "YYYY-MM-DD (or null if not found)",
  "salary_min": number (monthly basic salary, or null if not explicitly found),
  "salary_max": number (monthly maximum salary, or null if not explicitly found),
  "minimum_age": number (or null if not found),
  "maximum_age": number (or null if not found),
  "vacancies": number (total vacancies, or null if not found),
  "qualification_required": "Class 8 / Class 10 / Class 12 / Graduate / Postgraduate / PhD / Diploma (choose the closest matching one, or null)",
  "job_category": "Banking / UPSC / SSC / Railways / Defence / Police / State Government / Central Government / Healthcare / Teaching / PSU / Engineering / Insurance / Judiciary / Research & Science / Agriculture / Cooperative / Forest & Environment / Shipping & Ports / Telecom / Entrance Exam (choose the closest matching one)",
  "state": "Name of Indian state if this is state-level, or 'All India' if central/national (or null)",
  "selection_process": "Clear bullet points explaining recruitment stages (or null)",
  "official_website_link": "Main website URL of the organization",
  "official_application_link": "Direct application / registration URL"
}`;

    if (result.mode === 'direct_scrape' && pageText.length > 50) {
        prompt = `You are an expert Indian Government recruitment verification crawler.
Parse the following extracted text from the official landing page of ${jobName} by ${organization}.

EXTRACTED TEXT:
"""
${pageText}
"""
${targetStructureDesc}

RULES:
- Be 100% accurate based ONLY on the provided text.
- If application dates are not explicitly present in the provided text, you MUST return null. Do NOT estimate, guess, or assume dates.
- If dates are not in YYYY-MM-DD, convert them to standard ISO format.
- For payscales, ONLY extract monthly salary if explicitly mentioned in the text (e.g. ₹56,100 to ₹1,77,500). Extract minimum monthly basic pay as salary_min and maximum as salary_max. 
- If no payscale/salary range is explicitly defined in the text, extract null or 0 for salary_min and salary_max. Never estimate, guess, or use fallback values.
- If the selection process is not explicitly found in the text, return null or an empty string. Do NOT invent, assume, or generate generic stages or mock templates.
- Return strictly raw JSON. NO formatting tags or characters outside the JSON.`;
    } else {
        // AI augmented fallback matching prompt
        prompt = `You are an expert Indian Government recruitment verification system.
We could not access the official URL directly. Use your deep knowledge base to retrieve the exact official notification details for "${jobName}" recruitment conducted by "${organization}" for the current 2026 academic/fiscal cycle.
${targetStructureDesc}

RULES:
- Provide high-fidelity details matching the active recruitment cycles for this exam post in 2026.
- If the exact 2026 dates are unknown, you MUST return null for both application_start_date and application_end_date. Do NOT estimate, guess, assume, or provide highly logical dates. Any dates returned must be 100% authentic and verified. Under no circumstances should you generate arbitrary dates or generic placeholders.
- For payscales, ONLY extract if the official basic pay range is known for this specific post. If the payscale is not officially defined or not known, set salary_min and salary_max to null. Never guess, assume, or provide mock placeholders.
- If the selection process is not officially known for this exact post, set it to null. Do NOT generate standard templates or placeholders.
- Return strictly raw JSON.`;
    }

    let parsedText = '';

    try {
        result.logs.push(`[Scraper] Querying Vertex AI/NVIDIA content generation...`);
        const response = await generateContentDynamic(prompt, "application/json", 15000);
        parsedText = response.text();
    } catch (err) {
        result.logs.push(`[Scraper] ⚠️ AI extraction failed: ${err.message}`);
        throw err;
    }

    let cleanedText = parsedText;
    try {
        cleanedText = cleanedText.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match, p1) => {
            return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
        });
    } catch (e) {
        cleanedText = parsedText;
    }

    try {
        let parsedJSON;
        try {
            parsedJSON = JSON.parse(cleanedText);
        } catch {
            const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("Could not parse JSON response from LLM output.");
            parsedJSON = JSON.parse(jsonMatch[0]);
        }

        result.application_start_date = parsedJSON.application_start_date || null;
        result.application_end_date = parsedJSON.application_end_date || null;
        result.salary_min = parsedJSON.salary_min ? Number(parsedJSON.salary_min) : null;
        result.salary_max = parsedJSON.salary_max ? Number(parsedJSON.salary_max) : null;
        result.minimum_age = parsedJSON.minimum_age ? Number(parsedJSON.minimum_age) : null;
        result.maximum_age = parsedJSON.maximum_age ? Number(parsedJSON.maximum_age) : null;
        result.vacancies = parsedJSON.vacancies ? Number(parsedJSON.vacancies) : null;
        result.qualification_required = parsedJSON.qualification_required || null;
        result.job_category = parsedJSON.job_category || null;
        result.state = parsedJSON.state || null;

        if (parsedJSON.selection_process && parsedJSON.selection_process.trim().length > 10) {
            result.selection_process = parsedJSON.selection_process;
        }
        result.official_website_link = parsedJSON.official_website_link || null;
        result.official_application_link = parsedJSON.official_application_link || result.official_application_link;
        result.scraped_successfully = true;

        result.logs.push(`[Scraper] Parsing successfully finished!`);
    } catch (err) {
        result.error = err.message;
        result.logs.push(`[Scraper] Extraction mapping failed: ${err.message}`);
    }

    return result;
}

module.exports = {
    scrapeExamData
};
