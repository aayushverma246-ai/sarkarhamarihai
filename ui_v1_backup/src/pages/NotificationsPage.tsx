import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, clearToken } from '../api';
import Navbar from '../components/Navbar';
import GovLoader from '../components/GovLoader';
import { useLanguage } from '../i18n/LanguageContext';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const cached = getCachedUser();
  const { t, language } = useLanguage();
  const [user, setUser] = useState<any>(cached);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [jobsMap, setJobsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Undo Toast State
  const [toastNotif, setToastNotif] = useState<any | null>(null);
  const undoToastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [clearedAllNotifs, setClearedAllNotifs] = useState<any[] | null>(null);
  const undoAllTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [clearingAll, setClearingAll] = useState(false);

  useEffect(() => {
    if (!cached) { navigate('/login'); return; }
    const load = async () => {
      try {
        const [me, notifs, jobs] = await Promise.all([api.getMe(), api.getNotifications(), api.getJobs()]);
        setUser(me);
        setNotifications(notifs);
        const map: Record<string, any> = {};
        jobs.forEach(j => map[j.id] = j);
        setJobsMap(map);
      } catch {
        clearToken(); navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line
  }, []);

  // ─── Undo Deletion Logic ────────────────────────────────────────────────

  const finalizeDeletion = async (id: string) => {
    try {
      await api.deleteNotification(id);
      window.dispatchEvent(new Event('app:likeToggled'));
    } catch (err) {
      console.error('Failed to delete notification', err);
    }
  };

  const handleDeleteInitial = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();

    // If a deletion is already pending, finalize it immediately before starting a new one
    if (toastNotif && toastNotif.id !== id) {
      if (undoToastTimeoutRef.current) clearTimeout(undoToastTimeoutRef.current);
      finalizeDeletion(toastNotif.id);
    }

    const notifInfo = notifications.find(n => n.id === id);
    if (!notifInfo) return;

    setToastNotif(notifInfo);
    // Optimistically remove from UI
    setNotifications(prev => prev.filter(n => n.id !== id));

    // Set 6 second timer to actually delete
    const timer = setTimeout(() => {
      finalizeDeletion(id);
      setToastNotif(null);
    }, 6000);
    undoToastTimeoutRef.current = timer;
  };

  const handleUndo = () => {
    if (undoToastTimeoutRef.current) {
      clearTimeout(undoToastTimeoutRef.current);
      undoToastTimeoutRef.current = null;
    }
    if (toastNotif) {
      setNotifications(prev => {
        const updated = [...prev, toastNotif];
        return updated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      });
      setToastNotif(null);
    }
  };

  // ─── Localized Message Parser ──────────────────────────────────────────

  const getLocalizedMessage = (n: any) => {
    const message: string = n.message;
    const job = jobsMap[n.job_id];
    const examNameInfo = job ? (job[`exam_name_${language}`] || job.job_name) : null;

    // Check if the DB message is English. E.g "Applications for [Exam] are now LIVE!"
    if (message.includes('are now LIVE!')) {
      const examMatch = message.replace('Applications for ', '').replace(' are now LIVE!', '');
      return t('notif.live').replace('{exam}', examNameInfo || examMatch);
    }
    if (message.includes('closes on')) {
      // E.g "Hurry! The application for [Exam] closes on [Date]."
      const parts = message.replace('Hurry! The application for ', '').split(' closes on ');
      const examName = parts[0];
      const dateStr = parts[1]?.replace('.', '') || '';
      return t('notif.closing').replace('{exam}', examNameInfo || examName).replace('{date}', dateStr);
    }
    if (message.includes('You saved: ')) {
      const examMatch = message.replace('You saved: ', '');
      return (t('notif.saved') || 'You saved: {exam}').replace('{exam}', examNameInfo || examMatch);
    }
    // Fallback untouched
    return message;
  };

  const finalizeClearAll = async () => {
    try {
      await api.deleteAllNotifications();
      window.dispatchEvent(new Event('app:likeToggled'));
    } catch (err) {
      console.error('Failed to clear notifications', err);
    } finally {
      setClearingAll(false);
    }
  };

  const handleClearAll = () => {
    if (clearedAllNotifs) {
      if (undoAllTimeoutRef.current) clearTimeout(undoAllTimeoutRef.current);
      finalizeClearAll();
    }

    setClearingAll(true);
    setClearedAllNotifs(notifications);
    setNotifications([]);

    const timer = setTimeout(() => {
      finalizeClearAll();
      setClearedAllNotifs(null);
    }, 6000);
    undoAllTimeoutRef.current = timer;
  };

  const handleUndoAll = () => {
    if (undoAllTimeoutRef.current) {
      clearTimeout(undoAllTimeoutRef.current);
      undoAllTimeoutRef.current = null;
    }
    if (clearedAllNotifs) {
      setNotifications(clearedAllNotifs);
      setClearedAllNotifs(null);
      setClearingAll(false);
    }
  };

  if (!cached) return null;

  // Normalize SQLite timestamps: if they don't end with Z or +, they are UTC — add Z so JS parses correctly.
  const normalizeTs = (ts: string) =>
    ts && !ts.endsWith('Z') && !ts.includes('+') ? ts.replace(' ', 'T') + 'Z' : ts;

  const IST = 'Asia/Kolkata';

  const toISTDateString = (ts: string) =>
    new Date(normalizeTs(ts)).toLocaleDateString('en-IN', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' });

  const todayIST = toISTDateString(new Date().toISOString());
  const yesterdayIST = toISTDateString(new Date(Date.now() - 86400000).toISOString());

  const grouped = notifications.reduce((acc, n) => {
    const dateIST = toISTDateString(n.created_at);
    let label: string;
    if (dateIST === todayIST) label = t('notif.today') || 'Today';
    else if (dateIST === yesterdayIST) label = t('notif.yesterday') || 'Yesterday';
    else label = new Date(normalizeTs(n.created_at)).toLocaleDateString('en-IN', {
      timeZone: IST, month: 'short', day: 'numeric',
    });
    if (!acc[label]) acc[label] = [];
    acc[label].push(n);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="min-h-screen bg-[#080808]">
      <Navbar user={user} />
      <div className="page-enter max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-200">{t('notif.title') || 'Notifications'}</h1>
            <p className="text-gray-600 text-sm mt-0.5">{notifications.length} {t('notif.total') || 'total'}</p>
          </div>
          {notifications.length > 0 && (
            <button
              onClick={handleClearAll}
              disabled={clearingAll}
              className="px-3 py-1.5 bg-[#141414] text-xs font-medium text-red-500 rounded-lg border border-[#252525] hover:bg-red-950/30 hover:border-red-900/50 transition-colors disabled:opacity-50"
            >
              {clearingAll ? t('notif.clearing') || 'Clearing...' : t('notif.clearAll') || 'Clear All'}
            </button>
          )}
        </div>

        {loading && (
          <GovLoader message={t('notif.fetching') || "Fetching Official Notifications..."} />
        )}

        {!loading && notifications.length === 0 && (
          <div className="bg-[#0e0e0e] rounded-xl border border-[#141414] p-8 text-center">
            <p className="text-gray-200 font-medium">{t('notif.empty') || 'No notifications yet'}</p>
            <p className="text-gray-600 text-sm mt-1.5">
              {t('notif.emptySub') || 'Notifications appear when you save jobs or generate study plans.'}
            </p>
          </div>
        )}

        {!loading && notifications.length > 0 && (
          <div className="space-y-5">
            {(Object.entries(grouped) as [string, any[]][]).map(([label, notifs]) => (
              <div key={label}>
                <h2 className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2.5">{label}</h2>
                <div className="bg-[#0e0e0e] rounded-xl border border-[#1a1a1a] divide-y divide-[#141414] overflow-hidden">
                  {notifs.map((n: any, ni: number) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (document.startViewTransition) {
                          document.startViewTransition(() => navigate(`/jobs/${n.job_id}`));
                        } else {
                          navigate(`/jobs/${n.job_id}`);
                        }
                      }}
                      className={`animate-cardIn p-4 hover:bg-[#111] cursor-pointer transition-all flex items-start justify-between gap-4 group opacity-100`}
                      style={{ animationDelay: `${Math.min(ni, 6) * 30}ms` }}
                    >
                      <div>
                        <p className="text-sm text-gray-300">{getLocalizedMessage(n)}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          {new Date(normalizeTs(n.created_at)).toLocaleTimeString('en-IN', {
                            timeZone: IST, hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteInitial(e, n.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all rounded hover:bg-[#141414] focus:outline-none"
                        title={t('notif.clear') || "Clear notification"}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Floating Undo Toast for Single Notif */}
        {toastNotif && !clearedAllNotifs && (
          <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#252525] shadow-2xl shadow-black/20 dark:shadow-black/50 px-5 py-3 rounded-full flex items-center gap-4">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-300">{t('notif.deleted') || 'Notification deleted'}</span>
              <button
                onClick={handleUndo}
                className="text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-500"
              >
                {t('notif.undo') || 'UNDO'}
              </button>
            </div>
          </div>
        )}

        {/* Floating Undo Toast for Clear All */}
        {clearedAllNotifs && (
          <div className="fixed bottom-24 sm:bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
            <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#252525] shadow-2xl shadow-black/20 dark:shadow-black/50 px-5 py-3 rounded-full flex items-center gap-4">
              <span className="text-sm font-medium text-gray-900 dark:text-gray-300">All notifications cleared</span>
              <button
                onClick={handleUndoAll}
                className="text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-500"
              >
                {t('notif.undo') || 'UNDO'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
