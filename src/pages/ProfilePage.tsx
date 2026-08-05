import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, setCachedUser, clearToken } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { indianStates } from '../data/states';
import { useLanguage } from '../i18n/LanguageContext';
import { translateDynamicData } from '../utils/translateHelper';


export default function ProfilePage() {
  const navigate = useNavigate();
  const cached = getCachedUser();
  const { language } = useLanguage();
  const [user, setUser] = useState<any>(cached);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    full_name: '', age: '', category: 'General', state: 'Delhi',
    qualification_type: 'Graduation', qualification_status: 'Pursuing',
    current_year: '', current_semester: '', expected_graduation_year: '',
  });
  useEffect(() => {
    if (!cached) { navigate('/login'); return; }
    const load = async () => {
      setLoading(true);
      try {
        // Fetch user profile and billing status in parallel
        let me: any = null;

        try {
          const [meRes] = await Promise.all([
            api.getMe(),
            api.getBillingStatus().catch(() => null)
          ]);
          me = meRes;
        } catch (meErr: any) {
          // Only redirect on explicit auth failure, not on network errors
          if (meErr?.message?.includes('Session expired') || meErr?.message?.includes('401')) {
            clearToken(); navigate('/login'); return;
          }
          me = cached; // Fall back to cached user data
        }

        const resolvedUser = (me && me.email) ? me : cached;
        setUser(resolvedUser);
        if (me && me.email) setCachedUser(resolvedUser);
        setForm({
          full_name: resolvedUser.full_name || '',
          age: resolvedUser.age ? String(resolvedUser.age) : '',
          category: resolvedUser.category || 'General',
          state: resolvedUser.state || 'Delhi',
          qualification_type: resolvedUser.qualification_type || 'Graduation',
          qualification_status: resolvedUser.qualification_status || 'Pursuing',
          current_year: resolvedUser.current_year ? String(resolvedUser.current_year) : '',
          current_semester: resolvedUser.current_semester ? String(resolvedUser.current_semester) : '',
          expected_graduation_year: resolvedUser.expected_graduation_year ? String(resolvedUser.expected_graduation_year) : '',
        });
      } catch (err: any) {
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line
  }, []);

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
  const handleNum = (field: string, value: string) =>
    update(field, value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await api.updateMe({
        full_name: form.full_name || 'User',
        age: parseInt(form.age) || 0,
        category: form.category,
        state: form.state,
        qualification_type: form.qualification_type,
        qualification_status: form.qualification_status,
        current_year: parseInt(form.current_year) || 0,
        current_semester: parseInt(form.current_semester) || 0,
        expected_graduation_year: parseInt(form.expected_graduation_year) || 0,
      });
      if (updated) {
        setUser(updated);
        setCachedUser(updated);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  if (!cached) return null;

  const inputClass = "w-full px-3.5 py-2.5 rounded-lg bg-[#141414] border border-[#252525] text-gray-200 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none transition-all text-sm";

  return (
    <div className="min-h-screen bg-[#080808]">
      <Navbar user={user} />
      <div className="page-enter max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-32">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-200">Profile</h1>
          <p className="text-gray-600 text-sm mt-0.5">Your eligibility is computed from these details</p>
        </div>



        <div className="bg-[#0e0e0e] rounded-xl border border-[#1a1a1a] p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-600 text-sm">Loading profile...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-sm">{error}</div>}
              {saved && <div className="p-3 bg-green-950/40 border border-green-900/40 text-green-400 rounded-lg text-sm">Profile saved successfully! Eligible jobs refreshed.</div>}

              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Personal</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Full name</label>
                    <input type="text" value={form.full_name} onChange={e => update('full_name', e.target.value)} className={inputClass} placeholder="Your name" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Age</label>
                      <input type="text" inputMode="numeric" value={form.age} onChange={e => handleNum('age', e.target.value)} className={inputClass} placeholder="22" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Category</label>
                      <select value={form.category} onChange={e => update('category', e.target.value)} className={inputClass}>
                        {['General', 'OBC', 'SC', 'ST', 'EWS'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">State</label>
                    <select value={form.state} onChange={e => update('state', e.target.value)} className={inputClass}>
                    {indianStates.map((s) => <option key={s} value={s}>{translateDynamicData(s, language, 'state')}</option>)}
                    </select>
                  </div>
                  {user?.email && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Email</label>
                      <input type="email" value={user.email} readOnly className={inputClass + ' opacity-50 cursor-not-allowed'} />
                    </div>
                  )}
                </div>
              </section>

              <div className="border-t border-[#141414]" />

              <section>
                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Education</h2>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Qualification</label>
                      <select value={form.qualification_type} onChange={e => update('qualification_type', e.target.value)} className={inputClass}>
                        {['Class 10', 'Class 12', 'Graduation', 'Post Graduation', 'PhD'].map(q => <option key={q} value={q}>{translateDynamicData(q, language, 'qualification')}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-1.5">Status</label>
                      <select value={form.qualification_status} onChange={e => update('qualification_status', e.target.value)} className={inputClass}>
                        <option>Completed</option>
                        <option>Pursuing</option>
                      </select>
                    </div>
                  </div>
                  <div className={`grid gap-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#151515] ${form.qualification_status === 'Pursuing' && !['Class 10', 'Class 12'].includes(form.qualification_type) ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    {form.qualification_status === 'Pursuing' && !['Class 10', 'Class 12'].includes(form.qualification_type) && (
                      <>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Year</label>
                          <input type="text" inputMode="numeric" value={form.current_year} onChange={e => handleNum('current_year', e.target.value)} placeholder="e.g. 3" className={inputClass} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Semester</label>
                          <input type="text" inputMode="numeric" value={form.current_semester} onChange={e => handleNum('current_semester', e.target.value)} placeholder="e.g. 6" className={inputClass} />
                        </div>
                      </>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        {form.qualification_status === 'Completed' ? 'Passing Year' : 'Grad Year'}
                      </label>
                      <input type="text" inputMode="numeric" value={form.expected_graduation_year} onChange={e => handleNum('expected_graduation_year', e.target.value)} placeholder="e.g. 2026" className={inputClass} />
                    </div>
                  </div>
                </div>
              </section>

              <button type="submit" disabled={saving} className="w-full py-2.5 bg-red-800 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </div>
        <button onClick={handleLogout} className="w-full mt-4 py-2.5 bg-[#0e0e0e] border border-[#1a1a1a] text-gray-600 font-medium rounded-lg hover:bg-[#141414] hover:text-gray-400 transition-colors text-sm">
          Sign out
        </button>
      </div>
      <Footer />
    </div>
  );
}
