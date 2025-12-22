/**
 * Deterministically strings an object for hashing.
 * Sorts object keys recursively.
 */
export const canonicalStringify = (obj: any): string => {
    if (obj === null || typeof obj !== 'object') {
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        return '[' + obj.map(canonicalStringify).join(',') + ']';
    }

    const keys = Object.keys(obj).sort();
    const result = keys.map(key => {
        return `"${key}":${canonicalStringify(obj[key])}`;
    });

    return '{' + result.join(',') + '}';
};
