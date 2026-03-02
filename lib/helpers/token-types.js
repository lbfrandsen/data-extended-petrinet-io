// lib/helpers/token-types.js

import { isTokenColor, valueMatchesColor } from './token-colors.js';

/**
 * TokenType = array of colors
 * ε (typeless) = []
 */

export function typeToKey(type) {
  if (!type || type.length === 0) return '';
  return type.join('*');
}

export function typeToLabel(type) {
  if (!type || type.length === 0) return 'ε';
  return type.join('*');
}

export function parseType(input) {
  if (!input || input === '' || input === 'ε') return [];

  const parts = input.split('*').map(p => p.trim());

  for (const p of parts) {
    if (!isTokenColor(p)) {
      throw new Error(`Invalid token color: ${p}`);
    }
  }

  return parts;
}

export function validateValuesAgainstType(type, values) {
  if (type.length !== values.length) {
    return {
      ok: false,
      error: `Expected ${type.length} values, got ${values.length}`
    };
  }

  for (let i = 0; i < type.length; i++) {
    if (!valueMatchesColor(type[i], values[i])) {
      return {
        ok: false,
        error: `Value at position ${i} does not match type ${type[i]}`
      };
    }
  }

  return { ok: true };
}

export function normalizePlaceTypes(types) {
  const normalized = [];

  for (const t of types) {
    const parsed = Array.isArray(t) ? t : parseType(t);
    normalized.push(typeToKey(parsed));
  }

  return [...new Set(normalized)];
}