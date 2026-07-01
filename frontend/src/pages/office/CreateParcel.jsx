import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Package } from 'lucide-react';

export default function CreateParcel() {
    const [offices, setOffices] = useState([]);
    const [form, setForm] = useState({
        senderName: '', senderPhone: '', senderIdNumber: '',
        receiverName: '', receiverPhone: '',
        receivingOfficeId: '', weightKg: '', notes: '', parcelType: 'one_time', pricingOption: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [stkPending, setStkPending] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('mpesa');
    const [calculatedFee, setCalculatedFee] = useState(null);
    const [options, setOptions] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        api.get('/company/offices').then(r => setOffices(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        if (!form.receivingOfficeId) { setCalculatedFee(null); setOptions([]); return; }
        api.get('/company/pricing/options', {
            params: { office_id: form.receivingOfficeId, parcel_type: form.parcelType }
        }).then(r => {
            setOptions(r.data);
            if (r.data.length && !r.data.find(o => o.option_name === form.pricingOption)) {
                setForm(f => ({ ...f, pricingOption: r.data[0].option_name }));
            }
        }).catch(() => setOptions([]));
    }, [form.receivingOfficeId, form.parcelType]);

    useEffect(() => {
        if (!form.receivingOfficeId) { setCalculatedFee(null); return; }
        api.get('/company/pricing/calculate', {
            params: { office_id: form.receivingOfficeId, parcel_type: form.parcelType, weight: form.weightKg || 1, option: form.pricingOption || 'Standard' }
        }).then(r => setCalculatedFee(r.data.fee)).catch(() => setCalculatedFee(null));
    }, [form.receivingOfficeId, form.parcelType, form.weightKg, form.pricingOption]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.receivingOfficeId) return toast.error('Select receiving office');
        setSubmitting(true);
        if (paymentMethod === 'mpesa') setStkPending(true);
        try {
            const { data } = await api.post('/office/parcels', {
                ...form,
                weightKg: parseFloat(form.weightKg),
                receivingOfficeId: parseInt(form.receivingOfficeId),
                paymentMethod,
            });
            if (data.paymentMethod === 'cash') {
                toast.success('Parcel created! Collect KES ' + data.parcel.fee + ' in cash.');
                setStkPending(false);
                navigate(`/parcel/${data.parcel.id}`);
            } else {
                toast.success('STK Push sent to sender! Awaiting payment confirmation.');
                setStkPending(false);
                setTimeout(() => navigate(`/parcel/${data.parcel.id}`), 2000);
            }
        } catch (err) {
            setStkPending(false);
            toast.error(err.response?.data?.message || 'Failed to create parcel');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="p-4 max-w-2xl mx-auto mb-10 mt-6">
            <div className="flex items-center gap-3 mb-8">
                <button onClick={() => navigate(-1)} className="w-10 h-10 glass-card bg-white/50 border-white/60 flex items-center justify-center rounded-xl text-gray-500 hover:text-accent transition-all">
                    <ArrowLeft size={20} className="stroke-[2.5]" />
                </button>
                <div>
                    <h1 className="text-2xl font-black text-primary">Create Parcel</h1>
                    <p className="text-gray-500 font-medium">Payment collected via cash or M-Pesa</p>
                </div>
            </div>

            {/* STK Pending modal */}
            {stkPending && (
                <div className="fixed inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="glass-card bg-white/80 p-8 w-full max-w-sm text-center animate-fadeIn">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Package className="text-green-600 animate-pulse" size={36} />
                        </div>
                        <h3 className="font-black text-primary text-xl mb-2">Waiting for Payment</h3>
                        <p className="text-gray-500 font-medium">STK Push sent to sender's phone. Waiting for M-Pesa PIN entry...</p>
                        <div className="mt-8 flex justify-center">
                            <div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" />
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Sender */}
                <div className="glass-card bg-white/40 border border-white/60 p-6 transition-shadow">
                    <h2 className="font-black text-primary mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent"></span> Sender Details
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {[['senderName', 'Full Name', true, 'text'], ['senderPhone', 'Phone', true, 'tel'], ['senderIdNumber', 'ID Number', false, 'text']].map(([key, label, req, type]) => (
                            <div key={key} className={key === 'senderName' ? 'sm:col-span-2' : ''}>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                                <input type={type} required={req} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                    className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Receiver */}
                <div className="glass-card bg-white/40 border border-white/60 p-6 transition-shadow">
                    <h2 className="font-black text-primary mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Receiver Details
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-4">
                        {[['receiverName', 'Full Name', true, 'text'], ['receiverPhone', 'Phone', true, 'tel']].map(([key, label, req, type]) => (
                            <div key={key}>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">{label}</label>
                                <input type={type} required={req} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                    className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Parcel details */}
                <div className="glass-card bg-white/40 border border-white/60 p-6 transition-shadow">
                    <h2 className="font-black text-primary mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-sky-500"></span> Parcel Details
                    </h2>
                    <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Receiving Office</label>
                                <select required value={form.receivingOfficeId} onChange={e => setForm(f => ({ ...f, receivingOfficeId: e.target.value }))}
                                    className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-medium">
                                    <option value="" className="text-gray-400">Select destination office...</option>
                                    {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Weight (kg)</label>
                                <input type="number" step="0.1" min="0.1" required value={form.weightKg}
                                    onChange={e => setForm(f => ({ ...f, weightKg: e.target.value }))}
                                    className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-mono font-bold" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Parcel Type</label>
                            <div className="flex gap-3">
                                {['one_time', 'per_kg'].map(type => (
                                    <button key={type} type="button" onClick={() => setForm(f => ({ ...f, parcelType: type, pricingOption: '' }))}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${form.parcelType === type ? 'bg-accent text-white border-accent' : 'bg-white/80 text-gray-500 border-white/50 hover:bg-white'}`}>
                                        {type === 'one_time' ? 'One-Time' : 'Per Kg'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {form.parcelType === 'one_time' && options.length > 0 && (
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Pricing Option</label>
                                <select value={form.pricingOption} onChange={e => setForm(f => ({ ...f, pricingOption: e.target.value }))}
                                    className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all font-medium">
                                    {options.map(o => <option key={o.option_name} value={o.option_name}>{o.option_name} — KES {parseFloat(o.price).toLocaleString()}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wide">Notes (optional)</label>
                            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all resize-none" placeholder="Special handling instructions..." />
                        </div>
                    </div>
                </div>

                {/* Payment Method */}
                <div className="glass-card bg-white/50 border border-white/60 p-6">
                    <h2 className="font-black text-primary mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary"></span> Payment Method
                    </h2>
                    <div className="flex gap-4">
                        <button type="button" onClick={() => setPaymentMethod('mpesa')}
                            className={`flex-1 py-4 rounded-xl font-bold text-base transition-all border-2 ${paymentMethod === 'mpesa' ? 'bg-primary text-white border-primary scale-[1.02]' : 'bg-white/80 text-gray-500 border-white/50 hover:bg-white'}`}>
                            M-Pesa
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('cash')}
                            className={`flex-1 py-4 rounded-xl font-bold text-base transition-all border-2 ${paymentMethod === 'cash' ? 'bg-emerald-600 text-white border-emerald-600 scale-[1.02]' : 'bg-white/80 text-gray-500 border-white/50 hover:bg-white'}`}>
                            Cash
                        </button>
                    </div>
                </div>

                {/* Fee Preview */}
                {calculatedFee !== null && (
                    <div className="glass-card bg-accent-gradient text-white p-6 flex flex-col sm:flex-row items-center justify-between relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-xl -translate-y-1/2 translate-x-1/2"></div>
                        <div className="mb-2 sm:mb-0 relative z-10 text-center sm:text-left">
                            <div className="text-sm font-bold text-blue-100 uppercase tracking-widest mb-1">Calculated Fee</div>
                            <div className="text-xs font-medium text-blue-200 bg-white/10 px-3 py-1 rounded-full inline-block">{form.parcelType === 'one_time' ? 'Fixed price' : `${form.weightKg || 1} kg × rate`}</div>
                        </div>
                        <div className="text-4xl font-black relative z-10">KES {calculatedFee}</div>
                    </div>
                )}
                {calculatedFee === null && form.receivingOfficeId && (
                    <div className="glass-card bg-amber-50 border border-amber-200 p-4 rounded-2xl text-sm text-amber-800 font-medium text-center">
                        No pricing set for this destination. Contact your company admin.
                    </div>
                )}

                <button type="submit" disabled={submitting}
                    className={`w-full py-5 rounded-2xl font-black text-lg text-white transition-all hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0 ${paymentMethod === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary hover:bg-secondary'}`}>
                    {submitting ? 'Processing...' : paymentMethod === 'mpesa' ? `Create & Request KES ${calculatedFee || '?'} via M-Pesa` : `Create Parcel – Collect KES ${calculatedFee || '?'} Cash`}
                </button>
            </form>
        </div>
    );
}
