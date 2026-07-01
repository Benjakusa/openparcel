import { Link } from 'react-router-dom';
import { Package, ArrowRight, LogIn, Building2 } from 'lucide-react';

export default function OnboardingPage() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
            {/* Background tint */}
            <div className="fixed inset-0 bg-gradient-to-br from-blue-50/60 to-slate-100/80 pointer-events-none" />

            <div className="relative z-10 w-full max-w-sm animate-fadeIn">
                {/* Logo */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package size={32} className="text-white" strokeWidth={2} />
                    </div>
                    <h1 className="font-black text-xl tracking-tight text-slate-900">
                        OpenDesk<span className="text-blue-700">Parcel</span>
                    </h1>
                    <p className="text-slate-500 text-sm font-medium mt-2">
                        Parcel management built for Kenya
                    </p>
                </div>

                {/* Action cards */}
                <div className="glass-card p-6 space-y-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center mb-2">
                        Get started
                    </p>

                    {/* Sign in */}
                    <Link
                        to="/login"
                        className="flex items-center justify-between w-full bg-slate-900 hover:bg-blue-700 text-white px-5 py-4 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 group"
                    >
                        <div className="flex items-center gap-3">
                            <LogIn size={18} strokeWidth={2.5} />
                            <span>Sign in to your account</span>
                        </div>
                        <ArrowRight size={16} className="opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </Link>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-xs text-slate-400 font-semibold">or</span>
                        <div className="flex-1 h-px bg-slate-200" />
                    </div>

                    {/* Register */}
                    <Link
                        to="/register"
                        className="flex items-center justify-between w-full border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-800 px-5 py-4 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 group"
                    >
                        <div className="flex items-center gap-3">
                            <Building2 size={18} strokeWidth={2.5} className="text-blue-600" />
                            <span>Register a new company</span>
                        </div>
                        <ArrowRight size={16} className="text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                    </Link>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6 font-medium">
                    © {new Date().getFullYear()} OpenDeskParcel · Built for Kenyan logistics
                </p>
            </div>
        </div>
    );
}
