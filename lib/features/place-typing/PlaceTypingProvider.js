// lib/features/place-typing/PlaceTypingProvider.js

import { isTokenColor } from '../../helpers/token-colors.js';
import { typeToKey } from '../../helpers/token-types.js';

function parseTypeLine(line) {
    // Accept: <int>, <int,int>, <>, ε, empty
    const trimmed = (line || '').trim();
    if (!trimmed) return null;

    if (trimmed === 'ε') return [];

    // allow "<...>"
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) return []; // <>
        const parts = inner.split(',').map(s => s.trim()).filter(Boolean);

        for (const p of parts) {
            if (!isTokenColor(p)) {
                throw new Error(`Invalid color "${p}". Allowed: int, string, bool, real`);
            }
        }
        return parts;
    }

    // allow raw "int*string" too (optional)
    if (trimmed.includes('*')) {
        const parts = trimmed.split('*').map(s => s.trim()).filter(Boolean);
        for (const p of parts) {
            if (!isTokenColor(p)) {
                throw new Error(`Invalid color "${p}". Allowed: int, string, bool, real`);
            }
        }
        return parts;
    }

    // allow raw "int" too
    if (isTokenColor(trimmed)) return [trimmed];

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
        return [];
    }

    const typeKeys = [];
    for (const line of lines) {
        const typeArr = parseTypeLine(line);
        if (typeArr === null) continue;
        typeKeys.push(typeToKey(typeArr));
    }

    // dedupe
    return [...new Set(typeKeys)];
}

export default class PlaceTypingProvider {
    static $inject = ['eventBus'];

    constructor(eventBus) {
        this.eventBus = eventBus;

        // Fires for user placement via palette/context-pad creation (not import)
        eventBus.on('create.end', 1000, (event) => {
            const shape = event?.context?.shape;

            if (!shape || shape.type !== 'petri:place') return;

            if (!shape.businessObject) shape.businessObject = {};

            // Ensure base fields exist
            if (!Array.isArray(shape.businessObject.types)) shape.businessObject.types = [];
            if (!Array.isArray(shape.businessObject.marking)) shape.businessObject.marking = [];

            // If already typed, do nothing
            if (shape.businessObject.types.length > 0) return;

            try {
                const selected = promptForPlaceTypes(shape);

                if (selected === null) {
                    // cancelled: keep empty untyped
                    return;
                }

                shape.businessObject.types = selected;

                // If they typed it but had existing marking somehow, keep it for now.
                // Count display compatibility:
                if (Array.isArray(shape.businessObject.marking)) {
                    shape.businessObject.tokens = shape.businessObject.marking.length;
                }

                this.eventBus.fire('element.changed', { element: shape });
            } catch (e) {
                alert(e?.message || String(e));
            }
        });
    }
}