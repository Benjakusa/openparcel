import { useEffect, useState } from 'react';
import api from '../../api/client';
import { DollarSign, Banknote, Smartphone, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OfficeRevenue() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/office/revenue?days=30')
            .then(r => setData(r.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const grouped = {};
    let totalCash = 0;
    let totalMpesa = 0;

    for (const row of data) {
        if (!grouped[row.day]) grouped[row.day] = { day: row.day, cash: 0, mpesa: 0 };
        if (row.payment_method === 'cash') { grouped[row.day].cash = parseFloat(row.total); totalCash += parseFloat(row.total); }
        else { grouped[row.day].mpesa = parseFloat(row.total); totalMpesa += parseFloat(row.total); }
    }

    const days = Object.values(grouped).sort((a, b) => b.day.localeCompare(a.day));

    return (
        <div className="p-4 max-w-2xl mx-auto">
            <div className="bg-primary text-white px-4 py-4 flex items-center gap-3 -mx-4 -mt-4 mb-5">
                <Link to="/office" className="text-pale hover:text-white"><ArrowLeft size={20} /></Link>
                <div>
                    <div className="font-bold">Daily Revenue</div>
                    <div className="text-xs text-blue-200">Last 30 days</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-green-50 rounded-2xl p-4 text-center border border-green-200">
                    <Banknote size={20} className="text-green-600 mx-auto mb-1" />
                    <div className="text-lg font-black text-green-800">{totalCash.toLocaleString()}</div>
                    <div className="text-xs text-green-600">Cash</div>
                </div>
                <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-200">
                    <Smartphone size={20} className="text-blue-600 mx-auto mb-1" />
                    <div className="text-lg font-black text-blue-800">{totalMpesa.toLocaleString()}</div>
                    <div className="text-xs text-blue-600">M-Pesa</div>
                </div>
                <div className="bg-primary/5 rounded-2xl p-4 text-center border border-primary/20">
                    <DollarSign size={20} className="text-primary mx-auto mb-1" />
                    <div className="text-lg font-black text-primary">{(totalCash + totalMpesa).toLocaleString()}</div>
                    <div className="text-xs text-primary">Total (KES)</div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-pale shadow-sm">
                <div className="px-4 py-3 border-b border-pale/50">
                    <h2 className="font-bold text-primary text-sm">Revenue by Day</h2>
                </div>
                {loading ? (
                    <div className="text-center py-8 text-gray-400">Loading...</div>
                ) : days.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">No revenue data yet</div>
                ) : (
                    <div className="divide-y divide-pale/50">
                        {days.map(d => (
                            <div key={d.day} className="px-4 py-3 flex items-center justify-between text-sm">
                                <div className="font-semibold text-gray-700">{new Date(d.day + 'T00:00:00').toLocaleDateString()}</div>
                                <div className="flex items-center gap-4">
                                    <span className="text-green-700 font-medium">KES {d.cash.toLocaleString()}</span>
                                    <span className="text-blue-700 font-medium">KES {d.mpesa.toLocaleString()}</span>
                                    <span className="font-bold text-primary">KES {(d.cash + d.mpesa).toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
