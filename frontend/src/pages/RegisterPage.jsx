import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { CheckCircle } from 'lucide-react';
import PasswordStrength from '../components/PasswordStrength';

export default function RegisterPage() {
    const [form, setForm] = useState({ companyName: '', adminEmail: '', adminPassword: '', companyPhone: '' });
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.adminPassword.length < 8) return toast.error('Password must be at least 8 characters');
        setLoading(true);
        try {
            await api.post('/auth/register', form);
            setDone(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
                <div className="glass-card p-10 w-full max-w-md text-center animate-fadeIn">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="text-green-600" size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-primary mb-3">Registration Complete!</h2>
                    <p className="text-gray-500 mb-6 font-medium">
                        Your company has been successfully registered. You can now securely log into your admin dashboard.
                    </p>
                    <Link to="/login" className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-secondary transition-all">
                        Log In Now
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fadeIn mt-8 mb-12">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <span className="font-black text-4xl tracking-tight text-slate-900">
                            OpenDesk<span className="text-blue-700">Parcel</span>
                        </span>
                    </div>
                </div>

                <div className="glass-card p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Company Name</label>
                            <input
                                required
                                value={form.companyName}
                                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                                placeholder="Acme Logistics Ltd"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Company Phone</label>
                            <input
                                type="tel"
                                value={form.companyPhone}
                                onChange={e => setForm(f => ({ ...f, companyPhone: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                                placeholder="+254 7XX XXX XXX"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Admin Email</label>
                            <input
                                type="email"
                                required
                                value={form.adminEmail}
                                onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                                placeholder="admin@yourcompany.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                value={form.adminPassword}
                                onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                                placeholder="At least 8 characters"
                            />
                            <PasswordStrength password={form.adminPassword} />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-secondary transition-all disabled:opacity-60 mt-2"
                        >
                            {loading ? 'Registering...' : 'Register Company'}
                        </button>
                    </form>
                    <p className="text-center text-sm text-gray-500 mt-8 pt-4 border-t border-gray-200/50">
                        Already registered? <Link to="/login" className="text-accent font-bold hover:underline">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
