import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser } from '../api';
import { Job } from '../types';
import { useLanguage } from '../i18n/LanguageContext';

interface Props {
  job: Job;
  isLiked: boolean;
  onLikeToggle: (liked: boolean) => void;
  isApplied: boolean;
  onApplyToggle: (applied: boolean) => void;
  onBeforeNavigate?: () => void;
  staggerIndex?: number;
}

const JobCard = React.memo(function JobCard({ job, isLiked, onLikeToggle, isApplied, onApplyToggle, onBeforeNavigate, staggerIndex = 0 }: Props) {
  const navigate = useNavigate();
  const user = getCachedUser();
  const { t, language } = useLanguage();
  const [likeLoading, setLikeLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [likeBeat, setLikeBeat] = useState(false);

  // Dynamic translated title
  const examTitle = (job as any)[`exam_name_${language}`] || job.job_name;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    // Optimistic UI toggle immediately for that snappy, refined feel
    setLikeLoading(true);
    const newLikedStatus = !isLiked;
    onLikeToggle(newLikedStatus);
    // Trigger heartbeat pulse
    setLikeBeat(true);
    setTimeout(() => setLikeBeat(false), 400);

    try {
      if (newLikedStatus) {
        await api.likeJob(job.id);
      } else {
        await api.unlikeJob(job.id);
      }
      window.dispatchEvent(new Event('app:likeToggled'));
    } catch (err) {
      console.error(err);
      // Revert the UI if the server request fails
      onLikeToggle(isLiked);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleApply = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    setApplyLoading(true);
    const newAppliedStatus = !isApplied;
    onApplyToggle(newAppliedStatus);

    try {
      await api.toggleApplied(job.id);
    } catch (err) {
      console.error(err);
      onApplyToggle(isApplied);
    } finally {
      setApplyLoading(false);
    }
  };

  const isLive = job.form_status === 'LIVE';
  const isRecentlyClosed = job.form_status === 'RECENTLY_CLOSED';
  const statusStyle = isLive
    ? 'text-emerald-400 bg-emerald-900/15 border-emerald-900/25'
    : job.form_status === 'UPCOMING'
      ? 'text-amber-400 bg-amber-900/15 border-amber-900/25'
      : isRecentlyClosed
        ? 'text-orange-400 bg-orange-900/15 border-orange-900/25'
        : 'text-gray-600 bg-[#101010] border-[#191919]';

  const statusLabel = job.form_status === 'RECENTLY_CLOSED' ? t('job.recentlyClosed') : job.form_status === 'LIVE' ? t('tab.live') : job.form_status === 'UPCOMING' ? t('job.upcoming') : t('job.closed');

  // Calculate days until open and remaining
  let daysRemaining = null;
  let daysUntilOpen = null;
  let daysSinceClosed = null;
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
  } else if (isRecentlyClosed && job.application_end_date) {
    const end = new Date(job.application_end_date);
    end.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - end.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays >= 0) daysSinceClosed = diffDays;
  }

  // Calculate User Age
  let userAge: number | null = null;
  if (user?.dob) {
    const dob = new Date(user.dob);
    const ageDifMs = today.getTime() - dob.getTime();
    const ageDate = new Date(Math.abs(ageDifMs));
    userAge = Math.abs(ageDate.getUTCFullYear() - 1970);
  }

  // Dynamic Eligibility logic
  let isEligible = false;
  if (user && userAge !== null && user.qualification_type) {
    const meetsAge = userAge >= job.minimum_age && userAge <= job.maximum_age;
    
    const qualRank: Record<string, number> = {
      '10th': 1,
      '12th': 2,
      'Diploma': 2.5,
      'Graduation': 3,
      'Post Graduation': 4
    };
    
    const userRank = qualRank[user.qualification_type] || 0;
    const reqRank = qualRank[job.qualification_required] || 0;
    const meetsQual = userRank >= reqRank;
    
    isEligible = meetsAge && meetsQual;
  }

  // Dynamic relevance Match
  const isHighMatch = isEligible && job.salary_min >= 40000;

  // Stagger entry animation up to 25 items for a beautiful cascading effect
  const delay = Math.min(staggerIndex, 25) * 0.03;

  return (
    <div
      onClick={() => {
        onBeforeNavigate?.();
        if (document.startViewTransition) {
          document.startViewTransition(() => navigate(`/jobs/${job.id}`));
        } else {
          navigate(`/jobs/${job.id}`);
        }
      }}
      style={{ animationDelay: `${delay}s`, animationFillMode: 'both' }}
      className={`animate-cardIn card-hover bg-white dark:bg-[#0e0e0e] rounded-xl border p-3.5 sm:p-4 cursor-pointer group transition-all duration-300 hover:shadow-2xl hover:shadow-green-500/10 group-hover:-translate-y-1 hover:-translate-y-1 ${isApplied
        ? 'border-blue-900/40 bg-blue-950/5 hover:border-blue-800/60'
        : 'border-[#141414] hover:border-[#252525] hover:bg-[#101010]'
        }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-[9.5px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide ${statusStyle}`}>
              {statusLabel}
            </span>
            <span className="text-[9.5px] text-gray-600 bg-[#111] px-1.5 py-0.5 rounded border border-[#191919] truncate max-w-[140px] font-medium">
              {job.organization}
            </span>
            {isHighMatch && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded border font-bold tracking-tight text-emerald-400 bg-emerald-900/15 border-emerald-900/25 flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                {t('jobDetails.match')}
              </span>
            )}
            {!isHighMatch && isEligible && (
              <span className="text-[9.5px] px-1.5 py-0.5 rounded border font-bold tracking-tight text-blue-400 bg-blue-900/15 border-blue-900/25 flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                {t('jobDetails.eligibility')}
              </span>
            )}
          </div>
          <h3 className="text-[15px] sm:text-base font-bold text-gray-100 leading-tight group-hover:text-white transition-colors line-clamp-2">
            {examTitle}
          </h3>
          <div className="flex items-center text-[10px] text-gray-600 mt-2 gap-2 flex-wrap font-medium">
            <span className="flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.242-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              {t('job.india') || 'India'}
            </span>
            <span className="opacity-30">•</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-gray-500 bg-[#111] border border-[#191919]">
              <svg className="w-2.5 h-2.5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              {t('job.govSource') || 'Gov Source'}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            onClick={handleLike}
            disabled={likeLoading}
            className={`p-2 rounded-lg border transition-all duration-150 ${isLiked ? 'bg-red-900/20 border-red-900/30 text-red-400' : 'bg-[#111] border-[#1e1e1e] text-gray-600 hover:text-red-400 hover:border-[#252525] hover:bg-[#141414]'}`}
            title={isLiked ? (t('job.saved') || 'Saved') : (t('job.saveThisJob') || 'Save this job')}
          >
            <svg className={`w-4 h-4 ${likeBeat ? 'animate-heartbeat' : ''}`} viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>
 
          {(isLive || isRecentlyClosed || job.form_status === 'CLOSED') && (
            <button
              onClick={handleApply}
              disabled={applyLoading}
              className={`p-2 rounded-lg border transition-all ${isApplied ? 'bg-blue-900/20 border-blue-900/40 text-blue-400' : 'bg-[#111] border-[#1e1e1e] text-gray-500 hover:text-blue-400 hover:border-blue-900/30 hover:bg-[#141414]'}`}
              title={isApplied ? (t('job.applied')) : (t('job.markApplied'))}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                {isApplied ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                )}
              </svg>
            </button>
          )}
        </div>
      </div>
 
      <div className="grid grid-cols-2 gap-2 mt-4">
        <div className="bg-[#090909]/40 rounded-lg p-2.5 border border-[#141414]">
          <p className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">{t('job.age')}</p>
          <p className="text-xs text-gray-400 font-bold mt-1.5">{job.minimum_age}–{job.maximum_age} {t('job.years')}</p>
        </div>
        <div className="bg-[#090909]/40 rounded-lg p-2.5 border border-[#141414]">
          <p className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">{t('job.qualification')}</p>
          <p className="text-xs text-gray-400 font-bold mt-1.5 truncate">{job.qualification_required}</p>
        </div>
        {job.salary_max > 0 && (
          <div className="col-span-2 bg-[#090909]/40 rounded-lg p-2.5 border border-[#141414]">
            <p className="text-[10px] text-gray-700 font-bold uppercase tracking-wider">{t('job.salary')}</p>
            <p className="text-xs text-emerald-500/80 font-bold mt-1.5">₹{job.salary_min.toLocaleString('en-IN')} – ₹{job.salary_max.toLocaleString('en-IN')}</p>
          </div>
        )}
      </div>
 
      {(isLive || job.form_status === 'UPCOMING') && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[10px] text-gray-700 font-medium">
            {isLive ? t('job.closes') : t('job.opens')}: <span className="text-gray-500">{isLive ? job.application_end_date : job.application_start_date}</span>
          </p>
          {isLive && daysRemaining !== null && (
            <span className="text-[9.5px] font-black text-red-500 bg-red-950/30 px-2 py-0.5 rounded border border-red-900/30 animate-pulse whitespace-nowrap uppercase tracking-tighter">
              {daysRemaining === 0 ? "⚠️ Closing Today" : `⏳ ${daysRemaining} days left`}
            </span>
          )}
          {job.form_status === 'UPCOMING' && daysUntilOpen !== null && (
            <span className="text-[9.5px] font-black text-emerald-500 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/30 animate-pulse uppercase tracking-tighter">
              ⏳ Opens in {daysUntilOpen}d
            </span>
          )}
        </div>
      )}
      {isRecentlyClosed && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[10px] text-orange-700 font-medium">
            {t('job.closed')}: <span className="text-orange-600">{job.application_end_date}</span>
          </p>
          {daysSinceClosed !== null && (
            <span className="text-[9.5px] font-black text-orange-500 bg-orange-950/30 px-2 py-0.5 rounded border border-orange-900/30 uppercase tracking-tighter">
              ⏳ Closed {daysSinceClosed}d ago
            </span>
          )}
        </div>
      )}
      {/* Hover Reveal Arrow Indicator */}
      <div className="absolute bottom-5 right-5 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300 text-green-600 dark:text-green-500">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
      </div>

    </div>
  );
});

export default JobCard;
