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
import * as DialogService from '../../lib/services/DialogService.js';

const makeEventBus = () => ({
    on: jest.fn(),
    fire: jest.fn()
});

const makeRegistry = (elements) => ({
    getAll: () => elements
});

const makePlace = ({ id = 'p1', placeType = 'int', marking = [1], name = id } = {}) => ({
    type: 'petri:place',
    id,
    businessObject: {
        name,
        placeType,
        marking: [...marking],
        tokens: marking.length
    }
});

const makeTransition = ({ id = 't1', guardExpression = '', name = id } = {}) => ({
    type: 'petri:transition',
    id,
    businessObject: {
        name,
        guardExpression
    },
    incoming: [],
    outgoing: []
});

const makeConnection = ({ source, target, arcInscription = '<x>' } = {}) => ({
    source,
    target,
    businessObject: {
        arcInscription
    }
});

const makeMathService = () => ({
    randomIntBetween: jest.fn((min = 0, max = 100) => Math.min(Math.max(5, Math.ceil(min)), Math.floor(max))),
    randomNormal: jest.fn((mean = 0) => mean)
});

const makeSqlParserService = (queryResult = { status: 'none', message: 'no query' }) => ({
    evaluateTransitionQuery: jest.fn(() => queryResult),
    executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
});

const makeService = (elements, options = {}) => {
    const eventBus = makeEventBus();
    const mathService = options.mathService || makeMathService();
    const sqlParserService = options.sqlParserService || makeSqlParserService(options.queryResult);
    const databaseService = options.databaseService || null;
    const registry = makeRegistry(elements);

    return {
        eventBus,
        mathService,
        sqlParserService,
        registry,
        service: new BaseSimulationService(eventBus, registry, null, mathService, databaseService, null, sqlParserService)
    };
};

const attachIncoming = (transition, place, arcInscription = '<x>') => {
    const connection = makeConnection({ source: place, target: transition, arcInscription });
    transition.incoming.push(connection);
    return connection;
};

const attachOutgoing = (transition, place, arcInscription = '<x>') => {
    const connection = makeConnection({ source: transition, target: place, arcInscription });
    transition.outgoing.push(connection);
    return connection;
};

const applyPlan = (service, transition, plan) => {
    for (const entry of plan.consumption || []) {
        service.removeStoredTokens(entry.place, entry.tokens || []);
    }

    for (const connection of transition.outgoing || []) {
        service.addProducedTokens(connection.target, connection, plan.binding || {});
    }
};

beforeEach(() => {
    jest.clearAllMocks();
});


describe('BaseSimulationService firing plans - valid nets', () => {
    test('empty places consume and produce the placeholder empty token', () => {
        // Empty places have placeType "" and store the empty token as [].
        // This verifies the special zero-arity case: <> consumes one [] token and produces one [] token.
        const inputPlace = makePlace({ id: 'p1', placeType: '', marking: [[]] });
        const outputPlace = makePlace({ id: 'p2', placeType: '', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<>');
        attachOutgoing(transition, outputPlace, '<>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: {} }));

        applyPlan(service, transition, plan);
        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([[]]);
        expect(inputPlace.businessObject.tokens).toBe(0);
        expect(outputPlace.businessObject.tokens).toBe(1);
    });

    test('a simple int token can move from an int place to another int place', () => {
        // This is the baseline typed case: <x> binds x=7 from an int input place,
        // and the same x is valid for the int output place.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({
            binding: { x: 7 },
            consumption: [{ place: inputPlace, tokens: [7] }]
        }));

        applyPlan(service, transition, plan);
        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([7]);
    });

    test('a string token can move from a string place to another string place', () => {
        // Strings are represented as JavaScript strings after token input parsing.
        // This guards against treating all single-value tokens as interchangeable regardless of color.
        const inputPlace = makePlace({ id: 'p1', placeType: 'string', marking: ['alpha'] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'string', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<name>');
        attachOutgoing(transition, outputPlace, '<name>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { name: 'alpha' } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual(['alpha']);
    });

    test('a real token can move from a real place to another real place', () => {
        // Reals are valid for real places even when they are not integers.
        // This prevents the typed simulation tests from accidentally only exercising integer numbers.
        const inputPlace = makePlace({ id: 'p1', placeType: 'real', marking: [3.14] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'real', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<r>');
        attachOutgoing(transition, outputPlace, '<r>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { r: 3.14 } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual([3.14]);
    });

    test('a bool token can move from a bool place to another bool place', () => {
        // Boolean consumption has different JS value semantics than numeric and string tokens.
        // This verifies that false is treated as a real token value, not as a missing value.
        const inputPlace = makePlace({ id: 'p1', placeType: 'bool', marking: [false] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'bool', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<flag>');
        attachOutgoing(transition, outputPlace, '<flag>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { flag: false } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual([false]);
    });

    test('tuple values can be rebound and produced in a different valid order', () => {
        // The input token has type int*string and binds x=9, label="alpha".
        // The output place has type string*int, so producing <label,x> is valid and should reorder the tuple.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int*string', marking: [[9, 'alpha']] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'string*int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x,label>');
        attachOutgoing(transition, outputPlace, '<label,x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { x: 9, label: 'alpha' } }));

        applyPlan(service, transition, plan);
        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([['alpha', 9]]);
    });

    test('multiplicity consumes and produces the requested number of matching tokens', () => {
        // <x>^2 requires two available tokens that both bind x to the same value.
        // With [3, 3] available, the transition should consume both and produce two cloned output tokens.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [3, 3] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>^2');
        attachOutgoing(transition, outputPlace, '<x>^2');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({
            binding: { x: 3 },
            consumption: [{ place: inputPlace, tokens: [3, 3] }]
        }));

        applyPlan(service, transition, plan);
        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([3, 3]);
    });

    test('a guard can select a valid token binding', () => {
        // The input place has two possible int tokens.
        // The guard x > 5 should make the plan choose 6 and ignore 3.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [3, 6] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x > 5' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({
            binding: { x: 6 },
            consumption: [{ place: inputPlace, tokens: [6] }]
        }));
    });

    test('an unbound int output variable can be generated from an equality guard', () => {
        // No input arc binds x here.
        // The output arc needs an int x, and the guard x == 5 gives the generator a concrete valid value.
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x == 5' });
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { x: 5 }, consumption: [] }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual([5]);
    });

    test('an unbound bool output variable can be generated from a boolean equality guard', () => {
        // This verifies generated production for a non-numeric color.
        // Since flag is not consumed, the service must infer flag=true from the guard before production.
        const outputPlace = makePlace({ id: 'p2', placeType: 'bool', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'flag == true' });
        attachOutgoing(transition, outputPlace, '<flag>');

        const { service } = makeService([transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { flag: true } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual([true]);
    });

    test('an unbound string output variable can be generated from a string equality guard', () => {
        // The mocked string rule allows alphabetic strings, and "OK" satisfies it.
        // The guard gives the generator a deterministic string value instead of relying on randomness.
        const outputPlace = makePlace({ id: 'p2', placeType: 'string', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'label == "OK"' });
        attachOutgoing(transition, outputPlace, '<label>');

        const { service } = makeService([transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { label: 'OK' } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual(['OK']);
    });

    test('an unbound real output variable can be generated from a real equality guard', () => {
        // Real output generation should preserve non-integer numeric values when the guard fixes one.
        // This makes sure real-colored places are not treated as int-only numeric outputs.
        const outputPlace = makePlace({ id: 'p2', placeType: 'real', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'r == 2.5' });
        attachOutgoing(transition, outputPlace, '<r>');

        const { service } = makeService([transition, outputPlace]);
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { r: 2.5 } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual([2.5]);
    });

    test('buildAllTransitionFiringPlans returns every legal token binding', () => {
        // User-selection features consume the full candidate-plan list.
        // Even though prompt tests are out of scope, the underlying plan enumeration should be covered.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [1, 2, 3] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x >= 2' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        const plans = service.buildAllTransitionFiringPlans(transition);

        expect(plans.map(plan => plan.binding.x).sort()).toEqual([2, 3]);
        expect(plans.map(plan => plan.consumption[0].tokens[0]).sort()).toEqual([2, 3]);
    });

    test('a COUNT query can seed queryCount for output production', () => {
        // COUNT queries are converted to a base binding named queryCount.
        // Producing <queryCount> into an int place should be valid when the query returns a numeric count.
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachOutgoing(transition, outputPlace, '<queryCount>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT COUNT(*) FROM users',
            rows: [{ count: 4 }]
        };
        const { service } = makeService([transition, outputPlace], { queryResult });
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { queryCount: 4 } }));
    });

    test('row query bindings can match consumed tokens case-insensitively', () => {
        // Database row bindings may use lower-case column names while the arc uses upper-case variable names.
        // tokenMatchesVarsWithBinding should allow id from the row to match <ID> from the arc when values agree.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [42] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<ID>');
        attachOutgoing(transition, outputPlace, '<ID>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT id FROM users',
            rows: [{ id: 42 }]
        };
        const { service } = makeService([inputPlace, transition, outputPlace], { queryResult });
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: expect.objectContaining({ ID: 42, id: 42 }) }));
    });
});

describe('BaseSimulationService firing plans - invalid nets and blocked transitions', () => {
    test('a bound int value cannot be produced into a string place', () => {
        // This is the bad regression case from the earlier review.
        // x is bound as the number 7 from an int place, so producing <x> into a string place must be rejected.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'string', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
        expect(inputPlace.businessObject.marking).toEqual([7]);
        expect(outputPlace.businessObject.marking).toEqual([]);
    });

    test('an input token with the wrong JavaScript value type is not consumable', () => {
        // The place declares int, but the stored token is the string "7".
        // The plan should reject it before binding x, not silently treat it as a valid int token.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: ['7'] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('an input tuple with the wrong arity is not consumable', () => {
        // The place type int*string requires a two-value tuple.
        // A single-value token cannot satisfy <x,label>, even if the first value has the right color.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int*string', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int*string', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x,label>');
        attachOutgoing(transition, outputPlace, '<x,label>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('an outgoing arc whose variables do not match the target place arity is rejected', () => {
        // The target place requires int*string, but the outgoing inscription only provides <x>.
        // Planning should fail instead of generating an anonymous second value.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int*string', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('conflicting repeated variables across incoming arcs block the transition', () => {
        // Both incoming arcs use <x>, so they must consume tokens with the same value.
        // The available values 1 and 2 conflict, leaving no legal binding.
        const leftPlace = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        const rightPlace = makePlace({ id: 'p2', placeType: 'int', marking: [2] });
        const outputPlace = makePlace({ id: 'p3', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, leftPlace, '<x>');
        attachIncoming(transition, rightPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([leftPlace, rightPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('multiplicity fails when there are not enough matching tokens', () => {
        // <x>^2 needs two tokens with the same x value.
        // A single token is insufficient, so the transition must not be enabled.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [3] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>^2');
        attachOutgoing(transition, outputPlace, '<x>^2');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('a guard that evaluates false blocks an otherwise type-correct transition', () => {
        // Token and arc types line up, but x=3 does not satisfy x > 5.
        // The planner should return null rather than producing an output token.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [3] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x > 5' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('an invalid guard expression blocks the transition', () => {
        // Syntax errors are treated as false by evaluateGuardExpression.
        // This prevents a malformed guard from accidentally enabling a transition.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x >' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('an impossible generated output guard blocks the transition', () => {
        // The mocked integer domain is 0..100.
        // With no input token for x, the generator cannot produce an int satisfying x > 200.
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x > 200' });
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([transition, outputPlace]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('the same output-only variable cannot be reused with conflicting target colors', () => {
        // The first outgoing arc would require x to be an int.
        // The second outgoing arc would require the same x to be a string, which is impossible.
        const intOutput = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const stringOutput = makePlace({ id: 'p3', placeType: 'string', marking: [] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x == 5' });
        attachOutgoing(transition, intOutput, '<x>');
        attachOutgoing(transition, stringOutput, '<x>');

        const { service } = makeService([transition, intOutput, stringOutput]);

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('a query row binding with an incompatible value does not make the transition fireable', () => {
        // The query row binds id=99, but the only available token for <id> is 42.
        // Row bindings are constraints, so the planner must reject this row.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [42] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<id>');
        attachOutgoing(transition, outputPlace, '<id>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT id FROM users',
            rows: [{ id: 99 }]
        };
        const { service } = makeService([inputPlace, transition, outputPlace], { queryResult });

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });
});



describe('BaseSimulationService runtime firing behavior', () => {
    test('updateEnabledTransitions marks only transitions with a valid firing plan as enabled', () => {
        // This covers the runtime enablement layer on top of plan construction.
        // One transition has a valid int token available; the other is blocked by its guard.
        const readyInput = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const readyOutput = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const readyTransition = makeTransition({ id: 't-ready' });
        attachIncoming(readyTransition, readyInput, '<x>');
        attachOutgoing(readyTransition, readyOutput, '<x>');

        const blockedInput = makePlace({ id: 'p3', placeType: 'int', marking: [1] });
        const blockedOutput = makePlace({ id: 'p4', placeType: 'int', marking: [] });
        const blockedTransition = makeTransition({ id: 't-blocked', guardExpression: 'y > 5' });
        attachIncoming(blockedTransition, blockedInput, '<y>');
        attachOutgoing(blockedTransition, blockedOutput, '<y>');

        const { service, eventBus } = makeService([
            readyInput,
            readyTransition,
            readyOutput,
            blockedInput,
            blockedTransition,
            blockedOutput
        ]);

        service.isActive = true;
        service.updateEnabledTransitions();

        expect(service.isTransitionEnabled(readyTransition)).toBe(true);
        expect(service.isTransitionEnabled(blockedTransition)).toBe(false);
        expect(service.getEnabledTransitionCount()).toBe(1);
        expect(eventBus.fire).toHaveBeenCalledWith('simulation.state.changed', expect.objectContaining({
            active: true,
            enabledTransitionCount: 1
        }));
    });

    test('fireTransition consumes inputs, produces outputs, records history, and refreshes enablement', async () => {
        // This exercises the real asynchronous firing entry point rather than manually applying a plan.
        // A successful fire should mutate markings, record the fired transition, and append one timeline step.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service, eventBus } = makeService([inputPlace, transition, outputPlace]);
        service.isActive = true;
        service.stepHistory = [service.createSimulationSnapshot()];
        service.updateEnabledTransitions();

        await service.fireTransition(transition);

        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([7]);
        expect(service.isTransitionFired(transition)).toBe(true);
        expect(service.getExecutionLog()).toEqual(['t1']);
        expect(service.getCurrentStepIndex()).toBe(1);
        expect(service.stepHistory).toHaveLength(2);
        expect(eventBus.fire).toHaveBeenCalledWith('element.changed', { element: inputPlace });
        expect(eventBus.fire).toHaveBeenCalledWith('element.changed', { element: outputPlace });
    });

    test('fireTransition reports a query diagnostic when a disabled transition has a query error', async () => {
        // Disabled transitions normally do nothing on click.
        // If SQL diagnostics explain the disabled state, the user should see that diagnostic.
        const transition = makeTransition({ id: 't1' });
        const { service } = makeService([transition]);
        service.isActive = true;
        service.queryGuardDiagnostics.set('t1', {
            status: 'error',
            message: 'Query failed'
        });

        await service.fireTransition(transition);

        expect(DialogService.showAlert).toHaveBeenCalledWith({
            title: 'Transition Disabled',
            message: 'Query failed'
        });
    });

    test('fireTransition silently no-ops when inactive or disabled without diagnostics', async () => {
        // This is the ordinary guard at the top of fireTransition.
        // Without active simulation or enabled state, no alert or token mutation should happen.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);

        await service.fireTransition(transition);
        service.isActive = true;
        await service.fireTransition(transition);

        expect(inputPlace.businessObject.marking).toEqual([7]);
        expect(outputPlace.businessObject.marking).toEqual([]);
        expect(service.getExecutionLog()).toEqual([]);
        expect(DialogService.showAlert).not.toHaveBeenCalled();
    });

    test('fireTransition does not move tokens when an attached SQL action fails', async () => {
        // SQL actions run after a valid firing plan but before token mutation.
        // A failed action must abort the fire so the Petri net and database action stay consistent.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const sqlParserService = makeSqlParserService();
        sqlParserService.executeAttachedActionForTransition = jest.fn(() => ({
            ok: false,
            error: 'action failed'
        }));
        const { service } = makeService([inputPlace, transition, outputPlace], { sqlParserService });
        service.isActive = true;
        service.updateEnabledTransitions();

        await service.fireTransition(transition);

        expect(inputPlace.businessObject.marking).toEqual([7]);
        expect(outputPlace.businessObject.marking).toEqual([]);
        expect(service.getExecutionLog()).toEqual([]);
        expect(DialogService.showAlert).toHaveBeenCalledWith({
            title: 'Action Failed',
            message: 'action failed'
        });
    });

    test('fireTransition discards future timeline entries when firing from an earlier step', async () => {
        // If the user steps back and fires a new transition, the old future branch must be removed.
        // This protects timeline consistency when exploring alternative simulations.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [7] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<x>');
        attachOutgoing(transition, outputPlace, '<x>');

        const { service } = makeService([inputPlace, transition, outputPlace]);
        service.isActive = true;
        service.executionLog = ['old-transition'];
        service.currentStepIndex = 0;
        service.stepHistory = [
            service.createSimulationSnapshot(),
            { markings: new Map([['p1', []], ['p2', [999]]]), firedTransitions: ['old-transition'] }
        ];
        service.updateEnabledTransitions();

        await service.fireTransition(transition);

        expect(service.getExecutionLog()).toEqual(['t1']);
        expect(service.stepHistory).toHaveLength(2);
        expect(outputPlace.businessObject.marking).toEqual([7]);
    });

    test('fireTransition in SQL row mode no-ops when no rows are fireable', async () => {
        // Row SQL mode can return rows but still have no compatible token binding.
        // In that case firing should exit before consuming or producing tokens.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [42] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<id>');
        attachOutgoing(transition, outputPlace, '<id>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT id FROM users',
            rows: [{ id: 99 }]
        };
        const { service } = makeService([inputPlace, transition, outputPlace], { queryResult });
        service.isActive = true;
        service.enabledTransitions.add('t1');

        await service.fireTransition(transition);

        expect(inputPlace.businessObject.marking).toEqual([42]);
        expect(outputPlace.businessObject.marking).toEqual([]);
        expect(service.getExecutionLog()).toEqual([]);
    });
});

describe('BaseSimulationService lifecycle and reset behavior', () => {
    test('initial state snapshots clone markings and database state', () => {
        // Initial-state capture is used by resets and simulation activation.
        // Markings must be deep-cloned so later token mutation does not alter the saved baseline.
        const place = makePlace({ id: 'p1', placeType: 'int*string', marking: [[1, 'a']] });
        const databaseService = {
            snapshotDatabaseBytes: jest.fn(() => new Uint8Array([1, 2, 3])),
            getDbName: jest.fn(() => 'test.db')
        };
        const { service } = makeService([place], { databaseService });

        service.saveInitialTokenState();
        place.businessObject.marking[0][0] = 99;

        expect(service.initialTokenState.get('p1')).toEqual([[1, 'a']]);
        expect(service.initialDbSnapshot).toEqual(new Uint8Array([1, 2, 3]));
        expect(service.initialDbName).toBe('test.db');
    });

    test('ensureMasterInitialTokenState captures once and leaves an existing baseline untouched', () => {
        // Master initial state is meant to represent the first baseline.
        // Calling ensure twice should not overwrite it after the model has changed.
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        const { service } = makeService([place]);

        service.ensureMasterInitialTokenState();
        place.businessObject.marking = [2];
        service.ensureMasterInitialTokenState();

        expect(service.masterInitialTokenState.get('p1')).toEqual([1]);
    });

    test('hasMasterBaselineChanges reports when the current marking differs from the master baseline', () => {
        // The reset dialog uses this to hide the destructive baseline action when it would do nothing.
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        const { service } = makeService([place]);

        expect(service.hasMasterBaselineChanges()).toBe(false);

        service.saveMasterInitialTokenState();
        expect(service.hasMasterBaselineChanges()).toBe(false);

        place.businessObject.marking = [2];
        expect(service.hasMasterBaselineChanges()).toBe(true);
    });

    test('hasMasterBaselineChanges reports when the current database snapshot differs from the master baseline', () => {
        // Master reset also restores database state, so DB-only changes should expose the rebase action.
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        let dbBytes = new Uint8Array([1]);
        const databaseService = {
            snapshotDatabaseBytes: jest.fn(() => dbBytes),
            getDbName: jest.fn(() => 'model.db')
        };
        const { service } = makeService([place], { databaseService });

        service.saveMasterInitialTokenState();
        expect(service.hasMasterBaselineChanges()).toBe(false);

        dbBytes = new Uint8Array([2]);
        expect(service.hasMasterBaselineChanges()).toBe(true);
    });

    test('setMasterBaselineToCurrentState refreshes only the master baseline without resetting markings', () => {
        // Refreshing the master baseline is an explicit irreversible action, not a reset.
        // It should preserve the current marking and leave the active run state untouched.
        const place = makePlace({ id: 'p1', placeType: 'int*string', marking: [[1, 'a']] });
        const databaseService = {
            snapshotDatabaseBytes: jest.fn(() => new Uint8Array([7, 8, 9])),
            getDbName: jest.fn(() => 'rebased.db')
        };
        const { service } = makeService([place], { databaseService });

        service.masterInitialTokenState.set('p1', [[0, 'old']]);
        service.initialTokenState.set('p1', [[0, 'old']]);
        service.firedTransitions.add('t1');
        service.executionLog = ['t1'];
        service.stepHistory = [
            { markings: new Map([['p1', [[0, 'old']]]]), firedTransitions: [] },
            { markings: new Map([['p1', [[1, 'a']]]]), firedTransitions: ['t1'] }
        ];
        service.currentStepIndex = 1;
        service.isActive = true;

        service.setMasterBaselineToCurrentState();
        expect(service.hasMasterBaselineChanges()).toBe(false);
        place.businessObject.marking[0][0] = 99;

        expect(service.masterInitialTokenState.get('p1')).toEqual([[1, 'a']]);
        expect(service.initialTokenState.get('p1')).toEqual([[0, 'old']]);
        expect(service.masterInitialDbSnapshot).toEqual(new Uint8Array([7, 8, 9]));
        expect(service.masterInitialDbName).toBe('rebased.db');
        expect(service.isTransitionFired({ id: 't1' })).toBe(true);
        expect(service.getExecutionLog()).toEqual(['t1']);
        expect(service.getCurrentStepIndex()).toBe(1);
        expect(service.stepHistory).toHaveLength(2);
    });

    test('resetTokensToInitial restores captured markings and database snapshot', () => {
        // This covers the non-timeline reset path used when simulation is inactive.
        // Unknown places are not destructively cleared; captured places are restored.
        const capturedPlace = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        const uncapturedPlace = makePlace({ id: 'p2', placeType: 'int', marking: [9] });
        const databaseService = {
            restoreDatabaseFromSnapshot: jest.fn()
        };
        const { service } = makeService([capturedPlace, uncapturedPlace], { databaseService });

        service.initialTokenState.set('p1', [1]);
        service.initialDbSnapshot = new Uint8Array([4, 5]);
        service.initialDbName = 'initial.db';
        capturedPlace.businessObject.marking = [7];
        uncapturedPlace.businessObject.marking = [9];
        service.executionLog = ['t1'];

        service.resetTokensToInitial();

        expect(capturedPlace.businessObject.marking).toEqual([1]);
        expect(uncapturedPlace.businessObject.marking).toEqual([9]);
        expect(databaseService.restoreDatabaseFromSnapshot).toHaveBeenCalledWith(service.initialDbSnapshot, 'initial.db');
        expect(service.getExecutionLog()).toEqual([]);
    });

    test('resetTokensToInitial uses timeline step zero while simulation is active', () => {
        // Active simulation reset prefers the timeline restore path.
        // It should jump to step zero, restore the DB snapshot, and leave the existing timeline available.
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [9] });
        const databaseService = {
            restoreDatabaseFromSnapshot: jest.fn()
        };
        const { service } = makeService([place], { databaseService });
        service.isActive = true;
        service.executionLog = ['t1'];
        service.currentStepIndex = 1;
        service.stepHistory = [
            { markings: new Map([['p1', [1]]]), firedTransitions: [] },
            { markings: new Map([['p1', [9]]]), firedTransitions: ['t1'] }
        ];
        service.initialDbSnapshot = new Uint8Array([8, 9]);
        service.initialDbName = 'active.db';

        service.resetTokensToInitial();

        expect(service.getCurrentStepIndex()).toBe(0);
        expect(place.businessObject.marking).toEqual([1]);
        expect(service.stepHistory).toHaveLength(2);
        expect(databaseService.restoreDatabaseFromSnapshot).toHaveBeenCalledWith(service.initialDbSnapshot, 'active.db');
    });

    test('masterResetTokensToInitial restores master markings and clears runtime state', () => {
        // Master reset uses the master baseline rather than the current simulation-session baseline.
        // It should also clear fired/logged transition state.
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [5] });
        const { service } = makeService([place]);
        service.masterInitialTokenState.set('p1', [2]);
        service.firedTransitions.add('t1');
        service.executionLog = ['t1'];
        place.businessObject.marking = [9];

        service.masterResetTokensToInitial();

        expect(place.businessObject.marking).toEqual([2]);
        expect(service.isTransitionFired({ id: 't1' })).toBe(false);
        expect(service.getExecutionLog()).toEqual([]);
    });

    test('removeTransitionRuntimeState clears fired visuals and timeline references for a deleted transition', () => {
        // Deleted transitions should not leave ID-keyed runtime state that can affect a future transition.
        const { service } = makeService([]);
        service.enabledTransitions.add('t1');
        service.firedTransitions.add('t1');
        service.queryGuardDiagnostics.set('t1', { status: 'error' });
        service.executionLog = ['t1', 't2'];
        service.currentStepIndex = 2;
        service.stepHistory = [
            { markings: new Map(), firedTransitions: [] },
            { markings: new Map(), firedTransitions: ['t1'] },
            { markings: new Map(), firedTransitions: ['t1', 't2'] }
        ];

        const removed = service.removeTransitionRuntimeState('t1');

        expect(removed).toBe(true);
        expect(service.isTransitionEnabled({ id: 't1' })).toBe(false);
        expect(service.isTransitionFired({ id: 't1' })).toBe(false);
        expect(service.getExecutionLog()).toEqual(['t2']);
        expect(service.getCurrentStepIndex()).toBe(1);
        expect(service.stepHistory.map(snapshot => snapshot.firedTransitions)).toEqual([[], [], ['t2']]);
    });

    test('resetRuntimeState clears simulation internals and emits inactive mode', () => {
        // Runtime reset should clear transient simulation state without relying on PNML persistence.
        const transition = makeTransition({ id: 't1' });
        const { service, eventBus } = makeService([transition]);
        service.isActive = true;
        service.masterInitialTokenState.set('p1', [1]);
        service.initialTokenState.set('p1', [1]);
        service.enabledTransitions.add('t1');
        service.firedTransitions.add('t1');
        service.executionLog = ['t1'];
        service.stepHistory = [{ markings: new Map(), firedTransitions: [] }];
        service.sessionArchive = [{ id: 'session-1' }];
        service.sessionCounter = 1;
        service.queryGuardDiagnostics.set('t1', { status: 'error' });

        service.resetRuntimeState();

        expect(service.isSimulationActive()).toBe(false);
        expect(service.masterInitialTokenState.size).toBe(0);
        expect(service.initialTokenState.size).toBe(0);
        expect(service.getEnabledTransitionCount()).toBe(0);
        expect(service.getExecutionLog()).toEqual([]);
        expect(service.sessionArchive).toEqual([]);
        expect(service.queryGuardDiagnostics.size).toBe(0);
        expect(eventBus.fire).toHaveBeenCalledWith('simulation.mode.changed', { active: false });
    });

    test('stopSimulation archives current activity and disables simulation', () => {
        // stopSimulation is more than a flag flip: it archives the current run, clears history, and refreshes enablement.
        const { service } = makeService([]);
        service.isActive = true;
        service.executionLog = ['t1'];
        service.stepHistory = [{ markings: new Map(), firedTransitions: [] }, { markings: new Map(), firedTransitions: ['t1'] }];

        service.stopSimulation();

        expect(service.isSimulationActive()).toBe(false);
        expect(service.sessionArchive).toHaveLength(1);
        expect(service.sessionArchive[0].endedBy).toBe('stopSimulation');
        expect(service.getExecutionLog()).toEqual([]);
        expect(service.stepHistory).toEqual([]);
    });

    test('timeline helpers restore previous snapshots and reject invalid jumps', () => {
        // This covers the local timeline mechanics without testing persistence.
        // Step-back and jump-to-step should restore markings and fired transition sets from snapshots.
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [3] });
        const { service } = makeService([place]);
        service.isActive = true;
        service.executionLog = ['t1', 't2'];
        service.currentStepIndex = 2;
        service.stepHistory = [
            { markings: new Map([['p1', [3]]]), firedTransitions: [] },
            { markings: new Map([['p1', [4]]]), firedTransitions: ['t1'] },
            { markings: new Map([['p1', [5]]]), firedTransitions: ['t1', 't2'] }
        ];

        expect(service.stepBack()).toBe(true);
        expect(service.getCurrentStepIndex()).toBe(1);
        expect(place.businessObject.marking).toEqual([4]);
        expect(service.jumpToStep(0)).toBe(true);
        expect(place.businessObject.marking).toEqual([3]);
        expect(service.jumpToStep(99)).toBe(false);
        service.isActive = false;
        expect(service.stepBack()).toBe(false);
    });

    test('getTimelineState returns copied markings and logs', () => {
        // Consumers should not be able to mutate internal timeline state through the returned object.
        // Markings are deep-cloned and execution logs are copied.
        const { service } = makeService([]);
        service.isActive = true;
        service.executionLog = ['t1'];
        service.currentStepIndex = 1;
        service.stepHistory = [
            { markings: new Map([['p1', [[1, 'a']]]]), firedTransitions: ['t1'] }
        ];

        const timeline = service.getTimelineState();
        timeline.executionLog.push('external');
        timeline.stepHistory[0].markings.get('p1')[0][0] = 99;
        timeline.stepHistory[0].firedTransitions.push('external');

        expect(service.executionLog).toEqual(['t1']);
        expect(service.stepHistory[0].markings.get('p1')).toEqual([[1, 'a']]);
        expect(service.stepHistory[0].firedTransitions).toEqual(['t1']);
    });
});

describe('BaseSimulationService SQL query integration', () => {
    test('missing SQL parser service blocks query evaluation and records a diagnostic', () => {
        // If SQL infrastructure is unavailable, query-backed transitions must not silently fire.
        // The diagnostic event gives the UI a reason to display.
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const transition = makeTransition({ id: 't1' });
        const { service, eventBus } = makeService([transition], { sqlParserService: {} });

        expect(service.getQueryRowsForTransition(transition)).toBeNull();
        expect(service.queryGuardDiagnostics.get('t1')).toEqual({
            status: 'error',
            message: 'SQL parser service is unavailable.'
        });
        expect(eventBus.fire).toHaveBeenCalledWith('simulation.queryGuard.diagnostic', expect.objectContaining({
            transitionId: 't1',
            status: 'error'
        }));

        warnSpy.mockRestore();
    });

    test('query status none returns normal Petri-net mode', () => {
        // A transition with no attached SQL query should still produce a normal no-query result.
        const transition = makeTransition({ id: 't1' });
        const { service } = makeService([transition], {
            queryResult: { status: 'none', message: 'no query attached' }
        });

        expect(service.getQueryRowsForTransition(transition)).toEqual({
            mode: 'none',
            rows: null,
            baseBinding: {}
        });
        expect(service.queryGuardDiagnostics.get('t1')).toEqual({
            status: 'none',
            message: 'no query attached'
        });
    });

    test('query evaluation errors block the transition and record the error message', () => {
        // SQL parser errors are modeled as non-ok query evaluations.
        // The planner should return null before considering tokens.
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const transition = makeTransition({ id: 't1' });
        const { service } = makeService([transition], {
            queryResult: { ok: false, status: 'error', message: 'bad SQL' }
        });

        expect(service.getQueryRowsForTransition(transition)).toBeNull();
        expect(service.queryGuardDiagnostics.get('t1')).toEqual({
            status: 'error',
            message: 'bad SQL'
        });

        warnSpy.mockRestore();
    });

    test('malformed COUNT query results are rejected', () => {
        // COUNT queries must return exactly one row with exactly one numeric value.
        // Anything else is ambiguous and should block the transition.
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const transition = makeTransition({ id: 't1' });
        const malformedResults = [
            [],
            [{ count: 1 }, { count: 2 }],
            [{ count: 1, extra: 2 }],
            [{ count: 'not-a-number' }]
        ];

        for (const rows of malformedResults) {
            const { service } = makeService([transition], {
                queryResult: {
                    ok: true,
                    status: 'ok',
                    queryId: 'q1',
                    queryText: 'SELECT COUNT(*) FROM users',
                    rows
                }
            });

            expect(service.getQueryRowsForTransition(transition)).toBeNull();
            expect(service.queryGuardDiagnostics.get('t1').status).toBe('error');
        }

        warnSpy.mockRestore();
    });

    test('COUNT query bindings can satisfy or block transition guards', () => {
        // queryCount behaves like any other bound variable.
        // The same count can enable one guard and fail another.
        const passingOutput = makePlace({ id: 'p-pass', placeType: 'int', marking: [] });
        const passingTransition = makeTransition({ id: 't-pass', guardExpression: 'queryCount > 2' });
        attachOutgoing(passingTransition, passingOutput, '<queryCount>');

        const blockingOutput = makePlace({ id: 'p-block', placeType: 'int', marking: [] });
        const blockingTransition = makeTransition({ id: 't-block', guardExpression: 'queryCount > 10' });
        attachOutgoing(blockingTransition, blockingOutput, '<queryCount>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT COUNT(*) FROM users',
            rows: [{ count: 4 }]
        };

        const passing = makeService([passingTransition, passingOutput], { queryResult });
        const blocking = makeService([blockingTransition, blockingOutput], { queryResult });

        expect(passing.service.buildTransitionFiringPlan(passingTransition)).toEqual(expect.objectContaining({
            binding: { queryCount: 4 }
        }));
        expect(blocking.service.buildTransitionFiringPlan(blockingTransition)).toBeNull();
    });

    test('COUNT query accepts a numeric string result', () => {
        // Some database adapters return aggregate values as strings.
        // The service intentionally coerces one numeric COUNT value into queryCount.
        const outputPlace = makePlace({ id: 'p2', placeType: 'real', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachOutgoing(transition, outputPlace, '<queryCount>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT COUNT(*) FROM users',
            rows: [{ count: '4' }]
        };
        const { service } = makeService([transition, outputPlace], { queryResult });

        expect(service.buildTransitionFiringPlan(transition)).toEqual(expect.objectContaining({
            binding: { queryCount: 4 }
        }));
    });

    test('query diagnostics are emitted only when status or message changes', () => {
        // Repeated enablement refreshes can evaluate the same query many times.
        // The diagnostic event should not spam listeners when nothing changed.
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
        const transition = makeTransition({ id: 't1' });
        const { service, eventBus } = makeService([transition], {
            queryResult: { ok: false, status: 'error', message: 'bad SQL' }
        });

        service.getQueryRowsForTransition(transition);
        service.getQueryRowsForTransition(transition);

        const diagnosticEvents = eventBus.fire.mock.calls.filter(call => call[0] === 'simulation.queryGuard.diagnostic');
        expect(diagnosticEvents).toHaveLength(1);

        warnSpy.mockRestore();
    });

    test('row queries filter multiple rows down to the rows compatible with tokens', () => {
        // Row query results are candidate bindings, not automatic fires.
        // Only rows that match available tokens and all guards should remain fireable.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [42] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<id>');
        attachOutgoing(transition, outputPlace, '<id>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT id FROM users',
            rows: [{ id: 99 }, { id: 42 }, { id: 100 }]
        };
        const { service } = makeService([inputPlace, transition, outputPlace], { queryResult });
        const queryRows = service.getQueryRowsForTransition(transition);
        const fireableRows = service.getFireableRows(transition, queryRows.rows, queryRows.baseBinding);

        expect(fireableRows).toEqual([{ row: { id: 42 }, rowBinding: { id: 42 } }]);
        expect(service.buildTransitionFiringPlan(transition)).toEqual(expect.objectContaining({
            binding: expect.objectContaining({ id: 42 })
        }));
    });

    test('row query bindings can produce output-only variables', () => {
        // A SQL row can supply a value that is not consumed from a token.
        // The output place type still validates that the row value has the correct color.
        const outputPlace = makePlace({ id: 'p2', placeType: 'string', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachOutgoing(transition, outputPlace, '<name>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT name FROM users',
            rows: [{ name: 'Alice' }]
        };
        const { service } = makeService([transition, outputPlace], { queryResult });
        const plan = service.buildTransitionFiringPlan(transition);

        expect(plan).toEqual(expect.objectContaining({ binding: { name: 'Alice' } }));

        applyPlan(service, transition, plan);
        expect(outputPlace.businessObject.marking).toEqual(['Alice']);
    });

    test('row query bindings cannot bypass output place type checks', () => {
        // The row supplies a string name, but the output place requires int.
        // SQL bindings must obey the same color rules as token bindings.
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachOutgoing(transition, outputPlace, '<name>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT name FROM users',
            rows: [{ name: 'Alice' }]
        };
        const { service } = makeService([transition, outputPlace], { queryResult });

        expect(service.buildTransitionFiringPlan(transition)).toBeNull();
    });

    test('row query real values must match real output place types', () => {
        // Row-backed output variables should accept finite numbers for real places
        // and reject non-numeric strings that cannot represent a real token.
        const realOutput = makePlace({ id: 'p-real', placeType: 'real', marking: [] });
        const realTransition = makeTransition({ id: 't-real' });
        attachOutgoing(realTransition, realOutput, '<amount>');

        const invalidOutput = makePlace({ id: 'p-invalid', placeType: 'real', marking: [] });
        const invalidTransition = makeTransition({ id: 't-invalid' });
        attachOutgoing(invalidTransition, invalidOutput, '<amount>');

        const valid = makeService([realTransition, realOutput], {
            queryResult: {
                ok: true,
                status: 'ok',
                queryId: 'q1',
                queryText: 'SELECT amount FROM payments',
                rows: [{ amount: 12.5 }]
            }
        });
        const invalid = makeService([invalidTransition, invalidOutput], {
            queryResult: {
                ok: true,
                status: 'ok',
                queryId: 'q2',
                queryText: 'SELECT amount FROM payments',
                rows: [{ amount: '12.5' }]
            }
        });

        expect(valid.service.buildTransitionFiringPlan(realTransition)).toEqual(expect.objectContaining({
            binding: { amount: 12.5 }
        }));
        expect(invalid.service.buildTransitionFiringPlan(invalidTransition)).toBeNull();
    });

    test('fireTransition with row SQL mode uses a fireable row binding', async () => {
        // This runs the full fire path with a row query.
        // The non-matching SQL row is ignored; the matching row drives the actual token movement.
        const inputPlace = makePlace({ id: 'p1', placeType: 'int', marking: [42] });
        const outputPlace = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const transition = makeTransition({ id: 't1' });
        attachIncoming(transition, inputPlace, '<id>');
        attachOutgoing(transition, outputPlace, '<id>');

        const queryResult = {
            ok: true,
            status: 'ok',
            queryId: 'q1',
            queryText: 'SELECT id FROM users',
            rows: [{ id: 99 }, { id: 42 }]
        };
        const { service } = makeService([inputPlace, transition, outputPlace], { queryResult });
        service.isActive = true;
        service.updateEnabledTransitions();

        await service.fireTransition(transition);

        expect(inputPlace.businessObject.marking).toEqual([]);
        expect(outputPlace.businessObject.marking).toEqual([42]);
        expect(service.getExecutionLog()).toEqual(['t1']);
    });
});

describe('BaseSimulationService value generation and utility helpers', () => {
    test('normalizeTokenValues handles scalar, tuple, object-wrapped, and empty tokens', () => {
        // Imported and generated tokens can appear in several storage shapes.
        // Normalization gives binding logic one consistent array representation.
        const { service } = makeService([]);

        expect(service.normalizeTokenValues(7)).toEqual([7]);
        expect(service.normalizeTokenValues([7, 'a'])).toEqual([7, 'a']);
        expect(service.normalizeTokenValues({ value: [7, 'a'] })).toEqual([7, 'a']);
        expect(service.normalizeTokenValues({ value: 7 })).toEqual([7]);
        expect(service.normalizeTokenValues(null)).toEqual([]);
    });

    test('createStoredTokenFromValues stores epsilon, scalar, and tuple tokens in canonical shapes', () => {
        // The simulation stores empty places as [], single-color places as scalars, and product types as arrays.
        const { service } = makeService([]);

        expect(service.createStoredTokenFromValues([], [])).toEqual([]);
        expect(service.createStoredTokenFromValues([7], ['int'])).toBe(7);
        expect(service.createStoredTokenFromValues([7, 'a'], ['int', 'string'])).toEqual([7, 'a']);
    });

    test('randomValueForColor returns values matching the requested color', () => {
        // Random generation is used for output-only variables without a deterministic guard hint.
        // The exact random values are less important than their color and domain shape.
        const mathService = makeMathService();
        const { service } = makeService([], { mathService });

        expect(service.randomValueForColor('int')).toBe(5);
        expect(typeof service.randomValueForColor('real')).toBe('number');
        expect(typeof service.randomValueForColor('bool')).toBe('boolean');
        expect(service.randomValueForColor('string')).toMatch(/^[a-zA-Z]{1,20}$/);
        expect(service.randomValueForColor('unknown')).toBeNull();
    });

    test('string regex rule parsing and matching accept valid rules and reject invalid ones', () => {
        // String generation depends on the limited regex subset configured in rules.stringRegex.
        // These tests document the supported shape and the main validation failures.
        const { service } = makeService([]);

        expect(service.parseStringRegexRule('[A-C]{2,3}')).toEqual({
            chars: 'ABC',
            minLength: 2,
            maxLength: 3
        });
        expect(service.stringMatchesRegexRule('ABC', '[A-C]{3}')).toBe(true);
        expect(service.stringMatchesRegexRule('ABCD', '[A-C]{3}')).toBe(false);
        expect(() => service.parseStringRegexRule('abc*')).toThrow(/Unsupported string regex rule/);
        expect(() => service.parseStringRegexRule('[A-Z]{5,2}')).toThrow(/Invalid string regex quantifier/);
        expect(() => service.stringMatchesRegexRule('x', '')).toThrow(/Missing string regex rule/);
    });

    test('guard literal and value expression helpers evaluate safe literals and bound math', () => {
        // Output generation uses these helpers to infer concrete values from guard clauses.
        // The helper should resolve literals and bound expressions, while rejecting unbound or unsafe expressions.
        const { service } = makeService([]);

        expect(service.parseGuardLiteral('"hello"')).toBe('hello');
        expect(service.parseGuardLiteral('true')).toBe(true);
        expect(service.parseGuardLiteral('-3')).toBe(-3);
        expect(service.parseGuardLiteral('1.5')).toBeCloseTo(1.5);
        expect(service.evaluateGuardValueExpression('x + 2', { x: 3 })).toBe(5);
        expect(service.evaluateGuardValueExpression('missing + 2', { x: 3 })).toBeUndefined();
        expect(service.evaluateGuardValueExpression('process.exit()', {})).toBeUndefined();
    });

    test('constraint helpers extract hints and generate candidate values for unresolved outputs', () => {
        // These helper methods drive automatic output generation.
        // They should preserve useful literal hints and include basic fallback candidates.
        const { service } = makeService([]);

        expect(service.extractLiteralHintsForVar('x', 'x >= 2 && x < 5 && label == "A"')).toEqual({
            numeric: [2, 5],
            strings: [],
            bools: []
        });
        expect(service.extractLiteralHintsForVar('label', 'label == "A"')).toEqual({
            numeric: [],
            strings: ['A'],
            bools: []
        });
        expect(service.generateCandidatesForVar('flag', 'bool', 'flag == true', {})).toEqual([true, false]);
        expect(service.generateCandidatesForVar('x', 'int', 'x == 3', {})).toEqual(expect.arrayContaining([3, 0]));
        expect(service.generateCandidatesForVar('label', 'string', 'label == "A"', {})).toEqual(['A']);
    });

    test('tryResolveOutputBinding finds a complete generated binding or reports failure', () => {
        // This backtracking helper assigns unresolved output variables one at a time.
        // It must return a full binding only when the final guard evaluates true.
        const { service } = makeService([]);

        expect(service.tryResolveOutputBinding([['x', 'int'], ['flag', 'bool']], 0, {}, 'x == 5 && flag == true')).toEqual({
            x: 5,
            flag: true
        });
        expect(service.tryResolveOutputBinding([['x', 'int']], 0, {}, 'x > 200')).toBeNull();
    });

    test('deepClone and deepEqual protect token snapshots from shared references', () => {
        // Several snapshot and archive paths rely on JSON-compatible deep cloning/equality.
        // This small test documents that nested token arrays are copied and compared structurally.
        const { service } = makeService([]);
        const original = [[1, 'a']];
        const clone = service.deepClone(original);

        clone[0][0] = 99;

        expect(original).toEqual([[1, 'a']]);
        expect(service.deepEqual(original, [[1, 'a']])).toBe(true);
        expect(service.deepEqual(original, clone)).toBe(false);
    });
});
