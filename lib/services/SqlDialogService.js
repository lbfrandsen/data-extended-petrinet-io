export default class SqlDialogService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = document.getElementById('sql-dialog');
    this._nextQueryId = 1;
    this.queries = [this._createEntry('')];

    if (!this.container) {
      return;
    }

    this.render();
  }

  // Stack API exposed for other services/providers.
  pushQuery(query = '') {
    this.queries.push(this._createEntry(query));
    this._emitChanged();
    this.render();
  }

  popQuery() {
    // Convenience API: returns only the query text string.
    // Use this when callers do not care about stable query IDs.
    const entry = this.popQueryEntry();
    return entry ? entry.text : undefined;
  }

  popQueryEntry() {
    // Full entry API: returns { id, text } from the top of the stack.
    // Use this when query identity must be preserved for linking (e.g., transitions -> queries).
    if (!this.queries.length) {
      return undefined;
    }

    const query = this.queries.pop();
    this._emitChanged();
    this.render();
    return query;
  }

  clearQueries() {
    this.queries = [];
    this._emitChanged();
    this.render();
  }

  getQuery(index) {
    // Text-only accessor, aligned with popQuery().
    return this.queries[index]?.text;
  }

  getQueryId(index) {
    // ID-only accessor for stable query identity.
    return this.queries[index]?.id;
  }

  getQueryEntry(index) {
    // Full accessor, aligned with popQueryEntry().
    const entry = this.queries[index];
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

  _setQuery(index, value) {
    if (index < 0 || index >= this.queries.length) {
      return;
    }

    this.queries[index].text = String(value);
    this._emitChanged();
  }

  _emitChanged() {
    this.eventBus.fire('sqlDialog.queries.changed', {
      queries: this.getQueries(),
      entries: this.getQueryEntries()
    });
  }

  _createEntry(query = '') {
    return {
      id: this._nextQueryId++,
      text: String(query)
    };
  }

  _buildHeader(parent) {
    const title = document.createElement('div');
    title.className = 'sql-dialog__title';
    title.textContent = 'QUERIES';
    parent.appendChild(title);

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

  _buildRow(entry, index) {
    const row = document.createElement('div');
    row.className = 'sql-dialog__row';
    row.dataset.queryId = String(entry.id);

    const number = document.createElement('span');
    number.className = 'sql-dialog__index';
    number.textContent = `${index + 1}.`;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sql-dialog__input';
    input.placeholder = `Query ${index + 1}`;
    input.value = entry.text;
    input.addEventListener('input', (event) => {
      this._setQuery(index, event.target.value);
    });

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'sql-dialog__remove';
    removeButton.textContent = 'x';
    removeButton.title = 'Remove query';
    removeButton.addEventListener('click', () => {
      this.queries.splice(index, 1);
      this._emitChanged();
      this.render();
    });

    row.appendChild(number);
    row.appendChild(input);
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
      this.pushQuery('');
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
      this.queries.forEach((query, index) => {
        list.appendChild(this._buildRow(query, index));
      });
    }

    this.container.appendChild(list);
    this._buildActions(this.container);
  }
}

SqlDialogService.$inject = ['eventBus'];
