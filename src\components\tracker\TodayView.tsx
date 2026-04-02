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
    const [subjects, setSubjects] = useState<string[]>(['Quantitative Aptitude', 'General Studies']);

    const [generating, setGenerating] = useState(false);
    const [evaluating, setEvaluating] = useState(false);
    const [confirmFinish, setConfirmFinish] = useState(false);
    const [debriefInfo, setDebriefInfo] = useState<any>(null);

    useEffect(() => {
        async function fetchToday() {
            try {
                const pData = await api.getTrackerPlanToday();
                setPlan(pData?.plan || null);
                setSessions(pData?.sessions || []);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        fetchToday();
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

    if (loading) return <div className="py-20 flex justify-center"><GovLoader message={t('tracker.today.loading')} /></div>;

    if (!plan) {
        return (
            <div className="animate-fadeIn max-w-2xl mx-auto space-y-6 bg-gradient-to-b from-white to-gray-50 dark:from-[#] dark:to-[#] border border-gray-300 dark:border-[#333] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="text-center mb-6 sm:mb-8 relative z-10">
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 from-gray-900 to-gray-600 mb-2">{t('tracker.today.goodMorning').replace('{name}', user?.full_name?.split(' ')[0] || t('nav.profile'))}</h2>
                    <p className="text-gray-400 font-medium text-sm">{t('tracker.today.craftBlueprint')}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Sunrise className="w-4 h-4 text-yellow-500" /> {t('tracker.today.wakeTime')}
                        </label>
                        <input
                            type="time" value={wakeTime} onChange={e => setWakeTime(e.target.value)}
                            className="w-full bg-white dark:bg-[#111] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-gray-800 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all shadow-inner"
                        />
                    </div>
                    <div className="space-y-2 relative z-10">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Moon className="w-4 h-4 text-blue-400" /> {t('tracker.today.sleepTime')}
                        </label>
                        <input
                            type="time" value={sleepTime} onChange={e => setSleepTime(e.target.value)}
                            className="w-full bg-white dark:bg-[#111] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-gray-800 dark:text-white focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all shadow-inner"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
                        <span>{t('tracker.today.targetHours')}: <span className="text-gray-800 dark:text-white font-bold">{plannedHours} {t('prep.hours')}</span></span>
                    </label>
                    <input
                        type="range" min="1" max="16" step="0.5" value={plannedHours}
                        onChange={e => setPlannedHours(parseFloat(e.target.value))}
                        className="w-full accent-red-600"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-purple-400" /> {t('tracker.today.topics')}
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text" value={subjectInput} onChange={e => setSubjectInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddSubject()}
                            placeholder={t('tracker.today.topicPlaceholder')}
                            className="flex-1 bg-white dark:bg-[#111] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-500 placeholder:text-gray-400 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all shadow-inner"
                        />
                        <button onClick={handleAddSubject} className="px-6 py-3 bg-gray-100 dark:bg-[#222] hover:bg-[#1a1a1a] dark:hover:bg-[#1a1a1a] hover:bg-gray-200 text-gray-800 dark:text-white font-bold rounded-xl transition-all border border-[#333] dark:border-[#333] hover:border-[#444] border-gray-300 shadow-lg">
                            {t('tracker.today.addTopic')}
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                        {subjects.map(s => (
                            <span key={s} className="inline-flex items-center gap-1 px-3 py-1 bg-red-900/20 text-red-200 border border-red-900/30 rounded-full text-xs">
                                {s} <button onClick={() => removeSubject(s)} className="hover:text-white ml-1">&times;</button>
                            </span>
                        ))}
                    </div>
                </div>

                <div className="pt-4 relative z-10">
                    <button
                        onClick={handleGenerate} disabled={generating || subjects.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-gray-100 to-white dark:from-gray-800 dark:to-black text-gray-900 dark:text-white font-bold py-3.5 rounded-xl hover:scale-[1.02] shadow-[0_0_20px_rgba(255,255,255,0.1)] shadow-[0_0_20px_rgba(0,0,0,0.1)] transition-all disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {generating ? <><Zap className="w-5 h-5 animate-pulse text-yellow-500" /> {t('tracker.today.generating')}</> : <><Zap className="w-5 h-5 text-yellow-500" /> {t('tracker.today.generateDay')}</>}
                    </button>
                </div>
            </div>
        );
    }

    if (plan.status === 'planned') {
        return (
            <div className="animate-fadeIn max-w-2xl mx-auto bg-transparent px-1">
                <div className="flex justify-between items-center mb-6 px-1">
                    <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2"><Target className="w-5 h-5 sm:w-6 sm:h-6 text-red-500" /> {t('tracker.today.yourSchedule')}</h2>
                    <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-blue-900/30 text-blue-400 rounded-full text-[10px] sm:text-sm font-medium border border-blue-900/50">
                        {plan.planned_hours} {t('tracker.today.hrsGoal')}
                    </span>
                </div>

                <div className="relative border-l-2 border-[#222] ml-2 md:ml-8 space-y-4 sm:space-y-6 pb-8">
                    {sessions.map((session) => (
                        <div key={session.id} className="relative pl-6 md:pl-10">
                            <div className="absolute -left-[11px] top-1.5 bg-[#080808] dark:bg-[#080808] bg-[#f1f5f9] p-1">
                                {session.is_completed ? (
                                    <CheckCircle2 className="w-6 h-6 text-green-500 bg-[#080808]" />
                                ) : session.session_type === 'break' || session.session_type === 'rest' ? (
                                    <Circle className="w-4 h-4 text-gray-500 ml-1 bg-[#080808]" />
                                ) : (
                                    <Circle className="w-5 h-5 text-red-500 bg-[#080808]" />
                                )}
                            </div>

                            <div
                                onClick={() => {
                                    if (session.session_type !== 'break' && session.session_type !== 'rest') {
                                        toggleSession(session.id, Boolean(session.is_completed));
                                    }
                                }}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${session.is_completed
                                    ? 'border-green-900/50 bg-green-900/10 opacity-70'
                                    : session.session_type === 'break' || session.session_type === 'rest'
                                        ? 'border-[#222] bg-[#111]'
                                        : 'border-[#333] bg-[#1a1a1a] hover:border-red-500/50 hover:bg-[#222]'
                                    }`}
                            >
                                <div className="flex justify-between items-start gap-4">
                                    <div>
                                        <div className="text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                                            {session.start_time} - {session.end_time}
                                        </div>
                                        <h3 className={`text-lg font-medium ${session.is_completed ? 'text-gray-400 dark:text-gray-400 text-gray-400 line-through' : 'text-gray-800 dark:text-white'}`}>
                                            {session.title}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-sm uppercase tracking-wider font-bold ${session.session_type === 'study' ? 'bg-blue-500/20 text-blue-400' :
                                                session.session_type === 'mock' ? 'bg-purple-500/20 text-purple-400' :
                                                    session.session_type === 'revision' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-gray-800 text-gray-400'
                                                }`}>
                                                {session.session_type}
                                            </span>
                                            {session.exam_target_id && (
                                                <span className="text-[10px] px-2 py-0.5 rounded-sm uppercase tracking-wider font-bold bg-[#333] text-gray-300">
                                                    {t('tracker.tab.targets')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {session.session_type !== 'break' && session.session_type !== 'rest' && (
                                        <div className="flex-shrink-0 mt-1">
                                            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${session.is_completed ? 'bg-green-500 border-green-500 text-[#080808]' : 'border-gray-500 text-transparent'
                                                }`}>
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 pt-8 border-t border-[#1a1a1a] text-center">
                    {!confirmFinish ? (
                        <button
                            onClick={() => setConfirmFinish(true)} disabled={evaluating}
                            className="w-full sm:w-auto px-12 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors disabled:opacity-50 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
                        >
                            {t('tracker.today.finishEval')}
                        </button>
                    ) : (
                        <div className="bg-white dark:bg-[#1a1a1a] p-6 rounded-xl border border-red-900/50 max-w-sm mx-auto animate-fadeIn">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{t('tracker.today.readyWrap')}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{t('tracker.today.cantEdit')}</p>
                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={() => setConfirmFinish(false)} disabled={evaluating}
                                    className="px-6 py-2 bg-gray-100 dark:bg-[#222] hover:bg-gray-200 dark:hover:bg-[#333] text-gray-800 dark:text-white font-semibold rounded-lg transition-colors border border-gray-300 dark:border-[#333]"
                                >
                                    {t('hero.cancel')}
                                </button>
                                <button
                                    onClick={handleEvaluate} disabled={evaluating}
                                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center min-w-[120px]"
                                >
                                    {evaluating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t('tracker.today.yesFinish')}
                                </button>
                            </div>
                        </div>
                    )}
                    {!confirmFinish && <p className="mt-3 text-xs text-gray-500">{t('tracker.today.lockWarning')}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn max-w-2xl mx-auto">
            <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full mb-4 ring-4 ring-green-500/20">
                    <Trophy className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">{t('tracker.today.dayComplete')}</h2>
                <p className="text-gray-400">{t('tracker.today.breakdown')}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#1a1a1a] text-center shadow-sm">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{plan.productivity_score}%</div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">{t('tracker.today.productivityScore')}</div>
                </div>
                <div className="bg-white dark:bg-[#111] p-6 rounded-xl border border-gray-200 dark:border-[#1a1a1a] text-center shadow-sm">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white mb-1">{plan.completed_hours}</div>
                    <div className="text-sm text-gray-500 uppercase tracking-wider font-semibold">{t('tracker.today.hoursLogged')}</div>
                </div>
            </div>

            <div className="bg-white dark:bg-[#111] p-6 sm:p-8 rounded-xl border border-red-900/30 dark:border-red-900/30 border-red-200 relative overflow-hidden group shadow-sm">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 dark:bg-red-600/5 bg-red-600/10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-600/5 dark:bg-blue-600/5 bg-blue-600/10 rounded-full blur-3xl -ml-10 -mb-10"></div>

                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2 relative z-10">
                    <Zap className="w-5 h-5 text-yellow-500" /> {t('tracker.today.aiDebrief')}
                </h3>
                <div className="text-gray-700 dark:text-gray-300 leading-relaxed relative z-10 font-medium">
                    {debriefInfo?.debrief || "Great effort today! Remember, consistent compounding effort yields the biggest rewards. See you tomorrow."}
                </div>
            </div>
        </div>
    );
}
