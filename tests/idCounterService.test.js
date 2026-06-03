import IdCounterService from '../lib/services/IdCounterService.js';

describe('IdCounterService', () => {
    test('getNextPlaceId returns p1 for empty registry', () => {
        const registry = { getAll: () => [] };
        const service = new IdCounterService(registry);
        expect(service.getNextPlaceId()).toBe('p1');
    });

    test('getNextPlaceId fills gaps in existing IDs', () => {
        const registry = { getAll: () => [{ type: 'petri:place', id: 'p1' }, { type: 'petri:place', id: 'p3' }] };
        const service = new IdCounterService(registry);
        expect(service.getNextPlaceId()).toBe('p2');
    });

    test('getNextTransitionId returns t1 when no transitions exist', () => {
        const registry = { getAll: () => [] };
        const service = new IdCounterService(registry);
        expect(service.getNextTransitionId()).toBe('t1');
    });

    test('getNextTransitionId skips numbered labels properly', () => {
        const registry = { getAll: () => [{ type: 'petri:transition', id: 't1' }, { type: 'petri:transition', id: 't2' }] };
        const service = new IdCounterService(registry);
        expect(service.getNextTransitionId()).toBe('t3');
    });

    test('getNextTransitionLabel returns next unused letter', () => {
        const registry = { getAll: () => [{ type: 'petri:transition', businessObject: { name: 'A' } }, { type: 'petri:transition', businessObject: { name: 'B' } }] };
        const service = new IdCounterService(registry);
        expect(service.getNextTransitionLabel()).toBe('C');
    });

    test('getNextId returns IDs based on type', () => {
        const registry = { getAll: () => [] };
        const service = new IdCounterService(registry);
        expect(service.getNextId('petri:place')).toBe('p1');
        expect(service.getNextId('petri:transition')).toBe('t1');
    });
});