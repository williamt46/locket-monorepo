'use strict';

const { Contract } = require('fabric-contract-api');

class IntegrityContract extends Contract {

    async InitLedger(ctx) {
        // Optional: Initialize with some genesis data if needed
        console.info('============= START : Initialize Ledger ===========');
        console.info('============= END : Initialize Ledger =============');
    }

    /**
     * CreateAsset anchors a data hash to the ledger.
     * @param {Context} ctx the transaction context
     * @param {String} assetId unique identifier for this anchor (e.g. UUID or DID)
     * @param {String} userDID the Decentralized Identifier of the user
     * @param {String} dataHash the SHA-256 hash of the encrypted data
     */
    async CreateAsset(ctx, assetId, userDID, dataHash) {
        console.info('============= START : Create Asset ===========');

        const exists = await this.AssetExists(ctx, assetId);
        if (exists) {
            throw new Error(`The asset ${assetId} already exists`);
        }

        const asset = {
            assetId,
            userDID,
            dataHash,
            timestamp: ctx.stub.getTxTimestamp().seconds.low // Record block timestamp
        };

        // We explicitly DO NOT store the payload or key. 
        // Only metadata and hash.

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        console.info('============= END : Create Asset =============');
        return JSON.stringify(asset);
    }

    /**
     * ReadAsset returns the stored hash for verification.
     * @param {Context} ctx the transaction context
     * @param {String} assetId the asset to retrieve
     */
    async ReadAsset(ctx, assetId) {
        const assetJSON = await ctx.stub.getState(assetId); // get the asset from chaincode state
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`The asset ${assetId} does not exist`);
        }
        return assetJSON.toString();
    }

    /**
     * AssetExists checks if an asset exists.
     */
    async AssetExists(ctx, assetId) {
        const assetJSON = await ctx.stub.getState(assetId);
        return assetJSON && assetJSON.length > 0;
    }

    /**
     * CreateAssetBatch anchors multiple data hashes to the ledger in one transaction.
     * @param {Context} ctx the transaction context
     * @param {String} batchJSON JSON string containing array of assets [{assetId, userDID, dataHash}]
     */
    async CreateAssetBatch(ctx, batchJSON) {
        console.info('============= START : Create Asset Batch ===========');
        const assets = JSON.parse(batchJSON);
        const results = [];

        for (const assetData of assets) {
            const { assetId, userDID, dataHash } = assetData;
            const exists = await this.AssetExists(ctx, assetId);
            if (exists) {
                console.warn(`The asset ${assetId} already exists, skipping.`);
                continue;
            }

            const asset = {
                assetId,
                userDID,
                dataHash,
                timestamp: ctx.stub.getTxTimestamp().seconds.low
            };

            await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
            results.push(asset);
        }

        console.info('============= END : Create Asset Batch =============');
        return JSON.stringify(results);
    }
}

module.exports = IntegrityContract;
