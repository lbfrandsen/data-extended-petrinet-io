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
import { showAlert } from '../../lib/services/DialogService.js';

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

describe('BaseSimulationService', () => {
    let service;
    let eventBus;
    let registry;
    let mathService;
    let sqlParserService;

    beforeEach(() => {
        eventBus = makeEventBus();
        mathService = {
            randomIntBetween: jest.fn(() => 5),
            randomNormal: jest.fn(() => 0)
        };
        sqlParserService = {
            evaluateTransitionQuery: jest.fn(() => ({ status: 'none', message: 'no query' })),
            executeAttachedActionForTransition: jest.fn(() => ({ ok: true }))
        };
        registry = makeRegistry([]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);
    });

    test('saveMasterInitialTokenState stores a deep clone of place markings', () => {
        const place = makePlace({ id: 'p1', marking: [1, 2] });
        registry = makeRegistry([place]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        service.saveMasterInitialTokenState();
        expect(service.masterInitialTokenState.get('p1')).toEqual([1, 2]);

        place.businessObject.marking.push(3);
        expect(service.masterInitialTokenState.get('p1')).toEqual([1, 2]);
    });

    test('saveInitialTokenState stores a deep clone and syncs token count', () => {
        const place = makePlace({ id: 'p1', marking: [5] });
        registry = makeRegistry([place]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        service.saveInitialTokenState();
        expect(service.initialTokenState.get('p1')).toEqual([5]);
        expect(place.businessObject.tokens).toBe(1);

        place.businessObject.marking.push(7);
        expect(service.initialTokenState.get('p1')).toEqual([5]);
    });

    test('resetTokensToInitial restores marking from initialTokenState', () => {
        const place = makePlace({ id: 'p1', marking: [1] });
        registry = makeRegistry([place]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        service.saveInitialTokenState();
        place.businessObject.marking = [9];

        service.resetTokensToInitial();
        expect(place.businessObject.marking).toEqual([1]);
        expect(place.businessObject.tokens).toBe(1);
        expect(eventBus.fire).toHaveBeenCalledWith('element.changed', { element: place });
    });

    test('masterResetTokensToInitial restores marking from masterInitialTokenState', () => {
        const place = makePlace({ id: 'p1', marking: [4] });
        registry = makeRegistry([place]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        service.saveMasterInitialTokenState();
        place.businessObject.marking = [8];

        service.masterResetTokensToInitial();
        expect(place.businessObject.marking).toEqual([4]);
        expect(place.businessObject.tokens).toBe(1);
    });

    test('archiveCurrentSession returns false when no session data exists', () => {
        expect(service.archiveCurrentSession('nothing')).toBe(false);
    });

    test('archiveCurrentSession serializes session archive and getArchivedSessionById returns cloned entry', () => {
        const snapshot = { markings: new Map([['p1', [1]]]), firedTransitions: [] };
        service.stepHistory = [snapshot, snapshot];
        service.executionLog = ['t1'];

        expect(service.archiveCurrentSession('test')).toBe(true);
        expect(service.sessionArchive).toHaveLength(1);
        expect(service.sessionArchive[0].id).toBe('session-1');

        const archive = service.getArchivedSessionById('session-1');
        expect(archive).not.toBeNull();
        expect(archive.initialTokenState).toEqual([]);
        expect(archive.stepHistory[0].markings.get('p1')).toEqual([1]);
    });

    test('createSimulationSnapshot and restoreSimulationSnapshot preserve place markings', () => {
        const place = makePlace({ id: 'p1', marking: [2] });
        registry = makeRegistry([place]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const snapshot = service.createSimulationSnapshot();
        place.businessObject.marking = [3];
        service.restoreSimulationSnapshot(snapshot);

        expect(place.businessObject.marking).toEqual([2]);
        expect(eventBus.fire).toHaveBeenCalledWith('element.changed', { element: place });
    });

    test('jumpToStep returns false when inactive and true when active with valid step', () => {
        service.isActive = true;
        const snapshot = { markings: new Map(), firedTransitions: [] };
        service.stepHistory = [snapshot, snapshot];
        service.executionLog = ['t1'];
        service.currentStepIndex = 1;

        expect(service.jumpToStep(0)).toBe(true);
        expect(service.currentStepIndex).toBe(0);
        expect(service.jumpToStep(-1)).toBe(false);
    });

    test('exportSimulationState and importSimulationState preserve state shape', () => {
        const place = makePlace({ id: 'p1', marking: [7] });
        registry = makeRegistry([place]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);
        service.saveInitialTokenState();
        service.executionLog.push('t1');
        service.stepHistory.push({ markings: new Map([['p1', [7]]]), firedTransitions: [] });

        const state = service.exportSimulationState();
        const nextService = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);
        nextService.importSimulationState(state);

        expect(nextService.initialTokenState.has('p1')).toBe(true);
        expect(nextService.currentStepIndex).toBe(0);
        expect(nextService.stepHistory.length).toBeGreaterThan(0);
    });

    test('evaluateGuardExpression returns correct boolean and false for invalid guard', () => {
        expect(service.evaluateGuardExpression('x > 1', { x: 2 })).toBe(true);
        expect(service.evaluateGuardExpression('invalid $$', { x: 2 })).toBe(false);
    });

    test('evaluateGuardValueExpression parses literals and evaluates simple expressions', () => {
        expect(service.evaluateGuardValueExpression('"hello"')).toBe('hello');
        expect(service.evaluateGuardValueExpression('true')).toBe(true);
        expect(service.evaluateGuardValueExpression('3 + x', { x: 2 })).toBe(5);
        expect(service.evaluateGuardValueExpression('y + 1', { x: 2 })).toBeUndefined();
    });

    test('parseGuardLiteral detects strings, booleans, ints and reals', () => {
        expect(service.parseGuardLiteral('"x"')).toBe('x');
        expect(service.parseGuardLiteral('false')).toBe(false);
        expect(service.parseGuardLiteral('42')).toBe(42);
        expect(service.parseGuardLiteral('3.14')).toBe(3.14);
        expect(service.parseGuardLiteral('foo')).toBeUndefined();
    });

    test('tokenMatchesVarsWithBinding is case insensitive and rejects conflicting bound values', () => {
        expect(service.tokenMatchesVarsWithBinding([1], ['x'], { X: 1 })).toBe(true);
        expect(service.tokenMatchesVarsWithBinding([2], ['x'], { X: 1 })).toBe(false);
    });

    test('normalizeTokenValues supports arrays, objects with value, and primitives', () => {
        expect(service.normalizeTokenValues([1, 2])).toEqual([1, 2]);
        expect(service.normalizeTokenValues({ value: 1 })).toEqual([1]);
        expect(service.normalizeTokenValues(5)).toEqual([5]);
    });

    test('createStoredTokenFromValues returns empty array for zero-type and scalar for single-type', () => {
        expect(service.createStoredTokenFromValues([], [])).toEqual([]);
        expect(service.createStoredTokenFromValues([7], ['int'])).toBe(7);
        expect(service.createStoredTokenFromValues([7, 8], ['int', 'int'])).toEqual([7, 8]);
    });

    test('deepClone and deepEqual produce independent clones and equal comparisons', () => {
        const value = { a: 1, b: [2, 3] };
        const clone = service.deepClone(value);
        expect(clone).toEqual(value);
        expect(service.deepEqual(value, clone)).toBe(true);
        clone.b.push(4);
        expect(service.deepEqual(value, clone)).toBe(false);
    });

    test('syncTokenCount updates place token count and removeStoredTokens removes matching tokens', () => {
        const place = makePlace({ id: 'p1', marking: [1, 2] });
        service.syncTokenCount(place);
        expect(place.businessObject.tokens).toBe(2);
        service.removeStoredTokens(place, [1]);
        expect(place.businessObject.marking).toEqual([2]);
        expect(place.businessObject.tokens).toBe(1);
    });

    test('tokenMatchesPlaceType checks token value lengths against place type', () => {
        expect(service.tokenMatchesPlaceType([1], ['int'])).toBe(true);
        expect(service.tokenMatchesPlaceType([], [])).toBe(true);
        expect(service.tokenMatchesPlaceType([1, 2], ['int'])).toBe(false);
    });

    test('getQueryRowsForTransition supports row mode and count mode', () => {
        const transition = makeTransition({ id: 't1' });
        sqlParserService.evaluateTransitionQuery.mockReturnValueOnce({
            status: 'ok', ok: true, queryId: 'q1', queryText: 'SELECT x FROM t', rows: [{ x: 1 }]
        });
        expect(service.getQueryRowsForTransition(transition)).toEqual({ mode: 'rows', rows: [{ x: 1 }], baseBinding: {} });

        sqlParserService.evaluateTransitionQuery.mockReturnValueOnce({
            status: 'ok', ok: true, queryId: 'q2', queryText: 'SELECT COUNT(*) FROM t', rows: [{ count: 5 }]
        });
        expect(service.getQueryRowsForTransition(transition)).toEqual({ mode: 'count', rows: null, baseBinding: { queryCount: 5 } });
    });

    test('_extractSingleNumericQueryValue returns null on invalid count rows', () => {
        expect(service._extractSingleNumericQueryValue([])).toBeNull();
        expect(service._extractSingleNumericQueryValue([{ a: 1 }, { b: 2 }])).toBeNull();
        expect(service._extractSingleNumericQueryValue([{ a: 'not-num' }])).toBeNull();
    });

    test('buildTransitionFiringPlan finds a valid binding for a consumable input arc', () => {
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x == 1' });
        const connection = makeConnection({ source: place, target: transition, arcInscription: '<x>' });
        transition.incoming = [connection];
        registry = makeRegistry([place, transition]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const plan = service.buildTransitionFiringPlan(transition);
        expect(plan).not.toBeNull();
        expect(plan.binding).toEqual({ x: 1 });
        expect(plan.consumption[0].tokens).toEqual([1]);
    });

    test('getFireableRows returns rows compatible with available tokens', () => {
        const place = makePlace({ id: 'p1', placeType: 'int', marking: [1] });
        const transition = makeTransition({ id: 't1', guardExpression: 'x == 1' });
        const connection = makeConnection({ source: place, target: transition, arcInscription: '<x>' });
        transition.incoming = [connection];
        registry = makeRegistry([place, transition]);
        service = new BaseSimulationService(eventBus, registry, null, mathService, null, null, sqlParserService);

        const fireable = service.getFireableRows(transition, [{ x: 1 }, { x: 2 }], {});
        expect(fireable).toHaveLength(1);
        expect(fireable[0].rowBinding).toEqual({ x: 1 });
    });

    test('buildProducedToken uses binding when output variable is already bound', () => {
        const transition = makeTransition({ id: 't1', guardExpression: '' });
        const place = makePlace({ id: 'p2', placeType: 'int', marking: [] });
        const outputConnection = makeConnection({ source: transition, target: place, arcInscription: '<x>' });
        const produced = service.buildProducedToken(place, outputConnection, { x: 99 });
        expect(produced).toBe(99);
    });

    test('collectOutputVariableTypes returns null when variable types conflict', () => {
        const placeA = makePlace({ id: 'p1', placeType: 'int' });
        const placeB = makePlace({ id: 'p2', placeType: 'string' });
        const connA = makeConnection({ source: null, target: placeA, arcInscription: '<x>' });
        const connB = makeConnection({ source: null, target: placeB, arcInscription: '<x>' });
        expect(service.collectOutputVariableTypes([connA, connB])).toBeNull();
    });

    test('normalizeClauseSide removes redundant outer parentheses', () => {
        expect(service.normalizeClauseSide('((x))')).toBe('x');
        expect(service.normalizeClauseSide('(x + 1)')).toBe('x + 1');
        expect(service.normalizeClauseSide('x')).toBe('x');
    });

    test('extractLiteralHintsForVar returns numeric and string hints from guard clauses', () => {
        const hints = service.extractLiteralHintsForVar('x', 'x == 3 && y == "hello"', {});
        expect(hints.numeric).toEqual([3]);
        expect(hints.strings).toEqual([]);
    });
});