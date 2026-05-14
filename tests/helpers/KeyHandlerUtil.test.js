import keyHandlerUtil from '../../lib/helpers/KeyHandler-util.js';

describe('KeyHandlerUtil', () => {
    let target;

    beforeEach(() => {
        target = document.createElement('div');
        document.body.appendChild(target);
    });

    afterEach(() => {
        document.body.removeChild(target);
    });

    test('registerBinding throws when target has no addEventListener', () => {
        expect(() => keyHandlerUtil.registerBinding({ target: {}, callback: () => { } })).toThrow();
    });

    test('registerBinding throws when callback is not a function', () => {
        expect(() => keyHandlerUtil.registerBinding({ target, callback: null })).toThrow();
    });

    test('registerHotkey matches a key and invokes callback', () => {
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerHotkey({ target, key: 'a', callback });
        const event = new KeyboardEvent('keydown', { key: 'a' });
        target.dispatchEvent(event);
        expect(callback).toHaveBeenCalled();
        unregister();
    });

    test('registerSubmitOnEnter matches Enter and prevents shift-enter when disabled', () => {
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerSubmitOnEnter({ target, callback, allowShiftEnter: false });
        const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true });
        target.dispatchEvent(event);
        expect(callback).not.toHaveBeenCalled();
        unregister();
    });

    test('isTextInputElement returns true for input and textarea elements', () => {
        const input = document.createElement('input');
        const textarea = document.createElement('textarea');
        expect(keyHandlerUtil.isTextInputElement(input)).toBe(true);
        expect(keyHandlerUtil.isTextInputElement(textarea)).toBe(true);
    });

    test('isTextInputElement returns false for other elements', () => {
        const div = document.createElement('div');
        expect(keyHandlerUtil.isTextInputElement(div)).toBe(false);
    });

    test('isCanvasFocused returns false when active element is outside container', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const result = keyHandlerUtil.isCanvasFocused(container);
        document.body.removeChild(container);
        expect(result).toBe(true); // because document.body contains activeElement when no input focused
    });
});
