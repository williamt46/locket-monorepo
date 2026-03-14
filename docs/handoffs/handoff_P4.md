# Phase 4 Handoff: ConInSe Smart Contracts

**Status:** ✅ Complete  
**Date:** 2026-02-24  
**Conversation:** `52b72c75-edbe-4d20-ba02-088b5a721783`

---

## What Was Done

### 4.1 — ConInSe Chaincode

Created `network/chaincode/lib/consentContract.js`, co-located with the existing `IntegrityContract` in the same CCAAS package.

| Function | Type | Description |
|----------|------|-------------|
| `GrantConsentEvent` | invoke | Creates composite key `ConInSe~[userDid, recipientPK]`, stores consent token with kFrag, delegator PK, anchor hash, expiration, `status: ACTIVE` |
| `VerifyConsentEvent` | query | Checks token existence, `ACTIVE` status, and expiration via `ctx.stub.getTxTimestamp()`. Returns kFrag + delegator PK on success |
| `RevokeConsentEvent` | invoke | Sets `status: REVOKED` — irreversible, requires new `GrantConsentEvent` to re-enable |

### 4.2 — Deployment

- Modified `network/chaincode/index.js` to register both `IntegrityContract` and `ConInSeContract`
- Created `network/deploy-conInSe.sh` — clean restart + CCAAS deployment
- Chaincode deployed as `basic` v1.0 Sequence 1 (both Org1MSP + Org2MSP approved)

### 4.3 — Integration Tests (8/8 passed)

```
✓ C4.1  Fabric network running (4 peers)
✓ C4.2  Chaincode 'basic' committed on mychannel
✓ C4.3  GrantConsentEvent executed (status 200)
✓ C4.4  VerifyConsentEvent returned valid=true
✓ C4.4b kFragBase64 correctly returned
✓ C4.5  RevokeConsentEvent executed (status 200)
✓ C4.6  Post-revocation returns valid=false
✓ C4.6b Revocation reason correctly reported
```

Test script: `network/tests/conInSe.test.sh`

---

## Key Design Decisions

1. **Co-located contracts:** Both contracts ship in the same `basic` CCAAS package. Fabric routes calls via the `ContractName:FunctionName` prefix (e.g., `ConInSeContract:GrantConsentEvent`)
2. **Composite keys:** `ConInSe~[userDid, recipientPK]` enables O(1) lookup and future range queries by `userDid`
3. **Authoritative timestamps:** `ctx.stub.getTxTimestamp()` prevents clock-drift attacks (Risk R10)
4. **kFrag on-chain:** Safe because kFrags alone cannot decrypt data — they only enable proxy capsule transformation

---

## API Discoveries

- **CCAAS container cleanup:** Stale containers from previous sessions block redeployment. Must `docker rm -f` before starting new containers
- **Fabric version mismatch:** Local binaries v2.5.0 vs Docker images v2.5.14 — works but logged as warning
- **Multi-contract invocation:** Client must prefix function name with `ContractName:` when invoking a specific contract from a multi-contract package

---

## Files Changed

| File | Action |
|------|--------|
| `network/chaincode/lib/consentContract.js` | **NEW** — ConInSe contract |
| `network/chaincode/index.js` | Modified — registers both contracts |
| `network/deploy-conInSe.sh` | **NEW** — deployment script |
| `network/tests/conInSe.test.sh` | **NEW** — integration tests |

---

## Downstream Impact (Phase 5)

The Gateway's `FabricService` will invoke:
- `ConInSeContract:GrantConsentEvent` on `POST /api/consent/grant`
- `ConInSeContract:VerifyConsentEvent` on `POST /api/data/request` (before PRE re-encryption)

The kFrag returned by `VerifyConsentEvent` is passed directly to `CryptoService.proxyReEncrypt()`.
