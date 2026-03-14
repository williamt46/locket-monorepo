# Phase 5 Handoff: Serverless Gateway

**Status:** ✅ Complete  
**Date:** 2026-02-25  
**Conversation:** `52b72c75-edbe-4d20-ba02-088b5a721783`

---

## What Was Done

### 5.1 — Gateway Server

Created `apps/serverless-gateway/` — Express server acting as a blind PRE proxy.

| Route | Method | Behavior |
|-------|--------|----------|
| `/api/data/upload` | POST | Stores `{ ciphertextB64, capsuleB64 }` in ephemeral `Map<userDid, data>` |
| `/api/consent/grant` | POST | Records consent on-chain via `FabricService.recordConsentEvent()` |
| `/api/data/request/:did/:pk` | GET | Verify consent → PRE re-encrypt → return `{ ciphertextB64, capsuleB64, cfragB64, delegatorPublicKeyB64, verifyingKeyB64 }` |
| `/health` | GET | Returns `{ status: "ok", storage: N }` |

### 5.2 — FabricService

`apps/serverless-gateway/src/FabricService.ts` wraps `@hyperledger/fabric-gateway`:
- gRPC + TLS connection to `peer0.org1.example.com:7051`
- Identity from `User1@org1.example.com` MSP signcerts
- Uses `getContract(chaincodeName, 'ConInSeContract')` to avoid manual function prefixing
- `submitTransaction` for invokes, `evaluateTransaction` for queries

### 5.3 — P4 Chaincode Update

Added `verifyingKeyB64` as 8th parameter to `GrantConsentEvent` and included it in `VerifyConsentEvent` response. P4 integration tests updated (9/9 pass).

### 5.4 — Integration Tests (9/9 passed)

```
✓ G5.1  Server is running and healthy
✓ G5.2  Data upload returned 201
✓ G5.3  Consent grant returned 201
✓ G5.3b Consent token confirmed on-chain
✓ G5.4  Data request returned 200
✓ G5.4b cfragB64 present (re-encryption succeeded)
✓ G5.4c verifyingKeyB64 present in response
✓ G5.5  Unknown DID correctly rejected (403)
✓ G5.6  Missing fields correctly rejected (400)
```

---

## API Discoveries

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| `CryptoService.proxyReEncrypt is not a function` | P1 methods are instance methods, not static | Instantiate `new CryptoService()` |
| `head -n -1` fails on macOS | GNU extension not available | Use `sed '$d'` for portable last-line removal |
| Dummy test data fails PRE | `proxyReEncrypt` needs real Umbral capsules | Created `generate-test-data.js` for real PRE material |

---

## Files Created/Modified

| File | Action |
|------|--------|
| `apps/serverless-gateway/package.json` | **NEW** |
| `apps/serverless-gateway/tsconfig.json` | **NEW** |
| `apps/serverless-gateway/src/FabricService.ts` | **NEW** |
| `apps/serverless-gateway/src/index.ts` | **NEW** |
| `apps/serverless-gateway/tests/gateway.test.sh` | **NEW** |
| `apps/serverless-gateway/tests/generate-test-data.js` | **NEW** |
| `network/chaincode/lib/consentContract.js` | Modified — added `verifyingKeyB64` |
| `network/tests/conInSe.test.sh` | Modified — tests `verifyingKeyB64` |
| `TESTING.md` | Modified — added P5 commands |

---

## Downstream Impact

| Phase | Integration Point |
|-------|------------------|
| P6 (Mobile Sync) | `SyncService` calls `POST /api/data/upload` and `POST /api/consent/grant` |
| P7 (Provider Portal) | Calls `GET /api/data/request` → receives cfragB64 → `CryptoService.decryptAsRecipient()` |
| P8 (Partner Portal) | Same as P7 but without FHIR formatting |
