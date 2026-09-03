'use strict';

const { CANONICAL_STATES, normalizeCategory, normalizeState } = require('../constants');

// Compute today's date string once in IST
const getTodayIST = () => {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(today.getTime() + istOffset);
    return istDate.toISOString().split('T')[0];
};

function computeFormStatus(job, todayStr) {
    const start = job.application_start_date;
    const end = job.application_end_date;

    if (!start || !end) return 'CLOSED';
    if (todayStr < start) return 'UPCOMING';
    if (todayStr <= end) return 'LIVE';

    const endParts = end.split('-').map(Number);
    const todayParts = todayStr.split('-').map(Number);
    const endDays = endParts[0] * 365 + endParts[1] * 30 + endParts[2];
    const todayDays = todayParts[0] * 365 + todayParts[1] * 30 + todayParts[2];
    const diffDays = todayDays - endDays;

    if (diffDays <= 30) return 'RECENTLY_CLOSED';
    return 'CLOSED';
}

const _STATE_NAME_PATTERNS = CANONICAL_STATES.map(s => ({
    name: s,
    re: new RegExp('\\b' + s.replace(/[&]/g, '\\&').replace(/\s+/g, '\\s+') + '\\b', 'i')
}));

const _STATE_PSC_ORG_RE = /\b(?:APPSC|APSC|BPSC|CGPSC|DSSSB|GPSC|HPSC|HPPSC|JPSC|KPSC|MPPSC|MPSC|NPSC|OPSC|PPSC|RPSC|SPSC|TNPSC|TSPSC|TPSC|UPPSC|UKPSC|WBPSC|JKPSC)\b/i;
const _STATE_PSC_ORG_LONG_RE = /\bstate\s+public\s+service|public\s+service\s+commission\b/i;
const _STATE_CIVIL_SERVICES_RE = /\bstate\s+civil\s+services?\b|\bstate\s+services?\b/i;

function inferStateFromName(jobName, org) {
    const combined = ((jobName || '') + ' ' + (org || '')).toLowerCase();
    for (const { name, re } of _STATE_NAME_PATTERNS) {
        const lowerName = name.toLowerCase();
        if (combined.includes(lowerName)) {
            if (re.test(combined)) return name;
        }
    }
    return null;
}

function withStatus(job, todayStr) {
    const isVerified = Boolean(job.job_name && job.organization && job.official_application_link?.length > 5);
    const lastUpdated = job.created_at || todayStr;

    let parsedStates = [];
    if (job.states && job.states !== '[]') {
        try {
            parsedStates = JSON.parse(job.states);
        } catch (_) { }
    }

    const name = (job.job_name || '').toLowerCase();
    const org = (job.organization || '');

    let normalizedCategory = job.job_category;
    if (normalizedCategory) {
        const canonical = normalizeCategory(normalizedCategory);
        if (canonical) normalizedCategory = canonical;

        if (normalizedCategory === 'UPSC') {
            const isStatePSCOrg = _STATE_PSC_ORG_RE.test(org) && !/\bUPSC\b|Union Public Service Commission/i.test(org);
            const isStateCivilServices = _STATE_CIVIL_SERVICES_RE.test(name);
            const hasStatePSCOrgLong = _STATE_PSC_ORG_LONG_RE.test(org) && !/\bUnion\b/i.test(org);

            if (isStateCivilServices || (isStatePSCOrg && !name.startsWith('upsc ')) || hasStatePSCOrgLong) {
                normalizedCategory = 'State PSCs';
            }
        }

        if (normalizedCategory === 'State Government' || normalizedCategory === 'State PSCs') {
            if (/\bpsc\b|\bcivil services\b|\bstate services\b/.test(name)) {
                normalizedCategory = 'State PSCs';
            } else if (/\bpolice\b|\bconstable\b|\bsub inspector\b|\b(?:si)\b|\bhead constable\b|\bjail\b|\bprison\b|\bfire\s*(?:service|man)\b|\btraffic police\b|\barmed police\b|\bcyber\s*(?:crime|police)\b|\bhome guard\b|\bexcise\b/.test(name)) {
                normalizedCategory = 'Police';
            } else if (/\btet\b|\bteacher\b|\btgt\b|\bpgt\b|\bprimary teacher\b|\bschool\b|\beducation\b|\blab assistant\b/.test(name)) {
                normalizedCategory = 'Teaching';
            } else if (/\bforest\b|\bvan rakshak\b|\bwildlife\b|\bpollution\b/.test(name)) {
                normalizedCategory = 'Forest & Environment';
            } else if (/\bnhm\b|\bnursing\b|\bstaff nurse\b|\bcho\b|\banm\b|\bgnm\b|\bpharmacist\b|\bmedical officer\b|\bsurgeon\b|\bhospital\b|\bhealth\b/.test(name)) {
                normalizedCategory = 'Healthcare';
            } else if (/\bcourt\b|\bjudge\b|\bjudicial\b|\bsteno.*court\b|\bpeon.*court\b|\bbailiff\b/.test(name)) {
                normalizedCategory = 'Judiciary';
            } else if (/\belectricity\b|\bengineer\b|\bje\b|\bjunior engineer\b|\bwater board\b/.test(name)) {
                normalizedCategory = 'Engineering';
            } else if (/\bcooperative\b|\bbank clerk\b/.test(name)) {
                normalizedCategory = 'Cooperative';
            } else if (/\bagriculture\b|\bhorticulture\b|\bdairy\b|\bfisheries\b|\banimal husbandry\b|\bsericulture\b/.test(name)) {
                normalizedCategory = 'Agriculture';
            } else if (/\btransport\b|\bdriver\b|\bconductor\b|\brto\b|\bmotor vehicle\b|\broadways\b/.test(name)) {
                normalizedCategory = 'State Government';
            }
        }
    }

    let normalizedState = job.state;
    if (normalizedState) {
        const canonical = normalizeState(normalizedState);
        if (canonical) normalizedState = canonical;
    }

    if (normalizedState === 'All India') {
        const inferredFromOrg = inferStateFromName('', org);
        const inferredFromName = inferStateFromName(job.job_name, '');

        if (inferredFromOrg && /state government|psc|state\s/i.test(org)) {
            normalizedState = inferredFromOrg;
        } else if (inferredFromName && normalizedCategory === 'State PSCs') {
            normalizedState = inferredFromName;
        }
    }

    const normalizedStatesArr = parsedStates.map(s => {
        const c = normalizeState(s);
        return c || s;
    });

    return {
        ...job,
        job_category: normalizedCategory || job.job_category,
        state: normalizedState || job.state,
        states: normalizedStatesArr,
        form_status: computeFormStatus(job, todayStr),
        allows_final_year_students: !!job.allows_final_year_students,
        is_verified: isVerified,
        last_updated: lastUpdated
    };
}

const MINIMAL_COLUMNS = [
    'id', 'job_name', 'organization', 'qualification_required',
    'allows_final_year_students', 'minimum_age', 'maximum_age',
    'job_category', 'state', 'states', 'application_start_date',
    'application_end_date', 'vacancies', 'official_application_link',
    'last_verified_at', 'created_at', 'form_status', 'is_verified', 'last_updated'
];

function serializeMinimalJob(job, todayStr) {
    const statusJob = withStatus(job, todayStr);
    return MINIMAL_COLUMNS.map(col => statusJob[col] ?? null);
}

module.exports = {
    getTodayIST,
    computeFormStatus,
    inferStateFromName,
    withStatus,
    MINIMAL_COLUMNS,
    serializeMinimalJob
};
