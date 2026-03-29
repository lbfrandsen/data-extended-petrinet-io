import { showAlert, rules } from '../../services/DialogService.js';
import * as getters from '../../helpers/getters.js';
import * as arcUtils from '../../helpers/arc-utils.js';
import { evaluateGuardAst } from '../../helpers/GuardEngine.js';
import { isGuardEmptyError, parseGuardExpression } from '../../helpers/GuardParser.js';
import { showPrompt } from '../../services/DialogService.js';

export default class BaseSimulationService {

    static $inject = ["eventBus", "elementRegistry", "canvas", "mathService"];

    constructor(eventBus, elementRegistry, canvas, mathService) {
        this.eventBus = eventBus;
        this.elementRegistry = elementRegistry;
        this.canvas = canvas;
        this.mathService = mathService;
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
            const marking = this.deepClone(getters.getPlaceMarking(place)); // clone the marking with helpers
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
            snapshot.markings.set(place.id, this.deepClone(getters.getPlaceMarking(place))); // clone the marking for the place and save in snapshot
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

        getters.getTransitions(this.elementRegistry).forEach(transition => {
            if (this.buildTransitionFiringPlan(transition)) {
                this.enabledTransitions.add(transition.id);
            }
        });

        // Trigger re-render of all transitions
        this.refreshAllTransitions();
    }


    refreshAllTransitions() {
        getters.getTransitions(this.elementRegistry).forEach(transition => {
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
    async fireTransition(element) {
        if (!this.isActive || !this.isTransitionEnabled(element)) {
            return;
        }

        const plan = this.buildTransitionFiringPlan(element);
        if (!plan) {
            return;
        }

        // userinput
        if (rules.integerGeneration === 'defined') {
            const ok = await this._askUser(plan);
            if (!ok) return;
        }

        this.stepHistory.push(this.createSimulationSnapshot());

        const affectedPlaces = new Map();

        plan.consumption.forEach(step => {
            this.removeStoredTokens(step.place, step.tokens);
            affectedPlaces.set(step.place.id, step.place);
        });

        (plan.outgoingArc || []).forEach(connection => {
            const targetPlace = connection.target;

            if (!getters.isPetriPlace(targetPlace)) {
                return;
            }

            this.addProducedTokens(targetPlace, connection, plan.binding);
            affectedPlaces.set(targetPlace.id, targetPlace);
        });

        this.firedTransitions.add(element.id);

        affectedPlaces.forEach(place => {
            this.eventBus.fire('element.changed', { element: place });
        });

        this.updateEnabledTransitions();
    }

    // Prompts the user for unresolved output variables and keeps only values that can still satisfy the guard.
    async _askUser(plan) {
        for (const connection of (plan.outgoingArc || [])) {
            const arcIns = arcUtils.parseArcInscriptionSpec(connection);
            const vars = arcIns.vars || [];
            const placeType = getters.getPlaceType(connection.target);
            const transition = getters.getTransitionForConnection(connection);
            const guard = this.getTransitionGuardExpression(transition);

            for (let i = 0; i < vars.length; i++) {
                const varName = vars[i];

                if (!varName || plan.binding[varName] !== undefined) continue;

                const color = placeType[i];

                while (true) {
                    const input = await showPrompt({
                        title: 'User input',
                        message: `Enter value for ${varName}`,
                        validate: (val) => {
                            const parsed = this.parsePromptValueByColor(val, color);
                            if (parsed === undefined) {
                                return `Invalid ${color} value`;
                            }

                            if (!this._valid(parsed, varName, guard, color, plan.binding)) {
                                return 'Invalid input for guard';
                            }
                        }
                    });

                    if (input === null) return false;

                    const parsed = this.parsePromptValueByColor(input, color);
                    if (parsed === undefined) {
                        continue;
                    }

                    if (this._valid(parsed, varName, guard, color, plan.binding)) {
                        plan.binding[varName] = parsed;
                        break;
                    }
                }
            }
        }

        return true;
    }

    // Parses one prompt input according to the expected place color/type.
    parsePromptValueByColor(rawValue, color) {
        const text = String(rawValue ?? '').trim();

        if (color === 'int') {
            if (!/^[+-]?\d+$/.test(text)) {
                return undefined;
            }
            return Number(text);
        }

        if (color === 'real') {
            if (!/^[+-]?(?:\d+\.\d*|\d*\.\d+|\d+)$/.test(text)) {
                return undefined;
            }
            return Number(text);
        }

        if (color === 'bool') {
            if (/^true$/i.test(text)) {
                return true;
            }
            if (/^false$/i.test(text)) {
                return false;
            }
            return undefined;
        }

        if (color === 'string') {
            return text;
        }

        return rawValue;
    }

    // Performs type checks and a partial guard check for a candidate variable value.
    _valid(value, varName, guard, type, binding = {}) {
        // --- TYPE VALIDATION FIRST ---
        if (type === 'int') {
            if (!Number.isInteger(value)) return false;
        }

        if (type === 'real') {
            if (typeof value !== 'number' || isNaN(value)) return false;
        }

        if (type === 'bool') {
            if (typeof value !== 'boolean') return false;
        }

        if (type === 'string') {
            if (typeof value !== 'string') return false;

            // ONLY a-zA-Z
            if (!/^[a-zA-Z]+$/.test(value)) return false;
        }

        // --- GUARD VALIDATION ---
        const nextBinding = { ...binding };
        if (varName) {
            nextBinding[varName] = value;
        }

        const guardState = this.evaluateGuardExpression(guard, nextBinding, { partial: true });
        return guardState !== false;
    }

    // Storm & Joschka - building a firing plan for a transition
    buildTransitionFiringPlan(transition) {
        const incomingArcs = Array.isArray(transition.incoming) ? transition.incoming : [];
        const outgoingArcs = Array.isArray(transition.outgoing) ? transition.outgoing : [];
        const currentMarkings = new Map();

        for (const connection of incomingArcs) {
            const sourcePlace = connection?.source;

            if (!getters.isPetriPlace(sourcePlace)) {
                return null;
            }

            if (!currentMarkings.has(sourcePlace.id)) {
                currentMarkings.set(
                    sourcePlace.id,
                    this.deepClone(getters.getPlaceMarking(sourcePlace))
                );
            }
        }

        // to ensure guard satisfaction
        const guardExpression = this.getTransitionGuardExpression(transition);

        return this.findBindingForTransition(
            incomingArcs,
            0,
            currentMarkings,
            {},
            [],
            guardExpression,
            outgoingArcs
        );
    }

    // Find binding that satisfies guard
    findBindingForTransition(incomingArcs, arcIndex, currentMarkings, binding, consumption, guard, outgoingArcs
    ) {
        if (arcIndex >= incomingArcs.length) {
            const guardState = this.evaluateGuardExpression(guard, binding, { partial: true });
            if (guardState === false) {
                return null;
            }

            const solvedBinding = this.canProduceOutgoingBindings(outgoingArcs, binding, guard);
            if (!solvedBinding) {
                return null;
            }

            return {
                binding: solvedBinding,
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
        const placeType = getters.getPlaceType(sourcePlace);
        const arcInsRequirement = arcUtils.parseArcInscriptionSpec(connection);

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

    // Returns the transition guard expression.
    getTransitionGuardExpression(transition) {
        return String(transition?.businessObject?.guardExpression ?? '');
    }

    // Evaluates a guard expression against bindings. In partial mode, undefined means "not decided yet".
    evaluateGuardExpression(expression, binding = {}, options = {}) {
        try {
            const ast = parseGuardExpression(expression);
            return evaluateGuardAst(ast, binding, options);
        } catch (error) {
            if (isGuardEmptyError(error)) {
                return true;
            }
            return false;
        }
    }

    evaluateGuardValueExpression(raw, binding) {
        const expr = String(raw ?? '').trim();

        if (!expr) {
            return undefined;
        }

        const literal = this.parseGuardLiteral(expr);
        if (literal !== undefined) {
            return literal;
        }

        // only allow simple math / variable expressions
        if (!/^[A-Za-z_][A-Za-z0-9_\s+\-*/%().*]*$|^[\d\s+\-*/%().*A-Za-z_]+$/.test(expr)) {
            return undefined;
        }

        const identifiers = [...expr.matchAll(/\b[A-Za-z_][A-Za-z0-9_]*\b/g)]
            .map(match => match[0]);

        const reserved = new Set(['true', 'false']);
        const uniqueIdentifiers = [...new Set(identifiers)].filter(name => !reserved.has(name));

        for (const name of uniqueIdentifiers) {
            if (!Object.prototype.hasOwnProperty.call(binding, name)) {
                return undefined;
            }
        }

        try {
            const fn = new Function(
                ...uniqueIdentifiers,
                `return (${expr});`
            );

            return fn(...uniqueIdentifiers.map(name => binding[name]));
        } catch {
            return undefined;
        }
    }


    parseGuardLiteral(value) {
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
        const marking = getters.getPlaceMarking(place); // get marking

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
        const marking = getters.getPlaceMarking(place); // get marking
        const arcInsRequirement = arcUtils.parseArcInscriptionSpec(connection); // arcinsReq for connection

        const producedToken = this.buildProducedToken(place, connection, binding); // build once per firing

        for (let i = 0; i < arcInsRequirement.multiplicity; i++) { // for multiplicity of arc inscription
            marking.push(this.deepClone(producedToken)); // add identical token each time
        }


        this.syncTokenCount(place); // sync token count after
    }

    // building of tokens to be produced
    buildProducedToken(targetPlace, connection, binding) {
        const placeType = getters.getPlaceType(targetPlace); // get target place type
        const arcInsRequirement = arcUtils.parseArcInscriptionSpec(connection); // arcinsReq
        const values = [];
        const nextBinding = { ...binding };
        const transition = getters.getTransitionForConnection(connection);
        const guard = this.getTransitionGuardExpression(transition);

        for (let i = 0; i < placeType.length; i++) {
            const varName = arcInsRequirement.vars[i]; // get var name

            if (varName && Object.prototype.hasOwnProperty.call(nextBinding, varName)) { // if var already bound use value (for multiple arcs with same variable name)
                values.push(nextBinding[varName]);
                continue;
            }

            const producedValue = this.generateValueForVarWithGuard(varName, placeType[i], guard, nextBinding);

            values.push(producedValue);

            if (varName) {
                nextBinding[varName] = producedValue;
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

    // sync token count in a place
    syncTokenCount(place) {
        const marking = getters.getPlaceMarking(place);
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

    // Generates an unconstrained fallback value for a given color/type.
    randomValueForColor(color) {
        if (color === 'int') {
            const LIMIT = 2 ** 50;
            const min = -LIMIT;
            const max = LIMIT;
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        if (color === 'real') {
            const min = Number.MIN_SAFE_INTEGER;
            const max = Number.MAX_SAFE_INTEGER;
            const value = Math.random() * (max - min) + min;
            return Number(value.toFixed(3));
        }

        if (color === 'bool') {
            return Math.random() < 0.5;
        }

        if (color === 'string') {
            return this.getRandomString('', '', {});
        }

        return null;
    }

    generateValueForVarWithGuard(varName, color, guard, binding) {
        if (color === 'string') { // !guard / !varName in getRandomString()
            return this.getRandomString(varName, guard, binding);
        }

        // if (!varName || !guard) {
        //     return this.randomValueForColor(color);
        // }

        if (color === 'bool') {
            if (
                guard.includes(`${varName} = true`) ||
                guard.includes(`true = ${varName}`)) {
                return true;
            }

            if (
                guard.includes(`${varName} = false`) ||
                guard.includes(`false = ${varName}`)) {
                return false;
            }
        }

        const bounds = this.extractNumericBounds(varName, guard, color, binding);

        if (color === 'int') {
            const int_rule = rules.integerGeneration;
            const normal_distribution = rules.integerDistributionEnabled;

            const guardMin = Number.isFinite(bounds.min) ? Number(bounds.min) : Number.MIN_SAFE_INTEGER;
            const guardMax = Number.isFinite(bounds.max) ? Number(bounds.max) : Number.MAX_SAFE_INTEGER;

            const ruleMin = Number(rules.integerDomainMin);
            const ruleMax = Number(rules.integerDomainMax);

            const min = Math.max(ruleMin, guardMin);
            const max = Math.min(ruleMax, guardMax);

            if (int_rule === 'defined') {
                return null;
        } else {
            if (min > max) {
                showAlert({
                    title: 'Invalid Domain',
                    message: 'Please ensure that the domain is valid'
                });
                throw new Error('Invalid integer domain');
            } 
            if (normal_distribution) {
                const std = Number(rules.integerStd);
                const mean = Number(rules.integerMean);
                const value = Math.round(this.mathService.randomNormal(mean, std));

                if (value < min) return min;
                if (value > max) return max;
                return value;
            }
            return this.mathService.randomIntBetween(min, max);
        }
    }

        if (color === 'real') {
            const real_distribution = rules.realDistributionEnabled;

            const guardMin = Number.isFinite(bounds.min) ? Number(bounds.min) : Number.MIN_SAFE_INTEGER;
            const guardMax = Number.isFinite(bounds.max) ? Number(bounds.max) : Number.MAX_SAFE_INTEGER;

            const ruleMin = Number(rules.realDomainMin);
            const ruleMax = Number(rules.realDomainMax);
            const decimals = Number(rules.realDecimals ?? 2);

            const min = Math.max(ruleMin, guardMin);
            const max = Math.min(ruleMax, guardMax);

            if (min > max) {
                showAlert({
                    title: 'Invalid Domain',
                    message: 'Please ensure that the real domain is valid'
                });
                throw new Error('Invalid real domain');
            }

            if (real_distribution) {
                const std = Number(rules.realStd);
                const mean = Number(rules.realMean);
                const value = Number(this.mathService.randomNormal(mean, std).toFixed(decimals));

                if (value < min) return Number(min.toFixed(decimals));
                if (value > max) return Number(max.toFixed(decimals));
                return value;
        }

        return Number((Math.random() * (max - min) + min).toFixed(decimals));
        }

        return this.randomValueForColor(color);
    }

    // Derives numeric min/max bounds for one variable from simple comparison clauses.
    extractNumericBounds(varName, guard, color, binding = {}) {
        let min = Number.MIN_SAFE_INTEGER;
        let max = Number.MAX_SAFE_INTEGER;

        const clauses = this.splitGuardClauses(guard);

        for (const clause of clauses) {
            const match = clause.match(/^(.*?)\s*(>=|<=|>|<|=)\s*(.*?)$/);
            if (!match) continue;

            const [, leftRaw, op, rightRaw] = match;
            const leftExpr = leftRaw.trim();
            const rightExpr = rightRaw.trim();

            // case: x > ...
            if (leftExpr === varName) {
                const value = this.evaluateGuardValueExpression(rightExpr, binding);

                if (typeof value !== 'number') {
                    continue;
                }

                if (op === '>') min = Math.max(min, value + (color === 'int' ? 1 : 0));
                if (op === '>=') min = Math.max(min, value);
                if (op === '<') max = Math.min(max, value - (color === 'int' ? 1 : 0));
                if (op === '<=') max = Math.min(max, value);
                if (op === '=') {
                    min = value;
                    max = value;
                }

                continue;
            }

            // case: ... > x
            if (rightExpr === varName) {
                const value = this.evaluateGuardValueExpression(leftExpr, binding);

                if (typeof value !== 'number') {
                    continue;
                }

                if (op === '>') max = Math.min(max, value - (color === 'int' ? 1 : 0));
                if (op === '>=') max = Math.min(max, value);
                if (op === '<') min = Math.max(min, value + (color === 'int' ? 1 : 0));
                if (op === '<=') min = Math.max(min, value);
                if (op === '=') {
                    min = value;
                    max = value;
                }
            }
        }

        return { min, max };
    }

    // Splits a guard string on top-level && / || while respecting parentheses and string literals.
    splitGuardClauses(guard) {
        const text = String(guard ?? '').trim();
        if (!text) {
            return [];
        }

        const clauses = [];
        let current = '';
        let depth = 0;
        let quote = null;

        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const next = text[i + 1];

            if (quote) {
                current += char;

                if (char === '\\' && next !== undefined) {
                    current += next;
                    i += 1;
                    continue;
                }

                if (char === quote) {
                    quote = null;
                }

                continue;
            }

            if (char === '"' || char === "'") {
                quote = char;
                current += char;
                continue;
            }

            if (char === '(') {
                depth += 1;
                current += char;
                continue;
            }

            if (char === ')') {
                depth = Math.max(0, depth - 1);
                current += char;
                continue;
            }

            if (depth === 0 && ((char === '&' && next === '&') || (char === '|' && next === '|'))) {
                const trimmed = current.trim();
                if (trimmed) {
                    clauses.push(trimmed);
                }
                current = '';
                i += 1;
                continue;
            }

            current += char;
        }

        const tail = current.trim();
        if (tail) {
            clauses.push(tail);
        }

        return clauses;
    }

    parseStringRegexRule(regexText) {
        const raw = String(regexText ?? '').trim();

        if (!raw) {
            throw new Error('Missing string regex rule.');
        }

        const match = raw.match(/^\[([^\]]+)\](?:\{(\d+)(?:,(\d+))?\})?$/);

        if (!match) {
            throw new Error(`Unsupported string regex rule: ${raw}`);
        }

        const [, classBody, minRaw, maxRaw] = match;

        const expandCharClass = (body) => {
            let chars = '';
            let i = 0;

            while (i < body.length) {
                const start = body[i];
                const dash = body[i + 1];
                const end = body[i + 2];

                if (dash === '-' && end) {
                    const startCode = start.charCodeAt(0);
                    const endCode = end.charCodeAt(0);

                    if (startCode <= endCode) {
                        for (let code = startCode; code <= endCode; code++) {
                            chars += String.fromCharCode(code);
                        }
                        i += 3;
                        continue;
                    }
                }

                chars += start;
                i += 1;
            }

            return [...new Set(chars)].join('');
        };

        const chars = expandCharClass(classBody);

        if (!chars) {
            throw new Error(`Empty character class in string regex rule: ${raw}`);
        }

        let minLength = 1;
        let maxLength = 1;

        if (minRaw === undefined) {
            minLength = 1;
            maxLength = 1;
        } else if (maxRaw === undefined) {
            minLength = Number(minRaw);
            maxLength = Number(minRaw);
        } else {
            minLength = Number(minRaw);
            maxLength = Number(maxRaw);
        }

        if (!Number.isInteger(minLength) || !Number.isInteger(maxLength) || minLength < 0 || maxLength < minLength) {
            throw new Error(`Invalid string regex quantifier: ${raw}`);
        }

        return { chars, minLength, maxLength };
    }

    extractStringLengthBounds(varName, guard, binding = {}) {
        let min = -Infinity;
        let max = Infinity;

        if (!varName || !guard) {
            return { min, max };
        }

        const clauses = this.splitGuardClauses(guard);

        for (const clause of clauses) {
            const match = clause.match(/^(.*?)\s*(==|!=|>=|<=|=|>|<)\s*(.*?)$/);

            if (!match) {
                continue;
            }

            const [, leftRaw, op, rightRaw] = match;
            const leftExpr = leftRaw.trim();
            const rightExpr = rightRaw.trim();

            const leftLenMatch = leftExpr.match(/^(?:len|length)\((.*?)\)$/);
            const rightLenMatch = rightExpr.match(/^(?:len|length)\((.*?)\)$/);

            if (leftLenMatch && leftLenMatch[1].trim() === varName) {
                const value = this.evaluateGuardValueExpression(rightExpr, binding);

                if (!Number.isFinite(value)) {
                    continue;
                }

                if (op === '>') min = Math.max(min, Math.floor(value) + 1);
                if (op === '>=') min = Math.max(min, Math.ceil(value));
                if (op === '<') max = Math.min(max, Math.ceil(value) - 1);
                if (op === '<=') max = Math.min(max, Math.floor(value));
                if (op === '=' || op === '==') {
                    min = Math.max(min, Math.ceil(value));
                    max = Math.min(max, Math.floor(value));
                }

                continue;
            }

            if (rightLenMatch && rightLenMatch[1].trim() === varName) {
                const value = this.evaluateGuardValueExpression(leftExpr, binding);

                if (!Number.isFinite(value)) {
                    continue;
                }

                if (op === '>') max = Math.min(max, Math.ceil(value) - 1);
                if (op === '>=') max = Math.min(max, Math.floor(value));
                if (op === '<') min = Math.max(min, Math.floor(value) + 1);
                if (op === '<=') min = Math.max(min, Math.ceil(value));
                if (op === '=' || op === '==') {
                    min = Math.max(min, Math.ceil(value));
                    max = Math.min(max, Math.floor(value));
                }
            }
        }

        return { min, max };
    }

    getRandomString(varName, guard, binding = {}) {
        const { chars, minLength: regexMin, maxLength: regexMax } = this.parseStringRegexRule(rules.stringRegex);

        const makeRandomString = (length) => {
            let result = '';

            for (let i = 0; i < length; i++) {
                result += chars[Math.floor(Math.random() * chars.length)];
            }

            return result;
        };

        const randomInt = (min, max) => {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        };

        let equalsValue = null;
        const forbiddenValues = new Set();

        if (varName && guard) {
            const clauses = this.splitGuardClauses(guard);

            for (const clause of clauses) {
                const match = clause.match(/^(.*?)\s*(==|!=|>=|<=|=|>|<)\s*(.*?)$/);

                if (!match) {
                    continue;
                }

                const [, leftRaw, op, rightRaw] = match;
                const leftExpr = leftRaw.trim();
                const rightExpr = rightRaw.trim();

                if (leftExpr === varName || rightExpr === varName) {
                    const otherExpr = leftExpr === varName ? rightExpr : leftExpr;
                    const resolved = this.evaluateGuardValueExpression(otherExpr, binding);

                    if (typeof resolved === 'string') {
                        if (op === '=' || op === '==') {
                            equalsValue = resolved;
                        }

                        if (op === '!=') {
                            forbiddenValues.add(resolved);
                        }
                    }
                }
            }
        }

        if (equalsValue !== null) {
            if (!this.stringMatchesRegexRule(equalsValue, rules.stringRegex)) {
                throw new Error(
                    `Guard value "${equalsValue}" does not match string regex ${rules.stringRegex}.`
                );
            }

            const guardBounds = this.extractStringLengthBounds(varName, guard, binding);
            const valueLength = equalsValue.length;

            if (valueLength < guardBounds.min || valueLength > guardBounds.max) {
                throw new Error(
                    `Guard value "${equalsValue}" violates guard length constraints for ${varName}.`
                );
            }

            return equalsValue;
        }

        const guardBounds = this.extractStringLengthBounds(varName, guard, binding);
        const minLength = Math.max(regexMin, guardBounds.min);
        const maxLength = Math.min(regexMax, guardBounds.max);

        if (minLength > maxLength) {
            throw new Error(`String regex and guard length conflict for ${varName}.`);
        }

        for (let i = 0; i < 200; i++) {
            const value = makeRandomString(randomInt(minLength, maxLength));

            if (!forbiddenValues.has(value)) {
                return value;
            }
        }

        throw new Error(`Could not generate valid string for ${varName}.`);
    }

    stringMatchesRegexRule(value, regexText) {
        const pattern = String(regexText ?? '').trim();

        if (!pattern) {
            throw new Error('Missing string regex rule.');
        }

        const regex = new RegExp(`^${pattern}$`);
        return regex.test(String(value));
    }

    // Validates that a produced value matches the expected place color/type constraints.
    isValueOfColor(value, color) {
        if (color === 'int') {
            return Number.isInteger(value);
        }

        if (color === 'real') {
            return typeof value === 'number' && Number.isFinite(value);
        }

        if (color === 'bool') {
            return typeof value === 'boolean';
        }

        if (color === 'string') {
            return typeof value === 'string' && this.stringMatchesRegexRule(value, rules.stringRegex);
        }

        return true;
    }

    // Collects output variable types from outgoing arcs and rejects conflicting type reuse.
    collectOutputVariableTypes(outgoingArcs) {
        const outputVarTypes = new Map();

        for (const connection of (outgoingArcs || [])) {
            const targetPlace = connection?.target;

            if (!targetPlace || targetPlace.type !== 'petri:place') {
                return null;
            }

            const placeType = getters.getPlaceType(targetPlace);
            const arcInsRequirement = arcUtils.parseArcInscriptionSpec(connection);
            const vars = arcInsRequirement.vars || [];

            for (let i = 0; i < placeType.length; i++) {
                const varName = vars[i];
                if (!varName) {
                    continue;
                }

                const type = placeType[i];
                if (!outputVarTypes.has(varName)) {
                    outputVarTypes.set(varName, type);
                    continue;
                }

                if (outputVarTypes.get(varName) !== type) {
                    return null;
                }
            }
        }

        return outputVarTypes;
    }

    // Removes redundant outer parentheses around one clause side before matching variable names.
    normalizeClauseSide(expr) {
        let value = String(expr ?? '').trim();
        if (!value) {
            return value;
        }

        const isWrapped = (text) => {
            if (!text.startsWith('(') || !text.endsWith(')')) {
                return false;
            }

            let depth = 0;
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '(') depth += 1;
                if (char === ')') depth -= 1;

                if (depth === 0 && i < text.length - 1) {
                    return false;
                }
            }

            return depth === 0;
        };

        while (isWrapped(value)) {
            value = value.slice(1, -1).trim();
        }

        return value;
    }

    // Extracts concrete literals from direct comparisons involving one variable to seed candidate generation.
    extractLiteralHintsForVar(varName, guard, binding = {}) {
        const numeric = [];
        const strings = [];
        const bools = [];
        const clauses = this.splitGuardClauses(guard);

        for (const clause of clauses) {
            const match = clause.match(/^(.*?)\s*(==|!=|>=|<=|=|>|<)\s*(.*?)$/);
            if (!match) {
                continue;
            }

            const [, leftRaw, op, rightRaw] = match;
            const leftExpr = this.normalizeClauseSide(leftRaw);
            const rightExpr = this.normalizeClauseSide(rightRaw);

            if (leftExpr !== varName && rightExpr !== varName) {
                continue;
            }

            const otherExpr = leftExpr === varName ? rightExpr : leftExpr;
            const resolved = this.evaluateGuardValueExpression(otherExpr, binding);

            if (typeof resolved === 'number' && Number.isFinite(resolved)) {
                numeric.push(resolved);
            }

            if (typeof resolved === 'string' && (op === '=' || op === '==')) {
                strings.push(resolved);
            }

            if (typeof resolved === 'boolean' && (op === '=' || op === '==')) {
                bools.push(resolved);
            }
        }

        return { numeric, strings, bools };
    }

    // Builds candidate values for an unresolved output variable using hints, domains, and random samples.
    generateCandidatesForVar(varName, color, guard, binding) {
        const values = [];
        const seen = new Set();
        const add = (value) => {
            const key = JSON.stringify(value);
            if (!seen.has(key)) {
                seen.add(key);
                values.push(value);
            }
        };

        const { numeric, strings, bools } = this.extractLiteralHintsForVar(varName, guard, binding);

        if (color === 'bool') {
            for (const hinted of bools) {
                add(hinted);
            }
            add(true);
            add(false);
            return values;
        }

        if (color === 'int') {
            for (const hinted of numeric) {
                add(Math.round(hinted));
            }

            const minRule = Number.isFinite(Number(rules.integerDomainMin)) ? Number(rules.integerDomainMin) : -1000;
            const maxRule = Number.isFinite(Number(rules.integerDomainMax)) ? Number(rules.integerDomainMax) : 1000;
            const min = Math.min(minRule, maxRule);
            const max = Math.max(minRule, maxRule);

            add(min);
            add(max);
            add(0);

            for (let i = 0; i < 24; i++) {
                add(this.mathService.randomIntBetween(min, max));
            }

            return values;
        }

        if (color === 'real') {
            for (const hinted of numeric) {
                add(Number(hinted));
            }

            const minRule = Number.isFinite(Number(rules.realDomainMin)) ? Number(rules.realDomainMin) : -1000;
            const maxRule = Number.isFinite(Number(rules.realDomainMax)) ? Number(rules.realDomainMax) : 1000;
            const min = Math.min(minRule, maxRule);
            const max = Math.max(minRule, maxRule);
            const decimals = Number(rules.realDecimals ?? 2);

            add(Number(min.toFixed(decimals)));
            add(Number(max.toFixed(decimals)));
            add(0);

            for (let i = 0; i < 24; i++) {
                add(Number((Math.random() * (max - min) + min).toFixed(decimals)));
            }

            return values;
        }

        if (color === 'string') {
            for (const hinted of strings) {
                add(hinted);
            }

            for (let i = 0; i < 30; i++) {
                try {
                    add(this.getRandomString(varName, '', binding));
                } catch {
                    break;
                }
            }

            return values;
        }

        add(this.randomValueForColor(color));
        return values;
    }

    // Backtracks through unresolved output variables to find an assignment that satisfies the full guard.
    tryResolveOutputBinding(unresolved, index, currentBinding, guard) {
        if (index >= unresolved.length) {
            return this.evaluateGuardExpression(guard, currentBinding) ? currentBinding : null;
        }

        const [varName, color] = unresolved[index];
        const candidates = this.generateCandidatesForVar(varName, color, guard, currentBinding);

        for (const candidate of candidates) {
            if (!this.isValueOfColor(candidate, color)) {
                continue;
            }

            const nextBinding = {
                ...currentBinding,
                [varName]: candidate
            };

            const guardState = this.evaluateGuardExpression(guard, nextBinding, { partial: true });
            if (guardState === false) {
                continue;
            }

            const resolved = this.tryResolveOutputBinding(unresolved, index + 1, nextBinding, guard);
            if (resolved) {
                return resolved;
            }
        }

        return null;
    }

    // Returns a solved binding for output variables when possible, otherwise null.
    canProduceOutgoingBindings(outgoingArcs, binding, guard) {
        const outputVarTypes = this.collectOutputVariableTypes(outgoingArcs);
        if (!outputVarTypes) {
            return null;
        }

        const nextBinding = { ...binding };
        for (const [varName, color] of outputVarTypes.entries()) {
            if (!Object.prototype.hasOwnProperty.call(nextBinding, varName)) {
                continue;
            }

            if (!this.isValueOfColor(nextBinding[varName], color)) {
                return null;
            }
        }

        const unresolved = [...outputVarTypes.entries()].filter(
            ([varName]) => !Object.prototype.hasOwnProperty.call(nextBinding, varName)
        );

        let resolvedBinding;

        if (unresolved.length === 0) {
            resolvedBinding = this.evaluateGuardExpression(guard, nextBinding) ? nextBinding : null;
        } else {
            resolvedBinding = this.tryResolveOutputBinding(unresolved, 0, nextBinding, guard);
        }

        if (!resolvedBinding) {
            return null;
        }

        if (rules.integerGeneration === 'defined') {
            return { ...binding };
        }

        return resolvedBinding;
    }
}
