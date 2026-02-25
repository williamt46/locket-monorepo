# Locket Phase Registry (v0.9.1)

This registry tracks the status of each phase across different agent conversations. Agents should update this file upon phase completion.

## Execution Plan Reference

- **Full Plan:** [implementation_plan.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/implementation_plan.md)
- **Task Tracker:** [task.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/task.md)

## Phase Status

| Phase | Description | Key Deliverables | Deps | Status | Agent/Conv ID | Handoff Link |
|-------|-------------|-----------------|------|--------|---------------|--------------|
| P0 | Environment & Hardening | TrafficPadding removal, Docker/Fabric validation, test infra, **wasm2js spike** | — | [x] Complete | 52b72c75 | [handoff_P0.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/handoff_P0.md) |
| P1 | PRE Crypto Engine | `@locket/crypto-engine` (Umbral 6-step) + wasm2js build integration | P0 | [x] Complete | 52b72c75 | [handoff_P1.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/handoff_P1.md) |
| P2 | FHIR Formatter | `@locket/fhir-formatter` (LOINC/SNOMED mapping) | P0 | [x] Complete | aaf7cc20 | [handoff_P2.md](file:///Users/kabst/.gemini/antigravity/locket-monorepo/handoff_P2.md) |
| P3 | Onboarding Flow | 4-step wizard, `UserConfig`, clamping (period 1–20, cycle 10–100) | P0 | [x] Complete | 6c2d09c9 | [handoff_P3.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/handoff_P3.md) |
| P4 | ConInSe Contracts | Chaincode: Grant/Verify/Revoke on Fabric | P0, P1 | [x] Complete | 52b72c75 | [handoff_P4.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/handoff_P4.md) |
| P5 | Serverless Gateway | Express PRE proxy + `FabricService` (`@hyperledger/fabric-gateway`) | P1, P4 | [x] Complete | 52b72c75 | [handoff_P5.md](file:///Users/kabst/.gemini/antigravity/brain/52b72c75-edbe-4d20-ba02-088b5a721783/handoff_P5.md) |
| P6 | Mobile Sync + QR | `SyncService`, full camera QR scanner (`expo-camera`) | P3, P5 | [ ] Blocked | - | - |
| P7 | Provider Portal | **Vite React** + `vite-plugin-wasm`, FHIR edge-formatting | P1, P2, P5 | [ ] Blocked | - | - |
| P8 | Partner Portal | **Vite React** + `vite-plugin-wasm`, relational phase calc (NO FHIR) | P1, P5 | [ ] Blocked | - | - |
| P9 | Sovereign Persistence | AES-GCM-256 cloud backup, Clue/Flo import | P3 | [ ] Blocked | - | - |
| P10 | E2E Integration | Full PRE workflow script, security hardening, data purity audit | All | [ ] Blocked | - | - |

## WASM Strategy

| Component | Runtime | Strategy |
|-----------|---------|----------|
| Mobile App | Hermes | `wasm2js` conversion (validated in P0.5) |
| Provider Portal | Browser | `vite-plugin-wasm` (native WASM) |
| Partner Portal | Browser | `vite-plugin-wasm` (native WASM) |
| Serverless Gateway | Node.js | Native WASM |

## Parallelization

Phases **P1, P2, P3** can run in parallel after P0 completes. P5 requires both P1 and P4.

> [!TIP]
> **Status Codes:** `[ ] Pending`, `[/] In Progress`, `[x] Completed`, `[!] Blocked`.
> When a phase is completed, ensure the `Handoff Link` points to a `handoff_PX.md` file in the `brain/` directory.
