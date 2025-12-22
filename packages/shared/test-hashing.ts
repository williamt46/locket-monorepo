import { canonicalStringify } from './dist/hashing.js';
import crypto from 'crypto';

const hash = (data: string) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

const obj1 = { a: 1, b: 2 };
const obj2 = { b: 2, a: 1 };

const str1 = canonicalStringify(obj1);
const str2 = canonicalStringify(obj2);

const h1 = hash(str1);
const h2 = hash(str2);

console.log(`Object 1: ${JSON.stringify(obj1)} -> Hash: ${h1}`);
console.log(`Object 2: ${JSON.stringify(obj2)} -> Hash: ${h2}`);

if (h1 === h2) {
    console.log('✅ SUCCESS: Hashes are identical for different key orders.');
} else {
    console.log('❌ FAILURE: Hashes are different!');
    process.exit(1);
}

const obj3 = { a: { c: 3, d: 4 }, b: 2 };
const obj4 = { b: 2, a: { d: 4, c: 3 } };

if (hash(canonicalStringify(obj3)) === hash(canonicalStringify(obj4))) {
    console.log('✅ SUCCESS: Recursive sorting works.');
} else {
    console.log('❌ FAILURE: Recursive sorting failed!');
    process.exit(1);
}
