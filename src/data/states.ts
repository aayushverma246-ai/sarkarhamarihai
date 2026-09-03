/**
 * Canonical Indian States & Union Territories
 * Single source of truth for the frontend.
 * 28 States + 8 Union Territories = 36 entries.
 * No duplicates, no variant spellings.
 */

export const CANONICAL_STATES: string[] = [
  // 28 States (alphabetical)
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  // 8 Union Territories (alphabetical)
  'Andaman & Nicobar Islands',
  'Chandigarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
];

/** Canonical job categories for Indian government exams */
export const CANONICAL_CATEGORIES: string[] = [
  'Agriculture',
  'Banking',
  'Central Government',
  'Cooperative',
  'Defence',
  'Engineering',
  'Entrance Exam',
  'Forest & Environment',
  'Healthcare',
  'Insurance',
  'Judiciary',
  'Police',
  'PSU',
  'Railways',
  'Research & Science',
  'Shipping & Ports',
  'SSC',
  'State Government',
  'State PSCs',
  'Teaching',
  'Telecom',
  'UPSC',
];

/**
 * State normalization map for variant matching.
 * Keys are lowercase variant → canonical string.
 */
export const STATE_NORMALIZATION: Record<string, string> = {
  'andaman and nicobar islands': 'Andaman & Nicobar Islands',
  'andaman & nicobar': 'Andaman & Nicobar Islands',
  'dadra and nagar haveli': 'Dadra & Nagar Haveli and Daman & Diu',
  'daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'dadra and nagar haveli and daman and diu': 'Dadra & Nagar Haveli and Daman & Diu',
  'jammu and kashmir': 'Jammu & Kashmir',
  'j&k': 'Jammu & Kashmir',
  'pondicherry': 'Puducherry',
  'orissa': 'Odisha',
  'uttaranchal': 'Uttarakhand',
};

/** Normalize a state name to canonical form */
export function normalizeStateName(raw: string): string {
  if (!raw) return raw;
  const lower = raw.trim().toLowerCase();
  if (lower === 'all india') return 'All India';
  return STATE_NORMALIZATION[lower] 
    || CANONICAL_STATES.find(s => s.toLowerCase() === lower)
    || raw;
}

// Legacy exports for backward compatibility
export const indianStates = CANONICAL_STATES;
export const indianStatesCanonical = CANONICAL_STATES;
export const indianStatesUnique = [...CANONICAL_STATES].sort((a, b) => a.localeCompare(b));
