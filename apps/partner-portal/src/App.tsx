/**
 * Phase 6.5 — Partner Portal
 * Adds: consent request form, QR URL param auto-fill, webcam QR scanner stub,
 * and post-grant error states (Story 3.7). No FHIR — partner sees raw phase data only.
 */
import { useState, useEffect, useRef } from 'react';
import { GatewayClient, DecryptionService } from '@locket/portal-core';

// ─── Design Tokens (web, minimal stub) ───────────────────────────────────────
const T = {
    bg:           '#FDFBF9',
    blue:         '#006EC7',
    blueTint:     '#E5F1FA',
    terracota:    '#D1495B',
    text:         '#1A1A1A',
    placeholder:  '#8E8E93',
    inputBg:      '#F2F2F7',
    card:         '#FFFFFF',
    radius:       '12px',
    cardRadius:   '16px',
};

const VALID_DURATIONS = ['24h', '7d', '30d', 'Indefinite'] as const;
type RequestDuration = typeof VALID_DURATIONS[number];

const GATEWAY_URL = 'http://localhost:3000';

// ─── Webcam QR scanner (stub — F3) ───────────────────────────────────────────
function WebcamScanner({ onScan }: { onScan: (did: string, pk: string) => void }) {
    const videoRef    = useRef<HTMLVideoElement>(null);
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const [scanning, setScanning]     = useState(false);
    const [camError, setCamError]     = useState<string | null>(null);
    const animFrameRef = useRef<number | null>(null);

    const startCamera = async () => {
        setCamError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setScanning(true);
                requestAnimationFrame(tick);
            }
        } catch {
            setCamError('Use share link instead — camera permission denied.');
        }
    };

    const stopCamera = () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        const stream = (videoRef.current?.srcObject as MediaStream);
        stream?.getTracks().forEach(t => t.stop());
        setScanning(false);
    };

    const tick = async () => {
        const video  = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
            animFrameRef.current = requestAnimationFrame(tick);
            return;
        }
        const ctx = canvas.getContext('2d')!;
        canvas.width  = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        try {
            // @ts-ignore — jsQR optional dep
            const jsQR = (await import('jsqr')).default;
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code?.data) {
                const parsed = JSON.parse(code.data);
                if (parsed.did && parsed.pk) {
                    stopCamera();
                    onScan(parsed.did, parsed.pk);
                    return;
                }
            }
        } catch { /* parse miss — continue scanning */ }

        animFrameRef.current = requestAnimationFrame(tick);
    };

    useEffect(() => () => stopCamera(), []);

    return (
        <div style={{ marginBottom: '1rem' }}>
            {!scanning ? (
                <button
                    type="button"
                    onClick={startCamera}
                    style={btnStyle('outline')}
                >
                    📷 Scan QR Code
                </button>
            ) : (
                <div>
                    <video ref={videoRef} style={{ width: '100%', borderRadius: T.cardRadius }} />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <button type="button" onClick={stopCamera} style={{ ...btnStyle('outline'), marginTop: '0.5rem' }}>
                        Stop Camera
                    </button>
                </div>
            )}
            {camError && <p style={{ color: T.placeholder, fontSize: '12px', marginTop: '4px' }}>{camError}</p>}
        </div>
    );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function btnStyle(variant: 'primary' | 'outline'): React.CSSProperties {
    const base: React.CSSProperties = {
        borderRadius: T.radius,
        padding: '14px 20px',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        width: '100%',
        border: 'none',
    };
    if (variant === 'primary') return { ...base, backgroundColor: T.blue, color: '#fff' };
    return { ...base, backgroundColor: T.inputBg, color: T.text };
}

function inputStyle(): React.CSSProperties {
    return {
        backgroundColor: T.inputBg,
        border: 'none',
        borderRadius: T.radius,
        padding: '14px',
        fontSize: '14px',
        color: T.text,
        width: '100%',
        boxSizing: 'border-box',
    };
}

function selectStyle(): React.CSSProperties {
    return { ...inputStyle(), appearance: 'none' };
}

function errorBanner(msg: string, icon = '🔒'): React.ReactNode {
    return (
        <div style={{
            backgroundColor: T.terracota,
            color: '#fff',
            borderRadius: T.radius,
            padding: '12px',
            fontSize: '13px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
        }}>
            <span>{icon}</span>
            <span>{msg}</span>
        </div>
    );
}

function infoBanner(msg: string): React.ReactNode {
    return (
        <div style={{
            border: `1px solid ${T.blue}`,
            borderRadius: T.radius,
            padding: '12px',
            fontSize: '13px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
            color: T.text,
        }}>
            <span>⏳</span>
            <span>{msg}</span>
        </div>
    );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
    // Consent request form state
    const [displayName, setDisplayName]             = useState('');
    const [requestedDuration, setRequestedDuration] = useState<RequestDuration>('24h');
    const [requestStatus, setRequestStatus]         = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
    const [requestError, setRequestError]           = useState('');

    // Data decryption state
    const [userDid, setUserDid]                           = useState('');
    const [recipientSecretKeyB64, setRecipientSecretKeyB64] = useState('');
    const [recipientPublicKeyB64, setRecipientPublicKeyB64] = useState('');
    const [decryptedData, setDecryptedData]               = useState<any>(null);
    const [decryptError, setDecryptError]                 = useState('');
    const [decryptErrorCode, setDecryptErrorCode]         = useState<number | null>(null);
    const [qrLoaded, setQrLoaded]                         = useState(false);

    // ── Read URL params on mount (auto-fill from share link) ──────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const d = params.get('d');
        const k = params.get('k');
        if (d) { setUserDid(d); }
        if (k) {
            // Restore base64 from base64url
            const b64 = k.replace(/-/g, '+').replace(/_/g, '/');
            setRecipientPublicKeyB64(b64);
            setQrLoaded(true);
        }
    }, []);

    // ── Submit consent request ─────────────────────────────────────────────────
    const handleRequestAccess = async (e: React.FormEvent) => {
        e.preventDefault();
        setRequestStatus('submitting');
        setRequestError('');

        const durMap: Record<RequestDuration, string> = {
            '24h': '24h', '7d': '7d', '30d': '30d', 'Indefinite': 'indefinite'
        };

        const body = {
            userDid,
            recipientDID:          recipientPublicKeyB64, // use pubkey as DID proxy for MVP
            recipientPublicKeyB64,
            displayName,
            requestedDuration:     durMap[requestedDuration],
        };

        let attempt = 0;
        const delays = [1000, 2000, 4000];

        while (attempt <= 3) {
            try {
                const res = await fetch(`${GATEWAY_URL}/api/consent/request`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify(body),
                });
                if (!res.ok) {
                    const msg = await res.text();
                    throw new Error(msg || 'Request failed');
                }
                setRequestStatus('success');
                return;
            } catch (err: any) {
                if (attempt === 3) {
                    setRequestStatus('error');
                    setRequestError(err.message || 'Network error');
                    return;
                }
                await new Promise(r => setTimeout(r, delays[attempt]));
                attempt++;
            }
        }
    };

    // ── Decrypt data ──────────────────────────────────────────────────────────
    const handleDecrypt = async (e: React.FormEvent) => {
        e.preventDefault();
        setDecryptError('');
        setDecryptErrorCode(null);
        setDecryptedData(null);

        try {
            const client = new GatewayClient(GATEWAY_URL);
            const response = await client.requestData(userDid, recipientPublicKeyB64);

            const decryptor = new DecryptionService();
            const result = await decryptor.decryptSharedData(recipientSecretKeyB64, response);
            setDecryptedData(result);
        } catch (err: any) {
            const status = err?.status ?? err?.response?.status ?? null;
            setDecryptErrorCode(status);
            setDecryptError(err.message ?? 'Unknown error');
        }
    };

    // ── Render data error states (Story 3.7 — partner copy) ───────────────────
    const renderDecryptError = () => {
        if (!decryptError) return null;
        if (decryptErrorCode === 401) {
            return errorBanner('Your partner has removed your access. Ask them to share again from the Locket app.', '🔒');
        }
        if (decryptErrorCode === 404) {
            return infoBanner("No data available yet — your partner hasn't synced recently.");
        }
        return errorBanner('Decryption failed — the re-encryption keys may be mismatched. Contact support.', '⚠️');
    };

    const container: React.CSSProperties = {
        backgroundColor: T.bg,
        minHeight: '100vh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        padding: '2rem 1rem',
    };

    const card: React.CSSProperties = {
        backgroundColor: T.card,
        borderRadius: T.cardRadius,
        padding: '2rem',
        maxWidth: '480px',
        width: '100%',
        boxShadow: '0 4px 20px -2px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: 'fit-content',
    };

    return (
        <div style={container}>
            <div style={{ maxWidth: '480px', width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* ── Header ── */}
                <h1 style={{ fontSize: '24px', fontWeight: 700, color: T.text, margin: 0 }}>
                    Partner Portal
                </h1>

                {/* ── QR auto-fill confirmation chip ── */}
                {qrLoaded && (
                    <div style={{
                        backgroundColor: T.blueTint,
                        color: T.blue,
                        borderRadius: T.radius,
                        padding: '8px 12px',
                        fontSize: '12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        ✓ Loaded partner QR data
                    </div>
                )}

                {/* ── Consent Request Form ── */}
                <div style={card}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, margin: 0 }}>
                        Request Access
                    </h2>

                    {/* Webcam scanner stub (F3) */}
                    <WebcamScanner onScan={(did, pk) => {
                        setUserDid(did);
                        setRecipientPublicKeyB64(pk);
                        setQrLoaded(true);
                    }} />

                    {requestStatus === 'success' ? (
                        <div style={{
                            backgroundColor: T.blueTint,
                            borderRadius: T.cardRadius,
                            padding: '1.5rem',
                            textAlign: 'center',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.75rem',
                        }}>
                            <span style={{ fontSize: '32px' }}>🔒</span>
                            <p style={{ fontWeight: 600, color: T.text, margin: 0 }}>
                                Request sent — ask your partner to approve in their Locket app
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleRequestAccess} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <input
                                style={inputStyle()}
                                type="text"
                                placeholder="Partner DID"
                                value={userDid}
                                onChange={e => setUserDid(e.target.value)}
                                required
                            />
                            <input
                                style={inputStyle()}
                                type="text"
                                placeholder="Your Name (shown to your partner)"
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                required
                            />
                            <select
                                style={selectStyle()}
                                value={requestedDuration}
                                onChange={e => setRequestedDuration(e.target.value as RequestDuration)}
                            >
                                {VALID_DURATIONS.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>

                            {requestStatus === 'error' && errorBanner(requestError)}

                            <button
                                type="submit"
                                disabled={requestStatus === 'submitting'}
                                style={{ ...btnStyle('primary'), opacity: requestStatus === 'submitting' ? 0.6 : 1 }}
                            >
                                {requestStatus === 'submitting' ? 'Sending...' : 'Request Access'}
                            </button>
                        </form>
                    )}
                </div>

                {/* ── Data Decryption Form ── */}
                <div style={card}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, margin: 0 }}>
                        View Partner Data
                    </h2>
                    <form onSubmit={handleDecrypt} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <input style={inputStyle()} type="text" placeholder="Partner DID"
                            value={userDid} onChange={e => setUserDid(e.target.value)} required />
                        <input style={inputStyle()} type="text" placeholder="Your Public Key (Base64)"
                            value={recipientPublicKeyB64} onChange={e => setRecipientPublicKeyB64(e.target.value)} required />
                        <input style={inputStyle()} type="text" placeholder="Your Secret Key (Base64)"
                            value={recipientSecretKeyB64} onChange={e => setRecipientSecretKeyB64(e.target.value)} required />
                        <button type="submit" style={btnStyle('primary')}>Decrypt Data</button>
                    </form>

                    {renderDecryptError()}
                </div>

                {/* ── Decrypted Raw Phase Data ── */}
                {decryptedData && (
                    <div style={card}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.text, margin: 0 }}>
                            Raw Phase Data
                        </h2>
                        <pre style={{ background: T.inputBg, padding: '1rem', borderRadius: T.radius, overflow: 'auto', fontSize: '12px' }}>
                            {JSON.stringify(decryptedData, null, 2)}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}
