import { parseArcInscriptionText, parseArcInscriptionSpec, parseInscriptionLine } from '../lib/helpers/arc-utils.js';

describe('arc-utils', () => {
    test('parseArcInscriptionText handles simple variable annotation', () => {
        expect(parseArcInscriptionText('<x>')).toEqual({ text: '<x>', vars: ['x'], multiplicity: 1 });
    });

    test('parseArcInscriptionText handles multiple variables and multiplicity', () => {
        expect(parseArcInscriptionText('<x,y>^3')).toEqual({ text: '<x,y>', vars: ['x', 'y'], multiplicity: 3 });
    });

    test('parseArcInscriptionText supports superscript multiplicity', () => {
        expect(parseArcInscriptionText('<x>²')).toEqual({ text: '<x>', vars: ['x'], multiplicity: 2 });
    });

    test('parseArcInscriptionSpec reads businessObject arcInscription text', () => {
        const connection = { businessObject: { arcInscription: '<a>' } };
        expect(parseArcInscriptionSpec(connection)).toEqual({ text: '<a>', vars: ['a'], multiplicity: 1 });
    });

    test('parseInscriptionLine rejects invalid grammar and returns null', () => {
        const connection = {
            source: { type: 'petri:place', businessObject: { placeType: 'int' } },
            target: { type: 'petri:transition' }
        };
        expect(parseInscriptionLine('x', connection)).toBeNull();
    });

    test('parseInscriptionLine rejects wrong arity for place type', () => {
        const connection = {
            source: { type: 'petri:place', businessObject: { placeType: 'int*string' } },
            target: { type: 'petri:transition' }
        };
        expect(parseInscriptionLine('<x>', connection)).toBeNull();
    });

    test('parseInscriptionLine accepts valid inscription matching place type', () => {
        const connection = {
            source: { type: 'petri:place', businessObject: { placeType: 'int*string' } },
            target: { type: 'petri:transition' }
        };
        expect(parseInscriptionLine('<x,y>', connection)).toEqual({ text: '<x,y>', vars: ['x', 'y'], multiplicity: 1 });
    });
});