import { parseType } from '../../helpers/token-types.js';
export default class BaseSimulationService {

    static $inject = ["eventBus", "elementRegistry", "canvas"];

    constructor(eventBus, elementRegistry, canvas) {
        this.eventBus = eventBus;
        this.elementRegistry = elementRegistry;
        this.canvas = canvas;
        this.isActive = false;
        this.initialTokenState = new Map();
        this.enabledTransitions = new Set();
        this.firedTransitions = new Set();
    }

    // Elias Storm Vedel Jørgensen - clone objects for reseting tokens
    saveInitialTokenState() {
        const elements = this.elementRegistry.getAll();
        const places = elements.filter(el => el.type === "petri:place");

        places.forEach(place => {
            // const tokens = el.businessObject?.tokens || 0;
            // this.initialTokenState.set(el.id, tokens)
            const marking = this.deepClone(this.getPlaceMarking(place));
            this.initialTokenState.set(place.id, marking);
            this.syncTokenCount(place);
        })
    }

    // Elias Storm Vedel Jørgensen - deep clone for reseting tokens
    resetTokensToInitial() {
        // const element = this.elementRegistry.getAll();
        // const places = element.filter(el => el.mtype === "petri:place");

        // places.forEach(place => {

        //     const initialToken = this.initialTokenState.get(place.id) || 0;

        //     if (!place.businessObject) {
        //         place.businessObject = { tokens: 0 };
        //     }

        //     place.businessObject.tokens = initialToken;

        //     this.eventBus.fire("element.changed", { element: place });

        // })

        const elements = this.elementRegistry.getAll();
        const places = elements.filter(el => el.type === "petri:place");

        places.forEach(place => {
            if (!place.businessObject) {
                place.businessObject = {};
            }

            place.businessObject.marking = this.deepClone(this.initialTokenState.get(place.id) || []);
            this.syncTokenCount(place);
            this.eventBus.fire("element.changed", { element: place });
        });

        this.updateEnabledTransitions();
    }

    // clear rendered colors 
    clearSimulationState() {
        this.enabledTransitions.clear();
        this.firedTransitions.clear();
        this.refreshAllTransitions();
    };

    // Elias Storm Vedel Jørgensen - new firing
    canTransitionFire(transition) {
        // // Check if transition has incoming connections
        // const incoming = transition.incoming || [];

        // // If no incoming connections, transition can fire
        // if (incoming.length === 0) {
        //     return true;
        // }

        // // Check if all incoming places have at least one token
        // return incoming.every(connection => {
        //     const sourcePlace = connection.source;

        //     // Check if source has tokens
        //     const tokens = sourcePlace.businessObject?.tokens || 0;
        //     return tokens > 0;
        // });

        return this.buildTransitionFiringPlan(transition) !== null;
    }

    updateEnabledTransitions() {
        if (!this.isActive) {
            this.clearSimulationState();
            return;
        }

        this.enabledTransitions.clear();

        // Get all elements
        const elements = this.elementRegistry.getAll();

        // Find all transitions
        const transitions = elements.filter(el =>
            el.type === 'petri:transition' || el.type === 'petri:empty_transition'
        );


        transitions.forEach(transition => {
            if (this.canTransitionFire(transition)) {
                this.enabledTransitions.add(transition.id);
            }
        });

        // Trigger re-render of all transitions
        this.refreshAllTransitions();
    }

    refreshAllTransitions() {
        const elements = this.elementRegistry.getAll();
        const transitions = elements.filter(el =>
            el.type === 'petri:transition' || el.type === 'petri:empty_transition'
        );

        transitions.forEach(transition => {
            this.eventBus.fire('element.changed', { element: transition });
        });
    }

    // Elias Storm Vedel Jørgensen - new firing
    fireTransition(element) {
        // // Only fire if simulation is active and transition is enabled
        if (!this.isActive || !this.isTransitionEnabled(element)) {
            return;
        }

        const plan = this.buildTransitionFiringPlan(element);

        if (!plan) {
            return;
        }

        // Execute the firing plan
        const affectedPlaces = new Map();

        plan.consumption.forEach(step => {
            this.removeStoredTokens(step.place, step.tokens);
            affectedPlaces.set(step.place.id, step.place);
        });

        (plan.outgoing || []).forEach(connection => {
            const targetPlace = connection.target;

            if (!targetPlace || targetPlace.type !== 'petri:place') {
                return;
            }

            this.addProducedTokens(targetPlace, connection, plan.binding);
            affectedPlaces.set(targetPlace.id, targetPlace);
        });

        this.firedTransitions.add(element.id);

        // Trigger re-render of all affected places
        affectedPlaces.forEach(place => {
            this.eventBus.fire('element.changed', { element: place });
        });

        this.updateEnabledTransitions();



        // const incoming = element.incoming || [];
        // const outgoing = element.outgoing || [];
        // const affectedPlaces = [];

        // // Remove tokens from input places
        // incoming.forEach(connection => {
        //     const sourcePlace = connection.source;

        //     // Ensure businessObject exists
        //     if (!sourcePlace.businessObject) {
        //         sourcePlace.businessObject = { tokens: 0 };
        //     }

        //     const currentTokens = sourcePlace.businessObject.tokens || 0;
        //     sourcePlace.businessObject.tokens = Math.max(0, currentTokens - 1);
        //     affectedPlaces.push(sourcePlace);
        // });

        // // Add tokens to output places
        // outgoing.forEach(connection => {
        //     const targetPlace = connection.target;

        //     // Ensure businessObject exists
        //     if (!targetPlace.businessObject) {
        //         targetPlace.businessObject = { tokens: 0 };
        //     }

        //     const currentTokens = targetPlace.businessObject.tokens || 0;
        //     targetPlace.businessObject.tokens = currentTokens + 1;
        //     affectedPlaces.push(targetPlace);
        // });

        // // Mark this transition as fired
        // this.firedTransitions.add(element.id);

        // // Trigger re-render of all affected places
        // affectedPlaces.forEach(place => {
        //     this.eventBus.fire('element.changed', { element: place });
        // });

        // // Update which transitions are enabled
        // this.updateEnabledTransitions();
    }

    isTransitionEnabled(element) {
        return this.enabledTransitions.has(element.id);
    }

    isTransitionFired(element) {
        return this.firedTransitions.has(element.id);
    }

    //helpers 
    // for reseting tokens 
    deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    deepEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }
    // for getting placec types
    getPlaceType(place) {
        const rawTypes = place?.businessObject?.types || [];

        if (!Array.isArray(rawTypes) || rawTypes.length === 0) {
            return [];
        }

        const firstType = rawTypes[0];

        if (Array.isArray(firstType)) {
            return firstType;
        }

        return parseType(firstType);
    }
    // for getting the marking of a place
    getPlaceMarking(place) {
        if (!place.businessObject) {
            place.businessObject = {};
        }

        if (!Array.isArray(place.businessObject.marking)) {
            place.businessObject.marking = [];
        }

        return place.businessObject.marking;
    }
    // for reseting token count after firing
    syncTokenCount(place) {
        const marking = this.getPlaceMarking(place);
        place.businessObject.tokens = marking.length;
    }
    // for handling token values with multiple colors
    normalizeTokenValues(token) {
        if (Array.isArray(token)) {
            return token;
        }

        if (token && typeof token === 'object' && 'value' in token) {
            const value = token.value;
            return Array.isArray(value) ? value : [value];
        }

        if (token === undefined || token === null) {
            return [];
        }

        return [token];
    }
    // for creating stored token based on place type
    createStoredTokenFromValues(values, placeType) {
        if (placeType.length === 0) {
            return [];
        }

        if (placeType.length === 1) {
            return values[0];
        }

        return values;
    }
    // for parsing arc inscription and multiplicity
    parseArcInscriptionSpec(connection) {
        const rawText = String(connection?.businessObject?.arcInscription ?? '<x>').trim() || '<x>';

        let text = rawText;
        let multiplicity = 1;

        const superscriptMap = {
            '⁰': '0',
            '¹': '1',
            '²': '2',
            '³': '3',
            '⁴': '4',
            '⁵': '5',
            '⁶': '6',
            '⁷': '7',
            '⁸': '8',
            '⁹': '9'
        };

        const superscriptMatch = text.match(/^(.*?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/);
        if (superscriptMatch) {
            text = superscriptMatch[1].trim();
            multiplicity = Number(
                superscriptMatch[2]
                    .split('')
                    .map(ch => superscriptMap[ch])
                    .join('')
            );
        }

        const caretMatch = text.match(/^(.*?)\^(\d+)$/);
        if (caretMatch) {
            text = caretMatch[1].trim();
            multiplicity = Number(caretMatch[2]);
        }

        let inner = text;
        if (text.startsWith('<') && text.endsWith('>')) {
            inner = text.slice(1, -1).trim();
        }

        const vars = inner === ''
            ? []
            : inner.split(',').map(s => s.trim()).filter(Boolean);

        return {
            text: `<${vars.join(',')}>`,
            vars,
            multiplicity: Math.max(1, multiplicity)
        };
    }
    // for prompting arc inscription when creating a new connection
    tokenMatchesPlaceType(tokenValues, placeType) {
        if (placeType.length === 0) {
            return tokenValues.length === 0;
        }

        return tokenValues.length === placeType.length;
    }
    // for checking if token values match the variables in the arc inscription spec, considering existing variable bindings
    tokenMatchesVarsWithBinding(tokenValues, vars, binding) {
        if (vars.length === 0) {
            return true;
        }

        if (vars.length !== tokenValues.length) {
            return false;
        }

        const localBinding = { ...binding };

        for (let i = 0; i < vars.length; i++) {
            const varName = vars[i];
            const value = tokenValues[i];

            if (Object.prototype.hasOwnProperty.call(localBinding, varName) && !this.deepEqual(localBinding[varName], value)) {
                return false;
            }

            localBinding[varName] = value;
        }

        return true;
    }
    // for merging variable bindings from a token when it matches the arc inscription spec
    mergeBindingFromToken(binding, vars, tokenValues) {
        if (vars.length !== tokenValues.length) {
            return;
        }

        for (let i = 0; i < vars.length; i++) {
            const varName = vars[i];

            if (!Object.prototype.hasOwnProperty.call(binding, varName)) {
                binding[varName] = tokenValues[i];
            }
        }
    }

    pickTokensForRequirement(marking, placeType, requirement, binding) {
        const chosenIndexes = [];
        const chosenTokens = [];
        const nextBinding = { ...binding };
        const shouldBindVariables = requirement.multiplicity === 1;

        for (let index = 0; index < marking.length; index++) {
            const storedToken = marking[index];
            const tokenValues = this.normalizeTokenValues(storedToken);

            if (!this.tokenMatchesPlaceType(tokenValues, placeType)) {
                continue;
            }

            if (requirement.vars.length > 0 && requirement.vars.length !== tokenValues.length) {
                continue;
            }

            if (shouldBindVariables && !this.tokenMatchesVarsWithBinding(tokenValues, requirement.vars, nextBinding)) {
                continue;
            }

            chosenIndexes.push(index);
            chosenTokens.push(this.deepClone(storedToken));

            if (shouldBindVariables) {
                this.mergeBindingFromToken(nextBinding, requirement.vars, tokenValues);
            }

            if (chosenIndexes.length === requirement.multiplicity) {
                return {
                    indexes: chosenIndexes,
                    tokens: chosenTokens,
                    binding: nextBinding
                };
            }
        }

        return null;
    }

    buildTransitionFiringPlan(transition) {
        const incoming = transition.incoming || [];
        const outgoing = transition.outgoing || [];
        const workingMarkings = new Map();
        const binding = {};
        const consumption = [];

        for (const connection of incoming) {
            const sourcePlace = connection.source;

            if (!sourcePlace || sourcePlace.type !== 'petri:place') {
                return null;
            }

            if (!workingMarkings.has(sourcePlace.id)) {
                workingMarkings.set(sourcePlace.id, this.deepClone(this.getPlaceMarking(sourcePlace)));
            }

            const workingMarking = workingMarkings.get(sourcePlace.id);
            const placeType = this.getPlaceType(sourcePlace);
            const requirement = this.parseArcInscriptionSpec(connection);
            const picked = this.pickTokensForRequirement(workingMarking, placeType, requirement, binding);

            if (!picked) {
                return null;
            }

            consumption.push({
                place: sourcePlace,
                tokens: picked.tokens
            });

            Object.assign(binding, picked.binding);

            picked.indexes
                .slice()
                .sort((a, b) => b - a)
                .forEach(index => {
                    workingMarking.splice(index, 1);
                });
        }

        return {
            binding,
            consumption,
            outgoing
        };
    }

    randomValueForColor(color) {
        if (color === 'int') {
            return Math.floor(Math.random() * 10);
        }

        if (color === 'real') {
            return Number((Math.random() * 10).toFixed(2));
        }

        if (color === 'bool') {
            return Math.random() < 0.5;
        }

        if (color === 'string') {
            const values = ['a', 'b', 'c', 'd'];
            return values[Math.floor(Math.random() * values.length)];
        }

        return null;
    }

    buildProducedToken(targetPlace, connection, binding) {
        const placeType = this.getPlaceType(targetPlace);
        const requirement = this.parseArcInscriptionSpec(connection);
        const values = [];

        for (let i = 0; i < placeType.length; i++) {
            const varName = requirement.vars[i];

            if (varName && Object.prototype.hasOwnProperty.call(binding, varName)) {
                values.push(binding[varName]);
            } else {
                values.push(this.randomValueForColor(placeType[i]));
            }
        }

        return this.createStoredTokenFromValues(values, placeType);
    }

    removeStoredTokens(place, tokensToRemove) {
        const marking = this.getPlaceMarking(place);

        for (const tokenToRemove of tokensToRemove) {
            const index = marking.findIndex(token => this.deepEqual(token, tokenToRemove));

            if (index !== -1) {
                marking.splice(index, 1);
            }
        }

        this.syncTokenCount(place);
    }

    addProducedTokens(place, connection, binding) {
        const marking = this.getPlaceMarking(place);
        const requirement = this.parseArcInscriptionSpec(connection);

        for (let i = 0; i < requirement.multiplicity; i++) {
            marking.push(this.buildProducedToken(place, connection, binding));
        }

        this.syncTokenCount(place);
    }


}