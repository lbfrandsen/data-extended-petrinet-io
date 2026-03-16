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

  const parts = input.split('*').map(p => p.trim()).filter(Boolean);

  for (const p of parts) {
    if (!isTokenColor(p)) {
      throw new Error(`Invalid token color: ${p}`);
    }
  }

  return parts;
}

export function parsePlaceType(placeType) {
  if (Array.isArray(placeType)) {
    throw new Error('Legacy place type arrays are not supported. Use place_type as a single string value.');
  }

  if (placeType === null || placeType === undefined) {
    return [];
  }

  return parseType(String(placeType));
}

export function getRawPlaceType(businessObject) {
  if (!businessObject || typeof businessObject !== 'object') {
    return null;
  }

  return businessObject.place_type ?? null;
}

export function parsePlaceTypeFromBusinessObject(businessObject) {
  return parsePlaceType(getRawPlaceType(businessObject));
}

/**
 * Validate RAW user input strings against a type.
 * rawValues are strings like: '4', '"a"', 'true', '232.5'
 */
export function validateValuesAgainstType(type, rawValues) {
  if (type.length !== rawValues.length) {
    return {
      ok: false,
      error: `Expected ${type.length} values, got ${rawValues.length}`
    };
  }

  for (let i = 0; i < type.length; i++) {
    const raw = String(rawValues[i]).trim();

    if (!valueMatchesColor(type[i], raw)) {
      return {
        ok: false,
        error: `Invalid format at position ${i} for type ${type[i]}: ${raw}`
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
