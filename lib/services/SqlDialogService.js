import { showSqlQueriesList } from './DialogService.js';

export default class SqlDialogService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.container = document.getElementById('sql-dialog');
    this._nextQueryNumber = 1;
    this.queries = [this._createEntry('')];

    if (!this.container) {
      return;
    }

    // Listen for external open requests on the eventbus 
    this.eventBus.on('sqlDialog.open', () => {
      showSqlQueriesList({
        title: 'SQL Queries',
        entries: this.getQueryEntries()
      });
    });

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
    this._emitChanged();
    this.render();
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

  _emitChanged() {
    this.eventBus.fire('sqlDialog.queries.changed', {
      queries: this.getQueries(),
      entries: this.getQueryEntries()
    });
  }

  _createEntry(query = '') {
    return {
      id: `Q${this._nextQueryNumber++}`,
      text: String(query)
    };
  }

  _buildHeader(parent) {
    const title = document.createElement('div');
    title.className = 'sql-dialog__title';
    title.textContent = 'SQL QUERIES';
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
  }
}

SqlDialogService.$inject = ['eventBus'];
