// elias Storm vedel Jørgensen - provider for showing tokens on hover
export default class PlaceTokenHoverProvider {
    constructor(eventBus, overlays) {
        // this.eventBus = eventBus; // dont need it
        this.overlays = overlays;
        this.hoverTimeout = null;
        this.currentOverlayId = null;
        this.currentElement = null;

        eventBus.on('element.hover', (event) => {
            const element = event.element;
            if (element.type !== 'petri:place') return;

            this.currentElement = element;

            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
            }

            this.hoverTimeout = setTimeout(() => {
                if (this.currentElement !== element) return;
                this.showTokenOverlay(element);
            }, 1000);
        });

        eventBus.on('element.out', () => {
            this.currentElement = null;

            if (this.hoverTimeout) {
                clearTimeout(this.hoverTimeout);
                this.hoverTimeout = null;
            }

            this.hideTokenOverlay();
        });
    }

    getMarking(place) {
        const marking = place?.businessObject?.marking;
        return Array.isArray(marking) ? marking : [];
    }

    formatSingleValue(value) {
        if (typeof value === 'string') {
            return `"${value}"`;
        }

        return String(value);
    }

    formatToken(token) {
        if (token && typeof token === 'object' && 'value' in token) {
            return this.formatToken(token.value);
        }

        if (Array.isArray(token)) {
            return token.map(value => this.formatSingleValue(value)).join(', ');
        }

        return this.formatSingleValue(token);
    }

    groupTokens(marking) {
        const counts = new Map();

        for (const token of marking) {
            const text = this.formatToken(token);
            counts.set(text, (counts.get(text) || 0) + 1);
        }

        return Array.from(counts.entries()).map(([text, count]) => ({
            text,
            count
        }));
    }

    buildOverlayContent(place) {
        const marking = this.getMarking(place);

        const container = document.createElement('div');
        container.style.background = 'white';
        container.style.border = '1px solid #999';
        container.style.borderRadius = '4px';
        container.style.padding = '8px';
        container.style.fontSize = '12px';
        container.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
        container.style.pointerEvents = 'none';
        container.style.whiteSpace = 'pre';
        container.style.display = 'inline-block';

        if (marking.length === 0) {
            container.textContent = 'Tokens:\n(none)';
            return container;
        }

        const grouped = this.groupTokens(marking);

        const lines = ['Tokens:'];
        grouped.forEach(entry => {
            lines.push(`${entry.count} token${entry.count > 1 ? "s" : ""} of value: ${entry.text}`);
        });

        container.textContent = lines.join('\n');
        return container;
    }

    showTokenOverlay(place) {
        this.hideTokenOverlay();

        const html = this.buildOverlayContent(place);

        this.currentOverlayId = this.overlays.add(place, {
            position: {
                top: -10,
                left: place.width + 10
            },
            html
        });
    }

    hideTokenOverlay() {
        if (this.currentOverlayId) {
            this.overlays.remove(this.currentOverlayId);
            this.currentOverlayId = null;
        }
    }
}

PlaceTokenHoverProvider.$inject = ['eventBus', 'overlays'];