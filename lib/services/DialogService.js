import keyHandlerUtil from '../helpers/KeyHandler-util.js';

let activeDialog = null;

function removeActiveDialog() {
  if (activeDialog) {
    activeDialog.remove();
    activeDialog = null;
  }
}

function createOverlay() {
  removeActiveDialog();

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.35)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const modal = document.createElement('div');
  modal.style.width = 'min(520px, 90vw)';
  modal.style.maxHeight = '80vh';
  modal.style.overflow = 'auto';
  modal.style.background = '#fff';
  modal.style.borderRadius = '12px';
  modal.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)';
  modal.style.padding = '20px';
  modal.style.fontFamily = 'Arial, sans-serif';
  modal.style.color = '#222';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  activeDialog = overlay;

  return { overlay, modal };
}

function createWideOverlay() {
  removeActiveDialog();

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.35)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const modal = document.createElement('div');
  modal.style.width = 'min(1040px, 90vw)';
  modal.style.maxHeight = '80vh';
  modal.style.overflow = 'auto';
  modal.style.background = '#fff';
  modal.style.borderRadius = '12px';
  modal.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)';
  modal.style.padding = '20px';
  modal.style.fontFamily = 'Arial, sans-serif';
  modal.style.color = '#222';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  activeDialog = overlay;

  return { overlay, modal };
}

function createTitle(text) {
  const title = document.createElement('h3');
  title.textContent = text;
  title.style.margin = '0 0 12px 0';
  title.style.fontSize = '18px';
  return title;
}

function createMessage(text) {
  const message = document.createElement('div');
  message.textContent = text;
  message.style.whiteSpace = 'pre-wrap';
  message.style.lineHeight = '1.4';
  message.style.marginBottom = '16px';
  return message;
}

function createButtonRow() {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.justifyContent = 'flex-end';
  row.style.gap = '10px';
  row.style.marginTop = '16px';
  return row;
}

function createButton(label, onClick, kind = 'secondary') {
  const button = document.createElement('button');
  button.textContent = label;
  button.type = 'button';
  button.style.padding = '8px 14px';
  button.style.borderRadius = '8px';
  button.style.border = '1px solid #ccc';
  button.style.cursor = 'pointer';
  button.style.fontSize = '14px';

  if (kind === 'primary') {
    button.style.background = '#1976d2';
    button.style.color = '#fff';
    button.style.border = '1px solid #1976d2';
  } else {
    button.style.background = '#f5f5f5';
    button.style.color = '#222';
  }

  button.addEventListener('click', onClick);
  return button;
}

// Fields for domain constraints
function createDomainInputs(pendingRules) {
  const container = document.createElement('div');
  container.style.display = 'none';
  container.style.marginLeft = '16px';
  container.style.gap = '8px';
  container.style.alignItems = 'center';
  container.style.flexDirection = 'row';
  container.style.marginBottom = '24px';

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.placeholder = 'Min';
  minInput.value = pendingRules.integerDomainMin ?? '';
  minInput.addEventListener('change', () => { pendingRules.integerDomainMin = Number(minInput.value); });

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.placeholder = 'Max';
  maxInput.value = pendingRules.integerDomainMax ?? '';
  maxInput.addEventListener('change', () => { pendingRules.integerDomainMax = Number(maxInput.value); });

  container.appendChild(document.createTextNode('Min:'));
  container.appendChild(minInput);
  container.appendChild(document.createTextNode('Max:'));
  container.appendChild(maxInput);

  return container;
}

// Fields for distribution constraints
function createDomainStdAndMean(pendingRules) {
  const container = document.createElement('div');
  container.style.display = 'none';
  container.style.marginLeft = '16px';
  container.style.gap = '8px';
  container.style.alignItems = 'center';
  container.style.flexDirection = 'row';
  container.style.marginBottom = '24px';

  const stdInput = document.createElement('input');
  stdInput.type = 'number';
  stdInput.placeholder = 'σ';
  stdInput.value = pendingRules.integerStd ?? '';
  stdInput.addEventListener('change', () => { pendingRules.integerStd = Number(stdInput.value); });

  const meanInput = document.createElement('input');
  meanInput.type = 'number';
  meanInput.placeholder = 'μ';
  meanInput.value = pendingRules.integerMean ?? '';
  meanInput.addEventListener('change', () => { pendingRules.integerMean = Number(meanInput.value); });

  container.appendChild(document.createTextNode('σ:'));
  container.appendChild(stdInput);
  container.appendChild(document.createTextNode('μ:'));
  container.appendChild(meanInput);

  return container;
}

function createRealDomainInputs(pendingRules) {
  const container = document.createElement('div');
  container.style.display = 'none';
  container.style.marginLeft = '16px';
  container.style.gap = '8px';
  container.style.alignItems = 'center';
  container.style.flexDirection = 'row';
  container.style.marginBottom = '24px';

  const minInput = document.createElement('input');
  minInput.type = 'number';
  minInput.placeholder = 'Min';
  minInput.value = pendingRules.realDomainMin ?? '';
  minInput.addEventListener('change', () => { pendingRules.realDomainMin = Number(minInput.value); });

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.placeholder = 'Max';
  maxInput.value = pendingRules.realDomainMax ?? '';
  maxInput.addEventListener('change', () => { pendingRules.realDomainMax = Number(maxInput.value); });

  container.appendChild(document.createTextNode('Min:'));
  container.appendChild(minInput);
  container.appendChild(document.createTextNode('Max:'));
  container.appendChild(maxInput);

  return container;
}

function createRealDistributionInputs(pendingRules) {
  const container = document.createElement('div');
  container.style.display = 'none';
  container.style.marginLeft = '16px';
  container.style.gap = '8px';
  container.style.alignItems = 'center';
  container.style.flexDirection = 'row';
  container.style.marginBottom = '24px';

  const stdInput = document.createElement('input');
  stdInput.type = 'number';
  stdInput.placeholder = 'σ';
  stdInput.value = pendingRules.realStd ?? '';
  stdInput.addEventListener('change', () => { pendingRules.realStd = Number(stdInput.value); });

  const meanInput = document.createElement('input');
  meanInput.type = 'number';
  meanInput.placeholder = 'μ';
  meanInput.value = pendingRules.realMean ?? '';
  meanInput.addEventListener('change', () => { pendingRules.realMean = Number(meanInput.value); });

  container.appendChild(document.createTextNode('σ:'));
  container.appendChild(stdInput);
  container.appendChild(document.createTextNode('μ:'));
  container.appendChild(meanInput);

  return container;
}

// Field for string input
function createRegexInput(pendingRules) {
  const container = document.createElement('div');
  container.style.display = 'flex';
  container.style.alignItems = 'center';
  container.style.gap = '8px';

  container.appendChild(document.createTextNode('String generation (RegEx):'));

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type regex here';
  input.value = pendingRules.stringRegex ?? '[a-zA-Z]{1,20}';
  input.addEventListener('change', () => { pendingRules.stringRegex = input.value; });

  container.appendChild(input);

  return container;
}

// Creates a radio group for selecting options, used for generation rules
function createRadioGroup(label, options, name, onChange) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  labelEl.style.marginRight = '4px';
  row.appendChild(labelEl);

  const pillEls = [];

  const updateStyles = (selectedValue) => {
    pillEls.forEach(({ pill, value }) => {
      const active = value === selectedValue;
      pill.style.background = active ? '#1976d2' : '#f0f0f0';
      pill.style.color = active ? '#fff' : '#222';
      pill.style.border = active ? '1px solid #1976d2' : '1px solid #ccc';
    });
  };

  options.forEach(({ value, display, checked = false }) => {
    const pill = document.createElement('label');
    pill.style.display = 'inline-flex';
    pill.style.alignItems = 'center';
    pill.style.padding = '6px 14px';
    pill.style.borderRadius = '20px';
    pill.style.cursor = 'pointer';
    pill.style.fontSize = '14px';
    pill.style.userSelect = 'none';
    pill.style.transition = 'background 0.15s, color 0.15s';
    pill.style.background = checked ? '#1976d2' : '#f0f0f0';
    pill.style.color = checked ? '#fff' : '#222';
    pill.style.border = checked ? '1px solid #1976d2' : '1px solid #ccc';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = value;
    radio.checked = checked;
    radio.style.display = 'none';
    radio.addEventListener('change', () => {
      updateStyles(value);
      onChange(value);
    });

    pill.appendChild(radio);
    pill.appendChild(document.createTextNode(display));
    row.appendChild(pill);
    pillEls.push({ pill, value });
  });

  return row;
}

// Save all rules in a map to be exported as a collective
export const rules = {
  integerGeneration: 'randomDomain',
  consumptionMode: 'random',
  productionMode: 'user',
  integerDomainMin: 0,
  integerDomainMax: 100,
  integerStd: 10,
  integerMean: 50,
  integerDistributionEnabled: false,

  realDomainMin: 0,
  realDomainMax: 100,
  realStd: 10,
  realMean: 50,
  realDecimals: 2,
  realDistributionEnabled: false,

  stringRegex: '[a-zA-Z]{1,20}'
};

export function getConsumptionMode(currentRules = rules) {
  return currentRules?.consumptionMode === 'user' ? 'user' : 'random';
}

export function getProductionMode(currentRules = rules) {
  if (currentRules?.productionMode === 'user') {
    return 'user';
  }

  if (currentRules?.productionMode === 'random') {
    return 'random';
  }

  return currentRules?.integerGeneration === 'defined' ? 'user' : 'random';
}

// Rules dialog with options for token value generation
export function showRulesDialog({ title = '', message = '', onClose = null }) {
  const { overlay, modal } = createWideOverlay();
  let unregisterEscape = null;
  let closed = false;
  const closeDialog = () => {
    if (closed) {
      return;
    }
    closed = true;
    unregisterEscape?.();
    removeActiveDialog();
  };

  title = `SIMULATION RULES`
  message = `Set rules for token value generation when firing transitions.\n\n`;
  modal.appendChild(createTitle(title));
  modal.appendChild(createMessage(message));

  const pendingRules = {
    ...rules,
    consumptionMode: getConsumptionMode(rules),
    productionMode: getProductionMode(rules)
  };

  const userOptions = document.createElement('div');
  userOptions.style.marginBottom = '24px';

  const consumptionGroup = createRadioGroup(
    'Consumption:',
    [
      { value: 'random', display: 'Random consumption', checked: pendingRules.consumptionMode === 'random' },
      { value: 'user', display: 'User selected input', checked: pendingRules.consumptionMode === 'user' }
    ],
    'simulation-consumption-mode',
    value => {
      pendingRules.consumptionMode = value;
    }
  );
  consumptionGroup.style.marginBottom = '12px';
  userOptions.appendChild(consumptionGroup);

  const productionGroup = createRadioGroup(
    'Production:',
    [
      { value: 'random', display: 'Random production', checked: pendingRules.productionMode === 'random' },
      { value: 'user', display: 'Output production from user input', checked: pendingRules.productionMode === 'user' }
    ],
    'simulation-production-mode',
    value => {
      pendingRules.productionMode = value;
      syncGenerationAvailability();
    }
  );
  userOptions.appendChild(productionGroup);
  modal.appendChild(userOptions);

  const bigSeparator = document.createElement('hr');
  bigSeparator.style.margin = '24px 0';
  modal.appendChild(bigSeparator);
  // --- WRAPPER FOR DISABLING ---
  const generationWrapper = document.createElement('div');
  modal.appendChild(generationWrapper);

  const setDisabled = (disabled) => {
    generationWrapper.style.opacity = disabled ? '0.5' : '1';
    generationWrapper.style.pointerEvents = disabled ? 'none' : 'auto';
  };

  const syncIntegerGeneration = () => {
    pendingRules.integerGeneration = pendingRules.integerDistributionEnabled ? 'randomDist' : 'randomDomain';
  };

  const syncGenerationAvailability = () => {
    const productionUsesUserInput = pendingRules.productionMode === 'user';
    setDisabled(productionUsesUserInput);
  };

  syncIntegerGeneration();
  syncGenerationAvailability();

  // =====================
  // INTEGER SECTION
  // =====================
  const intSection = document.createElement('div');
  intSection.style.marginBottom = '32px';

  const intTitle = document.createElement('div');
  intTitle.textContent = 'INTEGER';
  intTitle.style.fontWeight = 'bold';
  intTitle.style.marginBottom = '8px';
  intSection.appendChild(intTitle);

  // ALWAYS SHOW DOMAIN
  const intDomainInputs = createDomainInputs(pendingRules);
  intDomainInputs.style.display = 'flex';
  intSection.appendChild(intDomainInputs);

  // DISTRIBUTION BUTTON
  const intDistRow = document.createElement('div');
  intDistRow.style.display = 'flex';
  intDistRow.style.alignItems = 'center';
  intDistRow.style.gap = '8px';
  intDistRow.style.marginBottom = '8px';

  const intDistLabel = document.createElement('span');
  intDistLabel.textContent = 'Distribution:';
  intDistRow.appendChild(intDistLabel);

  const intDistBtn = document.createElement('button');
  intDistBtn.style.padding = '6px 14px';
  intDistBtn.style.borderRadius = '20px';
  intDistBtn.style.cursor = 'pointer';
  intDistBtn.style.fontSize = '14px';
  intDistBtn.style.border = '1px solid #ccc';
  intDistBtn.style.transition = 'background 0.15s, color 0.15s';

  const intDistributionInputs = createDomainStdAndMean(pendingRules);

  let intDistEnabled = Boolean(pendingRules.integerDistributionEnabled);
  intDistributionInputs.style.display = intDistEnabled ? 'flex' : 'none';
  intDistBtn.textContent = intDistEnabled ? 'Enabled' : 'Disabled';
  intDistBtn.style.background = intDistEnabled ? '#1976d2' : '#f0f0f0';
  intDistBtn.style.color = intDistEnabled ? '#fff' : '#222';
  intDistBtn.style.border = intDistEnabled ? '1px solid #1976d2' : '1px solid #ccc';

  intDistBtn.onclick = () => {
    intDistEnabled = !intDistEnabled;
    pendingRules.integerDistributionEnabled = intDistEnabled;
    intDistributionInputs.style.display = intDistEnabled ? 'flex' : 'none';
    intDistBtn.textContent = intDistEnabled ? 'Enabled' : 'Disabled';
    intDistBtn.style.background = intDistEnabled ? '#1976d2' : '#f0f0f0';
    intDistBtn.style.color = intDistEnabled ? '#fff' : '#222';
    intDistBtn.style.border = intDistEnabled ? '1px solid #1976d2' : '1px solid #ccc';
    syncIntegerGeneration();
  };

  if (intDistEnabled) {
    pendingRules.integerGeneration = 'randomDist';
  } else {
    pendingRules.integerGeneration = 'randomDomain';
  }

  intDistRow.appendChild(intDistBtn);
  intSection.appendChild(intDistRow);
  intSection.appendChild(intDistributionInputs);

  generationWrapper.appendChild(intSection);

  // =====================
  // REAL SECTION
  // =====================
  const realSection = document.createElement('div');
  realSection.style.marginBottom = '32px';

  const realTitle = document.createElement('div');
  realTitle.textContent = 'REAL';
  realTitle.style.fontWeight = 'bold';
  realTitle.style.marginBottom = '8px';
  realSection.appendChild(realTitle);

  // ALWAYS SHOW DOMAIN
  const realDomainInputs = createRealDomainInputs(pendingRules);
  realDomainInputs.style.display = 'flex';
  realSection.appendChild(realDomainInputs);

  // DISTRIBUTION BUTTON
  const realDistRow = document.createElement('div');
  realDistRow.style.display = 'flex';
  realDistRow.style.alignItems = 'center';
  realDistRow.style.gap = '8px';
  realDistRow.style.marginBottom = '8px';

  const realDistLabel = document.createElement('span');
  realDistLabel.textContent = 'Distribution:';
  realDistRow.appendChild(realDistLabel);

  const realDistBtn = document.createElement('button');
  realDistBtn.style.padding = '6px 14px';
  realDistBtn.style.borderRadius = '20px';
  realDistBtn.style.cursor = 'pointer';
  realDistBtn.style.fontSize = '14px';
  realDistBtn.style.transition = 'background 0.15s, color 0.15s';

  const realDistributionInputs = createRealDistributionInputs(pendingRules);

  let realDistEnabled = Boolean(pendingRules.realDistributionEnabled);
  realDistributionInputs.style.display = realDistEnabled ? 'flex' : 'none';
  realDistBtn.textContent = realDistEnabled ? 'Enabled' : 'Disabled';
  realDistBtn.style.background = realDistEnabled ? '#1976d2' : '#f0f0f0';
  realDistBtn.style.color = realDistEnabled ? '#fff' : '#222';
  realDistBtn.style.border = realDistEnabled ? '1px solid #1976d2' : '1px solid #ccc';

  realDistBtn.onclick = () => {
    realDistEnabled = !realDistEnabled;
    pendingRules.realDistributionEnabled = realDistEnabled;
    realDistributionInputs.style.display = realDistEnabled ? 'flex' : 'none';
    realDistBtn.textContent = realDistEnabled ? 'Enabled' : 'Disabled';
    realDistBtn.style.background = realDistEnabled ? '#1976d2' : '#f0f0f0';
    realDistBtn.style.color = realDistEnabled ? '#fff' : '#222';
    realDistBtn.style.border = realDistEnabled ? '1px solid #1976d2' : '1px solid #ccc';
  };

  realDistRow.appendChild(realDistBtn);
  realSection.appendChild(realDistRow);
  realSection.appendChild(realDistributionInputs);

  // DECIMALS
  const decimalsRow = document.createElement('div');
  decimalsRow.style.marginTop = '8px';

  const decimalsInput = document.createElement('input');
  decimalsInput.type = 'number';
  decimalsInput.value = pendingRules.realDecimals ?? 2;

  decimalsInput.onchange = () => {
    pendingRules.realDecimals = Number(decimalsInput.value);
  };

  decimalsRow.appendChild(document.createTextNode('Decimals:'));
  decimalsRow.appendChild(decimalsInput);

  realSection.appendChild(decimalsRow);

  generationWrapper.appendChild(realSection);

  // --- STRING ---
  const regexInput = createRegexInput(pendingRules);
  generationWrapper.appendChild(regexInput);

  // --- BOOL ---
  const boolRow = document.createElement('div');
  boolRow.textContent = 'Boolean: random';
  boolRow.style.marginTop = '24px';
  generationWrapper.appendChild(boolRow);

  // --- BUTTONS ---
  const buttons = createButtonRow();
  buttons.appendChild(
    createButton('Save', () => {
      Object.assign(rules, pendingRules);
      if (onClose) onClose(rules);
      closeDialog();
    }, 'primary')
  );

  buttons.appendChild(
    createButton('Close', closeDialog)
  );

  modal.appendChild(buttons);

  overlay.addEventListener('click', event => {
    if (event.target === overlay) {
      closeDialog();
    }
  });

  unregisterEscape = keyHandlerUtil.registerHotkey({
    target: document,
    key: 'Escape',
    when: () => activeDialog === overlay,
    callback: closeDialog
  });
}

export function showAlert({ title = 'Message', message = '' }) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEnterSubmit = null;
    let unregisterEscape = null;
    let closed = false;

    const closeAlert = () => {
      if (closed) {
        return;
      }
      closed = true;
      unregisterEnterSubmit?.();
      unregisterEscape?.();
      removeActiveDialog();
      resolve();
    };

    modal.appendChild(createTitle(title));
    modal.appendChild(createMessage(message));

    const buttons = createButtonRow();
    const okButton = createButton('OK', closeAlert, 'primary');
    buttons.appendChild(okButton);

    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeAlert();
      }
    });

    unregisterEnterSubmit = keyHandlerUtil.registerSubmitOnEnter({
      target: overlay,
      callback: closeAlert
    });
    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: overlay,
      key: 'Escape',
      callback: closeAlert
    });

    okButton.focus();
  });
}

export function showPrompt({
  title = 'Input',
  message = '',
  initialValue = '',
  placeholder = '',
  validate
}) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEnterSubmit = null;
    let unregisterEscape = null;
    let closed = false;

    modal.appendChild(createTitle(title));
    modal.appendChild(createMessage(message));

    const input = document.createElement('textarea');
    input.value = initialValue;
    input.placeholder = placeholder;
    input.rows = 6;
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';
    input.style.padding = '10px';
    input.style.borderRadius = '8px';
    input.style.border = '1px solid #ccc';
    input.style.fontSize = '14px';
    input.style.resize = 'vertical';
    modal.appendChild(input);

    const errorBox = document.createElement('div');
    errorBox.style.color = '#b00020';
    errorBox.style.fontSize = '13px';
    errorBox.style.marginTop = '10px';
    errorBox.style.minHeight = '18px';
    modal.appendChild(errorBox);

    const buttons = createButtonRow();
    const closePrompt = value => {
      if (closed) {
        return;
      }
      closed = true;
      unregisterEnterSubmit?.();
      unregisterEscape?.();
      removeActiveDialog();
      resolve(value);
    };

    const submit = () => {
      const value = input.value;

      if (typeof validate === 'function') {
        const result = validate(value);

        if (result) {
          errorBox.textContent = result;
          return;
        }
      }

      closePrompt(value);
    };

    buttons.appendChild(
      createButton('Cancel', () => closePrompt(null))
    );

    buttons.appendChild(
      createButton('Save', submit, 'primary')
    );

    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closePrompt(null);
      }
    });

    unregisterEnterSubmit = keyHandlerUtil.registerSubmitOnEnter({
      target: input,
      callback: submit
    });
    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: overlay,
      key: 'Escape',
      callback: () => closePrompt(null)
    });

    input.focus();
    input.select();
  });
}

export function showMultiPrompt({
  title = 'Input',
  message = '',
  fields = [],
  validate
}) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();

    modal.appendChild(createTitle(title));
    modal.appendChild(createMessage(message));

    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '12px';

    const inputs = fields.map(field => {
      const row = document.createElement('label');
      row.style.display = 'flex';
      row.style.flexDirection = 'column';
      row.style.gap = '6px';

      const label = document.createElement('span');
      label.textContent = field.label;
      label.style.fontSize = '14px';
      label.style.fontWeight = 'bold';

      const input = field.options
        ? document.createElement('select')
        : document.createElement('input');

      if (field.options) {
        field.options.forEach(option => {
          const optionEl = document.createElement('option');
          optionEl.value = option.value;
          optionEl.textContent = option.label;
          optionEl.selected = option.value === (field.initialValue ?? option.value);
          input.appendChild(optionEl);
        });
      } else {
        input.type = 'text';
        input.placeholder = field.placeholder ?? '';
        input.value = field.initialValue ?? '';
      }

      input.style.width = '100%';
      input.style.boxSizing = 'border-box';
      input.style.padding = '10px';
      input.style.borderRadius = '8px';
      input.style.border = '1px solid #ccc';
      input.style.fontSize = '14px';

      row.appendChild(label);
      row.appendChild(input);
      form.appendChild(row);

      return {
        key: field.key,
        input
      };
    });

    modal.appendChild(form);

    const errorBox = document.createElement('div');
    errorBox.style.color = '#b00020';
    errorBox.style.fontSize = '13px';
    errorBox.style.marginTop = '10px';
    errorBox.style.minHeight = '18px';
    modal.appendChild(errorBox);

    const buttons = createButtonRow();
    const submit = () => {
      const values = {};

      inputs.forEach(({ key, input }) => {
        values[key] = input.value;
      });

      if (typeof validate === 'function') {
        const result = validate(values);

        if (result) {
          errorBox.textContent = result;
          return;
        }
      }

      removeActiveDialog();
      resolve(values);
    };

    buttons.appendChild(
      createButton('Cancel', () => {
        removeActiveDialog();
        resolve(null);
      })
    );

    buttons.appendChild(
      createButton('Save', submit, 'primary')
    );

    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        removeActiveDialog();
        resolve(null);
      }
    });

    inputs.forEach(({ input }) => {
      keyHandlerUtil.registerSubmitOnEnter({
        target: input,
        callback: submit
      });
    });

    if (inputs[0]) {
      inputs[0].input.focus();
      if (typeof inputs[0].input.select === 'function') {
        inputs[0].input.select();
      }
    }
  });
}

// Combined query row picker + consumption token selector dialog.
// fireableRows: [{ row: {col: val,...}, rowBinding: {col: val,...} }]
// getPlansForRow(rowBinding): returns candidate firing plans for that row binding
// usesUserSelectedConsumption: bool
// formatValue(v): formats a token value for display
// Returns { rowBinding, consumptionBinding } or null on cancel.
export function showQueryRowAndConsumptionDialog({
  transition,
  fireableRows = [],
  usesUserSelectedConsumption = false,
  getPlansForRow,
  formatValue = String
}) {
  return new Promise(resolve => {
    const { overlay, modal } = createWideOverlay();
    let unregisterEscape = null;
    let closed = false;

    const closeDialog = (result = null) => {
      if (closed) return;
      closed = true;
      unregisterEscape?.();
      removeActiveDialog();
      resolve(result);
    };

    modal.style.display = 'flex';
    modal.style.flexDirection = 'column';
    modal.style.maxHeight = '85vh';
    modal.style.padding = '0';
    modal.style.overflow = 'hidden';

    // ── Header ─────────────────────────────────────────────────────────────
    const header = document.createElement('div');
    header.style.padding = '20px 20px 12px 20px';
    header.style.borderBottom = '1px solid #e0e0e0';
    header.style.flexShrink = '0';

    const titleEl = createTitle('Fire Transition');
    titleEl.style.margin = '0 0 4px 0';
    header.appendChild(titleEl);
    modal.appendChild(header);

    // ── Scrollable body ────────────────────────────────────────────────────
    const body = document.createElement('div');
    body.style.flex = '1';
    body.style.overflow = 'auto';
    body.style.padding = '0 20px 16px 20px';
    modal.appendChild(body);

    // ── Query row picker section ───────────────────────────────────────────
    const rowSectionTitle = document.createElement('div');
    rowSectionTitle.textContent = 'Query Result';
    rowSectionTitle.style.fontWeight = 'bold';
    rowSectionTitle.style.margin = '16px 0 8px 0';
    rowSectionTitle.style.fontSize = '14px';
    body.appendChild(rowSectionTitle);

    // Derive column names from first fireable row
    const columns = fireableRows.length > 0 ? Object.keys(fireableRows[0].row) : [];

    const tableWrapper = document.createElement('div');
    tableWrapper.style.overflowX = 'auto';
    tableWrapper.style.overflowY = 'auto';
    tableWrapper.style.maxHeight = '220px';
    tableWrapper.style.border = '1px solid #e0e0e0';
    tableWrapper.style.borderRadius = '8px';
    tableWrapper.style.marginBottom = '4px';

    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    table.style.fontSize = '13px';
    table.style.fontFamily = 'monospace';

    // Table header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headerRow.style.background = '#f5f5f5';
    columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col;
      th.style.padding = '8px 12px';
      th.style.textAlign = 'left';
      th.style.borderBottom = '2px solid #e0e0e0';
      th.style.whiteSpace = 'nowrap';
      th.style.fontFamily = 'Arial, sans-serif';
      th.style.fontSize = '12px';
      th.style.fontWeight = 'bold';
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table body
    const tbody = document.createElement('tbody');

    let selectedRowIndex = null;
    let selectedRowBinding = null;
    const tableRows = [];

    const updateConsumptionSection = () => {
      renderConsumptionSection(selectedRowBinding);
    };

    const setSelectedRow = (index) => {
      selectedRowIndex = index;
      selectedRowBinding = fireableRows[index].rowBinding;

      tableRows.forEach((tr, i) => {
        if (i === index) {
          tr.style.background = '#e3f0ff';
          tr.style.outline = '2px solid #1976d2';
        } else {
          tr.style.background = '';
          tr.style.outline = '';
        }
      });

      updateConsumptionSection();
      saveBtn.disabled = false;
      saveBtn.style.opacity = '1';
    };

    fireableRows.forEach(({ row }, rowIdx) => {
      const tr = document.createElement('tr');
      tr.style.cursor = 'pointer';
      tr.style.transition = 'background 0.1s';

      tr.addEventListener('mouseenter', () => {
        if (selectedRowIndex !== rowIdx) tr.style.background = '#f0f7ff';
      });
      tr.addEventListener('mouseleave', () => {
        if (selectedRowIndex !== rowIdx) tr.style.background = '';
      });
      tr.addEventListener('click', () => setSelectedRow(rowIdx));

      columns.forEach(col => {
        const td = document.createElement('td');
        const val = row[col];
        td.textContent = val === null ? 'null' : String(val);
        td.style.padding = '7px 12px';
        td.style.borderBottom = '1px solid #f0f0f0';
        td.style.whiteSpace = 'nowrap';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
      tableRows.push(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);
    body.appendChild(tableWrapper);

    const rowHint = document.createElement('div');
    rowHint.style.fontSize = '12px';
    rowHint.style.color = '#888';
    rowHint.style.marginBottom = '4px';
    rowHint.textContent = `${fireableRows.length} row(s) available. Click a row to select it.`;
    body.appendChild(rowHint);

    // ── Separator ──────────────────────────────────────────────────────────
    if (usesUserSelectedConsumption) {
      const sep = document.createElement('hr');
      sep.style.margin = '16px 0';
      sep.style.borderColor = '#e0e0e0';
      body.appendChild(sep);

      const consumptionTitle = document.createElement('div');
      consumptionTitle.textContent = 'Select which tokens should be consumed on each incoming arc.';
      consumptionTitle.style.fontSize = '14px';
      consumptionTitle.style.marginBottom = '12px';
      consumptionTitle.style.color = '#555';
      body.appendChild(consumptionTitle);
    }

    // ── Consumption dropdowns ──────────────────────────────────────────────
    const consumptionContainer = document.createElement('div');
    body.appendChild(consumptionContainer);

    // Holds the currently selected consumption values keyed by prompt key
    let currentDropdownSelections = {};
    let currentPrompts = [];

    const renderConsumptionSection = (rowBinding) => {
      consumptionContainer.innerHTML = '';
      currentDropdownSelections = {};
      currentPrompts = [];

      if (!usesUserSelectedConsumption || !rowBinding) return;

      const candidatePlans = getPlansForRow(rowBinding);
      if (!candidatePlans || candidatePlans.length === 0) return;

      const incomingArcs = Array.isArray(transition?.incoming) ? transition.incoming : [];

      incomingArcs.forEach((connection, index) => {
        const sourcePlace = connection?.source;
        if (!sourcePlace || sourcePlace.type !== 'petri:place') return;

        // Collect unique token options for this arc across all plans (filtered by rowBinding)
        const seen = new Set();
        const options = candidatePlans.flatMap(plan => {
          const step = plan?.consumption?.[index];
          if (!step || step.place?.id !== sourcePlace.id) return [];
          const key = JSON.stringify(step.tokens);
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ value: key, label: step.tokens.map(t => formatValue(t)).join(' + ') }];
        });

        if (options.length === 0) return;

        // Label: "placeName <arcInscription>" matching existing consumption dialog style
        const arcLabel = (() => {
          const name = String(sourcePlace?.businessObject?.name || sourcePlace.id);
          const inscription = connection?.businessObject?.inscription || '';
          return inscription ? `${name} <${inscription}>` : name;
        })();

        const promptKey = `incoming-${index}`;
        currentPrompts.push({ key: promptKey, arcIndex: index, sourcePlace });

        const fieldWrapper = document.createElement('div');
        fieldWrapper.style.marginBottom = '14px';

        const label = document.createElement('div');
        label.style.fontWeight = 'bold';
        label.style.fontSize = '14px';
        label.style.marginBottom = '6px';
        label.textContent = arcLabel;
        fieldWrapper.appendChild(label);

        const select = document.createElement('select');
        select.style.width = '100%';
        select.style.padding = '10px';
        select.style.borderRadius = '8px';
        select.style.border = '1px solid #ccc';
        select.style.fontSize = '14px';
        select.style.boxSizing = 'border-box';

        options.forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt.value;
          optEl.textContent = opt.label;
          select.appendChild(optEl);
        });

        // Default to first option
        currentDropdownSelections[promptKey] = options[0]?.value ?? null;

        select.addEventListener('change', () => {
          currentDropdownSelections[promptKey] = select.value;
        });

        fieldWrapper.appendChild(select);
        consumptionContainer.appendChild(fieldWrapper);
      });
    };

    // Initial render (empty — no row selected yet)
    renderConsumptionSection(null);

    // ── Footer buttons ─────────────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.style.padding = '12px 20px 20px 20px';
    footer.style.borderTop = '1px solid #e0e0e0';
    footer.style.flexShrink = '0';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '10px';
    modal.appendChild(footer);

    footer.appendChild(createButton('Cancel', () => closeDialog(null)));

    const saveBtn = createButton('Select Row', () => {
      if (selectedRowIndex === null) return;

      // Build consumption binding from dropdown selections
      let consumptionBinding = {};

      if (usesUserSelectedConsumption && currentPrompts.length > 0) {
        // Find the matching candidate plan
        const candidatePlans = getPlansForRow(selectedRowBinding);
        const incomingArcs = Array.isArray(transition?.incoming) ? transition.incoming : [];

        const matchedPlan = candidatePlans.find(plan =>
          currentPrompts.every(prompt => {
            const step = plan?.consumption?.[prompt.arcIndex];
            if (!step) return false;
            return JSON.stringify(step.tokens) === currentDropdownSelections[prompt.key];
          })
        );

        consumptionBinding = matchedPlan ? { ...matchedPlan.binding } : {};
      }

      closeDialog({ rowBinding: selectedRowBinding, consumptionBinding });
    }, 'primary');

    // Disabled until user selects a row
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.5';
    footer.appendChild(saveBtn);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeDialog(null);
    });

    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: document,
      key: 'Escape',
      when: () => activeDialog === overlay,
      callback: () => closeDialog(null)
    });
  });
}

export function showSqlQueriesList({
  entries = [],
  selectedQueryId = null,
  onSelectQuery = null
} = {}) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEnterSubmit = null;
    let unregisterEscape = null;
    let closed = false;

    const closeDialog = () => {
      if (closed) {
        return;
      }
      closed = true;
      unregisterEnterSubmit?.();
      unregisterEscape?.();
      removeActiveDialog();
      resolve();
    };

    const title = 'SQL QUERIES';

    modal.appendChild(createTitle(title));

    const description = document.createElement('p');
    description.style.margin = '0 0 12px 0';
    description.style.fontSize = '14px';
    description.style.color = '#555';
    description.style.whiteSpace = 'pre-wrap';
    description.textContent = 'Choose a query from the list below to run against the current database.\nThe return value of the query will act as the transition guard, and determine whether the input place will fire, as well as determine the value of the output token.';
    modal.appendChild(description);

    const content = document.createElement('div');
    content.style.whiteSpace = 'pre-wrap';
    content.style.lineHeight = '1.4';
    content.style.marginBottom = '16px';

    if (!entries.length) {
      content.textContent = 'No queries available.';
    } else {
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '8px';

      entries.forEach(({ id, text }) => {
        const row = document.createElement('div');
        row.style.padding = '8px 10px';
        row.style.border = '1px solid #e0e0e0';
        row.style.borderRadius = '8px';
        row.style.background = '#fafafa';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '12px';

        if (selectedQueryId && selectedQueryId === id) {
          row.style.border = '1px solid #1976d2';
          row.style.background = '#f2f8ff';
        }

        const rowInfo = document.createElement('div');
        rowInfo.style.minWidth = '0';

        const label = document.createElement('div');
        label.style.fontWeight = '700';
        label.style.marginBottom = '4px';
        label.textContent = String(id);

        const query = document.createElement('div');
        query.style.fontFamily = 'monospace';
        query.style.fontSize = '12px';
        query.style.wordBreak = 'break-word';
        query.textContent = String(text || '(empty)');

        rowInfo.appendChild(label);
        rowInfo.appendChild(query);
        row.appendChild(rowInfo);

        if (typeof onSelectQuery === 'function') {
          const selectButton = createButton(
            selectedQueryId === id ? 'Detach' : 'Attach',
            async () => {
              const result = await onSelectQuery(id);
              if (result !== false) {
                closeDialog();
              }
            },
            selectedQueryId === id ? 'secondary' : 'primary'
          );
          selectButton.style.padding = '6px 10px';
          row.appendChild(selectButton);
        }

        list.appendChild(row);
      });

      content.appendChild(list);
    }

    modal.appendChild(content);

    const buttons = createButtonRow();
    const closeButton = createButton('Close', closeDialog, 'primary');
    buttons.appendChild(closeButton);
    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeDialog();
      }
    });

    unregisterEnterSubmit = keyHandlerUtil.registerSubmitOnEnter({
      target: overlay,
      callback: closeDialog
    });
    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: overlay,
      key: 'Escape',
      callback: closeDialog
    });

    closeButton.focus();
  });
}
