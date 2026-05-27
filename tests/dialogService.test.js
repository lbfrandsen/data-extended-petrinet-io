import { DEFAULT_RULES, getConsumptionMode, getProductionMode, showAlert } from '../lib/services/DialogService.js';

describe('DialogService', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    test('DEFAULT_RULES has expected default values', () => {
        expect(DEFAULT_RULES.integerGeneration).toBe('randomDomain');
        expect(DEFAULT_RULES.consumptionMode).toBe('random');
        expect(DEFAULT_RULES.productionMode).toBe('random');
        expect(DEFAULT_RULES.stringRegex).toBe('[a-zA-Z]{1,20}');
    });

    test('getConsumptionMode returns user when rule is user, otherwise random', () => {
        expect(getConsumptionMode({ consumptionMode: 'user' })).toBe('user');
        expect(getConsumptionMode({ consumptionMode: 'random' })).toBe('random');
        expect(getConsumptionMode({})).toBe('random');
    });

    test('getProductionMode returns user for user mode and random for other modes', () => {
        expect(getProductionMode({ productionMode: 'user' })).toBe('user');
        expect(getProductionMode({ productionMode: 'random' })).toBe('random');
        expect(getProductionMode({ productionMode: 'bogus', integerGeneration: 'defined' })).toBe('user');
        expect(getProductionMode({ productionMode: 'bogus', integerGeneration: 'randomDomain' })).toBe('random');
    });

    test('showAlert renders a modal overlay and resolves when clicked outside', async () => {
        const promise = showAlert({ title: 'Test Title', message: 'Hello world' });
        const overlay = document.body.lastElementChild;
        expect(overlay).not.toBeNull();
        expect(overlay.textContent).toContain('Test Title');
        expect(overlay.textContent).toContain('Hello world');

        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await expect(promise).resolves.toBeUndefined();
        expect(document.body.lastElementChild).toBeNull();
    });
});
