import keyHandlerUtil from '../helpers/KeyHandler-util.js';

const DEMO_GRAPHS_URL = 'https://drive.google.com/drive/folders/1UxDIrCZoKsmTPYRscQlN1PeOt96CPulP?usp=sharing';

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

<h2>Demo Graphs</h2>
<p>Ready-made example models are available here: <a href="${DEMO_GRAPHS_URL}" target="_blank" rel="noopener noreferrer">Demo Graphs on Google Drive</a>.</p>

<h2>Capabilities</h2>

<h3>1) Colored Petri Net Features</h3>
<ul>
  <li>Places support explicit type definitions (colors): <code>int</code>, <code>real</code>, <code>bool</code>, <code>string</code>, and tuple types like <code>&lt;int,string&gt;</code>.</li>
  <li>Places can also be epsilon typed (empty tuple), represented as <code>e</code>.</li>
  <li>Typed markings are stored per place, and token counts are synchronized from marking content.</li>
  <li>Arc inscriptions define variable bindings per token component (examples: <code>&lt;x&gt;</code>, <code>&lt;x,y&gt;</code>, <code>&lt;&gt;</code>) and support multiplicity with <code>^n</code> or superscript digits.</li>
  <li>Arc inscriptions are auto-generated from place arity and stay synchronized when place types change.</li>
  <li>Transition guards can be edited and are validated against variable types from incoming/outgoing arc inscriptions.</li>
  <li>Guard expressions support boolean logic and arithmetic comparisons; invalid guards are rejected.</li>
  <li>Place labels, transition labels, and arc inscription labels are rendered in-canvas, with optional ID label toggling (<code>t</code>).</li>
</ul>

<h3>2) Database Extension (SQL-backed CPN behavior)</h3>
<p>The database extension adds query-aware and action-aware transition behavior on top of typed Petri net simulation.</p>

<h4>Database loading and scope</h4>
<ul>
  <li>Upload a <code>.db</code> or <code>.sqlite</code> file using the SQL dialog (click any transition to open it).</li>
  <li>Once loaded, the database becomes active for all SQL queries and actions during simulation.</li>
  <li>If no database is loaded, SQL-bound transitions are blocked and display a diagnostic message when clicked.</li>
</ul>

<h4>Query authoring and transition binding</h4>
<ul>
  <li>Queries are managed in the QUERIES tab with stable IDs (<code>Q1</code>, <code>Q2</code>, ...).</li>
  <li>Only <code>SELECT ...</code> statements are accepted; other statement types are rejected.</li>
  <li>Any transition can be bound to a query from the transition's SQL assignment dialog.</li>
  <li>Bound query IDs are persisted on the transition and exported with the model.</li>
</ul>

<h4>How queries affect transition enablement</h4>
<ul>
  <li>During simulation, a transition with a bound query is evaluated against the current database state.</li>
  <li>If query evaluation fails (no database, empty query, removed query, SQL error), the transition is blocked.</li>
  <li>If the query succeeds, result rows are transformed into variable bindings (column name → value).</li>
  <li>The transition is enabled only if at least one row satisfies arc-inscription token constraints, guard evaluation, and output producibility.</li>
</ul>

<h4>Special COUNT semantics</h4>
<ul>
  <li>Queries matching <code>SELECT COUNT(...)</code> are handled specially: they must return exactly one numeric cell.</li>
  <li>That value is exposed as <code>queryCount</code> in guard evaluation, enabling threshold-based guards driven by live DB counts.</li>
</ul>

<h4>Row-driven execution behavior</h4>
<ul>
  <li>For row-based queries, each result row is a candidate binding.</li>
  <li>In automatic mode the engine selects a fireable row randomly.</li>
  <li>In user-driven mode (configured via the Execution Configuration dialog) you can pick the row and manually select consumed tokens.</li>
</ul>

<h4>SQL actions on transition fire</h4>
<ul>
  <li>Actions are managed in the ACTIONS tab with stable IDs (<code>A1</code>, <code>A2</code>, ...).</li>
  <li>Supported statement forms:
    <ul>
      <li><code>INSERT INTO ... VALUES ...</code></li>
      <li><code>UPDATE ... SET ... WHERE ...</code></li>
      <li><code>DELETE FROM ... WHERE ...</code></li>
    </ul>
  </li>
  <li>One transition can have multiple bound actions; all execute (in order) when the transition fires.</li>
  <li>If any action fails, firing is aborted and token movement does not proceed.</li>
  <li>Database changes are only written to disk when you actively export a <code>.db</code> or <code>.dbpnml</code> file.</li>
</ul>

<h2>Simulation Guide</h2>

<h3>Simulation mode and firing</h3>
<ul>
  <li>Toggle simulation mode on/off at any time with the play button in the palette or by pressing <code>s</code>.</li>
  <li>When simulation is active, transition enablement is continuously recalculated.</li>
  <li>Clicking an enabled transition fires it, consuming and producing tokens according to arc inscriptions.</li>
  <li>Editing affordances are reduced while simulation is active to prevent accidental model changes.</li>
</ul>

<h3>Transition colors and meaning</h3>
<ul>
  <li><strong>White</strong>: transition is not enabled (idle or blocked).</li>
  <li><strong>Light green</strong>: transition is enabled and can fire now (also shows a play triangle).</li>
  <li><strong>Plum</strong>: transition has fired earlier in this simulation session but is not enabled right now.</li>
</ul>

<h3>Step-back and reset</h3>
<ul>
  <li>Every successful firing stores a snapshot in simulation history.</li>
  <li><strong>Step-back</strong> (<code>b</code> or <code>Ctrl+Z</code> in simulation mode): restores the previous snapshot (tokens + fired-transition state).</li>
  <li><strong>Reset</strong> (<code>r</code>): opens a dialog to choose between two reset modes:
    <ul>
      <li><strong>Soft Reset</strong>: restores token marking to the start of the current simulation run.</li>
      <li><strong>Master Reset</strong>: restores token marking to before the very first simulation run (the original baseline).</li>
    </ul>
  </li>
  <li>Both reset types clear simulation history, fired-transition markers, and exit simulation mode.</li>
</ul>

<h3>Execution Roadmap</h3>
<ul>
  <li>The Execution Roadmap panel sits in the bottom-right corner — hover over it to expand.</li>
  <li>The panel shows all transitions fired in the current simulation session in order.</li>
  <li>While simulation is active, click any step in the list to jump directly to that state.</li>
  <li><strong>Export Roadmap</strong>: downloads a detailed JSON file containing the full timeline — token markings, transition states, and guard bindings for every step.</li>
  <li>The archive icon shows execution history from previous simulation sessions in the current page load.</li>
</ul>

<h3>Execution Configuration</h3>
<ul>
  <li>Open via the <strong>Rules</strong> button in the top-left corner.</li>
  <li>Controls how token values are consumed and produced when a transition fires:
    <ul>
      <li><strong>Consumption mode</strong>: random (engine picks tokens) or user-selected (you choose).</li>
      <li><strong>Production mode</strong>: random (engine generates values) or user-provided (you enter them).</li>
    </ul>
  </li>
  <li>Integer and real domains: set min/max bounds and optionally enable normal-distribution sampling (μ, σ).</li>
  <li>String generation: constrained by a character-class regex rule (e.g. <code>[a-z]{3,6}</code>).</li>
  <li>Generated output values are validated against the place type and guard constraints before being accepted.</li>
</ul>

<h2>Export and Import Guide</h2>

<h3>PNML file</h3>
<ul>
  <li>Standard PNML format suitable for exchange with other tools.</li>
  <li>Does <em>not</em> include simulation state, SQL metadata, or database content.</li>
  <li>Importing a plain PNML file starts with a clean slate (no simulation history, no SQL bindings).</li>
</ul>

<h3>PNML + DB</h3>
<ul>
  <li>Two download options are available:
    <ul>
      <li><strong>Single .dbpnml file</strong>: bundles the PNML and the SQLite database together as one JSON file. Easiest for sharing.</li>
      <li><strong>Two separate files</strong>: saves a <code>.pnml</code> (with SQL metadata and simulation history) alongside a <code>.db</code> file.</li>
    </ul>
  </li>
  <li>Both options preserve: SQL queries and actions, transition bindings, execution configuration rules, and the database.</li>
  <li>After import, toggle simulation on to start a fresh session from the imported model state, with the original master-reset baseline intact.</li>
</ul>

<h2>Hotkey Guide</h2>

<h3>Simulation hotkeys</h3>
<ul>
  <li><code>s</code>: Toggle simulation mode on/off.</li>
  <li><code>r</code>: Open reset dialog (Soft Reset or Master Reset). Requires simulation to be active.</li>
  <li><code>b</code>: Step back one simulation firing (requires simulation active and history present).</li>
</ul>

<h3>View hotkeys</h3>
<ul>
  <li><code>t</code>: Toggle ID label visibility for places and transitions.</li>
</ul>

<h3>Editing hotkeys</h3>
<ul>
  <li><code>Ctrl+C</code> / <code>Cmd+C</code>: Copy selected elements to the internal clipboard.</li>
  <li><code>Ctrl+V</code> / <code>Cmd+V</code>: Paste copied elements with preserved relative layout and fresh IDs.</li>
  <li><code>Ctrl+Z</code> / <code>Cmd+Z</code>:
    <ul>
      <li>In edit mode: undo diagram command history.</li>
      <li>In simulation mode: step back one simulation firing.</li>
    </ul>
  </li>
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
