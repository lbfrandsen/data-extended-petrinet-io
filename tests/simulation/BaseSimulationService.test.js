jest.mock('../../lib/services/DialogService.js', () => {
    const mockRules = {
        integerGeneration: 'randomDomain',
        consumptionMode: 'random',
        productionMode: 'random',
        integerDomainMin: 0,
        integerDomainMax: 100,
        integerStd: 10,
        integerMean: 50,
        integerDistributionEnabled: false,
        realDomainMin: 0,
        realDomainMax: 100,
        realStd: 10,
        realMean: 50,
        realDecimals: 2,
        realDistributionEnabled: false,
        stringRegex: '[a-zA-Z]{1,20}'
    };

    return {
        __esModule: true,
        showAlert: jest.fn(() => Promise.resolve()),
        showMultiPrompt: jest.fn(),
        showQueryRowAndConsumptionDialog: jest.fn(),
        getConsumptionMode: jest.fn(() => 'random'),
        getProductionMode: jest.fn(() => 'random'),
        rules: mockRules
    };
});

import BaseSimulationService from '../../lib/features/simulation/BaseSimulationService.js';

const makeEventBus = () => ({
    on: jest.fn(),
    fire: jest.fn()
});

const makeRegistry = (elements) => ({
    getAll: () => elements
});

const makePlace = ({ id = 'p1', placeType = 'int', marking = [1], name = 'P1' } = {}) => ({
    type: 'petri:place',
    id,
    businessObject: {
        name,
        placeType,
        marking: [...marking],
        tokens: marking.length
    }
});

const makeTransition = ({ id = 't1', guardExpression = '', incoming = [], outgoing = [], name = 'T1' } = {}) => ({
    type: 'petri:transition',
    id,
    businessObject: {
        name,
        guardExpression
    },
    incoming,
    outgoing
});

const makeConnection = ({ source, target, arcInscription = '<x>' } = {}) => ({
    source,
    target,
    businessObject: {
        arcInscription
    }
});


describe('BaseSimulationService Petri net scenarios', () => {
    test('scenario 1: an empty-type transition consumes and produces its placeholder token', () => {
        const inputPlace = makePlace({ id: 'p1', placeType: '', marking: [[]] });
        const outputPlace = makePlace({ id: 'p2', placeType: '', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: '' });
        const inputArc = makeConnection({ source: inputPlace, target: transition, arcInscription: '<>' });
        const outputArc = makeConnection({ source: transition, target: outputPlace, arcInscription: '<>' });

        transition.incoming = [inputArc];
        transition.outgoing = [outputArc];

        const eventBus = makeEventBus();
        const mathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        const sqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        const registry = makeRegistry([inputPlace, transition, outputPlace]);
        const service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const plan = service.buildTransitionFiringPlan(transition);
        expect(plan).not.toBeNull();

        for (const entry of plan.consumption || []) {
            service.removeStoredTokens(entry.place, entry.tokens || []);
        }

        for (const connection of transition.outgoing || []) {
            service.addProducedTokens(connection.target, connection, plan.binding || {});
        }

        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([[]]);
    });

    test('scenario 2: a simple typed transition moves an int token to a string place', () => {
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'string', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: '' });
        const inputArc = makeConnection({ source: inputPlace, target: transition, arcInscription: '<x>' });
        const outputArc = makeConnection({ source: transition, target: outputPlace, arcInscription: '<x>' });

        transition.incoming = [inputArc];
        transition.outgoing = [outputArc];

        const eventBus = makeEventBus();
        const mathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        const sqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        const registry = makeRegistry([inputPlace, transition, outputPlace]);
        const service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const plan = service.buildTransitionFiringPlan(transition);
        expect(plan).not.toBeNull();

        for (const entry of plan.consumption || []) {
            service.removeStoredTokens(entry.place, entry.tokens || []);
        }

        for (const connection of transition.outgoing || []) {
            service.addProducedTokens(connection.target, connection, plan.binding || {});
        }

        expect(plan.binding).toEqual({ x: 7 });
        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([7]);
    });

    test('scenario 3: multi-variable inscriptions bind and produce values across two incoming arcs', () => {
        const inputPlaceA = makePlace({ id: 'p1', placeType: 'int*string', marking: [[9, 'alpha']] });
        const inputPlaceB = makePlace({ id: 'p3', placeType: 'int', marking: [6] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'string*int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: '' });
        const arcA = makeConnection({ source: inputPlaceA, target: transition, arcInscription: '<x,y>' });
        const arcB = makeConnection({ source: inputPlaceB, target: transition, arcInscription: '<x1>' });
        const outputArc = makeConnection({ source: transition, target: outputPlace, arcInscription: '<y,x1>' });

        transition.incoming = [arcA, arcB];
        transition.outgoing = [outputArc];

        const eventBus = makeEventBus();
        const mathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        const sqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        const registry = makeRegistry([inputPlaceA, inputPlaceB, transition, outputPlace]);
        const service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const plan = service.buildTransitionFiringPlan(transition);
        expect(plan).not.toBeNull();

        for (const entry of plan.consumption || []) {
            service.removeStoredTokens(entry.place, entry.tokens || []);
        }

        for (const connection of transition.outgoing || []) {
            service.addProducedTokens(connection.target, connection, plan.binding || {});
        }

        expect(plan.binding).toEqual({ x: 9, y: 'alpha', x1: 6 });
        expect(inputPlaceA.businessObject.marking).toEqual([]);
        expect(inputPlaceB.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([['alpha', 6]]);
    });

    test('scenario 4: multiplicity consumes and reproduces duplicate tokens', () => {
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [3, 3] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: '' });
        const inputArc = makeConnection({ source: inputPlace, target: transition, arcInscription: '<x>^2' });
        const outputArc = makeConnection({ source: transition, target: outputPlace, arcInscription: '<x>^2' });

        transition.incoming = [inputArc];
        transition.outgoing = [outputArc];

        const eventBus = makeEventBus();
        const mathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        const sqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        const registry = makeRegistry([inputPlace, transition, outputPlace]);
        const service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const plan = service.buildTransitionFiringPlan(transition);
        expect(plan).not.toBeNull();

        for (const entry of plan.consumption || []) {
            service.removeStoredTokens(entry.place, entry.tokens || []);
        }

        for (const connection of transition.outgoing || []) {
            service.addProducedTokens(connection.target, connection, plan.binding || {});
        }

        expect(plan.binding).toEqual({ x: 3 });
        expect(plan.consumption).toEqual([{ place: inputPlace, tokens: [3, 3] }]);
        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([3, 3]);
    });

    test('scenario 5: the guard allows valid bindings and blocks invalid ones', () => {
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [6] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x > 5 && x < 10' });
        const inputArc = makeConnection({ source: inputPlace, target: transition, arcInscription: '<x>' });
        const outputArc = makeConnection({ source: transition, target: outputPlace, arcInscription: '<x>' });

        transition.incoming = [inputArc];
        transition.outgoing = [outputArc];

        const eventBus = makeEventBus();
        const mathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        const sqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        const registry = makeRegistry([inputPlace, transition, outputPlace]);
        const service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);
        const allowedPlan = service.buildTransitionFiringPlan(transition);

        expect(allowedPlan).toEqual(expect.objectContaining({ binding: { x: 6 } }));

        const blockedInputPlace = makePlace({ id: 'p9', placeType: 'int', marking: [11] });
        const blockedOutputPlace = makePlace({ id: 'p10', placeType: 'int', marking: [] });
        const blockedTransition = makeTransition({ id: 't2', guardExpression: 'x > 5 && x < 10' });
        const blockedInputArc = makeConnection({ source: blockedInputPlace, target: blockedTransition, arcInscription: '<x>' });
        const blockedOutputArc = makeConnection({ source: blockedTransition, target: blockedOutputPlace, arcInscription: '<x>' });

        blockedTransition.incoming = [blockedInputArc];
        blockedTransition.outgoing = [blockedOutputArc];

        const blockedEventBus = makeEventBus();
        const blockedMathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        const blockedSqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        const blockedRegistry = makeRegistry([blockedInputPlace, blockedTransition, blockedOutputPlace]);
        const blockedService = new BaseSimulationService(blockedEventBus, blockedRegistry, null, blockedMathService, null, null, blockedSqlParserService);
        expect(blockedService.buildTransitionFiringPlan(blockedTransition)).toBeNull();
    });
});
