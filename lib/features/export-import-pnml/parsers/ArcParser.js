/**
 * Parses PNML arc elements and creates diagram connections
 */
import * as arcUtils from '../../../helpers/arc-utils.js';

function readToolspecificProperty(node, key) {
    const propertyNode = node.querySelector(`:scope > toolspecific[tool="petrinet.io"] > property[key="${key}"]`)
        || node.querySelector(`toolspecific[tool="petrinet.io"] property[key="${key}"]`);

    if (!propertyNode) {
        return null;
    }

    const valueAttr = propertyNode.getAttribute('value');
    const textNode = propertyNode.querySelector(':scope > text') || propertyNode.querySelector('text');
    return valueAttr ?? (textNode ? textNode.textContent : null);
}

function parseBooleanProperty(value, fallback = false) {
    if (value === null || value === undefined) {
        return fallback;
    }

    return String(value).trim().toLowerCase() === 'true';
}

export default class ArcParser {
    // Parse arc XML node and create connection
    static parse(arcNode, elementMap, elementFactory, canvas, root, findLabel) {
        // Get source and target IDs
        const sourceId = arcNode.getAttribute('source');
        const targetId = arcNode.getAttribute('target');
        
        // Look up source and target elements
        const sourceElement = elementMap.get(sourceId);
        const targetElement = elementMap.get(targetId);

        // Only create connection if both elements exist
        if (sourceElement && targetElement) {
            // Calculate start and end points (center of elements)
            const startPoint = {
                x: sourceElement.x + sourceElement.width / 2,
                y: sourceElement.y + sourceElement.height / 2
            };
            const endPoint = {
                x: targetElement.x + targetElement.width / 2,
                y: targetElement.y + targetElement.height / 2
            };

            // Get intermediate waypoints from XML
            const positionNodes = arcNode.querySelectorAll('graphics > position');
            let waypoints = [startPoint];

            if (positionNodes.length > 0) {
                positionNodes.forEach(posNode => {
                    waypoints.push({
                        x: parseFloat(posNode.getAttribute('x')),
                        y: parseFloat(posNode.getAttribute('y'))
                    });
                });
            }

            waypoints.push(endPoint);

            // Extract label information
            const label = findLabel(arcNode);
            const inscription = label ? label.text : '';
            const labelOffsetX = label ? label.offsetX : null;
            const labelOffsetY = label ? label.offsetY : null;
            const parsedInscription = arcUtils.parseArcInscriptionText(inscription);
            const arcManual = parseBooleanProperty(readToolspecificProperty(arcNode, 'arcManual'), false);

            // Create connection
            const arcId = arcNode.getAttribute('id');
            const connection = elementFactory.createConnection({
                id: arcId,
                type: 'petri:connection',
                waypoints: waypoints,
                source: sourceElement,
                target: targetElement,
                businessObject: {
                    arcInscription: inscription,
                    arcInscriptionVars: parsedInscription.vars,
                    arcManual,
                    ...(labelOffsetX !== null && labelOffsetY !== null && {
                        labelOffset: { x: labelOffsetX, y: labelOffsetY }
                    })
                }
            });

            // Add to canvas
            canvas.addConnection(connection, root);
        }
    }
}
