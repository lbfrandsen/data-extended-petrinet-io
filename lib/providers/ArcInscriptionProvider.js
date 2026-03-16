// Elias Storm Vedel Jørgensen - new provider for arc inscription editing
import { off } from 'tiny-svg';
import { parsePlaceTypeFromBusinessObject } from '../helpers/token-types.js';
import { showAlert } from '../services/DialogService.js';

// translate user input into arc inscription text
// for when you edit existing inscriptions i.e. multiple <x,y>²
export function parseInscriptionLine(line) {
    const trimmed = String(line ?? '').trim(); // trim whitespace and handle null

    if (!trimmed) { // break if empty or only whitespace
        msg = "Invalid arc inscription: input cannot be empty.";
        showAlert({
            title: 'Invalid place type',
            message: msg
        });
    }

    const superscriptMap = {
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

    const normalized = trimmed.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, ch => superscriptMap[ch]);

    const match = normalized.match(/^<([^>]+)>(?:\^?(\d+))?$/);

    if (!match) {
        msg = "Invalid arc inscription format. Expected format: <var1,var2,...>^multiplicity. Example: <x,y>^2";
        showAlert({
            title: 'Invalid place type',
            message: msg
        });
    }

    let inner = match[1].trim();
    const multiplicity = match[2] ? parseInt(match[2], 10) : 1;

    // If user wrote <...>, extract inner; otherwise treat the whole input as inner.
    if (trimmed.startsWith('<') && trimmed.includes('>')) {
        const end = trimmed.indexOf('>');
        inner = trimmed.slice(1, end).trim();
    } else {
        inner = trimmed;
    }

    const vars = inner
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    // Basic variables TODO: for multiset arcs
    for (const v of vars) {
        if (!/^[A-Za-z][A-Za-z0-9]*$/.test(v)) {
            showAlert({
                title: 'Invalid variable name',
                message: `Variable "${v}" is not a valid name. Variable names must start with a letter and contain only letters and digits.`
            });
        }
    }

    const text = multiplicity > 1
        ? `<${vars.join(',')}>^${multiplicity}`
        : `<${vars.join(',')}>`;

    return { text, vars, multiplicity };
}

// eventbus listener 
const ARC_INSCRIPTION_SYNC_FLAG = '__arcInscriptionSyncRegistered';

// helpers:
function getConnectionSource(connection) {
    return connection?.source || connection?.businessObject?.source || connection?.businessObject?.sourceRef || null;
}

function getConnectionTarget(connection) {
    return connection?.target || connection?.businessObject?.target || connection?.businessObject?.targetRef || null;
}

function isPetriPlace(element) {
    return element?.type === 'petri:place';
}

function isPetriTransition(element) {
    return element?.type === 'petri:transition' || element?.type === 'petri:empty_transition';
}

// is arc from or to a place
export function getPlaceForConnection(connection) {
    const source = getConnectionSource(connection);
    const target = getConnectionTarget(connection);

    if (isPetriPlace(source) && isPetriTransition(target)) {
        return source;
    }

    if (isPetriTransition(source) && isPetriPlace(target)) {
        return target;
    }

    if (isPetriPlace(source)) {
        return source;
    }

    if (isPetriPlace(target)) {
        return target;
    }
    return null;
}

// reads place type and builds arc inscription //TODO fix firstype bs

// finds all connections that share source or target
export function getSiblingConnections(connection) {
    const source = getConnectionSource(connection);
    const target = getConnectionTarget(connection);

    const transition = isPetriTransition(source) ? source : isPetriTransition(target) ? target : null;

    if (!transition) {
        return [];
    }


    // get all connections
    const incoming = Array.isArray(transition.incoming) ? transition.incoming : [];
    const outgoing = Array.isArray(transition.outgoing) ? transition.outgoing : [];

    const seen = new Set();
    const all = [];
    // loop through all connections and add if not seen before
    for (const conn of [...incoming, ...outgoing]) {
        if (!conn || seen.has(conn)) continue;
        seen.add(conn);
        all.push(conn);
    }

    return all;
}

// // offset for variables names 
// function getConnectionVariableOffset(connection) {
//     const siblings = getSiblingConnections(connection);

//     // sord by ID to get variable order
//     const sorted = siblings.slice().sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));

//     let offset = 0;

//     for (const conn of sorted) {
//         if (conn === connection) break;
//         // count variables in siblings before the current connection to determine offset
//         const vars = conn.businessObject?.arcInscriptionVars || [];
//         offset += vars.length || 1;
//     }
//     return offset;
// }

// Gets variable names e.g. y or x3 for a connection
function variableNameAt(index) {
    const base = ['x', 'y', 'z'];

    if (index < base.length) {
        return base[index];
    }

    return `x${index - 2}`;
}

// creates array of size numVars with variable names based on offset using variableNameAt
function createDefaultArcVars(connection, numVars) {
    // const offset = getConnectionVariableOffset(connection);

    // return Array.from({ length: numVars }, (_, i) => variableNameAt(offset + i));

    const siblings = getSiblingConnections(connection);
    const used = new Set();

    for (const conn of siblings) {
        if (conn === connection) continue;

        const vars = conn.businessObject?.arcInscriptionVars || [];
        for (const v of vars) {
            used.add(v);
        }
    }

    const vars = [];
    let idx = 0;

    while (vars.length < numVars) {
        const name = variableNameAt(idx);

        if (!used.has(name)) {
            vars.push(name);
            used.add(name);
        }

        idx++;
    }

    return vars;
}

// build arc inscription text and vars
function buildArcInscriptionFromPlace(connection, place) {
    const placeType = parsePlaceTypeFromBusinessObject(place?.businessObject);
    const vars = createDefaultArcVars(connection, placeType.length); // create variable names based on number of types and offset

    return {
        text: `<${vars.join(',')}>`,
        vars
    };
}

// live track if place types change for update of arc inscriptions
function applyArcInscription(connection, eventBus) {
    if (!connection?.businessObject) { // check if connection exists
        return;
    }

    if (connection.businessObject.arcManual) {
        return;
    }
    const place = getPlaceForConnection(connection);
    if (!place) {
        return;
    }


    const next = buildArcInscriptionFromPlace(connection, place);


    // const currentText = String(connection.businessObject.arcInscription ?? ''); // get string of inscription or empty
    // const currentVars = Array.isArray(connection.businessObject.arcInscriptionVars)
    //     ? connection.businessObject.arcInscriptionVars
    //     : []; // get array of vars or var or emptyy

    // const changed = // check if inscription text or vars changed by comparing next with currentText/Vars
    //     currentText !== next.text || // text differs
    //     currentVars.length !== next.vars.length || // num of Vars differs
    //     currentVars.some((v, i) => v !== next.vars[i]); // any var differs

    // if (!changed) {
    //     return;
    // }

    connection.businessObject.arcInscription = next.text;
    connection.businessObject.arcInscriptionVars = next.vars;

    if (eventBus) { // fire element changed to update UI
        eventBus.fire('element.changed', { element: connection });
    }
}

// get arcs connected to place (dont confuse with getSiblingConnections)
export function getArcsConnectedToPlace(place) {
    const incoming = Array.isArray(place?.incoming) ? place.incoming : [];
    const outgoing = Array.isArray(place?.outgoing) ? place.outgoing : [];

    const seen = new Set();
    const connections = [];

    for (const connection of [...incoming, ...outgoing]) { // loop through all connections and add if not seen before
        if (!connection || seen.has(connection)) continue;
        seen.add(connection);
        connections.push(connection);
    }

    return connections; // return all unique connections to a place
}

// sync arc inscriptions with place type changes
export function registerArcInscriptionSync(eventBus) {
    if (!eventBus || eventBus[ARC_INSCRIPTION_SYNC_FLAG]) { // return if already registered or no eventBus
        return;
    }

    eventBus[ARC_INSCRIPTION_SYNC_FLAG] = true; // flag

    eventBus.on('commandStack.connection.create.postExecute', function (event) { // when connection created, initialize inscription
        const connection = event?.context?.connection;
        applyArcInscription(connection, eventBus);
    });

    eventBus.on('commandStack.connection.reconnectStart.postExecute', function (event) { // arc source changes ==> update
        const connection = event?.context?.connection;
        applyArcInscription(connection, eventBus);
    });

    eventBus.on('commandStack.connection.reconnectEnd.postExecute', function (event) { // arc target changes ==> update
        const connection = event?.context?.connection;
        applyArcInscription(connection, eventBus);
    });

    eventBus.on('element.changed', function (event) { // if element changed
        const element = event?.element;

        if (!isPetriPlace(element)) { //check if place
            return;
        }

        const connections = getArcsConnectedToPlace(element); // if place, get all connected arcs
        for (const connection of connections) { // and apply inscription update to all
            applyArcInscription(connection, eventBus);
        }
    });
}

// exportable function to implemet all arc stuff in contextpadprovider
export function initializeArcInscription(connection, eventBus) {
    registerArcInscriptionSync(eventBus);
    applyArcInscription(connection, eventBus);
}
