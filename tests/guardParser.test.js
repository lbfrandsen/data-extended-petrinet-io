import { parseGuardExpression } from '../lib/helpers/GuardParser.js';

describe('GuardParser', () => {
    test('empty input returns an always-true bool literal', () => {
        // Empty guards mean "no restriction", so the parser represents them as a true bool literal.
        expect(parseGuardExpression('')).toEqual({
            type: 'Literal',
            value: true,
            valueType: 'bool'
        });
    });

    test('parses comparisons, identifiers, and numeric literals', () => {
        // This is the smallest useful guard shape: variable, comparison operator, and integer literal.
        expect(parseGuardExpression('x > 5')).toMatchObject({
            type: 'BinaryExpression',
            operator: '>',
            left: { type: 'Identifier', name: 'x' },
            right: { type: 'Literal', value: 5, valueType: 'int' }
        });
    });

    test('preserves operator precedence for arithmetic and boolean expressions', () => {
        // Multiplication must bind tighter than addition, comparison tighter than &&.
        const ast = parseGuardExpression('x + 2 * y > 10 && ok');

        expect(ast.operator).toBe('&&');
        expect(ast.left.operator).toBe('>');
        expect(ast.left.left.operator).toBe('+');
        expect(ast.left.left.right.operator).toBe('*');
        expect(ast.right).toEqual({ type: 'Identifier', name: 'ok' });
    });

    test('parentheses override default precedence', () => {
        // Parenthesized additive expressions should stay grouped before multiplication.
        const ast = parseGuardExpression('(x + 2) * y > 10');

        expect(ast.left.operator).toBe('*');
        expect(ast.left.left.operator).toBe('+');
    });

    test('parses unary operators', () => {
        // Unary boolean and numeric operators are used by the engine for type checking and evaluation.
        expect(parseGuardExpression('!flag')).toMatchObject({
            type: 'UnaryExpression',
            operator: '!',
            argument: { type: 'Identifier', name: 'flag' }
        });
        expect(parseGuardExpression('-x < 0').left).toMatchObject({
            type: 'UnaryExpression',
            operator: '-',
            argument: { type: 'Identifier', name: 'x' }
        });
    });

    test('parses function calls and multiple argument expressions', () => {
        // Function-call syntax is parsed here; function validity is checked by GuardEngine.
        const ast = parseGuardExpression('len(name) == 3');

        expect(ast.left).toEqual({
            type: 'CallExpression',
            callee: 'len',
            arguments: [{ type: 'Identifier', name: 'name' }]
        });
    });

    test('parses booleans, strings, ints, and reals', () => {
        // Literal tokenization should preserve both the JS value and the guard value type.
        expect(parseGuardExpression('true')).toEqual({ type: 'Literal', value: true, valueType: 'bool' });
        expect(parseGuardExpression('"hello"')).toEqual({ type: 'Literal', value: 'hello', valueType: 'string' });
        expect(parseGuardExpression('3')).toEqual({ type: 'Literal', value: 3, valueType: 'int' });
        expect(parseGuardExpression('3.14')).toEqual({ type: 'Literal', value: 3.14, valueType: 'real' });
    });

    test('normalizes escaped string characters according to parser rules', () => {
        // Guard string parsing consumes the escape marker and keeps the escaped character.
        expect(parseGuardExpression('"a\\"b"')).toEqual({
            type: 'Literal',
            value: 'a"b',
            valueType: 'string'
        });
    });

    test('throws for malformed expressions', () => {
        // Syntax errors should fail before the engine sees an AST.
        expect(() => parseGuardExpression('(x > 0')).toThrow(/Expected "\)"|Unexpected end/);
        expect(() => parseGuardExpression('x == "unterminated')).toThrow(/Unterminated string literal/);
        expect(() => parseGuardExpression('x @ 1')).toThrow(/Unexpected token "@"/);
        expect(() => parseGuardExpression('x > 1 2')).toThrow(/Unexpected token "2"/);
    });
});
