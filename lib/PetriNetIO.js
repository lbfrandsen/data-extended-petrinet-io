import Editor from './core/editor.js';

export default class PetriNetIO {
  /**
   * @param {Object} options
   * @param {string|HTMLElement} options.container - CSS selector or DOM node
   * @param {Object} [options.editorOptions] - forwarded to Editor
   */
  constructor(options = {}) {
    const { container, editorOptions = {}, ...rest } = options;

    if (!container) {
      throw new Error('PetriNetIO: `container` option is required');
    }

    this._container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!this._container) {
      throw new Error(`PetriNetIO: cannot find container "${container}"`);
    }

    // Editor should be your existing main class
    // Adjust the constructor signature if needed.
    this._editor = new Editor({
      container: this._container,
      ...editorOptions,
      ...rest
    });
  }

  get editor() {
    return this._editor;
  }

  getCanvas() {
    return this._editor.get('canvas');
  }

  getSimulationService() {
    return this._editor.get('simulationService');
  }

  importPNML(pnmlString) {
    const importer = this._editor.get('pnmlImporter'); // adjust if different
    return importer.importPnml(pnmlString);
  }

  loadFromFile(options = {}) {
    const importer = this._editor.get('pnmlImporter');
    importer.loadFromFile(options);
  }

  exportPNML(targetFileName = 'model.pnml', options = {}) {
    const exporter = this._editor.get('pnmlExporter');
    return exporter.exportPnml(targetFileName, options);
  }

  exportCombinedDBPNML(targetFileName = 'model.dbpnml') {
    const service = this._editor.get('dbPnmlService');
    return service.exportCombined(targetFileName);
  }

  exportPNMLAndDB(targetFileName = 'model-with-db.pnml') {
    const service = this._editor.get('dbPnmlService');
    return service.exportSeparateFiles({ pnmlFilename: targetFileName });
  }

  async importCombinedDBPNML(file) {
    const service = this._editor.get('dbPnmlService');
    return service.importCombinedFile(file);
  }

  async importPNMLAndDB(files) {
    const service = this._editor.get('dbPnmlService');
    return service.importSeparateFiles(files);
  }

  exportTpn(targetFileName = 'model.tpn') {
    const exporter = this._editor.get('tpnExporter');
    return exporter.exportTpn(targetFileName);
  }

  async exportSVG(targetFileName = 'model.svg') {
    const svgExporter = this._editor.get('svgExporter');
    svgExporter.exportSvg(targetFileName);
  }

  async exportPDF(targetFileName = 'model.pdf') {
    const pdfExporter = this._editor.get('pdfExporter');
    pdfExporter.exportPdf(targetFileName);
  }

  destroy() {
    if (this._editor && typeof this._editor.destroy === 'function') {
      this._editor.destroy();
    }

    this._editor = null;
    this._container = null;
  }
}
