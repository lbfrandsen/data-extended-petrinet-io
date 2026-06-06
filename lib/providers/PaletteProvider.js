import { showAlert, showPrompt, showResetModeDialog } from '../services/DialogService.js';
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

    // Keep the toggle button in sync when simulation state changes externally (e.g. after import).
    if (typeof this.eventBus?.on === 'function') {
      this.eventBus.on('simulation.mode.changed', (event) => {
        const button = document.querySelector('[data-action="start-simulation"]');
        if (button) {
          button.classList.toggle('active', Boolean(event.active));
        }
      });
    }
  }

  titleError = "Error";

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

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 't',
        when,
        preventDefault: false,
        callback: () => this.toggleLabels()
      })
    );

    return () => unregisterHotkeys.forEach(unregister => unregister());
  }

  _stepBackSimulation() {
    if (!this.simulationService.isSimulationActive()) {
      showAlert({ title: this.titleError, message: 'Step-back failed: no simulation is active.' });
      return;
    }

    const didStepBack = this.simulationService.stepBack();
    if (!didStepBack) {
      showAlert({ title: this.titleError, message: 'Step-back failed: no previous simulation step found.' });
    }
  }

  async _resetSimulation() {
    if (!this.simulationService.isSimulationActive()) {
      showAlert({ title: this.titleError, message: 'Reset failed: no simulation is active.' });
      return;
    }

    const resetMode = await showResetModeDialog({
      title: 'Reset Simulation',
      message: 'Choose reset behavior:\n- Master Reset: restore marking from before the first simulation run.\n- Soft Reset: restore marking from before the current simulation run.'
    });

    if (resetMode === null) {
      return;
    }

    if (resetMode === 'master') {
      this.simulationService.masterResetTokensToInitial();
    } else {
      this.simulationService.resetTokensToInitial();
    }

    this.simulationService.stopSimulation();
    this.deactivateSimulationButton();
  }

  // Called if the provider is ever torn down
  destroy() {
    this._destroyHotkeys?.();
  }

  toggleLabels(event) {
    this.idCounterService.toggleLabels();

    const button = event?.target?.closest?.('[data-action="labels"]')
      || document.querySelector('[data-action="labels"]');

    if (button) {
      button.classList.toggle('active');
    }

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
                placeType: null,
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

      "create-separator": {
        group: "create",
        separator: true
      },

      "start-simulation": {
        group: "simulation",
        className: "fa-regular fa-circle-play",
        title: "Start Simulation (S)",
        action: {
          click: (event) => {
            this.toggleSimulationButton(event);
          }
        }
      },

      "step-back-simulation": {
        group: "simulation",
        className: "fa-solid fa-backward-step",
        title: "Step Back (B)",
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
        title: "Reset Tokens (R)",
        action: {
          click: async () => this._resetSimulation()
        }
      },

      "labels": {
        group: "labels",
        className: "fa-solid fa-tags",
        title: "Toggle Labels (T)",
        action: {
          click: (event) => {
            this.toggleLabels(event);
          }
        }
      }

    }
  }
}
