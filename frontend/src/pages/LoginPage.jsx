import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Package, LogIn } from 'lucide-react';

export default function LoginPage() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', form);
            login(data.user, data.token);
            toast.success(`Welcome back, ${data.user.email}`);
            const role = data.user.role;
            if (role === 'super_admin') navigate('/admin');
            else if (role === 'company_admin') navigate('/company');
            else navigate('/office');
        } catch (err) {
            toast.error(err.response?.data?.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fadeIn">
                <div className="text-center mb-8">
                    <div className="mb-6">
                        <span className="font-normal text-sm tracking-tight text-slate-900">
                            OpenDesk<span className="text-blue-700">Parcel</span>
                        </span>
                    </div>
                    <p className="text-gray-500 mt-2 font-normal">Sign in to your account</p>
                </div>

                <div className="glass-card p-8">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm font-normal text-primary mb-1.5">Email Address</label>
                            <input
                                type="email"
                                required
                                value={form.email}
                                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                                placeholder="you@company.com"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-normal text-primary mb-1.5">Password</label>
                            <input
                                type="password"
                                required
                                value={form.password}
                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl font-normal disabled:opacity-60 flex items-center justify-center gap-2 mt-2 btn-base btn-primary"
                        >
                            {loading ? <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" /> : <LogIn size={18} />}
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <div className="text-right text-xs mt-2">
                        <Link to="/forgot-password" className="text-gray-400 hover:text-accent transition-colors font-normal">Forgot password?</Link>
                    </div>
                    <p className="text-center text-sm text-gray-500 mt-6">
                        New company?{' '}
                        <Link to="/register" className="text-accent font-normal hover:underline">Register here</Link>
                    </p>
                    <p className="text-center text-xs text-gray-400 mt-3 pt-3 border-t border-gray-200/50">
                        <Link to="/onboarding" className="hover:text-accent transition-colors">← Back to home</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
