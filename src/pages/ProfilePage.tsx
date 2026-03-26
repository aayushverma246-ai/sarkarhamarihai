import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, setCachedUser, clearToken } from '../api';
import Navbar from '../components/Navbar';
import { indianStates } from '../data/states';

export default function ProfilePage() {
  const navigate = useNavigate();
  const cached = getCachedUser();
  const [user, setUser] = useState<any>(cached);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [likedCount, setLikedCount] = useState(0);
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
        const [me, eligible, liked] = await Promise.all([
          api.getMe(),
          api.getEligibleJobs(),
          api.getLikedJobs(),
        ]);
        setUser(me);
        setCachedUser(me);
        setEligibleCount(eligible.length);
        setLikedCount(liked.length);
        setForm({
          full_name: me.full_name || '',
          age: me.age ? String(me.age) : '',
          category: me.category || 'General',
          state: me.state || 'Delhi',
          qualification_type: me.qualification_type || 'Graduation',
          qualification_status: me.qualification_status || 'Pursuing',
          current_year: me.current_year ? String(me.current_year) : '',
          current_semester: me.current_semester ? String(me.current_semester) : '',
          expected_graduation_year: me.expected_graduation_year ? String(me.expected_graduation_year) : '',
        });
      } catch {
        clearToken(); navigate('/login');
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
      setUser(updated);
      setCachedUser(updated);
      const eligible = await api.getEligibleJobs();
      setEligibleCount(eligible.length);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
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
      <div className="page-enter max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-200">Profile</h1>
          <p className="text-gray-600 text-sm mt-0.5">Your eligibility is computed from these details</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#0e0e0e] rounded-lg border border-[#141414] p-4">
            <p className="text-[11px] text-red-700 uppercase tracking-wide">Eligible Jobs</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{loading ? '—' : eligibleCount}</p>
          </div>
          <div className="bg-[#0e0e0e] rounded-lg border border-[#141414] p-4">
            <p className="text-[11px] text-gray-600 uppercase tracking-wide">Saved Jobs</p>
            <p className="text-3xl font-bold text-gray-300 mt-1">{loading ? '—' : likedCount}</p>
          </div>
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
                    {indianStates.map((s: string) => <option key={s}>{s}</option>)}
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
                        {['Class 10', 'Class 12', 'Graduation', 'Post Graduation', 'PhD'].map(q => <option key={q}>{q}</option>)}
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
                  {form.qualification_status === 'Pursuing' && (
                    <div className="grid grid-cols-3 gap-3 p-3 bg-[#0a0a0a] rounded-lg border border-[#151515]">
                      {[
                        { label: 'Year', field: 'current_year', ph: '3' },
                        { label: 'Semester', field: 'current_semester', ph: '5' },
                        { label: 'Grad Year', field: 'expected_graduation_year', ph: '2026' },
                      ].map(({ label, field, ph }) => (
                        <div key={field}>
                          <label className="block text-xs text-gray-500 mb-1">{label}</label>
                          <input type="text" inputMode="numeric" value={(form as any)[field]} onChange={e => handleNum(field, e.target.value)} placeholder={ph} className={inputClass} />
                        </div>
                      ))}
                    </div>
                  )}
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
    </div>
  );
}
