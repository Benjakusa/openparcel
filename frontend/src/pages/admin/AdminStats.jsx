import { useEffect, useState } from 'react';
import api from '../../api/client';
import { Building2, Clock, CheckCircle2, Package, DollarSign, Users, BarChart3, TrendingUp } from 'lucide-react';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="glass-card p-5 hover:-translate-y-1 transition-all group">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="text-sm sm:text-sm font-normal text-primary">{value?.toLocaleString() ?? '—'}</div>
      <div className="text-xs sm:text-sm font-normal text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function BarChart({ data, valueKey, color, height = 120 }) {
  if (!data || data.length === 0) return <div className="text-gray-400 text-sm text-center py-8">No data</div>;
  const max = Math.max(...data.map(d => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => {
        const h = (Number(d[valueKey]) / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center group relative">
            <div className="absolute bottom-full mb-1 text-xs font-normal text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-0.5 rounded whitespace-nowrap">
              {Number(d[valueKey]).toLocaleString()}
            </div>
            <div className="w-full rounded-t-sm transition-all hover:opacity-80" style={{ height: `${h}%`, backgroundColor: color, minHeight: d[valueKey] > 0 ? 4 : 0 }} />
            {data.length <= 31 && <span className="text-[8px] text-gray-400 mt-1 rotate-45 origin-left whitespace-nowrap">{d.day ? new Date(d.day).getDate() : ''}</span>}
          </div>
        );
      })}
    </div>
  );
}

function DonutChart({ segments, size = 140 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = size / 2;
  const circumference = 2 * Math.PI * radius * 0.7;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle cx={radius} cy={radius} r={radius * 0.7} fill="none" stroke="#f0f0f0" strokeWidth={radius * 0.3} />
        {segments.filter(s => s.value > 0).map((seg, i) => {
          const len = (seg.value / total) * circumference;
          const dash = `${len} ${circumference - len}`;
          const s = offset;
          offset += len;
          return <circle key={i} cx={radius} cy={radius} r={radius * 0.7} fill="none" stroke={seg.color} strokeWidth={radius * 0.3} strokeDasharray={dash} strokeDashoffset={-s} />;
        })}
      </svg>
      <div className="space-y-1.5">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: seg.color }} />
            <span className="text-gray-600">{seg.label}</span>
            <span className="font-normal text-primary">{Math.round((seg.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const PERIODS = [7, 30, 90];

export default function AdminStats() {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState(30);
  const [revenueData, setRevenueData] = useState([]);
  const [parcelData, setParcelData] = useState([]);
  const [clientData, setClientData] = useState([]);
  const [topClients, setTopClients] = useState([]);

  useEffect(() => {
    api.get('/admin/stats').then(r => setStats(r.data)).catch(() => { });
  }, []);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats/revenue', { params: { days: period } }).then(r => setRevenueData(r.data)).catch(() => { }),
      api.get('/admin/stats/parcels', { params: { days: period } }).then(r => setParcelData(r.data)).catch(() => { }),
      api.get('/admin/stats/clients', { params: { days: period } }).then(r => setClientData(r.data)).catch(() => { }),
      api.get('/admin/stats/top-clients').then(r => setTopClients(r.data)).catch(() => { }),
    ]);
  }, [period]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="glass-card bg-accent-gradient p-6 sm:p-8 text-white mb-2 overflow-hidden">
        <h1 className="text-base sm:text-base font-semibold">Platform Analytics</h1>
        <p className="text-blue-100 font-normal mt-1 text-sm">Revenue, parcel volume, and client growth trends.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard icon={Building2} label="Total Companies" value={stats?.total_companies} color="bg-primary" />
        <StatCard icon={Clock} label="Pending Approvals" value={stats?.pending_approvals} color="bg-amber-500" />
        <StatCard icon={CheckCircle2} label="Active Subscriptions" value={stats?.active_subscriptions} color="bg-emerald-500" />
        <StatCard icon={Building2} label="Trialing" value={stats?.trialing} color="bg-sky-500" />
        <StatCard icon={Package} label="Total Parcels" value={stats?.total_parcels} color="bg-accent" />
        <StatCard icon={DollarSign} label="Platform Revenue" value={`KES ${parseFloat(stats?.total_platform_revenue || 0).toLocaleString()}`} color="bg-indigo-600" />
        <StatCard icon={Users} label="Active Clients" value={stats?.active_clients} color="bg-teal-500" />
        <StatCard icon={TrendingUp} label="Subscription Payments" value={stats?.subs_active} color="bg-purple-500" />
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-normal text-gray-500 uppercase">Period:</span>
        {PERIODS.map(d => (
          <button key={d} onClick={() => setPeriod(d)}
            className={`px-4 py-1.5 rounded-xl text-sm font-normal transition-all ${period === d ? 'bg-accent text-white shadow-sm' : 'bg-white/70 text-gray-600 hover:bg-white border border-gray-200'}`}>
            {d}d
          </button>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><DollarSign size={16} /> Daily Platform Revenue</h3>
          <div className="flex items-end gap-1" style={{ height: 140 }}>
            {revenueData.length === 0 ? <div className="text-gray-400 text-sm w-full text-center">No data for this period</div> : (() => {
              const max = Math.max(...revenueData.map(d => Number(d.platform_revenue) || 0), 1);
              return revenueData.map((d, i) => {
                const h = (Number(d.platform_revenue) / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center group relative">
                    <div className="absolute bottom-full mb-1 text-xs font-normal text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-0.5 rounded whitespace-nowrap">
                      KES {Number(d.platform_revenue).toLocaleString()}
                    </div>
                    <div className="w-full rounded-t-sm transition-all" style={{ height: `${Math.max(h, 2)}%`, backgroundColor: '#34d399' }} />
                    {revenueData.length <= 31 && <span className="text-[8px] text-gray-400 mt-1">{d.day ? new Date(d.day).getDate() : ''}</span>}
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* Parcel Volume */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><Package size={16} /> Daily Parcel Volume</h3>
          <BarChart data={parcelData} valueKey="count" color="#6366f1" height={140} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* New Clients */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><Building2 size={16} /> New Clients</h3>
          <BarChart data={clientData} valueKey="count" color="#f59e0b" height={140} />
        </div>

        {/* Subscription Breakdown */}
        <div className="glass-card p-5">
          <h3 className="font-semibold text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><BarChart3 size={16} /> Subscription Breakdown</h3>
          <DonutChart segments={[
            { label: 'Active', value: stats?.active_subscriptions || 0, color: '#10b981' },
            { label: 'Trialing', value: stats?.trialing || 0, color: '#0ea5e9' },
            { label: 'Pending', value: stats?.pending_approvals || 0, color: '#f59e0b' },
          ]} />
        </div>
      </div>

      {/* Top Clients */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-primary text-sm uppercase tracking-wide mb-4 flex items-center gap-2"><DollarSign size={16} /> Top Clients by Parcel Volume</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-gray-500 font-normal uppercase tracking-wider border-b border-gray-100">
              <th className="pb-2 text-left">#</th><th className="pb-2 text-left">Company</th><th className="pb-2 text-right">Parcels</th>
            </tr></thead>
            <tbody>
              {topClients.length === 0 ? <tr><td colSpan={3} className="py-6 text-center text-gray-400">No data</td></tr> :
                topClients.map((c, i) => (
                  <tr key={c.id} className="border-b border-gray-50">
                    <td className="py-2 text-gray-400 font-normal w-8">{i + 1}</td>
                    <td className="py-2 font-normal text-primary">{c.name}</td>
                    <td className="py-2 text-right font-normal">{c.parcel_count}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
