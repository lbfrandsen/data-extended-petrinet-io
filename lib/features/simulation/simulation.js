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
            if (element.type === "petri:transition" || element.type === "petri:empty_transition") {
                if (this.isTransitionEnabled(element)) {
                    this.fireTransition(element);
                }
            }
        });
    
    }

    // Toggles simulation mode on/off
    toggleSimulation() {
        this.isActive = !this.isActive;

        // Prevent tokens being yeeted on reset
        if (this.isActive) {
            this.saveInitialTokenState();
        }

        this.updateEnabledTransitions();

        this.eventBus.fire('simulation.mode.changed', { active: this.isActive });
        return this.isActive;
    }
}
