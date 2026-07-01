import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function getToken() {
    try {
        return sessionStorage.getItem('token');
    } catch { return null; }
}

export default function PrintPage() {
    const { id } = useParams();
    const [html, setHtml] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = getToken();
        fetch(`/api/office/parcels/${id}/print`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.text())
            .then(text => { setHtml(text); setLoading(false); })
            .catch(() => setLoading(false));
    }, [id]);

    if (loading) {
        return <div className="h-screen w-screen flex items-center justify-center bg-white">Loading sticker...</div>;
    }

    return (
        <div className="h-screen w-screen relative">
            <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-700 z-50 flex items-center gap-2">
                <ArrowLeft size={16} /> Back
            </button>
            <iframe
                srcDoc={html}
                title="Print Sticker"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-modals"
            />
        </div>
    );
}
