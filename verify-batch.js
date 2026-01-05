// Using native fetch

async function testBatch() {
    console.log('--- STARTING BATCH VERIFICATION ---');
    
    const assets = [
        { userDID: 'did:locket:batch-1', dataHash: 'hash-001' },
        { userDID: 'did:locket:batch-2', dataHash: 'hash-002' },
        { userDID: 'did:locket:batch-3', dataHash: 'hash-003' }
    ];

    console.log(`[Client] Sending ${assets.length} items to batch anchor...`);
    
    const response = await fetch('http://localhost:3000/api/anchor/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets })
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Batch Anchor failed: ${err}`);
    }

    const result = await response.json();
    console.log('[Client] Batch Anchor Success!', result);

    // Verify the first one
    const assetId = result.results[0].assetId;
    console.log(`[Client] Verifying first asset in batch: ${assetId}`);
    
    const verifyRes = await fetch(`http://localhost:3000/api/verify/${assetId}`);
    const verified = await verifyRes.json();
    
    console.log('[Client] Retrieved Asset:', verified);
    if (verified.dataHash === 'hash-001') {
        console.log('SUCCESS: Batch Integrity Verified.');
    } else {
        console.log('FAILURE: Hash mismatch.');
    }
}

testBatch().catch(console.error);
