import { parseGuardExpression } from '../lib/helpers/GuardParser.js';
import { typeCheckGuardAst, evaluateGuardAst, evaluateGuardAstValue, formatGuardAst } from '../lib/helpers/GuardEngine.js';

describe('GuardEngine', () => {
    test('type checks int comparison correctly', () => {
        const ast = parseGuardExpression('x > 5');
        const meta = new Map([['x', { type: 'int' }]]);
        expect(typeCheckGuardAst(ast, meta)).toBe('bool');
    });

    test('parses a simple comparison expression', () => {
        const ast = parseGuardExpression('x > 5');
        expect(ast).toMatchObject({
            type: 'BinaryExpression',
            operator: '>',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Literal', value: 5, valueType: 'int' }
        });
    });

    test('parses a compound boolean expression', () => {
        const ast = parseGuardExpression('x > 0 && y == "hello"');
        expect(ast.type).toBe('BinaryExpression');
        expect(ast.operator).toBe('&&');
        expect(ast.left.operator).toBe('>');
        expect(ast.right.operator).toBe('==');
    });

    test('throws for unmatched parentheses', () => { // no )
        expect(() => parseGuardExpression('(x > 0')).toThrow(/Expected "\)"|Unexpected end of guard expression/);
    });

    test('throws for unterminated string literals', () => {
        expect(() => parseGuardExpression('x == "someString')).toThrow(/Unterminated string literal/);
    });

    test('empty string returns always-true literal', () => {
        const ast = parseGuardExpression('');
        expect(ast).toEqual({ type: 'Literal', value: true, valueType: 'bool' });
    });

    test('check complex expression with len, =, () || &&', () => {
        const ast = parseGuardExpression('len(foo) > 3 || (x == 5 && y != "bar")');
        expect(ast).toMatchObject({
            type: 'BinaryExpression',
            operator: '||',
            left: {
                type: 'BinaryExpression',
                operator: '>',
                left: { type: 'CallExpression', callee: 'len', arguments: [{ type: 'Identifier', name: 'foo' }] },
                right: { type: 'Literal', value: 3, valueType: 'int' }
            },
            right: {
                type: 'BinaryExpression',
                operator: '&&',
                left: {
                    type: 'BinaryExpression',
                    operator: '==',
                    left: { type: 'Identifier', name: 'x' },
                    right: { type: 'Literal', value: 5, valueType: 'int' }
                },
                right: {
                    type: 'BinaryExpression',
                    operator: '!=',
                    left: { type: 'Identifier', name: 'y' },
                    right: { type: 'Literal', value: 'bar', valueType: 'string' }
                }
            }
        });
    });

    test('throws for type mismatch between int and string', () => {
        const ast = parseGuardExpression('x == "hello"');
        const meta = new Map([['x', { type: 'int' }]]);
        expect(() => typeCheckGuardAst(ast, meta)).toThrow(/Cannot compare/);
    });

    test('throws when expression does not resolve to boolean', () => {
        const ast = parseGuardExpression('x + 5'); // check x + 5 = int not bool
        const meta = new Map([['x', { type: 'int' }]]);
        expect(() => typeCheckGuardAst(ast, meta)).toThrow(/must evaluate to boolean/);
    });

    test('throws on unknown variable', () => {
        const ast = parseGuardExpression('x > 1'); // x doesn't exist
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

    test('formats AST back to readable text', () => {
        const ast = parseGuardExpression('x > 5 && len(foo) == 3');
        expect(formatGuardAst(ast)).toBe('x > 5 && len(foo) == 3');
    });

    test('len on non-string returns undefined evaluation', () => {
        const ast = parseGuardExpression('len(x) == 3');
        expect(evaluateGuardAst(ast, { x: 123 })).toBe(false);
    });
});