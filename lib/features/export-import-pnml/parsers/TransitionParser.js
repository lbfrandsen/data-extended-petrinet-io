/**
 * Parses PNML transition elements and creates diagram shapes
 */
export default class TransitionParser {
    // Parse transition XML node and create transition shape
    static parse(transitionNode, elementFactory, canvas, root, defaultPnml, findLabel) {
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
                })
            }
        });

        // Add to canvas and return
        canvas.addShape(transition, root);
        return transition;
    }
}
