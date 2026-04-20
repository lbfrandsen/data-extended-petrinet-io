import keyHandlerUtil from '../helpers/KeyHandler-util.js';

const text = `
# Documentation and Credits

This editor extends the original petrinet-io project with typed Colored Petri Net features and a database-backed simulation extension for data-aware process modeling.

## Original Creator
- Andrea Burattin

## Extension Creators
- Lucas Bjerg Frandsen
- Joschka Eckert-Boulet
- Elias Storm Vedel Jørgensen

## Capabilities

### 1) Colored Petri Net Capabilities
- Places support explicit type definitions (colors): int, real, bool, string, and tuples like <int,string>.
- Places can also be epsilon typed (empty tuple), represented as e.
- Typed markings are stored per place, and token counts are synchronized from marking content.
- Arc inscriptions define variable bindings per token component (examples: <x>, <x,y>, <>) and support multiplicity with \`^n\` or superscript digits.
- Arc inscriptions are auto-generated from place arity and stay synchronized when place types change.
- Transition guards can be edited and are validated against available variable types from incoming/outgoing arc inscriptions.
- Guard expressions support boolean logic and arithmetic comparisons; invalid guards are rejected.
- Place labels, transition labels, and arc inscription labels are rendered in-canvas, with optional ID label toggling.

### 2) Database Extension (SQL-backed CPN behavior)
The database extension adds query-aware and action-aware transition behavior on top of typed Petri net simulation.

#### Database loading and scope
- You can upload a \`.db\` or \`.sqlite\` file directly in the SQL dialog.
- Once loaded, it becomes the active in-memory database for all SQL queries/actions.
- If no database is loaded, SQL-bound transitions are blocked and report diagnostics.

#### Query authoring and transition binding
- Queries are managed in the QUERIES tab with stable IDs (\`Q1\`, \`Q2\`, ...).
- Query entries are normalized to \`SELECT ...\`; non-SELECT statements are rejected for query guards.
- Any transition can be bound to a query from the transition SQL assignment dialog.
- Bound query IDs are persisted on transition business objects and exported with the model metadata.

#### How queries affect transition enablement
- During simulation, a transition with a bound query is evaluated against current DB state.
- If query evaluation fails (missing DB, empty query, removed query, SQL error), transition enabling fails.
- If a query succeeds, result rows are transformed into variable bindings (column name -> value).
- The transition is enabled only if at least one row can satisfy:
  - Arc-inscription token matching and consumption constraints.
  - Guard evaluation constraints.
  - Output token producibility constraints.

#### Special COUNT semantics
- Queries that match \`SELECT COUNT(...)\` are handled specially.
- They must return exactly one numeric cell.
- That numeric value is exposed as \`queryCount\` in guard evaluation.
- This enables compact guards such as threshold checks using live DB-derived counts.

#### Row-driven execution behavior
- For row-based queries, each row is a candidate binding.
- In fully automatic simulation mode, the engine selects one fireable row randomly.
- In user-driven mode, the UI lets you pick the row and, if configured, manually select consumed tokens.
- This allows deterministic replay-style behavior even when many rows are fireable.

#### SQL actions on transition fire
- Actions are managed in the ACTIONS tab with stable IDs (\`A1\`, \`A2\`, ...).
- Supported action forms are:
  - \`INSERT INTO ... VALUES ...\`
  - \`DELETE FROM ... WHERE ...\`
- One transition can have multiple bound actions.
- When a transition fires, bound actions execute before token state updates.
- If any action fails, firing is aborted and token movement does not proceed.
- Actions are intentionally powerful: they can irreversibly modify the loaded database.

#### Persistence and import/export behavior
- Query/action entries and transition bindings are included in PNML metadata.
- Simulation rule metadata and simulation history state are also persisted.
- The database file itself is not embedded in PNML export.
- After importing PNML, the DB must be uploaded again to restore SQL-backed behavior.

## Simulation Guide

### Simulation mode and firing
- Toggle simulation mode on/off at any time.
- When simulation is active, transition enablement is continuously recalculated.
- Clicking an enabled transition fires it.
- In simulation mode, editing affordances are reduced to prevent accidental model edits.

### Transition colors and meaning
- White: transition is currently not enabled (idle/blocked).
- Light green: transition is enabled and can fire now.
- Plum: transition has fired earlier in the current simulation session, but is not enabled right now.
- Enabled transitions also show a play triangle marker.

### Step-back and reset behavior
- Every successful firing stores a snapshot in simulation history.
- Step-back restores the previous snapshot (tokens + fired-transition state).
- Reset returns all places to the token marking saved at the start of the active simulation run.
- Reset also clears simulation history/fired markers and exits simulation mode.

### Rule-driven token generation and consumption
- Simulation rules support:
  - Random or user-selected token consumption.
  - Random or user-provided output production.
  - Integer/real domains and optional normal-distribution sampling.
  - Regex-constrained string generation.
- Generated output values are checked against type/color and guard constraints.

## Hotkey Guide

### Simulation and view hotkeys
- \`s\`: Toggle simulation mode.
- \`r\`: Reset tokens to initial simulation-state marking and stop simulation.
- \`b\`: Step back one simulation firing (if history exists).
- \`t\`: Toggle ID labels visibility for places/transitions.

### Editing hotkeys
- \`Ctrl+C\` / \`Cmd+C\`: Copy selected elements to internal clipboard.
- \`Ctrl+V\` / \`Cmd+V\`: Paste copied elements with preserved relative layout.
- \`Ctrl+Z\` / \`Cmd+Z\`:
  - In edit mode: undo diagram command history.
  - In simulation mode: performs step-back in simulation history.

### Notes on copy/paste
- Copy/paste is shape-oriented and keeps core shape properties/business object data.
- Pasted elements receive fresh IDs to avoid ID collisions.

(doc is WIP: markdown formatting and content will be refined in the final version)`;

export function getDocumentation() {
  return text;
}

let activeDialog = null;

function removeActiveDialog() {
  if (activeDialog) {
    activeDialog.remove();
    activeDialog = null;
  }
}

// Create overlay and modal container for docs.
function createDocumentationOverlay() {
  removeActiveDialog();

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.35)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const modal = document.createElement('div');
  modal.style.position = 'relative';
  modal.style.width = 'min(1100px, 96vw)';
  modal.style.maxHeight = '88vh';
  modal.style.overflow = 'hidden';
  modal.style.background = '#fff';
  modal.style.borderRadius = '12px';
  modal.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)';
  modal.style.padding = '22px';
  modal.style.fontFamily = 'Arial, sans-serif';
  modal.style.color = '#222';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  activeDialog = overlay;

  return { overlay, modal };
}

function createButtonRow() {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'flex-end';
  row.style.gap = '10px';
  row.style.marginTop = '16px';
  row.style.flex = '0 0 auto';
  return row;
}

function createButton(label, onClick, kind = 'secondary') {
  const button = document.createElement('button');
  button.textContent = label;
  button.type = 'button';
  button.style.padding = '8px 14px';
  button.style.borderRadius = '8px';
  button.style.border = '1px solid #ccc';
  button.style.cursor = 'pointer';
  button.style.fontSize = '14px';

  if (kind === 'primary') {
    button.style.background = '#1976d2';
    button.style.color = '#fff';
    button.style.border = '1px solid #1976d2';
  } else {
    button.style.background = '#f5f5f5';
    button.style.color = '#222';
  }

  button.addEventListener('click', onClick);
  return button;
}

export function showDocumentationDialog() {
  return new Promise(resolve => {
    const { overlay, modal } = createDocumentationOverlay();
    let unregisterEscape = null;
    let closed = false;

    const closeDialog = () => {
      if (closed) {
        return;
      }
      closed = true;
      unregisterEscape?.();
      removeActiveDialog();
      resolve();
    };

    const icon = document.createElement('img');
    icon.src = '/docs_icon.png';
    icon.alt = 'Documentation icon';
    icon.style.position = 'absolute';
    icon.style.top = '16px';
    icon.style.right = '16px';
    icon.style.width = '80px';
    icon.style.height = '80px';
    icon.style.objectFit = 'contain';
    icon.style.pointerEvents = 'none';
    modal.appendChild(icon);

    const title = document.createElement('h2');
    title.textContent = 'Documentation and Credit';
    title.style.margin = '0 0 14px 0';
    title.style.fontSize = '22px';
    title.style.paddingRight = '96px';
    title.style.minHeight = '84px';
    modal.appendChild(title);

    const divider = document.createElement('div');
    divider.style.width = '100%';
    divider.style.height = '1px';
    divider.style.background = '#e0e0e0';
    divider.style.margin = '0 0 14px 0';
    divider.style.flex = '0 0 auto';
    modal.appendChild(divider);

    const content = document.createElement('div');
    content.textContent = getDocumentation();
    content.style.whiteSpace = 'pre-wrap';
    content.style.lineHeight = '1.45';
    content.style.overflow = 'auto';
    content.style.padding = '2px 4px 2px 0';
    content.style.flex = '1 1 auto';
    modal.appendChild(content);

    const buttons = createButtonRow();
    const closeButton = createButton('Close', closeDialog, 'primary');
    buttons.appendChild(closeButton);
    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeDialog();
      }
    });

    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: document,
      key: 'Escape',
      when: () => activeDialog === overlay,
      callback: closeDialog
    });

    closeButton.focus();
  });
}
