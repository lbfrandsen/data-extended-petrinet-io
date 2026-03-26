export const tokenColors = ['int', 'string', 'bool'];

export function isTokenColor(color) {
    return tokenColors.includes(color);
}

export function typeToKey(type) {
    return Array.isArray(type) ? type.join(',') : String(type);
}

export function parseTypeLine(line) {
    if (!line) return [];

    return line
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
}

export function parseType(input) {
    return parseTypeLine(input);
}

export function getRawPlaceType(businessObject) {
    return businessObject.type || [];
}

export function parsePlaceTypeFromBusinessObject(businessObject) {
    return getRawPlaceType(businessObject);
}

export function validateValuesAgainstType(type, values) {
    if (!type || !values) return false;
    if (type.length !== values.length) return false;

    return values.every((val, i) => {
        const expected = type[i];

        if (expected === 'int') return typeof val === 'number';
        if (expected === 'string') return typeof val === 'string';
        if (expected === 'bool') return typeof val === 'boolean';

        return true;
    });
}