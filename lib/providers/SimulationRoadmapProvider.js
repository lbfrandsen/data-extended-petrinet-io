import { showAlert } from '../services/DialogService.js';
import SimulationRoadmapExportService from '../services/SimulationRoadmapExportService.js';

export default class SimulationRoadmapProvider {
  static $inject = ['eventBus', 'simulationService', 'elementRegistry', 'sqlDialogService'];

  constructor(eventBus, simulationService, elementRegistry, sqlDialogService) {
    this.eventBus = eventBus;
    this.simulationService = simulationService;
    this.exportService = new SimulationRoadmapExportService(
      simulationService,
      elementRegistry,
      sqlDialogService
    );
    this.isExpanded = false;
    this.container = this._ensureContainer();

    if (!this.container) {
      return;
    }

    this.container.addEventListener('mouseenter', () => this._expandFromHover());
    this.container.addEventListener('mouseleave', () => this._collapsePanel());

    this.eventBus.on('simulation.mode.changed', () => this.render());
    this.eventBus.on('simulation.state.changed', () => this.render());

    this.render();
  }

  // Reuse an existing roadmap node if one was already created.
  _ensureContainer() {
    let container = document.getElementById('simulation-roadmap');
    if (container) {
      return container;
    }

    // Create the roadmap node and attach it to the page body.
    container = document.createElement('div');
    container.id = 'simulation-roadmap';
    container.className = 'simulation-roadmap';
    document.body.appendChild(container);
    return container;
  }

  // Avoid extra renders when the panel is already expanded.
  _expandFromHover() {
    if (this.isExpanded) {
      return;
    }
    this.isExpanded = true;
    this.render();
  }

  _collapsePanel() {
    this.isExpanded = false;
    this.render();
  }

  // Read the current simulation status with safe fallbacks.
  _getSnapshot() {
    const active = typeof this.simulationService?.isSimulationActive === 'function'
      ? this.simulationService.isSimulationActive()
      : Boolean(this.simulationService?.isActive);

    const enabledTransitionCount = typeof this.simulationService?.getEnabledTransitionCount === 'function'
      ? this.simulationService.getEnabledTransitionCount()
      : 0;

    const stepHistoryDepth = typeof this.simulationService?.getStepHistoryDepth === 'function'
      ? this.simulationService.getStepHistoryDepth()
      : 0;

    const currentStepIndex = typeof this.simulationService?.getCurrentStepIndex === 'function'
      ? this.simulationService.getCurrentStepIndex()
      : stepHistoryDepth;

    const executionLog = typeof this.simulationService?.getExecutionLog === 'function'
      ? this.simulationService.getExecutionLog()
      : [];

    return {
      active,
      enabledTransitionCount,
      stepHistoryDepth,
      currentStepIndex,
      executionLog
    };
  }

  render() {
    if (!this.container) {
      return;
    }

    // Refresh panel state from a fresh simulation snapshot.
    const snapshot = this._getSnapshot();
    this.container.innerHTML = '';
    this.container.classList.toggle('is-expanded', this.isExpanded);

    const header = document.createElement('div');
    header.className = 'simulation-roadmap__header';

    const headerText = document.createElement('div');
    headerText.className = 'simulation-roadmap__header-text';

    const title = document.createElement('div');
    title.className = 'simulation-roadmap__title';
    title.textContent = 'SIM ROADMAP';
    headerText.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'simulation-roadmap__summary';
    summary.textContent = `Status: ${snapshot.active ? 'active' : 'inactive'} | Enabled: ${snapshot.enabledTransitionCount} | Step: ${snapshot.currentStepIndex}/${snapshot.executionLog.length}`;
    headerText.appendChild(summary);

    const icon = document.createElement('img');
    icon.className = 'simulation-roadmap__icon';
    icon.src = '/sim_log_icon.png';
    icon.alt = 'Simulation log icon';

    header.appendChild(headerText);
    header.appendChild(icon);

    this.container.appendChild(header);

    // Stop after header render when the panel is collapsed.
    if (!this.isExpanded) {
      return;
    }

    const divider = document.createElement('div');
    divider.className = 'simulation-roadmap__divider';
    this.container.appendChild(divider);

    const list = document.createElement('div');
    list.className = 'simulation-roadmap__list';
    const currentStep = snapshot.currentStepIndex;
    const canJump = snapshot.active && typeof this.simulationService?.jumpToStep === 'function';

    const hint = document.createElement('div');
    hint.className = 'simulation-roadmap__hint';
    hint.textContent = canJump
      ? 'Click a prior step to jump directly.'
      : 'Enable simulation to jump between steps.';
    list.appendChild(hint);

    // Show an empty-state message until at least one transition has fired.
    if (!snapshot.executionLog.length) {
      const empty = document.createElement('div');
      empty.className = 'simulation-roadmap__empty';
      empty.textContent = 'No simulation steps yet.';
      list.appendChild(empty);
    } else {
      const rows = [
        { step: 0, text: 'Step 0 - Initial marking' },
        ...snapshot.executionLog.map((transitionId, index) => ({
          step: index + 1,
          text: `Step ${index + 1} - Fired ${transitionId}`
        }))
      ];

      rows.forEach(({ step, text }) => {
        const rowButton = document.createElement('button');
        rowButton.type = 'button';
        rowButton.className = 'simulation-roadmap__row-btn';
        rowButton.textContent = text;

        if (step === currentStep) {
          rowButton.classList.add('is-current');
          rowButton.title = 'Current simulation step';
          rowButton.disabled = true;
        } else if (!canJump) {
          rowButton.disabled = true;
        } else {
          rowButton.title = `Jump to step ${step}`;
          rowButton.addEventListener('click', () => {
            this.simulationService.jumpToStep(step);
          });
        }

        list.appendChild(rowButton);
      });
    }

    const actionRow = document.createElement('div');
    actionRow.className = 'simulation-roadmap__actions';

    const exportButton = document.createElement('button');
    exportButton.type = 'button';
    exportButton.className = 'simulation-roadmap__export-btn';
    exportButton.textContent = 'Export Roadmap';
    exportButton.addEventListener('click', async () => {
      try {
        this.exportService.exportToDownload();
        await showAlert({
          title: 'Export Complete',
          message: 'Simulation roadmap JSON was exported succesfully. Check your downloads folder.'
        });
      } catch (error) {
        await showAlert({
          title: 'Export Failed',
          message: error?.message || String(error)
        });
      }
    });

    const archiveButton = document.createElement('button');
    archiveButton.type = 'button';
    archiveButton.className = 'simulation-roadmap__archive-btn bpmn-icon-subprocess-expanded';
    archiveButton.title = 'Show session archive';
    archiveButton.setAttribute('aria-label', 'Show session archive');
    archiveButton.addEventListener('click', async () => {
      const archive = typeof this.simulationService?.getSessionArchive === 'function'
        ? this.simulationService.getSessionArchive()
        : [];

      if (!archive.length) {
        await showAlert({
          title: 'Session Archive',
          message: 'No archived simulation sessions yet.'
        });
        return;
      }

      const lines = archive
        .map((session, idx) => {
          // const endedAt = session?.endedAt ? new Date(session.endedAt).toLocaleString() : 'n/a';
          const steps = Array.isArray(session?.executionLog) ? session.executionLog.length : 0;
          const endedBy = session?.endedBy || 'unknown';
          return `${idx + 1}. ${session.id} | steps: ${steps} | ended by: ${endedBy}`;
        })
        .join('\n');

      await showAlert({
        title: 'Session Archive',
        message: lines
      });
    });

    actionRow.appendChild(exportButton);
    actionRow.appendChild(archiveButton);
    list.appendChild(actionRow);

    this.container.appendChild(list);
  }
}
