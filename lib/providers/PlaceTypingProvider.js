// lib/features/place-typing/PlaceTypingProvider.js

import { isTokenColor } from '../helpers/token-colors.js';
import { typeToKey } from '../helpers/token-types.js';

function parseTypeLine(line) {
    console.log("Line: ".concat(line))
    // Accept: <int>, <int,int>, <>, ε, empty
    const trimmed = line.trim();
    var count_open = 0;
    var count_closed = 0;
    var commas = 0;
    var current_type = "";
    var types = [];
    var comma_flag = false;
    console.log("Trimmed: ".concat(trimmed));
    // console.log("Trimmed length: ".concat(trimmed.length));
    for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '<') {
            comma_flag = false;
            count_open++;
            current_type += trimmed[i];
        } else if (trimmed[i] === '>')
            { 
                comma_flag = true;
                count_closed++;
                current_type += trimmed[i];
                types.push(current_type);
                current_type = "";
                types.forEach(t => {
                    console.log(t);
            });              
                // console.log("Current string".concat(current_type));
            }
        else if (trimmed[i] === ',') {
                if (comma_flag) {
                    commas++;
                }
                else {
                current_type += trimmed[i];
                }
            }
        else {
            current_type += trimmed[i];
        }
        // <int>, <int,string>
        // [<int>, <int, string> ]
    }

    console.log("\n Types");
    types.forEach(t => {
        console.log(t);
    });
    if ((count_open !== count_closed)) {//|| commas !== count_closed-1) {
        throw new Error('Invalid format: Mismatch in tuple brackets.');
    }
    if (commas !== count_closed-1) {
        throw new Error('Invalid format: Error in comma placement.')
    }

    else {
        var returnTypes = [];
        types.forEach(type => {
            const trimmed_type = type.trim();
            if (!trimmed_type) return null;
        
            if (trimmed_type === 'ε') returnTypes.push([]);
        
            // allow "<...>"
            if (trimmed_type.startsWith('<') && trimmed_type.endsWith('>')) {
                const inner = trimmed_type.slice(1, -1).trim();
                if (!inner) return []; // <>
                const parts = inner.split(',').map(s => s.trim()).filter(Boolean);
        
                for (const p of parts) {
                    if (!isTokenColor(p)) {
                        throw new Error(`Invalid color "${p}". Allowed: int, string, bool, real`);
                    }
                }
                returnTypes.push(parts);
            }
        });
        console.log("HERE IS RETURN TYPES".concat(returnTypes.length));
        returnTypes.forEach(a => {
            console.log(a);
        });
        return returnTypes;
    }
    

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