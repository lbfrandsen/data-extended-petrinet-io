import { showAlert, showPrompt } from '../../services/DialogService.js';
import * as getters from '../../helpers/getters.js';
import * as arcUtils from '../../helpers/arc-utils.js';
import * as placeTypeUtils from '../../helpers/placeTypeUtils.js'
import * as tokenValidationUtils from '../../helpers/tokenValidationUtils.js'
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
    if (element.type !== 'petri:place' && element.type !== 'petri:transition' && element.type !== 'petri:connection') {
      return null;
    }

    const text = element.businessObject?.name || '';
    const viewbox = this.canvas.viewbox();
    const zoom = viewbox.scale || 1;

    if (element.type === 'petri:connection') {
      const waypoints = element.waypoints || [];
      const mid = waypoints[Math.floor(waypoints.length / 2)] || { x: 0, y: 0 };

      return {
        bounds: {
          x: mid.x * zoom - viewbox.x * zoom - 40,
          y: mid.y * zoom - viewbox.y * zoom - 12,
          width: 80,
          height: 24
        },
        text: element.businessObject?.arcInscription || '',
        style: {
          fontFamily: 'Arial, sans-serif',
          fontSize: 12 * zoom + 'px'
        }
      };
    }

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
    } else if (element.type === 'petri:connection') {
      const parsed = arcUtils.parseInscriptionLine(newText, element)
      if (!parsed) return;

      const siblings = getters.getSiblingConnections(element);
      const place = getters.getPlaceForConnection(element);
      const types = placeTypeUtils.parsePlaceTypeFromBusinessObject(place?.businessObject);

      for (const conn of siblings) {

        if (conn === element) continue;

        const vars = conn.businessObject?.arcInscriptionVars || [];

        const otherPlace = getters.getPlaceForConnection(conn);
        const otherTypes = placeTypeUtils.parsePlaceTypeFromBusinessObject(otherPlace?.businessObject);

        for (let i = 0; i < parsed.vars.length; i++) {
          for (let j = 0; j < vars.length; j++) {

            if (parsed.vars[i] === vars[j] && types[i] !== otherTypes[j]) {
              showAlert({
                title: 'Variable name conflict',
                message: `Variable "${parsed.vars[i]}" is already used with a different type on this transition. Please choose a different variable name or ensure the types match.`
              });
            }

          }
        }
      }

      element.businessObject.arcManual = true;
      element.businessObject.arcInscription = parsed.text;
      element.businessObject.arcInscriptionVars = parsed.vars;
    }
    this.eventBus.fire('element.changed', { element });
  }

  async addTokenPopup(place) {
    if (!place.businessObject) place.businessObject = {};
    if (!Array.isArray(place.businessObject.marking)) place.businessObject.marking = [];

    // Keep manual token insertion consistent with simulation token storage.
    const createStoredTokenFromValues = (values, typeArr) => {
      if (typeArr.length === 0) return [];
      if (typeArr.length === 1) return values[0];
      return values;
    };

    // A missing placeType is treated as epsilon (typeless), not as an error.
    const typeKey = placeTypeUtils.getRawPlaceType(place.businessObject) ?? '';

    // ε token
    if (typeKey === '') {
      place.businessObject.marking.push(createStoredTokenFromValues([], []));
      place.businessObject.tokens = place.businessObject.marking.length;
      this.eventBus.fire('element.changed', { element: place });
      if (this.simulationService.isActive) this.simulationService.updateEnabledTransitions();
      return;
    }

    const typeArr = placeTypeUtils.parseType(typeKey);

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
    const check = tokenValidationUtils.validateValuesAgainstType(typeArr, rawParts);

    if (!check.ok) {
      showAlert({
        title: 'Invalid token values',
        message: "Invalid token values for type <" + typeArr.join(',') + ">: "
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
    // Store as scalar for single-color places and as tuple-array for product types.
    place.businessObject.marking.push(createStoredTokenFromValues(values, typeArr));
    place.businessObject.tokens = place.businessObject.marking.length;

    this.eventBus.fire('element.changed', { element: place });
    if (this.simulationService.isActive) this.simulationService.updateEnabledTransitions();
  }

}
