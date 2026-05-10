import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft } from 'lucide-react';

export default function PrintPage() {
    const { id } = useParams();
    const [html, setHtml] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch the print HTML from the backend and display it in an iframe
        const token = localStorage.getItem('token');
        fetch(`/api/office/parcels/${id}/print`, {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(r => r.text())
            .then(text => {
                // Write into iframe
                setHtml(text);
            });
    }, [id]);

    return (
        <div className="h-screen w-screen relative">
            <button onClick={() => navigate(-1)} className="absolute top-4 left-4 bg-gray-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-2xl hover:bg-gray-700 z-50 flex items-center gap-2">
                <ArrowLeft size={16} /> Back
            </button>
            <iframe
                srcDoc={html}
                title="Print Sticker"
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-modals"
            />
        </div>
    );
}
