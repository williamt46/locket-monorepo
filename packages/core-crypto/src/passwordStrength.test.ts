import { describe, it, expect } from 'vitest';
import { assessPasswordStrength } from './passwordStrength.js';

describe('assessPasswordStrength (lightweight gate)', () => {
    it('rejects too-short passwords', () => {
        expect(assessPasswordStrength('Ab1x').ok).toBe(false);
        expect(assessPasswordStrength('Ab1xyz7890a').ok).toBe(false); // 11 chars
    });

    it('accepts at the length boundary (12 chars)', () => {
        const r = assessPasswordStrength('Ab1xyz789012'); // 12 chars, no patterns
        expect(r.ok).toBe(true);
        expect(r.reason).toBeUndefined();
    });

    it('accepts long single-class passphrases (no forced variety)', () => {
        // Google guidance: long & memorable > forced character-class mixing
        expect(assessPasswordStrength('correcthorsebattery').ok).toBe(true); // 19 chars, all lowercase
        expect(assessPasswordStrength('treehouseoceancloud').ok).toBe(true); // 19 chars, all lowercase
        // Patterns still block long all-lowercase strings that contain banned words
        expect(assessPasswordStrength('mypassword12345678').ok).toBe(false); // contains "password"
    });

    it('rejects leading or trailing blank spaces', () => {
        expect(assessPasswordStrength(' mypassword12345').ok).toBe(false);
        expect(assessPasswordStrength('mypassword12345 ').ok).toBe(false);
        expect(assessPasswordStrength(' mypassword12345 ').ok).toBe(false);
    });

    it('rejects common passwords (exact denylist, case-insensitive)', () => {
        expect(assessPasswordStrength('password123').ok).toBe(false);
        expect(assessPasswordStrength('PASSWORD123').ok).toBe(false);
    });

    it('rejects common pattern variants the denylist alone misses', () => {
        expect(assessPasswordStrength('password1234').ok).toBe(false);   // contains "password"
        expect(assessPasswordStrength('letmein2026!!').ok).toBe(false);  // contains "letmein"
        expect(assessPasswordStrength('qwerty12345!!').ok).toBe(false);  // contains "qwerty"
        expect(assessPasswordStrength('abcdefgh1234').ok).toBe(false);   // contains "abcd" + "1234"
        expect(assessPasswordStrength('aaaaaaaaaaaa').ok).toBe(false);   // 12 repeated chars
    });

    it('accepts a strong passphrase', () => {
        const r = assessPasswordStrength('correct-horse-Battery-9');
        expect(r.ok).toBe(true);
    });
});
