import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2, DollarSign, X, Package } from 'lucide-react';

export default function CompanyPricing() {
    const [pricing, setPricing] = useState([]);
    const [offices, setOffices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ destinationOfficeId: '', parcelType: 'one_time', optionName: '', price: '' });
    const [oneTimeOptions, setOneTimeOptions] = useState(['Standard']);

    const fetchPricing = () => {
        api.get('/company/pricing').then(r => setPricing(r.data)).catch(() => {}).finally(() => setLoading(false));
    };

    useEffect(() => {
        api.get('/company/offices').then(r => setOffices(r.data)).catch(() => {});
        fetchPricing();
    }, []);

    useEffect(() => {
        const opts = new Set(pricing.filter(p => p.parcel_type === 'one_time').map(p => p.option_name));
        setOneTimeOptions([...opts].sort());
    }, [pricing]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.destinationOfficeId || !form.price) return toast.error('Fill all fields');
        try {
            await api.post('/company/pricing', {
                destinationOfficeId: parseInt(form.destinationOfficeId),
                parcelType: form.parcelType,
                optionName: form.parcelType === 'one_time' ? form.optionName || 'Standard' : undefined,
                price: parseFloat(form.price),
            });
            toast.success('Pricing saved');
            setShowModal(false);
            setForm({ destinationOfficeId: '', parcelType: 'one_time', optionName: '', price: '' });
            fetchPricing();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save pricing');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this pricing rule?')) return;
        try {
            await api.delete(`/company/pricing/${id}`);
            toast.success('Pricing deleted');
            fetchPricing();
        } catch (err) {
            toast.error('Failed to delete');
        }
    };

    const grouped = {};
    for (const p of pricing) {
        const key = p.office_name + '|' + p.destination_office_id;
        if (!grouped[key]) grouped[key] = { office_name: p.office_name, oneTime: [], perKg: null };
        if (p.parcel_type === 'one_time') grouped[key].oneTime.push(p);
        else grouped[key].perKg = p;
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-base sm:text-base font-semibold text-gray-900">Parcel Pricing</h1>
                    <p className="text-sm font-normal text-gray-500 mt-0.5">Set pricing per destination, type, and option</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="bg-accent text-white px-4 py-2.5 rounded-xl text-sm font-normal hover:bg-secondary transition-all flex items-center gap-2">
                    <Plus size={16} /> Add Pricing
                </button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-400 font-normal">Loading...</div>
            ) : Object.keys(grouped).length === 0 ? (
                <div className="text-center py-12 text-gray-400 font-normal bg-white/50 rounded-2xl border border-gray-200">
                    <DollarSign size={40} className="mx-auto mb-3 text-gray-300" />
                    No pricing rules set. Add pricing for each destination office.
                </div>
            ) : (
                <div className="space-y-4">
                    {Object.entries(grouped).map(([key, g]) => (
                        <div key={key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                            <div className="px-5 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                    <Package size={16} className="text-accent" /> {g.office_name}
                                </h3>
                            </div>
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
                                        <th className="px-5 py-3 font-normal">Type</th>
                                        <th className="px-5 py-3 font-normal">Option</th>
                                        <th className="px-5 py-3 font-normal">Price (KES)</th>
                                        <th className="px-5 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {g.oneTime.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3"><span className="text-xs font-normal px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">One-Time</span></td>
                                            <td className="px-5 py-3 font-normal text-gray-700">{p.option_name || 'Standard'}</td>
                                            <td className="px-5 py-3 font-normal text-primary">KES {parseFloat(p.price).toLocaleString()}</td>
                                            <td className="px-5 py-3 text-right">
                                                <button onClick={() => handleDelete(p.id)}
                                                    className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {g.perKg && (
                                        <tr key={g.perKg.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-5 py-3"><span className="text-xs font-normal px-2.5 py-1 rounded-full bg-purple-50 text-purple-700">Per Kg</span></td>
                                            <td className="px-5 py-3 font-normal text-gray-700">—</td>
                                            <td className="px-5 py-3 font-normal text-primary">KES {parseFloat(g.perKg.price).toLocaleString()} / kg</td>
                                            <td className="px-5 py-3 text-right">
                                                <button onClick={() => handleDelete(g.perKg.id)}
                                                    className="text-red-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-all">
                                                    <Trash2 size={15} />
                                                </button>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 animate-fadeIn">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-base font-semibold text-gray-900">Add Pricing Rule</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-normal text-gray-500 mb-1.5 uppercase tracking-wide">Destination Office</label>
                                <select required value={form.destinationOfficeId}
                                    onChange={e => setForm(f => ({ ...f, destinationOfficeId: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent">
                                    <option value="">Select office...</option>
                                    {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-normal text-gray-500 mb-1.5 uppercase tracking-wide">Parcel Type</label>
                                <div className="flex gap-3">
                                    {['one_time', 'per_kg'].map(type => (
                                        <button key={type} type="button" onClick={() => setForm(f => ({ ...f, parcelType: type, optionName: '' }))}
                                            className={`flex-1 py-3 rounded-xl text-sm font-normal border-2 transition-all ${form.parcelType === type ? 'bg-accent text-white border-accent' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                                            {type === 'one_time' ? 'One-Time' : 'Per Kg'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {form.parcelType === 'one_time' && (
                                <div>
                                    <label className="block text-xs font-normal text-gray-500 mb-1.5 uppercase tracking-wide">Option Name</label>
                                    <div className="flex gap-2">
                                        <input type="text" value={form.optionName}
                                            onChange={e => setForm(f => ({ ...f, optionName: e.target.value }))}
                                            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-normal"
                                            placeholder="e.g. Standard, Express, Fragile" />
                                    </div>
                                    {oneTimeOptions.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {oneTimeOptions.map(opt => (
                                                <button key={opt} type="button" onClick={() => setForm(f => ({ ...f, optionName: opt }))}
                                                    className={`text-xs px-2.5 py-1 rounded-lg border font-normal transition-all ${form.optionName === opt ? 'bg-accent text-white border-accent' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div>
                                <label className="block text-xs font-normal text-gray-500 mb-1.5 uppercase tracking-wide">
                                    Price {form.parcelType === 'per_kg' ? '(per kg)' : '(KES)'}
                                </label>
                                <input type="number" min="0" step="1" required value={form.price}
                                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent font-mono font-normal"
                                    placeholder="0" />
                            </div>
                            <button type="submit" className="w-full py-3 rounded-xl font-normal btn-base btn-primary">
                                Save Pricing
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
