import RuleProvider from 'diagram-js/lib/features/rules/RuleProvider.js';

import { isFrameElement } from 'diagram-js/lib/util/Elements.js';


export default class CustomRuleProvider extends RuleProvider{

    static $inject = ["eventBus", "elementRegistry"];

    constructor(eventBus, elementRegistry){

    super(eventBus)
    this.elementRegistry = elementRegistry;
    }

    init(){
        const isRoot = (element) => Boolean(element && !element.parent);
        const isPetriShape = (element) => (
            element?.type === "petri:place" ||
            element?.type === "petri:transition"
        );

        this.addRule("shape.create", (context) => {
            const target = context.target;
            const shape = context.shape;

            if (!target || !isPetriShape(shape)) {
                return false;
            }

            // Petri net nodes should only be created on the root canvas,
            // never nested inside other nodes.
            return isRoot(target);
        });

        this.addRule("elements.move", (context) => {
            const { shapes = [], target } = context;

            if (!shapes.some(isPetriShape)) {
                return true;
            }

            // Keep Petri net nodes on the root canvas to avoid invalid
            // parent/child relationships during drag-and-drop.
            return !target || isRoot(target);
        });

        this.addRule("connection.create", (context) => {

            const {source, target} = context;

            if (!source || !target) { return false; }

            // disallow same-type connections
            if (source.type === "petri:place" && target.type === "petri:place"){
                return false;
            }
            if (source.type === "petri:transition" && target.type === "petri:transition"){
                return false;
            }

            // prevent duplicate connections
            const hasDuplicateDirectedConnection = Array.isArray(source.outgoing) && source.outgoing.some((connection) => connection.target === target);
            if (hasDuplicateDirectedConnection) {
                return false;
            }

            if (target.parent === source.parent) {
                return { type: 'petri:connection' };  
            }

            return false;
        }); 
        this.addRule("shape.resize", (context) => {
            const shape = context.shape; 
            
            // Allow resizing for frames
            if (isFrameElement(shape)) {
                return true;
            }
            
            // Allow resizing for petri net shapes (places and transitions)
            if (shape.type === "petri:place" || 
                shape.type === "petri:transition") {
                return true;
            }
            
            // Disallow resizing for other elements
            return false;
        })
    }

}
