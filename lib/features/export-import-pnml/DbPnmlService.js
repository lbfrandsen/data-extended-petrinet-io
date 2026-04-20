function bytesToBase64(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length) {
    return '';
  }

  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export default class DbPnmlService {

  static $inject = ['pnmlExporter', 'pnmlImporter', 'databaseService'];

  constructor(pnmlExporter, pnmlImporter, databaseService) {
    this.pnmlExporter = pnmlExporter;
    this.pnmlImporter = pnmlImporter;
    this.databaseService = databaseService;
  }

  _downloadText(text, filename, mimeType = 'application/json') {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  buildBundle() {
    const dbBytes = this.databaseService?.exportDatabase?.();
    const dbName = this.databaseService?.getDbName?.();

    if (!dbBytes || !dbName) {
      throw new Error('No database is currently loaded.');
    }

    return {
      format: 'dbpmnl',
      version: 1,
      pnml: this.pnmlExporter.getPnmlString({
        includeNetMetadata: true,
        includeQueryBindings: true
      }),
      db: {
        name: dbName,
        encoding: 'base64',
        data: bytesToBase64(dbBytes)
      }
    };
  }

  exportCombined(filename = 'petri-net.dbpmnl') {
    const bundle = this.buildBundle();
    this._downloadText(JSON.stringify(bundle, null, 2), filename, 'application/json');
  }

  exportSeparateFiles({ pnmlFilename = 'petri-net-with-db.pnml', dbFilename = null } = {}) {
    const hasDb = this.databaseService?.downloadDatabase?.(dbFilename);
    if (!hasDb) {
      throw new Error('No database is currently loaded.');
    }

    this.pnmlExporter.exportPnml(pnmlFilename, {
      includeNetMetadata: true,
      includeQueryBindings: true
    });
  }

  async importCombinedFile(file) {
    const content = await file.text();
    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error('The selected .dbpmnl file is not valid JSON.');
    }

    if (parsed?.format !== 'dbpmnl' || typeof parsed?.pnml !== 'string' || !parsed?.db?.data) {
      throw new Error('The selected .dbpmnl file is missing PNML or database data.');
    }

    this.pnmlImporter.importPnml(parsed.pnml, {
      importNetMetadata: true,
      importQueryBindings: true,
      resetExternalState: true
    });

    const loaded = await this.databaseService.loadFromUint8Array(
      base64ToBytes(parsed.db.data),
      parsed.db.name || 'database.db'
    );

    if (!loaded) {
      throw new Error('The database payload inside the .dbpmnl file could not be loaded.');
    }
  }

  async importSeparateFiles({ pnmlFile, dbFile }) {
    if (!pnmlFile || !dbFile) {
      throw new Error('Please provide both a .pnml file and a .db/.sqlite file.');
    }

    const pnmlContent = await pnmlFile.text();
    this.pnmlImporter.importPnml(pnmlContent, {
      importNetMetadata: true,
      importQueryBindings: true,
      resetExternalState: true
    });

    const dbBytes = new Uint8Array(await dbFile.arrayBuffer());
    const loaded = await this.databaseService.loadFromUint8Array(dbBytes, dbFile.name || 'database.db');
    if (!loaded) {
      throw new Error(`Could not load database file "${dbFile.name}".`);
    }
  }
}
