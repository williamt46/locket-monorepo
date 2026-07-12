import type { LogEntry } from '../models/LogEntry';
import { inferTemperatureUnit } from './temperature';

/**
 * One-time migration for BBT values that the PRE-T4 `ledgerEntryToLogEntry`
 * baked into the free-text `note` as the substring `"BBT: {value}"` (before a
 * dedicated `LogEntry.temperature` field existed). This pulls that value out of
 * the note into `temperature` and strips the substring, leaving the rest of the
 * note text intact.
 *
 * The value was appended by the old importer via `notes.join(', ')`, so in the
 * wild the BBT token can be preceded by a `", "` join separator, but real notes
 * may also use other punctuation (e.g. `"period cramps. BBT: 36.5"`). We strip
 * the token itself and then trim only trailing *separator* punctuation
 * (whitespace, commas, semicolons) — a sentence-ending period is preserved.
 */

// Captures the numeric BBT value written by the old importer. Case-insensitive
// on the "BBT" label; accepts optional sign and a decimal fraction.
const BBT_NOTE_RE = /BBT:\s*(-?\d+(?:\.\d+)?)/i;

/** True if a note string still contains a `"BBT:"` token (any value). */
export function noteHasBbt(note?: string | null): boolean {
  if (!note) return false;
  return BBT_NOTE_RE.test(note);
}

/**
 * Parse a `"BBT: {value}"` token out of a note. Returns the numeric value and
 * the remaining note text (dangling separators cleaned up), or `null` when no
 * token is present. Pure — does not mutate its input.
 */
export function parseBbtFromNote(note: string): { value: number; rest: string } | null {
  const match = BBT_NOTE_RE.exec(note);
  if (!match) return null;

  const value = parseFloat(match[1]);
  if (!Number.isFinite(value)) return null;

  const rest = note
    .replace(BBT_NOTE_RE, '')
    // Collapse a separator left orphaned in the middle (e.g. "a, , b" -> "a, b").
    .replace(/([,;])\s*\1/g, '$1')
    // Trim leading/trailing separator punctuation, but keep a trailing period.
    .replace(/^[\s,;]+/, '')
    .replace(/[\s,;]+$/, '')
    .trim();

  return { value, rest };
}

/**
 * Migrate a single decrypted LogEntry: extract a legacy `"BBT: {value}"` note
 * token into `temperature` (magnitude-based °F/°C inference, same helper as the
 * T4 importer) and strip it from `note`. Returns a NEW entry when a change was
 * made, or `null` when the entry has no legacy BBT note (so callers can skip the
 * re-encrypt write). Idempotent: a second pass over a migrated entry finds no
 * token and returns `null`.
 *
 * If the entry already carries a `temperature` (e.g. a post-T4 import), the
 * existing value is preserved — we only strip the stray note text.
 */
export function migrateBbtInNote(entry: LogEntry): LogEntry | null {
  if (!entry.note) return null;

  const parsed = parseBbtFromNote(entry.note);
  if (!parsed) return null;

  const next: LogEntry = { ...entry };

  // Preserve an already-set temperature; only fill it from the note when absent.
  if (next.temperature == null) {
    next.temperature = { value: parsed.value, unit: inferTemperatureUnit(parsed.value) };
  }

  if (parsed.rest.length > 0) {
    next.note = parsed.rest;
  } else {
    delete next.note;
  }

  return next;
}

// ── One-shot boot orchestrator (impure) ────────────────────────────────────

const MIGRATION_FLAG_KEY = 'locket_bbt_note_migrated_v1';

// Session short-circuit so a single app launch runs the pass at most once even
// if multiple screens mount the hook. Resets on module reload (next launch), so
// a crashed pass is retried until the persisted flag is set.
let ranThisSession = false;

/** Test hook: clear the session short-circuit. */
export function resetBbtMigrationSession(): void {
  ranThisSession = false;
}

/**
 * Run the one-time BBT-note migration over the encrypted ledger. Guarded by a
 * persisted SecureStore flag so it runs once per install, and re-encrypts each
 * changed record via the same crypto path as any other edit (preserving the
 * record `id`/`status`/`assetId`, regenerating the integrity signature).
 *
 * Never throws to the caller — a failure leaves the ledger untouched and the
 * flag unset, so the pass is retried on the next launch.
 *
 * Returns the number of records rewritten (0 when nothing needed migrating or
 * the pass had already run).
 */
export async function runBbtNoteMigration(keyHex?: string): Promise<number> {
  if (ranThisSession || !keyHex) return 0;
  ranThisSession = true;

  try {
    // Lazy-load native/service deps so unit tests can exercise the pure
    // functions above without pulling in SecureStore / the ledger singleton.
    // Kept inside the try so a module-load failure (e.g. Metro's transient
    // `LoadBundleFromServerRequestError` in dev) is handled here instead of
    // rejecting to the caller — honoring the "never throws" contract above.
    const SecureStore = await import('expo-secure-store');
    const { getLedger } = await import('../services/StorageService');
    const { LocketCryptoService } = await import('@locket/core-crypto');

    const already = await SecureStore.getItemAsync(MIGRATION_FLAG_KEY);
    if (already) return 0;

    const ledger = await getLedger();
    if (ledger.init) await ledger.init();
    const events = await ledger.loadEvents();

    const crypto = new LocketCryptoService();
    let rewritten = 0;

    for (const event of events) {
      let decrypted: any;
      try {
        decrypted = await crypto.decryptData(event.payload, keyHex);
      } catch {
        // Undecryptable record (wrong key / corrupt) — leave it alone.
        continue;
      }
      if (!decrypted || typeof decrypted !== 'object') continue;

      const migrated = migrateBbtInNote(decrypted as LogEntry);
      if (!migrated) continue;

      const payload = await crypto.encryptData(migrated, keyHex);
      const signature = await crypto.generateIntegrityHash(payload);
      await ledger.saveEvent({
        id: event.id,
        ts: event.ts,
        payload,
        status: event.status,
        assetId: event.assetId,
        signature,
        isDummy: event.isDummy,
      });
      rewritten += 1;
    }

    await SecureStore.setItemAsync(MIGRATION_FLAG_KEY, '1');
    if (rewritten > 0) {
      console.log(`[BbtNoteMigration] Migrated ${rewritten} record(s) out of note text`);
    }
    return rewritten;
  } catch (e) {
    // Leave the flag unset so the pass retries next launch.
    ranThisSession = false;
    console.error('[BbtNoteMigration] migration failed; ledger left untouched', e);
    return 0;
  }
}
