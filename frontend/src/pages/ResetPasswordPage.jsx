import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import PasswordStrength from '../components/PasswordStrength';
import { Lock, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
    const { token } = useParams();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 8) return toast.error('Password must be at least 8 characters');
        setLoading(true);
        try {
            await api.post(`/auth/reset-password/${token}`, { password });
            setDone(true);
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
                <div className="glass-card p-10 w-full max-w-md text-center animate-fadeIn shadow-2xl">
                    <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-primary mb-3">Password Reset!</h2>
                    <p className="text-gray-500 mb-6 font-medium">You can now log in with your new password.</p>
                    <Link to="/login" className="inline-block bg-primary text-white px-6 py-3 rounded-xl font-bold hover:bg-secondary transition-all">
                        Log In Now
                    </Link>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="min-h-[90vh] bg-transparent flex items-center justify-center p-4">
                <div className="glass-card p-10 w-full max-w-md text-center animate-fadeIn shadow-2xl">
                    <h2 className="text-xl font-black text-primary mb-3">Invalid Link</h2>
                    <p className="text-gray-500 mb-6">This reset link is missing or invalid.</p>
                    <Link to="/forgot-password" className="text-accent font-bold hover:underline">Request a new link</Link>
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
                    <h2 className="text-xl font-black text-primary mb-2">Set New Password</h2>
                    <p className="text-sm text-gray-500 mb-6">Enter your new password below.</p>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-primary mb-1.5">New Password</label>
                            <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                                className="w-full border border-gray-200 bg-white/70 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                                placeholder="At least 8 characters" />
                            <PasswordStrength password={password} />
                        </div>
                        <button type="submit" disabled={loading}
                            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-secondary transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                            <Lock size={18} /> {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
