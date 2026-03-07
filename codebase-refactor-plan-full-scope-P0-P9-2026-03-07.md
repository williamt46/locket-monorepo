# Codebase Refactor Plan — Full Scope (P0–P9)

Covering all 16 commits from `819f0806` to `823dc37` across completed phases P0–P9.

---

## Commit Inventory

| Commit | Phase | Summary |
|---|---|---|
| `823dc37` | P7, P8 | Minimal Provider + Partner portals, `@locket/portal-core` |
| `91cfb4b` | P9.1 | `CloudBackupService` Buffer strictness, `StorageService` init safety |
| `4f94da6` | P9.3 | Unmapped Clue/Flo/CSV keys → note strings |
| `dc89a40` | — | Runtime boot crash fix, UI resiliency |
| `254fbbd` | — | Remove legacy `apps/gateway` |
| `e38b8f0` | P9.1 | Crypto-engine dist rebuild |
| `d6d853a` | P9.1 | `CloudBackupService` + backup/restore UI |
| `6a63cad` | — | Gitignore + agent rules |
| `f866dd9` | P6 | `SyncService`, `ConsentScreen`, QR camera |
| `630bc37` | P9.2 | `ImportService` pipeline (Clue/Flo/CSV) |
| `df91617` | — | Release tag v0.9.1 |
| `5e96fe3` | — | Housekeeping |
| `93b8ec5` | P4 | ConInSe smart contracts |
| `f97c1b5` | — | iOS/Android build error fixes |
| `c6c1978` | — | Rename substack-series HTML |
| `99f2f64` | — | Editorial board HTML page |

---

## Proposed Refactor Targets

### 1. Handoff Document Consolidation

12 handoff docs scattered across 4 `brain/` dirs + repo root with inconsistent casing.

**Action:**
- Create `docs/handoffs/`
- **Copy** all handoffs to `docs/handoffs/handoff_P{N}.md` (lowercase, consistent)
- Do NOT delete originals from `brain/`
- Update all links in `phase_registry.md`

---

### 2. StorageService: JS → TS Migration

`StorageService.js` (65 lines) — only `.js` service in a TS codebase.

**Action:** Rename to `.ts`, add types, update imports.

---

### 3. LedgerScreen Decomposition (594 lines)

**Action:**
- Extract `LedgerHeaderActions` component (EXPORT, RESTORE, IMPORT)
- **RESET moved to overflow menu** (less visible)
- Extract `usePredictions()` custom hook

---

### 4. Test Organization

8 mobile test files flat in `__tests__/` (except `services/SyncService.test.ts`).

**Action:** Reorganize: `__tests__/models/`, `__tests__/services/`, `__tests__/import/`.

---

### 5. Phase Registry Accuracy Audit

**Action:** Standardize all handoff links to `docs/handoffs/`. Fix P7/P8 Conv ID (registry says `1c0df022`, handoffs live in `f8e465d6`).

---

### 6. Dev Artifact Cleanup

| File | Action |
|---|---|
| `dev_logs.txt` (23KB) | **Delete** |
| `implementation_plan_v0.9.1.md` | **Delete** |
| `verify-batch.js` | Move to `scripts/` |
| `verify-flow.js` | Move to `scripts/` |

---

### 7. Docs Directory

Create `docs/handoffs/` only (no future placeholder dirs).

---

## P10 E2E Verification Tests (TDD)

All tests written **RED first** per the TDD skill. The test file is created before any P10 production code.

> [!IMPORTANT]
> Each test below calls real service methods with real WASM crypto. No mocks except for network I/O (`fetch`) and Fabric (`FabricService`).

### Test File: `packages/e2e/tests/P10.e2e.test.ts`

New `@locket/e2e` package scoped to integration verification.

---

### Domain 1: PRE Workflow Chain

Exercises the full 6-step PRE flow across `crypto-engine` → `gateway` → `portal-core`.

#### T1 — Full PRE round-trip produces identical plaintext

```
Owner encrypts payload → generates kFrag → proxy re-encrypts capsule → recipient decrypts with cFrag
Assert: decrypted output deep-equals original payload
APIs: CryptoService.{generateUserKeys, encryptLocalData, generateConsentKFrag, proxyReEncrypt, decryptAsRecipient}
```

#### T2 — DecryptionService wraps CryptoService correctly

```
Build a GatewayResponse from real PRE artifacts → call DecryptionService.decryptSharedData()
Assert: decrypted data deep-equals original payload
APIs: DecryptionService.decryptSharedData, CryptoService.*
```

#### T3 — FHIR edge-formatting produces valid R4 Bundle

```
Decrypt payload → pass to FhirService.generateClinicalBundle()
Assert: Bundle.type === 'collection', Patient identifier matches DID, Observations contain LOINC 42798-9 (cycleLength), LOINC 8339-4 (periodLength), LOINC 92656-8 (flow)
APIs: FhirService.generateClinicalBundle
```

#### T4 — Partner portal path: raw JSON, no FHIR

```
Same PRE round-trip → DecryptionService.decryptSharedData() only
Assert: output is raw JSON (no FHIR resourceType), deep-equals original
APIs: DecryptionService.decryptSharedData (no FhirService)
```

#### T5 — Anchor hash is deterministic across encrypt cycles

```
Encrypt same payload twice with same key
Assert: both anchorHash values are identical (canonicalStringify determinism proof)
APIs: CryptoService.encryptLocalData, canonicalStringify
```

---

### Domain 2: Data Purity Audit

Validates data integrity across serialization, backup, and import boundaries.

#### T6 — canonicalStringify is idempotent across nested + undefined keys

```
Object with nested keys, undefined values, undefined array items
Assert: canonicalStringify(parse(canonicalStringify(obj))) === canonicalStringify(obj)
APIs: canonicalStringify
```

#### T7 — Backup envelope round-trip preserves data fidelity

```
Create realistic LedgerEntry[] with flow, symptoms, notes → encrypt → decrypt
Assert: restored events deep-equal originals (this is a unit-level purity test using crypto primitives, not RN-specific CloudBackupService)
APIs: AES-GCM-256 encrypt/decrypt cycle (portable Node.js crypto)
```

#### T8 — Clue import preserves all mapped + unmapped fields

```
Parse fixture Clue JSON → verify entries contain expected flow, symptoms, and unmapped keys in note field
Assert: no data loss, unmapped properties appear as comma-separated note strings
APIs: parseClueExport
```

#### T9 — Flo import preserves all mapped + unmapped fields

```
Parse fixture Flo JSON → verify entries
Assert: same fidelity guarantees as T8
APIs: parseFloExport
```

#### T10 — CSV import preserves all mapped + unmapped fields

```
Parse fixture CSV with mixed date formats and unknown extra columns
Assert: all dates parsed to correct timestamps, flow and symptom columns mapped, unmapped columns appear as comma-separated note strings (zero data loss)
APIs: parseCsvExport, parseDateAutoDetect
```

---

### Domain 3: Security Hardening

Validates cryptographic boundaries and failure modes.

#### T11 — Wrong recipient key fails decryption

```
Full PRE setup → attempt decryptAsRecipient with a DIFFERENT recipient secret key
Assert: throws error (WASM verification failure)
APIs: CryptoService.decryptAsRecipient
```

#### T12 — Tampered ciphertext fails decryption

```
Full PRE setup → flip one byte in ciphertextB64 → attempt decryptAsRecipient
Assert: throws error
APIs: CryptoService.decryptAsRecipient
```

#### T13 — Tampered capsule fails re-encryption

```
Full PRE setup → flip one byte in capsuleB64 → attempt proxyReEncrypt
Assert: throws error
APIs: CryptoService.proxyReEncrypt
```

#### T14 — Invalid kFrag rejected by proxy

```
Generate valid capsule → use random base64 string as kFrag → attempt proxyReEncrypt
Assert: throws error (cannot deserialize KeyFrag)
APIs: CryptoService.proxyReEncrypt
```

#### T15 — Backup integrity hash detects tampering

```
Create encrypted envelope → modify encryptedData → attempt restore
Assert: throws 'integrity hash verification failed'
APIs: AES-GCM envelope decrypt + SHA-256 hash comparison (portable Node.js crypto)
```

---

## Skills Assessment

| Skill | Rating | Role |
|---|---|---|
| **test-driven-development** | 🟢 Primary | Iron Law: all P10 tests written RED-first before any production code. Red-Green-Refactor cycle drives the entire E2E suite. |
| **kaizen** | 🟢 Primary | One smell per commit, leave code better, standardized work |
| **lint-and-validate** | 🟢 Primary | `tsc --noEmit`, `npm run test`, `npm run lint` after every step |
| **concise-planning** | 🟢 Primary | Atomic, verb-first action items per target |
| **git-pushing** | 🟡 Supporting | One conventional commit per step via `smart_commit.sh` |
| **systematic-debugging** | 🟡 Supporting | Root cause first if tests break during refactoring |

---

## Verification Plan

After each refactor step:

```bash
# Mobile (86 tests)
cd apps/mobile && npm run test

# Shared (7 tests)
cd packages/shared && npx vitest run

# Crypto-engine (13 tests)
cd packages/crypto-engine && npx vitest run

# FHIR formatter (24 tests)
cd packages/fhir-formatter && npx vitest run

# Portal-core (1 test)
cd packages/portal-core && npx vitest run

# E2E (15 tests — P10)
cd packages/e2e && npx vitest run

# Type check
cd apps/mobile && npx tsc --noEmit
```

### Manual Verification
- After handoff consolidation: confirm all `phase_registry.md` links resolve
- After StorageService migration: `tsc --noEmit` passes
- After test reorg: `vitest run` discovers all 86 mobile tests
- After cleanup: `npm run dev` starts all workspaces cleanly
