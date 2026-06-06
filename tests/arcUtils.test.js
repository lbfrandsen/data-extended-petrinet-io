jest.mock('../lib/services/DialogService.js', () => ({
    __esModule: true,
    showAlert: jest.fn()
}));

import { showAlert } from '../lib/services/DialogService.js';
import { parseArcInscriptionText, parseArcInscriptionSpec, parseInscriptionLine } from '../lib/helpers/arc-utils.js';

const connectionForPlaceType = (placeType, arcInscription = '<x>') => ({
    source: { type: 'petri:place', businessObject: { placeType } },
    target: { type: 'petri:transition' },
    businessObject: { arcInscription }
});

describe('arc-utils permissive parsing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('parseArcInscriptionText handles simple variables, tuples, and exponent multiplicity', () => {
        // This covers the permissive reader used by existing diagrams and display paths.
        // It should preserve the normalized tuple text, extracted variables, and numeric multiplicity.
        expect(parseArcInscriptionText('<x>')).toEqual({ text: '<x>', vars: ['x'], multiplicity: 1 });
        expect(parseArcInscriptionText('<x,y>^3')).toEqual({ text: '<x,y>', vars: ['x', 'y'], multiplicity: 3 });
    });

    test('parseArcInscriptionText handles superscript multiplicity', () => {
        // Users can enter multiplicity with superscript digits in the UI.
        // The parser should treat that as the same multiplicity value as caret notation.
        expect(parseArcInscriptionText('<x,y>²')).toEqual({ text: '<x,y>', vars: ['x', 'y'], multiplicity: 2 });
    });

    test('parseArcInscriptionSpec defaults missing inscription to <x>', () => {
        // Older or partially-created arc business objects may not have an inscription yet.
        // The permissive spec parser should fall back to the historical single-variable default.
        expect(parseArcInscriptionSpec({ businessObject: {} })).toEqual({ text: '<x>', vars: ['x'], multiplicity: 1 });
        expect(parseArcInscriptionSpec(null)).toEqual({ text: '<x>', vars: ['x'], multiplicity: 1 });
    });

    test('permissive parser normalizes whitespace and malformed raw text into variable lists', () => {
        // The permissive path intentionally accepts loose text that the strict editor would reject.
        // This keeps old labels readable while still returning a normalized internal shape.
        expect(parseArcInscriptionText(' < x , y > ^2 ')).toEqual({ text: '<x,y>', vars: ['x', 'y'], multiplicity: 2 });
        expect(parseArcInscriptionText('x,y')).toEqual({ text: '<x,y>', vars: ['x', 'y'], multiplicity: 1 });
    });
});

describe('arc-utils strict inscription editing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('parseInscriptionLine accepts valid inscriptions matching the connected place type', () => {
        // The strict editor path validates against the place type connected to the arc.
        // These assertions cover both a typed tuple place and the special empty-place inscription.
        expect(parseInscriptionLine('<x,y>', connectionForPlaceType('int*string'))).toEqual({
            text: '<x,y>',
            vars: ['x', 'y'],
            multiplicity: 1
        });
        expect(parseInscriptionLine('<>', connectionForPlaceType(''))).toEqual({
            text: '<>',
            vars: [],
            multiplicity: 1
        });
    });

    test('parseInscriptionLine normalizes superscript multiplicity to caret notation', () => {
        // Strict parsing accepts UI-friendly superscript input, but stores the canonical caret form.
        // This keeps edited inscriptions consistent with the format the rest of the code expects.
        expect(parseInscriptionLine('<x>³', connectionForPlaceType('int'))).toEqual({
            text: '<x>^3',
            vars: ['x'],
            multiplicity: 3
        });
    });

    test('parseInscriptionLine rejects empty and malformed grammar with alerts', () => {
        // Invalid user edits should fail closed and explain the expected format through DialogService.
        // The parser returns null so callers know not to persist the bad inscription.
        expect(parseInscriptionLine('', connectionForPlaceType('int'))).toBeNull();
        expect(showAlert).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Invalid arc inscription' }));

        expect(parseInscriptionLine('x', connectionForPlaceType('int'))).toBeNull();
        expect(showAlert).toHaveBeenLastCalledWith(expect.objectContaining({
            title: 'Invalid arc inscription',
            message: expect.stringContaining('Expected format')
        }));
    });

    test('parseInscriptionLine rejects invalid variable names', () => {
        // Variable names become guard bindings, so names that cannot be valid identifiers must be rejected.
        // This prevents malformed bindings from leaking into simulation planning.
        expect(parseInscriptionLine('<1x>', connectionForPlaceType('int'))).toBeNull();
        expect(showAlert).toHaveBeenLastCalledWith(expect.objectContaining({
            title: 'Invalid variable name',
            message: expect.stringContaining('1x')
        }));
    });

    test('parseInscriptionLine rejects arity mismatches against the place type', () => {
        // The number of inscription variables must match the color arity of the connected place.
        // An int*string place cannot legally be consumed or produced with only <x>.
        expect(parseInscriptionLine('<x>', connectionForPlaceType('int*string'))).toBeNull();
        expect(showAlert).toHaveBeenLastCalledWith(expect.objectContaining({
            title: 'Arc inscription does not match place type',
            message: expect.stringContaining('length 2')
        }));
    });
});
