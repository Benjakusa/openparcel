import { useEffect, useState } from 'react';
import api from '../../api/client';
import toast from 'react-hot-toast';
import { Shield, TestTube, Settings } from 'lucide-react';

export default function CompanyMpesa() {
    const [config, setConfig] = useState(null);
    const [form, setForm] = useState({ shortcode: '', consumerKey: '', consumerSecret: '', passkey: '', environment: 'sandbox' });
    const [saving, setSaving] = useState(false);
    const [testPhone, setTestPhone] = useState('');
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        api.get('/company/mpesa/config').then(r => setConfig(r.data)).catch(() => { });
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/company/mpesa/config', form);
            toast.success('M-Pesa credentials saved and encrypted');
            api.get('/company/mpesa/config').then(r => setConfig(r.data));
            setForm({ shortcode: '', consumerKey: '', consumerSecret: '', passkey: '', environment: 'sandbox' });
        } catch (err) {
            toast.error(err.response?.data?.message || 'Save failed');
        } finally { setSaving(false); }
    };

    const handleTest = async () => {
        if (!testPhone) return toast.error('Enter a phone number');
        setTesting(true);
        try {
            await api.post('/company/mpesa/test', { phone: testPhone });
            toast.success('Test STK Push sent! Check your phone.');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Test failed');
        } finally { setTesting(false); }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                    <Settings size={24} className="text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-primary">M-Pesa Settings</h1>
                    <p className="text-sm font-medium text-gray-500">Configure your company's credentials for collecting parcel fees</p>
                </div>
            </div>

            {config?.configured && (
                <div className="bg-emerald-50/80 backdrop-blur-sm border border-emerald-200/60 rounded-2xl p-5 flex items-center gap-4 relative overflow-hidden">
                    <div className="absolute inset-0 bg-emerald-400/5 mix-blend-overlay"></div>
                    <div className="w-12 h-12 bg-white rounded-xl border border-emerald-100 flex items-center justify-center relative z-10">
                        <Shield className="text-emerald-500" size={24} />
                    </div>
                    <div className="relative z-10">
                        <div className="font-black text-emerald-800 text-lg uppercase tracking-wide">M-Pesa Configured</div>
                        <div className="text-sm font-semibold text-emerald-600 mt-0.5">Shortcode: {config.shortcode} <span className="opacity-50 mx-1">•</span> <span className="uppercase">{config.environment}</span></div>
                    </div>
                </div>
            )}

            <div className="glass-card bg-white/60 border border-white p-6 sm:p-8">
                <h2 className="font-black text-xl text-primary mb-5 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent"></span>{config?.configured ? 'Update Credentials' : 'Configure M-Pesa'}</h2>
                <form onSubmit={handleSave} className="space-y-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                        {[['shortcode', 'Shortcode / Paybill', true], ['consumerKey', 'Consumer Key', true], ['consumerSecret', 'Consumer Secret', true], ['passkey', 'Passkey', true]].map(([key, label, req]) => (
                            <div key={key} className="col-span-2 sm:col-span-1">
                                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">{label}</label>
                                <input type={['consumerSecret', 'passkey'].includes(key) ? 'password' : 'text'} required={req}
                                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                                    placeholder={config?.configured ? '(leave blank to keep)' : ''}
                                    className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all" />
                            </div>
                        ))}
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1.5">Environment</label>
                        <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}
                            className="w-full border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all">
                            <option value="sandbox">Sandbox (testing)</option>
                            <option value="production">Production</option>
                        </select>
                    </div>
                    <div className="bg-white/50 border border-white rounded-xl p-4 text-xs font-semibold text-gray-500 flex gap-2">
                        <span>🔒</span> <span>Credentials are encrypted using AES-256-CBC before storage. Never stored in plaintext.</span>
                    </div>
                    <button type="submit" disabled={saving} className="w-full sm:w-auto bg-primary text-white px-8 py-3.5 rounded-xl font-black hover:bg-secondary disabled:opacity-60 text-base transition-all hover:-translate-y-0.5">
                        {saving ? 'Saving...' : 'Save Credentials'}
                    </button>
                </form>
            </div>

            {config?.configured && (
                <div className="glass-card bg-white/60 border border-white p-6 sm:p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-emerald-500/10 to-transparent blur-xl rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                    <h2 className="font-black text-xl text-primary mb-4 flex items-center gap-2 relative z-10"><span className="w-2 h-2 rounded-full bg-emerald-500"></span>Test M-Pesa Integration (KES 1)</h2>
                    <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                        <input value={testPhone} onChange={e => setTestPhone(e.target.value)}
                            placeholder="Testing Phone e.g. 0708374149"
                            className="flex-1 border border-gray-200/60 bg-white/70 rounded-xl px-4 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all" />
                        <button onClick={handleTest} disabled={testing}
                            className="flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl text-sm font-black hover:bg-emerald-700 disabled:opacity-60 transition-all hover:-translate-y-0.5 whitespace-nowrap">
                            <TestTube size={18} className="text-emerald-100" />{testing ? 'Sending...' : 'Run Test'}
                        </button>
                    </div>
                    <p className="text-xs font-semibold text-gray-500 mt-3 relative z-10 pl-1">For Sandbox testing: use phone 254708374149, PIN 1234</p>
                </div>
            )}
        </div>
    );
}
