import SimulationUiBehavior from '../../lib/features/simulation/SimulationUiBehavior.js';

describe('SimulationUiBehavior', () => {
    let eventBus;
    let canvas;
    let simulationService;
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        canvas = {
            getContainer: jest.fn(() => container)
        };

        eventBus = {
            on: jest.fn()
        };

        simulationService = {
            isSimulationActive: jest.fn(() => false)
        };
    });

    test('attaches simulation-mode class when simulation becomes active', () => {
        SimulationUiBehavior(eventBus, canvas, simulationService);

        const changeHandler = eventBus.on.mock.calls.find((call) => call[0] === 'simulation.mode.changed')[1];
        expect(changeHandler).toBeDefined();

        changeHandler({ active: true });
        expect(container.classList.contains('simulation-mode')).toBe(true);
    });

    test('removes simulation-mode class when simulation becomes inactive', () => {
        container.classList.add('simulation-mode');
        SimulationUiBehavior(eventBus, canvas, simulationService);

        const changeHandler = eventBus.on.mock.calls.find((call) => call[0] === 'simulation.mode.changed')[1];
        expect(changeHandler).toBeDefined();

        changeHandler({ active: false });
        expect(container.classList.contains('simulation-mode')).toBe(false);
    });

    test('applies initial active state if simulationService isSimulationActive returns true', () => {
        simulationService.isSimulationActive = jest.fn(() => true);

        SimulationUiBehavior(eventBus, canvas, simulationService);

        expect(container.classList.contains('simulation-mode')).toBe(true);
    });
});
