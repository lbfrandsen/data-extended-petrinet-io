jest.mock('../../lib/core/editor.js', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation((options) => ({
            get: jest.fn((key) => options[key] ?? `mock-${key}`),
            destroy: jest.fn()
        }))
    };
});

jest.mock('../../lib/assets/petrinet-io.css', () => ({}), { virtual: true });
jest.mock('@fortawesome/fontawesome-free/css/all.min.css', () => ({}), { virtual: true });
jest.mock('bpmn-font/dist/css/bpmn-embedded.css', () => ({}), { virtual: true });

import PetriNetIO, { PetriNetIO as NamedPetriNetIO } from '../../lib/index.js';
import RealPetriNetIO from '../../lib/PetriNetIO.js';
import Editor from '../../lib/core/editor.js';

describe('PetriNetIO', () => {
    let container;
    let instance;

    beforeEach(() => {
        document.body.innerHTML = '';
        container = document.createElement('div');
        container.id = 'test-container';
        document.body.appendChild(container);

        instance = new RealPetriNetIO({ container, editorOptions: {} });
    });

    test('exports default and named PetriNetIO from lib/index.js', () => {
        expect(PetriNetIO).toBe(NamedPetriNetIO);
        expect(PetriNetIO).toBeDefined();
    });

    test('initializes editor with provided container', () => {
        expect(Editor).toHaveBeenCalledWith(expect.objectContaining({ container }));
        expect(instance.editor).toBeDefined();
    });

    test('getCanvas and getSimulationService delegate to editor.get()', () => {
        expect(instance.getCanvas()).toBe('mock-canvas');
        expect(instance.getSimulationService()).toBe('mock-simulationService');
    });

    test('export and import methods delegate to the editor services', async () => {
        const mockImporter = { importPnml: jest.fn(() => 'imported') };
        const mockExporter = { exportPnml: jest.fn(() => 'exported') };
        const mockDbService = { exportCombined: jest.fn(() => 'combined'), exportSeparateFiles: jest.fn(() => 'separate') };
        const mockTpnExporter = { exportTpn: jest.fn(() => 'tpn') };
        const mockSvgExporter = { exportSvg: jest.fn(() => 'svg') };
        const mockPdfExporter = { exportPdf: jest.fn(() => 'pdf') };

        instance._editor.get.mockImplementation((key) => {
            switch (key) {
                case 'pnmlImporter': return mockImporter;
                case 'pnmlExporter': return mockExporter;
                case 'dbPnmlService': return mockDbService;
                case 'tpnExporter': return mockTpnExporter;
                case 'svgExporter': return mockSvgExporter;
                case 'pdfExporter': return mockPdfExporter;
                default: return null;
            }
        });

        expect(instance.importPNML('<pnml/>')).toBe('imported');
        expect(instance.exportPNML()).toBe('exported');

        expect(instance.exportPNML()).toBe('exported');
        expect(instance.exportCombinedDBPNML()).toBe('combined');
        expect(instance.exportPNMLAndDB()).toBe('separate');
        expect(instance.exportTpn()).toBe('tpn');

        await instance.exportSVG('output.svg');
        await instance.exportPDF('output.pdf');
        expect(mockSvgExporter.exportSvg).toHaveBeenCalledWith('output.svg');
        expect(mockPdfExporter.exportPdf).toHaveBeenCalledWith('output.pdf');
    });

    test('destroy clears editor and container references', () => {
        instance.destroy();
        expect(instance._editor).toBeNull();
        expect(instance._container).toBeNull();
    });
});
