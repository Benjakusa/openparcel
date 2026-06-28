import React, { useState } from 'react';
import { PackageSearch, Settings as SettingsIcon, Truck, ChevronLeft } from 'lucide-react';
import TrackParcel from './pages/TrackParcel';
import ParcelDetail from './pages/ParcelDetail';
import SettingsPage from './pages/Settings';

const DEFAULT_API_URL = 'https://openparcel-5f7k.onrender.com';

function getStoredApiUrl() {
    try {
        return localStorage.getItem('opendesk_api_url') || DEFAULT_API_URL;
    } catch {
        return DEFAULT_API_URL;
    }
}

export default function App() {
    const [page, setPage] = useState('track');
    const [trackingId, setTrackingId] = useState(null);
    const [apiUrl, setApiUrl] = useState(getStoredApiUrl);

    const handleTrack = (id) => {
        setTrackingId(id);
        setPage('detail');
    };

    const handleBack = () => {
        setTrackingId(null);
        setPage('track');
    };

    const handleApiChange = (url) => {
        setApiUrl(url);
        try { localStorage.setItem('opendesk_api_url', url); } catch {}
    };

    return (
        <div className="app-container">
            <header className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {page !== 'track' && (
                        <button
                            onClick={handleBack}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'white',
                                cursor: 'pointer',
                                padding: 4,
                                display: 'flex',
                                '-webkit-app-region': 'no-drag',
                            }}
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <Truck size={22} />
                    <div>
                        <div className="header-title">OpenDesk Parcel</div>
                        <div className="header-subtitle">Parcel Tracking Client</div>
                    </div>
                </div>
                <button
                    onClick={() => setPage(page === 'settings' ? 'track' : 'settings')}
                    style={{
                        background: 'rgba(255,255,255,0.1)',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 6,
                        display: 'flex',
                        '-webkit-app-region': 'no-drag',
                    }}
                >
                    <SettingsIcon size={20} />
                </button>
            </header>

            <main className="main-content">
                {page === 'settings' && (
                    <SettingsPage apiUrl={apiUrl} onApiChange={handleApiChange} onBack={handleBack} />
                )}
                {page === 'track' && (
                    <TrackParcel apiUrl={apiUrl} onTrack={handleTrack} />
                )}
                {page === 'detail' && trackingId && (
                    <ParcelDetail apiUrl={apiUrl} trackingId={trackingId} onBack={handleBack} />
                )}
            </main>

            <footer className="footer">
                OpenDesk Parcel Client v1.0.0 &mdash; Track your parcels in real-time
            </footer>
        </div>
    );
}
