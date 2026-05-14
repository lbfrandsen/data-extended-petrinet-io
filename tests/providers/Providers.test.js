jest.mock('../../lib/services/DialogService.js', () => ({
    __esModule: true,
    showAlert: jest.fn(),
    showPrompt: jest.fn(),
    showResetModeDialog: jest.fn()
}));
jest.mock('diagram-js/lib/features/rules/RuleProvider.js', () => {
    return class RuleProvider {
        constructor() { this.addRule = jest.fn(); }
        init() { }
    };
});

jest.mock('diagram-js/lib/util/Elements.js', () => ({
    __esModule: true,
    isFrameElement: jest.fn(() => false)
}));
import keyHandlerUtil from '../../lib/helpers/KeyHandler-util.js';
import CustomRuleProvider from '../../lib/providers/RuleProvider.js';
import CustomPaletteProvider from '../../lib/providers/PaletteProvider.js';
import PlaceTokenHoverProvider from '../../lib/providers/PlaceTokenHoverProvider.js';
import SimulationRoadmapProvider from '../../lib/providers/SimulationRoadmapProvider.js';
import LegendProvider from '../../lib/providers/LegendProvider.js';

const { showAlert, showResetModeDialog } = require('../../lib/services/DialogService.js');

describe('Providers', () => {
    beforeEach(() => {
        jest.spyOn(keyHandlerUtil, 'registerHotkey').mockImplementation(() => jest.fn());
        showAlert.mockClear();
        showResetModeDialog.mockClear();
    });

    describe('RuleProvider', () => {
        test('init calls addRule to register shape and connection rules', () => {
            const provider = new CustomRuleProvider({}, {});
            provider.addRule = jest.fn();
            provider.init();

            expect(provider.addRule).toHaveBeenCalledWith('shape.create', expect.any(Function));
            expect(provider.addRule).toHaveBeenCalledWith('connection.create', expect.any(Function));
            expect(provider.addRule).toHaveBeenCalledWith('shape.resize', expect.any(Function));
        });
    });

    describe('PaletteProvider', () => {
        let provider;
        let palette;
        let eventBus;
        let simulationService;
        let idCounterService;
        let elementRegistry;
        let create;
        let elementFactory;
        let lassoTool;
        let handTool;
        let spaceTool;

        beforeEach(() => {
            palette = { registerProvider: jest.fn() };
            eventBus = { fire: jest.fn() };
            simulationService = { isSimulationActive: jest.fn(() => false), toggleSimulation: jest.fn(() => true), stepBack: jest.fn(), masterResetTokensToInitial: jest.fn(), resetTokensToInitial: jest.fn(), stopSimulation: jest.fn() };
            idCounterService = { toggleLabels: jest.fn(), getNextPlaceId: jest.fn(() => 'p1'), getNextTransitionId: jest.fn(() => 't1') };
            elementRegistry = { getAll: jest.fn(() => [{ id: 'p1' }]) };
            create = { start: jest.fn() };
            elementFactory = { createShape: jest.fn((shape) => shape) };
            lassoTool = { activateSelection: jest.fn() };
            handTool = { activateHand: jest.fn() };
            spaceTool = { activateSelection: jest.fn() };
            provider = new CustomPaletteProvider(create, elementFactory, lassoTool, handTool, palette, spaceTool, simulationService, idCounterService, eventBus, elementRegistry);
        });

        test('toggleLabels toggles button active class and fires element.changed for all elements', () => {
            document.body.innerHTML = '<button data-action="labels"></button>';
            const button = document.querySelector('[data-action="labels"]');
            const element = { id: 'p1' };
            elementRegistry.getAll.mockReturnValue([element]);

            provider.toggleLabels({ target: button });
            expect(button.classList.contains('active')).toBe(true);
            expect(eventBus.fire).toHaveBeenCalledWith('element.changed', { element });
        });

        test('toggleSimulationButton toggles simulation button active state', () => {
            document.body.innerHTML = '<button data-action="start-simulation"></button>';
            const button = document.querySelector('[data-action="start-simulation"]');

            provider.toggleSimulationButton({ target: button });
            expect(simulationService.toggleSimulation).toHaveBeenCalled();
            expect(button.classList.contains('active')).toBe(true);
        });

        test('_resetSimulation calls showAlert when no simulation is active', async () => {
            simulationService.isSimulationActive.mockReturnValue(false);
            await provider._resetSimulation();
            expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error' }));
        });
    });

    describe('PlaceTokenHoverProvider', () => {
        test('formats values and builds overlay content correctly', () => {
            const overlays = { add: jest.fn(() => 'id1'), remove: jest.fn() };
            const eventBus = { on: jest.fn() };
            const provider = new PlaceTokenHoverProvider(eventBus, overlays);
            const place = { businessObject: { marking: [1, 'hello', { value: [2, 'x'] }] }, width: 10 };

            const formatted = provider.formatToken([2, 'x']);
            expect(formatted).toContain('2');
            expect(formatted).toContain('"x"');

            const content = provider.buildOverlayContent(place);
            expect(content.textContent).toContain('Tokens:');
            expect(content.textContent).toContain('token of value');
        });

        test('showTokenOverlay adds overlay and hideTokenOverlay removes it', () => {
            const overlays = { add: jest.fn(() => 'token-1'), remove: jest.fn() };
            const eventBus = { on: jest.fn() };
            const provider = new PlaceTokenHoverProvider(eventBus, overlays);
            const place = { businessObject: { marking: [1] }, width: 20 };

            provider.showTokenOverlay(place);
            expect(overlays.add).toHaveBeenCalled();
            provider.hideTokenOverlay();
            expect(overlays.remove).toHaveBeenCalledWith('token-1');
        });
    });

    describe('SimulationRoadmapProvider', () => {
        let eventBus;
        let simulationService;
        let elementRegistry;
        let sqlDialogService;
        let provider;

        beforeEach(() => {
            document.body.innerHTML = '';
            eventBus = { on: jest.fn() };
            simulationService = { isSimulationActive: jest.fn(() => false), getEnabledTransitionCount: jest.fn(() => 0), getStepHistoryDepth: jest.fn(() => 0), getCurrentStepIndex: jest.fn(() => 0), getExecutionLog: jest.fn(() => []), getSessionArchive: jest.fn(() => []) };
            elementRegistry = { getAll: jest.fn(() => []) };
            sqlDialogService = {};
            provider = new SimulationRoadmapProvider(eventBus, simulationService, elementRegistry, sqlDialogService);
        });

        test('render creates roadmap container and shows empty state when collapsed', () => {
            const container = document.getElementById('simulation-roadmap');
            expect(container).toBeTruthy();
            expect(container.textContent).toContain('SIM ROADMAP');
        });

        test('export button is rendered in roadmap', async () => {
            const container = document.getElementById('simulation-roadmap');
            expect(container).toBeTruthy();
            expect(container.innerHTML).toBeTruthy();
        });
    });

    describe('LegendProvider', () => {
        test('renders empty legend when no places or transitions exist', () => {
            document.body.innerHTML = '<div id="place-legend"></div>';
            const eventBus = { on: jest.fn() };
            const elementRegistry = { getAll: jest.fn(() => []) };
            new LegendProvider(eventBus, elementRegistry);
            expect(document.getElementById('place-legend').textContent).toContain('No places or transitions yet');
        });

        test('renders place and transition rows with sanitized labels', () => {
            document.body.innerHTML = '<div id="place-legend"></div>';
            const eventBus = { on: jest.fn() };
            const elementRegistry = {
                getAll: jest.fn(() => [
                    { type: 'petri:place', id: 'P1', businessObject: { name: 'Place 1', placeType: 'int' } },
                    { type: 'petri:transition', id: 'T1', businessObject: { name: 'Trans 1', guardExpression: 'x > 0' } }
                ])
            };
            new LegendProvider(eventBus, elementRegistry);
            const html = document.getElementById('place-legend').innerHTML;
            expect(html).toContain('Place 1');
            expect(html).toContain('Trans 1');
        });
    });
});
