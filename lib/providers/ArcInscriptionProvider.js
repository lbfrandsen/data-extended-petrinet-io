// Elias Storm Vedel Jørgensen - new provider for arc inscription editing
function parseInscriptionLine(line) {
    const trimmed = String(line ?? '').trim();

    // inscriptions formats:
    // - <x> for single variable
    // - <x,y> for multiple variables
    if (!trimmed) {
        throw new Error('Inscription cannot be empty. Use x or <x> or <x,y>.');
    }

    let inner; // man kan skrive "let inner = ..." i JS

    // If user wrote <...>, extract inner; otherwise treat the whole input as inner.
    if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
        inner = trimmed.slice(1, -1).trim();
    } else {
        inner = trimmed;
    }

    if (!inner) {
        throw new Error('Inscription cannot be empty. Use x or <x> or <x,y>.');
    }

    const vars = inner
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

    // Basic variables
    for (const v of vars) {
        if (!/^[A-Za-z]+$/.test(v)) {
            throw new Error(`Invalid variable name "${v}". Use only letters like x, or A.`);
        }
    }

    return { text: `<${vars.join(',')}>`, vars };
}

// prompt for pop-up on arc inscription editing
function promptForArcInscription(connection) {
    const current =
        String(connection.businessObject?.arcInscription ?? '').trim() || '<x>';

    const msg =
        `Set arc inscription\n\n` +
        `Examples:\n` +
        `<x>\n` +
        `<x,y>\n\n`;

    const input = window.prompt(msg, current);
    if (input === null) return null;

    return parseInscriptionLine(input);
}

// function to be called from context pad provider
export function promptAndSetArcInscription(connection, eventBus) {
    try {
        const parsed = promptForArcInscription(connection);
        if (parsed === null) return;

        connection.businessObject.arcInscription = parsed.text;
        connection.businessObject.arcInscriptionVars = parsed.vars;

        eventBus.fire('element.changed', { element: connection });

    } catch (err) {
        alert(err.message);
    }
}