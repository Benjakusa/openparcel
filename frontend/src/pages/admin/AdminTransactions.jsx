import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowLeftRight, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

const TX_STATUS_MAP = {
  success: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-red-100 text-red-700',
  pending: 'bg-amber-100 text-amber-700',
};

export default function AdminTransactions() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTxs = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const { data } = await api.get('/admin/transactions', { params });
      setTxs(data);
    } catch { toast.error('Failed to load transactions'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTxs(); }, [page, typeFilter, statusFilter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-primary">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center"><ArrowLeftRight size={24} className="text-indigo-600" /></div>
          <div>
            <h1 className="text-base font-semibold text-primary">Transactions</h1>
            <p className="text-sm font-normal text-gray-500">All M-Pesa payment events across the platform</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
            className="bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All types</option>
            <option value="subscription">Subscription</option>
            <option value="parcel">Parcel fee</option>
          </select>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-white/70 border border-white/60 rounded-xl px-3 py-2 text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="">All status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <button onClick={fetchTxs} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl btn-base btn-secondary">
            <RefreshCw size={18} />
          </button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50/50 border-b border-gray-200/50">
              <tr>
                {['Type', 'Company', 'Amount', 'Status', 'Receipt', 'Reference', 'Date'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-normal text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100/50">
              {loading ? (
                <tr><td colSpan={7} className="py-12 text-center font-normal uppercase tracking-widest text-xs text-gray-400">Loading...</td></tr>
              ) : txs.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center font-normal uppercase tracking-widest text-xs text-gray-400">No transactions found</td></tr>
              ) : txs.map((tx, i) => (
                <tr key={`${tx.tx_type}-${tx.id}-${i}`} className="hover:bg-white/60 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${tx.tx_type === 'subscription' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {tx.tx_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-normal text-primary">{tx.company_name || '—'}</td>
                  <td className="px-4 py-3 font-normal">KES {parseFloat(tx.amount || 0).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${TX_STATUS_MAP[tx.status] || 'bg-gray-100 text-gray-600'}`}>{tx.status}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.mpesa_receipt_number || '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{tx.ref || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
