// Everything about parsing / labeling / validating place types:
// Enum for colors
export const TokenColor = Object.freeze({
    INT: 'int',
    STRING: 'string',
    BOOL: 'bool',
    REAL: 'real'
})
// Array of all valid token colors derived from TokenColor enum
export const ALL_TOKEN_COLORS = Object.values(TokenColor);

// check if string is valid token color
export function isTokenColor(color) {
    return ALL_TOKEN_COLORS.includes(color);
}

// type array to a string (e.g. ['int','string'] → "int*string")
export function typeToKey(type) {
    if (!type || type.length === 0) return '';
    return type.join('*');
}

// Parses a string like "int*string" into an array ['int','string']
export function parseType(input) {
    if (!input || input === '' || input === 'ε') return [];

    const parts = input.split('*').map(p => p.trim()).filter(Boolean);

    for (const p of parts) {
        if (!isTokenColor(p)) {
            throw new Error(`Invalid token color: ${p}`);
        }
    }

    return parts;
}
// Parse raw place_type 
export function parsePlaceType(placeType) {
    if (Array.isArray(placeType)) {
        throw new Error('Legacy place type arrays are not supported. Use place_type as a single string value.');
    }

    if (placeType === null || placeType === undefined) {
        return [];
    }

    return parseType(String(placeType));
}

export function getRawPlaceType(businessObject) {
    if (!businessObject || typeof businessObject !== 'object') {
        return null;
    }

    return businessObject.place_type ?? null;
}

export function parsePlaceTypeFromBusinessObject(businessObject) {
    return parsePlaceType(getRawPlaceType(businessObject));
}
