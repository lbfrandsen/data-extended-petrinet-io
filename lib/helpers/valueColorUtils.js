import { TokenColor } from './placeTypeUtils.js';

export function parseValueByColor(color, rawValue) {
    const text = String(rawValue ?? '').trim();

    switch (color) {
        case TokenColor.INT:
        case 'int':
            if (!/^[+-]?\d+$/.test(text)) {
                return undefined;
            }
            return Number(text);

        case TokenColor.REAL:
        case 'real':
            if (!/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)$/.test(text)) {
                return undefined;
            }
            return Number(text);

        case TokenColor.BOOL:
        case 'bool':
            if (/^true$/i.test(text)) {
                return true;
            }
            if (/^false$/i.test(text)) {
                return false;
            }
            return undefined;

        case TokenColor.STRING:
        case 'string':
            if (!/^"([^"\\]|\\.)*"$/.test(text)) {
                return undefined;
            }
            return text.slice(1, -1);

        default:
            return undefined;
    }
}

export function typedValueMatchesColor(color, value) {
    switch (color) {
        case TokenColor.INT:
        case 'int':
            return Number.isInteger(value);

        case TokenColor.REAL:
        case 'real':
            return typeof value === 'number' && Number.isFinite(value);

        case TokenColor.BOOL:
        case 'bool':
            return typeof value === 'boolean';

        case TokenColor.STRING:
        case 'string':
            return typeof value === 'string';

        default:
            return false;
    }
}

export function rawValueMatchesColor(color, rawValue) {
    return typedValueMatchesColor(color, parseValueByColor(color, rawValue));
}
