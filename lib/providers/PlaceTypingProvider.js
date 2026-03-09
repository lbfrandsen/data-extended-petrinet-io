// lib/features/place-typing/PlaceTypingProvider.js

import { isTokenColor } from '../helpers/token-colors.js';
import { typeToKey } from '../helpers/token-types.js';

function parseTypeLine(line) {
    // havde error pga dette TODO ved ikke
    if (line.startsWith('<') && line.endsWith('>')) {
        var trimmed = line.slice(1, -1).trim();
    }
    else {
        var trimmed = line.trim();
    }
    console.log("Line: " + line);
    if (line === "" || line === null) {
        return [];
    }

    trimmed = line.trim();
    console.log("Trimmed: " + trimmed);

    if (trimmed === "" || trimmed === "ε") {
        return [];
    }

    const parts = trimmed.split(",").map(s => s.trim());

    // Reject malformed comma usage like int, or ,int or int,,string
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
}

function promptForPlaceType(place) {
    const msg =
        `Please select one place type.\n\n` +
        `Examples:\n` +
        `int\n` +
        `string\n` +
        `int,string\n` +
        `ε\n\n` +
        `Allowed colors: int, string, bool, real\n`;

    const input = window.prompt(msg);
    if (input === null) {
        return null;
    }

    const trimmed = input.trim();

    const typeArr = parseTypeLine(trimmed);
    return [typeToKey(typeArr)];
}

export function promptAndSetPlaceTypes(place, eventBus) {
    console.log("\n \n \n Does promtAndSetPlace run??? \n \n \n \n");
    if (!place || place.type !== 'petri:place') return;

    if (!place.businessObject) place.businessObject = {};
    if (!Array.isArray(place.businessObject.types)) place.businessObject.types = [];
    if (!Array.isArray(place.businessObject.marking)) place.businessObject.marking = [];

    const selected = promptForPlaceType(place);
    if (selected === null) return;

    place.businessObject.types = selected;

    if (Array.isArray(place.businessObject.marking)) {
        place.businessObject.tokens = place.businessObject.marking.length;
    }

    eventBus.fire('element.changed', { element: place });
}