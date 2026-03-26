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

function RoadmapSkeleton({ progress, examName }: { progress: number; examName: string }) {
  const steps = [
    { pct: 10, label: 'Analyzing syllabus...' },
    { pct: 25, label: 'Mapping subject priorities...' },
    { pct: 40, label: 'Building phase plan...' },
    { pct: 55, label: 'Creating daily strategy...' },
    { pct: 70, label: 'Generating resources...' },
    { pct: 85, label: 'Finalizing mock test plan...' },
    { pct: 95, label: 'Polishing your master guide...' },
  ];
  const currentStep = steps.filter(s => s.pct <= progress).pop() || steps[0];

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      {/* Overview skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/5 p-5 rounded-xl md:col-span-2">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-[0.3em] mb-3">Generating Roadmap</p>
          <div className="flex items-end gap-4">
            <span className="text-4xl font-black text-white/20 leading-none animate-pulse">{progress}%</span>
            <div className="pb-1 flex-1">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-600 to-purple-600 rounded-full transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-3 font-bold italic animate-pulse">{currentStep.label}</p>
        </div>
        {[1, 2].map(i => (
          <div key={i} className="bg-white/[0.02] border border-white/5 p-5 rounded-xl">
            <div className="h-3 w-16 bg-white/5 rounded mb-3 animate-pulse" />
            <div className="h-6 w-12 bg-white/5 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Phase skeletons */}
      <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01]">
        <div className="px-6 py-4 flex items-center gap-3">
          <span className="text-lg">🎯</span>
          <span className="text-[11px] font-black text-gray-500 uppercase tracking-[0.2em]">Building study plan for {examName}...</span>
        </div>
        <div className="px-6 pb-5 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-5" style={{ animationDelay: `${i * 200}ms` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-4 w-16 bg-red-600/10 rounded-md animate-pulse" />
                <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
              </div>
              <div className="h-4 w-3/4 bg-white/5 rounded animate-pulse mb-2" />
              <div className="h-3 w-1/2 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* More section skeletons */}
      {[1, 2].map(i => (
        <div key={i} className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.01] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-5 w-5 bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-4/5 bg-white/5 rounded animate-pulse" />
            <div className="h-3 w-3/5 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: { title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-white/5 rounded-2xl overflow-hidden bg-white/[0.02] transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <span className="text-[11px] font-black text-gray-300 uppercase tracking-[0.2em]">{title}</span>
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-6 pb-5">{children}</div>}
    </div>
  );
}

function RoadmapContent({ content }: { content: any }) {
  const data = content?.overview ? content : (content?.roadmap_content || {});
  const {
    overview = {},
    syllabus_breakdown = [],
    phase_plan = [],
    daily_strategy = {},
    weekly_strategy = {},
    resources = [],
    revision_plan = {},
    mock_test_strategy = {},
    weak_area_plan = {},
    final_month_strategy = {},
    warnings = [],
    success_formula = [],
    // V9 legacy fields
    strategy = [],
    priorities = [],
    plan = [],
  } = data;

  const getStatusColor = (status: string) => {
    if (status?.includes('Achievable')) return 'text-green-500 bg-green-500/10 border-green-500/20';
    if (status?.includes('Challenging')) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    if (status?.includes('Risky')) return 'text-red-500 bg-red-500/10 border-red-500/20';
    return 'text-gray-400 bg-white/5 border-white/10';
  };

  // Loading state
  if (!data.overview && !strategy.length && !syllabus_breakdown.length) {
    return (
      <div className="p-12 text-center border border-white/5 rounded-2xl bg-white/[0.02] animate-pulse">
        <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.6em]">Synthesizing Master Guide...</p>
        <p className="mt-3 text-[11px] text-gray-500 font-bold italic">AI is creating your personalized permanent blueprint.</p>
      </div>
    );
  }

  // Detect if this is V14 (comprehensive) or V9 (legacy) format
  const isV14 = syllabus_breakdown.length > 0 || phase_plan.length > 0 || Object.keys(daily_strategy).length > 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-700">

      {/* 1. EXAM OVERVIEW */}
      <CollapsibleSection title="Exam Overview" icon="📊" defaultOpen={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-5 rounded-xl md:col-span-2">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em] mb-3">Readiness</p>
            <div className="flex items-end gap-4">
              <span className="text-5xl font-black text-white leading-none">{overview.readiness_score || 0}</span>
              <div className="pb-1 space-y-1.5 flex-1">
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all duration-1000" style={{ width: `${overview.readiness_score || 0}%` }} />
                </div>
              </div>
            </div>
          </div>
          <div className={`p-5 rounded-xl border flex flex-col justify-center ${getStatusColor(overview.feasibility_status)}`}>
            <p className="text-[10px] font-black uppercase tracking-wider opacity-60 mb-1.5">Feasibility</p>
            <p className="text-lg font-black tracking-tight">{overview.feasibility_status || '...'}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-5 rounded-xl flex flex-col justify-center">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Daily</p>
            <p className="text-lg font-black text-white">{overview.recommended_daily_hours || 0}h</p>
          </div>
        </div>
        {overview.key_insight && (
          <p className="text-[11px] text-gray-400 italic mt-4 bg-white/[0.03] border border-white/5 rounded-xl p-3.5">💡 {overview.key_insight}</p>
        )}
      </CollapsibleSection>

      {/* 2. SYLLABUS BREAKDOWN (V14) */}
      {isV14 && syllabus_breakdown.length > 0 && (
        <CollapsibleSection title="Syllabus Breakdown" icon="📚" defaultOpen={false}>
          <div className="space-y-3">
            {syllabus_breakdown.map((sub: any, i: number) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">#{sub.priority_order || i + 1}</span>
                    <h5 className="text-[13px] font-black text-white">{sub.subject}</h5>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${sub.weightage === 'High' ? 'text-red-400 bg-red-500/10' : sub.weightage === 'Medium' ? 'text-amber-400 bg-amber-500/10' : 'text-gray-400 bg-white/5'}`}>
                    {sub.weightage}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(sub.topics || []).map((t: string, j: number) => (
                    <span key={j} className="text-[10px] font-bold text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-lg">{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* 3. PHASE-WISE STUDY PLAN */}
      <CollapsibleSection title="Phase-wise Study Plan" icon="🎯" defaultOpen={true}>
        <div className="space-y-4">
          {(isV14 ? phase_plan : plan).map((p: any, i: number) => (
            <div key={i} className="bg-gradient-to-r from-white/[0.04] to-transparent border border-white/5 rounded-xl p-5 group hover:border-red-600/20 transition-all">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[9px] font-black text-red-600 uppercase tracking-wider bg-red-600/10 px-2 py-0.5 rounded-md">Phase {i + 1}</span>
                {isV14 && p.duration && <span className="text-[10px] text-gray-500 font-bold">{p.duration}</span>}
              </div>
              <h5 className="text-[13px] font-black text-white mb-2">{isV14 ? p.phase_name : p}</h5>
              {isV14 && p.focus && <p className="text-[11px] text-gray-400 italic mb-2">{p.focus}</p>}
              {isV14 && p.daily_targets && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {p.daily_targets.map((t: string, j: number) => (
                    <span key={j} className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">{t}</span>
                  ))}
                </div>
              )}
              {isV14 && p.milestone && (
                <p className="text-[10px] text-emerald-500 font-bold mt-2.5 flex items-center gap-1.5">✅ Milestone: {p.milestone}</p>
              )}
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* 4. DAILY STRATEGY (V14) */}
      {isV14 && Object.keys(daily_strategy).length > 0 && (
        <CollapsibleSection title="Daily Strategy" icon="☀️" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.entries(daily_strategy).map(([slot, info]: [string, any]) => (
              <div key={slot} className="bg-white/[0.03] border border-white/5 rounded-xl p-4">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-2 capitalize">{slot} {info.duration && `(${info.duration})`}</p>
                <div className="space-y-1.5">
                  {(info.activities || []).map((a: string, j: number) => (
                    <p key={j} className="text-[11px] text-gray-300 flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span> {a}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* 5. WEEKLY STRATEGY (V14) */}
      {isV14 && Object.keys(weekly_strategy).length > 0 && (
        <CollapsibleSection title="Weekly Strategy" icon="📅" defaultOpen={false}>
          <div className="space-y-3">
            {Object.entries(weekly_strategy).map(([day, plan]: [string, any]) => (
              <div key={day} className="flex items-start gap-4 bg-white/[0.02] border border-white/5 rounded-xl p-4">
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider w-24 flex-shrink-0 pt-0.5 capitalize">{day.replace(/_/g, ' ')}</span>
                <p className="text-[12px] text-gray-300 font-bold">{plan}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* 6. RESOURCES (V14) */}
      {isV14 && resources.length > 0 && (
        <CollapsibleSection title="Resources" icon="📖" defaultOpen={false}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {resources.map((r: any, i: number) => (
              <div key={i} className="bg-white/[0.03] border border-white/5 rounded-xl p-3.5 flex items-start gap-3">
                <span className="text-[9px] font-black text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5">{r.type}</span>
                <div>
                  <p className="text-[12px] font-bold text-white">{r.name}</p>
                  <p className="text-[10px] text-gray-500">{r.purpose}</p>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* 7. REVISION PLAN (V14) */}
      {isV14 && Object.keys(revision_plan).length > 0 && (
        <CollapsibleSection title="Revision Plan" icon="🔄" defaultOpen={false}>
          {revision_plan.method && <p className="text-[12px] text-gray-300 font-bold mb-3">Method: {revision_plan.method}</p>}
          {revision_plan.cycles && (
            <div className="space-y-2 mb-3">
              {revision_plan.cycles.map((c: string, i: number) => (
                <p key={i} className="text-[11px] text-gray-400 flex items-start gap-2"><span className="text-emerald-500">↻</span> {c}</p>
              ))}
            </div>
          )}
          {revision_plan.spaced_repetition && (
            <p className="text-[11px] text-gray-400 bg-white/[0.03] border border-white/5 rounded-xl p-3 italic">🧠 {revision_plan.spaced_repetition}</p>
          )}
        </CollapsibleSection>
      )}

      {/* 8. MOCK TEST STRATEGY (V14) */}
      {isV14 && Object.keys(mock_test_strategy).length > 0 && (
        <CollapsibleSection title="Mock Test Strategy" icon="📝" defaultOpen={false}>
          <div className="space-y-2.5">
            {mock_test_strategy.start_after && <p className="text-[11px] text-gray-300"><span className="font-bold text-gray-500">Start:</span> {mock_test_strategy.start_after}</p>}
            {mock_test_strategy.frequency && <p className="text-[11px] text-gray-300"><span className="font-bold text-gray-500">Frequency:</span> {mock_test_strategy.frequency}</p>}
            {mock_test_strategy.analysis_method && <p className="text-[11px] text-gray-300"><span className="font-bold text-gray-500">Analysis:</span> {mock_test_strategy.analysis_method}</p>}
            {mock_test_strategy.recommended_sources && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {mock_test_strategy.recommended_sources.map((s: string, i: number) => (
                  <span key={i} className="text-[10px] font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">{s}</span>
                ))}
              </div>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* 9. WEAK AREA PLAN (V14) */}
      {isV14 && Object.keys(weak_area_plan).length > 0 && (
        <CollapsibleSection title="Weak Area Improvement" icon="⚡" defaultOpen={false}>
          {weak_area_plan.identification_method && <p className="text-[11px] text-gray-300 mb-3"><span className="font-bold text-gray-500">How to identify:</span> {weak_area_plan.identification_method}</p>}
          {weak_area_plan.improvement_tactics && (
            <div className="space-y-1.5 mb-3">
              {weak_area_plan.improvement_tactics.map((t: string, i: number) => (
                <p key={i} className="text-[11px] text-gray-400 flex items-start gap-2"><span className="text-amber-500">→</span> {t}</p>
              ))}
            </div>
          )}
          {weak_area_plan.time_allocation && <p className="text-[11px] text-gray-400 bg-white/[0.03] border border-white/5 rounded-xl p-3">⏰ {weak_area_plan.time_allocation}</p>}
        </CollapsibleSection>
      )}

      {/* 10. FINAL MONTH STRATEGY (V14) */}
      {isV14 && Object.keys(final_month_strategy).length > 0 && (
        <CollapsibleSection title="Final Month Strategy" icon="🏁" defaultOpen={false}>
          <div className="space-y-3">
            {final_month_strategy.last_30_days && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3.5">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">Last 30 Days</p>
                <p className="text-[11px] text-gray-300">{final_month_strategy.last_30_days}</p>
              </div>
            )}
            {final_month_strategy.last_7_days && (
              <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3.5">
                <p className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-1">Last 7 Days</p>
                <p className="text-[11px] text-gray-300">{final_month_strategy.last_7_days}</p>
              </div>
            )}
            {final_month_strategy.exam_day && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3.5">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-wider mb-1">Exam Day</p>
                <p className="text-[11px] text-gray-300">{final_month_strategy.exam_day}</p>
              </div>
            )}
            {final_month_strategy.mental_preparation && (
              <p className="text-[11px] text-gray-400 italic">🧘 {final_month_strategy.mental_preparation}</p>
            )}
          </div>
        </CollapsibleSection>
      )}

      {/* LEGACY V9: Strategy + Priorities (backward compatible) */}
      {!isV14 && strategy.length > 0 && (
        <CollapsibleSection title="Strategic Approach" icon="🎯" defaultOpen={true}>
          <div className="space-y-4">
            {strategy.map((item: string, i: number) => (
              <div key={i} className="flex gap-4">
                <span className="text-[11px] font-black text-white/10 pt-0.5">0{i + 1}</span>
                <p className="text-[13px] text-gray-300 font-bold leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {!isV14 && priorities.length > 0 && (
        <CollapsibleSection title="High-Impact Priorities" icon="🔥" defaultOpen={true}>
          <div className="space-y-3">
            {priorities.map((p: string, i: number) => (
              <div key={i} className="p-4 bg-white/5 border border-white/5 rounded-xl flex items-center gap-4">
                <span className="text-[10px] font-black text-red-600">#{i + 1}</span>
                <p className="text-[12px] font-bold text-gray-300">{p}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* WARNINGS */}
      {warnings.length > 0 && (
        <CollapsibleSection title="Critical Warnings" icon="⚠️" defaultOpen={false}>
          <div className="space-y-3">
            {warnings.map((w: string, i: number) => (
              <p key={i} className="text-[12px] font-bold text-red-200/80 leading-relaxed italic border-l-2 border-red-500/30 pl-3.5">{w}</p>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* SUCCESS FORMULA */}
      {success_formula.length > 0 && (
        <CollapsibleSection title="Success Formula" icon="🏆" defaultOpen={true}>
          <div className="space-y-3">
            {success_formula.map((rule: string, i: number) => (
              <div key={i} className="flex items-center gap-3.5">
                <div className="w-1.5 h-1.5 bg-red-600 rounded-full flex-shrink-0" />
                <p className="text-[13px] font-black text-white italic tracking-tight">{rule}</p>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Permanent Badge */}
      <div className="pt-6 text-center flex flex-col items-center gap-1.5">
        <div className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-full">
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">One-Time Permanent Blueprint • No Modification Possible</p>
        </div>
        <p className="text-[10px] font-bold text-white/5 italic">SarkarHamariHai V14 Engine</p>
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
          if (r.tier) { /* roadmap tier is available if needed */ }
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

  const [roadmapProgress, setRoadmapProgress] = useState(0);

  const handleRoadmap = async () => {
    if (!job || roadmap) return;
    setLoadingRoadmap(true);
    setRoadmapError('');
    setRoadmapProgress(0);

    // Immediately show skeleton placeholder
    const skeletonData = {
      overview: {
        exam_name: job.job_name,
        readiness_score: 0,
        feasibility_status: 'Generating...',
        recommended_daily_hours: 0,
        days_remaining: 0,
        key_insight: 'AI is building your personalized master guide...',
        is_ready: false
      },
      syllabus_breakdown: [],
      phase_plan: [{ phase_name: 'Initializing...', duration: 'Calculating', daily_targets: ['AI analyzing your profile'], milestone: 'Loading...' }],
      daily_strategy: {},
      weekly_strategy: {},
      resources: [],
      revision_plan: {},
      mock_test_strategy: {},
      weak_area_plan: {},
      final_month_strategy: {},
      warnings: [],
      success_formula: [],
      _isLoading: true
    };
    setRoadmap(skeletonData as any);

    try {
      await api.generateRoadmap(job.id);

      // Progressive polling with smooth progress bar
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = 2000;

      const poll = async () => {
        try {
          const check = await api.getGeneratedRoadmap(job.id);
          const content = check?.roadmap_content;
          attempts++;
          setRoadmapProgress(Math.min(95, Math.round((attempts / maxAttempts) * 100)));

          if (content && (content.is_ready || content.overview?.is_ready)) {
            // Smooth transition: update progress to 100%, then swap content
            setRoadmapProgress(100);
            setTimeout(() => {
              setRoadmap(content);
              setLoadingRoadmap(false);
            }, 300);
          } else if (attempts < maxAttempts) {
            setTimeout(poll, pollInterval);
          } else {
            // Timeout: use whatever we have
            setRoadmapProgress(100);
            setTimeout(() => {
              setRoadmap(content || skeletonData);
              setLoadingRoadmap(false);
            }, 300);
          }
        } catch {
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, pollInterval);
          } else {
            setLoadingRoadmap(false);
          }
        }
      };

      setTimeout(poll, 1500); // Give backend 1.5s head start
    } catch (err: any) {
      console.error('[V14 MasterPlan] API Fail:', err);
      // Client-side fallback
      const syllabus = job.syllabus || job.job_name;
      const kw = syllabus.split(/[,;|(\n]/).map((s:string) => s.trim()).filter((s:string) => s.length > 2);
      const chunk = Math.max(1, Math.ceil(kw.length / 4));
      const fallback = {
        overview: { exam_name: job.job_name, readiness_score: 15, feasibility_status: 'Achievable', recommended_daily_hours: 4, days_remaining: 90, key_insight: 'Start with fundamentals, build daily consistency.' },
        syllabus_breakdown: [{ subject: kw[0] || 'General Studies', topics: kw.slice(0, 4), weightage: 'High', priority_order: 1 }],
        phase_plan: [
          { phase_name: 'Phase 1: Foundation', duration: '3 weeks', focus: 'Core concepts', daily_targets: kw.slice(0, 3), milestone: 'Complete basics' },
          { phase_name: 'Phase 2: Practice', duration: '4 weeks', focus: 'Problem solving', daily_targets: kw.slice(chunk, chunk + 3), milestone: 'Mock readiness' },
          { phase_name: 'Phase 3: Revision', duration: '2 weeks', focus: 'Full revision + mocks', daily_targets: ['Revise weak areas', 'Daily mock tests'], milestone: 'Exam day' }
        ],
        daily_strategy: { morning: { duration: '3h', activities: ['New topic study', 'Note-making'] }, afternoon: { duration: '2h', activities: ['Practice questions', 'Previous year papers'] }, evening: { duration: '2h', activities: ['Revision', 'Current affairs'] } },
        weekly_strategy: { weekdays: 'Rotate subjects daily', saturday: 'Full mock test + analysis', sunday: 'Weekly revision + weak areas' },
        resources: [{ type: 'Book', name: 'Standard textbook', purpose: 'Concept building' }],
        revision_plan: { method: 'Active Recall + Spaced Repetition', cycles: ['After each topic', 'Weekly consolidated', 'Pre-exam sweep'], spaced_repetition: 'Day 1, 3, 7, 14, 30 intervals' },
        mock_test_strategy: { start_after: 'Phase 2', frequency: '2 per week, daily in last month', analysis_method: 'Categorize mistakes: conceptual vs silly', recommended_sources: ['Previous year papers'] },
        weak_area_plan: { identification_method: 'Track mock errors by topic', improvement_tactics: ['30 min daily on weakest subject', 'Topic-wise quizzes'], time_allocation: '20% of study time' },
        final_month_strategy: { last_30_days: 'Only revision + mocks', last_7_days: 'Light revision, formula sheets', exam_day: 'Arrive early, attempt easy first', mental_preparation: '7-8 hours sleep, eat light' },
        warnings: ['Do not start new topics in final month', 'Track progress weekly'],
        success_formula: ['Consistency beats intensity', 'Mock tests are non-negotiable', 'Track progress weekly'],
        is_ready: true, is_permanent: true
      };
      setRoadmap(fallback as any);
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

        <div className="bg-[#0e0e0e] rounded-2xl border border-[#141414] overflow-hidden shadow-2xl">

          {/* ── HEADER ───────────────────────────────────────────────── */}
          <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-6 sm:pb-7">
            <div className="flex flex-col gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <StatusBadge status={job.form_status} />
                  <span className="text-[11px] font-bold text-gray-500 bg-[#141414] border border-[#1e1e1e] px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {job.job_category}
                  </span>
                  {(job as any).allows_final_year_students && (
                    <span className="text-[11px] font-bold text-blue-400 bg-blue-950/40 border border-blue-900/30 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {t('job.finalYearEligible')}
                    </span>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-4">{examTitle}</h1>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-4 text-[11px]">
                  <span className="text-gray-400 font-bold uppercase tracking-widest bg-gray-500/5 px-2 py-0.5 rounded border border-gray-500/10">
                    {job.organization}
                  </span>

                  {/* Verification Indicator */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-950/20 border border-emerald-900/30 rounded-lg text-emerald-500 font-bold uppercase tracking-tighter">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    <span>Official Source</span>
                  </div>

                  <div className="flex items-center gap-2 px-2.5 py-1 bg-[#111] border border-[#1a1a1a] rounded-lg text-gray-500 font-bold uppercase tracking-tighter">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span>Updated {fmt((job as any).last_updated || new Date().toISOString().split('T')[0])}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── ACTION STRIP ────────────────────────────────────────── */}
          <div className="bg-[#111] px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 border-t border-[#1a1a1a]">

            <div className="flex gap-3 items-center">
              {/* Save button */}
              <button
                onClick={handleLike}
                disabled={likeLoading}
                title={liked ? 'Remove from saved' : 'Save this exam'}
                className={`p-3 rounded-xl border transition-all duration-150 flex-shrink-0 flex-1 sm:flex-none justify-center flex items-center ${liked
                  ? 'bg-red-950/50 border-red-800/50 text-red-500 shadow-[0_0_20px_rgba(220,38,38,0.15)] ring-1 ring-red-500/20'
                  : 'bg-[#141414] border-[#252525] text-gray-500 hover:text-red-400 hover:bg-[#1a1a1a] hover:border-red-900/40'
                  }`}
              >
                <svg
                  className={`w-6 h-6 transition-transform ${liked ? 'animate-heart-live' : ''}`}
                  viewBox="0 0 24 24"
                  fill={liked ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth={liked ? 1.5 : 2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>

              {applied ? (
                <button
                  onClick={() => setShowUnmarkConfirm(true)}
                  disabled={appliedLoading}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black bg-red-950/20 text-red-500 hover:bg-red-900/40 transition-all border border-red-500/30 shadow-[0_0_25px_rgba(239,68,68,0.25)] animate-pulse flex-1 uppercase tracking-wider"
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Unmark Applied
                </button>
              ) : (isLive || isRecentlyClosed || job.form_status === 'CLOSED') && (
                <button
                  onClick={handleApplyToggle}
                  disabled={appliedLoading}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black transition-all flex-1 bg-[#141414] border border-[#252525] text-gray-300 hover:bg-[#1a1a1a] hover:border-blue-900/40 uppercase tracking-wider"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {t('job.markApplied')}
                </button>
              )}
            </div>

            {/* Main Action Group */}
            <div className="flex flex-col sm:flex-row flex-1 gap-3">
              {isLive && appLink && (
                <a
                  href={appLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl text-sm transition-all shadow-xl shadow-emerald-950/50 flex-1 justify-center uppercase tracking-widest"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span>Apply Now</span>
                </a>
              )}
              {!isLive && appLink && (
                <a
                  href={appLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#141414] hover:bg-[#1a1a1a] text-gray-300 font-black rounded-xl text-sm transition-all border border-[#252525] flex-1 justify-center uppercase tracking-widest"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Official Page</span>
                </a>
              )}

              {isLive && !applied && (
                <button
                  onClick={handleReminderToggle}
                  disabled={reminderLoading || appliedLoading}
                  className={`inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-xl text-sm font-black transition-all flex-1 relative overflow-hidden uppercase tracking-wider ${reminding
                    ? 'bg-purple-900/40 border border-purple-700/50 text-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.2)] ring-1 ring-purple-500/50'
                    : 'bg-[#141414] border border-[#252525] text-gray-400 hover:text-purple-400 hover:bg-[#1a1a1a] hover:border-purple-900/40'
                    }`}
                >
                  {reminding && <div className="absolute inset-0 bg-purple-500/10 animate-pulse"></div>}
                  <svg className={`w-5 h-5 relative z-10 ${reminding ? 'animate-[ring_1s_ease-in-out_infinite] origin-top text-purple-400' : ''}`} fill={reminding ? "currentColor" : "none"} stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="relative z-10">{reminding ? t('job.remindersOn') : t('job.remindDaily')}</span>
                </button>
              )}
            </div>

            {/* Meta Info Group */}
            <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
              {isLive && daysRemaining !== null && (
                <span className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-black text-red-500 bg-red-950/30 border border-red-900/40 animate-pulse flex-1 sm:flex-none justify-center whitespace-nowrap uppercase tracking-widest shadow-lg shadow-red-950/20">
                  {daysRemaining === 0 ? "⚠️ Closing Today" : `⏳ ${daysRemaining} ${t('job.daysLeft')}`}
                </span>
              )}
              
              {(isRecentlyClosed || job.form_status === 'CLOSED' || job.form_status === 'UPCOMING') && !applied && (
                <span className={`inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black flex-1 sm:flex-none uppercase tracking-wider ${isRecentlyClosed
                  ? 'bg-orange-950/40 border border-orange-900/30 text-orange-500 shadow-xl shadow-orange-900/20'
                  : job.form_status === 'UPCOMING'
                    ? 'bg-amber-950/30 border border-amber-900/25 text-amber-500 shadow-xl shadow-amber-900/20'
                    : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400'
                  }`}>
                  {job.form_status === 'UPCOMING' && t('job.formNotOpen')}
                  {job.form_status === 'UPCOMING' && daysUntilOpen !== null && (
                    <span className="ml-1 text-[11px] font-black text-amber-500 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/30 animate-pulse">
                      ⏳ Opens in {daysUntilOpen}d
                    </span>
                  )}
                  {isRecentlyClosed && t('job.recentlyClosedMsg')}
                  {job.form_status === 'CLOSED' && t('job.applicationClosed')}
                </span>
              )}
            </div>
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
              <div className="bg-[#0a0a0a] border border-[#161616] rounded-xl shadow-inner overflow-hidden transition-all duration-500">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#161616] bg-[#0d0d0d]">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('job.aiGenerated')}</span>
                    {loadingRoadmap && (
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                        <span className="text-[9px] font-black text-red-500/60 uppercase tracking-wider animate-pulse">Generating...</span>
                      </div>
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

                {/* Progress bar during loading */}
                {loadingRoadmap && (
                  <div className="h-1 bg-[#111] overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-600 via-purple-600 to-red-600 transition-all duration-700 ease-out"
                      style={{ width: `${roadmapProgress}%` }}
                    />
                  </div>
                )}

                {!isRoadmapMinimized && (
                  <div className={`p-5 transition-opacity duration-500 ${loadingRoadmap ? 'opacity-60' : 'opacity-100'}`}>
                    {loadingRoadmap ? (
                      <RoadmapSkeleton progress={roadmapProgress} examName={job.job_name} />
                    ) : (
                      <RoadmapContent content={roadmap} />
                    )}
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
                {roadmapError && (
                  <p className="text-xs text-red-500 font-medium px-4">{roadmapError}</p>
                )}
                <button
                  onClick={handleRoadmap}
                  disabled={loadingRoadmap}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-red-800 text-white hover:bg-red-700 text-sm font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 disabled:opacity-50"
                >
                  {t('job.generateRoadmap')}
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
