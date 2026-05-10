import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { ScanLine, CheckCircle, XCircle, Package, Send, CheckSquare, ClipboardCheck, ArrowRight, ArrowLeft } from 'lucide-react';

export default function ScanPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const mode = searchParams.get('mode'); // 'dispatch', 'receive', 'collect', or null
    const initialId = searchParams.get('id');

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [scanning, setScanning] = useState(false);
    const [manualId, setManualId] = useState(initialId || '');
    const [result, setResult] = useState(null);
    const [tab, setTab] = useState(initialId ? 'manual' : 'camera');
    const [parcelData, setParcelData] = useState(null);
    const [processingAction, setProcessingAction] = useState(false);
    const [vehicleNo, setVehicleNo] = useState('');
    const streamRef = useRef(null);

    useEffect(() => {
        if (initialId && tab === 'manual') {
            processTrackingId(initialId);
        }
        return () => { stopCamera(); };
    }, [initialId, tab]);

    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            setScanning(true);
            requestAnimationFrame(scan);
        } catch {
            toast.error('Camera access denied. Use manual input.');
            setTab('manual');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
        }
        setScanning(false);
    };

    const scan = async () => {
        if (!scanning && !streamRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
            return requestAnimationFrame(scan);
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        try {
            const jsQR = (await import('jsqr')).default;
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code) {
                stopCamera();
                await processTrackingId(code.data);
            } else {
                requestAnimationFrame(scan);
            }
        } catch (e) {
            requestAnimationFrame(scan);
        }
    };

    const processTrackingId = async (trackingId) => {
        try {
            // Only lookup the parcel without mutating
            const { data } = await api.post('/scan/lookup', { trackingId });
            setParcelData(data.parcel);
            setResult(null); // Clear any previous mutation results
        } catch (err) {
            const msg = err.response?.data?.message || 'Scan lookup failed';
            setResult({ success: false, message: msg });
            setParcelData(null);
        }
    };

    const handleAction = async (actionStr) => {
        if (!parcelData) return;

        if (actionStr === 'dispatch' && !vehicleNo.trim()) {
            toast.error('Vehicle numberplate is required for dispatch.');
            return;
        }

        setProcessingAction(true);
        try {
            let res;
            if (actionStr === 'dispatch') {
                res = await api.put(`/office/parcels/tracking/${parcelData.tracking_id}/dispatch`, { vehicleNumberplate: vehicleNo });
            } else if (actionStr === 'receive') {
                res = await api.put(`/office/parcels/tracking/${parcelData.tracking_id}/receive`);
            } else if (actionStr === 'collect') {
                res = await api.put(`/office/parcels/tracking/${parcelData.tracking_id}/collect`);
            } else {
                throw new Error('Unknown action');
            }

            const updatedParcel = { ...parcelData, status: actionStr === 'dispatch' ? 'dispatched' : actionStr === 'receive' ? 'arrived' : 'picked_up' };
            setResult({ success: true, message: res.data.message, parcel: updatedParcel });
            setParcelData(null);
            setVehicleNo('');
            toast.success(res.data.message);
        } catch (err) {
            const msg = err.response?.data?.message || 'Action failed';
            toast.error(msg);
        } finally {
            setProcessingAction(false);
        }
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        if (!manualId.trim()) return;
        await processTrackingId(manualId.trim());
    };

    const reset = () => { setResult(null); setParcelData(null); setManualId(''); };

    // Derived flags for available actions
    const isSender = parcelData?.sending_office_id === user?.office_id;
    const isReceiver = parcelData?.receiving_office_id === user?.office_id;

    return (
        <div className="min-h-screen bg-gray-50/50">
            <div className="bg-white border-b border-gray-200 text-primary px-5 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
                <div className="flex flex-row items-center gap-2">
                    <button onClick={() => navigate(-1)} className="text-gray-600 hover:text-primary transition-colors font-bold px-4 py-2 rounded-xl bg-gray-50 border border-gray-200 flex items-center shadow-sm mr-3 gap-2">
                        <ArrowLeft size={18} /> <span className="hidden sm:block text-sm">Back</span>
                    </button>
                    <ScanLine size={24} className="text-accent" />
                    <h1 className="font-black text-xl">Parcel Scanner</h1>
                </div>
            </div>

            {/* Success/Error Result Screen */}
            {result ? (
                <div className="p-6 max-w-md mx-auto mt-8 text-center animate-fadeIn">
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md ${result.success ? 'bg-emerald-100' : 'bg-red-100'}`}>
                        {result.success ? <CheckCircle size={50} className="text-emerald-500" /> : <XCircle size={50} className="text-red-500" />}
                    </div>
                    <h2 className={`font-black text-3xl mb-3 ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                        {result.success ? 'Success!' : 'Error'}
                    </h2>
                    <p className="text-gray-600 mb-6 font-medium text-lg">{result.message}</p>

                    {result.parcel && (
                        <div className="bg-white rounded-2xl p-5 text-left mb-8 border border-gray-200 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-accent/10 to-transparent blur-xl rounded-bl-full pointer-events-none -mr-4 -mt-4"></div>
                            <div className="relative z-10">
                                <div className="text-xs uppercase font-bold text-gray-500 tracking-wider mb-1">Tracking ID</div>
                                <div className="font-mono text-lg font-black text-primary mb-4">{result.parcel.tracking_id}</div>

                                <div className="text-xs uppercase font-bold text-gray-500 tracking-wider mb-1">Updated Status</div>
                                <div><span className={`badge-${result.parcel.status} font-black px-3 py-1.5 rounded-lg text-sm shadow-sm`}>{result.parcel.status.replace('_', ' ')}</span></div>
                            </div>
                        </div>
                    )}
                    <button onClick={reset} className="w-full bg-primary text-white border border-gray-800 px-8 py-4 rounded-xl font-black text-lg hover:bg-secondary hover:shadow-lg transition-all active:scale-95">
                        Scan Another Parcel
                    </button>
                </div>
            ) : parcelData ? (
                /* Looked up Parcel Data Screen with Actions */
                <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto mt-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden relative">
                        <div className="bg-slate-50 border-b border-gray-200 p-6 flex flex-col justify-center items-center text-center">
                            <div className="w-16 h-16 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center mb-4">
                                <Package size={32} className="text-accent" />
                            </div>
                            <h2 className="text-2xl font-black text-primary tracking-tight">{parcelData.tracking_id}</h2>
                            <span className={`block mt-3 w-max mx-auto text-xs font-black uppercase tracking-widest px-3 py-1 rounded bg-gray-100 border border-gray-200 text-gray-700`}>{parcelData.status.replace('_', ' ')}</span>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 relative">
                                    <div className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1">Sender</div>
                                    <div className="font-bold text-sm text-primary">{parcelData.sender_name}</div>
                                    <div className="text-xs text-gray-500 mt-1">{parcelData.sending_office_name}</div>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 relative">
                                    <div className="text-[10px] uppercase font-black tracking-widest text-gray-400 mb-1">Receiver</div>
                                    <div className="font-bold text-sm text-primary">{parcelData.receiver_name}</div>
                                    <div className="text-xs text-gray-500 mt-1">{parcelData.receiving_office_name}</div>
                                </div>
                            </div>

                            <hr className="border-gray-100 my-2" />

                            <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest mb-3">Available Actions</h3>

                            <div className="flex flex-col gap-3">
                                {parcelData.status === 'created' && isSender && mode === 'dispatch' ? (
                                    <div className="space-y-3">
                                        <div className="bg-amber-50 p-4 border border-amber-200 rounded-2xl">
                                            <label className="block text-xs uppercase font-black tracking-widest text-amber-800 mb-2">Transport Vehicle Plate</label>
                                            <input
                                                type="text"
                                                value={vehicleNo}
                                                onChange={e => setVehicleNo(e.target.value.toUpperCase())}
                                                placeholder="e.g. KCA 123G"
                                                className="w-full bg-white border border-amber-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 rounded-xl px-4 py-3 font-mono font-bold text-lg text-amber-900 transition-all uppercase placeholder-amber-200"
                                            />
                                        </div>
                                        <button disabled={processingAction || !vehicleNo.trim()} onClick={() => handleAction('dispatch')} className="w-full flex items-center justify-between text-left bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-md transition-all group disabled:opacity-50">
                                            <div>
                                                <div className="font-black text-lg">Dispatch Parcel</div>
                                                <div className="text-xs text-blue-100 font-semibold opacity-90 mt-0.5">Send off to {parcelData.receiving_office_name}</div>
                                            </div>
                                            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Send size={20} />
                                            </div>
                                        </button>
                                    </div>
                                ) : parcelData.status === 'dispatched' && isReceiver && mode === 'receive' ? (
                                    <button disabled={processingAction} onClick={() => handleAction('receive')} className="w-full flex items-center justify-between text-left bg-emerald-600 hover:bg-emerald-700 text-white p-4 rounded-2xl shadow-md transition-all group disabled:opacity-50">
                                        <div>
                                            <div className="font-black text-lg">Receive Parcel</div>
                                            <div className="text-xs text-emerald-100 font-semibold opacity-90 mt-0.5">Mark arrived at {parcelData.receiving_office_name}</div>
                                        </div>
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <CheckSquare size={20} />
                                        </div>
                                    </button>
                                ) : parcelData.status === 'arrived' && isReceiver && mode === 'collect' ? (
                                    <button disabled={processingAction} onClick={() => handleAction('collect')} className="w-full flex items-center justify-between text-left bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-2xl shadow-md transition-all group disabled:opacity-50 border-2 border-transparent hover:border-purple-300">
                                        <div>
                                            <div className="font-black text-xl">Verified & Collect</div>
                                            <div className="text-sm text-purple-100 font-semibold opacity-90 mt-0.5">I have verified Receiver's ID</div>
                                        </div>
                                        <div className="w-12 h-12 bg-white/25 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <ClipboardCheck size={24} />
                                        </div>
                                    </button>
                                ) : (
                                    <div className="bg-gray-50 border border-gray-200 text-gray-500 rounded-xl p-4 text-center font-semibold text-sm">
                                        {mode === 'dispatch' && <p>Parcel is not pending dispatch</p>}
                                        {mode === 'receive' && <p>Parcel is not in-transit towards this office</p>}
                                        {mode === 'collect' && <p>Parcel is not ready for verified collection</p>}
                                        {!mode && <p>Select a workflow mode from Dashboard</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={reset} className="w-full mt-4 text-gray-500 font-bold text-sm bg-white border border-gray-200 py-3 rounded-xl hover:bg-gray-50 hover:text-primary transition-all">
                        Cancel & Scan Another
                    </button>
                </div>
            ) : (
                /* Main Scanning View */
                <div className="p-4 sm:p-6 lg:p-8 max-w-lg mx-auto">
                    {/* Tabs */}
                    <div className="flex bg-white shadow-sm border border-gray-200 p-1.5 rounded-2xl mb-6">
                        {[['camera', '📷 Camera Code Scanner'], ['manual', '⌨️ Manual Entry']].map(([id, label]) => (
                            <button key={id} onClick={() => { setTab(id); if (id === 'camera') { reset(); setScanning(false); } }}
                                className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${tab === id ? 'bg-primary text-white shadow-md' : 'bg-transparent text-gray-500 hover:text-primary'}`}>
                                {label}
                            </button>
                        ))}
                    </div>

                    <div className="glass-card bg-white border border-gray-200 p-6 sm:p-8 shadow-xl rounded-3xl relative overflow-hidden">
                        {tab === 'camera' && (
                            <div className="flex flex-col items-center">
                                <div className="text-center mb-6">
                                    <h2 className="text-2xl font-black text-primary drop-shadow-sm">Scan QR Label</h2>
                                    <p className="text-gray-500 font-medium text-sm mt-1">Point your camera at the OpenDesk QR label</p>
                                </div>
                                <div className="relative bg-slate-900 border-4 border-gray-900 rounded-3xl overflow-hidden mb-6 aspect-square w-full sm:w-80 shadow-inner group">
                                    <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
                                    <canvas ref={canvasRef} className="hidden" />

                                    {!scanning && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10 transition-all group-hover:bg-black/50">
                                            <button onClick={startCamera} className="bg-white text-primary px-8 py-4 rounded-2xl font-black shadow-xl hover:scale-105 active:scale-95 transition-all flex flex-col items-center gap-2">
                                                <ScanLine size={32} className="text-accent" /> <span className="uppercase tracking-widest text-[10px]">Tap to Start</span>
                                            </button>
                                        </div>
                                    )}
                                    {scanning && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/10">
                                            <div className="relative w-48 h-48 sm:w-56 sm:h-56">
                                                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent rounded-tl-lg" />
                                                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent rounded-tr-lg" />
                                                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent rounded-bl-lg" />
                                                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent rounded-br-lg" />
                                                <div className="absolute top-0 bottom-0 left-0 right-0 bg-accent/10 scan-line animate-scanLine" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {scanning && <button onClick={stopCamera} className="bg-red-50 text-red-600 px-6 py-2 rounded-xl text-sm font-bold border border-red-200 shadow-sm hover:bg-red-100 transition-colors">Abort Scanner</button>}
                            </div>
                        )}

                        {tab === 'manual' && (
                            <form onSubmit={handleManualSubmit} className="space-y-6">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-black text-primary drop-shadow-sm">Manual Lookup</h2>
                                    <p className="text-gray-500 font-medium text-sm mt-1">Enter the tracking ID directly</p>
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-widest font-black text-gray-400 mb-2">Tracking ID / Code</label>
                                    <input value={manualId} onChange={e => setManualId(e.target.value)}
                                        placeholder="e.g. OPEN-AB12CD34"
                                        className="w-full border-2 border-gray-200 bg-gray-50 rounded-2xl px-5 py-4 text-base focus:outline-none focus:ring-4 focus:ring-accent/20 focus:border-accent font-mono font-bold text-primary transition-all shadow-inner" />
                                </div>
                                <button type="submit" className="w-full bg-primary text-white py-4 rounded-2xl font-black text-lg hover:bg-secondary hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all shadow-md mt-2 flex justify-center items-center gap-2">
                                    Search Database <ArrowRight size={20} />
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
