import { parseValueByColor, typedValueMatchesColor, rawValueMatchesColor } from '../lib/helpers/valueColorUtils.js';

describe('valueColorUtils', () => {
  test('parseValueByColor parses ints, reals, bools, and strings', () => {
    expect(parseValueByColor('int', '42')).toBe(42);
    expect(parseValueByColor('real', '3.14')).toBeCloseTo(3.14);
    expect(parseValueByColor('bool', 'true')).toBe(true);
    expect(parseValueByColor('string', '"hello"')).toBe('hello');
    expect(parseValueByColor('int', 'abc')).toBeUndefined();
  });

  test('typedValueMatchesColor validates JS values correctly', () => {
    expect(typedValueMatchesColor('int', 10)).toBe(true);
    expect(typedValueMatchesColor('real', 1.5)).toBe(true);
    expect(typedValueMatchesColor('bool', false)).toBe(true);
    expect(typedValueMatchesColor('string', 'hi')).toBe(true);
    expect(typedValueMatchesColor('int', 1.2)).toBe(false);
  });

  test('rawValueMatchesColor validates raw string input against colors', () => {
    expect(rawValueMatchesColor('int', '10')).toBe(true);
    expect(rawValueMatchesColor('real', '2.5')).toBe(true);
    expect(rawValueMatchesColor('bool', 'false')).toBe(true);
    expect(rawValueMatchesColor('string', '"hi"')).toBe(true);
    expect(rawValueMatchesColor('int', '2.5')).toBe(false);
  });
});
