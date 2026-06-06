import { validateValuesAgainstType } from '../lib/helpers/tokenValidationUtils.js';

describe('tokenValidationUtils', () => {
    test('validates raw values against product and primitive types', () => {
        // Token prompt validation checks raw text before values are parsed into JS markings.
        expect(validateValuesAgainstType(['int', 'string'], ['42', '"abc"'])).toEqual({ ok: true });
        expect(validateValuesAgainstType(['real', 'bool'], ['3.14', 'false'])).toEqual({ ok: true });
        expect(validateValuesAgainstType([], [])).toEqual({ ok: true });
    });

    test('returns an arity error when value count does not match type length', () => {
        // Product type arity is part of the token contract and should fail before per-value parsing.
        expect(validateValuesAgainstType(['int', 'real'], ['42'])).toEqual({
            ok: false,
            error: 'Expected 2 values, got 1'
        });
        expect(validateValuesAgainstType([], ['42'])).toEqual({
            ok: false,
            error: 'Expected 0 values, got 1'
        });
    });

    test('returns indexed format errors for invalid raw values', () => {
        // Error messages should identify the failing tuple position and expected color.
        expect(validateValuesAgainstType(['int'], ['3.14'])).toEqual({
            ok: false,
            error: expect.stringContaining('Invalid format at position 0')
        });
        expect(validateValuesAgainstType(['int', 'string'], ['1', 'abc'])).toEqual({
            ok: false,
            error: expect.stringContaining('position 1 for type string')
        });
        expect(validateValuesAgainstType(['bool'], ['yes'])).toEqual({
            ok: false,
            error: expect.stringContaining('type bool')
        });
    });
});
