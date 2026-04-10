# TODOS

## Mobile

### P0 — Pre-existing test failure (noticed on claude/sharp-kowalevski)

**Title:** `CloudBackupService.test.ts` fails to resolve `@locket/shared`

**Error:** `Failed to resolve entry for package "@locket/shared". The package may have incorrect main/module/exports specified in its package.json.`

**File:** `apps/mobile/__tests__/services/CloudBackupService.test.ts`

**Noticed:** 2026-04-03 during Phase 6.5 ship workflow. Reproduced on base branch (`main`) — pre-existing.

**Fix:** Check `packages/shared/package.json` — verify `main` / `module` / `exports` fields are set correctly for the vitest resolution path. May need a `vitest.config.ts` alias for workspace packages.

---

## Gateway — Phase 6.5 Security Follow-ups

### P1 — Provider portal authentication on POST /api/consent/request

**Title:** `/api/consent/request` is unauthenticated — any caller can spam consent prompts

**Context:** Identified during Phase 6.5 adversarial review. The endpoint relies solely on the patient's approval as the trust barrier, plus a 50-per-userDid eviction cap. For MVP this is acceptable; for production it creates a consent-phishing and DoS vector.

**Fix:** Add provider portal API key authentication (or a signed JWT) to `POST /api/consent/request`. Define a provider registration flow separate from the patient session token system.

### P1 — Server-side denial endpoint

**Title:** Patient denial is client-only; indefinite consent requests resurface after reinstall/device wipe

**Context:** `denyRequest` in `useConsentRequests` adds to a local SecureStore ring-buffer but never signals the server. The server-side `PendingConsentRequest` remains until its `expiresAt` (or never, for `indefinite` duration). On a new device, all denied requests reappear.

**Fix:** Add `POST /api/consent/deny/:requestId` (authenticated, same auth as revoke) that removes the entry from `pendingRequests`. Call it from `denyRequest` alongside the local filter.

### P1 — Session token TTL

**Title:** Session tokens have no expiry and no revocation mechanism

**Context:** A token issued by `/api/auth/register` lives in the `sessionTokens` Map indefinitely (until server restart or 10k-token eviction). Leaked tokens grant permanent read access to the patient's pending consent list.

**Fix:** Add a TTL field to the session record (e.g., 7 days). In `GET /api/consent/pending`, reject tokens where `Date.now() - session.issuedAt > SESSION_TTL_MS`. Add `DELETE /api/auth/session` for explicit logout.

---

## Completed
