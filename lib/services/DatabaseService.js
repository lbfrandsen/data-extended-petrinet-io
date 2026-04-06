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
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      this.db = new this.SQL.Database(new Uint8Array(buffer));
      this.dbName = file.name || null;
      this.eventBus.fire('database.changed', { dbName: this.getDbName() });
      await showAlert({
        title: 'Database Loaded',
        message: `Successfully loaded database "${file.name}". You can now run SQL queries against it.`
      });
    } catch (error) {
      await showAlert({
        title: 'Failed to Load Database',
        message: `Could not load database from file "${file.name}".\n${error}`
      });
    }
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
}

DatabaseService.$inject = ['eventBus'];
