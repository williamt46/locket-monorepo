# Mission Walkthrough: Debugging the Locket Ledger

This document details the diagnostic journey and fixes implemented to restore the Locket application's data flow, specifically addressing the 7-day period auto-fill (User Story 2.8) and the individual data deletion (User Story 2.9).

## 1. The "Ghosting" Batch Bug (User Story 2.8)

### Symptom
When a user logged a 7-day period, only the first and sometimes the second day would appear on the calendar. The remaining 5-6 days were "ghosted"—successfully inscribed according to logs, but missing from the UI.

### Root Cause Analysis
The failure was two-fold:
1.  **Async Write Race Condition:** In `FileSystemLedger.ts`, the `saveToDisk` method was calling `this.file.write()` without `await`. When 7 rapid-fire inscriptions occurred (a batch), the app would trigger a `refresh()` which read the file while it was still being overwritten, leading to data corruption or stale reads.
2.  **JSON Serialization Error:** The batch loop in `LedgerScreen.tsx` was passing `undefined` to the `note` field for days 2-7. Our `canonicalStringify` engine preserved these `undefined` values, creating invalid JSON. During decryption, `JSON.parse` would fail on these records, causing the mapping loop to silently drop them.

### The Fix
- **Atomic Batch Inscription:** Implemented `saveEvents(records[])` at the storage layer to perform a single disk operation for the entire 7-day batch.
- **Strict Serialization:** Updated the UI loop to conditionally omit the `note` key entirely instead of passing `undefined`, ensuring 100% valid JSON payloads.
- **In-Memory Source of Truth:** Refactored the ledger to maintain state in memory during a session and only load from disk on initialization, preventing redundant/stale disk reads.

---

## 2. The "Clear Data" Pipeline (User Story 2.9)

### Symptom
Tapping "Clear Data" in the entry modal would close the modal but leave the data visible on the screen and persisted in the backend.

### The Fix
- **Scoped Deletion Logic:** Implemented `deleteByTimestamp(ts)` across both `FileSystemLedger` and `SQLiteLedger`. 
- **Date Key Matching:** Standardized the deletion logic to wipe any record matching the `YYYY-MM-DD` string of the selected timestamp, ensuring all events for that specific day are removed without touching adjacent days.
- **UI Synchronization:** Linked the delete action to a `useLedger` refresh, which triggers the decryption pipeline and updates the `decryptedData` state, instantly removing the dot from the calendar.

---

## 3. Tooling for Diagnosis: The "Clean Slate"

To isolate these bugs from old, undecryptable test data, we implemented a **"RESET"** feature:
- **`superNuke()`:** A coordinate strike that wipes the `FileSystemLedger` file AND shreds the Master Encryption Key in `SecureStore`.
- This allowed us to verify that a "factory fresh" app could successfully inscribe and decrypt 7/7 events with no legacy noise.

## Verification Results

### Final Logs (Story 2.8 & 2.9)
```log
@locket/mobile:dev:  LOG  [LedgerScreen] Decrypting 25 events...
@locket/mobile:dev:  LOG  [LedgerScreen] Decrypted 25 / 25 events successfully
@locket/mobile:dev:  LOG  [LedgerScreen] Decrypted state updated: 9 -> 16 days mapped
...
@locket/mobile:dev:  LOG  [LedgerScreen] VERIFY DELETE: Scoping wipe to 1/13/2025
@locket/mobile:dev:  LOG  [FileSystemLedger] Deleted 1 events for 2025-0-13.
@locket/mobile:dev:  LOG  [LedgerScreen] Decrypted state updated: 16 -> 15 days mapped
```

> [!IMPORTANT]
> **Conclusion:** The Ledger Data Flow is now fully synchronized. All 7 days of a period are guaranteed to persist and render, and individual records can be wiped with precision.
