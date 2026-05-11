import { parseGuardExpression } from '../lib/helpers/GuardParser.js';

describe('GuardParser', () => {
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

    test('throws for unmatched parentheses', () => {
        expect(() => parseGuardExpression('(x > 0')).toThrow(/Expected "\)"|Unexpected end of guard expression/);
    });

    test('throws for unterminated string literals', () => {
        expect(() => parseGuardExpression('x == "unclosed')).toThrow(/Unterminated string literal/);
    });

    test('empty string returns always-true literal', () => {
        const ast = parseGuardExpression('');
        expect(ast).toEqual({ type: 'Literal', value: true, valueType: 'bool' });
    });
});