import { validateValuesAgainstType } from '../lib/helpers/tokenValidationUtils.js';

describe('tokenValidationUtils', () => {
    test('validates correct values against a simple type', () => {
        expect(validateValuesAgainstType(['int', 'string'], ['42', '"abc"'])).toEqual({ ok: true });
    });

    test('returns error when values length does not match type length', () => {
        expect(validateValuesAgainstType(['int', 'real'], ['42'])).toEqual({
            ok: false,
            error: 'Expected 2 values, got 1'
        });
    });

    test('returns error when a raw value does not match its color', () => {
        expect(validateValuesAgainstType(['int'], ['3.14'])).toEqual({
            ok: false,
            error: expect.stringContaining('Invalid format at position 0')
        });
    });
});