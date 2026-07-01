import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Users, UserPlus, Key } from 'lucide-react';
import PasswordStrength from '../../components/PasswordStrength';

function ResetPasswordForm({ email, onSave, onCancel }) {
    const [password, setPassword] = useState('');
    const [wipeData, setWipeData] = useState(false);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (wipeData && !confirm(`Are you absolutely sure you want to completely wipe all generic logs for ${email}? This action cannot be undone.`)) return;
        setSaving(true);
        try {
            await onSave(password, wipeData);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset password');
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="glass-card bg-white/90 p-8 w-full max-w-md transition-all relative overflow-hidden">
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="font-black text-2xl text-primary flex items-center gap-2">
                        <Key className="text-amber-500" />
                        Reset Password
                    </h3>
                    <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/50 border border-white hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all text-gray-400">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                    <div className="text-sm font-medium text-gray-500 mb-4">Resetting credentials for: <span className="font-bold text-primary">{email}</span></div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">New Password</label>
                        <input type="password" required placeholder="New secure password" value={password} onChange={e => setPassword(e.target.value)}
                            className="w-full bg-white/70 border border-gray-200/60 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all" />
                        <PasswordStrength password={password} />
                    </div>

                    <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                        <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-100 transition-colors">
                            <input type="checkbox" checked={!wipeData} onChange={() => setWipeData(false)} className="mt-1 w-4 h-4 text-primary focus:ring-primary rounded" />
                            <div>
                                <div className="text-sm font-bold text-gray-800">Retain existing historical data</div>
                                <div className="text-xs font-medium text-gray-500 mt-0.5">Keep all associated records and actions (Default)</div>
                            </div>
                        </label>
                        <label className="flex items-start gap-3 p-4 cursor-pointer hover:bg-red-50 border-t border-gray-200 transition-colors group">
                            <input type="checkbox" checked={wipeData} onChange={() => setWipeData(true)} className="mt-1 w-4 h-4 text-red-500 focus:ring-red-500 rounded" />
                            <div>
                                <div className="text-sm font-bold text-red-600 group-hover:text-red-700 transition-colors">Wipe all non-essential data</div>
                                <div className="text-xs font-medium text-red-400 mt-0.5">Permanently delete explicit historical footprint of this account</div>
                            </div>
                        </label>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onCancel} className="flex-1 bg-white/60 hover:bg-white border border-white text-gray-600 py-3.5 rounded-xl text-base font-bold transition-all">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-amber-500 text-white hover:-translate-y-0.5 hover:bg-amber-600 py-3.5 rounded-xl text-base font-black disabled:opacity-60 transition-all">
                            {saving ? 'Saving...' : 'Reset Key'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function StaffForm({ offices, onSave, onCancel }) {
    const [form, setForm] = useState({ email: '', password: '', fullName: '', phone: '', officeId: '' });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/company/staff', form);
            toast.success('Staff member added');
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to add staff');
        } finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="glass-card bg-white/80 p-8 w-full max-w-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/20 to-transparent blur-xl rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                <div className="flex items-center justify-between mb-6 relative z-10">
                    <h3 className="font-black text-2xl text-primary flex items-center gap-2">
                        <UserPlus className="text-accent" />
                        Add Staff
                    </h3>
                    <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/50 border border-white hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center transition-all text-gray-400">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Assign to Office</label>
                        <select required value={form.officeId} onChange={e => setForm(f => ({ ...f, officeId: e.target.value }))}
                            className="w-full bg-white/70 border border-gray-200/60 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all">
                            <option value="">Select office...</option>
                            {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                        </select>
                    </div>
                    {[['fullName', 'Full Name', false, 'John Kamau'], ['email', 'Email', true, 'staff@company.com'], ['phone', 'Phone', false, '0700000000'], ['password', 'Password', true, '']].map(([key, label, req, ph]) => (
                        <div key={key}>
                            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
                            <input type={key === 'password' ? 'password' : 'text'} required={req} placeholder={ph}
                                value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                className="w-full bg-white/70 border border-gray-200/60 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all" />
                            {key === 'password' && <PasswordStrength password={form.password} />}
                        </div>
                    ))}
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onCancel} className="flex-1 bg-white/60 hover:bg-white border border-white text-gray-600 py-3.5 rounded-xl text-base font-bold transition-all">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 bg-primary text-white hover:-translate-y-0.5 hover:bg-secondary py-3.5 rounded-xl text-base font-black disabled:opacity-60 transition-all">
                            {saving ? 'Adding...' : 'Add Staff'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CompanyStaff() {
    const [staff, setStaff] = useState([]);
    const [offices, setOffices] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [resetConfig, setResetConfig] = useState(null);

    const fetchData = () => Promise.all([
        api.get('/company/staff').then(r => setStaff(r.data)),
        api.get('/company/offices').then(r => setOffices(r.data)),
    ]).catch(() => { });

    useEffect(() => { fetchData(); }, []);

    const removeStaff = async (id, email) => {
        if (!confirm(`Remove ${email}?`)) return;
        try { await api.delete(`/company/staff/${id}`); toast.success('Staff removed'); fetchData(); }
        catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="glass-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-accent mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                        <Users size={24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black text-primary">Staff Directory</h1>
                        <p className="text-sm font-medium text-gray-500">{staff.length} active team members</p>
                    </div>
                </div>
                <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-primary text-white hover:-translate-y-0.5 px-5 py-3 rounded-xl text-sm font-black transition-all">
                    <Plus size={18} strokeWidth={3} /> Add Staff
                </button>
            </div>

            <div className="glass-card p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50/50 border-b border-gray-200/50">
                            <tr>{['Name', 'Email', 'Office', 'Phone', 'Joined', 'Actions'].map(h => <th key={h} className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>)}</tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50">
                            {staff.length === 0
                                ? <tr><td colSpan={6} className="py-12 text-center font-bold uppercase tracking-widest text-xs text-gray-400">No staff members assigned</td></tr>
                                : staff.map(s => (
                                    <tr key={s.id} className="hover:bg-white/60 transition-colors group">
                                        <td className="px-6 py-4 font-black text-primary text-base group-hover:text-accent transition-colors">{s.full_name || '—'}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-600">{s.email}</td>
                                        <td className="px-6 py-4 font-semibold text-gray-600"><span className="bg-white/50 border border-white/50 px-2 py-1 rounded">{s.office_name || '—'}</span></td>
                                        <td className="px-6 py-4 font-medium text-gray-500">{s.phone || '—'}</td>
                                        <td className="px-6 py-4 font-medium text-gray-400">{s.created_at ? new Date(s.created_at).toLocaleDateString() : '—'}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <button onClick={() => setResetConfig(s)} className="bg-white hover:bg-amber-50 border border-gray-200 hover:border-amber-200 text-amber-500 hover:text-amber-600 px-3 h-8 rounded-lg flex items-center justify-center transition-all font-bold text-xs" title="Reset Password">
                                                    Reset
                                                </button>
                                                <button onClick={() => removeStaff(s.id, s.email)} className="bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 text-red-400 hover:text-red-600 w-8 h-8 rounded-lg flex items-center justify-center transition-all" title="Remove Staff">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showForm && <StaffForm offices={offices} onSave={() => { setShowForm(false); fetchData(); }} onCancel={() => setShowForm(false)} />}

            {resetConfig && (
                <ResetPasswordForm
                    email={resetConfig.email}
                    onCancel={() => setResetConfig(null)}
                    onSave={async (password, wipeData) => {
                        const { data } = await api.put(`/company/staff/${resetConfig.id}/reset-password`, { password, wipeData });
                        toast.success(data.message);
                        setResetConfig(null);
                        fetchData();
                    }}
                />
            )}
        </div>
    );
}
