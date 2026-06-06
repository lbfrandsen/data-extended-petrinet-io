import SqlDialogService from '../lib/services/SqlDialogService.js';

const makeEventBus = () => {
    const handlers = new Map();

    return {
        on: jest.fn((eventName, handler) => {
            handlers.set(eventName, handler);
        }),
        fire: jest.fn(),
        emit(eventName, payload) {
            handlers.get(eventName)?.(payload);
        }
    };
};

const makeDatabaseService = () => ({
    getDbName: jest.fn(() => 'test.db')
});

describe('SqlDialogService transition binding lifecycle', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="sql-dialog"></div>';
        jest.clearAllMocks();
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('shape.removed detaches query and action bindings for a deleted transition', () => {
        // Transition bindings are keyed by transition ID, so deletion must remove them before that ID can reappear.
        const eventBus = makeEventBus();
        const service = new SqlDialogService(eventBus, makeDatabaseService());
        const transition = {
            id: 't1',
            type: 'petri:transition',
            businessObject: {}
        };

        expect(service.attachQueryToTransition(transition, 'Q1')).toBe(true);
        expect(service.attachActionToTransition(transition, 'A1')).toBe(true);
        expect(service.getQueryBindings()).toEqual([{ transitionId: 't1', queryId: 'Q1' }]);
        expect(service.getActionBindings()).toEqual([{ transitionId: 't1', actionId: 'A1' }]);

        eventBus.emit('shape.removed', { element: transition });

        expect(service.getQueryBindings()).toEqual([]);
        expect(service.getActionBindings()).toEqual([]);
        expect(transition.businessObject.queryGuardId).toBeUndefined();
        expect(transition.businessObject.actionId).toBeUndefined();
        expect(transition.businessObject.actionIds).toBeUndefined();
    });
});
