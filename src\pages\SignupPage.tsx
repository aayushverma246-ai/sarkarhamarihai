import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setCachedUser } from '../api';
import { supabase } from '../utils/supabase';
import { indianStates } from '../data/states';
import Logo from '../assets/logo';
import GovLoader from '../components/GovLoader';

export default function SignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    age: '',
    category: 'General',
    state: 'Delhi',
    qualification_type: 'Graduation',
    qualification_status: 'Pursuing',
    current_year: '',
    current_semester: '',
    expected_graduation_year: '',
  });

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumericInput = (field: string, value: string) => {
    const cleaned = value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
    update(field, cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Comprehensive Validation
    if (!form.full_name.trim()) return setError('Full name is required.');
    if (!form.email.includes('@')) return setError('Please enter a valid email address.');
    if (form.password.length < 6) return setError('Password must be at least 6 characters.');

    const ageNum = parseInt(form.age);
    if (!form.age || isNaN(ageNum) || ageNum < 14) {
      setError('Please enter a valid age (14 or above).');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Create user in Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
          }
        }
      });

      if (signUpError) {
        throw new Error(signUpError.message);
      }

      if (!data.user) {
        throw new Error('Signup failed. Please try again.');
      }

      // If email confirmation is required, Supabase won't return a session
      if (!data.session) {
        // Auto sign-in to get a session (works if email confirmation is disabled)
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });

        if (signInError) {
          // Email confirmation might be required
          setError('Account created! Please check your email to confirm, then log in.');
          setLoading(false);
          return;
        }

        if (!signInData.session) {
          setError('Account created! Please check your email to confirm, then log in.');
          setLoading(false);
          return;
        }
      }

      // Step 2: Create profile in our database
      const profileData = {
        full_name: form.full_name,
        age: ageNum,
        category: form.category,
        state: form.state,
        qualification_type: form.qualification_type,
        qualification_status: form.qualification_status,
        current_year: parseInt(form.current_year) || 0,
        current_semester: parseInt(form.current_semester) || 0,
        expected_graduation_year: parseInt(form.expected_graduation_year) || 0,
      };

      const { user } = await api.setupProfile(profileData);
      setCachedUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col cap-safe-all relative overflow-hidden font-sans selection:bg-red-600/30 selection:text-white pb-8">
      
      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Soft Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <GovLoader message="Creating account..." />
        </div>
      )}

      <div className="w-full max-w-xl mx-auto px-5 relative z-10 pt-10 pb-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 flex justify-center relative">
            <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 rounded-full" />
            <Logo size={56} className="text-red-500 relative z-10 drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-white">Create Account</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide">
            {step === 1 ? 'Step 1: Identity' : 'Step 2: Education'}
          </p>
        </div>

        <div className="bg-[#0a0a0a]/80 border border-white/10 p-8 sm:p-10 backdrop-blur-2xl relative shadow-2xl rounded-3xl">
          {/* Top border highlight */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

          <div className="flex gap-2 mb-8">
            <div className={`flex-1 h-1 rounded-full transition-colors ${step >= 1 ? 'bg-red-500' : 'bg-white/10'}`} />
            <div className={`flex-1 h-1 rounded-full transition-colors ${step >= 2 ? 'bg-red-500' : 'bg-white/10'}`} />
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm tracking-wide text-center font-medium rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Full Name</label>
                  <input type="text" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner" placeholder="John Doe" autoComplete="name" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner" placeholder="john@example.com" autoComplete="email" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Password</label>
                  <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner" placeholder="Minimum 6 characters" autoComplete="new-password" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Age</label>
                    <input type="text" inputMode="numeric" value={form.age} onChange={(e) => handleNumericInput('age', e.target.value)} required className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner" placeholder="e.g. 22" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Category</label>
                    <select value={form.category} onChange={(e) => update('category', e.target.value)} className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner" autoComplete="off">
                      <option className="bg-[#0a0a0a]" value="General">General</option>
                      <option className="bg-[#0a0a0a]" value="OBC">OBC</option>
                      <option className="bg-[#0a0a0a]" value="SC">SC</option>
                      <option className="bg-[#0a0a0a]" value="ST">ST</option>
                      <option className="bg-[#0a0a0a]" value="EWS">EWS</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">State</label>
                  <select value={form.state} onChange={(e) => update('state', e.target.value)} className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner" autoComplete="address-level1">
                    {indianStates.map((s) => (<option className="bg-[#0a0a0a]" key={s} value={s}>{s}</option>))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.full_name || !form.email || !form.password || !form.age) {
                      setError('Please fill all fields before continuing.');
                      return;
                    }
                    setError('');
                    setStep(2);
                  }}
                  className="w-full py-4 mt-6 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all shadow-lg hover:shadow-red-500/20 active:scale-[0.98] rounded-full"
                >
                  Continue →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-medium tracking-wide text-white">Education Profile</h2>
                  <button type="button" onClick={() => setStep(1)} className="text-sm font-medium text-gray-500 hover:text-white transition-colors px-3 py-1 bg-white/5 rounded-lg hover:bg-white/10">← Back</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Highest Qual.</label>
                    <select value={form.qualification_type} onChange={(e) => update('qualification_type', e.target.value)} className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner">
                      <option className="bg-[#0a0a0a]" value="Class 10">Class 10</option>
                      <option className="bg-[#0a0a0a]" value="Class 12">Class 12</option>
                      <option className="bg-[#0a0a0a]" value="Graduation">Graduation</option>
                      <option className="bg-[#0a0a0a]" value="Post Graduation">Post Graduation</option>
                      <option className="bg-[#0a0a0a]" value="PhD">PhD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Status</label>
                    <select value={form.qualification_status} onChange={(e) => update('qualification_status', e.target.value)} className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner">
                      <option className="bg-[#0a0a0a]" value="Completed">Completed</option>
                      <option className="bg-[#0a0a0a]" value="Pursuing">Pursuing</option>
                    </select>
                  </div>
                </div>
                {form.qualification_status === 'Pursuing' && (
                  <div className="grid grid-cols-3 gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl mt-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Year</label>
                      <input type="text" inputMode="numeric" value={form.current_year} onChange={(e) => handleNumericInput('current_year', e.target.value)} className="w-full px-3 py-3 bg-black/50 border border-white/10 text-gray-100 focus:border-red-500/50 outline-none text-sm rounded-xl text-center font-medium shadow-inner" placeholder="3" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Sem</label>
                      <input type="text" inputMode="numeric" value={form.current_semester} onChange={(e) => handleNumericInput('current_semester', e.target.value)} className="w-full px-3 py-3 bg-black/50 border border-white/10 text-gray-100 focus:border-red-500/50 outline-none text-sm rounded-xl text-center font-medium shadow-inner" placeholder="5" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Grad Yr</label>
                      <input type="text" inputMode="numeric" value={form.expected_graduation_year} onChange={(e) => handleNumericInput('expected_graduation_year', e.target.value)} className="w-full px-3 py-3 bg-black/50 border border-white/10 text-gray-100 focus:border-red-500/50 outline-none text-sm rounded-xl text-center font-medium shadow-inner" placeholder="2026" />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 mt-8 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all disabled:opacity-50 shadow-lg hover:shadow-red-500/20 active:scale-[0.98] rounded-full"
                >
                  {loading ? 'Initializing...' : 'Initialize System'}
                </button>
              </div>
            )}
          </form>

          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-white/5"></div>
            <span className="text-xs text-gray-500 font-medium">or</span>
            <div className="flex-1 h-px bg-white/5"></div>
          </div>

          <button
            onClick={async () => {
              setLoading(true);
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
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-8 text-center text-sm text-gray-500 font-medium">
            Already have an account?{' '}
            <Link to="/login" className="text-red-500 font-semibold hover:text-red-400 transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
