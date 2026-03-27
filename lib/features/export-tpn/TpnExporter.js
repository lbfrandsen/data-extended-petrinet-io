export default class TpnExporter {

    static $inject = ["canvas", "elementRegistry"];

    constructor(canvas, elementRegistry) {
        this.canvas = canvas;
        this.elementRegistry = elementRegistry;
    }

    getTpnString() {
        const root = this.canvas.getRootElement();
        const elements = this.elementRegistry.filter(element =>
            element.parent === root
        );

        const places = [];
        const transitions = [];
        const connections = [];
        elements.forEach(element => {
            if (element.type === "petri:place") {
                places.push(element);
            } else if (element.type === "petri:transition") {
                transitions.push(element);
            } else if (element.type === "petri:connection") {
                connections.push(element);
            }
        });

        const lines = [];
        places.forEach(place => {
            const placeId = place.id;
            const initTokens = place.businessObject?.tokens || 0;

            // If you always want `init 0` even when empty, remove the ternary
            if (initTokens !== null && initTokens !== undefined) {
                lines.push(`place ${placeId} init ${initTokens};`);
            } else {
                lines.push(`place ${placeId};`);
            }
        });

        transitions.forEach(transition => {
            const label = this._formatTransitionLabel(transition);

            const inPlaces = [];
            const outPlaces = [];

            // connections: place -> transition => input
            //              transition -> place => output
            connections.forEach(conn => {
                if (conn.target === transition && conn.source && conn.source.type === "petri:place") {
                    inPlaces.push(conn.source.id);
                } else if (conn.source === transition && conn.target && conn.target.type === "petri:place") {
                    outPlaces.push(conn.target.id);
                }
            });

            const inPart = inPlaces.length ? inPlaces.join(" ") : "";
            const outPart = outPlaces.length ? outPlaces.join(" ") : "";

            const parts = [`trans ${label}`];

            if (inPart) {
                parts.push(`in ${inPart}`);
            }

            if (outPart) {
                parts.push(`out ${outPart}`);
            }

            lines.push(parts.join(" ") + ";");
        });

        return lines.join("\n");
    }

	exportTpn(filename = 'petri-net.tpn'){
        try {
        const tpn = this.getTpnString();

            // Create and trigger download
        const blob = new Blob([tpn], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error in exportTpn:', error);
            alert('Export failed: ' + error.message);
        }
    }

    _formatTransitionLabel(transition) {
        const bo = transition.businessObject || {};
        const id = transition.id;
        const name = bo.name || '';

        if (id && name) {
            return `"${id}"~"${name}"`;
        }

        if (id) {
            return `"${id}"`;
        }

        return '""';
    }
}
