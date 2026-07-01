import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Activity, RefreshCw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTIONS = [
  'CREATED_PARCEL', 'SCANNED_PARCEL', 'RETRY_PAYMENT', 'RESENT_WHATSAPP',
  'CREATED_OFFICE', 'UPDATED_OFFICE', 'INVITED_STAFF', 'UPDATED_MPESA',
];

const ACTION_COLORS = {
  CREATED_PARCEL: 'bg-blue-100 text-blue-700',
  SCANNED_PARCEL: 'bg-amber-100 text-amber-700',
  RETRY_PAYMENT: 'bg-red-100 text-red-700',
  RESENT_WHATSAPP: 'bg-green-100 text-green-700',
  CREATED_OFFICE: 'bg-purple-100 text-purple-700',
  UPDATED_OFFICE: 'bg-indigo-100 text-indigo-700',
  INVITED_STAFF: 'bg-teal-100 text-teal-700',
  UPDATED_MPESA: 'bg-cyan-100 text-cyan-700',
};

export default function AdminActivity() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (actionFilter) params.action = actionFilter;
      const { data } = await api.get('/admin/activity', { params });
      setLogs(data);
    } catch { toast.error('Failed to load activity'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page, actionFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-primary">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center"><Activity size={24} className="text-purple-600" /></div>
          <div>
            <h1 className="text-2xl font-black text-primary">Platform Activity</h1>
            <p className="text-sm font-medium text-gray-500">Audit trail across all tenants</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
            className="bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <button onClick={fetchLogs} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl text-gray-500 hover:text-primary transition-all">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="glass-card p-0 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center font-bold uppercase tracking-widest text-xs text-gray-400">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center font-bold uppercase tracking-widest text-xs text-gray-400">No activity found</div>
        ) : (
          <div className="divide-y divide-gray-100/50">
            {logs.map(log => (
              <div key={log.id} className="px-6 py-4 hover:bg-white/60 transition-colors">
                <div className="flex items-start gap-4">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-600'}`}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="text-sm font-medium text-primary">
                      {log.company_name || 'Unknown Company'}
                      {log.user_name && <span className="text-gray-500 font-normal"> · by {log.user_name}</span>}
                    </div>
                    {log.details && (
                      <div className="mt-0.5 text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded inline-block">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Page {page}</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/70 border border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm disabled:opacity-40 transition-all">
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setPage(p => p + 1)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/70 border border-gray-200 text-gray-600 hover:bg-white hover:shadow-sm transition-all">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
