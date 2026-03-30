// Elias Storm Vedel Jørgensen - new provider for arc inscription editing
import * as getters from '../helpers/getters.js';
import * as placeTypeUtils from '../helpers/placeTypeUtils.js';

// eventbus listener 
const ARC_INSCRIPTION_SYNC_FLAG = '__arcInscriptionSyncRegistered';

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
    const siblings = getters.getSiblingConnections(connection);
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

// live track if place types change for update of arc inscriptions
// replace applyArcInscription with
function applyArcInscription(connection, eventBus) {
    const place = connection?.businessObject && getters.getPlaceForConnection(connection);
    if (!place || connection.businessObject.arcManual) return;

    const placeType = placeTypeUtils.parsePlaceTypeFromBusinessObject(place?.businessObject);
    const existingVars = Array.isArray(connection.businessObject.arcInscriptionVars)
        ? connection.businessObject.arcInscriptionVars
        : [];

    // Token-count updates also fire `element.changed` on places during simulation.
    // Only regenerate auto inscriptions when the connected place arity actually needs it
    // or when the inscription has not been initialized yet.
    if (
        existingVars.length === placeType.length &&
        typeof connection.businessObject.arcInscription === 'string' &&
        connection.businessObject.arcInscription.length > 0
    ) {
        return;
    }

    const vars = createDefaultArcVars(connection, placeType.length);

    connection.businessObject.arcInscription = `<${vars.join(',')}>`;
    connection.businessObject.arcInscriptionVars = vars;

    if (eventBus) {
        eventBus.fire('element.changed', { element: connection });
    }
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

        if (!getters.isPetriPlace(element)) { //check if place
            return;
        }

        const connections = getters.getArcsConnectedToPlace(element); // if place, get all connected arcs
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
