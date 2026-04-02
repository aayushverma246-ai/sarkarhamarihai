import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getCachedUser } from '../api';
import { Job } from '../types';
import Navbar from '../components/Navbar';
import GovLoader from '../components/GovLoader';
import { useLanguage } from '../i18n/LanguageContext';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(dateStr: string) {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
}

function fmtSalary(min: number, max: number) {
  if (!min && !max) return '—';
  const f = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`;
  if (!min) return f(max);
  if (!max) return f(min);
  return `${f(min)} – ${f(max)}`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; text: string; bg: string; label: string }> = {
    LIVE: { dot: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-900/15 border-emerald-900/25', label: 'Live — Apply Now' },
    UPCOMING: { dot: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-900/15 border-amber-900/25', label: 'Upcoming' },
    RECENTLY_CLOSED: { dot: 'bg-orange-500', text: 'text-orange-500', bg: 'bg-orange-900/15 border-orange-900/25', label: 'Recently Closed' },
    CLOSED: { dot: 'bg-gray-500', text: 'text-gray-500', bg: 'bg-[#101010] border-[#191919]', label: 'Closed' },
  };
  const c = cfg[status] || cfg.CLOSED;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold tracking-wide ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-${status === 'LIVE' ? 'pulse' : 'none'}`} />
      {c.label}
    </span>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[#141414]">
      <div className="px-6 pt-5 pb-1">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-base">{icon}</span>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-widest">{title}</h2>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#0f0f0f] last:border-0">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-gray-200 flex-1">{value}</span>
    </div>
  );
}

// ─── Selection process maps ──────────────────────────────────────────────────

function getSelectionSteps(category: string, selectionProcess: string): string[] {
  if (selectionProcess) return selectionProcess.split('|').map(s => s.trim()).filter(Boolean);
  const defaults: Record<string, string[]> = {
    SSC: ['Tier I — Computer Based Exam (Objective)', 'Tier II — Computer Based Exam', 'Document Verification', 'Medical Examination'],
    UPSC: ['Preliminary Exam (Objective)', 'Mains Exam (Descriptive)', 'Personality Test / Interview', 'Medical & Document Verification'],
    Banking: ['Preliminary Exam', 'Mains Exam', 'Interview (for PO/SO)', 'Document Verification'],
    Railway: ['Computer Based Test (CBT)', 'Physical Efficiency Test (PET)', 'Document Verification', 'Medical Examination'],
    Defence: ['Written Exam / NDA Paper', 'SSB Interview (5-day process)', 'Medical Examination', 'Final Merit List'],
    Police: ['Written Exam', 'Physical Standards Test (PST)', 'Physical Efficiency Test (PET)', 'Medical Examination', 'Document Verification'],
    'State Services': ['Preliminary Exam (Objective)', 'Mains Exam (Descriptive)', 'Interview / Viva-voce', 'Document Verification'],
    Teaching: ['Written Exam (Paper I & II)', 'Document Verification', 'Certificate Issuance'],
    Research: ['Written Exam / GATE Score', 'Interview / Skill Test', 'Document Verification'],
    PSU: ['GATE Score Shortlisting', 'Group Discussion', 'Personal Interview', 'Document Verification'],
    Healthcare: ['Written Exam', 'Skill / Practical Test', 'Document Verification'],
  };
  return defaults[category] || ['Written Exam', 'Interview / Skill Test', 'Document Verification', 'Final Merit List'];
}

function RoadmapContent({ content }: { content: any }) {
  // [V9 MASTER GUIDE] Optimized Data Extraction
  const data = content?.overview ? content : (content?.roadmap_content || {});
  const { 
    overview = {}, 
    strategy = [], 
    priorities = [], 
    plan = [], 
    warnings = [], 
    success_formula = [] 
  } = data;

  const getStatusColor = (status: string) => {
    if (status?.includes('Achievable')) return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (status?.includes('Risky')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  if (!data.overview && !strategy.length) {
     return (
       <div className="p-16 text-center border border-white/5 rounded-3xl bg-white/[0.02] animate-pulse">
         <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.8em] animate-bounce">Synchronizing Master Guide...</p>
         <p className="mt-4 text-[11px] text-gray-500 font-bold italic">Deep reasoning in progress. Creating your permanent blueprint.</p>
       </div>
     );
  }

  return (
    <div className="space-y-10 animate-in fade-in zoom-in-95 duration-1000">
      {/* 1. SNAPSHOT - THE REALITY CHECK */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2 bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8 rounded-[2rem] backdrop-blur-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <span className="text-8xl font-black italic">V9</span>
          </div>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.5em] mb-6">Readiness Factor</p>
          <div className="flex items-end gap-6">
            <span className="text-7xl font-black text-white leading-none tracking-tighter">{overview.readiness_score || 0}</span>
            <div className="pb-2 space-y-2 flex-1">
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Master Score</p>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden w-full backdrop-blur-sm">
                <div className="h-full bg-red-600 rounded-full shadow-[0_0_20px_rgba(220,38,38,0.5)] transition-all duration-1000" style={{ width: `${overview.readiness_score || 0}%` }} />
              </div>
            </div>
          </div>
        </div>
        
        <div className={`p-8 rounded-[2rem] border flex flex-col justify-center transition-all duration-500 ${getStatusColor(overview.feasibility_status)}`}>
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-3">Feasibility</p>
          <p className="text-2xl font-black italic tracking-tight leading-tight">{overview.feasibility_status || 'Auditing...'}</p>
        </div>

        <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] flex flex-col justify-center">
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Commitment</p>
          <p className="text-2xl font-black text-white">{overview.recommended_daily_hours || 0}h <span className="text-[11px] font-bold text-gray-500 uppercase">Daily</span></p>
        </div>
      </div>

      {/* 2. THE MASTER STRATEGY & PRIORITIES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-[#0c0c0c]/80 border border-white/10 p-10 rounded-[2.5rem] shadow-2xl relative">
          <div className="absolute top-6 right-8">
             <span className="text-[10px] font-black text-red-600/50 uppercase tracking-widest">Fixed Action Plan</span>
          </div>
          <h4 className="text-[11px] font-black text-white uppercase tracking-[0.5em] mb-10 flex items-center gap-4">
            <span className="w-8 h-[1px] bg-red-600" /> Strategic Approach
          </h4>
          <div className="space-y-6">
            {strategy.map((item: string, i: number) => (
              <div key={i} className="flex gap-6 group">
                <span className="text-[12px] font-black text-white/10 group-hover:text-red-600/40 transition-colors pt-0.5">0{i + 1}</span>
                <p className="text-[14px] text-gray-300 font-bold leading-relaxed tracking-tight group-hover:text-white transition-colors">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 p-10 rounded-[2.5rem] flex flex-col">
          <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-[0.5em] mb-10">High-Impact Priorities</h4>
          <div className="flex-1 space-y-4">
            {priorities.map((p: string, i: number) => (
              <div key={i} className="p-5 bg-white/5 border border-white/5 rounded-2xl flex items-center gap-6 group hover:border-white/10 transition-all">
                <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center border border-red-600/20">
                   <span className="text-[10px] font-black text-red-600 italic">#{i+1}</span>
                </div>
                <p className="text-[13px] font-bold text-gray-300 group-hover:text-white transition-colors">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. EXECUTION PHASES */}
      <div className="space-y-6">
        <h4 className="text-[11px] font-black text-white/30 uppercase tracking-[0.6em] text-center">Execution Blueprint</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plan.map((p: string, i: number) => (
            <div key={i} className="p-8 bg-gradient-to-b from-white/5 to-transparent border border-white/5 rounded-[2rem] group hover:border-red-600/30 transition-all">
               <span className="text-[9px] font-black text-red-600 uppercase tracking-widest block mb-4 italic">Phase 0{i+1}</span>
               <p className="text-[13px] text-gray-400 font-bold leading-relaxed">{p}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. CRITICAL WARNINGS & SUCCESS FORMULA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-red-950/20 border border-red-500/20 p-10 rounded-[2.5rem] space-y-8">
          <h5 className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] flex items-center gap-3">
             <span className="w-2 h-2 bg-red-500 animate-pulse rounded-full" /> Intelligence Alerts
          </h5>
          <div className="space-y-6">
            {warnings.map((w: string, i: number) => (
              <div key={i} className="flex gap-4">
                 <span className="text-red-500/30 text-[10px] font-black pt-1">!</span>
                 <p className="text-[13px] font-bold text-red-200/80 leading-relaxed italic border-l border-red-500/20 pl-4">{w}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a] border border-white/10 p-10 rounded-[2.5rem] relative overflow-hidden group">
           <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
              <span className="text-[120px] font-black italic">GOV</span>
           </div>
           <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-10">Personalized Success Formula</h5>
           <div className="space-y-6 relative z-10">
             {success_formula.map((rule: string, i: number) => (
               <div key={i} className="flex items-center gap-5">
                  <div className="w-1.5 h-1.5 bg-red-600 rounded-full" />
                  <p className="text-[14px] font-black text-white italic tracking-tight">{rule}</p>
               </div>
             ))}
           </div>
        </div>
      </div>

      <div className="pt-8 text-center flex flex-col items-center gap-2">
        <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
           <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">One-Time Permanent Blueprint • No Modification Possible</p>
        </div>
        <p className="text-[10px] font-bold text-white/5 italic">Generated exclusively via SarkarHamariHai V9 Engine</p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function JobDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const cached = getCachedUser();
  const { t, language } = useLanguage();
  const [user, setUser] = useState<any>(cached);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [roadmap, setRoadmap] = useState<string | null>(null);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [pageError, setPageError] = useState('');
  const [roadmapError, setRoadmapError] = useState('');
  const [roadmapTier, setRoadmapTier] = useState<number>(1);
  const [isRoadmapMinimized, setIsRoadmapMinimized] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [applied, setApplied] = useState(false);
  const [appliedLoading, setAppliedLoading] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);
  const [showUnmarkSuccess, setShowUnmarkSuccess] = useState(false);
  const [showUnmarkConfirm, setShowUnmarkConfirm] = useState(false);


  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        if (cached) {
          const [me, j, likeStatus, appliedStatus, reminderStatus] = await Promise.all([
            api.getMe(),
            api.getJobById(id),
            api.getLikedStatus(id),
            api.getAppliedStatus(id),
            api.getReminderStatus(id),
          ]);
          setUser(me);
          setJob(j);
          setLiked(likeStatus.liked);
          setApplied(appliedStatus.applied);
          setReminding(reminderStatus.reminders_enabled);
        } else {
          const j = await api.getJobById(id);
          setJob(j);
        }
        try { 
          const r = await api.getRoadmap(id); 
          setRoadmap(r.roadmap_content);
          if (r.tier) setRoadmapTier(r.tier);
        } catch { /* none yet */ }
      } catch (err) {
        console.error(err);
        setPageError('Could not load exam details.');
      } finally { setLoading(false); }
    };
    load();
    // eslint-disable-next-line
  }, [id]);

  const handleLike = async () => {
    if (!cached) { navigate('/login'); return; }
    if (!job) return;

    // Snappy Optimistic UI Toggle
    setLikeLoading(true);
    const newLikedStatus = !liked;
    setLiked(newLikedStatus);

    try {
      if (newLikedStatus) {
        await api.likeJob(job.id);
      } else {
        await api.unlikeJob(job.id);
      }
      // Broadcast to the Navbar Notification Bell
      window.dispatchEvent(new Event('app:likeToggled'));
    } catch (err) {
      console.error(err);
      // Revert if server fails
      setLiked(liked);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleApplyToggle = async () => {
    if (!cached) { navigate('/login'); return; }
    if (!job) return;
    setAppliedLoading(true);
    const newAppliedStatus = !applied;
    setApplied(newAppliedStatus);

    try {
      await api.toggleApplied(job.id);
    } catch (err) {
      console.error(err);
      setApplied(applied);
    } finally {
      setAppliedLoading(false);
    }
  };

  const handleReminderToggle = async () => {
    if (!cached) { navigate('/login'); return; }
    if (!job) return;
    setReminderLoading(true);
    const newRemindingStatus = !reminding;
    setReminding(newRemindingStatus);

    try {
      await api.toggleReminder(job.id);
    } catch (err) {
      console.error(err);
      setReminding(reminding);
    } finally {
      setReminderLoading(false);
    }
  };

  const handleRoadmap = async () => {
    if (!job || roadmap) return;
    setLoadingRoadmap(true);
    setRoadmapError(''); // Clear roadmap-specific error
    try {
      setRoadmap(null);
      const res = await api.generateRoadmap(job.id);
      
      let attempts = 0;
      const poll = async () => {
        const check = await api.getGeneratedRoadmap(job.id);
        const content = check?.roadmap_content;
        
        if (content && (content.is_ready || content.overview?.is_ready)) {
          setRoadmap(content);
          setLoadingRoadmap(false);
        } else if (attempts < 30) { // Extended to 60s
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setRoadmap(content || res.roadmap_content);
          setLoadingRoadmap(false);
        }
      };
      poll();
    } catch (err: any) {
      console.error("[V8 MasterPlan] API Fail, triggering Client-Side Self-Healing...", err);
      // V8 MasterPlan Fallback
      const syllabus = job.syllabus || job.job_name;
      const kw = syllabus.split(/[,;|(\n]/).map((s:string) => s.trim()).filter((s:string) => s.length > 2);
      
      const localRoadmap = {
        roadmap: {
          total_days: 90,
          phases: [{ phase_name: "Fundamentals", duration_days: 30, focus: "Basics" }],
          daily_plan: [{ day: 1, schedule: [{ time_slot: "Morning", subject: "Main", topic: kw[0] || "Intro", task: "Read basics" }] }]
        },
        subject_strategy: [{ subject: "Main", priority: "High", approach: "In-depth", topics_covered: [] }],
        revision_plan: { cycles: ["Daily"], final_revision_strategy: "Active recall" },
        mock_test_plan: { start_day: 60, frequency: "Weekly", full_length_tests: 10, sectional_tests: 5 },
        final_phase: { last_30_days: "Mocks", last_7_days: "Formulae", exam_day_strategy: "Calmness" }
      };
      
      setRoadmap(localRoadmap as any);
      setRoadmapTier(3);
    } finally {
      setLoadingRoadmap(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808]">
        <Navbar user={user} />
        <GovLoader message={t('job.loadingDetails')} />
      </div>
    );
  }

  if (pageError || !job) {
    return (
      <div className="min-h-screen bg-[#080808]">
        <Navbar user={user} />
        <div className="max-w-3xl mx-auto px-4 py-12 text-center">
          <p className="text-red-400 text-sm">{pageError || 'Exam not found'}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-[#141414] text-gray-400 rounded-lg text-sm hover:bg-[#1a1a1a]"
          >
            ← {t('job.backToDashboard')}
          </button>
        </div>
      </div>
    );
  }

  const isLive = job.form_status === 'LIVE';
  const isRecentlyClosed = job.form_status === 'RECENTLY_CLOSED';
  const selectionSteps = getSelectionSteps(job.job_category, (job as any).selection_process);
  const appLink = job.official_application_link;
  const notifLink = (job as any).official_notification_link || '';
  const websiteLink = (job as any).official_website_link || '';

  const safeHost = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  };

  const examTitle = (job as any)[`exam_name_${language}`] || job.job_name;

  // Calculate generic countdowns
  let daysRemaining = null;
  let daysUntilOpen = null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (isLive && job.application_end_date) {
    const end = new Date(job.application_end_date);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) daysRemaining = diffDays;
  } else if (job.form_status === 'UPCOMING' && job.application_start_date) {
    const start = new Date(job.application_start_date);
    start.setHours(0, 0, 0, 0);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) daysUntilOpen = diffDays;
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      <Navbar user={user} />
      <div className="page-enter max-w-3xl mx-auto px-4 sm:px-6 py-6">

        {/* Back */}
        <button
          onClick={() => {
            if (document.startViewTransition) {
              document.startViewTransition(() => navigate(-1));
            } else {
              navigate(-1);
            }
          }}
          className="btn-press flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-400 mb-5 transition-colors group"
        >
          <svg className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t('job.backToDashboard')}
        </button>

        <div className="bg-[#0e0e0e] rounded-2xl border border-[#141414] overflow-hidden shadow-xl">

          {/* ── HEADER ───────────────────────────────────────────────── */}
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <StatusBadge status={job.form_status} />
                  <span className="text-xs text-gray-700 bg-[#141414] border border-[#1e1e1e] px-2 py-0.5 rounded-full">
                    {job.job_category}
                  </span>
                  {(job as any).allows_final_year_students && (
                    <span className="text-xs text-blue-400 bg-blue-950/40 border border-blue-900/30 px-2 py-0.5 rounded-full">
                      {t('job.finalYearEligible')}
                    </span>
                  )}
                </div>

                <h1 className="text-xl sm:text-2xl font-bold text-gray-50 leading-snug">{examTitle}</h1>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-xs">
                  <span className="text-gray-400 font-medium">
                    {job.organization}
                  </span>

                  {/* Verification Indicator */}
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-950/20 border border-emerald-900/30 rounded text-emerald-500/90 font-medium">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span>Source: Official Govt Notification</span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#111] border border-[#1a1a1a] rounded text-gray-500 font-medium">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Updated {fmt((job as any).last_updated || new Date().toISOString().split('T')[0])}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* ── ACTION STRIP ────────────────────────────────────────── */}
          <div className="bg-[#111] px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2 sm:gap-3 border-t border-[#1a1a1a]">

            {/* Save button */}
            <button
              onClick={handleLike}
              disabled={likeLoading}
              title={liked ? 'Remove from saved' : 'Save this exam'}
              className={`p-2.5 rounded-xl border transition-all duration-150 flex-shrink-0 ${liked
                ? 'bg-red-950/50 border-red-800/50 text-red-400 shadow-[0_0_16px_rgba(220,38,38,0.12)]'
                : 'bg-[#141414] border-[#232323] text-gray-500 hover:text-red-400 hover:bg-[#1a1a1a] hover:border-red-900/40'
                }`}
            >
              <svg
                className={`w-5 h-5 transition-transform ${liked ? 'animate-heart-live' : ''}`}
                viewBox="0 0 24 24"
                fill={liked ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>

            {/* Action buttons */}
            {isLive && appLink && (
              <a
                href={appLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-emerald-900/30 flex-1 sm:flex-none justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <span>Apply on {safeHost(appLink)}</span>
              </a>
            )}
            {!isLive && appLink && (
              <a
                href={appLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#141414] hover:bg-[#1a1a1a] text-gray-300 font-semibold rounded-xl text-sm transition-all border border-[#252525] flex-1 sm:flex-none justify-center"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                <span>View Official Page</span>
              </a>
            )}
            {applied ? (
              <button
                onClick={() => setShowUnmarkConfirm(true)}
                disabled={appliedLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold bg-red-950/20 text-red-500 hover:bg-red-900/40 transition-all border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse flex-1 sm:flex-none"
              >
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Unmark Applied
              </button>
            ) : (isLive || isRecentlyClosed || job.form_status === 'CLOSED') && (
              <button
                onClick={handleApplyToggle}
                disabled={appliedLoading}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1 sm:flex-none bg-[#141414] border border-[#252525] text-gray-300 hover:bg-[#1a1a1a]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {t('job.markApplied')}
              </button>
            )}
            {isLive && !applied && (
              <button
                onClick={handleReminderToggle}
                disabled={reminderLoading || appliedLoading}
                title="We'll send you an email reminder everyday so you don't miss the deadline."
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1 sm:flex-none relative overflow-hidden ${reminding
                  ? 'bg-purple-900/30 border border-purple-800/50 text-purple-400 shadow-[0_0_12px_rgba(168,85,247,0.15)] ring-1 ring-purple-500/50'
                  : 'bg-[#141414] border border-[#252525] text-gray-400 hover:text-purple-300 hover:bg-[#1a1a1a] hover:border-purple-900/30'
                  }`}
              >
                {/* Subtle pulse background when active */}
                {reminding && <div className="absolute inset-0 bg-purple-500/10 animate-pulse"></div>}
                
                <svg className={`w-4 h-4 relative z-10 ${reminding ? 'animate-[ring_1s_ease-in-out_infinite] origin-top' : ''}`} fill={reminding ? "currentColor" : "none"} stroke="currentColor" strokeWidth={reminding ? 1.5 : 2.5} viewBox="0 0 24 24">
                  {reminding ? (
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  ) : (
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  )}
                </svg>
                <span className="relative z-10">{reminding ? t('job.remindersOn') : t('job.remindDaily')}</span>
              </button>
            )}
            {!isLive && !applied && (
              <button
                onClick={handleReminderToggle}
                disabled={reminderLoading || appliedLoading}
                title="We will notify you when this exam status changes."
                className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex-1 sm:flex-none relative overflow-hidden ${reminding
                  ? 'bg-blue-900/30 border border-blue-800/50 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/50'
                  : 'bg-[#141414] border border-[#252525] text-gray-400 hover:text-blue-300 hover:bg-[#1a1a1a] hover:border-blue-900/30'
                  }`}
              >
                {/* Subtle pulse background when active */}
                {reminding && <div className="absolute inset-0 bg-blue-500/10 animate-pulse"></div>}

                <svg className={`w-4 h-4 relative z-10 ${reminding ? 'animate-[ring_1s_ease-in-out_infinite] origin-top' : ''}`} fill={reminding ? "currentColor" : "none"} stroke="currentColor" strokeWidth={reminding ? 1.5 : 2.5} viewBox="0 0 24 24">
                  {reminding ? (
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  ) : (
                     <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  )}
                </svg>
                <span className="relative z-10">{reminding ? 'Notify Me (On)' : 'Notify Me'}</span>
              </button>
            )}
            {(isRecentlyClosed || job.form_status === 'CLOSED' || job.form_status === 'UPCOMING') && !applied && (
              <span className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium flex-1 sm:flex-none ${isRecentlyClosed
                ? 'bg-orange-950/40 border border-orange-900/30 text-orange-400'
                : job.form_status === 'UPCOMING'
                  ? 'bg-amber-950/30 border border-amber-900/25 text-amber-500'
                  : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400'
                }`}>
                {job.form_status === 'UPCOMING' && t('job.formNotOpen')}
                {job.form_status === 'UPCOMING' && daysUntilOpen !== null && (
                  <span className="ml-1 text-[11px] font-bold text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/30 animate-pulse">
                    ⏳ Opens in {daysUntilOpen} days
                  </span>
                )}
                {isRecentlyClosed && t('job.recentlyClosedMsg')}
                {job.form_status === 'CLOSED' && t('job.applicationClosed')}
              </span>
            )}
            
            {isLive && daysRemaining !== null && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-950/30 border border-red-900/30 animate-pulse flex-1 sm:flex-none justify-center whitespace-nowrap">
                {daysRemaining === 0 ? "⚠️ Closing Today" : `⏳ ${daysRemaining} ${t('job.daysLeft')}`}
              </span>
            )}
          </div>
        </div>

        {/* ── IMPORTANT INFO & DATES ───────────────────────────────── */}
        <Section title={t('job.importantDates')} icon="📅">
          <div className="divide-y divide-[#111]">
            {(job.salary_min > 0 || job.salary_max > 0) && (
              <InfoRow label={t('job.payScale')} value={
                <span className="text-emerald-400 font-medium">
                  {fmtSalary(job.salary_min, job.salary_max)} {t('job.perMonth')}
                </span>
              } />
            )}
            <InfoRow label={t('job.appOpens')} value={
              <span className="flex items-center gap-2">
                {fmt(job.application_start_date)}
                {job.form_status === 'LIVE' && <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-1.5 py-0.5 rounded-full">{t('job.openNow')}</span>}
              </span>
            } />
            <InfoRow label={t('job.appDeadline')} value={
              <span className={`flex items-center gap-2 ${job.form_status === 'LIVE' ? 'text-amber-300 font-medium' : ''}`}>
                {fmt(job.application_end_date)}
                {job.form_status === 'LIVE' && (
                  <span className="text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/30 px-1.5 py-0.5 rounded-full">{t('job.deadline')}</span>
                )}
              </span>
            } />
          </div>
          <p className="text-[11px] text-gray-700 mt-3 pb-5">
            {t('job.verifyDates')}
          </p>
        </Section>

        {/* ── ELIGIBILITY ──────────────────────────────────────────── */}
        <Section title={t('job.eligibility')} icon="✅">
          <div className="divide-y divide-[#111] pb-5">
            <InfoRow label={t('job.qualification')} value={job.qualification_required} />
            <InfoRow label={t('job.ageLimit')} value={`${job.minimum_age} – ${job.maximum_age} ${t('job.years')}`} />
            {(job as any).allows_final_year_students && (
              <InfoRow label={t('job.finalYear')} value={
                <span className="text-blue-400">{t('job.finalYearDesc')}</span>
              } />
            )}
            <InfoRow label={t('job.category')} value={t('job.categoryRelax')} />
          </div>
        </Section>

        {/* ── SELECTION PROCESS ─────────────────────────────────────── */}
        <Section title={t('job.selectionProcess')} icon="🎯">
          <div className="space-y-3 pb-5">
            {selectionSteps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#141414] border border-[#252525] text-gray-500 text-xs flex items-center justify-center flex-shrink-0 mt-0.5 font-medium">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-300 pt-0.5">{step}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── OFFICIAL LINKS ────────────────────────────────────────── */}
        <Section title={t('job.officialLinks')} icon="🔗">
          <div className="space-y-2 pb-5">
            {appLink && (
              <a href={appLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2a2a2a] transition-colors group">
                <div>
                  <p className="text-xs text-gray-600 mb-0.5">{t('job.appPortal')}</p>
                  <p className="text-sm text-gray-300 group-hover:text-gray-100">{safeHost(appLink)}</p>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {notifLink && (
              <a href={notifLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2a2a2a] transition-colors group">
                <div>
                  <p className="text-xs text-gray-600 mb-0.5">{t('job.officialNotifPdf')}</p>
                  <p className="text-sm text-gray-300 group-hover:text-gray-100">{safeHost(notifLink)}</p>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {websiteLink && (
              <a href={websiteLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-between p-3 bg-[#111] border border-[#1e1e1e] rounded-xl hover:border-[#2a2a2a] transition-colors group">
                <div>
                  <p className="text-xs text-gray-600 mb-0.5">{t('job.officialWebsite')}</p>
                  <p className="text-sm text-gray-300 group-hover:text-gray-100">{safeHost(websiteLink)}</p>
                </div>
                <svg className="w-4 h-4 text-gray-700 group-hover:text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
            {!appLink && !notifLink && !websiteLink && (
              <p className="text-sm text-gray-600 pb-2">{t('job.noLinks')}</p>
            )}
          </div>
        </Section>

        {/* ── PREPARATION ROADMAP ──────────────────────────────────── */}
        <Section
          title={t('job.prepRoadmap')}
          icon="🗺️"
        >
          <div className="pb-5">
            {roadmap ? (
              <div className="bg-[#0a0a0a] border border-[#161616] rounded-xl shadow-inner overflow-hidden transition-all duration-300">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#161616] bg-[#0d0d0d]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('job.aiGenerated')}</span>
                    {loadingRoadmap && (
                      <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                    )}
                  </div>
                  <button
                    onClick={() => setIsRoadmapMinimized(!isRoadmapMinimized)}
                    className="text-[10px] font-bold text-red-600 hover:text-red-500 uppercase tracking-tight flex items-center gap-1 group"
                  >
                    {isRoadmapMinimized ? (
                      <><span>{t('job.expand')}</span> <span className="group-hover:translate-y-0.5 transition-transform">↓</span></>
                    ) : (
                      <><span>{t('job.minimize')}</span> <span className="group-hover:-translate-y-0.5 transition-transform">↑</span></>
                    )}
                  </button>
                </div>
                {!isRoadmapMinimized && (
                  <div className="p-5">
                    <RoadmapContent content={roadmap} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8 text-center bg-[#0a0a0a]/50 rounded-2xl border border-dashed border-[#1a1a1a]">
                <div className="w-14 h-14 rounded-3xl bg-[#0e0e0e] border border-[#1a1a1a] flex items-center justify-center text-3xl shadow-sm">
                  🗺️
                </div>
                <div className="max-w-xs">
                  <p className="text-base font-bold text-gray-200">{t('job.personalizedPlan')}</p>
                  <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
                    {t('job.aiRoadmapDesc')}
                  </p>
                </div>
                {roadmapError && ( // ONLY roadmap error here
                  <p className="text-xs text-red-500 font-medium px-4">{roadmapError}</p>
                )}
                <button
                  onClick={handleRoadmap}
                  disabled={loadingRoadmap}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-red-800 text-white hover:bg-red-700 text-sm font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                >
                  {loadingRoadmap ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {t('job.analyzingSyllabi')}</>
                  ) : (
                    <>{t('job.generateRoadmap')}</>
                  )}
                </button>
              </div>
            )}
          </div>
        </Section>

        {/* Footer note */}
        <div className="px-6 py-3 bg-[#080808] border-t border-[#141414]">
          <p className="text-[11px] text-gray-700 text-center">
            {t('job.footerDisclaimer')}
          </p>
        </div>
      </div>

      {/* ── UNMARK SUCCESS OVERLAY ─────────────────────────────────── */}
      {showUnmarkSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080808]/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-scaleIn">
            <div className="w-20 h-20 bg-red-950/30 border border-red-900/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-500 animate-pulse" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Profile Reset</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Preparation data removed. We are recalibrating your AI recommendation engine.
            </p>
            <div className="mt-8 flex justify-center">
              <div className="flex gap-1.5">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-800 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── UNMARK CONFIRMATION OVERLAY ────────────────────────────── */}
      {showUnmarkConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#080808]/90 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0e0e0e] border border-[#1a1a1a] rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-scaleIn">
            <div className="w-16 h-16 bg-red-950/30 border border-red-900/40 rounded-full flex items-center justify-center mx-auto mb-5 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Unmark Exam?</h3>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Are you sure you want to remove this exam from your applied list? Tracking details and recommendations will be recalibrated.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnmarkConfirm(false)}
                className="flex-1 px-4 py-3 bg-[#141414] text-gray-300 font-bold rounded-xl hover:bg-[#1a1a1a] transition-colors border border-[#252525]"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                   setShowUnmarkConfirm(false);
                   setAppliedLoading(true);
                   try {
                     await api.unmarkApplied(job.id);
                     setApplied(false);
                     setShowUnmarkSuccess(true);
                     setTimeout(() => setShowUnmarkSuccess(false), 3000);
                   } catch (err) {
                     console.error(err);
                   } finally {
                     setAppliedLoading(false);
                   }
                }}
                className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
              >
                Yes, Unmark
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
