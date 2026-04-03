/**
 * FabricService — Encapsulates all Hyperledger Fabric peer communication
 * via the @hyperledger/fabric-gateway SDK.
 *
 * Connection pattern adapted from fabric-samples/asset-transfer-basic.
 */

import * as grpc from '@grpc/grpc-js';
import { connect, Contract, Gateway, Identity, Signer, signers, hash } from '@hyperledger/fabric-gateway';
import * as crypto from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

// ─── Configuration ───────────────────────────────────────────────────────────

const CHANNEL_NAME = process.env.CHANNEL_NAME || 'mychannel';
const CHAINCODE_NAME = process.env.CHAINCODE_NAME || 'basic';
const MSP_ID = process.env.MSP_ID || 'Org1MSP';

// Crypto material paths — relative to the test-network organizations dir
const CRYPTO_PATH = process.env.CRYPTO_PATH || path.resolve(
    __dirname, '..', '..', '..', 'network', 'fabric-samples', 'test-network',
    'organizations', 'peerOrganizations', 'org1.example.com'
);

const KEY_DIR = process.env.KEY_DIRECTORY_PATH || path.resolve(
    CRYPTO_PATH, 'users', 'User1@org1.example.com', 'msp', 'keystore'
);

const CERT_DIR = process.env.CERT_DIRECTORY_PATH || path.resolve(
    CRYPTO_PATH, 'users', 'User1@org1.example.com', 'msp', 'signcerts'
);

const TLS_CERT_PATH = process.env.TLS_CERT_PATH || path.resolve(
    CRYPTO_PATH, 'peers', 'peer0.org1.example.com', 'tls', 'ca.crt'
);

const PEER_ENDPOINT = process.env.PEER_ENDPOINT || 'localhost:7051';
const PEER_HOST_ALIAS = process.env.PEER_HOST_ALIAS || 'peer0.org1.example.com';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConsentVerification {
    valid: boolean;
    kFragBase64?: string;
    delegatorPublicKeyBase64?: string;
    verifyingKeyBase64?: string;
    reason?: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

const utf8Decoder = new TextDecoder();

export class FabricService {
    private client: grpc.Client | null = null;
    private gateway: Gateway | null = null;
    private integrityContract: Contract | null = null;
    private consentContract: Contract | null = null;

    /**
     * Establish gRPC + TLS connection to the Fabric peer.
     */
    async connect(): Promise<void> {
        console.log('[FabricService] Connecting to Fabric peer...');
        console.log(`  Channel: ${CHANNEL_NAME}`);
        console.log(`  Chaincode: ${CHAINCODE_NAME}`);
        console.log(`  MSP: ${MSP_ID}`);
        console.log(`  Peer: ${PEER_ENDPOINT}`);

        // 1. gRPC TLS connection
        const tlsRootCert = await fs.readFile(TLS_CERT_PATH);
        const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);
        this.client = new grpc.Client(PEER_ENDPOINT, tlsCredentials, {
            'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
        });

        // 2. Identity from MSP signcerts
        const certPath = await this.getFirstDirFile(CERT_DIR);
        const credentials = await fs.readFile(certPath);
        const identity: Identity = { mspId: MSP_ID, credentials };

        // 3. Signer from MSP keystore
        const keyPath = await this.getFirstDirFile(KEY_DIR);
        const privateKeyPem = await fs.readFile(keyPath);
        const privateKey = crypto.createPrivateKey(privateKeyPem);
        const signer: Signer = signers.newPrivateKeySigner(privateKey);

        // 4. Connect gateway
        this.gateway = connect({
            client: this.client,
            identity,
            signer,
            hash: hash.sha256,
            evaluateOptions: () => ({ deadline: Date.now() + 5000 }),
            endorseOptions: () => ({ deadline: Date.now() + 15000 }),
            submitOptions: () => ({ deadline: Date.now() + 5000 }),
            commitStatusOptions: () => ({ deadline: Date.now() + 60000 }),
        });

        // 5. Get contract references
        const network = this.gateway.getNetwork(CHANNEL_NAME);
        this.integrityContract = network.getContract(CHAINCODE_NAME, 'IntegrityContract');
        this.consentContract = network.getContract(CHAINCODE_NAME, 'ConInSeContract');

        console.log('[FabricService] Connected ✓');
    }

    /**
     * Record a consent grant on-chain via ConInSeContract:GrantConsentEvent.
     */
    async recordConsentEvent(
        userDid: string,
        recipientPublicKey: string,
        kFragBase64: string,
        delegatorPublicKeyBase64: string,
        anchorHash: string,
        durationMinutes: number,
        verifyingKeyBase64: string
    ): Promise<string> {
        this.ensureConnected();
        const expirationMs = String(Date.now() + durationMinutes * 60 * 1000);

        console.log(`[FabricService] GrantConsentEvent: ${userDid} → ${recipientPublicKey.substring(0, 16)}...`);

        const resultBytes = await this.consentContract!.submitTransaction(
            'GrantConsentEvent',
            userDid,
            recipientPublicKey,
            kFragBase64,
            delegatorPublicKeyBase64,
            anchorHash,
            expirationMs,
            verifyingKeyBase64
        );

        const result = utf8Decoder.decode(resultBytes);
        console.log('[FabricService] Consent granted ✓');
        return result;
    }

    /**
     * Revoke consent on-chain via ConInSeContract:RevokeConsentEvent.
     */
    async revokeConsent(
        userDid: string,
        recipientPublicKey: string
    ): Promise<void> {
        this.ensureConnected();

        console.log(`[FabricService] RevokeConsentEvent: ${userDid} → ${recipientPublicKey.substring(0, 16)}...`);

        await this.consentContract!.submitTransaction(
            'RevokeConsentEvent',
            userDid,
            recipientPublicKey
        );

        console.log('[FabricService] Consent revoked ✓');
    }

    /**
     * Verify consent on-chain via ConInSeContract:VerifyConsentEvent.
     * Uses evaluateTransaction (query — no ledger commit).
     */
    async verifyConsentEvent(
        userDid: string,
        recipientPublicKey: string
    ): Promise<ConsentVerification> {
        this.ensureConnected();

        console.log(`[FabricService] VerifyConsentEvent: ${userDid} → ${recipientPublicKey.substring(0, 16)}...`);

        const resultBytes = await this.consentContract!.evaluateTransaction(
            'VerifyConsentEvent',
            userDid,
            recipientPublicKey
        );

        const result: ConsentVerification = JSON.parse(utf8Decoder.decode(resultBytes));
        console.log(`[FabricService] Consent check: valid=${result.valid}`);
        return result;
    }

    /**
     * Clean shutdown of gRPC connection.
     */
    disconnect(): void {
        if (this.gateway) {
            this.gateway.close();
            this.gateway = null;
        }
        if (this.client) {
            this.client.close();
            this.client = null;
        }
        this.integrityContract = null;
        this.consentContract = null;
        console.log('[FabricService] Disconnected');
    }

    // ─── Private Helpers ─────────────────────────────────────────────────────

    private ensureConnected(): void {
        if (!this.consentContract || !this.integrityContract) {
            throw new Error('[FabricService] Not connected. Call connect() first.');
        }
    }

    /**
     * Legacy Anchor: Create a single asset (IntegrityContract).
     */
    async createAsset(userDid: string, dataHash: string): Promise<string> {
        this.ensureConnected();
        const assetId = `anchor_${crypto.randomUUID()}`;
        const resultBytes = await this.integrityContract!.submitTransaction(
            'CreateAsset',
            assetId,
            userDid,
            dataHash
        );
        return utf8Decoder.decode(resultBytes);
    }

    /**
     * Legacy Anchor: Create a batch of assets (IntegrityContract).
     */
    async createAssetBatch(assets: Array<{ assetId?: string; userDID: string; dataHash: string }>): Promise<string> {
        this.ensureConnected();

        // Ensure every asset has an ID
        const finalAssets = assets.map(a => ({
            assetId: a.assetId || `anchor_${crypto.randomUUID()}`,
            userDID: a.userDID,
            dataHash: a.dataHash
        }));

        const resultBytes = await this.integrityContract!.submitTransaction(
            'CreateAssetBatch',
            JSON.stringify(finalAssets)
        );
        return utf8Decoder.decode(resultBytes);
    }

    /**
     * Legacy Anchor: Read an asset for verification (IntegrityContract).
     */
    async readAsset(assetId: string): Promise<any> {
        this.ensureConnected();
        const resultBytes = await this.integrityContract!.evaluateTransaction('ReadAsset', assetId);
        return JSON.parse(utf8Decoder.decode(resultBytes));
    }

    private async getFirstDirFile(dirPath: string): Promise<string> {
        const files = await fs.readdir(dirPath);
        const file = files[0];
        if (!file) {
            throw new Error(`[FabricService] No files found in: ${dirPath}`);
        }
        return path.join(dirPath, file);
    }
}
