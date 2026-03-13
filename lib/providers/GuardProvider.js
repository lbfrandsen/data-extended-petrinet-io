import { parseType, parsePlaceTypes } from '../helpers/token-types.js';
import { showAlert, showPrompt} from '../services/DialogService.js';

/**
 * Extracts variable names from an arc, preferring explicit parsed vars over raw inscription text.
 */
function getArcVars(connection) {
  const explicitVars = connection?.businessObject?.arcInscriptionVars;
  if (Array.isArray(explicitVars) && explicitVars.length > 0) {
    return explicitVars;
  }

  const inscription = String(connection?.businessObject?.arcInscription ?? '').trim();
  if (!inscription) {
    return [];
  }

  const inner =
    inscription.startsWith('<') && inscription.endsWith('>')
      ? inscription.slice(1, -1)
      : inscription;

  return inner
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

/**
 * Collects all typed input or output connections of a transition together with their vars and types.
 */
function getTypedConnections(transition, direction) {
  const isInput =
    direction === 'input' ||
    direction === 'Input' ||
    direction === 'INPUT' ||
    direction === 'In' ||
    direction === 'in' ||
    direction === 'IN';

  const connections = isInput
    ? (Array.isArray(transition?.incoming) ? transition.incoming : [])
    : (Array.isArray(transition?.outgoing) ? transition.outgoing : []);

  return connections
    .map(connection => {
      const place = isInput ? connection?.source : connection?.target;

      if (place?.type !== 'petri:place') {
        return null;
      }

      const vars = getArcVars(connection);
      const types = parsePlaceTypes(place?.businessObject?.types || []);

      if (vars.length === 0 || types.length === 0) {
        return null;
      }

      return { connection, place, vars, types };
    })
    .filter(Boolean);
}

/**
 * Builds a variable-to-type map for one side of a transition and rejects conflicting reuse.
 */
function buildVariableTypeMap(typedConnections) {
  const map = new Map();

  for (const { vars, types } of typedConnections) {
  if (vars.length !== types.length) {
    throw new Error(
      `Arc variables "${vars.join(', ')}" do not match place type arity ${types.length}.`
    );
  }
    for (let i = 0; i < count; i++) {
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

/**
 * Merges input and output variable maps and tracks on which side each variable is valid.
 */
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

/**
 * Parses a literal value and classifies it as string, bool, int, or real.
 */
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

/**
 * Verifies that a variable type can be compared with the given operator and literal type.
 */
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

/**
 * Parses one guard clause, validates it, and attaches the set of sides on which it applies.
 */
function parseClause(expression, variableMeta) {
  const trimmed = String(expression ?? '').trim();
  const match = trimmed.match(/^([A-Za-z]+)\s*(==|!=|>=|<=|=|>|<)\s*(.+)$/);

  if (!match) {
    throw new Error(`Invalid clause "${trimmed}". Expected something like x > 5 or y = "a".`);
  }

  const [, variableName, operator, literalRaw] = match;
  const meta = variableMeta.get(variableName);

  if (!meta) {
    throw new Error(`Unknown variable "${variableName}".`);
  }

  const literal = parseLiteral(literalRaw);
  validateOperator(meta.type, operator, literal.kind);

  return {
    text: trimmed,
    sides: meta.sides
  };
}

/**
 * Splits a guard expression into alternating clause and boolean-operator tokens.
 */
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

/**
 * Finds the operator that should connect the current clause to the previous kept clause on one side.
 */
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

/**
 * Rebuilds a side-specific guard by keeping only clauses that belong to that side.
 */
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

/**
 * Validates a combined guard expression and splits it into input and output guards.
 */
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

/**
 * Formats a variable/type map into a human-readable prompt list.
 */
function formatVarList(variableTypes) {
  const entries = [...variableTypes.entries()];
  return entries.length === 0
    ? '(none)'
    : entries.map(([name, type]) => `${name}: ${type}`).join('\n');
}

/**
 * Builds the guard dialog message shown to the user.
 */
function buildPromptMessage(inputVariableTypes, outputVariableTypes) {
  return (
    `Type one guard expression. The code will separate input and output variables automatically.\n\n` +
    `Example:\n` +
    `x > 5 && y < 10\n\n` +
    `Available INPUT variables:\n${formatVarList(inputVariableTypes)}\n\n` +
    `Available OUTPUT variables:\n${formatVarList(outputVariableTypes)}\n\n` +
    `Leave empty to clear both guards.`
  );
}

/**
 * Opens the guard prompt, validates the entered expression, and stores the split guards on the transition.
 */
export async function promptAndSetGuard(transition, eventBus) {
  if (transition?.type !== 'petri:transition') {
    return;
  }

  if (!transition.businessObject) {
    transition.businessObject = {};
  }

  const inputConnections = getTypedConnections(transition, 'input');
  const outputConnections = getTypedConnections(transition, 'output');

  if (inputConnections.length === 0 && outputConnections.length === 0) {
    await showAlert({
      title: 'No typed arcs found',
      message: 'No typed input or output arcs found yet.'
    });
    return;
  }

  let inputVariableTypes;
  let outputVariableTypes;

  try {
    inputVariableTypes = buildVariableTypeMap(inputConnections);
    outputVariableTypes = buildVariableTypeMap(outputConnections);
  } catch (error) {
    await showAlert({
      title: 'Guard setup error',
      message: error.message
    });
    return;
  }

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
    transition.businessObject.outputGuard = result.outputGuard;

    eventBus?.fire('element.changed', { element: transition });
  } catch (error) {
    await showAlert({
      title: 'Invalid guard',
      message: error.message
    });
  }
}