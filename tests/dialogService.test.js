import {
    DEFAULT_RULES,
    getConsumptionMode,
    getProductionMode,
    rules,
    showAlert,
    showConfirmDialog,
    showMultiPrompt,
    showPrompt,
    showQueryRowAndConsumptionDialog,
    showResetModeDialog,
    showRulesDialog
} from '../lib/services/DialogService.js';

const clickButton = (label) => {
    const button = Array.from(document.querySelectorAll('button'))
        .find((candidate) => candidate.textContent === label);

    expect(button).toBeTruthy();
    button.click();
    return button;
};

const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

const resetRules = () => {
    Object.keys(rules).forEach((key) => {
        delete rules[key];
    });
    Object.assign(rules, DEFAULT_RULES);
};

describe('DialogService rules and mode helpers', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetRules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        resetRules();
    });

    test('getConsumptionMode accepts only supported modes and defaults invalid data to random', () => {
        // Consumption mode controls whether the simulation chooses consumed tokens automatically or asks the user.
        // Invalid persisted values should not leak into simulation behavior, so the helper falls back to random.
        expect(getConsumptionMode({ consumptionMode: 'random' })).toBe('random');
        expect(getConsumptionMode({ consumptionMode: 'user' })).toBe('user');
        expect(getConsumptionMode({ consumptionMode: 'manual' })).toBe('random');
        expect(getConsumptionMode(null)).toBe('random');
    });

    test('getProductionMode supports explicit modes and maps legacy defined generation to user input', () => {
        // Production mode replaced the older integerGeneration="defined" setting.
        // The fallback keeps older imported diagrams behaving as user-selected production.
        expect(getProductionMode({ productionMode: 'random' })).toBe('random');
        expect(getProductionMode({ productionMode: 'user' })).toBe('user');
        expect(getProductionMode({ productionMode: 'broken', integerGeneration: 'defined' })).toBe('user');
        expect(getProductionMode({ productionMode: 'broken', integerGeneration: 'randomDomain' })).toBe('random');
        expect(getProductionMode(null)).toBe('random');
    });

    test('showRulesDialog saves changed mode and generation rules into the exported rules object', () => {
        // The rules dialog is mostly UI, but saving it mutates the global rules consumed by simulation and export.
        // This covers the important behavior without checking layout details or button colors.
        const onClose = jest.fn();

        showRulesDialog({ onClose });

        document.querySelector('input[name="simulation-consumption-mode"][value="user"]').click();
        document.querySelector('input[name="simulation-production-mode"][value="user"]').click();

        const numberInputs = Array.from(document.querySelectorAll('input[type="number"]'));
        numberInputs[0].value = '-5';
        numberInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
        numberInputs[1].value = '25';
        numberInputs[1].dispatchEvent(new Event('change', { bubbles: true }));

        const stringInput = document.querySelector('input[type="text"]');
        stringInput.value = '[A-Z]{2}';
        stringInput.dispatchEvent(new Event('change', { bubbles: true }));

        clickButton('Save');

        expect(rules).toEqual(expect.objectContaining({
            consumptionMode: 'user',
            productionMode: 'user',
            integerDomainMin: -5,
            integerDomainMax: 25,
            stringRegex: '[A-Z]{2}'
        }));
        expect(onClose).toHaveBeenCalledWith(rules);
        expect(document.body.children).toHaveLength(0);
    });
});

describe('DialogService simple dialog promises', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        resetRules();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        resetRules();
    });

    test('showAlert renders plain text and resolves after OK closes the active dialog', async () => {
        // Alert callers only need to know that the message is visible and the returned promise resolves on close.
        // The test verifies that the overlay is removed so later dialogs do not stack on stale DOM.
        const promise = showAlert({ title: 'Problem', message: 'Something happened' });

        expect(document.body.textContent).toContain('Problem');
        expect(document.body.textContent).toContain('Something happened');

        clickButton('OK');

        await expect(promise).resolves.toBeUndefined();
        expect(document.body.children).toHaveLength(0);
    });

    test('showAlert renders html content when contentHtml is supplied', async () => {
        // Some callers pass preformatted HTML diagnostics instead of plain text.
        // This verifies that contentHtml takes that branch and still closes through the normal OK path.
        const promise = showAlert({
            title: 'Details',
            message: 'plain text should not be used',
            contentHtml: '<strong class="diagnostic">SQL error</strong>'
        });

        expect(document.querySelector('.diagnostic')?.textContent).toBe('SQL error');
        expect(document.body.textContent).not.toContain('plain text should not be used');

        clickButton('OK');

        await expect(promise).resolves.toBeUndefined();
    });

    test('showConfirmDialog resolves true or false from the selected close path', async () => {
        // Confirm dialogs are used for irreversible actions, so callers need a boolean.
        let promise = showConfirmDialog({ title: 'Confirm', message: 'Continue?' });
        clickButton('Yes');
        await expect(promise).resolves.toBe(true);

        promise = showConfirmDialog({ title: 'Confirm', message: 'Continue?' });
        clickButton('No');
        await expect(promise).resolves.toBe(false);
    });

    test('showResetModeDialog resolves master, soft, set-baseline, or null depending on the selected close path', async () => {
        // Reset mode is a semantic dialog: callers branch on master, soft, baseline updates, or null.
        // Covering each return value is more useful than checking how the buttons are styled.
        let promise = showResetModeDialog();
        clickButton('Master Reset');
        await expect(promise).resolves.toBe('master');

        promise = showResetModeDialog();
        clickButton('Soft Reset');
        await expect(promise).resolves.toBe('soft');

        promise = showResetModeDialog({ canSetMasterBaseline: true });
        clickButton('Set New Master Baseline');
        await expect(promise).resolves.toBe('set-master-baseline');

        promise = showResetModeDialog();
        expect(document.body.textContent).not.toContain('Set New Master Baseline');
        clickButton('Cancel');
        await expect(promise).resolves.toBeNull();

        promise = showResetModeDialog();
        clickButton('Cancel');
        await expect(promise).resolves.toBeNull();
    });

    test('showPrompt blocks invalid submissions, then resolves the edited value once validation passes', async () => {
        // Prompt validation should keep the dialog open and display an error without resolving the promise.
        // Once the value is valid, Save should resolve with the textarea contents.
        const promise = showPrompt({
            title: 'Set guard',
            initialValue: 'bad',
            validate: value => value === 'bad' ? 'Invalid guard' : null
        });
        let resolved = false;
        promise.then(() => {
            resolved = true;
        });

        clickButton('Save');
        await flushPromises();

        expect(resolved).toBe(false);
        expect(document.body.textContent).toContain('Invalid guard');

        const input = document.querySelector('textarea');
        input.value = 'x > 5';
        clickButton('Save');

        await expect(promise).resolves.toBe('x > 5');
    });

    test('showPrompt resolves null when cancelled', async () => {
        // Cancellation is distinct from submitting an empty string.
        // Callers use null to decide that no model update should be applied.
        const promise = showPrompt({ title: 'Rename', initialValue: 'P1' });

        clickButton('Cancel');

        await expect(promise).resolves.toBeNull();
    });

    test('showMultiPrompt collects text and select fields and respects custom submit labels', async () => {
        // Multi-prompt is used for structured user input, so the important contract is field-keyed output.
        // This covers both plain text inputs and select fields in one dialog.
        const promise = showMultiPrompt({
            title: 'Token values',
            submitLabel: 'Use values',
            fields: [
                { key: 'name', label: 'Name', initialValue: 'alpha' },
                {
                    key: 'kind',
                    label: 'Kind',
                    initialValue: 'real',
                    options: [
                        { value: 'int', label: 'Integer' },
                        { value: 'real', label: 'Real' }
                    ]
                }
            ]
        });

        const [nameInput, kindSelect] = document.querySelectorAll('input, select');
        nameInput.value = 'beta';
        kindSelect.value = 'int';
        clickButton('Use values');

        await expect(promise).resolves.toEqual({ name: 'beta', kind: 'int' });
    });

    test('showMultiPrompt blocks invalid structured values and resolves null on cancel', async () => {
        // Validation should work for the aggregated values object, not only for single prompts.
        // The cancel path should still resolve null so callers can safely abort.
        const invalidPromise = showMultiPrompt({
            fields: [{ key: 'count', label: 'Count', initialValue: '0' }],
            validate: values => Number(values.count) > 0 ? null : 'Count must be positive'
        });
        let resolved = false;
        invalidPromise.then(() => {
            resolved = true;
        });

        clickButton('Save');
        await flushPromises();

        expect(resolved).toBe(false);
        expect(document.body.textContent).toContain('Count must be positive');

        clickButton('Cancel');
        await expect(invalidPromise).resolves.toBeNull();
    });
});

describe('DialogService SQL row and consumption selection dialog', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('showQueryRowAndConsumptionDialog resolves the selected query row when consumption selection is disabled', async () => {
        // SQL row mode can ask the user to choose a database row even when token consumption remains automatic.
        // In that case the dialog should return the row binding and an empty consumption binding.
        const promise = showQueryRowAndConsumptionDialog({
            fireableRows: [
                { row: { id: 1, name: 'Alice' }, rowBinding: { id: 1, name: 'Alice' } },
                { row: { id: 2, name: 'Bob' }, rowBinding: { id: 2, name: 'Bob' } }
            ],
            usesUserSelectedConsumption: false
        });

        document.querySelectorAll('tbody tr')[1].click();
        clickButton('Select Row');

        await expect(promise).resolves.toEqual({
            rowBinding: { id: 2, name: 'Bob' },
            consumptionBinding: {}
        });
    });

    test('showQueryRowAndConsumptionDialog returns the matching consumption binding selected from dropdowns', async () => {
        // When SQL row selection and user-selected consumption are both enabled, the dialog must combine both choices.
        // The selected dropdown option is matched back to the candidate plan so simulation receives the full binding.
        const sourcePlace = {
            id: 'p1',
            type: 'petri:place',
            businessObject: { name: 'Input' }
        };
        const transition = {
            incoming: [
                {
                    source: sourcePlace,
                    businessObject: { arcInscription: '<x>' }
                }
            ]
        };
        const selectedPlan = {
            binding: { id: 1, x: 42 },
            consumption: [{ place: sourcePlace, tokens: [42] }]
        };
        const getPlansForRow = jest.fn(() => [
            selectedPlan,
            {
                binding: { id: 1, x: 99 },
                consumption: [{ place: sourcePlace, tokens: [99] }]
            }
        ]);

        const promise = showQueryRowAndConsumptionDialog({
            transition,
            fireableRows: [
                { row: { id: 1 }, rowBinding: { id: 1 } }
            ],
            usesUserSelectedConsumption: true,
            getPlansForRow,
            formatValue: value => `token:${value}`
        });

        document.querySelector('tbody tr').click();

        const select = document.querySelector('select');
        expect(Array.from(select.options).map(option => option.textContent)).toEqual([
            'Select binding',
            'token:42',
            'token:99'
        ]);

        select.value = JSON.stringify([42]);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        clickButton('Select Row');

        await expect(promise).resolves.toEqual({
            rowBinding: { id: 1 },
            consumptionBinding: { id: 1, x: 42 }
        });
    });

    test('showQueryRowAndConsumptionDialog resolves null when cancelled', async () => {
        // Cancelling the combined SQL dialog must tell the simulation that no row or token choice was made.
        // This is the guard against firing a transition after the user backs out.
        const promise = showQueryRowAndConsumptionDialog({
            fireableRows: [
                { row: { id: 1 }, rowBinding: { id: 1 } }
            ]
        });

        clickButton('Cancel');

        await expect(promise).resolves.toBeNull();
    });
});
