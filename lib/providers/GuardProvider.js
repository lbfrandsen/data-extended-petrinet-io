import { parseType } from '../helpers/token-types.js';
import { showAlert, showPrompt } from '../services/DialogService.js';

function isPetriPlace(element) {
    return element?.type === 'petri:place' || element?.$type === 'petri:Place';
}

function isPetriTransition(element) {
  return (
    element?.type === 'petri:transition' ||
    element?.type === 'petri:empty_transition' ||
    element?.$type === 'petri:Transition'
  );
}

function parsePlaceTypes(types) {
  if (!Array.isArray(types) || types.length === 0) {
    return [];
  }

  const firstType = types[0];

  if (Array.isArray(firstType)) {
    return firstType;
  }

  return parseType(firstType);
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
  const connections =
    direction === 'input'
      ? (Array.isArray(transition?.incoming) ? transition.incoming : [])
      : (Array.isArray(transition?.outgoing) ? transition.outgoing : []);

  const result = [];

  for (const connection of connections) {
    const place = direction === 'input' ? connection?.source : connection?.target;

    if (!isPetriPlace(place)) {
      continue;
    }

    const vars = getArcVars(connection);
    const types = parsePlaceTypes(place?.businessObject?.types || []);

    if (vars.length === 0 || types.length === 0) {
      continue;
    }

    result.push({
      connection,
      place,
      vars,
      types
    });
  }

  return result;
}

function buildVariableTypeMap(typedConnections) {
  const map = new Map();

  for (const typedConnection of typedConnections) {
    const count = Math.min(typedConnection.vars.length, typedConnection.types.length);

    for (let i = 0; i < count; i++) {
      const variableName = typedConnection.vars[i];
      const variableType = typedConnection.types[i];

      if (!map.has(variableName)) {
        map.set(variableName, variableType);
        continue;
      }

      const existingType = map.get(variableName);

      if (existingType !== variableType) {
        throw new Error(
          `Variable "${variableName}" is used with conflicting types: ${existingType} and ${variableType}.`
        );
      }
    }
  }

  return map;
}

function parseLiteral(raw) {
  const value = String(raw ?? '').trim();

  if (/^"([^"\\]|\\.)*"$/.test(value) || /^'([^'\\]|\\.)*'$/.test(value)) {
    return {
      kind: 'string',
      value: value.slice(1, -1)
    };
  }

  if (/^(true|false)$/i.test(value)) {
    return {
      kind: 'bool',
      value: value.toLowerCase() === 'true'
    };
  }

  if (/^[+-]?\d+$/.test(value)) {
    return {
      kind: 'int',
      value: Number(value)
    };
  }

  if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)$/.test(value)) {
    return {
      kind: 'real',
      value: Number(value)
    };
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

function validateSingleClause(expression, variableTypes) {
  const trimmed = String(expression ?? '').trim();

  const match = trimmed.match(/^([A-Za-z]+)\s*(==|!=|>=|<=|=|>|<)\s*(.+)$/);
  if (!match) {
    throw new Error(`Invalid clause "${trimmed}". Expected something like x > 5 or y = "a".`);
  }

  const [, variableName, operator, literalRaw] = match;
  const variableType = variableTypes.get(variableName);

  if (!variableType) {
    throw new Error(`Unknown variable "${variableName}".`);
  }

  const literal = parseLiteral(literalRaw);
  validateOperator(variableType, operator, literal.kind);
}

function validateGuardExpression(expression, variableTypes) {
  const trimmed = String(expression ?? '').trim();

  if (!trimmed) {
    return '';
  }

  // supports:
  // x > 5
  // y = "a"
  // x > 5 && y = "a"
  // a = 1 || b = 2
  const clauses = trimmed.split(/\s*(?:&&|\|\|)\s*/).filter(Boolean);

  if (clauses.length === 0) {
    throw new Error('Guard is empty.');
  }

  for (const clause of clauses) {
    validateSingleClause(clause, variableTypes);
  }

  return trimmed;
}

function buildPromptMessage(direction, typedConnections, variableTypes) {
  const header = direction === 'input' ? 'Set input guard' : 'Set output guard';

  const rows = [];
  let arcNumber = 1;

  for (const typedConnection of typedConnections) {
    const count = Math.min(typedConnection.vars.length, typedConnection.types.length);
    const pairs = [];

    for (let i = 0; i < count; i++) {
      pairs.push(`${typedConnection.vars[i]}: ${typedConnection.types[i]}`);
    }

    rows.push(`Arc ${arcNumber}: ${pairs.join(', ')}`);
    arcNumber++;
  }

  const allVars = [...variableTypes.entries()].map(([name, type]) => `${name}: ${type}`);

  const firstVar = variableTypes.keys().next().value;
  const firstType = variableTypes.get(firstVar);

  const example1 =
    firstType === 'string'
      ? `${firstVar} = "a"`
      : firstType === 'bool'
        ? `${firstVar} = true`
        : `${firstVar} > 5`;

  const example2 =
    allVars.length >= 2
      ? (() => {
          const [leftName, leftType] = [...variableTypes.entries()][0];
          const [rightName, rightType] = [...variableTypes.entries()][1];

          const leftExpr =
            leftType === 'string'
              ? `${leftName} = "a"`
              : leftType === 'bool'
                ? `${leftName} = true`
                : `${leftName} > 5`;

          const rightExpr =
            rightType === 'string'
              ? `${rightName} != "b"`
              : rightType === 'bool'
                ? `${rightName} = false`
                : `${rightName} <= 10`;

          return `${leftExpr} && ${rightExpr}`;
        })()
      : null;

  return (
    `${header}\n\n` +
    `Available variables:\n${allVars.join('\n')}\n\n` +
    `Grouped by arc:\n${rows.join('\n')}\n\n` +
    `Examples:\n` +
    `${example1}\n` +
    `${example2 ? `${example2}\n` : ''}\n` +
    `Leave empty to clear the guard.`
  );
}

async function promptAndSetGuard(transition, eventBus, direction) {
  if (!isPetriTransition(transition)) {
    return;
  }

  if (!transition.businessObject) {
    transition.businessObject = {};
  }

  const typedConnections = getTypedConnections(transition, direction);

  if (typedConnections.length === 0) {
    await showAlert({
      title: 'No typed arcs',
      message: `No typed ${direction} arcs found yet. Connect one typed place first.`
    });
    return;
  }
  let variableTypes;
  try {
    variableTypes = buildVariableTypeMap(typedConnections);
  } catch (error) {
    await showAlert({
      title: 'Type conflict',
      message: error.message
    });
    return;
}

  const propertyName = direction === 'input' ? 'inputGuard' : 'outputGuard';
  const current = String(transition.businessObject[propertyName] ?? '');

  const input = await showPrompt({
    title: direction === 'input' ? 'Set input guard' : 'Set output guard',
    message: buildPromptMessage(direction, typedConnections, variableTypes),
    initialValue: current
  });

  if (input === null) {
    return;
  }

  try {
    const guard = validateGuardExpression(input, variableTypes);
    transition.businessObject[propertyName] = guard;
    eventBus?.fire('element.changed', { element: transition });
  } catch (error) {
    await showAlert({
      title: 'Invalid guard',
      message: error.message
    });
  }
}

export async function promptAndSetInputGuard(transition, eventBus) {
  promptAndSetGuard(transition, eventBus, 'input');
}

export async function promptAndSetOutputGuard(transition, eventBus) {
  promptAndSetGuard(transition, eventBus, 'output');
}