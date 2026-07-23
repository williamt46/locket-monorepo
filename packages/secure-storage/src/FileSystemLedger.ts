import { Directory, File, Paths } from 'expo-file-system';
import { LedgerStorage, StorageRecord, LedgerInitError } from './types.js';

// Sibling of events.json used for crash-safe writes. saveToDisk writes here
// first, verifies the written byte count, then atomically replaces events.json.
// If a write is interrupted, this file survives intact and loadFromDisk
// recovers the ledger from it.
const TEMP_FILE_NAME = 'events.json.tmp';

/**
 * Exact UTF-8 byte length of a JS string. `String.length` counts UTF-16 code
 * units, which undercounts every non-ASCII character — so it cannot be used to
 * verify how many bytes a write actually produced. No TextEncoder dependency:
 * it is not guaranteed on Hermes.
 */
function utf8ByteLength(s: string): number {
    let bytes = 0;
    for (let i = 0; i < s.length; i++) {
        const code = s.charCodeAt(i);
        if (code < 0x80) {
            bytes += 1;
        } else if (code < 0x800) {
            bytes += 2;
        } else if (code >= 0xd800 && code <= 0xdbff) {
            // High surrogate: with its low surrogate this is one 4-byte code point.
            bytes += 4;
            i++;
        } else {
            bytes += 3;
        }
    }
    return bytes;
}

export class FileSystemLedger implements LedgerStorage {
    private events: StorageRecord[] = [];
    private dir: Directory;
    private file: File;
    private tmpFile: File;
    private isInitialized: boolean = false;
    /**
     * Set when a ledger file was present on disk but could not be read as a
     * valid ledger and no recoverable temp backup existed. Callers must treat
     * this as fatal — we fail closed rather than silently presenting an empty
     * ledger. loadFromDisk also throws a LedgerInitError in this case.
     */
    public corrupted: boolean = false;

    constructor() {
        this.dir = new Directory(Paths.document, 'locket_ledger');
        this.file = new File(this.dir, 'events.json');
        this.tmpFile = new File(this.dir, TEMP_FILE_NAME);
    }

    async init(): Promise<void> {
        if (!this.dir.exists) {
            await this.dir.create({ intermediates: true, idempotent: true });
        }
        await this.loadFromDisk();

        // Data Migration: Ensure all records have unique IDs for anchor updates
        let migrationCount = 0;
        this.events = this.events.map(e => {
            if (!e.id) {
                migrationCount++;
                return { ...e, id: Math.random().toString(36).substring(7) + '-' + Date.now() };
            }
            return e;
        });

        if (migrationCount > 0) {
            console.log(`[FileSystemLedger] Data Migration: Assigned IDs to ${migrationCount} records`);
            await this.saveToDisk();
        }

        this.isInitialized = true;
        console.log(`[FileSystemLedger] Initialized with ${this.events.length} events`);
    }

    /**
     * Parse the given file's contents into a StorageRecord[]. Returns null when
     * the file is absent, empty/whitespace (a truncated write), or unparseable —
     * i.e. anything that is NOT a usable ledger. Never throws.
     */
    private async tryReadLedger(file: File): Promise<StorageRecord[] | null> {
        if (!file.exists) return null;
        let content: string;
        try {
            content = await file.text();
        } catch (e) {
            console.error('[FileSystemLedger] Failed to read ledger file', file.uri, e);
            return null;
        }
        if (!content || !content.trim()) return null;
        try {
            const parsed = JSON.parse(content);
            return Array.isArray(parsed) ? parsed : null;
        } catch (e) {
            console.error('[FileSystemLedger] Failed to parse ledger file', file.uri, e);
            return null;
        }
    }

    private async loadFromDisk(): Promise<void> {
        this.corrupted = false;

        // Note whether ANY ledger file exists BEFORE we try to read. This is how
        // we tell a genuine first boot (nothing on disk -> empty is correct) from
        // an interrupted/corrupt write (a file exists but won't parse -> fail
        // closed, never silently empty).
        const mainExisted = this.file.exists;
        const tmpExisted = this.tmpFile.exists;

        // 1. Primary path: read events.json.
        const fromMain = await this.tryReadLedger(this.file);
        if (fromMain) {
            this.events = fromMain;
            // Main is good — discard any stale temp from a prior interrupted write.
            if (this.tmpFile.exists) {
                try { this.tmpFile.delete(); } catch { /* best-effort cleanup */ }
            }
            return;
        }

        // 2. Recovery path: events.json is missing/truncated/corrupt. If the temp
        // file from an interrupted write survived intact, recover from it and
        // promote it to the main file so the next boot is clean.
        const fromTmp = await this.tryReadLedger(this.tmpFile);
        if (fromTmp) {
            this.events = fromTmp;
            console.warn('[FileSystemLedger] Recovered ledger from temp file after an interrupted write');
            try {
                if (this.file.exists) this.file.delete();
                this.tmpFile.move(this.file);
                // move() repoints the tmpFile instance's uri to events.json;
                // restore a temp handle for subsequent saves.
                this.tmpFile = new File(this.dir, TEMP_FILE_NAME);
            } catch (e) {
                console.error('[FileSystemLedger] Failed to promote recovered temp file', e);
            }
            return;
        }

        // 3. Nothing usable. If a file WAS present we must not zero the ledger —
        // that is exactly the silent-empty failure we are guarding against.
        if (mainExisted || tmpExisted) {
            this.corrupted = true;
            throw new LedgerInitError(
                'Ledger file present on disk but unreadable/corrupt, and no recoverable backup exists. ' +
                'Refusing to start with an empty ledger.'
            );
        }

        // 4. Genuine first boot: no main file, no temp file. Empty is correct.
        this.events = [];
    }

    /**
     * Persist `records` to disk. Callers pass the CANDIDATE state and only commit
     * it to `this.events` after this resolves — a throw here must leave the
     * in-memory ledger exactly as it was, because loadEvents serves `this.events`
     * as the source of truth and any later successful save would flush a batch
     * the caller already reported as failed.
     */
    private async saveToDisk(records: StorageRecord[] = this.events): Promise<void> {
        const serialized = JSON.stringify(records);

        // 1. Write to a temp file in the same directory. A crash here leaves the
        // real events.json untouched.
        if (this.tmpFile.exists) {
            try { this.tmpFile.delete(); } catch { /* overwrite below */ }
        }
        this.tmpFile.write(serialized);

        // 2. Verify the temp file landed COMPLETELY before letting it replace the
        // real ledger. If the write was short, abort WITHOUT touching events.json —
        // the previous good ledger stays on disk.
        //
        // We compare byte size rather than reading the file back and JSON.parsing
        // it. The readback cost 2x file I/O plus a full parse on EVERY save — paid
        // on each ordinary single-entry save, not just on imports — which is a real
        // freeze on a multi-MB ledger. A torn/short write is the failure this guard
        // exists for, and size catches exactly that at O(1).
        //
        // The expected size is the UTF-8 BYTE length, computed exactly. Comparing
        // against `serialized.length` (UTF-16 code units) would undercount by 1-2
        // bytes per non-ASCII character — note text, imported free text, emoji —
        // leaving a slack window in which a truncated write still looks complete.
        const expectedBytes = utf8ByteLength(serialized);
        const writtenBytes = this.tmpFile.size;
        if (writtenBytes === null || writtenBytes !== expectedBytes) {
            throw new Error(
                `[FileSystemLedger] Incomplete ledger write: temp file is ` +
                `${writtenBytes === null ? 'unreadable' : `${writtenBytes} bytes`}, expected ` +
                `${expectedBytes}. Refusing to replace events.json; the previous ledger is intact.`,
            );
        }

        // 3. Atomically replace events.json with the verified temp file. The tmp
        // survives the whole window, so an interrupted replace is recoverable on
        // next boot (loadFromDisk step 2).
        if (this.file.exists) {
            this.file.delete();
        }
        this.tmpFile.move(this.file);

        // move() repoints tmpFile's uri to events.json; restore a fresh temp
        // handle for the next save.
        this.tmpFile = new File(this.dir, TEMP_FILE_NAME);
    }

    async saveEvent(record: StorageRecord): Promise<void> {
        // Idempotency: Use existing ID if present, otherwise generate one
        const id = record.id || Math.random().toString(36).substring(7) + '-' + Date.now();
        const newRecord = { ...record, id };

        // Build the candidate state, persist it, and only then adopt it — a
        // failed write must not leave the record live in memory (see saveToDisk).
        const next = [...this.events];
        const index = next.findIndex(e => e.id === id);
        if (index >= 0) {
            next[index] = newRecord;
        } else {
            if (record.id) {
                console.warn(`[FileSystemLedger] Single update failed: Record ${record.id} not found.`);
            }
            next.push(newRecord);
        }
        await this.saveToDisk(next);
        this.events = next;
    }

    async saveEvents(records: StorageRecord[]): Promise<void> {
        // Build the candidate state, persist it, and only then adopt it — a failed
        // write must not leave the batch live in memory (see saveToDisk).
        const next = [...this.events];
        // Index by id once instead of a findIndex scan per record: a batch import
        // is O(records x ledgerSize) otherwise, which is millions of comparisons
        // on the JS thread for a few thousand entries.
        const indexById = new Map<string, number>();
        for (let i = 0; i < next.length; i++) {
            const existingId = next[i].id;
            if (existingId !== undefined) indexById.set(existingId, i);
        }
        for (const record of records) {
            const id = record.id || Math.random().toString(36).substring(7) + '-' + Date.now();
            const newRecord = { ...record, id };
            const index = indexById.get(id);
            if (index !== undefined) {
                next[index] = newRecord;
            } else {
                indexById.set(id, next.length);
                next.push(newRecord);
            }
        }
        await this.saveToDisk(next);
        this.events = next;
        console.log(`[FileSystemLedger] Batch saved ${records.length} events (including updates)`);
    }

    async loadEvents(): Promise<StorageRecord[]> {
        // DO NOT call loadFromDisk here. It overwrites memory with disk state.
        // In a running app, this.events is the source of truth.
        // We only load from disk on init().

        // Return latest first. If TS is equal, use array index as tie-breaker (latest index = latest insertion)
        const filtered = this.events
            .map((e, idx) => ({ ...e, _idx: idx }))
            .filter(e => !e.isDummy)
            .sort((a, b) => b.ts - a.ts || b._idx - a._idx)
            .map(({ _idx, ...e }) => e);

        return filtered;
    }

    async deleteByTimestamp(ts: number): Promise<void> {
        const date = new Date(ts);
        // Use Y-M-D string for reliable matching across day boundaries
        const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

        const initialCount = this.events.length;
        // Persist before adopting: a failed write must not drop records from the
        // running app while the caller is told nothing changed (see saveToDisk).
        const next = this.events.filter(e => {
            const d = new Date(e.ts);
            const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            return s !== dateStr;
        });

        if (next.length !== initialCount) {
            await this.saveToDisk(next);
            this.events = next;
            console.log(`[FileSystemLedger] Deleted ${initialCount - next.length} events for ${dateStr}. Remaining: ${next.length}`);
        } else {
            console.log(`[FileSystemLedger] No events found to delete for ${dateStr}`);
        }
    }

    async deleteByIds(ids: string[]): Promise<number> {
        if (!ids || ids.length === 0) return 0;
        const idSet = new Set(ids);
        const before = this.events.length;
        // Persist before adopting: a failed write must not make the records vanish
        // from the running app while the caller reports the purge failed, only for
        // them to return on the next launch (see saveToDisk).
        const next = this.events.filter(e => !e.id || !idSet.has(e.id));
        const removed = before - next.length;
        if (removed > 0) {
            await this.saveToDisk(next);
            this.events = next;
            console.log(`[FileSystemLedger] Deleted ${removed} events by id`);
        }
        return removed;
    }

    async nuke(): Promise<void> {
        this.events = [];
        if (this.file.exists) {
            await this.file.delete();
        }
        // The crash-safety temp file MUST die with the main file. loadFromDisk
        // treats a surviving events.json.tmp as a recoverable backup and promotes
        // it, so leaving it here would resurrect the wiped ledger on next init —
        // a factory reset that silently gives the data back.
        if (this.tmpFile.exists) {
            try { this.tmpFile.delete(); } catch { /* best-effort; main file is already gone */ }
        }
        console.log('[FileSystemLedger] Ledger nuked');
    }

    async insertDummy(): Promise<void> {
        const dummyRecord: StorageRecord = {
            id: `dummy_${Math.random().toString(36).substring(7)}`,
            ts: Date.now(),
            payload: { noise: Math.random().toString(36) },
            status: 'local',
            isDummy: true
        };
        const next = [...this.events, dummyRecord];
        await this.saveToDisk(next);
        this.events = next;
    }
}
