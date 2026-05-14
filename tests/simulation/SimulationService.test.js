import SimulationService from '../../lib/features/simulation/simulation.js';

describe('SimulationService', () => {
    let eventBus;
    let service;
    const registry = { getAll: jest.fn(() => []) };

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
});
