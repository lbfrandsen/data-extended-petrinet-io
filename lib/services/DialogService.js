import keyHandlerUtil from '../helpers/KeyHandler-util.js';

let activeDialog = null;

function removeActiveDialog() {
  if (activeDialog) {
    activeDialog.remove();
    activeDialog = null;
  }
}

// Creates centeret overlay with modal styling
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

// Creates wider version of overlay for dialogs that require more horizontal space
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
  modal.style.width = 'min(640px, 90vw)';
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

function createDivider() {
  const d = document.createElement('div');
  d.style.width = '100%';
  d.style.height = '1px';
  d.style.background = '#e0e0e0';
  d.style.margin = '16px 0';
  d.style.flex = '0 0 auto';
  return d;
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

const PINK_STYLE = '#ff00bf'
const DARK_RED_STYLE = '#850000';

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
      pill.style.background = active ? PINK_STYLE : '#f0f0f0';
      pill.style.color = active ? '#fff' : '#222';
      pill.style.border = active ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #ccc';
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
    pill.style.background = checked ? PINK_STYLE : '#f0f0f0';
    pill.style.color = checked ? '#fff' : '#222';
    pill.style.border = checked ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #ccc';

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
export const DEFAULT_RULES = Object.freeze({
  integerGeneration: 'randomDomain',
  consumptionMode: 'random',
  productionMode: 'random',
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
});

export const rules = {
  ...DEFAULT_RULES
};

function isMode(value) {
  return value === 'random' || value === 'user';
}

export function getConsumptionMode(currentRules = rules) {
  return isMode(currentRules?.consumptionMode)
    ? currentRules.consumptionMode
    : 'random';
}

export function getProductionMode(currentRules = rules) {
  return isMode(currentRules?.productionMode)
    ? currentRules.productionMode
    : (currentRules?.integerGeneration === 'defined' ? 'user' : 'random');
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

  const bigSeparator = document.createElement('hr');
  bigSeparator.style.margin = '24px 0';

  modal.style.position = 'relative';

  const simulationIcon = document.createElement('img');
  simulationIcon.src = '/sim_icon.png';
  simulationIcon.alt = 'Simulation rules';
  simulationIcon.style.position = 'absolute';
  simulationIcon.style.top = '16px';
  simulationIcon.style.right = '16px';
  simulationIcon.style.width = '70px';
  simulationIcon.style.height = '70px';
  simulationIcon.style.objectFit = 'contain';
  simulationIcon.style.pointerEvents = 'none';
  modal.appendChild(simulationIcon);

  title = `SIMULATION RULES`
  message = `Set rules for token value generation when firing transitions.\n\n`;
  modal.appendChild(createTitle(title));
  modal.appendChild(createMessage(message));

  modal.appendChild(bigSeparator.cloneNode(true));

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
      { value: 'user', display: 'User selected consumption', checked: pendingRules.consumptionMode === 'user' }
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


  modal.appendChild(bigSeparator.cloneNode(true));
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
  intDistBtn.style.background = intDistEnabled ? PINK_STYLE : '#f0f0f0';
  intDistBtn.style.color = intDistEnabled ? '#fff' : '#222';
  intDistBtn.style.border = intDistEnabled ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #ccc';

  intDistBtn.onclick = () => {
    intDistEnabled = !intDistEnabled;
    pendingRules.integerDistributionEnabled = intDistEnabled;
    intDistributionInputs.style.display = intDistEnabled ? 'flex' : 'none';
    intDistBtn.textContent = intDistEnabled ? 'Enabled' : 'Disabled';
    intDistBtn.style.background = intDistEnabled ? PINK_STYLE : '#f0f0f0';
    intDistBtn.style.color = intDistEnabled ? '#fff' : '#222';
    intDistBtn.style.border = intDistEnabled ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #ccc';
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
  realSection.appendChild(createDivider());
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
  realDistBtn.style.background = realDistEnabled ? PINK_STYLE : '#f0f0f0';
  realDistBtn.style.color = realDistEnabled ? '#fff' : '#222';
  realDistBtn.style.border = realDistEnabled ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #ccc';

  realDistBtn.onclick = () => {
    realDistEnabled = !realDistEnabled;
    pendingRules.realDistributionEnabled = realDistEnabled;
    realDistributionInputs.style.display = realDistEnabled ? 'flex' : 'none';
    realDistBtn.textContent = realDistEnabled ? 'Enabled' : 'Disabled';
    realDistBtn.style.background = realDistEnabled ? PINK_STYLE : '#f0f0f0';
    realDistBtn.style.color = realDistEnabled ? '#fff' : '#222';
    realDistBtn.style.border = realDistEnabled ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #ccc';
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

  decimalsRow.appendChild(document.createTextNode('Decimals:  '));
  decimalsRow.appendChild(decimalsInput);

  realSection.appendChild(decimalsRow);

  generationWrapper.appendChild(realSection);

  // --- STRING ---
  const regexInput = createRegexInput(pendingRules);
  generationWrapper.appendChild(createDivider());
  generationWrapper.appendChild(regexInput);

  // --- BOOL ---
  const boolRow = document.createElement('div');
  boolRow.textContent = 'Boolean: random';
  boolRow.style.marginTop = '24px';
  generationWrapper.appendChild(createDivider());
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

export function showResetModeDialog({
  title = 'Choose Reset Type',
  message = 'Select whether to reset to the master baseline or the most recent simulation start.'
} = {}) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEscape = null;
    let closed = false;

    const closeDialog = value => {
      if (closed) {
        return;
      }
      closed = true;
      unregisterEscape?.();
      removeActiveDialog();
      resolve(value);
    };

    modal.appendChild(createTitle(title));
    modal.appendChild(createMessage(message));

    const buttons = createButtonRow();
    buttons.style.justifyContent = 'space-between';

    const cancelButton = createButton('Cancel', () => closeDialog(null));
    const softButton = createButton('Soft Reset', () => closeDialog('soft'));
    const masterButton = createButton('Master Reset', () => closeDialog('master'), 'primary');

    const rightButtons = document.createElement('div');
    rightButtons.style.display = 'flex';
    rightButtons.style.gap = '10px';
    rightButtons.appendChild(softButton);
    rightButtons.appendChild(masterButton);

    buttons.appendChild(cancelButton);
    buttons.appendChild(rightButtons);
    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeDialog(null);
      }
    });

    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: overlay,
      key: 'Escape',
      callback: () => closeDialog(null)
    });

    masterButton.focus();
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

export function showBugReportDialog() {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEscape = null;
    let unregisterEnterSubmitTitle = null;
    let closed = false;

    modal.appendChild(createTitle('Report a bug'));
    modal.appendChild(createMessage('Describe the issue you encountered.'));

    const form = document.createElement('div');
    form.style.display = 'flex';
    form.style.flexDirection = 'column';
    form.style.gap = '12px';

    const titleRow = document.createElement('label');
    titleRow.style.display = 'flex';
    titleRow.style.flexDirection = 'column';
    titleRow.style.gap = '6px';

    const titleLabel = document.createElement('span');
    titleLabel.textContent = 'Title';
    titleLabel.style.fontSize = '14px';
    titleLabel.style.fontWeight = 'bold';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Short summary of the bug';
    titleInput.style.width = '100%';
    titleInput.style.boxSizing = 'border-box';
    titleInput.style.padding = '10px';
    titleInput.style.borderRadius = '8px';
    titleInput.style.border = '1px solid #ccc';
    titleInput.style.fontSize = '14px';

    titleRow.appendChild(titleLabel);
    titleRow.appendChild(titleInput);
    form.appendChild(titleRow);

    const descriptionRow = document.createElement('label');
    descriptionRow.style.display = 'flex';
    descriptionRow.style.flexDirection = 'column';
    descriptionRow.style.gap = '6px';

    const descriptionLabel = document.createElement('span');
    descriptionLabel.textContent = 'Description';
    descriptionLabel.style.fontSize = '14px';
    descriptionLabel.style.fontWeight = 'bold';

    const descriptionInput = document.createElement('textarea');
    descriptionInput.placeholder = 'What happened? What did you expect to happen? How can we reproduce it?';
    descriptionInput.rows = 6;
    descriptionInput.style.width = '100%';
    descriptionInput.style.boxSizing = 'border-box';
    descriptionInput.style.padding = '10px';
    descriptionInput.style.borderRadius = '8px';
    descriptionInput.style.border = '1px solid #ccc';
    descriptionInput.style.fontSize = '14px';
    descriptionInput.style.resize = 'vertical';

    descriptionRow.appendChild(descriptionLabel);
    descriptionRow.appendChild(descriptionInput);
    form.appendChild(descriptionRow);

    modal.appendChild(form);

    const errorBox = document.createElement('div');
    errorBox.style.color = '#b00020';
    errorBox.style.fontSize = '13px';
    errorBox.style.marginTop = '10px';
    errorBox.style.minHeight = '18px';
    modal.appendChild(errorBox);

    const closeDialog = result => {
      if (closed) {
        return;
      }
      closed = true;
      unregisterEscape?.();
      unregisterEnterSubmitTitle?.();
      removeActiveDialog();
      resolve(result);
    };

    const submit = () => {
      const title = titleInput.value.trim();
      const description = descriptionInput.value.trim();

      if (!title) {
        errorBox.textContent = 'Title is required.';
        titleInput.focus();
        return;
      }

      if (!description) {
        errorBox.textContent = 'Description is required.';
        descriptionInput.focus();
        return;
      }

      closeDialog({ title, description });
    };

    const buttons = createButtonRow();
    buttons.appendChild(createButton('Cancel', () => closeDialog(null)));
    buttons.appendChild(createButton('Submit', submit, 'primary'));
    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        closeDialog(null);
      }
    });

    unregisterEscape = keyHandlerUtil.registerHotkey({
      target: overlay,
      key: 'Escape',
      callback: () => closeDialog(null)
    });
    unregisterEnterSubmitTitle = keyHandlerUtil.registerSubmitOnEnter({
      target: titleInput,
      callback: submit
    });

    titleInput.focus();
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
      currentDropdownSelections = {};

      tableRows.forEach((tr, i) => {
        if (i === index) {
          tr.style.background = '#e3f0ff';
          tr.style.outline = `2px solid ${DARK_RED_STYLE}`;
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
    let allCandidatePlans = [];
    let selectElementsByKey = {}; // Maps promptKey to select DOM element

    const getFilteredPlans = (excludePromptKey = null) => {
      const selectedKeys = Object.entries(currentDropdownSelections).filter(([key, value]) => {
        // Exclude the current prompt being updated from filtering
        if (excludePromptKey && key === excludePromptKey) return false;
        return value && value !== '';
      });
      if (selectedKeys.length === 0) {
        return allCandidatePlans;
      }
      return allCandidatePlans.filter(plan =>
        selectedKeys.every(([key, selectedValue]) => {
          const arcIndex = Number(key.replace('incoming-', ''));
          const step = plan?.consumption?.[arcIndex];
          return step && JSON.stringify(step.tokens) === selectedValue;
        })
      );
    };

    const updateAllDropdowns = () => {
      currentPrompts.forEach(prompt => {
        const { key: promptKey, arcIndex, sourcePlace } = prompt;
        // Filter based on OTHER selections, not this one
        const filteredPlans = getFilteredPlans(promptKey);

        const seen = new Set();
        const options = filteredPlans.flatMap(plan => {
          const step = plan?.consumption?.[arcIndex];
          if (!step || step.place?.id !== sourcePlace.id) return [];
          const tokenKey = JSON.stringify(step.tokens);
          if (seen.has(tokenKey)) return [];
          seen.add(tokenKey);
          return [{ value: tokenKey, label: step.tokens.map(t => formatValue(t)).join(' + ') }];
        });

        const select = selectElementsByKey[promptKey];
        if (!select) return;

        const previousValue = select.value;
        select.innerHTML = '';

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Select binding';
        select.appendChild(emptyOption);

        options.forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt.value;
          optEl.textContent = opt.label;
          select.appendChild(optEl);
        });

        // Restore previous selection if still valid
        if (previousValue && options.some(opt => opt.value === previousValue)) {
          select.value = previousValue;
        } else {
          select.value = '';
          currentDropdownSelections[promptKey] = '';
        }
      });
    };

    const renderConsumptionSection = (rowBinding) => {
      consumptionContainer.innerHTML = '';
      selectElementsByKey = {};
      currentDropdownSelections = {};
      currentPrompts = [];

      if (!usesUserSelectedConsumption || !rowBinding) return;

      allCandidatePlans = getPlansForRow(rowBinding) || [];
      if (!allCandidatePlans || allCandidatePlans.length === 0) return;

      const incomingArcs = Array.isArray(transition?.incoming) ? transition.incoming : [];

      incomingArcs.forEach((connection, index) => {
        const sourcePlace = connection?.source;
        if (!sourcePlace || sourcePlace.type !== 'petri:place') return;

        // Collect unique token options for this arc across all plans
        const seen = new Set();
        const options = allCandidatePlans.flatMap(plan => {
          const step = plan?.consumption?.[index];
          if (!step || step.place?.id !== sourcePlace.id) return [];
          const key = JSON.stringify(step.tokens);
          if (seen.has(key)) return [];
          seen.add(key);
          return [{ value: key, label: step.tokens.map(t => formatValue(t)).join(' + ') }];
        });

        if (options.length === 0) return;

        // Label: "placeName <arcInscription>" - always show <>, even if empty
        const arcLabel = (() => {
          const name = String(sourcePlace?.businessObject?.name || sourcePlace.id);
          const rawInscription = connection?.businessObject?.arcInscription || '';
          return `${name} ${rawInscription || '<>'}`;
        })();

        const promptKey = `incoming-${index}`;
        currentPrompts.push({ key: promptKey, arcIndex: index, sourcePlace });
        currentDropdownSelections[promptKey] = '';

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

        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Select binding';
        select.appendChild(emptyOption);

        options.forEach(opt => {
          const optEl = document.createElement('option');
          optEl.value = opt.value;
          optEl.textContent = opt.label;
          select.appendChild(optEl);
        });

        select.addEventListener('change', () => {
          currentDropdownSelections[promptKey] = select.value;
          updateAllDropdowns();
        });

        selectElementsByKey[promptKey] = select;
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
  queryBindingTransitionIds = {},
  onSelectQuery = null,
  actionEntries = [],
  selectedActionIds = [],
  actionBindingTransitionIds = {},
  onSelectAction = null,
  onResetBindings = null
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

    const applyAttachButtonStyle = (button, isAttached) => {
      button.style.background = isAttached ? '#f5f5f5' : PINK_STYLE;
      button.style.color = isAttached ? '#222' : '#fff';
      button.style.border = isAttached ? '1px solid #ccc' : `1.5px solid ${DARK_RED_STYLE}`;
    };
    const queryRowRefs = new Map();
    const actionRowRefs = new Map();

    const renderQuerySelectionState = () => {
      queryRowRefs.forEach((ref, queryId) => {
        const active = selectedQueryId === queryId;
        ref.row.style.border = active ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #e0e0e0';
        ref.row.style.background = active ? '#f2f8ff' : '#fafafa';
        ref.button.textContent = active ? 'Detach' : 'Attach';
        applyAttachButtonStyle(ref.button, active);
      });
    };

    const renderActionSelectionState = () => {
      actionRowRefs.forEach((ref, actionId) => {
        const selectedNow = selectedActionIds.includes(actionId);
        ref.row.style.border = selectedNow ? `1.5px solid ${DARK_RED_STYLE}` : '1px solid #e0e0e0';
        ref.row.style.background = selectedNow ? '#f2f8ff' : '#fafafa';
        ref.button.textContent = selectedNow ? 'Detach' : 'Attach';
        applyAttachButtonStyle(ref.button, selectedNow);
      });
    };

    const title = 'QUERIES';

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
          row.style.border = `1.5px solid ${DARK_RED_STYLE}`;
          row.style.background = '#f2f8ff';
        }

        const rowInfo = document.createElement('div');
        rowInfo.style.minWidth = '0';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        header.style.marginBottom = '4px';

        const label = document.createElement('div');
        label.style.fontWeight = '700';
        label.textContent = String(id);
        header.appendChild(label);

        const transitionIds = Array.isArray(queryBindingTransitionIds?.[id]) ? queryBindingTransitionIds[id] : [];
        const boundCount = transitionIds.length;
        if (boundCount > 0) {
          const boundToBadge = document.createElement('span');
          boundToBadge.textContent = `Bound to ${transitionIds.join(', ')}`;
          boundToBadge.style.fontSize = '11px';
          boundToBadge.style.lineHeight = '1';
          boundToBadge.style.padding = '4px 7px';
          boundToBadge.style.borderRadius = '999px';
          boundToBadge.style.background = '#f6d1df';
          boundToBadge.style.border = `1.5px solid ${DARK_RED_STYLE}`;
          boundToBadge.style.color = '#4b0f1f';
          header.appendChild(boundToBadge);
        }

        const query = document.createElement('div');
        query.style.fontFamily = 'monospace';
        query.style.fontSize = '12px';
        query.style.wordBreak = 'break-word';
        query.textContent = String(text || '(empty)');

        rowInfo.appendChild(header);
        rowInfo.appendChild(query);
        row.appendChild(rowInfo);

        if (typeof onSelectQuery === 'function') {
          const selectButton = createButton(
            selectedQueryId === id ? 'Detach' : 'Attach',
            async () => {
              const result = await onSelectQuery(id);
              if (result === false) {
                return;
              }
              selectedQueryId = selectedQueryId === id ? null : id;
              renderQuerySelectionState();
            },
            selectedQueryId === id ? 'secondary' : 'primary'
          );
          selectButton.style.padding = '6px 10px';
          applyAttachButtonStyle(selectButton, selectedQueryId === id);
          queryRowRefs.set(id, { row, button: selectButton });
          row.appendChild(selectButton);
        }

        list.appendChild(row);
      });

      content.appendChild(list);
    }

    modal.appendChild(content);

    const divider = document.createElement('div');
    divider.style.borderTop = '1px solid #e7e7e7';
    divider.style.margin = '10px 0 12px 0';
    modal.appendChild(divider.cloneNode(true));

    const actionsTitle = document.createElement('h3');
    actionsTitle.textContent = 'ACTIONS';
    actionsTitle.style.margin = '0 0 12px 0';
    actionsTitle.style.fontSize = '18px';
    modal.appendChild(actionsTitle);

    const actionsDescription = document.createElement('p');
    actionsDescription.style.margin = '0 0 12px 0';
    actionsDescription.style.fontSize = '14px';
    actionsDescription.style.color = '#555';
    actionsDescription.style.whiteSpace = 'pre-wrap';
    actionsDescription.textContent = 'Choose an action from the list below to execute when this transition fires.\nWhen an action executes, it will modify your database irreversibly, so please be careful :)';
    modal.appendChild(actionsDescription);

    const actionsContent = document.createElement('div');
    actionsContent.style.whiteSpace = 'pre-wrap';
    actionsContent.style.lineHeight = '1.4';
    actionsContent.style.marginBottom = '16px';

    if (!actionEntries.length) {
      actionsContent.textContent = 'No actions available.';
    } else {
      const list = document.createElement('div');
      list.style.display = 'flex';
      list.style.flexDirection = 'column';
      list.style.gap = '8px';

      actionEntries.forEach(({ id, sql, type }) => {
        const isSelected = Array.isArray(selectedActionIds) && selectedActionIds.includes(id);
        const row = document.createElement('div');
        row.style.padding = '8px 10px';
        row.style.border = '1px solid #e0e0e0';
        row.style.borderRadius = '8px';
        row.style.background = '#fafafa';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.justifyContent = 'space-between';
        row.style.gap = '12px';

        if (isSelected) {
          row.style.border = `1.5px solid ${DARK_RED_STYLE}`;
          row.style.background = '#f2f8ff';
        }

        const rowInfo = document.createElement('div');
        rowInfo.style.minWidth = '0';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.gap = '8px';
        header.style.marginBottom = '4px';

        const label = document.createElement('div');
        label.style.fontWeight = '700';
        label.textContent = `${String(id)}${type ? ` (${String(type)})` : ''}`;
        header.appendChild(label);

        // Badges showing which transitions this action is currently bound to and their names
        const transitionIds = Array.isArray(actionBindingTransitionIds?.[id]) ? actionBindingTransitionIds[id] : [];
        const boundCount = transitionIds.length;
        if (boundCount > 0) {
          const badge = document.createElement('span');
          badge.textContent = `Bound to ${boundCount} transition${boundCount === 1 ? '' : 's'} (${transitionIds.join(', ')})`;
          badge.style.fontSize = '11px';
          badge.style.lineHeight = '1';
          badge.style.padding = '4px 7px';
          badge.style.borderRadius = '999px';
          badge.style.background = '#f6d1df';
          badge.style.border = `1.5px solid ${DARK_RED_STYLE}`;
          badge.style.color = '#4b0f1f';
          header.appendChild(badge);
        }

        const actionSql = document.createElement('div');
        actionSql.style.fontFamily = 'monospace';
        actionSql.style.fontSize = '12px';
        actionSql.style.wordBreak = 'break-word';
        actionSql.textContent = String(sql || '(empty)');

        rowInfo.appendChild(header);
        rowInfo.appendChild(actionSql);
        row.appendChild(rowInfo);

        if (typeof onSelectAction === 'function') {
          const selectButton = createButton(
            isSelected ? 'Detach' : 'Attach',
            async () => {
              const result = await onSelectAction(id);
              if (result === false) {
                return;
              }

              const currentlySelected = Array.isArray(selectedActionIds) && selectedActionIds.includes(id);
              if (currentlySelected) {
                selectedActionIds = selectedActionIds.filter((actionId) => actionId !== id);
              } else {
                selectedActionIds = [...selectedActionIds, id];
              }

              renderActionSelectionState();
            },
            isSelected ? 'secondary' : 'primary'
          );
          selectButton.style.padding = '6px 10px';
          applyAttachButtonStyle(selectButton, isSelected);
          actionRowRefs.set(id, { row, button: selectButton });
          row.appendChild(selectButton);
        }

        list.appendChild(row);
      });

      actionsContent.appendChild(list);
    }

    modal.appendChild(actionsContent);

    const buttons = createButtonRow();
    if (typeof onResetBindings === 'function') {
      const resetButton = createButton('Reset bindings', async () => {
        const result = await onResetBindings();
        if (result === false) {
          return;
        }

        selectedQueryId = null;
        selectedActionIds = [];
        renderQuerySelectionState();
        renderActionSelectionState();
      });
      resetButton.style.background = DARK_RED_STYLE;
      resetButton.style.color = '#fff';
      resetButton.style.border = `1.5px solid ${DARK_RED_STYLE}`;
      buttons.appendChild(resetButton);
    }
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

export function showTwoFileUploadDialog() {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let closed = false;
    let pnmlFile = null;
    let dbFile = null;

    const closeDialog = () => {
      if (closed) return;
      closed = true;
      removeActiveDialog();
      resolve(null);
    };

    // Title
    const title = createTitle('Select PNML and DB Files');
    modal.appendChild(title);

    // Message
    const message = createMessage('Select both a .pnml file and a .db/.sqlite file to import.');
    modal.appendChild(message);

    // Container for file uploads
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    container.style.margin = '16px 0';

    // PNML File Upload
    const pnmlField = document.createElement('div');
    pnmlField.style.display = 'flex';
    pnmlField.style.flexDirection = 'column';
    pnmlField.style.gap = '8px';

    const pnmlLabel = document.createElement('label');
    pnmlLabel.style.fontWeight = 'bold';
    pnmlLabel.style.fontSize = '14px';
    pnmlLabel.textContent = 'PNML File (.pnml)';
    pnmlField.appendChild(pnmlLabel);

    const pnmlInputWrapper = document.createElement('div');
    pnmlInputWrapper.style.display = 'flex';
    pnmlInputWrapper.style.gap = '8px';
    pnmlInputWrapper.style.alignItems = 'center';

    const pnmlButton = createButton('Choose PNML File', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.pnml';
      input.onchange = (event) => {
        const file = event.target.files?.[0];
        if (file && file.name.toLowerCase().endsWith('.pnml')) {
          pnmlFile = file;
          pnmlFileName.textContent = file.name;
          pnmlFileName.style.color = '#2e7d32';
          updateSaveButton();
        }
      };
      input.click();
    });
    pnmlInputWrapper.appendChild(pnmlButton);

    const pnmlFileName = document.createElement('span');
    pnmlFileName.style.fontSize = '13px';
    pnmlFileName.style.color = '#999';
    pnmlFileName.textContent = 'No file selected';
    pnmlInputWrapper.appendChild(pnmlFileName);

    pnmlField.appendChild(pnmlInputWrapper);
    container.appendChild(pnmlField);

    // DB File Upload
    const dbField = document.createElement('div');
    dbField.style.display = 'flex';
    dbField.style.flexDirection = 'column';
    dbField.style.gap = '8px';

    const dbLabel = document.createElement('label');
    dbLabel.style.fontWeight = 'bold';
    dbLabel.style.fontSize = '14px';
    dbLabel.textContent = 'Database File (.db)';
    dbField.appendChild(dbLabel);

    const dbInputWrapper = document.createElement('div');
    dbInputWrapper.style.display = 'flex';
    dbInputWrapper.style.gap = '8px';
    dbInputWrapper.style.alignItems = 'center';

    const dbButton = createButton('Choose DB File', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.db';
      input.onchange = (event) => {
        const file = event.target.files?.[0];
        if (file && file.name.toLowerCase().endsWith('.db')) {
          dbFile = file;
          dbFileName.textContent = file.name;
          dbFileName.style.color = '#2e7d32';
          updateSaveButton();
        }
      };
      input.click();
    });
    dbInputWrapper.appendChild(dbButton);

    const dbFileName = document.createElement('span');
    dbFileName.style.fontSize = '13px';
    dbFileName.style.color = '#999';
    dbFileName.textContent = 'No file selected';
    dbInputWrapper.appendChild(dbFileName);

    dbField.appendChild(dbInputWrapper);
    container.appendChild(dbField);

    modal.appendChild(container);

    // Buttons
    const buttonRow = createButtonRow();

    buttonRow.appendChild(createButton('Cancel', () => closeDialog()));

    const saveButton = createButton('Import', () => {
      if (!pnmlFile || !dbFile) {
        return;
      }
      closed = true;
      removeActiveDialog();
      resolve({ pnmlFile, dbFile });
    }, 'primary');

    const updateSaveButton = () => {
      saveButton.disabled = !pnmlFile || !dbFile;
      saveButton.style.opacity = saveButton.disabled ? '0.5' : '1';
    };

    updateSaveButton();
    buttonRow.appendChild(saveButton);

    modal.appendChild(buttonRow);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeDialog();
    });

    keyHandlerUtil.registerHotkey({
      target: document,
      key: 'Escape',
      when: () => activeDialog === overlay,
      callback: () => closeDialog()
    });
  });
}
