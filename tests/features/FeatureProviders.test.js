jest.mock('../../lib/services/DialogService.js', () => ({
    __esModule: true,
    showAlert: jest.fn(),
    showPrompt: jest.fn()
}));

import EditingProvider from '../../lib/features/editing/EditingProvider.js';
import KeyboardShortcuts from '../../lib/features/keyboard/PetriNetKeyboardBindings.js';
import MenuProvider from '../../lib/features/popup/MenuProvider.js';
import SimulationUiBehavior from '../../lib/features/simulation/SimulationUiBehavior.js';
import { registerArcInscriptionSync, initializeArcInscription } from '../../lib/providers/ArcInscriptionProvider.js';
import * as getters from '../../lib/helpers/getters.js';

const { showAlert, showPrompt } = require('../../lib/services/DialogService.js');

describe('Features and arc providers', () => {
    beforeEach(() => {
        showAlert.mockClear();
        showPrompt.mockClear();
    });

    describe('EditingProvider', () => {
        let provider;
        let eventBus;
        let directEditing;
        let canvas;
        let simulationService;

        beforeEach(() => {
            eventBus = { on: jest.fn(), fire: jest.fn() };
            directEditing = { registerProvider: jest.fn(), isActive: jest.fn(() => false), activate: jest.fn(), complete: jest.fn() };
            canvas = { viewbox: jest.fn(() => ({ x: 0, y: 0, scale: 1 })) };
            simulationService = { isActive: false, updateEnabledTransitions: jest.fn() };
            provider = new EditingProvider(eventBus, directEditing, canvas, simulationService);
        });

        test('activate returns bounds and text for connection elements', () => {
            const element = { type: 'petri:connection', waypoints: [{ x: 1, y: 2 }, { x: 5, y: 6 }], businessObject: { arcInscription: 'x' } };
            const info = provider.activate(element);
            expect(info.bounds.width).toBe(80);
            expect(info.text).toBe('x');
        });

        test('update on transition stores businessObject name and fires event', () => {
            const element = { type: 'petri:transition', businessObject: {} };
            provider.update(element, 'MyTransition', '', null);
            expect(element.businessObject.name).toBe('MyTransition');
            expect(eventBus.fire).toHaveBeenCalledWith({ element });
        });

        test('update on connection parses inscription and fires event', () => {
            const place = { businessObject: { placeType: 'int' } };
            jest.spyOn(getters, 'getSiblingConnections').mockReturnValue([]);
            jest.spyOn(getters, 'getPlaceForConnection').mockReturnValue(place);
            const element = { type: 'petri:connection', businessObject: {}, waypoints: [] };
            provider.update(element, '<x>', '', null);
            expect(element.businessObject.arcManual).toBe(true);
            expect(element.businessObject.arcInscription).toBe('<x>');
            expect(element.businessObject.arcInscriptionVars).toEqual(['x']);
            expect(eventBus.fire).toHaveBeenCalled();
        });

        test('addTokenPopup for epsilon place adds empty marking without prompt', async () => {
            const place = { type: 'petri:place', businessObject: { placeType: '' } };
            await provider.addTokenPopup(place);
            expect(place.businessObject.marking).toEqual([[]]);
            expect(place.businessObject.tokens).toBe(1);
            expect(eventBus.fire).toHaveBeenCalledWith({ element: place });
        });
    });

    describe('KeyboardShortcuts', () => {
        let service;
        let canvas;
        let selection;
        let modeling;
        let elementFactory;
        let idCounterService;
        let commandStack;
        let simulationService;

        beforeEach(() => {
            canvas = { getContainer: jest.fn(() => document.createElement('div')), getRootElement: jest.fn(() => ({})), getChildren: jest.fn(() => []), viewbox: jest.fn(() => ({ x: 0, y: 0, width: 200, height: 100 })) };
            selection = { get: jest.fn(() => []), select: jest.fn() };
            modeling = { removeElements: jest.fn(), createShape: jest.fn((shape) => shape) };
            elementFactory = { createShape: jest.fn((shape) => shape) };
            idCounterService = { getNextPlaceId: jest.fn(() => 'p1'), getNextTransitionId: jest.fn(() => 't1') };
            commandStack = { canUndo: jest.fn(() => true), undo: jest.fn(), canRedo: jest.fn(() => true), redo: jest.fn() };
            simulationService = { isSimulationActive: jest.fn(() => false), stepBack: jest.fn() };
            service = new KeyboardShortcuts({}, modeling, selection, elementFactory, canvas, idCounterService, commandStack, simulationService);
        });

        test('undo calls commandStack.undo when simulation is inactive', () => {
            service._handleUndo();
            expect(commandStack.undo).toHaveBeenCalled();
        });

        test('redo calls commandStack.redo when redo history exists', () => {
            service._handleRedo();
            expect(commandStack.redo).toHaveBeenCalled();
        });

        test('delete removes selected elements via modeling', () => {
            const element = { id: 'item1' };
            selection.get.mockReturnValue([element]);
            service._handleDelete();
            expect(modeling.removeElements).toHaveBeenCalledWith([element]);
        });

        test('copy and paste duplicate allowed element geometry and select pasted shapes', () => {
            const element = { type: 'petri:place', x: 10, y: 20, width: 10, height: 10, businessObject: { foo: 'bar' } };
            selection.get.mockReturnValue([element]);
            service._handleCopy();
            expect(service._clipboard.length).toBe(1);
            selection.get.mockReturnValue([]);
            service._handlePaste();
            expect(elementFactory.createShape).toHaveBeenCalled();
            expect(selection.select).toHaveBeenCalled();
        });
    });

    describe('MenuProvider', () => {
        let provider;
        let eventBus;
        let popupMenu;
        let simulationService;

        beforeEach(() => {
            eventBus = { fire: jest.fn() };
            popupMenu = { registerProvider: jest.fn() };
            simulationService = {};
            provider = new MenuProvider(eventBus, popupMenu, simulationService);
        });

        test('getPopupMenuEntries returns label and properties entries for places', () => {
            const element = { type: 'petri:place' };
            const entries = provider.getPopupMenuEntries(element);
            expect(entries.label).toBeDefined();
            expect(entries.properties).toBeDefined();
        });

        test('showProperties calls showAlert with formatted info', () => {
            const element = { type: 'petri:connection', id: 'C1', x: 1, y: 2, width: 10, height: 10, businessObject: { arcInscription: '<x>' } };
            provider.showProperties(element);
            expect(showAlert).toHaveBeenCalledWith(expect.objectContaining({ title: 'Properties for petri:connection ' }));
        });

        test('setLabel prompts and updates the element name', async () => {
            showPrompt.mockResolvedValue('Updated');
            const element = { id: 'P1', businessObject: {} };
            await provider.setLabel(element);
            expect(element.businessObject.name).toBe('Updated');
            expect(eventBus.fire).toHaveBeenCalledWith({ element });
        });
    });

    describe('SimulationUiBehavior', () => {
        test('adds and removes simulation-mode CSS class based on eventBus', () => {
            const container = document.createElement('div');
            const canvas = { getContainer: jest.fn(() => container) };
            const eventBus = { on: jest.fn((event, fn) => { if (event === 'simulation.mode.changed') { eventBus._callback = fn; } }) };
            const simulationService = { isSimulationActive: jest.fn(() => false) };

            SimulationUiBehavior(eventBus, canvas, simulationService);
            expect(container.classList.contains('simulation-mode')).toBe(false);
            eventBus._callback({ active: true });
            expect(container.classList.contains('simulation-mode')).toBe(true);
            eventBus._callback({ active: false });
            expect(container.classList.contains('simulation-mode')).toBe(false);
        });
    });

    describe('ArcInscriptionProvider', () => {
        let eventBus;

        beforeEach(() => {
            eventBus = { on: jest.fn(), fire: jest.fn() };
            jest.spyOn(getters, 'getSiblingConnections').mockReturnValue([]);
            jest.spyOn(getters, 'getPlaceForConnection').mockReturnValue({ businessObject: { placeType: 'int' } });
        });

        test('initializeArcInscription registers sync and applies inscription', () => {
            const connection = { businessObject: {} };
            initializeArcInscription(connection, eventBus);
            expect(connection.businessObject.arcInscription).toBe('<x>');
            expect(eventBus.fire).toHaveBeenCalledWith({ element: connection });
        });

        test('registerArcInscriptionSync binds events for connection changes', () => {
            const initialCallCount = eventBus.on.mock.calls.length;
            registerArcInscriptionSync(eventBus);
            expect(eventBus.on.mock.calls.length).toBeGreaterThan(initialCallCount);
        });
    });
});
