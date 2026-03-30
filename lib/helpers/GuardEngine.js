// Tri-state marker used when partial evaluation cannot decide a sub-expression yet.
const UNKNOWN = { kind: 'GUARD_UNKNOWN' };

const BOOLEAN_OPERATORS = new Set(['&&', '||']);
const COMPARISON_OPERATORS = new Set(['=', '==', '!=', '>', '<', '>=', '<=']);
const ARITHMETIC_OPERATORS = new Set(['+', '-', '*', '/', '%']);

// Returns true when a type is numeric in guard semantics.
function isNumericType(type) {
  return type === 'int' || type === 'real';
}

// Enforces equality compatibility rules, including int/real cross-comparisons.
function assertCompatibleEquality(leftType, rightType) {
  if (leftType === rightType) {
    return;
  }

  if (isNumericType(leftType) && isNumericType(rightType)) {
    return;
  }

  throw new Error(`Cannot compare ${leftType} with ${rightType} using equality.`);
}

// Recursively type-checks an AST node and returns its inferred type.
function typeCheckNode(node, variableMeta) {
  if (!node || typeof node !== 'object') {
    throw new Error('Invalid guard AST node.');
  }

  if (node.type === 'Literal') {
    return node.valueType;
  }

  if (node.type === 'Identifier') {
    const meta = variableMeta.get(node.name);
    if (!meta) {
      throw new Error(`Unknown variable "${node.name}" in guard expression.`);
    }
    return meta.type;
  }

  if (node.type === 'CallExpression') {
    const callee = node.callee.toLowerCase();
    if (callee !== 'len' && callee !== 'length') {
      throw new Error(`Unsupported function "${node.callee}" in guard expression.`);
    }
    if (node.arguments.length !== 1) {
      throw new Error(`${node.callee}(...) expects exactly one argument.`);
    }
    const argType = typeCheckNode(node.arguments[0], variableMeta);
    if (argType !== 'string') {
      throw new Error(`${node.callee}(...) only supports string arguments.`);
    }
    return 'int';
  }

  if (node.type === 'UnaryExpression') {
    const argType = typeCheckNode(node.argument, variableMeta);

    if (node.operator === '!') {
      if (argType !== 'bool') {
        throw new Error('Operator "!" requires a boolean expression.');
      }
      return 'bool';
    }

    if (node.operator === '+' || node.operator === '-') {
      if (!isNumericType(argType)) {
        throw new Error(`Unary operator "${node.operator}" requires int or real.`);
      }
      return argType;
    }

    throw new Error(`Unsupported unary operator "${node.operator}".`);
  }

  if (node.type !== 'BinaryExpression') {
    throw new Error(`Unsupported AST node type "${node.type}".`);
  }

  const leftType = typeCheckNode(node.left, variableMeta);
  const rightType = typeCheckNode(node.right, variableMeta);
  const operator = node.operator;

  if (BOOLEAN_OPERATORS.has(operator)) {
    if (leftType !== 'bool' || rightType !== 'bool') {
      throw new Error(`Operator "${operator}" requires boolean operands.`);
    }
    return 'bool';
  }

  if (ARITHMETIC_OPERATORS.has(operator)) {
    if (!isNumericType(leftType) || !isNumericType(rightType)) {
      throw new Error(`Operator "${operator}" requires int or real operands.`);
    }

    if (operator === '/') {
      return 'real';
    }

    if (leftType === 'real' || rightType === 'real') {
      return 'real';
    }

    return 'int';
  }

  if (COMPARISON_OPERATORS.has(operator)) {
    if (operator === '=' || operator === '==' || operator === '!=') {
      assertCompatibleEquality(leftType, rightType);
      return 'bool';
    }

    if (!isNumericType(leftType) || !isNumericType(rightType)) {
      throw new Error(`Operator "${operator}" requires numeric operands.`);
    }

    return 'bool';
  }

  throw new Error(`Unsupported operator "${operator}" in guard expression.`);
}

// Evaluates boolean operators using tri-state values (true/false/unknown).
function evaluateBooleanOp(operator, left, right) {
  if (operator === '&&') {
    if (left === false || right === false) {
      return false;
    }
    if (left === true && right === true) {
      return true;
    }
    return UNKNOWN;
  }

  if (operator === '||') {
    if (left === true || right === true) {
      return true;
    }
    if (left === false && right === false) {
      return false;
    }
    return UNKNOWN;
  }

  return UNKNOWN;
}

// Recursively evaluates one AST node against a variable binding.
// `partial = true` means "incomplete bindings are allowed": missing values become UNKNOWN.
// `partial = false` means "full check": missing values are treated as evaluation failure.
function evaluateNode(node, binding, partial) {
  if (node.type === 'Literal') {
    return node.value;
  }

  if (node.type === 'Identifier') {
    if (Object.prototype.hasOwnProperty.call(binding, node.name)) {
      return binding[node.name];
    }
    // If a variable is not bound yet, keep it as UNKNOWN in partial mode so callers can continue searching.
    return partial ? UNKNOWN : undefined;
  }

  if (node.type === 'CallExpression') {
    const callee = node.callee.toLowerCase();
    if (callee !== 'len' && callee !== 'length') {
      return undefined;
    }

    if (node.arguments.length !== 1) {
      return undefined;
    }

    const argValue = evaluateNode(node.arguments[0], binding, partial);
    if (argValue === UNKNOWN) {
      return UNKNOWN;
    }
    if (typeof argValue !== 'string') {
      return undefined;
    }
    return argValue.length;
  }

  if (node.type === 'UnaryExpression') {
    const argValue = evaluateNode(node.argument, binding, partial);

    if (argValue === UNKNOWN) {
      return UNKNOWN;
    }
    if (argValue === undefined) {
      return undefined;
    }

    if (node.operator === '!') {
      return Boolean(argValue) ? false : true;
    }

    if (node.operator === '+') {
      const parsed = Number(argValue);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    if (node.operator === '-') {
      const parsed = Number(argValue);
      return Number.isFinite(parsed) ? -parsed : undefined;
    }

    return undefined;
  }

  if (node.type !== 'BinaryExpression') {
    return undefined;
  }

  if (BOOLEAN_OPERATORS.has(node.operator)) {
    const left = evaluateNode(node.left, binding, partial);
    const right = evaluateNode(node.right, binding, partial);

    const normalizeBool = (value) => {
      if (value === UNKNOWN) return UNKNOWN;
      // In partial mode an unresolved boolean operand is UNKNOWN, not a hard failure.
      if (value === undefined) return partial ? UNKNOWN : undefined;
      if (typeof value !== 'boolean') return Boolean(value);
      return value;
    };

    const leftBool = normalizeBool(left);
    const rightBool = normalizeBool(right);

    if (leftBool === undefined || rightBool === undefined) {
      return undefined;
    }

    return evaluateBooleanOp(node.operator, leftBool, rightBool);
  }

  const leftValue = evaluateNode(node.left, binding, partial);
  const rightValue = evaluateNode(node.right, binding, partial);

  if (leftValue === UNKNOWN || rightValue === UNKNOWN) {
    return UNKNOWN;
  }

  if (leftValue === undefined || rightValue === undefined) {
    return undefined;
  }

  if (ARITHMETIC_OPERATORS.has(node.operator)) {
    const leftNum = Number(leftValue);
    const rightNum = Number(rightValue);

    if (!Number.isFinite(leftNum) || !Number.isFinite(rightNum)) {
      return undefined;
    }

    if (node.operator === '+') return leftNum + rightNum;
    if (node.operator === '-') return leftNum - rightNum;
    if (node.operator === '*') return leftNum * rightNum;
    if (node.operator === '/') {
      if (rightNum === 0) {
        return undefined;
      }
      return leftNum / rightNum;
    }
    if (node.operator === '%') {
      if (rightNum === 0) {
        return undefined;
      }
      return leftNum % rightNum;
    }
  }

  if (COMPARISON_OPERATORS.has(node.operator)) {
    if (node.operator === '=' || node.operator === '==') return leftValue === rightValue;
    if (node.operator === '!=') return leftValue !== rightValue;
    if (node.operator === '>') return leftValue > rightValue;
    if (node.operator === '<') return leftValue < rightValue;
    if (node.operator === '>=') return leftValue >= rightValue;
    if (node.operator === '<=') return leftValue <= rightValue;
  }

  return undefined;
}

// Returns numeric precedence used when formatting an AST back to text.
function getOperatorPrecedence(operator) {
  if (operator === '||') return 1;
  if (operator === '&&') return 2;
  if (COMPARISON_OPERATORS.has(operator)) return 3;
  if (operator === '+' || operator === '-') return 4;
  if (operator === '*' || operator === '/' || operator === '%') return 5;
  return 0;
}

// Formats a literal AST node to guard expression text.
function formatLiteral(node) {
  if (node.valueType === 'string') {
    return `"${String(node.value).replace(/"/g, '\\"')}"`;
  }
  if (node.valueType === 'bool') {
    return node.value ? 'true' : 'false';
  }
  return String(node.value);
}

// Serializes an AST node while preserving precedence via parentheses.
function formatGuardAstNode(node, parentPrecedence = 0) {
  if (!node || typeof node !== 'object') {
    return '';
  }

  if (node.type === 'Literal') {
    return formatLiteral(node);
  }

  if (node.type === 'Identifier') {
    return node.name;
  }

  if (node.type === 'CallExpression') {
    const args = node.arguments.map(arg => formatGuardAstNode(arg, 0)).join(', ');
    return `${node.callee}(${args})`;
  }

  if (node.type === 'UnaryExpression') {
    const inner = formatGuardAstNode(node.argument, 6);
    return `${node.operator}${inner}`;
  }

  if (node.type === 'BinaryExpression') {
    const precedence = getOperatorPrecedence(node.operator);
    const leftText = formatGuardAstNode(node.left, precedence);
    const rightText = formatGuardAstNode(node.right, precedence + 1);
    const text = `${leftText} ${node.operator} ${rightText}`;
    return precedence < parentPrecedence ? `(${text})` : text;
  }

  return '';
}

// Validates that an AST is type-safe and resolves to a boolean expression.
export function typeCheckGuardAst(ast, variableMeta) {
  const resultType = typeCheckNode(ast, variableMeta);
  if (resultType !== 'bool') {
    throw new Error('Guard expression must evaluate to boolean.');
  }
  return resultType;
}

// Evaluates an AST against bindings.
// With `options.partial = true`, undecidable results are returned as `undefined`
// (meaning "not false yet, but not provably true either").
export function evaluateGuardAst(ast, binding = {}, options = {}) {
  // Normalized flag used throughout recursive evaluation.
  const partial = Boolean(options.partial);
  const value = evaluateNode(ast, binding, partial);

  if (value === UNKNOWN) {
    // Partial mode keeps "unknown so far" as undefined; full mode treats it as false.
    return partial ? undefined : false;
  }

  if (value === undefined) {
    return false;
  }

  return Boolean(value);
}

// Formats a guard AST into normalized source text.
export function formatGuardAst(ast) {
  return formatGuardAstNode(ast, 0);
}
