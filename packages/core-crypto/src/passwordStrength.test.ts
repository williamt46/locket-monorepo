import { describe, it, expect } from 'vitest';
import { assessPasswordStrength } from './passwordStrength.js';

describe('assessPasswordStrength (lightweight gate)', () => {
    it('rejects too-short passwords', () => {
        expect(assessPasswordStrength('Ab1x').ok).toBe(false);
        expect(assessPasswordStrength('Ab1xyz789').ok).toBe(false); // 9 chars
    });

    it('accepts at the length boundary with variety', () => {
        const r = assessPasswordStrength('Ab1xyz7890'); // 10 chars: upper+lower+digit
        expect(r.ok).toBe(true);
        expect(r.reason).toBeUndefined();
    });

    it('rejects common passwords even when long enough', () => {
        expect(assessPasswordStrength('password123').ok).toBe(false);
        expect(assessPasswordStrength('PASSWORD123').ok).toBe(false); // case-insensitive
    });

    it('rejects single-character-class passwords', () => {
        expect(assessPasswordStrength('abcdefghij').ok).toBe(false); // all lowercase
        expect(assessPasswordStrength('1112223334').ok).toBe(false); // all digits
    });

    it('accepts a strong passphrase', () => {
        const r = assessPasswordStrength('correct-horse-Battery-9');
        expect(r.ok).toBe(true);
    });
});
