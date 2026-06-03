import * as getters from '../lib/helpers/getters.js';

describe('getters', () => {
    test('identifies places and transitions correctly', () => {
        expect(getters.isPetriPlace({ type: 'petri:place' })).toBe(true);
        expect(getters.isPetriPlace({ type: 'petri:transition' })).toBe(false);
        expect(getters.isPetriTransition({ type: 'petri:transition' })).toBe(true);
        expect(getters.isPetriTransition({ type: 'petri:place' })).toBe(false);
    });

    test('getPlaceForConnection returns the place side for a connection', () => {
        const place = { type: 'petri:place' };
        const transition = { type: 'petri:transition' };
        expect(getters.getPlaceForConnection({ source: place, target: transition })).toBe(place);
        expect(getters.getPlaceForConnection({ source: transition, target: place })).toBe(place);
    });

    test('getTransitionForConnection returns the transition side', () => {
        const place = { type: 'petri:place' };
        const transition = { type: 'petri:transition' };
        expect(getters.getTransitionForConnection({ source: place, target: transition })).toBe(transition);
        expect(getters.getTransitionForConnection({ source: transition, target: place })).toBe(transition);
    });

    test('getSiblingConnections returns unique incoming and outgoing connections', () => {
        const place = { type: 'petri:place' };
        const transition = { type: 'petri:transition' };

        const conn1 = { id: 1, source: place, target: transition };
        const conn2 = { id: 2, source: transition, target: place };

        transition.incoming = [conn1, conn1]; // duplicate on purpose
        transition.outgoing = [conn2];

        const siblings = getters.getSiblingConnections({
            source: place,
            target: transition
        });

        expect(siblings).toEqual([conn1, conn2]);
    });

    test('getPlaceMarking initializes marking if missing', () => {
        const place = { businessObject: {} };
        const marking = getters.getPlaceMarking(place);
        expect(marking).toEqual([]);
        expect(place.businessObject.marking).toEqual([]);
    });

    test('getPlaceMarking returns existing marking when it is already set', () => {
        const place = { businessObject: { marking: [1, 2] } };

        const marking = getters.getPlaceMarking(place);

        expect(marking).toEqual([1, 2]);
        expect(place.businessObject.marking).toEqual([1, 2]);
    });

    test('getPlaceType reads type from businessObject', () => {
        const place = { businessObject: { placeType: 'int*string' } };
        expect(getters.getPlaceType(place)).toEqual(['int', 'string']);
    });

    test('getConnectionContext includes place type and inscription spec', () => {
        const place = { type: 'petri:place', businessObject: { placeType: 'int' } };
        const transition = { type: 'petri:transition' };
        const connection = { source: place, target: transition, businessObject: { arcInscription: '<x>' } };
        const context = getters.getConnectionContext(connection);
        expect(context.placeType).toEqual(['int']);
        expect(context.arcInscription).toEqual({ text: '<x>', vars: ['x'], multiplicity: 1 });
    });
});