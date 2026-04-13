import { showSqlQueriesList } from './DialogService.js';

export default class SqlDialogService {
  constructor(eventBus, databaseService) {
    this.eventBus = eventBus;
    this.databaseService = databaseService;
    this.container = document.getElementById('sql-dialog');
    this._nextQueryNumber = 1;
    this.queries = [this._createEntry('')];
    this.queryBindings = new Map();
    this.queryOutput = 'No query run yet.';
    this.queryCountOutput = null;

    if (!this.container) {
      return;
    }

    // Listen for external open requests on the eventbus 
    this.eventBus.on('sqlDialog.open', ({ element } = {}) => {
      showSqlQueriesList({
        entries: this.getQueryEntries(),
        selectedQueryId: this.getBoundQueryIdForTransition(element),
        onSelectQuery: (queryId) => {
          const attached = this.attachQueryToTransition(element, queryId);
          if (attached && element) {
            this.eventBus.fire('element.changed', { element });
            this.render();
          }
          return attached;
        }
      });
    });
    this.eventBus.on('database.changed', () => this.render());

    this.render();
  }

  // List API: create a new query entry { id: 'Qn', text: '...' }.
  addQuery(query = '') {
    this.queries.push(this._createEntry(query));
    this._emitChanged();
    this.render();
  }

  // Remove one query by stable ID (e.g. 'Q3').
  removeQueryById(queryId) {
    const index = this.queries.findIndex((query) => query.id === queryId);
    if (index === -1) {
      return false;
    }

    this.queries.splice(index, 1);
    this._removeBindingsForQuery(queryId);
    this._emitChanged();
    this.render();
    return true;
  }

  // Remove one query by index in the current rendered list.
  removeQueryAt(index) {
    if (index < 0 || index >= this.queries.length) {
      return false;
    }

    this.queries.splice(index, 1);
    this._emitChanged();
    this.render();
    return true;
  }

  clearQueries() {
    this.queries = [];
    this.queryBindings.clear();
    this._emitBindingsChanged();
    this._emitChanged();
    this.render();
  }

  loadQueries(entries = []) {
    if (!Array.isArray(entries)) {
      return;
    }

    this.queries = entries.map((entry) => ({
      id: String(entry.id),
      text: String(entry.text || '')
    }));

    const maxIndex = this.queries.reduce((max, entry) => {
      const match = /^Q(\d+)$/i.exec(entry.id);
      const value = match ? Number(match[1]) : 0;
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    this._nextQueryNumber = maxIndex + 1;
    this._emitChanged();
    this.render();
  }

  loadBindings(bindings = []) {
    this.queryBindings.clear();

    if (!Array.isArray(bindings)) {
      this._emitBindingsChanged();
      return;
    }

    bindings.forEach((binding) => {
      if (!binding || !binding.transitionId || !binding.queryId) {
        return;
      }

      if (this.getQueryEntryById(binding.queryId)) {
        this.queryBindings.set(binding.transitionId, binding.queryId);
      }
    });

    this._emitBindingsChanged();
  }

  loadState({ queries = [], bindings = [] } = {}) {
    this.loadQueries(queries);
    this.loadBindings(bindings);
  }

  getQuery(index) {
    return this.queries[index]?.text;
  }

  getQueryId(index) {
    return this.queries[index]?.id;
  }

  getQueryEntry(index) {
    const entry = this.queries[index];
    return entry ? { ...entry } : undefined;
  }

  getQueryById(queryId) {
    const entry = this.queries.find((query) => query.id === queryId);
    return entry ? entry.text : undefined;
  }

  getQueryEntryById(queryId) {
    const entry = this.queries.find((query) => query.id === queryId);
    return entry ? { ...entry } : undefined;
  }

  getQueries() {
    return this.queries.map((entry) => entry.text);
  }

  getQueryEntries() {
    return this.queries.map((entry) => ({ ...entry }));
  }

  size() {
    return this.queries.length;
  }

  setQueryAt(index, value) {
    if (index < 0 || index >= this.queries.length) {
      return false;
    }

    this.queries[index].text = String(value);
    this._emitChanged();
    return true;
  }

  setQueryById(queryId, value) {
    const entry = this.queries.find((query) => query.id === queryId);
    if (!entry) {
      return false;
    }

    entry.text = String(value);
    this._emitChanged();
    return true;
  }

  // Bind a query (Qn) to a transition so simulation logic can resolve it later.
  attachQueryToTransition(transitionOrId, queryId) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId || !this.getQueryEntryById(queryId)) {
      return false;
    }

    this.queryBindings.set(transitionId, queryId);
    this._setTransitionBindingOnBusinessObject(transitionOrId, queryId);
    this._emitBindingsChanged();
    return true;
  }

  detachQueryFromTransition(transitionOrId) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId) {
      return false;
    }

    const hadBinding = this.queryBindings.delete(transitionId);
    this._setTransitionBindingOnBusinessObject(transitionOrId, null);

    if (hadBinding) {
      this._emitBindingsChanged();
    }

    return hadBinding;
  }

  getBoundQueryIdForTransition(transitionOrId) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId) {
      return undefined;
    }
    return this.queryBindings.get(transitionId);
  }

  getBoundQueryEntryForTransition(transitionOrId) {
    const queryId = this.getBoundQueryIdForTransition(transitionOrId);
    if (!queryId) {
      return undefined;
    }
    return this.getQueryEntryById(queryId);
  }

  getQueryBindings() {
    return Array.from(this.queryBindings.entries()).map(([transitionId, queryId]) => ({
      transitionId,
      queryId
    }));
  }

  _emitChanged() {
    this.eventBus.fire('sqlDialog.queries.changed', {
      queries: this.getQueries(),
      entries: this.getQueryEntries()
    });
  }

  _emitBindingsChanged() {
    this.eventBus.fire('sqlDialog.bindings.changed', {
      bindings: this.getQueryBindings()
    });
  }

  _resolveTransitionId(transitionOrId) {
    if (typeof transitionOrId === 'string') {
      return transitionOrId;
    }
    return transitionOrId?.id;
  }

  _setTransitionBindingOnBusinessObject(transitionOrId, queryId) {
    if (typeof transitionOrId === 'string') {
      return;
    }

    const businessObject = transitionOrId?.businessObject;
    if (!businessObject) {
      return;
    }

    if (queryId) {
      businessObject.queryGuardId = queryId;
      return;
    }

    delete businessObject.queryGuardId;
  }

  _removeBindingsForQuery(queryId) {
    let removed = false;

    for (const [transitionId, boundQueryId] of this.queryBindings.entries()) {
      if (boundQueryId === queryId) {
        this.queryBindings.delete(transitionId);
        removed = true;
      }
    }

    if (removed) {
      this._emitBindingsChanged();
    }
  }

  _createEntry(query = '') {
    return {
      id: `Q${this._nextQueryNumber++}`,
      text: String(query)
    };
  }

  _buildHeader(parent) {
    const headerRow = document.createElement('div');
    headerRow.className = 'sql-dialog__header';

    const title = document.createElement('div');
    title.className = 'sql-dialog__title';
    title.textContent = 'SQL QUERIES';

    const dbLabel = document.createElement('div');
    dbLabel.className = 'sql-dialog__db-label';
    dbLabel.textContent = `current db: ${this.databaseService.getDbName() || 'none'}`;

    headerRow.appendChild(title);
    headerRow.appendChild(dbLabel);
    parent.appendChild(headerRow);

    const divider = document.createElement('div');
    divider.className = 'sql-dialog__divider';
    parent.appendChild(divider);
  }

  _buildEmptyState(parent) {
    const empty = document.createElement('div');
    empty.className = 'sql-dialog__empty';
    empty.textContent = 'No queries yet';
    parent.appendChild(empty);
  }

  _buildRow(entry) {
    const row = document.createElement('div');
    row.className = 'sql-dialog__row';
    row.dataset.queryId = String(entry.id);

    const number = document.createElement('span');
    number.className = 'sql-dialog__index';
    number.textContent = entry.id;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sql-dialog__input';
    input.placeholder = entry.id;
    input.value = entry.text;
    input.addEventListener('input', (event) => {
      this.setQueryById(entry.id, event.target.value);
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'sql-dialog__remove';
    removeButton.textContent = 'x';
    removeButton.title = 'Remove query';
    removeButton.addEventListener('click', () => {
      this.removeQueryById(entry.id);
    });

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'sql-dialog__run';
    runButton.textContent = 'Run';
    runButton.title = `Run ${entry.id}`;
    runButton.addEventListener('click', () => {
      this.runQueryById(entry.id);
    });

    row.appendChild(number);
    row.appendChild(input);
    row.appendChild(runButton);
    row.appendChild(removeButton);
    return row;
  }

  _buildActions(parent) {
    const actionRow = document.createElement('div');
    actionRow.className = 'sql-dialog__actions';

    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.className = 'sql-dialog__add';
    addButton.textContent = '+';
    addButton.addEventListener('click', () => {
      this.addQuery('');
    });

    const clearAllButton = document.createElement('button');
    clearAllButton.type = 'button';
    clearAllButton.className = 'sql-dialog__clear-all';
    clearAllButton.textContent = 'CA';
    clearAllButton.title = 'Clear all queries';
    clearAllButton.addEventListener('click', () => {
      this.clearQueries();
    });

    actionRow.appendChild(addButton);
    actionRow.appendChild(clearAllButton);
    parent.appendChild(actionRow);
  }

  runQueryById(queryId) {
    const entry = this.getQueryEntryById(queryId);
    if (!entry) {
      this.queryOutput = `Query ${queryId} not found.`;
      this.queryCountOutput = null;
      this.render();
      return;
    }

    const query = String(entry.text || '').trim();
    if (!query) {
      this.queryOutput = `${queryId}: query is empty.`;
      this.queryCountOutput = null;
      this.render();
      return;
    }

    if (!this.databaseService.getDbName()) {
      this.queryOutput = `${queryId}: no database loaded. Upload a .db/.sqlite file first.`;
      this.queryCountOutput = null;
      this.render();
      return;
    }

    const result = this.databaseService.queryWithStatus(query);
    if (!result.ok) {
      this.queryOutput = `${queryId}: ${result.error}`;
      this.queryCountOutput = null;
      this.render();
      return;
    }
    const rows = result.rows;
    this.queryCountOutput = rows.length;

    if (!rows.length) {
      this.queryOutput = `${queryId}: query executed, no rows returned.`;
      this.render();
      return;
    }

    this.queryOutput = `${queryId}:\n${JSON.stringify(rows, null, 2)}`;
    this.render();
  }

  buildOutput(parent) {
    const divider = document.createElement('div');
    divider.className = 'sql-dialog__output-divider';
    parent.appendChild(divider);

    const label = document.createElement('div');
    label.className = 'sql-dialog__output-label';
    label.textContent = 'QUERY OUTPUT';
    parent.appendChild(label);

    const output = document.createElement('pre');
    output.className = 'sql-dialog__output';
    output.textContent = this.queryOutput;
    parent.appendChild(output);

    const count = document.createElement('div');
    count.className = 'sql-dialog__output-count';
    count.textContent = this.queryCountOutput === null
      ? 'queryCount: N/A'
      : `queryCount: ${this.queryCountOutput}`;
    parent.appendChild(count);
  }

  render() {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';

    this._buildHeader(this.container);

    const list = document.createElement('div');
    list.className = 'sql-dialog__list';

    if (!this.queries.length) {
      this._buildEmptyState(list);
    } else {
      this.queries.forEach((query) => {
        list.appendChild(this._buildRow(query));
      });
    }

    this.container.appendChild(list);
    this._buildActions(this.container);
    this.buildOutput(this.container);
  }
}

SqlDialogService.$inject = ['eventBus', 'databaseService'];
