import * as placeTypeUtils from '../helpers/placeTypeUtils.js';
import * as arcUtils from './arc-utils.js';

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
    return element?.type === 'petri:transition';
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

    const transition = isPetriTransition(source)
        ? source
        : isPetriTransition(target)
            ? target
            : null;

    if (!transition) {
        return [];
    }

    const incoming = Array.isArray(transition.incoming) ? transition.incoming : [];
    const outgoing = Array.isArray(transition.outgoing) ? transition.outgoing : [];

    const seen = new Set();
    const all = [];

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
        place.businessObject.marking = [];
    }

    return place.businessObject.marking;
}

export function getPlaceType(place) {
    return placeTypeUtils.parsePlaceTypeFromBusinessObject(place?.businessObject);
}

export function getTransitions(elementRegistry) {
    return elementRegistry.getAll().filter(isPetriTransition);
}

export function getPlaces(elementRegistry) {
    return elementRegistry.getAll().filter(isPetriPlace);
}

export function getConnectionContext(connection) {
    const source = getConnectionSource(connection);
    const target = getConnectionTarget(connection);
    const place = getPlaceForConnection(connection);
    const transition = getTransitionForConnection(connection);

    return {
        connection,
        source,
        target,
        place,
        transition,
        placeType: place ? getPlaceType(place) : [],
        arcInscription: arcUtils.parseArcInscriptionSpec(connection)
    };
}

export function getTypedArcContext(connection, direction) {
    const ctx = getConnectionContext(connection);

    const isInput = direction === 'input';
    const place = isInput ? ctx.source : ctx.target;

    if (!isPetriPlace(place)) {
        return null;
    }

    const vars = Array.isArray(connection?.businessObject?.arcInscriptionVars)
        ? connection.businessObject.arcInscriptionVars
        : [];

    const placeType = getPlaceType(place);

    return {
        ...ctx,
        place,
        placeType,
        vars
    };
}