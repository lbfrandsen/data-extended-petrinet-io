// arc-utils.js
import * as getters from './getters.js';
import { showAlert } from '../services/DialogService.js';
import * as placeTypeUtils from '../helpers/placeTypeUtils.js';
export const superscriptMap = {
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

    let normalized = trimmed.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => superscriptMap[ch]);

    const match = normalized.match(/^<([^>]*)>(?:\^(\d+))?$/);

    if (!match) {
        showAlert({
            title: 'Invalid arc inscription',
            message: 'Invalid arc inscription format. Expected format: <x>, <x,y>, <> or with multiplicity like <x>^3.'
        });
        return null;
    }

    const inner = match[1].trim();
    const multiplicity = match[2] ? parseInt(match[2], 10) : 1;

    if (!Number.isInteger(multiplicity) || multiplicity < 1) {
        showAlert({
            title: 'Invalid arc inscription',
            message: 'Multiplicity must be a positive integer.'
        });
        return null;
    }

    const vars = inner === ''
        ? []
        : inner.split(',').map(s => s.trim()).filter(Boolean);

    for (const v of vars) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(v)) {
            showAlert({
                title: 'Invalid variable name',
                message: `Variable "${v}" is not a valid name. Variable names must start with a letter and contain only letters and digits.`
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