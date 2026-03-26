// ── Preparation Dashboard Widgets ──
// Readiness Score, AI Coach Panel, Nationwide Comparison
// All data sourced from existing tracker API endpoints

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useLanguage } from '../i18n/LanguageContext';

interface TrackerStats {
    current_streak: number;
    longest_streak: number;
    total_study_hours: number;
    overall_readiness_score: number;
    target_probability: number;
    days_studied_this_week?: number;
    exam_countdowns?: { exam_name: string; days_left: number; syllabus_pct: number }[];
    weak_subjects?: { exam_name: string; syllabus_pct: number }[];
    readiness_explanation?: string;
}

interface TrackerTarget {
    id: string;
    exam_name: string;
    exam_date: string | null;
    syllabus_completed_pct: number;
}

interface TodayPlan {
    plan: { planned_hours: number; completed_hours: number; productivity_score: number; status: string } | null;
    sessions: any[];
}

export default function PrepWidgets({ hideStudyCard = false, onWidgetClick }: { hideStudyCard?: boolean, onWidgetClick?: (tab: 'targets' | 'today' | 'history') => void }) {
    const navigate = useNavigate();
    const { t } = useLanguage();
    const [stats, setStats] = useState<TrackerStats | null>(null);
    const [targets, setTargets] = useState<TrackerTarget[]>([]);
    const [todayPlan, setTodayPlan] = useState<TodayPlan | null>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [coachReason, setCoachReason] = useState<string | null>(null);
    const [comparisonExpanded, setComparisonExpanded] = useState(false);

    useEffect(() => {
        Promise.all([
            api.getTrackerStats().catch(() => null),
            api.getTrackerTargets().catch(() => []),
            api.getTrackerPlanToday().catch(() => null),
            api.getTrackerHistory().catch(() => ({ history: [] })),
        ]).then(([s, tg, tp, hist]) => {
            setStats(s);
            setTargets(tg || []);
            setTodayPlan(tp);
            setHistory(hist?.history || []);
            setLoaded(true);
        });
    }, []);

    if (!loaded) return null;

    const hasData = stats && (stats.total_study_hours > 0 || stats.current_streak > 0 || targets.length > 0);

    // Compute percentile from hours (simulated based on national average of ~3 hours/day)
    const totalHours = stats?.total_study_hours || 0;
    const daysSinceStart = Math.max(1, Math.floor(totalHours / 3) || 1);
    const avgDailyHours = totalHours / daysSinceStart;
    const nationalAvgDaily = 2.5; // Indian aspirant average
    const percentile = Math.min(99, Math.max(1, Math.floor(50 + (avgDailyHours - nationalAvgDaily) * 15)));

    const streakDays = stats?.current_streak || 0;
    const readinessScore = stats?.overall_readiness_score || 0;
    const clearanceProb = stats?.target_probability || 0;

    // Consistency badge
    const consistencyLabel = streakDays >= 7 ? t('prep.aboveAvg') : streakDays >= 3 ? t('prep.average') : t('prep.belowAvg');
    const consistencyColor = streakDays >= 7 ? 'text-green-400' : streakDays >= 3 ? 'text-yellow-400' : 'text-red-400';

    // Coach data
    const plan = todayPlan?.plan;
    const plannedH = plan?.planned_hours || 0;
    const completedH = plan?.completed_hours || 0;
    const productivityPct = plan?.productivity_score || 0;
    const planCompleted = plan?.status === 'completed';
    const showCoach = plan && plannedH > 0;

    return (
        <div className="space-y-4 mb-5">
            {/* ── Readiness Score Cards ── */}
            {hasData ? (
                <div className="grid grid-cols-2 lg:grid-cols-2 gap-3">
                    {/* Readiness Score */}
                    <div
                        onClick={() => onWidgetClick ? onWidgetClick('targets') : navigate('/tracker?tab=targets')}
                        className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-3 hover:border-green-900/40 transition-all duration-300 cursor-pointer hover:scale-[1.02]" style={{ animationDelay: '0ms' }}>
                        <p className="text-[9px] text-green-700 uppercase tracking-wide">{t('prep.readinessScore')}</p>
                        <div className="flex items-end gap-1 mt-1">
                            <span className={`text-2xl font-bold ${readinessScore >= 70 ? 'text-green-400' : readinessScore >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                {readinessScore}%
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${readinessScore >= 70 ? 'bg-green-500' : readinessScore >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${readinessScore}%` }}
                            />
                        </div>
                    </div>

                    {/* Study Streak */}
                    <div
                        onClick={() => onWidgetClick ? onWidgetClick('history') : navigate('/tracker?tab=history')}
                        className="bg-[#0b0b0b] relative overflow-hidden rounded-lg border border-[#1a1a1a] p-3 hover:border-orange-500/40 transition-all duration-300 cursor-pointer hover:scale-[1.02] shadow-lg group flex flex-col justify-between" style={{ animationDelay: '50ms' }}>
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-orange-500/10 rounded-full blur-xl group-hover:bg-orange-500/20 transition-all duration-500 pointer-events-none"></div>
                        <p className="text-[9px] text-orange-600 font-bold uppercase tracking-wider relative z-10">{t('prep.streak')}</p>
                        <div className="flex items-end gap-1.5 mt-1 relative z-10 flex-1">
                            <span className={`text-3xl pr-2 font-black text-transparent bg-clip-text bg-gradient-to-br from-orange-400 to-red-500 ${streakDays >= 3 ? 'drop-shadow-[0_0_20px_rgba(249,115,22,0.4)]' : ''}`}>
                                <span className={streakDays > 0 ? 'inline-block origin-bottom animate-pulse' : ''}>🔥</span> {streakDays}
                            </span>
                            <span className="text-[10px] text-orange-500/60 font-bold mb-1.5 tracking-widest uppercase">{t('prep.days')}</span>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-orange-900/20 relative z-10 w-full">
                            <div className="flex items-center gap-1.5">
                                <span className="text-orange-500 text-[10px]">🏆</span>
                                <p className="text-[9px] text-orange-500/80 font-bold tracking-wider uppercase">Longest</p>
                            </div>
                            <p className="text-xs font-black text-orange-400">{stats?.longest_streak || 0} <span className="text-[9px] opacity-70">days</span></p>
                        </div>
                    </div>

                    {/* Study Consistency */}
                    <div
                        onClick={() => onWidgetClick ? onWidgetClick('history') : navigate('/tracker?tab=history')}
                        className="bg-[#0b0b0b] relative overflow-hidden rounded-lg border border-[#1a1a1a] p-3 hover:border-emerald-500/40 transition-all duration-300 cursor-pointer hover:scale-[1.02] shadow-lg group" style={{ animationDelay: '100ms' }}>
                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all duration-500 pointer-events-none"></div>
                        <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider relative z-10">{t('prep.studyConsistency')}</p>
                        <div className="flex items-center gap-1.5 mt-2 relative z-10">
                            {[0, 1, 2, 3, 4, 5, 6].map(d => {
                                const isDone = d < (stats?.days_studied_this_week || 0);
                                return (
                                    <div key={d} className={`w-3.5 h-3.5 rounded-[4px] border ${
                                        isDone
                                            ? 'bg-gradient-to-br from-emerald-400 to-green-600 border-emerald-400/50 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]'
                                            : 'bg-[#111] border-[#222]'
                                        } transition-all duration-500 delay-[${d * 50}ms]`} />
                                );
                            })}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-2 relative z-10">
                            <span className="text-emerald-500 font-black">{stats?.days_studied_this_week || 0}</span> {t('prep.daysThisWeek')}
                        </p>
                    </div>

                    {/* Clearance Probability */}
                    <div
                        onClick={() => onWidgetClick ? onWidgetClick('targets') : navigate('/tracker?tab=targets')}
                        className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-3 hover:border-purple-900/40 transition-all duration-300 cursor-pointer hover:scale-[1.02]" style={{ animationDelay: '150ms' }}>
                        <p className="text-[9px] text-purple-700 uppercase tracking-wide">{t('prep.clearanceProb')}</p>
                        <div className="flex items-end gap-1.5 mt-1">
                            <span className={`text-2xl font-bold ${clearanceProb >= 60 ? 'text-purple-400' : 'text-purple-600'}`}>
                                {clearanceProb}%
                            </span>
                        </div>
                        <div className="mt-2 h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 ease-out ${clearanceProb >= 60 ? 'bg-purple-500' : 'bg-purple-700'}`}
                                style={{ width: `${clearanceProb}%` }}
                            />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-900/20 flex items-center justify-center text-lg">📊</div>
                        <div>
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-300">{t('prep.readiness')}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{t('prep.noTargets')}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/tracker')}
                        className="px-3 py-1.5 bg-green-900/30 text-green-400 text-xs font-medium rounded-lg hover:bg-green-900/50 transition-colors"
                    >
                        {t('prep.goToTracker')}
                    </button>
                </div>
            )}

            {/* ── Target Exams Progress ── */}
            {targets.length > 0 && (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🎯</span>
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('prep.readiness')}</h3>
                    </div>
                    <div className="space-y-2.5">
                        {targets.map(tgt => {
                            const pct = tgt.syllabus_completed_pct || 0;
                            const daysLeft = tgt.exam_date
                                ? Math.max(0, Math.ceil((new Date(tgt.exam_date).getTime() - Date.now()) / (86400000)))
                                : null;
                            return (
                                <div key={tgt.id} className="flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs text-gray-800 dark:text-gray-300 font-medium truncate">{tgt.exam_name}</span>
                                            <span className="text-[10px] text-gray-500 dark:text-gray-500 ml-2 whitespace-nowrap">
                                                {daysLeft !== null ? `${daysLeft}d left` : ''}
                                            </span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                    <span className={`text-xs font-bold min-w-[40px] text-right ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        {pct}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Exam Countdown Badges ── */}
            {stats?.exam_countdowns && stats.exam_countdowns.length > 0 && (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4 animate-fadeIn">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">⏰</span>
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('prep.examCountdown')}</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {stats.exam_countdowns.map((ec, i) => (
                            <div key={i} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${ec.days_left <= 30 ? 'bg-red-950/30 border-red-900/40 text-red-400' :
                                ec.days_left <= 90 ? 'bg-amber-950/30 border-amber-900/40 text-amber-400' :
                                    'bg-blue-950/30 border-blue-900/40 text-blue-400'
                                }`}>
                                <span className="text-xs font-medium truncate max-w-[120px]">{ec.exam_name}</span>
                                <span className={`text-lg font-bold ${ec.days_left <= 30 ? 'text-red-300' : ec.days_left <= 90 ? 'text-amber-300' : 'text-blue-300'}`}>
                                    {ec.days_left}
                                </span>
                                <span className="text-[10px] opacity-70">{t('prep.daysRemaining')}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Weak Subject Warnings ── */}
            {stats?.weak_subjects && stats.weak_subjects.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/10 rounded-lg border border-red-200 dark:border-red-900/30 p-4 animate-fadeIn">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">⚠️</span>
                        <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">{t('prep.weakSubjects')}</h3>
                    </div>
                    <div className="space-y-2">
                        {stats.weak_subjects.map((ws, i) => (
                            <div key={i} className="flex items-center justify-between">
                                <span className="text-xs text-gray-800 dark:text-gray-300 truncate">{ws.exam_name}</span>
                                <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                                        <div className="h-full bg-red-500 rounded-full transition-all duration-500" style={{ width: `${ws.syllabus_pct}%` }} />
                                    </div>
                                    <span className="text-xs font-bold text-red-400">{Math.round(ws.syllabus_pct)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Total Hours / Study Insights ── */}
            {hasData && (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4 animate-fadeIn">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">⏳</span>
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">{t('prep.totalHours')} & Insights</h3>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-2xl font-bold text-blue-400">{totalHours.toFixed(1)} <span className="text-sm text-gray-500 dark:text-gray-500 font-medium">{t('prep.hours')}</span></p>
                            <p className="text-[10px] text-gray-500 dark:text-gray-500 mt-1">Accrued over your preparation journey.</p>
                        </div>
                        {stats?.readiness_explanation && (
                            <div className="flex-1 bg-blue-950/10 border border-blue-900/20 p-2.5 rounded text-[10px] text-gray-600 dark:text-gray-400 italic">
                                "{t('prep.readinessExplanation')}"
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Nationwide Comparison (Expandable) ── */}
            {hasData && (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] overflow-hidden">
                    <button
                        onClick={() => setComparisonExpanded(!comparisonExpanded)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:bg-[#111] transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-sm">🏆</span>
                            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('prep.comparison')}</h3>
                        </div>
                        <svg className={`w-4 h-4 text-gray-500 dark:text-gray-500 transition-transform ${comparisonExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>

                    {comparisonExpanded && (
                        <div className="px-4 pb-4 grid grid-cols-3 gap-3 border-t border-[#1a1a1a] pt-3">
                            <div className="text-center">
                                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{t('prep.percentile')}</p>
                                <p className="text-lg font-bold text-cyan-400 mt-1">Top {100 - percentile}%</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{t('prep.weeklyRank')}</p>
                                <p className="text-lg font-bold text-amber-400 mt-1">#{Math.max(1, Math.floor(1000 * (1 - percentile / 100)))}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{t('prep.consistency')}</p>
                                <p className={`text-sm font-bold mt-1 ${consistencyColor}`}>{consistencyLabel}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── AI Accountability Coach ── */}
            {showCoach && (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🧠</span>
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('coach.title')}</h3>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-4 mb-3">
                        <div className="flex-1">
                            <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-500 mb-1">
                                <span>{t('coach.planned')}: {plannedH}h</span>
                                <span>{t('coach.completed')}: {completedH.toFixed(1)}h</span>
                            </div>
                            <div className="h-2 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-700 ${productivityPct >= 80 ? 'bg-green-500' : productivityPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                    style={{ width: `${Math.min(100, productivityPct)}%` }}
                                />
                            </div>
                        </div>
                        <span className={`text-lg font-bold ${productivityPct >= 80 ? 'text-green-400' : productivityPct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {productivityPct}%
                        </span>
                    </div>

                    {/* Quick reason selector (if productivity < 80%) */}
                    {planCompleted && productivityPct < 80 && !coachReason && (
                        <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{t('coach.whyMissed')}</p>
                            <div className="flex flex-wrap gap-1.5">
                                {[
                                    { key: 'lazy', label: t('coach.lazy') },
                                    { key: 'busy', label: t('coach.busy') },
                                    { key: 'sick', label: t('coach.sick') },
                                    { key: 'emergency', label: t('coach.emergency') },
                                ].map(r => (
                                    <button
                                        key={r.key}
                                        onClick={() => setCoachReason(r.key)}
                                        className="px-2.5 py-1.5 text-xs bg-gray-100 dark:bg-[#1a1a1a] border border-[#252525] rounded-lg text-gray-600 dark:text-gray-400 hover:text-white hover:border-[#333] transition-colors"
                                    >
                                        {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Motivational message after selection */}
                    {coachReason && (
                        <div className="bg-gray-50 dark:bg-[#111] rounded-lg p-3 border border-[#1a1a1a]">
                            <p className="text-xs text-gray-800 dark:text-gray-300 leading-relaxed">
                                {t('coach.motivational')}
                            </p>
                        </div>
                    )}

                    {/* Celebration for high productivity */}
                    {planCompleted && productivityPct >= 80 && (
                        <div className="bg-green-900/10 rounded-lg p-3 border border-green-900/30">
                            <p className="text-xs text-green-400 font-medium">{t('coach.great')}</p>
                            <p className="text-xs text-green-600 mt-1">{t('coach.celebrate')}</p>
                        </div>
                    )}
                </div>
            )}

            {/* ── Today's Study Plan Quick Card (hidden on Tracker page) ── */}
            {!hideStudyCard && (() => {
                const sessions = todayPlan?.sessions || [];
                const studySessions = sessions.filter((s: any) => s.session_type !== 'break' && s.session_type !== 'rest');
                const completedSessions = studySessions.filter((s: any) => s.is_completed);
                const hasPlan = todayPlan?.plan;

                return (
                    <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="text-sm">📅</span>
                            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('prep.studyToday')}</h3>
                        </div>
                        {hasPlan ? (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-600 dark:text-gray-400">
                                        {completedSessions.length}/{studySessions.length} {t('tracker.today.sessions')}
                                    </span>
                                    <span className={`text-xs font-bold ${completedSessions.length === studySessions.length && studySessions.length > 0 ? 'text-green-400' : 'text-gray-500 dark:text-gray-500'}`}>
                                        {studySessions.length > 0 ? Math.round((completedSessions.length / studySessions.length) * 100) : 0}%
                                    </span>
                                </div>
                                <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-cyan-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${studySessions.length > 0 ? (completedSessions.length / studySessions.length) * 100 : 0}%` }}
                                    />
                                </div>
                                {studySessions.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                        {studySessions.slice(0, 3).map((s: any, i: number) => (
                                            <div key={i} className="flex items-center gap-2 text-[11px]">
                                                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[8px] ${s.is_completed ? 'bg-green-900/30 text-green-400' : 'bg-gray-100 dark:bg-[#1a1a1a] text-gray-600'}`}>
                                                    {s.is_completed ? '✓' : '○'}
                                                </span>
                                                <span className={`truncate ${s.is_completed ? 'text-gray-500 dark:text-gray-500 line-through' : 'text-gray-600 dark:text-gray-400'}`}>
                                                    {s.title}
                                                </span>
                                                <span className="text-gray-700 ml-auto whitespace-nowrap">{s.start_time}</span>
                                            </div>
                                        ))}
                                        {studySessions.length > 3 && (
                                            <p className="text-[10px] text-gray-600 pl-5">+{studySessions.length - 3} more</p>
                                        )}
                                    </div>
                                )}
                                <button
                                    onClick={() => navigate('/tracker')}
                                    className="mt-3 w-full py-1.5 text-xs text-cyan-400 bg-cyan-900/10 border border-cyan-900/30 rounded-lg hover:bg-cyan-900/20 transition-colors"
                                >
                                    {t('nav.tracker')} →
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-3">
                                <p className="text-xs text-gray-500 dark:text-gray-500 mb-2">{t('prep.noPlansYet')}</p>
                                <button
                                    onClick={() => navigate('/tracker')}
                                    className="px-4 py-1.5 bg-cyan-900/30 text-cyan-400 text-xs font-medium rounded-lg hover:bg-cyan-900/50 transition-colors"
                                >
                                    {t('prep.generatePlan')}
                                </button>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* ── Subject-wise Readiness with Weak Alerts ── */}
            {targets.length > 0 && (
                <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">📚</span>
                        <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('prep.subjectWise')}</h3>
                    </div>
                    <div className="space-y-3">
                        {targets.map(tgt => {
                            const pct = tgt.syllabus_completed_pct || 0;
                            const isWeak = pct < 30;
                            const daysLeft = tgt.exam_date
                                ? Math.max(0, Math.ceil((new Date(tgt.exam_date).getTime() - Date.now()) / 86400000))
                                : null;

                            // Estimated completion: based on current progress rate
                            let estCompletion = '';
                            if (pct > 0 && pct < 100 && totalHours > 0) {
                                const remainingPct = 100 - pct;
                                const daysActive = Math.max(1, Math.floor(totalHours / 2)); // rough estimate of active days
                                const dailyPctRate = pct / daysActive;
                                if (dailyPctRate > 0) {
                                    const daysToComplete = Math.ceil(remainingPct / dailyPctRate);
                                    const completionDate = new Date(Date.now() + daysToComplete * 86400000);
                                    estCompletion = completionDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
                                }
                            }

                            return (
                                <div key={tgt.id} className={`rounded-lg p-3 border ${isWeak ? 'border-red-900/40 bg-red-50 dark:bg-red-950/10' : 'border-[#1a1a1a] bg-gray-50 dark:bg-[#111]'}`}>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs text-gray-800 dark:text-gray-300 font-medium truncate">{tgt.exam_name}</span>
                                            {isWeak && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-red-900/30 text-red-400 rounded font-bold flex-shrink-0">
                                                    ⚠ {t('prep.weakAlert')}
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-xs font-bold ${pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {pct}%
                                        </span>
                                    </div>
                                    <div className="h-1.5 bg-gray-100 dark:bg-[#1a1a1a] rounded-full overflow-hidden mb-1.5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] text-gray-600">
                                        <span>{daysLeft !== null ? `${daysLeft}d left` : ''}</span>
                                        {estCompletion && (
                                            <span className="text-gray-500 dark:text-gray-500">
                                                {t('prep.estimatedCompletion')}: {estCompletion}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Weekly Improvement Indicator ── */}
            {(() => {
                if (history.length < 2) return null;
                const now = new Date();
                const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
                const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

                const thisWeek = history.filter((h: any) => new Date(h.date) >= oneWeekAgo);
                const lastWeek = history.filter((h: any) => {
                    const d = new Date(h.date);
                    return d >= twoWeeksAgo && d < oneWeekAgo;
                });

                if (lastWeek.length === 0) return null;

                const avgThis = thisWeek.length > 0
                    ? thisWeek.reduce((acc: number, h: any) => acc + (h.productivity_score || 0), 0) / thisWeek.length
                    : 0;
                const avgLast = lastWeek.reduce((acc: number, h: any) => acc + (h.productivity_score || 0), 0) / lastWeek.length;

                const diff = Math.round(avgThis - avgLast);
                const isUp = diff > 0;
                const isFlat = diff === 0;

                return (
                    <div className="bg-white dark:bg-[#0e0e0e] rounded-lg border border-gray-200 dark:border-[#141414] p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">📈</span>
                            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-300 uppercase tracking-wider">{t('prep.weeklyImprovement')}</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isUp ? 'bg-green-900/20' : isFlat ? 'bg-gray-800' : 'bg-red-900/20'}`}>
                                {isUp ? '↑' : isFlat ? '→' : '↓'}
                            </div>
                            <div>
                                <p className={`text-lg font-bold ${isUp ? 'text-green-400' : isFlat ? 'text-gray-600 dark:text-gray-400' : 'text-red-400'}`}>
                                    {isUp ? '+' : ''}{diff}%
                                </p>
                                <p className="text-[10px] text-gray-600">
                                    vs last week ({Math.round(avgLast)}% → {Math.round(avgThis)}%)
                                </p>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
