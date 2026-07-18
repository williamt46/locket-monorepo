# Umbral (`@nucypher/umbral-pre`) GPL-3.0 exposure — findings & remediation proposal

**Date:** 2026-07-09
**Status:** Investigation complete (tasks 1–3 of the source brief). Tasks 4–5 below are **proposals only** — nothing has been implemented or merged. Legal/security sign-off required before any code lands, per the brief.

---

## TL;DR

GPL-3.0 code **is shipping in distributed client artifacts today**, via two independent paths, both confirmed in committed source — not hypothetical:

1. **`apps/mobile` imports `@locket/crypto-engine` directly** and calls it client-side (keygen + kFrag-gen), despite `crypto-engine` not being declared anywhere in `apps/mobile/package.json`. Invisible to a manifest-based scan — exactly the blind spot the brief flagged.
2. **`apps/partner-portal` and `apps/provider-portal` already bundle Umbral's WASM binary** into their built browser assets (`dist/assets/umbral_pre_wasm-*.js` exists on disk for both today).

`apps/web` and `packages/core-crypto` are clean. The re-encryption transform is correctly confined to `apps/serverless-gateway` (server-only, GPL-compliant private use).

---

## (a) Current exposure: YES, confirmed

### 1. Mobile — undeclared workspace import (the manifest blind spot)

`apps/mobile/package.json` dependencies: `@locket/core-crypto`, `@locket/secure-storage`, `@locket/shared` — **no `@locket/crypto-engine`**. A Sonatype/npm scan of this manifest reports zero copyleft dependencies.

But committed mobile source imports it directly anyway (resolves via npm workspace hoisting):

- `apps/mobile/src/screens/ConsentScreen.tsx:5` — `import { CryptoService } from '@locket/crypto-engine'`
- `apps/mobile/src/services/SyncService.ts:1` — same import

This is a live, reachable code path (the consent-grant flow), not demo/dead code — see (b) below.

### 2. Portals — built bundles already contain the GPL WASM binary

`apps/partner-portal` and `apps/provider-portal` both depend on `@locket/portal-core` → `@locket/crypto-engine`, and both declare `vite-plugin-wasm` + `vite-plugin-top-level-await` to bundle Umbral's WASM module for in-browser decryption. Confirmed already built:

- `apps/partner-portal/dist/assets/umbral_pre_wasm-B_vHRLFz.js`
- `apps/provider-portal/dist/assets/umbral_pre_wasm-B_vHRLFz.js`

### Clean workspaces

- **`apps/web`** — no dependency on `portal-core` or `crypto-engine`; zero `umbral` references anywhere in source or manifest.
- **`packages/core-crypto`** — depends only on `@locket/shared` + peer dep `react-native-quick-crypto`. This is the AES-256-GCM/HKDF/Argon2id primitive for ledger/backup/baseline encryption — confirmed structurally unrelated to Umbral, as the brief assumed.

Independently confirmed: `node_modules/@nucypher/umbral-pre/package.json` declares `"license": "GPL-3.0-only"`, `"version": "0.10.0"` — matches the audit exactly.

---

## (b) Which workspace calls each Umbral operation

| Operation | Needs secret key? | Called from | Evidence |
|---|---|---|---|
| **Keygen** — `generateUserKeys()` | generates the private key | **`apps/mobile`** (client) | [`ConsentScreen.tsx:109-114`](apps/mobile/src/screens/ConsentScreen.tsx:109) — lazily generates a PRE keypair on first consent action, stores it in Expo `SecureStore` |
| **kFrag-gen** — `generateConsentKFrag()` | needs delegator's private key | **`apps/mobile`** (client) | [`SyncService.ts:61`](apps/mobile/src/services/SyncService.ts:61), inside `grantAccess()` — the live share/consent-grant flow |
| **Re-encryption transform** — `proxyReEncrypt()` | no secret key needed | **`apps/serverless-gateway`** (correct location) | [`index.ts:132`](apps/serverless-gateway/src/index.ts:132); module loaded dynamically at `index.ts:212-225` |

Two operations outside the brief's named three, also GPL-dependent, also client-side:

- `encryptLocalData()` — **`apps/mobile`**, [`SyncService.ts:24`](apps/mobile/src/services/SyncService.ts:24)
- `decryptAsRecipient()` — **`apps/partner-portal`** + **`apps/provider-portal`**, via [`packages/portal-core/src/DecryptionService.ts:18`](packages/portal-core/src/DecryptionService.ts:18), invoked at `App.tsx:21` (partner) / `App.tsx:24` (provider)

`decryptOriginalData()` (owner self-decrypt) is defined in `CryptoService.ts` but has no call site in the repo today — not a current exposure vector.

## Task 3 — urgent flag: **triggered**

Both keygen and kFrag-gen — the two operations the brief names as requiring the private key — are called from `apps/mobile` today, in a live, reachable path. This is GPL-3.0 code shipping inside the distributed mobile binary right now.

Separately (outside the literal trigger condition, but the same underlying risk the brief's background section calls "arguably" a conveyance trigger): `apps/partner-portal` and `apps/provider-portal` are already building the GPL WASM binary into their browser bundles, confirmed via built artifacts, not just source imports. Treat this as equally urgent.

One nuance from the existing architecture notes: on iOS, `generateUserKeys()`/`generateConsentKFrag()` currently fail at *runtime* (a known, separately-tracked `WebAssembly.instantiate()` failure on Hermes). That doesn't change the license analysis — the GPL module is still compiled into the shipped JS bundle regardless of whether it executes successfully on that OS.

---

## (c) Proposed architecture split (task 4 — not implemented)

1. **Keygen + kFrag-gen + local encrypt move client-side, off `@nucypher/umbral-pre`.**
   `generateUserKeys()`, `generateConsentKFrag()` (threshold=1/shares=1), and `encryptLocalData()` are the academic Umbral construction, not NuCypher's protected code expression — a from-scratch TS implementation against the published scheme, or a permissively-licensed library if one exists, avoids the dependency entirely. **A short research spike to check for an existing permissive library should happen before committing to a rewrite** — not yet done, out of scope for tasks 1–3.
   Files to change: split these three methods out of `packages/crypto-engine/src/CryptoService.ts` into a new non-GPL module (e.g. `packages/crypto-engine-client`), then repoint the imports in `apps/mobile/src/screens/ConsentScreen.tsx` and `apps/mobile/src/services/SyncService.ts`.

2. **Re-encryption stays exactly where it is.** `apps/serverless-gateway`'s `proxyReEncrypt()` (`index.ts:132`) already satisfies GPL-3.0's private/network-use allowance — no change needed, as long as the compiled gateway is never distributed to end users (it isn't).

3. **Decrypt operations need the same treatment as keygen/kFrag-gen.** `decryptOriginalData()` and `decryptAsRecipient()` both need Capsule/cFrag deserialization and are client-side by design (portals decrypt in-browser so the gateway never assembles plaintext). `decryptAsRecipient()` is already built into the partner/provider portal bundles today (see (a)) — this needs to move to the same non-GPL client module as #1.

4. **No private-key transmission required by this split.** Confirmed: `proxyReEncrypt(capsuleB64, kfragB64)` takes no secret-key parameter (`CryptoService.ts:195-198`) — as long as keygen/kFrag-gen stay client-side (as proposed), the gateway never sees key material, by construction. Note: a demo-only server-side kFrag-delegation fallback (routing around the open iOS WASM bug) is documented in local architecture notes as explicitly fenced and **not present** in committed `apps/serverless-gateway/src/index.ts` — this remediation should ensure that path is never promoted to production, since sending kFrag material to the gateway would be a separate, worse problem than the license issue.

## (d) Draft CI license gate (task 5 — not implemented)

No Sonatype or license-scan config exists in-repo today — the only CI workflow is `.github/workflows/ci.yml` (build/lint/test, no license step). The original audit was run externally. Draft addition, scoped to only the four client-runtime workspaces:

```yaml
  license-gate:
    name: Copyleft license gate (client workspaces)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 24, cache: npm }
      - run: npm ci
      - name: Fail on copyleft deps reachable from shipped client workspaces
        run: |
          FAIL_ON="GPL-1.0;GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0;LGPL-2.0;LGPL-2.1;LGPL-3.0"
          npx license-checker --production --failOn "$FAIL_ON" --start apps/mobile
          npx license-checker --production --failOn "$FAIL_ON" --start apps/web
          npx license-checker --production --failOn "$FAIL_ON" --start apps/partner-portal
          npx license-checker --production --failOn "$FAIL_ON" --start apps/provider-portal
```

Notes:

- `apps/serverless-gateway` (and any other server-only workspace) is deliberately exempt — private/network use is GPL-3.0-compliant.
- `--start <path>` walks the workspace's actual *resolved* dependency tree, including hoisted workspace-protocol packages — this is what would have caught the `apps/mobile` → `crypto-engine` gap a manifest-only scan missed. That property is the point of this gate.
- **This will fail immediately if merged before (c) lands** — right now it would correctly fail on `apps/mobile`, `apps/partner-portal`, and `apps/provider-portal` given the findings above. Sequence it with or after the remediation, not before.
- Worth checking separately whether the org's Sonatype Lifecycle policy (if any) already has a "block PR" toggle in its own dashboard — that config wouldn't be visible from this repo, so I can't confirm either way.

---

## Next steps

No code was changed in this investigation, per the brief. Per this repo's own change-control conventions (`locket-change-control`), anything touching the PRE/consent surface — which (c) does — needs a locked plan doc (brainstorm → `docs/local-only/*.private.md` plan → eng/design review → lock → implement) before coding starts, not just a go-ahead. Recommend that as the next step once (a)–(d) above get sign-off.
