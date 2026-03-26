import { TokenColor } from './placeTypeUtils.js';

// Check raw value against type
// "4" + int -> true
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



// Validate raw inputs against type
// ["int"] + ["4"] -> { ok: true }
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
