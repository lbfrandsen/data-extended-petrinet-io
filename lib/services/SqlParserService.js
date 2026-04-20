/*
SQL query parsing, validation and execution is handled here.
The service listen to 'sqlDialog.runQuery' event, which is emitted by SqlDialogService.js when user clicks run on a query. 
*/

export default class SqlParserService {
  constructor(eventBus, sqlDialogService, databaseService) {
    this.eventBus = eventBus;
    this.sqlDialogService = sqlDialogService;
    this.databaseService = databaseService;

    this.eventBus.on('sqlDialog.runQuery', ({ queryId } = {}) => {
      this.handleRunQuery(queryId);
    });
  }

  handleRunQuery(queryId) {
    const normalizedQueryId = String(queryId || '').trim();

    if (!normalizedQueryId) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: 'Query ID is missing.',
        queryCountOutput: null
      });
      return;
    }

    const entry = this.sqlDialogService.getQueryEntryById(normalizedQueryId);

    if (!entry) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: `Query ${normalizedQueryId} not found.`,
        queryCountOutput: null
      });
      return;
    }

    const query = String(entry.text || '').trim();

    if (!query) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: `${normalizedQueryId}: query is empty.`,
        queryCountOutput: null
      });
      return;
    }

    if (!this.databaseService.getDbName()) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: `${normalizedQueryId}: no database loaded. Upload a .db/.sqlite file first.`,
        queryCountOutput: null
      });
      return;
    }

    // SQL query tab is SELECT-only; INSERT/DELETE belongs in ACTIONS.
    if (!/^\s*select\b/i.test(query)) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: `${normalizedQueryId}: only SELECT queries are allowed in SQL QUERIES.`,
        queryCountOutput: null
      });
      return;
    }

    const result = this.databaseService.queryWithStatus(query);

    if (!result.ok) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: `${normalizedQueryId}: ${result.error}`,
        queryCountOutput: null
      });
      return;
    }

    const rows = result.rows;

    if (!rows.length) {
      this.sqlDialogService.setQueryRunOutput({
        queryOutput: `${normalizedQueryId}: query executed, no rows returned.`,
        queryCountOutput: 0
      });
      return;
    }

    this.sqlDialogService.setQueryRunOutput({
      queryOutput: `${normalizedQueryId}:\n${JSON.stringify(rows, null, 2)}`,
      queryCountOutput: rows.length
    });
  }
}

SqlParserService.$inject = ['eventBus', 'sqlDialogService', 'databaseService'];
