import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { CreditCard, RefreshCw, Clock, CheckCircle, XCircle } from 'lucide-react';

const STATUS_MAP = {
  trialing: 'bg-yellow-100/80 text-yellow-800',
  active: 'bg-emerald-100/80 text-emerald-700',
  expired: 'bg-red-100/80 text-red-700',
  suspended: 'bg-gray-200/80 text-gray-600',
};

function TrialBadge({ endDate }) {
  if (!endDate) return <span className="text-gray-400 text-xs">—</span>;
  const days = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
  const cls = days > 14 ? 'bg-emerald-100 text-emerald-700' : days > 7 ? 'bg-amber-100 text-amber-700' : days > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500';
  return <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${cls}`}>{days > 0 ? `${days} days` : 'Expired'}</span>;
}

export default function AdminSubscriptions() {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await api.get('/admin/subscriptions', { params });
      setSubs(data);
    } catch { toast.error('Failed to load subscriptions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSubs(); }, [filter]);

  const extendTrial = async (id, name, days) => {
    if (!confirm(`Extend trial for ${name} by ${days} days?`)) return;
    try { await api.put(`/admin/companies/${id}/extend-trial`, { days }); toast.success(`Extended by ${days}d`); fetchSubs(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const changePlan = async (id, name, plan) => {
    if (!confirm(`Change ${name} to ${plan}?`)) return;
    try { await api.put(`/admin/companies/${id}/change-plan`, { plan }); toast.success(`Changed to ${plan}`); fetchSubs(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const suspend = async (id, name) => {
    if (!confirm(`Suspend ${name}?`)) return;
    try { await api.put(`/admin/companies/${id}/suspend`); toast.success('Suspended'); fetchSubs(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-primary">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center"><CreditCard size={24} className="text-amber-600" /></div>
          <div>
            <h1 className="text-base font-semibold text-primary">Subscriptions</h1>
            <p className="text-sm font-normal text-gray-500">{subs.length} clients · Manage billing and trials</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={filter} onChange={e => setFilter(e.target.value)}
            className="bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
          <button onClick={fetchSubs} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl btn-base btn-secondary">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-200/50">
              <tr>
                {['Client', 'Plan', 'Status', 'Trial End', 'Subscription End', 'Total Paid', 'Last Payment', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center font-normal uppercase tracking-widest text-xs text-gray-400">Loading...</td></tr>
              ) : subs.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center font-normal uppercase tracking-widest text-xs text-gray-400">No subscriptions found</td></tr>
              ) : subs.map(s => (
                <tr key={s.id} className="hover:bg-white/60 transition-colors">
                  <td className="px-4 py-3 font-normal text-primary">{s.name}</td>
                  <td className="px-4 py-3 font-normal text-gray-600 text-xs capitalize">{s.subscription_plan || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-normal px-2.5 py-1 rounded-full uppercase tracking-wide ${STATUS_MAP[s.subscription_status] || 'bg-gray-100 text-gray-600'}`}>{s.subscription_status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <TrialBadge endDate={s.trial_end_date} />
                    <div className="text-xs text-gray-400 mt-0.5">{s.trial_end_date ? new Date(s.trial_end_date).toLocaleDateString() : '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.subscription_end_date ? new Date(s.subscription_end_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3 font-normal text-emerald-600">KES {parseFloat(s.total_paid || 0).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{s.last_payment_date ? new Date(s.last_payment_date).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="relative group">
                        <button className="bg-amber-50 border-amber-100 px-2 py-1 rounded-lg text-amber-700 text-xs font-normal btn-base btn-secondary">
                          <Clock size={12} className="inline mr-1" />Trial
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 p-1.5 hidden group-hover:block z-10 min-w-[120px]">
                          {[7, 14, 30].map(d => (
                            <button key={d} onClick={() => extendTrial(s.id, s.name, d)} className="block w-full text-left px-3 py-2 text-xs font-normal text-gray-700 hover:bg-gray-50 rounded-lg">{d} days</button>
                          ))}
                        </div>
                      </div>
                      <div className="relative group">
                        <button className="border border-blue-100 px-2 py-1 rounded-lg text-blue-700 text-xs font-normal btn-base btn-primary">
                          <CreditCard size={12} className="inline mr-1" />Plan
                        </button>
                        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 p-1.5 hidden group-hover:block z-10 min-w-[120px]">
                          {['monthly', 'yearly', 'trialing'].map(p => (
                            <button key={p} onClick={() => changePlan(s.id, s.name, p)} className="block w-full text-left px-3 py-2 text-xs font-normal text-gray-700 hover:bg-gray-50 rounded-lg capitalize">{p}</button>
                          ))}
                        </div>
                      </div>
                      {s.subscription_status !== 'suspended' && (
                        <button onClick={() => suspend(s.id, s.name)} className="bg-red-50 hover:bg-red-100 border border-red-100 px-2 py-1 rounded-lg text-red-600 text-xs font-normal transition-all">Suspend</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
