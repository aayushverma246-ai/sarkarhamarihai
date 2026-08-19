import { indianStates } from './data/states';
import { Job } from './types';

// Escape regex special chars in state names to handle them safely
function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function meetsStateCriteria(user: any, job: Job): boolean {
    if (!user || !job) return false;
    const textToSearch = ((job.job_name || '') + ' ' + (job.organization || '')).toLowerCase();
    const userState = (user.state || '').toLowerCase().trim();

    // Detect all Indian states mentioned in the job title/org
    const mentionedStates = indianStates.filter(state => {
        const regex = new RegExp(`(?:^|\\s|,)${escapeRegex(state)}(?:\\s|,|$)`, 'i');
        return regex.test(textToSearch);
    });

    // If no specific state is mentioned, it's a central/all-India job — open to everyone.
    if (mentionedStates.length === 0) return true;

    // If a state IS mentioned (e.g., "Assam PWD"), user MUST be from that state.
    if (userState && mentionedStates.some(state => state.toLowerCase() === userState)) {
        return true;
    }
    return false;
}

export function meetsTechnicalCriteria(user: any, job: Job): boolean {
    if (!job) return false;
    const textToSearch = ((job.job_name || '') + ' ' + (job.organization || '')).toLowerCase();
    const isHighlyTechnical = /(?:junior engineer|assistant engineer|ae\/je|\bae\b|\bje\b|b\.tech|\bbtech\b|m\.tech|\bmtech\b|diploma in|\biti\b|nursing|medical officer|\bmbbs\b)/i.test(textToSearch);
    
    if (!isHighlyTechnical) return true;
    if (!user || !user.qualification_type) return false;
    
    const userQual = user.qualification_type.toLowerCase();
    return userQual.includes('b.tech') || 
           userQual.includes('b.e.') || 
           userQual.includes('m.tech') || 
           userQual.includes('diploma') ||
           userQual.includes('nursing') ||
           userQual.includes('medical') ||
           userQual.includes('iti');
}

export function meetsAge(user: any, job: Job): boolean {
    if (!user || !user.age || user.age === 0) return false;
    if (!job.minimum_age || !job.maximum_age) return true; // Default if job missing limits
    
    const minAge = Number(job.minimum_age);
    let maxAge = Number(job.maximum_age);
    const userAge = Number(user.age);
    
    if (user.category === 'OBC') {
        maxAge += 3;
    } else if (user.category === 'SC' || user.category === 'ST') {
        maxAge += 5;
    }
    
    return userAge >= minAge && userAge <= maxAge;
}

const qualificationOrder: Record<string, number> = { 
    'Class 10': 1, 
    'Class 12': 2, 
    'Diploma': 2.5,
    'Graduation': 3, 
    'Post Graduation': 4, 
    'PhD': 5 
};

export function meetsQualification(user: any, job: Job): boolean {
    if (!user || !user.qualification_type) return false;
    const userLevel = qualificationOrder[user.qualification_type] || 0;
    const jobLevel = qualificationOrder[job.qualification_required] || 0;
    
    if (userLevel === 0) return false;
    if (jobLevel === 0) return true; // Job missing required qualification (assume basic)

    if (user.qualification_status === 'Completed') return userLevel >= jobLevel;
    
    if (user.qualification_status === 'Pursuing') {
        if (userLevel > jobLevel) return true;
        if (userLevel === jobLevel && job.allows_final_year_students) return true;
    }
    return false;
}

export function formatRelativeTime(dateString: string | undefined | null): string {
    if (!dateString) return 'Missing timestamp';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Missing timestamp';
    
    // Fallback to absolute if the date is exactly '2024-04-02', maybe someone hardcoded it in string?
    // Not needed. 

    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 0) return 'Updated just now'; // Future drift fallback
    if (diffInSeconds < 60) return 'Updated just now';
    if (diffInSeconds < 3600) {
        const mins = Math.floor(diffInSeconds / 60);
        return `Updated ${mins} min${mins !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 86400) {
        const hrs = Math.floor(diffInSeconds / 3600);
        return `Updated ${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
    }
    if (diffInSeconds < 172800) {
        return 'Updated yesterday';
    }
    const days = Math.floor(diffInSeconds / 86400);
    return `Updated ${days} day${days !== 1 ? 's' : ''} ago`;
}
