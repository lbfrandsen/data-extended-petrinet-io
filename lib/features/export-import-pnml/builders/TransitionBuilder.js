/**
 * Builds PNML XML string for a transition element
 */

function escapeXml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Generate XML for a transition (rectangle) element
export function buildTransitionXml(element) {
    const labelOffsetX = element.businessObject?.labelOffset?.x ?? 0;
    const labelOffsetY = element.businessObject?.labelOffset?.y ?? 0;
    const guardExpression = String(element.businessObject?.guardExpression ?? '').trim();
    const queryGuardId = String(element.businessObject?.queryGuardId ?? '').trim();

    const toolspecific = (guardExpression || queryGuardId)
        ? `                <toolspecific tool="petrinet.io" version="1.0">
${guardExpression ? `                    <property key="guardExpression" format="text">
                        <text>${escapeXml(guardExpression)}</text>
                    </property>
` : ''}${queryGuardId ? `                    <property key="queryGuardId" format="text">
                        <text>${escapeXml(queryGuardId)}</text>
                    </property>
` : ''}                </toolspecific>
`
        : '';

    return `            <transition id="${element.id}">
                <graphics>
                    <position x="${element.x}" y="${element.y}" />
                    <dimension x="${element.width}" y="${element.height}" />
                </graphics>
                <name>
                    <text>${escapeXml(element.businessObject?.name || '')}</text>
                    <graphics>
                        <offset x="${labelOffsetX}" y="${labelOffsetY}" />
                    </graphics>
                </name>
${toolspecific}            </transition>
`;
}

