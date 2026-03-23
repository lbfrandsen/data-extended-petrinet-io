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
  stringGeneration: 'defined',
};

// Rules dialog with options for token value generation
export function showRulesDialog({ title = 'Rules', message = '', onClose = null }) {
  const { overlay, modal } = createWideOverlay();

  message = `Set rules for token value generation when firing transitions.\n\n`;

  // Allow rules dict to mutate, with the risk of nothing being saved and thus updated
  const pendingRules = { ...rules };
  const domainInputs = createDomainInputs(pendingRules);
  domainInputs.style.display = rules.integerGeneration === 'random_domain' ? 'flex' : 'none';

  const distributionInputs = createDomainStdAndMean(pendingRules);
  distributionInputs.style.display = rules.integerGeneration === 'random_dist' ? 'flex' : 'none';
  
  modal.appendChild(createTitle(title));
  modal.appendChild(createMessage(message));

  // Rows of togglable options
  const integerRow = createRadioGroup(
    'Integer generation:',
    [
      { value: 'defined', display: 'Defined' , checked: rules.integerGeneration === 'defined'},
      { value: 'random_domain', display: 'Random inside domain' , checked: rules.integerGeneration === 'random_domain'},
      { value: 'random_dist', display: 'Random inside distribution' , checked: rules.integerGeneration === 'random_dist'},
    ],
    'integer-generation',
    (value) => {
      pendingRules.integerGeneration = value; 
      domainInputs.style.display = value === 'random_domain' ? 'flex' : 'none'; // Only show domain inputs if random_domain is selected
      distributionInputs.style.display = value === 'random_dist' ? 'flex' : 'none'; // Only show distribution inputs if random_dist is selected
    } 
  );

  const stringRow = createRadioGroup(
    'String generation:',
    [
      { value: 'defined', display: 'Defined' , checked: rules.stringGeneration === 'defined'},
      { value: 'random', display: 'Random' , checked: rules.stringGeneration === 'random'},
    ],
    'string-generation',
    (value) => { pendingRules.stringGeneration = value; } 
  );

  modal.appendChild(integerRow);
  modal.appendChild(domainInputs);
  modal.appendChild(distributionInputs);
  integerRow.style.marginBottom = '48px';

  modal.appendChild(stringRow);

  const buttons = createButtonRow();
  buttons.appendChild(
    createButton('Save', () => {
      Object.assign(rules, pendingRules); // Update rules with pending changes on save
      if (onClose) onClose(rules);
      console.log('Current rules', rules);
      removeActiveDialog();
    }, 'primary')
  );
  buttons.appendChild(createButton('Close', () => {
      console.log('Yeeted rules', pendingRules);
      console.log('Current rules', rules);
      removeActiveDialog(); // pendingRules is yeeted on close without saving, so no changes are made to rules
    }, 'secondary')
  );
  modal.appendChild(buttons);

}

export function showAlert({ title = 'Message', message = '' }) {
  return new Promise(resolve => {
    const { overlay, modal } = createOverlay();

    modal.appendChild(createTitle(title));
    modal.appendChild(createMessage(message));

    const buttons = createButtonRow();
    buttons.appendChild(
      createButton('OK', () => {
        removeActiveDialog();
        resolve();
      }, 'primary')
    );

    modal.appendChild(buttons);

    overlay.addEventListener('click', event => {
      if (event.target === overlay) {
        removeActiveDialog();
        resolve();
      }
    });
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

    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    });

    input.focus();
    input.select();
  });
}
