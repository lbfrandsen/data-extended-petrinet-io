import { TokenColor, isTokenColor, typeToKey, parseType, parsePlaceType, parsePlaceTypeFromBusinessObject } from '../lib/helpers/placeTypeUtils.js';

describe('placeTypeUtils', () => {
    test('parseType splits composite types', () => {
        expect(parseType('int*string')).toEqual(['int', 'string']);
    });

    test('parseType supports single primitive types', () => {
        expect(parseType('bool')).toEqual(['bool']);
    });

    test('parseType handles empty and epsilon as empty type', () => {
        expect(parseType('')).toEqual([]);
        expect(parseType('ε')).toEqual([]);
    });

    test('parseType throws for invalid token color', () => {
        expect(() => parseType('int*banana')).toThrow(/Invalid token color/);
    });

    test('typeToKey serializes type arrays', () => {
        expect(typeToKey(['int', 'string'])).toBe('int*string');
        expect(typeToKey([])).toBe('');
    });

    test('isTokenColor recognizes valid colors', () => {
        expect(isTokenColor('int')).toBe(true);
        expect(isTokenColor('banana')).toBe(false);
    });

    test('parsePlaceType handles null and missing types', () => {
        expect(parsePlaceType(null)).toEqual([]);
        expect(parsePlaceType(undefined)).toEqual([]);
    });

    test('parsePlaceTypeFromBusinessObject reads both placeType styles', () => {
        expect(parsePlaceTypeFromBusinessObject({ placeType: 'int*string' })).toEqual(['int', 'string']);
        expect(parsePlaceTypeFromBusinessObject({ place_type: 'bool' })).toEqual(['bool']);
    });
});