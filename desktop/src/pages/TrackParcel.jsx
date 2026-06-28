import React, { useState } from 'react';
import { Search, Package, History } from 'lucide-react';

export default function TrackParcel({ apiUrl, onTrack }) {
    const [trackingId, setTrackingId] = useState('');
    const [recentSearches, setRecentSearches] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('opendesk_recent') || '[]');
        } catch { return []; }
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const id = trackingId.trim().toUpperCase();
        if (!id) return;
        const updated = [id, ...recentSearches.filter(s => s !== id)].slice(0, 5);
        setRecentSearches(updated);
        try { localStorage.setItem('opendesk_recent', JSON.stringify(updated)); } catch {}
        onTrack(id);
    };

    return (
        <div>
            <div className="card" style={{ textAlign: 'center', padding: '40px 24px' }}>
                <Package size={48} style={{ color: 'var(--primary)', marginBottom: 16 }} />
                <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                    Track Your Parcel
                </h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>
                    Enter your tracking ID to see the current status and location of your parcel
                </p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Enter tracking ID (e.g. ABC12)"
                            value={trackingId}
                            onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                            maxLength={10}
                            autoFocus
                        />
                        <button type="submit" className="btn btn-primary" disabled={!trackingId.trim()}>
                            <Search size={18} />
                            Track
                        </button>
                    </div>
                </form>
            </div>

            {recentSearches.length > 0 && (
                <div className="card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                        <History size={16} style={{ color: 'var(--text-muted)' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
                            Recent Searches
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {recentSearches.map((id) => (
                            <button
                                key={id}
                                className="btn btn-outline"
                                style={{ padding: '6px 14px', fontSize: 13 }}
                                onClick={() => onTrack(id)}
                            >
                                {id}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="card" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8 }}>
                <strong style={{ color: 'var(--text)' }}>How to track:</strong><br />
                1. Look for the tracking ID on your receipt or WhatsApp message<br />
                2. Enter the ID above and click Track<br />
                3. View real-time status of your parcel from dispatch to delivery
            </div>
        </div>
    );
}
