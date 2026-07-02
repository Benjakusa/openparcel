import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Building, MapPin, Phone } from 'lucide-react';

function OfficeForm({ initial, onSave, onCancel }) {
    const [form, setForm] = useState(initial || { name: '', address: '', phone: '' });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (initial?.id) {
                await api.put(`/company/offices/${initial.id}`, form);
                toast.success('Office updated');
            } else {
                await api.post('/company/offices', form);
                toast.success('Office created');
            }
            onSave();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="glass-card bg-white/80 p-8 w-full max-w-md transition-all">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-base text-primary flex items-center gap-2">
                        {initial?.id ? <Pencil className="text-accent" /> : <Plus className="text-accent" />}
                        {initial?.id ? 'Edit Office' : 'Add Office'}
                    </h3>
                    <button onClick={onCancel} className="w-8 h-8 rounded-full bg-white/50 border-white flex items-center justify-center btn-base btn-icon">
                        <X size={18} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {[['name', 'Office Name', true], ['address', 'Address', false], ['phone', 'Phone', false]].map(([key, label, req]) => (
                        <div key={key}>
                            <label className="block text-xs font-normal uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
                            <input required={req} value={form[key] || ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                className="w-full bg-white/70 border border-gray-200/60 rounded-xl px-4 py-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all" />
                        </div>
                    ))}
                    <div className="flex gap-4 pt-4">
                        <button type="button" onClick={onCancel} className="flex-1 bg-white/60 border-white py-3.5 rounded-xl text-sm font-normal btn-base btn-secondary">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-3.5 rounded-xl text-sm font-normal disabled:opacity-60 btn-base btn-primary">
                            {saving ? 'Saving...' : 'Save Office'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default function CompanyOffices() {
    const [offices, setOffices] = useState([]);
    const [editOffice, setEditOffice] = useState(null);
    const [showForm, setShowForm] = useState(false);

    const fetchOffices = () => api.get('/company/offices').then(r => setOffices(r.data)).catch(() => { });
    useEffect(() => { fetchOffices(); }, []);

    const deleteOffice = async (id, name) => {
        if (!confirm(`Delete office "${name}"?`)) return;
        try { await api.delete(`/company/offices/${id}`); toast.success('Deleted'); fetchOffices(); }
        catch (err) { toast.error(err.response?.data?.message || 'Delete failed'); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-base sm:text-base font-semibold text-primary mb-1">Offices</h1>
                    <p className="text-sm font-normal text-gray-500">{offices.length} registered locations</p>
                </div>
                <button onClick={() => { setEditOffice(null); setShowForm(true); }}
                    className="flex items-center gap-2 bg-primary text-white hover:-translate-y-0.5 px-5 py-3 rounded-xl text-sm font-normal transition-all">
                    <Plus size={18} strokeWidth={3} /> Add Office
                </button>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {offices.map(o => (
                    <div key={o.id} className="glass-card bg-white/60 border border-white p-6 hover:-translate-y-1 transition-all group flex flex-col justify-between h-full relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-accent/10 to-transparent blur-xl rounded-bl-full pointer-events-none -mr-4 -mt-4 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                        <div className="mb-6 relative z-10">
                            <div className="flex items-start gap-4 mb-4">
                                <div className="w-12 h-12 bg-primary/5 rounded-xl border border-white flex items-center justify-center shrink-0">
                                    <Building className="text-primary" size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-primary text-base leading-tight group-hover:text-accent transition-colors">{o.name}</h3>
                                </div>
                            </div>

                            <div className="space-y-3 pl-1">
                                <div className="flex items-start gap-3 text-sm">
                                    <MapPin size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                    <span className="font-normal text-gray-600">{o.address || 'No address provided'}</span>
                                </div>
                                <div className="flex items-start gap-3 text-sm">
                                    <Phone size={16} className="text-gray-400 mt-0.5 shrink-0" />
                                    <span className="font-normal text-gray-600">{o.phone || 'No phone provided'}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-200/50 relative z-10">
                            <button onClick={() => { setEditOffice(o); setShowForm(true); }}
                                className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 flex items-center justify-center gap-2 text-primary hover:text-accent py-2.5 rounded-xl text-sm font-normal transition-all">
                                <Pencil size={15} /> Edit
                            </button>
                            <button onClick={() => deleteOffice(o.id, o.name)}
                                className="flex-none bg-white hover:bg-red-50 border border-gray-200 hover:border-red-200 flex items-center justify-center text-red-500 w-11 py-2.5 rounded-xl transition-all" title="Delete Office">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    </div>
                ))}

                {offices.length === 0 && (
                    <div className="sm:col-span-2 lg:col-span-3 glass-card p-12 text-center border-dashed border-2 border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors" onClick={() => { setEditOffice(null); setShowForm(true); }}>
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4">
                            <Building className="text-primary/50" size={32} />
                        </div>
                        <h3 className="text-base font-semibold text-primary mb-1">No Offices Added</h3>
                        <p className="text-gray-500 font-normal mb-6 text-sm">Start by adding your primary dispatching office</p>
                        <button className="font-normal px-6 py-2.5 rounded-xl inline-flex items-center gap-2 text-sm btn-base btn-primary">
                            <Plus size={18} strokeWidth={3} /> Add Your First Office
                        </button>
                    </div>
                )}
            </div>

            {showForm && (
                <OfficeForm
                    initial={editOffice}
                    onSave={() => { setShowForm(false); fetchOffices(); }}
                    onCancel={() => setShowForm(false)}
                />
            )}
        </div>
    );
}
