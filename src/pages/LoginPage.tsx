import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { selectAuth } from '../store/selectors';
import { loginAction, guestLoginAction } from '../store/actions/authActions';
import Logo from '../assets/logo';
import GovLoader from '../components/GovLoader';
import { Capacitor } from '@capacitor/core';
import { getCachedUser, clearToken } from '../api';
import { motion, AnimatePresence } from 'framer-motion';
import { Fingerprint, Delete, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector(selectAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Mobile specific state
  const [forcePasswordLogin, setForcePasswordLogin] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  useEffect(() => {
    if (forcePasswordLogin) {
      // Reserved for native credential prompt bypass
    }
  }, [forcePasswordLogin]);

  const cachedUser = getCachedUser();
  const isNative = Capacitor.isNativePlatform();

  // If user is logged in and not unlocked yet, we show lock screen by default on mobile (disabled)
  const showLockScreen = false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(loginAction(email, password));
      sessionStorage.setItem('sarkar_mobile_unlocked', 'true');
      navigate('/dashboard');
    } catch (err) {
      // Handled by Redux select
    }
  };

  const handleGuestLogin = () => {
    dispatch(guestLoginAction())
      .then(() => {
        sessionStorage.setItem('sarkar_mobile_unlocked', 'true');
        navigate('/dashboard');
      })
      .catch(() => {
        sessionStorage.setItem('sarkar_mobile_unlocked', 'true');
        navigate('/dashboard');
      });
  };

  const handleSwitchAccount = () => {
    // Clear session and show normal credentials screen
    clearToken();
    setForcePasswordLogin(true);
    setPasscode('');
  };

  const handleKeyPress = (num: string) => {
    if (isUnlocking) return;
    if (num === 'back') {
      setPasscode(prev => prev.slice(0, -1));
      return;
    }
    if (passcode.length >= 4) return;
    const newPasscode = passcode + num;
    setPasscode(newPasscode);

    if (newPasscode.length === 4) {
      setIsUnlocking(true);
      // Mock unlock validation
      setTimeout(() => {
        setUnlockSuccess(true);
        setTimeout(() => {
          sessionStorage.setItem('sarkar_mobile_unlocked', 'true');
          navigate('/dashboard');
        }, 300);
      }, 500);
    }
  };

  const handleBiometricScan = () => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    setTimeout(() => {
      setUnlockSuccess(true);
      setTimeout(() => {
        sessionStorage.setItem('sarkar_mobile_unlocked', 'true');
        navigate('/dashboard');
      }, 300);
    }, 1000);
  };

  // Canvas dot-matrix interactive background
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!isNative) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const dots: { x: number; y: number; baseSize: number; currentSize: number }[] = [];
    const spacing = 24;
    const cols = Math.floor(width / spacing) + 1;
    const rows = Math.floor(height / spacing) + 1;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        dots.push({
          x: c * spacing + (spacing / 2),
          y: r * spacing + (spacing / 2),
          baseSize: 1.2,
          currentSize: 1.2
        });
      }
    }

    let touch = { x: -1000, y: -1000, active: false };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touch.x = e.touches[0].clientX;
        touch.y = e.touches[0].clientY;
        touch.active = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        touch.x = e.touches[0].clientX;
        touch.y = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = () => {
      touch.active = false;
      touch.x = -1000;
      touch.y = -1000;
    };

    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleTouchEnd);

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const dx = dot.x - touch.x;
        const dy = dot.y - touch.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 100) {
          const factor = (100 - dist) / 100;
          dot.currentSize = dot.baseSize + factor * 2.2;
          ctx.fillStyle = `rgba(220, 38, 38, ${0.12 + factor * 0.48})`; // glow red near touch
        } else {
          dot.currentSize = dot.currentSize + (dot.baseSize - dot.currentSize) * 0.1;
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        }

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.currentSize, 0, Math.PI * 2);
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('resize', handleResize);
    };
  }, [isNative]);

  const initials = cachedUser?.full_name 
    ? cachedUser.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() 
    : 'U';

  // ────────────────────────────────────────────────────────────────────────────
  // MOBILE NATIVE RENDER (Nothing OS / Engineered Noir style)
  // ────────────────────────────────────────────────────────────────────────────
  if (isNative) {
    return (
      <div className="h-screen h-[100dvh] bg-[#0d0e12] flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-space select-none">
        {/* Reacting dot-matrix canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />

        {/* Ambient red scanline gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 via-transparent to-black/30 pointer-events-none z-0" />

        {/* Screen layout loader */}
        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <GovLoader message="AUTHENTICATING..." />
          </div>
        )}

        <AnimatePresence mode="wait">
          {showLockScreen ? (
            // ==========================================
            // QUICK UNLOCK LOCK SCREEN
            // ==========================================
            <motion.div
              key="lockscreen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col justify-between z-10 pt-4"
            >
              {/* Header */}
              <div className="text-center">
                <div className="mx-auto w-14 h-14 rounded-full border border-red-500/30 flex items-center justify-center bg-red-950/10 shadow-[0_0_10px_rgba(220,38,38,0.1)] mb-3">
                  <span className="font-mono text-lg font-bold tracking-wider text-red-400">{initials}</span>
                </div>
                <h1 className="text-lg font-semibold tracking-wider text-white uppercase font-space">
                  {cachedUser?.full_name || 'WELCOME BACK'}
                </h1>
                <p className="text-[9px] text-red-500 tracking-widest font-mono uppercase mt-0.5">
                  SECURED APP SESSION
                </p>
              </div>

              {/* Central Biometric Pulse Trigger */}
              <div className="flex flex-col items-center justify-center my-4">
                <button
                  onClick={handleBiometricScan}
                  disabled={isUnlocking}
                  className={`w-24 h-24 border flex flex-col items-center justify-center relative transition-all duration-300 active:scale-95 bg-black/40 ${
                    unlockSuccess 
                      ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                      : 'border-white/10 hover:border-red-500/50 text-white'
                  }`}
                  style={{ borderRadius: '0px' }}
                >
                  {/* Scanline element */}
                  {isUnlocking && !unlockSuccess && (
                    <div className="absolute left-0 right-0 h-1 bg-red-500 shadow-[0_0_8px_#ef4444] animate-[bounce_1.4s_infinite]" />
                  )}
                  
                  <Fingerprint className={`w-10 h-10 ${
                    isUnlocking && !unlockSuccess ? 'text-red-500 biometric-scan-pulse' : ''
                  }`} />
                  
                  <span className="text-[7px] font-mono tracking-widest uppercase mt-2">
                    {unlockSuccess ? 'SUCCESS' : isUnlocking ? 'SCANNING...' : 'TAP TO SCAN'}
                  </span>
                </button>

                {/* Dot matrix code feedback indicator */}
                <div className="flex justify-center items-center gap-3 mt-5">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full border transition-all duration-150 ${
                        idx < passcode.length
                          ? 'bg-red-500 border-red-500 shadow-[0_0_8px_#ef4444]'
                          : 'border-white/20 bg-transparent'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Numeric Key Matrix */}
              <div className="w-full max-w-xs mx-auto pb-2">
                <div className="grid grid-cols-3 gap-2">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                    <button
                      key={num}
                      onClick={() => handleKeyPress(num)}
                      className="h-11 border border-white/5 bg-white/[0.02] text-white font-mono text-lg flex items-center justify-center key-press-active"
                      style={{ borderRadius: '0px' }}
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={handleSwitchAccount}
                    className="h-11 border border-white/5 bg-transparent text-[8px] text-gray-500 font-mono tracking-widest flex items-center justify-center text-center leading-tight uppercase active:bg-white/5"
                    style={{ borderRadius: '0px' }}
                  >
                    SWITCH<br/>ACCOUNT
                  </button>
                  <button
                    onClick={() => handleKeyPress('0')}
                    className="h-11 border border-white/5 bg-white/[0.02] text-white font-mono text-lg flex items-center justify-center key-press-active"
                    style={{ borderRadius: '0px' }}
                  >
                    0
                  </button>
                  <button
                    onClick={() => handleKeyPress('back')}
                    className="h-11 border border-white/5 bg-transparent text-gray-400 flex items-center justify-center active:bg-white/5"
                    style={{ borderRadius: '0px' }}
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            // ==========================================
            // FULL PASSWORD LOGIN SCREEN
            // ==========================================
            <motion.div
              key="loginform"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 flex flex-col justify-between z-10 pt-4"
            >
              {/* Header */}
              <div className="text-center pt-2">
                <div className="mx-auto w-10 h-10 flex items-center justify-center relative mb-3">
                  <div className="absolute inset-0 bg-red-600 blur-xl opacity-20 rounded-full" />
                  <Logo size={32} className="text-red-500 relative z-10" />
                </div>
                <h1 className="text-xl font-black tracking-[0.2em] text-white font-space uppercase">
                  SARKAR.HAMARI.HAI
                </h1>
                <p className="text-[8px] text-red-500 tracking-[0.3em] font-mono uppercase mt-0.5">
                  GOVERNMENT EXAMS PORTAL / NATIVE MOBILE
                </p>
              </div>

              {/* Form Input Blocks */}
              <div className="w-full max-w-sm mx-auto px-2 space-y-4">
                {error && (
                  <div className="border border-red-500/30 bg-red-950/20 text-red-400 text-[10px] tracking-widest text-center font-mono py-3 uppercase">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[8px] text-gray-500 font-mono tracking-widest uppercase mb-1.5 ml-1">
                      USER EMAIL IDENTIFICATION
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoCapitalize="off"
                      autoCorrect="off"
                      className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white font-mono text-xs focus:border-red-500/50 outline-none transition-all placeholder-gray-800"
                      style={{ borderRadius: '0px' }}
                      placeholder="ENTER EMAIL ADDRESS"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] text-gray-500 font-mono tracking-widest uppercase mb-1.5 ml-1">
                      USER SECURE ACCESS KEY
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white font-mono text-xs focus:border-red-500/50 outline-none transition-all placeholder-gray-800"
                      style={{ borderRadius: '0px' }}
                      placeholder="ENTER PASSWORD"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-red-700 hover:bg-red-600 text-white font-mono text-xs font-bold tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 active:scale-[0.98] shadow-lg shadow-red-950/20 border border-red-600/30"
                    style={{ borderRadius: '0px' }}
                  >
                    ACCESS PORTAL <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

                {/* Separator */}
                <div className="flex items-center gap-4 py-1">
                  <div className="flex-1 h-px bg-white/5"></div>
                  <span className="text-[8px] text-gray-600 font-mono tracking-widest uppercase">OR</span>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>

                {/* Alternative Logins */}
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      dispatch({ type: 'AUTH_START' });
                      try {
                        const { supabase } = await import('../utils/supabase');
                        const redirectUrl = 'https://sarkarhamarihai.vercel.app/auth/callback?platform=mobile';
                        const { data, error } = await supabase.auth.signInWithOAuth({
                          provider: 'google',
                          options: {
                            redirectTo: redirectUrl,
                            skipBrowserRedirect: true
                          }
                        });
                        
                        if (error) throw error;
                        
                        if (data?.url) {
                          const { Browser } = await import('@capacitor/browser');
                          await Browser.open({ url: data.url, presentationStyle: 'popover' });
                        } else {
                          throw new Error('Google auth failure.');
                        }
                      } catch (err: any) {
                        dispatch({ type: 'AUTH_FAIL', payload: err.message || 'Google authentication failed' });
                      }
                    }}
                    disabled={loading}
                    className="w-full py-3.5 border border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.03] text-gray-300 font-mono text-[10px] tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 active:scale-[0.98]"
                    style={{ borderRadius: '0px' }}
                  >
                    <svg width="14" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    CONTINUE WITH GOOGLE
                  </button>

                  <button
                    onClick={handleGuestLogin}
                    disabled={loading}
                    className="w-full py-3.5 bg-transparent text-gray-500 hover:text-gray-400 font-mono text-[9px] tracking-widest transition-all disabled:opacity-50 active:scale-[0.98] border border-transparent hover:border-white/5 active:bg-white/5"
                    style={{ borderRadius: '0px' }}
                  >
                    CONTINUE AS ACCESS GUEST
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="pb-4 pt-6 text-center text-[10px] text-gray-600 font-mono tracking-widest">
                NEW CITIZEN?{' '}
                <Link to="/signup" className="text-red-500 font-bold hover:text-red-400 transition-colors underline">
                  CREATE ACCOUNT
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ORIGINAL WEB RENDER (Kept completely untouched)
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col cap-safe-all relative overflow-hidden font-sans selection:bg-red-600/30 selection:text-white">

      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Soft Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-black rounded-full blur-[100px] pointer-events-none z-0" />

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <GovLoader message="Authenticating..." />
        </div>
      )}

      {/* Header / Logo section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6 relative z-10">
        <div className="animate-scaleIn text-center">
          <div className="mx-auto mb-6 flex justify-center relative">
            <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 rounded-full" />
            <Logo size={56} className="text-red-500 relative z-10 drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-white">Welcome Back</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide">Government jobs. One place.</p>
        </div>
      </div>

      {/* Form section */}
      <div className="animate-slideUp w-full max-w-md mx-auto px-5 pb-12 relative z-10">
        <div className="bg-[#0a0a0a]/80 border border-white/10 p-8 sm:p-10 backdrop-blur-2xl relative shadow-2xl rounded-3xl">
          {/* Top border highlight */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm tracking-wide text-center font-medium rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoCapitalize="off"
                autoCorrect="off"
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner"
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-2 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all disabled:opacity-50 shadow-lg hover:shadow-red-500/20 active:scale-[0.98] rounded-full"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/5"></div>
            <span className="text-xs text-gray-500 font-medium">or</span>
            <div className="flex-1 h-px bg-white/5"></div>
          </div>

          <button
            onClick={async () => {
              dispatch({ type: 'AUTH_START' });
              try {
                const { supabase } = await import('../utils/supabase');
                const isNative = Capacitor.isNativePlatform();
                const redirectUrl = isNative
                  ? 'https://sarkarhamarihai.vercel.app/auth/callback?platform=mobile'
                  : window.location.origin + '/auth/callback';
                
                if (isNative) {
                  // On native mobile, skip WebView navigation and request OAuth URL to launch external browser
                  const { data, error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: {
                      redirectTo: redirectUrl,
                      skipBrowserRedirect: true
                    }
                  });
                  
                  if (error) throw error;
                  
                  if (data?.url) {
                    // Open in the system's secure browser Custom Tab
                    const { Browser } = await import('@capacitor/browser');
                    await Browser.open({ url: data.url, presentationStyle: 'popover' });
                  } else {
                    throw new Error('Could not retrieve Google OAuth login URL.');
                  }
                } else {
                  // On standard web browser
                  const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { redirectTo: redirectUrl }
                  });
                  if (error) throw error;
                }
              } catch (err: any) {
                dispatch({ type: 'AUTH_FAIL', payload: err.message || 'Google authentication failed' });
              }
            }}
            disabled={loading}
            className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 text-gray-200 font-medium text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-3 mb-3 active:scale-[0.98] rounded-xl shadow-sm"
          >
            <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-3.5 bg-transparent text-gray-500 hover:text-gray-300 font-medium text-sm transition-all disabled:opacity-50 active:scale-[0.98] rounded-xl hover:bg-white/5"
          >
            Continue as Guest
          </button>

          <p className="mt-8 text-center text-sm text-gray-500 font-medium">
            New here?{' '}
            <Link to="/signup" className="text-red-500 font-semibold hover:text-red-400 transition-colors">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
