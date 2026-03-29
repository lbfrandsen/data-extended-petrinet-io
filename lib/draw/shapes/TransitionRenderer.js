/**
 * Handles drawing and path calculation for Petri net transitions (rectangles)
 */
import { create as svgCreate, attr as svgAttr, append as svgAppend } from 'tiny-svg';
import { componentsToPath } from 'diagram-js/lib/util/RenderUtil.js';
import { drawPlayTriangle } from '../helpers/PlayTriangleHelper.js';
import { promptAndSetGuard } from '../../providers/GuardProvider.js';


// Draw a transition (rectangle) on the canvas
export function drawTransition(parentGfx, element, styles, simulationService) {
  const { width, height } = element;
  const isEnabled = simulationService.isTransitionEnabled(element);
  const isFired = simulationService.isTransitionFired(element);

  // Determine fill color based on simulation state
  let fillColor = 'white';
  if (isEnabled) {
    fillColor = 'lightgreen';
  } else if (isFired && !isEnabled) {
    fillColor = 'plum';
  }

  // Set rectangle style
  const attrs = styles.computeStyle({}, {
    stroke: '#000000',
    strokeWidth: 2,
    fill: fillColor
  });

  if (attrs.fill === 'none') {
    delete attrs.fillOpacity;
  }

  // Create and append rectangle
  const rect = svgCreate('rect');
  svgAttr(rect, { x: 0, y: 0, width, height, rx: 0, ry: 0 });
  svgAttr(rect, attrs);
  svgAppend(parentGfx, rect);

  // Draw play triangle if transition is enabled
  if (isEnabled) {
    drawPlayTriangle(parentGfx, width, height, styles);
  }

  // Draw guard text under the transition
  drawGuardText(parentGfx, element, width, height);

  return rect;
}

// Renders the transition guard text.
function drawGuardText(parentGfx, element, width, height) {
  const bo = element.businessObject || {};
  const guardExpression = String(bo.guardExpression ?? '').trim();

  var lines;
  if (!guardExpression) {
    lines = ['[ ]'];
  } else {
    lines = formatGuardForDisplay(guardExpression);
    if (lines.length === 0) {
      return;
    }
  }

  const text = svgCreate('text');

  svgAttr(text, {
    x: width / 2,
    y: -lines.length*12 - 15,
    fill: '#888888',
    fontSize: '10px',
    textAnchor: 'middle',
    pointerEvents: 'all'
  });

  for (let i = 0; i < lines.length; i++) {
    appendTspan(text, {
      x: width / 2,
      dy: i === 0 ? 0 : 12,
      text: lines[i]
    });
  }

    text.addEventListener('dblclick', event => {
    event.stopPropagation();
    promptAndSetGuard(element);
  });
  svgAppend(parentGfx, text);
}

function appendTspan(textNode, { x, dy, text }) {
  const tspan = svgCreate('tspan');
  svgAttr(tspan, { x, dy });
  tspan.textContent = text;
  svgAppend(textNode, tspan);
}

/**
 * Turns:
 *   x > 5 || y = true && z = "a"
 *
 * into:
 *   ( x > 5
 *     || y = true
 *     && z = "a" )
 *
 * This preserves the visible difference between && and ||.
 * It does not try to parse nested parentheses semantically.
 */
function formatGuardForDisplay(guard) {
  const trimmed = String(guard || '').trim();

  if (!trimmed) {
    return [];
  }

  const parts = trimmed
    .split(/(\s*\&\&\s*|\s*\|\|\s*)/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return [];
  }

  const lines = [];

  // First clause
  lines.push(`( ${parts[0]}`);

  // Remaining operator + clause pairs
  for (let i = 1; i < parts.length; i += 2) {
    const op = parts[i];
    const clause = parts[i + 1];

    if (!clause) {
      continue;
    }

    const isLast = i + 1 >= parts.length - 1;
    lines.push(`  ${op} ${clause}${isLast ? ' )' : ''}`);
  }

  // If there was only one clause, close the parenthesis on same line
  if (parts.length === 1) {
    lines[0] = `${lines[0]} )`;
  }

  return lines;
}

// Get the SVG path for a transition (used for hit detection)
export function getTransitionPath(shape) {
  let x = shape.x;
  let y = shape.y;
  let width = shape.width;
  let height = shape.height;

  // Define rectangle path
  const rectPath = [
    ['M', x, y],
    ['l', width, 0],
    ['l', 0, height],
    ['l', -width, 0],
    ['z']
  ];

  return componentsToPath(rectPath);
}

