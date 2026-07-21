# Locket Monorepo

Locket is a local-first reproductive health tracker with cryptographic sharing, blockchain-anchored consent, and privacy-preserving data export flows. The codebase combines an Expo mobile app, lightweight web portals, a serverless re-encryption gateway, Hyperledger Fabric chaincode, and shared TypeScript packages.

## Architecture

Managed with npm workspaces and Turborepo.

```text
apps/
  mobile/              Expo React Native app
  web/                 React/Vite web interface
  serverless-gateway/  Express/Fabric/PRE gateway
  provider-portal/     Vite portal for care-provider workflows
  partner-portal/      Vite portal for partner access workflows

packages/
  core-crypto/         Mobile-oriented crypto facade
  crypto-engine/       PRE and cryptographic primitives
  fhir-formatter/      HL7 FHIR export formatting
  secure-storage/      Ledger storage abstractions
  shared/              Shared types, hashing, constants, educational content
  portal-core/         Portal gateway and decryption helpers
  e2e/                 End-to-end workflow tests

network/
  chaincode/           Hyperledger Fabric consent contract
  fabric-samples/      Local Fabric network context
  tests/               Chaincode integration tests
```

## Applications

### Mobile App — `apps/mobile/`

The primary product surface. Built with Expo, React Native, React Navigation, Vitest, Expo SQLite, Expo SecureStore, and React Native Quick Crypto.

**Screens:** `LogScreen`, `AddSymptomsScreen`, `CycleInsightsScreen`, `LedgerScreen`, `ImportScreen`, `SettingsScreen`, `OnboardingScreen`, `AuthScreen`, `LogDataScreen`, `LedgerInitErrorScreen`.

Key capabilities:
- Local onboarding and encrypted local persistence
- Ledger and calendar views for health records
- Period logging, period-span logging, and per-day merge behavior
- Symptom logging across physical, mood, sex, and trigger categories
- Cycle prediction utilities, current phase detection, and cycle insight screens
- Educational content mapped into phase and symptom views
- Import support for Clue, Flo, and CSV exports, including field mapping into Locket log entries
- Cloud backup envelopes using platform-agnostic AES-GCM encryption, with an optional password-protected v2 envelope (Argon2id-derived key) that lets a backup be restored on a new device by rebinding the local master key
- Baseline cycle data (`BaselineCycleData`, formerly `UserConfig`) is HKDF-wrapped at rest and migrated automatically from the legacy plaintext entry on first launch after upgrade
- Factory reset that wipes local data and keys without resurrecting stale encrypted records

Key directories:
- `src/screens/` — app screens
- `src/components/` — shared UI (content sheets, disclaimer modals, phase cards, calendars, onboarding)
- `src/services/` — storage, sync, backup, import, blockchain, and key services
- `src/utils/PredictionEngine.ts` — cycle prediction and phase logic
- `src/models/` — user configuration, log entries, and import types
- `src/theme/` — design tokens
- `__tests__/` — unit and integration coverage for models, predictions, import parsing, services, and backup round trips

### Web App — `apps/web/`

React/Vite interface for browser-based interaction with Locket data flows. Key code under `src/`, including `LogDataScreen.jsx`, service helpers, and `main.jsx`.

### Serverless Gateway — `apps/serverless-gateway/`

Express service connecting clients to Hyperledger Fabric consent state and the PRE crypto engine.

- Fabric consent verification via `FabricService.ts`
- Proxy re-encryption request handling
- CORS and rate limiting
- Hardened async handling for proxy re-encryption

> The legacy `apps/gateway/` service was removed after February 25, 2026 to avoid port conflicts. Use `apps/serverless-gateway/` for all gateway work.

### Provider Portal — `apps/provider-portal/`

Vite/React app for provider-facing workflows. Uses `@locket/portal-core` for gateway and decryption helpers, and `@locket/fhir-formatter` for FHIR-formatted health data output. Carries the deferred Umbral PRE feature (GPL-3.0) and is outside the current MVP release scope — see `docs/umbral-pre-mvp-deferral-2026-07-19.md`.

### Partner Portal — `apps/partner-portal/`

Vite/React app for partner-facing access workflows. Uses `@locket/portal-core` for shared portal logic. Carries the deferred Umbral PRE feature (GPL-3.0) and is outside the current MVP release scope — see `docs/umbral-pre-mvp-deferral-2026-07-19.md`.

## Shared Packages

| Package | Description |
|---------|-------------|
| `@locket/core-crypto` | Mobile-oriented cryptographic service layer built around the shared data model and React Native crypto runtime |
| `@locket/crypto-engine` | Cryptographic primitives and PRE workflow support (deterministic behavior, shredding, workflow coverage) |
| `@locket/fhir-formatter` | Transforms Locket health records into HL7 FHIR R4 bundles |
| `@locket/secure-storage` | Storage abstractions for filesystem and SQLite-backed ledgers |
| `@locket/shared` | Shared types, constants, hashing utilities, and content mapping (phase/symptom content and tests) |
| `@locket/portal-core` | Shared portal utilities — gateway client behavior and decryption services |
| `@locket/e2e` | End-to-end workflow coverage across crypto, portal, FHIR, and shared packages |

## Design System

The design source of truth lives in `docs/locket-design-system/`. It contains exported HTML/CSS/JS prototypes, color and type tokens, component previews, and mobile UI kit references.

Start with `docs/locket-design-system/README.md` before implementing design-system-driven UI changes.

## Prerequisites

- Node.js 18 or newer
- npm 10.x (repo currently records `npm@10.9.4`)
- Docker Desktop and Docker Compose — required for the local Fabric network
- Xcode — required for iOS development
- Android Studio and Java 17 — required for Android development

## Installation

```bash
npm install
```

## Development

Run all workspaces through Turborepo:

```bash
npm run dev
```

Run a specific app directly:

```bash
cd apps/mobile && npm run dev
cd apps/serverless-gateway && npm run dev
cd apps/provider-portal && npm run dev
cd apps/partner-portal && npm run dev
```

## Mobile Development

### iOS Simulator

```bash
cd apps/mobile
npx expo run:ios
```

After the native app is installed, use Expo start with a cleared cache for routine development:

```bash
npx expo start -c
```

### iOS Device

1. Connect the iPhone by USB.
2. Enable Developer Mode on the iPhone.
3. Open the Xcode workspace:
   ```bash
   open apps/mobile/ios/locketapp.xcworkspace
   ```
4. In Xcode, select the `locketapp` project and configure Signing & Capabilities with your team.
5. Run:
   ```bash
   cd apps/mobile
   npx expo run:ios --device
   ```

### Android

Ensure an Android Virtual Device is running and `JAVA_HOME` points to Java 17:

```bash
cd apps/mobile
npx expo run:android
```

## Build

```bash
npm run build
```

Turborepo builds dependency packages first and writes output under `dist/` where applicable.

## Tests

Run the full monorepo test pipeline:

```bash
npm run test
```

Run targeted tests:

```bash
cd apps/mobile && npm test
cd packages/crypto-engine && npm test
cd packages/fhir-formatter && npm test
cd packages/shared && npm test
cd packages/e2e && npm test
```

Run the Fabric chaincode integration test after the network is running:

```bash
cd network
bash tests/conInSe.test.sh
```

Additional testing notes live in `TESTING.md`.

## Continuous Integration

GitHub Actions is configured in `.github/workflows/ci.yml` and runs on every push to `main` and on every pull request:

1. `npm ci`
2. `npx turbo run build` — compiles `dist/` for workspace consumers before tests run
3. `npx turbo run lint` — ESLint flat config (`eslint.config.mjs`) across workspaces with a `lint` script
4. `npx turbo run test`

The workflow calls Turbo directly (not `npm run test`) to avoid npm workspace fan-out into packages without test scripts. A new push to the same ref cancels any in-progress run for that branch.

Two license-compliance jobs run alongside `build-and-test`: `license-gate` (SPDX metadata scan + source-import scan for the MVP client workspaces) and `bundle-artifact-scan` (exports the mobile bundle and greps the built artifact for copyleft fingerprints — the authoritative check, since it sees what actually ships).

Linting uses the root `eslint.config.mjs` (ESLint 9 flat config); `apps/web` ships its own config, which takes precedence for that app.

## Blockchain Network

The local developer network uses Hyperledger Fabric.

Key files:
- `network/chaincode/index.js` — consent smart contract
- `network/install-fabric.sh` — fetch the upstream `fabric-samples` + binaries
- `network/start-network.sh` — local network bootstrap
- `network/deploy-conInSe.sh` — recovery and redeploy script

#### First-time setup (`network/fabric-samples` is not in git)

`network/fabric-samples/` is **gitignored** and not committed. It is the upstream
Hyperledger `fabric-samples` checkout plus the **generated crypto material**
(private keys, MSP certs, TLS certs) produced when you start the test network.
That material is per-machine and must never be committed, so a fresh clone will
not have it. Generate it once before starting the network:

```bash
cd network
./install-fabric.sh            # clones hyperledger/fabric-samples + downloads Fabric binaries
```

This populates `network/fabric-samples/test-network/`, which is the default
location `apps/serverless-gateway` reads crypto material from. The gateway path
is overridable via `CRYPTO_PATH` (and `KEY_DIRECTORY_PATH`, `CERT_DIRECTORY_PATH`,
`TLS_CERT_PATH`); in CI/production, set those env vars to real provisioned paths
rather than relying on the local test-network default.

Start the local network:

```bash
cd network
./start-network.sh
```

### Fresh Reset

If the network is inconsistent (stale certificates, missing chaincode namespaces, connection failures):

1. Stop all services (`Ctrl+C` in any `npm run dev` or `expo start` terminal).
2. Reset and redeploy:
   ```bash
   cd network
   bash deploy-conInSe.sh
   ```
   This removes stale Docker containers and redeploys the smart contract.
3. Restart:
   ```bash
   cd ..
   npm run dev
   ```

## Security

Locket is designed around local-first storage and explicit sharing:

- Health data is persisted locally before being shared
- Consent state is anchored in Hyperledger Fabric
- Proxy re-encryption (PRE) exists in `apps/serverless-gateway` and the portal apps, allowing gateway-mediated re-encryption without exposing plaintext to the gateway — the feature is deferred from the MVP mobile/web release surface (see `docs/umbral-pre-mvp-deferral-2026-07-19.md`); the mobile app no longer imports any PRE code
- Backup envelopes use platform-agnostic AES-GCM encryption; the password-protected v2 envelope derives its key with Argon2id and bounds KDF parameters read back from a restore file to guard against corrupted or malicious backups
- The encrypted SQLite ledger is the only supported production store — if it fails to initialize the app fails closed with `LedgerInitError` instead of silently downgrading to plaintext storage; the plaintext fallback is reachable only via the explicit `LOCKET_ALLOW_PLAINTEXT_LEDGER=1` dev/test opt-in, never auto-enabled
- Factory reset deletes local records and keys without resurrecting stale encrypted data
- `.gitignore` protects local agent tooling, generated output, and sensitive runtime material from accidental commits

### Dependency Auditing

Dependencies are continuously scanned using Sonatype OSS Index via MCP. Resolution strategy: upgrade to the latest secure versions recommended by Sonatype intelligence.

### License Compliance

CI enforces a copyleft gate on the MVP release surface (`apps/mobile`, `apps/web`). Three layers, because each catches a class the others miss: (1) the **bundle-artifact scan** exports the mobile app and runs `strings` over the Hermes bytecode looking for GPL fingerprints — this is the authoritative check and the only one that would have caught the original exposure, where `@locket/crypto-engine` (→ `@nucypher/umbral-pre`, GPL-3.0-only) reached the bundle via an **undeclared, workspace-hoisted import** invisible to metadata tools; (2) a resolved-dependency-tree scan (`npm ls --parseable` piped to `.github/scripts/check-copyleft.js`) checks every physically resolved package — workspace-hoisted ones included — for GPL/AGPL, with SPDX `OR`/`AND` expression semantics (a dual license with a permissive alternative passes with a notice), self-tested in CI against known-bad and known-good fixtures; (3) a source-import scan rejects `@locket/crypto-engine`, `@locket/portal-core`, and `@nucypher/*` imports in MVP client source (ts/tsx/js/jsx across the whole workspace dirs, grep exit codes handled fail-closed, self-tested against a planted import). `apps/serverless-gateway` is deliberately excluded (server-only/private GPL use is compliant and never distributed); `apps/partner-portal`/`apps/provider-portal` are excluded because they intentionally carry the deferred PRE feature and are outside MVP release scope. See `docs/umbral-gpl-exposure-report-2026-07-09.md` and `docs/umbral-pre-mvp-deferral-2026-07-19.md`.

### Security Patches

**January 2026**
- `body-parser` updated to `>2.2.2` (API Gateway DoS mitigation)
- `expo` SDK updated to secure patch levels
- `@react-native-community/cli` updated to `>20.0.0` (RCE mitigation)

### Vulnerability Reporting

Report security vulnerabilities directly to the maintainers. Do not disclose publicly until a patch has been released.

## Workflow Notes

- Prefer workspace scripts at the repo root for cross-package tasks
- Keep shared logic in `packages/*` and consume it via workspace dependencies
- Use `apps/serverless-gateway/` as the backend gateway; `apps/gateway/` is removed
- Use `docs/locket-design-system/` for UI implementation guidance
- Keep generated `dist/` output out of source control; some CI and local flows require packages to be built before downstream tests run
