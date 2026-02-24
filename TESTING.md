# Locket Testing & Verification Guide

This document consolidates the testing workflows for the Locket MVP, categorized by test type and implementation phase.

## 🧪 Test Categories

| Type | Scope | Tool | Description |
|---|---|---|---|
| **Unit** | Logic / Packages | Vitest | Validates isolated algorithms (Crypto, FHIR, UI clamping). |
| **Integration** | Network / API | Bash + Peer CLI | Validates on-chain state transitions and multi-container handshakes. |
| **E2E** | Full Workflow | Scripted | (P10) Validates the entire Sovereign Persistence path. |

---

## 🏃 Commands Reference

### 1. Global Monorepo Tests (Unit Only)
To run all package-level unit tests across the entire monorepo:
```bash
# From the root directory
npm run test
```

---

### 2. Phase-Specific Commands

#### Phase 1: PRE Cryptographic Engine
**Type:** Unit Test (WASM-based logic)
```bash
cd packages/crypto-engine
npm test
```
*Note: This validates the 6-step PRE workflow in memory using Node.js/WASM.*

#### Phase 2: FHIR Formatter
**Type:** Unit Test (Mappers)
```bash
cd packages/fhir-formatter
npm test
```
*Note: Validates Locket JSON conversion to HL7 FHIR R4 Bundles.*

#### Phase 3: Onboarding Flow
**Type:** Unit Test (Mobile State)
```bash
cd apps/mobile
npm test
```
*Note: Validates UserConfig persistence and data clamping logic.*

#### Phase 4: ConInSe Smart Contracts
**Type:** Integration Test (Blockchain)
**Prerequisite:** Network must be running (`bash deploy-conInSe.sh`)
```bash
cd network
bash tests/conInSe.test.sh
```
*Note: This invokes actual on-chain transactions to verify Grant/Verify/Revoke lifecycle.*

---

## 💡 Frequently Asked Questions

### Can I run Phase 1 tests using the Phase 4 command?
**No.** 
- **Phase 1 (`crypto-engine`)** tests are **unit tests** that run in the Node.js runtime. They don't require the blockchain.
- **Phase 4 (`conInSe`)** tests are **integration tests** that require a live Hyperledger Fabric network running in Docker.

### Why is Docker required for Phase 4?
Phase 4 tests interact with the `basic` chaincode running in a Peer node. Without the Docker containers, there is no ledger to query or invoke against.

### How do I watch for changes while developing?
For any unit test (P1, P2, P3), you can use the watch mode:
```bash
npx vitest
```
