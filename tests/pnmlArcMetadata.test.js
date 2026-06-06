import { buildArcXml } from '../lib/features/export-import-pnml/builders/ArcBuilder.js';
import ArcParser from '../lib/features/export-import-pnml/parsers/ArcParser.js';

const parseXml = (xml) => new DOMParser().parseFromString(xml, 'text/xml').documentElement;

const makeArcElement = (arcManual) => ({
    id: 'a1',
    source: { id: 'p1' },
    target: { id: 't1' },
    waypoints: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    businessObject: {
        arcInscription: '<x>',
        arcManual
    }
});

const makeParserDeps = () => {
    const source = {
        id: 'p1',
        type: 'petri:place',
        x: 10,
        y: 20,
        width: 30,
        height: 30
    };
    const target = {
        id: 't1',
        type: 'petri:transition',
        x: 100,
        y: 20,
        width: 40,
        height: 40
    };
    const created = [];
    const elementFactory = {
        createConnection: jest.fn((config) => config)
    };
    const canvas = {
        addConnection: jest.fn((connection) => {
            created.push(connection);
        })
    };

    return {
        elementMap: new Map([
            ['p1', source],
            ['t1', target]
        ]),
        elementFactory,
        canvas,
        root: { id: 'root' },
        created
    };
};

describe('PNML arc manual metadata', () => {
    test('buildArcXml persists explicit arcManual metadata', () => {
        // Arc inscription text alone cannot distinguish automatic from user-edited inscriptions.
        expect(buildArcXml(makeArcElement(true))).toContain('<property key="arcManual" value="true" />');
        expect(buildArcXml(makeArcElement(false))).toContain('<property key="arcManual" value="false" />');
    });

    test('ArcParser restores arcManual metadata when present', () => {
        const { elementMap, elementFactory, canvas, root, created } = makeParserDeps();
        const arcNode = parseXml(`
            <arc id="a1" source="p1" target="t1">
                <inscription><text>&lt;x&gt;</text></inscription>
                <toolspecific tool="petrinet.io" version="1.0">
                    <property key="arcManual" value="true" />
                </toolspecific>
            </arc>
        `);

        ArcParser.parse(arcNode, elementMap, elementFactory, canvas, root, () => ({ text: '<x>' }));

        expect(created[0].businessObject.arcManual).toBe(true);
        expect(created[0].businessObject.arcInscription).toBe('<x>');
        expect(created[0].businessObject.arcInscriptionVars).toEqual(['x']);
    });

    test('ArcParser defaults missing arcManual metadata to automatic even with inscription text', () => {
        const { elementMap, elementFactory, canvas, root, created } = makeParserDeps();
        const arcNode = parseXml(`
            <arc id="a1" source="p1" target="t1">
                <inscription><text>&lt;x&gt;</text></inscription>
            </arc>
        `);

        ArcParser.parse(arcNode, elementMap, elementFactory, canvas, root, () => ({ text: '<x>' }));

        expect(created[0].businessObject.arcManual).toBe(false);
    });
});
