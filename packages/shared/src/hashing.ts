/**
 * Deterministically strings an object for hashing.
 * Sorts object keys recursively.
 * Safely handles undefined values identically to JSON.stringify.
 */
export const canonicalStringify = (obj: any): string => {
    // Standard primitives or null
    if (obj === null || typeof obj !== 'object') {
        // Handle undefined just like JSON.stringify (though technically it shouldn't hit this as root)
        if (obj === undefined) return undefined as any;
        return JSON.stringify(obj);
    }

    if (Array.isArray(obj)) {
        // JSON.stringify maps undefined array elements to null
        const mapped = obj.map(item => item === undefined ? null : item);
        return '[' + mapped.map(canonicalStringify).join(',') + ']';
    }

    // Filter out keys where the value is explicitly undefined
    const keys = Object.keys(obj)
        .filter(key => obj[key] !== undefined)
        .sort();

    const result = keys.map(key => {
        return `"${key}":${canonicalStringify(obj[key])}`;
    });

    return '{' + result.join(',') + '}';
};
