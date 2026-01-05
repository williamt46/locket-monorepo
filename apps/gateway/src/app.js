const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { connectToNetwork, submitTransaction, evaluateTransaction } = require('./fabricClient');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Anchor Data Hash (Zero-Knowledge Write)
// Payload: { userDID: string, dataHash: string }
app.post('/api/anchor', async (req, res) => {
    try {
        const { userDID, dataHash } = req.body;
        
        if (!userDID || !dataHash) {
            return res.status(400).json({ error: 'Missing userDID or dataHash' });
        }

        console.log(`[Anchor] Request for DID: ${userDID}, Hash: ${dataHash}`);

        // Generate a unique Asset ID (e.g., UUID-v4 like)
        const assetId = `asset-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const result = await submitTransaction('CreateAsset', assetId, userDID, dataHash);
        
        res.status(201).json({ 
            success: true, 
            assetId: assetId,
            txId: result.transactionId,
            blockHeight: result.blockHeight // Optional, if we parse it
        });

    } catch (error) {
        console.error('[Anchor Error]', error);
        res.status(500).json({ error: error.message });
    }
});

// Anchor Multiple Hashes (Batch Write)
// Payload: { assets: [{userDID, dataHash, id?}] }
app.post('/api/anchor/batch', async (req, res) => {
    try {
        const { assets } = req.body;
        
        if (!assets || !Array.isArray(assets)) {
            return res.status(400).json({ error: 'Missing or invalid assets array' });
        }

        console.log(`[AnchorBatch] Request for ${assets.length} assets`);

        const enrichedAssets = assets.map(a => ({
            assetId: a.id || `asset-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
            userDID: a.userDID,
            dataHash: a.dataHash
        }));

        const result = await submitTransaction('CreateAssetBatch', JSON.stringify(enrichedAssets));
        
        res.status(201).json({ 
            success: true, 
            txId: result.transactionId,
            results: enrichedAssets.map(a => ({ assetId: a.assetId }))
        });

    } catch (error) {
        console.error('[AnchorBatch Error]', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify Data Hash (Read)
// Params: assetID (which is the userDID for this singleton model, or a derived ID)
// For this MVP, let's assume one Asset per User for simplicity, or we use a composite key.
// Let's assume the Chaincode stores assets by "AssetID".
app.get('/api/verify/:assetId', async (req, res) => {
    try {
        const { assetId } = req.params;
        console.log(`[Verify] Query for AssetID: ${assetId}`);

        const resultJSON = await evaluateTransaction('ReadAsset', assetId);
        const result = JSON.parse(resultJSON);

        res.json(result);
    } catch (error) {
        console.error('[Verify Error]', error);
        res.status(404).json({ error: 'Asset not found or query failed' });
    }
});

app.listen(PORT, () => {
    console.log(`Locket Gateway running on http://localhost:${PORT}`);
});
