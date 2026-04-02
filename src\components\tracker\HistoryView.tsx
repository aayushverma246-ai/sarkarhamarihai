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

    if (loading) return <div className="text-center py-20"><GovLoader message={t('tracker.history.loading')} /></div>;

    const getScoreColor = (score: number) => {
        if (score >= 90) return 'text-green-500 bg-green-500/10 border-green-500/20';
        if (score >= 70) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
        if (score >= 40) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
        return 'text-red-500 bg-red-500/10 border-red-500/20';
    };

    const getScoreGlow = (score: number) => {
        if (score >= 90) return 'drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]';
        if (score >= 70) return 'drop-shadow-[0_0_5px_rgba(16,185,129,0.4)]';
        if (score >= 40) return 'drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]';
        return 'drop-shadow-[0_0_5px_rgba(239,68,68,0.4)]';
    };

    return (
        <div className="animate-fadeIn max-w-4xl mx-auto space-y-6 sm:space-y-8 px-1 sm:px-0">
            <div className="bg-[#0b0b0b] border border-[#1a1a1a] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="flex flex-col mb-10 relative z-10">
                    <h2 className="text-2xl font-bold text-gray-200 flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-red-900/20 border border-red-900/30 shadow-inner">
                            <CalendarDays className="w-5 h-5 text-red-500" />
                        </div>
                        {t('tracker.history.title')}
                    </h2>
                    <p className="text-gray-400 font-medium text-sm mt-2 ml-1">Chronological record of your preparation journey.</p>
                </div>

                {history.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-[#222] rounded-xl flex flex-col items-center gap-3">
                         <Clock className="w-8 h-8 opacity-50" />
                        {t('tracker.history.empty')}
                    </div>
                ) : (
                    <div className="relative border-l-2 border-[#1a1a1a] ml-4 sm:ml-8 space-y-8 pb-4">
                        {history.map((day) => {
                            const isExpanded = expandedDate === day.date;
                            const isLoading = loadingDays[day.date];
                            const detail = dayDetails[day.date];
                            const scoreColor = getScoreColor(day.productivity_score);
                            const glow = getScoreGlow(day.productivity_score);

                            return (
                                <div key={day.id} className="relative pl-6 sm:pl-10 group">
                                    {/* Timeline dot */}
                                    <div className={`absolute -left-[11px] top-6 w-5 h-5 rounded-full border-4 border-[#0b0b0b] transition-all duration-300 ${isExpanded ? 'bg-red-500 scale-125' : 'bg-[#333] group-hover:bg-red-400 group-hover:scale-110'}`} />

                                    {/* Day Card */}
                                    <div 
                                        onClick={() => toggleDay(day.date)}
                                        className={`bg-[#111] border rounded-2xl transition-all duration-300 cursor-pointer shadow-sm overflow-hidden 
                                            ${isExpanded ? 'border-red-900/40 shadow-red-900/10' : 'border-[#1a1a1a] hover:border-[#333] hover:bg-[#141414]'}`}
                                    >
                                        {/* Header / Summary */}
                                        <div className="p-5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`px-3 py-1.5 rounded-lg border flex flex-col items-center justify-center min-w-[60px] ${scoreColor}`}>
                                                    <span className={`text-xl font-bold leading-tight ${glow}`}>{day.productivity_score}%</span>
                                                    <span className="text-[9px] uppercase tracking-wider opacity-80 font-semibold">Score</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-bold text-gray-200">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</h3>
                                                    <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {day.completed_hours} hrs studied
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            <div className="text-gray-500 ml-auto mr-2">
                                                {isExpanded ? <ChevronUp className="w-5 h-5 text-red-500" /> : <ChevronDown className="w-5 h-5 group-hover:text-gray-300 transition-colors" />}
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {isExpanded && (
                                            <div className="border-t border-[#1a1a1a] bg-[#0a0a0a] p-5 animate-in slide-in-from-top-2 fade-in duration-200">
                                                {isLoading ? (
                                                    <div className="py-6 flex justify-center"><GovLoader message="Loading sessions..." /></div>
                                                ) : detail ? (
                                                    <div className="space-y-6">
                                                        {/* Sessions Nested Timeline */}
                                                        <div>
                                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 border-b border-[#1a1a1a] pb-2 flex items-center gap-2">
                                                                <Target className="w-4 h-4" /> Logged Sessions
                                                            </h4>
                                                            
                                                            {detail.sessions && detail.sessions.length > 0 ? (
                                                                <div className="relative border-l border-[#222] ml-4 md:ml-6 space-y-4">
                                                                    {detail.sessions.map((session: any) => (
                                                                        <div key={session.id} className="relative pl-6 sm:pl-8 max-w-2xl">
                                                                            <div className="absolute -left-[9px] top-1.5 bg-[#0a0a0a] p-0.5 rounded-full">
                                                                                {session.is_completed ? (
                                                                                    <CheckCircle2 className="w-4 h-4 text-emerald-500/80 bg-emerald-900/20 rounded-full" />
                                                                                ) : (
                                                                                    <Circle className="w-4 h-4 text-gray-600 bg-[#111] rounded-full" />
                                                                                )}
                                                                            </div>
                                                                            
                                                                            <div className={`p-3.5 rounded-xl border transition-all ${session.is_completed ? 'border-emerald-900/30 bg-emerald-950/10' : 'border-[#1a1a1a] bg-[#111] opacity-70'}`}>
                                                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                                                    <div className={`font-semibold text-sm ${session.is_completed ? 'text-gray-200' : 'text-gray-500 line-through'}`}>
                                                                                        {session.title || 'Focus Session'}
                                                                                    </div>
                                                                                    {session.is_completed && <span className="text-[10px] text-emerald-500 font-bold bg-emerald-950/30 px-1.5 py-0.5 rounded uppercase">{t('coach.completed') || 'Done'}</span>}
                                                                                </div>
                                                                                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                                                                    <span className="bg-[#1a1a1a] px-1.5 py-0.5 rounded text-[10px] uppercase font-medium border border-[#252525]">{session.session_type}</span>
                                                                                    <span>• {session.start_time} - {session.end_time}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div className="text-sm text-gray-600 italic px-4 py-2 border-l-2 border-gray-800">No specific sessions logged this day.</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-600 text-sm py-4 text-center">Failed to load details.</div>
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
