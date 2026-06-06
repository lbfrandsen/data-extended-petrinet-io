import { parseGuardExpression } from '../lib/helpers/GuardParser.js';
import { typeCheckGuardAst, evaluateGuardAst, evaluateGuardAstValue, formatGuardAst } from '../lib/helpers/GuardEngine.js';

const ast = (source) => parseGuardExpression(source);
const meta = (entries) => new Map(entries.map(([name, type]) => [name, { type }]));

describe('GuardEngine type checking', () => {
    test('accepts boolean comparisons and boolean operators', () => {
        // Type checking should allow a guard made from boolean-valued subexpressions.
        const variableMeta = meta([
            ['x', 'int'],
            ['name', 'string'],
            ['flag', 'bool']
        ]);

        expect(typeCheckGuardAst(ast('x > 5 && name == "ok" && flag'), variableMeta)).toBe('bool');
    });

    test('accepts int and real arithmetic with numeric comparisons', () => {
        // Numeric arithmetic can mix int and real values when the final expression is boolean.
        const variableMeta = meta([
            ['x', 'int'],
            ['y', 'real']
        ]);

        expect(typeCheckGuardAst(ast('x + y / 2 >= 3.5'), variableMeta)).toBe('bool');
    });

    test('accepts int-real equality but rejects incompatible equality', () => {
        // Equality permits numeric cross-comparison but not unrelated color families.
        expect(typeCheckGuardAst(ast('x == y'), meta([['x', 'int'], ['y', 'real']]))).toBe('bool');
        expect(() => typeCheckGuardAst(ast('x == name'), meta([['x', 'int'], ['name', 'string']]))).toThrow(/Cannot compare/);
    });

    test('rejects non-boolean root expressions and unknown variables', () => {
        // A guard must resolve to bool and may only reference variables known from arcs/query bindings.
        expect(() => typeCheckGuardAst(ast('x + 5'), meta([['x', 'int']]))).toThrow(/must evaluate to boolean/);
        expect(() => typeCheckGuardAst(ast('missing > 1'), meta([]))).toThrow(/Unknown variable/);
    });

    test('checks function calls and unary operators', () => {
        // Engine-level validation decides which parsed calls/operators are semantically valid.
        expect(typeCheckGuardAst(ast('len(name) == 4 && !flag'), meta([['name', 'string'], ['flag', 'bool']]))).toBe('bool');
        expect(typeCheckGuardAst(ast('-x < 0'), meta([['x', 'int']]))).toBe('bool');
        expect(() => typeCheckGuardAst(ast('len(x) == 1'), meta([['x', 'int']]))).toThrow(/only supports string/);
        expect(() => typeCheckGuardAst(ast('unknownFn(x) == 1'), meta([['x', 'int']]))).toThrow(/Unsupported function/);
        expect(() => typeCheckGuardAst(ast('!x'), meta([['x', 'int']]))).toThrow(/requires a boolean/);
    });
});

describe('GuardEngine evaluation', () => {
    test('evaluates comparisons, arithmetic, and booleans', () => {
        // Runtime evaluation should combine arithmetic and boolean operators using bound values.
        expect(evaluateGuardAst(ast('x > 5'), { x: 10 })).toBe(true);
        expect(evaluateGuardAst(ast('x > 5'), { x: 3 })).toBe(false);
        expect(evaluateGuardAst(ast('x * 2 + y == 11'), { x: 4, y: 3 })).toBe(true);
        expect(evaluateGuardAst(ast('flag && !other'), { flag: true, other: false })).toBe(true);
    });

    test('evaluates len/length and string comparisons', () => {
        // len and length are aliases at evaluation time and only succeed for string values.
        expect(evaluateGuardAst(ast('len(name) == 5'), { name: 'alpha' })).toBe(true);
        expect(evaluateGuardAst(ast('length(name) != 4'), { name: 'alpha' })).toBe(true);
        expect(evaluateGuardAst(ast('len(x) == 3'), { x: 123 })).toBe(false);
    });

    test('returns false for undefined evaluation in full mode', () => {
        // Full evaluation treats missing values or invalid arithmetic as a non-fireable guard.
        expect(evaluateGuardAst(ast('missing > 1'), {})).toBe(false);
        expect(evaluateGuardAst(ast('x / 0 > 1'), { x: 10 })).toBe(false);
        expect(evaluateGuardAst(ast('x % 0 == 0'), { x: 10 })).toBe(false);
    });

    test('supports partial evaluation for unresolved variables', () => {
        // Partial mode is used during binding search: unknown is allowed unless the expression is already false.
        expect(evaluateGuardAst(ast('x > 5 && y > 0'), { x: 6 }, { partial: true })).toBeUndefined();
        expect(evaluateGuardAst(ast('x > 5 && y > 0'), { x: 3 }, { partial: true })).toBe(false);
        expect(evaluateGuardAst(ast('x > 5 || y > 0'), { x: 6 }, { partial: true })).toBe(true);
        expect(evaluateGuardAstValue(ast('x + y'), { x: 1 }, { partial: true })).toBeUndefined();
    });
});

describe('GuardEngine formatting', () => {
    test('formats expressions with stable precedence', () => {
        // Formatting should preserve meaning while removing unnecessary parentheses.
        expect(formatGuardAst(ast('x > 5 && len(name) == 3'))).toBe('x > 5 && len(name) == 3');
        expect(formatGuardAst(ast('(x + 2) * y > 10'))).toBe('(x + 2) * y > 10');
        expect(formatGuardAst(ast('x + y * z > 10'))).toBe('x + y * z > 10');
    });

    test('formats literals and unary expressions', () => {
        // String escaping and unary operator formatting should round-trip to readable guard text.
        expect(formatGuardAst(ast('"a\\"b" == name'))).toBe('"a\\"b" == name');
        expect(formatGuardAst(ast('!flag || -x < 0'))).toBe('!flag || -x < 0');
    });
});
