import React, { useEffect, useState } from 'react';
import { MapPin, Phone, User, Weight, DollarSign, RefreshCw, ArrowLeft } from 'lucide-react';
import axios from 'axios';

const STATUS_LABELS = {
    pending_payment: 'Pending Payment',
    payment_failed: 'Payment Failed',
    created: 'Parcel Created',
    dispatched: 'In Transit',
    arrived: 'Arrived at Destination',
    picked_up: 'Picked Up',
};

const TIMELINE_STEPS = [
    { key: 'created', label: 'Parcel Created' },
    { key: 'dispatched', label: 'Dispatched' },
    { key: 'arrived', label: 'Arrived at Office' },
    { key: 'picked_up', label: 'Picked Up' },
];

function getStatusIndex(status) {
    const order = ['pending_payment', 'payment_failed', 'created', 'dispatched', 'arrived', 'picked_up'];
    return order.indexOf(status);
}

function formatDate(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function ParcelDetail({ apiUrl, trackingId, onBack }) {
    const [parcel, setParcel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchParcel = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${apiUrl}/api/track/${trackingId}`);
            setParcel(res.data);
        } catch (err) {
            if (err.response?.status === 404) {
                setError('Parcel not found. Please check the tracking ID and try again.');
            } else {
                setError(err.response?.data?.message || 'Failed to fetch parcel details. Check your connection and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (trackingId) fetchParcel();
    }, [trackingId, apiUrl]);

    if (loading) {
        return (
            <div className="card loading">
                <div className="spinner" />
                <p>Looking up parcel {trackingId}...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <div className="error-message">{error}</div>
                <button className="btn btn-outline" onClick={onBack}>
                    <ArrowLeft size={16} /> Back to Search
                </button>
            </div>
        );
    }

    if (!parcel) return null;

    const statusIdx = getStatusIndex(parcel.status);

    return (
        <div>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>TRACKING ID</div>
                        <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 3, color: 'var(--primary)' }}>
                            {parcel.tracking_id}
                        </div>
                    </div>
                    <span className={`status-badge status-${parcel.status}`}>
                        {STATUS_LABELS[parcel.status] || parcel.status}
                    </span>
                </div>

                <div className="parcel-detail-grid">
                    <div className="detail-item">
                        <div className="detail-label"><User size={12} /> Sender</div>
                        <div className="detail-value">{parcel.sender_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{parcel.sender_phone}</div>
                    </div>
                    <div className="detail-item">
                        <div className="detail-label"><User size={12} /> Receiver</div>
                        <div className="detail-value">{parcel.receiver_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{parcel.receiver_phone}</div>
                    </div>
                    <div className="detail-item">
                        <div className="detail-label"><MapPin size={12} /> From</div>
                        <div className="detail-value">{parcel.sending_office?.name || 'N/A'}</div>
                    </div>
                    <div className="detail-item">
                        <div className="detail-label"><MapPin size={12} /> To</div>
                        <div className="detail-value">{parcel.receiving_office?.name || 'N/A'}</div>
                    </div>
                    <div className="detail-item">
                        <div className="detail-label"><Weight size={12} /> Weight</div>
                        <div className="detail-value">{parcel.weight_kg} kg</div>
                    </div>
                    <div className="detail-item">
                        <div className="detail-label"><DollarSign size={12} /> Fee Paid</div>
                        <div className="detail-value">KES {parcel.fee_paid?.toLocaleString()}</div>
                    </div>
                </div>

                {parcel.company && (
                    <div style={{ marginTop: 16, padding: 12, background: 'var(--bg)', borderRadius: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                        Managed by <strong>{parcel.company.name}</strong>
                        {parcel.company.phone && <span> &middot; {parcel.company.phone}</span>}
                    </div>
                )}
            </div>

            <div className="card">
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Journey Timeline</h3>
                <div className="timeline">
                    {TIMELINE_STEPS.map((step, idx) => {
                        const isActive = statusIdx >= getStatusIndex(step.key) && parcel.status !== 'pending_payment' && parcel.status !== 'payment_failed';
                        const date = parcel.timeline?.[step.key];
                        return (
                            <div key={step.key} className="timeline-item">
                                <div className={`timeline-dot ${isActive ? 'active' : ''}`} />
                                <div className="timeline-date">
                                    {isActive && date ? formatDate(date) : isActive ? 'Completed' : 'Pending'}
                                </div>
                                <div className="timeline-label" style={{ color: isActive ? 'var(--text)' : 'var(--text-muted)' }}>
                                    {step.label}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="action-bar">
                <button className="btn btn-outline" onClick={onBack}>
                    <ArrowLeft size={16} /> Track Another
                </button>
                <button className="btn btn-outline" onClick={fetchParcel}>
                    <RefreshCw size={16} /> Refresh
                </button>
            </div>
        </div>
    );
}
