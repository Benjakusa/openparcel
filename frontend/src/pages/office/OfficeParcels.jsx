import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Link } from 'react-router-dom';
import { RefreshCw, Package } from 'lucide-react';

function StatusBadge({ status }) {
    return <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full badge-${status} uppercase tracking-wide`}>{status?.replace('_', ' ')}</span>;
}

export default function OfficeParcels() {
    const [parcels, setParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [refreshing, setRefreshing] = useState(false);

    const fetchParcels = () => {
        setLoading(true);
        const params = status ? `?status=${status}&limit=50` : '?limit=50';
        api.get(`/office/parcels${params}`)
            .then(r => setParcels(r.data))
            .catch(() => { })
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => {
        fetchParcels();
        const int = setInterval(fetchParcels, 30000);
        return () => clearInterval(int);
    }, [status]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
            <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-accent shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                        <Package size={20} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-primary drop-shadow-sm">Office Parcels</h1>
                        <p className="text-sm font-medium text-gray-500">Manage and track your recent shipments</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <select value={status} onChange={e => setStatus(e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent flex-1 sm:flex-none shadow-sm transition-all cursor-pointer">
                        <option value="">Status: All</option>
                        {['pending_payment', 'payment_failed', 'created', 'dispatched', 'arrived', 'picked_up'].map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                        ))}
                    </select>
                    <button onClick={() => { setRefreshing(true); fetchParcels(); }} className="w-10 h-10 glass-card flex items-center justify-center rounded-xl text-gray-500 hover:text-accent hover:shadow-md transition-all shrink-0" title="Refresh">
                        <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {loading ? <div className="glass-card p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">Loading Parcels...</div>
                    : parcels.length === 0 ? <div className="glass-card p-12 text-center text-gray-400 font-bold uppercase tracking-widest text-sm">No parcels found</div>
                        : parcels.map(p => (
                            <Link to={`/parcel/${p.id}`} key={p.id} className="glass-card p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-md transition-all flex flex-col sm:flex-row gap-3 sm:gap-6 justify-between items-start sm:items-center group">
                                <div className="space-y-1 w-full sm:w-auto">
                                    <div className="flex items-center justify-between sm:justify-start gap-3">
                                        <span className="font-mono font-black text-primary text-base sm:text-lg group-hover:text-accent transition-colors">{p.tracking_id || 'PENDING'}</span>
                                        <div className="sm:hidden"><StatusBadge status={p.status} /></div>
                                    </div>
                                    <div className="text-sm font-semibold text-gray-700 flex items-center gap-1.5 flex-wrap">
                                        <span>{p.sender_name}</span>
                                        <span className="text-accent text-xs">→</span>
                                        <span>{p.receiver_name}</span>
                                    </div>
                                    <div className="text-xs font-medium text-gray-500 flex flex-wrap items-center gap-2">
                                        <span>{p.sending_office_name} <span className="opacity-50 mx-1">/</span> {p.receiving_office_name}</span>
                                        <span className="opacity-50 hidden sm:inline">•</span>
                                        <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">KES {p.fee_paid}</span>
                                    </div>
                                </div>
                                <div className="flex w-full sm:w-auto sm:flex-col items-center sm:items-end justify-between grow-0 shrink-0 gap-2 border-t sm:border-0 border-gray-100 pt-3 sm:pt-0 mt-1 sm:mt-0">
                                    <div className="hidden sm:block"><StatusBadge status={p.status} /></div>
                                    <div className="text-xs font-semibold text-gray-400">{new Date(p.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</div>
                                </div>
                            </Link>
                        ))}
            </div>
        </div>
    );
}
