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

// Save all rules in a map to be exported as a collective
export const rules = {
  integerGeneration: 'defined',
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

// Rules dialog with options for token value generation
export function showRulesDialog({ title = '', message = '', onClose = null }) {
  const { overlay, modal } = createWideOverlay();
  title = `SIMULATION RULES`
  message = `Set rules for token value generation when firing transitions.\n\n`;
  modal.appendChild(createTitle(title));
  modal.appendChild(createMessage(message));

  const pendingRules = { ...rules };

  // --- USER INPUT TOGGLE ---
  const userRow = document.createElement('div');
  userRow.style.marginBottom = '24px';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = rules.integerGeneration === 'defined';

  const label = document.createElement('label');
  label.textContent = ' User input';

  userRow.appendChild(checkbox);
  userRow.appendChild(label);
  modal.appendChild(userRow);
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

  setDisabled(checkbox.checked);

  checkbox.onchange = () => {
    pendingRules.integerGeneration = checkbox.checked
      ? 'defined'
      : (pendingRules.integerDistributionEnabled ? 'randomDist' : 'randomDomain');

    setDisabled(checkbox.checked);
  };

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
  const intDistBtn = document.createElement('button');
  intDistBtn.style.marginBottom = '8px';

  const intDistributionInputs = createDomainStdAndMean(pendingRules);

  let intDistEnabled = Boolean(pendingRules.integerDistributionEnabled);
  intDistributionInputs.style.display = intDistEnabled ? 'flex' : 'none';
  intDistBtn.textContent = intDistEnabled ? 'Disable distribution' : 'Enable distribution';

  intDistBtn.onclick = () => {
    intDistEnabled = !intDistEnabled;
    pendingRules.integerDistributionEnabled = intDistEnabled;
    intDistributionInputs.style.display = intDistEnabled ? 'flex' : 'none';
    intDistBtn.textContent = intDistEnabled ? 'Disable distribution' : 'Enable distribution';
    pendingRules.integerGeneration = intDistEnabled ? 'randomDist' : 'randomDomain';
  };

  if (intDistEnabled) {
    pendingRules.integerGeneration = 'randomDist';
  } else if (pendingRules.integerGeneration !== 'defined') {
    pendingRules.integerGeneration = 'randomDomain';
  }

  intSection.appendChild(intDistBtn);
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
  const realDistBtn = document.createElement('button');
  realDistBtn.style.marginBottom = '8px';

  const realDistributionInputs = createRealDistributionInputs(pendingRules);

  let realDistEnabled = Boolean(pendingRules.realDistributionEnabled);
  realDistributionInputs.style.display = realDistEnabled ? 'flex' : 'none';
  realDistBtn.textContent = realDistEnabled ? 'Disable distribution' : 'Enable distribution';

  realDistBtn.onclick = () => {
    realDistEnabled = !realDistEnabled;
    pendingRules.realDistributionEnabled = realDistEnabled;
    realDistributionInputs.style.display = realDistEnabled ? 'flex' : 'none';
    realDistBtn.textContent = realDistEnabled ? 'Disable distribution' : 'Enable distribution';
  };

  realSection.appendChild(realDistBtn);
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
      removeActiveDialog();
    }, 'primary')
  );

  buttons.appendChild(
    createButton('Close', () => {
      removeActiveDialog();
    })
  );

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
      if (event.target === overlay) {
        closeAlert();
      }
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

        if (result) {
          errorBox.textContent = result;
          return;
        }
      }

      removeActiveDialog();
      resolve(value);
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

    keyHandlerUtil.registerSubmitOnEnter({
      target: input,
      callback: submit
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

      const input = document.createElement('input');
      input.type = 'text';
      input.value = field.initialValue ?? '';
      input.placeholder = field.placeholder ?? '';
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
      inputs[0].input.select();
    }
  });
}

export function showSqlQueriesList({entries = [] } = {}) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();
    let unregisterEnterSubmit = null;

    const closeDialog = () => {
      unregisterEnterSubmit?.();
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

        const label = document.createElement('div');
        label.style.fontWeight = '700';
        label.style.marginBottom = '4px';
        label.textContent = String(id);

        const query = document.createElement('div');
        query.style.fontFamily = 'monospace';
        query.style.fontSize = '12px';
        query.textContent = String(text || '(empty)');

        row.appendChild(label);
        row.appendChild(query);
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

    closeButton.focus();
  });
}
