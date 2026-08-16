import { useState, useEffect } from 'react';
import { api } from '../../api';
import { Save, Target, Plus, Trash2, ChevronDown, Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { translateDynamicData } from '../../utils/translateHelper';


export default function TargetsView() {
    const { t, language } = useLanguage();
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

        // Auto-fill date if they select a predefined job from the master DB via dropdown
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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-4">
                <div className="w-10 h-10 border-2 border-red-500/25 border-t-red-500 rounded-full animate-spin" />
                <p className="text-sm font-semibold tracking-wider text-gray-500 animate-pulse uppercase">Syncing Exam Targets...</p>
            </div>
        );
    }

    return (
        <div className="animate-fadeIn max-w-4xl mx-auto space-y-6 px-4 sm:px-0">
            <div className="bg-gradient-to-br from-[#0c0c0f] to-[#070709] border border-[#1f1f25]/80 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-red-600/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none"></div>

                {/* --- Header Section --- */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8 pb-6 border-b border-[#181820]/60 relative z-10">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-400 flex items-center gap-3">
                            <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]">
                                <Target className="w-6 h-6 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]" />
                            </div>
                            {t('tracker.tab.targets')}
                        </h2>
                        <p className="text-gray-400 text-sm mt-3 ml-1 leading-relaxed max-w-xl">{t('tracker.targets.desc')}</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 disabled:from-gray-800 disabled:to-gray-900 disabled:text-gray-500 text-white text-sm font-bold rounded-xl transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.45)]"
                    >
                        <Save className={`w-4.5 h-4.5 ${saving ? 'animate-spin' : ''}`} />
                        {saving ? t('tracker.targets.saving') : t('tracker.targets.save')}
                    </button>
                </div>

                {/* --- Target Cards List --- */}
                <div className="space-y-6 relative z-10">
                    {targets.map((target, i) => (
                        <div
                            key={i}
                            className="p-6 bg-[#111116]/80 border border-[#202028]/80 hover:border-red-500/30 rounded-2xl relative group transition-all duration-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]"
                        >
                            <button
                                onClick={() => removeTarget(i)}
                                className="absolute top-4 right-4 p-2.5 bg-[#1c1c24] text-gray-400 hover:text-red-500 hover:bg-[#262633] rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-md border border-[#2d2d3a]"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pr-6">
                                {/* Exam Name Input / Dropdown */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('tracker.targets.searchExam')}</label>
                                    <div className="relative">
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                value={translateDynamicData(target.exam_name, language, 'job_name') || ''}
                                                onChange={e => {
                                                    updateTarget(i, 'exam_name', e.target.value);
                                                    setOpenDropdownIdx(i);
                                                }}
                                                onFocus={() => setOpenDropdownIdx(i)}
                                                placeholder={t('tracker.targets.placeholder')}
                                                className="w-full bg-[#08080c]/90 border border-[#22222b] rounded-xl px-4 py-3.5 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all shadow-inner pr-10"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setOpenDropdownIdx(openDropdownIdx === i ? null : i)}
                                                className="absolute right-3 p-1.5 text-gray-500 hover:text-gray-200 transition-colors"
                                            >
                                                <ChevronDown className={`w-4.5 h-4.5 transition-transform duration-300 ${openDropdownIdx === i ? 'rotate-180 text-red-500' : ''}`} />
                                            </button>
                                        </div>

                                        {openDropdownIdx === i && (
                                            <>
                                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownIdx(null)} />
                                                <div className="absolute left-0 right-0 mt-2 bg-[#0e0e12] border border-[#22222d] rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar animate-fadeIn origin-top">
                                                    <div className="p-1.5 space-y-0.5">
                                                        {allJobs.filter(job => {
                                                            const translatedName = translateDynamicData(job.job_name, language, 'job_name');
                                                            const searchLower = target.exam_name.toLowerCase();
                                                            return !target.exam_name ||
                                                                translatedName.toLowerCase().includes(searchLower) ||
                                                                job.job_name.toLowerCase().includes(searchLower);
                                                        }).slice(0, 50).map((job, jIdx) => {
                                                            const translatedName = translateDynamicData(job.job_name, language, 'job_name');
                                                            return (
                                                                <button
                                                                    key={jIdx}
                                                                    onClick={() => {
                                                                        updateTarget(i, 'exam_name', job.job_name);
                                                                        setOpenDropdownIdx(null);
                                                                    }}
                                                                    className={`w-full text-left px-4 py-3 text-sm rounded-lg transition-colors flex items-center justify-between ${target.exam_name === job.job_name ? 'bg-red-500/10 text-red-500 font-semibold' : 'text-gray-300 hover:bg-[#1a1a24] hover:text-white'}`}
                                                                >
                                                                    <span className="truncate">{translatedName}</span>
                                                                    {target.exam_name === job.job_name && <Check className="w-4 h-4 text-red-500 flex-shrink-0" />}
                                                                </button>
                                                            );
                                                        })}
                                                        {allJobs.filter(job => {
                                                            const translatedName = translateDynamicData(job.job_name, language, 'job_name');
                                                            const searchLower = target.exam_name.toLowerCase();
                                                            return !target.exam_name ||
                                                                translatedName.toLowerCase().includes(searchLower) ||
                                                                job.job_name.toLowerCase().includes(searchLower);
                                                        }).length === 0 && (
                                                            <div className="px-4 py-3 text-sm text-gray-500 italic text-center">{t('tracker.targets.noExamsFound')}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Target Date Input */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">{t('tracker.targets.targetDate')}</label>
                                    <input
                                        type="date"
                                        value={target.exam_date || ''}
                                        onChange={e => updateTarget(i, 'exam_date', e.target.value)}
                                        className="w-full bg-[#08080c]/90 border border-[#22222b] rounded-xl px-4 py-3.5 text-sm text-gray-100 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all shadow-inner target-date-input"
                                    />
                                </div>
                            </div>

                            {/* Syllabus Completed Percentage */}
                            <div className="mt-6 pt-5 border-t border-[#181822]">
                                <div className="flex justify-between items-center text-xs mb-4">
                                    <span className="font-bold text-gray-500 uppercase tracking-wider">{t('tracker.targets.syllabusCompleted')}</span>
                                    <span className="font-black text-sm bg-red-950/30 text-red-400 px-2.5 py-1 rounded-lg border border-red-900/30">{target.syllabus_completed_pct || 0}%</span>
                                </div>
                                <div className="relative">
                                    <div
                                        className={`absolute -top-12 px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white text-xs font-bold rounded-lg shadow-[0_0_15px_rgba(220,38,38,0.4)] pointer-events-none transition-all duration-200 z-10 ${activeSliderIdx === i ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'}`}
                                        style={{
                                            left: `calc(${target.syllabus_completed_pct || 0}%)`,
                                            transform: 'translateX(-50%)'
                                        }}
                                    >
                                        {target.syllabus_completed_pct || 0}%
                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-red-700 rotate-45 transform origin-center"></div>
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
                                        className="w-full accent-red-500 cursor-pointer relative z-0 h-1.5 bg-[#0a0a0d] rounded-lg border border-[#22222b]"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {targets.length === 0 && (
                        <div className="text-center py-16 text-gray-500 border-2 border-dashed border-[#1f1f28]/80 bg-[#08080c]/50 rounded-2xl flex flex-col items-center justify-center gap-4">
                            <div className="w-14 h-14 bg-red-500/5 rounded-full flex items-center justify-center border border-red-500/10">
                                <Target className="w-6 h-6 text-red-500/40" />
                            </div>
                            <p className="font-medium text-sm text-gray-400">{t('tracker.targets.noTargetYet')}</p>
                        </div>
                    )}
                </div>

                {/* Add Target Button */}
                <div className="mt-8 flex justify-center relative z-10">
                    <button
                        onClick={addTarget}
                        className="px-6 py-3 bg-[#111116] hover:bg-[#161622] hover:border-red-500/40 text-gray-200 hover:text-white text-sm font-bold rounded-xl transition-all duration-300 flex items-center gap-2 border border-[#202028] shadow-md active:scale-95"
                    >
                        <Plus className="w-4 h-4 text-red-500" />
                        {t('tracker.targets.addTarget')}
                    </button>
                </div>
            </div>
        </div>
    );
}
