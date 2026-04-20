import PnmlExporter from "./PnmlExporter.js";
import PnmlImporter from "./PnmlImporter.js";
import DbPnmlService from "./DbPnmlService.js";

export default {
    __init__: ['pnmlExporter', 'pnmlImporter', 'dbPnmlService'],
    pnmlExporter: ['type', PnmlExporter],
    pnmlImporter: ['type', PnmlImporter],
    dbPnmlService: ['type', DbPnmlService]
};
