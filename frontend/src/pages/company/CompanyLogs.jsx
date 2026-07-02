import { useEffect, useState } from 'react';
import api from '../../api/client';
import { RefreshCw, Activity, User, MapPin, Filter } from 'lucide-react';

const ACTION_COLORS = {
    CREATED_PARCEL: 'bg-blue-50 text-blue-700 border-blue-200',
    SCANNED_PARCEL: 'bg-amber-50 text-amber-700 border-amber-200',
    RETRY_PAYMENT: 'bg-red-50 text-red-700 border-red-200',
    RESENT_WHATSAPP: 'bg-green-50 text-green-700 border-green-200',
    CREATED_OFFICE: 'bg-purple-50 text-purple-700 border-purple-200',
    UPDATED_OFFICE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    INVITED_STAFF: 'bg-teal-50 text-teal-700 border-teal-200',
    UPDATED_MPESA: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

function formatDateTime(ts) {
    if (!ts) return { date: '—', time: '' };
    const d = new Date(ts);
    if (isNaN(d.getTime())) return { date: '—', time: '' };
    return {
        date: d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }),
        time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    };
}

function renderDetails(details) {
    if (!details) return null;
    const entries = typeof details === 'string' ? Object.entries(JSON.parse(details || '{}')) : Object.entries(details);
    if (!entries.length) return null;
    return (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
            {entries.map(([k, v]) => (
                <span key={k} className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded border border-gray-200 text-xs font-normal">
                    <strong className="text-gray-400 uppercase tracking-widest text-[10px] mr-1">{k.replace(/_/g, ' ')}:</strong>{v}
                </span>
            ))}
        </div>
    );
}

export default function CompanyLogs() {
    const [logs, setLogs] = useState([]);
    const [offices, setOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedOffice, setSelectedOffice] = useState('');

    const fetchLogs = (officeId = selectedOffice) => {
        setLoading(true);
        const params = officeId ? `?office_id=${officeId}` : '';
        api.get(`/company/logs${params}`)
            .then(r => setLogs(r.data))
            .catch(() => { })
            .finally(() => { setLoading(false); setRefreshing(false); });
    };

    useEffect(() => {
        api.get('/company/offices').then(r => setOffices(r.data)).catch(() => { });
        fetchLogs();
    }, []);

    useEffect(() => {
        fetchLogs(selectedOffice);
    }, [selectedOffice]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-accent">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-blue-50 rounded-2xl flex items-center justify-center">
                        <Activity size={22} className="text-accent" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold text-gray-900">Activity Logs</h1>
                        <p className="text-sm font-normal text-gray-500 mt-0.5">
                            Timestamped audit trail of staff actions
                            {selectedOffice && offices.find(o => o.id === selectedOffice) && (
                                <span className="ml-1 text-accent font-normal">
                                    · {offices.find(o => o.id === selectedOffice)?.name}
                                </span>
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {/* Office filter */}
                    <div className="relative flex-1 sm:w-52">
                        <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <select
                            value={selectedOffice}
                            onChange={e => setSelectedOffice(e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-normal text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
                        >
                            <option value="">All Offices</option>
                            {offices.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => { setRefreshing(true); fetchLogs(); }}
                        className="w-10 h-10 shrink-0 glass-card flex items-center justify-center rounded-xl text-gray-500 hover:text-accent transition-all"
                        title="Refresh"
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin text-accent' : ''} />
                    </button>
                </div>
            </div>

            {/* Log table */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm min-w-[640px]">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-5 py-3.5 text-xs font-normal text-gray-500 uppercase tracking-wider">Timestamp</th>
                                <th className="px-5 py-3.5 text-xs font-normal text-gray-500 uppercase tracking-wider">Office</th>
                                <th className="px-5 py-3.5 text-xs font-normal text-gray-500 uppercase tracking-wider">Staff Member</th>
                                <th className="px-5 py-3.5 text-xs font-normal text-gray-500 uppercase tracking-wider">Action</th>
                                <th className="px-5 py-3.5 text-xs font-normal text-gray-500 uppercase tracking-wider">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading && !refreshing ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-12 text-center text-gray-400 font-normal uppercase tracking-widest text-xs animate-pulse">
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-5 py-12 text-center text-gray-400 font-normal uppercase tracking-widest text-xs">
                                        No activity recorded yet
                                    </td>
                                </tr>
                            ) : (
                                logs.map(log => {
                                    const { date, time } = formatDateTime(log.created_at);
                                    return (
                                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                            {/* Timestamp — date + time on separate lines */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <div className="font-normal text-gray-800 text-sm">{date}</div>
                                                <div className="font-mono text-xs text-gray-400 mt-0.5">{time}</div>
                                            </td>

                                            {/* Office */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 text-gray-700 font-normal text-sm">
                                                    <MapPin size={13} className="text-accent shrink-0" />
                                                    {log.office_name || <span className="text-gray-400 italic">Unassigned</span>}
                                                </div>
                                            </td>

                                            {/* Staff */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1.5 font-normal text-gray-800 text-sm">
                                                    <User size={13} className="text-gray-400 shrink-0" />
                                                    {log.user_name || 'Unknown'}
                                                </div>
                                                {log.user_email && (
                                                    <div className="text-xs text-gray-400 mt-0.5 ml-4">{log.user_email}</div>
                                                )}
                                            </td>

                                            {/* Action badge */}
                                            <td className="px-5 py-4 whitespace-nowrap">
                                                <span className={`font-mono text-xs font-normal px-2.5 py-1 rounded-lg border ${ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                                                    {log.action?.replace(/_/g, ' ')}
                                                </span>
                                            </td>

                                            {/* Details */}
                                            <td className="px-5 py-4 max-w-xs">
                                                {renderDetails(log.details)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Row count footer */}
                {!loading && logs.length > 0 && (
                    <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 font-normal">
                        Showing {logs.length} log{logs.length !== 1 ? 's' : ''}
                        {selectedOffice && ' for selected office'}
                    </div>
                )}
            </div>
        </div>
    );
}
