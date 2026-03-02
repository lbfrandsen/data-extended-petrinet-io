// enum-ish object for token colors/types
export const TokenColor = Object.freeze({
  INT: 'int',
  STRING: 'string',
  BOOL: 'bool',
  REAL: 'real'
})

export const ALL_TOKEN_COLORS = Object.values(TokenColor);

export function isTokenColor(color) {
  return ALL_TOKEN_COLORS.includes(color);
}

// Checks token types against values, e.g. int,string against 4,hello
export function valueMatchesColor(color, rawValue) {
  const value = String(rawValue).trim();

  switch (color) {
    case TokenColor.INT:
      // Only digits, optional leading minus
      if (!/^-?\d+$/.test(value)) return false;

      const intVal = Number(value);
      return Number.isInteger(intVal) && Number.isFinite(intVal);

    case TokenColor.REAL:
      // Must contain decimal point, digits required on both sides
      if (!/^-?\d+\.\d+$/.test(value)) return false;

      const realVal = Number(value);
      return Number.isFinite(realVal);

    case TokenColor.BOOL:
      // true or false, case insensitive, NO quotes allowed
      if (/^true$/i.test(value)) return true;
      if (/^false$/i.test(value)) return true;
      return false;

    case TokenColor.STRING:
      // Must be quoted with double quotes ONLY
      // Example: "hello"
      if (!/^"([^"]*)"$/.test(value)) return false;
      return true;


    default:
      return false;
  }
}
