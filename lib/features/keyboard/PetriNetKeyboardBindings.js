import keyHandlerUtil from '../../helpers/KeyHandler-util.js';

export default class KeyboardShortcuts {

  static $inject = [
    'eventBus',
    'modeling',
    'selection',
    'elementFactory',
    'canvas',
    'idCounterService',
    'commandStack', // diagram-js history service
    'simulationService'

  ];

  constructor(eventBus, modeling, selection, elementFactory, canvas, idCounterService, commandStack, simulationService) {
    this.eventBus = eventBus;
    this.modeling = modeling;
    this.selection = selection;
    this.elementFactory = elementFactory;
    this.canvas = canvas;
    this.idCounterService = idCounterService;
    this.commandStack = commandStack;
    this.simulationService = simulationService;
    
    this._clipboard = []; // Internal clipboard for copy/paste

    this._destroyHotkeys = this._registerHotkeys();
  }

  _registerHotkeys() {
    const when = event => !this._isTextInputActive(event) && this._isCanvasFocused();
    const unregisterHotkeys = [];

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'z',
        modKey: true,
        shiftKey: false,
        when,
        callback: () => this._handleUndo()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'y',
        ctrlKey: true,
        when,
        callback: () => this._handleRedo()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'z',
        metaKey: true,
        shiftKey: true,
        when,
        callback: () => this._handleRedo()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'Delete',
        when,
        callback: () => this._handleDelete()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'Backspace',
        when,
        callback: () => this._handleDelete()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'c',
        modKey: true,
        when,
        callback: () => this._handleCopy()
      })
    );

    unregisterHotkeys.push(
      keyHandlerUtil.registerHotkey({
        key: 'v',
        modKey: true,
        when,
        callback: () => this._handlePaste()
      })
    );

    return () => unregisterHotkeys.forEach(unregister => unregister());
  }

  destroy() {
    this._destroyHotkeys?.();
  }
  
  _isTextInputActive(event) {
    return keyHandlerUtil.isTextInputEvent(event);
  }

  _isCanvasFocused() {
    const canvasContainer = this.canvas.getContainer();
    return keyHandlerUtil.isCanvasFocused(canvasContainer);
  }

  _handleUndo() {
    // When simulation is active, undo steps back in the simulation history instead of undoing modeling changes
    if (this.simulationService?.isSimulationActive()) {
      this.simulationService.stepBack();
      return;
    }

    // Avoid undo calls when history is empty
    if (this.commandStack.canUndo()) {
      this.commandStack.undo();
    }
  }

  _handleRedo() {
    // Avoid no-op redo calls when redo history is empty
    if (this.commandStack.canRedo()) {
      this.commandStack.redo();
    }
  }

  _handleDelete() {
    const selectedElements = this.selection.get();
    while (selectedElements.length > 0) {
      this.modeling.removeElements(selectedElements);
    }
  }

  _handleSelectAll() {
    const root = this.canvas.getRootElement();
    const allElements = this.canvas.getChildren(root);
    this.selection.select(allElements);
  }

  _handleCopy() {
    const selectedElements = this.selection.get();

    if (selectedElements.length > 0) {
      // Copy element data to internal clipboard with all required properties
      this._clipboard = selectedElements
        .filter(element => {
          // Validate element has required properties
          return element &&
            element.type &&
            isFinite(element.x) &&
            isFinite(element.y) &&
            isFinite(element.width) &&
            isFinite(element.height);
        })
        .map(element => ({
          type: element.type,
          x: element.x,
          y: element.y,
          width: element.width,
          height: element.height,
          businessObject: element.businessObject ? { ...element.businessObject } : undefined
        }));

      console.log('Copied', this._clipboard.length, 'elements');
    }
  }

  _handlePaste() {
    if (this._clipboard.length === 0) {
      return;
    }

    const root = this.canvas.getRootElement();
    const pastePosition = this._getPastePosition();

    // Calculate the bounding box of the original elements to maintain relative positioning
    const originalBounds = this._getElementsBounds(this._clipboard);

    // Create new elements from clipboard
    const newElements = [];

    this._clipboard.forEach((elementData, index) => {
      // Calculate relative position from the original group's top-left corner
      const relativeX = elementData.x - originalBounds.x;
      const relativeY = elementData.y - originalBounds.y;

      // Calculate final position with validation
      const finalX = pastePosition.x + relativeX;
      const finalY = pastePosition.y + relativeY;

      // Validate coordinates are finite numbers
      if (!isFinite(finalX) || !isFinite(finalY) || !isFinite(elementData.width) || !isFinite(elementData.height)) {
        console.warn('Skipping element with invalid coordinates:', elementData);
        return;
      }


      let newId;

      if (elementData.type === "petri:transition") {
        newId = this.idCounterService.getNextTransitionId();
      } else {
        newId = this.idCounterService.getNextPlaceId();
      }

      // Create shape with all required properties
      const shape = this.elementFactory.createShape({
        id: newId,
        type: elementData.type,
        x: finalX,
        y: finalY,
        width: elementData.width,
        height: elementData.height,
        businessObject: elementData.businessObject
      });

      const newElement = this.modeling.createShape(shape, { x: finalX, y: finalY }, root);
      newElements.push(newElement);
    });

    // Select the newly pasted elements
    this.selection.select(newElements);

    console.log('Pasted', newElements.length, 'elements');
  }

  _getPastePosition() {
    // Get the first selected element to position paste relative to it
    const selectedElements = this.selection.get();
    if (selectedElements.length > 0) {
      const referenceElement = selectedElements[0];
      return {
        x: referenceElement.x + 100,
        y: referenceElement.y + 50
      };
    }

    // Fallback to viewport center if no selection
    const viewbox = this.canvas.viewbox();
    return {
      x: viewbox.x + viewbox.width / 2,
      y: viewbox.y + viewbox.height / 2
    };
  }

  _getElementsBounds(elements) {
    if (elements.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach(element => {
      minX = Math.min(minX, element.x);
      minY = Math.min(minY, element.y);
      maxX = Math.max(maxX, element.x + element.width);
      maxY = Math.max(maxY, element.y + element.height);
    });

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }
}
