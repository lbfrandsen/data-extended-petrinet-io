import { showSqlQueriesList } from './DialogService.js';

export default class SqlDialogService {
  // Initializes SQL dialog state, event listeners, and first render. This service coordinates query/action UI state and transition attachments.
  constructor(eventBus, databaseService) {
    this.eventBus = eventBus;
    this.databaseService = databaseService;
    this.container = document.getElementById('sql-dialog');
    this._nextQueryNumber = 1;
    this.queries = [this._createEntry('')];
    this.queryBindings = new Map();
    this.actionBindings = new Map();
    this.queryOutput = 'No query run yet.';
    this.queryCountOutput = null;
    this.activeTab = 'sql';
    this.isExpanded = false;
    this._nextActionNumber = 1;
    this.actionEntries = [this._createActionEntry()];

    if (!this.container) {
      return;
    }

    // Listen for external open requests on the eventbus 
    this.eventBus.on('sqlDialog.open', ({ element } = {}) => {
      const selectedQueryId = this.getBoundQueryIdForTransition(element);
      const selectedActionIds = this.getBoundActionIdsForTransition(element);
      const queryBindingTransitionIds = this.getQueryBindings().reduce((acc, binding) => {
        const queryId = String(binding?.queryId || '').trim();
        const transitionId = String(binding?.transitionId || '').trim();
        if (!queryId) {
          return acc;
        }
        const existing = acc[queryId] || new Set();
        if (transitionId) {
          existing.add(transitionId);
        }
        acc[queryId] = existing;
        return acc;
      }, {});
      const actionBindingTransitionIds = this.getActionBindings().reduce((acc, binding) => {
        const actionId = String(binding?.actionId || '').trim();
        const transitionId = String(binding?.transitionId || '').trim();
        if (!actionId) {
          return acc;
        }
        const existing = acc[actionId] || new Set();
        if (transitionId) {
          existing.add(transitionId);
        }
        acc[actionId] = existing;
        return acc;
      }, {});
      const normalizedQueryBindingTransitionIds = Object.fromEntries(
        Object.entries(queryBindingTransitionIds).map(([queryId, idsSet]) => [queryId, Array.from(idsSet).sort()])
      );
      const normalizedActionBindingTransitionIds = Object.fromEntries(
        Object.entries(actionBindingTransitionIds).map(([actionId, idsSet]) => [actionId, Array.from(idsSet).sort()])
      );
      showSqlQueriesList({
        entries: this.getQueryEntries(),
        selectedQueryId,
        queryBindingTransitionIds: normalizedQueryBindingTransitionIds,
        onSelectQuery: (queryId) => {
          if (selectedQueryId && selectedQueryId === queryId) {
            const detached = this.detachQueryFromTransition(element);
            if (detached && element) {
              this.eventBus.fire('element.changed', { element });
              this.render();
            }
            return detached;
          }

          const attached = this.attachQueryToTransition(element, queryId);
          if (attached && element) {
            this.eventBus.fire('element.changed', { element });
            this.render();
          }
          return attached;
        },
        actionEntries: this.getActionEntries(),
        selectedActionIds,
        actionBindingTransitionIds: normalizedActionBindingTransitionIds,
        onSelectAction: (actionId) => {
          const currentlyAttached = this.getBoundActionIdsForTransition(element).includes(actionId);
          if (currentlyAttached) {
            const detached = this.detachActionFromTransition(element, actionId);
            if (detached && element) {
              this.eventBus.fire('element.changed', { element });
              this.render();
            }
            return detached;
          }

          const attached = this.attachActionToTransition(element, actionId);
          if (attached && element) {
            this.eventBus.fire('element.changed', { element });
            this.render();
          }
          return attached;
        },
        onResetBindings: () => {
          const detachedQuery = this.detachQueryFromTransition(element);
          const detachedActions = this.detachActionFromTransition(element);
          const changed = Boolean(detachedQuery || detachedActions);

          if (changed && element) {
            this.eventBus.fire('element.changed', { element });
            this.render();
          }

          return changed;
        }
      });
    });
    this.eventBus.on('database.changed', () => this.render());
    this.container.addEventListener('mouseenter', () => this._expandFromHover());

    this.render();
  }

  // Expands the SQL panel on hover when it is currently collapsed
  _expandFromHover() {
    if (this.isExpanded) {
      return;
    }
    this.isExpanded = true;
    this.render();
  }

  // Collapses the SQL panel and returns it to hover-open mode
  _collapsePanel() {
    this.isExpanded = false;
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

  // Clears all query entries and query-to-transition bindings. This resets the query side of the dialog to an empty state.
  clearQueries() {
    this.queries = [];
    this.queryBindings.clear();
    this._emitBindingsChanged();
    this._emitChanged();
    this.render();
  }

  // Loads query entries from persisted metadata. It also recalculates the next query ID counter for new entries.
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

  // Loads query bindings from persisted metadata. Invalid references are ignored to keep bindings consistent.
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

  // Loads action entries from persisted metadata. It also rebuilds structured action fields and updates the action ID counter.
  loadActions(entries = []) {
    if (!Array.isArray(entries)) {
      return;
    }

    this.actionEntries = entries.map((entry) => {
      const type = this._normalizeActionType(entry?.type);
      const sql = String(entry?.sql || '').trim();
      const parsed = this._extractActionParts(type, sql);

      return {
        id: String(entry?.id),
        type,
        sql,
        intoTarget: String(entry?.intoTarget ?? parsed.intoTarget ?? ''),
        valuesExpr: String(entry?.valuesExpr ?? parsed.valuesExpr ?? ''),
        fromTarget: String(entry?.fromTarget ?? parsed.fromTarget ?? ''),
        whereExpr: String(entry?.whereExpr ?? parsed.whereExpr ?? '')
      };
    });

    const maxIndex = this.actionEntries.reduce((max, entry) => {
      const match = /^A(\d+)$/i.exec(entry.id);
      const value = match ? Number(match[1]) : 0;
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    this._nextActionNumber = maxIndex + 1;
    this._emitActionsChanged();
    this.render();
  }

  // Loads action bindings from persisted metadata. Invalid references are ignored to keep bindings consistent.
  loadActionBindings(bindings = []) {
    this.actionBindings.clear();

    if (!Array.isArray(bindings)) {
      this._emitBindingsChanged();
      return;
    }

    bindings.forEach((binding) => {
      if (!binding || !binding.transitionId || !binding.actionId) {
        return;
      }

      if (this.getActionEntryById(binding.actionId)) {
        const existing = this.actionBindings.get(binding.transitionId) || new Set();
        existing.add(binding.actionId);
        this.actionBindings.set(binding.transitionId, existing);
      }
    });

    this._emitBindingsChanged();
  }

  // Loads full SQL dialog state in one call. This is used during import/restore flows.
  loadState({ queries = [], bindings = [], actions = [], actionBindings = [] } = {}) {
    this.loadQueries(queries);
    this.loadBindings(bindings);
    this.loadActions(actions);
    this.loadActionBindings(actionBindings);
  }

  // Returns query SQL text at a given index. It is a lightweight accessor for query consumers.
  getQuery(index) {
    return this.queries[index]?.text;
  }

  // Returns query ID at a given index. This helps callers map list position to stable IDs.
  getQueryId(index) {
    return this.queries[index]?.id;
  }

  // Returns a cloned query entry at a given index. Cloning prevents outside mutation of internal state.
  getQueryEntry(index) {
    const entry = this.queries[index];
    return entry ? { ...entry } : undefined;
  }

  // Returns query SQL text for a specific query ID. This is the ID-based accessor for query content.
  getQueryById(queryId) {
    const entry = this.queries.find((query) => query.id === queryId);
    return entry ? entry.text : undefined;
  }

  // Returns a cloned query entry by query ID. Cloning preserves service ownership of state.
  getQueryEntryById(queryId) {
    const entry = this.queries.find((query) => query.id === queryId);
    return entry ? { ...entry } : undefined;
  }

  // Returns all query SQL strings. This is useful for emitting compact query payloads.
  getQueries() {
    return this.queries.map((entry) => entry.text);
  }

  // Returns cloned query entries for external consumers. This avoids leaking mutable internal objects.
  getQueryEntries() {
    return this.queries.map((entry) => ({ ...entry }));
  }

  // Returns action SQL text at a given index. It is a lightweight accessor for action consumers.
  getAction(index) {
    return this.actionEntries[index]?.sql;
  }

  // Returns action ID at a given index. This helps callers map list position to stable IDs.
  getActionId(index) {
    return this.actionEntries[index]?.id;
  }

  // Returns a cloned action entry at a given index. Cloning prevents outside mutation of internal state.
  getActionEntry(index) {
    const entry = this.actionEntries[index];
    return entry ? { ...entry } : undefined;
  }

  // Returns action SQL text for a specific action ID. This is the ID-based accessor for action content.
  getActionById(actionId) {
    const entry = this.actionEntries.find((action) => action.id === actionId);
    return entry ? entry.sql : undefined;
  }

  // Returns a cloned action entry by action ID. Cloning preserves service ownership of state.
  getActionEntryById(actionId) {
    const entry = this.actionEntries.find((action) => action.id === actionId);
    return entry ? { ...entry } : undefined;
  }

  // Returns all action SQL strings. This is useful for emitting compact action payloads.
  getActions() {
    return this.actionEntries.map((entry) => entry.sql);
  }

  // Returns cloned action entries for external consumers. This avoids leaking mutable internal objects.
  getActionEntries() {
    return this.actionEntries.map((entry) => ({ ...entry }));
  }

  // Returns the current number of query entries. This is kept for simple UI/list checks.
  size() {
    return this.queries.length;
  }

  // Updates query SQL text by list index. This supports index-based editing flows.
  setQueryAt(index, value) {
    if (index < 0 || index >= this.queries.length) {
      return false;
    }

    this.queries[index].text = String(value);
    this._emitChanged();
    return true;
  }

  // Updates query SQL text by stable query ID. This is the main path for query input updates.
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

  // Detaches any query bound to a transition. It also clears the business object property mirror.
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

  // Returns the query ID currently bound to a transition. This is used by simulation and attach dialogs.
  getBoundQueryIdForTransition(transitionOrId) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId) {
      return undefined;
    }
    return this.queryBindings.get(transitionId);
  }

  // Returns the query entry currently bound to a transition. This helps consumers resolve bound SQL quickly.
  getBoundQueryEntryForTransition(transitionOrId) {
    const queryId = this.getBoundQueryIdForTransition(transitionOrId);
    if (!queryId) {
      return undefined;
    }
    return this.getQueryEntryById(queryId);
  }

  // Returns all query bindings as serializable objects. This is used for event payloads and metadata export.
  getQueryBindings() {
    return Array.from(this.queryBindings.entries()).map(([transitionId, queryId]) => ({
      transitionId,
      queryId
    }));
  }

  // Attaches an action to a transition by ID. The binding is stored both in memory and on the transition business object.
  attachActionToTransition(transitionOrId, actionId) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId || !this.getActionEntryById(actionId)) {
      return false;
    }

    const existing = this.actionBindings.get(transitionId) || new Set();
    existing.add(actionId);
    this.actionBindings.set(transitionId, existing);
    this._setActionBindingOnBusinessObject(transitionOrId, [...existing]);
    this._emitBindingsChanged();
    return true;
  }

  // Detaches one action bound to a transition, or all when no action ID is given. It also keeps business object binding mirrors in sync.
  detachActionFromTransition(transitionOrId, actionId = null) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId) {
      return false;
    }

    const existing = this.actionBindings.get(transitionId);
    if (!existing || existing.size === 0) {
      return false;
    }

    let hadBinding = false;

    if (actionId) {
      hadBinding = existing.delete(actionId);
      if (existing.size > 0) {
        this.actionBindings.set(transitionId, existing);
        this._setActionBindingOnBusinessObject(transitionOrId, [...existing]);
      } else {
        this.actionBindings.delete(transitionId);
        this._setActionBindingOnBusinessObject(transitionOrId, null);
      }
    } else {
      hadBinding = true;
      this.actionBindings.delete(transitionId);
      this._setActionBindingOnBusinessObject(transitionOrId, null);
    }

    if (hadBinding) {
      this._emitBindingsChanged();
    }

    return hadBinding;
  }

  // Returns the action ID currently bound to a transition. This is used by simulation and attach dialogs.
  getBoundActionIdForTransition(transitionOrId) {
    const ids = this.getBoundActionIdsForTransition(transitionOrId);
    return ids[0];
  }

  // Returns all action IDs currently bound to a transition. This supports multi-action execution order on transition fire.
  getBoundActionIdsForTransition(transitionOrId) {
    const transitionId = this._resolveTransitionId(transitionOrId);
    if (!transitionId) {
      return [];
    }

    const ids = this.actionBindings.get(transitionId);
    return ids ? [...ids] : [];
  }

  // Returns the action entry currently bound to a transition. This helps consumers resolve bound SQL quickly.
  getBoundActionEntryForTransition(transitionOrId) {
    const actionId = this.getBoundActionIdsForTransition(transitionOrId)[0];
    if (!actionId) {
      return undefined;
    }

    return this.getActionEntryById(actionId);
  }

  // Returns all action bindings as serializable objects. This is used for event payloads and metadata export.
  getActionBindings() {
    return Array.from(this.actionBindings.entries()).flatMap(([transitionId, actionIds]) => {
      return [...actionIds].map((actionId) => ({
        transitionId,
        actionId
      }));
    });
  }

  // Emits query list changes on the event bus. Other services listen to this to recompute simulation state.
  _emitChanged() {
    this.eventBus.fire('sqlDialog.queries.changed', {
      queries: this.getQueries(),
      entries: this.getQueryEntries()
    });
  }

  // Emits query/action binding changes on the event bus. This keeps transition enablement and UI indicators in sync.
  _emitBindingsChanged() {
    this.eventBus.fire('sqlDialog.bindings.changed', {
      bindings: this.getQueryBindings(),
      actionBindings: this.getActionBindings()
    });
  }

  // Emits action list changes on the event bus. This keeps downstream action consumers updated.
  _emitActionsChanged() {
    this.eventBus.fire('sqlDialog.actions.changed', {
      actions: this.getActions(),
      entries: this.getActionEntries()
    });
  }

  // Normalizes transition input into a transition ID string. It supports both element objects and raw IDs.
  _resolveTransitionId(transitionOrId) {
    if (typeof transitionOrId === 'string') {
      return transitionOrId;
    }
    return transitionOrId?.id;
  }

  // Writes/removes the bound query ID on a transition business object. This keeps bindings persisted with diagram elements.
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

  // Writes/removes the bound action ID on a transition business object. This keeps bindings persisted with diagram elements.
  _setActionBindingOnBusinessObject(transitionOrId, actionIds) {
    if (typeof transitionOrId === 'string') {
      return;
    }

    const businessObject = transitionOrId?.businessObject;
    if (!businessObject) {
      return;
    }

    if (Array.isArray(actionIds) && actionIds.length > 0) {
      businessObject.actionIds = [...actionIds];
      businessObject.actionId = actionIds[0];
      return;
    }

    delete businessObject.actionIds;
    delete businessObject.actionId;
  }

  // Removes all bindings that reference a deleted query. This prevents stale transition references.
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

  // Removes all bindings that reference a deleted action. This prevents stale transition references.
  _removeBindingsForAction(actionId) {
    let removed = false;

    for (const [transitionId, boundActionIds] of this.actionBindings.entries()) {
      if (boundActionIds.has(actionId)) {
        boundActionIds.delete(actionId);
        if (boundActionIds.size === 0) {
          this.actionBindings.delete(transitionId);
        } else {
          this.actionBindings.set(transitionId, boundActionIds);
        }
        removed = true;
      }
    }

    if (removed) {
      this._emitBindingsChanged();
    }
  }

  // Creates a new query entry with an auto-incremented ID. This centralizes query entry shape and ID allocation.
  _createEntry(query = '') {
    return {
      id: `Q${this._nextQueryNumber++}`,
      text: String(query)
    };
  }

  // Creates a new action entry with parsed structured fields. This centralizes action entry shape and ID allocation.
  _createActionEntry(type = 'INSERT', sql = '') {
    const normalizedType = this._normalizeActionType(type);
    const normalizedSql = String(sql || '').trim();
    const parsed = this._extractActionParts(normalizedType, normalizedSql);
    return {
      id: `A${this._nextActionNumber++}`,
      type: normalizedType,
      sql: normalizedSql,
      intoTarget: parsed.intoTarget,
      valuesExpr: parsed.valuesExpr,
      fromTarget: parsed.fromTarget,
      whereExpr: parsed.whereExpr
    };
  }

  // Normalizes action type to either INSERT or DELETE. This ensures consistent downstream branching.
  _normalizeActionType(type) {
    return String(type || '').toUpperCase() === 'DELETE' ? 'DELETE' : 'INSERT';
  }

  // Parses structured action parts from an SQL string. This supports restoring editable action fields from persisted SQL.
  _extractActionParts(type, sql) {
    const normalizedSql = String(sql || '').trim();

    if (!normalizedSql) {
      return {
        intoTarget: '',
        valuesExpr: '',
        fromTarget: '',
        whereExpr: ''
      };
    }

    if (type === 'DELETE') {
      const deleteMatch = normalizedSql.match(/^\s*delete\s+from\s+(.+?)\s+where\s+(.+)\s*$/i);
      return {
        intoTarget: '',
        valuesExpr: '',
        fromTarget: deleteMatch ? deleteMatch[1] : '',
        whereExpr: deleteMatch ? deleteMatch[2] : ''
      };
    }

    const insertMatch = normalizedSql.match(/^\s*insert\s+into\s+(.+?)\s+values\s+(.+)\s*$/i);
    return {
      intoTarget: insertMatch ? insertMatch[1] : '',
      valuesExpr: insertMatch ? insertMatch[2] : '',
      fromTarget: '',
      whereExpr: ''
    };
  }

  // Builds canonical action SQL from structured action fields. This keeps stored action SQL consistent with the UI form.
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

  // Builds the compact dialog header with title and DB label. This is used by single-mode dialog states.
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

  // Builds the tabbed SQL/ACTIONS header in expanded mode. This keeps top-level tab switching UI in one place.
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
    sqlTab.textContent = 'QUERIES';
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

  // Builds the empty-state row for missing queries. This gives users clear feedback when no entries exist.
  _buildEmptyState(parent) {
    const empty = document.createElement('div');
    empty.className = 'sql-dialog__empty';
    empty.textContent = 'No queries yet';
    parent.appendChild(empty);
  }

  // Builds the upload prompt UI when no DB is loaded. This blocks SQL workflows until a DB is connected.
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

  // Adds a new action row and emits action updates. This is used by the Actions tab add button.
  _addActionEntry() {
    this.actionEntries.push(this._createActionEntry());
    this._emitActionsChanged();
    this.render();
  }

  // Clears all action rows and action bindings. This resets the Actions tab to an empty state.
  _clearActionEntries() {
    this.actionEntries = [];
    this.actionBindings.clear();
    this._emitActionsChanged();
    this._emitBindingsChanged();
    this.render();
  }

  // Removes one action row by ID and cleans related bindings. This prevents orphaned action references.
  _removeActionEntryById(actionId) {
    const index = this.actionEntries.findIndex((entry) => entry.id === actionId);
    if (index === -1) {
      return;
    }
    const removed = this.actionEntries.splice(index, 1)[0];
    if (removed?.id) {
      this._removeBindingsForAction(removed.id);
    }
    this._emitActionsChanged();
    this.render();
  }

  // Updates action type and recomputes canonical action SQL. This keeps form fields and stored SQL aligned.
  _setActionTypeById(actionId, type) {
    const entry = this.actionEntries.find((item) => item.id === actionId);
    if (!entry) {
      return;
    }
    entry.type = this._normalizeActionType(type);
    entry.sql = this._composeActionSql(entry);
    this._emitActionsChanged();
    this.render();
  }

  // Updates one structured action field and recomputes SQL. This drives live SQL composition while typing.
  _setActionPartById(actionId, key, value) {
    const entry = this.actionEntries.find((item) => item.id === actionId);
    if (!entry || !Object.prototype.hasOwnProperty.call(entry, key)) {
      return;
    }
    entry[key] = String(value ?? '');
    entry.sql = this._composeActionSql(entry);
    this._emitActionsChanged();
  }

  // Opens a file picker and forwards selected DB files to database service. This is the UI entry point for DB uploads.
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

  // Removes leading SELECT keyword from a query input string. This keeps the UI input focused on the variable part of SELECT.
  _stripSelectPrefix(value) {
    const text = String(value ?? '').trimStart();
    return text.replace(/^select\s+/i, '');
  }

  // Ensures a query string is stored with a SELECT prefix. This normalizes user input into executable query text.
  _withSelectPrefix(value) {
    const text = String(value ?? '');
    const trimmed = text.trim();
    if (!trimmed) {
      return '';
    }
    return `SELECT ${this._stripSelectPrefix(text)}`;
  }

  // Builds one query row with index, input, run, and remove controls. This encapsulates query row rendering and event handlers.
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

  // Builds the Actions tab list and controls for structured action editing. This is the main UI surface for action authoring.
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

        const idLabel = document.createElement('span');
        idLabel.className = 'sql-dialog__index';
        idLabel.textContent = String(entry.id);
        row.appendChild(idLabel);

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

  // Dispatches query execution by query ID through the event bus. Execution logic is handled by SQL parser service.
  runQueryById(queryId) {
    this.eventBus.fire('sqlDialog.runQuery', { queryId });
  }

  // Sets query output text/count and re-renders the dialog. This is the single write path for query execution output.
  setQueryRunOutput({ queryOutput, queryCountOutput = null } = {}) {
    this.queryOutput = String(queryOutput ?? '');
    this.queryCountOutput = Number.isFinite(queryCountOutput) ? queryCountOutput : null;
    this.render();
  }

  // Builds the query output panel section. This renders both result payload and queryCount metadata.
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

    const meta = document.createElement('div');
    meta.className = 'sql-dialog__output-meta';

    const count = document.createElement('div');
    count.className = 'sql-dialog__output-count';
    count.textContent = this.queryCountOutput === null
      ? 'queryCount: N/A'
      : `queryCount: ${this.queryCountOutput}`;
    meta.appendChild(count);

    if (this.isExpanded) {
      meta.appendChild(this._buildCollapseButton());
    }

    parent.appendChild(meta);
  }

  // Builds a shared footer row for tabs that do not show queryCount
  _buildActionsFooter(parent) {
    if (!this.isExpanded) {
      return;
    }

    const meta = document.createElement('div');
    meta.className = 'sql-dialog__output-meta';

    const spacer = document.createElement('div');
    spacer.className = 'sql-dialog__output-spacer';
    spacer.setAttribute('aria-hidden', 'true');
    meta.appendChild(spacer);

    meta.appendChild(this._buildCollapseButton());
    parent.appendChild(meta);
  }

  // Builds the reusable collapse button element used by all panel footers. This keeps collapse behavior defined in one place.
  _buildCollapseButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'sql-dialog__collapse';
    button.textContent = 'Collapse >';
    button.title = 'Collapse SQL panel';
    button.addEventListener('click', () => this._collapsePanel());
    return button;
  }


  // Rebuilds the dialog DOM for the current mode and state. This is called after all state updates to keep UI synchronized.
  render() {
    if (!this.container) {
      return;
    }

    this.container.innerHTML = '';
    const hasDatabase = Boolean(this.databaseService.getDbName());
    this.activeTab = this.activeTab === 'actions' ? 'actions' : 'sql';
    this.container.classList.toggle('sql-dialog--no-db', !hasDatabase);
    this.container.classList.toggle('is-expanded', this.isExpanded);

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
      this._buildActionsFooter(this.container);
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
