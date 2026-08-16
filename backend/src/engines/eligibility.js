'use strict';

/**
 * Eligibility Engine
 * Parses raw string qualification and age into structured JSON without physical data.
 */
function parseEligibility(jobName, qualificationStr, minAgeStr, maxAgeStr, categoryStr) {
  const educationLevel = /B\.Tech|Degree|Graduation|B\.A|B\.Sc|B\.Com/i.test(qualificationStr) ? 'Graduation'
    : /Diploma/i.test(qualificationStr) ? 'Diploma'
    : /12th|Intermediate/i.test(qualificationStr) ? '12th Pass'
    : /10th|Matric/i.test(qualificationStr) ? '10th Pass'
    : /Post Grad|Master|M\.Tech|M\.Sc/i.test(qualificationStr) ? 'Post Graduation'
    : 'Not Specified';

  const minAge = parseInt(minAgeStr) || 18;
  const maxAge = parseInt(maxAgeStr) || 30;

  // Government age relaxations
  let relaxations = { OBC: 3, SC: 5, ST: 5, PwD: 10 };
  if (/Defence|Police/i.test(jobName)) {
    // Some defence jobs don't have standard PwD relaxation
    relaxations = { OBC: 3, SC: 5, ST: 5 };
  }

  return {
    education: {
      level: educationLevel,
      raw_text: qualificationStr
    },
    age: {
      base_min: minAge,
      base_max: maxAge,
      relaxations
    },
    nationality: ["Indian", "Nepal", "Bhutan"],
    attempt_limits: /UPSC Civil/i.test(jobName) ? { GEN: 6, OBC: 9, SC_ST: "unlimited" } : "unlimited"
  };
}

module.exports = { parseEligibility };
