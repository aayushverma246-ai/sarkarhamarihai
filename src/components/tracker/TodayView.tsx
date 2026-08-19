import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Sunrise, Moon, Target, CheckCircle2, Circle, Zap, BookOpen, Trophy } from 'lucide-react';
import GovLoader from '../GovLoader';
import { useLanguage } from '../../i18n/LanguageContext';

export default function TodayView({ user, onUpdateStats }: { user: any, stats: any, onUpdateStats: (newStats: any) => void }) {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [plan, setPlan] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);

    const [wakeTime, setWakeTime] = useState('06:00');
    const [sleepTime, setSleepTime] = useState('22:00');
    const [plannedHours, setPlannedHours] = useState(6);
    const [subjectInput, setSubjectInput] = useState('');
    const [subjects, setSubjects] = useState<string[]>([]);
    const [hasActiveTargets, setHasActiveTargets] = useState(false);

    const [generating, setGenerating] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [confirmFinish, setConfirmFinish] = useState(false);
    const [debriefInfo, setDebriefInfo] = useState<any>(null);

    useEffect(() => {
        async function fetchTodayAndTargets() {
            try {
                const [pData, targetsData] = await Promise.all([
                    api.getTrackerPlanToday(),
                    api.getTrackerTargets().catch(() => [])
                ]);
                setPlan(pData?.plan || null);
                setSessions(pData?.sessions || []);

                if (targetsData && targetsData.length > 0) {
                    setHasActiveTargets(true);
                    const allSubjects: string[] = [];
                    targetsData.forEach((t: any) => {
                        if (t.subjects && Array.isArray(t.subjects)) {
                            t.subjects.forEach((s: string) => {
                                if (!allSubjects.some(existing => existing.toLowerCase() === s.toLowerCase())) {
                                    allSubjects.push(s);
                                }
                            });
                        }
                    });
                    if (allSubjects.length > 0) {
                        setSubjects(allSubjects);
                    } else {
                        const targetNames = targetsData.map((t: any) => t.exam_name).filter(Boolean);
                        setSubjects(targetNames);
                    }
                } else {
                    setHasActiveTargets(false);
                    setSubjects([]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchTodayAndTargets();
    }, []);

    const handleAddSubject = () => {
        const input = subjectInput.trim();
        if (input && !subjects.some(s => s.toLowerCase() === input.toLowerCase())) {
            setSubjects([...subjects, input]);
            setSubjectInput('');
        }
    };

    const removeSubject = (s: string) => {
        setSubjects(subjects.filter(sub => sub !== s));
    };

    const handleGenerate = async () => {
        try {
            setGenerating(true);
            await api.generateTrackerPlan({
                wake_time: wakeTime,
                sleep_time: sleepTime,
                planned_hours: plannedHours,
                subjects,
                preferences: { sessionLength: "60 mins", breakLength: "15 mins" }
            });
            const pData = await api.getTrackerPlanToday();
            setPlan(pData?.plan || null);
            setSessions(pData?.sessions || []);
        } catch (err) {
            console.error(err);
            alert(t('tracker.today.generateFailed'));
        } finally {
            setGenerating(false);
        }
    };

    const toggleSession = async (sessionId: string, currentStatus: boolean) => {
        try {
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, is_completed: !currentStatus } : s));
            await api.toggleTrackerSession(sessionId, !currentStatus);
        } catch (err) {
            console.error(err);
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, is_completed: currentStatus } : s));
        }
    };

    const handleEvaluate = async () => {
        try {
            setEvaluating(true);
            const res = await api.evaluateTrackerPlan();
            setDebriefInfo(res);
            const pData = await api.getTrackerPlanToday();
            setPlan(pData.plan);
            const s = await api.getTrackerStats();
            onUpdateStats(s);
        } catch (err) {
            console.error(err);
            alert(t('tracker.today.generateFailed'));
        } finally {
            setEvaluating(false);
        }
    };

    if (loading) {
        return (
            <div className="py-24 flex flex-col items-center justify-center space-y-4">
                <GovLoader message={t('tracker.today.loading')} />
            </div>
        );
    }

    // --- CASE A: NO PLAN YET (FORM TO GENERATE) ---
    if (!plan) {
        return (
            <div className="animate-fadeIn max-w-3xl mx-auto space-y-6 bg-gradient-to-br from-[#0c0c0f] to-[#070709] border border-[#1f1f25]/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                <div className="text-center mb-8 relative z-10">
                    <h2 className="text-2xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 mb-3">
                        {t('tracker.today.goodMorning').replace('{name}', user?.full_name?.split(' ')[0] || t('nav.profile'))}
                    </h2>
                    <p className="text-gray-400 font-semibold text-sm sm:text-base max-w-md mx-auto leading-relaxed">{t('tracker.today.craftBlueprint')}</p>
                </div>

                {/* Wake / Sleep Time Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Sunrise className="w-4 h-4 text-yellow-500 drop-shadow-[0_0_6px_rgba(234,179,8,0.4)]" /> 
                            {t('tracker.today.wakeTime')}
                        </label>
                        <input
                            type="time"
                            value={wakeTime}
                            onChange={e => setWakeTime(e.target.value)}
                            className="w-full bg-[#08080c] border border-[#22222b] rounded-xl px-4 py-3.5 text-gray-100 font-medium focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all shadow-inner"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                            <Moon className="w-4 h-4 text-blue-400 drop-shadow-[0_0_6px_rgba(96,165,250,0.4)]" /> 
                            {t('tracker.today.sleepTime')}
                        </label>
                        <input
                            type="time"
                            value={sleepTime}
                            onChange={e => setSleepTime(e.target.value)}
                            className="w-full bg-[#08080c] border border-[#22222b] rounded-xl px-4 py-3.5 text-gray-100 font-medium focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all shadow-inner"
                        />
                    </div>
                </div>

                {/* Planned Study Hours Slider */}
                <div className="space-y-3 relative z-10 pt-2">
                    <div className="flex items-center justify-between text-xs ml-1">
                        <span className="font-bold text-gray-500 uppercase tracking-widest">{t('tracker.today.targetHours')}</span>
                        <span className="text-red-400 font-black text-sm bg-red-950/30 border border-red-900/30 px-3 py-1 rounded-lg">
                            {plannedHours} {t('prep.hours')}
                        </span>
                    </div>
                    <input
                        type="range"
                        min="1"
                        max="16"
                        step="0.5"
                        value={plannedHours}
                        onChange={e => setPlannedHours(parseFloat(e.target.value))}
                        className="w-full accent-red-500 cursor-pointer h-1.5 bg-[#08080c] border border-[#22222b] rounded-lg"
                    />
                </div>

                {/* Topics To Cover */}
                <div className="space-y-3 relative z-10 pt-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 ml-1">
                        <BookOpen className="w-4 h-4 text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]" /> 
                        {t('tracker.today.topics')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={subjectInput}
                            onChange={e => setSubjectInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                            placeholder={t('tracker.today.topicPlaceholder')}
                            className="flex-1 bg-[#08080c] border border-[#22222b] rounded-xl px-4 py-3.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all shadow-inner"
                        />
                        <button
                            onClick={handleAddSubject}
                            className="px-6 py-3.5 bg-[#111116] hover:bg-[#161622] text-gray-200 hover:text-white font-bold rounded-xl transition-all border border-[#202028] shadow-md flex items-center justify-center active:scale-95"
                        >
                            {t('tracker.today.addTopic')}
                        </button>
                    </div>

                    {/* Subject Tags list */}
                    <div className="flex flex-wrap gap-2.5 mt-3 min-h-[36px]">
                        {subjects.map(s => (
                            <span
                                key={s}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-950/20 text-red-300 border border-red-900/30 rounded-full text-xs font-semibold shadow-sm transition-all hover:bg-red-900/35"
                            >
                                {s}
                                <button
                                    onClick={() => removeSubject(s)}
                                    className="hover:text-red-400 text-gray-500 text-sm font-bold pl-1 transition-colors"
                                >
                                    &times;
                                </button>
                            </span>
                        ))}
                    </div>

                    {/* Zero Placeholder Custom Tip */}
                    {hasActiveTargets ? (
                        <p className="text-[10px] text-gray-500 italic mt-2 ml-1">
                            🚀 Automatically synced with your saved exam targets. Feel free to add more customized topics.
                        </p>
                    ) : (
                        <p className="text-[10px] text-gray-500 italic mt-2 ml-1">
                            💡 Tip: Go to the <span className="text-red-400/80 font-bold">Exam Targets</span> tab and save exams to pre-populate topics automatically with zero placeholders.
                        </p>
                    )}
                </div>

                {/* Generate Day Button */}
                <div className="pt-6 relative z-10 border-t border-[#181822]">
                    <button
                        onClick={handleGenerate}
                        disabled={generating || subjects.length === 0}
                        className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white font-bold py-4 rounded-xl hover:scale-[1.01] shadow-[0_4px_20px_rgba(220,38,38,0.2)] hover:shadow-[0_4px_30px_rgba(220,38,38,0.4)] transition-all duration-300 disabled:opacity-40 disabled:hover:scale-100"
                    >
                        {generating ? (
                            <>
                                <Zap className="w-5 h-5 animate-pulse text-yellow-400" /> 
                                {t('tracker.today.generating')}
                            </>
                        ) : (
                            <>
                                <Zap className="w-5 h-5 text-yellow-400" /> 
                                {t('tracker.today.generateDay')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // --- CASE B: PLAN IS CURRENTLY ACTIVE / PLANNED ---
    if (plan.status === 'planned') {
        return (
            <div className="animate-fadeIn max-w-3xl mx-auto px-4 sm:px-0">
                {/* Schedule Header */}
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-[#181822]">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2.5">
                        <Target className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" /> 
                        {t('tracker.today.yourSchedule')}
                    </h2>
                    <span className="px-3.5 py-1.5 bg-blue-950/30 text-blue-400 rounded-xl text-xs sm:text-sm font-semibold border border-blue-900/30">
                        {plan.planned_hours} {t('tracker.today.hrsGoal')}
                    </span>
                </div>

                {/* Chronological Timeline sessions */}
                <div className="relative border-l-2 border-[#1c1c24] ml-3 sm:ml-8 space-y-5 pb-8">
                    {sessions.map((session) => (
                        <div key={session.id} className="relative pl-6 sm:pl-10 group">
                            {/* Dot indicator */}
                            <div className="absolute -left-[11px] top-4 bg-[#080808] p-1.5 rounded-full transition-transform duration-300 group-hover:scale-110">
                                {session.is_completed ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500 bg-[#080808]" />
                                ) : session.session_type === 'break' || session.session_type === 'rest' ? (
                                    <Circle className="w-4 h-4 text-gray-600 ml-0.5 bg-[#080808]" />
                                ) : (
                                    <Circle className="w-5 h-5 text-red-500/80 bg-[#080808]" />
                                )}
                            </div>

                            <div
                                onClick={() => {
                                    if (session.session_type !== 'break' && session.session_type !== 'rest') {
                                        toggleSession(session.id, Boolean(session.is_completed));
                                    }
                                }}
                                className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                                    session.is_completed
                                        ? 'border-emerald-900/40 bg-emerald-950/10 opacity-70'
                                        : session.session_type === 'break' || session.session_type === 'rest'
                                            ? 'border-[#202028]/80 bg-[#0f0f13]/60 hover:bg-[#121217]/70'
                                            : 'border-[#22222d] bg-[#121217] hover:border-red-500/30 hover:bg-[#151520]'
                                } shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <div className="text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">
                                            {session.start_time} - {session.end_time}
                                        </div>
                                        <h3 className={`text-base sm:text-lg font-semibold transition-all ${
                                            session.is_completed 
                                                ? 'text-gray-400 line-through' 
                                                : 'text-gray-100'
                                        }`}>
                                            {session.title}
                                        </h3>
                                        
                                        {/* Status badges */}
                                        <div className="flex items-center gap-2 mt-3">
                                            <span className={`text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider font-bold border ${
                                                session.session_type === 'study' ? 'bg-blue-950/30 text-blue-400 border-blue-900/20 shadow-[0_0_8px_rgba(59,130,246,0.15)]' :
                                                session.session_type === 'mock' ? 'bg-purple-950/30 text-purple-400 border-purple-900/20 shadow-[0_0_8px_rgba(168,85,247,0.15)]' :
                                                session.session_type === 'revision' ? 'bg-orange-950/30 text-orange-400 border-orange-900/20 shadow-[0_0_8px_rgba(249,115,22,0.15)]' :
                                                'bg-[#181822]/80 text-gray-500 border-transparent'
                                            }`}>
                                                {session.session_type}
                                            </span>
                                            {session.exam_target_id && (
                                                <span className="text-[9px] px-2 py-0.5 rounded-md uppercase tracking-wider font-bold bg-[#1d1d26] text-gray-400 border border-[#2c2c3d]">
                                                    {t('tracker.tab.targets')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Checkbox box */}
                                    {session.session_type !== 'break' && session.session_type !== 'rest' && (
                                        <div className="flex-shrink-0 mt-1">
                                            <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                session.is_completed 
                                                    ? 'bg-emerald-500 border-emerald-500 text-[#0c0c0f]' 
                                                    : 'border-[#2f2f3d] text-transparent hover:border-red-500/50'
                                            }`}>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Evaluations Panel */}
                <div className="mt-8 pt-8 border-t border-[#181822] text-center">
                    {!confirmFinish ? (
                        <button
                            onClick={() => setConfirmFinish(true)}
                            disabled={evaluating}
                            className="w-full sm:w-auto px-12 py-4 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-xl transition-all duration-300 shadow-[0_4px_25px_rgba(220,38,38,0.3)] hover:scale-[1.01]"
                        >
                            {t('tracker.today.finishEval')}
                        </button>
                    ) : (
                        <div className="bg-[#121217] p-6 sm:p-8 rounded-2xl border border-red-900/30 max-w-md mx-auto animate-fadeIn shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-2xl pointer-events-none"></div>
                            <h3 className="text-xl font-bold text-white mb-2 relative z-10">{t('tracker.today.readyWrap')}</h3>
                            <p className="text-sm text-gray-400 mb-6 relative z-10 leading-relaxed">{t('tracker.today.cantEdit')}</p>
                            <div className="flex gap-4 justify-center relative z-10">
                                <button
                                    onClick={() => setConfirmFinish(false)}
                                    disabled={evaluating}
                                    className="px-6 py-3 bg-[#1c1c24] hover:bg-[#252530] text-gray-300 font-bold rounded-xl transition-colors border border-[#2d2d3a] flex-1"
                                >
                                    {t('hero.cancel')}
                                </button>
                                <button
                                    onClick={handleEvaluate}
                                    disabled={evaluating}
                                    className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold rounded-xl transition-all flex items-center justify-center min-w-[140px] flex-1 active:scale-95 shadow-md"
                                >
                                    {evaluating ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        t('tracker.today.yesFinish')
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                    {!confirmFinish && (
                        <p className="mt-4 text-xs text-gray-500 tracking-wider uppercase font-semibold">{t('tracker.today.lockWarning')}</p>
                    )}
                </div>
            </div>
        );
    }

    // --- CASE C: DAY COMPLETED (SCOREBOARD / REVIEW DEBRIEF) ---
    return (
        <div className="animate-fadeIn max-w-3xl mx-auto px-4 sm:px-0">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-emerald-500/10 rounded-full mb-5 ring-4 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
                    <Trophy className="w-12 h-12 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-bounce" />
                </div>
                <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 mb-2">
                    {t('tracker.today.dayComplete')}
                </h2>
                <p className="text-gray-400 text-sm sm:text-base font-semibold">{t('tracker.today.breakdown')}</p>
            </div>

            {/* Metrics cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
                <div className="bg-[#111116] border border-[#202028] hover:border-emerald-500/20 p-6 rounded-2xl text-center shadow-lg relative overflow-hidden transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl"></div>
                    <div className="text-4xl sm:text-5xl font-black text-emerald-400 mb-2 drop-shadow-[0_0_15px_rgba(52,211,153,0.3)]">
                        {plan.productivity_score}%
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{t('tracker.today.productivityScore')}</div>
                </div>
                <div className="bg-[#111116] border border-[#202028] hover:border-blue-500/20 p-6 rounded-2xl text-center shadow-lg relative overflow-hidden transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-xl"></div>
                    <div className="text-4xl sm:text-5xl font-black text-blue-400 mb-2 drop-shadow-[0_0_15px_rgba(96,165,250,0.3)]">
                        {plan.completed_hours}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">{t('tracker.today.hoursLogged')}</div>
                </div>
            </div>

            {/* AI Debrief panel */}
            <div className="bg-gradient-to-br from-[#121217] to-[#0c0c10] p-6 sm:p-8 rounded-2xl border border-red-950/30 relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 right-0 w-40 h-40 bg-red-600/5 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-600/5 rounded-full blur-3xl -ml-16 -mb-16"></div>

                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2.5 relative z-10">
                    <Zap className="w-5 h-5 text-yellow-400 drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]" /> 
                    {t('tracker.today.aiDebrief')}
                </h3>
                <div className="text-gray-300 leading-relaxed relative z-10 text-sm sm:text-base font-medium">
                    {debriefInfo?.debrief || "Great effort today! Remember, consistent compounding effort yields the biggest rewards. See you tomorrow."}
                </div>
            </div>
        </div>
    );
}
