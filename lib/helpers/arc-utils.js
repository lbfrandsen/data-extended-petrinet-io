// arc-utils.js
import * as getters from './getters.js';
import { showAlert } from '../services/DialogService.js';
import * as placeTypeUtils from '../helpers/placeTypeUtils.js';

export const superscriptMap = { // map superscript digits to normal
    '⁰': '0',
    '¹': '1',
    '²': '2',
    '³': '3',
    '⁴': '4',
    '⁵': '5',
    '⁶': '6',
    '⁷': '7',
    '⁸': '8',
    '⁹': '9'
};

// raw arcIns string to multiplicity - both <x>² & <x>^2
function normalizeMultiplicitySuffix(input) {
    let text = String(input ?? '').trim();

    if (!text) {
        return { text: '', multiplicity: 1 };
    }

    let multiplicity = 1;

    const superscriptMatch = text.match(/^(.*?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
    if (superscriptMatch) {
        text = superscriptMatch[1].trim();
        multiplicity = Number(
            superscriptMatch[2]
                .split('')
                .map(ch => superscriptMap[ch])
                .join('')
        );
    }

    const exponentMatch = text.match(/^(.*?)\^(\d+)$/);
    if (exponentMatch) {
        text = exponentMatch[1].trim();
        multiplicity = Number(exponentMatch[2]);
    }

    return { // clean text + multiplicity 
        text,
        multiplicity: Math.max(1, multiplicity)
    };
}

// extracts vars from ins
function extractVars(text) {
    let inner = text;

    if (text.startsWith('<') && text.endsWith('>')) {
        inner = text.slice(1, -1).trim();
    }

    const vars = inner === ''
        ? []
        : inner.split(',').map(s => s.trim()).filter(Boolean);

    return vars;
}

// parse 
function parseArcInscriptionCore(input) {
    const rawText = String(input ?? '').trim();
    const safeText = rawText || '<x>';

    const { text, multiplicity } = normalizeMultiplicitySuffix(safeText);
    const vars = extractVars(text);

    return {
        text: `<${vars.join(',')}>`,
        vars,
        multiplicity
    };
}

// permissive version
export function parseArcInscriptionSpec(connection) {
    return parseArcInscriptionCore(connection?.businessObject?.arcInscription);
}

export function parseArcInscriptionText(text) {
    return parseArcInscriptionCore(text);
}

// normal parser from arcInscriptionProvider.js 
// checks correct syntax of inscriptions
export function parseInscriptionLine(line, connection) {
    const trimmed = String(line ?? '').trim();

    if (!trimmed) {
        showAlert({
            title: 'Invalid arc inscription',
            message: 'Invalid arc inscription: input cannot be empty.'
        });
        return null;
    }

    const place = getters.getPlaceForConnection(connection);
    const placeType = placeTypeUtils.parsePlaceTypeFromBusinessObject(place?.businessObject);

    const normalized = trimmed.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => superscriptMap[ch]);
    const match = normalized.match(/^<([^>]*)>(?:\^(\d+))?$/);

    if (!match) {
        showAlert({
            title: 'Invalid arc inscription',
            message: 'Invalid arc inscription format. Expected format: <x>, <x,y>, <> or with multiplicity like <x>^3.'
        });
        return null;
    }

    const parsed = parseArcInscriptionCore(trimmed);
    const { vars, multiplicity } = parsed;

    if (!Number.isInteger(multiplicity) || multiplicity < 1) {
        showAlert({
            title: 'Invalid arc inscription',
            message: 'Multiplicity must be a positive integer.'
        });
        return null;
    }

    for (const v of vars) {
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(v)) {
            showAlert({
                title: 'Invalid variable name',
                message: `Variable "${v}" is not a valid name. Variable names must start with a letter and contain only letters, digits, and underscores.`
            });
            return null;
        }
    }

    if (vars.length !== placeType.length) {
        showAlert({
            title: 'Arc inscription does not match place type',
            message: `This place type has length ${placeType.length}, so the arc inscription must also have ${placeType.length} variable(s).`
        });
        return null;
    }

    const text = multiplicity > 1
        ? `<${vars.join(',')}>^${multiplicity}`
        : `<${vars.join(',')}>`;

    return { text, vars, multiplicity };
}
