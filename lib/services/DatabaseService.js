import initSqlJs from 'sql.js';
import { showAlert } from './DialogService';

export default class DatabaseService {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.db = null;
    this.dbName = null;
    this.SQL = null;
    globalThis._db = this;
    this._init();
  }

  async _init() {
    try {
      this.SQL = await initSqlJs({
        locateFile: (file) => file.endsWith('.wasm') ? '/sql-wasm.wasm' : file
      });
      console.log('Database engine ready. Upload a .db/.sqlite file via "Upload DB".');
    } catch (error) {
      console.error('Database init failed:', error);
    }
  }

  async loadFromFile(file) {
    if (!this.SQL) {
      console.error('sql.js not ready yet');
      return false;
    }

    try {
      const buffer = await file.arrayBuffer();
      const loaded = await this.loadFromUint8Array(new Uint8Array(buffer), file.name || null, {
        showSuccessAlert: false
      });
      if (!loaded) {
        throw new Error('Invalid or unreadable database file');
      }
      await showAlert({
        title: 'Database Loaded',
        message: `Successfully loaded database "${file.name}". You can now run SQL queries and actions against it.\n\nThe changes made to your database are only written on disk when you export either as .db or .dppnml, but be careful regardless.`
      });
      return true;
    } catch (error) {
      await showAlert({
        title: 'Failed to Load Database',
        message: `Could not load database from file "${file.name}".\n${error}`
      });
      return false;
    }
  }

  async loadFromUint8Array(bytes, dbName = 'database.db', { showSuccessAlert = false } = {}) {
    if (!this.SQL) {
      console.error('sql.js not ready yet');
      return false;
    }

    try {
      if (this.db && typeof this.db.close === 'function') {
        this.db.close();
      }
      this.db = new this.SQL.Database(bytes);
      this.dbName = dbName || 'database.db';
      this.eventBus.fire('database.changed', { dbName: this.getDbName() });

      if (showSuccessAlert) {
        await showAlert({
          title: 'Database Loaded',
          message: `Successfully loaded database "${this.dbName}". You can now run SQL queries against it.`
        });
      }

      return true;
    } catch (error) {
      if (showSuccessAlert) {
        await showAlert({
          title: 'Failed to Load Database',
          message: `Could not load database "${dbName}".\n${error}`
        });
      }
      return false;
    }
  }

  clearDatabase() {
    if (this.db && typeof this.db.close === 'function') {
      this.db.close();
    }

    this.db = null;
    this.dbName = null;
    this.eventBus.fire('database.changed', { dbName: null });
  }

  exportDatabase() {
    if (!this.db) {
      return null;
    }

    return this.db.export();
  }

  snapshotDatabaseBytes() {
    const bytes = this.exportDatabase();
    return bytes ? new Uint8Array(bytes) : null;
  }

  restoreDatabaseFromSnapshot(bytes, dbName = null) {
    if (!bytes || !this.SQL) {
      return false;
    }

    try {
      if (this.db && typeof this.db.close === 'function') {
        this.db.close();
      }
      this.db = new this.SQL.Database(new Uint8Array(bytes));
      if (dbName) {
        this.dbName = dbName;
      }
      this.eventBus.fire('database.changed', { dbName: this.getDbName() });
      return true;
    } catch (error) {
      console.error('Database snapshot restore failed:', error);
      return false;
    }
  }

  hasDatabase() {
    return Boolean(this.db);
  }

  downloadDatabase(filename = null) {
    const bytes = this.exportDatabase();
    if (!bytes) {
      return false;
    }

    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || this.dbName || 'database.db';
    link.click();
    URL.revokeObjectURL(url);
    return true;
  }

  // Get name of db file if loaded
  getDbName () {
    return this.dbName;
  }

  query(sql) {
    const result = this.queryWithStatus(sql);
    return result.rows;
  }

  queryWithStatus(sql) {
    if (!this.db) {
      return {
        ok: false,
        rows: [],
        error: 'No database loaded yet'
      };
    }

    try {
      const results = this.db.exec(sql);
      if (!results.length) {
        return {
          ok: true,
          rows: [],
          error: null
        };
      }

      const { columns, values } = results[0];
      const rows = values.map(row =>
        Object.fromEntries(columns.map((col, i) => [col, row[i]]))
      );
      return {
        ok: true,
        rows,
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        rows: [],
        error: `Query error: ${err.message}`
      };
    }
  }

  runStatementsAtomically(statements = [], savepointName = 'sim_action_batch') {
    if (!this.db) {
      return {
        ok: false,
        error: 'No database loaded yet'
      };
    }

    const normalized = Array.isArray(statements)
      ? statements.map((sql) => String(sql || '').trim()).filter(Boolean)
      : [];

    if (!normalized.length) {
      return {
        ok: true,
        error: null
      };
    }

    const safeSavepoint = String(savepointName || 'sim_action_batch').replace(/[^A-Za-z0-9_]/g, '_');

    try {
      this.db.exec(`SAVEPOINT ${safeSavepoint}`);
    } catch (error) {
      return {
        ok: false,
        error: `Failed to open transaction savepoint: ${error.message}`
      };
    }

    try {
      normalized.forEach((sql) => this.db.exec(sql));
      this.db.exec(`RELEASE SAVEPOINT ${safeSavepoint}`);
      return {
        ok: true,
        error: null
      };
    } catch (error) {
      try {
        this.db.exec(`ROLLBACK TO SAVEPOINT ${safeSavepoint}`);
        this.db.exec(`RELEASE SAVEPOINT ${safeSavepoint}`);
      } catch (rollbackError) {
        return {
          ok: false,
          error: `Action batch failed (${error.message}) and rollback failed (${rollbackError.message}).`
        };
      }

      return {
        ok: false,
        error: `Query error: ${error.message}`
      };
    }
  }
}

DatabaseService.$inject = ['eventBus'];
