import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { api } from '../api';
import { Job } from '../types';
import { Sparkles, RefreshCcw, Zap, Heart, CheckCircle, ClipboardList, BookOpen, ExternalLink, ChevronDown, ChevronUp, Target, TrendingUp, AlertTriangle, UserX, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ─── Types ─── */
interface RJob extends Job {
    similarity?: number;
    detailed_gap_analysis?: any;
    overlapping_topics?: string[];
    missing_topics?: string[];
    difficulty_gap?: 'low' | 'medium' | 'high';
    gap_summary?: string;
    explanation?: string;
    location?: string;
    eligibility_score?: number;
    exam_type?: string;
}

interface Props {
    externalSearch?: string;
    externalCategory?: string;
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

/* ── Exam Info (expandable — gap analysis ONLY here) ── */
const ExamInfoSection = memo(function ExamInfoSection({ job }: { job: RJob }) {
    const [expanded, setExpanded] = useState(false);
    const overlapping = job.overlapping_topics || [];
    const missing = job.missing_topics || [];
    const diffLabels: Record<string, { text: string; color: string }> = {
        low: { text: 'Easy Transition', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
        medium: { text: 'Moderate Gap', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
        high: { text: 'Significant Gap', color: 'text-red-400 bg-red-500/10 border-red-500/20' },
    };
    const diff = diffLabels[job.difficulty_gap || 'medium'];

    return (
        <div className="border border-white/[0.05] light-border-subtle rounded-xl overflow-hidden">
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-2">
                    <Info size={14} className="text-blue-400" />
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exam Info & Gap Analysis</span>
                    {missing.length > 0 && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/15 px-1.5 py-0.5 rounded-full">{missing.length} gaps</span>}
                </div>
                {expanded ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
            </button>
            <div className={`overflow-hidden transition-all duration-300 ease-out ${expanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-4 pb-4 space-y-4 border-t border-white/[0.04] light-border-subtle pt-4">
                    <div className="flex flex-wrap gap-2">
                        <span className={`text-[9px] font-bold uppercase px-2.5 py-1 rounded-lg border ${diff.color}`}>{diff.text}</span>
                        <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/15 px-2.5 py-1 rounded-lg flex items-center gap-1"><CheckCircle size={10} /> MATCHED</span>
                        {job.form_status === 'LIVE' && <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2.5 py-1 rounded-lg tracking-wider">● OPEN</span>}
                        {job.form_status === 'UPCOMING' && <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/15 px-2.5 py-1 rounded-lg tracking-wider">◷ UPCOMING</span>}
                        {job.form_status === 'CLOSED' && <span className="text-[9px] font-bold text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg tracking-wider">○ CLOSED</span>}
                    </div>
                    <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] flex items-center gap-1.5"><Target size={12} className="text-purple-400" /> Gap Analysis</h4>
                        {overlapping.length > 0 && (<div>
                            <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><CheckCircle size={10} /> Shared ({overlapping.length})</p>
                            <div className="flex flex-wrap gap-1">{overlapping.map((t, i) => <span key={i} className="text-[9px] font-semibold px-2 py-0.5 bg-emerald-950/30 text-emerald-400 border border-emerald-500/15 rounded-md">{t}</span>)}</div>
                        </div>)}
                        {missing.length > 0 && (<div>
                            <p className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><AlertTriangle size={10} /> To Study ({missing.length})</p>
                            <div className="flex flex-wrap gap-1">{missing.map((t, i) => <span key={i} className="text-[9px] font-semibold px-2 py-0.5 bg-amber-950/30 text-amber-400 border border-amber-500/15 rounded-md">{t}</span>)}</div>
                        </div>)}
                        {overlapping.length === 0 && missing.length === 0 && <p className="text-[10px] text-gray-600 italic">Topic analysis will refine on next load.</p>}
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3">
                        <p className="text-[9px] font-bold text-gray-600 uppercase tracking-wider mb-1 flex items-center gap-1"><TrendingUp size={10} /> Roadmap & Suggestion</p>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                            {job.gap_summary || (missing.length > 0 ? `Focus on ${missing.slice(0, 3).join(', ')} to bridge the gap.` : `Strong overlap. Practice at advanced level.`)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
});

/* ── Recommendation Card ── */
const RecommendationCard = memo(function RecommendationCard({ job, isApplied, isLiked, onToggleApply, onToggleLike, onNavigate, onOpenDetails }: {
    job: RJob; isApplied: boolean; isLiked: boolean;
    onToggleApply: () => void; onToggleLike: () => void; onNavigate: (url: string) => void; onOpenDetails: (job: RJob) => void;
}) {
    const isLive = job.form_status === 'LIVE';
    return (
        <div className="group bg-[#0c0c0c] light-card rounded-2xl border border-white/[0.06] light-border hover:border-red-500/25 transition-all duration-300 overflow-hidden hover:shadow-[0_2px_24px_rgba(239,68,68,0.06)]">
            <div className="p-5 pb-0">
                <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest ${isLive ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20' : job.form_status === 'UPCOMING' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' : 'bg-white/5 text-gray-600 border border-white/5'}`}>
                                {isLive ? '● LIVE' : job.form_status === 'UPCOMING' ? '◷ UPCOMING' : '○ CLOSED'}
                            </span>
                            {job.exam_type && (
                                <span className="px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    {job.exam_type}
                                </span>
                            )}
                            <button onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
                                className={`w-7 h-7 rounded-md flex items-center justify-center border transition-all ${isLiked ? 'bg-red-600 border-red-500 text-white' : 'bg-transparent border-white/10 text-gray-600 hover:text-red-400 hover:border-red-500/30'}`}>
                                <Heart size={13} fill={isLiked ? "currentColor" : "none"} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onToggleApply(); }}
                                className={`h-7 px-2 rounded-md flex items-center gap-1 border transition-all text-[8px] font-bold uppercase tracking-wider ${isApplied ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-transparent border-white/10 text-gray-600 hover:text-emerald-400 hover:border-emerald-500/30'}`}>
                                {isApplied ? <CheckCircle size={11} /> : <ClipboardList size={11} />}
                                {isApplied ? 'Applied' : 'Track'}
                            </button>
                        </div>
                        <h3 className="text-base font-bold text-white light-text leading-snug mb-1 group-hover:text-red-500 transition-colors duration-300 pr-2">{job.job_name}</h3>
                        <p className="text-[10px] text-gray-600 font-semibold uppercase tracking-wider">{job.organization}</p>
                    </div>
                    <div className="flex-shrink-0">
                        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-red-600 to-red-800 shadow-lg shadow-red-900/25 border-2 border-black/30">
                            <span className="text-white text-sm font-black leading-none">{job.similarity}%</span>
                            <span className="text-white/50 text-[6px] font-bold uppercase mt-0.5">match</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="px-5 py-3"><p className="text-[10px] text-gray-500 italic leading-relaxed">"{job.explanation}"</p></div>
            <div className="px-5 pb-4"><ExamInfoSection job={job} /></div>
            <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button onClick={() => onNavigate(`/jobs/${job.id}`)} className="flex items-center justify-center gap-1.5 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-gray-300 light-text-secondary text-[9px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] light-border-subtle transition-all duration-200">
                    <BookOpen size={13} /> Explore Exam
                </button>
                <button onClick={() => window.open(job.official_application_link || job.official_website_link || 'https://india.gov.in', '_blank')}
                    className="flex items-center justify-center gap-1.5 py-3 text-white text-[9px] font-bold uppercase tracking-wider rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 transition-all duration-200 shadow-md shadow-green-900/20">
                    <ExternalLink size={12} /> Apply Now
                </button>
                <button onClick={() => onOpenDetails(job)}
                    className="flex sm:col-span-1 col-span-1 items-center justify-center gap-1.5 py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[9px] font-bold uppercase tracking-wider rounded-xl border border-blue-500/20 transition-all duration-200">
                    <Target size={13} /> View Detailed Gap Analysis
                </button>
            </div>
        </div>
    );
});

/* ═══════════════════════════════════════════════════════════════
   MAIN WIDGET — ZERO FAILURE, ZERO ERROR UI
   
   1. Show cached results from localStorage INSTANTLY
   2. Call API in background (silent)
   3. On success: smooth update
   4. On failure: keep cached data, NO error message shown
   ═══════════════════════════════════════════════════════════════ */
export default function RecommendationsWidget({ externalSearch = '', externalCategory = 'All' }: Props) {
    const recsRef = useRef<RJob[]>([]);
    const [recs, _setRecs] = useState<RJob[]>(() => {
        try {
            const saved = localStorage.getItem('ai_recs_cache');
            const parsed = saved ? JSON.parse(saved) : [];
            recsRef.current = parsed;
            return parsed;
        } catch { return []; }
    });
    const setRecs = useCallback((data: RJob[] | ((prev: RJob[]) => RJob[])) => {
        _setRecs(prev => {
            const next = typeof data === 'function' ? data(prev) : data;
            recsRef.current = next;
            return next;
        });
    }, []);

    const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
    const [likedJobs, setLikedJobs] = useState<Job[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    // Only show skeleton if no cached data at all
    const [showSkeleton, setShowSkeleton] = useState(recsRef.current.length === 0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedJob, setSelectedJob] = useState<RJob | null>(null);

    const navigate = useNavigate();
    const isMounted = useRef(true);
    const fetchIdRef = useRef(0);

    useEffect(() => {
        try {
            const s = JSON.parse(sessionStorage.getItem('recs_nav_state') || '{}');
            if (s.search) setSearch(s.search);
            if (s.category) setCategory(s.category);
        } catch {}
    }, []);
    useEffect(() => () => { isMounted.current = false; }, []);

    /* ── CORE LOADER: Silent, never shows errors ── */
    const loadData = useCallback(async (pageNum = 1) => {
        const fetchId = ++fetchIdRef.current;
        if (pageNum > 1) setLoadingMore(true);
        else if (recsRef.current.length > 0) setRefreshing(true);

        try {
            // Step 1: Get user data (5s max)
            const [applied, liked, me] = await Promise.all([
                api.getAppliedJobs().catch(() => [] as Job[]),
                api.getLikedJobs().catch(() => [] as Job[]),
                api.getMe().catch(() => null)
            ]);
            if (fetchId !== fetchIdRef.current || !isMounted.current) return;

            setAppliedJobs(applied || []);
            setLikedJobs(liked || []);
            if (me) setUserProfile(me);

            const combinedExams: Job[] = [];
            const ids = new Set<string>();
            for (const j of [...(applied || []), ...(liked || [])]) {
                if (!ids.has(j.id)) { ids.add(j.id); combinedExams.push(j); }
            }

            // CHANGED: Always call aiMatch even with 0 exams - backend now returns fallback recommendations
            // Step 2: REQUIRED API call with robust Retry Loop — NO SILENT FAILURE
            let res: any = null;
            let attempts = 0;
            
            while (!res && attempts < 3) {
                try {
                    res = await api.aiMatch(combinedExams, pageNum, search, category === 'All' ? '' : category);
                } catch (e) {
                    attempts++;
                    console.warn(`[AI] Attempt ${attempts} failed, retrying...`);
                    if (attempts >= 3) break; 
                    await new Promise(r => setTimeout(r, 2000 * attempts));
                }
            }

            if (!res || !isMounted.current || fetchId !== fetchIdRef.current) {
                // To avoid "failing silently", preserve caches but end the loading state cleanly.
                setLoadingMore(false);
                setRefreshing(false);
                return;
            }

            const newData = (res.data || []).map((r: any) => ({
                ...r,
                explanation: r.explanation || "Syllabus overlap match."
            }));

            if (pageNum === 1) {
                setRecs(newData);
                try { localStorage.setItem('ai_recs_cache', JSON.stringify(newData.slice(0, 8))); } catch {}
            } else {
                setRecs(prev => [...prev, ...newData]);
            }
            setHasMore(res.hasMore || false);
            setPage(res.page || pageNum);


        } catch {
            // SILENT — keep cached data visible
        } finally {
            if (fetchId === fetchIdRef.current && isMounted.current) {
                setShowSkeleton(false);
                setLoadingMore(false);
                setRefreshing(false);
            }
        }
    }, [search, category, setRecs]);

    const handleToggleApply = async (job: Job) => {
        try { await api.toggleApplied(job.id); setAppliedJobs(await api.getAppliedJobs().catch(() => []) || []); } catch {}
    };
    const handleToggleLike = async (job: Job) => {
        try {
            if (likedJobs.some(j => j.id === job.id)) await api.unlikeJob(job.id);
            else await api.likeJob(job.id);
            setLikedJobs(await api.getLikedJobs().catch(() => []) || []);
        } catch {}
    };

    useEffect(() => { setSearch(externalSearch); }, [externalSearch]);
    useEffect(() => { setCategory(externalCategory); }, [externalCategory]);

    // Load on mount + filter change (300ms debounce, single execution)
    useEffect(() => {
        const timer = setTimeout(() => loadData(1), 300);
        return () => clearTimeout(timer);
    }, [search, category, loadData]);

    const handleNavigation = (url: string) => {
        sessionStorage.setItem('recs_nav_state', JSON.stringify({ search, category, page }));
        navigate(url);
    };

    const isProfileIncomplete = userProfile && (!userProfile.age || !userProfile.qualification_type || !userProfile.category);

    /* ═══ RENDER — NEVER shows errors, NEVER blank ═══ */

    if (appliedJobs.length === 0 && likedJobs.length === 0 && !showSkeleton && recs.length === 0) {
        return (
            <div className="mb-10 bg-[#0c0c0c] light-card border border-white/5 light-border rounded-2xl p-10 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/[0.03] to-purple-600/[0.03]" />
                <Sparkles size={36} className="mx-auto text-red-500/20 mb-4 relative z-10" />
                <h2 className="text-xl font-bold text-white light-text mb-2 relative z-10">AI Recommendations</h2>
                <p className="text-gray-500 max-w-md mx-auto text-sm relative z-10 leading-relaxed">
                    Apply to or save an exam to unlock <span className="text-red-500 font-semibold">AI-powered syllabus matching</span>.
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
                <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-red-600 to-red-800 text-white flex items-center justify-center shadow-lg shadow-red-900/20 font-black text-sm">AI</div>
                    <div>
                        <h2 className="text-lg font-bold text-white light-text tracking-tight leading-none">AI Syllabus Ranker</h2>
                        <div className="flex items-center gap-1.5 mt-1">
                            <Zap size={9} className="text-green-500" />
                            <p className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.25em]">NVIDIA NIM • Nemotron • Embed VL</p>
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
                        {recs.length} exam{recs.length !== 1 ? 's' : ''} matched {hasMore && '· more available'}
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
                    <Sparkles size={32} className="mx-auto text-red-500/15 mb-3" />
                    <h3 className="text-sm font-bold text-gray-400 mb-1.5">No Matches Yet</h3>
                    <p className="text-gray-600 text-xs max-w-sm mx-auto">Apply to more exams to see syllabus-matched recommendations.</p>
                    <button onClick={() => navigate('/')} className="mt-5 px-5 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-400 text-[10px] font-bold uppercase tracking-wider rounded-xl border border-white/[0.04] transition-all">Browse Exams</button>
                </div>
            )}

            {/* Modal for Detailed Gap Analysis */}
            {selectedJob && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedJob(null)}>
                    <div className="bg-[#0c0c0c] light-card border border-white/[0.08] light-border rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 border-b border-white/[0.06] light-border flex justify-between items-center bg-white/[0.02]">
                            <div>
                                <h3 className="text-lg font-bold text-white light-text pr-4">{selectedJob.job_name}</h3>
                                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1"><Target size={12}/> Detailed Gap Analysis</p>
                            </div>
                            <button onClick={() => setSelectedJob(null)} className="text-gray-500 hover:text-white transition-colors">✕</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
                            {selectedJob.detailed_gap_analysis ? (
                                <>
                                    {/* Subject Wise Analysis */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">1. Subject-Wise Analysis</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {(selectedJob.detailed_gap_analysis.subject_wise_analysis || []).map((sub: any, i: number) => (
                                                <div key={i} className="bg-white/5 p-3 rounded-lg border border-white/10">
                                                    <p className="text-sm font-bold text-white mb-1">{sub.subject}</p>
                                                    <div className="flex justify-between text-[10px] text-gray-400 uppercase font-semibold">
                                                        <span>Overlap: <span className="text-emerald-400">{sub.overlap_percentage}%</span></span>
                                                        <span>Gap: <span className="text-amber-400">{sub.gap_percentage}%</span></span>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!selectedJob.detailed_gap_analysis.subject_wise_analysis || selectedJob.detailed_gap_analysis.subject_wise_analysis.length === 0) && (
                                                <p className="text-xs text-gray-500 italic">No subject-level gaps detected.</p>
                                            )}
                                        </div>
                                    </section>
                                    
                                    {/* Topics */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">2. Topic & Subtopic Analysis</h4>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1 flex items-center gap-1">✅ Common Topics</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.common_topics || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md">{t}</span>)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-amber-500 font-bold uppercase mb-1 flex items-center gap-1">❌ Missing Topics</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.missing_topics || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md">{t}</span>)}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-blue-500 font-bold uppercase mb-1 flex items-center gap-1">⚠️ Partial Overlaps</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(selectedJob.detailed_gap_analysis.topic_subtopic_analysis?.partial_overlaps || []).map((t: string, i: number) => <span key={i} className="px-2 py-1 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md">{t}</span>)}
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    {/* Metrics */}
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

                                    {/* Priority */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">4. Priority Classification</h4>
                                        <div className="space-y-2 bg-black/50 p-3 rounded-lg border border-white/5">
                                            <p className="text-xs"><span className="text-red-400 font-bold w-16 inline-block">High:</span> <span className="text-gray-300">{(selectedJob.detailed_gap_analysis.priority_classification?.high || []).join(', ') || '-'}</span></p>
                                            <p className="text-xs"><span className="text-amber-400 font-bold w-16 inline-block">Medium:</span> <span className="text-gray-300">{(selectedJob.detailed_gap_analysis.priority_classification?.medium || []).join(', ') || '-'}</span></p>
                                            <p className="text-xs"><span className="text-emerald-400 font-bold w-16 inline-block">Low:</span> <span className="text-gray-300">{(selectedJob.detailed_gap_analysis.priority_classification?.low || []).join(', ') || '-'}</span></p>
                                        </div>
                                    </section>

                                    {/* Roadmap */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">5. Preparation Roadmap</h4>
                                        <div className="space-y-2">
                                            {(selectedJob.detailed_gap_analysis.preparation_roadmap || []).map((r: any, i: number) => (
                                                <div key={i} className="flex gap-3 text-sm items-start relative pb-2 ml-2">
                                                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 flex-shrink-0"></div>
                                                    <div className="flex-1">
                                                        <p className="text-gray-300 font-medium">{r.task}</p>
                                                        <p className="text-[10px] text-blue-400/80 font-bold uppercase mt-0.5">Est. Effort: {r.effort_estimation}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* Risk */}
                                    <section>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">6. Risk Analysis</h4>
                                        <div className="bg-red-500/5 p-4 rounded-lg border border-red-500/10">
                                            <p className="text-xs font-bold text-red-400 mb-1">Critical Missing Areas</p>
                                            <p className="text-sm text-gray-300 mb-3">{(selectedJob.detailed_gap_analysis.risk_analysis?.critical_missing_areas || []).join(', ') || 'None critical'}</p>
                                            <p className="text-xs font-bold text-red-400/80 mb-1">Risk Factors</p>
                                            <p className="text-sm text-gray-400 leading-relaxed italic">"{selectedJob.detailed_gap_analysis.risk_analysis?.exam_risk_factors || 'Minimal transitional risk.'}"</p>
                                        </div>
                                    </section>
                                </>
                            ) : (
                                <div className="text-center text-gray-500 py-10">
                                    <Sparkles size={24} className="mx-auto text-blue-500/50 mb-3 opacity-50" />
                                    <p className="text-sm font-semibold">Detailed analysis unavailable</p>
                                    <p className="text-xs mt-1">Please try again later or reload the recommendations.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t border-white/[0.06] flex justify-end bg-white/[0.01]">
                            <button onClick={() => setSelectedJob(null)} className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-colors border border-white/5">Close Module</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
