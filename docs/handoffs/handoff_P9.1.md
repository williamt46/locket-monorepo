# Handoff: Phase 9.1 (Platform-Agnostic Encrypted Backup)

## Completed Work
- [x] Defined `LocketBackupFile` envelope interface.
- [x] Implemented `CloudBackupService.ts` utilizing AES-256-GCM envelope cryptography (wrapped DEK logic).
- [x] Installed local file management APIs (`expo-sharing`, `expo-file-system`, `expo-document-picker`).
- [x] Integrated "EXPORT" and "RESTORE" actions into the `LedgerScreen` header.
- [x] Wrote comprehensive unit tests verifying deep equality, wrong key rejection, ciphertext tampering, and hash integrity tampering.
- [x] Executed Phase 9.1 Checkpoint script successfully.

## Verification Proof
```
=== Phase 9.1: Platform-Agnostic Encrypted Backup ===
[C9.1.1] Checking UX dependencies...
PASS: All Expo dependencies installed
[C9.1.2] Running Backup Service crypto tests...
 
 RUN  v4.0.18 /Users/kabst/.gemini/antigravity/locket-monorepo/apps/mobile

 ✓ __tests__/CloudBackupService.test.ts (5 tests) 7ms
   ✓ CloudBackupService envelope encryption (5)
     ✓ creates a valid .locket backup JSON 2ms
     ✓ successfully restores data with the correct master key 2ms
     ✓ fails to restore with the wrong master key 1ms
     ✓ detects tampering within the encrypted data payload 1ms
     ✓ detects tampering of the integrity hash 0ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  175ms

=== Phase 9.1: ALL CHECKPOINTS PASSED ===
```

## Context for Next Agent
- **Key Files**: 
  - `apps/mobile/src/services/CloudBackupService.ts`
  - `apps/mobile/src/screens/LedgerScreen.tsx`
  - `apps/mobile/__tests__/CloudBackupService.test.ts`
- **Bug Fixes Discovered During E2E Validation**:
  - `react-native-quick-crypto`'s JSI bridge corrupts AES-GCM ciphertext when strings are used. The implementation was rewritten to strictly enforce `Buffer` objects, avoiding AES-GCM tag validation errors. 
  - `StorageService.js` initialization race condition fixed. `rawNukeData` and `rawSaveEvents` now defensively `await initStorage()` before wiping the local SQLite database.
- **Caveats**: 
  - Restoring a backup currently acts as a full overwrite by wiping the local ledger via `rawNukeData` and injecting via `rawSaveEvents`. Selective merging is NOT implemented in Phase 9.1.
  - **P9.2 Agent Note**: The Phase 9.2 (Clue / Flo import) agent is correctly utilizing the `batchInscribe` hook (instead of `rawSaveEvents`) because they are importing raw, unencrypted source CSVs that need to be actively encrypted by the master key before hitting the local ledger, whereas P9.1 deals exclusively with moving pre-encrypted backup blobs.
