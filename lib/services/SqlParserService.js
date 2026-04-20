export default class SqlParserService {
  constructor(eventBus, sqlDialogService, databaseService) {
    this.eventBus = eventBus;
    this.sqlDialogService = sqlDialogService;
    this.databaseService = databaseService;

    this.eventBus.on('sqlDialog.runQuery', ({ queryId } = {}) => {
      this.handleRunQuery(queryId);
    });

    this.eventBus.on('sqlDialog.runAction', ({ actionId } = {}) => {
      this.executeActionById(actionId);
    });
  }

  handleRunQuery(queryId) {
    const normalizedQueryId = String(queryId || '').trim();
    const result = this.executeQueryById(normalizedQueryId, { requireSelect: true });

    if (!result.ok) {
      let queryOutput = `${normalizedQueryId}: ${result.error}`;

      if (result.code === 'missing_id') {
        queryOutput = 'Query ID is missing.';
      } else if (result.code === 'not_found') {
        queryOutput = `Query ${normalizedQueryId} not found.`;
      } else if (result.code === 'empty') {
        queryOutput = `${normalizedQueryId}: query is empty.`;
      } else if (result.code === 'no_db') {
        queryOutput = `${normalizedQueryId}: no database loaded. Upload a .db/.sqlite file first.`;
      } else if (result.code === 'not_select') {
        queryOutput = `${normalizedQueryId}: only SELECT queries are allowed in SQL QUERIES.`;
      }

      this.sqlDialogService.setQueryRunOutput({
        queryOutput,
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

  executeQueryById(queryId, { requireSelect = true } = {}) {
    const normalizedQueryId = String(queryId || '').trim();

    if (!normalizedQueryId) {
      return {
        ok: false,
        code: 'missing_id',
        error: 'Query ID is missing.',
        queryId: normalizedQueryId,
        queryText: '',
        rows: []
      };
    }

    const entry = this.sqlDialogService.getQueryEntryById(normalizedQueryId);
    if (!entry) {
      return {
        ok: false,
        code: 'not_found',
        error: `Query ${normalizedQueryId} not found.`,
        queryId: normalizedQueryId,
        queryText: '',
        rows: []
      };
    }

    const queryText = String(entry.text || '').trim();
    if (!queryText) {
      return {
        ok: false,
        code: 'empty',
        error: `Query ${normalizedQueryId} is empty.`,
        queryId: normalizedQueryId,
        queryText,
        rows: []
      };
    }

    if (!this.databaseService.getDbName()) {
      return {
        ok: false,
        code: 'no_db',
        error: 'No database loaded. Upload a .db/.sqlite file first.',
        queryId: normalizedQueryId,
        queryText,
        rows: []
      };
    }

    if (requireSelect && !/^\s*select\b/i.test(queryText)) {
      return {
        ok: false,
        code: 'not_select',
        error: 'Only SELECT queries are allowed in SQL QUERIES.',
        queryId: normalizedQueryId,
        queryText,
        rows: []
      };
    }

    const result = this.databaseService.queryWithStatus(queryText);
    if (!result.ok) {
      return {
        ok: false,
        code: 'execution_error',
        error: result.error,
        queryId: normalizedQueryId,
        queryText,
        rows: []
      };
    }

    return {
      ok: true,
      code: null,
      error: null,
      queryId: normalizedQueryId,
      queryText,
      rows: result.rows
    };
  }

  evaluateTransitionQuery(transition) {
    const queryId = String(
      transition?.businessObject?.queryGuardId
      || this.sqlDialogService?.getBoundQueryIdForTransition?.(transition)
      || ''
    ).trim();

    if (!queryId) {
      return {
        ok: true,
        status: 'none',
        queryId: null,
        queryText: '',
        rows: [],
        message: 'No SQL query attached to this transition.'
      };
    }

    const result = this.executeQueryById(queryId, { requireSelect: true });

    if (!result.ok) {
      if (result.code === 'no_db') {
        return {
          ok: false,
          status: 'error',
          queryId,
          queryText: result.queryText || '',
          rows: [],
          message: `Query ${queryId} is attached, but no database is loaded.`
        };
      }

      if (result.code === 'empty') {
        return {
          ok: false,
          status: 'error',
          queryId,
          queryText: result.queryText || '',
          rows: [],
          message: `Query ${queryId} is attached, but its SQL text is empty.`
        };
      }

      if (result.code === 'not_found') {
        return {
          ok: false,
          status: 'error',
          queryId,
          queryText: '',
          rows: [],
          message: `Query ${queryId} is attached, but it no longer exists.`
        };
      }

      if (result.code === 'not_select') {
        return {
          ok: false,
          status: 'error',
          queryId,
          queryText: result.queryText || '',
          rows: [],
          message: `Query ${queryId} must be a SELECT statement.`
        };
      }

      return {
        ok: false,
        status: 'error',
        queryId,
        queryText: result.queryText || '',
        rows: [],
        message: `Query ${queryId} failed: ${result.error}`
      };
    }

    return {
      ok: true,
      status: 'ok',
      queryId,
      queryText: result.queryText,
      rows: result.rows,
      message: `Query ${queryId} returned ${result.rows.length} row(s).`
    };
  }

  executeAttachedActionForTransition(transition) {
    const actionIds = this._resolveAttachedActionIds(transition);

    if (actionIds.length === 0) {
      return { ok: true, skipped: true, error: null };
    }

    for (const actionId of actionIds) {
      const result = this.executeActionById(actionId);
      if (!result.ok) {
        return {
          ok: false,
          skipped: false,
          error: `Action ${actionId} failed: ${result.error}`
        };
      }
    }

    return {
      ok: true,
      skipped: false,
      error: null
    };
  }

  _resolveAttachedActionIds(transition) {
    const boundIds = this.sqlDialogService?.getBoundActionIdsForTransition?.(transition);
    if (Array.isArray(boundIds) && boundIds.length > 0) {
      return boundIds.map((id) => String(id || '').trim()).filter(Boolean);
    }

    if (Array.isArray(transition?.businessObject?.actionIds)) {
      return transition.businessObject.actionIds.map((id) => String(id || '').trim()).filter(Boolean);
    }

    const fallback = String(transition?.businessObject?.actionId || '').trim();
    return fallback ? [fallback] : [];
  }

  executeActionById(actionId) {
    const normalizedActionId = String(actionId || '').trim();

    if (!normalizedActionId) {
      return { ok: false, error: 'Action ID is missing.' };
    }

    const entry = this.sqlDialogService.getActionEntryById(normalizedActionId);
    if (!entry) {
      return { ok: false, error: `Action ${normalizedActionId} not found.` };
    }

    if (!this.databaseService.getDbName()) {
      return { ok: false, error: 'No database loaded. Upload a .db/.sqlite file first.' };
    }

    const validationError = this._validateActionEntry(entry, normalizedActionId);
    if (validationError) {
      return { ok: false, error: validationError };
    }

    const result = this.databaseService.queryWithStatus(entry.sql);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, error: null };
  }

  _validateActionEntry(entry, actionId) {
    const type = String(entry?.type || '').toUpperCase() === 'DELETE' ? 'DELETE' : 'INSERT';
    const sql = String(entry?.sql || '').trim();

    if (!sql) {
      return `Action ${actionId} SQL is empty.`;
    }

    if (type === 'DELETE') {
      if (!/^\s*delete\s+from\s+.+\s+where\s+.+$/i.test(sql)) {
        return `Action ${actionId} must match DELETE FROM ... WHERE ...`;
      }
      return null;
    }

    if (!/^\s*insert\s+into\s+.+\s+values\s+.+$/i.test(sql)) {
      return `Action ${actionId} must match INSERT INTO ... VALUES ...`;
    }

    return null;
  }
}

SqlParserService.$inject = ['eventBus', 'sqlDialogService', 'databaseService'];
