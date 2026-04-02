import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setCachedUser } from '../api';
import Logo from '../assets/logo';
import GovLoader from '../components/GovLoader';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(email, password);
      setToken(token);
      setCachedUser(user);
      navigate('/dashboard');
      // Keep loading=true through navigation so loader stays visible
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // Ironclad single request guest auth
      const res = await fetch(`${(import.meta as any).env.VITE_API_URL || 'http://localhost:3001/api'}/auth/guest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Failed to authenticate guest.');
      }

      setToken(data.token);
      setCachedUser(data.user);
      navigate('/dashboard');
    } catch (err: any) {
      console.warn('[Guest Login] Error, falling back to pure offline mode', err);
      // Zero-Failure Guarantee: Offline Fallback
      const ts = Date.now();
      setToken('mock_guest_token_' + ts);
      setCachedUser({
        id: 'offline_guest_' + ts,
        email: 'guest@sarkar.app',
        full_name: 'Guest User',
        age: 25,
        category: 'General',
        state: 'All India',
        qualification_type: 'Graduation',
        qualification_status: 'Completed',
      });
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080808]">
          <GovLoader message="Authenticating..." />
        </div>
      )}

      <div className="animate-scaleIn w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size={64} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">SarkarHamariHai</h1>
          <p className="text-gray-600 mt-1 text-sm">Government jobs, one place</p>
        </div>

        <div className="bg-[#0e0e0e] rounded-xl border border-[#1a1a1a] p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-1">Sign in</h2>
          <p className="text-gray-600 text-sm mb-5">Welcome back</p>

          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email or User ID</label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#141414] border border-[#252525] text-gray-200 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none transition-all text-sm placeholder-gray-700"
                placeholder="email@example.com or User ID"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#141414] border border-[#252525] text-gray-200 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none transition-all text-sm placeholder-gray-700"
                placeholder="Your password"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-red-800 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-[#1a1a1a]"></div>
            <span className="text-xs text-gray-700">or</span>
            <div className="flex-1 h-px bg-[#1a1a1a]"></div>
          </div>

          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full py-2.5 bg-[#141414] border border-[#252525] text-gray-400 font-medium rounded-lg hover:bg-[#1a1a1a] hover:text-gray-300 transition-colors text-sm disabled:opacity-50"
          >
            Continue as Guest
          </button>
          <p className="text-center text-[11px] text-gray-700 mt-2">
            No account needed. Browse all jobs instantly.
          </p>

          <p className="mt-5 text-center text-sm text-gray-500">
            New here?{' '}
            <Link to="/signup" className="text-red-500 font-medium hover:text-red-400">Create account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
