import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Package, Building2, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
    const [form, setForm] = useState({ companyName: '', adminEmail: '', adminPassword: '' });
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.adminPassword.length < 6) return toast.error('Password must be at least 6 characters');
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
                <div className="glass-card p-10 w-full max-w-md text-center animate-fadeIn shadow-2xl">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <CheckCircle className="text-green-600" size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-primary mb-3">Registration Complete!</h2>
                    <p className="text-gray-500 mb-6 font-medium">
                        Your company has been successfully registered. You can now securely log into your admin dashboard.
                    </p>
                    <Link to="/login" className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-secondary hover:shadow-lg transition-all shadow-md">
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
                        <span className="font-black text-4xl tracking-tight text-slate-900 drop-shadow-sm">
                            OpenDesk<span className="text-blue-700">Parcel</span>
                        </span>
                    </div>
                </div>

                <div className="glass-card p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Company Name</label>
                            <input
                                required
                                value={form.companyName}
                                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-inner"
                                placeholder="Acme Logistics Ltd"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Admin Email</label>
                            <input
                                type="email"
                                required
                                value={form.adminEmail}
                                onChange={e => setForm(f => ({ ...f, adminEmail: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-inner"
                                placeholder="admin@yourcompany.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                value={form.adminPassword}
                                onChange={e => setForm(f => ({ ...f, adminPassword: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all shadow-inner"
                                placeholder="At least 6 characters"
                            />
                        </div>
                        <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 text-sm text-gray-600 font-medium">
                            <Package size={16} className="inline mr-2 text-accent" />
                            Your account will be instantly created and you can log in immediately.
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-secondary hover:shadow-lg transition-all disabled:opacity-60 mt-2"
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
