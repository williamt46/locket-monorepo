import { useState } from 'react';
import { GatewayClient, DecryptionService } from '@locket/portal-core';
import { FhirService } from '@locket/fhir-formatter';

export default function App() {
    const [gatewayUrl, setGatewayUrl] = useState('http://localhost:3000');
    const [userDid, setUserDid] = useState('');
    const [recipientSecretKeyB64, setRecipientSecretKeyB64] = useState('');
    const [recipientPublicKeyB64, setRecipientPublicKeyB64] = useState('');
    const [decryptedData, setDecryptedData] = useState<any>(null);
    const [fhirBundle, setFhirBundle] = useState<any>(null);
    const [error, setError] = useState('');

    const handleDecrypt = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setDecryptedData(null);
        setFhirBundle(null);

        try {
            const client = new GatewayClient(gatewayUrl);
            const response = await client.requestData(userDid, recipientPublicKeyB64);

            const decryptor = new DecryptionService();
            const result = await decryptor.decryptSharedData(recipientSecretKeyB64, response);
            setDecryptedData(result);

            // Format to FHIR R4 Edge Format
            const bundle = FhirService.generateClinicalBundle(userDid, result as any);
            setFhirBundle(bundle);

        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1>Provider Portal (Minimal P7)</h1>
            <form onSubmit={handleDecrypt} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px' }}>
                <input
                    type="text"
                    placeholder="Gateway URL (http://localhost:3000)"
                    value={gatewayUrl}
                    onChange={e => setGatewayUrl(e.target.value)}
                    required
                />
                <input
                    type="text"
                    placeholder="User DID"
                    value={userDid}
                    onChange={e => setUserDid(e.target.value)}
                    required
                />
                <input
                    type="text"
                    placeholder="Recipient Public Key (Base64)"
                    value={recipientPublicKeyB64}
                    onChange={e => setRecipientPublicKeyB64(e.target.value)}
                    required
                />
                <input
                    type="text"
                    placeholder="Recipient Secret Key (Base64)"
                    value={recipientSecretKeyB64}
                    onChange={e => setRecipientSecretKeyB64(e.target.value)}
                    required
                />
                <button type="submit">Request & Decrypt</button>
            </form>

            {error && <div style={{ color: 'red', marginTop: '1rem' }}>{error}</div>}

            {decryptedData && (
                <div style={{ marginTop: '2rem' }}>
                    <h2>Decrypted Raw Data</h2>
                    <pre style={{ background: '#f5f5f5', padding: '1rem' }}>
                        {JSON.stringify(decryptedData, null, 2)}
                    </pre>
                </div>
            )}

            {fhirBundle && (
                <div style={{ marginTop: '2rem' }}>
                    <h2>FHIR Bundle (R4)</h2>
                    <pre style={{ background: '#f5f5f5', padding: '1rem' }}>
                        {JSON.stringify(fhirBundle, null, 2)}
                    </pre>
                </div>
            )}
        </div>
    );
}
