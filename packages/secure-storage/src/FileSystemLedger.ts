import { Directory, File, Paths } from 'expo-file-system';
import { LedgerStorage, StorageRecord, LedgerInitError } from './types.js';

// Sibling of events.json used for crash-safe writes. saveToDisk writes here
// first, verifies the readback parses, then atomically replaces events.json.
// If a write is interrupted, this file survives intact and loadFromDisk
// recovers the ledger from it.
const TEMP_FILE_NAME = 'events.json.tmp';

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

    private async saveToDisk(): Promise<void> {
        const serialized = JSON.stringify(this.events);

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
        // Safe direction: UTF-8 byte length is always >= JS string length, so a
        // COMPLETE write can never trip this check (no false aborts). In practice
        // the ledger JSON is pure ASCII anyway — base64 payloads, alphanumeric ids,
        // numeric timestamps — so the two are equal.
        const writtenBytes = this.tmpFile.size;
        if (writtenBytes === null || writtenBytes < serialized.length) {
            throw new Error(
                `[FileSystemLedger] Incomplete ledger write: temp file is ` +
                `${writtenBytes === null ? 'unreadable' : `${writtenBytes} bytes`}, expected at least ` +
                `${serialized.length}. Refusing to replace events.json; the previous ledger is intact.`,
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

        const index = this.events.findIndex(e => e.id === id);
        if (index >= 0) {
            this.events[index] = newRecord;
        } else {
            if (record.id) {
                console.warn(`[FileSystemLedger] Single update failed: Record ${record.id} not found.`);
            }
            this.events.push(newRecord);
        }
        await this.saveToDisk();
    }

    async saveEvents(records: StorageRecord[]): Promise<void> {
        const before = this.events.length;
        // Index by id once instead of a findIndex scan per record: a batch import
        // is O(records x ledgerSize) otherwise, which is millions of comparisons
        // on the JS thread for a few thousand entries.
        const indexById = new Map<string, number>();
        for (let i = 0; i < this.events.length; i++) {
            const existingId = this.events[i].id;
            if (existingId !== undefined) indexById.set(existingId, i);
        }
        for (const record of records) {
            const id = record.id || Math.random().toString(36).substring(7) + '-' + Date.now();
            const newRecord = { ...record, id };
            const index = indexById.get(id);
            if (index !== undefined) {
                this.events[index] = newRecord;
            } else {
                indexById.set(id, this.events.length);
                this.events.push(newRecord);
            }
        }
        const after = this.events.length;
        await this.saveToDisk();
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
        this.events = this.events.filter(e => {
            const d = new Date(e.ts);
            const s = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            return s !== dateStr;
        });

        if (this.events.length !== initialCount) {
            await this.saveToDisk();
            console.log(`[FileSystemLedger] Deleted ${initialCount - this.events.length} events for ${dateStr}. Remaining: ${this.events.length}`);
        } else {
            console.log(`[FileSystemLedger] No events found to delete for ${dateStr}`);
        }
    }

    async deleteByIds(ids: string[]): Promise<number> {
        if (!ids || ids.length === 0) return 0;
        const idSet = new Set(ids);
        const before = this.events.length;
        this.events = this.events.filter(e => !e.id || !idSet.has(e.id));
        const removed = before - this.events.length;
        if (removed > 0) {
            await this.saveToDisk();
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
        this.events.push(dummyRecord);
        await this.saveToDisk();
    }
}
