// lib/helpers/token-colors.js

export const TokenColor = Object.freeze({
  INT: 'int',
  STRING: 'string',
  BOOL: 'bool',
  REAL: 'real'
});

export const ALL_TOKEN_COLORS = Object.values(TokenColor);

export function isTokenColor(color) {
  return ALL_TOKEN_COLORS.includes(color);
}

export function valueMatchesColor(color, value) {
  switch (color) {
    case TokenColor.INT:
      return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);

    case TokenColor.REAL:
      return typeof value === 'number' && Number.isFinite(value);

    case TokenColor.BOOL:
      return typeof value === 'boolean';

    case TokenColor.STRING:
      return typeof value === 'string';

    default:
      return false;
  }
}