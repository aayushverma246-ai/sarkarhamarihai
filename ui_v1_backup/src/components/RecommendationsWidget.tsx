import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import { Job } from '../types';
import { Sparkles, ArrowRight, RefreshCcw, AlertCircle, LayoutGrid, Activity, Zap, Cpu, Heart, CheckCircle, ClipboardList, BookOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface RJob extends Job {
    similarity?: number;
    overlapping_topics?: string[];
    missing_topics?: string[];
    difficulty_gap?: 'low' | 'medium' | 'high';
    explanation?: string;
    location?: string;
}

interface Props {
    externalSearch?: string;
    externalCategory?: string;
}

// PREMIUM Glassmorphism Loader
function NuclearLoader({ text = "AI CALIBRATION IN PROGRESS" }: { text?: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-20 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-3xl border border-white/10 rounded-[4rem] shadow-[0_0_100px_rgba(220,38,38,0.1)] relative overflow-hidden group">
            <div className="absolute inset-0 bg-red-600/5 animate-pulse" />
            <div className="relative w-24 h-24 mb-10 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-t-2 border-red-500 animate-[spin_1.5s_linear_infinite]" />
                <div className="absolute inset-2 rounded-full border-b-2 border-purple-500 animate-[spin_2s_linear_infinite_reverse]" />
                <Cpu size={40} className="text-white animate-pulse" />
            </div>
            <h2 className="text-lg font-black text-white tracking-[0.6em] uppercase italic text-center animate-bounce">{text}</h2>
        </div>
    );
}

export default function RecommendationsWidget({ externalSearch = '', externalCategory = 'All' }: Props) {
    const [recs, setRecs] = useState<RJob[]>(() => {
        try {
            const saved = localStorage.getItem('ai_recs_cache');
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
    const [likedJobs, setLikedJobs] = useState<Job[]>([]);
    
    // Read saved state synchronously
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
    const [activeTab, setActiveTab] = useState<'recs' | 'gap'>(saved.tab || 'recs');

    const navigate = useNavigate();
    const isFirstLoad = useRef(true);

    const loadData = async (pageNum = 1, forceRefresh = false) => {
        if (pageNum === 1 && forceRefresh) {
            // Only show full-screen loader if we have NO data yet or it's a NEW filter
            if (recs.length === 0) setLoading(true);
            else setIsSilentRefreshing(true);
        }
        else if (pageNum > 1) setLoadingMore(true);
        setError(null);

        try {
            const [applied, liked] = await Promise.all([
                api.getAppliedJobs(),
                api.getLikedJobs()
            ]);
            setAppliedJobs(applied || []);
            setLikedJobs(liked || []);
            
            const combinedExams = [];
            const ids = new Set();
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
                    explanation: r.explanation || "Syllabus overlap match."
                }));
                
                if (pageNum === 1) {
                    setRecs(newData);
                    localStorage.setItem('ai_recs_cache', JSON.stringify(newData.slice(0, 5)));
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
        }
    };

    const handleToggleApply = async (job: Job) => {
        try {
            await api.toggleApplied(job.id);
            // Silent refresh
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

    // Debounced fetch on prop changes
    useEffect(() => { setSearch(externalSearch); }, [externalSearch]);
    useEffect(() => { setCategory(externalCategory); }, [externalCategory]);

    useEffect(() => {
        if (isFirstLoad.current && recs.length > 0) {
            loadData(1, false);
            isFirstLoad.current = false;
            return;
        }
        const timer = setTimeout(() => { loadData(1, true); }, 400); 
        return () => clearTimeout(timer);
        // eslint-disable-next-line
    }, [search, category]);

    const handleNavigation = (url: string) => {
        sessionStorage.setItem('recs_nav_state', JSON.stringify({ search, category, page, tab: activeTab }));
        navigate(url);
    };

    if (error) {
        return (
            <div className="mb-12 bg-red-950/20 border-2 border-red-900/50 p-12 rounded-[3.5rem] text-center shadow-[0_0_50px_rgba(220,38,38,0.2)] backdrop-blur-xl">
                <AlertCircle size={64} className="text-red-500 mx-auto mb-6 animate-pulse" />
                <h3 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter italic">AI ENGINE OFFLINE</h3>
                <p className="text-red-400 font-mono text-xs mb-10">{error}</p>
                <button onClick={() => loadData(1, true)} className="px-12 py-5 bg-gradient-to-r from-red-600 to-red-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-red-900/40">Re-Initialize</button>
            </div>
        );
    }

    if (appliedJobs.length === 0 && likedJobs.length === 0 && !loading) {
        return (
            <div className="mb-12 bg-[#050505] border border-white/5 rounded-[4rem] p-20 text-center shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 to-purple-600/5" />
                <h2 className="text-5xl font-black text-white mb-6 uppercase italic tracking-tighter relative z-10">AI Recommendations</h2>
                <p className="text-gray-400 max-w-2xl mx-auto text-lg relative z-10 leading-relaxed">Apply to or Save your first exam to unlock <span className="text-red-500 font-bold">V13.0 Semantic Matching</span>. We strictly rank based on syllabus overlap.</p>
                <button onClick={() => navigate('/')} className="mt-10 px-12 py-5 bg-white text-black rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-colors relative z-10">Find Exams to Apply</button>
            </div>
        );
    }

    return (
        <div className="mb-12 space-y-10 animate-fadeIn min-h-[800px] transition-all">
            {/* V13.0 Header */}
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[3rem] p-10 shadow-2xl overflow-hidden group">
                {isSilentRefreshing && (
                    <div className="absolute top-0 left-0 w-full h-1 overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-red-600 to-purple-600 animate-[loading-bar_1.5s_infinite]" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/10 via-purple-600/5 to-transparent opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="flex items-center gap-8 relative z-10">
                    <div className="w-16 h-16 rounded-[1.5rem] bg-gradient-to-br from-red-600 to-purple-700 text-white flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)] font-black text-3xl rotate-6 group-hover:rotate-0 transition-transform duration-500">AI</div>
                    <div>
                        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-none">Strict Syallbus Ranker</h2>
                        <div className="flex items-center gap-2 mt-3">
                            <Zap size={12} className="text-yellow-500 animate-pulse" />
                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.5em]">V13.0 SEMANTIC OVERLAP STABLE</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* TAB SYSTEM */}
            <div className="flex gap-4 p-2 bg-white/5 backdrop-blur-md rounded-[2.5rem] border border-white/10 w-fit">
                <button 
                    onClick={() => setActiveTab('recs')}
                    className={`px-8 py-4 flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${activeTab === 'recs' ? 'bg-red-600 text-white shadow-xl shadow-red-900/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                    <LayoutGrid size={16} /> Rankings
                </button>
                <button 
                    onClick={() => setActiveTab('gap')}
                    className={`px-8 py-4 flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all rounded-2xl ${activeTab === 'gap' ? 'bg-purple-600 text-white shadow-xl shadow-purple-900/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                >
                    <Activity size={16} /> Gap Analysis
                </button>
            </div>

            {loading ? (
                <NuclearLoader text="RECONSTRUCTING RECOMMENDATIONS" />
            ) : recs.length === 0 ? (
                <div className="text-center py-24 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[4rem] relative overflow-hidden">
                    <Sparkles size={64} className="mx-auto text-red-500/20 mb-8" />
                    <h3 className="text-2xl font-black text-gray-300 mb-3 uppercase italic tracking-tighter">No Matches Found (Strict 70%)</h3>
                    <p className="text-gray-600 text-xs uppercase tracking-widest font-black">Try applying to exams with broader syllabus overlap.</p>
                </div>
            ) : activeTab === 'recs' ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
                    </div>
                    {hasMore && (
                        <div className="flex justify-center mt-12 pb-12">
                            <button 
                                onClick={() => loadData(page + 1)}
                                disabled={loadingMore}
                                className="group px-12 py-6 rounded-[2rem] bg-white/5 hover:bg-red-600 text-white font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 transition-all duration-500 border border-white/10 hover:border-red-500 shadow-2xl disabled:opacity-50"
                            >
                                {loadingMore ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Zap className="w-5 h-5 group-hover:animate-pulse" />}
                                {loadingMore ? 'Syncing...' : 'Load Next Batch'}
                            </button>
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-8 pb-20">
                    {recs.map(job => (
                        <div key={job.id} className="group relative bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-10 flex flex-col md:flex-row gap-10 items-start hover:border-purple-500/50 transition-all duration-700 shadow-2xl overflow-hidden">
                            <div className="md:w-1/3 flex-shrink-0 relative z-10">
                                <div className="flex flex-col gap-4 mb-8">
                                    <div className="w-fit px-5 py-2 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-red-900/40 animate-pulse">
                                        {job.similarity}% Overlap
                                    </div>
                                    <h3 className="text-2xl font-black text-white leading-none uppercase italic tracking-tighter">{job.job_name}</h3>
                                    <p className="text-[10px] text-red-500/60 font-black uppercase tracking-widest leading-none mt-2">{job.explanation}</p>
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => handleNavigation(`/jobs/${job.id}`)} className="w-full px-6 py-4 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-3">
                                        View Roadmap <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 w-full relative z-10">
                                <div className="bg-emerald-500/5 rounded-3xl p-8 border border-emerald-500/10">
                                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3 italic">Shared Mastery ({job.overlapping_topics?.length})</h4>
                                    <div className="flex flex-wrap gap-2.5">
                                        {job.overlapping_topics?.slice(0, 10).map((t, i) => (
                                            <span key={i} className="text-[10px] font-black px-4 py-2 bg-emerald-950/20 text-emerald-400 border border-emerald-500/20 rounded-xl uppercase tracking-wider">{t}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-white/5 rounded-3xl p-8 border border-white/10">
                                    <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-6 flex items-center gap-3 italic text-center">SEMANTIC REASONING</h4>
                                    <p className="text-xs text-gray-400 leading-relaxed italic">"{job.explanation}"</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

interface CardProps {
    job: RJob;
    isApplied: boolean;
    isLiked: boolean;
    onToggleApply: () => void;
    onToggleLike: () => void;
    onNavigate: (url: string) => void;
}

function RecommendationCard({ job, isApplied, isLiked, onToggleApply, onToggleLike, onNavigate }: CardProps) {
    const isHigh = (job.similarity || 0) >= 70;
    const isLive = job.form_status === 'LIVE';
    
    return (
        <div className={`group relative flex flex-col bg-white/5 backdrop-blur-xl transition-all duration-700 rounded-[3rem] overflow-hidden border ${isHigh ? 'border-red-500/30' : 'border-white/5'} hover:border-red-500/80 hover:shadow-[0_0_80px_rgba(239,68,68,0.2)] h-full`}>
            {/* OVERLAP BADGE */}
            <div className="absolute top-8 right-8 z-20">
                <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-red-600 to-purple-700 shadow-[0_0_30px_rgba(220,38,38,0.5)] border-4 border-black/50 group-hover:scale-110 transition-transform">
                    <span className="text-white text-lg font-black leading-none">{job.similarity}%</span>
                    <span className="text-white/60 text-[8px] font-black uppercase">MATCH</span>
                </div>
            </div>

            {/* QUICK ACTIONS */}
            <div className="absolute top-8 left-8 z-20 flex gap-3">
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleLike(); }}
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center backdrop-blur-2xl border transition-all ${isLiked ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggleApply(); }}
                    className={`h-12 px-5 rounded-2xl flex items-center gap-3 backdrop-blur-2xl border transition-all text-[10px] font-black uppercase tracking-widest ${isApplied ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/40' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'}`}
                >
                    {isApplied ? <CheckCircle size={16} /> : <ClipboardList size={16} />}
                    {isApplied ? 'Applied' : 'Track'}
                </button>
            </div>

            <div className="p-10 pt-24 pb-6 relative z-10 flex-grow">
                <div className={`w-fit px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.2em] mb-6 ${isLive ? 'bg-emerald-500 text-white' : 'bg-black/40 text-gray-500 border border-white/10'}`}>
                    {isLive ? 'LIVE' : 'UPCOMING'}
                </div>
                
                <h3 className="text-3xl font-black text-white leading-[0.9] mb-4 uppercase italic tracking-tighter group-hover:text-red-500 transition-colors duration-500 pr-16">{job.job_name}</h3>
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em] mb-6">{job.organization}</p>
                <div className="pt-6 border-t border-white/5">
                    <p className="text-[11px] text-gray-400 italic leading-relaxed line-clamp-3 leading-loose">"{job.explanation}"</p>
                </div>
            </div>

            <div className="p-8 bg-black/20 backdrop-blur-md border-t border-white/5 grid grid-cols-2 gap-4 relative z-10">
                <button onClick={() => onNavigate(`/jobs/${job.id}`)} className="flex items-center justify-center gap-3 py-5 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[1.5rem] border border-white/5 transition-all">
                   <BookOpen size={16} /> Roadmap
                </button>
                <button 
                    onClick={() => { if (job.official_application_link) window.open(job.official_application_link, '_blank'); }}
                    className="py-5 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-[1.5rem] bg-gradient-to-r from-red-600 to-red-800 hover:scale-[1.05] transition-all shadow-xl shadow-red-900/30 font-black"
                >Direct Link</button>
            </div>
        </div>
    );
}

const style = document.createElement('style');
style.innerHTML = `
    @keyframes loading-bar {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
`;
document.head.appendChild(style);
