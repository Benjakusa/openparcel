import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
                <div className="glass-card p-10 w-full max-w-md text-center animate-fadeIn shadow-2xl">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-primary mb-3">Check Your Email</h2>
                    <p className="text-gray-500 mb-2 font-medium">
                        If that email is registered, we've sent a password reset link.
                    </p>
                    <p className="text-xs text-gray-400 mb-6">
                        (In dev mode, check the server console for the reset token)
                    </p>
                    <Link to="/login" className="text-accent font-bold hover:underline">Back to login</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-fadeIn mt-8 mb-12">
                <div className="text-center mb-8">
                    <span className="font-black text-4xl tracking-tight text-slate-900 drop-shadow-sm">
                        OpenDesk<span className="text-blue-700">Parcel</span>
                    </span>
                </div>
                <div className="glass-card p-8 shadow-2xl">
                    <h2 className="text-xl font-black text-primary mb-2">Reset Password</h2>
                    <p className="text-sm text-gray-500 mb-6">Enter your email and we'll send you a reset link.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">Email</label>
                            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                                placeholder="admin@yourcompany.com" />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-secondary transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            <Mail size={18} /> {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </form>
                    <p className="text-center text-sm text-gray-500 mt-6">
                        <Link to="/login" className="text-accent font-bold hover:underline inline-flex items-center gap-1">
                            <ArrowLeft size={14} /> Back to login
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
