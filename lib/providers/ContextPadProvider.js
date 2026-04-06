import { initializeArcInscription, registerArcInscriptionSync } from '../providers/ArcInscriptionProvider.js';
import { promptAndSetGuard } from './GuardProvider.js';
export default class CustomContextPadProvider {

  static $inject = [
    "eventBus",
    "connect",
    "contextPad",
    "modeling",
    "elementFactory",
    "create",
    "popupMenu",
    "idCounterService",
    "selection",
    "simulationService",
    "directEditing",
    "placeTypingProvider"
  ];

  constructor(eventBus, connect, contextPad, modeling, elementFactory, create, popupMenu, idCounterService, selection, simulationService, directEditing, placeTypingProvider) {
    this.eventBus = eventBus;
    this.connect = connect;
    this.modeling = modeling;
    this.elementFactory = elementFactory;
    this.create = create;
    this.popupMenu = popupMenu;
    this.idCounterService = idCounterService;
    this.selection = selection;
    this.simulationService = simulationService;
    this.directEditing = directEditing;
    this.placeTypingProvider = placeTypingProvider;
    registerArcInscriptionSync(eventBus);
    contextPad.registerProvider(this);
  }


  getContextPadEntries(element) {

    if (this.simulationService.isActive) return;

    const { connect, modeling, elementFactory } = this;
    const removeElement = () => { modeling.removeElements([element]) };
    const startConnect = (event, element, autoActivate) => { connect.start(event, element, autoActivate); }

    const createAdjacent = (type) => {
      this.directEditing.complete();
      const parent = element.parent;
      if (!parent) return;

      const defaultSizes = {
        "petri:transition": { width: 40, height: 40 },
        "petri:place": { width: 30, height: 30 }
      };

      const size = defaultSizes[type] || { width: 40, height: 40 };

      // choose side based on connections: right if outgoing present (or none), left if only incoming
      const hasOutgoing = Array.isArray(element.outgoing) && element.outgoing.length > 0;
      const hasIncoming = Array.isArray(element.incoming) && element.incoming.length > 0;
      const placeRight = !hasOutgoing || hasIncoming;

      // compute CENTER coordinates for createShape position
      const centerY = element.y + element.height / 2;
      const centerX = placeRight
        ? element.x + element.width + 50 + size.width / 2
        : element.x - 30 - size.width / 2;

      // create shape with auto-generated ID
      const shapeConfig = {
        id: this.idCounterService.getNextId(type),
        type,
        width: size.width,
        height: size.height
      };

      // Add businessObject for places
      if (type === 'petri:place') {
        shapeConfig.businessObject = { tokens: 0, placeType: null, marking: [] };
      }

      const shape = elementFactory.createShape(shapeConfig);
      const created = modeling.createShape(shape, { x: centerX, y: centerY }, parent);

      // after transition is added, activate direct editing
      if (type === 'petri:transition') {
        created.businessObject = {};
        created.businessObject.name = this.idCounterService.getNextTransitionLabel();
        this.directEditing.activate(created);
        this.eventBus.fire('element.changed', { element: created });
      }

      // connect selected element -> newly created element
      const connection = modeling.createConnection(
        element,
        created,
        { type: 'petri:connection', id: this.idCounterService.getNextConnectionId() },
        parent
      );
      initializeArcInscription(connection, this.eventBus);

      this.selection.select(created);
    };

    const entries = {
      delete: {
        group: 'edit',
        className: 'bpmn-icon-trash',
        title: 'Remove',
        action: {
          click: removeElement,
          dragstart: removeElement
        }
      },
      connect: {
        group: 'edit',
        className: 'bpmn-icon-connection',
        title: 'Connect',
        action: {
          click: startConnect,
          dragstart: startConnect
        }
      },
    };

    if (element.type === 'petri:place') {
      entries.transition = {
        group: 'edit',
        className: 'bpmn-icon-task',
        title: 'Create transition',
        action: {
          click: () => createAdjacent('petri:transition')
        }
      },  // Add gear icon for setting type only for places
        entries.setType = {
          group: 'tools',
          className: 'bpmn-icon-service',
          title: 'Set type',
          action: {
            click: () => {
              this.placeTypingProvider.promptAndSetPlaceType(element);
            }
          }
        };
    } else if (element.type === 'petri:transition') {
      entries.place = {
        group: 'edit',
        className: 'bpmn-icon-start-event-none',
        title: 'Create place',
        action: {
          click: () => createAdjacent('petri:place')
        }
      },
        entries.setGuard = {
          group: 'tools',
          className: 'bpmn-icon-gateway-parallel',
          title: 'Set guards',
          action: {
            click: () => {
              promptAndSetGuard(element, this.eventBus);
            }
          }
        },
          entries.setSqlQuery = {
            group: 'tools',
            className: 'bpmn-icon-data-store',
            title: 'Set queries',
            action: {
              click: () => {
                this.eventBus.fire('sqlDialog.open', { element });
              }
            }
          }
        ;
    }

    // Add tool icon for all element types
    entries.tool = {
      group: 'tools',
      className: 'bpmn-icon-screw-wrench',
      title: 'Tool action',
      action: {
        click: (event) => {
          const position = {
            x: event.x || event.clientX,
            y: event.y || event.clientY
          };

          this.popupMenu.open(element, 'menu', position);
        }
      }
    };

    return entries;
  }
}
