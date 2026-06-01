import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Job } from '../types';
import { RefreshCcw, Zap, Heart, CheckCircle, ClipboardList, BookOpen, ExternalLink, Target, AlertTriangle, UserX, Info, Brain, Clock, Shield, ArrowRight, BarChart3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { selectCurrentUser, selectJobsState, selectRecsState } from '../store/selectors';
import { fetchRecommendationsAction } from '../store/actions/recommendationActions';
import { toggleLikeAction, toggleApplyAction } from '../store/actions/jobActions';

/* ─── Types ─── */
interface RJob extends Job {
    similarity?: number;
    detailed_gap_analysis?: any;
    overlapping_topics?: string[];
    missing_topics?: string[];
    overlapping_subjects?: string[];
    missing_subjects?: string[];
    extra_preparation_needed?: string[];
    difficulty_gap?: 'low' | 'medium' | 'high';
    difficulty_comparison?: string;
    study_time_estimate?: string;
    gap_summary?: string;
    explanation?: string;
    location?: string;
    eligibility_score?: number;
    exam_type?: string;
}

interface Props {
    externalSearch?: string;
    externalCategory?: string;
    externalState?: string;
}

/* ── Premium Minimal Fetching Loader ── */
function AIProcessLoader() {
    const [phase, setPhase] = useState(0);
    const phrases = [
        "Analyzing the structure of your applied curricula...",
        "Cross-referencing subject chapters and core domains...",
        "Sifting through target exam syllabi for deep synergy...",
        "Assembling a custom transition roadmap for you..."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase((p) => (p + 1) % phrases.length);
        }, 3200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="relative bg-[#090909] border border-white/[0.03] rounded-3xl p-16 text-center overflow-hidden my-4 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col items-center justify-center min-h-[240px] animate-fadeIn">
            {/* Elegant, calm breathing center indicator */}
            <div className="relative w-16 h-16 mb-6 flex items-center justify-center">
                {/* Outermost slow breathing halo */}
                <div className="absolute inset-0 rounded-full border border-amber-500/10 bg-amber-500/[0.01] animate-[ping_4s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
                {/* Middle soft breathing ring */}
                <div className="absolute w-12 h-12 rounded-full border border-amber-500/20 bg-amber-500/[0.02] animate-[pulse_2.5s_ease-in-out_infinite]" />
                {/* Inner ambient glowing core */}
                <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-500 to-rose-400 opacity-80 shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse" />
            </div>

            <div className="space-y-3 max-w-sm relative z-10">
                <p className="text-[12px] text-amber-500/80 font-serif italic tracking-wide">
                    Syllabus Synergy Scanner
                </p>
                <div className="h-6 flex items-center justify-center overflow-hidden">
                    <p className="text-[11px] text-gray-400 font-sans tracking-wide transition-all duration-1000 ease-in-out" key={phase}>
                        {phrases[phase]}
                    </p>
                </div>
            </div>
            
            {/* Extremely quiet, human organic line */}
            <div className="mt-8 w-24 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        </div>
    );
}

/* ── Overlap Score Ring ── */
function ScoreRing({ score }: { score: number }) {
    const radius = 24;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 85 ? '#10b981' : score >= 75 ? '#f59e0b' : '#ef4444';

    return (
        <div className="relative w-16 h-16 flex-shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" className="light-score-ring-bg" strokeWidth="4" />
                <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="4"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white light-text text-sm font-black leading-none">{score}%</span>
                <span className="text-[6px] font-bold text-gray-500 uppercase mt-0.5">match</span>
            </div>
        </div>
    );
}

/* ── Quick Stats Bar ── */
function QuickStats({ job }: { job: RJob }) {
    const overlapping = job.overlapping_topics || [];
    const missing = job.missing_topics || [];

    return (
        <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center light-badge-emerald">
                <p className="text-emerald-400 text-sm font-black">{overlapping.length}</p>
                <p className="text-[8px] text-emerald-500/70 font-bold uppercase tracking-wider light-text-secondary">Shared</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center light-badge-amber">
                <p className="text-amber-400 text-sm font-black">{missing.length}</p>
                <p className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider light-text-secondary">Gaps</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2 text-center light-badge-blue">
                <p className="text-blue-400 text-[10px] font-black">{job.study_time_estimate || '—'}</p>
                <p className="text-[8px] text-blue-500/70 font-bold uppercase tracking-wider light-text-secondary">Extra Study</p>
            </div>
        </div>
    );
}

/* ── Inline Gap Preview (always visible on card) ── */
function InlineGapPreview({ job }: { job: RJob }) {
    const overlapping = (job.overlapping_topics || []).slice(0, 4);
    const missing = (job.missing_topics || []).slice(0, 3);

    if (overlapping.length === 0 && missing.length === 0) return null;

    return (
        <div className="space-y-2 mb-3 animate-fadeIn">
            {overlapping.length > 0 && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                        {overlapping.map((t, i) => (
                            <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 bg-emerald-950/30 text-emerald-400 border border-emerald-500/15 rounded-md light-badge-emerald">{t}</span>
                        ))}
                    </div>
                </div>
            )}
            {missing.length > 0 && (
                <div className="flex items-start gap-2">
                    <AlertTriangle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                        {missing.map((t, i) => (
                            <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 bg-amber-950/30 text-amber-400 border border-amber-500/15 rounded-md light-badge-amber">{t}</span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ── Recommendation Card ── */
const RecommendationCard = memo(function RecommendationCard({ job, isApplied, isLiked, onToggleApply, onToggleLike, onNavigate, onOpenDetails }: {
    job: RJob; isApplied: boolean; isLiked: boolean;
    onToggleApply: () => void; onToggleLike: () => void; onNavigate: (url: string) => void; onOpenDetails: (job: RJob) => void;
}) {
    const isLive = job.form_status === 'LIVE';
    const isRecentlyClosed = job.form_status === 'RECENTLY_CLOSED';
    const isUpcoming = job.form_status === 'UPCOMING';

    // Calculate countdown terms
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let daysRemaining = null;
    let daysUntilOpen = null;
    let daysSinceClosed = null;

    if (isLive && job.application_end_date) {
        const end = new Date(job.application_end_date);
        end.setHours(0, 0, 0, 0);
        const diffTime = end.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) daysRemaining = diffDays;
    } else if (isUpcoming && job.application_start_date) {
        const start = new Date(job.application_start_date);
        start.setHours(0, 0, 0, 0);
        const diffTime = start.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) daysUntilOpen = diffDays;
    } else if (isRecentlyClosed && job.application_end_date) {
        const end = new Date(job.application_end_date);
        end.setHours(0, 0, 0, 0);
        const diffTime = today.getTime() - end.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0) daysSinceClosed = diffDays;
    }

    const diffLabels: Record<string, { text: string; color: string; icon: string }> = {
        low: { text: 'Easy Transition', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', icon: '✅' },
        medium: { text: 'Moderate Gap', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: '⚡' },
        high: { text: 'Significant Gap', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: '🔴' },
    };
    const diff = diffLabels[job.difficulty_gap || 'medium'];

    return (
        <div className="group bg-[#0c0c0c] light-card rounded-2xl border border-white/[0.06] light-border hover:border-red-500/25 transition-all duration-300 overflow-hidden hover:shadow-[0_2px_24px_rgba(239,68,68,0.06)]">
            <div className="p-5 pb-0">
                {/* Header */}
                <div className="flex items-start gap-4 mb-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-2">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${isLive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : isUpcoming ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' : isRecentlyClosed ? 'bg-orange-500/10 text-orange-400 border border-orange-500/15' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                                {isLive ? '● LIVE' : isUpcoming ? '◷ UPCOMING' : isRecentlyClosed ? '○ RECENTLY CLOSED' : '○ CLOSED'}
                            </span>
                            {daysRemaining !== null && (
                                <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/15">
                                    {daysRemaining === 0 ? '⚠️ Closing Today' : daysRemaining === 1 ? '⌛ 1 Day Left' : `⌛ ${daysRemaining} Days Left`}
                                </span>
                            )}
                            {daysUntilOpen !== null && (
                                <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-400 border border-amber-500/15">
                                    {`⏳ Opens in ${daysUntilOpen}d`}
                                </span>
                            )}
                            {daysSinceClosed !== null && (
                                <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest bg-red-500/10 text-red-400 border border-red-500/15">
                                    {`Closed ${daysSinceClosed}d ago`}
                                </span>
                            )}
                            <span className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-md border ${diff.color}`}>
                                {diff.icon} {diff.text}
                            </span>
                        </div>
                        <h3 className="text-base font-bold text-white light-text leading-snug mb-1 group-hover:text-red-500 transition-colors duration-300 pr-2">{job.job_name}</h3>
                        <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{job.organization}</p>
                    </div>
                    <ScoreRing score={job.similarity || 0} />
                </div>

                {/* Syllabus Match Insights */}
                <div className="bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 mb-3 text-[11px] light-bg-subtle">
                    <div className="flex items-center gap-1.5 mb-1.5 text-gray-400 font-semibold uppercase tracking-wider text-[8px] light-text-secondary">
                        <Target size={10} className="text-red-400" />
                        <span>Syllabus Transition Insight</span>
                        {job.detailed_gap_analysis?.gemini_powered && (
                            <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded ml-auto border border-emerald-500/10 light-badge-emerald">VERIFIED MATCH</span>
                        )}
                    </div>
                    <p className="text-gray-400 leading-relaxed italic light-text">"{job.explanation}"</p>
                </div>

                {/* Quick Stats */}
                <QuickStats job={job} />

                {/* Inline Gap Preview */}
                <InlineGapPreview job={job} />
            </div>

            {/* Action buttons */}
            <div className="px-5 pb-4 flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-150 active:scale-90 hover:scale-105 light-border ${isLiked ? 'bg-red-600 border-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.2)]' : 'bg-transparent border-white/10 text-gray-600 hover:text-red-400 hover:border-red-500/30'}`}
                    title={isLiked ? "Saved to Targets" : "Track Exam"}>
                    <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onToggleApply(); }}
                    className={`h-9 px-3 rounded-xl flex items-center gap-1.5 border transition-all duration-150 active:scale-90 hover:scale-105 text-[9px] font-bold uppercase tracking-wider light-border ${isApplied ? 'bg-emerald-600 border-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'bg-transparent border-white/10 text-gray-600 hover:text-emerald-400 hover:border-emerald-500/30'}`}>
                    {isApplied ? <CheckCircle size={12} /> : <ClipboardList size={12} />}
                    {isApplied ? 'Applied' : 'Mark Applied'}
                </button>
            </div>

            {/* Bottom action bar */}
            <div className="px-5 pb-5 grid grid-cols-3 gap-2">
                <button onClick={() => onNavigate(`/jobs/${job.id}`)} className="flex items-center justify-center gap-1.5 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-[9px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] light-bg-subtle light-text light-border transition-all duration-200">
                    <BookOpen size={13} /> Explore
                </button>
                <button onClick={() => window.open(job.official_application_link || job.official_website_link || 'https://india.gov.in', '_blank')}
                    className="flex items-center justify-center gap-1.5 py-3 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 transition-all duration-200 shadow-md shadow-green-900/20">
                    <ExternalLink size={12} /> Apply
                </button>
                <button onClick={() => onOpenDetails(job)}
                    className="flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 text-blue-400 text-[9px] font-bold uppercase tracking-wider rounded-xl border border-blue-500/20 light-badge-blue transition-all duration-200">
                    <BarChart3 size={13} /> Analysis
                </button>
            </div>
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN WIDGET — ZERO FAILURE, ZERO ERROR UI
   ═══════════════════════════════════════════════════════════════ */
export default function RecommendationsWidget({ externalSearch = '', externalCategory = 'All', externalState = 'All India' }: Props) {
    const dispatch = useAppDispatch();

    // Select from Redux store
    const userProfile = useAppSelector(selectCurrentUser);
    const { appliedJobs, likedJobs } = useAppSelector(selectJobsState);
    const {
        recs,
        loading: showSkeleton,
        loadingMore,
        refreshing,
        page,
        hasMore
    } = useAppSelector(selectRecsState);

    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [stateFilter, setStateFilter] = useState('All India');
    const [selectedJob, setSelectedJob] = useState<RJob | null>(null);
    const [showExplanation, setShowExplanation] = useState(false);

    const navigate = useNavigate();
    const isMounted = useRef(true);
    const searchRef = useRef(search);
    const categoryRef = useRef(category);
    const stateRef = useRef(stateFilter);

    useEffect(() => {
        searchRef.current = search;
        categoryRef.current = category;
        stateRef.current = stateFilter;
    }, [search, category, stateFilter]);

    // Lock background scroll when Detailed Analysis modal is open to prevent scroll leaks and WebView composition blur glitches
    useEffect(() => {
        if (selectedJob) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedJob]);

    useEffect(() => {
        try {
            const s = JSON.parse(sessionStorage.getItem('recs_nav_state') || '{}');
            if (s.search) setSearch(s.search);
            if (s.category) setCategory(s.category);
            if (s.state) setStateFilter(s.state);
        } catch { }
    }, []);
    useEffect(() => () => { isMounted.current = false; }, []);

    // Only use applied exams as candidates for matching
    const combinedExams = useMemo(() => {
        return appliedJobs || [];
    }, [appliedJobs]);

    /* ── CORE LOADER ── */
    const loadData = useCallback(async (pageNum = 1) => {
        if (combinedExams.length === 0) return;
        try {
            await dispatch(fetchRecommendationsAction(
                combinedExams,
                pageNum,
                searchRef.current,
                categoryRef.current,
                stateRef.current === 'All India' ? '' : stateRef.current
            ));
        } catch (err) {
            console.error('[RecommendationsWidget load failed]', err);
        }
    }, [combinedExams, dispatch]);

    const handleToggleApply = useCallback((job: Job) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        const isApplied = appliedJobs.some(j => j.id === job.id);
        dispatch(toggleApplyAction(job, isApplied));
    }, [dispatch, appliedJobs]);

    const handleToggleLike = useCallback((job: Job) => {
        if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
        const isLiked = likedJobs.some(j => j.id === job.id);
        dispatch(toggleLikeAction(job, isLiked));
    }, [dispatch, likedJobs]);

    useEffect(() => { setSearch(externalSearch); }, [externalSearch]);
    useEffect(() => { setCategory(externalCategory); }, [externalCategory]);
    useEffect(() => { setStateFilter(externalState); }, [externalState]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (combinedExams.length > 0) {
                loadData(1);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [search, category, stateFilter, combinedExams.length, loadData]);

    const isRestoringScroll = useRef(false);
    useEffect(() => {
        if (recs.length > 0 && !showSkeleton) {
            try {
                const s = JSON.parse(sessionStorage.getItem('recs_nav_state') || '{}');
                if (s.scrollPosition && s.scrollPosition > 0 && !isRestoringScroll.current) {
                    isRestoringScroll.current = true;
                    requestAnimationFrame(() => {
                        window.scrollTo({ top: s.scrollPosition, behavior: 'instant' });
                        requestAnimationFrame(() => {
                            window.scrollTo({ top: s.scrollPosition, behavior: 'instant' });
                            isRestoringScroll.current = false;
                            s.scrollPosition = 0;
                            sessionStorage.setItem('recs_nav_state', JSON.stringify(s));
                        });
                    });
                }
            } catch { }
        }
    }, [recs.length, showSkeleton]);

    const handleNavigation = (url: string) => {
        sessionStorage.setItem('recs_nav_state', JSON.stringify({ search, category, state: stateFilter, page, scrollPosition: window.scrollY }));
        navigate(url);
    };

    const isProfileIncomplete = userProfile && (!userProfile.age || !userProfile.qualification_type || !userProfile.category);

    /* ═══ RENDER ═══ */

    if (appliedJobs.length === 0 && !showSkeleton && recs.length === 0) {
        return (
            <div className="mb-10 bg-[#090909] light-card border border-white/[0.03] light-border rounded-3xl p-12 text-center relative overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.3)] animate-fadeIn">
                {/* Soft glow ambient backdrops */}
                <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-amber-500/5 blur-[80px] pointer-events-none" />
                <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-rose-500/5 blur-[80px] pointer-events-none" />
                
                {/* Custom designer overlapping synergy rings logo */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/5 to-rose-500/10 border border-white/[0.04] flex items-center justify-center mx-auto mb-6 relative z-10 shadow-[0_4px_20px_rgba(245,158,11,0.04)]">
                    <svg className="w-8 h-8 text-amber-500/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                        {/* Overlapping Venn Circles */}
                        <circle cx="9.5" cy="12" r="5" className="opacity-70" />
                        <circle cx="14.5" cy="12" r="5" className="text-rose-400 opacity-70" />
                        {/* Fused center highlight */}
                        <path d="M12 8.5c.8 1 1.2 2.2 1.2 3.5s-.4 2.5-1.2 3.5c-.8-1-1.2-2.2-1.2-3.5s.4-2.5 1.2-3.5z" fill="currentColor" className="text-amber-400/20" />
                    </svg>
                </div>
                
                <div className="flex flex-col items-center justify-center mb-4 relative z-10">
                    <span className="mb-2 px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/5 text-[9px] text-amber-400 font-sans tracking-wider">
                        Syllabus Compatibility
                    </span>
                    <h2 className="text-lg font-bold text-white light-text tracking-tight font-sans">
                        Discover Your Synergy Path
                    </h2>
                </div>
                
                <p className="text-gray-500 max-w-sm mx-auto text-xs relative z-10 leading-relaxed font-sans font-medium">
                    Mark an exam as applied to reveal curriculum alignment. The engine calculates subject overlap to suggest optimal companion exams requiring minimal incremental preparation.
                </p>
                
                <button onClick={() => navigate('/')} 
                    className="mt-6 px-6 py-2 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 text-amber-400 light-text text-[11px] font-sans font-medium rounded-xl border border-amber-500/20 hover:border-amber-500/40 transition-all duration-300 relative z-10 shadow-sm">
                    Browse Active Exams
                </button>
            </div>
        );
    }

    return (
        <div className="mb-10 space-y-5 min-h-[300px] gpu-accelerated page-enter">
            {/* Header */}
            <div className="relative bg-[#090909] light-card border border-white/[0.03] light-border rounded-3xl p-6 overflow-hidden transition-all duration-300 shadow-[0_8px_30px_rgba(0,0,0,0.3)] hover:border-amber-500/10">
                {/* Extremely soft warmth overlay */}
                <div className="absolute -top-20 -left-20 w-40 h-40 rounded-full bg-amber-500/[0.02] blur-[60px] pointer-events-none" />
                
                {refreshing && (
                    <div className="absolute top-0 left-0 w-full h-[1.5px] overflow-hidden z-20">
                        <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-amber-500 to-transparent animate-[slide_1.8s_ease-in-out_infinite]" />
                    </div>
                )}
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                    <div className="flex items-start gap-4">
                        {/* Elegant designer overlapping synergy rings logo */}
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/[0.03] to-rose-500/[0.06] border border-white/[0.04] flex items-center justify-center flex-shrink-0 relative group/icon shadow-sm">
                            <svg className="w-6 h-6 text-amber-500/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                                <circle cx="9.5" cy="12" r="5.2" className="opacity-70" />
                                <circle cx="14.5" cy="12" r="5.2" className="text-rose-400/80 opacity-70" />
                                <path d="M12 8.5c.8 1 1.2 2.2 1.2 3.5s-.4 2.5-1.2 3.5c-.8-1-1.2-2.2-1.2-3.5s.4-2.5 1.2-3.5z" fill="currentColor" className="text-amber-400/10" />
                            </svg>
                        </div>
                        
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base font-bold text-white light-text tracking-tight leading-none">
                                    Syllabus Compatibility
                                </h2>
                                <span className="px-2 py-0.5 rounded-full border border-amber-500/20 bg-amber-500/[0.03] text-[9px] text-amber-400 font-sans tracking-wide">
                                    verified synergy
                                </span>
                            </div>
                            
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <p className="text-xs text-gray-500 font-medium">Core subject modules are compared across available target exams.</p>
                                <button onClick={() => setShowExplanation(!showExplanation)}
                                    className="text-[10px] text-amber-500/70 hover:text-amber-400 font-medium tracking-wide font-sans flex items-center gap-1 transition-all">
                                    <span>{showExplanation ? "Hide details" : "Learn how alignment works"}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-end gap-3 flex-shrink-0 ml-auto sm:ml-0">
                        {/* Premium refresh button */}
                        <button onClick={() => { loadData(1); }}
                            className="w-9 h-9 rounded-xl bg-white/[0.01] hover:bg-amber-500/[0.04] border border-white/[0.04] hover:border-amber-500/20 flex items-center justify-center transition-all duration-300 group/ref light-bg-subtle shadow-sm"
                            title="Refresh recommendations">
                            <RefreshCcw size={13} className={`text-gray-500 group-hover/ref:text-amber-500 group-active/ref:scale-90 transition-all ${refreshing ? 'animate-spin text-amber-500' : ''}`} />
                        </button>
                        
                        {/* Premium human-minimal Counter pill */}
                        <div className="bg-white/[0.01] border border-white/[0.04] rounded-full px-3.5 py-1 text-center hidden sm:block light-bg-subtle shadow-sm relative overflow-hidden">
                            <p className="text-xs font-bold text-gray-400 leading-none font-sans">
                                {recs.length} compatible {recs.length === 1 ? 'exam' : 'exams'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Elegant, clean explanation text and grid */}
                {showExplanation && (
                    <div className="mt-5 pt-4 border-t border-white/[0.03] light-border text-xs text-gray-400 leading-relaxed animate-fadeIn space-y-4 relative z-10">
                        <div className="bg-white/[0.01] rounded-2xl p-4 border border-white/[0.02] light-bg-subtle">
                            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5 font-bold font-sans">How synergy is calculated</p>
                            <p className="text-gray-400 light-text text-[11px] leading-relaxed">
                                Our synergy engine maps curriculum overlap by analyzing specific chapters, weights, and scoring distributions. This shows you exactly how much of a target exam is covered by the preparation you are already putting into your applied exams.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                            <div className="space-y-1 bg-white/[0.01] border border-white/[0.02] p-4.5 rounded-2xl light-bg-subtle">
                                <p className="font-bold text-white light-text font-sans text-xs tracking-wide text-amber-500/90">Concept Harmony</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">Identifies matching chapters so you don't repeat prep for shared subjects.</p>
                            </div>
                            <div className="space-y-1 bg-white/[0.01] border border-white/[0.02] p-4.5 rounded-2xl light-bg-subtle">
                                <p className="font-bold text-white light-text font-sans text-xs tracking-wide text-amber-500/90">Pacing & Study Focus</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">Classifies difficulty gaps (low, medium, high) to set correct preparation expectations.</p>
                            </div>
                            <div className="space-y-1 bg-white/[0.01] border border-white/[0.02] p-4.5 rounded-2xl light-bg-subtle">
                                <p className="font-bold text-white light-text font-sans text-xs tracking-wide text-amber-500/90">Subject Synergy</p>
                                <p className="text-[11px] text-gray-500 leading-relaxed">Isolates specific missing chapters and estimates the additional study time needed.</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Profile warning */}
            {isProfileIncomplete && (
                <div className="bg-amber-950/15 border border-amber-800/20 rounded-xl p-4 flex items-start gap-3">
                    <UserX size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-amber-300">Complete your profile for better results</p>
                        <button onClick={() => navigate('/profile')} className="mt-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">→ Update Profile</button>
                    </div>
                </div>
            )}

            {/* Content */}
            {showSkeleton && recs.length === 0 ? (
                <div className="space-y-4 animate-fadeIn">
                    <AIProcessLoader />
                </div>
            ) : recs.length > 0 ? (
                <div className="space-y-4">
                    {refreshing && <AIProcessLoader />}
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider px-1">
                        {recs.length} exam{recs.length !== 1 ? 's' : ''} with strong syllabus overlap {hasMore && '· more available'}
                    </p>
                    {recs.map(job => (
                        <RecommendationCard key={job.id} job={job}
                            isApplied={appliedJobs.some(j => j.id === job.id)}
                            isLiked={likedJobs.some(j => j.id === job.id)}
                            onToggleApply={() => handleToggleApply(job)}
                            onToggleLike={() => handleToggleLike(job)}
                            onNavigate={handleNavigation}
                            onOpenDetails={setSelectedJob} />
                    ))}
                    {hasMore && (
                        <div className="flex justify-center pt-2 pb-4">
                            <button onClick={() => loadData(page + 1)} disabled={loadingMore}
                                className="px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300 border border-white/[0.06] hover:border-red-500 disabled:opacity-50 light-bg-subtle light-text light-border hover:text-white hover:border-red-600">
                                {loadingMore ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                {loadingMore ? 'Loading...' : 'Load More'}
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-14 bg-[#0c0c0c] light-card border border-white/[0.04] light-border rounded-2xl">
                    <Brain size={32} className="mx-auto text-red-500/15 mb-3" />
                    <h3 className="text-sm font-bold text-gray-400 mb-1.5">No Matches Found</h3>
                    <p className="text-gray-600 text-xs max-w-sm mx-auto">Apply to more exams to unlock syllabus-matched recommendations.</p>
                    <button onClick={() => navigate('/')} className="mt-5 px-5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] light-bg-subtle light-text light-border transition-all">Browse Exams</button>
                </div>
            )}

            {/* ═══ DETAILED ANALYSIS MODAL ═══ */}
            {selectedJob && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 overflow-y-auto" onClick={() => setSelectedJob(null)}>
                    <div className="bg-[#0c0c0c] light-card border border-white/[0.08] light-border rounded-2xl w-full max-w-2xl max-h-[90vh] md:max-h-[85vh] my-auto flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/[0.06] light-border bg-gradient-to-r from-white/[0.02] to-transparent flex-shrink-0">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 pr-4">
                                    <h3 className="text-lg font-bold text-white light-text">{selectedJob.job_name}</h3>
                                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{selectedJob.organization}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-bold text-gray-400 bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 rounded-lg flex items-center gap-1 light-bg-subtle light-border">
                                            <Target size={11} className="text-red-400" /> Syllabus Overlap Compatibility Analysis
                                        </span>
                                        {selectedJob.detailed_gap_analysis?.gemini_powered && (
                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">✓ AI Verified</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ScoreRing score={selectedJob.similarity || 0} />
                                    <button onClick={() => setSelectedJob(null)} className="text-gray-500 hover:text-red-500 transition-colors text-xl">✕</button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-6 custom-scrollbar light-text">
                            {selectedJob.detailed_gap_analysis ? (
                                <>
                                    {/* Source Exams */}
                                    {selectedJob.detailed_gap_analysis.source_exams && (
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 light-bg-subtle">
                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2 light-text-secondary">Compared Against Your Exams</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedJob.detailed_gap_analysis.source_exams.map((name: string, i: number) => (
                                                    <span key={i} className="text-[10px] font-bold text-white bg-red-600/15 border border-red-500/20 px-2.5 py-1 rounded-lg light-badge-red">{name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Explanation */}
                                    <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-xl p-4 light-badge-blue">
                                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Brain size={11} /> AI Verdict</p>
                                        <p className="text-sm text-gray-300 leading-relaxed italic light-text">"{selectedJob.explanation}"</p>
                                        {selectedJob.difficulty_comparison && (
                                            <div className="flex items-center gap-3 mt-3">
                                                <span className="text-[9px] font-bold text-gray-500 uppercase light-text-secondary">Difficulty:</span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${selectedJob.difficulty_comparison === 'easier' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15 light-badge-emerald' :
                                                    selectedJob.difficulty_comparison === 'harder' ? 'text-red-400 bg-red-500/10 border-red-500/15 light-badge-red' :
                                                        'text-amber-400 bg-amber-500/10 border-amber-500/15 light-badge-amber'
                                                    }`}>{selectedJob.difficulty_comparison}</span>
                                                {selectedJob.study_time_estimate && (
                                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 light-text-secondary"><Clock size={10} /> {selectedJob.study_time_estimate}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 1. Subject-Wise Analysis */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2 light-border light-text-secondary">
                                            <BarChart3 size={13} className="text-purple-400" /> 1. Subject-Wise Overlap
                                            {selectedJob.detailed_gap_analysis.gemini_powered && (
                                                <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/15 ml-auto light-badge-emerald">AI-Powered</span>
                                            )}
                                            {!selectedJob.detailed_gap_analysis.gemini_powered && (
                                                <span className="text-[7px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10 ml-auto light-bg-subtle">Estimated</span>
                                            )}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(selectedJob.detailed_gap_analysis.subject_wise_analysis || []).map((sub: any, i: number) => (
                                                <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/10 light-bg-subtle">
                                                    <p className="text-sm font-bold text-white mb-2 light-text">{sub.subject}</p>
                                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-1.5 light-bg-card-subtle">
                                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all" style={{ width: `${sub.overlap_percentage}%` }} />
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-gray-400 uppercase font-semibold light-text-secondary">
                                                        <span>Overlap: <span className="text-emerald-400">{sub.overlap_percentage}%</span></span>
                                                        <span>Gap: <span className="text-amber-400">{sub.gap_percentage}%</span></span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!selectedJob.detailed_gap_analysis.subject_wise_analysis || selectedJob.detailed_gap_analysis.subject_wise_analysis.length === 0) && (
                                                <p className="text-xs text-gray-500 italic">Subject-level analysis will improve with more data.</p>
                                            )}
                                        </div>
                                    </section>

                                    {/* 2. Topics */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2 light-border light-text-secondary">
                                            <Target size={13} className="text-blue-400" /> 2. Topic Analysis
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1.5 flex items-center gap-1"><CheckCircle size={10} /> Common Topics ({(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.common_topics || []).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.common_topics || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md light-badge-emerald">{t}</span>)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-amber-500 font-bold uppercase mb-1.5 flex items-center gap-1"><AlertTriangle size={10} /> Missing Topics ({(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.missing_topics || []).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.missing_topics || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md light-badge-amber">{t}</span>)}
                                                </div>
                                            </div>
                                            {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.partial_overlaps || []).length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-blue-500 font-bold uppercase mb-1.5 flex items-center gap-1"><Info size={10} /> Partial Overlaps</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.partial_overlaps || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md light-badge-blue">{t}</span>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* 3. Metrics */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 light-border light-text-secondary">3. Gap Metrics</h4>
                                        <div className="bg-white/5 p-4 rounded-xl flex justify-around flex-wrap gap-4 light-bg-subtle">
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-white light-text">{selectedJob.detailed_gap_analysis.gap_metrics?.total_overlap_percentage || selectedJob.similarity}%</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase light-text-secondary">Total Overlap</p>
                                            </div>
                                            <div className="text-center max-w-[150px]">
                                                <p className="text-sm font-bold text-amber-400 truncate">{(selectedJob.detailed_gap_analysis.gap_metrics?.critical_subject_gaps || []).join(', ') || 'None'}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase light-text-secondary">Critical Gaps</p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 4. Priority */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2 light-border light-text-secondary">
                                            <Shield size={13} className="text-red-400" /> 4. Priority Classification
                                        </h4>
                                        <div className="space-y-2 bg-black/50 p-3 rounded-lg border border-white/5 light-bg-subtle">
                                            <p className="text-xs light-text"><span className="text-red-400 font-bold w-16 inline-block">🔴 High:</span> <span className="text-gray-300 light-text">{(selectedJob.detailed_gap_analysis.priority_classification?.high || []).join(', ') || '—'}</span></p>
                                            <p className="text-xs light-text"><span className="text-amber-400 font-bold w-16 inline-block">🟡 Medium:</span> <span className="text-gray-300 light-text">{(selectedJob.detailed_gap_analysis.priority_classification?.medium || []).join(', ') || '—'}</span></p>
                                            <p className="text-xs light-text"><span className="text-emerald-400 font-bold w-16 inline-block">🟢 Low:</span> <span className="text-gray-300 light-text">{(selectedJob.detailed_gap_analysis.priority_classification?.low || []).join(', ') || '—'}</span></p>
                                        </div>
                                    </section>

                                    {/* 5. Preparation Roadmap */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2 light-border light-text-secondary">
                                            <ArrowRight size={13} className="text-emerald-400" /> 5. Preparation Roadmap
                                        </h4>
                                        <div className="space-y-2">
                                            {(selectedJob.detailed_gap_analysis.preparation_roadmap || []).map((r: any, i: number) => (
                                                <div key={i} className="flex gap-3 text-sm items-start relative pb-2 ml-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 light-badge-blue">
                                                        <span className="text-[9px] font-black text-blue-400">{i + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-gray-300 font-medium light-text">{r.task}</p>
                                                        <p className="text-[10px] text-blue-400/80 font-bold uppercase mt-0.5 flex items-center gap-1"><Clock size={9} /> Est. Effort: {r.effort_estimation}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* 6. Risk Analysis */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 light-border light-text-secondary">6. Risk Analysis</h4>
                                        <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10 light-badge-red">
                                            <p className="text-xs font-bold text-red-400 mb-1">Critical Missing Areas</p>
                                            <p className="text-sm text-gray-300 mb-3 light-text">{(selectedJob.detailed_gap_analysis.risk_analysis?.critical_missing_areas || []).join(', ') || 'None critical'}</p>
                                            <p className="text-xs font-bold text-red-400/80 mb-1">Risk Assessment</p>
                                            <p className="text-sm text-gray-400 leading-relaxed italic light-text">"{selectedJob.detailed_gap_analysis.risk_analysis?.exam_risk_factors || 'Minimal transitional risk.'}"</p>
                                        </div>
                                    </section>
                                </>
                            ) : (
                                <div className="text-center text-gray-500 py-10">
                                    <Brain size={24} className="mx-auto text-blue-500/50 mb-3 opacity-50" />
                                    <p className="text-sm font-semibold">Detailed analysis loading...</p>
                                    <p className="text-xs mt-1">AI Match Engine is analyzing syllabus overlap. Please refresh in a moment.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/[0.06] flex-shrink-0 flex justify-between items-center bg-white/[0.01]">
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleNavigation(`/jobs/${selectedJob.id}`)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5 flex items-center gap-1.5 light-bg-subtle light-text light-border">
                                    <BookOpen size={12} /> Explore Exam
                                </button>
                                <button onClick={() => window.open(selectedJob.official_application_link || selectedJob.official_website_link || '', '_blank')}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5">
                                    <ExternalLink size={12} /> Apply Now
                                </button>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5 light-bg-subtle light-text light-border hover:bg-gray-100">Close</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
