import React, { useState, useEffect } from 'react';
import { generateKey, encryptData, generateIntegrityHash, exportKey, importKey } from './services/WebCryptoService';
import { saveEvent, getEvents } from './services/LocalStorageService';
import { saveKey, loadKey, deleteKey, hasKey } from './services/KeyStorageService';

const GATEWAY_URL = 'http://localhost:3000/api';

function LogDataScreen() {
    const [key, setKey] = useState(null);
    const [dataInput, setDataInput] = useState('');
    const [status, setStatus] = useState(null);
    const [loading, setLoading] = useState(false);
    const [events, setEvents] = useState([]);

    useEffect(() => {
        // Load Key or Generate New One
        const initKey = async () => {
            let k;
            if (hasKey()) {
                const jwk = loadKey();
                k = await importKey(jwk);
                console.log('Session Key Loaded from Storage');
            } else {
                k = await generateKey();
                const jwk = await exportKey(k);
                saveKey(jwk);
                console.log('New Session Key Generated & Saved');
            }
            setKey(k);
            setEvents(getEvents());
        };
        initKey();
    }, []);

    const handleLogData = async () => {
        if (!key || !dataInput) return;
        setLoading(true);
        setStatus(null);

        try {
            const payload = { event: dataInput, timestamp: Date.now() };
            const encrypted = await encryptData(payload, key);
            const integrityHash = await generateIntegrityHash(encrypted);
            const userDID = "did:test:web-user";

            const response = await fetch(`${GATEWAY_URL}/anchor`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userDID, dataHash: integrityHash })
            });

            const resJson = await response.json();
            if (!response.ok) throw new Error(resJson.error || 'Anchor failed');

            saveEvent(encrypted, resJson.assetId);
            setEvents(getEvents()); // Refresh list

            setStatus({
                type: 'success',
                message: 'Data Secured & Anchored!',
                detail: { assetId: resJson.assetId, hash: integrityHash }
            });
            setDataInput('');
        } catch (error) {
            console.error(error);
            setStatus({ type: 'error', message: 'Failed to secure data.', detail: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (assetId, localEncrypted) => {
        setLoading(true);
        setStatus(null);
        try {
            // 1. Re-calc local hash
            const localHash = await generateIntegrityHash(localEncrypted);

            // 2. Fetch remote hash
            const res = await fetch(`${GATEWAY_URL}/verify/${assetId}`);
            if (!res.ok) throw new Error('Failed to fetch from blockchain');
            const remoteAsset = await res.json();
            const remoteHash = remoteAsset.dataHash;

            // 3. Compare
            if (localHash === remoteHash) {
                setStatus({ type: 'verified', message: 'INTEGRITY VERIFIED', detail: `Blockchain Hash Matches Local Hash: ${localHash}` });
            } else {
                setStatus({ type: 'error', message: 'INTEGRITY FAILURE', detail: 'Remote hash does not match local data!' });
            }
        } catch (e) {
            setStatus({ type: 'error', message: 'Verification Error', detail: e.message });
        } finally {
            setLoading(false);
        }
    };

    const handleNukeKey = () => {
        if (window.automated_test || confirm("WARNING: Deleting the key will make all your local data permanently unrecoverable. This is cryptographically irreversible. Are you sure?")) {
            deleteKey();
            setKey(null);
            setStatus({ type: 'error', message: 'KEY DELETED', detail: 'Data is now cryptographically shredded.' });
        }
    };

    return (
        <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Locket ZK</h1>
                {key && <button onClick={handleNukeKey} style={{ width: 'auto', padding: '0.3rem', fontSize: '0.8rem', background: '#f85149' }}>Nuke Key</button>}
            </div>

            {!key ? (
                <div className="status" style={{ borderColor: '#f85149' }}>
                    <strong>Key Missing</strong>
                    <p>The encryption key has been destroyed. Local data is unrecoverable.</p>
                    <button onClick={() => window.location.reload()}>Reset / Generate New Key</button>
                </div>
            ) : (
                <>
                    <div className="input-group">
                        <label>Log Health Event</label>
                        <input type="text" value={dataInput} onChange={(e) => setDataInput(e.target.value)} placeholder="e.g. Cycle Start" />
                    </div>

                    <button onClick={handleLogData} disabled={loading || !dataInput}>
                        {loading ? 'Anchoring...' : 'Personally Lock Data'}
                    </button>

                    {status && (
                        <div className="status" style={{ borderColor: status.type === 'error' ? '#f85149' : (status.type === 'verified' ? '#238636' : '#a091ff') }}>
                            <strong>{status.message}</strong>
                            <div className="hash-display">{typeof status.detail === 'object' ? JSON.stringify(status.detail) : status.detail}</div>
                        </div>
                    )}

                    <div style={{ marginTop: '2rem' }}>
                        <label>Local Event Log (Click to Verify)</label>
                        {events.length === 0 && <p style={{ fontSize: '0.8rem', color: '#8b949e' }}>No events found.</p>}
                        {events.map((ev, i) => (
                            <div key={i} onClick={() => handleVerify(ev.assetId, ev)} style={{
                                background: '#0d1117',
                                padding: '0.8rem',
                                marginBottom: '0.5rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                border: '1px solid #30363d',
                                fontSize: '0.8rem'
                            }}>
                                <div style={{ color: '#a091ff' }}>{ev.assetId}</div>
                                <div style={{ color: '#8b949e' }}>Timestamp: {new Date(ev.timestamp).toLocaleString()}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

export default LogDataScreen;
