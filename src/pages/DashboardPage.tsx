import { useState, useEffect, useCallback, useMemo, useRef, startTransition } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, getCachedUser } from '../api';
import { Job } from '../types';
import Navbar from '../components/Navbar';
import JobCard from '../components/JobCard';


import { useLanguage } from '../i18n/LanguageContext';
import RecommendationsWidget from '../components/RecommendationsWidget';
import GovLoader from '../components/GovLoader';
import { LayoutDashboard, Sparkles, Search, XCircle, ChevronDown } from 'lucide-react';
import { meetsTechnicalCriteria, meetsAge, meetsQualification } from '../utils';

import { CANONICAL_STATES, CANONICAL_CATEGORIES, indianStatesCanonical } from '../data/states';

export type TabKey = 'eligible' | 'eligibleLive' | 'partial' | 'live' | 'upcoming' | 'closed' | 'liked' | 'applied' | 'all';

// Removed: meetsStateFilter (now entirely handled natively by PostgreSQL backend)

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const cachedUser = getCachedUser();
  const [user, setUser] = useState<any>(cachedUser || { full_name: 'Guest' });

  const [rawAllJobs, setRawAllJobs] = useState<Job[]>([]);
  const [rawEligibleJobs, setRawEligibleJobs] = useState<Job[]>([]);
  const [rawPartialJobs, setRawPartialJobs] = useState<Job[]>([]);
  const [likedJobs, setLikedJobs] = useState<Job[]>([]);
  const [appliedJobs, setAppliedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCriticalLoaded, setIsCriticalLoaded] = useState(false);

  const [criticalError, setCriticalError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // Startup-grade Auto Recovery Array
  useEffect(() => {
    if (criticalError) {
      const t = setTimeout(() => window.location.reload(), 15000);
      return () => clearTimeout(t);
    }
  }, [criticalError]);

  // Helper to safely get the initial tab
  const getInitialTab = useCallback((): TabKey => {
    const urlTab = searchParams.get('tab') as TabKey;
    const validTabs: TabKey[] = ['eligible', 'eligibleLive', 'partial', 'live', 'upcoming', 'closed', 'liked', 'applied', 'all'];
    if (urlTab && validTabs.includes(urlTab)) return urlTab;
    const storedTab = localStorage.getItem('dashboard_last_tab') as TabKey;
    if (storedTab && validTabs.includes(storedTab as TabKey)) return storedTab as TabKey;
    return 'all';
  }, [searchParams]);

  // Explicit state for active tab
  const [activeTab, setActiveTabState] = useState<TabKey>(getInitialTab());
  // visualTab updates instantly for zero-lag UI feedback
  const [visualTab, setVisualTab] = useState<TabKey>(getInitialTab());
  const [isSwitching, setIsSwitching] = useState(false);
  const [viewMode, setViewMode] = useState<'exams' | 'recs'>((localStorage.getItem('dashboard_view_mode') as 'exams' | 'recs') || 'exams');

  // Progressive rendering state
  const INITIAL_BATCH = 30;
  const [visibleCount, setVisibleCount] = useState(INITIAL_BATCH);
  const [tabIsAnimating, setTabIsAnimating] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevTabRef = useRef<TabKey>(getInitialTab());

  const [selectedState, setSelectedState] = useState<string>('All India');

  // Unified setter with guaranteed zero-lag paint
  const setActiveTab = useCallback((tab: TabKey) => {
    if (tab === prevTabRef.current) return;

    // 1. IMMEDIATELY update the visual UI and hide old content.
    // This is mathematically the minimal amount of work React can do,
    // ensuring the tab underline moves and the screen clears instantly.
    setVisualTab(tab);
    // Keep current height during transition to prevent layout jump
    const currentHeight = document.querySelector('.tab-panel')?.clientHeight;
    if (currentHeight) (document.querySelector('.tab-panel') as HTMLElement).style.minHeight = `${currentHeight}px`;
    setIsSwitching(true);

    // 2. Yield the main thread to the browser so it can physically paint the instant UI change.
    // setTimeout(..., 10) ensures the browser has time to rasterize and draw the frame.
    setTimeout(() => {
      setVisibleCount(6);
      setTabIsAnimating(true);
      setActiveTabState(tab);
      prevTabRef.current = tab;
      setIsSwitching(false);
      
      // Clear min-height after transition
      const panel = document.querySelector('.tab-panel') as HTMLElement;
      if (panel) panel.style.minHeight = '';

      localStorage.setItem('dashboard_last_tab', tab);

      // Defer React Router completely into the background
      startTransition(() => {
        setSearchParams(prev => {
          const next = new URLSearchParams(prev);
          next.set('tab', tab);
          return next;
        }, { replace: true });
      });
    }, 15);

  }, [setSearchParams]);

  // 3. Incrementally render the rest of the batch using rAF so the main thread never blocks
  useEffect(() => {
    if (!tabIsAnimating) return;

    let frameId: number;
    const renderMore = () => {
      setVisibleCount(prev => {
        if (prev >= INITIAL_BATCH) {
          setTabIsAnimating(false);
          return prev;
        }
        // Add 8 more cards per frame until we hit the batch size
        return Math.min(prev + 8, INITIAL_BATCH);
      });
      if (visibleCount < INITIAL_BATCH) {
        frameId = requestAnimationFrame(renderMore);
      }
    };

    frameId = requestAnimationFrame(renderMore);
    return () => cancelAnimationFrame(frameId);
  }, [tabIsAnimating, visibleCount]);

  // Sync state with URL changes (e.g., browser Back/Forward)
  useEffect(() => {
    const urlTab = searchParams.get('tab') as TabKey;
    if (urlTab && urlTab !== activeTab) {
      setActiveTabState(urlTab);
      setVisualTab(urlTab); // Sync visual state for instant UI update
      localStorage.setItem('dashboard_last_tab', urlTab);
    }
  }, [searchParams]); // Only depend on searchParams to avoid "revert" race condition

  // Ensure URL is populated on initial load
  useEffect(() => {
    const urlTab = searchParams.get('tab');
    if (!urlTab) {
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.set('tab', activeTab);
        return next;
      }, { replace: true });
    }
  }, []); // Only once on mount

  // Declare filter state before the useMemos that reference them
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [dbCategories, setDbCategories] = useState<string[]>([]);
  const [dbStates, setDbStates] = useState<string[]>([]);

  // Preload categories and states from DB for instant dropdowns
  useEffect(() => {
    api.getCategories().then(cats => {
      if (Array.isArray(cats) && cats.length > 1) setDbCategories(cats);
    }).catch(() => {});
    api.getStates().then(states => {
      if (Array.isArray(states) && states.length > 0) setDbStates(states);
    }).catch(() => {});
  }, []);

  const statesDropdown = useMemo(() => {
    // Use canonical list — always complete, no variants
    return ['All India', ...CANONICAL_STATES];
  }, []);
  
    
  const allJobs = useMemo(() => {
    return [...rawAllJobs].sort((a, b) => {
      const nameA = a.job_name || '';
      const nameB = b.job_name || '';
      return nameA.localeCompare(nameB, undefined, { sensitivity: 'base' });
    });
  }, [rawAllJobs]);
  const eligibleJobs = useMemo(() => {
    return [...rawEligibleJobs].sort((a, b) => (a.job_name || '').localeCompare(b.job_name || '', undefined, { sensitivity: 'base' }));
  }, [rawEligibleJobs]);
  const partialJobs = useMemo(() => {
    return [...rawPartialJobs].sort((a, b) => (a.job_name || '').localeCompare(b.job_name || '', undefined, { sensitivity: 'base' }));
  }, [rawPartialJobs]);

  const liveJobs = useMemo(() => allJobs.filter(j => j.form_status === 'LIVE'), [allJobs]);
  const upcomingJobs = useMemo(() => allJobs.filter(j => j.form_status === 'UPCOMING'), [allJobs]);
  const recentlyClosedJobs = useMemo(() => allJobs.filter(j => j.form_status === 'RECENTLY_CLOSED'), [allJobs]);
  const closedJobs = useMemo(() => allJobs.filter(j => j.form_status === 'CLOSED' || j.form_status === 'RECENTLY_CLOSED'), [allJobs]);
  const eligibleLiveJobs = useMemo(() => eligibleJobs.filter(j => j.form_status === 'LIVE'), [eligibleJobs]);

  const categories = useMemo(() => {
    // Start with canonical categories, merge any DB-specific ones
    const merged = new Set([...CANONICAL_CATEGORIES, ...dbCategories]);
    merged.delete('All');
    merged.delete('Other');
    merged.delete('Others');
    merged.delete('Misc');
    
    const sorted = Array.from(merged).sort((a, b) => a.localeCompare(b));
    return ['All', ...sorted];
  }, [dbCategories]);

  // ── Scroll & State Persistence ──────────────────────────────
  const isRestoringScroll = useRef(false);
  
  // Restore state on mount
  useEffect(() => {
    const saved = sessionStorage.getItem('dashboard_nav_state');
    if (saved) {
      try {
        const { search: sSearch, category: sCat, selectedState: sState, activeTab: sTab, viewMode: sView } = JSON.parse(saved);
        if (sSearch) setSearch(sSearch);
        if (sCat) setCategory(sCat);
        if (sState) setSelectedState(sState);
        if (sTab) {
          setActiveTabState(sTab);
          setVisualTab(sTab);
        }
        if (sView) setViewMode(sView);
      } catch (e) {
        console.error("Failed to restore dashboard state:", e);
      }
    }
  }, []);

  const saveNavState = useCallback(() => {
    const state = {
      search,
      category,
      selectedState,
      activeTab,
      viewMode,
      scrollPosition: window.scrollY
    };
    sessionStorage.setItem('dashboard_nav_state', JSON.stringify(state));
  }, [search, category, selectedState, activeTab, viewMode]);
  
  // Scroll listener ─────────────────────────────────────────────────────────────
  // LOCK ON MOUNT — prevents the scroll listener from saving y=0 during
  // the initial loading phase before restoration can read sessionStorage.
  // LOCK ON MOUNT — prevents the scroll listener from saving y=0 during
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // Disable browser's own scroll restoration (it fights our manual one)
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  // Scroll listener — only saves when NOT loading AND NOT restoring
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleScroll = () => {
      if (isRestoringScroll.current || loadingRef.current) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (isRestoringScroll.current || loadingRef.current) return;
        const y = Math.max(
          window.scrollY,
          document.documentElement.scrollTop,
          document.body?.scrollTop || 0
        );
        sessionStorage.setItem(`dashboard_scroll_${activeTab}_${viewMode}`, y.toString());
      }, 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [activeTab]);

  // Restore scroll after loading is complete
  useEffect(() => {
    if (!loading) {
      const saved = sessionStorage.getItem('dashboard_nav_state');
      if (saved) {
        try {
          const { scrollPosition, activeTab: sTab, viewMode: sView } = JSON.parse(saved);
          if (activeTab === sTab && viewMode === sView && scrollPosition > 0) {
            isRestoringScroll.current = true;
            
            // Use requestAnimationFrame to ensure DOM is rendered before scrolling
            const restore = () => {
              window.scrollTo({ top: scrollPosition, behavior: 'instant' });
              // Double check in next frame for stability
              requestAnimationFrame(() => {
                window.scrollTo({ top: scrollPosition, behavior: 'instant' });
                isRestoringScroll.current = false;
              });
            };
            
            requestAnimationFrame(restore);
          }
        } catch (e) {
          isRestoringScroll.current = false;
        }
      }
    }
  }, [loading, activeTab, viewMode]);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) setGreeting(t('greeting.morning'));
    else if (h >= 12 && h < 17) setGreeting(t('greeting.afternoon'));
    else if (h >= 17 && h < 21) setGreeting(t('greeting.evening'));
    else setGreeting(t('greeting.default'));
  }, [t]);

  // Data Loading Trigger
  useEffect(() => {
    if (!cachedUser) { navigate('/login'); return; }

    const isMockGuest = localStorage.getItem('sarkar_token')?.startsWith('mock_guest_token_');

      const loadData = async () => {
        setLoading(true);
        setIsCriticalLoaded(false);
  
        try {
          // ── PHASE 1: Fetch user & accurately filtered jobs via exact SQL ──────
          let authFailed = false;
          
          const [me, jobsResponse] = await Promise.all([
            api.getMe().catch(err => {
               if (!isMockGuest && err.message && (err.message.includes('Session expired') || err.message.includes('401'))) {
                 authFailed = true;
               }
               return cachedUser || { full_name: 'Guest', age: 0 };
            }),
            api.getJobsAllMinimal().catch(err => {
               console.error('getJobsAllMinimal failed:', err);
               return { jobs: [] };
            }),
          ]);
          
          if (authFailed && !isMockGuest) {
            navigate('/login');
            return;
          }
          
          const resolvedUser = (me && me.full_name) ? me : (cachedUser || { full_name: 'Guest', age: 0 });
          
          // The database ALREADY exact-matched 'state' and 'category'. 
          const validJobs = Array.isArray(jobsResponse?.jobs) ? jobsResponse.jobs : [];
          setRawAllJobs(validJobs);
          
          // Compute eligible/partial purely from the localized DB payload
          const hasCompleteProfile = !!(resolvedUser?.qualification_type && resolvedUser?.age && resolvedUser.age > 0);
          let strictlyEligible: Job[] = [];
          let broadlyEligible: Job[] = [];
          let strictPartial: Job[] = [];
          let broadlyUpcoming: Job[] = [];
          
          for (const j of validJobs) {
              if (hasCompleteProfile) {
                  const isEligible = meetsQualification(resolvedUser, j) && meetsAge(resolvedUser, j) && meetsTechnicalCriteria(j);
                  if (isEligible) strictlyEligible.push(j);
              }
              if ((j.form_status === 'LIVE' || j.form_status === 'UPCOMING') && meetsTechnicalCriteria(j)) {
                  broadlyEligible.push(j);
              }
              if (hasCompleteProfile) {
                  const isPartial = (meetsQualification(resolvedUser, j) || meetsAge(resolvedUser, j)) && !(meetsQualification(resolvedUser, j) && meetsAge(resolvedUser, j)) && meetsTechnicalCriteria(j);
                  if (isPartial) strictPartial.push(j);
              }
              if (j.form_status === 'UPCOMING' && meetsTechnicalCriteria(j)) {
                  broadlyUpcoming.push(j);
              }
          }
          
          const finalEligible = strictlyEligible.length > 0 ? strictlyEligible : broadlyEligible.slice(0, 100);
          const finalPartial = strictPartial.length > 0 ? strictPartial : broadlyUpcoming.slice(0, 50);
          
          setUser(resolvedUser);
          setRawEligibleJobs(finalEligible);
          setRawPartialJobs(finalPartial);

          // ── RELEASE GovLoader immediately once jobs are ready ─────────────────
          setIsCriticalLoaded(true);
          setLoading(false);

          // ── PHASE 2: Load liked/applied silently in background (non-blocking) ──
          Promise.all([
            api.getLikedJobs().catch(() => []),
            api.getAppliedJobs().catch(() => []),
            api.getNotifications().catch(() => {}),
          ]).then(([liked, applied]) => {
            setLikedJobs(Array.isArray(liked) ? liked : []);
            setAppliedJobs(Array.isArray(applied) ? applied : []);
          });

        } catch (err: any) {
          console.error('Dashboard load failed:', err);
          setCriticalError(err.message || 'Failed to connect to official servers. Please check your connection.');
          setLoading(false);
        }
      };

    const handleAppliedSync = () => {
      api.getAppliedJobs().then(applied => {
        setAppliedJobs(Array.isArray(applied) ? applied : []);
      });
    };

    window.addEventListener('app:appliedToggled', handleAppliedSync);
    loadData();

    // Auto-refresh every 1 hour to keep data accurate
    const hourlyRefresh = setInterval(() => {
      loadData();
    }, 3600000);

    return () => {
      window.removeEventListener('app:appliedToggled', handleAppliedSync);
      clearInterval(hourlyRefresh);
    };
    // eslint-disable-next-line
  }, []); // Only fetch once on mount. Filters are now instant client-side!

  const handleLikeToggle = useCallback((job: Job, isBecomingLiked: boolean) => {
    if (!isBecomingLiked) {
      setLikedJobs((prev) => prev.filter((j) => j.id !== job.id));
    } else {
      setLikedJobs((prev) => [...prev, job]);
    }
  }, []);

  const handleApplyToggle = useCallback((job: Job, isBecomingApplied: boolean) => {
    if (!isBecomingApplied) {
      setAppliedJobs((prev) => prev.filter((j) => j.id !== job.id));
    } else {
      setAppliedJobs((prev) => [...prev, job]);
    }
  }, []);

  // RENDER CONTROL: GovLoader Integration (STAGE 1)
  if (criticalError) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4 animate-[fadeIn_0.5s_ease-out]">
        <div className="bg-[#0e0e0e] border border-red-900/30 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
          {/* subtle scanning animation background */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-900/5 to-transparent animate-[scan_3s_ease-in-out_infinite]" />
          
          <div className="w-16 h-16 bg-red-950/20 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <svg className="w-8 h-8 text-red-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-200 mb-2 tracking-wide">Connection Interrupted</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {criticalError}
          </p>
          <div className="flex flex-col gap-3 relative">
            <button 
              onClick={() => {
                setCriticalError(null);
                window.location.reload();
              }}
              className="w-full py-3 bg-red-800 hover:bg-red-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-red-900/20 active:scale-95 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Retry Connection
            </button>
            <p className="text-xs text-red-500/70 font-medium">Auto-retrying in 15s...</p>
          </div>
        </div>
      </div>
    );
  }

  const hasProfile = !!(user?.qualification_type && user?.age && user.age > 0);
  const firstName = (user?.full_name && typeof user.full_name === 'string' && user.full_name !== 'Guest') 
    ? user.full_name.split(' ')[0] 
    : '';


  const tabJobs = useCallback((tab: TabKey): Job[] => {
    const getFallback = (primary: Job[], fallbackFn: () => Job[]): Job[] => {
      if (primary.length > 0) return primary;
      return fallbackFn();
    };

    switch (tab) {
      case 'eligibleLive': 
        return getFallback(eligibleLiveJobs, () => liveJobs.slice(0, 50));
      case 'eligible': 
        return getFallback(eligibleJobs, () => 
          allJobs.filter(j => j.form_status === 'LIVE' || j.form_status === 'UPCOMING').slice(0, 100)
        );
      case 'partial': 
        return getFallback(partialJobs, () => 
          allJobs.filter(j => j.form_status === 'UPCOMING').slice(0, 50)
        );
      case 'live': 
        return getFallback(liveJobs, () => 
          allJobs.filter(j => j.form_status === 'RECENTLY_CLOSED').slice(0, 30)
        );
      case 'upcoming': 
        return getFallback(upcomingJobs, () => 
          allJobs.filter(j => j.form_status === 'LIVE').slice(0, 30)
        );
      case 'closed': 
        return getFallback(closedJobs, () => 
          allJobs.slice(0, 30)
        );
      case 'liked': 
        return likedJobs;
      case 'applied': 
        return appliedJobs;
      case 'all': 
        return allJobs;
      default: 
        return allJobs;
    }
  }, [eligibleLiveJobs, eligibleJobs, partialJobs, liveJobs, upcomingJobs, closedJobs, likedJobs, appliedJobs, allJobs]);

  const filtered = useMemo(() => {
    let jobs = tabJobs(activeTab);
    
    // 1. STRICT State Filter
    // When a specific state is selected:
    //   - Show jobs explicitly tagged for that state OR 'All India'
    //   - EXCLUDE jobs with no state, empty state, or a different specific state
    if (selectedState && selectedState !== 'All India') {
      const lowerFilter = selectedState.toLowerCase();
      jobs = jobs.filter(j => {
        const jobState = (j.state || '').trim();
        // 'All India' national-level jobs always included
        if (jobState.toLowerCase() === 'all india') return true;
        // Exact match for selected state
        if (jobState.toLowerCase() === lowerFilter) return true;
        // Match within multi-state array (for multi-state jobs)
        if (j.states && Array.isArray(j.states) && j.states.length > 0) {
          return j.states.some((s: string) => (s || '').toLowerCase() === lowerFilter ||
            (s || '').toLowerCase() === 'all india');
        }
        // Empty/null state with no states array: treat as state-specific unknown, exclude
        return false;
      });
    }

    // 2. STRICT Category Filter — exact match, case-insensitive
    if (category && category !== 'All') {
      const lowerCat = category.toLowerCase();
      jobs = jobs.filter(j => (j.job_category || '').toLowerCase() === lowerCat);
    }

    // 3. Search Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      jobs = jobs.filter(j =>
        j.job_name.toLowerCase().includes(q) ||
        j.organization.toLowerCase().includes(q) ||
        j.job_category.toLowerCase().includes(q)
      );
    }

    return jobs;
  }, [activeTab, tabJobs, search, selectedState, category]);

  // Slice for progressive rendering
  const visibleJobs = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  // STRICT RULE OVERRIDE: Reset visible count flush guaranteeing UI updates inherently via array purge
  useEffect(() => {
    setVisibleCount(INITIAL_BATCH);
  }, [activeTab, search, selectedState, category]);

  // IntersectionObserver to load more cards on scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || tabIsAnimating) return; 
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisibleCount(prev => Math.min(prev + INITIAL_BATCH, filtered.length));
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, filtered.length, tabIsAnimating]);

  const likedSet = useMemo(() => new Set(likedJobs.map(j => j.id)), [likedJobs]);
  const appliedSet = useMemo(() => new Set(appliedJobs.map(j => j.id)), [appliedJobs]);

  const tabs = useMemo(() => [
    { key: 'eligibleLive' as TabKey, label: t('tab.liveEligible'), count: eligibleLiveJobs.length },
    { key: 'eligible' as TabKey, label: t('tab.eligible'), count: eligibleJobs.length },
    { key: 'partial' as TabKey, label: t('tab.closeMatch'), count: partialJobs.length },
    { key: 'live' as TabKey, label: t('tab.live'), count: liveJobs.length },
    { key: 'upcoming' as TabKey, label: t('tab.upcoming'), count: upcomingJobs.length },
    { key: 'closed' as TabKey, label: t('tab.closed'), count: closedJobs.length, dot: recentlyClosedJobs.length > 0 ? 'orange' : undefined },
    { key: 'liked' as TabKey, label: t('tab.saved'), count: likedJobs.length },
    { key: 'applied' as TabKey, label: t('tab.applied'), count: appliedJobs.length },
    { key: 'all' as TabKey, label: t('tab.all'), count: allJobs.length },
  ], [eligibleLiveJobs, eligibleJobs, partialJobs, liveJobs, upcomingJobs, closedJobs, recentlyClosedJobs, likedJobs, appliedJobs, allJobs, t, language]);

  // Dynamic Closed Exam Counter (Last 30 Days)
  const [closedLast30DaysCount, setClosedLast30DaysCount] = useState(0);
  
  const calculateClosedCount = useCallback(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const count = closedJobs.filter(job => {
      if (!job.application_end_date) return false;
      const endDate = new Date(job.application_end_date);
      return endDate >= thirtyDaysAgo && endDate <= new Date();
    }).length;
    
    setClosedLast30DaysCount(count);
  }, [closedJobs]);

  useEffect(() => {
    calculateClosedCount();
    const interval = setInterval(calculateClosedCount, 3600000); // Hourly
    return () => clearInterval(interval);
  }, [calculateClosedCount]);

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {!isCriticalLoaded ? (
        <div className="min-h-screen w-full flex items-center justify-center">
          <GovLoader message="Synthesizing your personalized dashboard..." />
        </div>
      ) : (
        <>
          <Navbar user={user} />
          <div className="dashboard-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 animate-[fadeIn_0.4s_ease-out]">
            {/* Header */}
            <div className="mb-5">
              <div className="flex items-start justify-between">
                <h1 className="text-xl font-bold text-gray-200 tracking-wide mt-1">
                  {greeting}{firstName ? `, ${firstName}` : ''}
                </h1>
              </div>
              <div className="mt-2 mb-4">
                <h2 className="text-sm font-medium text-amber-500/90 mb-1 tracking-wider uppercase">{t('dashboard.welcome')}</h2>
                <p className="text-gray-400 text-xs max-w-2xl leading-relaxed">
                  {t('dashboard.description')}
                </p>
              </div>
                <p className="text-gray-600 text-[11px] uppercase tracking-wider font-medium">
                  {hasProfile
                    ? `${eligibleJobs.length} ${t('dashboard.eligibleFound')} ${liveJobs.length} ${t('dashboard.formsOpen')}`
                    : t('dashboard.completeProfile')}
                </p>
              </div>


            {/* Profile nudge */}
            {!hasProfile && (
              <div className="mb-5 p-4 bg-amber-900/10 border border-amber-900/30 rounded-xl flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-900/20 flex items-center justify-center text-amber-500 text-lg flex-shrink-0">⚠️</div>
                  <div>
                    <p className="text-sm font-bold text-amber-500">{t('dashboard.profileIncomplete')}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.profileNeededMsg')}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-500 transition-all shadow-lg shadow-amber-900/20 whitespace-nowrap"
                >
                  {t('dashboard.setupNow')}
                </button>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-5">
              <button 
                onClick={() => setActiveTab('all')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'all' ? 'border-[#252525] ring-1 ring-[#252525]' : 'border-[#141414] hover:border-[#252525]'}`}
              >
                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{t('stats.total')}</p>
                <p className="text-xl font-bold text-gray-200 mt-0.5">{allJobs.length}</p>
              </button>
              <button 
                onClick={() => setActiveTab('live')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'live' ? 'border-green-900/40 ring-1 ring-green-900/20' : 'border-[#141414] hover:border-[#252525]'}`}
              >
                <p className="text-[9px] text-green-700 uppercase tracking-wide">{t('stats.live')}</p>
                <p className="text-xl font-bold text-green-500 mt-0.5">{liveJobs.length}</p>
              </button>
              <button 
                onClick={() => setActiveTab('eligible')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'eligible' ? 'border-red-900/40 ring-1 ring-red-900/20' : 'border-[#141414] hover:border-[#252525]'}`}
              >
                <p className="text-[9px] text-red-700 uppercase tracking-wide">{t('stats.eligible')}</p>
                <p className="text-xl font-bold text-red-400 mt-0.5">{eligibleJobs.length}</p>
                {!hasProfile && <p className="text-[9px] text-red-600 font-bold mt-0.5">{t('stats.needsProfile')}</p>}
              </button>
              <button 
                onClick={() => setActiveTab('partial')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'partial' ? 'border-amber-900/40 ring-1 ring-amber-900/20' : 'border-[#141414] hover:border-[#252525]'}`}
              >
                <p className="text-[9px] text-amber-700 uppercase tracking-wide">{t('stats.partialMatch')}</p>
                <p className="text-xl font-bold text-amber-500 mt-0.5">{partialJobs.length}</p>
              </button>
              <button 
                onClick={() => setActiveTab('eligibleLive')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'eligibleLive' ? 'border-blue-900/40 ring-1 ring-blue-900/20' : 'border-[#141414] hover:border-[#252525]'}`}
              >
                <p className="text-[9px] text-blue-700 uppercase tracking-wide">{t('stats.liveEligible')}</p>
                <p className="text-xl font-bold text-blue-400 mt-0.5">{eligibleLiveJobs.length}</p>
                {!hasProfile && <p className="text-[9px] text-red-600 font-bold mt-0.5">{t('stats.needsProfile')}</p>}
              </button>
              <button 
                onClick={() => setActiveTab('liked')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'liked' ? 'border-[#252525] ring-1 ring-[#252525]' : 'border-[#141414] hover:border-[#252525]'}`}
              >
                <p className="text-[9px] text-gray-600 uppercase tracking-wide">{t('stats.saved')}</p>
                <p className="text-xl font-bold text-gray-300 mt-0.5">{likedJobs.length}</p>
              </button>
              <button 
                onClick={() => setActiveTab('applied')} 
                className={`bg-[#0e0e0e] rounded-lg border p-3 text-left transition-colors ${activeTab === 'applied' ? 'border-purple-900/40 ring-1 ring-purple-900/20' : 'border-[#141414] hover:border-[#1e1e1e]'}`}
              >
                <p className="text-[9px] text-purple-700 uppercase tracking-wide">{t('stats.applied')}</p>
                <p className="text-xl font-bold text-purple-400 mt-0.5">{appliedJobs.length}</p>
              </button>
            </div>

            {/* SEARCH & CATEGORY (Refined Aesthetics) */}
            <div className="flex flex-col sm:flex-row items-center gap-2 mb-6">
              <div className="relative flex-1 w-full group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-500 group-focus-within:text-red-500 transition-colors" />
                </div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('dashboard.searchPlaceholder')}
                  className="block w-full pl-10 pr-4 py-2.5 bg-[#0e0e0e]/40 backdrop-blur-xl border border-[#1a1a1a] rounded-xl text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-red-900/40 focus:border-red-900/40 transition-all font-medium placeholder:font-normal"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="relative w-full sm:w-64 group">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#0e0e0e]/40 backdrop-blur-xl border border-[#1a1a1a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-900/40 focus:border-red-900/40 transition-all appearance-none cursor-pointer font-medium"
                >
                  <option value="All" className="bg-[#0e0e0e] text-gray-300">All Categories</option>
                  {categories.filter(cat => cat !== 'All').map(cat => (
                    <option key={cat} value={cat} className="bg-[#0e0e0e] text-gray-300">{cat}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-red-500 transition-colors" />
                </div>
              </div>

              {/* STATE FILTER */}
              <div className="relative w-full sm:w-64 group">
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full bg-[#0e0e0e]/40 backdrop-blur-xl border border-[#1a1a1a] rounded-xl pl-4 pr-10 py-2.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-red-900/40 focus:border-red-900/40 transition-all appearance-none cursor-pointer font-medium"
                >
                  <option value="All India" className="bg-[#0e0e0e] text-gray-300">All India</option>
                  {statesDropdown.filter(s => s !== 'All India').map(s => (
                    <option key={s} value={s} className="bg-[#0e0e0e] text-gray-300">{s}</option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                  <ChevronDown className="h-4 w-4 text-gray-500 group-hover:text-red-500 transition-colors" />
                </div>
              </div>
            </div>

            {/* View Toggle */}
            <div className="flex gap-2 mb-6 bg-[#0a0a0a] p-1.5 rounded-2xl border border-[#1a1a1a] w-fit shadow-inner relative z-20">
              <button
                onClick={() => {
                  setViewMode('exams');
                  localStorage.setItem('dashboard_view_mode', 'exams');
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'exams' ? 'bg-gradient-to-r from-red-600/20 to-red-600/5 text-red-500 border border-red-500/30' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <LayoutDashboard className="w-4 h-4" />
                {t('stats.total')} Exams
              </button>
              <button
                onClick={() => {
                  setViewMode('recs');
                  localStorage.setItem('dashboard_view_mode', 'recs');
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap ${viewMode === 'recs' ? 'bg-gradient-to-r from-yellow-600/20 to-yellow-600/5 text-yellow-500 border border-yellow-500/30' : 'text-gray-400 hover:text-gray-200'}`}
              >
                <Sparkles className="w-4 h-4" />
                AI Recommendations
              </button>
            </div>

            {viewMode === 'exams' ? (
              <div className="bg-[#0b0b0b] rounded-xl border border-[#141414] overflow-hidden">
                <div className="border-b border-[#141414] overflow-x-auto">
                  <div className="flex min-w-max">
                    {tabs.map((tab) => (
                      <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-all duration-150 whitespace-nowrap ${visualTab === tab.key
                          ? 'border-red-700 text-red-400 font-medium'
                          : 'border-transparent text-gray-600 hover:text-gray-400'
                          }`}
                      >
                        {tab.key === 'liked' ? (
                          <span className="flex items-center gap-1">
                            <svg className={`w-3.5 h-3.5 ${likedJobs.length > 0 ? 'text-red-400' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            {tab.label}
                          </span>
                        ) : (
                          <span>{tab.label}</span>
                        )}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${visualTab === tab.key ? 'bg-red-900/30 text-red-400' : 'bg-[#111] text-gray-700'}`}>
                          {tab.count}
                        </span>
                        {tab.dot === 'orange' && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={`tab-panel p-4 transition-opacity duration-150 ${isSwitching ? 'opacity-0' : 'opacity-100'}`} key={activeTab}>
                  <div className="flex flex-col gap-3 mb-3">
                    {activeTab === 'closed' && closedLast30DaysCount > 0 && (
                      <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2.5 flex items-center gap-3 animate-fadeIn">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <p className="text-xs font-bold text-orange-400 tracking-tight">
                          {closedLast30DaysCount} exams closed in last 30 days
                        </p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-600">
                        {tabs.find(t => t.key === activeTab)?.label}: {filtered.length} job{filtered.length !== 1 ? 's' : ''}
                        {search && <span className="text-gray-500"> matching "{search}"</span>}
                      </p>
                      {(search || category !== 'All') && (
                        <button onClick={() => { setSearch(''); setCategory('All'); }} className="text-xs text-red-600 hover:text-red-500 transition-colors">
                          {t('dashboard.clearFilters')}
                        </button>
                      )}
                    </div>
                  </div>

                  {filtered.length === 0 ? (
                    <div className="text-center py-16 px-4">
                      <div className="w-16 h-16 rounded-3xl bg-[#0e0e0e] border border-[#1a1a1a] flex items-center justify-center text-3xl mx-auto mb-4 grayscale opacity-40">
                        {activeTab === 'liked' ? '♥️' : activeTab === 'applied' ? '✅' : '🔍'}
                      </div>
                      <h3 className="text-lg font-bold text-gray-200">
                        {activeTab === 'liked' ? t('empty.saved') : activeTab === 'applied' ? t('empty.applied') : t('empty.noMatch')}
                      </h3>
                      <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto leading-relaxed">
                        {activeTab === 'eligible' || activeTab === 'partial' || activeTab === 'eligibleLive' 
                          ? (!hasProfile ? t('empty.profileNeeded') : t('empty.eligibleHint')) 
                          : t('empty.generalHint')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {visibleJobs.map((job, i) => (
                          <JobCard
                            key={job.id}
                            job={job}
                            staggerIndex={i}
                            isLiked={likedSet.has(job.id)}
                            onLikeToggle={(liked) => handleLikeToggle(job, liked)}
                            isApplied={appliedSet.has(job.id)}
                            onApplyToggle={(applied) => handleApplyToggle(job, applied)}
                            onBeforeNavigate={saveNavState}
                          />
                        ))}
                      </div>
                      {hasMore && (
                        <div ref={sentinelRef} className="flex justify-center py-6">
                          <div className="w-6 h-6 border-2 border-red-800 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-fadeIn">
                <RecommendationsWidget externalSearch={search} externalCategory={category} />
              </div>
            )}
          </div>
        </>
      )}

      <p className="text-center text-[10px] text-gray-700 mt-6">
        {t('dashboard.footer')} • v1.7.0 • {new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })}
      </p>
    </div>
  );
}
