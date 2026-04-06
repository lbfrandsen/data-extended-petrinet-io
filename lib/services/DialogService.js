import keyHandlerUtil from '../helpers/KeyHandler-util.js';

let activeDialog = null;

function removeActiveDialog() {
  if (activeDialog) {
    activeDialog.remove();
    activeDialog = null;
  }
}

function createOverlay(width = '520px') {
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
  modal.style.width = `min(${width}, 90vw)`;
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

function createRadioGroup(label, options, name, onChange) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '16px';

  const labelEl = document.createElement('span');
  labelEl.textContent = label;
  row.appendChild(labelEl);

  options.forEach(({ value, display, checked = false }) => {
    const wrapper = document.createElement('label');
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '4px';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = name;
    radio.value = value;
    radio.checked = checked;
    radio.addEventListener('change', () => onChange(value));

    wrapper.appendChild(radio);
    wrapper.appendChild(document.createTextNode(display));
    row.appendChild(wrapper);
  });

  return row;
}

// Generic min/max number input pair
function createMinMaxInputs(minKey, maxKey, pendingRules) {
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
  minInput.value = pendingRules[minKey] ?? '';
  minInput.addEventListener('change', () => { pendingRules[minKey] = Number(minInput.value); });

  const maxInput = document.createElement('input');
  maxInput.type = 'number';
  maxInput.placeholder = 'Max';
  maxInput.value = pendingRules[maxKey] ?? '';
  maxInput.addEventListener('change', () => { pendingRules[maxKey] = Number(maxInput.value); });

  container.append('Min:', minInput, 'Max:', maxInput);
  return container;
}

// Generic std/mean number input pair
function createStdMeanInputs(stdKey, meanKey, pendingRules) {
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
  stdInput.value = pendingRules[stdKey] ?? '';
  stdInput.addEventListener('change', () => { pendingRules[stdKey] = Number(stdInput.value); });

  const meanInput = document.createElement('input');
  meanInput.type = 'number';
  meanInput.placeholder = 'μ';
  meanInput.value = pendingRules[meanKey] ?? '';
  meanInput.addEventListener('change', () => { pendingRules[meanKey] = Number(meanInput.value); });

  container.append('σ:', stdInput, 'μ:', meanInput);
  return container;
}

// Builds a labeled section with domain inputs and a toggle for distribution inputs
function createNumberSection({ title, domainInputs, distInputs, pendingRules, enabledKey, onToggle }) {
  const section = document.createElement('div');
  section.style.marginBottom = '32px';

  const header = document.createElement('div');
  header.textContent = title;
  header.style.fontWeight = 'bold';
  header.style.marginBottom = '8px';
  section.appendChild(header);

  domainInputs.style.display = 'flex';
  section.appendChild(domainInputs);

  const btn = document.createElement('button');
  btn.style.marginBottom = '8px';

  let enabled = Boolean(pendingRules[enabledKey]);
  distInputs.style.display = enabled ? 'flex' : 'none';
  btn.textContent = enabled ? 'Disable distribution' : 'Enable distribution';

  btn.onclick = () => {
    enabled = !enabled;
    pendingRules[enabledKey] = enabled;
    distInputs.style.display = enabled ? 'flex' : 'none';
    btn.textContent = enabled ? 'Disable distribution' : 'Enable distribution';
    if (onToggle) onToggle(enabled);
  };

  section.appendChild(btn);
  section.appendChild(distInputs);
  return section;
}

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
  if (currentRules?.productionMode === 'user') return 'user';
  if (currentRules?.productionMode === 'random') return 'random';
  return currentRules?.integerGeneration === 'defined' ? 'user' : 'random';
}

export function showRulesDialog({ onClose = null } = {}) {
  const { modal } = createOverlay('1040px');
  modal.appendChild(createTitle('SIMULATION RULES'));
  modal.appendChild(createMessage('Set rules for token value generation when firing transitions.\n\n'));

  const pendingRules = {
    ...rules,
    consumptionMode: getConsumptionMode(rules),
    productionMode: getProductionMode(rules)
  };

  // Consumption / Production mode
  const userOptions = document.createElement('div');
  userOptions.style.marginBottom = '24px';

  const consumptionGroup = createRadioGroup(
    'Consumption:',
    [
      { value: 'random', display: 'Random consumption', checked: pendingRules.consumptionMode === 'random' },
      { value: 'user', display: 'User selected input', checked: pendingRules.consumptionMode === 'user' }
    ],
    'simulation-consumption-mode',
    value => { pendingRules.consumptionMode = value; }
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

  const separator = document.createElement('hr');
  separator.style.margin = '24px 0';
  modal.appendChild(separator);

  const generationWrapper = document.createElement('div');
  modal.appendChild(generationWrapper);

  const syncGenerationAvailability = () => {
    const disabled = pendingRules.productionMode === 'user';
    generationWrapper.style.opacity = disabled ? '0.5' : '1';
    generationWrapper.style.pointerEvents = disabled ? 'none' : 'auto';
  };

  pendingRules.integerGeneration = pendingRules.integerDistributionEnabled ? 'randomDist' : 'randomDomain';
  syncGenerationAvailability();

  // INTEGER
  generationWrapper.appendChild(createNumberSection({
    title: 'INTEGER',
    domainInputs: createMinMaxInputs('integerDomainMin', 'integerDomainMax', pendingRules),
    distInputs: createStdMeanInputs('integerStd', 'integerMean', pendingRules),
    pendingRules,
    enabledKey: 'integerDistributionEnabled',
    onToggle: enabled => { pendingRules.integerGeneration = enabled ? 'randomDist' : 'randomDomain'; }
  }));

  // REAL
  const realSection = createNumberSection({
    title: 'REAL',
    domainInputs: createMinMaxInputs('realDomainMin', 'realDomainMax', pendingRules),
    distInputs: createStdMeanInputs('realStd', 'realMean', pendingRules),
    pendingRules,
    enabledKey: 'realDistributionEnabled'
  });

  const decimalsRow = document.createElement('div');
  decimalsRow.style.marginTop = '8px';
  const decimalsInput = document.createElement('input');
  decimalsInput.type = 'number';
  decimalsInput.value = pendingRules.realDecimals ?? 2;
  decimalsInput.onchange = () => { pendingRules.realDecimals = Number(decimalsInput.value); };
  decimalsRow.append('Decimals:', decimalsInput);
  realSection.appendChild(decimalsRow);
  generationWrapper.appendChild(realSection);

  // STRING
  const regexContainer = document.createElement('div');
  regexContainer.style.display = 'flex';
  regexContainer.style.alignItems = 'center';
  regexContainer.style.gap = '8px';
  const regexInput = document.createElement('input');
  regexInput.type = 'text';
  regexInput.placeholder = 'Type regex here';
  regexInput.value = pendingRules.stringRegex ?? '[a-zA-Z]{1,20}';
  regexInput.addEventListener('change', () => { pendingRules.stringRegex = regexInput.value; });
  regexContainer.append('String generation (RegEx):', regexInput);
  generationWrapper.appendChild(regexContainer);

  // BOOL
  const boolRow = document.createElement('div');
  boolRow.textContent = 'Boolean: random';
  boolRow.style.marginTop = '24px';
  generationWrapper.appendChild(boolRow);

  // BUTTONS
  const buttons = createButtonRow();
  buttons.appendChild(createButton('Save', () => {
    Object.assign(rules, pendingRules);
    if (onClose) onClose(rules);
    removeActiveDialog();
  }, 'primary'));
  buttons.appendChild(createButton('Close', removeActiveDialog));
  modal.appendChild(buttons);
}

export function showAlert({ title = 'Message', message = '' }) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEnterSubmit = null;

    const closeAlert = () => {
      unregisterEnterSubmit?.();
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
      if (event.target === overlay) closeAlert();
    });

    unregisterEnterSubmit = keyHandlerUtil.registerSubmitOnEnter({
      target: overlay,
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
    const submit = () => {
      const value = input.value;
      if (typeof validate === 'function') {
        const result = validate(value);
        if (result) { errorBox.textContent = result; return; }
      }
      removeActiveDialog();
      resolve(value);
    };

    buttons.appendChild(createButton('Cancel', () => { removeActiveDialog(); resolve(null); }));
    buttons.appendChild(createButton('Save', submit, 'primary'));
    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) { removeActiveDialog(); resolve(null); }
    });

    keyHandlerUtil.registerSubmitOnEnter({ target: input, callback: submit });
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

      return { key: field.key, input };
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
      inputs.forEach(({ key, input }) => { values[key] = input.value; });
      if (typeof validate === 'function') {
        const result = validate(values);
        if (result) { errorBox.textContent = result; return; }
      }
      removeActiveDialog();
      resolve(values);
    };

    buttons.appendChild(createButton('Cancel', () => { removeActiveDialog(); resolve(null); }));
    buttons.appendChild(createButton('Save', submit, 'primary'));
    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) { removeActiveDialog(); resolve(null); }
    });

    inputs.forEach(({ input }) => {
      keyHandlerUtil.registerSubmitOnEnter({ target: input, callback: submit });
    });

    if (inputs[0]) {
      inputs[0].input.focus();
      if (typeof inputs[0].input.select === 'function') inputs[0].input.select();
    }
  });
}
