import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Printer, Download, MessageCircle, RefreshCw, Send } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function StatusBadge({ status }) {
    return <span className={`text-sm font-normal px-3 py-1.5 rounded-full badge-${status}`}>{status?.replace(/_/g, ' ')}</span>;
}

function TimelineStep({ label, time, active, done }) {
    return (
        <div className={`flex items-start gap-3 ${!done && !active ? 'opacity-30' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${done ? 'bg-green-500' : active ? 'bg-accent pulse-ring' : 'bg-gray-200'}`}>
                <div className={`w-3 h-3 rounded-full ${done || active ? 'bg-white' : 'bg-gray-400'}`} />
            </div>
            <div>
                <div className={`font-normal text-sm ${done || active ? 'text-primary' : 'text-gray-400'}`}>{label}</div>
                {time && <div className="text-xs text-gray-400">{new Date(time).toLocaleString()}</div>}
            </div>
        </div>
    );
}

const STATUS_ORDER = ['created', 'dispatched', 'arrived', 'picked_up'];

export default function ParcelDetail() {
    const { id } = useParams();
    const [parcel, setParcel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState(false);
    const [retrying, setRetrying] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const fetchParcel = () => {
        api.get(`/office/parcels/${id}`)
            .then(r => setParcel(r.data))
            .catch(() => toast.error('Parcel not found'))
            .finally(() => setLoading(false));
    };

    useEffect(() => { fetchParcel(); }, [id]);

    const resendWhatsApp = async () => {
        setResending(true);
        try { await api.post(`/office/parcels/${id}/resend-whatsapp`); toast.success('WhatsApp notification resent'); }
        catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
        finally { setResending(false); }
    };

    const retryPayment = async () => {
        setRetrying(true);
        try { await api.post(`/office/parcels/${id}/retry`); toast.success('Retry STK Push sent'); fetchParcel(); }
        catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
        finally { setRetrying(false); }
    };

    const downloadReceipt = (type) => {
        const token = localStorage.getItem('token');
        const link = document.createElement('a');
        link.href = `/api/office/parcels/${id}/receipt?type=${type}`;
        link.target = '_blank';
        // For proper download with auth header we use fetch
        fetch(link.href, { headers: { Authorization: `Bearer ${token}` } })
            .then(r => r.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = `receipt-${parcel?.tracking_id}-${type}.pdf`;
                a.click(); URL.revokeObjectURL(url);
            });
    };

    if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin h-10 w-10 border-4 border-accent border-t-transparent rounded-full" /></div>;
    if (!parcel) return <div className="p-6 text-center text-gray-400">Parcel not found</div>;

    const statusIdx = STATUS_ORDER.indexOf(parcel.status);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-primary text-white px-4 py-4 flex items-center gap-3">
                <button onClick={() => navigate(-1)} className="text-pale hover:text-white p-2 bg-white/10 rounded-xl transition-colors"><ArrowLeft size={20} /></button>
                <div>
                    <div className="font-normal">Parcel Detail</div>
                    <div className="text-xs text-blue-200 font-mono">{parcel.tracking_id || 'PENDING'}</div>
                </div>
            </div>

            <div className="p-4 max-w-lg mx-auto space-y-4 mt-2">
                {/* Status */}
                <div className="bg-white rounded-2xl border border-pale p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="font-normal text-primary">Status</div>
                        <StatusBadge status={parcel.status} />
                    </div>
                    {/* Timeline */}
                    <div className="space-y-3">
                        <TimelineStep label="Created" time={parcel.created_at} done={statusIdx >= 0} active={parcel.status === 'created'} />
                        <TimelineStep label="Dispatched" time={parcel.dispatched_at} done={statusIdx >= 1} active={parcel.status === 'dispatched'} />
                        <TimelineStep label="Arrived" time={parcel.arrived_at} done={statusIdx >= 2} active={parcel.status === 'arrived'} />
                        <TimelineStep label="Picked Up" time={parcel.picked_up_at} done={statusIdx >= 3} active={parcel.status === 'picked_up'} />
                    </div>
                </div>

                {/* Parcel info */}
                <div className="bg-white rounded-2xl border border-pale p-5 space-y-3 text-sm">
                    <div className="font-normal text-primary mb-1">Parcel Details</div>
                    {[
                        ['From', parcel.sending_office_name],
                        ['To', parcel.receiving_office_name],
                        ['Weight', `${parcel.weight_kg} kg`],
                        ['Fee', `KES ${parcel.fee_paid}`],
                        ...(parcel.vehicle_numberplate ? [['Vehicle Plate', parcel.vehicle_numberplate]] : []),
                    ].map(([l, v]) => (
                        <div key={l} className="flex items-center justify-between">
                            <span className="text-gray-500">{l}</span>
                            <span className="font-normal text-primary">{v}</span>
                        </div>
                    ))}
                </div>

                {/* People */}
                <div className="grid grid-cols-2 gap-4">
                    {[['Sender', parcel.sender_name, parcel.sender_phone, parcel.sender_id_masked],
                    ['Receiver', parcel.receiver_name, parcel.receiver_phone, null]].map(([role, name, phone, id]) => (
                        <div key={role} className="bg-white rounded-2xl border border-pale p-4 text-sm">
                            <div className="text-xs text-gray-400 font-normal uppercase mb-2">{role}</div>
                            <div className="font-normal text-primary">{name}</div>
                            <div className="text-gray-500">{phone}</div>
                            {id && <div className="text-gray-400 font-mono text-xs">{id}</div>}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div className="bg-white rounded-2xl border border-pale p-5">
                    <div className="font-normal text-primary mb-3">Actions</div>
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => downloadReceipt('sender')} className="flex items-center justify-center gap-2 bg-pale/50 text-primary py-2.5 rounded-xl text-sm font-normal hover:bg-pale transition-colors">
                            <Download size={15} /> Sender Receipt
                        </button>
                        <button onClick={() => downloadReceipt('receiver')} className="flex items-center justify-center gap-2 bg-pale/50 text-primary py-2.5 rounded-xl text-sm font-normal hover:bg-pale transition-colors">
                            <Download size={15} /> Receiver Receipt
                        </button>
                        {parcel.tracking_id && (
                            <Link to={`/print/${id}`} className="flex items-center justify-center gap-2 bg-accent text-white py-2.5 rounded-xl text-sm font-normal hover:bg-secondary col-span-2 transition-colors">
                                <Printer size={15} /> Print QR Sticker
                            </Link>
                        )}

                        {parcel.status === 'created' && parcel.sending_office_id === user.office_id && (
                            <Link to={`/scan?mode=dispatch&id=${parcel.tracking_id}`} className="flex flex-col items-center justify-center gap-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-normal hover:bg-blue-700 col-span-2 transition-colors cursor-pointer">
                                <div className="flex gap-2 items-center"><Send size={15} /> Scan to Dispatch</div>
                            </Link>
                        )}

                        {['dispatched', 'arrived', 'picked_up'].includes(parcel.status) && (
                            <button onClick={resendWhatsApp} disabled={resending} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-normal col-span-2 disabled:opacity-60 btn-base btn-primary">
                                <MessageCircle size={15} />{resending ? 'Sending...' : 'Resend WhatsApp'}
                            </button>
                        )}
                        {['pending_payment', 'payment_failed'].includes(parcel.status) && parcel.status !== 'payment_failed' && (
                            <button onClick={retryPayment} disabled={retrying} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-normal col-span-2 disabled:opacity-60 btn-base btn-primary">
                                <RefreshCw size={15} />{retrying ? 'Retrying...' : 'Retry Payment'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
