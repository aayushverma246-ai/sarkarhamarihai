import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setCachedUser, getCachedUser } from '../api';
import { supabase } from '../utils/supabase';
import { indianStates } from '../data/states';
import Logo from '../assets/logo';
import GovLoader from '../components/GovLoader';

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [form, setForm] = useState({
    full_name: '',
    age: '',
    category: 'General',
    state: 'Delhi',
    qualification_type: 'Graduation',
    qualification_status: 'Completed',
    current_year: '',
    current_semester: '',
    expected_graduation_year: '',
    password: '',
  });

  useEffect(() => {
    const cachedUser = getCachedUser();
    if (!cachedUser) {
      navigate('/login', { replace: true });
      return;
    }
    setUser(cachedUser);
    setForm(prev => ({
      ...prev,
      full_name: cachedUser.full_name || '',
    }));
  }, [navigate]);

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

    // Validations
    if (!form.full_name.trim()) return setError('Full name is required.');
    
    const ageNum = parseInt(form.age);
    if (!form.age || isNaN(ageNum) || ageNum < 14) {
      return setError('Please enter a valid age (14 or above).');
    }

    if (!form.password || form.password.length < 6) {
      return setError('App password must be at least 6 characters.');
    }

    setLoading(true);
    try {
      // Step 1: Update user password in Supabase Auth
      const { error: passwordError } = await supabase.auth.updateUser({
        password: form.password,
      });

      if (passwordError) {
        const msg = passwordError.message || '';
        const isSamePasswordError = msg.toLowerCase().includes('different from the old') || 
                                     msg.toLowerCase().includes('should be different');
        if (!isSamePasswordError) {
          throw new Error(`Password configuration failed: ${passwordError.message}`);
        }
      }

      // Step 2: Save profile details to our database
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

      const { user: updatedUser } = await api.setupProfile(profileData);
      
      // Step 3: Cache updated user profile and redirect to dashboard
      setCachedUser(updatedUser);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col cap-safe-all relative overflow-hidden font-sans selection:bg-red-600/30 selection:text-white pb-8">
      {/* Subtle Dot Grid Background */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
      
      {/* Soft Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <GovLoader message="Configuring profile..." />
        </div>
      )}

      <div className="w-full max-w-xl mx-auto px-5 relative z-10 pt-10 pb-10">
        <div className="text-center mb-8">
          <div className="mx-auto mb-6 flex justify-center relative">
            <div className="absolute inset-0 bg-red-500 blur-2xl opacity-20 rounded-full" />
            <Logo size={56} className="text-red-500 relative z-10 drop-shadow-md" />
          </div>
          <h1 className="text-3xl font-medium tracking-tight text-white">Complete Profile</h1>
          <p className="text-gray-400 mt-2 text-sm font-medium tracking-wide">
            Setup your credentials and details for SarkarHamariHai
          </p>
        </div>

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
              <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Full Name</label>
              <input
                type="text"
                value={form.full_name}
                onChange={(e) => update('full_name', e.target.value)}
                required
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner"
                placeholder="John Doe"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Age</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.age}
                  onChange={(e) => handleNumericInput('age', e.target.value)}
                  required
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner"
                  placeholder="e.g. 22"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => update('category', e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner"
                >
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
              <select
                value={form.state}
                onChange={(e) => update('state', e.target.value)}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner"
              >
                {indianStates.map((s) => (
                  <option className="bg-[#0a0a0a]" key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Highest Qualification</label>
                <select
                  value={form.qualification_type}
                  onChange={(e) => update('qualification_type', e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner"
                >
                  <option className="bg-[#0a0a0a]" value="Class 10">Class 10</option>
                  <option className="bg-[#0a0a0a]" value="Class 12">Class 12</option>
                  <option className="bg-[#0a0a0a]" value="Graduation">Graduation</option>
                  <option className="bg-[#0a0a0a]" value="Post Graduation">Post Graduation</option>
                  <option className="bg-[#0a0a0a]" value="PhD">PhD</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Status</label>
                <select
                  value={form.qualification_status}
                  onChange={(e) => update('qualification_status', e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm rounded-xl appearance-none font-medium shadow-inner"
                >
                  <option className="bg-[#0a0a0a]" value="Completed">Completed</option>
                  <option className="bg-[#0a0a0a]" value="Pursuing">Pursuing</option>
                </select>
              </div>
            </div>

            {form.qualification_status === 'Pursuing' && (
              <div className="grid grid-cols-3 gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl mt-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Year</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.current_year}
                    onChange={(e) => handleNumericInput('current_year', e.target.value)}
                    className="w-full px-3 py-3 bg-black/50 border border-white/10 text-gray-100 focus:border-red-500/50 outline-none text-sm rounded-xl text-center font-medium shadow-inner"
                    placeholder="3"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Sem</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.current_semester}
                    onChange={(e) => handleNumericInput('current_semester', e.target.value)}
                    className="w-full px-3 py-3 bg-black/50 border border-white/10 text-gray-100 focus:border-red-500/50 outline-none text-sm rounded-xl text-center font-medium shadow-inner"
                    placeholder="5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">Grad Yr</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.expected_graduation_year}
                    onChange={(e) => handleNumericInput('expected_graduation_year', e.target.value)}
                    className="w-full px-3 py-3 bg-black/50 border border-white/10 text-gray-100 focus:border-red-500/50 outline-none text-sm rounded-xl text-center font-medium shadow-inner"
                    placeholder="2026"
                  />
                </div>
              </div>
            )}

            <div className="border-t border-white/5 pt-4 mt-6">
              <label className="block text-xs text-gray-400 mb-2 font-medium tracking-wide ml-1">
                Choose App Password (for normal login)
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3.5 bg-white/5 border border-white/10 text-gray-100 focus:border-red-500/50 focus:bg-white/10 outline-none transition-all text-sm placeholder-gray-600 rounded-xl font-medium shadow-inner"
                placeholder="Minimum 6 characters"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 mt-6 bg-red-600 hover:bg-red-500 text-white font-semibold text-[15px] transition-all disabled:opacity-50 shadow-lg hover:shadow-red-500/20 active:scale-[0.98] rounded-full"
            >
              {loading ? 'Saving Setup...' : 'Complete Setup & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
