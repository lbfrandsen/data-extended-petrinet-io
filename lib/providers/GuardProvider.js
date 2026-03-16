import { parsePlaceTypeFromBusinessObject } from '../helpers/token-types.js';
import { showAlert, showPrompt } from '../services/DialogService.js';


// Opens the guard prompt, validates the entered expression, and stores the split guards on the transition.
export async function promptAndSetGuard(transition, eventBus) {
  if (transition?.type !== 'petri:transition') {
    return;
  }

  if (!transition.businessObject) {
    transition.businessObject = {};
  }

  const inputarcs = getTypedArcs(transition, 'input');
  const outputarcs = getTypedArcs(transition, 'output');

  if (inputarcs.length === 0 && outputarcs.length === 0) {
    await showAlert({
      title: 'No typed arcs found',
      message: 'No typed input or output arcs found yet.'
    });
    return;
  }

  let inputVariableTypes;
  let outputVariableTypes;

  try {
    inputVariableTypes = buildVariableTypeMap(inputarcs);
    outputVariableTypes = buildVariableTypeMap(outputarcs);
  } catch (error) {
    await showAlert({
      title: 'Guard setup error',
      message: error.message
    });
    return;
  }

  // Used for prefilling prompt
  const currentInput = String(transition.businessObject.inputGuard ?? '').trim();
  const currentOutput = String(transition.businessObject.outputGuard ?? '').trim();
  const currentValue = [currentInput, currentOutput].filter(Boolean).join(' && ');

  const input = await showPrompt({
    title: 'Set transition guard',
    message: buildPromptMessage(inputVariableTypes, outputVariableTypes),
    initialValue: currentValue,
    placeholder: 'x > 5 && y < 10',
    validate: value => {
      try {
        splitAndValidateGuardExpression(value, inputVariableTypes, outputVariableTypes);
        return '';
      } catch (error) {
        return error.message;
      }
    }
  });

  if (input === null) {
    return;
  }

  try {
    const result = splitAndValidateGuardExpression(
      input,
      inputVariableTypes,
      outputVariableTypes
    );

    transition.businessObject.inputGuard = result.inputGuard;
    console.log("Input guard: ".concat(transition.businessObject.inputGuard));
    transition.businessObject.outputGuard = result.outputGuard;
    console.log("Output guard: ".concat(transition.businessObject.outputGuard));

    eventBus?.fire('element.changed', { element: transition });
  } catch (error) {
    await showAlert({
      title: 'Invalid guard',
      message: error.message
    });
  }
}


// Validates a combined guard expression and splits it into input and output guards for backend.
function splitAndValidateGuardExpression(expression, inputVariableTypes, outputVariableTypes) {
  const trimmed = String(expression ?? '').trim();

  if (!trimmed) {
    return {
      inputGuard: '',
      outputGuard: ''
    };
  }

  const variableMeta = buildCombinedVariableMeta(inputVariableTypes, outputVariableTypes);
  const tokens = tokenizeExpression(trimmed);

  if (tokens.length === 0) {
    throw new Error('Guard is empty.');
  }

  const sequence = tokens.map(token => {
    if (token.kind === 'operator') {
      return token;
    }

    const clause = parseClause(token.value, variableMeta);
    return {
      kind: 'clause',
      value: clause.text,
      sides: clause.sides
    };
  });

  return {
    inputGuard: rebuildGuardForSide(sequence, 'input'),
    outputGuard: rebuildGuardForSide(sequence, 'output')
  };
}


// Extracts variable names from an arc, preferring explicit parsed vars over raw inscription text.
function getArcVars(arc) {
  const explicitVars = arc?.businessObject?.arcInscriptionVars;
  if (Array.isArray(explicitVars) && explicitVars.length > 0) {
    return explicitVars;
  }
  else return [];
}


// Collects all types and vars from connected places.
function getTypedArcs(transition, direction) {
  const isInput =
    direction === 'input' ||
    direction === 'Input' ||
    direction === 'INPUT' ||
    direction === 'In' ||
    direction === 'in' ||
    direction === 'IN';

  const arcs = isInput
    ? (Array.isArray(transition?.incoming) ? transition.incoming : [])
    : (Array.isArray(transition?.outgoing) ? transition.outgoing : []);

  return arcs
    .map(arc => {
      const place = isInput ? arc?.source : arc?.target;

      if (place?.type !== 'petri:place') {
        return null;
      }

      const vars = getArcVars(arc);
      const types = parsePlaceTypeFromBusinessObject(place?.businessObject);

      if (vars.length === 0 || types.length === 0) {
        return null;
      }

      return { arc, place, vars, types };
    })
    .filter(Boolean);
}


// Builds a variable-to-type map for one side of a transition and rejects conflicting reuse.
function buildVariableTypeMap(typedarcs) {
  const map = new Map();

  for (const { vars, types } of typedarcs) {
    if (vars.length !== types.length) {
      throw new Error(
        `Arc variables "${vars.join(', ')}" do not match place type arity ${types.length}.`
      );
    }
    for (let i = 0; i < vars.length; i++) {
      const name = vars[i];
      const type = types[i];

      if (!map.has(name)) {
        map.set(name, type);
        continue;
      }

      const existingType = map.get(name);
      if (existingType !== type) {
        throw new Error(
          `Variable "${name}" is used with conflicting types: ${existingType} and ${type}.`
        );
      }
    }
  }

  return map;
}


// Merges input and output variable maps and tracks on which side each variable is valid.
function buildCombinedVariableMeta(inputVariableTypes, outputVariableTypes) {
  const combined = new Map();

  for (const [name, type] of inputVariableTypes.entries()) {
    combined.set(name, { type, sides: new Set(['input']) });
  }

  for (const [name, type] of outputVariableTypes.entries()) {
    if (combined.has(name)) {
      const existing = combined.get(name);

      if (existing.type !== type) {
        throw new Error(
          `Variable "${name}" exists on both input and output with conflicting types: ${existing.type} and ${type}.`
        );
      }

      existing.sides.add('output');
      continue;
    }

    combined.set(name, { type, sides: new Set(['output']) });
  }

  return combined;
}


// Parses a literal value and classifies it as string, bool, int, or real.
function parseLiteral(raw) {
  const value = String(raw ?? '').trim();

  if (/^"([^"\\]|\\.)*"$/.test(value) || /^'([^'\\]|\\.)*'$/.test(value)) {
    return { kind: 'string', value: value.slice(1, -1) };
  }

  if (/^(true|false)$/i.test(value)) {
    return { kind: 'bool', value: value.toLowerCase() === 'true' };
  }

  if (/^[+-]?\d+$/.test(value)) {
    return { kind: 'int', value: Number(value) };
  }

  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)$/.test(value)) {
    return { kind: 'real', value: Number(value) };
  }

  throw new Error(`Could not parse literal "${value}".`);
}


// Verifies that a variable type can be compared with the given operator and literal type.
function validateOperator(variableType, operator, literalType) {
  const equalityOnly = ['=', '==', '!='];
  const ordered = ['>', '<', '>=', '<='];

  if (variableType === 'string') {
    if (!equalityOnly.includes(operator)) {
      throw new Error('Strings only support =, == and !=.');
    }
    if (literalType !== 'string') {
      throw new Error('String variables must be compared with a string literal like "a".');
    }
    return;
  }

  if (variableType === 'bool') {
    if (!equalityOnly.includes(operator)) {
      throw new Error('Booleans only support =, == and !=.');
    }
    if (literalType !== 'bool') {
      throw new Error('Bool variables must be compared with true or false.');
    }
    return;
  }

  if (variableType === 'int') {
    if (![...equalityOnly, ...ordered].includes(operator)) {
      throw new Error(`Unsupported operator "${operator}" for int.`);
    }
    if (literalType !== 'int') {
      throw new Error('Int variables must be compared with an integer literal like 5.');
    }
    return;
  }

  if (variableType === 'real') {
    if (![...equalityOnly, ...ordered].includes(operator)) {
      throw new Error(`Unsupported operator "${operator}" for real.`);
    }
    if (literalType !== 'int' && literalType !== 'real') {
      throw new Error('Real variables must be compared with a numeric literal like 5 or 5.2.');
    }
    return;
  }

  throw new Error(`Unsupported variable type "${variableType}".`);
}


// Parses one guard clause, validates it, and attaches the set of sides on which it applies.
function parseClause(expression, variableMeta) {
  const trimmed = String(expression ?? '').trim();
  const match = trimmed.match(/^(.*?)\s*(==|!=|>=|<=|=|>|<)\s*(.*?)$/);

  if (!match) {
    throw new Error(`Invalid clause "${trimmed}".`);
  }

  const [, leftRaw, operator, rightRaw] = match;
  const left = leftRaw.trim();
  const right = rightRaw.trim();

  const leftMeta = variableMeta.get(left);
  const rightMeta = variableMeta.get(right);

  // variable OP literal
  if (leftMeta) {
    try {
      const literal = parseLiteral(right);
      validateOperator(leftMeta.type, operator, literal.kind);

      return {
        text: trimmed,
        sides: leftMeta.sides
      };
    } catch {
      // fall through
    }
  }

  // literal OP variable
  if (rightMeta) {
    try {
      const literal = parseLiteral(left);
      validateOperator(rightMeta.type, operator, literal.kind);

      return {
        text: trimmed,
        sides: rightMeta.sides
      };
    } catch {
      // fall through
    }
  }

  // variable OP variable
  if (leftMeta && rightMeta) {
    if (leftMeta.type !== rightMeta.type) {
      throw new Error(
        `Type mismatch: "${left}" is ${leftMeta.type}, "${right}" is ${rightMeta.type}.`
      );
    }

    return {
      text: trimmed,
      sides: new Set([...leftMeta.sides, ...rightMeta.sides])
    };
  }

  // variable OP arithmetic-expression
  if (leftMeta && /[+\-*/()]/.test(right)) {
    return {
      text: trimmed,
      sides: leftMeta.sides
    };
  }

  // arithmetic-expression OP variable
  if (rightMeta && /[+\-*/()]/.test(left)) {
    return {
      text: trimmed,
      sides: rightMeta.sides
    };
  }

  throw new Error(`Invalid clause "${trimmed}".`);
}


// Splits a guard expression into alternating clause and boolean-operator tokens.
function tokenizeExpression(expression) {
  const trimmed = String(expression ?? '').trim();

  if (!trimmed) {
    return [];
  }

  return trimmed
    .split(/(\s*(?:&&|\|\|)\s*)/)
    .map(part => part.trim())
    .filter(Boolean)
    .map((value, index) => ({
      kind: index % 2 === 0 ? 'clause' : 'operator',
      value
    }));
}


// Finds the operator that should connect the current clause to the previous kept clause
function findNearestPreviousOperator(sequence, clauseIndex, side) {
  for (let i = clauseIndex - 1; i >= 0; i--) {
    const token = sequence[i];

    if (token.kind === 'clause' && token.sides.has(side)) {
      return null;
    }

    if (token.kind === 'operator') {
      return token.value;
    }
  }

  return null;
}


// Rebuilds a side-specific guard by keeping only clauses that belong to that side.
function rebuildGuardForSide(sequence, side) {
  const parts = [];

  for (let i = 0; i < sequence.length; i++) {
    const token = sequence[i];

    if (token.kind !== 'clause' || !token.sides.has(side)) {
      continue;
    }

    if (parts.length === 0) {
      parts.push(token.value);
      continue;
    }

    parts.push(findNearestPreviousOperator(sequence, i, side) || '&&');
    parts.push(token.value);
  }

  return parts.join(' ').trim();
}


// Formats a variable/type map into a readable prompt list.
function formatVarList(variableTypes) {
  const entries = [...variableTypes.entries()];
  return entries.length === 0
    ? '(none)'
    : entries.map(([name, type]) => `${name}: ${type}`).join('\n');
}

function buildPromptMessage(inputVariableTypes, outputVariableTypes) {
  return (
    `Type a guard expression. \n\n` +
    `Example:\n` +
    `x > 5 && y < 10\n\n` +
    `Available INPUT variables:\n${formatVarList(inputVariableTypes)}\n\n` +
    `Available OUTPUT variables:\n${formatVarList(outputVariableTypes)}\n\n` +
    `Leave empty to clear both guards.`
  );
}
