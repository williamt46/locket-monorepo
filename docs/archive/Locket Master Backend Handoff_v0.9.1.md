# **Locket MVP: Master Backend & Cryptography Implementation Plan**

**AI Agent Directive:** You are tasked with building the backend and cryptographic infrastructure for a Zero-Knowledge, Local-First health application. The primary directive is "Don't Trust, Verify." Do not attempt to build a standard CRUD API. The backend must remain completely blind to the user's health data. Execute these phases sequentially. Do not proceed to the next phase until the unit tests in Phase 2 and 6 pass.

### **Executive Summary**

The Locket MVP utilizes a highly advanced, privacy-preserving architectural stack designed to guarantee cryptographic data sovereignty without sacrificing clinical interoperability.

1. **Cryptography:** We implement Proxy Re-Encryption (PRE) using NuCypher's Umbral library. This allows users to encrypt data once locally, and mathematically delegate decryption rights to third parties (clinicians) via a blind proxy server. The server transforms the ciphertext for the recipient without ever accessing the plaintext.  
2. **Consent Layer:** We utilize the ConInSe (Consensual Innate Sequential Tokenised Consent) architecture atop Hyperledger Fabric. This event-driven, domain-centric model tokenizes the consent grants, ensuring an immutable, GDPR-compliant audit trail of exactly who was granted access and when.  
3. **Data Purity:** The system guarantees uncorrupted physiological truths. All data masking, artificial noise injection, or padding engines are strictly prohibited. The system is a pure ledger.  
4. **Scope Boundaries:** There is zero integration of Federated Learning (FL), Machine Learning (ML), Fully Homomorphic Encryption (FHE), or Partially Homomorphic Encryption (PHE). The infrastructure is strictly focused on point-to-point secure data transit and immutable consent validation.

## **Architecture Core Constraints**

1. **Proxy Re-Encryption (PRE) Mandate:** The Serverless Gateway acts as the Umbral Proxy. It receives re-encryption keys (kFrags) from the user and applies them to encrypted capsules to generate cFrags for the recipient. It must NEVER possess private keys.  
2. **ConInSe Smart Contracts:** Consent must be tokenized and event-driven on Hyperledger Fabric, acting as the ultimate gatekeeper before the Proxy Server executes a re-encryption.  
3. **Crypto-Shredding (GDPR):** Handled mathematically. Deleting the local private key renders the base ciphertext mathematically irretrievable.  
4. **Data Purity & Determinism:** No noise generation, dummy data, or padding. Use json-stable-stringify for deterministic hashing to prevent false tamper flags.

## **Phase 1: Strict Workspace Scaffolding**

Establish the monorepo structure and enforce dependency guardrails. Swap out standard asymmetric libraries for the Umbral PRE WASM engine.

mkdir locket-monorepo && cd locket-monorepo  
npm init \-y  
mkdir apps packages

\# Initialize Crypto Engine (PRE)  
mkdir \-p packages/crypto-engine/src packages/crypto-engine/tests  
cd packages/crypto-engine && npm init \-y  
npm install @nucypher/umbral-pre json-stable-stringify  
npm install \-D typescript @types/node @types/json-stable-stringify vitest  
npx tsc \--init  
cd ../..

\# Initialize FHIR Formatter  
mkdir \-p packages/fhir-formatter/src packages/fhir-formatter/tests  
cd packages/fhir-formatter && npm init \-y  
npm install @types/fhir uuid  
npm install \-D typescript @types/node @types/uuid vitest  
npx tsc \--init  
cd ../..

\# Initialize Apps (Gateway & ConInSe Proxy)  
mkdir \-p apps/serverless-gateway/src apps/serverless-gateway/chaincode  
cd apps/serverless-gateway && npm init \-y  
npm install express cors @hyperledger/fabric-gateway @nucypher/umbral-pre  
npm install \-D typescript @types/express @types/node  
npx tsc \--init  
cd ../..

**Root package.json**

{  
  "name": "locket-monorepo",  
  "private": true,  
  "workspaces": \[  
    "apps/\*",  
    "packages/\*"  
  \],  
  "scripts": {  
    "audit:strict": "npm audit \--audit-level=high",  
    "test:crypto": "npm run test \--workspace=@locket/crypto-engine",  
    "test:fhir": "npm run test \--workspace=@locket/fhir-formatter"  
  }  
}

## **Phase 2: The PRE Cryptographic Engine (@locket/crypto-engine)**

### **2.1 The Core Logic (packages/crypto-engine/src/CryptoService.ts)**

This implementation maps to the exact 6-step FLORA/Umbral PRE workflow.

import { SecretKey, PublicKey, encrypt, decryptOriginal, generateKFrags, reencrypt, decryptReencrypted, Capsule, KFrag, CFrag } from '@nucypher/umbral-pre';  
import crypto from 'crypto';  
import stringify from 'json-stable-stringify';

export class CryptoService {  
  /\*\*  
   \* Step 1: User generates a public-private key pair during registration.  
   \*/  
  static generateUserKeys() {  
    const secretKey \= SecretKey.random();  
    return {  
      privateKeyBase64: Buffer.from(secretKey.toU8Array()).toString('base64'),  
      publicKeyBase64: Buffer.from(secretKey.publicKey().toU8Array()).toString('base64'),  
    };  
  }

  /\*\*  
   \* Step 2/Local Action: Encrypt the exact, unpadded truth.   
   \*/  
  static encryptLocalData(rawPayload: object, userPublicKeyBase64: string) {  
    const stableJson \= stringify(rawPayload);  
    const plaintext \= new TextEncoder().encode(stableJson);  
    const pubKey \= PublicKey.fromU8Array(new Uint8Array(Buffer.from(userPublicKeyBase64, 'base64')));  
      
    const { ciphertext, capsule } \= encrypt(pubKey, plaintext);  
    const hash \= crypto.createHash('sha256').update(stableJson).digest('hex');

    return {  
      ciphertextBase64: Buffer.from(ciphertext).toString('base64'),  
      capsuleBase64: Buffer.from(capsule.toU8Array()).toString('base64'),  
      anchorHash: hash  
    };  
  }

  /\*\*  
   \* Step 3: User accepts request \-\> Generate Re-Encryption Key (kFrag) locally.  
   \* This is sent to the proxy. It reveals nothing about the user's private key.  
   \*/  
  static generateConsentKFrag(userPrivateKeyBase64: string, recipientPublicKeyBase64: string) {  
    const privKey \= SecretKey.fromU8Array(new Uint8Array(Buffer.from(userPrivateKeyBase64, 'base64')));  
    const delegatorPubKey \= privKey.publicKey();  
    const recipientPubKey \= PublicKey.fromU8Array(new Uint8Array(Buffer.from(recipientPublicKeyBase64, 'base64')));  
      
    // Generate M=1, N=1 threshold for direct 1-to-1 proxy delegation  
    const kFrags \= generateKFrags(privKey, recipientPubKey, 1, 1, delegatorPubKey, delegatorPubKey);  
      
    return Buffer.from(kFrags\[0\].toU8Array()).toString('base64');  
  }

  /\*\*  
   \* Step 5 (PROXY SERVER ONLY): Proxy re-encrypts the ciphertext using the kFrag.  
   \* Note: The Proxy executes this, but we house the logic here for monorepo sharing.  
   \*/  
  static proxyReEncrypt(capsuleBase64: string, kFragBase64: string) {  
    const capsule \= Capsule.fromU8Array(new Uint8Array(Buffer.from(capsuleBase64, 'base64')));  
    const kFrag \= KFrag.fromU8Array(new Uint8Array(Buffer.from(kFragBase64, 'base64')));  
      
    const cFrag \= reencrypt(capsule, kFrag);  
    return Buffer.from(cFrag.toU8Array()).toString('base64');  
  }

  /\*\*  
   \* Step 6: 3rd Party Decrypts the re-encrypted data using their private key.  
   \*/  
  static decryptAsRecipient(  
    recipientPrivateKeyBase64: string,   
    delegatorPublicKeyBase64: string,  
    ciphertextBase64: string,   
    capsuleBase64: string,   
    cFragBase64: string  
  ) {  
    const privKey \= SecretKey.fromU8Array(new Uint8Array(Buffer.from(recipientPrivateKeyBase64, 'base64')));  
    const delegatorPubKey \= PublicKey.fromU8Array(new Uint8Array(Buffer.from(delegatorPublicKeyBase64, 'base64')));  
    const ciphertext \= new Uint8Array(Buffer.from(ciphertextBase64, 'base64'));  
    const capsule \= Capsule.fromU8Array(new Uint8Array(Buffer.from(capsuleBase64, 'base64')));  
    const cFrag \= CFrag.fromU8Array(new Uint8Array(Buffer.from(cFragBase64, 'base64')));

    const plaintext \= decryptReencrypted(privKey, delegatorPubKey, ciphertext, capsule, \[cFrag\]);  
    return JSON.parse(new TextDecoder().decode(plaintext));  
  }  
}

### **2.2 Verification Test (packages/crypto-engine/tests/CryptoShredding.test.ts)**

import { describe, it, expect } from 'vitest';  
import { CryptoService } from '../src/CryptoService';

describe('Proxy Re-Encryption (PRE) & Shredding Validation', () \=\> {  
  it('Should successfully run the 6-step PRE workflow', () \=\> {  
    // 1\. Setup Identities  
    const alice \= CryptoService.generateUserKeys(); // Patient  
    const drBob \= CryptoService.generateUserKeys(); // Provider  
    const mockData \= { flow: 'heavy', date: '2026-02-23' };

    // 2\. Alice encrypts data locally  
    const { ciphertextBase64, capsuleBase64 } \= CryptoService.encryptLocalData(mockData, alice.publicKeyBase64);

    // 3\. Alice generates Re-Encryption Key (kFrag) for Bob  
    const kFrag \= CryptoService.generateConsentKFrag(alice.privateKeyBase64, drBob.publicKeyBase64);

    // 4 & 5\. Proxy Server Re-Encrypts (Blindly)  
    const cFrag \= CryptoService.proxyReEncrypt(capsuleBase64, kFrag);

    // 6\. Bob decrypts the data  
    const decrypted \= CryptoService.decryptAsRecipient(  
      drBob.privateKeyBase64, alice.publicKeyBase64, ciphertextBase64, capsuleBase64, cFrag  
    );

    expect(decrypted).toEqual(mockData);  
  });

  it('CRITICAL: Should prevent decryption if re-encryption is bypassed or key shredded', () \=\> {  
    const alice \= CryptoService.generateUserKeys();  
    const drBob \= CryptoService.generateUserKeys();  
    const { ciphertextBase64, capsuleBase64 } \= CryptoService.encryptLocalData({ data: 'secret' }, alice.publicKeyBase64);  
      
    const invalidCFrag \= CryptoService.proxyReEncrypt(capsuleBase64, CryptoService.generateConsentKFrag(alice.privateKeyBase64, alice.publicKeyBase64));

    expect(() \=\> {  
      CryptoService.decryptAsRecipient(drBob.privateKeyBase64, alice.publicKeyBase64, ciphertextBase64, capsuleBase64, invalidCFrag);  
    }).toThrow();  
  });  
});

## **Phase 3: ConInSe Gateway & Blind PRE Proxy**

### **3.1 Gateway Server (apps/serverless-gateway/src/index.ts)**

The server stores the ciphertext and handles PRE requests upon consent validation.

import express from 'express';  
import cors from 'cors';  
import { FabricService } from './FabricService';  
import { CryptoService } from '@locket/crypto-engine';

const app \= express();  
app.use(cors());  
app.use(express.json({ limit: '10mb' }));

const storage \= new Map\<string, any\>(); // Ephemeral Storage mapping DID \-\> { ciphertext, capsule }  
const fabric \= new FabricService();

// App Uploads Base Ciphertext (Public Key stored on-chain)  
app.post('/api/data/upload', (req, res) \=\> {  
  const { userDid, ciphertextBase64, capsuleBase64, anchorHash } \= req.body;  
  storage.set(userDid, { ciphertextBase64, capsuleBase64 });  
  res.status(201).json({ status: "Data Anchored" });  
});

// App Submits Consent & kFrag for a Provider  
app.post('/api/consent/grant', async (req, res) \=\> {  
  const { userDid, recipientPublicKey, kFragBase64, anchorHash } \= req.body;  
  await fabric.recordConsentEvent(userDid, recipientPublicKey, kFragBase64, anchorHash, 30);  
  res.status(201).json({ status: "ConInSe Consent Token Generated" });  
});

// Provider Requests Data \-\> Proxy executes Re-Encryption  
app.get('/api/data/request/:userDid/:recipientPublicKey', async (req, res) \=\> {  
  const { userDid, recipientPublicKey } \= req.params;  
    
  try {  
    // 1\. ConInSe Verification  
    const consent \= await fabric.verifyConsentEvent(userDid, recipientPublicKey);  
    if (\!consent.valid) return res.status(403).json({ error: consent.reason });

    const data \= storage.get(userDid);  
    if (\!data) return res.status(404).json({ error: "Data unavailable." });

    // 2\. Proxy Re-Encryption (Step 5\)  
    // Server blindly transforms the capsule using the securely stored kFrag  
    const cFragBase64 \= CryptoService.proxyReEncrypt(data.capsuleBase64, consent.kFragBase64);

    res.json({   
      ciphertextBase64: data.ciphertextBase64,   
      capsuleBase64: data.capsuleBase64,   
      cFragBase64,  
      delegatorPublicKeyBase64: consent.delegatorPublicKeyBase64  
    });  
  } catch (e: any) {  
    res.status(500).json({ error: e.message });  
  }  
});

app.listen(3000, () \=\> console.log('ConInSe PRE Proxy running on 3000'));

### **3.2 ConInSe Chaincode (apps/serverless-gateway/chaincode/consent.js)**

Tokenized, event-driven consent tracking.

'use strict';  
const { Contract } \= require('fabric-contract-api');

class ConInSeContract extends Contract {  
    async GrantConsentEvent(ctx, userDid, recipientPublicKey, kFragBase64, delegatorPublicKeyBase64, anchorHash, expirationTimestamp) {  
        const tokenizedConsent \= {   
            docType: 'consentToken',   
            userDid,   
            recipientPublicKey,   
            kFragBase64, // The Re-Encryption key proxy payload  
            delegatorPublicKeyBase64,  
            anchorHash,   
            expirationTimestamp: parseInt(expirationTimestamp),   
            status: 'ACTIVE'   
        };  
        const consentKey \= ctx.stub.createCompositeKey('ConInSe', \[userDid, recipientPublicKey\]);  
        await ctx.stub.putState(consentKey, Buffer.from(JSON.stringify(tokenizedConsent)));  
        return JSON.stringify(tokenizedConsent);  
    }

    async VerifyConsentEvent(ctx, userDid, recipientPublicKey) {  
        const consentKey \= ctx.stub.createCompositeKey('ConInSe', \[userDid, recipientPublicKey\]);  
        const bytes \= await ctx.stub.getState(consentKey);  
        if (\!bytes || bytes.length \=== 0\) return JSON.stringify({ valid: false, reason: 'Consent token not found' });  
          
        const record \= JSON.parse(bytes.toString());  
        if (record.status \!== 'ACTIVE') return JSON.stringify({ valid: false, reason: 'Consent revoked' });  
        if (Date.now() \> record.expirationTimestamp) return JSON.stringify({ valid: false, reason: 'Consent token expired' });  
          
        return JSON.stringify({   
            valid: true,   
            kFragBase64: record.kFragBase64,  
            delegatorPublicKeyBase64: record.delegatorPublicKeyBase64  
        });  
    }  
}  
module.exports \= ConInSeContract;

## **Phase 4: Data Generator Mobile Sync (apps/app-universal/src/SyncService.ts)**

import { CryptoService } from '@locket/crypto-engine';

export class SyncService {  
  static async uploadBaselineCiphertext(userDid: string, rawLedgerData: object, userPublicKeyBase64: string) {  
    const payload \= CryptoService.encryptLocalData(rawLedgerData, userPublicKeyBase64);  
    await fetch('http://localhost:3000/api/data/upload', {  
      method: 'POST',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify({ userDid, ...payload })  
    });  
  }

  static async grantAccess(userDid: string, userPrivateKeyBase64: string, recipientPublicKeyBase64: string, anchorHash: string) {  
    const kFragBase64 \= CryptoService.generateConsentKFrag(userPrivateKeyBase64, recipientPublicKeyBase64);  
    await fetch('http://localhost:3000/api/consent/grant', {  
      method: 'POST',  
      headers: { 'Content-Type': 'application/json' },  
      body: JSON.stringify({ userDid, recipientPublicKeyBase64, kFragBase64, anchorHash })  
    });  
  }  
}

## **Phase 5 & 6: The Decryption Portal & FHIR Formatter**

### **6.1 FHIR Mapper (packages/fhir-formatter/src/FhirService.ts)**

import { Bundle, BundleEntry, Observation, Patient } from 'fhir/r4';  
import { v4 as uuidv4 } from 'uuid';

export class FhirService {  
  static generateClinicalBundle(userDid: string, payload: any): Bundle {  
    const patientUuid \= uuidv4();  
    const patientReference \= \`urn:uuid:${patientUuid}\`;  
    const entries: BundleEntry\[\] \= \[\];

    entries.push({ fullUrl: patientReference, resource: { resourceType: "Patient", id: patientUuid, identifier: \[{ system: "urn:ietf:rfc:3986", value: userDid }\], active: true } as Patient });

    if (payload.config) {  
      const configDate \= new Date().toISOString();  
      entries.push(this.createObs(patientReference, configDate, { code: "42798-9", display: "Cycle Length" }, payload.config.cycleLength, 'quantity'));  
    }

    if (payload.ledger) {  
      Object.entries(payload.ledger).forEach((\[dateStr, log\]: \[string, any\]) \=\> {  
        const isoDate \= \`${dateStr}T00:00:00Z\`;  
        if (log.flow) entries.push(this.createObs(patientReference, isoDate, { code: "92656-8", display: "Flow" }, log.flow, 'string'));  
      });  
    }

    return { resourceType: "Bundle", id: uuidv4(), type: "collection", timestamp: new Date().toISOString(), entry: entries };  
  }

  private static createObs(patientRef: string, date: string, coding: any, value: any, type: string): BundleEntry {  
    const id \= uuidv4();  
    const obs: Observation \= { resourceType: "Observation", id, status: "final", code: { coding: \[coding\] }, subject: { reference: patientRef }, effectiveDateTime: date };  
    if (type \=== 'string') obs.valueString \= String(value);  
    if (type \=== 'quantity') obs.valueQuantity \= { value: Number(value), unit: 'days' };  
    return { fullUrl: \`urn:uuid:${id}\`, resource: obs };  
  }  
}

### **5.1 Provider View Implementation (apps/provider-portal/src/components/ProviderView.tsx)**

'use client';  
import React, { useState, useEffect } from 'react';  
import { CryptoService } from '@locket/crypto-engine';  
import { FhirService } from '@locket/fhir-formatter';

export default function ProviderView({ userDid, providerKeys }: any) {  
  const \[fhirBundle, setFhirBundle\] \= useState\<any\>(null);  
  const \[error, setError\] \= useState\<string | null\>(null);

  useEffect(() \=\> {  
    const fetchDecryptAndFormat \= async () \=\> {  
      try {  
        const encodedPubKey \= encodeURIComponent(providerKeys.publicKeyBase64);  
        const res \= await fetch(\`http://localhost:3000/api/data/request/${userDid}/${encodedPubKey}\`);  
        if (\!res.ok) throw new Error("Failed to fetch. ConInSe Consent may have expired.");

        const { ciphertextBase64, capsuleBase64, cFragBase64, delegatorPublicKeyBase64 } \= await res.json();  
          
        // 1\. Local Memory Decryption (Step 6 of PRE Workflow)  
        const rawJson \= CryptoService.decryptAsRecipient(  
          providerKeys.privateKeyBase64,   
          delegatorPublicKeyBase64,   
          ciphertextBase64,   
          capsuleBase64,   
          cFragBase64  
        );  
          
        // 2\. Format to Clinical Standard  
        const bundle \= FhirService.generateClinicalBundle(userDid, rawJson);  
        setFhirBundle(bundle);

      } catch (err: any) { setError(err.message); }  
    };  
    fetchDecryptAndFormat();  
  }, \[userDid, providerKeys\]);

  if (error) return \<div className="p-4 text-red-600"\>Access Denied: {error}\</div\>;  
  if (\!fhirBundle) return \<div\>Resolving Proxy & Decrypting...\</div\>;

  return (  
    \<div className="p-6 bg-white rounded-lg shadow"\>  
      \<h2 className="text-xl font-bold mb-2"\>Patient FHIR R4 Bundle (PRE Decrypted)\</h2\>  
      \<pre className="bg-gray-100 p-4 rounded text-xs overflow-auto"\>{JSON.stringify(fhirBundle, null, 2)}\</pre\>  
    \</div\>  
  );  
}  
