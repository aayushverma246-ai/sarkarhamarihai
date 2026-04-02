import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Save, Target, Plus, Trash2, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import RecommendationsWidget from '../RecommendationsWidget';

export default function TargetsView() {
    const { t } = useLanguage();
    const [targets, setTargets] = useState<any[]>([]);
    const [allJobs, setAllJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [openDropdownIdx, setOpenDropdownIdx] = useState<number | null>(null);
    const [activeSliderIdx, setActiveSliderIdx] = useState<number | null>(null);

    useEffect(() => {
        api.getTrackerTargets().then(res => {
            setTargets(res || []);
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });

        api.getJobs().then(jobs => {
            if (jobs && jobs.length > 0) {
                // Deduplicate by job_name to prevent duplicate options
                const uniqueJobs = Array.from(new Map(jobs.map((item: any) => [item.job_name, item])).values());
                setAllJobs(uniqueJobs as any[]);
            } else {
                setAllJobs([]);
            }
        }).catch((err: any) => console.error(err));
    }, []);

    const addTarget = () => {
        setTargets([...targets, { exam_name: '', exam_date: '', syllabus_completed_pct: 0 }]);
    };

    const removeTarget = (index: number) => {
        setTargets(targets.filter((_, i) => i !== index));
    };

    const updateTarget = (index: number, field: string, value: any) => {
        const newTargets = [...targets];
        newTargets[index][field] = value;

        // Auto-fill date if they select a predefined job from the master DB via datalist
        if (field === 'exam_name') {
            const foundJob = allJobs.find(j => j.job_name === value);
            if (foundJob && foundJob.application_end_date) {
                newTargets[index].exam_date = foundJob.application_end_date;
            }
        }

        setTargets(newTargets);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await api.saveTrackerTargets(targets);
        } catch (e) {
            console.error(e);
            alert('Failed to save targets');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="text-center py-20 text-gray-500">Loading your targets...</div>;

    return (
        <div className="animate-fadeIn max-w-3xl mx-auto space-y-6">
            <div className="bg-gradient-to-b from-white to-gray-50 dark:from-[#111] dark:to-[#080808] border border-gray-200 dark:border-[#1a1a1a] rounded-2xl p-6 sm:p-8 shadow-sm dark:shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 shadow-inner">
                                <Target className="w-5 h-5 text-red-500" />
                            </div>
                            {t('tracker.tab.targets')}
                        </h2>
                        <p className="text-gray-400 text-sm mt-2 ml-1">{t('tracker.targets.desc')}</p>
                    </div>
                    <button onClick={handleSave} disabled={saving} className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 shadow-[0_0_20px_rgba(220,38,38,0.25)] hover:shadow-[0_0_25px_rgba(220,38,38,0.4)] text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        <Save className="w-4 h-4" /> {saving ? t('tracker.targets.saving') : t('tracker.targets.save')}
                    </button>
                </div>

                <div className="space-y-5 pb-8 relative z-10">
                    {targets.map((target, i) => (
                        <div key={i} className="p-5 bg-gradient-to-br from-white to-gray-50 dark:from-[#131313] dark:to-[#0f0f0f] border border-gray-200 dark:border-[#222] hover:border-red-500/30 dark:hover:border-red-900/30 rounded-xl relative group transition-all shadow-sm">
                            <button onClick={() => removeTarget(i)} className="absolute top-3 right-3 p-2 bg-red-50 dark:bg-red-500/5 text-gray-500 hover:text-red-600 dark:hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                                <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{t('tracker.targets.searchExam')}</label>
                                    <div className="relative">
                                        <div className="relative group/input">
                                            <input
                                                type="text"
                                                value={target.exam_name || ''}
                                                onChange={e => {
                                                    updateTarget(i, 'exam_name', e.target.value);
                                                    setOpenDropdownIdx(i);
                                                }}
                                                onFocus={() => setOpenDropdownIdx(i)}
                                                placeholder={t('tracker.targets.placeholder')}
                                                className="w-full bg-white dark:bg-[#080808] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all pr-10 shadow-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setOpenDropdownIdx(openDropdownIdx === i ? null : i)}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors"
                                            >
                                                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${openDropdownIdx === i ? 'rotate-180 text-red-500' : ''}`} />
                                            </button>
                                        </div>

                                        {openDropdownIdx === i && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownIdx(null)} />
                                                <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-[#0e0e0e] border border-gray-200 dark:border-[#222] rounded-xl shadow-xl dark:shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar animate-fadeIn origin-top">
                                                    <div className="p-1.5 space-y-0.5">
                                                        {allJobs.filter(job =>
                                                            !target.exam_name || t(job.job_name).toLowerCase().includes(target.exam_name.toLowerCase()) || job.job_name.toLowerCase().includes(target.exam_name.toLowerCase())
                                                        ).slice(0, 50).map((job, jIdx) => (
                                                            <button
                                                                key={jIdx}
                                                                onClick={() => {
                                                                    updateTarget(i, 'exam_name', job.job_name);
                                                                    setOpenDropdownIdx(null);
                                                                }}
                                                                className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-colors flex items-center justify-between ${target.exam_name === job.job_name ? 'bg-red-500/10 text-red-500 font-medium' : 'text-gray-300 hover:bg-slate-800/50 hover:text-white'}`}
                                                            >
                                                                <span className="truncate">{t(job.job_name)}</span>
                                                                {target.exam_name === job.job_name && <Check className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                                            </button>
                                                        ))}
                                                        {allJobs.filter(job =>
                                                            !target.exam_name || t(job.job_name).toLowerCase().includes(target.exam_name.toLowerCase()) || job.job_name.toLowerCase().includes(target.exam_name.toLowerCase())
                                                        ).length === 0 && (
                                                                <div className="px-4 py-3 text-sm text-gray-500 italic">{t('tracker.targets.noExamsFound')}</div>
                                                            )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest ml-1">{t('tracker.targets.targetDate')}</label>
                                    <input
                                        type="date"
                                        value={target.exam_date || ''}
                                        onChange={e => updateTarget(i, 'exam_date', e.target.value)}
                                        className="w-full bg-white dark:bg-[#080808] border border-gray-300 dark:border-[#333] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 transition-all shadow-sm target-date-input"
                                    />
                                </div>
                            </div>

                            <div className="mt-6 pt-5 border-t border-gray-200 dark:border-[#222]">
                                <div className="flex justify-between text-xs mb-4">
                                    <span className="font-bold text-gray-500 uppercase tracking-wider">{t('tracker.targets.syllabusCompleted')}</span>
                                    <span className="text-gray-900 dark:text-white font-black">{target.syllabus_completed_pct || 0}%</span>
                                </div>
                                <div className="relative">
                                    <div
                                        className={`absolute -top-10 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow-[0_0_10px_rgba(255,0,0,0.3)] pointer-events-none transition-all duration-200 z-10 ${activeSliderIdx === i ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}`}
                                        style={{
                                            left: `calc(${target.syllabus_completed_pct || 0}%)`,
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        {target.syllabus_completed_pct || 0}%
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-red-600 rotate-45 transform origin-center"></div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={target.syllabus_completed_pct || 0}
                                        onChange={e => updateTarget(i, 'syllabus_completed_pct', parseInt(e.target.value))}
                                        onMouseDown={() => setActiveSliderIdx(i)}
                                        onMouseUp={() => setActiveSliderIdx(null)}
                                        onMouseLeave={() => setActiveSliderIdx(null)}
                                        onTouchStart={() => setActiveSliderIdx(i)}
                                        onTouchEnd={() => setActiveSliderIdx(null)}
                                        className="w-full accent-red-500 relative z-0 cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {targets.length === 0 && (
                        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 dark:border-[#333] bg-gray-50 dark:bg-[#0a0a0a]/50 rounded-2xl flex flex-col items-center justify-center gap-3">
                            <Target className="w-8 h-8 opacity-50 text-gray-400 dark:text-gray-600" />
                            <p className="font-medium text-sm">{t('tracker.targets.noTargetYet')}</p>
                        </div>
                    )}
                </div>

                <div className="mt-2 flex justify-center relative z-10">
                    <button onClick={addTarget} className="px-6 py-3 bg-white dark:bg-[#111] hover:bg-gray-50 dark:hover:bg-[#1a1a1a] focus:ring-2 focus:ring-gray-300 dark:focus:ring-[#333] text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 border border-gray-300 dark:border-[#333] shadow-sm">
                        <Plus className="w-4 h-4" /> {t('tracker.targets.addTarget')}
                    </button>
                </div>
            </div>

            {/* AI Recommendations Section */}
            <div className="mt-8">
                <RecommendationsWidget />
            </div>
        </div>
    );
}
