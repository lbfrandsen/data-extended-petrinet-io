import { getRawPlaceType, parseType } from '../helpers/token-types.js';

function getPlaceId(place) {
    return (
        place?.businessObject?.id ||
        place?.id ||
        ''
    );
}

function getPlaceIdNumber(place) {
    const id = getPlaceId(place);
    const match = /^P(\d+)$/i.exec(id);

    if (!match) {
        return Number.MAX_SAFE_INTEGER;
    }

    return Number(match[1]);
}

function formatPlaceLabel(place) {
    const id = getPlaceId(place).trim();
    return id || 'Unnamed place';
}

function formatTypeLabel(businessObject) {
    const rawType = getRawPlaceType(businessObject);
    const parsed = parseType(rawType);

    if (!parsed || !parsed.length) {
        return 'ε';
    }

    return parsed.join(',');
}

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

    _bindEvents() {
        const rerender = () => this.render();

        this._eventBus.on('import.done', rerender);
        this._eventBus.on('diagram.clear', rerender);
        this._eventBus.on('commandStack.changed', rerender);

        // catches direct element/businessObject updates
        this._eventBus.on('element.changed', rerender);
        this._eventBus.on('elements.changed', rerender);

        // optional but often useful in these editors
        this._eventBus.on('shape.added', rerender);
        this._eventBus.on('shape.removed', rerender);
    }
    _getPlaces() {
        return this._elementRegistry
            .getAll()
            .filter((element) => element && element.type === 'petri:place')
            .sort((a, b) => {
                const aNum = getPlaceIdNumber(a);
                const bNum = getPlaceIdNumber(b);

                if (aNum !== bNum) {
                    return aNum - bNum;
                }

                return getPlaceId(a).localeCompare(getPlaceId(b));
            });
    }

    _buildItems() {
        return this._getPlaces().map((place) => {
            const businessObject = place.businessObject || {};

            return {
                label: formatPlaceLabel(place),
                typeLabel: formatTypeLabel(businessObject)
            };
        });
    }

    render() {
        if (!this._container) {
            return;
        }

        const items = this._buildItems();

        if (!items.length) {
            this._container.innerHTML = `
        <div class="place-legend__title">Legend</div>
        <div class="place-legend__empty">No places yet</div>
      `;
            return;
        }

        const rows = items.map(({ label, typeLabel }) => `
      <div class="place-legend__row">
        <span class="place-legend__name">${this._escapeHtml(label)}</span>
        <span class="place-legend__sep"> - </span>
        <span class="place-legend__type">type: ${this._escapeHtml(typeLabel)}</span>
      </div>
    `).join('');

        this._container.innerHTML = `
      <div class="place-legend__title">Legend</div>
      <div class="place-legend__list">${rows}</div>
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