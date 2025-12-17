const crypto = require('crypto'); // Node's crypto for test script validation


const GATEWAY_URL = 'http://localhost:3000/api';

// Mimic App Encryption (AES-256-GCM)
function encrypt(text) {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(JSON.stringify({ text }), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');
    
    return {
        iv: iv.toString('hex'),
        content: encrypted,
        tag: tag,
        key: key // Return key to prove we generated it, but we won't send it
    };
}

// Mimic App Hashing
function hashData(encrypted) {
    const raw = encrypted.iv + encrypted.content + encrypted.tag;
    return '0x' + crypto.createHash('sha256').update(raw).digest('hex');
}

async function runTest() {
    console.log('--- STARTING E2E VERIFICATION ---');

    // 1. Local Encryption
    const payload = encrypt("Cycle Start 2025-01-01");
    const dataHash = hashData(payload);
    console.log(`[Client] Generated Hash: ${dataHash}`);

    // 2. Write to Blockchain
    console.log('[Client] Sending Anchor Request...');
    const writeRes = await fetch(`${GATEWAY_URL}/anchor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userDID: 'did:test:simulation',
            dataHash: dataHash
        })
    });

    if (!writeRes.ok) {
        throw new Error(`Anchor failed: ${await writeRes.text()}`);
    }

    const writeJson = await writeRes.json();
    console.log('[Client] Anchor Success!', writeJson);
    const assetId = writeJson.assetId;

    // 3. Verify from Blockchain
    console.log(`[Client] Verifying Asset: ${assetId}...`);
    const readRes = await fetch(`${GATEWAY_URL}/verify/${assetId}`);
    
    if (!readRes.ok) {
        throw new Error(`Verify failed: ${await readRes.text()}`);
    }

    const readJson = await readRes.json();
    console.log('[Client] Retrieved Asset:', readJson);

    // 4. Integrity Check
    if (readJson.dataHash === dataHash) {
        console.log('SUCCESS: Hash Matches! Zero-Knowledge Integrity Proven.');
    } else {
        console.error('FAILURE: Hash Mismatch!');
        console.error(`Expected: ${dataHash}`);
        console.error(`Received: ${readJson.dataHash}`);
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error(err);
    process.exit(1);
});
