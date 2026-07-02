import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Search, RefreshCw, Building2, CheckCircle, XCircle, ChevronDown, Clock } from 'lucide-react';

const STATUS_MAP = {
  trialing: 'bg-yellow-100/80 text-yellow-800',
  active: 'bg-emerald-100/80 text-emerald-700',
  expired: 'bg-red-100/80 text-red-700',
  suspended: 'bg-gray-200/80 text-gray-600',
};

const SORT_OPTIONS = [
  { key: 'registered_at', label: 'Registered' },
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'parcels', label: 'Parcels' },
  { key: 'trial_end', label: 'Trial End' },
];

function StatusBadge({ status }) {
  return <span className={`text-xs font-normal px-2.5 py-1 rounded-full uppercase tracking-wide ${STATUS_MAP[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>;
}

function TrialDays({ endDate }) {
  if (!endDate) return <span className="text-gray-400">—</span>;
  const days = Math.ceil((new Date(endDate) - new Date()) / (1000 * 60 * 60 * 24));
  const cls = days > 14 ? 'text-emerald-600' : days > 7 ? 'text-amber-600' : days > 0 ? 'text-red-500' : 'text-gray-400';
  return <span className={`font-normal ${cls}`}>{days > 0 ? `${days}d` : 'Expired'}</span>;
}

export default function AdminCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('registered_at');
  const [order, setOrder] = useState('DESC');

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const params = { sort, order };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/admin/companies', { params });
      setCompanies(data);
    } catch { toast.error('Failed to load companies'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchCompanies(); }, [sort, order, statusFilter]);

  const approve = async (id, name) => {
    if (!confirm(`Approve ${name}?`)) return;
    try { await api.put(`/admin/companies/${id}/approve`); toast.success('Approved!'); fetchCompanies(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const suspend = async (id, name) => {
    if (!confirm(`Suspend ${name}?`)) return;
    try { await api.put(`/admin/companies/${id}/suspend`); toast.success('Suspended'); fetchCompanies(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const deleteCompany = async (id, name) => {
    if (!confirm(`Are you absolutely sure you want to PERMANENTLY delete ${name}? This will wipe all their data, parcels, and users.`)) return;
    try { await api.delete(`/admin/companies/${id}`); toast.success('Company deleted successfully'); fetchCompanies(); }
    catch (err) { toast.error(err.response?.data?.message || 'Failed to delete company'); }
  };

  const toggleSort = (key) => {
    if (sort === key) setOrder(o => o === 'DESC' ? 'ASC' : 'DESC');
    else { setSort(key); setOrder('DESC'); }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-primary mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Building2 size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-base sm:text-base font-semibold text-primary">Client Companies</h1>
            <p className="text-sm font-normal text-gray-500">{companies.length} registered tenants</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full pl-9 pr-3 py-2 bg-white/70 border border-white/60 rounded-xl text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary transition-all focus:bg-white placeholder-gray-400"
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All status</option>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="suspended">Suspended</option>
          </select>
          <button onClick={fetchCompanies} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl shrink-0 btn-base btn-secondary" title="Refresh">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-200/50">
              <tr>
                {[
                  { key: 'name', label: 'Company' },
                  { key: null, label: 'Approved' },
                  { key: 'status', label: 'Status' },
                  { key: null, label: 'Plan' },
                  { key: null, label: 'M-Pesa' },
                  { key: null, label: 'Staff' },
                  { key: null, label: 'Offices' },
                  { key: 'parcels', label: 'Parcels' },
                  { key: 'trial_end', label: 'Trial' },
                  { key: 'registered_at', label: 'Registered' },
                  { key: null, label: 'Actions' },
                ].map(({ key, label }) => (
                  <th key={label} className={`px-4 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider ${key ? 'cursor-pointer hover:text-primary' : ''}`}
                    onClick={() => key && toggleSort(key)}>
                    <span className="flex items-center gap-1">{label}{key && sort === key && <ChevronDown size={12} className={`transition-transform ${order === 'ASC' ? 'rotate-180' : ''}`} />}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {loading ? (
                <tr><td colSpan={12} className="py-12 text-center font-normal uppercase tracking-widest text-xs text-gray-400">Loading...</td></tr>
              ) : companies.length === 0 ? (
                <tr><td colSpan={12} className="py-12 text-center font-normal uppercase tracking-widest text-xs text-gray-400">No companies found</td></tr>
              ) : companies.map(c => (
                <tr key={c.id} className="hover:bg-white/60 transition-colors group">
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/admin/companies/${c.id}`)}
                      className="font-normal text-primary text-base hover:text-accent transition-colors text-left">
                      {c.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {c.approved
                      ? <span className="flex items-center gap-1 text-emerald-600 font-normal text-xs"><CheckCircle size={12} /> Yes</span>
                      : <span className="flex items-center gap-1 text-red-500 font-normal text-xs"><XCircle size={12} /> Pending</span>}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={c.subscription_status} /></td>
                  <td className="px-4 py-3 font-normal text-gray-600 text-xs">{c.subscription_plan || '—'}</td>
                  <td className="px-4 py-3">
                    {c.mpesa_configured
                      ? <span className="text-emerald-500 font-normal text-sm leading-none">✓</span>
                      : <span className="text-red-300 font-normal text-sm leading-none">✗</span>}
                  </td>
                  <td className="px-4 py-3 font-normal text-gray-700">{c.staff_count}</td>
                  <td className="px-4 py-3 font-normal text-gray-700">{c.office_count}</td>
                  <td className="px-4 py-3 font-normal text-gray-700">{c.parcel_count}</td>
                  <td className="px-4 py-3"><TrialDays endDate={c.trial_end_date} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(c.registered_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => navigate(`/admin/companies/${c.id}`)}
                        className="bg-white/50 border border-white/50 hover:bg-white transition-all px-2.5 py-1.5 rounded-lg text-accent hover:text-primary text-xs font-normal">
                        View
                      </button>
                      {!c.approved &&
                        <button onClick={() => approve(c.id, c.name)}
                          className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 transition-all px-2.5 py-1.5 rounded-lg text-emerald-700 text-xs font-normal">
                          Approve
                        </button>}
                      {c.approved && c.subscription_status !== 'suspended' &&
                        <button onClick={() => suspend(c.id, c.name)}
                          className="bg-red-50 hover:bg-red-100 border border-red-100 transition-all px-2.5 py-1.5 rounded-lg text-red-600 text-xs font-normal">
                          Suspend
                        </button>}
                      <button onClick={() => deleteCompany(c.id, c.name)}
                        className="bg-gray-100 hover:bg-gray-200 border border-gray-200 transition-all px-2.5 py-1.5 rounded-lg text-gray-700 text-xs font-normal">
                        Delete
                      </button>
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
