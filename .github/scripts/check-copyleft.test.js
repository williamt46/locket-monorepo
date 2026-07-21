// Unit tests for the copyleft license gate.
//
// The script's contract IS its exit code — that is what every CI layer keys
// on — so these run it as a real subprocess over piped stdin rather than
// importing internals. A refactor that keeps the functions but breaks the
// exit code would still be caught here.
//
// The CI job (.github/workflows/ci.yml license-gate) self-tests the two
// headline cases against fixtures before every enforcement run. These tests
// lock in the branches that self-test does NOT reach: SPDX OR/AND/WITH
// expression semantics, the fail-closed guard, the non-string license
// shapes, and the deliberate LGPL exclusion.
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'check-copyleft.js');

/** Write a package.json into a fresh temp dir and return that dir path. */
function pkgDir(manifest) {
    const dir = mkdtempSync(join(tmpdir(), 'copyleft-'));
    const pkg = join(dir, 'pkg');
    mkdirSync(pkg);
    writeFileSync(join(pkg, 'package.json'), JSON.stringify(manifest));
    return pkg;
}

/** Run the gate over the given directory paths (one per stdin line). */
function runGate(dirs) {
    const res = spawnSync('node', [CHECK], {
        input: dirs.join('\n'),
        encoding: 'utf8',
    });
    return { code: res.status, stdout: res.stdout, stderr: res.stderr };
}

/** Convenience: run the gate over a single synthetic package manifest. */
function checkLicense(license) {
    const manifest = { name: 'fixture', version: '1.0.0' };
    if (license !== undefined) manifest.license = license;
    return runGate([pkgDir(manifest)]);
}

describe('check-copyleft — single-id SPDX licenses', () => {
    it('should fail a plain GPL package', () => {
        const { code, stderr } = checkLicense('GPL-3.0-only');
        expect(code).toBe(1);
        expect(stderr).toContain('COPYLEFT:');
    });

    it('should fail every GPL/AGPL id variant', () => {
        for (const id of ['GPL-2.0', 'GPL-3.0-only', 'AGPL-3.0-or-later', 'AGPL-1.0']) {
            expect(checkLicense(id).code, `expected ${id} to fail`).toBe(1);
        }
    });

    it('should match copyleft ids case-insensitively', () => {
        expect(checkLicense('gpl-3.0').code).toBe(1);
        expect(checkLicense('aGpL-3.0').code).toBe(1);
    });

    it('should pass a permissive package with no notice', () => {
        const { code, stdout } = checkLicense('MIT');
        expect(code).toBe(0);
        expect(stdout).not.toContain('notice:');
    });

    it('should pass a package that declares no license at all', () => {
        expect(checkLicense(undefined).code).toBe(0);
    });
});

describe('check-copyleft — LGPL is deliberately not gated', () => {
    // The \b in /\b(A?GPL)-\d/i is load-bearing: LGPL is weak copyleft and
    // linking against it does not impose source-disclosure on the app, so
    // gating it would block legitimate dependencies.
    it('should pass LGPL without failing or emitting a notice', () => {
        const { code, stdout, stderr } = checkLicense('LGPL-3.0-or-later');
        expect(code).toBe(0);
        expect(stdout).not.toContain('notice:');
        expect(stderr).not.toContain('COPYLEFT:');
    });

    it('should pass an OR expression whose only copyleft-looking part is LGPL', () => {
        const { code, stdout } = checkLicense('(MIT OR LGPL-2.1)');
        expect(code).toBe(0);
        expect(stdout).not.toContain('notice:');
    });
});

describe('check-copyleft — SPDX OR (licensee chooses)', () => {
    it('should pass a dual license with a permissive alternative, with a notice', () => {
        // The live case that exact-id matching was blind to: node-forge.
        const { code, stdout } = checkLicense('(BSD-3-Clause OR GPL-2.0)');
        expect(code).toBe(0);
        expect(stdout).toContain('notice: dual-licensed, non-copyleft choice applies');
        expect(stdout).toContain('BSD-3-Clause OR GPL-2.0');
    });

    it('should fail an OR expression when EVERY alternative is copyleft', () => {
        const { code, stderr } = checkLicense('(GPL-2.0 OR GPL-3.0)');
        expect(code).toBe(1);
        expect(stderr).toContain('COPYLEFT:');
    });

    it('should fail an all-copyleft OR that mixes GPL and AGPL', () => {
        expect(checkLicense('GPL-2.0-only OR AGPL-3.0-or-later').code).toBe(1);
    });

    it('should handle OR without surrounding parentheses', () => {
        expect(checkLicense('MIT OR GPL-3.0').code).toBe(0);
        expect(checkLicense('GPL-2.0 OR AGPL-3.0').code).toBe(1);
    });

    it('should treat the OR keyword case-insensitively', () => {
        // Lowercase `or` must still split; if it did not, the whole string
        // would match COPYLEFT and a permissive choice would wrongly fail.
        expect(checkLicense('(MIT or GPL-3.0)').code).toBe(0);
    });
});

describe('check-copyleft — SPDX AND / WITH (all terms apply)', () => {
    it('should fail when a copyleft term is ANDed with a permissive one', () => {
        const { code, stderr } = checkLicense('(MIT AND GPL-3.0)');
        expect(code).toBe(1);
        expect(stderr).toContain('COPYLEFT:');
    });

    it('should fail a GPL license carrying a WITH exception', () => {
        expect(checkLicense('GPL-3.0-only WITH Classpath-exception-2.0').code).toBe(1);
    });

    it('should pass an AND expression with no copyleft part', () => {
        expect(checkLicense('(MIT AND Apache-2.0)').code).toBe(0);
    });
});

describe('check-copyleft — non-string license shapes', () => {
    it('should read the legacy license.type object form', () => {
        expect(checkLicense({ type: 'GPL-3.0', url: 'http://example.invalid' }).code).toBe(1);
        expect(checkLicense({ type: 'MIT', url: 'http://example.invalid' }).code).toBe(0);
    });

    it('should read the legacy licenses[] array of objects as an OR choice', () => {
        const permissiveAlt = runGate([
            pkgDir({
                name: 'fixture',
                version: '1.0.0',
                licenses: [{ type: 'MIT' }, { type: 'GPL-2.0' }],
            }),
        ]);
        expect(permissiveAlt.code).toBe(0);
        expect(permissiveAlt.stdout).toContain('notice:');

        const allCopyleft = runGate([
            pkgDir({
                name: 'fixture',
                version: '1.0.0',
                licenses: [{ type: 'GPL-2.0' }, { type: 'AGPL-3.0' }],
            }),
        ]);
        expect(allCopyleft.code).toBe(1);
    });

    it('should read a licenses[] array of bare strings', () => {
        const { code, stdout } = runGate([
            pkgDir({ name: 'fixture', version: '1.0.0', licenses: ['MIT', 'GPL-2.0'] }),
        ]);
        expect(code).toBe(0);
        expect(stdout).toContain('notice:');
    });

    it('should not crash on an unrecognized license shape', () => {
        const { code } = runGate([
            pkgDir({ name: 'fixture', version: '1.0.0', license: { spdx: 'GPL-3.0' } }),
        ]);
        // No readable id — treated as unlicensed rather than throwing. The
        // bundle-artifact scan remains the authoritative backstop.
        expect(code).toBe(0);
    });
});

describe('check-copyleft — fail-closed guard', () => {
    it('should fail when stdin is empty', () => {
        const { code, stderr } = runGate([]);
        expect(code).toBe(1);
        expect(stderr).toContain('zero packages');
    });

    it('should fail when stdin is only whitespace', () => {
        const { code, stderr } = runGate(['', '', '']);
        expect(code).toBe(1);
        expect(stderr).toContain('zero packages');
    });

    it('should fail when every listed path is unreadable', () => {
        // A broken `npm ls` upstream emitting garbage paths must never read
        // as green just because nothing parsed.
        const { code, stderr } = runGate(['/nonexistent/a', '/nonexistent/b']);
        expect(code).toBe(1);
        expect(stderr).toContain('zero packages');
    });

    it('should skip unreadable paths but still check the readable ones', () => {
        const { code, stdout } = runGate(['/nonexistent/a', pkgDir({ name: 'ok', version: '1.0.0', license: 'MIT' })]);
        expect(code).toBe(0);
        expect(stdout).toContain('checked 1 resolved packages');
    });

    it('should still fail on a copyleft package mixed in with unreadable paths', () => {
        const { code } = runGate(['/nonexistent/a', pkgDir({ name: 'bad', version: '1.0.0', license: 'GPL-3.0' })]);
        expect(code).toBe(1);
    });
});

describe('check-copyleft — reporting across many packages', () => {
    it('should report every offending package, not just the first', () => {
        const { code, stderr } = runGate([
            pkgDir({ name: 'bad-one', version: '1.0.0', license: 'GPL-3.0' }),
            pkgDir({ name: 'fine', version: '1.0.0', license: 'MIT' }),
            pkgDir({ name: 'bad-two', version: '2.0.0', license: 'AGPL-3.0' }),
        ]);
        expect(code).toBe(1);
        expect(stderr).toContain('bad-one@1.0.0');
        expect(stderr).toContain('bad-two@2.0.0');
        expect(stderr).not.toContain('fine@');
    });

    it('should report an accurate checked count', () => {
        const { code, stdout } = runGate([
            pkgDir({ name: 'a', version: '1.0.0', license: 'MIT' }),
            pkgDir({ name: 'b', version: '1.0.0', license: 'Apache-2.0' }),
            pkgDir({ name: 'c', version: '1.0.0', license: 'ISC' }),
        ]);
        expect(code).toBe(0);
        expect(stdout).toContain('checked 3 resolved packages');
    });

    it('should pass a wholly permissive tree', () => {
        const { code, stderr } = runGate([
            pkgDir({ name: 'a', version: '1.0.0', license: 'MIT' }),
            pkgDir({ name: 'b', version: '1.0.0', license: 'BSD-2-Clause' }),
        ]);
        expect(code).toBe(0);
        expect(stderr).not.toContain('COPYLEFT:');
    });
});
