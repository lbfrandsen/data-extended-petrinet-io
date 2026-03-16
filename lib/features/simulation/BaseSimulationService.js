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
        this.stepHistory = [];
    }

    // Getter for simulation active state
    isSimulationActive() {
        return this.isActive;
    }

    // Stop somulation and clear enabled/fired transitions
    stopSimulation() {
        this.isActive = false;
        this.clearStepHistory();
        this.updateEnabledTransitions();
    }

    // Elias Storm Vedel Jørgensen - saving initial token state for resets
    saveInitialTokenState() {
        const elements = this.elementRegistry.getAll(); // see consructor
        const places = elements.filter(el => el.type === "petri:place"); // filter for places

        places.forEach(place => { // for each place
            const marking = this.deepClone(this.getPlaceMarking(place)); // clone the marking with helpers
            this.initialTokenState.set(place.id, marking); // save the cloned marking in map
            this.syncTokenCount(place); // check token count synced
        })
    }

    // Elias Storm Vedel Jørgensen - reseting to initial token state
    resetTokensToInitial() {
        const elements = this.elementRegistry.getAll(); // get all elements & filter for places
        const places = elements.filter(el => el.type === "petri:place");

        places.forEach(place => {
            place.businessObject.marking = this.deepClone(this.initialTokenState.get(place.id) || []); //marking set på place clone
            this.syncTokenCount(place); // sync check
            this.eventBus.fire("element.changed", { element: place }); // trigger re-render for place
        });
        this.firedTransitions.clear(); // clear fired transitions as part of reset, NOT on simulation toggle
        this.clearStepHistory();
        this.updateEnabledTransitions(); // update enabled transitions after reset
    }

    // Simulation history
    clearStepHistory() {
        this.stepHistory = [];
    }

    canStepBack() {
        return this.isActive && this.stepHistory.length > 0;
    }

    // Create a snapshot of the current simulation state for step-back 
    createSimulationSnapshot() {
        const snapshot = {
            markings: new Map(),
            firedTransitions: Array.from(this.firedTransitions)
        };

        const elements = this.elementRegistry.getAll();
        const places = elements.filter(el => el.type === 'petri:place'); // get tokens and their values for all places

        places.forEach(place => {
            snapshot.markings.set(place.id, this.deepClone(this.getPlaceMarking(place))); // clone the marking for the place and save in snapshot
        });

        return snapshot;
    }

    // Restore the simulation state from a snapshot
    restoreSimulationSnapshot(snapshot) {
        const elements = this.elementRegistry.getAll();
        const places = elements.filter(el => el.type === 'petri:place');

        places.forEach(place => {
            const savedMarking = snapshot.markings.get(place.id) || [];
            place.businessObject.marking = this.deepClone(savedMarking);
            this.syncTokenCount(place);
            this.eventBus.fire('element.changed', { element: place });
        });

        this.firedTransitions = new Set(snapshot.firedTransitions || []);
    }

    // Step back to previous state
    stepBack() {
        if (!this.canStepBack()) {
            return false;
        }

        const snapshot = this.stepHistory.pop();
        this.restoreSimulationSnapshot(snapshot);
        this.updateEnabledTransitions();
        return true;
    }

    // refresh and rerender enabled transitions
    updateEnabledTransitions() {
        if (!this.isActive) {
            this.enabledTransitions.clear();
            this.refreshAllTransitions();
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
            if (this.buildTransitionFiringPlan(transition)) {
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

    isTransitionEnabled(element) {
        return this.enabledTransitions.has(element.id);
    }

    isTransitionFired(element) {
        return this.firedTransitions.has(element.id);
    }

    // Elias Storm Vedel Jørgensen - new firing
    fireTransition(element) {
        // Only fire if simulation is active and transition is enabled
        if (!this.isActive || !this.isTransitionEnabled(element)) {
            return;
        }

        const plan = this.buildTransitionFiringPlan(element); // build firing plan based on marking
        if (!plan) {
            return;
        }

        // Save the exact pre-fire state so step-back can restore original token values.
        this.stepHistory.push(this.createSimulationSnapshot());

        // Execute the firing plan
        const affectedPlaces = new Map();

        plan.consumption.forEach(step => {
            this.removeStoredTokens(step.place, step.tokens);
            affectedPlaces.set(step.place.id, step.place);
        });

        (plan.outgoingArc || []).forEach(connection => {
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
    }

    // Storm & Joschka - building a firing plan for a transition
    buildTransitionFiringPlan(transition) {
        const incomingArcs = Array.isArray(transition.incoming) ? transition.incoming : [];
        const outgoingArcs = Array.isArray(transition.outgoing) ? transition.outgoing : [];
        const currentMarkings = new Map();

        for (const connection of incomingArcs) {
            const sourcePlace = connection?.source;

            if (!sourcePlace || sourcePlace.type !== 'petri:place') {
                return null;
            }

            if (!currentMarkings.has(sourcePlace.id)) {
                currentMarkings.set(
                    sourcePlace.id,
                    this.deepClone(this.getPlaceMarking(sourcePlace))
                );
            }
        }

        // to ensure guard satisfaction
        return this.findBindingForTransition(
            incomingArcs,
            0,
            currentMarkings,
            {},
            [],
            transition.businessObject?.inputGuard,
            outgoingArcs
        );
    }

    // Find binding that satisfies guard
    findBindingForTransition(incomingArcs, arcIndex, currentMarkings, binding, consumption, guard, outgoingArcs
    ) {
        if (arcIndex >= incomingArcs.length) {
            console.log('Final binding:', binding);
            console.log('Guard:', guard);
            console.log('Guard result:', this.evaluateGuardExpression(guard, binding));
            if (!this.evaluateGuardExpression(guard, binding)) {
                return null;
            }

            return {
                binding,
                consumption,
                outgoingArc: outgoingArcs
            };
        }

        // one arc at a time
        const connection = incomingArcs[arcIndex];
        const sourcePlace = connection?.source;

        if (!sourcePlace || sourcePlace.type !== 'petri:place') {
            return null;
        }

        const workingMarking = currentMarkings.get(sourcePlace.id);
        const placeType = this.getPlaceType(sourcePlace);
        const arcInsRequirement = this.parseArcInscriptionSpec(connection);

        // find all possible bindings
        const candidates = this.findAllTokenSelectionsForArc(
            workingMarking,
            placeType,
            arcInsRequirement,
            binding
        );

        for (const picked of candidates) {
            const nextMarkings = new Map(currentMarkings);
            const nextWorkingMarking = this.deepClone(workingMarking);

            // remove tokens from marking
            picked.indexes
                .slice()
                .sort((a, b) => b - a)
                .forEach(index => {
                    nextWorkingMarking.splice(index, 1);
                });

            nextMarkings.set(sourcePlace.id, nextWorkingMarking);

            // check guard works for next arc as well
            const result = this.findBindingForTransition(
                incomingArcs,
                arcIndex + 1,
                nextMarkings,
                picked.binding,
                [
                    ...consumption,
                    {
                        place: sourcePlace,
                        tokens: picked.tokens
                    }
                ],
                guard,
                outgoingArcs
            );

            if (result) {
                return result;
            }
        }

        return null;
    }

    // find all possible bindings
    findAllTokenSelectionsForArc(marking, placeType, arcInsRequirement, binding) {
        const results = [];

        const search = (startIndex, chosenIndexes, chosenTokens, currentBinding) => {
            if (chosenIndexes.length === arcInsRequirement.multiplicity) {
                results.push({
                    indexes: [...chosenIndexes],
                    tokens: this.deepClone(chosenTokens),
                    binding: { ...currentBinding }
                });
                return;
            }

            for (let index = startIndex; index < marking.length; index++) {
                const storedToken = marking[index];
                const tokenValues = this.normalizeTokenValues(storedToken);

                if (!this.tokenMatchesPlaceType(tokenValues, placeType)) {
                    continue;
                }

                if (arcInsRequirement.vars.length !== tokenValues.length) {
                    continue;
                }

                if (!this.tokenMatchesVarsWithBinding(tokenValues, arcInsRequirement.vars, currentBinding)) {
                    continue;
                }

                const nextBinding = { ...currentBinding };
                this.mergeBindingFromToken(nextBinding, arcInsRequirement.vars, tokenValues);
                console.log('Next binding after merge:', nextBinding);

                chosenIndexes.push(index);
                chosenTokens.push(this.deepClone(storedToken));

                search(index + 1, chosenIndexes, chosenTokens, nextBinding);

                chosenIndexes.pop();
                chosenTokens.pop();
            }
        };

        search(0, [], [], { ...binding });

        return results;
    }

    // Evaluate Guard Expression
    evaluateGuardExpression(expression, binding) {
        const trimmed = String(expression ?? '').trim();

        if (!trimmed) {
            return true;
        }

        const tokens = trimmed
            .split(/(\s*(?:&&|\|\|)\s*)/)
            .map(part => part.trim())
            .filter(Boolean);

        let result = null;
        let pendingOp = null;

        for (const token of tokens) {
            if (token === '&&' || token === '||') {
                pendingOp = token;
                continue;
            }

            const clauseResult = this.evaluateGuardClause(token, binding);

            if (result === null) {
                result = clauseResult;
            } else if (pendingOp === '&&') {
                result = result && clauseResult;
            } else if (pendingOp === '||') {
                result = result || clauseResult;
            }
        }

        return Boolean(result);
    }

    // Evaluate single clause in guard expression (for instance x > 5 in x > 5 && x < 10)
    evaluateGuardClause(clause, binding) {
        const trimmed = String(clause ?? '').trim();
        const match = trimmed.match(/^([A-Za-z]+)\s*(==|!=|>=|<=|=|>|<)\s*(.+)$/);

        if (!match) {
            return false;
        }

        const [, variableName, operator, literalRaw] = match;

        if (!(variableName in binding)) {
            return false;
        }

        const left = binding[variableName];
        const right = this.parseGuardLiteral(literalRaw);

        switch (operator) {
            case '=':
            case '==':
                return left === right;
            case '!=':
                return left !== right;
            case '>':
                return left > right;
            case '<':
                return left < right;
            case '>=':
                return left >= right;
            case '<=':
                return left <= right;
            default:
                return false;
        }
    }


    parseGuardLiteral(raw) {
        const value = String(raw ?? '').trim();

        if (/^"([^"\\]|\\.)*"$/.test(value) || /^'([^'\\]|\\.)*'$/.test(value)) {
            return value.slice(1, -1);
        }

        if (/^(true|false)$/i.test(value)) {
            return value.toLowerCase() === 'true';
        }

        if (/^[+-]?\d+$/.test(value)) {
            return Number(value);
        }

        if (/^[+-]?(?:\d+\.\d*|\d*\.\d+)$/.test(value)) {
            return Number(value);
        }

        return undefined;
    }

    // checks if other arc has binded variable to token value
    tokenMatchesVarsWithBinding(tokenValues, vars, binding) {
        if (vars.length === 0) {// return if <>
            return true;
        }

        const localBinding = { ...binding };

        for (let i = 0; i < vars.length; i++) {
            const varName = vars[i]; // read var name
            const value = tokenValues[i]; // and value

            if (Object.prototype.hasOwnProperty.call(localBinding, varName) && !this.deepEqual(localBinding[varName], value)) { // Var already binded to different value ==> token does not match
                return false;
            }

            localBinding[varName] = value; // bind 
        }

        return true;
    }

    // store variable values into the binding if they are not already set.
    mergeBindingFromToken(binding, vars, tokenValues) {
        for (let i = 0; i < vars.length; i++) {
            const varName = vars[i]; // var

            if (!Object.prototype.hasOwnProperty.call(binding, varName)) { // if not binded
                binding[varName] = tokenValues[i]; // bind variable to value from token
            }
        }
    }

    // removing tokens from place based on consumption plan
    removeStoredTokens(place, tokensToRemove) {
        const marking = this.getPlaceMarking(place); // get marking

        for (const tokenToRemove of tokensToRemove) { // consuption plan for tokensToRemove
            const index = marking.findIndex(token => this.deepEqual(token, tokenToRemove)); // find idx of token in marking

            if (index !== -1) { // -1 ==> not found, 0 or higher ==> found
                marking.splice(index, 1);
            }
        }

        this.syncTokenCount(place); // sync token count after
    }

    // produce tokens 
    addProducedTokens(place, connection, binding) {
        const marking = this.getPlaceMarking(place); // get marking
        const arcInsRequirement = this.parseArcInscriptionSpec(connection); // arcinsReq for connection

        const producedToken = this.buildProducedToken(place, connection, binding); // build once per firing

        for (let i = 0; i < arcInsRequirement.multiplicity; i++) { // for multiplicity of arc inscription
            marking.push(this.deepClone(producedToken)); // add identical token each time
        }


        this.syncTokenCount(place); // sync token count after
    }

    // building of tokens to be produced
    buildProducedToken(targetPlace, connection, binding) {
        const placeType = this.getPlaceType(targetPlace); // get target place type
        const arcInsRequirement = this.parseArcInscriptionSpec(connection); // arcinsReq
        const values = [];

        for (let i = 0; i < placeType.length; i++) {
            const varName = arcInsRequirement.vars[i]; // get var name 

            if (varName && Object.prototype.hasOwnProperty.call(binding, varName)) { // if var already bound use value (for multiple arcs with same variable name)
                values.push(binding[varName]);
            } else {
                values.push(this.randomValueForColor(placeType[i])); // else random from color
            }
        }

        return this.createStoredTokenFromValues(values, placeType); // create final stored token 
    }

    // check if a token matches place types
    tokenMatchesPlaceType(tokenValues, placeType) {
        if (placeType.length === 0) {
            return tokenValues.length === 0; // no type ==> empty token
        }

        return tokenValues.length === placeType.length; // token length === type length
    }

    // for parsing arc inscription and multiplicity
    parseArcInscriptionSpec(connection) {
        const rawText = String(connection?.businessObject?.arcInscription ?? '<x>').trim() || '<x>'; // raw input when changing inscription maually

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

        const superscriptMatch = text.match(/^(.*?)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/); // regex to check fo superscript for multiplicity
        if (superscriptMatch) {  // if match convert superscript to number and trim text
            text = superscriptMatch[1].trim();
            multiplicity = Number(
                superscriptMatch[2]
                    .split('')
                    .map(ch => superscriptMap[ch])
                    .join('')
            );
        }

        const exponentMatch = text.match(/^(.*?)\^(\d+)$/); // regex to check for "^somenum" for multiplicity
        if (exponentMatch) { // if "^somenum" match, parse number and trim text
            text = exponentMatch[1].trim();
            multiplicity = Number(exponentMatch[2]);
        }

        let inner = text;
        if (text.startsWith('<') && text.endsWith('>')) { // if text is in form <...>, extract inner part for parsing variables
            inner = text.slice(1, -1).trim();
        }

        const vars = inner === '' ? [] : inner.split(',').map(s => s.trim()).filter(Boolean); // split by comma for variables and trim

        return { // some parsed arc ins 
            text: `<${vars.join(',')}>`,
            vars,
            multiplicity: Math.max(1, multiplicity)
        };
    }

    // for getting placec type as array
    getPlaceType(place) {
        const rawTypes = place?.businessObject?.types || [];

        if (!Array.isArray(rawTypes) || rawTypes.length === 0) { // if no type ==> empty type
            return [];
        }
        const firstType = rawTypes[0];
        return Array.isArray(firstType) ? firstType : parseType(firstType);
    }

    // for getting the marking of a place
    getPlaceMarking(place) {
        if (!Array.isArray(place.businessObject.marking)) {
            place.businessObject.marking = []; // 
        }

        return place.businessObject.marking;
    }

    // sync token count in a place
    syncTokenCount(place) {
        const marking = this.getPlaceMarking(place);
        place.businessObject.tokens = marking.length; // updates stores token count
    }

    // convert token values into a consistant array of values
    normalizeTokenValues(token) {
        if (Array.isArray(token)) {
            return token;
        }

        if (token && typeof token === 'object' && 'value' in token) { // check for token in correct format
            const value = token.value;
            return Array.isArray(value) ? value : [value];
        }

        if (token === undefined || token === null) { // empty
            return [];
        }

        return [token]; // else wrap in []
    }

    // for creating stored token based on place type
    createStoredTokenFromValues(values, placeType) {
        if (placeType.length === 0) { // []
            return [];
        }

        if (placeType.length === 1) { // fx [5]
            return values[0];
        }

        return values; // fx [5,...]
    }

    // make a full copy of a value so changes do not affect the original.
    deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    // Check if two values are structually identical
    deepEqual(a, b) {
        return JSON.stringify(a) === JSON.stringify(b);
    }

    // function for random values - TODO: ADVANCE
    randomValueForColor(color) {
        if (color === 'int') { // 0, 2, 3, ... 9
            return Math.floor(Math.random() * 10);
        }

        if (color === 'real') { // 0.00, 0.01, ... 9.99
            return Number((Math.random() * 10).toFixed(2));
        }

        if (color === 'bool') { // true or false
            return Math.random() < 0.5;
        }

        if (color === 'string') { // "a", "b", "c" or "d"
            const values = ['a', 'b', 'c', 'd'];
            return values[Math.floor(Math.random() * values.length)];
        }

        return null;
    }
}
