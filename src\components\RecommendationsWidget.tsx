import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
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

/* ── Skeleton Card ── */
function SkeletonCard() {
    return (
        <div className="bg-[#0c0c0c] light-card rounded-2xl border border-white/[0.06] light-border p-6 animate-pulse">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1 space-y-2.5">
                    <div className="h-5 w-3/5 bg-white/[0.06] light-skeleton rounded-lg" />
                    <div className="h-3 w-2/5 bg-white/[0.04] light-skeleton rounded" />
                </div>
                <div className="w-14 h-14 rounded-full bg-white/[0.06] light-skeleton flex-shrink-0 ml-4" />
            </div>
            <div className="space-y-2 mb-4">
                <div className="h-3 w-full bg-white/[0.04] light-skeleton rounded" />
                <div className="h-3 w-4/5 bg-white/[0.04] light-skeleton rounded" />
            </div>
            <div className="h-10 w-full bg-white/[0.04] light-skeleton rounded-xl mb-3" />
            <div className="grid grid-cols-2 gap-2.5">
                <div className="h-11 bg-white/[0.04] light-skeleton rounded-xl" />
                <div className="h-11 bg-white/[0.06] light-skeleton rounded-xl" />
            </div>
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
                <circle cx="28" cy="28" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <circle cx="28" cy="28" r={radius} fill="none" stroke={color} strokeWidth="4"
                    strokeDasharray={circumference} strokeDashoffset={offset}
                    strokeLinecap="round" className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white text-sm font-black leading-none">{score}%</span>
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
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-lg p-2 text-center">
                <p className="text-emerald-400 text-sm font-black">{overlapping.length}</p>
                <p className="text-[8px] text-emerald-500/70 font-bold uppercase tracking-wider">Shared</p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center">
                <p className="text-amber-400 text-sm font-black">{missing.length}</p>
                <p className="text-[8px] text-amber-500/70 font-bold uppercase tracking-wider">Gaps</p>
            </div>
            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-2 text-center">
                <p className="text-blue-400 text-[10px] font-black">{job.study_time_estimate || '—'}</p>
                <p className="text-[8px] text-blue-500/70 font-bold uppercase tracking-wider">Extra Study</p>
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
        <div className="space-y-2 mb-3">
            {overlapping.length > 0 && (
                <div className="flex items-start gap-2">
                    <CheckCircle size={11} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                        {overlapping.map((t, i) => (
                            <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 bg-emerald-950/30 text-emerald-400 border border-emerald-500/15 rounded-md">{t}</span>
                        ))}
                    </div>
                </div>
            )}
            {missing.length > 0 && (
                <div className="flex items-start gap-2">
                    <AlertTriangle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                        {missing.map((t, i) => (
                            <span key={i} className="text-[9px] font-semibold px-1.5 py-0.5 bg-amber-950/30 text-amber-400 border border-amber-500/15 rounded-md">{t}</span>
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

                {/* AI Explanation */}
                <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-xl p-3 mb-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <Brain size={11} className="text-blue-400" />
                        <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Gemini AI Analysis</span>
                        {job.detailed_gap_analysis?.gemini_powered && (
                            <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/15">✓ VERIFIED</span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed italic">"{job.explanation}"</p>
                </div>

                {/* Quick Stats */}
                <QuickStats job={job} />

                {/* Inline Gap Preview */}
                <InlineGapPreview job={job} />
            </div>

            {/* Action buttons */}
            <div className="px-5 pb-4 flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${isLiked ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-white/10 text-gray-600 hover:text-red-400 hover:border-red-500/30'}`}
                    title={isLiked ? "Saved to Targets" : "Track Exam"}>
                    <Heart size={14} fill={isLiked ? "currentColor" : "none"} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onToggleApply(); }}
                    className={`h-9 px-3 rounded-xl flex items-center gap-1.5 border transition-all text-[9px] font-bold uppercase tracking-wider ${isApplied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-transparent border-white/10 text-gray-600 hover:text-emerald-400 hover:border-emerald-500/30'}`}>
                    {isApplied ? <CheckCircle size={12} /> : <ClipboardList size={12} />}
                    {isApplied ? 'Applied' : 'Mark Applied'}
                </button>
            </div>

            {/* Bottom action bar */}
            <div className="px-5 pb-5 grid grid-cols-3 gap-2">
                <button onClick={() => onNavigate(`/jobs/${job.id}`)} className="flex items-center justify-center gap-1.5 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 text-[9px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] transition-all duration-200">
                    <BookOpen size={13} /> Explore
                </button>
                <button onClick={() => window.open(job.official_application_link || job.official_website_link || 'https://india.gov.in', '_blank')}
                    className="flex items-center justify-center gap-1.5 py-3 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 transition-all duration-200 shadow-md shadow-green-900/20">
                    <ExternalLink size={12} /> Apply
                </button>
                <button onClick={() => onOpenDetails(job)}
                    className="flex items-center justify-center gap-1.5 py-3 bg-gradient-to-r from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 text-blue-400 text-[9px] font-bold uppercase tracking-wider rounded-xl border border-blue-500/20 transition-all duration-200">
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

    useEffect(() => {
        try {
            const s = JSON.parse(sessionStorage.getItem('recs_nav_state') || '{}');
            if (s.search) setSearch(s.search);
            if (s.category) setCategory(s.category);
            if (s.state) setStateFilter(s.state);
        } catch { }
    }, []);
    useEffect(() => () => { isMounted.current = false; }, []);

    // Combine applied and liked jobs into candidates for matching
    const combinedExams = useMemo(() => {
        const ids = new Set<string>();
        const list: Job[] = [];
        for (const j of [...(appliedJobs || []), ...(likedJobs || [])]) {
            if (!ids.has(j.id)) { ids.add(j.id); list.push(j); }
        }
        return list;
    }, [appliedJobs, likedJobs]);

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
        const isApplied = appliedJobs.some(j => j.id === job.id);
        dispatch(toggleApplyAction(job, isApplied));
    }, [dispatch, appliedJobs]);

    const handleToggleLike = useCallback((job: Job) => {
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

    if (appliedJobs.length === 0 && likedJobs.length === 0 && !showSkeleton && recs.length === 0) {
        return (
            <div className="mb-10 bg-[#0c0c0c] light-card border border-white/5 light-border rounded-2xl p-10 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/[0.03] to-purple-600/[0.03]" />
                <Brain size={36} className="mx-auto text-red-500/20 mb-4 relative z-10" />
                <h2 className="text-xl font-bold text-white light-text mb-2 relative z-10">AI Syllabus Intelligence</h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm relative z-10 leading-relaxed">
                    Apply to or save an exam to unlock <span className="text-red-500 font-semibold">Gemini AI-powered syllabus matching</span> — we'll find exams with 70%+ syllabus overlap.
                </p>
                <button onClick={() => navigate('/')} className="mt-5 px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white light-text text-xs font-bold uppercase tracking-widest rounded-xl border border-white/10 light-border transition-all relative z-10">
                    Browse Exams
                </button>
            </div>
        );
    }

    return (
        <div className="mb-10 space-y-5 min-h-[300px]">
            {/* Header */}
            <div className="relative bg-[#0c0c0c] light-card border border-white/[0.06] light-border rounded-2xl p-5 overflow-hidden">
                {refreshing && (
                    <div className="absolute top-0 left-0 w-full h-0.5 overflow-hidden">
                        <div className="h-full w-1/3 bg-gradient-to-r from-red-600 to-purple-600 animate-[slide_1.5s_ease-in-out_infinite]" />
                    </div>
                )}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center shadow-lg shadow-red-900/20">
                            <Brain size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white light-text tracking-tight leading-none">AI Syllabus Intelligence</h2>
                            <div className="flex items-center gap-1.5 mt-1">
                                <Zap size={9} className="text-green-500" />
                                <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.25em]">Gemini AI • ≥70% Overlap Only • Detailed Analysis</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => { loadData(1); }}
                            className="w-9 h-9 rounded-lg bg-white/[0.04] hover:bg-red-600/20 border border-white/[0.06] flex items-center justify-center transition-all group/ref"
                            title="Refresh recommendations">
                            <RefreshCcw size={14} className={`text-gray-500 group-hover/ref:text-red-400 transition-colors ${refreshing ? 'animate-spin' : ''}`} />
                        </button>
                        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5 text-center hidden sm:block">
                            <p className="text-lg font-black text-white">{recs.length}</p>
                            <p className="text-[7px] font-bold text-gray-600 uppercase tracking-wider">Matches</p>
                        </div>
                    </div>
                </div>
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
                <div className="space-y-4">{[1, 2, 3].map(i => <SkeletonCard key={i} />)}</div>
            ) : recs.length > 0 ? (
                <div className="space-y-4">
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
                                className="px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300 border border-white/[0.06] hover:border-red-500 disabled:opacity-50">
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
                    <p className="text-gray-600 text-xs max-w-sm mx-auto">Apply to or save more exams to unlock syllabus-matched recommendations.</p>
                    <button onClick={() => navigate('/')} className="mt-5 px-5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] transition-all">Browse Exams</button>
                </div>
            )}

            {/* ═══ DETAILED ANALYSIS MODAL ═══ */}
            {selectedJob && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
                    <div className="bg-[#0c0c0c] light-card border border-white/[0.08] light-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Modal Header */}
                        <div className="p-5 border-b border-white/[0.06] light-border bg-gradient-to-r from-white/[0.02] to-transparent">
                            <div className="flex justify-between items-start">
                                <div className="flex-1 pr-4">
                                    <h3 className="text-lg font-bold text-white light-text">{selectedJob.job_name}</h3>
                                    <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">{selectedJob.organization}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className="text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                            <Brain size={11} /> Gemini AI Detailed Analysis
                                        </span>
                                        {selectedJob.detailed_gap_analysis?.gemini_powered && (
                                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/15">✓ AI Verified</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <ScoreRing score={selectedJob.similarity || 0} />
                                    <button onClick={() => setSelectedJob(null)} className="text-gray-500 hover:text-white transition-colors text-xl">✕</button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                            {selectedJob.detailed_gap_analysis ? (
                                <>
                                    {/* Source Exams */}
                                    {selectedJob.detailed_gap_analysis.source_exams && (
                                        <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
                                            <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-2">Compared Against Your Exams</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedJob.detailed_gap_analysis.source_exams.map((name: string, i: number) => (
                                                    <span key={i} className="text-[10px] font-bold text-white bg-red-600/15 border border-red-500/20 px-2.5 py-1 rounded-lg">{name}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* AI Explanation */}
                                    <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/10 rounded-xl p-4">
                                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-1.5"><Brain size={11} /> AI Verdict</p>
                                        <p className="text-sm text-gray-300 leading-relaxed italic">"{selectedJob.explanation}"</p>
                                        {selectedJob.difficulty_comparison && (
                                            <div className="flex items-center gap-3 mt-3">
                                                <span className="text-[9px] font-bold text-gray-500 uppercase">Difficulty:</span>
                                                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg border ${selectedJob.difficulty_comparison === 'easier' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/15' :
                                                    selectedJob.difficulty_comparison === 'harder' ? 'text-red-400 bg-red-500/10 border-red-500/15' :
                                                        'text-amber-400 bg-amber-500/10 border-amber-500/15'
                                                    }`}>{selectedJob.difficulty_comparison}</span>
                                                {selectedJob.study_time_estimate && (
                                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1"><Clock size={10} /> {selectedJob.study_time_estimate}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* 1. Subject-Wise Analysis */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2">
                                            <BarChart3 size={13} className="text-purple-400" /> 1. Subject-Wise Overlap
                                            {selectedJob.detailed_gap_analysis.gemini_powered && (
                                                <span className="text-[7px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/15 ml-auto">AI-Powered</span>
                                            )}
                                            {!selectedJob.detailed_gap_analysis.gemini_powered && (
                                                <span className="text-[7px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10 ml-auto">Estimated</span>
                                            )}
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(selectedJob.detailed_gap_analysis.subject_wise_analysis || []).map((sub: any, i: number) => (
                                                <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/10">
                                                    <p className="text-sm font-bold text-white mb-2">{sub.subject}</p>
                                                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden mb-1.5">
                                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all" style={{ width: `${sub.overlap_percentage}%` }} />
                                                    </div>
                                                    <div className="flex justify-between text-[10px] text-gray-400 uppercase font-semibold">
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
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2">
                                            <Target size={13} className="text-blue-400" /> 2. Topic Analysis
                                        </h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1.5 flex items-center gap-1"><CheckCircle size={10} /> Common Topics ({(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.common_topics || []).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.common_topics || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">{t}</span>)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-amber-500 font-bold uppercase mb-1.5 flex items-center gap-1"><AlertTriangle size={10} /> Missing Topics ({(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.missing_topics || []).length})</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.missing_topics || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">{t}</span>)}
                                                </div>
                                            </div>
                                            {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.partial_overlaps || []).length > 0 && (
                                                <div>
                                                    <p className="text-[10px] text-blue-500 font-bold uppercase mb-1.5 flex items-center gap-1"><Info size={10} /> Partial Overlaps</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.partial_overlaps || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">{t}</span>)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </section>

                                    {/* 3. Metrics */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">3. Gap Metrics</h4>
                                        <div className="bg-white/5 p-4 rounded-xl flex justify-around flex-wrap gap-4">
                                            <div className="text-center">
                                                <p className="text-2xl font-black text-white">{selectedJob.detailed_gap_analysis.gap_metrics?.total_overlap_percentage || selectedJob.similarity}%</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">Total Overlap</p>
                                            </div>
                                            <div className="text-center max-w-[150px]">
                                                <p className="text-sm font-bold text-amber-400 truncate">{(selectedJob.detailed_gap_analysis.gap_metrics?.critical_subject_gaps || []).join(', ') || 'None'}</p>
                                                <p className="text-[10px] text-gray-500 font-bold uppercase">Critical Gaps</p>
                                            </div>
                                        </div>
                                    </section>

                                    {/* 4. Priority */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2">
                                            <Shield size={13} className="text-red-400" /> 4. Priority Classification
                                        </h4>
                                        <div className="space-y-2 bg-black/50 p-3 rounded-lg border border-white/5">
                                            <p className="text-xs"><span className="text-red-400 font-bold w-16 inline-block">🔴 High:</span> <span className="text-gray-300">{(selectedJob.detailed_gap_analysis.priority_classification?.high || []).join(', ') || '—'}</span></p>
                                            <p className="text-xs"><span className="text-amber-400 font-bold w-16 inline-block">🟡 Medium:</span> <span className="text-gray-300">{(selectedJob.detailed_gap_analysis.priority_classification?.medium || []).join(', ') || '—'}</span></p>
                                            <p className="text-xs"><span className="text-emerald-400 font-bold w-16 inline-block">🟢 Low:</span> <span className="text-gray-300">{(selectedJob.detailed_gap_analysis.priority_classification?.low || []).join(', ') || '—'}</span></p>
                                        </div>
                                    </section>

                                    {/* 5. Preparation Roadmap */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2 flex items-center gap-2">
                                            <ArrowRight size={13} className="text-emerald-400" /> 5. Preparation Roadmap
                                        </h4>
                                        <div className="space-y-2">
                                            {(selectedJob.detailed_gap_analysis.preparation_roadmap || []).map((r: any, i: number) => (
                                                <div key={i} className="flex gap-3 text-sm items-start relative pb-2 ml-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                                                        <span className="text-[9px] font-black text-blue-400">{i + 1}</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-gray-300 font-medium">{r.task}</p>
                                                        <p className="text-[10px] text-blue-400/80 font-bold uppercase mt-0.5 flex items-center gap-1"><Clock size={9} /> Est. Effort: {r.effort_estimation}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* 6. Risk Analysis */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">6. Risk Analysis</h4>
                                        <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10">
                                            <p className="text-xs font-bold text-red-400 mb-1">Critical Missing Areas</p>
                                            <p className="text-sm text-gray-300 mb-3">{(selectedJob.detailed_gap_analysis.risk_analysis?.critical_missing_areas || []).join(', ') || 'None critical'}</p>
                                            <p className="text-xs font-bold text-red-400/80 mb-1">Risk Assessment</p>
                                            <p className="text-sm text-gray-400 leading-relaxed italic">"{selectedJob.detailed_gap_analysis.risk_analysis?.exam_risk_factors || 'Minimal transitional risk.'}"</p>
                                        </div>
                                    </section>
                                </>
                            ) : (
                                <div className="text-center text-gray-500 py-10">
                                    <Brain size={24} className="mx-auto text-blue-500/50 mb-3 opacity-50" />
                                    <p className="text-sm font-semibold">Detailed analysis loading...</p>
                                    <p className="text-xs mt-1">Gemini AI is analyzing syllabus overlap. Please refresh in a moment.</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-white/[0.06] flex justify-between items-center bg-white/[0.01]">
                            <div className="flex items-center gap-2">
                                <button onClick={() => handleNavigation(`/jobs/${selectedJob.id}`)}
                                    className="px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5 flex items-center gap-1.5">
                                    <BookOpen size={12} /> Explore Exam
                                </button>
                                <button onClick={() => window.open(selectedJob.official_application_link || selectedJob.official_website_link || '', '_blank')}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5">
                                    <ExternalLink size={12} /> Apply Now
                                </button>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5">Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
