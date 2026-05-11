import MathService from '../lib/services/MathService.js';

describe('MathService', () => {
    const originalRandom = Math.random;
    let mathService;

    beforeEach(() => {
        mathService = new MathService();
    });

    afterEach(() => {
        Math.random = originalRandom;
    });

    test('randomBetween returns numbers inside range', () => {
        Math.random = () => 0.5;
        expect(mathService.randomBetween(0, 10)).toBe(5);
    });

    test('randomIntBetween returns integer inside inclusive bounds', () => {
        Math.random = () => 0.5;
        expect(mathService.randomIntBetween(1, 6)).toBe(4);
    });

    test('randomNormal returns a finite number', () => {
        Math.random = (() => {
            const values = [0.3, 0.7];
            let i = 0;
            return () => values[i++ % values.length];
        })();
        const value = mathService.randomNormal(0, 1);
        expect(Number.isFinite(value)).toBe(true);
    });
});