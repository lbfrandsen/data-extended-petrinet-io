export function normalizeTokenValues(token) {
    if (Array.isArray(token)) return token;
    return [token];
}

export function createStoredTokenFromValues(values, placeType) {
    return {
        values,
        type: placeType
    };
}

export function syncTokenCount(place) {
    const marking = place.businessObject.marking || [];
    place.businessObject.tokenCount = marking.length;
}

export function tokenMatchesPlaceType(values, type) {
    if (!type || values.length !== type.length) return false;

    return values.every((v, i) => {
        const t = type[i];

        if (t === 'int') return typeof v === 'number';
        if (t === 'string') return typeof v === 'string';
        if (t === 'bool') return typeof v === 'boolean';

        return true;
    });
}

export function formatSingleValue(value) {
    if (typeof value === 'string') return `"${value}"`;
    return String(value);
}

export function formatToken(token) {
    return token.values.map(formatSingleValue).join(', ');
}

export function groupTokens(marking) {
    const map = new Map();

    marking.forEach(token => {
        const key = JSON.stringify(token.values);

        if (!map.has(key)) {
            map.set(key, { token, count: 0 });
        }

        map.get(key).count++;
    });

    return Array.from(map.values());
}

export function removeStoredTokens(place, tokensToRemove) {
    const marking = place.businessObject.marking || [];

    place.businessObject.marking = marking.filter(
        t => !tokensToRemove.includes(t)
    );
}