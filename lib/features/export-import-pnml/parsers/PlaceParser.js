/**
 * Parses PNML place elements and creates diagram shapes
 */

function parseInteger(value, fallback = 0) {
    // This safely parses integer text and falls back when PNML content is missing or invalid.
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

// This parser restores place geometry plus optional petrinet.io metadata for types and markings.
export default class PlaceParser {
    static _getToolspecificNodes(placeNode) {
        // This collects petrinet.io toolspecific nodes from supported locations in the place XML.
        const direct = Array.from(placeNode.querySelectorAll(':scope > toolspecific[tool="petrinet.io"]'));
        const graphics = Array.from(placeNode.querySelectorAll('graphics > toolspecific[tool="petrinet.io"]'));

        return [...direct, ...graphics];
    }

    static _readPropertyValue(toolspecificNode, key) {
        // This reads a property value from either the value attribute or nested text content.
        const selector = `:scope > property[key="${key}"]`;
        const propertyNode = toolspecificNode.querySelector(selector) || toolspecificNode.querySelector(`property[key="${key}"]`);

        if (!propertyNode) {
            return null;
        }

        const valueAttr = propertyNode.getAttribute('value');
        if (valueAttr !== null) {
            return valueAttr;
        }

        const textNode = propertyNode.querySelector(':scope > text') || propertyNode.querySelector('text');
        return textNode ? textNode.textContent : null;
    }

    static _parsePlaceType(placeNode) {
        // This loads place type metadata using both current and legacy property keys.
        const nodes = PlaceParser._getToolspecificNodes(placeNode);

        for (const node of nodes) {
            const placeType = PlaceParser._readPropertyValue(node, 'placeType')
                ?? PlaceParser._readPropertyValue(node, 'place_type');

            if (placeType !== null) {
                return placeType;
            }
        }

        return null;
    }

    static _parseMarking(placeNode) {
        // This parses JSON marking metadata and ignores malformed or non-array payloads.
        const nodes = PlaceParser._getToolspecificNodes(placeNode);

        for (const node of nodes) {
            const rawMarking = PlaceParser._readPropertyValue(node, 'marking');

            if (rawMarking === null) {
                continue;
            }

            try {
                const parsed = JSON.parse(rawMarking);
                if (Array.isArray(parsed)) {
                    // This returns parsed marking only when structure matches expected token list shape.
                    return parsed;
                }

                console.warn('Ignoring non-array marking metadata for place', placeNode.getAttribute('id'));
                return null;
            } catch (error) {
                console.warn('Failed to parse marking metadata for place', placeNode.getAttribute('id'), error);
                return null;
            }
        }

        return null;
    }

    // Parse place XML node and create place shape
    static parse(placeNode, elementFactory, canvas, root, defaultPnml, findLabel) {
        // This builds a place element while restoring custom type and marking metadata when present.
        // Extract attributes from XML
        const id = placeNode.getAttribute('id');
        const positionNode = placeNode.querySelector('graphics > position');
        const dimensionNode = placeNode.querySelector('graphics > dimension');
        const markingNode = placeNode.querySelector('initialMarking > text');

        // Get position and dimensions (with defaults)
        const x = positionNode ? parseFloat(positionNode.getAttribute('x')) : 100;
        const y = positionNode ? parseFloat(positionNode.getAttribute('y')) : 100;
        const width = defaultPnml ? 50 : (dimensionNode ? parseFloat(dimensionNode.getAttribute('x')) : 50);
        const height = defaultPnml ? 50 : (dimensionNode ? parseFloat(dimensionNode.getAttribute('y')) : 50);
        const initialMarkingTokens = markingNode ? parseInteger(markingNode.textContent, 0) : 0;
        const parsedMarking = PlaceParser._parseMarking(placeNode);
        const hasParsedMarking = Array.isArray(parsedMarking);
        // This keeps legacy compatibility by using initialMarking when custom marking metadata is absent.
        const tokens = hasParsedMarking ? parsedMarking.length : initialMarkingTokens;
        const placeType = PlaceParser._parsePlaceType(placeNode);

        // Extract label information
        const label = findLabel(placeNode);
        const name = label ? label.text : '';
        const labelOffsetX = label ? label.offsetX : null;
        const labelOffsetY = label ? label.offsetY : null;

        // Create place shape
        const place = elementFactory.createShape({
            id: id,
            type: 'petri:place',
            x: x,
            y: y,
            width: width,
            height: height,
            businessObject: {
                name: name,
                tokens: tokens,
                placeType: placeType,
                ...(hasParsedMarking && { marking: parsedMarking }),
                ...(labelOffsetX !== null && labelOffsetY !== null && {
                    labelOffset: { x: labelOffsetX, y: labelOffsetY }
                })
            }
        });

        // Add to canvas and return
        canvas.addShape(place, root);
        return place;
    }
}
