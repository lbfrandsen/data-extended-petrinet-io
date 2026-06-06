import IdCounterService from '../lib/services/IdCounterService.js';

const serviceFor = (elements) => new IdCounterService({ getAll: () => elements });

describe('IdCounterService numeric IDs', () => {
    test('place and transition IDs start at p1 and t1 for an empty registry', () => {
        // Fresh diagrams should start with the first human-readable place/transition IDs.
        const service = serviceFor([]);

        expect(service.getNextPlaceId()).toBe('p1');
        expect(service.getNextTransitionId()).toBe('t1');
    });

    test('place IDs fill gaps while transition IDs continue after the highest seen ID', () => {
        // Transition IDs are not reused because simulation and SQL runtime state is keyed by transition ID.
        const service = serviceFor([
            { type: 'petri:place', id: 'p1' },
            { type: 'petri:place', id: 'p3' },
            { type: 'petri:transition', id: 't1' },
            { type: 'petri:transition', id: 't3' }
        ]);

        expect(service.getNextPlaceId()).toBe('p2');
        expect(service.getNextTransitionId()).toBe('t4');
    });

    test('transition IDs are not reused after a transition was observed and then deleted', () => {
        // This prevents fired-state and SQL bindings for a deleted transition ID from affecting a new transition.
        let elements = [{ type: 'petri:transition', id: 't1' }];
        const service = new IdCounterService({ getAll: () => elements });

        elements = [];

        expect(service.getNextTransitionId()).toBe('t2');
    });

    test('non-matching element types are ignored', () => {
        // Only elements of the matching Petri type should reserve an ID in that namespace.
        const service = serviceFor([
            { type: 'petri:transition', id: 'p1' },
            { type: 'petri:place', id: 't1' },
            { type: 'other', id: 'p2' }
        ]);

        expect(service.getNextPlaceId()).toBe('p1');
        expect(service.getNextTransitionId()).toBe('t1');
    });

    test('malformed transition IDs are ignored unless they start with t', () => {
        // Transition ID parsing is prefix-based, so unrelated IDs should not reserve t numbers.
        const service = serviceFor([
            { type: 'petri:transition', id: 'transition1' },
            { type: 'petri:transition', id: 'x2' },
            { type: 'petri:transition', id: 't3' }
        ]);

        expect(service.getNextTransitionId()).toBe('t4');
    });

    test('malformed place IDs are ignored unless they start with p', () => {
        // Place IDs should follow the same prefix discipline as transition IDs.
        // A place with id x1 must not reserve p1.
        const service = serviceFor([
            { type: 'petri:place', id: 'x1' },
            { type: 'petri:place', id: 'p2' }
        ]);

        expect(service.getNextPlaceId()).toBe('p1');
    });
});

describe('IdCounterService labels and dispatch', () => {
    test('getNextTransitionLabel returns the first unused uppercase letter', () => {
        // Transition labels use simple alphabetical names independent of transition IDs.
        const service = serviceFor([
            { type: 'petri:transition', businessObject: { name: 'A' } },
            { type: 'petri:transition', businessObject: { name: 'B' } }
        ]);

        expect(service.getNextTransitionLabel()).toBe('C');
    });

    test('getNextTransitionLabel ignores null labels but currently treats undefined as used data', () => {
        // Null labels are filtered before label allocation, and undefined does not block the first letter.
        const service = serviceFor([
            { type: 'petri:transition', businessObject: { name: null } },
            { type: 'petri:transition', businessObject: {} }
        ]);

        expect(service.getNextTransitionLabel()).toBe('A');
    });

    test('getNextId delegates by element type and returns undefined for unsupported input', () => {
        // Context pad callers use getNextId as the public type-dispatching entry point.
        const service = serviceFor([]);

        expect(service.getNextId('petri:place')).toBe('p1');
        expect(service.getNextId('petri:transition')).toBe('t1');
        expect(service.getNextId('petri:connection')).toBeUndefined();
        expect(service.getNextId()).toBeUndefined();
    });

    test('getNextConnectionId returns a prefixed unique-looking ID', () => {
        // Connection IDs are UUID/random based; the stable contract is the Connection_ prefix.
        const service = serviceFor([]);

        expect(service.getNextConnectionId()).toMatch(/^Connection_/);
    });

    test('toggleLabels flips label visibility', () => {
        // Label visibility is internal UI state and should toggle predictably.
        const service = serviceFor([]);

        expect(service.labelsVisible).toBe(false);
        service.toggleLabels();
        expect(service.labelsVisible).toBe(true);
        service.toggleLabels();
        expect(service.labelsVisible).toBe(false);
    });
});
