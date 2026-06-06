import keyHandlerUtil from '../lib/helpers/KeyHandler-util.js';

const makeTarget = () => {
    const listeners = {};

    return {
        listeners,
        addEventListener: jest.fn((eventName, handler) => {
            listeners[eventName] = handler;
        }),
        removeEventListener: jest.fn((eventName, handler) => {
            if (listeners[eventName] === handler) {
                delete listeners[eventName];
            }
        }),
        contains: jest.fn(() => false)
    };
};

const keyEvent = (overrides = {}) => ({
    key: 'Enter',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    ...overrides
});

describe('KeyHandler-util registration', () => {
    test('registerBinding validates target and callback', () => {
        // Bindings must attach to DOM-like targets and invoke real callback functions.
        expect(() => keyHandlerUtil.registerBinding({ target: {}, callback: jest.fn() })).toThrow(/target must support addEventListener/);
        expect(() => keyHandlerUtil.registerBinding({ target: makeTarget(), callback: null })).toThrow(/callback must be a function/);
    });

    test('registerBinding adds one keydown listener and unregister removes it', () => {
        // The unregister function should fully detach the shared keydown dispatcher when no bindings remain.
        const target = makeTarget();
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerBinding({ target, callback });

        expect(target.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(target.listeners.keydown).toEqual(expect.any(Function));

        unregister();

        expect(target.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(target.listeners.keydown).toBeUndefined();
    });

    test('bindings run by priority, then registration order, and respect stopOnMatch', () => {
        // Higher priority bindings run first; stopOnMatch prevents lower-priority callbacks from firing.
        const target = makeTarget();
        const calls = [];
        const cleanup = [
            keyHandlerUtil.registerBinding({ target, callback: () => calls.push('low'), priority: 0 }),
            keyHandlerUtil.registerBinding({ target, callback: () => calls.push('high'), priority: 10, stopOnMatch: false }),
            keyHandlerUtil.registerBinding({ target, callback: () => calls.push('middle'), priority: 5 })
        ];

        target.listeners.keydown(keyEvent());

        expect(calls).toEqual(['high', 'middle']);
        cleanup.forEach(unregister => unregister());
    });

    test('bindings honor when and match predicates', () => {
        // Both predicates must pass before a binding callback is allowed to run.
        const target = makeTarget();
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerBinding({
            target,
            callback,
            when: event => event.enabled,
            match: event => event.key === 'A'
        });

        target.listeners.keydown(keyEvent({ key: 'A', enabled: false }));
        target.listeners.keydown(keyEvent({ key: 'B', enabled: true }));
        target.listeners.keydown(keyEvent({ key: 'A', enabled: true }));

        expect(callback).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('preventDefault and stopPropagation options call event methods', () => {
        // Key bindings can opt into browser-event suppression when they handle a shortcut.
        const target = makeTarget();
        const unregister = keyHandlerUtil.registerBinding({
            target,
            callback: jest.fn(),
            preventDefault: true,
            stopPropagation: true
        });
        const event = keyEvent();

        target.listeners.keydown(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
        unregister();
    });
});

describe('KeyHandler-util hotkey helpers', () => {
    test('registerHotkey matches normalized keys and modifier requirements', () => {
        // Hotkeys normalize letter case but still enforce requested modifier states.
        const target = makeTarget();
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerHotkey({
            target,
            key: 'S',
            ctrlKey: true,
            shiftKey: false,
            callback
        });

        target.listeners.keydown(keyEvent({ key: 's', ctrlKey: false }));
        target.listeners.keydown(keyEvent({ key: 'S', ctrlKey: true, shiftKey: true }));
        target.listeners.keydown(keyEvent({ key: 's', ctrlKey: true, shiftKey: false }));

        expect(callback).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('registerHotkey supports platform modKey matching', () => {
        // modKey abstracts Ctrl on some platforms and Meta on others by accepting either key.
        const target = makeTarget();
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerHotkey({
            target,
            key: 'z',
            modKey: true,
            callback
        });

        target.listeners.keydown(keyEvent({ key: 'z', ctrlKey: false, metaKey: false }));
        target.listeners.keydown(keyEvent({ key: 'z', metaKey: true }));

        expect(callback).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('registerSubmitOnEnter matches enter and can reject shift-enter', () => {
        // Submit-on-enter should not trigger for other keys or Shift+Enter unless explicitly allowed.
        const target = makeTarget();
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerSubmitOnEnter({ target, callback });

        target.listeners.keydown(keyEvent({ key: 'Escape' }));
        target.listeners.keydown(keyEvent({ key: 'Enter', shiftKey: true }));
        target.listeners.keydown(keyEvent({ key: 'Enter', shiftKey: false }));

        expect(callback).toHaveBeenCalledTimes(1);
        unregister();
    });

    test('registerSubmitOnEnter can allow shift-enter', () => {
        // Some text areas need Shift+Enter to submit, so the helper exposes that option.
        const target = makeTarget();
        const callback = jest.fn();
        const unregister = keyHandlerUtil.registerSubmitOnEnter({ target, callback, allowShiftEnter: true });

        target.listeners.keydown(keyEvent({ key: 'Enter', shiftKey: true }));

        expect(callback).toHaveBeenCalledTimes(1);
        unregister();
    });
});

describe('KeyHandler-util DOM focus helpers', () => {
    test('isTextInputElement detects input-like elements', () => {
        // Keyboard shortcuts should avoid stealing keystrokes from editable controls.
        expect(keyHandlerUtil.isTextInputElement({ tagName: 'INPUT' })).toBe(true);
        expect(keyHandlerUtil.isTextInputElement({ tagName: 'TEXTAREA' })).toBe(true);
        expect(keyHandlerUtil.isTextInputElement({ tagName: 'SELECT' })).toBe(true);
        expect(keyHandlerUtil.isTextInputElement({ tagName: 'DIV', isContentEditable: true })).toBe(true);
        expect(keyHandlerUtil.isTextInputElement({ tagName: 'DIV' })).toBe(false);
        expect(keyHandlerUtil.isTextInputElement(null)).toBe(false);
    });

    test('isTextInputEvent reads event target or active element', () => {
        // Event handlers can check either the explicit event target or the current active element.
        const input = document.createElement('input');
        const button = document.createElement('button');
        document.body.appendChild(input);
        document.body.appendChild(button);
        input.focus();

        expect(keyHandlerUtil.isTextInputEvent({ target: button })).toBe(false);
        expect(keyHandlerUtil.isTextInputEvent({})).toBe(true);

        input.remove();
        button.remove();
    });

    test('isCanvasFocused accepts active descendants, the canvas itself, and body focus', () => {
        // Canvas shortcuts are allowed when focus is inside the canvas or falls back to the document body.
        const canvas = document.createElement('div');
        const child = document.createElement('button');
        canvas.appendChild(child);
        document.body.appendChild(canvas);

        child.focus();
        expect(keyHandlerUtil.isCanvasFocused(canvas)).toBe(true);

        canvas.tabIndex = 0;
        canvas.focus();
        expect(keyHandlerUtil.isCanvasFocused(canvas)).toBe(true);

        document.body.focus();
        expect(keyHandlerUtil.isCanvasFocused(canvas)).toBe(true);
        expect(keyHandlerUtil.isCanvasFocused(null)).toBe(false);

        canvas.remove();
    });
});
