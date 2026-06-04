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
        expect(service.isActive).toBe(false);
        const result = service.toggleSimulation();
        expect(result).toBe(true);
        expect(service.ensureMasterInitialTokenState).toHaveBeenCalled();
        expect(service.saveInitialTokenState).toHaveBeenCalled();
        expect(service.eventBus.fire).toHaveBeenCalledWith('simulation.mode.changed', { active: true });
    });

    test('toggleSimulation deactivates simulation and archives session when already active', () => {
        service.isActive = true;
        service.archiveCurrentSession = jest.fn();
        const result = service.toggleSimulation();
        expect(result).toBe(false);
        expect(service.archiveCurrentSession).toHaveBeenCalledWith('toggleOff');
    });

    test('toggleSimulation initializes stepHistory and currentStepIndex when activated', () => {
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
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});

        expect(eventBus.on).toHaveBeenCalledWith(
            ['elements.changed', 'connection.added', 'connection.removed', 'shape.added', 'shape.removed'],
            expect.any(Function)
        );
        expect(eventBus.on).toHaveBeenCalledWith('element.click', expect.any(Function));
    });

    test('element.click handler fires transition when transition is enabled', () => {
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});
        const clickHandler = eventBus.on.mock.calls.find((call) => call[0] === 'element.click')[1];

        testService.isTransitionEnabled = jest.fn(() => true);
        testService.fireTransition = jest.fn();

        clickHandler({ element: { type: 'petri:transition' } });

        expect(testService.fireTransition).toHaveBeenCalled();
    });

    test('element.click handler does not fire transition when transition is disabled', () => {
        const eventBus = { on: jest.fn(), fire: jest.fn() };
        const testService = new SimulationService(eventBus, makeRegistry(), {}, {}, {}, {}, {});
        const clickHandler = eventBus.on.mock.calls.find((call) => call[0] === 'element.click')[1];

        testService.isTransitionEnabled = jest.fn(() => false);
        testService.fireTransition = jest.fn();

        clickHandler({ element: { type: 'petri:transition' } });

        expect(testService.fireTransition).not.toHaveBeenCalled();
    });

    test('archiveCurrentSession stores a session record and keeps it readable through the archive API', () => {
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
