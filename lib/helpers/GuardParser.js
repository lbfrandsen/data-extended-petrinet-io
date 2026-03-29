const EMPTY_GUARD_ERROR = 'Guard is empty.';

// Returns true when a character can start an identifier token.
function isIdentifierStart(char) {
  return /[A-Za-z_]/.test(char);
}

// Returns true when a character can appear after the first identifier character.
function isIdentifierPart(char) {
  return /[A-Za-z0-9_]/.test(char);
}

// Returns true when a character is numeric.
function isDigit(char) {
  return /[0-9]/.test(char);
}

// Converts guard text into lexical tokens used by the parser.
function tokenizeGuardExpression(source) {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    const twoChar = source.slice(index, index + 2);

    if (['&&', '||', '==', '!=', '>=', '<='].includes(twoChar)) {
      tokens.push({ type: 'operator', value: twoChar });
      index += 2;
      continue;
    }

    if (['(', ')', ',', '+', '-', '*', '/', '%', '<', '>', '=', '!'].includes(char)) {
      const type = ['(', ')', ','].includes(char) ? 'punctuation' : 'operator';
      tokens.push({ type, value: char });
      index += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = '';
      index += 1;
      let closed = false;

      while (index < source.length) {
        const next = source[index];

        if (next === '\\') {
          const escaped = source[index + 1];
          if (escaped === undefined) {
            break;
          }

          value += escaped;
          index += 2;
          continue;
        }

        if (next === quote) {
          closed = true;
          index += 1;
          break;
        }

        value += next;
        index += 1;
      }

      if (!closed) {
        throw new Error('Unterminated string literal in guard expression.');
      }

      tokens.push({
        type: 'literal',
        value,
        valueType: 'string'
      });
      continue;
    }

    if (isDigit(char) || (char === '.' && isDigit(source[index + 1] || ''))) {
      let numberText = '';
      let dotCount = 0;

      while (index < source.length) {
        const next = source[index];

        if (isDigit(next)) {
          numberText += next;
          index += 1;
          continue;
        }

        if (next === '.') {
          dotCount += 1;
          if (dotCount > 1) {
            break;
          }
          numberText += next;
          index += 1;
          continue;
        }

        break;
      }

      if (numberText === '.' || !numberText.length) {
        throw new Error(`Invalid numeric literal near "${source.slice(index, index + 10)}".`);
      }

      tokens.push({
        type: 'literal',
        value: Number(numberText),
        valueType: numberText.includes('.') ? 'real' : 'int'
      });
      continue;
    }

    if (isIdentifierStart(char)) {
      let name = char;
      index += 1;

      while (index < source.length && isIdentifierPart(source[index])) {
        name += source[index];
        index += 1;
      }

      if (/^(true|false)$/i.test(name)) {
        tokens.push({
          type: 'literal',
          value: name.toLowerCase() === 'true',
          valueType: 'bool'
        });
      } else {
        tokens.push({
          type: 'identifier',
          value: name
        });
      }

      continue;
    }

    throw new Error(`Unexpected token "${char}" in guard expression.`);
  }

  return tokens;
}

// Recursive-descent parser with explicit precedence handling.
class GuardParser {
  // Initializes parser state for one token list.
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  // Parses a complete expression and ensures no trailing tokens remain.
  parse() {
    const ast = this.parseOr();

    if (this.peek()) {
      throw new Error(`Unexpected token "${this.peek().value}" in guard expression.`);
    }

    return ast;
  }

  // Parses OR expressions.
  parseOr() {
    let node = this.parseAnd();

    while (this.matchOperator('||')) {
      const operator = this.consume().value;
      const right = this.parseAnd();
      node = {
        type: 'BinaryExpression',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  // Parses AND expressions.
  parseAnd() {
    let node = this.parseComparison();

    while (this.matchOperator('&&')) {
      const operator = this.consume().value;
      const right = this.parseComparison();
      node = {
        type: 'BinaryExpression',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  // Parses comparison expressions.
  parseComparison() {
    let node = this.parseAdditive();

    while (this.matchAnyOperator(['=', '==', '!=', '>', '<', '>=', '<='])) {
      const operator = this.consume().value;
      const right = this.parseAdditive();
      node = {
        type: 'BinaryExpression',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  // Parses additive arithmetic expressions.
  parseAdditive() {
    let node = this.parseMultiplicative();

    while (this.matchAnyOperator(['+', '-'])) {
      const operator = this.consume().value;
      const right = this.parseMultiplicative();
      node = {
        type: 'BinaryExpression',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  // Parses multiplicative arithmetic expressions.
  parseMultiplicative() {
    let node = this.parseUnary();

    while (this.matchAnyOperator(['*', '/', '%'])) {
      const operator = this.consume().value;
      const right = this.parseUnary();
      node = {
        type: 'BinaryExpression',
        operator,
        left: node,
        right
      };
    }

    return node;
  }

  // Parses unary operators.
  parseUnary() {
    if (this.matchAnyOperator(['!', '+', '-'])) {
      const operator = this.consume().value;
      const argument = this.parseUnary();
      return {
        type: 'UnaryExpression',
        operator,
        argument
      };
    }

    return this.parsePrimary();
  }

  // Parses literals, identifiers, function calls, and grouped subexpressions.
  parsePrimary() {
    if (this.matchPunctuation('(')) {
      this.consume();
      const inner = this.parseOr();
      this.expectPunctuation(')');
      return inner;
    }

    const token = this.peek();

    if (!token) {
      throw new Error('Unexpected end of guard expression.');
    }

    if (token.type === 'literal') {
      this.consume();
      return {
        type: 'Literal',
        value: token.value,
        valueType: token.valueType
      };
    }

    if (token.type === 'identifier') {
      this.consume();
      const identifierNode = {
        type: 'Identifier',
        name: token.value
      };

      if (!this.matchPunctuation('(')) {
        return identifierNode;
      }

      this.consume();
      const args = [];

      if (!this.matchPunctuation(')')) {
        while (true) {
          args.push(this.parseOr());
          if (!this.matchPunctuation(',')) {
            break;
          }
          this.consume();
        }
      }

      this.expectPunctuation(')');

      return {
        type: 'CallExpression',
        callee: token.value,
        arguments: args
      };
    }

    throw new Error(`Unexpected token "${token.value}" in guard expression.`);
  }

  // Returns the current token without consuming it.
  peek() {
    return this.tokens[this.index];
  }

  // Consumes and returns the current token.
  consume() {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }

  // Checks whether the current token is one specific operator.
  matchOperator(value) {
    const token = this.peek();
    return token?.type === 'operator' && token.value === value;
  }

  // Checks whether the current token is any operator in the provided list.
  matchAnyOperator(values) {
    const token = this.peek();
    return token?.type === 'operator' && values.includes(token.value);
  }

  // Checks whether the current token is one specific punctuation symbol.
  matchPunctuation(value) {
    const token = this.peek();
    return token?.type === 'punctuation' && token.value === value;
  }

  // Consumes one required punctuation symbol or throws.
  expectPunctuation(value) {
    if (!this.matchPunctuation(value)) {
      throw new Error(`Expected "${value}" in guard expression.`);
    }
    this.consume();
  }
}

// Parses a guard expression string into an AST.
export function parseGuardExpression(expression) {
  const source = String(expression ?? '').trim();
  if (!source) {
    throw new Error(EMPTY_GUARD_ERROR);
  }

  const tokens = tokenizeGuardExpression(source);
  const parser = new GuardParser(tokens);
  return parser.parse();
}

// Returns true when an error came from parsing an empty guard expression.
export function isGuardEmptyError(error) {
  return error instanceof Error && error.message === EMPTY_GUARD_ERROR;
}
