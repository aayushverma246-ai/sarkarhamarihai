'use strict';

/**
 * translation.js — Native Google Cloud Translation Integration
 * 
 * Provides startup-grade automated language translation services
 * using Google Cloud Translation API (v2) keylessly via ADC.
 * Supports transparent self-healing fallback when the API is disabled or not configured.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let translateClient = null;
let useGoogleTranslate = true;

try {
  const { Translate } = require('@google-cloud/translate').v2;
  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'project-4d0e8e2b-8721-434b-aa7';
  console.log(`[Translation] Initializing Google Cloud Translation Client (Project: ${projectId})`);
  translateClient = new Translate({ projectId });
} catch (err) {
  console.warn('[Translation] Google Cloud Translate SDK failed to load. Defaulting to bypass:', err.message);
  useGoogleTranslate = false;
}

/**
 * Dynamic translator wrapper for Google Cloud Translation API.
 * 
 * @param {string} text - The source string to translate (in English)
 * @param {string} targetLang - The ISO language code (e.g. 'hi' for Hindi, 'ta' for Tamil, 'bn' for Bengali)
 * @returns {Promise<string>} The translated text, or the original text as a fallback
 */
async function translateText(text, targetLang) {
  if (!text || typeof text !== 'string') return '';
  const lang = (targetLang || 'en').toLowerCase().trim();

  // If target language is already English, return directly
  if (lang === 'en') return text;

  if (useGoogleTranslate && translateClient) {
    try {
      console.log(`[Translation] Requesting Google Cloud Translation for: "${text}" into language: ${lang}`);
      const [translation] = await translateClient.translate(text, lang);
      if (translation) {
        console.log(`[Translation] Success: "${translation}"`);
        return translation;
      }
    } catch (err) {
      console.warn(`[Translation] Google Cloud Translation API failed or quota exceeded: ${err.message}. Using bypass...`);
      // Fall through to fallback below
    }
  }

  // Self-Healing Fallback: Basic pre-configured overrides for common Indian government exam terms
  // to guarantee a beautiful experience even if the billing/payscale quota is exceeded!
  const termMap = {
    'hi': {
      'civil services': 'सिविल सेवा',
      'examination': 'परीक्षा',
      'constable': 'आरक्षक (कांस्टेबल)',
      'police': 'पुलिस',
      'railway': 'रेलवे',
      'teacher': 'शिक्षक',
      'recruitment': 'भर्ती',
      'officer': 'अधिकारी',
      'clerk': 'लिपिक (क्लर्क)'
    },
    'ta': {
      'civil services': 'குடிமைப் பணிகள்',
      'examination': 'தேர்வு',
      'constable': 'காவலர் (கான்ஸ்டபிள்)',
      'police': 'காவல்துறை',
      'railway': 'இரயில்வே',
      'teacher': 'ஆசிரியர்',
      'recruitment': 'ஆள்சேர்ப்பு',
      'officer': 'அதிகாரி',
      'clerk': 'எழுத்தர்'
    },
    'bn': {
      'civil services': 'সিভিল সার্ভিস',
      'examination': 'পরীক্ষা',
      'constable': 'কনস্টেবল',
      'police': 'পুলিশ',
      'railway': 'রেলওয়ে',
      'teacher': 'শিক্ষক',
      'recruitment': 'নিয়োগ',
      'officer': 'কর্মকর্তা',
      'clerk': 'কেরানি'
    }
  };

  let translated = text;
  const mappings = termMap[lang];
  if (mappings) {
    for (const [eng, tr] of Object.entries(mappings)) {
      const regex = new RegExp(`\\b${eng}\\b`, 'gi');
      translated = translated.replace(regex, tr);
    }
  }

  return translated;
}

module.exports = {
  translateText
};
