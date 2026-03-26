import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { api } from '../api';
import { Job } from '../types';
import { Sparkles, RefreshCcw, AlertCircle, Zap, Heart, CheckCircle, ClipboardList, BookOpen, ExternalLink, ChevronDown, ChevronUp, Target, TrendingUp, AlertTriangle, UserX, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─── Types ─── */
interface RJob extends Job {
    similarity?: number;
    overlapping_topics?: string[];
    missing_topics?: string[];
    difficulty_gap?: 'low' | 'medium' | 'high';
    explanation?: string;
    location?: string;
    eligibility_score?: number;
}

interface Props {
    externalSearch?: string;
    externalCategory?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   SKELETON CARD — shown while loading (single-column)
   ═══════════════════════════════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════════════════════════════
   EXAM INFO — Expandable section containing Gap Analysis
   Gap analysis ONLY appears inside this section.
   ═══════════════════════════════════════════════════════════════════ */
const ExamInfoSection = memo(function ExamInfoSection({ job }: { job: RJob }) {
    const [expanded, setExpanded] = useState(false);
    const overlapping = job.overlapping_topics || [];
    const missing = job.missing_topics || [];
    const difficultyLabel: Record<string, { text: string; color: string }> = {
        low: { text: 'Easy Transition', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        medium: { text: 'Moderate Gap', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
        high: { text: 'Significant Gap', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    };
    const diff = difficultyLabel[job.difficulty_gap || 'medium'];

    return (
        <div className="border border-white/[0.05] light-border-subtle rounded-xl overflow-hidden">
            <button
                onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
            >
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exam Info & Gap Analysis</span>
                    {missing.length > 0 && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/15 px-1.5 py-0.5 rounded-full">
                            {missing.length} gaps
                        </span>
                    )}
                </div>
                {expanded ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
            </button>

            {/* Expandable content — gap analysis lives ONLY here */}
            <div className={`overflow-hidden transition-all duration-300 ease-out ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04] light-border-subtle pt-4">

                    {/* Quick stats row */}
                    <div className="flex flex-wrap gap-2">
                        <span className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border ${diff.color}`}>
                            {diff.text}
                        </span>
                        {job.eligibility_score != null && (
                            <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2.5 py-1 rounded-lg">
                                {job.eligibility_score}% Eligible
                            </span>
                        )}
                        {job.form_status === 'LIVE' && (
                            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-lg">
                                ● Applications Open
                            </span>
                        )}
                    </div>

                    {/* ── GAP ANALYSIS ── */}
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5">
                            <Target size={12} className="text-purple-400" /> Gap Analysis
                        </h4>

                        {/* Shared Topics */}
                        {overlapping.length > 0 && (
                            <div>
                                <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                    <CheckCircle size={10} /> Shared Topics ({overlapping.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {overlapping.map((t, i) => (
                                        <span key={i} className="text-[9px] font-semibold px-2 py-0.5 bg-emerald-950/30 text-emerald-400 border border-emerald-500/15 rounded-md">{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Missing Topics */}
                        {missing.length > 0 && (
                            <div>
                                <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                                    <AlertTriangle size={10} /> Additional Topics to Study ({missing.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                    {missing.map((t, i) => (
                                        <span key={i} className="text-[9px] font-semibold px-2 py-0.5 bg-amber-950/30 text-amber-400 border border-amber-500/15 rounded-md">{t}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* No data */}
                        {overlapping.length === 0 && missing.length === 0 && (
                            <p className="text-[10px] text-gray-600 italic">Detailed topic analysis will appear after AI processing.</p>
                        )}
                    </div>

                    {/* Improvement Suggestion */}
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <TrendingUp size={10} /> Improvement Suggestion
                        </p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                            {missing.length > 0
                                ? `Focus on ${missing.slice(0, 3).join(', ')} to bridge the gap. These topics are not covered in your current preparation.`
                                : `Your syllabus has strong overlap with this exam. Focus on advanced practice for shared topics.`
                            }
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════════════
   RECOMMENDATION CARD — Single-column full-width card
   Contains: name, overlap badge, AI reason, exam info (expandable), 2 buttons
   ═══════════════════════════════════════════════════════════════════ */
const RecommendationCard = memo(function RecommendationCard({ job, isApplied, isLiked, onToggleApply, onToggleLike, onNavigate }: {
    job: RJob; isApplied: boolean; isLiked: boolean;
    onToggleApply: () => void; onToggleLike: () => void; onNavigate: (url: string) => void;
}) {
    const isLive = job.form_status === 'LIVE';

    return (
        <div className="group bg-[#0c0c0c] light-card rounded-2xl border border-white/[0.06] light-border hover:border-red-500/25 transition-all duration-300 overflow-hidden hover:shadow-[0_2px_24px_rgba(239,68,68,0.06)]">
            {/* ── Card Header ── */}
            <div className="p-5 pb-0">
                <div className="flex items-start gap-4">
                    {/* Left: Info */}
                    <div className="flex-1 min-w-0">
                        {/* Status + Quick Actions */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${isLive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : job.form_status === 'UPCOMING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                                {isLive ? '● LIVE' : job.form_status === 'UPCOMING' ? '◷ UPCOMING' : '○ CLOSED'}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
                                className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all ${isLiked ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-white/10 text-gray-600 hover:text-red-400 hover:border-red-500/30'}`}
                            >
                                <Heart size={13} fill={isLiked ? "currentColor" : "none"} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleApply(); }}
                                className={`h-7 px-2 rounded-md flex items-center gap-1 border transition-all text-[8px] font-bold uppercase tracking-wider ${isApplied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-transparent border-white/10 text-gray-600 hover:text-emerald-400 hover:border-emerald-500/30'}`}
                            >
                                {isApplied ? <CheckCircle size={11} /> : <ClipboardList size={11} />}
                                {isApplied ? 'Applied' : 'Track'}
                            </button>
                        </div>

                        {/* Title */}
                        <h3 className="text-base font-bold text-white light-text leading-snug mb-1 group-hover:text-red-500 transition-colors duration-300 pr-2">{job.job_name}</h3>
                        <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{job.organization}</p>
                    </div>

                    {/* Right: Overlap Badge */}
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-900/25 border-2 border-black/30">
                            <span className="text-white text-sm font-black leading-none">{job.similarity}%</span>
                            <span className="text-white/50 text-[6px] font-bold uppercase mt-0.5">match</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── AI Reason ── */}
            <div className="px-5 py-3">
                <p className="text-[10px] text-gray-500 italic leading-relaxed">"{job.explanation}"</p>
            </div>

            {/* ── Exam Info (Expandable — contains Gap Analysis) ── */}
            <div className="px-5 pb-4">
                <ExamInfoSection job={job} />
            </div>

            {/* ── Action Buttons (exactly 2) ── */}
            <div className="px-5 pb-5 grid grid-cols-2 gap-2.5">
                <button
                    onClick={() => onNavigate(`/jobs/${job.id}`)}
                    className="flex items-center justify-center gap-1.5 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 light-text-secondary text-[9px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] light-border-subtle transition-all duration-200"
                >
                    <BookOpen size={13} /> Explore Exam
                </button>
                <button
                    onClick={() => {
                        if (job.official_application_link) window.open(job.official_application_link, '_blank');
                        else onNavigate(`/jobs/${job.id}`);
                    }}
                    className="flex items-center justify-center gap-1.5 py-3 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all duration-200 shadow-md shadow-red-900/20"
                >
                    {job.official_application_link ? <><ExternalLink size={12} /> Apply Now</> : <><BookOpen size={12} /> View Details</>}
                </button>
            </div>
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════════════
   MAIN WIDGET — Single-column card stack
   ═══════════════════════════════════════════════════════════════════ */
export default function RecommendationsWidget({ externalSearch = '', externalCategory = 'All' }: Props) {
    const [recs, setRecs] = useState<RJob[]>(() => {
        try {
            const saved = localStorage.getItem('ai_recs_cache');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
    const [likedJobs, setLikedJobs] = useState<Job[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);

    const getSavedState = () => {
        try {
            const s = sessionStorage.getItem('recs_nav_state');
            return s ? JSON.parse(s) : {};
        } catch { return {}; }
    };
    const saved = getSavedState();

    const [page, setPage] = useState(saved.page || 1);
    const [hasMore, setHasMore] = useState(false);
    const [search, setSearch] = useState(saved.search || '');
    const [category, setCategory] = useState(saved.category || 'All');
    const [loading, setLoading] = useState(recs.length === 0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [isSilentRefreshing, setIsSilentRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [contentVisible, setContentVisible] = useState(recs.length > 0);

    const navigate = useNavigate();
    const isFirstLoad = useRef(true);

    /* ── Data Loading ── */
    const loadData = useCallback(async (pageNum = 1, forceRefresh = false) => {
        if (pageNum === 1 && forceRefresh) {
            if (recs.length === 0) setLoading(true);
            else setIsSilentRefreshing(true);
        } else if (pageNum > 1) setLoadingMore(true);
        setError(null);

        try {
            const [applied, liked, me] = await Promise.all([
                api.getAppliedJobs(),
                api.getLikedJobs(),
                api.getMe().catch(() => null)
            ]);
            setAppliedJobs(applied || []);
            setLikedJobs(liked || []);
            if (me) setUserProfile(me);

            // Deduplicate applied + liked exams
            const combinedExams: Job[] = [];
            const ids = new Set<string>();
            for (const j of [...(applied || []), ...(liked || [])]) {
                if (!ids.has(j.id)) {
                    ids.add(j.id);
                    combinedExams.push(j);
                }
            }

            if (combinedExams.length > 0) {
                const res = await api.aiMatch(combinedExams, pageNum, search, category === 'All' ? '' : category);
                const newData = (res.data || []).map((r: any) => ({
                    ...r,
                    explanation: r.explanation || "Syllabus overlap match — AI analysis pending."
                }));

                if (pageNum === 1) {
                    setRecs(newData);
                    localStorage.setItem('ai_recs_cache', JSON.stringify(newData.slice(0, 6)));
                } else {
                    setRecs(prev => [...prev, ...newData]);
                }
                setHasMore(res.hasMore);
                setPage(res.page);
            } else {
                setRecs([]);
                setHasMore(false);
            }
        } catch (err: any) {
            console.error("AI Fetch Error:", err);
            setError(err.message || "AI engine recalibrating. Please retry.");
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setIsSilentRefreshing(false);
            requestAnimationFrame(() => setContentVisible(true));
        }
    }, [search, category]); // eslint-disable-line react-hooks/exhaustive-deps

    /* ── Toggle handlers ── */
    const handleToggleApply = async (job: Job) => {
        try {
            await api.toggleApplied(job.id);
            const updated = await api.getAppliedJobs();
            setAppliedJobs(updated || []);
        } catch (err) { console.error("Toggle Apply Error:", err); }
    };

    const handleToggleLike = async (job: Job) => {
        try {
            const isLiked = likedJobs.some(j => j.id === job.id);
            if (isLiked) await api.unlikeJob(job.id);
            else await api.likeJob(job.id);
            const updatedLiked = await api.getLikedJobs();
            setLikedJobs(updatedLiked || []);
        } catch (err) { console.error("Toggle Like Error:", err); }
    };

    /* ── Sync external props ── */
    useEffect(() => { setSearch(externalSearch); }, [externalSearch]);
    useEffect(() => { setCategory(externalCategory); }, [externalCategory]);

    /* ── Load on mount / filter change ── */
    useEffect(() => {
        if (isFirstLoad.current && recs.length > 0) {
            loadData(1, false);
            isFirstLoad.current = false;
            return;
        }
        isFirstLoad.current = false;
        const timer = setTimeout(() => { loadData(1, true); }, 400);
        return () => clearTimeout(timer);
    }, [search, category]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleNavigation = (url: string) => {
        sessionStorage.setItem('recs_nav_state', JSON.stringify({ search, category, page }));
        navigate(url);
    };

    const isProfileIncomplete = userProfile && (!userProfile.age || !userProfile.qualification_type || !userProfile.category);

    /* ═══════════════════════════════════════════════════
       RENDER
       ═══════════════════════════════════════════════════ */

    /* ── Error ── */
    if (error) {
        return (
            <div className="mb-10 bg-[#0c0c0c] light-card border border-red-900/20 p-8 rounded-2xl text-center">
                <AlertCircle size={36} className="text-red-500 mx-auto mb-3" />
                <h3 className="text-base font-bold text-white light-text mb-2">AI Engine Offline</h3>
                <p className="text-red-400/70 text-xs mb-5 max-w-sm mx-auto">{error}</p>
                <button onClick={() => loadData(1, true)} className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-colors">
                    Retry
                </button>
            </div>
        );
    }

    /* ── Empty (no applied/liked) ── */
    if (appliedJobs.length === 0 && likedJobs.length === 0 && !loading) {
        return (
            <div className="mb-10 bg-[#0c0c0c] light-card border border-white/5 light-border rounded-2xl p-10 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/[0.03] to-purple-600/[0.03]" />
                <Sparkles size={36} className="mx-auto text-red-500/20 mb-4 relative z-10" />
                <h2 className="text-xl font-bold text-white light-text mb-2 relative z-10">AI Recommendations</h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm relative z-10 leading-relaxed">
                    Apply to or save your first exam to unlock <span className="text-red-500 font-semibold">Gemini-powered syllabus matching</span>.
                    Only exams with ≥70% overlap are shown.
                </p>
                <button onClick={() => navigate('/')} className="mt-5 px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-white light-text text-xs font-bold uppercase tracking-widest rounded-xl border border-white/10 light-border transition-all relative z-10">
                    Browse Exams
                </button>
            </div>
        );
    }

    return (
        <div className="mb-10 space-y-5 min-h-[300px]">
            {/* ── HEADER ── */}
            <div className="relative bg-[#0c0c0c] light-card border border-white/[0.06] light-border rounded-2xl p-5 overflow-hidden">
                {isSilentRefreshing && (
                    <div className="absolute top-0 left-0 w-full h-0.5 overflow-hidden">
                        <div className="h-full w-1/3 bg-gradient-to-r from-red-600 to-purple-600 animate-[slide_1.5s_ease-in-out_infinite]" />
                    </div>
                )}
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center shadow-lg shadow-red-900/20 font-black text-sm">AI</div>
                    <div>
                        <h2 className="text-lg font-bold text-white light-text tracking-tight leading-none">AI Syllabus Ranker</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <Zap size={9} className="text-yellow-500" />
                            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.25em]">Gemini • Semantic Overlap • ≥70% Filter</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── PROFILE INCOMPLETE WARNING ── */}
            {isProfileIncomplete && (
                <div className="bg-amber-950/15 border border-amber-800/20 rounded-xl p-4 flex items-start gap-3">
                    <UserX size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-amber-300">Complete your profile for better results</p>
                        <p className="text-[10px] text-amber-400/60 mt-0.5">Add age, qualification, and category for eligibility-matched results.</p>
                        <button onClick={() => navigate('/profile')} className="mt-1.5 text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">→ Update Profile</button>
                    </div>
                </div>
            )}

            {/* ── CONTENT ── */}
            {loading ? (
                /* Skeleton loading — single column */
                <div className="space-y-4">
                    {[1, 2, 3, 4].map(i => <SkeletonCard key={i} />)}
                </div>
            ) : recs.length === 0 ? (
                /* No matches */
                <div className="text-center py-14 bg-[#0c0c0c] light-card border border-white/[0.04] light-border rounded-2xl">
                    <Sparkles size={32} className="mx-auto text-red-500/15 mb-3" />
                    <h3 className="text-sm font-bold text-gray-400 mb-1.5">No Matches Found</h3>
                    <p className="text-gray-600 text-xs max-w-sm mx-auto leading-relaxed">
                        No exams meet the strict 70% syllabus overlap threshold. Try applying to exams with broader syllabi.
                    </p>
                    <button onClick={() => navigate('/')} className="mt-5 px-5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] transition-all">
                        Browse All Exams
                    </button>
                </div>
            ) : (
                /* ─── SINGLE COLUMN CARD STACK ─── */
                <div className={`space-y-4 transition-opacity duration-500 ${contentVisible ? 'opacity-100' : 'opacity-0'}`}>
                    {/* Result count */}
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-wider px-1">
                        {recs.length} exam{recs.length !== 1 ? 's' : ''} matched {hasMore && '(scroll for more)'}
                    </p>

                    {/* Cards — SINGLE COLUMN, no grid */}
                    {recs.map(job => (
                        <RecommendationCard
                            key={job.id}
                            job={job}
                            isApplied={appliedJobs.some(j => j.id === job.id)}
                            isLiked={likedJobs.some(j => j.id === job.id)}
                            onToggleApply={() => handleToggleApply(job)}
                            onToggleLike={() => handleToggleLike(job)}
                            onNavigate={handleNavigation}
                        />
                    ))}

                    {/* Load More */}
                    {hasMore && (
                        <div className="flex justify-center pt-2 pb-4">
                            <button
                                onClick={() => loadData(page + 1)}
                                disabled={loadingMore}
                                className="px-6 py-3 rounded-xl bg-white/[0.04] hover:bg-red-600 text-white font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 transition-all duration-300 border border-white/[0.06] hover:border-red-500 disabled:opacity-50"
                            >
                                {loadingMore ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                                {loadingMore ? 'Loading...' : 'Load More Matches'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
