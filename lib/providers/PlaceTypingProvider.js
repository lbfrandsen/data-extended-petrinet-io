// lib/features/place-typing/PlaceTypingProvider.js

import { isTokenColor } from '../helpers/token-colors.js';
import { typeToKey } from '../helpers/token-types.js';

function parseTypeLine(line) {
    console.log("Line: " + line);

    const trimmed = line.trim();
    console.log("Trimmed: " + trimmed);

    // Allow: empty, ε, <>, <int>, <int,string>, <string,bool,bool>, ...
    if (trimmed === "" || trimmed === "ε") {
        return [];
    }

    if (!trimmed.startsWith("<") || !trimmed.endsWith(">")) {
        throw new Error('Invalid format: type line must be exactly one tuple type like <int> or <int,string>.');
    }

    // Must contain exactly one opening and one closing bracket
    const openCount = (trimmed.match(/</g) || []).length;
    const closeCount = (trimmed.match(/>/g) || []).length;

    if (openCount !== 1 || closeCount !== 1) {
        throw new Error('Invalid format: only one type is allowed.');
    }

    const inner = trimmed.slice(1, -1).trim();

    // <>
    if (inner === "") {
        return [];
    }

    const parts = inner.split(",").map(s => s.trim());

    // Reject malformed comma usage like <int,>, <,int>, <int,,string>
    if (parts.some(p => p === "")) {
        throw new Error('Invalid format: malformed comma placement inside tuple type.');
    }

    for (const p of parts) {
        if (!isTokenColor(p)) {
            throw new Error(`Invalid color "${p}". Allowed: int, string, bool, real`);
        }
    }

    console.log("Parsed type:");
    console.log(parts);

    return parts;
    

    // allow raw "int*string" too (optional)
    // if (trimmed.includes('*')) {
    //     const parts = trimmed.split('*').map(s => s.trim()).filter(Boolean);
    //     for (const p of parts) {
    //         if (!isTokenColor(p)) {
    //             throw new Error(`Invalid color "${p}". Allowed: int, string, bool, real`);
    //         }
    //     }
    //     return parts;
    // }

    // allow raw "int" too
    // if (isTokenColor(trimmed)) return [trimmed];

    throw new Error(`Could not parse type "${trimmed}". Use <int>, <int,int>, <> or ε.`);
}

function promptForPlaceTypes(place) {
    const msg =
        `Please select place type(s) for this place.\n\n` +
        `Enter one type per line. Examples:\n` +
        `<int>\n<string>\n<int,int>\n<>\n\n` +
        `Allowed colors: int, string, bool, real\n` +
        `Tip: <> means ε (untyped).\n`;

    const input = window.prompt(msg, '<>');

    if (input === null) {
        // user cancelled: keep untyped (empty set)
        return null;
    }

    const lines = input
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length === 0) {
        // allow empty => no types
        console.log("lines is empty");
        return [];
    }

    const typeKeys = [];
    for (const line of lines) {
        console.log("ParseTypeLine called now");
        const typeArr = parseTypeLine(line);
        if (typeArr === null) continue;
        typeKeys.push(typeToKey(typeArr));
    }

    // dedupe
    return [...new Set(typeKeys)];
}

export function promptAndSetPlaceTypes(place, eventBus) {
    console.log("\n \n \n Does promtAndSetPlace run??? \n \n \n \n");
    if (!place || place.type !== 'petri:place') return;

    if (!place.businessObject) place.businessObject = {};
    if (!Array.isArray(place.businessObject.types)) place.businessObject.types = [];
    if (!Array.isArray(place.businessObject.marking)) place.businessObject.marking = [];

    const selected = promptForPlaceTypes(place);
    if (selected === null) return;

    place.businessObject.types = selected;

    if (Array.isArray(place.businessObject.marking)) {
        place.businessObject.tokens = place.businessObject.marking.length;
    }

    eventBus.fire('element.changed', { element: place });
}