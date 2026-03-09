// Elias Storm Vedel Jørgensen - new provider for arc inscription editing
import { parseType } from '../helpers/token-types';

// translate user input into arc inscription text
// for when you edit existing inscriptions i.e. multiple <x,y>²
function parseInscriptionLine(line) {
    const trimmed = String(line ?? '').trim();

    // inscriptions formats:
    // - <x> for 1
    // - <x,y> for 2
    // - <x,y,z> for 3
    // - <x1,x2,...> for n
    if (!trimmed) {
        throw new Error('Inscription cannot be empty. Use x or <x> or <x,y>.');
    }

    let inner;

    // If user wrote <...>, extract inner; otherwise treat the whole input as inner.
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        inner = trimmed.slice(1, -1).trim();
    } else {
        inner = trimmed;
    }

    const vars = inner
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    // Basic variables TODO: for multiset arcs
    for (const v of vars) {
        if (!/^[A-Za-z]+$/.test(v)) {
            throw new Error(`Invalid variable name "${v}". Use only letters like x, or A.`);
        }
    }

    return { text: `<${vars.join(',')}>`, vars };
}

// prompt for pop-up on arc inscription editing
function promptForArcInscription(connection) {
    const current =
        String(connection.businessObject?.arcInscription ?? '').trim() || '<x>';

    const msg =
        `Set arc inscription\n\n` +
        `TODO FOR multiset arcs`

    const input = window.prompt(msg, current);
    if (input === null) return null;

    return parseInscriptionLine(input);
}

// eventbus listener 
const ARC_INSCRIPTION_SYNC_FLAG = '__arcInscriptionSyncRegistered';

// helpers:
function getConnectionSource(connection) {
    return connection?.source || connection?.businessObject?.source || null;
}

function getConnectionTarget(connection) {
    return connection?.target || connection?.businessObject?.target || null;
}

function isPetriPlace(element) {
    return element?.type === 'petri:place' || element?.$type === 'petri:Place';
}

function isPetriTransition(element) {
    return element?.type === 'petri:transition' || element?.$type === 'petri:Transition';
}

// is arc from or to a place
function getPlaceForConnection(connection) {
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

// reads place type and builds arc inscription 
function parsePlaceTypes(types) {
    if (!Array.isArray(types) || types.length === 0) {
        return [];
    }

    const firstType = types[0];

    if (Array.isArray(firstType)) {
        return firstType;
    }

    return parseType(firstType);
}

// default values for arc inscription variables
function createDefaultArcVars(arity) {
    if (arity === 0) return [];
    if (arity === 1) return ['x'];
    if (arity === 2) return ['x', 'y'];
    if (arity === 3) return ['x', 'y', 'z'];

    return Array.from({ length: arity }, (_, i) => `x${i + 1}`);
}

// build arc inscription text and vars
function buildArcInscriptionFromPlace(place) {
    const types = parsePlaceTypes(place?.businessObject?.types || []);
    const vars = createDefaultArcVars(types.length);

    return {
        text: `<${vars.join(',')}>`,
        vars
    };
}

// live track if place types change for update of arc inscriptions
function applyArcInscription(connection, eventBus) {
    if (!connection?.businessObject) {
        return;
    }

    const place = getPlaceForConnection(connection);
    if (!place) {
        return;
    }

    const next = buildArcInscriptionFromPlace(place);
    const currentText = String(connection.businessObject.arcInscription ?? '');
    const currentVars = Array.isArray(connection.businessObject.arcInscriptionVars)
        ? connection.businessObject.arcInscriptionVars
        : [];

    const changed =
        currentText !== next.text ||
        currentVars.length !== next.vars.length ||
        currentVars.some((v, i) => v !== next.vars[i]);

    if (!changed) {
        return;
    }

    connection.businessObject.arcInscription = next.text;
    connection.businessObject.arcInscriptionVars = next.vars;

    if (eventBus) {
        eventBus.fire('element.changed', { element: connection });
    }
}

// call all connections to a place to update if later changed 
function getConnectedConnections(place) {
    const incoming = Array.isArray(place?.incoming) ? place.incoming : [];
    const outgoing = Array.isArray(place?.outgoing) ? place.outgoing : [];
    const boIncoming = Array.isArray(place?.businessObject?.incoming) ? place.businessObject.incoming : [];
    const boOutgoing = Array.isArray(place?.businessObject?.outgoing) ? place.businessObject.outgoing : [];

    const seen = new Set();
    const connections = [];

    for (const connection of [...incoming, ...outgoing, ...boIncoming, ...boOutgoing]) {
        if (!connection || seen.has(connection)) continue;
        seen.add(connection);
        connections.push(connection);
    }

    return connections;
}

// sync arc inscriptions with place type changes
function registerPlaceTypeSync(eventBus) {
    if (!eventBus || eventBus[ARC_INSCRIPTION_SYNC_FLAG]) {
        return;
    }

    eventBus[ARC_INSCRIPTION_SYNC_FLAG] = true;

    //for "connect" button
    eventBus.on('commandStack.connection.create.postExecute', function (event) {
        const connection = event.context.connection;
        applyArcInscription(connection, eventBus);
    });

    eventBus.on('element.changed', function (event) {
        const element = event?.element;

        if (!isPetriPlace(element)) {
            return;
        }

        const connections = getConnectedConnections(element);
        for (const connection of connections) {
            applyArcInscription(connection, eventBus);
        }
    });
}

export function promptAndSetArcInscription(connection, eventBus) {
    registerPlaceTypeSync(eventBus);
    applyArcInscription(connection, eventBus);
}
