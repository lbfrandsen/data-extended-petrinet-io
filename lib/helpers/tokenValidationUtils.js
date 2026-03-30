import { typedValueMatchesColor, parseValueByColor } from './valueColorUtils.js';

export function validateValuesAgainstType(type, rawValues) {
    if (type.length !== rawValues.length) {
        return {
            ok: false,
            error: `Expected ${type.length} values, got ${rawValues.length}`
        };
    }

    for (let i = 0; i < type.length; i++) {
        const parsed = parseValueByColor(type[i], rawValues[i]);

        if (!typedValueMatchesColor(type[i], parsed)) {
            return {
                ok: false,
                error: `Invalid format at position ${i} for type ${type[i]}: ${rawValues[i]}`
            };
        }
    }

    return { ok: true };
}