import { useState, useEffect } from 'react';
import { api } from '../api';
import Navbar from '../components/Navbar';
import GovLoader from '../components/GovLoader';
import {
    Target, CalendarDays, Crosshair, LayoutDashboard, Sparkles, X, MessageSquare
} from 'lucide-react';
import TodayView from '../components/tracker/TodayView';
import TargetsView from '../components/tracker/TargetsView';
import HistoryView from '../components/tracker/HistoryView';
import PrepWidgets from '../components/PrepWidgets';
import { useLanguage } from '../i18n/LanguageContext';

export default function TrackerPage() {
    const { t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'targets' | 'today' | 'history'>('targets');
    const [showAI, setShowAI] = useState(false);

    useEffect(() => {
        async function init() {
            try {
                const [me, s] = await Promise.all([
                    api.getMe(),
                    api.getTrackerStats()
                ]);
                setUser(me);
                setStats(s);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#080808]">
                <Navbar user={user} />
                <div className="flex h-[calc(100vh-56px)] items-center justify-center">
                    <GovLoader message={t('tracker.today.loading')} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#080808] text-gray-200">
            <Navbar user={user} />

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* ── Header ── */}
                <div className="mb-8 animate-fadeIn">
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 flex items-center gap-4">
                        <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shadow-inner">
                            <Target className="w-6 h-6 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                        </div>
                        {t('tracker.title')}
                    </h1>
                    <p className="text-sm font-medium text-gray-400 mt-2 ml-1">
                        {t('tracker.subtitle')}
                    </p>
                </div>

                {/* ── Top Section: Key Metrics ── */}
                <div className="mb-8 animate-fadeIn" style={{ animationDelay: '100ms' }}>
                    <PrepWidgets hideStudyCard={true} onWidgetClick={setActiveTab} />
                </div>

                {/* ── Middle Section: Step-wise Tabs ── */}
                <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
                    <div className="flex gap-2 mb-6 bg-[#0a0a0a] p-1.5 rounded-2xl border border-[#1a1a1a] w-fit overflow-x-auto max-w-full shadow-inner relative z-20">
                        <button
                            onClick={() => setActiveTab('targets')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'targets' ? 'bg-gradient-to-r from-red-600/20 to-red-600/5 text-red-500 border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.15)]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a] border border-transparent'}`}
                        >
                            <Crosshair className={`w-4 h-4 ${activeTab === 'targets' ? 'drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]' : ''}`} />
                            1. {t('tracker.tab.targets')}
                        </button>
                        <button
                            onClick={() => setActiveTab('today')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'today' ? 'bg-gradient-to-r from-blue-600/20 to-blue-600/5 text-blue-500 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a] border border-transparent'}`}
                        >
                            <LayoutDashboard className={`w-4 h-4 ${activeTab === 'today' ? 'drop-shadow-[0_0_5px_rgba(59,130,246,0.8)]' : ''}`} />
                            2. {t('tracker.tab.today')}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${activeTab === 'history' ? 'bg-gradient-to-r from-purple-600/20 to-purple-600/5 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'text-gray-400 hover:text-gray-200 hover:bg-[#1a1a1a] border border-transparent'}`}
                        >
                            <CalendarDays className={`w-4 h-4 ${activeTab === 'history' ? 'drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]' : ''}`} />
                            3. {t('tracker.tab.history')}
                        </button>
                    </div>

                    {/* ── View Render Area ── */}
                    <div className="pb-24">
                        {activeTab === 'today' && <TodayView user={user} stats={stats} onUpdateStats={setStats} />}
                        {activeTab === 'targets' && <TargetsView />}
                        {activeTab === 'history' && <HistoryView />}
                    </div>
                </div>

                {/* ── Floating AI Assistant ── */}
                <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
                    {showAI && (
                        <div className="bg-[#111]/90 dark:bg-[#111]/90 light-mode:bg-white/90 backdrop-blur-md border border-red-900/50 dark:border-red-900/50 light-mode:border-red-200 shadow-2xl shadow-red-900/20 light-mode:shadow-red-900/10 rounded-2xl p-5 mb-4 w-72 sm:w-80 animate-in slide-in-from-bottom-5">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-white dark:text-white light-mode:text-gray-900 font-bold flex items-center gap-2">
                                    <Sparkles className="w-4 h-4 text-yellow-500 animate-pulse" /> {t('tracker.ai.mentor.title')}
                                </h3>
                                <button onClick={() => setShowAI(false)} className="text-gray-500 hover:text-white dark:hover:text-white light-mode:hover:text-gray-900 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-sm text-gray-300 dark:text-gray-300 light-mode:text-gray-700 space-y-3 font-medium">
                                <p>{t('tracker.ai.greeting')}</p>
                                {(stats?.current_streak || 0) < 3 && <p className="text-red-400 dark:text-red-400 light-mode:text-red-600">⚠️ {t('tracker.ai.lowStreak')}</p>}
                                <p className={`font-bold ${(stats?.target_probability || 0) >= 70 ? 'text-green-400 dark:text-green-400 light-mode:text-green-600' : (stats?.target_probability || 0) >= 40 ? 'text-yellow-400 dark:text-yellow-400 light-mode:text-yellow-600' : 'text-red-400 dark:text-red-400 light-mode:text-red-600'}`}>
                                    🎯 {t('prep.clearanceProb')}: {stats?.target_probability || 0}%
                                </p>
                                {(stats?.total_study_hours || 0) > 50 && <p className="text-blue-400 dark:text-blue-400 light-mode:text-blue-600">📚 {t('tracker.ai.impressiveHours')}</p>}
                                <p className="text-xs text-gray-500 pt-2 border-t border-[#333] dark:border-[#333] light-mode:border-gray-200 mt-2">
                                    {t('tracker.ai.calcNote')}
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowAI(!showAI)}
                        className="w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(220,38,38,0.5)] transition-all hover:scale-105 active:scale-95 group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-white/20 scale-0 group-hover:scale-150 rounded-full transition-transform duration-500 ease-out" />
                        {showAI ? <X className="w-6 h-6 relative z-10" /> : <MessageSquare className="w-6 h-6 relative z-10" />}
                    </button>
                </div>

            </main>
        </div>
    );
}
