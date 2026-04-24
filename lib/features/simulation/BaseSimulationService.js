import {
    showAlert,
    rules,
    showMultiPrompt,
    showDynamicMultiPrompt,
    showQueryRowAndConsumptionDialog,
    getConsumptionMode,
    getProductionMode
} from '../../services/DialogService.js';
import * as getters from '../../helpers/getters.js';
import * as arcUtils from '../../helpers/arc-utils.js';
import { evaluateGuardAst, evaluateGuardAstValue } from '../../helpers/GuardEngine.js';
import { parseGuardExpression } from '../../helpers/GuardParser.js';
import * as tokenValidationUtils from '../../helpers/tokenValidationUtils.js';
import { parseValueByColor, typedValueMatchesColor } from '../../helpers/valueColorUtils.js';



export default class BaseSimulationService {

    static $inject = ["eventBus", "elementRegistry", "canvas", "mathService", "databaseService", "sqlDialogService"];

    constructor(eventBus, elementRegistry, canvas, mathService, databaseService, sqlDialogService) {
        this.eventBus = eventBus;
        this.elementRegistry = elementRegistry;
        this.canvas = canvas;
        this.mathService = mathService;
        this.databaseService = databaseService;
        this.sqlDialogService = sqlDialogService;
        this.isActive = false;
        this.initialTokenState = new Map();
        this.enabledTransitions = new Set();
        this.firedTransitions = new Set();
        this.stepHistory = [];
        this.queryGuardDiagnostics = new Map();

        // Query-enabled transition state depends on DB load + query text + bindings.
        // Recompute enablement/diagnostics when those external sources change.
        this.eventBus.on('database.changed', () => this.updateEnabledTransitions());
        this.eventBus.on('sqlDialog.queries.changed', () => this.updateEnabledTransitions());
        this.eventBus.on('sqlDialog.bindings.changed', () => this.updateEnabledTransitions());
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

    resetRuntimeState() {
        this.isActive = false;
        this.initialTokenState = new Map();
        this.enabledTransitions.clear();
        this.firedTransitions.clear();
        this.stepHistory = [];
        this.queryGuardDiagnostics.clear();
        this.eventBus.fire('simulation.mode.changed', { active: this.isActive });
        this.updateEnabledTransitions();
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

    // Serialize simulation internals so PNML export/import can preserve step-back history.
    exportSimulationState() {
        return {
            isActive: this.isActive,
            initialTokenState: Array.from(this.initialTokenState.entries()),
            firedTransitions: Array.from(this.firedTransitions),
            stepHistory: this.stepHistory.map(snapshot => ({
                markings: Array.from((snapshot?.markings || new Map()).entries()),
                firedTransitions: Array.isArray(snapshot?.firedTransitions) ? snapshot.firedTransitions : []
            }))
        };
    }

    // Restore simulation internals from serialized graph data.
    importSimulationState(state) {
        if (!state || typeof state !== 'object') {
            return;
        }

        this.isActive = false;
        this.initialTokenState = new Map(Array.isArray(state.initialTokenState) ? state.initialTokenState : []);
        this.firedTransitions = new Set(Array.isArray(state.firedTransitions) ? state.firedTransitions : []);
        this.stepHistory = Array.isArray(state.stepHistory)
            ? state.stepHistory.map(snapshot => ({
                markings: new Map(Array.isArray(snapshot?.markings) ? snapshot.markings : []),
                firedTransitions: Array.isArray(snapshot?.firedTransitions) ? snapshot.firedTransitions : []
            }))
            : [];

        // Start imported models from the pre-first-firing baseline so initial enablement is correct.
        if (this.initialTokenState.size > 0) {
            const places = this.elementRegistry.getAll().filter(el => el.type === 'petri:place');
            places.forEach(place => {
                if (!this.initialTokenState.has(place.id)) return;
                place.businessObject.marking = this.deepClone(this.initialTokenState.get(place.id) || []);
                this.syncTokenCount(place);
                this.eventBus.fire('element.changed', { element: place });
            });
            this.firedTransitions.clear();
        }

        this.eventBus.fire('simulation.mode.changed', { active: this.isActive });
        this.updateEnabledTransitions();
    }

    rebaseInitialStateToCurrentMarking() {
        this.initialTokenState.clear();
        this.saveInitialTokenState();
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
            const diagnostic = this.queryGuardDiagnostics.get(element?.id);
            if (diagnostic && diagnostic.status !== 'ok' && diagnostic.status !== 'none') {
                await showAlert({
                    title: 'Transition Disabled',
                    message: diagnostic.message
                });
            }
            return;
        }

        let plan;

        if (this.usesUserSelectedConsumption() || this.usesUserDefinedProduction()) {
            plan = await this._resolveUserDrivenPlan(element);
        } else {
            // Auto mode: pick a random fireable row when a query is attached.
            const queryResult = this.getQueryRowsForTransition(element);
            if (queryResult === null) return;

            if (queryResult.mode === 'rows') {
                const fireable = this.getFireableRows(element, queryResult.rows, queryResult.baseBinding);
                if (fireable.length === 0) return;
                const picked = fireable[Math.floor(Math.random() * fireable.length)];
                plan = this._buildFiringPlanWithRowBinding(element, picked.rowBinding);
            } else {
                plan = this._buildFiringPlanWithRowBinding(element, { ...queryResult.baseBinding });
            }
        }

        if (!plan) {
            return;
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

    usesUserSelectedConsumption() {
        return getConsumptionMode(rules) === 'user';
    }

    usesUserDefinedProduction() {
        return getProductionMode(rules) === 'user';
    }

    async _resolveUserDrivenPlan(transition) {
        // Check if a query is attached and get its rows.
        const queryResult = this.getQueryRowsForTransition(transition);
        if (queryResult === null) return null;

        if (queryResult.mode === 'rows') {
            // Filter rows to those that are actually fireable given current tokens.
            const fireableRows = this.getFireableRows(transition, queryResult.rows, queryResult.baseBinding);
            if (fireableRows.length === 0) return null;

            // Show combined row-picker + consumption dialog.
            const result = await showQueryRowAndConsumptionDialog({
                transition,
                fireableRows,
                usesUserSelectedConsumption: this.usesUserSelectedConsumption(),
                getPlansForRow: (rowBinding) => this.buildAllTransitionFiringPlans(
                    transition,
                    { ...queryResult.baseBinding, ...rowBinding }
                ),
                formatValue: (v) => this._formatPromptValue(v)
            });

            if (result === null) return null;

            const { rowBinding, consumptionBinding } = result;
            const mergedBinding = {
                ...queryResult.baseBinding,
                ...rowBinding,
                ...consumptionBinding
            };

            return this.usesUserDefinedProduction()
                ? this._askUserForProduction(transition, mergedBinding)
                : this.buildTransitionFiringPlanWithBinding(transition, mergedBinding);
        }

        // No row-based query attached: existing flow, optionally seeded by queryCount.
        const baseBinding = { ...queryResult.baseBinding };
        const candidatePlans = this.usesUserSelectedConsumption()
            ? this.buildAllTransitionFiringPlans(transition, baseBinding)
            : null;

        if (candidatePlans && candidatePlans.length === 0) {
            return null;
        }

        const binding = candidatePlans
            ? await this._askUserForConsumption(transition, candidatePlans)
            : baseBinding;

        if (binding === null) {
            return null;
        }

        return this.usesUserDefinedProduction()
            ? this._askUserForProduction(transition, binding)
            : this.buildTransitionFiringPlanWithBinding(transition, binding);
    }

    async _askUserForConsumption(transition, candidatePlans) {
        const prompts = (Array.isArray(transition?.incoming) ? transition.incoming : []).flatMap((connection, index) => {
            const sourcePlace = connection?.source;

            if (!getters.isPetriPlace(sourcePlace)) {
                return [];
            }

            const allOptions = candidatePlans.flatMap(plan => {
                const step = plan?.consumption?.[index];
                const value = JSON.stringify(step?.tokens);

                if (!step || step.place?.id !== sourcePlace.id) {
                    return [];
                }

                return [{
                    value,
                    label: step.tokens.map(token => this._formatPromptValue(token)).join(' + ')
                }];
            });

            const uniqueOptions = [];
            const seen = new Set();
            allOptions.forEach(option => {
                if (!seen.has(option.value)) {
                    seen.add(option.value);
                    uniqueOptions.push(option);
                }
            });

            return uniqueOptions.length === 0 ? [] : [{
                key: `incoming-${index}`,
                label: `${String(sourcePlace?.businessObject?.name || sourcePlace.id)} ${arcUtils.parseArcInscriptionSpec(connection).text || '<>'}`,
                options: uniqueOptions
            }];
        });

        if (prompts.length === 0) {
            return {};
        }

        const input = await showDynamicMultiPrompt({
            title: 'User selected consumption',
            message: 'Select which tokens should be consumed on each incoming arc.',
            fields: prompts.map(prompt => ({
                key: prompt.key,
                label: prompt.label,
                options: prompt.options,
                placeholder: 'Select binding'
            })),

            onChange: currentValues => {
                const selectedBindings = {};
                for (const [key, selectedValue] of Object.entries(currentValues)) {
                    if (selectedValue && selectedValue !== '') {
                        selectedBindings[key] = JSON.parse(selectedValue);
                    }
                }

                const filteredPlans = candidatePlans.filter(plan => {
                    return Object.entries(selectedBindings).every(([key, selectedTokens]) => {
                        const arcIndex = Number(key.replace('incoming-', ''));
                        const step = plan?.consumption?.[arcIndex];
                        return step && JSON.stringify(step.tokens) === JSON.stringify(selectedTokens);
                    });
                });

                const updatedOptions = {};
                prompts.forEach(prompt => {
                    const optionSet = new Set();
                    const options = [];

                    filteredPlans.forEach(plan => {
                        const step = plan?.consumption?.[Number(prompt.key.replace('incoming-', ''))];
                        if (!step) {
                            return;
                        }

                        const value = JSON.stringify(step.tokens);
                        if (!optionSet.has(value)) {
                            optionSet.add(value);
                            options.push({ value, label: step.tokens.map(token => this._formatPromptValue(token)).join(' + ') });
                        }
                    });

                    updatedOptions[prompt.key] = options;
                });

                return updatedOptions;
            },
            validate: values => {
                const selectedPlan = this._findCandidatePlanForSelection(candidatePlans, prompts, values);
                if (!selectedPlan) {
                    return 'Selected tokens do not match any consumable input binding or guard.';
                }
            }
        });

        if (input === null) {
            return null;
        }

        const selectedPlan = this._findCandidatePlanForSelection(candidatePlans, prompts, input);

        return selectedPlan ? { ...selectedPlan.binding } : null;
    }

    async _askUserForProduction(transition, initialBinding = {}) {
        const candidatePlans = this.buildAllTransitionFiringPlans(transition, initialBinding);

        if (candidatePlans.length === 0) {
            return null;
        }

        const prompts = [];
        const inscriptionLines = [];
        const seenVars = new Set();
        const seenInscriptions = new Set();

        for (const connection of (candidatePlans[0].outgoingArc || [])) {
            const targetPlace = connection?.target;

            if (!getters.isPetriPlace(targetPlace)) {
                continue;
            }

            const arcIns = arcUtils.parseArcInscriptionSpec(connection);
            const vars = arcIns.vars || [];
            const placeType = getters.getPlaceType(targetPlace);
            const inscriptionLine = `${arcIns.text || `<${vars.join(',')}>`}: ${placeType.join(',')}`;

            if (!seenInscriptions.has(inscriptionLine)) {
                seenInscriptions.add(inscriptionLine);
                inscriptionLines.push(inscriptionLine);
            }

            for (let i = 0; i < vars.length; i++) {
                const varName = vars[i];

                if (!varName || seenVars.has(varName) || Object.prototype.hasOwnProperty.call(initialBinding, varName)) {
                    continue;
                }

                seenVars.add(varName);

                const options = [];
                const optionSet = new Set();

                for (const plan of candidatePlans) {
                    if (!Object.prototype.hasOwnProperty.call(plan?.binding || {}, varName)) {
                        continue;
                    }

                    const value = plan.binding[varName];
                    const formatted = this._formatPromptValue(value);
                    const key = JSON.stringify(value); // Use JSON to handle complex values

                    if (!optionSet.has(key)) {
                        optionSet.add(key);
                        options.push({ value: key, label: formatted });
                    }
                }

                prompts.push({
                    varName,
                    color: placeType[i],
                    options
                });
            }
        }

        if (prompts.length === 0) {
            return this.buildTransitionFiringPlanWithBinding(transition, initialBinding);
        }

        const messageLines = ['Select values to produce for the outgoing arc variables.'];

        if (Object.keys(initialBinding).length > 0) {
            messageLines.push(`Existing binding: ${Object.entries(initialBinding)
                .map(([key, value]) => `${key}=${this._formatPromptValue(value)}`)
                .join(', ')}`);
        }

        if (inscriptionLines.length > 0) {
            messageLines.push('', 'Arc inscriptions:', ...inscriptionLines);
        }

        messageLines.push('', 'Variables:', ...prompts.map(prompt => `${prompt.varName}: ${prompt.color}`));

        const input = await showDynamicMultiPrompt({
            title: 'Select Binding',
            message: messageLines.join('\n'),
            fields: prompts.map(prompt => ({
                key: prompt.varName,
                label: `Select value for ${prompt.varName}:`,
                options: prompt.options
            })),
            onChange: (currentValues) => {
                // Parse current selections, ignore empty
                const selectedBindings = {};
                for (const [key, jsonValue] of Object.entries(currentValues)) {
                    if (jsonValue && jsonValue !== '') {
                        try {
                            selectedBindings[key] = JSON.parse(jsonValue);
                        } catch (e) {
                            // Ignore invalid
                        }
                    }
                }

                // Filter candidate plans that match the selected bindings
                const filteredPlans = candidatePlans.filter(plan => {
                    for (const [varName, selectedValue] of Object.entries(selectedBindings)) {
                        if (plan.binding[varName] !== selectedValue) {
                            return false;
                        }
                    }
                    return true;
                });

                // For each variable, collect possible values from filtered plans
                const updatedOptions = {};
                for (const prompt of prompts) {
                    const varName = prompt.varName;
                    const optionSet = new Set();
                    const options = [];

                    for (const plan of filteredPlans) {
                        if (Object.prototype.hasOwnProperty.call(plan.binding, varName)) {
                            const value = plan.binding[varName];
                            const key = JSON.stringify(value);
                            if (!optionSet.has(key)) {
                                optionSet.add(key);
                                options.push({ value: key, label: this._formatPromptValue(value) });
                            }
                        }
                    }

                    updatedOptions[varName] = options;
                }

                return updatedOptions;
            },
            validate: values => {
                const parsedValues = {};
                for (const [key, jsonValue] of Object.entries(values)) {
                    if (jsonValue && jsonValue !== '') {
                        try {
                            parsedValues[key] = JSON.parse(jsonValue);
                        } catch (e) {
                            return `${key}: Invalid value`;
                        }
                    } else {
                        return `${key}: Please select a value`;
                    }
                }
                const combinedBinding = {
                    ...initialBinding,
                    ...parsedValues
                };

                for (const prompt of prompts) {
                    const selectedValue = parsedValues[prompt.varName];
                    if (selectedValue === undefined) continue;
                    const check = tokenValidationUtils.validateValuesAgainstType([prompt.color], [this._formatPromptValue(selectedValue)]);

                    if (!check.ok) {
                        return `${prompt.varName}: ${check.error}`;
                    }
                }

                if (!this.buildTransitionFiringPlanWithBinding(transition, combinedBinding)) {
                    return 'Selected values do not match any valid binding.';
                }
            }
        });

        if (input === null) return null;

        const parsedValues = {};
        for (const prompt of prompts) {
            const jsonValue = input[prompt.varName];
            if (jsonValue) {
                try {
                    parsedValues[prompt.varName] = JSON.parse(jsonValue);
                } catch (e) {
                    // Should not happen due to validation
                }
            }
        }

        return this.buildTransitionFiringPlanWithBinding(transition, {
            ...initialBinding,
            ...parsedValues
        });
    }

    _findCandidatePlanForSelection(candidatePlans, prompts, selectedValues) {
        return candidatePlans.find(plan => prompts.every(prompt => {
            const arcIndex = Number(prompt.key.replace('incoming-', ''));
            const step = plan?.consumption?.[arcIndex];

            if (!step) {
                return false;
            }

            return JSON.stringify(step.tokens) === selectedValues[prompt.key];
        })) || null;
    }

    _formatPromptValue(value) {
        if (value === undefined || value === null) {
            return String(value);
        }

        if (!Array.isArray(value) && typeof value === 'object') {
            return this._formatPromptValue(this.normalizeTokenValues(value));
        }

        if (typeof value === 'string') {
            return `"${value}"`;
        }

        if (Array.isArray(value)) {
            return `<${value.map(item => this._formatPromptValue(item)).join(', ')}>`;
        }

        return String(value);
    }

    // Performs type checks and a partial guard check for a candidate variable value.
    // "partial" means we allow missing bindings while constructing a candidate binding.
    // We only reject when the current partial assignment already makes the guard false.
    _valid(value, varName, guard, type, binding = {}) {
        if (!typedValueMatchesColor(type, value)) {
            return false;
        }

        if (type === 'string') {
            if (!this.stringMatchesRegexRule(value, rules.stringRegex)) {
                return false;
            }
        }

        const nextBinding = { ...binding };
        if (varName) {
            nextBinding[varName] = value;
        }

        const guardState = this.evaluateGuardExpression(guard, nextBinding, { partial: true });
        return guardState !== false;
    }

    // Storm & Joschka - building a firing plan for a transition.
    // Tries all fireable query rows (or empty binding when no query attached).
    buildTransitionFiringPlan(transition) {
        const queryResult = this.getQueryRowsForTransition(transition);
        if (queryResult === null) return null;

        if (queryResult.mode !== 'rows') {
            return this._buildFiringPlanWithRowBinding(transition, { ...queryResult.baseBinding });
        }

        for (const row of queryResult.rows) {
            const plan = this._buildFiringPlanWithRowBinding(transition, {
                ...queryResult.baseBinding,
                ...this._buildRowBinding(row)
            });
            if (plan) return plan;
        }

        return null;
    }

    // Builds a firing plan seeded with an already-chosen row binding plus any additional binding
    // supplied by the caller (e.g. user-selected consumption tokens).
    buildTransitionFiringPlanWithBinding(transition, initialBinding = {}) {
        const incomingArcs = Array.isArray(transition.incoming) ? transition.incoming : [];
        const outgoingArcs = Array.isArray(transition.outgoing) ? transition.outgoing : [];
        const currentMarkings = new Map();

        for (const connection of incomingArcs) {
            const sourcePlace = connection?.source;
            if (!getters.isPetriPlace(sourcePlace)) return null;
            if (!currentMarkings.has(sourcePlace.id)) {
                currentMarkings.set(sourcePlace.id, this.deepClone(getters.getPlaceMarking(sourcePlace)));
            }
        }

        return this.findBindingForTransition(
            incomingArcs, 0, currentMarkings, { ...initialBinding }, [],
            this.getTransitionGuardExpression(transition), outgoingArcs
        );
    }

    // Returns all firing plans for a specific row binding (used by the user-consumption dialog).
    buildAllTransitionFiringPlans(transition, rowBinding = {}) {
        const incomingArcs = Array.isArray(transition.incoming) ? transition.incoming : [];
        const outgoingArcs = Array.isArray(transition.outgoing) ? transition.outgoing : [];
        const currentMarkings = new Map();

        for (const connection of incomingArcs) {
            const sourcePlace = connection?.source;
            if (!getters.isPetriPlace(sourcePlace)) return [];
            if (!currentMarkings.has(sourcePlace.id)) {
                currentMarkings.set(sourcePlace.id, this.deepClone(getters.getPlaceMarking(sourcePlace)));
            }
        }

        return this.findAllBindingsForTransition(
            incomingArcs, 0, currentMarkings, { ...rowBinding }, [],
            this.getTransitionGuardExpression(transition), outgoingArcs
        );
    }

    // Returns one of:
    // { mode: 'none', rows: null, baseBinding: {} }
    // { mode: 'count', rows: null, baseBinding: { queryCount: number } }
    // { mode: 'rows', rows: [...], baseBinding: {} }
    // or null on error (transition blocked).
    getQueryRowsForTransition(transition) {
        const queryId = transition?.businessObject?.queryGuardId
            || this.sqlDialogService?.getBoundQueryIdForTransition?.(transition);

        if (!queryId) {
            this._setQueryGuardDiagnostic(transition, {
                status: 'none',
                message: 'No SQL query attached to this transition.'
            });
            return { mode: 'none', rows: null, baseBinding: {} };
        }

        if (!this.databaseService?.getDbName?.()) {
            this._setQueryGuardDiagnostic(transition, {
                status: 'error',
                message: `Query ${queryId} is attached, but no database is loaded.`
            });
            return null;
        }

        const queryEntry = this.sqlDialogService?.getQueryEntryById?.(queryId);
        const queryText = String(queryEntry?.text ?? '').trim();

        if (!queryText) {
            this._setQueryGuardDiagnostic(transition, {
                status: 'error',
                message: `Query ${queryId} is attached, but its SQL text is empty.`
            });
            return null;
        }

        const queryResult = this.databaseService.queryWithStatus(queryText);

        if (!queryResult.ok) {
            this._setQueryGuardDiagnostic(transition, {
                status: 'error',
                message: `Query ${queryId} failed: ${queryResult.error}`
            });
            return null;
        }

        if (this._looksLikeCountSelectQuery(queryText)) {
            const queryCount = this._extractSingleNumericQueryValue(queryResult.rows);

            if (queryCount === null) {
                this._setQueryGuardDiagnostic(transition, {
                    status: 'error',
                    message: `Query ${queryId} looks like COUNT(...), but did not return exactly one numeric value.`
                });
                return null;
            }

            this._setQueryGuardDiagnostic(transition, {
                status: 'ok',
                message: `Query ${queryId} returned queryCount=${queryCount}.`
            });

            return {
                mode: 'count',
                rows: null,
                baseBinding: { queryCount }
            };
        }

        this._setQueryGuardDiagnostic(transition, {
            status: 'ok',
            message: `Query ${queryId} returned ${queryResult.rows.length} row(s).`
        });

        return {
            mode: 'rows',
            rows: queryResult.rows,
            baseBinding: {}
        };
    }

    _looksLikeCountSelectQuery(queryText) {
        return /^\s*select\s+count\s*\(/i.test(String(queryText ?? ''));
    }

    _extractSingleNumericQueryValue(rows) {
        if (!Array.isArray(rows) || rows.length !== 1) {
            return null;
        }

        const row = rows[0];
        if (!row || typeof row !== 'object' || Array.isArray(row)) {
            return null;
        }

        const columns = Object.keys(row);
        if (columns.length !== 1) {
            return null;
        }

        const value = row[columns[0]];
        const numeric = typeof value === 'number' ? value : Number(value);

        return Number.isFinite(numeric) ? numeric : null;
    }

    // Given a query result row object, build the initial binding from column name → value.
    _buildRowBinding(row) {
        if (!row || typeof row !== 'object') {
            return {};
        }
        return { ...row };
    }

    // Returns fireable rows: rows whose column bindings are compatible with available tokens.
    // Each entry is { row, rowBinding }.
    getFireableRows(transition, rows, baseBinding = {}) {
        const fireable = [];
        for (const row of rows) {
            const rowBinding = { ...baseBinding, ...this._buildRowBinding(row) };
            const plan = this._buildFiringPlanWithRowBinding(transition, rowBinding);
            if (plan) {
                fireable.push({ row, rowBinding });
            }
        }
        return fireable;
    }

    // Internal helper: builds a firing plan seeded with a row binding, without side effects.
    _buildFiringPlanWithRowBinding(transition, rowBinding) {
        const incomingArcs = Array.isArray(transition.incoming) ? transition.incoming : [];
        const outgoingArcs = Array.isArray(transition.outgoing) ? transition.outgoing : [];
        const currentMarkings = new Map();

        for (const connection of incomingArcs) {
            const sourcePlace = connection?.source;
            if (!getters.isPetriPlace(sourcePlace)) return null;
            if (!currentMarkings.has(sourcePlace.id)) {
                currentMarkings.set(sourcePlace.id, this.deepClone(getters.getPlaceMarking(sourcePlace)));
            }
        }

        return this.findBindingForTransition(
            incomingArcs, 0, currentMarkings, rowBinding, [],
            this.getTransitionGuardExpression(transition), outgoingArcs
        );
    }

    _setQueryGuardDiagnostic(transition, diagnostic) {
        if (!transition?.id) {
            return;
        }

        const previous = this.queryGuardDiagnostics.get(transition.id);
        const changed = !previous
            || previous.status !== diagnostic.status
            || previous.message !== diagnostic.message;

        if (!changed) {
            return;
        }

        this.queryGuardDiagnostics.set(transition.id, diagnostic);
        this.eventBus.fire('simulation.queryGuard.diagnostic', {
            transitionId: transition.id,
            ...diagnostic
        });
        if (diagnostic.status === 'error') {
            console.warn(`[query-guard:${transition.id}] ${diagnostic.message}`);
        }
    }

    // Find binding that satisfies guard
    findBindingForTransition(incomingArcs, arcIndex, currentMarkings, binding, consumption, guard, outgoingArcs
    ) {
        if (arcIndex >= incomingArcs.length) {
            // partial:true keeps search alive unless the guard is definitely false.
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

    findAllBindingsForTransition(incomingArcs, arcIndex, currentMarkings, binding, consumption, guard, outgoingArcs
    ) {
        if (arcIndex >= incomingArcs.length) {
            const guardState = this.evaluateGuardExpression(guard, binding, { partial: true });
            if (guardState === false) {
                return [];
            }

            return [{
                binding,
                consumption,
                outgoingArc: outgoingArcs
            }];
        }

        const connection = incomingArcs[arcIndex];
        const sourcePlace = connection?.source;

        if (!sourcePlace || sourcePlace.type !== 'petri:place') {
            return [];
        }

        const workingMarking = currentMarkings.get(sourcePlace.id);
        const placeType = getters.getPlaceType(sourcePlace);
        const arcInsRequirement = arcUtils.parseArcInscriptionSpec(connection);
        const candidates = this.findAllTokenSelectionsForArc(
            workingMarking,
            placeType,
            arcInsRequirement,
            binding
        );
        const results = [];

        for (const picked of candidates) {
            const nextMarkings = new Map(currentMarkings);
            const nextWorkingMarking = this.deepClone(workingMarking);

            picked.indexes
                .slice()
                .sort((a, b) => b - a)
                .forEach(index => {
                    nextWorkingMarking.splice(index, 1);
                });

            nextMarkings.set(sourcePlace.id, nextWorkingMarking);

            const nextResults = this.findAllBindingsForTransition(
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

            results.push(...nextResults);
        }

        return results;
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

        // Shuffle the results to ensure random token consumption order
        return this.shuffleArray(results);
    }

    // Returns the transition guard expression.
    getTransitionGuardExpression(transition) {
        return String(transition?.businessObject?.guardExpression ?? '');
    }

    // Evaluates a guard expression against bindings.
    // options.partial:
    // true  => allow unresolved variables and return undefined for "not decided yet"
    // false => require a fully decided boolean right now
    evaluateGuardExpression(expression, binding = {}, options = {}) {
        try {
            const ast = parseGuardExpression(expression);
            return evaluateGuardAst(ast, binding, options);
        } catch {
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

        // Build a case-insensitive index so DB column names (e.g. "id") match arc
        // inscription variables (e.g. "ID") even when the casing differs.
        const lowerBinding = {};
        for (const [k, v] of Object.entries(binding)) {
            lowerBinding[k.toLowerCase()] = v;
        }

        const localBinding = { ...binding };

        for (let i = 0; i < vars.length; i++) {
            const varName = vars[i]; // read var name
            const value = tokenValues[i]; // and value

            // Exact-case check first, then case-insensitive fallback for DB columns
            const exactMatch = Object.prototype.hasOwnProperty.call(localBinding, varName);
            const boundValue = exactMatch
                ? localBinding[varName]
                : lowerBinding[varName.toLowerCase()];
            const isBound = exactMatch || Object.prototype.hasOwnProperty.call(lowerBinding, varName.toLowerCase());

            if (isBound && !this.deepEqual(boundValue, value)) { // Var already bound to different value ==> token does not match
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
        const context = getters.getTypedArcContext(connection, 'output');
        if (!context) {
            return this.createStoredTokenFromValues([], []);
        }

        const placeType = context.placeType;
        const arcInsRequirement = context.arcInscription;
        const values = [];
        const nextBinding = { ...binding };
        const guard = this.getTransitionGuardExpression(context.transition);

        for (let i = 0; i < placeType.length; i++) {
            const varName = arcInsRequirement.vars[i];

            if (varName && Object.prototype.hasOwnProperty.call(nextBinding, varName)) {
                values.push(nextBinding[varName]);
                continue;
            }

            const producedValue = this.generateValueForVarWithGuard(varName, placeType[i], guard, nextBinding);

            values.push(producedValue);

            if (varName) {
                nextBinding[varName] = producedValue;
            }
        }

        return this.createStoredTokenFromValues(values, placeType);
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

    // Fisher-Yates shuffle algorithm to randomly shuffle an array in place
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Generates a random value that respects current domain/type rules.
    randomValueForColor(color) {
        if (color === 'int') {
            const minRule = Number.isFinite(Number(rules.integerDomainMin)) ? Number(rules.integerDomainMin) : -1000;
            const maxRule = Number.isFinite(Number(rules.integerDomainMax)) ? Number(rules.integerDomainMax) : 1000;
            const min = Math.ceil(Math.min(minRule, maxRule));
            const max = Math.floor(Math.max(minRule, maxRule));

            if (min > max) {
                return 0;
            }

            return this.mathService.randomIntBetween(min, max);
        }

        if (color === 'real') {
            const minRule = Number.isFinite(Number(rules.realDomainMin)) ? Number(rules.realDomainMin) : -1000;
            const maxRule = Number.isFinite(Number(rules.realDomainMax)) ? Number(rules.realDomainMax) : 1000;
            const min = Math.min(minRule, maxRule);
            const max = Math.max(minRule, maxRule);
            const decimals = Number(rules.realDecimals ?? 2);

            if (min > max) {
                return 0;
            }

            const value = Math.random() * (max - min) + min;
            return Number(value.toFixed(decimals));
        }

        if (color === 'bool') {
            return Math.random() < 0.5;
        }

        if (color === 'string') {
            return this.generateStringWithConstraints({});
        }

        return null;
    }

    generateValueForVarWithGuard(varName, color, guard, binding) {
        if (!varName) {
            return this.randomValueForColor(color);
        }

        const ast = this.safeParseGuard(guard);
        const constraints = this.collectConstraintsForVar(ast, varName, binding);

        for (let i = 0; i < 50; i++) {
            let candidate;

            if (color === 'bool') {
                if (constraints.bool === true) {
                    candidate = true;
                } else if (constraints.bool === false) {
                    candidate = false;
                } else {
                    candidate = Math.random() < 0.5;
                }
            } else if (color === 'string') {
                candidate = this.generateStringWithConstraints(constraints);
            } else if (color === 'int' || color === 'real') {
                candidate = this.generateNumberWithConstraints(color, constraints);
            } else {
                candidate = this.randomValueForColor(color);
            }

            const nextBinding = { ...binding };
            if (varName) {
                nextBinding[varName] = candidate;
            }

            // partial:false means this candidate must satisfy the complete guard.
            if (this.evaluateGuardExpression(guard, nextBinding, { partial: false }) === true) {
                return candidate;
            }
        }

        if (color === 'int') {
            const minRule = Number.isFinite(Number(rules.integerDomainMin)) ? Number(rules.integerDomainMin) : -1000;
            const maxRule = Number.isFinite(Number(rules.integerDomainMax)) ? Number(rules.integerDomainMax) : 1000;
            const min = Math.ceil(Math.min(minRule, maxRule));
            const max = Math.floor(Math.max(minRule, maxRule));

            // For bounded integer domains, do a deterministic full scan before giving up.
            if (Number.isFinite(min) && Number.isFinite(max) && max >= min && max - min <= 10000) {
                for (let candidate = min; candidate <= max; candidate++) {
                    const nextBinding = {
                        ...binding,
                        [varName]: candidate
                    };

                    if (this.evaluateGuardExpression(guard, nextBinding, { partial: false }) === true) {
                        return candidate;
                    }
                }
            }
        }

        return undefined;
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


    stringMatchesRegexRule(value, regexText) {
        const pattern = String(regexText ?? '').trim();

        if (!pattern) {
            throw new Error('Missing string regex rule.');
        }

        const regex = new RegExp(`^${pattern}$`);
        return regex.test(String(value));
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
            if (!this.typedValueMatchesColor(color, candidate)) {
                continue;
            }

            const nextBinding = {
                ...currentBinding,
                [varName]: candidate
            };

            // partial:true lets us prune only on definite false while values are still being assigned.
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
        const nextBinding = { ...binding };

        for (const connection of (outgoingArcs || [])) {
            const targetPlace = connection?.target;

            if (!targetPlace || targetPlace.type !== 'petri:place') {
                return null;
            }

            const placeType = getters.getPlaceType(targetPlace);
            const arcInsRequirement = arcUtils.parseArcInscriptionSpec(connection);

            for (let i = 0; i < placeType.length; i++) {
                const varName = arcInsRequirement.vars[i];

                if (varName && Object.prototype.hasOwnProperty.call(nextBinding, varName)) {
                    continue;
                }

                // In user-input mode, do not prefill unresolved output vars.
                // Keep them unbound so _askUser(...) can prompt for them later.
                if (this.usesUserDefinedProduction()) {
                    continue;
                }

                try {
                    const producedValue = this.generateValueForVarWithGuard(
                        varName,
                        placeType[i],
                        guard,
                        nextBinding
                    );

                    if (producedValue === undefined) {
                        return null;
                    }

                    if (varName) {
                        nextBinding[varName] = producedValue;
                    }
                } catch {
                    const transitionId = connection?.source?.id ?? 'unknown';
                    showAlert({
                        title: 'Generation Error',
                        message: `Failed to generate value for variable "${varName}" into transition "${transitionId}". Please check your rules and guards.`
                    });
                    return null;
                }
            }
        }

        if (this.usesUserDefinedProduction()) {
            return { ...binding };
        }

        return this.evaluateGuardExpression(guard, nextBinding, { partial: false }) === true
            ? nextBinding
            : null;
    }

    safeParseGuard(guard) {
        try {
            return parseGuardExpression(guard);
        } catch {
            return null;
        }
    }

    collectConstraintsForVar(ast, varName, binding) {
        if (!ast) return {};

        const walk = (node) => {
            if (!node) return [];

            if (node.type === 'BinaryExpression') {
                if (node.operator === '&&') {
                    return [...walk(node.left), ...walk(node.right)];
                }

                if (node.operator === '||') {
                    return Math.random() < 0.5
                        ? walk(node.left)
                        : walk(node.right);
                }

                return [node];
            }

            return [node];
        };

        const clauses = walk(ast);

        const constraints = {
            min: Number.NEGATIVE_INFINITY,
            max: Number.POSITIVE_INFINITY,
            equals: undefined,
            notEquals: new Set(),
            bool: undefined,
            stringEquals: undefined
        };

        for (const node of clauses) {
            if (node.type !== 'BinaryExpression') continue;

            const { left, right, operator } = node;

            const leftVal = this.evalAstSafe(left, binding);
            const rightVal = this.evalAstSafe(right, binding);

            const isLeftVar = left.type === 'Identifier' && left.name === varName;
            const isRightVar = right.type === 'Identifier' && right.name === varName;

            if (!isLeftVar && !isRightVar) continue;

            const value = isLeftVar ? rightVal : leftVal;

            if (value === undefined) continue;

            if (typeof value === 'number') {
                if (operator === '>') constraints.min = Math.max(constraints.min, value + 1);
                if (operator === '>=') constraints.min = Math.max(constraints.min, value);
                if (operator === '<') constraints.max = Math.min(constraints.max, value - 1);
                if (operator === '<=') constraints.max = Math.min(constraints.max, value);
                if (operator === '=' || operator === '==') constraints.equals = value;
            }

            if (typeof value === 'boolean') {
                if (operator === '=' || operator === '==') constraints.bool = value;
            }

            if (typeof value === 'string') {
                if (operator === '=' || operator === '==') constraints.stringEquals = value;
            }
        }

        return constraints;
    }

    evalAstSafe(node, binding) {
        try {
            // partial:true lets AST probing tolerate missing variables during constraint inference.
            return evaluateGuardAstValue(node, binding, { partial: true });
        } catch {
            return undefined;
        }
    }

    generateNumberWithConstraints(color, constraints) {
        let min = Number.isFinite(constraints.min)
            ? constraints.min
            : Number.NEGATIVE_INFINITY;

        let max = Number.isFinite(constraints.max)
            ? constraints.max
            : Number.POSITIVE_INFINITY;

        if (constraints.equals !== undefined) {
            return constraints.equals;
        }

        if (color === 'int') {
            min = Math.max(min, Number(rules.integerDomainMin));
            max = Math.min(max, Number(rules.integerDomainMax));

            min = Math.ceil(min);
            max = Math.floor(max);

            if (min > max) {
                return this.randomValueForColor('int');
            }

            if (rules.integerDistributionEnabled) {
                const val = Math.round(
                    this.mathService.randomNormal(
                        Number(rules.integerMean),
                        Number(rules.integerStd)
                    )
                );
                return Math.min(max, Math.max(min, val));
            }
            return this.mathService.randomIntBetween(min, max);
        }

        if (color === 'real') {
            min = Math.max(min, Number(rules.realDomainMin));
            max = Math.min(max, Number(rules.realDomainMax));

            if (min > max) {
                return this.randomValueForColor('real');
            }

            const decimals = Number(rules.realDecimals ?? 2);

            if (rules.realDistributionEnabled) {
                const val = this.mathService.randomNormal(
                    Number(rules.realMean),
                    Number(rules.realStd)
                );
                return Number(Math.min(max, Math.max(min, val)).toFixed(decimals));
            }

            return Number((Math.random() * (max - min) + min).toFixed(decimals));
        }

        return this.randomValueForColor(color);
    }

    generateStringWithConstraints(constraints) {
        if (constraints.stringEquals !== undefined) {
            return constraints.stringEquals;
        }

        const { chars, minLength, maxLength } = this.parseStringRegexRule(rules.stringRegex);

        const length = Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[Math.floor(Math.random() * chars.length)];
        }
        return result;
    }
}

