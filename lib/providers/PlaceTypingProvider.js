// lib/features/place-typing/PlaceTypingProvider.js

import { isTokenColor } from '../helpers/token-colors.js';
import { getRawPlaceType, typeToKey } from '../helpers/token-types.js';
import { showAlert, showPrompt } from '../services/DialogService.js';

function parseTypeLine(line) {
    if (line.startsWith('<') && line.endsWith('>')) {
        var trimmed = line.slice(1, -1).trim();
    }
    else {
        var trimmed = line.trim();
    }
    console.log("Line: " + line);
    if (line === "" || line === null || line === undefined) {
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

async function promptForPlaceType(place) {
    const currentPlaceType = getRawPlaceType(place.businessObject);
    const current = (currentPlaceType === null || currentPlaceType === '')
        ? 'ε'
        : String(currentPlaceType).replace(/\*/g, ',');

    const msg =
        `Please select one place type.\n\n` +
        `Examples:\n` +
        `int\n` +
        `string\n` +
        `int,string\n` +
        `ε\n\n` +
        `Allowed colors: int, string, bool, real\n`;

    const input = await showPrompt({
        title: 'Set place type',
        message: msg,
        initialValue: current
    });
    if (input === null) {
        return null;
    }

    try {
        const trimmed = input.trim();
        const typeArr = parseTypeLine(trimmed);
        return typeToKey(typeArr);
    } catch (error) {
        await showAlert({
            title: 'Invalid place type',
            message: error.message
        });
        return null;
    }
}

export async function promptAndSetPlaceType(place, eventBus) {
    console.log("\n \n \n Does promtAndSetPlace run??? \n \n \n \n");
    if (!place || place.type !== 'petri:place') return;

    if (!place.businessObject) place.businessObject = {};
    place.businessObject.place_type = getRawPlaceType(place.businessObject);
    if (!Array.isArray(place.businessObject.marking)) place.businessObject.marking = [];

    const selected = await promptForPlaceType(place);
    if (selected === null) return;

    place.businessObject.place_type = selected;

    // if (Array.isArray(place.businessObject.marking)) {
    place.businessObject.tokens = place.businessObject.marking.length;
    // }

    eventBus.fire('element.changed', { element: place });
}

export const promptAndSetPlaceTypes = promptAndSetPlaceType;
