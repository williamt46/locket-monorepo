import { describe, it, expect } from 'vitest';
import { canonicalStringify } from '../src/hashing';

describe('canonicalStringify', () => {
    it('handles primitive values correctly', () => {
        expect(canonicalStringify(null)).toBe('null');
        expect(canonicalStringify(123)).toBe('123');
        expect(canonicalStringify('test')).toBe('"test"');
        expect(canonicalStringify(true)).toBe('true');
    });

    it('sorts object keys alphabetically', () => {
        const obj1 = { z: 1, a: 2, m: 3 };
        const obj2 = { a: 2, m: 3, z: 1 };

        const str1 = canonicalStringify(obj1);
        const str2 = canonicalStringify(obj2);

        expect(str1).toBe('{"a":2,"m":3,"z":1}');
        expect(str1).toBe(str2);
    });

    it('handles nested objects recursively', () => {
        const obj1 = { b: { z: 1, a: 2 }, c: 3 };
        const obj2 = { c: 3, b: { a: 2, z: 1 } };

        const str1 = canonicalStringify(obj1);
        const str2 = canonicalStringify(obj2);

        expect(str1).toBe('{"b":{"a":2,"z":1},"c":3}');
        expect(str1).toBe(str2);
    });

    it('safely drops object keys with undefined values like JSON.stringify', () => {
        const obj = { a: 1, b: undefined, c: 3 };
        const str = canonicalStringify(obj);

        expect(str).toBe('{"a":1,"c":3}');
        // Must be parseable valid JSON
        expect(JSON.parse(str)).toEqual({ a: 1, c: 3 });
    });

    it('preserves object keys with null values', () => {
        const obj = { a: 1, b: null };
        const str = canonicalStringify(obj);

        expect(str).toBe('{"a":1,"b":null}');
        expect(JSON.parse(str)).toEqual({ a: 1, b: null });
    });

    it('maps undefined array items to null like JSON.stringify', () => {
        const arr = [1, undefined, 3];
        const str = canonicalStringify(arr);

        expect(str).toBe('[1,null,3]');
        expect(JSON.parse(str)).toEqual([1, null, 3]);
    });

    it('complex nested object with undefined preserves validity', () => {
        const data = {
            id: '123',
            note: undefined,
            nested: [1, undefined, null],
            meta: {
                flag: true,
                empty: undefined
            }
        };

        const str = canonicalStringify(data);
        expect(str).toBe('{"id":"123","meta":{"flag":true},"nested":[1,null,null]}');

        const parsed = JSON.parse(str);
        expect(parsed.note).toBeUndefined();
        expect(parsed.meta.empty).toBeUndefined();
        expect(parsed.nested[1]).toBeNull(); // standard JSON stringify behavior
    });
});
