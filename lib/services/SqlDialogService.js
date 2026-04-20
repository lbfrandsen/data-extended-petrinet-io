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
    this.activeTab = 'sql';
    this._nextActionNumber = 1;
    this.actionEntries = [this._createActionEntry()];

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

  _createActionEntry(type = 'INSERT', sql = '') {
    const normalizedType = this._normalizeActionType(type);
    const normalizedSql = String(sql || '').trim();
    return {
      id: `A${this._nextActionNumber++}`,
      type: normalizedType,
      sql: normalizedSql,
      intoTarget: '',
      valuesExpr: '',
      fromTarget: '',
      whereExpr: ''
    };
  }

  _normalizeActionType(type) {
    return String(type || '').toUpperCase() === 'DELETE' ? 'DELETE' : 'INSERT';
  }

  _composeActionSql(entry) {
    if (!entry) {
      return '';
    }

    if (entry.type === 'DELETE') {
      const fromTarget = String(entry.fromTarget || '').trim();
      const whereExpr = String(entry.whereExpr || '').trim();

      if (!fromTarget || !whereExpr) {
        return '';
      }

      return `DELETE FROM ${fromTarget} WHERE ${whereExpr}`;
    }

    const intoTarget = String(entry.intoTarget || '').trim();
    const valuesExpr = String(entry.valuesExpr || '').trim();

    if (!intoTarget || !valuesExpr) {
      return '';
    }

    return `INSERT INTO ${intoTarget} VALUES ${valuesExpr}`;
  }

  _buildHeader(parent, { titleText = 'SQL QUERIES', showDivider = true } = {}) {
    const headerRow = document.createElement('div');
    headerRow.className = 'sql-dialog__header';

    const title = document.createElement('div');
    title.className = 'sql-dialog__title';
    title.textContent = titleText;

    const dbLabel = document.createElement('div');
    dbLabel.className = 'sql-dialog__db-label';
    dbLabel.textContent = `current db: ${this.databaseService.getDbName() || 'none'}`;

    headerRow.appendChild(title);
    headerRow.appendChild(dbLabel);
    parent.appendChild(headerRow);

    if (showDivider) {
      const divider = document.createElement('div');
      divider.className = 'sql-dialog__divider';
      parent.appendChild(divider);
    }
  }

  _buildTabbedHeader(parent) {
    const headerRow = document.createElement('div');
    headerRow.className = 'sql-dialog__header sql-dialog__header--tabs';

    const title = document.createElement('div');
    title.className = 'sql-dialog__title sql-dialog__title--functions';
    title.textContent = 'SQL FUNCTIONS';

    const tabs = document.createElement('div');
    tabs.className = 'sql-dialog__tabs';

    const sqlTab = document.createElement('button');
    sqlTab.type = 'button';
    sqlTab.className = `sql-dialog__tab ${this.activeTab === 'sql' ? 'is-active' : ''}`.trim();
    sqlTab.textContent = 'SQL QUERIES';
    sqlTab.addEventListener('click', () => {
      if (this.activeTab !== 'sql') {
        this.activeTab = 'sql';
        this.render();
      }
    });

    const actionsTab = document.createElement('button');
    actionsTab.type = 'button';
    actionsTab.className = `sql-dialog__tab ${this.activeTab === 'actions' ? 'is-active' : ''}`.trim();
    actionsTab.textContent = 'ACTIONS';
    actionsTab.addEventListener('click', () => {
      if (this.activeTab !== 'actions') {
        this.activeTab = 'actions';
        this.render();
      }
    });

    tabs.appendChild(sqlTab);
    tabs.appendChild(actionsTab);

    const dbLabel = document.createElement('div');
    dbLabel.className = 'sql-dialog__db-label';
    dbLabel.textContent = `current db: ${this.databaseService.getDbName() || 'none'}`;

    headerRow.appendChild(title);
    headerRow.appendChild(tabs);
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

  _buildNoDatabaseState(parent) {
    const emptyState = document.createElement('div');
    emptyState.className = 'sql-dialog__no-db';

    const aura = document.createElement('div');
    aura.className = 'sql-dialog__no-db-aura';

    const ring = document.createElement('div');
    ring.className = 'sql-dialog__no-db-ring';

    const eyebrow = document.createElement('div');
    eyebrow.className = 'sql-dialog__no-db-eyebrow';
    eyebrow.textContent = 'DATABASE';

    const icon = document.createElement('i');
    icon.className = 'bpmn-icon-data-store sql-dialog__no-db-icon';

    const text = document.createElement('div');
    text.className = 'sql-dialog__no-db-text';
    text.textContent = 'No database connected';

    const uploadButton = document.createElement('button');
    uploadButton.type = 'button';
    uploadButton.className = 'sql-dialog__upload-db';
    uploadButton.textContent = 'UPLOAD';
    uploadButton.addEventListener('click', () => {
      this._promptUploadDbFile();
    });

    emptyState.appendChild(aura);
    emptyState.appendChild(ring);
    emptyState.appendChild(eyebrow);
    emptyState.appendChild(icon);
    emptyState.appendChild(text);
    emptyState.appendChild(uploadButton);
    parent.appendChild(emptyState);
  }

  _addActionEntry() {
    this.actionEntries.push(this._createActionEntry());
    this.render();
  }

  _clearActionEntries() {
    this.actionEntries = [];
    this.render();
  }

  _removeActionEntryById(actionId) {
    const index = this.actionEntries.findIndex((entry) => entry.id === actionId);
    if (index === -1) {
      return;
    }
    this.actionEntries.splice(index, 1);
    this.render();
  }

  _setActionTypeById(actionId, type) {
    const entry = this.actionEntries.find((item) => item.id === actionId);
    if (!entry) {
      return;
    }
    entry.type = this._normalizeActionType(type);
    entry.sql = this._composeActionSql(entry);
    this.render();
  }

  _setActionPartById(actionId, key, value) {
    const entry = this.actionEntries.find((item) => item.id === actionId);
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, key)) {
      return;
    }
    entry[key] = String(value ?? '');
    entry.sql = this._composeActionSql(entry);
  }

  _promptUploadDbFile() {
    if (!this.databaseService || typeof this.databaseService.loadFromFile !== 'function') {
      console.error('Database service is not ready yet');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.sqlite';
    input.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) {
        this.databaseService.loadFromFile(file);
      }
    });
    input.click();
  }

  _stripSelectPrefix(value) {
    const text = String(value ?? '').trimStart();
    return text.replace(/^select\s+/i, '');
  }

  _withSelectPrefix(value) {
    const text = String(value ?? '');
    const trimmed = text.trim();
    if (!trimmed) {
      return '';
    }
    return `SELECT ${this._stripSelectPrefix(text)}`;
  }

  _buildRow(entry) {
    const row = document.createElement('div');
    row.className = 'sql-dialog__row';
    row.dataset.queryId = String(entry.id);

    const number = document.createElement('span');
    number.className = 'sql-dialog__index';
    number.textContent = entry.id;

    const selectKeyword = document.createElement('span');
    selectKeyword.className = 'sql-dialog__query-keyword';
    selectKeyword.textContent = 'SELECT';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sql-dialog__input';
    input.placeholder = entry.id;
    input.value = this._stripSelectPrefix(entry.text);
    input.addEventListener('input', (event) => {
      this.setQueryById(entry.id, this._withSelectPrefix(event.target.value));
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'sql-dialog__remove';
    removeButton.textContent = 'X';
    removeButton.title = 'Remove query';
    removeButton.addEventListener('click', () => {
      this.removeQueryById(entry.id);
    });

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.className = 'sql-dialog__run';
    const runIcon = document.createElement('i');
    runIcon.className = 'bpmn-icon-intermediate-event-throw-link sql-dialog__run-icon';
    runButton.appendChild(runIcon);
    runButton.title = `Run ${entry.id}`;
    runButton.addEventListener('click', () => {
      this.runQueryById(entry.id);
    });

    row.appendChild(number);
    row.appendChild(selectKeyword);
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

  _buildActionsTab(parent) {
    const panel = document.createElement('div');
    panel.className = 'sql-dialog__actions-tab';

    const list = document.createElement('div');
    list.className = 'sql-dialog__action-list';

    if (!this.actionEntries.length) {
      const empty = document.createElement('div');
      empty.className = 'sql-dialog__empty';
      empty.textContent = 'No actions yet';
      list.appendChild(empty);
    } else {
      this.actionEntries.forEach((entry) => {
        const row = document.createElement('div');
        row.className = 'sql-dialog__action-row';

        const typeSelect = document.createElement('select');
        typeSelect.className = 'sql-dialog__action-type';
        ['INSERT', 'DELETE'].forEach((optionValue) => {
          const option = document.createElement('option');
          option.value = optionValue;
          option.textContent = optionValue;
          option.selected = entry.type === optionValue;
          typeSelect.appendChild(option);
        });
        typeSelect.addEventListener('change', (event) => {
          this._setActionTypeById(entry.id, event.target.value);
        });

        const sqlInputGroup = document.createElement('div');
        sqlInputGroup.className = 'sql-dialog__action-input-group';

        if (entry.type === 'DELETE') {
          const fromKeyword = document.createElement('span');
          fromKeyword.className = 'sql-dialog__query-keyword';
          fromKeyword.textContent = 'FROM';

          const fromInput = document.createElement('input');
          fromInput.type = 'text';
          fromInput.className = 'sql-dialog__input sql-dialog__action-input';
          fromInput.placeholder = 'table_name';
          fromInput.value = entry.fromTarget || '';
          fromInput.addEventListener('input', (event) => {
            this._setActionPartById(entry.id, 'fromTarget', event.target.value);
          });

          const whereKeyword = document.createElement('span');
          whereKeyword.className = 'sql-dialog__query-keyword';
          whereKeyword.textContent = 'WHERE';

          const whereInput = document.createElement('input');
          whereInput.type = 'text';
          whereInput.className = 'sql-dialog__input sql-dialog__action-input';
          whereInput.placeholder = 'type = \'yeet\'';
          whereInput.value = entry.whereExpr || '';
          whereInput.addEventListener('input', (event) => {
            this._setActionPartById(entry.id, 'whereExpr', event.target.value);
          });

          sqlInputGroup.appendChild(fromKeyword);
          sqlInputGroup.appendChild(fromInput);
          sqlInputGroup.appendChild(whereKeyword);
          sqlInputGroup.appendChild(whereInput);
        } else {
          const intoKeyword = document.createElement('span');
          intoKeyword.className = 'sql-dialog__query-keyword';
          intoKeyword.textContent = 'INTO';

          const intoInput = document.createElement('input');
          intoInput.type = 'text';
          intoInput.className = 'sql-dialog__input sql-dialog__action-input';
          intoInput.placeholder = 'table_name (col1, col2)';
          intoInput.value = entry.intoTarget || '';
          intoInput.addEventListener('input', (event) => {
            this._setActionPartById(entry.id, 'intoTarget', event.target.value);
          });

          const valuesKeyword = document.createElement('span');
          valuesKeyword.className = 'sql-dialog__query-keyword';
          valuesKeyword.textContent = 'VALUES';

          const valuesInput = document.createElement('input');
          valuesInput.type = 'text';
          valuesInput.className = 'sql-dialog__input sql-dialog__action-input';
          valuesInput.placeholder = '(value1, value2)';
          valuesInput.value = entry.valuesExpr || '';
          valuesInput.addEventListener('input', (event) => {
            this._setActionPartById(entry.id, 'valuesExpr', event.target.value);
          });

          sqlInputGroup.appendChild(intoKeyword);
          sqlInputGroup.appendChild(intoInput);
          sqlInputGroup.appendChild(valuesKeyword);
          sqlInputGroup.appendChild(valuesInput);
        }

        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.className = 'sql-dialog__action-remove';
        removeButton.textContent = 'X';
        removeButton.title = 'Remove action';
        removeButton.addEventListener('click', () => {
          this._removeActionEntryById(entry.id);
        });

        row.appendChild(typeSelect);
        row.appendChild(sqlInputGroup);
        row.appendChild(removeButton);
        list.appendChild(row);
      });
    }

    panel.appendChild(list);

    const controls = document.createElement('div');
    controls.className = 'sql-dialog__actions';

    const addActionButton = document.createElement('button');
    addActionButton.type = 'button';
    addActionButton.className = 'sql-dialog__add';
    addActionButton.textContent = '+';
    addActionButton.addEventListener('click', () => {
      this._addActionEntry();
    });

    const clearAllActionsButton = document.createElement('button');
    clearAllActionsButton.type = 'button';
    clearAllActionsButton.className = 'sql-dialog__clear-all';
    clearAllActionsButton.textContent = 'CA';
    clearAllActionsButton.title = 'Clear all actions';
    clearAllActionsButton.addEventListener('click', () => {
      this._clearActionEntries();
    });

    controls.appendChild(addActionButton);
    controls.appendChild(clearAllActionsButton);
    panel.appendChild(controls);

    const warning = document.createElement('div');
    warning.className = 'sql-dialog__action-status';
    warning.textContent = 'CAUTION: Actions are executed on permission of their bound transition guards. They will modify your database irreversibly.';
    panel.appendChild(warning);

    parent.appendChild(panel);
  }

  runQueryById(queryId) {
    this.eventBus.fire('sqlDialog.runQuery', { queryId });
  }

  setQueryRunOutput({ queryOutput, queryCountOutput = null } = {}) {
    this.queryOutput = String(queryOutput ?? '');
    this.queryCountOutput = Number.isFinite(queryCountOutput) ? queryCountOutput : null;
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
    const hasDatabase = Boolean(this.databaseService.getDbName());
    this.activeTab = this.activeTab === 'actions' ? 'actions' : 'sql';
    this.container.classList.toggle('sql-dialog--no-db', !hasDatabase);

    if (!hasDatabase) {
      this.activeTab = 'sql';
      this._buildHeader(this.container, {
        titleText: 'UPLOAD DATABASE',
        showDivider: false
      });
      this._buildNoDatabaseState(this.container);
      return;
    }

    this._buildTabbedHeader(this.container);

    if (this.activeTab === 'actions') {
      this._buildActionsTab(this.container);
      return;
    }

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
