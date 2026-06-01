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
            <div className="min-h-screen bg-[#060608] text-gray-200">
                <Navbar user={user} />
                <div className="flex h-[calc(100vh-56px)] items-center justify-center">
                    <GovLoader message={t('tracker.today.loading')} />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#060608] text-gray-200 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-900/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-950/5 rounded-full blur-[140px] pointer-events-none" />

            <Navbar user={user} />

            <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
                
                {/* ── Header ── */}
                <div className="mb-10 animate-fadeIn flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 flex items-center gap-4">
                            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                <Target className="w-7 h-7 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                            </div>
                            {t('tracker.title')}
                        </h1>
                        <p className="text-gray-400 font-semibold text-sm sm:text-base mt-3 ml-1 leading-relaxed">
                            {t('tracker.subtitle')}
                        </p>
                    </div>
                </div>

                {/* ── Top Section: Key Metrics ── */}
                <div className="mb-10 animate-fadeIn" style={{ animationDelay: '100ms' }}>
                    <div className="p-1 bg-[#121217]/40 backdrop-blur-xl border border-[#1f1f25]/50 rounded-3xl shadow-xl">
                        <PrepWidgets hideStudyCard={true} onWidgetClick={setActiveTab} />
                    </div>
                </div>

                {/* ── Middle Section: Step-wise Tabs ── */}
                <div className="animate-fadeIn" style={{ animationDelay: '200ms' }}>
                    <div className="flex gap-2.5 mb-8 bg-[#0b0b0f]/80 p-2 rounded-2xl border border-[#1f1f28] w-fit overflow-x-auto max-w-full shadow-2xl relative z-20 backdrop-blur-md">
                        <button
                            onClick={() => setActiveTab('targets')}
                            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black transition-all duration-300 whitespace-nowrap ${
                                activeTab === 'targets' 
                                    ? 'bg-gradient-to-r from-red-950/40 via-red-900/10 to-red-950/5 text-red-400 border border-red-500/30 shadow-[0_0_15px_rgba(220,38,38,0.1)]' 
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#15151c] border border-transparent'
                            }`}
                        >
                            <Crosshair className={`w-4 h-4 transition-all duration-300 ${activeTab === 'targets' ? 'text-red-400 drop-shadow-[0_0_5px_rgba(239,68,68,0.8)] scale-110' : ''}`} />
                            1. {t('tracker.tab.targets')}
                        </button>
                        <button
                            onClick={() => setActiveTab('today')}
                            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black transition-all duration-300 whitespace-nowrap ${
                                activeTab === 'today' 
                                    ? 'bg-gradient-to-r from-blue-950/40 via-blue-900/10 to-blue-950/5 text-blue-400 border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#15151c] border border-transparent'
                            }`}
                        >
                            <LayoutDashboard className={`w-4 h-4 transition-all duration-300 ${activeTab === 'today' ? 'text-blue-400 drop-shadow-[0_0_5px_rgba(59,130,246,0.8)] scale-110' : ''}`} />
                            2. {t('tracker.tab.today')}
                        </button>
                        <button
                            onClick={() => setActiveTab('history')}
                            className={`flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black transition-all duration-300 whitespace-nowrap ${
                                activeTab === 'history' 
                                    ? 'bg-gradient-to-r from-purple-950/40 via-purple-900/10 to-purple-950/5 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]' 
                                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#15151c] border border-transparent'
                            }`}
                        >
                            <CalendarDays className={`w-4 h-4 transition-all duration-300 ${activeTab === 'history' ? 'text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)] scale-110' : ''}`} />
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

                {/* ── Floating AI Mentor Dashboard ── */}
                <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
                    {showAI && (
                        <div className="bg-[#0e0e12]/95 border border-red-950/50 backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] rounded-2xl p-5 mb-4 w-72 sm:w-80 border-red-900/30 animate-in slide-in-from-bottom-5 duration-300">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-white font-bold flex items-center gap-2.5 text-sm sm:text-base">
                                    <Sparkles className="w-4.5 h-4.5 text-yellow-500 animate-pulse" /> 
                                    {t('tracker.ai.mentor.title')}
                                </h3>
                                <button 
                                    onClick={() => setShowAI(false)} 
                                    className="text-gray-500 hover:text-white p-1 hover:bg-[#1a1a24] rounded-lg transition-all"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-300 space-y-3 font-semibold leading-relaxed">
                                <p>{t('tracker.ai.greeting')}</p>
                                {(stats?.current_streak || 0) < 3 && (
                                    <p className="text-red-400/90 bg-red-950/20 border border-red-900/30 p-2 rounded-lg text-xs flex gap-1.5 items-center">
                                        <span>⚠️</span> 
                                        {t('tracker.ai.lowStreak')}
                                    </p>
                                )}
                                <div className="p-3 bg-[#08080c] rounded-xl border border-[#22222b] space-y-1">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black block">Forecast Probability</span>
                                    <p className={`font-black text-sm sm:text-base flex items-center gap-1.5 ${(stats?.target_probability || 0) >= 70 ? 'text-emerald-400' : (stats?.target_probability || 0) >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                                        🎯 {t('prep.clearanceProb')}: {stats?.target_probability || 0}%
                                    </p>
                                </div>
                                {(stats?.total_study_hours || 0) > 50 && (
                                    <p className="text-blue-400 flex items-center gap-1.5">
                                        <span>📚</span> 
                                        {t('tracker.ai.impressiveHours')}
                                    </p>
                                )}
                                <p className="text-[10px] text-gray-500 pt-2 border-t border-[#1a1a24] mt-2">
                                    {t('tracker.ai.calcNote')}
                                </p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setShowAI(!showAI)}
                        className="w-14 h-14 bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white rounded-full flex items-center justify-center shadow-[0_4px_20px_rgba(220,38,38,0.4)] transition-all hover:scale-105 active:scale-95 group relative overflow-hidden border border-red-500/20"
                    >
                        <div className="absolute inset-0 bg-white/10 scale-0 group-hover:scale-150 rounded-full transition-transform duration-500 ease-out pointer-events-none" />
                        {showAI ? <X className="w-6 h-6 relative z-10" /> : <MessageSquare className="w-6 h-6 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />}
                    </button>
                </div>

            </main>
        </div>
    );
}
