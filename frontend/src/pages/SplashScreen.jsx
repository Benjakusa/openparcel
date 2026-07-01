import { useEffect } from 'react';
import { Package } from 'lucide-react';

export default function SplashScreen({ onDone }) {
    useEffect(() => {
        const timer = setTimeout(onDone, 1800);
        return () => clearTimeout(timer);
    }, [onDone]);

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center bg-white z-50 animate-fadeIn">
            <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center">
                    <Package size={40} className="text-white" strokeWidth={2} />
                </div>
                <span className="font-black text-xl tracking-tight text-slate-900">
                    OpenDesk<span className="text-blue-700">Parcel</span>
                </span>
                <div className="flex gap-1.5 mt-2">
                    <span className="w-2 h-2 rounded-full bg-blue-700 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-700 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-blue-700 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            </div>
        </div>
    );
}
