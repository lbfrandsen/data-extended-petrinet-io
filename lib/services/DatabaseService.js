// Testing database integration

import initSqlJs from 'sql.js';

export default class DatabaseService {
  constructor() {
    this.db = null;
    globalThis._db = this; // Expose immediately; query() will guard until ready.
    this._init();
  }

  async _init() {
    try {
      const SQL = await initSqlJs({
        // Resolve wasm from app root where webpack copies it.
        locateFile: (file) => file.endsWith('.wasm') ? '/sql-wasm.wasm' : file
      });

      this.db = new SQL.Database();

      this.db.run(`
        CREATE TABLE tokens (
          id INTEGER PRIMARY KEY,
          value TEXT,
          color TEXT
        );
      `);

      this.db.run(`
        INSERT INTO tokens VALUES (1, 'hello', 'red');
        INSERT INTO tokens VALUES (2, 'world', 'blue');
        INSERT INTO tokens VALUES (3, 'foo',   'red');
      `);

      console.log('Database ready, access via _db');
    } catch (error) {
      console.error('Database init failed:', error);
    }
  }

  query(sql) {
    if (!this.db) {
      console.error('Database not ready yet');
      return [];
    }

    try {
      const results = this.db.exec(sql);
      if (!results.length) return [];

      // sql.js returns [{ columns: [...], values: [[...], [...]] }]
      // Convert to array of plain objects for easier use
      const { columns, values } = results[0];
      return values.map(row =>
        Object.fromEntries(columns.map((col, i) => [col, row[i]]))
      );
    } catch (err) {
      console.error('Query error:', err.message);
      return [];
    }
  }
}
