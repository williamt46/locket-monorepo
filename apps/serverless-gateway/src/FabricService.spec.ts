import { describe, it, expect, vi } from 'vitest';
import { FabricService } from './FabricService';
import * as crypto from 'crypto';

// Mock the dependencies of FabricService
vi.mock('@hyperledger/fabric-gateway');
vi.mock('@grpc/grpc-js');
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn().mockResolvedValue('fake-cert'),
    readdir: vi.fn().mockResolvedValue(['fake-file']),
  },
}));
vi.mock('path', () => ({
  resolve: (...args: string[]) => args.join('/'),
  join: (...args: string[]) => args.join('/'),
}));

describe('FabricService Asset ID Generation', () => {
  it('should generate a UUID-based asset ID in createAsset', async () => {
    const service = new FabricService();

    // Manually set the private fields to avoid connecting to a real Fabric peer
    (service as any).integrityContract = {
      submitTransaction: vi.fn().mockResolvedValue(Buffer.from('success')),
    };
    (service as any).consentContract = {
        submitTransaction: vi.fn()
    };

    const userDid = 'did:example:123';
    const dataHash = 'some-hash';

    await service.createAsset(userDid, dataHash);

    const submitTransactionSpy = (service as any).integrityContract.submitTransaction;
    const calledAssetId = submitTransactionSpy.mock.calls[0][1];

    expect(calledAssetId).toMatch(/^anchor_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('should generate UUID-based asset IDs in createAssetBatch', async () => {
    const service = new FabricService();

    (service as any).integrityContract = {
      submitTransaction: vi.fn().mockResolvedValue(Buffer.from('success')),
    };
    (service as any).consentContract = {
        submitTransaction: vi.fn()
    };

    const assets = [
      { userDID: 'did:user1', dataHash: 'hash1' },
      { userDID: 'did:user2', dataHash: 'hash2' }
    ];

    await service.createAssetBatch(assets);

    const submitTransactionSpy = (service as any).integrityContract.submitTransaction;
    const finalAssets = JSON.parse(submitTransactionSpy.mock.calls[0][1]);

    expect(finalAssets[0].assetId).toMatch(/^anchor_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(finalAssets[1].assetId).toMatch(/^anchor_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(finalAssets[0].assetId).not.toBe(finalAssets[1].assetId);
  });
});
