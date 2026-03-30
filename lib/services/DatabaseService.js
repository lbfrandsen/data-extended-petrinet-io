import initSqlJs from 'sql.js';

export default class DatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    globalThis._db = this;
    this._init();
  }

  async _init() {
    try {
      this.SQL = await initSqlJs({
        locateFile: (file) => file.endsWith('.wasm') ? '/sql-wasm.wasm' : file
      });

      // Seed database for testing — overwritten if user uploads a .db file
      this.db = new this.SQL.Database();
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

      console.log('Seed database ready, access via _db');
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
      console.log('Seed database replaced with:', file.name);
    } catch (error) {
      console.error('Failed to load database file:', error);
    }
  }

  query(sql) {
    if (!this.db) {
      console.error('No database loaded yet');
      return [];
    }

    try {
      const results = this.db.exec(sql);
      if (!results.length) return [];

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