import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Link } from 'react-router-dom';
import { Package, Plus, ScanLine, Clock, CheckCircle2 } from 'lucide-react';

function StatusBadge({ status }) {
    return <span className={`text-xs font-bold px-3 py-1 rounded-full badge-${status}`}>{status?.replace('_', ' ').toUpperCase()}</span>;
}

export default function OfficeDashboard() {
    const [profile, setProfile] = useState(null);
    const [parcels, setParcels] = useState([]);
    const [stats, setStats] = useState({ pending_dispatch: 0, in_transit_inbound: 0, ready_for_collection: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = api.get('/office/profile')
            .then(r => setProfile(r.data))
            .catch(() => setProfile({ name: 'No Office Assigned', address: 'Contact Admin' }));

        const fetchParcels = api.get('/office/parcels?limit=20')
            .then(r => setParcels(r.data))
            .catch(() => setParcels([]));

        const fetchStats = api.get('/office/stats')
            .then(r => setStats(r.data))
            .catch(() => setStats(null));

        Promise.all([fetchProfile, fetchParcels, fetchStats]).finally(() => setLoading(false));
    }, []);

    const pending = parcels.filter(p => p.status === 'created' && p.sending_office_id === profile?.id);
    const arriving = parcels.filter(p => p.status === 'dispatched' && p.receiving_office_id === profile?.id);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
            {/* Office header */}
            <div className="glass-card bg-accent-gradient p-6 sm:p-8 text-white overflow-hidden">
                <div className="relative z-10">
                    <div className="text-xs text-blue-100 font-bold uppercase tracking-widest mb-1 opacity-80">Your Office</div>
                    <div className="text-xl sm:text-2xl font-black mb-1">{profile?.name || 'Loading...'}</div>
                    <div className="text-blue-100 font-medium text-xs sm:text-sm">{profile?.address || ''}</div>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4">
                <div className="glass-card p-3 sm:p-4 text-center border-b-4 border-amber-400">
                    <div className="text-lg sm:text-xl font-black text-amber-500 mb-0.5">{stats?.pending_dispatch || 0}</div>
                    <div className="text-[10px] sm:text-xs font-semibold text-gray-500 whitespace-nowrap">To Dispatch</div>
                </div>
                <div className="glass-card p-3 sm:p-4 text-center border-b-4 border-sky-400">
                    <div className="text-lg sm:text-xl font-black text-sky-500 mb-0.5">{stats?.in_transit_inbound || 0}</div>
                    <div className="text-[10px] sm:text-xs font-semibold text-gray-500 whitespace-nowrap">Incoming</div>
                </div>
                <div className="glass-card p-3 sm:p-4 text-center border-b-4 border-purple-400">
                    <div className="text-lg sm:text-xl font-black text-purple-500 mb-0.5">{stats?.ready_for_collection || 0}</div>
                    <div className="text-[10px] sm:text-xs font-semibold text-gray-500 whitespace-nowrap">To Collect</div>
                </div>
            </div>

            {/* Quick actions grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Link to="/office/create-parcel" className="glass-card bg-white/50 border-white/60 p-5 flex flex-col items-center gap-3 hover:-translate-y-1 transition-all group">
                    <div className="bg-primary/5 p-3 rounded-2xl group-hover:scale-110 group-hover:bg-primary/10 transition-all">
                        <Plus size={24} className="text-primary" />
                    </div>
                    <span className="font-bold text-xs text-primary text-center">New Parcel</span>
                </Link>
                <Link to="/scan?mode=dispatch" className="glass-card bg-amber-50 border-amber-100 p-5 flex flex-col items-center gap-3 hover:-translate-y-1 transition-all group">
                    <div className="bg-amber-100 p-3 rounded-2xl group-hover:scale-110 transition-all">
                        <ScanLine size={24} className="text-amber-600" />
                    </div>
                    <span className="font-bold text-xs text-amber-800 text-center">Scan to Dispatch</span>
                </Link>
                <Link to="/scan?mode=receive" className="glass-card bg-sky-50 border-sky-100 p-5 flex flex-col items-center gap-3 hover:-translate-y-1 transition-all group">
                    <div className="bg-sky-100 p-3 rounded-2xl group-hover:scale-110 transition-all">
                        <ScanLine size={24} className="text-sky-600" />
                    </div>
                    <span className="font-bold text-xs text-sky-800 text-center">Scan to Receive</span>
                </Link>
                <Link to="/scan?mode=collect" className="glass-card bg-purple-50 border-purple-100 p-5 flex flex-col items-center gap-3 hover:-translate-y-1 transition-all group">
                    <div className="bg-purple-100 p-3 rounded-2xl group-hover:scale-110 transition-all">
                        <Package size={24} className="text-purple-600" />
                    </div>
                    <span className="font-bold text-xs text-purple-800 text-center">Parcel Collection</span>
                </Link>
            </div>

            {/* Pending dispatch */}
            {pending.length > 0 && (
                <div className="glass-card border-l-4 border-amber-400 p-6">
                    <h2 className="font-black text-primary mb-5 flex items-center gap-2 text-lg">
                        <Clock size={20} className="text-amber-500" /> Ready to Dispatch ({pending.length})
                    </h2>
                    <div className="grid gap-3">
                        {pending.map(p => (
                            <div key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all gap-4">
                                <div>
                                    <span className="font-mono font-black text-primary text-base inline-block mb-1">{p.tracking_id}</span>
                                    <div className="text-gray-500 font-medium flex items-center gap-1">
                                        Dest: <span className="text-primary font-semibold truncate">{p.receiving_office_name}</span>
                                    </div>
                                </div>
                                <Link to={`/scan?mode=dispatch&id=${p.tracking_id}`} className="w-full sm:w-auto text-center bg-accent text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-secondary transition-colors shadow">
                                    Scan to Dispatch
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Arriving parcels */}
            {arriving.length > 0 && (
                <div className="glass-card border-l-4 border-sky-400 p-6">
                    <h2 className="font-black text-primary mb-5 flex items-center gap-2 text-lg">
                        <CheckCircle2 size={20} className="text-sky-500" /> Incoming Parcels ({arriving.length})
                    </h2>
                    <div className="grid gap-3">
                        {arriving.map(p => (
                            <div key={p.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm bg-gray-50 p-4 rounded-2xl border border-gray-100 hover:border-gray-200 transition-all gap-4">
                                <div>
                                    <span className="font-mono font-black text-primary text-base inline-block mb-1">{p.tracking_id}</span>
                                    <div className="text-gray-500 font-medium flex items-center gap-1">
                                        From: <span className="text-primary font-semibold truncate">{p.sending_office_name}</span>
                                    </div>
                                </div>
                                <Link to={`/scan?mode=receive&id=${p.tracking_id}`} className="w-full sm:w-auto text-center bg-sky-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-sky-600 transition-colors shadow">
                                    Scan to Receive
                                </Link>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent parcels */}
            <div className="glass-card p-0 overflow-hidden">
                <div className="flex items-center justify-between p-6 border-b border-gray-200/50">
                    <h2 className="text-lg font-black text-primary flex items-center gap-2"><Package size={20} className="text-accent" /> Recent Parcels</h2>
                    <Link to="/office/parcels" className="text-accent text-sm font-bold hover:underline">View all</Link>
                </div>
                <div className="p-2 sm:p-4">
                    {loading ? <div className="text-center py-8 text-gray-400 font-medium">Loading activity...</div>
                        : parcels.length === 0 ? <div className="text-center py-8 text-gray-400 font-medium">No parcels registered yet.</div>
                            : <div className="space-y-1 sm:space-y-2">
                                {parcels.slice(0, 5).map(p => (
                                    <Link to={`/parcel/${p.id}`} key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-transparent hover:border-white/60 hover:bg-white/40 transition-all gap-3 group">
                                        <div>
                                            <div className="font-mono text-sm font-black text-primary mb-1 group-hover:text-accent transition-colors">{p.tracking_id || 'PENDING'}</div>
                                            <div className="text-sm text-gray-500 font-medium">
                                                <span className="text-primary font-semibold">{p.receiver_name}</span> · KES {p.fee_paid}
                                            </div>
                                        </div>
                                        <div>
                                            <StatusBadge status={p.status} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                    }
                </div>
            </div>
        </div>
    );
}
