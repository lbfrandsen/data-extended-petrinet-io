import {
    TokenColor,
    ALL_TOKEN_COLORS,
    isTokenColor,
    typeToKey,
    parseType,
    parsePlaceType,
    getRawPlaceType,
    parsePlaceTypeFromBusinessObject
} from '../lib/helpers/placeTypeUtils.js';

describe('placeTypeUtils token colors', () => {
    test('exports the supported token colors', () => {
        // This documents the canonical color vocabulary used by places, tokens, and guards.
        expect(TokenColor).toEqual({
            INT: 'int',
            STRING: 'string',
            BOOL: 'bool',
            REAL: 'real'
        });
        expect(ALL_TOKEN_COLORS).toEqual(['int', 'string', 'bool', 'real']);
        expect(isTokenColor('int')).toBe(true);
        expect(isTokenColor('banana')).toBe(false);
    });
});

describe('placeTypeUtils type parsing', () => {
    test('parseType supports primitive, product, whitespace, empty, and epsilon types', () => {
        // Place types are stored as star-delimited strings and parsed into ordered color arrays.
        expect(parseType('bool')).toEqual(['bool']);
        expect(parseType('int*string')).toEqual(['int', 'string']);
        expect(parseType(' int * string ')).toEqual(['int', 'string']);
        expect(parseType('')).toEqual([]);
        expect(parseType('ε')).toEqual([]);
        expect(parseType(null)).toEqual([]);
    });

    test('parseType rejects invalid token colors', () => {
        // Unknown colors must fail early so downstream validation never sees unsupported type names.
        expect(() => parseType('int*banana')).toThrow(/Invalid token color: banana/);
    });

    test('typeToKey serializes parsed type arrays', () => {
        // Serialization mirrors parseType's star-delimited storage format.
        expect(typeToKey(['int', 'string'])).toBe('int*string');
        expect(typeToKey([])).toBe('');
        expect(typeToKey(null)).toBe('');
    });

    test('parsePlaceType rejects legacy arrays and handles missing values', () => {
        // Current metadata uses one string value; legacy arrays are intentionally rejected.
        expect(parsePlaceType(null)).toEqual([]);
        expect(parsePlaceType(undefined)).toEqual([]);
        expect(() => parsePlaceType(['int'])).toThrow(/Legacy place type arrays/);
    });
});

describe('placeTypeUtils business object helpers', () => {
    test('getRawPlaceType reads current and legacy keys', () => {
        // Imported/older diagrams may use place_type, but placeType takes precedence when both exist.
        expect(getRawPlaceType({ placeType: 'int', place_type: 'string' })).toBe('int');
        expect(getRawPlaceType({ place_type: 'bool' })).toBe('bool');
        expect(getRawPlaceType(null)).toBeNull();
        expect(getRawPlaceType('not-object')).toBeNull();
    });

    test('parsePlaceTypeFromBusinessObject reads both placeType styles', () => {
        // This is the public helper most other modules use when reading place type metadata.
        expect(parsePlaceTypeFromBusinessObject({ placeType: 'int*string' })).toEqual(['int', 'string']);
        expect(parsePlaceTypeFromBusinessObject({ place_type: 'bool' })).toEqual(['bool']);
        expect(parsePlaceTypeFromBusinessObject({})).toEqual([]);
    });
});
