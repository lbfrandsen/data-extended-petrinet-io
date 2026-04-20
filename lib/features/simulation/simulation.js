import BaseSimulationService from "./BaseSimulationService.js"


export default class SimulationService extends BaseSimulationService{

    static $inject = ["eventBus", "elementRegistry", "canvas", "mathService", "databaseService", "sqlDialogService", "sqlParserService"];

    constructor(eventBus, elementRegistry, canvas, mathService, databaseService, sqlDialogService, sqlParserService) {
        super(eventBus, elementRegistry, canvas, mathService, databaseService, sqlDialogService, sqlParserService);

        // Listen for element changes to update enabled transitions
        this.eventBus.on(['elements.changed', 'connection.added', 'connection.removed', 'shape.added', 'shape.removed'], () => {
            if (this.isActive) {
                this.updateEnabledTransitions();
            }
        });

        this.eventBus.on("element.click", (event) => {
            const element = event.element; 
            if (element.type === "petri:transition") {
                if (this.isTransitionEnabled(element)) {
                    this.fireTransition(element);
                }
            }
        });
    
    }

    // Toggles simulation mode on/off
    toggleSimulation() {
        const wasActive = this.isActive;
        this.isActive = !this.isActive;

        // Always capture a fresh baseline when starting a simulation session.
        // Reusing stale initialTokenState across runs causes reset-to-initial drift.
        if (!wasActive && this.isActive) {
            this.initialTokenState.clear();
            this.saveInitialTokenState();
        }

        this.updateEnabledTransitions();

        this.eventBus.fire('simulation.mode.changed', { active: this.isActive });
        return this.isActive;
    }
}
