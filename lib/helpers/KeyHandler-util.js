class KeyHandlerUtil {
  constructor() {
    this._targetStates = new Map();
    this._nextBindingId = 1;
    this._nextOrder = 1;
  }

  registerBinding({
    target = document,
    match = () => true,
    when,
    callback,
    preventDefault = false,
    stopPropagation = false,
    stopOnMatch = true,
    priority = 0
  }) {
    if (!target || typeof target.addEventListener !== 'function') {
      throw new Error('KeyHandler-util: target must support addEventListener.');
    }

    if (typeof callback !== 'function') {
      throw new Error('KeyHandler-util: callback must be a function.');
    }

    const state = this._getOrCreateTargetState(target);

    const binding = {
      id: this._nextBindingId++,
      order: this._nextOrder++,
      match,
      when,
      callback,
      preventDefault,
      stopPropagation,
      stopOnMatch,
      priority
    };

    state.bindings.push(binding);

    return () => {
      const targetState = this._targetStates.get(target);

      if (!targetState) {
        return;
      }

      targetState.bindings = targetState.bindings.filter(entry => entry.id !== binding.id);

      if (targetState.bindings.length === 0) {
        target.removeEventListener('keydown', targetState.dispatch);
        this._targetStates.delete(target);
      }
    };
  }

  registerHotkey({
    target = document,
    key,
    callback,
    when,
    preventDefault = true,
    stopPropagation = false,
    stopOnMatch = true,
    priority = 0,
    ctrlKey,
    metaKey,
    shiftKey,
    altKey,
    modKey
  }) {
    const normalizedKey = this._normalizeKey(key);

    return this.registerBinding({
      target,
      when,
      callback,
      preventDefault,
      stopPropagation,
      stopOnMatch,
      priority,
      match: event => {
        const eventKey = this._normalizeKey(event.key);

        if (normalizedKey && eventKey !== normalizedKey) {
          return false;
        }

        if (typeof ctrlKey === 'boolean' && event.ctrlKey !== ctrlKey) {
          return false;
        }

        if (typeof metaKey === 'boolean' && event.metaKey !== metaKey) {
          return false;
        }

        if (typeof shiftKey === 'boolean' && event.shiftKey !== shiftKey) {
          return false;
        }

        if (typeof altKey === 'boolean' && event.altKey !== altKey) {
          return false;
        }

        if (typeof modKey === 'boolean' && (event.ctrlKey || event.metaKey) !== modKey) {
          return false;
        }

        return true;
      }
    });
  }

  registerSubmitOnEnter({
    target,
    callback,
    allowShiftEnter = false,
    preventDefault = true
  }) {
    return this.registerBinding({
      target,
      callback,
      preventDefault,
      match: event => {
        if (event.key !== 'Enter') {
          return false;
        }

        if (!allowShiftEnter && event.shiftKey) {
          return false;
        }

        return true;
      }
    });
  }

  isTextInputElement(element) {
    if (!element) {
      return false;
    }

    const tag = element.tagName;

    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
  }

  isTextInputEvent(event) {
    const target = event?.target || document.activeElement;

    return this.isTextInputElement(target);
  }

  isCanvasFocused(canvasContainer) {
    if (!canvasContainer) {
      return false;
    }

    const activeElement = document.activeElement;

    return canvasContainer.contains(activeElement) ||
      activeElement === canvasContainer ||
      activeElement === document.body;
  }

  _getOrCreateTargetState(target) {
    const existingState = this._targetStates.get(target);

    if (existingState) {
      return existingState;
    }

    const state = {
      bindings: [],
      dispatch: event => {
        const targetState = this._targetStates.get(target);

        if (!targetState || targetState.bindings.length === 0) {
          return;
        }

        const sortedBindings = [ ...targetState.bindings ].sort((a, b) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }

          return a.order - b.order;
        });

        for (const binding of sortedBindings) {
          if (typeof binding.when === 'function' && !binding.when(event)) {
            continue;
          }

          if (typeof binding.match === 'function' && !binding.match(event)) {
            continue;
          }

          if (binding.preventDefault) {
            event.preventDefault();
          }

          if (binding.stopPropagation) {
            event.stopPropagation();
          }

          binding.callback(event);

          if (binding.stopOnMatch) {
            break;
          }
        }
      }
    };

    this._targetStates.set(target, state);
    target.addEventListener('keydown', state.dispatch);

    return state;
  }

  _normalizeKey(key) {
    if (typeof key !== 'string') {
      return '';
    }

    return key.toLowerCase();
  }
}

const keyHandlerUtil = new KeyHandlerUtil();

export default keyHandlerUtil;
