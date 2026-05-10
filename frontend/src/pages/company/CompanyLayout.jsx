import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useState } from 'react';
import { Package, Building2, Users, Settings, CreditCard, LayoutDashboard, LogOut, Activity, ArrowLeft, Menu, X } from 'lucide-react';

export default function CompanyLayout() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleLogout = () => { logout(); navigate('/login'); };

    const links = [
        { to: '/company', icon: LayoutDashboard, label: 'Dashboard', end: true },
        { to: '/company/offices', icon: Building2, label: 'Offices' },
        { to: '/company/staff', icon: Users, label: 'Staff' },
        { to: '/company/parcels', icon: Package, label: 'Parcels' },
        { to: '/company/logs', icon: Activity, label: 'Activity Logs' },
        { to: '/company/mpesa', icon: Settings, label: 'M-Pesa Settings' },
        { to: '/company/subscription', icon: CreditCard, label: 'Subscription' },
    ];

    return (
        <div className="flex h-screen bg-white relative z-0">
            {/* Mobile Backdrop — z-40 keeps it below modals (z-50) */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden" onClick={() => setMobileMenuOpen(false)} />
            )}

            {/* ── Sidebar ──────────────────────────────────────────────────────
                Desktop  (lg 1024px+): w-64 full labels
                Tablet   (md 768px+) : w-16 icon-only strip with tooltip
                Mobile   (<md)       : off-canvas hamburger panel
            ──────────────────────────────────────────────────────────────── */}
            <aside className={`
                fixed inset-y-0 left-0 flex flex-col z-50
                bg-white border-r border-gray-200 shadow-lg
                transition-transform duration-300
                w-64
                md:relative md:translate-x-0 md:w-16 md:shadow-none
                lg:w-64
                ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                {/* Branding */}
                <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2 md:hidden lg:flex">
                        <Package size={20} className="text-accent shrink-0" />
                        <div>
                            <span className="font-black text-base tracking-tight text-gray-900">
                                OpenDesk<span className="text-blue-600">Parcel</span>
                            </span>
                            <div className="text-[10px] text-gray-400 leading-none mt-0.5 truncate max-w-[130px]">
                                {user?.company_name}
                            </div>
                        </div>
                    </div>
                    {/* Icon-only brand at tablet */}
                    <div className="hidden md:flex lg:hidden w-full items-center justify-center">
                        <Package size={22} className="text-accent" />
                    </div>
                    <button
                        className="md:hidden text-gray-400 hover:text-gray-700 p-1 rounded-lg"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 py-3 overflow-y-auto space-y-0.5 px-2">
                    {links.map(({ to, icon: Icon, label, end }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end={end}
                            onClick={() => setMobileMenuOpen(false)}
                            data-tooltip={label}
                            className={({ isActive }) =>
                                `sidebar-tooltip flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors
                                md:justify-center lg:justify-start
                                ${isActive
                                    ? 'bg-accent text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                }`
                            }
                        >
                            <Icon size={18} className="shrink-0" />
                            <span className="md:hidden lg:block">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                {/* Footer */}
                <div className="p-2 border-t border-gray-100 shrink-0">
                    <div className="text-xs text-gray-400 mb-2 truncate px-2 md:hidden lg:block">
                        {user?.email}
                    </div>
                    <button
                        onClick={handleLogout}
                        data-tooltip="Logout"
                        className="sidebar-tooltip flex items-center gap-2 text-gray-500 font-bold hover:text-red-500 text-sm transition-colors w-full p-2.5 hover:bg-red-50 rounded-xl md:justify-center lg:justify-start"
                    >
                        <LogOut size={16} className="shrink-0" />
                        <span className="md:hidden lg:block">Logout</span>
                    </button>
                </div>
            </aside>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <main className="flex-1 overflow-auto flex flex-col bg-white min-w-0">
                {/* Mobile header */}
                <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20 shrink-0">
                    <button
                        onClick={() => setMobileMenuOpen(true)}
                        className="text-gray-500 hover:text-gray-900 p-2 rounded-xl bg-gray-50 border border-gray-200"
                    >
                        <Menu size={18} />
                    </button>
                    <span className="font-black text-base tracking-tight text-gray-900">
                        OpenDesk<span className="text-blue-600">Parcel</span>
                    </span>
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-700 bg-red-50 p-2 rounded-xl border border-red-100">
                        <LogOut size={18} />
                    </button>
                </header>

                {/* Desktop back nav */}
                <div className="hidden md:flex px-6 pt-5 pb-0">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-gray-500 hover:text-gray-900 font-bold text-sm bg-white px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-2 hover:border-gray-300 hover:-translate-x-0.5 transition-all duration-150"
                    >
                        <ArrowLeft size={15} /> Back
                    </button>
                </div>

                <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
