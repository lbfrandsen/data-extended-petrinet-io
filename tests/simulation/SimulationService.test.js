import SimulationService from '../../lib/features/simulation/simulation.js';

describe('SimulationService', () => {
    let eventBus;
    let service;
    const registry = { getAll: jest.fn(() => []) };

    const makePlace = (marking = [1]) => ({
        id: 'p1',
        type: 'petri:place',
        businessObject: {
            marking: [...marking],
            tokens: marking.length
        }
    });

    beforeEach(() => {
        eventBus = { on: jest.fn(), fire: jest.fn() };
        service = new SimulationService(eventBus, registry, {}, {}, {}, {}, {});
        service.ensureMasterInitialTokenState = jest.fn();
        service.saveInitialTokenState = jest.fn();
        service.stepHistory = [];
        service.executionLog = [];
        service.updateEnabledTransitions = jest.fn();
    });

    test('toggleSimulation activates simulation, initializes state, and fires event', () => {
        // Starting simulation should initialize both the master token state and the current session state.
        // The mode-change event is what lets the UI update its simulation controls.
        expect(service.isActive).toBe(false);
        const result = service.toggleSimulation();
        expect(result).toBe(true);
        expect(service.ensureMasterInitialTokenState).toHaveBeenCalled();
        expect(service.saveInitialTokenState).toHaveBeenCalled();
        expect(service.eventBus.fire).toHaveBeenCalledWith('simulation.mode.changed', { active: true });
    });

    test('toggleSimulation deactivates simulation and archives session when already active', () => {
        // Turning simulation off is also the lifecycle boundary for preserving the run history.
        // This verifies that deactivation routes through the archive path instead of just flipping a flag.
        service.isActive = true;
        service.archiveCurrentSession = jest.fn();
        const result = service.toggleSimulation();
        expect(result).toBe(false);
        expect(service.archiveCurrentSession).toHaveBeenCalledWith('toggleOff');
    });

    test('toggleSimulation initializes stepHistory and currentStepIndex when activated', () => {
        // A new run starts with a snapshot at step 0 and no fired transitions yet.
        // This gives step-back and timeline controls a stable baseline immediately after activation.
        service.isActive = false;
        service.ensureMasterInitialTokenState = jest.fn();
        service.saveInitialTokenState = jest.fn();
        service.updateEnabledTransitions = jest.fn();

        const result = service.toggleSimulation();

        expect(result).toBe(true);
        expect(service.stepHistory).toHaveLength(1);
        expect(service.currentStepIndex).toBe(0);
        expect(service.executionLog).toEqual([]);
        expect(service.eventBus.fire).toHaveBeenCalledWith('simulation.mode.changed', { active: true });
    });

    const makeRegistry = () => ({ getAll: jest.fn(() => []) });

    test('constructor registers eventBus listeners for element click and state changes', () => {
        // SimulationService wires itself into diagram-js through eventBus listeners.
        // These registrations are the only way model edits and transition clicks reach the service.
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});

        expect(eventBus.on).toHaveBeenCalledWith(
            ['elements.changed', 'connection.added', 'connection.removed', 'shape.added', 'shape.removed'],
            expect.any(Function)
        );
        expect(eventBus.on).toHaveBeenCalledWith('element.click', expect.any(Function));
    });

    test('model change handler refreshes enabled transitions only while active', () => {
        // Enabled-state recomputation is only meaningful while simulation mode is active.
        // This protects normal editing from unnecessary simulation work, while still updating active runs.
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});
        const changedHandler = eventBus.on.mock.calls.find((call) => Array.isArray(call[0]) && call[0].includes('elements.changed'))[1];

        testService.updateEnabledTransitions = jest.fn();
        testService.isActive = false;
        changedHandler();
        expect(testService.updateEnabledTransitions).not.toHaveBeenCalled();

        testService.isActive = true;
        changedHandler();
        expect(testService.updateEnabledTransitions).toHaveBeenCalledTimes(1);
    });

    test('element.click handler fires transition when transition is enabled', () => {
        // In simulation mode, clicking an enabled transition is the main user path for firing it.
        // The handler should delegate to fireTransition only after the enabled check passes.
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});
        const clickHandler = eventBus.on.mock.calls.find((call) => call[0] === 'element.click')[1];

        testService.isTransitionEnabled = jest.fn(() => true);
        testService.fireTransition = jest.fn();

        clickHandler({ element: { type: 'petri:transition' } });

        expect(testService.fireTransition).toHaveBeenCalled();
    });

    test('element.click handler does not fire transition when transition is disabled', () => {
        // Disabled transitions can still be clicked in the diagram.
        // The click handler must not fire them unless the service currently considers them enabled.
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});
        const clickHandler = eventBus.on.mock.calls.find((call) => call[0] === 'element.click')[1];

        testService.isTransitionEnabled = jest.fn(() => false);
        testService.fireTransition = jest.fn();

        clickHandler({ element: { type: 'petri:transition' } });

        expect(testService.fireTransition).not.toHaveBeenCalled();
    });

    test('element.click handler ignores non-transition elements', () => {
        // Places and other diagram elements share the same click event channel.
        // The simulation click behavior should only apply to Petri net transitions.
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});
        const clickHandler = eventBus.on.mock.calls.find((call) => call[0] === 'element.click')[1];

        testService.isTransitionEnabled = jest.fn();
        testService.fireTransition = jest.fn();

        clickHandler({ element: { type: 'petri:place' } });

        expect(testService.isTransitionEnabled).not.toHaveBeenCalled();
        expect(testService.fireTransition).not.toHaveBeenCalled();
    });

    test('archiveCurrentSession stores a session record and keeps it readable through the archive API', () => {
        // Archiving captures the initial state, timeline, execution log, and ending reason for later inspection.
        // The copy returned by the archive API must be defensive so callers cannot mutate stored history.
        const place = makePlace([5]);
        const testService = new SimulationService(eventBus, { getAll: jest.fn(() => [place]) }, {}, {}, {}, {}, {});

        testService.initialTokenState.set('p1', [5]);
        testService.executionLog = ['step-1'];
        testService.stepHistory = [
            { markings: new Map([['p1', [5]]]), firedTransitions: ['t1'] },
            { markings: new Map([['p1', [8]]]), firedTransitions: [] }
        ];
        testService.currentStepIndex = 1;

        const archived = testService.archiveCurrentSession('test-run');

        expect(archived).toBe(true);
        expect(testService.sessionArchive).toHaveLength(1);
        expect(testService.sessionArchive[0].endedBy).toBe('test-run');
        expect(testService.getSessionArchive()).toHaveLength(1);

        const archiveCopy = testService.getSessionArchive()[0];
        archiveCopy.initialTokenState[0][1].push(99);

        expect(testService.sessionArchive[0].initialTokenState[0][1]).toEqual([5]);
    });

    test('createSimulationSnapshot and restoreSimulationSnapshot round-trip token markings', () => {
        // Snapshots are the mechanism behind undo/step navigation in simulation mode.
        // Restoring a snapshot should reset both place markings and the set of fired transitions.
        const place = makePlace([3]);
        const testService = new SimulationService(eventBus, { getAll: jest.fn(() => [place]) }, {}, {}, {}, {}, {});

        testService.firedTransitions = new Set(['t1']);
        const snapshot = testService.createSimulationSnapshot();

        place.businessObject.marking = [9];
        testService.firedTransitions = new Set();

        testService.restoreSimulationSnapshot(snapshot);

        expect(place.businessObject.marking).toEqual([3]);
        expect(Array.from(testService.firedTransitions)).toEqual(['t1']);
    });

    test('stepBack restores the previous snapshot and updates the current step index', () => {
        // Stepping back should move exactly one position in the timeline and restore that saved marking state.
        // The enabled transition cache must also be refreshed after the restored state is applied.
        const place = makePlace([2]);
        const testService = new SimulationService(eventBus, { getAll: jest.fn(() => [place]) }, {}, {}, {}, {}, {});
        const updateSpy = jest.spyOn(testService, 'updateEnabledTransitions').mockImplementation(() => { });

        testService.isActive = true;
        testService.currentStepIndex = 1;
        testService.stepHistory = [
            { markings: new Map([['p1', [2]]]), firedTransitions: [] },
            { markings: new Map([['p1', [4]]]), firedTransitions: ['t1'] }
        ];

        const result = testService.stepBack();

        expect(result).toBe(true);
        expect(testService.currentStepIndex).toBe(0);
        expect(place.businessObject.marking).toEqual([2]);
        expect(updateSpy).toHaveBeenCalled();
    });

    test('jumpToStep only accepts valid step positions and restores the requested snapshot', () => {
        // Timeline jumps should reject out-of-range indices without changing state.
        // A valid index should restore the matching snapshot and update the current pointer.
        const place = makePlace([1]);
        const testService = new SimulationService(eventBus, { getAll: jest.fn(() => [place]) }, {}, {}, {}, {}, {});
        jest.spyOn(testService, 'updateEnabledTransitions').mockImplementation(() => { });

        testService.isActive = true;
        testService.currentStepIndex = 2;
        testService.executionLog = ['a', 'b'];
        testService.stepHistory = [
            { markings: new Map([['p1', [1]]]), firedTransitions: [] },
            { markings: new Map([['p1', [2]]]), firedTransitions: ['t1'] },
            { markings: new Map([['p1', [3]]]), firedTransitions: ['t1', 't2'] }
        ];

        expect(testService.jumpToStep(-1)).toBe(false);
        expect(testService.jumpToStep(99)).toBe(false);
        expect(testService.jumpToStep(1)).toBe(true);
        expect(testService.currentStepIndex).toBe(1);
        expect(place.businessObject.marking).toEqual([2]);
    });
});
