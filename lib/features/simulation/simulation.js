import BaseSimulationService from "./BaseSimulationService.js"


export default class SimulationService extends BaseSimulationService{

    static $inject = ["eventBus", "elementRegistry", "canvas", "mathService"];

    constructor(eventBus, elementRegistry, canvas, mathService) {
        super(eventBus, elementRegistry, canvas, mathService);

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

    // Toggles simulation mode on/off without clearing the state of transitions
    toggleSimulation() {
        this.isActive = !this.isActive;

        if (this.isActive && this.initialTokenState.size === 0) {
            this.saveInitialTokenState();
        }

        this.updateEnabledTransitions();

        this.eventBus.fire('simulation.mode.changed', { active: this.isActive });
        return this.isActive;
    }
}
