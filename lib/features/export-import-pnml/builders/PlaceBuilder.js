/**
 * Builds PNML XML string for a place element
 */

// This builder emits place XML including optional petrinet.io metadata for typed markings.
function escapeXml(value) {
  // This escapes XML-special characters so serialized metadata stays valid in PNML.
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getTokenCount(businessObject) {
  // This prefers marking length because marking is the source of truth for typed token state.
  const marking = businessObject?.marking;

  if (Array.isArray(marking)) {
    return marking.length;
  }

  const raw = businessObject?.tokens;

  if (Number.isFinite(raw)) {
    return raw;
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildToolspecificXml(businessObject) {
  // This writes petrinet.io-specific place typing and marking metadata into PNML.
  const placeType = businessObject?.place_type;
  const hasPlaceType = placeType !== null && placeType !== undefined;

  const marking = Array.isArray(businessObject?.marking) ? businessObject.marking : null;
  const hasMarking = Array.isArray(marking) && marking.length > 0;

  if (!hasPlaceType && !hasMarking) {
    // This skips emitting toolspecific when there is no custom metadata to persist.
    return '';
  }

  let toolspecificXml = `                <toolspecific tool="petrinet.io" version="1.0">
`;

  if (hasPlaceType) {
    // This persists the raw place_type key so token color typing survives round-trip.
    toolspecificXml += `                    <property key="placeType" value="${escapeXml(placeType)}" />
`;
  }

  if (hasMarking) {
    // This stores full marking payload as JSON text to preserve typed token values exactly.
    const markingJson = JSON.stringify(marking);
    toolspecificXml += `                    <property key="marking" format="json">
                        <text>${escapeXml(markingJson)}</text>
                    </property>
`;
  }

  toolspecificXml += `                </toolspecific>
`;

  return toolspecificXml;
}

// Generate XML for a place (circle) element
export function buildPlaceXml(element) {
  // This exports standard place geometry and labels plus custom metadata for typed tokens.
  const labelOffsetX = element.businessObject?.labelOffset?.x ?? 0;
  const labelOffsetY = element.businessObject?.labelOffset?.y ?? 0;
  const tokenCount = getTokenCount(element.businessObject);
  const toolspecificXml = buildToolspecificXml(element.businessObject);
  
  return `            <place id="${element.id}">
                <graphics>
                    <position x="${element.x}" y="${element.y}" />
                    <dimension x="${element.width}" y="${element.height}" />
                </graphics>
                <name>
                    <text>${element.businessObject?.name || ''}</text>
                    <graphics>
                        <offset x="${labelOffsetX}" y="${labelOffsetY}" />
                    </graphics>
                </name>
                <initialMarking>
                    <text>${tokenCount}</text>
                </initialMarking>
${toolspecificXml}
            </place>
`;
}
