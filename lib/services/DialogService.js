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
