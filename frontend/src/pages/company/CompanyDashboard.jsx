import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Package, Building2, Users, DollarSign, AlertCircle, Clock, RefreshCw, Banknote, Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, accentColor, sub }) {
    return (
        <div className="glass-card p-6 hover:-translate-y-1 transition-all group">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 shadow-inner ${accentColor}`}>
                <Icon size={22} className="text-white drop-shadow-sm" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-primary drop-shadow-sm">{value}</div>
            <div className="text-xs sm:text-sm font-medium text-gray-500 mt-1">{label}</div>
            {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
        </div>
    );
}

export default function CompanyDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchDashboard = () => {
        api.get('/company/dashboard')
            .then(r => setData(r.data))
            .catch(() => { })
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => {
        fetchDashboard();
        const int = setInterval(fetchDashboard, 30000);
        return () => clearInterval(int);
    }, []);

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-4 border-accent border-t-transparent" /></div>;

    const company = data?.company;
    const trialEnd = company?.trial_end_date ? new Date(company.trial_end_date) : null;
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))) : 0;
    const isTrialing = company?.subscription_status === 'trialing';
    const isExpired = company?.subscription_status === 'expired';

    return (
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            {/* Banner */}
            {isExpired && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
                    <AlertCircle className="text-red-500" size={24} />
                    <div>
                        <div className="font-bold text-red-800 text-lg">Subscription Expired</div>
                        <div className="text-sm text-red-600 font-medium">Your trial has ended.
                            <Link to="/company/subscription" className="ml-1 underline font-bold hover:text-red-500 transition-colors">Buy a plan to continue.</Link>
                        </div>
                    </div>
                </div>
            )}
            {isTrialing && daysLeft <= 5 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 flex items-center gap-3">
                    <Clock className="text-yellow-600" size={24} />
                    <div>
                        <div className="font-bold text-yellow-800 text-lg">Trial ends in {daysLeft} day(s)</div>
                        <div className="text-sm text-yellow-700 font-medium">
                            <Link to="/company/subscription" className="underline font-bold hover:text-yellow-500 transition-colors">Upgrade now</Link> to avoid interruption.
                        </div>
                    </div>
                </div>
            )}

            <div className="glass-card p-5 sm:p-6 border-l-4 border-accent">
                <h1 className="text-xl sm:text-2xl font-black text-primary drop-shadow-sm mb-1">{company?.name}</h1>
                <p className="text-gray-500 font-medium text-xs sm:text-sm">
                    {isTrialing ? `Free trial – ${daysLeft} days left` : `Plan: ${company?.subscription_plan || 'None'} · Status: ${company?.subscription_status}`}
                </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                <StatCard icon={Building2} label="Offices" value={data?.offices ?? 0} accentColor="bg-primary" />
                <StatCard icon={Users} label="Staff Members" value={data?.staff ?? 0} accentColor="bg-slate-700" />
                <StatCard icon={Package} label="Total Parcels" value={data?.total_parcels ?? 0} accentColor="bg-accent" />
                <StatCard icon={DollarSign} label="Total Revenue (KES)" value={(data?.revenue_total ?? 0).toLocaleString()} accentColor="bg-indigo-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <StatCard icon={Banknote} label="Cash Revenue" value={(data?.revenue_cash ?? 0).toLocaleString()} accentColor="bg-emerald-500" />
                <StatCard icon={Smartphone} label="M-Pesa Revenue" value={(data?.revenue_mpesa ?? 0).toLocaleString()} accentColor="bg-sky-500" />
            </div>

            {/* Status breakdown */}
            {data?.parcels_by_status && (
                <div className="glass-card p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-black text-primary">Parcel Status Breakdown</h2>
                        <button onClick={() => { setRefreshing(true); fetchDashboard(); }} className="p-2 text-gray-400 hover:text-accent bg-white/50 rounded-xl shadow-sm hover:shadow transition-all" title="Refresh Breakdown">
                            <RefreshCw size={18} className={refreshing ? 'animate-spin text-accent' : ''} />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {Object.entries(data.parcels_by_status).map(([status, count]) => (
                            <div key={status} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                                <div className={`text-xs font-bold px-3 py-1 rounded-full inline-block mb-3 badge-${status}`}>{status.replace('_', ' ').toUpperCase()}</div>
                                <div className="text-xl sm:text-2xl font-black text-primary">{count}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Daily Revenue */}
            {data?.daily_revenue && data.daily_revenue.length > 0 && (
                <div className="glass-card p-0 overflow-hidden">
                    <div className="p-6 border-b border-gray-200/50">
                        <h2 className="text-lg font-black text-primary">Daily Revenue (Last 30 Days)</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50/50 text-left text-xs text-gray-500 uppercase tracking-wider">
                                    <th className="px-6 py-4 font-bold">Date</th>
                                    <th className="px-6 py-4 font-bold">Cash</th>
                                    <th className="px-6 py-4 font-bold">M-Pesa</th>
                                    <th className="px-6 py-4 font-bold text-primary">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100/50">
                                {(() => {
                                    const grouped = {};
                                    for (const r of data.daily_revenue) {
                                        if (!grouped[r.day]) grouped[r.day] = { day: r.day, cash: 0, mpesa: 0 };
                                        if (r.payment_method === 'cash') grouped[r.day].cash += parseFloat(r.total);
                                        else grouped[r.day].mpesa += parseFloat(r.total);
                                    }
                                    return Object.values(grouped).sort((a, b) => b.day.localeCompare(a.day)).map(d => (
                                        <tr key={d.day} className="hover:bg-white/60 transition-colors">
                                            <td className="px-6 py-4 text-gray-700 font-semibold">{new Date(d.day + 'T00:00:00').toLocaleDateString()}</td>
                                            <td className="px-6 py-4 text-emerald-600 font-medium">KES {d.cash.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-sky-600 font-medium">KES {d.mpesa.toLocaleString()}</td>
                                            <td className="px-6 py-4 font-black text-primary">KES {(d.cash + d.mpesa).toLocaleString()}</td>
                                        </tr>
                                    ));
                                })()}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Per-Office Performance & Lookup */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">

                {/* Parcel Lookup Widget */}
                <div className="glass-card p-6 border-t-4 border-accent flex flex-col justify-center">
                    <h2 className="text-lg font-black text-primary mb-2 flex items-center gap-2"><Package size={20} className="text-heading" /> Global Lookup</h2>
                    <p className="text-xs text-gray-500 font-medium mb-4">Directly view the lifecycle details of any parcel bypassing office scope.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const val = e.target.elements.tracking.value.trim();
                        if (val) window.location.href = `/parcel/${val}`;
                    }}>
                        <input name="tracking" placeholder="Enter Tracking ID..." className="w-full bg-white/60 border border-gray-200 rounded-xl px-4 py-3 font-mono font-bold text-sm text-primary mb-3 focus:border-accent focus:ring focus:ring-accent/20 transition-all font-bold" />
                        <button type="submit" className="w-full bg-primary text-white font-bold text-sm py-3 rounded-xl hover:bg-secondary transition-all shadow shadow-primary/20">Track Parcel</button>
                    </form>
                </div>

                {/* Performance Table */}
                {data?.per_office_performance && (
                    <div className="glass-card p-0 overflow-hidden lg:col-span-2">
                        <div className="p-6 border-b border-gray-200/50">
                            <h2 className="text-lg font-black text-primary">Office Performance Breakdown</h2>
                        </div>
                        <div className="overflow-x-auto max-h-64">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-gray-50 z-10 border-b border-gray-200">
                                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="px-6 py-3 font-bold">Office Name</th>
                                        <th className="px-6 py-3 font-bold">Parcels Dispatched</th>
                                        <th className="px-6 py-3 font-bold text-emerald-600">Successfully Delivered</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100/50">
                                    {data.per_office_performance.map(o => (
                                        <tr key={o.id} className="hover:bg-white/60 transition-colors">
                                            <td className="px-6 py-4 font-bold text-primary">{o.name}</td>
                                            <td className="px-6 py-4 font-semibold text-gray-700">{o.total_dispatched}</td>
                                            <td className="px-6 py-4 font-black text-emerald-600">{o.successfully_delivered}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
