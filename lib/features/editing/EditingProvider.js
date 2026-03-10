import { parseType, validateValuesAgainstType } from '../../helpers/token-types.js';
import { showAlert, showPrompt } from '../../services/DialogService.js';
export default class EditingProvider {

  static $inject = ['eventBus', 'directEditing', 'canvas', 'simulationService'];

  constructor(eventBus, directEditing, canvas, simulationService) {
    this.eventBus = eventBus;
    this.directEditing = directEditing;
    this.canvas = canvas;
    this.simulationService = simulationService;

    directEditing.registerProvider(this);

    eventBus.on('element.dblclick', 1000, (event) => {
      const element = event && event.element;

      if (!element) return;

      if (element.type == "petri:transition" && this.simulationService.isActive) {
        return;
      }

      if (element.type === "petri:place") {
        this.addTokenPopup(element);
        return;
      }

      this.directEditing.activate(element);
    });

    // Intercept clicks outside the editing box to complete instead of cancel
    eventBus.on('element.mousedown', 1500, (event) => {
      if (directEditing.isActive()) {
        // Complete the editing to save the text
        directEditing.complete();
      }
    });

  }

  activate(element) {
    if (element.type !== 'petri:place' && element.type !== 'petri:transition') {
      return null;
    }

    const text = element.businessObject?.name || '';
    const viewbox = this.canvas.viewbox();
    const zoom = viewbox.scale || 1;

    return {
      bounds: {
        x: element.x * zoom - viewbox.x * zoom,
        y: element.y * zoom - viewbox.y * zoom,
        width: element.width * zoom,
        height: element.height * zoom
      },
      text: text,
      style: {
        fontFamily: 'Arial, sans-serif',
        fontSize: "12" * zoom + "px",
      }
    };
  }

  update(element, newText, oldText, bounds) {
    if (element.type === "petri:transition") {
      if (!element.businessObject) {
        element.businessObject = {};
      }
      element.businessObject.name = newText;
    } else if (element.type === "petri:place") {
      // const updateTokens = newText;
      // if (updateTokens !== null) {
      //   // Convert to number and validate
      //   const tokenCount = parseInt(updateTokens, 10);
      //   if (!isNaN(tokenCount) && tokenCount >= 0) {
      //     element.businessObject.tokens = tokenCount;
      //     this.eventBus.fire('element.changed', { element });
      //     if (this.simulationService.isActive) {
      //       this.simulationService.updateEnabledTransitions();
      //     }
      //   } else {
      //     alert("Please enter a valid number of tokens (0 or greater)");
      //   }
      // }
    }
    this.eventBus.fire('element.changed', { element });
  }

  async addTokenPopup(place) {
    if (!place.businessObject) place.businessObject = {};
    if (!Array.isArray(place.businessObject.types)) place.businessObject.types = [];
    if (!Array.isArray(place.businessObject.marking)) place.businessObject.marking = [];

    const types = place.businessObject.types;
    const msg = 'This place has no types. Create the place again or add typing first.'

    if (types.length === 0) {
      showAlert({
        title: 'No types defined',
        message: msg
      });
      return;
    }

    const typeMenu = types
      .map((tk, i) => {
        const label = tk === '' ? 'ε (<>)' : `<${tk.split('*').join(',')}>`;
        return `${i + 1}: ${label}`;
      })
      .join('\n');

    const pick = await showPrompt({
      title: 'Add token',
      message: `Select token type by number:\n\n${typeMenu}`,
      initialValue: '1'
    });

    if (pick === null) return;

    const idx = parseInt(pick, 10) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= types.length) {
      showAlert({
        title: 'Invalid selection',
        message: 'Please enter a valid number corresponding to the token type.'
      });
      return;
    }

    const typeKey = types[idx];

    // ε token
    if (typeKey === '') {
      place.businessObject.marking.push({ type: '', value: [] });
      place.businessObject.tokens = place.businessObject.marking.length;
      this.eventBus.fire('element.changed', { element: place });
      if (this.simulationService.isActive) this.simulationService.updateEnabledTransitions();
      return;
    }

    const typeArr = parseType(typeKey);

    const valueStr = await showPrompt({
      title: 'Enter token values',
      message:
        `Enter token values for type <${typeArr.join(',')}>.\n` +
        `Use comma-separated values.\n` +
        `Examples:\n` +
        `int -> 4\n` +
        `bool -> true\n` +
        `string -> "hello"\n` +
        `int,string -> 4, "hello"\n`,
      initialValue: ''
    });

    if (valueStr === null) return;

    const rawParts = valueStr.split(',').map(s => s.trim());

    // Validate RAW input first (so strings must still be quoted here)
    const check = validateValuesAgainstType(typeArr, rawParts);
    if (!check.ok) {
      showAlert({
        title: 'Invalid token values',
        message: check.error
      });
      return;
    }

    // Convert AFTER validation
    const values = rawParts.map((raw, i) => {
      const c = typeArr[i];
      const s = String(raw).trim();

      if (c === 'int') return Number(s);
      if (c === 'real') return Number(s);
      if (c === 'bool') return /^true$/i.test(s);
      if (c === 'string') return s.slice(1, -1); // strip the surrounding "

      return s;
    });
    place.businessObject.marking.push({ type: typeKey, value: values });
    place.businessObject.tokens = place.businessObject.marking.length;

    this.eventBus.fire('element.changed', { element: place });
    if (this.simulationService.isActive) this.simulationService.updateEnabledTransitions();
  }

}

