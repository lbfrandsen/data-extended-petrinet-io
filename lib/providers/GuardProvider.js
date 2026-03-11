import { parseType } from '../helpers/token-types.js';
import { showAlert, showPrompt } from '../services/DialogService.js';

function parsePlaceTypes(types) {
  if (!Array.isArray(types) || types.length === 0) {
    return [];
  }

  const firstType = types[0];
  return Array.isArray(firstType) ? firstType : parseType(firstType);
}

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

function getTypedConnections(transition, direction) {
  const connections = direction === 'input' || direction === "Input" || direction === "INPUT" || direction === "In" || direction === "in" || direction === "IN"
    ? (Array.isArray(transition?.incoming) ? transition.incoming : [])
    : (Array.isArray(transition?.outgoing) ? transition.outgoing : []);

  return connections
    .map(connection => {
      const place = direction === 'input' ? connection?.source : connection?.target;

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

function buildVariableTypeMap(typedConnections) {
  const map = new Map();

  for (const { vars, types } of typedConnections) {
    const count = Math.min(vars.length, types.length);

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

function buildCombinedVariableMeta(inputVariableTypes, outputVariableTypes) {
  const combined = new Map();

  for (const [name, type] of inputVariableTypes.entries()) {
    combined.set(name, { type, side: 'input' });
  }

  for (const [name, type] of outputVariableTypes.entries()) {
    if (combined.has(name)) {
      const existing = combined.get(name);

      if (existing.type !== type) {
        throw new Error(
          `Variable "${name}" exists on both input and output with conflicting types: ${existing.type} and ${type}.`
        );
      }

      throw new Error(
        `Variable "${name}" exists on both input and output. Use distinct variable names for now.`
      );
    }

    combined.set(name, { type, side: 'output' });
  }

  return combined;
}

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
    variableName,
    side: meta.side,
    text: trimmed
  };
}

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

function findNearestPreviousOperator(sequence, clauseIndex, side) {
  for (let i = clauseIndex - 1; i >= 0; i--) {
    const token = sequence[i];

    if (token.kind === 'clause' && token.side === side) {
      return null;
    }

    if (token.kind === 'operator') {
      return token.value;
    }
  }

  return null;
}

function rebuildGuardForSide(sequence, side) {
  const parts = [];

  for (let i = 0; i < sequence.length; i++) {
    const token = sequence[i];

    if (token.kind !== 'clause' || token.side !== side) {
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
      side: clause.side
    };
  });

  return {
    inputGuard: rebuildGuardForSide(sequence, 'input'),
    outputGuard: rebuildGuardForSide(sequence, 'output')
  };
}

function formatVarList(variableTypes) {
  const entries = [...variableTypes.entries()];
  return entries.length === 0
    ? '(none)'
    : entries.map(([name, type]) => `${name}: ${type}`).join('\n');
}

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
    buildCombinedVariableMeta(inputVariableTypes, outputVariableTypes);
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