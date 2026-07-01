import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Package } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatusBadge({ status }) {
    return <span className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full badge-${status} uppercase tracking-wide`}>{status?.replace('_', ' ')}</span>;
}

export default function CompanyParcels() {
    const [parcels, setParcels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({ status: '', office_id: '' });
    const [offices, setOffices] = useState([]);

    const fetchParcels = () => {
        const params = new URLSearchParams();
        if (filters.status) params.set('status', filters.status);
        if (filters.office_id) params.set('office_id', filters.office_id);
        setLoading(true);
        api.get(`/company/parcels?${params}`).then(r => setParcels(r.data.parcels || [])).catch(() => { }).finally(() => setLoading(false));
    };

    useEffect(() => {
        api.get('/company/offices').then(r => setOffices(r.data));
        fetchParcels();
    }, []);

    useEffect(() => { fetchParcels(); }, [filters]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="glass-card p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 border-l-4 border-accent shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Package size={24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-primary drop-shadow-sm">All Parcels</h1>
                        <p className="text-sm font-medium text-gray-500">Track and manage packages across your network</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
                    <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
                        className="bg-white/70 border border-white/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent flex-1 w-full lg:w-auto shadow-sm transition-all hover:bg-white cursor-pointer">
                        <option value="">Status: All</option>
                        {['pending_payment', 'payment_failed', 'created', 'dispatched', 'arrived', 'picked_up'].map(s => (
                            <option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</option>
                        ))}
                    </select>
                    <select value={filters.office_id} onChange={e => setFilters(f => ({ ...f, office_id: e.target.value }))}
                        className="bg-white/70 border border-white/60 rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 focus:outline-none focus:ring-2 focus:ring-accent flex-1 w-full lg:w-auto shadow-sm transition-all hover:bg-white cursor-pointer">
                        <option value="">Office: All</option>
                        {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                </div>
            </div>

            <div className="glass-card p-0 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-200/50">
                            <tr>{['Tracking ID', 'Sender', 'Receiver', 'Route', 'Fee', 'Status', 'Date', ''].map(h =>
                                <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                            )}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50">
                            {loading ? <tr><td colSpan={8} className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">Loading data...</td></tr>
                                : parcels.length === 0 ? <tr><td colSpan={8} className="py-12 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">No parcels found</td></tr>
                                    : parcels.map(p => (
                                        <tr key={p.id} className="hover:bg-white/60 transition-colors group">
                                            <td className="px-6 py-4 font-mono text-sm font-black text-primary group-hover:text-accent transition-colors">{p.tracking_id || '—'}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-700">{p.sender_name}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-700">{p.receiver_name}</td>
                                            <td className="px-6 py-4 text-xs font-medium text-gray-500">
                                                <span>{p.sending_office_name}</span> <span className="text-accent mx-1">→</span> <span>{p.receiving_office_name}</span>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-emerald-600">KES {p.fee_paid}</td>
                                            <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                                            <td className="px-6 py-4 text-gray-400 text-xs font-medium">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</td>
                                            <td className="px-6 py-4">
                                                <Link to={`/parcel/${p.id}`} className="text-accent text-xs font-bold hover:underline bg-white/50 px-3 py-1.5 rounded-lg border border-white/50 shadow-sm hover:shadow hover:bg-white transition-all">View</Link>
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
