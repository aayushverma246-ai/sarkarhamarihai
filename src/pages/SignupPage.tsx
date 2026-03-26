import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setCachedUser } from '../api';
import { indianStates } from '../data/states';
import Logo from '../assets/logo';

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
      const { token, user } = await api.signup({
        ...form,
        age: ageNum,
        current_year: parseInt(form.current_year) || 0,
        current_semester: parseInt(form.current_semester) || 0,
        expected_graduation_year: parseInt(form.expected_graduation_year) || 0,
      });
      setToken(token);
      setCachedUser(user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[#141414] border border-[#252525] text-gray-200 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none transition-all text-sm placeholder-gray-600";

  return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size={56} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Create your account</h1>
          <p className="text-gray-600 mt-1 text-sm">
            {step === 1 ? 'Basic information' : 'Education details'}
          </p>
        </div>

        <div className="bg-[#0e0e0e] rounded-xl border border-[#1a1a1a] p-6 sm:p-8">
          <div className="flex gap-2 mb-6">
            <div className={`flex-1 h-1 rounded-full ${step >= 1 ? 'bg-red-800' : 'bg-[#1a1a1a]'}`} />
            <div className={`flex-1 h-1 rounded-full ${step >= 2 ? 'bg-red-800' : 'bg-[#1a1a1a]'}`} />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Name</label>
                  <input type="text" value={form.full_name} onChange={(e) => update('full_name', e.target.value)} required className={inputClass} placeholder="Your full name" autoComplete="name" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required className={inputClass} placeholder="you@email.com" autoComplete="email" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">Password</label>
                  <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={6} className={inputClass} placeholder="Minimum 6 characters" autoComplete="new-password" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Age</label>
                    <input type="text" inputMode="numeric" value={form.age} onChange={(e) => handleNumericInput('age', e.target.value)} required className={inputClass} placeholder="e.g. 22" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Category</label>
                    <select value={form.category} onChange={(e) => update('category', e.target.value)} className={inputClass} autoComplete="off">
                      <option value="General">General</option>
                      <option value="OBC">OBC</option>
                      <option value="SC">SC</option>
                      <option value="ST">ST</option>
                      <option value="EWS">EWS</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1.5">State</label>
                  <select value={form.state} onChange={(e) => update('state', e.target.value)} className={inputClass} autoComplete="address-level1">
                    {indianStates.map((s: string) => (<option key={s} value={s}>{s}</option>))}
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
                  className="w-full py-2.5 bg-red-800 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm mt-2"
                >
                  Continue
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-semibold text-gray-200">Education</h2>
                  <button type="button" onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-300">Back</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Highest qualification</label>
                    <select value={form.qualification_type} onChange={(e) => update('qualification_type', e.target.value)} className={inputClass}>
                      <option value="Class 10">Class 10</option>
                      <option value="Class 12">Class 12</option>
                      <option value="Graduation">Graduation</option>
                      <option value="Post Graduation">Post Graduation</option>
                      <option value="PhD">PhD</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Status</label>
                    <select value={form.qualification_status} onChange={(e) => update('qualification_status', e.target.value)} className={inputClass}>
                      <option value="Completed">Completed</option>
                      <option value="Pursuing">Pursuing</option>
                    </select>
                  </div>
                </div>
                {form.qualification_status === 'Pursuing' && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#151515]">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Year</label>
                      <input type="text" inputMode="numeric" value={form.current_year} onChange={(e) => handleNumericInput('current_year', e.target.value)} className={inputClass} placeholder="3" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Semester</label>
                      <input type="text" inputMode="numeric" value={form.current_semester} onChange={(e) => handleNumericInput('current_semester', e.target.value)} className={inputClass} placeholder="5" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Grad year</label>
                      <input type="text" inputMode="numeric" value={form.expected_graduation_year} onChange={(e) => handleNumericInput('expected_graduation_year', e.target.value)} className={inputClass} placeholder="2026" />
                    </div>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 bg-red-800 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm mt-2 disabled:opacity-50"
                >
                  {loading ? 'Creating account...' : 'Create Account'}
                </button>
              </div>
            )}
          </form>

          <p className="mt-5 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-red-500 font-medium hover:text-red-400">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
