import * as getters from '../lib/helpers/getters.js';

describe('getters element type helpers', () => {
    test('identifies places and transitions safely', () => {
        // These predicates are used throughout editing/simulation and should be null-safe.
        expect(getters.isPetriPlace({ type: 'petri:place' })).toBe(true);
        expect(getters.isPetriPlace({ type: 'petri:transition' })).toBe(false);
        expect(getters.isPetriPlace(null)).toBe(false);
        expect(getters.isPetriTransition({ type: 'petri:transition' })).toBe(true);
        expect(getters.isPetriTransition({ type: 'petri:place' })).toBe(false);
        expect(getters.isPetriTransition(undefined)).toBe(false);
    });

    test('returns source and target directly from a connection', () => {
        // Source/target helpers intentionally do not reinterpret the connection shape.
        const source = { id: 'source' };
        const target = { id: 'target' };

        expect(getters.getConnectionSource({ source, target })).toBe(source);
        expect(getters.getConnectionTarget({ source, target })).toBe(target);
    });
});

describe('getters connection helpers', () => {
    test('getPlaceForConnection and getTransitionForConnection return the relevant side', () => {
        // Connections can be place->transition or transition->place; both orientations should work.
        const place = { type: 'petri:place' };
        const transition = { type: 'petri:transition' };

        expect(getters.getPlaceForConnection({ source: place, target: transition })).toBe(place);
        expect(getters.getPlaceForConnection({ source: transition, target: place })).toBe(place);
        expect(getters.getTransitionForConnection({ source: place, target: transition })).toBe(transition);
        expect(getters.getTransitionForConnection({ source: transition, target: place })).toBe(transition);
    });

    test('connection side helpers return null when the expected element type is absent', () => {
        // Invalid connections should not produce misleading place/transition context.
        const connection = {
            source: { type: 'petri:place' },
            target: { type: 'petri:place' }
        };

        expect(getters.getTransitionForConnection(connection)).toBeNull();
        expect(getters.getPlaceForConnection({ source: { type: 'petri:transition' }, target: { type: 'petri:transition' } })).toBeNull();
    });

    test('getSiblingConnections returns unique incoming and outgoing transition connections', () => {
        // Sibling lookup powers arc validation and should de-duplicate repeated references.
        const place = { type: 'petri:place' };
        const transition = { type: 'petri:transition' };
        const conn1 = { id: 1, source: place, target: transition };
        const conn2 = { id: 2, source: transition, target: place };

        transition.incoming = [conn1, conn1];
        transition.outgoing = [conn2];

        expect(getters.getSiblingConnections({ source: place, target: transition })).toEqual([conn1, conn2]);
    });

    test('getSiblingConnections returns an empty list without a transition', () => {
        // If neither side is a transition, there is no transition neighborhood to inspect.
        expect(getters.getSiblingConnections({
            source: { type: 'petri:place' },
            target: { type: 'petri:place' }
        })).toEqual([]);
    });

    test('getArcsConnectedToPlace combines incoming and outgoing arrays safely', () => {
        // Place type changes need to update all connected arcs regardless of direction.
        const incoming = [{ id: 'in' }];
        const outgoing = [{ id: 'out' }];

        expect(getters.getArcsConnectedToPlace({ incoming, outgoing })).toEqual([...incoming, ...outgoing]);
        expect(getters.getArcsConnectedToPlace({})).toEqual([]);
    });
});

describe('getters place and registry helpers', () => {
    test('getPlaceMarking initializes marking if missing and returns existing markings', () => {
        // Marking arrays are the mutable source of token state, so missing arrays are initialized once.
        const missing = { businessObject: {} };
        const existing = { businessObject: { marking: [1, 2] } };

        expect(getters.getPlaceMarking(missing)).toEqual([]);
        expect(missing.businessObject.marking).toEqual([]);
        expect(getters.getPlaceMarking(existing)).toEqual([1, 2]);
    });

    test('getPlaceType reads type metadata from the business object', () => {
        // The getter delegates current and legacy place type metadata parsing.
        expect(getters.getPlaceType({ businessObject: { placeType: 'int*string' } })).toEqual(['int', 'string']);
        expect(getters.getPlaceType({ businessObject: { place_type: 'bool' } })).toEqual(['bool']);
    });

    test('getTransitions and getPlaces filter an element registry', () => {
        // Registry helpers provide the simulation with only the relevant Petri net element classes.
        const place = { type: 'petri:place' };
        const transition = { type: 'petri:transition' };
        const registry = { getAll: () => [place, transition, { type: 'other' }] };

        expect(getters.getPlaces(registry)).toEqual([place]);
        expect(getters.getTransitions(registry)).toEqual([transition]);
    });
});

describe('getters context helpers', () => {
    test('getConnectionContext includes source, target, place type, transition, and inscription spec', () => {
        // Connection context is the common bundle used by typing, guard, and simulation logic.
        const place = { type: 'petri:place', businessObject: { placeType: 'int' } };
        const transition = { type: 'petri:transition' };
        const connection = { source: place, target: transition, businessObject: { arcInscription: '<x>' } };

        expect(getters.getConnectionContext(connection)).toEqual(expect.objectContaining({
            connection,
            source: place,
            target: transition,
            place,
            transition,
            placeType: ['int'],
            arcInscription: { text: '<x>', vars: ['x'], multiplicity: 1 }
        }));
    });

    test('getTypedArcContext returns input and output context only when the requested side is a place', () => {
        // Directional arc context should only be present when the expected side is actually a place.
        const inputPlace = { type: 'petri:place', businessObject: { placeType: 'int' } };
        const outputPlace = { type: 'petri:place', businessObject: { placeType: 'string' } };
        const transition = { type: 'petri:transition' };
        const inputConnection = {
            source: inputPlace,
            target: transition,
            businessObject: { arcInscription: '<x>', arcInscriptionVars: ['x'] }
        };
        const outputConnection = {
            source: transition,
            target: outputPlace,
            businessObject: { arcInscription: '<name>', arcInscriptionVars: ['name'] }
        };

        expect(getters.getTypedArcContext(inputConnection, 'input')).toEqual(expect.objectContaining({
            place: inputPlace,
            placeType: ['int'],
            vars: ['x']
        }));
        expect(getters.getTypedArcContext(outputConnection, 'output')).toEqual(expect.objectContaining({
            place: outputPlace,
            placeType: ['string'],
            vars: ['name']
        }));
        expect(getters.getTypedArcContext(inputConnection, 'output')).toBeNull();
    });
});
