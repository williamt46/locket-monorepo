# Umbral PRE deferred to post-MVP — decision record

**Date:** 2026-07-19
**Status:** Decided and implemented. Cross-references the findings report
`docs/umbral-gpl-exposure-report-2026-07-09.md` (treated as an immutable
historical record) and the approved design
(`~/.gstack/projects/williamt46-locket-monorepo/kabst-main-design-20260718-143836.md`,
reviewed via /autoplan 2026-07-18).

## What was decided

**Defer the entire Umbral PRE / consent-sharing feature to post-MVP** rather
than rewriting the crypto for MVP. The MVP ships with zero GPL/AGPL code in
distributed client artifacts (`apps/mobile`, `apps/web`). Clinician sharing is
NOT deferred — it ships via a separate mechanism (QR one-shot encrypted-FHIR
share, MIT-licensed crypto only; see the approved design). Only the PRE
*mechanism* is deferred.

The original report's alternative (clean-room non-GPL reimplementation of the
PRE workflow) was **not** chosen for MVP — deferral is simpler and lower-risk —
but nothing here forecloses it post-MVP.

## What was deleted (recoverable from git history)

- `apps/mobile/src/screens/ConsentScreen.tsx`
- `apps/mobile/src/services/SyncService.ts` (the PRE one; `BackgroundSyncService.ts` is unrelated and untouched)
- `apps/mobile/__tests__/services/SyncService.test.ts`
- Two lines in `apps/mobile/src/navigation/AppNavigator.tsx` (the import and the `<Stack.Screen name="Consent">` registration)

This code path was already dead — nothing navigated to `Consent` — so the
deletion changes zero observable behavior. It was deleted rather than
feature-flagged because Metro bundles the *static import graph*: a runtime flag
would still compile the GPL WASM into the shipped bundle.

**Proven empirically (2026-07-19):** `strings` over the exported Hermes bundle
found 3 umbral/nucypher fingerprints before the deletion and 0 after.

## Do not resurrect `uploadBaselineCiphertext` as-is

`SyncService.uploadBaselineCiphertext()` PRE-encrypted and uploaded
baseline-shaped data. That violates architecture Invariant #7 (baseline cycle
data must never be shareable) independent of any license question. When PRE
work resumes, this method must not come back in that form.

## What was intentionally kept (not deleted)

- `packages/crypto-engine` — the GPL wrapper stays in the workspace; nothing in
  the MVP release surface imports it.
- `apps/partner-portal`, `apps/provider-portal` — standalone PRE-demo apps;
  kept in the build/lint graph for post-MVP resumption, excluded from MVP
  release scope and from the license gate. (Their local `dist/` build output
  contains the built umbral WASM; `dist` is gitignored and was never
  committed — any reuse of the portal shell for MVP surfaces requires a
  GPL-free rebuild.)
- `apps/serverless-gateway` — server-only/private GPL-3.0 use is compliant
  (never distributed). No AGPL exists anywhere in umbral-pre's chain (it has
  zero transitive dependencies).

## The CI gate

Three layers in `.github/workflows/ci.yml` (`license-gate` +
`bundle-artifact-scan`); see README "License Compliance" for the layer
rationale. The key empirical finding that shaped the design: **a metadata
scan cannot see the historical exposure.** `license-checker --start
apps/mobile` exits 0 on the pre-deletion tree, because the GPL import was
undeclared and workspace-hoisted. Only the built-artifact scan catches that
class, so the artifact scan is the authoritative layer, is self-tested (the
grep pattern is asserted against a known fingerprint, and export failure
fails the job — a broken export must never read as green).
