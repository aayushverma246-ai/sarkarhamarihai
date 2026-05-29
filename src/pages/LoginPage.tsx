import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../store';
import { selectAuth } from '../store/selectors';
import { loginAction, guestLoginAction } from '../store/actions/authActions';
import Logo from '../assets/logo';
import GovLoader from '../components/GovLoader';

export default function LoginPage() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector(selectAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(loginAction(email, password));
      navigate('/dashboard');
    } catch (err) {
      // Handled by Redux select
    }
  };

  const handleGuestLogin = () => {
    dispatch(guestLoginAction())
      .then(() => {
        navigate('/dashboard');
      })
      .catch(() => {
        navigate('/dashboard');
      });
  };

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
              const { supabase } = await import('../utils/supabase');
              const isNative = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform();
              const redirectUrl = isNative
                ? 'https://sarkarhamaraihai.vercel.app/auth/callback'
                : window.location.origin + '/auth/callback';
              await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: { redirectTo: redirectUrl }
              });
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
