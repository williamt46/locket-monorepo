# Changelog

All notable changes to Locket are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## [0.1.0.0] - 2026-04-03

### Added

**Reversed QR Consent (Phase 6.5)** — Patient shows QR, provider scans to request access. Eliminates camera permission on the patient device.

- **Patient QR share** — `ConsentScreen` now shows a QR code encoding the patient's public DID. No camera, no permission prompt. Includes a Share Link button for desktop providers.
- **Consent request inbox** — Two-tab layout (Share / Requests). Providers submit requests via their portal; patients see them in the Requests tab with approve/deny controls.
- **ConsentReviewCard** — Duration pills (24h/7d/30d/Indefinite), permanent-access warning, success animation, haptic feedback on grant/deny, accessibility labels.
- **Active consent management** — `SharedWithSection` on the Ledger screen shows all active consents with countdown badges, one-tap revocation, and inline confirmation.
- **Session-token auth for polling** — `POST /api/auth/register` issues a UUID session token; `GET /api/consent/pending` requires it. Prevents metadata leakage across patient DIDs.
- **Pending request management** — `POST /api/consent/request` stores requests with per-userDid eviction cap (50 entries); `POST /api/consent/revoke` logs on-chain before removing from memory.
- **Provider portal** — Consent request form with QR auto-fill (URL params `d=` + `k=`), webcam scanner stub (jsQR), exponential-backoff retry, FHIR R4 bundle download (Story 3.3), and three error states: revoked / no data / decryption failure (Story 3.7).
- **Partner portal** — Same consent request flow with partner-appropriate copy; shows raw phase data (no FHIR).
- **Share landing page** — `apps/provider-portal/public/share.html` with UA detection: mobile → deep-link to `locket://share?d=…&k=…`; desktop → redirect to provider portal.
- **`ConsentTypes.ts`** — Single source of truth for `ConsentDuration`, `ConsentRequest`, and `ActiveConsent` types across the mobile app.

### Changed

- `SyncService.uploadBaselineCiphertext` now requires `userDid` so the gateway can index ciphertext per patient.
- `BackgroundSyncService.executeAnchorBatch` triggers a decoupled, fire-and-forget ciphertext upload after each ledger write (fixes stale-data bug on first provider access).
- `expo-camera` removed from mobile dependencies; `NSCameraUsageDescription` removed from `app.json` and `Info.plist`.
- `react-native-qrcode-svg` added (uses existing `react-native-svg` 15.12.1 peer dep).
- `sessionTokens` Map capped at 10,000 entries; `requestLog` array capped at 1,000 entries (unbounded growth fix).
- Gateway revoke route now writes on-chain before removing from in-memory state (prevents silent partial write on Fabric failure).
- `recipientPublicKeyB64` validated as non-empty base64, max 512 chars, on `POST /api/consent/request`.
- Poll in `useConsentRequests` uses an in-flight guard to prevent concurrent fetch races on slow connections.

### Fixed

- `FabricService` gains `revokeConsent()` method — previously only `recordConsentEvent` and `verifyConsentEvent` existed.

