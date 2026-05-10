import { useEffect, useState } from 'react';
import api from '../../api/client';
import { HeartPulse, Database, Clock, AlertTriangle, CheckCircle, XCircle, Activity, RefreshCw } from 'lucide-react';

function HealthCard({ icon: Icon, label, value, status }) {
  const colorMap = {
    ok: 'bg-emerald-500',
    warn: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };
  return (
    <div className="glass-card bg-white/60 p-5 border border-white/60 shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[status] || 'bg-gray-400'}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">{label}</div>
      </div>
      <div className={`text-lg font-black ${status === 'error' ? 'text-red-600' : 'text-primary'}`}>{value ?? '—'}</div>
    </div>
  );
}

export default function AdminHealth() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);

  const fetchHealth = async () => {
    try {
      const { data } = await api.get('/admin/health');
      setHealth(data);
      setError(null);
    } catch { setError('Could not reach health endpoint'); }
  };

  useEffect(() => { fetchHealth(); }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="glass-card p-6 flex items-center justify-between border-l-4 border-primary shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center"><HeartPulse size={24} className="text-emerald-600" /></div>
          <div>
            <h1 className="text-2xl font-black text-primary drop-shadow-sm">System Health</h1>
            <p className="text-sm font-medium text-gray-500">Platform infrastructure and operational status</p>
          </div>
        </div>
        <button onClick={fetchHealth} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl text-gray-500 hover:text-primary hover:shadow-md transition-all">
          <RefreshCw size={18} />
        </button>
      </div>

      {error ? (
        <div className="glass-card p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <XCircle size={32} className="text-red-500" />
          </div>
          <div className="text-lg font-bold text-red-600">Connection Error</div>
          <div className="text-sm text-gray-500 mt-1">{error}</div>
        </div>
      ) : !health ? (
        <div className="py-12 text-center font-bold uppercase tracking-widest text-xs text-gray-400 animate-pulse">Loading system status...</div>
      ) : (
        <>
          {/* Status Banner */}
          <div className={`glass-card p-5 ${health.db_status === 'connected' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'} border shadow-sm flex items-center gap-3`}>
            {health.db_status === 'connected'
              ? <><CheckCircle size={20} className="text-emerald-600" /><span className="font-bold text-emerald-700">All systems operational</span></>
              : <><XCircle size={20} className="text-red-600" /><span className="font-bold text-red-700">System issues detected</span></>}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <HealthCard icon={Database} label="Database" value={health.db_status === 'connected' ? 'Connected' : 'Disconnected'} status={health.db_status === 'connected' ? 'ok' : 'error'} />
            <HealthCard icon={Clock} label="DB Time" value={health.db_time ? new Date(health.db_time).toLocaleString() : '—'} status="info" />
            <HealthCard icon={Activity} label="DB Version" value={health.db_version ? health.db_version.split(' ')[0] : '—'} status="info" />
            <HealthCard icon={AlertTriangle} label="Failed Payments (24h)" value={health.failed_payments_24h} status={health.failed_payments_24h > 5 ? 'warn' : health.failed_payments_24h > 0 ? 'ok' : 'ok'} />
            <HealthCard icon={Clock} label="Stale Pending" value={health.stale_pending_payments} status={health.stale_pending_payments > 10 ? 'warn' : 'ok'} />
            <HealthCard icon={CheckCircle} label="Active Clients" value={health.active_companies} status="ok" />
          </div>

          {/* Uptime */}
          <div className="glass-card bg-white/60 p-5 border border-white/60 shadow-sm">
            <h3 className="font-black text-primary text-sm uppercase tracking-wide mb-2 flex items-center gap-2"><Clock size={16} /> Server Uptime</h3>
            <div className="text-lg font-bold text-primary">
              {health.uptime ? `${Math.floor(health.uptime / 86400)}d ${Math.floor((health.uptime % 86400) / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m` : '—'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
