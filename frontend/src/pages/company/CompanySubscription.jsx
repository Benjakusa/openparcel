import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { CheckCircle, Clock, Smartphone, CreditCard, Shield } from 'lucide-react';

const PLANS = [
    { id: 'monthly', label: 'Monthly Plan', price: 1999, desc: 'Billed monthly. Cancel anytime.' },
    { id: 'lifetime', label: 'Lifetime Plan', price: 29999, desc: 'Pay once, use forever.' },
];

export default function CompanySubscription() {
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [phone, setPhone] = useState('');
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paying, setPaying] = useState(false);

    const fetchStatus = () => {
        api.get('/company/subscription/status')
            .then(r => setStatus(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    };
    useEffect(() => { fetchStatus(); }, []);

    const handleBuy = async () => {
        if (!phone) return toast.error('Enter your phone number');
        if (!selectedPlan) return toast.error('Select a plan');
        setPaying(true);
        try {
            const { data } = await api.post('/company/subscribe', { plan: selectedPlan, phoneNumber: phone });
            toast.success(data.message);
            setSelectedPlan(null);
            setPhone('');
            setTimeout(fetchStatus, 5000); // Poll after 5s
        } catch (err) {
            toast.error(err.response?.data?.message || 'Payment failed');
        } finally { setPaying(false); }
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full shadow-sm" /></div>;

    const isActive = status?.subscription_status === 'active';
    const isTrialing = status?.subscription_status === 'trialing';
    const trialEnd = status?.trial_end_date ? new Date(status.trial_end_date) : null;
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - new Date()) / (1000 * 60 * 60 * 24))) : 0;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-8">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <CreditCard size={24} className="text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary drop-shadow-sm">Subscription</h1>
                    <p className="text-sm font-medium text-gray-500">Manage your billing and platform access</p>
                </div>
            </div>

            {/* Current status */}
            <div className="glass-card bg-white/60 border border-white p-6 sm:p-8 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/10 to-transparent blur-xl rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                <div className="flex items-start sm:items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-white/80 rounded-full flex items-center justify-center shadow-sm shrink-0">
                        {isActive ? <CheckCircle className="text-emerald-500" size={26} /> : <Clock className="text-amber-500" size={26} />}
                    </div>
                    <div>
                        <div className="font-black text-2xl text-primary capitalize drop-shadow-sm">{status?.subscription_status}</div>
                        {isActive && <div className="text-sm font-medium text-gray-600 mt-1">Plan: <span className="font-bold">{status?.subscription_plan}</span> <span className="text-gray-300 mx-2">|</span> Expires: <span className="font-bold">{status?.subscription_end_date ? new Date(status.subscription_end_date).toLocaleDateString() : 'Never'}</span></div>}
                        {isTrialing && <div className="text-sm font-bold text-amber-600 mt-1 bg-amber-50 px-2.5 py-1 rounded-md inline-block border border-amber-100">{daysLeft} day(s) remaining in free trial</div>}
                    </div>
                </div>
            </div>

            {/* Buy plan section */}
            {!isActive && (
                <div className="space-y-6">
                    <h2 className="font-black text-xl text-primary mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent"></span> Choose a Plan
                    </h2>
                    <div className="grid sm:grid-cols-2 gap-5">
                        {PLANS.map(plan => (
                            <div key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                                className={`cursor-pointer rounded-2xl border-2 p-6 transition-all shadow-sm flex flex-col justify-between ${selectedPlan === plan.id ? 'border-accent bg-accent/5 shadow-md scale-[1.02]' : 'border-white/60 bg-white/40 hover:bg-white hover:shadow-md'}`}>
                                <div>
                                    <div className="font-bold text-primary uppercase text-xs tracking-wide">{plan.label}</div>
                                    <div className="text-3xl font-black text-accent mt-2 drop-shadow-sm">KES {plan.price.toLocaleString()}</div>
                                    <div className="text-sm font-medium text-gray-500 mt-3">{plan.desc}</div>
                                </div>
                                {selectedPlan === plan.id && <div className="mt-4 text-xs bg-accent/10 border border-accent/20 text-accent font-bold px-3 py-1.5 rounded-lg inline-flex w-max items-center gap-1.5"><CheckCircle size={14} /> Selected</div>}
                            </div>
                        ))}
                    </div>

                    {selectedPlan && (
                        <div className="glass-card bg-white/60 border border-white shadow-sm p-6 sm:p-8 animate-fadeIn mt-2">
                            <h3 className="font-black text-lg text-primary mb-4 flex items-center gap-2 uppercase tracking-wide text-sm"><Smartphone size={20} className="text-accent" /> Pay via M-Pesa STK Push</h3>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <input value={phone} onChange={e => setPhone(e.target.value)}
                                    placeholder="Your phone e.g. 0708374149"
                                    className="flex-1 border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-inner" />
                                <button onClick={handleBuy} disabled={paying}
                                    className="bg-primary text-white px-8 py-3.5 rounded-xl text-base font-black hover:bg-secondary disabled:opacity-60 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 whitespace-nowrap">
                                    {paying ? 'Sending...' : 'Pay Now'}
                                </button>
                            </div>
                            <p className="text-xs font-semibold text-gray-500 mt-3 flex items-center gap-1.5"><Shield size={14} className="text-gray-400" /> An STK Push will be sent to your phone. Enter your M-Pesa PIN to complete.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
