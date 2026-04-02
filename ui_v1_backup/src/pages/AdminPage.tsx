import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getCachedUser, clearToken } from '../api';
import { Job } from '../types';
import Navbar from '../components/Navbar';
import GovLoader from '../components/GovLoader';

const EMPTY_FORM = {
  id: '', job_name: '', organization: '', qualification_required: 'Graduation',
  allows_final_year_students: false, minimum_age: '18', maximum_age: '30',
  application_start_date: '', application_end_date: '',
  salary_min: '25000', salary_max: '80000',
  job_category: 'SSC', official_application_link: '',
};

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

function computeFormStatus(job: Job): string {
  const today = new Date();
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const todayNum = y * 10000 + (m + 1) * 100 + d;
  const sp = job.application_start_date.split('-');
  const startNum = parseInt(sp[0]) * 10000 + parseInt(sp[1]) * 100 + parseInt(sp[2]);
  const ep = job.application_end_date.split('-');
  const endNum = parseInt(ep[0]) * 10000 + parseInt(ep[1]) * 100 + parseInt(ep[2]);
  if (todayNum < startNum) return 'UPCOMING';
  if (todayNum > endNum) return 'CLOSED';
  return 'LIVE';
}

export default function AdminPage() {
  const navigate = useNavigate();
  const cached = getCachedUser();
  const [user, setUser] = useState<any>(cached);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!cached) { navigate('/login'); return; }
    const load = async () => {
      try {
        const [me, j] = await Promise.all([api.getMe(), api.getJobs()]);
        setUser(me);
        setJobs(j);
      } catch {
        clearToken(); navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line
  }, []);

  const refresh = async () => {
    const j = await api.getJobs();
    setJobs(j);
  };

  const handleAddJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const jobId = form.id || generateId();
      const res = await fetch('http://localhost:3001/api/admin/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sarkar_token')}`,
        },
        body: JSON.stringify({
          ...form,
          id: jobId,
          minimum_age: parseInt(form.minimum_age) || 18,
          maximum_age: parseInt(form.maximum_age) || 30,
          salary_min: parseInt(form.salary_min) || 25000,
          salary_max: parseInt(form.salary_max) || 80000,
          allows_final_year_students: form.allows_final_year_students ? 1 : 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add job');
      }
      await refresh();
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add job');
    } finally {
      setSaving(false);
    }
  };

  if (!cached) return null;

  const liveCount = jobs.filter(j => computeFormStatus(j) === 'LIVE').length;
  const upcomingCount = jobs.filter(j => computeFormStatus(j) === 'UPCOMING').length;

  const inputClass = "w-full px-3 py-2 rounded-lg bg-[#141414] border border-[#252525] text-gray-200 focus:ring-1 focus:ring-red-700 focus:border-red-700 outline-none transition-all text-sm";

  return (
    <div className="min-h-screen bg-[#080808]">
      <Navbar user={user} />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-gray-200">Manage Jobs</h1>
            <p className="text-gray-600 text-sm mt-0.5">{jobs.length} total · {liveCount} live · {upcomingCount} upcoming</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-red-800 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors">
            {showForm ? 'Cancel' : '+ Add Job'}
          </button>
        </div>

        {showForm && (
          <div className="bg-[#0e0e0e] rounded-xl border border-[#1a1a1a] p-5 mb-5">
            <h2 className="text-base font-semibold text-gray-200 mb-4">New Job</h2>
            {error && <div className="mb-3 p-3 bg-red-950/40 border border-red-900/40 text-red-400 rounded-lg text-sm">{error}</div>}
            <form onSubmit={handleAddJob} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Job Name</label>
                <input required value={form.job_name} onChange={e => setForm((f: any) => ({ ...f, job_name: e.target.value }))} className={inputClass} placeholder="E.g. SSC CGL 2026" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Organization</label>
                <input required value={form.organization} onChange={e => setForm((f: any) => ({ ...f, organization: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Category</label>
                <select value={form.job_category} onChange={e => setForm((f: any) => ({ ...f, job_category: e.target.value }))} className={inputClass}>
                  {['SSC', 'UPSC', 'Banking', 'Insurance', 'Railway', 'Defence', 'Police', 'Research', 'PSU', 'State Services', 'Teaching', 'Central Govt', 'Judiciary', 'Healthcare', 'Agriculture', 'Telecom', 'Forest', 'Shipping', 'Cooperative', 'Entrance Exam'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Qualification Required</label>
                <select value={form.qualification_required} onChange={e => setForm((f: any) => ({ ...f, qualification_required: e.target.value }))} className={inputClass}>
                  {['Class 10', 'Class 12', 'Graduation', 'Post Graduation', 'PhD'].map(q => <option key={q}>{q}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Official Link</label>
                <input required type="url" value={form.official_application_link} onChange={e => setForm((f: any) => ({ ...f, official_application_link: e.target.value }))} className={inputClass} placeholder="https://ssc.gov.in" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min Age</label>
                <input type="number" value={form.minimum_age} onChange={e => setForm((f: any) => ({ ...f, minimum_age: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Age</label>
                <input type="number" value={form.maximum_age} onChange={e => setForm((f: any) => ({ ...f, maximum_age: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Start Date</label>
                <input required type="date" value={form.application_start_date} onChange={e => setForm((f: any) => ({ ...f, application_start_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">End Date</label>
                <input required type="date" value={form.application_end_date} onChange={e => setForm((f: any) => ({ ...f, application_end_date: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Min Salary</label>
                <input type="number" value={form.salary_min} onChange={e => setForm((f: any) => ({ ...f, salary_min: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Salary</label>
                <input type="number" value={form.salary_max} onChange={e => setForm((f: any) => ({ ...f, salary_max: e.target.value }))} className={inputClass} />
              </div>
              <div className="sm:col-span-2 flex items-center gap-2">
                <input type="checkbox" id="fys" checked={form.allows_final_year_students} onChange={e => setForm((f: any) => ({ ...f, allows_final_year_students: e.target.checked }))} className="accent-red-700" />
                <label htmlFor="fys" className="text-sm text-gray-400">Allows final year students</label>
              </div>
              <div className="sm:col-span-2">
                <button type="submit" disabled={saving} className="w-full py-2.5 bg-red-800 text-white font-medium rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50">
                  {saving ? 'Adding...' : 'Add Job'}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-[#0e0e0e] rounded-xl border border-[#1a1a1a] overflow-hidden">
          {loading ? (
            <GovLoader message="Loading Jobs..." />
          ) : (
            <div className="divide-y divide-[#141414]">
              {jobs.map(job => (
                <div key={job.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-200 font-medium truncate">{job.job_name}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{job.organization} · {job.job_category}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded border ${computeFormStatus(job) === 'LIVE' ? 'text-green-400 bg-green-900/20 border-green-900/30' : computeFormStatus(job) === 'UPCOMING' ? 'text-yellow-400 bg-yellow-900/20 border-yellow-900/30' : 'text-gray-500 bg-[#111] border-[#1a1a1a]'}`}>
                      {computeFormStatus(job)}
                    </span>
                    <button
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="px-2.5 py-1 bg-[#141414] border border-[#252525] text-gray-500 text-xs rounded hover:text-gray-300 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
