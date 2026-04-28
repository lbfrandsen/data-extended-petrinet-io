import * as getters from '../helpers/getters.js';
import * as arcUtils from '../helpers/arc-utils.js';

function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function getElementName(element) {
  return String(element?.businessObject?.name || element?.id || '');
}

function downloadJson(filename, payload) {
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default class SimulationRoadmapExportService {
  constructor(simulationService, elementRegistry, sqlDialogService) {
    this.simulationService = simulationService;
    this.elementRegistry = elementRegistry;
    this.sqlDialogService = sqlDialogService;
  }

  buildExportJson() {
    const timelineState = this.simulationService.getTimelineState();
    const places = getters.getPlaces(this.elementRegistry);
    const transitions = getters.getTransitions(this.elementRegistry);
    const allElements = this.elementRegistry.getAll();
    const arcs = allElements.filter((element) => element?.waypoints && element?.source && element?.target);

    const netPlaces = places.map((place) => ({
      id: place.id,
      name: getElementName(place),
      types: getters.getPlaceType(place)
    }));

    const netTransitions = transitions.map((transition) => ({
      id: transition.id,
      name: getElementName(transition),
      guard: {
        text: this.simulationService.getTransitionGuardExpression(transition)
      },
      bindings: {
        queryId: this.sqlDialogService?.getBoundQueryIdForTransition?.(transition) || null,
        actionIds: this.sqlDialogService?.getBoundActionIdsForTransition?.(transition) || []
      }
    }));

    const netArcs = arcs.map((arc) => {
      const parsed = arcUtils.parseArcInscriptionSpec(arc);
      return {
        id: arc.id,
        sourceId: arc.source?.id || null,
        targetId: arc.target?.id || null,
        inscription: {
          text: parsed?.text || '',
          vars: Array.isArray(parsed?.vars) ? parsed.vars : [],
          multiplicity: Number(parsed?.multiplicity || 1)
        }
      };
    });

    const timeline = timelineState.stepHistory.map((snapshot, step) => {
      const placeMarkings = places.map((place) => {
        const saved = snapshot.markings.get(place.id) || [];
        const tokens = Array.isArray(saved) ? saved : [];

        return {
          id: place.id,
          name: getElementName(place),
          types: getters.getPlaceType(place),
          tokens: tokens.map((token, index) => ({
            index,
            value: cloneValue(token)
          })),
          tokenCount: tokens.length
        };
      });

      const transitionState = transitions.map((transition) => ({
        id: transition.id,
        name: getElementName(transition),
        guard: this.simulationService.getTransitionGuardExpression(transition),
        queryId: this.sqlDialogService?.getBoundQueryIdForTransition?.(transition) || null,
        actionIds: this.sqlDialogService?.getBoundActionIdsForTransition?.(transition) || [],
        firedBeforeOrAtStep: (snapshot.firedTransitions || []).includes(transition.id)
      }));

      return {
        step,
        firedTransitionId: step === 0 ? null : (timelineState.executionLog[step - 1] || null),
        firedTransitionsUpToStep: Array.isArray(snapshot.firedTransitions) ? [...snapshot.firedTransitions] : [],
        marking: {
          places: placeMarkings
        },
        transitions: transitionState
      };
    });

    return {
      schemaVersion: 'simulation-roadmap-export/v1',
      meta: {
        exportedAt: new Date().toISOString(),
        app: {
          name: 'petrinet-io'
        },
        simulation: {
          active: timelineState.active,
          currentStepIndex: timelineState.currentStepIndex,
          totalSteps: timelineState.executionLog.length
        }
      },
      net: {
        places: netPlaces,
        transitions: netTransitions,
        arcs: netArcs
      },
      timeline
    };
  }

  exportToDownload() {
    const now = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `simulation-roadmap-${now}.json`;
    const payload = this.buildExportJson();
    downloadJson(filename, payload);
    return filename;
  }
}
