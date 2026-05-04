/**
 * Parses PNML transition elements and creates diagram shapes
 */
function readToolspecificProperty(node, key) {
    const toolspecific = node.querySelector('toolspecific[tool="petrinet.io"]');
    if (!toolspecific) {
        return null;
    }

    const propertyNode = toolspecific.querySelector(`property[key="${key}"]`);
    if (!propertyNode) {
        return null;
    }

    const textNode = propertyNode.querySelector('text');
    if (textNode) {
        return textNode.textContent || null;
    }

    return propertyNode.getAttribute('value') || null;
}

export default class TransitionParser {
    // Parse transition XML node and create transition shape
    static parse(transitionNode, elementFactory, canvas, root, defaultPnml, findLabel, { importQueryBindings = true } = {}) {
        // Extract attributes from XML
        const id = transitionNode.getAttribute('id');
        const positionNode = transitionNode.querySelector('graphics > position');
        const dimensionNode = transitionNode.querySelector('graphics > dimension');

        // Get position and dimensions (with defaults)
        const x = positionNode ? parseFloat(positionNode.getAttribute('x')) : 100;
        const y = positionNode ? parseFloat(positionNode.getAttribute('y')) : 100;
        const width = defaultPnml ? 70 : (dimensionNode ? parseFloat(dimensionNode.getAttribute('x')) : 70);
        const height = defaultPnml ? 70 : (dimensionNode ? parseFloat(dimensionNode.getAttribute('y')) : 70);

        // Extract label information
        const label = findLabel(transitionNode);
        const name = label ? label.text : '';
        const labelOffsetX = label ? label.offsetX : null;
        const labelOffsetY = label ? label.offsetY : null;

        const guardExpression = readToolspecificProperty(transitionNode, 'guardExpression');
        const queryGuardId = importQueryBindings
            ? readToolspecificProperty(transitionNode, 'queryGuardId')
            : null;
        const actionId = importQueryBindings
            ? readToolspecificProperty(transitionNode, 'actionId')
            : null;

        // Create transition shape
        const transition = elementFactory.createShape({
            id: id,
            type: 'petri:transition',
            x: x,
            y: y,
            width: width,
            height: height,
            businessObject: {
                name: name,
                ...(labelOffsetX !== null && labelOffsetY !== null && {
                    labelOffset: { x: labelOffsetX, y: labelOffsetY }
                }),
                ...(guardExpression ? { guardExpression: guardExpression } : {}),
                ...(queryGuardId ? { queryGuardId: queryGuardId } : {}),
                ...(actionId ? { actionId: actionId } : {})
            }
        });

        // Add to canvas and return
        canvas.addShape(transition, root);
        return transition;
    }
}
