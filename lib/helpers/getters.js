import * as placeTypeUtils from '../helpers/placeTypeUtils.js';

export function getConnectionSource(connection) {
    return connection.source;
}

export function getConnectionTarget(connection) {
    return connection.target;
}

export function isPetriPlace(element) {
    return element?.type === 'petri:place';
}

export function isPetriTransition(element) {
    return element?.type === 'petri:transition' || element?.type === 'petri:empty_transition';
}

export function getPlaceForConnection(connection) {
    const source = getConnectionSource(connection);
    const target = getConnectionTarget(connection);

    if (isPetriPlace(source)) return source;
    if (isPetriPlace(target)) return target;

    return null;
}

export function getTransitionForConnection(connection) {
    const source = getConnectionSource(connection);
    const target = getConnectionTarget(connection);

    if (isPetriTransition(source)) return source;
    if (isPetriTransition(target)) return target;

    return null;
}

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

export function getArcsConnectedToPlace(place) {
    return (place.incoming || []).concat(place.outgoing || []);
}

export function getPlaceMarking(place) {
    if (!Array.isArray(place.businessObject.marking)) {
        place.businessObject.marking = []; // 
    }

    return place.businessObject.marking;
}

export function getPlaceType(place) {
    return placeTypeUtils.parsePlaceTypeFromBusinessObject(place?.businessObject);
}