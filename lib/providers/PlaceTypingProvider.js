// lib/features/place-typing/PlaceTypingProvider.js
import { showAlert, showPrompt } from '../services/DialogService.js';
import * as placeTypeUtils from '../helpers/placeTypeUtils.js'
export default class PlaceTypingProvider {

    static $inject = ['eventBus'];

    constructor(eventBus) {
        this._eventBus = eventBus;
    }

    parseTypeLine(line) { // parse user input in prompt
        const trimmed = line.startsWith('<') && line.endsWith('>')
            ? line.slice(1, -1).trim()
            : line.trim();

        if (line === "" || line === null || line === "ε") return [];

        const parts = trimmed.split(",").map(s => s.trim());

        // Reject malformed comma usage like int, or ,int or int,,string
        if (parts.some(p => p === "")) {
            throw new Error('Invalid format: malformed comma placement inside tuple type.');
        }

        for (const p of parts) { // checks for "abc" or other
            if (!placeTypeUtils.isTokenColor(p)) {
                throw new Error(`Invalid color "${p}". Allowed: int, string, bool, real`);
            }
        }

        return parts;
    }

    async promptForPlaceType(place) { // prompt
        const currentPlaceType = placeTypeUtils.getRawPlaceType(place.businessObject);
        const current = (currentPlaceType === null || currentPlaceType === '')
            ? 'ε'
            : String(currentPlaceType).replace(/\*/g, ',');

        const msg =
            `Allowed colors: int, string, bool, real, or any combination of the four\n`;

        const input = await showPrompt({
            title: 'Set place type',
            message: msg,
            initialValue: current
        });
        if (input === null) {
            return null;
        }

        try {
            const typeArr = this.parseTypeLine(input);
            return placeTypeUtils.typeToKey(typeArr);
        } catch (error) {
            await showAlert({
                title: 'Invalid place type',
                message: error.message
            });
            return null;
        }
    }

    async promptAndSetPlaceType(place) {
        if (!place.businessObject) place.businessObject = {};
        if (!Array.isArray(place.businessObject.marking)) place.businessObject.marking = [];

        const selected = await this.promptForPlaceType(place);
        if (selected === null) return;

        place.businessObject.place_type = selected;

        place.businessObject.tokens = place.businessObject.marking.length;

        this._eventBus.fire('element.changed', { element: place });

        const incomingArcs = Array.isArray(place.incoming) ? place.incoming : [];
        const outgoingArcs = Array.isArray(place.outgoing) ? place.outgoing : [];

        for (const arc of incomingArcs) {
            const transition = arc?.source;
            if (transition?.businessObject) {
                transition.businessObject.outputGuard = '';
                this._eventBus.fire('element.changed', { element: transition });
            }
        }

        for (const arc of outgoingArcs) {
            const transition = arc?.target;
            if (transition?.businessObject) {
                transition.businessObject.inputGuard = '';
                this._eventBus.fire('element.changed', { element: transition });
            }
        }
    }

}