import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Crash-safety regression suite for FileSystemLedger (T1).
 *
 * We mock 'expo-file-system' with a tiny in-memory filesystem so the tests run
 * under plain Node/vitest without native bindings. The mock models exactly the
 * surface FileSystemLedger uses: Directory.{exists,create}, File.{exists,text,
 * write,delete,move}, and Paths.document.
 *
 * The invariants under test:
 *  - a normal save/load round-trips;
 *  - an interrupted write (temp present, main truncated/corrupt) recovers the
 *    prior ledger from the temp file instead of losing it;
 *  - a corrupt main file with NO recoverable backup fails loud (throws
 *    LedgerInitError, sets `corrupted`) and does NOT silently return [];
 *  - saveEvents keeps its existing append/round-trip behavior and leaves no
 *    stale temp file behind on success.
 */

const DOC = 'file:///doc';
const DIR = `${DOC}/locket_ledger`;
const MAIN = `${DIR}/events.json`;
const TMP = `${DIR}/events.json.tmp`;

const state = vi.hoisted(() => ({
    files: new Map<string, string>(),
    dirs: new Set<string>(),
    /** When set, File.write garbles the stored content (simulates a short write). */
    garbleWrites: false,
}));

function joinUri(parts: any[]): string {
    return parts.map((p) => (p && typeof p === 'object' && 'uri' in p ? p.uri : String(p))).join('/');
}

vi.mock('expo-file-system', () => {
    class Directory {
        uri: string;
        constructor(...parts: any[]) { this.uri = joinUri(parts); }
        get exists() { return state.dirs.has(this.uri); }
        create() { state.dirs.add(this.uri); }
    }
    class File {
        uri: string;
        constructor(...parts: any[]) { this.uri = joinUri(parts); }
        get exists() { return state.files.has(this.uri); }
        /**
         * Byte size, mirroring expo-file-system's `File.size` (null when the file
         * is absent/unreadable). saveToDisk's write-completeness guard reads this
         * instead of doing a full readback + JSON.parse on every save.
         */
        get size(): number | null {
            const content = state.files.get(this.uri);
            if (content === undefined) return null;
            // Real UTF-8 byte count, like the native File.size. Must NOT be
            // content.length — that is UTF-16 code units, and the whole point of
            // the byte-exact guard is that the two diverge for non-ASCII text.
            return Buffer.byteLength(content, 'utf8');
        }
        async text() {
            if (!state.files.has(this.uri)) throw new Error(`ENOENT ${this.uri}`);
            return state.files.get(this.uri)!;
        }
        write(content: string) {
            const s = String(content);
            // Simulate a short/garbled write: only the first half lands on disk.
            state.files.set(this.uri, state.garbleWrites ? s.slice(0, Math.floor(s.length / 2)) : s);
        }
        delete() { state.files.delete(this.uri); }
        move(dest: { uri: string }) {
            const content = state.files.get(this.uri);
            state.files.delete(this.uri);
            if (content !== undefined) state.files.set(dest.uri, content);
            this.uri = dest.uri;
        }
    }
    const Paths = { get document() { return new Directory(DOC); } };
    return { Directory, File, Paths };
});

import { FileSystemLedger } from './FileSystemLedger.js';
import { LedgerInitError, StorageRecord } from './types.js';

function rec(id: string, ts: number): StorageRecord {
    return { id, ts, payload: { iv: 'x', encryptedData: `e-${id}`, authTag: 't' }, status: 'local', signature: `h-${id}` };
}

describe('FileSystemLedger crash-safety (T1)', () => {
    beforeEach(() => {
        state.files.clear();
        state.dirs.clear();
        state.garbleWrites = false;
    });

    it('aborts the save when the temp file is short, leaving the previous good ledger on disk', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('a', 100)]);
        const good = state.files.get(MAIN);

        // Next write is short/garbled -> the verify step must throw BEFORE the
        // atomic replace, so events.json still holds the last good ledger.
        state.garbleWrites = true;
        await expect(ledger.saveEvents([rec('b', 200)])).rejects.toThrow(/Incomplete ledger write/);
        expect(state.files.get(MAIN)).toBe(good);

        // And the surviving temp is not mistaken for a better copy on next boot.
        state.garbleWrites = false;
        const next = new FileSystemLedger();
        await next.init();
        expect((await next.loadEvents()).map((e) => e.id)).toEqual(['a']);
        expect(next.corrupted).toBe(false);
    });

    it('round-trips a normal save then load in a fresh instance', async () => {
        const a = new FileSystemLedger();
        await a.init();
        await a.saveEvents([rec('a', 100), rec('b', 200)]);

        // Fresh instance reads the persisted state from disk.
        const b = new FileSystemLedger();
        await b.init();
        const loaded = await b.loadEvents();
        expect(loaded.map((e) => e.id).sort()).toEqual(['a', 'b']);
        // loadEvents returns latest-first by ts.
        expect(loaded[0].id).toBe('b');
    });

    it('leaves no stale temp file behind after a successful save', async () => {
        const a = new FileSystemLedger();
        await a.init();
        await a.saveEvents([rec('a', 100)]);
        expect(state.files.has(MAIN)).toBe(true);
        expect(state.files.has(TMP)).toBe(false);
    });

    it('recovers the prior ledger when a write was interrupted (temp intact, main truncated)', async () => {
        // Simulate a kill mid-write: events.json got truncated to empty, but the
        // verified temp file from the previous good save survived.
        state.dirs.add(DIR);
        const good = JSON.stringify([rec('a', 100), rec('b', 200)]);
        state.files.set(MAIN, '');       // truncated / zero-length main
        state.files.set(TMP, good);      // intact temp backup

        const ledger = new FileSystemLedger();
        await ledger.init();

        const loaded = await ledger.loadEvents();
        expect(loaded.map((e) => e.id).sort()).toEqual(['a', 'b']);
        expect(ledger.corrupted).toBe(false);
        // Temp is promoted to main and cleaned up.
        expect(state.files.get(MAIN)).toBe(good);
        expect(state.files.has(TMP)).toBe(false);
    });

    it('recovers when the main file is present but corrupt (unparseable) and temp is intact', async () => {
        state.dirs.add(DIR);
        const good = JSON.stringify([rec('a', 100)]);
        state.files.set(MAIN, '{ this is not valid json');
        state.files.set(TMP, good);

        const ledger = new FileSystemLedger();
        await ledger.init();

        const loaded = await ledger.loadEvents();
        expect(loaded.map((e) => e.id)).toEqual(['a']);
        expect(ledger.corrupted).toBe(false);
    });

    it('FAILS LOUD on a corrupt main file with no backup — never silently returns []', async () => {
        state.dirs.add(DIR);
        state.files.set(MAIN, '{ truncated garbage');   // corrupt, no temp

        const ledger = new FileSystemLedger();
        await expect(ledger.init()).rejects.toBeInstanceOf(LedgerInitError);
        expect(ledger.corrupted).toBe(true);
    });

    it('treats a genuine first boot (no files at all) as an empty ledger, not corruption', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        expect(ledger.corrupted).toBe(false);
        expect(await ledger.loadEvents()).toEqual([]);
    });

    it('discards a stale/garbage temp file when the main file is good', async () => {
        state.dirs.add(DIR);
        const good = JSON.stringify([rec('a', 100)]);
        state.files.set(MAIN, good);
        state.files.set(TMP, 'garbage-left-over');

        const ledger = new FileSystemLedger();
        await ledger.init();
        expect((await ledger.loadEvents()).map((e) => e.id)).toEqual(['a']);
        expect(state.files.has(TMP)).toBe(false);
    });

    it('saveEvents appends new records and assigns ids to id-less records (existing behavior)', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([{ ts: 1, payload: {}, status: 'local' } as StorageRecord]);
        const loaded = await ledger.loadEvents();
        expect(loaded).toHaveLength(1);
        expect(typeof loaded[0].id).toBe('string');
        expect(loaded[0].id!.length).toBeGreaterThan(0);
    });
});

describe('FileSystemLedger.deleteByIds count (T5)', () => {
    beforeEach(() => {
        state.files.clear();
        state.dirs.clear();
    });

    it('returns the number of records actually removed', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('a', 1), rec('b', 2), rec('c', 3)]);
        const removed = await ledger.deleteByIds(['a', 'c']);
        expect(removed).toBe(2);
        expect((await ledger.loadEvents()).map((e) => e.id)).toEqual(['b']);
    });

    it('counts only ids that matched a record (missing ids do not count)', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('a', 1)]);
        const removed = await ledger.deleteByIds(['a', 'does-not-exist']);
        expect(removed).toBe(1);
    });

    it('returns 0 and is a no-op for an empty id list', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('a', 1)]);
        expect(await ledger.deleteByIds([])).toBe(0);
        expect((await ledger.loadEvents()).map((e) => e.id)).toEqual(['a']);
    });
});

describe('FileSystemLedger.nuke temp-file cleanup', () => {
    beforeEach(() => {
        state.files.clear();
        state.dirs.clear();
        state.garbleWrites = false;
    });

    it('deletes the crash-safety temp file so a wipe cannot be resurrected on next init', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('secret', 100)]);

        // Simulate a temp file surviving an interrupted write: loadFromDisk
        // treats events.json.tmp as a recoverable backup and promotes it.
        state.files.set(TMP, state.files.get(MAIN)!);

        await ledger.nuke();

        expect(state.files.has(MAIN)).toBe(false);
        expect(state.files.has(TMP)).toBe(false);

        // The wipe must stay wiped — a fresh boot gets an empty ledger, not the
        // pre-nuke data recovered from the temp file.
        const next = new FileSystemLedger();
        await next.init();
        expect(await next.loadEvents()).toEqual([]);
        expect(next.corrupted).toBe(false);
    });
});

describe('FileSystemLedger write-failure atomicity', () => {
    beforeEach(() => {
        state.files.clear();
        state.dirs.clear();
        state.garbleWrites = false;
    });

    it('does not leave a failed batch live in memory when the write aborts', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('a', 100)]);

        // The next write lands short, so saveToDisk throws before the replace.
        state.garbleWrites = true;
        await expect(ledger.saveEvents([rec('b', 200), rec('c', 300)])).rejects.toThrow(
            /Incomplete ledger write/,
        );

        // loadEvents serves this.events as the source of truth, so the rejected
        // batch must not be visible — otherwise the UI shows entries the caller
        // was told were never written, and the next save would flush them.
        state.garbleWrites = false;
        expect((await ledger.loadEvents()).map((e) => e.id)).toEqual(['a']);
    });

    it('does not drop records from memory when a delete fails to persist', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();
        await ledger.saveEvents([rec('a', 100), rec('b', 200)]);

        state.garbleWrites = true;
        await expect(ledger.deleteByIds(['a'])).rejects.toThrow(/Incomplete ledger write/);

        // The caller reports "nothing was removed", so the records must still be
        // in the running ledger rather than silently gone until next launch.
        state.garbleWrites = false;
        expect((await ledger.loadEvents()).map((e) => e.id).sort()).toEqual(['a', 'b']);
    });

    it('detects a truncated write of non-ASCII content (byte-exact, not UTF-16 length)', async () => {
        const ledger = new FileSystemLedger();
        await ledger.init();

        // Note text with multibyte characters: UTF-8 bytes exceed String.length,
        // so a length-based guard would accept a write truncated inside the slack.
        const multibyte: StorageRecord = {
            id: 'm',
            ts: 100,
            payload: { iv: 'x', encryptedData: 'réésumé — 記録 🩸', authTag: 't' },
            status: 'local',
            signature: 'h-m',
        };
        await ledger.saveEvents([multibyte]);
        const good = state.files.get(MAIN);

        // Drop exactly one trailing byte-equivalent character from the write.
        const originalWrite = state.files.set.bind(state.files);
        state.garbleWrites = false;
        let intercepted = false;
        const spy = vi.spyOn(state.files, 'set').mockImplementation((k: any, v: any) => {
            if (!intercepted && k === TMP) {
                intercepted = true;
                return originalWrite(k, String(v).slice(0, -1));
            }
            return originalWrite(k, v);
        });

        await expect(ledger.saveEvents([rec('n', 200)])).rejects.toThrow(/Incomplete ledger write/);
        spy.mockRestore();
        expect(state.files.get(MAIN)).toBe(good);
    });
});
