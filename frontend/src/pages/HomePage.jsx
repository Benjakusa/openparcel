import { Link } from 'react-router-dom';
import { Package, Shield, Smartphone, Zap, CheckCircle, ArrowRight, LogIn } from 'lucide-react';

const features = [
    { icon: Package, title: 'Smart Parcel Tracking', desc: 'QR code stickers auto-generated on payment. Full status timeline from dispatch to pickup.' },
    { icon: Shield, title: 'Secure Multi-Tenant', desc: 'Each company has isolated data, encrypted M-Pesa credentials, and role-based access.' },
    { icon: Smartphone, title: 'WhatsApp Notifications', desc: 'Automated updates sent to senders & receivers at every status change.' },
    { icon: Zap, title: 'M-Pesa Integrated', desc: 'Parcel fees collected via STK Push using each company\'s own M-Pesa credentials.' },
];

const plans = [
    {
        id: 'monthly',
        title: 'Monthly',
        price: 'KES 1,999',
        period: '/month',
        features: ['Unlimited parcels', 'All offices & staff', 'M-Pesa integration', 'WhatsApp notifications', 'PDF receipts'],
        highlight: false,
    },
    {
        id: 'lifetime',
        title: 'Lifetime',
        price: 'KES 29,999',
        period: 'one-time',
        features: ['Everything in Monthly', 'No recurring fees', 'Priority support', 'All future updates', 'Custom branding (soon)'],
        highlight: true,
    },
];

export default function HomePage() {
    return (
        <div className="min-h-screen relative bg-slate-50">
            {/* Dynamic Generated Background Layer */}
            <div className="fixed inset-0 bg-[url('/hero-bg.png')] bg-cover bg-center bg-no-repeat opacity-90 z-0 pointer-events-none"></div>

            {/* Scrim overlay for contrast */}
            <div className="fixed inset-0 bg-white/40 backdrop-blur-md z-0 pointer-events-none"></div>

            <div className="relative z-10 flex flex-col min-h-screen">
                {/* Navbar */}
<nav className="sticky top-0 z-50 glass-card bg-white/80 backdrop-blur-xl border-b border-white shadow-sm">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16 sm:h-20">
        <div className="flex items-center">
            <span className="font-black text-xl sm:text-2xl tracking-tight text-slate-900 drop-shadow-sm">
                OpenDesk<span className="text-blue-700">Parcel</span>
            </span>
        </div>
        <div className="flex items-center gap-3 sm:gap-5">
            <Link to="/login" className="text-slate-900 font-bold hover:text-blue-700 transition-colors">
                <span className="hidden sm:inline">Login</span>
                <LogIn size={20} className="sm:hidden" />
            </Link>
            <Link to="/register" className="bg-slate-900 text-white px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 border border-slate-800">
                Get Started
            </Link>
        </div>
    </div>
</nav>

                {/* Hero */}
                <section className="pt-24 pb-16 px-4">
                    <div className="max-w-5xl mx-auto glass-card bg-white/60 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] border border-white p-10 sm:p-20 text-center animate-fadeIn rounded-3xl">
                        <h1 className="text-5xl md:text-7xl font-black mb-8 leading-tight text-slate-900 drop-shadow-[0_2px_2px_rgba(255,255,255,1)]">
                            Parcel Management<br />
                            <span className="text-blue-700">Built for Kenya</span>
                        </h1>
                        <p className="text-xl text-slate-800 mb-12 max-w-2xl mx-auto font-bold leading-relaxed drop-shadow-[0_1px_1px_rgba(255,255,255,1)]">
                            Multi-tenant SaaS for companies managing parcel logistics. M-Pesa payments, QR stickers, WhatsApp updates — all in one platform.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-5 justify-center">
                            <Link to="/register" className="bg-blue-700 text-white font-black px-10 py-5 rounded-2xl hover:bg-blue-800 hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-3 text-lg shadow-lg border border-blue-600">
                                Start Your Trial <ArrowRight size={22} strokeWidth={3} />
                            </Link>
                            <Link to="/login" className="glass-card bg-white/80 border border-white text-slate-900 font-black px-10 py-5 rounded-2xl hover:bg-white transition-all text-lg text-center shadow-lg hover:-translate-y-1">
                                Sign In
                            </Link>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="py-20 px-4">
                    <div className="max-w-6xl mx-auto">
                        <h2 className="text-3xl lg:text-4xl font-black text-slate-900 text-center mb-6 drop-shadow-sm">Everything you need</h2>
                        <p className="text-center text-slate-800 mb-16 font-bold text-xl drop-shadow-sm">One platform for your entire parcel operations</p>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                            {features.map((f) => (
                                <div key={f.title} className="glass-card bg-white/70 backdrop-blur-lg border border-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-2xl hover:-translate-y-2 transition-all p-8 rounded-3xl group">
                                    <div className="w-16 h-16 bg-white rounded-2xl shadow-md border border-gray-100 flex items-center justify-center mb-6 text-blue-700 group-hover:bg-blue-700 group-hover:text-white transition-all duration-300 transform group-hover:scale-110">
                                        <f.icon size={30} strokeWidth={2.5} />
                                    </div>
                                    <h3 className="font-black text-slate-900 mb-4 text-xl">{f.title}</h3>
                                    <p className="text-slate-800 font-medium leading-relaxed">{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Pricing */}
                <section className="py-20 px-4 mb-20">
                    <div className="max-w-5xl mx-auto">
                        <h2 className="text-3xl lg:text-4xl font-black text-slate-900 text-center mb-6 drop-shadow-sm">Simple Pricing</h2>
                        <p className="text-center text-slate-800 mb-16 font-bold text-xl drop-shadow-sm">Transparent plans to scale your logistics</p>
                        <div className="grid md:grid-cols-2 gap-10">
                            {plans.map((plan) => (
                                <div key={plan.id} className={`glass-card backdrop-blur-xl p-12 relative transition-all duration-300 rounded-3xl ${plan.highlight ? 'bg-blue-50/90 border-2 border-blue-400 shadow-[0_20px_40px_rgba(0,0,0,0.12)] scale-[1.02] md:scale-105' : 'bg-white/70 border border-white shadow-xl hover:scale-[1.02]'}`}>
                                    {plan.highlight && (
                                        <div className="absolute -top-5 left-1/2 -translate-x-1/2 bg-blue-700 shadow-xl text-white text-sm font-black px-6 py-2.5 rounded-full uppercase tracking-wider">
                                            BEST VALUE
                                        </div>
                                    )}
                                    <h3 className={`text-3xl font-black mb-3 ${plan.highlight ? 'text-blue-800' : 'text-slate-900'}`}>{plan.title}</h3>
                                    <div className="flex items-baseline gap-2 mb-10 pb-8 border-b border-gray-200/60">
                                        <span className="text-5xl font-black text-slate-900">{plan.price}</span>
                                        <span className="text-lg text-slate-700 font-bold">{plan.period}</span>
                                    </div>
                                    <ul className="space-y-5 mb-12">
                                        {plan.features.map((f) => (
                                            <li key={f} className="flex items-center gap-4 text-slate-800 font-bold text-lg">
                                                <div className={`p-1 rounded-full ${plan.highlight ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-slate-600'}`}>
                                                    <CheckCircle size={20} strokeWidth={3} />
                                                </div>
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Link to="/register" className={`block w-full text-center py-5 rounded-2xl font-black text-lg transition-all shadow-md hover:shadow-xl ${plan.highlight ? 'bg-blue-700 text-white hover:bg-blue-800 border border-blue-600' : 'glass-card bg-white/90 text-slate-900 border border-white hover:bg-white hover:text-blue-700'}`}>
                                        Start Your Journey
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="mt-auto py-10 bg-white text-center text-sm font-bold text-black w-full z-10 rounded-t-3xl border-t border-gray-200 flex flex-col items-center justify-center gap-3">
                    <span className="font-black text-xl tracking-tight text-black drop-shadow-sm">
                        OpenDesk<span className="text-blue-600">Parcel</span>
                    </span>
                    <span>© {new Date().getFullYear()}. Built for Kenyan logistics.</span>
                </footer>
            </div>
        </div>
    );
}
