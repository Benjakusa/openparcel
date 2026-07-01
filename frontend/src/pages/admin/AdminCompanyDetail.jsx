import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Building2, Package, DollarSign, Users, MapPin, CreditCard, CheckCircle, XCircle, Clock, RefreshCw, Activity, AlertTriangle, Smartphone, Key } from 'lucide-react';
import PasswordStrength from '../../components/PasswordStrength';

function ResetPasswordForm({ email, onSave, onCancel }) {
  const [password, setPassword] = useState('');
  const [wipeData, setWipeData] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (wipeData && !confirm(`Are you absolutely sure you want to completely wipe all generic logs for ${email}? This action cannot be undone.`)) return;
    setSaving(true);
    try {
      await onSave(password, wipeData);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="glass-card bg-white/90 p-8 w-full max-w-md transition-all relative overflow-hidden">
        <div className="flex items-center justify-between mb-6 relative z-10">
          <h3 className="font-black text-2xl text-primary flex items-center gap-2">
            <Key className="text-amber-500" />
            Reset Password
          </h3>
          <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/50 border border-white hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all text-gray-400">
            <XCircle size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div className="text-sm font-medium text-gray-500 mb-4">Resetting credentials for: <span className="font-bold text-primary">{email}</span></div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">New Password</label>
            <input type="password" required placeholder="New secure password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/70 border border-gray-200/60 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all" />
            <PasswordStrength password={password} />
          </div>

          <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
            <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-100 transition-colors">
              <input type="checkbox" checked={!wipeData} onChange={() => setWipeData(false)} className="mt-1 w-4 h-4 text-primary focus:ring-primary rounded" />
              <div>
                <div className="text-sm font-bold text-gray-800">Retain existing historical data</div>
                <div className="text-xs font-medium text-gray-500 mt-0.5">Keep all associated records and actions (Default)</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-red-50 border-t border-gray-200 transition-colors group">
              <input type="checkbox" checked={wipeData} onChange={() => setWipeData(true)} className="mt-1 w-4 h-4 text-red-500 focus:ring-red-500 rounded" />
              <div>
                <div className="text-sm font-bold text-red-600 group-hover:text-red-700 transition-colors">Wipe all non-essential data</div>
                <div className="text-xs font-medium text-red-400 mt-0.5">Permanently delete explicit historical footprint of this account</div>
              </div>
            </label>
          </div>

          <div className="flex gap-4 pt-4">
            <button type="button" onClick={onCancel} className="flex-1 bg-white/60 hover:bg-white border border-white text-gray-600 py-3.5 rounded-xl text-base font-bold transition-all">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-amber-500 text-white hover:-translate-y-0.5 hover:bg-amber-600 py-3.5 rounded-xl text-base font-black disabled:opacity-60 transition-all">
              {saving ? 'Saving...' : 'Reset Key'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const STATUS_MAP = {
  trialing: 'bg-yellow-100/80 text-yellow-800',
  active: 'bg-emerald-100/80 text-emerald-700',
  expired: 'bg-red-100/80 text-red-700',
  suspended: 'bg-gray-200/80 text-gray-600',
};

function StatCard({ icon: Icon, label, value, color, sub }) {
  return (
    <div className="glass-card bg-white/60 p-5 border border-white/60">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</div>
      </div>
      <div className="text-2xl font-black text-primary">{value ?? '—'}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  return <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${STATUS_MAP[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function CheckItem({ done, label }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${done ? 'text-emerald-600' : 'text-gray-400'}`}>
      {done ? <CheckCircle size={16} /> : <XCircle size={16} />}
      <span className="font-medium">{label}</span>
    </div>
  );
}

export default function AdminCompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [parcelFilter, setParcelFilter] = useState('');
  const [resetConfig, setResetConfig] = useState(null);

  const fetchCompany = async () => {
    try {
      const { data } = await api.get(`/admin/companies/${id}`);
      setCompany(data);
    } catch { toast.error('Failed to load company'); navigate('/admin/companies'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCompany(); }, [id]);

  const approve = async () => {
    try { await api.put(`/admin/companies/${id}/approve`); toast.success('Approved!'); fetchCompany(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const suspend = async () => {
    if (!confirm(`Suspend ${company?.name}?`)) return;
    try { await api.put(`/admin/companies/${id}/suspend`); toast.success('Suspended'); fetchCompany(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const extendTrial = async (days) => {
    setExtending(true);
    try { await api.put(`/admin/companies/${id}/extend-trial`, { days }); toast.success(`Trial extended by ${days} days`); fetchCompany(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setExtending(false); }
  };

  const changePlan = async (plan) => {
    try { await api.put(`/admin/companies/${id}/change-plan`, { plan }); toast.success(`Plan changed to ${plan}`); fetchCompany(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" /></div>;
  if (!company) return null;

  const setupItems = [
    { done: (company.office_count || 0) > 0, label: 'Offices created' },
    { done: (company.staff_count || 0) > 0, label: 'Staff added' },
    { done: company.mpesa_configured, label: 'M-Pesa configured' },
    { done: (company.total_parcels || 0) > 0, label: 'First parcel sent' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="glass-card p-6 border-l-4 border-primary">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/admin/companies')} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl text-gray-500 hover:text-primary transition-all">
              <ArrowLeft size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black text-primary">{company.name}</h1>
                <StatusBadge status={company.subscription_status} />
                {company.approved
                  ? <span className="flex items-center gap-1 text-emerald-600 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md"><CheckCircle size={12} /> Approved</span>
                  : <span className="flex items-center gap-1 text-red-500 font-bold text-xs bg-red-50 px-2 py-1 rounded-md"><XCircle size={12} /> Pending</span>}
              </div>
              <p className="text-sm text-gray-500 mt-1">Registered {new Date(company.registered_at).toLocaleDateString()} · Plan: {company.subscription_plan || 'None'} · Trial ends: {company.trial_end_date ? new Date(company.trial_end_date).toLocaleDateString() : '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!company.approved && <button onClick={approve} className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">Approve Client</button>}
            {company.approved && company.subscription_status !== 'suspended' && <button onClick={suspend} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">Suspend</button>}
            <div className="relative group">
              <button disabled={extending} className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                <Clock size={14} /> {extending ? 'Extending...' : 'Extend Trial'}
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 p-1.5 hidden group-hover:block z-10 min-w-[140px]">
                {[7, 14, 30].map(d => (
                  <button key={d} onClick={() => extendTrial(d)} className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg">{d} days</button>
                ))}
              </div>
            </div>
            <div className="relative group">
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2">
                <CreditCard size={14} /> Change Plan
              </button>
              <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-gray-100 p-1.5 hidden group-hover:block z-10 min-w-[140px]">
                {['monthly', 'yearly', 'trialing'].map(p => (
                  <button key={p} onClick={() => changePlan(p)} className="block w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg capitalize">{p}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Setup Checklist */}
      <div className="glass-card bg-white/60 p-5 border border-white/60">
        <h2 className="font-black text-primary text-sm uppercase tracking-wide mb-3 flex items-center gap-2"><Activity size={16} /> Setup Progress</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">{setupItems.map((item, i) => <CheckItem key={i} {...item} />)}</div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard icon={Package} label="Total Parcels" value={company.total_parcels} color="bg-accent" />
        <StatCard icon={Package} label="Parcels (30d)" value={company.parcels_30d} color="bg-blue-500" />
        <StatCard icon={AlertTriangle} label="Pending Payments" value={company.pending_payments} color="bg-amber-500" />
        <StatCard icon={AlertTriangle} label="Failed Payments" value={company.failed_payments} color="bg-red-500" />
        <StatCard icon={CreditCard} label="Subscription Rev" value={`KES ${parseFloat(company.total_subscription_revenue || 0).toLocaleString()}`} color="bg-indigo-500" />
      </div>

      {/* Users + Offices row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Users */}
        <div className="glass-card bg-white/60 p-5 border border-white/60">
          <h2 className="font-black text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><Users size={16} /> Staff ({company.users?.length || 0})</h2>
          {company.users?.length === 0 ? <p className="text-gray-400 text-sm">No staff added yet</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {company.users?.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-semibold text-primary text-sm">{u.full_name || '—'}</div>
                    <div className="text-xs text-gray-500">{u.email} · {u.role?.replace('_', ' ')}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{u.phone || '—'}</span>
                    <button onClick={() => setResetConfig(u)} className="bg-white hover:bg-amber-50 border border-gray-200 hover:border-amber-200 text-amber-500 hover:text-amber-600 px-2 h-6 rounded-md flex items-center justify-center transition-all font-bold text-[10px]" title="Reset Password">
                      Reset
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Offices */}
        <div className="glass-card bg-white/60 p-5 border border-white/60">
          <h2 className="font-black text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><MapPin size={16} /> Offices ({company.offices?.length || 0})</h2>
          {company.offices?.length === 0 ? <p className="text-gray-400 text-sm">No offices created yet</p> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {company.offices?.map(o => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="font-semibold text-primary text-sm">{o.name}</div>
                    <div className="text-xs text-gray-500">{o.address || 'No address'} · {o.phone || '—'}</div>
                  </div>
                  <div className="text-xs font-bold text-accent">{o.parcel_count} parcels</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Parcels */}
      <div className="glass-card bg-white/60 p-5 border border-white/60">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-primary text-sm uppercase tracking-wide flex items-center gap-2"><Package size={16} /> Recent Parcels</h2>
          {company.recent_parcels?.length > 0 && (
            <select value={parcelFilter} onChange={e => setParcelFilter(e.target.value)} className="text-xs bg-white/70 border border-gray-200 rounded-lg px-2 py-1 text-gray-600">
              <option value="">All status</option>
              <option value="created">Created</option>
              <option value="dispatched">Dispatched</option>
              <option value="arrived">Arrived</option>
              <option value="picked_up">Picked up</option>
              <option value="pending_payment">Pending payment</option>
            </select>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 font-bold uppercase tracking-wider border-b border-gray-100">
              <th className="pb-2 text-left">Tracking</th><th className="pb-2 text-left">Status</th><th className="pb-2 text-left">Fee</th><th className="pb-2 text-left">Payment</th><th className="pb-2 text-left">Date</th>
            </tr></thead>
            <tbody>
              {company.recent_parcels?.length === 0 ? (
                <tr><td colSpan={5} className="py-6 text-center text-gray-400 text-sm">No parcels yet</td></tr>
              ) : company.recent_parcels?.filter(p => !parcelFilter || p.status === parcelFilter).map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="py-2 font-mono font-bold text-primary text-xs">{p.tracking_id || p.parcel_id || 'PENDING'}</td>
                  <td className="py-2"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.status === 'created' ? 'bg-blue-100 text-blue-700' : p.status === 'dispatched' ? 'bg-amber-100 text-amber-700' : p.status === 'arrived' ? 'bg-green-100 text-green-700' : p.status === 'picked_up' ? 'bg-emerald-100 text-emerald-700' : p.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700' }`}>{p.status?.replace('_', ' ')}</span></td>
                  <td className="py-2 font-semibold">KES {p.fee_paid || 0}</td>
                  <td className="py-2 text-gray-500 text-xs">{p.payment_method || '—'}</td>
                  <td className="py-2 text-gray-500 text-xs">{new Date(p.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Activity */}
      <div className="glass-card bg-white/60 p-5 border border-white/60">
        <h2 className="font-black text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><Activity size={16} /> Recent Activity</h2>
        {company.recent_activity?.length === 0 ? <p className="text-gray-400 text-sm">No activity yet</p> : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {company.recent_activity?.map(a => (
              <div key={a.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-primary">{a.action?.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-gray-500 truncate">{a.user_name || 'System'} · {new Date(a.created_at).toLocaleString()}</div>
                  {a.details && <div className="text-xs text-gray-400 mt-0.5 truncate">{typeof a.details === 'string' ? a.details : JSON.stringify(a.details)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {resetConfig && (
        <ResetPasswordForm
          email={resetConfig.email}
          onCancel={() => setResetConfig(null)}
          onSave={async (password, wipeData) => {
            const { data } = await api.put(`/admin/companies/${id}/users/${resetConfig.id}/reset-password`, { password, wipeData });
            toast.success(data.message);
            setResetConfig(null);
            fetchCompany();
          }}
        />
      )}
    </div>
  );
}
