import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabase';
import { getCachedUser } from '../api';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RealtimeNotificationBanner() {
  const [activeNotification, setActiveNotification] = useState<{ id: string; message: string; job_id?: string } | null>(null);
  const navigate = useNavigate();
  const user = getCachedUser();

  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to real-time public.notifications insertions for this user
    const channel = supabase
      .channel(`user-notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotif = payload.new as any;
          if (newNotif) {
            // Trigger a physical tactile haptic double vibration pulse on mobile
            if (typeof navigator !== 'undefined' && navigator.vibrate) {
              navigator.vibrate([40, 60, 40]);
            }

            setActiveNotification({
              id: newNotif.id,
              message: newNotif.message,
              job_id: newNotif.job_id
            });

            // Fire custom event to instantly reload navbar badge counts
            window.dispatchEvent(new CustomEvent('app:notificationReceived'));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!activeNotification) return;
    const timer = setTimeout(() => {
      setActiveNotification(null);
    }, 6000); // Slide away after 6 seconds
    return () => clearTimeout(timer);
  }, [activeNotification]);

  if (!activeNotification) return null;

  return (
    <div
      onClick={() => {
        if (activeNotification.job_id) {
          navigate(`/jobs/${activeNotification.job_id}`);
        } else {
          navigate('/notifications');
        }
        setActiveNotification(null);
      }}
      className="fixed top-18 left-1/2 transform -translate-x-1/2 z-[10001] w-[92%] sm:w-full sm:max-w-md bg-[#0c0c0ce6] border border-red-500/20 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl flex items-start gap-3.5 cursor-pointer animate-[slideDown_0.4s_ease-out] hover:border-red-500/30 transition-all group"
    >
      <div className="w-9 h-9 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center flex-shrink-0 text-red-500 group-hover:scale-110 transition-transform">
        <Bell size={18} className="animate-bounce" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">New Alert Received</p>
        <p className="text-xs text-gray-200 mt-1 leading-relaxed font-sans font-medium line-clamp-2 pr-3">{activeNotification.message}</p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setActiveNotification(null);
        }}
        className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-white/5 flex-shrink-0 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
