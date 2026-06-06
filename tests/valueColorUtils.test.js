import { parseValueByColor, typedValueMatchesColor, rawValueMatchesColor } from '../lib/helpers/valueColorUtils.js';

describe('valueColorUtils parseValueByColor', () => {
  test('parses valid raw values for each supported color', () => {
    // Raw text from prompts is converted into the JS value shape used by markings and bindings.
    expect(parseValueByColor('int', '42')).toBe(42);
    expect(parseValueByColor('int', ' -7 ')).toBe(-7);
    expect(parseValueByColor('real', '3.14')).toBeCloseTo(3.14);
    expect(parseValueByColor('real', '42')).toBe(42);
    expect(parseValueByColor('bool', 'TRUE')).toBe(true);
    expect(parseValueByColor('bool', 'false')).toBe(false);
    expect(parseValueByColor('string', '"hello"')).toBe('hello');
  });

  test('rejects invalid raw values for each supported color', () => {
    // Invalid prompt text should become undefined so callers can reject it cleanly.
    expect(parseValueByColor('int', '3.14')).toBeUndefined();
    expect(parseValueByColor('real', 'abc')).toBeUndefined();
    expect(parseValueByColor('bool', 'yes')).toBeUndefined();
    expect(parseValueByColor('string', 'hello')).toBeUndefined();
    expect(parseValueByColor('unknown', '1')).toBeUndefined();
  });

  test('accepts escaped string syntax but preserves escape characters literally', () => {
    // This documents current string behavior: syntax accepts escapes, but parseValueByColor does not unescape them.
    expect(parseValueByColor('string', '"a\\"b"')).toBe('a\\"b');
  });
});

describe('valueColorUtils type matching', () => {
  test('typedValueMatchesColor validates JavaScript values correctly', () => {
    // Runtime simulation checks stored JS values, not raw prompt text.
    expect(typedValueMatchesColor('int', 10)).toBe(true);
    expect(typedValueMatchesColor('int', 1.2)).toBe(false);
    expect(typedValueMatchesColor('int', NaN)).toBe(false);
    expect(typedValueMatchesColor('real', 1.5)).toBe(true);
    expect(typedValueMatchesColor('real', Infinity)).toBe(false);
    expect(typedValueMatchesColor('bool', false)).toBe(true);
    expect(typedValueMatchesColor('string', 'hi')).toBe(true);
    expect(typedValueMatchesColor('unknown', 'hi')).toBe(false);
  });

  test('rawValueMatchesColor validates raw strings by parsing then type-checking', () => {
    // Raw validation composes parsing and typed validation for user-entered text.
    expect(rawValueMatchesColor('int', '10')).toBe(true);
    expect(rawValueMatchesColor('real', '2.5')).toBe(true);
    expect(rawValueMatchesColor('bool', 'false')).toBe(true);
    expect(rawValueMatchesColor('string', '"hi"')).toBe(true);
    expect(rawValueMatchesColor('int', '2.5')).toBe(false);
    expect(rawValueMatchesColor('unknown', '2.5')).toBe(false);
  });
});
