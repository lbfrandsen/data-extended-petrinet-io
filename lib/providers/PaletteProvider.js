import { showAlert, showPrompt } from '../services/DialogService.js';
import keyHandlerUtil from '../helpers/KeyHandler-util.js';

export default class CustomPaletteProvider {

  static $inject = [
    "create",
    "elementFactory",
    "lassoTool",
    "handTool",
    "palette",
    "spaceTool",
    "simulationService",
    "idCounterService",
    "eventBus",
    "elementRegistry"
  ];

  constructor(create, elementFactory, lassoTool, handTool, palette, spaceTool, simulationService, idCounterService, eventBus, elementRegistry) {
    this.create = create;
    this.elementFactory = elementFactory;
    this.lassoTool = lassoTool;
    this.handTool = handTool;
    this.palette = palette;
    this.spaceTool = spaceTool;
    this.simulationService = simulationService;
    this.idCounterService = idCounterService;
    this.eventBus = eventBus;
    this.elementRegistry = elementRegistry;

    palette.registerProvider(this);

    this._destroyHotkeys = this._registerHotkeys();
  }

  title_error = "Error";

  _registerHotkeys() {
    const when = event => !keyHandlerUtil.isTextInputEvent(event);
    const unregisterHotkeys = [];

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 's',
        when,
        preventDefault: false,
        callback: () => this.toggleSimulationButton()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'b',
        when,
        preventDefault: false,
        callback: () => this._stepBackSimulation()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'r',
        when,
        preventDefault: false,
        callback: () => this._resetSimulation()
      })
    );

    return () => unregisterHotkeys.forEach(unregister => unregister());
  }

  _stepBackSimulation() {
    if (!this.simulationService.isSimulationActive()) {
      showAlert({ title: this.title_error, message: 'Step-back failed: no simulation is active.' });
      return;
    }

    const didStepBack = this.simulationService.stepBack();
    if (!didStepBack) {
      showAlert({ title: this.title_error, message: 'Step-back failed: no previous simulation step found.' });
    }
  }

  _resetSimulation() {
    if (!this.simulationService.isSimulationActive()) {
      showAlert({ title: this.title_error, message: 'Reset failed: no simulation is active.' });
      return;
    }

    this.simulationService.resetTokensToInitial();
    this.simulationService.stopSimulation();
    this.deactivateSimulationButton();
  }
  
  // Called if the provider is ever torn down
  destroy() {
    this._destroyHotkeys?.();
  }

  toggleLabels(event) {
    this.idCounterService.toggleLabels();

    // Make button active when labels hidden
    const button = event.target.closest('[data-action="labels"]');
    if (button) {
      button.classList.toggle('active');
    }

    // Re-render all elements
    this.elementRegistry.getAll().forEach(el => {
      this.eventBus.fire('element.changed', { element: el });
    });
  }

  toggleSimulationButton(event) {
    const button = event?.target?.closest?.('[data-action="start-simulation"]')
      || document.querySelector('[data-action="start-simulation"]');

    const isActive = this.simulationService.toggleSimulation();

    if (button) {
      if (isActive) {
        button.classList.add('active');
      } else {
        button.classList.remove('active');
      }
    }
  }

  deactivateSimulationButton() {
    const simulationButton = document.querySelector('[data-action="start-simulation"]');
    if (simulationButton) {
      simulationButton.classList.remove('active');
    }
  }

  getPaletteEntries() {

    const { create, elementFactory, lassoTool, handTool, spaceTool } = this;

    return {
      'hand-tool': {
        group: 'tools',
        className: 'bpmn-icon-hand-tool',
        title: 'Activate the hand tool',
        action: {
          click: function (event) {
            handTool.activateHand(event);
          }
        }
      },
      "lasso-tool": {
        group: "tools",
        className: "bpmn-icon-lasso-tool",
        title: "Activate Lasso Tool",
        action: {
          click: (event) => lassoTool.activateSelection(event)
        }
      },
      'space-tool': {
        group: 'tools',
        className: 'bpmn-icon-space-tool',
        title: 'Activate the create/remove space tool',
        action: {
          click: function (event) {
            spaceTool.activateSelection(event);
          }
        }
      },
      "tool-separator": {
        group: "tools",
        separator: true
      },

      "create-circle": {
        group: "create",
        className: "bpmn-icon-start-event-none",
        title: "Add a new place",
        action: {
          click: (event) => {
            const circleShape = elementFactory.createShape({
              id: this.idCounterService.getNextPlaceId(),
              width: 30,
              height: 30,
              type: "petri:place",
              businessObject: {
                tokens: 0,
                place_type: null,
                marking: []       // colored marking storage
              }
            });
            create.start(event, circleShape);
          }
        }
      },
      "create-transition": {
        group: "create",
        className: "bpmn-icon-task",
        title: "Add a new transition",
        action: {
          click: (event) => {
            const shape = elementFactory.createShape({
              id: this.idCounterService.getNextTransitionId(),
              width: 40,
              height: 40,
              type: "petri:transition"
            });

            create.start(event, shape);
          }
        }
      },

      "create-empty-transition": {
        group: "create",
        className: "palette-icon-create-empty-transition",
        title: "Add a new silent transition",
        action: {
          click: (event) => {
            const shape = elementFactory.createShape({
              id: this.idCounterService.getNextTransitionId(),
              width: 10,
              height: 50,
              type: "petri:empty_transition"
            });

            create.start(event, shape);
          }
        }
      },

      "create-separator": {
        group: "create",
        separator: true
      },

      "start-simulation": {
        group: "simulation",
        className: "fa-regular fa-circle-play",
        title: "Start Simulation",
        action: {
          click: (event) => {
            this.toggleSimulationButton(event);
          }
        }
      },

      "step-back-simulation": {
        group: "simulation",
        className: "fa-solid fa-backward-step",
        title: "Step Back",
        action: {
          click: () => {
            if (!this.simulationService.isSimulationActive()) {
              showAlert({
                title: 'Step-back error',
                message: 'Step-back failed: no simulation is active.'
              });
              return;
            }

            const didStepBack = this.simulationService.stepBack();
            if (!didStepBack) {
              showAlert({
                title: 'Step-back error',
                message: 'Step-back failed: no previous simulation step found.'
              });
            }
          }
        }
      },

      "reset-tokens": {
        group: "simulation",
        className: "fa-regular bpmn-icon-end-event-compensation",
        title: "Reset Tokens",
        action: {
          click: () => {
            if (!this.simulationService.isSimulationActive()) { // Only actually reset tokens if simulation is active
              showAlert({
                title: 'Reset error',
                message: 'Reset failed: no simulation is active.'
              });
            } else {
              this.simulationService.resetTokensToInitial();
              this.simulationService.stopSimulation();
              this.deactivateSimulationButton();
            }
          }
        }
      },

      "labels": {
        group: "labels",
        className: "fa-solid fa-tags",
        title: "Toggle Labels",
        action: {
          click: (event) => {
            this.toggleLabels(event);
          }
        }
      }

    }
  }
}
