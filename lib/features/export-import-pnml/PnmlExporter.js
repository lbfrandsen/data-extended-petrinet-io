/**
 * Exports Petri net diagrams to PNML (Petri Net Markup Language) format
 * Uses specialized builders for each element type
 */
import { buildPlaceXml } from './builders/PlaceBuilder.js';
import { buildTransitionXml } from './builders/TransitionBuilder.js';
import { buildArcXml } from './builders/ArcBuilder.js';
import { rules, showAlert } from '../../services/DialogService.js';

export default class PnmlExporter {

    static $inject = ["canvas", "elementRegistry", "simulationService", "sqlDialogService", "databaseService"]

    constructor(canvas, elementRegistry, simulationService, sqlDialogService, databaseService) {
        this.canvas = canvas;
        this.elementRegistry = elementRegistry;
        this.simulationService = simulationService;
        this.sqlDialogService = sqlDialogService;
        this.databaseService = databaseService;
    }

    // Generate PNML XML string from current diagram
    getPnmlString({ includeNetMetadata = true, includeQueryBindings = true } = {}) {
        const root = this.canvas.getRootElement();
        const elements = this.elementRegistry.filter(element =>
            element.parent === root
        );

        let pnml = this._getXmlHeader({ includeNetMetadata });

        // Build XML for each element using appropriate builder
        elements.forEach(element => {
            if (element.type === "petri:place") {
                pnml += buildPlaceXml(element);
            } else if (element.type === "petri:transition") {
                pnml += buildTransitionXml(element, { includeNetMetadata, includeQueryBindings });
            } else if (element.type === "petri:connection") {
                pnml += buildArcXml(element);
            }
        });

        pnml += this._getXmlFooter();
        return pnml;
    }

    // Get PNML file header
    _getXmlHeader({ includeNetMetadata = true } = {}) {
        if (!includeNetMetadata) {
            return `<?xml version="1.0" encoding="UTF-8"?>
<pnml>
    <net id="ptnet1" type="http://www.pnml.org/version-2009/grammar/ptnet">
        <page id="top-level">
`;
        }

        const rulesJson = this._escapeXml(JSON.stringify(rules));
        const simulationState = this.simulationService?.exportSimulationState
            ? this.simulationService.exportSimulationState()
            : {};
        const simulationStateJson = this._escapeXml(JSON.stringify(simulationState));
        const sqlMetadataJson = this._escapeXml(JSON.stringify(this._buildSqlMetadata()));

        return `<?xml version="1.0" encoding="UTF-8"?>
<pnml>
    <net id="ptnet1" type="http://www.pnml.org/version-2009/grammar/ptnet">
        <toolspecific tool="petrinet.io" version="1.0">
            <!-- Persist global simulation rules so they survive export/import round-trip. -->
            <property key="simulationRules" format="json">
                <text>${rulesJson}</text>
            </property>
            <!-- Persist simulation runtime state so step-back can continue after import. -->
            <property key="simulationState" format="json">
                <text>${simulationStateJson}</text>
            </property>
            <!-- Persist SQL queries/actions and transition bindings only; DB must be uploaded manually. -->
            <property key="sqlMetadata" format="json">
                <text>${sqlMetadataJson}</text>
            </property>
        </toolspecific>
        <page id="top-level">
`;
    }

    // Get PNML file footer
    _getXmlFooter() {
        return `        </page>
    </net>
</pnml>`;
    }

    _buildSqlMetadata() {
        return {
            queries: this.sqlDialogService?.getQueryEntries?.() ?? [],
            bindings: this.sqlDialogService?.getQueryBindings?.() ?? [],
            actions: this.sqlDialogService?.getActionEntries?.() ?? [],
            actionBindings: this.sqlDialogService?.getActionBindings?.() ?? []
        };
    }

    _escapeXml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }

    // Export diagram as PNML file download
    exportPnml(filename = 'petri-net.pnml', options = {}) {
        try {
            // Warn the user that the DB is not bundled when exporting to plain PNML
            if (!options.suppressDbWarning && this.databaseService.getDbName()) {
                const dbName = this.databaseService.getDbName();
                let message = 'A database is currently attached: "' + dbName + '".\n\nExporting to plain PNML does not include the database file. When importing this PNML file later, you will need to re-upload your database file in order to restore SQL query functionality.';

                if (options.includeNetMetadata) {
                    message += '\n\nThe export will preserve SQL query metadata.';
                    if (options.includeQueryBindings) {
                        message += ' Transition query bindings are also preserved.';
                    } else {
                        message += ' Transition query bindings are not preserved in this export.';
                    }
                } else {
                    message += '\n\nThis export does not preserve SQL query metadata or transition bindings.';
                }

                showAlert({
                    title: 'NOTICE',
                    message: 'You\'ve uploaded/connected a database: "' + this.databaseService.getDbName() + '".\n\nExporting to pnml doesn\'t include the uploaded db file. When importing your pnml file, you will need to re-upload your db file to restore SQL query and action functionality.\n\nAll written SQL queries/actions and their transition bindings are preserved.'
                })
            }
            const pnml = this.getPnmlString(options);

            // Create and trigger download
            const blob = new Blob([pnml], { type: 'application/xml' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error in exportPnml:', error);
            alert('Export failed: ' + error.message);
        }
    }
}
