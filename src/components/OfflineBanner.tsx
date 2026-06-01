import { useState, useEffect } from 'react';

export default function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(!navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      // Keep showing green banner briefly, then hide
      setTimeout(() => {
        setShowBanner(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!showBanner || (!isOnline && !wasOffline && navigator.onLine)) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] transition-all duration-300 ease-out shadow-lg text-center text-xs font-semibold tracking-wide flex items-center justify-center gap-2 border-b backdrop-blur-md animate-slideDown ${
        isOnline
          ? 'bg-emerald-500/90 border-emerald-400/20 text-white'
          : 'bg-amber-500/90 border-amber-400/20 text-white'
      }`}
      style={{
        paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
        paddingBottom: '10px',
      }}
    >
      {isOnline ? (
        <>
          <svg className="w-4 h-4 animate-bounce text-emerald-100" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-emerald-50">Connection Restored! Back online.</span>
        </>
      ) : (
        <>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
          </span>
          <span className="text-amber-50">You are currently offline. Using cached data.</span>
        </>
      )}
    </div>
  );
}
