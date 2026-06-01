import { useState, useEffect } from 'react';
import { api } from '../../api';
import { CalendarDays, CheckCircle2, Circle, ChevronDown, ChevronUp, Clock, Target } from 'lucide-react';
import GovLoader from '../GovLoader';
import { useLanguage } from '../../i18n/LanguageContext';

export default function HistoryView() {
    const { t } = useLanguage();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [expandedDate, setExpandedDate] = useState<string | null>(null);
    const [dayDetails, setDayDetails] = useState<Record<string, any>>({});
    const [loadingDays, setLoadingDays] = useState<Record<string, boolean>>({});

    useEffect(() => {
        api.getTrackerHistory().then(res => {
            // Sort history descending (newest first)
            const sorted = (res?.history || []).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setHistory(sorted);
            setLoading(false);
            
            // Auto expand the most recent day if exists
            if (sorted.length > 0) {
                toggleDay(sorted[0].date);
            }
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, []);

    const toggleDay = async (date: string) => {
        if (expandedDate === date) {
            setExpandedDate(null);
            return;
        }
        
        setExpandedDate(date);
        
        if (!dayDetails[date]) {
            setLoadingDays(prev => ({ ...prev, [date]: true }));
            try {
                const res = await api.getTrackerHistoryDate(date);
                setDayDetails(prev => ({ ...prev, [date]: res }));
            } catch (e) {
                console.error(e);
            } finally {
                setLoadingDays(prev => ({ ...prev, [date]: false }));
            }
        }
    };

    if (loading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <GovLoader message={t('tracker.history.loading')} />
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
        if (score >= 70) return 'text-green-400 bg-green-500/10 border-green-500/20';
        if (score >= 40) return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
        return 'text-red-400 bg-red-500/10 border-red-500/20';
    };

    const getScoreGlow = (score: number) => {
        if (score >= 90) return 'drop-shadow-[0_0_10px_rgba(52,211,153,0.5)]';
        if (score >= 70) return 'drop-shadow-[0_0_8px_rgba(74,222,128,0.4)]';
        if (score >= 40) return 'drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]';
        return 'drop-shadow-[0_0_8px_rgba(248,113,113,0.4)]';
    };

    return (
        <div className="animate-fadeIn max-w-4xl mx-auto space-y-6 sm:space-y-8 px-4 sm:px-0">
            <div className="bg-gradient-to-br from-[#0c0c0f] to-[#070709] border border-[#1f1f25]/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>

                {/* --- Header Section --- */}
                <div className="flex flex-col mb-10 pb-6 border-b border-[#181820]/60 relative z-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                            <CalendarDays className="w-6 h-6 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                        </div>
                        {t('tracker.history.title')}
                    </h2>
                    <p className="text-gray-400 text-sm mt-3 ml-1 leading-relaxed max-w-xl">
                        A master timeline of your learning sprints, performance history, and daily logs.
                    </p>
                </div>

                {/* --- Empty State --- */}
                {history.length === 0 ? (
                    <div className="text-center py-16 text-gray-500 border-2 border-dashed border-[#1f1f28]/80 bg-[#08080c]/50 rounded-2xl flex flex-col items-center justify-center gap-4 relative z-10">
                        <div className="w-14 h-14 bg-red-500/5 rounded-full flex items-center justify-center border border-red-500/10">
                            <Clock className="w-6 h-6 text-red-500/40" />
                        </div>
                        <p className="font-semibold text-sm text-gray-400">{t('tracker.history.empty')}</p>
                    </div>
                ) : (
                    /* --- History Vertical Timeline --- */
                    <div className="relative border-l border-[#1c1c24] ml-3 sm:ml-8 space-y-6 pb-4 relative z-10">
                        {history.map((day) => {
                            const isExpanded = expandedDate === day.date;
                            const isLoading = loadingDays[day.date];
                            const detail = dayDetails[day.date];
                            const scoreColor = getScoreColor(day.productivity_score);
                            const glow = getScoreGlow(day.productivity_score);

                            return (
                                <div key={day.id} className="relative pl-6 sm:pl-10 group">
                                    {/* Timeline Connection Dot */}
                                    <div className={`absolute -left-[6px] top-6 w-3.5 h-3.5 rounded-full border-2 border-[#08080c] transition-all duration-300 ${
                                        isExpanded 
                                            ? 'bg-red-500 scale-125 shadow-[0_0_8px_rgba(239,68,68,0.8)]' 
                                            : 'bg-[#2b2b36] group-hover:bg-red-400/80 group-hover:scale-110'
                                    }`} />

                                    {/* Collapsible Card */}
                                    <div 
                                        onClick={() => toggleDay(day.date)}
                                        className={`bg-[#111116]/80 border rounded-2xl transition-all duration-300 cursor-pointer shadow-md overflow-hidden ${
                                            isExpanded 
                                                ? 'border-red-500/30 bg-[#14141d]/90 shadow-[0_4px_30px_rgba(220,38,38,0.05)]' 
                                                : 'border-[#202028]/80 hover:border-[#2f2f3d] hover:bg-[#15151c]/80'
                                        }`}
                                    >
                                        {/* Row Summary */}
                                        <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                {/* Daily Performance Score Badge */}
                                                <div className={`px-3 py-2 rounded-xl border flex flex-col items-center justify-center min-w-[64px] ${scoreColor}`}>
                                                    <span className={`text-xl font-black leading-tight ${glow}`}>{day.productivity_score}%</span>
                                                    <span className="text-[8px] uppercase tracking-widest opacity-70 font-black mt-0.5">Score</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-base sm:text-lg font-bold text-gray-100">
                                                        {new Date(day.date.replace(/-/g, '/')).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </h3>
                                                    <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-1 font-medium">
                                                        <Clock className="w-3.5 h-3.5 text-gray-600" />
                                                        {day.completed_hours} hrs studied
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="text-gray-500 pr-2">
                                                {isExpanded ? (
                                                    <ChevronUp className="w-5 h-5 text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 group-hover:text-gray-200 transition-colors" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Collapsible Content Area */}
                                        {isExpanded && (
                                            <div className="border-t border-[#181822]/80 bg-[#0a0a0d] p-5 animate-fadeIn">
                                                {isLoading ? (
                                                    <div className="py-8 flex justify-center">
                                                        <GovLoader message="Loading logs..." />
                                                    </div>
                                                ) : detail ? (
                                                    <div className="space-y-4">
                                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 pb-2 border-b border-[#181822] flex items-center gap-2">
                                                            <Target className="w-4 h-4 text-red-500/80" /> Logged Sessions
                                                        </h4>
                                                        
                                                        {detail.sessions && detail.sessions.length > 0 ? (
                                                            <div className="relative border-l border-[#1a1a24] ml-3 sm:ml-5 space-y-4">
                                                                {detail.sessions.map((session: any) => (
                                                                    <div key={session.id} className="relative pl-6 sm:pl-8 max-w-2xl">
                                                                        {/* Nested bullet dot */}
                                                                        <div className="absolute -left-[5px] top-2 bg-[#0a0a0d] p-0.5 rounded-full">
                                                                            {session.is_completed ? (
                                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 bg-[#0a0a0d] rounded-full" />
                                                                            ) : (
                                                                                <Circle className="w-3.5 h-3.5 text-gray-600 bg-[#0a0a0d] rounded-full" />
                                                                            )}
                                                                        </div>
                                                                        
                                                                        {/* Nested Card */}
                                                                        <div className={`p-4 rounded-xl border transition-all ${
                                                                            session.is_completed 
                                                                                ? 'border-emerald-950 bg-emerald-950/10' 
                                                                                : 'border-[#1a1a24]/80 bg-[#111116]/80 opacity-60'
                                                                        } shadow-[inset_0_1px_1px_rgba(255,255,255,0.01)]`}>
                                                                            <div className="flex justify-between items-start gap-3 mb-1">
                                                                                <div className={`font-semibold text-sm ${session.is_completed ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                                                                                    {session.title || 'Focus Session'}
                                                                                </div>
                                                                                {session.is_completed && (
                                                                                    <span className="text-[8px] text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-900/30 px-2 py-0.5 rounded uppercase tracking-wider">
                                                                                        {t('coach.completed') || 'Done'}
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-2 font-medium">
                                                                                <span className="bg-[#191922] px-2 py-0.5 rounded border border-[#2b2b38] text-[9px] uppercase font-bold text-gray-400">
                                                                                    {session.session_type}
                                                                                </span>
                                                                                <span>•</span>
                                                                                <span>{session.start_time} - {session.end_time}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-gray-500 italic px-4 py-3 border-l-2 border-[#1c1c24] bg-[#0c0c0f]">
                                                                No specific focus sessions logged on this day.
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="text-red-400 text-sm py-4 text-center">
                                                        Failed to load details. Please refresh.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
