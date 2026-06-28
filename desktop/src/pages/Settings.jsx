import React, { useState } from 'react';
import { Globe, RefreshCw, Check, AlertTriangle } from 'lucide-react';

const DEFAULT_API_URL = 'https://openparcel-5f7k.onrender.com';

export default function SettingsPage({ apiUrl, onApiChange, onBack }) {
    const [url, setUrl] = useState(apiUrl);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    const handleSave = () => {
        const cleanUrl = url.replace(/\/+$/, '');
        setUrl(cleanUrl);
        onApiChange(cleanUrl);
    };

    const handleTestConnection = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`${url.replace(/\/+$/, '')}/health`);
            if (res.ok) {
                setTestResult({ ok: true, message: 'Connection successful!' });
            } else {
                setTestResult({ ok: false, message: `Server returned status ${res.status}` });
            }
        } catch (err) {
            setTestResult({ ok: false, message: `Connection failed: ${err.message}` });
        } finally {
            setTesting(false);
        }
    };

    return (
        <div>
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <Globe size={20} style={{ color: 'var(--primary)' }} />
                    <h2 style={{ fontSize: 18, fontWeight: 700 }}>Server Settings</h2>
                </div>

                <div className="settings-section">
                    <h3>Backend API URL</h3>
                    <input
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        placeholder="https://your-backend.com"
                    />
                    <div className="hint">
                        The URL of your OpenDesk Parcel backend server. This is where tracking requests will be sent.
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary" onClick={handleSave}>
                        <Check size={16} /> Save
                    </button>
                    <button
                        className="btn btn-outline"
                        onClick={handleTestConnection}
                        disabled={testing}
                    >
                        <RefreshCw size={16} className={testing ? 'spinner' : ''} />
                        {testing ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>

                {testResult && (
                    <div style={{
                        marginTop: 16,
                        padding: 12,
                        borderRadius: 6,
                        fontSize: 13,
                        background: testResult.ok ? '#d1fae5' : '#fef2f2',
                        color: testResult.ok ? '#065f46' : '#991b1b',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                    }}>
                        {testResult.ok ? <Check size={16} /> : <AlertTriangle size={16} />}
                        {testResult.message}
                    </div>
                )}
            </div>

            <div className="card" style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                <strong style={{ color: 'var(--text)' }}>About</strong><br />
                OpenDesk Parcel Desktop Client v1.0.0<br />
                This application connects to an OpenDesk Parcel backend server to allow
                customers to track their parcels in real-time.
            </div>
        </div>
    );
}
