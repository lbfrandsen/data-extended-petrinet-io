const uuid = typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID
  ? () => globalThis.crypto.randomUUID()
  : () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export default class IdCounterService {
  static $inject = ["elementRegistry", "eventBus"];
  constructor(elementRegistry, eventBus) {
    this.elementRegistry = elementRegistry;
    this.eventBus = eventBus;
    this.placeCounter = 1;
    this.transitionCounter = 1;
    this.labelsVisible = false;

    this._syncCountersFromRegistry();

    if (typeof this.eventBus?.on === 'function') {
      this.eventBus.on('shape.added', ({ element } = {}) => {
        this._observeElementId(element);
      });
    }
  }

  getNextPlaceId() {
    this._syncCountersFromRegistry();
    const elements = this.elementRegistry.getAll();
    const places = elements.filter(el => el.type === "petri:place");

    const existingIds = new Set(
      places
        .map(el => el.id)
        .filter(id => typeof id === 'string' && id.startsWith('p'))
        .map(id => {
          const num = parseInt(id.substring(1));
          return isNaN(num) ? null : num;
        })
        .filter(num => num !== null)
    );

    let candidate = 1;
    while (existingIds.has(candidate)) {
      candidate++;
    }

    // Update counter to be at least as high as the candidate (for future increments)
    if (candidate >= this.placeCounter) {
      this.placeCounter = candidate + 1;
    }

    return `p${candidate}`;
  }

  getNextTransitionId() {
    this._syncCountersFromRegistry();
    const elements = this.elementRegistry.getAll();
    const transitions = elements.filter(el => el.type === 'petri:transition');

    // Extract all existing transition IDs and parse their numbers
    const existingIds = new Set(
      transitions
        .map(el => el.id)
        .filter(id => id.startsWith('t'))
        .map(id => {
          const num = parseInt(id.substring(1));
          return isNaN(num) ? null : num;
        })
        .filter(num => num !== null)
    );

    // New transitions must not reuse IDs from deleted transitions in this session.
    let candidate = this.transitionCounter;
    while (existingIds.has(candidate)) {
      candidate++;
    }

    // Update counter to be at least as high as the candidate (for future increments)
    if (candidate >= this.transitionCounter) {
      this.transitionCounter = candidate + 1;
    }

    return `t${candidate}`;
  }

  _syncCountersFromRegistry() {
    const elements = typeof this.elementRegistry?.getAll === 'function'
      ? this.elementRegistry.getAll()
      : [];

    elements.forEach(element => this._observeElementId(element));
  }

  _observeElementId(element) {
    if (!element) {
      return;
    }

    if (element.type === 'petri:place') {
      const numericId = this._parseNumericId(element.id, 'p');
      if (!numericId) {
        return;
      }
      this.placeCounter = Math.max(this.placeCounter, numericId + 1);
    } else if (element.type === 'petri:transition') {
      const numericId = this._parseNumericId(element.id, 't');
      if (!numericId) {
        return;
      }
      this.transitionCounter = Math.max(this.transitionCounter, numericId + 1);
    }
  }

  _parseNumericId(id, prefix) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(String(id || ''));
    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  getNextTransitionLabel() {
    const elements = this.elementRegistry.getAll();
    const transitions = elements.filter(el => el.type === 'petri:transition');

    // Extract all existing transition IDs and parse their numbers
    const existingLabels = new Set(
      transitions
        .map(el => el.businessObject.name)
        .filter(num => num !== null)
    );

    // Find the lowest available number starting from 1
    let candidate = 'A';
    while (existingLabels.has(candidate)) {
      candidate = String.fromCharCode(candidate.charCodeAt(0) + 1);
    }

    return candidate;
  }

  getNextConnectionId() {
    return 'Connection_' + uuid()
  }

  // Get next ID based on type
  getNextId(type) {
    if (type) {
      if (type === 'petri:place') {
        return this.getNextPlaceId();
      } else if (type === 'petri:transition') {
        return this.getNextTransitionId();
      } else {
        return undefined;
      }
    }
  }

  toggleLabels() {
    this.labelsVisible = !this.labelsVisible;
  }
}
