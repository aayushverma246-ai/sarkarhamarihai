'use strict';

const assert = require('assert');
const { computeLocalScore } = require('../backend/src/services/gemini_recommender');

console.log('[Test] Running recommender scoring deterministic verification...');

// Mock structured syllabus inputs
const perfectSource = {
  subjects: ['mathematics', 'reasoning', 'english'],
  keywords: ['algebra', 'geometry', 'grammar', 'vocabulary']
};

const perfectCandidate = {
  subjects: ['mathematics', 'reasoning', 'english'],
  keywords: ['algebra', 'geometry', 'grammar', 'vocabulary']
};

const partialCandidate = {
  subjects: ['mathematics'],
  keywords: ['algebra']
};

// 1. Verification: Perfect match WITH semantic score (40% + 20% + 30% + 10% = 100%)
const withSemPerfect = computeLocalScore(perfectSource, perfectCandidate, 1.0, true);
console.log('1. Perfect match WITH semantic score:', withSemPerfect);
assert.strictEqual(withSemPerfect.localScore, 100, 'Perfect match with semantic score should be 100');

// 2. Verification: Perfect match WITHOUT semantic score (60% + 30% + 10% = 100%)
const noSemPerfect = computeLocalScore(perfectSource, perfectCandidate, 0.0, true);
console.log('2. Perfect match WITHOUT semantic score (same category):', noSemPerfect);
assert.strictEqual(noSemPerfect.localScore, 100, 'Perfect match without semantic score must equal exactly 100');

// 3. Verification: Perfect match WITHOUT semantic score (different category) (60% + 30% = 90%)
const noSemDiffCat = computeLocalScore(perfectSource, perfectCandidate, 0.0, false);
console.log('3. Perfect match WITHOUT semantic score (different category):', noSemDiffCat);
assert.strictEqual(noSemDiffCat.localScore, 90, 'Perfect match without semantic in diff category should be 90');

// 4. Verification: Category bonus does not push raw weighting above 100%
const noSemMax = computeLocalScore(perfectSource, perfectCandidate, 0, true);
assert(noSemMax.localScore <= 100, 'Raw score + category bonus must not exceed 100');

// 5. Verification: Partial match WITHOUT semantic score (predictable scaling)
const partialScore = computeLocalScore(perfectSource, partialCandidate, 0.0, false);
console.log('5. Partial match WITHOUT semantic score:', partialScore);
assert(partialScore.localScore >= 0 && partialScore.localScore <= 100, 'Partial score must be bounded between 0 and 100');

console.log('[Test] ALL RECOMENDER SCORING VERIFICATIONS PASSED SUCCESSFULLY!');
