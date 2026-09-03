import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';
import { api, setCachedUser } from '../api';
import Logo from '../assets/logo';
import GovLoader from '../components/GovLoader';
import { Capacitor } from '@capacitor/core';
import { ArrowRight } from 'lucide-react';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('No active recovery session found. Please request a new password reset link.');
        setTimeout(() => navigate('/login'), 4000);
      }
    }
    checkSession();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password
      });

      if (updateError) throw updateError;

      // Ensure profile exists in custom DB
      const { user: profileUser } = await api.ensureProfile();
      if (profileUser) {
        setCachedUser(profileUser);
      }

      setSuccess('Your password has been reset successfully!');
      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ────────────────────────────────────────────────────────────────────────────
  // MOBILE NATIVE RENDER (Nothing OS / Engineered Noir style)
  // ────────────────────────────────────────────────────────────────────────────
  if (isNative) {
    return (
      <div className="h-screen h-[100dvh] bg-[#0d0e12] flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden font-space select-none">
        {/* Ambient red scanline gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/5 via-transparent to-black/30 pointer-events-none z-0" />

        {loading && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
            <GovLoader message="UPDATING KEY..." />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-center z-10 py-4 max-w-sm w-full mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="mx-auto w-10 h-10 flex items-center justify-center relative mb-3">
              <div className="absolute inset-0 bg-red-600 blur-xl opacity-20 rounded-full" />
              <Logo size={32} className="text-red-500 relative z-10" />
            </div>
            <h1 className="text-xl font-black tracking-[0.2em] text-white font-space uppercase">
              CREATE ACCESS KEY
            </h1>
            <p className="text-[8px] text-red-500 tracking-[0.3em] font-mono uppercase mt-0.5">
              GOVERNMENT EXAMS PORTAL / SECURE KEY UPDATE
            </p>
          </div>

          <div className="space-y-4">
            {error && (
              <div className="border border-red-500/30 bg-red-950/20 text-red-400 text-[10px] tracking-widest text-center font-mono py-3 uppercase">
                {error}
              </div>
            )}
            {success && (
              <div className="border border-emerald-500/30 bg-emerald-950/20 text-emerald-400 text-[10px] tracking-widest text-center font-mono py-3 uppercase">
                {success}
              </div>
            )}

            {!success && (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="block text-[8px] text-gray-500 font-mono tracking-widest uppercase mb-1.5 ml-1">
                    NEW SECURE ACCESS KEY
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white font-mono text-xs focus:border-red-500/50 outline-none transition-all placeholder-gray-800"
                    style={{ borderRadius: '0px' }}
                    placeholder="ENTER NEW PASSWORD"
                  />
                </div>
                <div>
                  <label className="block text-[8px] text-gray-500 font-mono tracking-widest uppercase mb-1.5 ml-1">
                    CONFIRM NEW ACCESS KEY
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/[0.02] border border-white/10 text-white font-mono text-xs focus:border-red-500/50 outline-none transition-all placeholder-gray-800"
                    style={{ borderRadius: '0px' }}
                    placeholder="CONFIRM NEW PASSWORD"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-red-700 hover:bg-red-600 text-white font-mono text-xs font-bold tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4 active:scale-[0.98] shadow-lg shadow-red-950/20 border border-red-600/30"
                  style={{ borderRadius: '0px' }}
                >
                  SAVE NEW ACCESS KEY <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {success && (
              <button
                onClick={() => navigate('/dashboard', { replace: true })}
                className="w-full py-3.5 bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-xs font-bold tracking-widest transition-all flex items-center justify-center gap-2 mt-4 active:scale-[0.98] border border-emerald-600/30"
                style={{ borderRadius: '0px' }}
              >
                PROCEED TO DASHBOARD <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-3.5 border border-white/10 hover:border-white/20 bg-white/[0.01] hover:bg-white/[0.03] text-gray-300 font-mono text-[10px] tracking-widest transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
              style={{ borderRadius: '0px' }}
            >
              RETURN TO LOGIN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  // ORIGINAL WEB RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#050505] flex flex-col cap-safe-all relative overflow-hidden font-sans selection:bg-red-600/30 selection:text-white">
      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Soft Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <GovLoader message="Saving password..." />
        </div>
      )}

      {/* Header / Logo section */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-6 relative z-10">
        <div className="animate-scaleIn text-center">
          <div className="mx-auto mb-6 flex justify-center relative">
            <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 rounded-full" />
            <Logo size={56} className="text-red-500 relative z-10 drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-white">Create New Password</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide">Enter a secure new password for your account.</p>
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
          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm tracking-wide text-center font-medium rounded-xl">
              {success}
            </div>
          )}

          {!success && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                Save Password
              </button>
            </form>
          )}

          {success && (
            <button
              onClick={() => navigate('/dashboard', { replace: true })}
              className="w-full py-4 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[15px] transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] rounded-full"
            >
              Continue to Dashboard
            </button>
          )}

          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full py-3.5 mt-4 bg-transparent text-gray-500 hover:text-gray-300 font-medium text-sm transition-all active:scale-[0.98] rounded-xl hover:bg-white/5"
          >
            Return to Login
          </button>
        </div>
      </div>
    </div>
  );
}
