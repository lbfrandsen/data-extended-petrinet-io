import * as placeTypeUtils from '../helpers/placeTypeUtils.js'
function getPlaceId(place) {
    return place?.id;
}

function getTransitionId(transition) {
    return transition?.id;
}

// Return name if exists
function formatPlaceLabel(place) {
    const name = String(place?.businessObject?.name ?? '').trim();

    if (name) {
        return name;
    }

    const id = String(getPlaceId(place) ?? '').trim();
    return id || 'Unnamed place';
}

// Return epsilon if no type, otherwise format as "type1,type2" as parsed earlier
function formatTypeLabel(businessObject) {
    const rawType = placeTypeUtils.getRawPlaceType(businessObject);
    const parsed = placeTypeUtils.parseType(rawType);

    if (!parsed.length) {
        return 'ε';
    }

    return parsed.join(',');
}

// Check if element is a transition 
function isTransition(element) {
    return element && element.type === 'petri:transition';
}

// Return name if transition exists, otherwise return ID or "Unnamed transition"
function formatTransitionLabel(transition) {
    const name = String(transition?.businessObject?.name ?? '').trim();

    if (name) {
        return name;
    }

    const id = String(getTransitionId(transition) ?? '').trim();
    return id || 'Unnamed transition';
}

// Combine input and output guards for display, show "none" if no guards
function formatGuardLabel(businessObject) {
    const inputGuard = String(businessObject?.inputGuard ?? '').trim();
    const outputGuard = String(businessObject?.outputGuard ?? '').trim();
    const combined = [inputGuard, outputGuard].filter(Boolean).join(' && ');

    return combined || 'none';
}

// LegendProvider is responsible for rendering the legend based on current places and transitions in the diagram
export default class LegendProvider {
    constructor(eventBus, elementRegistry) {
        this._eventBus = eventBus;
        this._elementRegistry = elementRegistry;
        this._container = document.getElementById('place-legend');

        if (!this._container) {
            return;
        }

        this._bindEvents();
        this.render();
    }

    // Re-render legend on events
    _bindEvents() {
        const rerender = () => this.render();

        this._eventBus.on('import.done', rerender);
        this._eventBus.on('diagram.clear', rerender);
        this._eventBus.on('commandStack.changed', rerender);

        this._eventBus.on('element.changed', rerender);
        this._eventBus.on('elements.changed', rerender);

        this._eventBus.on('shape.added', rerender);
        this._eventBus.on('shape.removed', rerender);
    }

    // Get places
    _getPlaces() {
        return this._elementRegistry
            .getAll()
            .filter(element => element.type === 'petri:place')
            .sort((a, b) =>
                String(getPlaceId(a) ?? '').localeCompare(String(getPlaceId(b) ?? ''))
            );
    }
    // Get transitions
    _getTransitions() {
        return this._elementRegistry
            .getAll()
            .filter(element => isTransition(element))
            .sort((a, b) =>
                String(getTransitionId(a) ?? '').localeCompare(String(getTransitionId(b) ?? ''))
            );
    }

    // Build label and type info for places
    _buildPlaceItems() {
        return this._getPlaces().map((place) => {
            const businessObject = place.businessObject || {};

            return {
                label: formatPlaceLabel(place),
                detail: `type: ${formatTypeLabel(businessObject)}`
            };
        });
    }

    // Build label and guard info for transitions
    _buildTransitionItems() {
        return this._getTransitions().map((transition) => {
            const businessObject = transition.businessObject || {};

            return {
                label: formatTransitionLabel(transition),
                detail: `guard: ${formatGuardLabel(businessObject)}`
            };
        });
    }

    // Build HTML rows for legend items
    _buildRows(items) {
        return items.map(({ label, detail }) => `
      <div class="place-legend__row">
        <span class="place-legend__name">${this._escapeHtml(label)}</span>
        <span class="place-legend__sep"> - </span>
        <span class="place-legend__type">${this._escapeHtml(detail)}</span>
      </div>
    `).join('');
    }

    // Main render function, builds HTML for the legend based on current places and transitions
    // Automatically scales with the number of elements and expands on hover when content is too long
    // (CSS is LLM-generated)
    render() {
        if (!this._container) {
            return;
        }

        const placeItems = this._buildPlaceItems();
        const transitionItems = this._buildTransitionItems();

        if (!placeItems.length && !transitionItems.length) {
            this._container.innerHTML = `
        <div class="place-legend__title">Legend</div>
        <div class="place-legend__empty">No places or transitions yet</div>
      `;
            return;
        }

        const placeSection = placeItems.length
            ? `
        <div class="place-legend__section">
          <div class="place-legend__subtitle">Places</div>
          <div class="place-legend__list">${this._buildRows(placeItems)}</div>
        </div>
      `
            : '';

        const transitionSection = transitionItems.length
            ? `
        <div class="place-legend__section">
          <div class="place-legend__subtitle">Transitions</div>
          <div class="place-legend__list">${this._buildRows(transitionItems)}</div>
        </div>
      `
            : '';

        this._container.innerHTML = `
      <div class="place-legend__title">Legend</div>
      ${placeSection}
      ${transitionSection}
    `;
    }

    _escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

LegendProvider.$inject = ['eventBus', 'elementRegistry'];
