import keyHandlerUtil from '../helpers/KeyHandler-util.js';

const html = `
<h1>Documentation and Credits</h1>
<p>This editor extends the original petrinet-io project with typed Colored Petri Net features and a database-backed simulation extension for data-aware process modeling.</p>

<h2>Original Creator</h2>
<ul>
  <li>Andrea Burattin</li>
</ul>

<h2>Extension Creators</h2>
<ul>
  <li>Lucas Bjerg Frandsen</li>
  <li>Joschka Eckert-Boulet</li>
  <li>Elias Storm Vedel Jørgensen</li>
</ul>

<h2>Capabilities</h2>

<h3>1) Colored Petri Net Capabilities</h3>
<ul>
  <li>Places support explicit type definitions (colors): int, real, bool, string, and tuples like <code>&lt;int,string&gt;</code>.</li>
  <li>Places can also be epsilon typed (empty tuple), represented as <code>e</code>.</li>
  <li>Typed markings are stored per place, and token counts are synchronized from marking content.</li>
  <li>Arc inscriptions define variable bindings per token component (examples: <code>&lt;x&gt;</code>, <code>&lt;x,y&gt;</code>, <code>&lt;&gt;</code>) and support multiplicity with <code>^n</code> or superscript digits.</li>
  <li>Arc inscriptions are auto-generated from place arity and stay synchronized when place types change.</li>
  <li>Transition guards can be edited and are validated against available variable types from incoming/outgoing arc inscriptions.</li>
  <li>Guard expressions support boolean logic and arithmetic comparisons; invalid guards are rejected.</li>
  <li>Place labels, transition labels, and arc inscription labels are rendered in-canvas, with optional ID label toggling.</li>
</ul>

<h3>2) Database Extension (SQL-backed CPN behavior)</h3>
<p>The database extension adds query-aware and action-aware transition behavior on top of typed Petri net simulation.</p>

<h4>Database loading and scope</h4>
<ul>
  <li>You can upload a <code>.db</code> or <code>.sqlite</code> file directly in the SQL dialog.</li>
  <li>Once loaded, it becomes the active in-memory database for all SQL queries/actions.</li>
  <li>If no database is loaded, SQL-bound transitions are blocked and report diagnostics.</li>
</ul>

<h4>Query authoring and transition binding</h4>
<ul>
  <li>Queries are managed in the QUERIES tab with stable IDs (<code>Q1</code>, <code>Q2</code>, ...).</li>
  <li>Query entries are normalized to <code>SELECT ...</code>; non-SELECT statements are rejected for query guards.</li>
  <li>Any transition can be bound to a query from the transition SQL assignment dialog.</li>
  <li>Bound query IDs are persisted on transition business objects and exported with the model metadata.</li>
</ul>

<h4>How queries affect transition enablement</h4>
<ul>
  <li>During simulation, a transition with a bound query is evaluated against current DB state.</li>
  <li>If query evaluation fails (missing DB, empty query, removed query, SQL error), transition enabling fails.</li>
  <li>If a query succeeds, result rows are transformed into variable bindings (column name -&gt; value).</li>
  <li>The transition is enabled only if at least one row can satisfy:
    <ul>
      <li>Arc-inscription token matching and consumption constraints.</li>
      <li>Guard evaluation constraints.</li>
      <li>Output token producibility constraints.</li>
    </ul>
  </li>
</ul>

<h4>Special COUNT semantics</h4>
<ul>
  <li>Queries that match <code>SELECT COUNT(...)</code> are handled specially.</li>
  <li>They must return exactly one numeric cell.</li>
  <li>That numeric value is exposed as <code>queryCount</code> in guard evaluation.</li>
  <li>This enables compact guards such as threshold checks using live DB-derived counts.</li>
</ul>

<h4>Row-driven execution behavior</h4>
<ul>
  <li>For row-based queries, each row is a candidate binding.</li>
  <li>In fully automatic simulation mode, the engine selects one fireable row randomly.</li>
  <li>In user-driven mode, the UI lets you pick the row and, if configured, manually select consumed tokens.</li>
  <li>This allows deterministic replay-style behavior even when many rows are fireable.</li>
</ul>

<h4>SQL actions on transition fire</h4>
<ul>
  <li>Actions are managed in the ACTIONS tab with stable IDs (<code>A1</code>, <code>A2</code>, ...).</li>
  <li>Supported action forms are:
    <ul>
      <li><code>INSERT INTO ... VALUES ...</code></li>
      <li><code>DELETE FROM ... WHERE ...</code></li>
    </ul>
  </li>
  <li>One transition can have multiple bound actions.</li>
  <li>When a transition fires, bound actions execute before token state updates.</li>
  <li>If any action fails, firing is aborted and token movement does not proceed.</li>
  <li>Actions are intentionally powerful: they can irreversibly modify the loaded database.</li>
</ul>

<h4>Persistence and import/export behavior</h4>
<ul>
  <li>Query/action entries and transition bindings are included in PNML metadata.</li>
  <li>Simulation rule metadata and simulation history state are also persisted.</li>
  <li>The database file itself is not embedded in PNML export.</li>
  <li>After importing PNML, the DB must be uploaded again to restore SQL-backed behavior.</li>
</ul>

<h2>Simulation Guide</h2>

<h3>Simulation mode and firing</h3>
<ul>
  <li>Toggle simulation mode on/off at any time.</li>
  <li>When simulation is active, transition enablement is continuously recalculated.</li>
  <li>Clicking an enabled transition fires it.</li>
  <li>In simulation mode, editing affordances are reduced to prevent accidental model edits.</li>
</ul>

<h3>Transition colors and meaning</h3>
<ul>
  <li>White: transition is currently not enabled (idle/blocked).</li>
  <li>Light green: transition is enabled and can fire now.</li>
  <li>Plum: transition has fired earlier in the current simulation session, but is not enabled right now.</li>
  <li>Enabled transitions also show a play triangle marker.</li>
</ul>

<h3>Step-back and reset behavior</h3>
<ul>
  <li>Every successful firing stores a snapshot in simulation history.</li>
  <li>Step-back restores the previous snapshot (tokens + fired-transition state).</li>
  <li>Reset returns all places to the token marking saved at the start of the active simulation run.</li>
  <li>Reset also clears simulation history/fired markers and exits simulation mode.</li>
</ul>

<h3>Rule-driven token generation and consumption</h3>
<ul>
  <li>Simulation rules support:
    <ul>
      <li>Random or user-selected token consumption.</li>
      <li>Random or user-provided output production.</li>
      <li>Integer/real domains and optional normal-distribution sampling.</li>
      <li>Regex-constrained string generation.</li>
    </ul>
  </li>
  <li>Generated output values are checked against type/color and guard constraints.</li>
</ul>

<h2>Hotkey Guide</h2>

<h3>Simulation and view hotkeys</h3>
<ul>
  <li><code>s</code>: Toggle simulation mode.</li>
  <li><code>r</code>: Reset tokens to initial simulation-state marking and stop simulation.</li>
  <li><code>b</code>: Step back one simulation firing (if history exists).</li>
  <li><code>t</code>: Toggle ID labels visibility for places/transitions.</li>
</ul>

<h3>Editing hotkeys</h3>
<ul>
  <li><code>Ctrl+C</code> / <code>Cmd+C</code>: Copy selected elements to internal clipboard.</li>
  <li><code>Ctrl+V</code> / <code>Cmd+V</code>: Paste copied elements with preserved relative layout.</li>
  <li><code>Ctrl+Z</code> / <code>Cmd+Z</code>:
    <ul>
      <li>In edit mode: undo diagram command history.</li>
      <li>In simulation mode: performs step-back in simulation history.</li>
    </ul>
  </li>
</ul>

<h3>Notes on copy/paste</h3>
<ul>
  <li>Copy/paste is shape-oriented and keeps core shape properties/business object data.</li>
  <li>Pasted elements receive fresh IDs to avoid ID collisions.</li>
</ul>
`;

export function getDocumentation() {
  return html;
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
    content.innerHTML = getDocumentation();
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
