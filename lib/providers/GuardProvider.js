import * as placeTypeUtils from '../helpers/placeTypeUtils.js';
import * as getters from '../helpers/getters.js';
import {
  formatGuardAst,
  typeCheckGuardAst
} from '../helpers/GuardEngine.js';
import { parseGuardExpression } from '../helpers/GuardParser.js';
import { showAlert, showPrompt } from '../services/DialogService.js';

// Opens the guard prompt, validates the entered expression, and stores it on the transition.
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

  const currentValue = String(transition.businessObject.guardExpression ?? '').trim();

  const input = await showPrompt({
    title: 'Set transition guard',
    message: buildPromptMessage(inputVariableTypes, outputVariableTypes),
    initialValue: currentValue,
    placeholder: 'x > 5 && (y < 10 || z = "a")',
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

    transition.businessObject.guardExpression = result;

    eventBus?.fire('element.changed', { element: transition });
  } catch (error) {
    await showAlert({
      title: 'Invalid guard',
      message: error.message
    });
  }
}

// Validates a full guard expression and returns normalized guard text.
function splitAndValidateGuardExpression(expression, inputVariableTypes, outputVariableTypes) {
  const source = String(expression ?? '').trim();

  // Empty input means "clear guard".
  if (!source) {
    return '';
  }

  let ast;

  try {
    ast = parseGuardExpression(source);
  } catch (error) {
    throw error;
  }

  const variableMeta = buildCombinedVariableMeta(inputVariableTypes, outputVariableTypes);
  typeCheckGuardAst(ast, variableMeta);
  return formatGuardAst(ast);
}

// Extracts variable names from an arc, preferring explicit parsed vars over raw inscription text.
function getArcVars(arc) {
  const explicitVars = arc?.businessObject?.arcInscriptionVars;
  return Array.isArray(explicitVars) ? explicitVars : [];
}

// Collects all types and vars from connected places.
function getTypedArcs(transition, direction) {
  const isInput = direction === 'input';

  const arcs = isInput
    ? (Array.isArray(transition?.incoming) ? transition.incoming : [])
    : (Array.isArray(transition?.outgoing) ? transition.outgoing : []);

  return arcs
    .map(arc => {
      const context = getters.getTypedArcContext(arc, direction);

      if (!context) {
        return null;
      }

      if (context.vars.length === 0 || context.placeType.length === 0) {
        return null;
      }

      return {
        arc,
        place: context.place,
        vars: context.vars,
        types: context.placeType
      };
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

// Merges input and output variable maps into a single variable-type map.
function buildCombinedVariableMeta(inputVariableTypes, outputVariableTypes) {
  const combined = new Map();

  for (const [name, type] of inputVariableTypes.entries()) {
    combined.set(name, { type });
  }

  for (const [name, type] of outputVariableTypes.entries()) {
    if (combined.has(name)) {
      const existing = combined.get(name);

      if (existing.type !== type) {
        throw new Error(
          `Variable "${name}" exists on both input and output with conflicting types: ${existing.type} and ${type}.`
        );
      }

      continue;
    }

    combined.set(name, { type });
  }

  return combined;
}

// Formats a variable/type map into a readable prompt list.
function formatVarList(variableTypes) {
  const entries = [...variableTypes.entries()];
  return entries.length === 0
    ? '(none)'
    : entries.map(([name, type]) => `${name}: ${type}`).join('\n');
}

function buildPromptMessage(inputVariableTypes, outputVariableTypes) {
  // Builds the help text shown in the guard prompt, including available typed variables.
  return (
    `Type a guard expression.\n\n` +
    `Examples:\n` +
    `x > 5 && (y < 10 || z = "a")\n` +
    `x + y > z\n\n` +
    `Available INPUT variables:\n${formatVarList(inputVariableTypes)}\n\n` +
    `Available OUTPUT variables:\n${formatVarList(outputVariableTypes)}\n\n` +
    `Leave empty to clear guard.`
  );
}
