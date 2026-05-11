import { parseGuardExpression } from '../lib/helpers/GuardParser.js';
import { typeCheckGuardAst, evaluateGuardAst, evaluateGuardAstValue, formatGuardAst } from '../lib/helpers/GuardEngine.js';

describe('GuardEngine', () => {
    test('type checks int comparison correctly', () => {
        const ast = parseGuardExpression('x > 5');
        const meta = new Map([['x', { type: 'int' }]]);
        expect(typeCheckGuardAst(ast, meta)).toBe('bool');
    });

    test('throws for type mismatch between int and string', () => {
        const ast = parseGuardExpression('x == "hello"');
        const meta = new Map([['x', { type: 'int' }]]);
        expect(() => typeCheckGuardAst(ast, meta)).toThrow(/Cannot compare/);
    });

    test('throws when expression does not resolve to boolean', () => {
        const ast = parseGuardExpression('x + 5');
        const meta = new Map([['x', { type: 'int' }]]);
        expect(() => typeCheckGuardAst(ast, meta)).toThrow(/must evaluate to boolean/);
    });

    test('throws on unknown variable', () => {
        const ast = parseGuardExpression('x > 1');
        const meta = new Map();
        expect(() => typeCheckGuardAst(ast, meta)).toThrow(/Unknown variable/);
    });

    test('evaluates guard expression true and false', () => {
        const ast = parseGuardExpression('x > 5');
        expect(evaluateGuardAst(ast, { x: 10 })).toBe(true);
        expect(evaluateGuardAst(ast, { x: 3 })).toBe(false);
    });

    test('evaluates boolean AND correctly', () => {
        const ast = parseGuardExpression('x && y');
        expect(evaluateGuardAst(ast, { x: true, y: false })).toBe(false);
    });

    test('partial evaluation returns undefined for missing variable', () => {
        const ast = parseGuardExpression('x && y');
        expect(evaluateGuardAst(ast, { x: true }, { partial: true })).toBeUndefined();
    });

    test('division by zero returns undefined in evaluation value path', () => {
        const ast = parseGuardExpression('10 / 0 == 0');
        expect(evaluateGuardAstValue(ast, {})).toBeUndefined();
    });

    test('formats AST back to readable text', () => {
        const ast = parseGuardExpression('x > 5 && len(foo) == 3');
        expect(formatGuardAst(ast)).toBe('x > 5 && len(foo) == 3');
    });

    test('len on non-string returns undefined evaluation', () => {
        const ast = parseGuardExpression('len(x) == 3');
        expect(evaluateGuardAst(ast, { x: 123 })).toBe(false);
    });
});