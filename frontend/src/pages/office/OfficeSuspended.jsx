import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle, LogOut } from 'lucide-react';

export default function OfficeSuspended() {
    const { logout } = useAuth();

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full glass-card bg-white p-8 text-center border-t-4 border-red-500 rounded-2xl relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-32 bg-red-50/50 -z-10" />
                <div className="w-20 h-20 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6 border border-red-200">
                    <AlertTriangle size={36} className="text-red-500" />
                </div>

                <h1 className="text-base font-semibold text-gray-800 mb-3">Subscription Ended</h1>
                <p className="text-gray-500 font-normal mb-8">
                    Your company's subscription has expired or is suspended. Please contact your administrator to renew and restore access.
                </p>

                <button
                    onClick={logout}
                    className="w-full justify-center flex items-center gap-2 py-3 rounded-xl font-normal btn-base btn-secondary"
                >
                    <LogOut size={18} />
                    Log out securely
                </button>
            </div>
        </div>
    );
}
