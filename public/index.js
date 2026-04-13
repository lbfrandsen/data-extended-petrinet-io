import PetriNetIO from '../lib/index'; // or from 'petrinet-io' after install
import { showAlert, showRulesDialog } from '../lib/services/DialogService.js';
import { getDocumentation } from '../lib/providers/DocumentationProvider.js';

const petrinetio = new PetriNetIO({
  container: '#container'
});

function loadDocumentation() {
  let docsText;
  try {
    docsText = getDocumentation();
  } catch (error) {
    console.error('Failed to load documentation:', error);
    docsText = `Failed to load documentation: ${error.message}`;
  }
  showAlert({
    title: 'Documentation and Credit',
    message: docsText,
    markdown: true
  });
}

function uploadDbFile() {
  if (!globalThis._db || typeof globalThis._db.loadFromFile !== 'function') {
    console.error('Database service is not ready yet');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.db,.sqlite';
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) globalThis._db.loadFromFile(file);
  });
  input.click();
}

document.getElementById('rules').addEventListener('click', showRulesDialog);
document.getElementById('js-upload-db').addEventListener('click', uploadDbFile);

document.getElementById('js-docs').addEventListener('click', loadDocumentation);

document.getElementById('js-open-pnml').addEventListener('click', () => {
  petrinetio.loadFromFile();
});

document.getElementById('js-download-pnml').addEventListener('click', () => {
  petrinetio.exportPNML();
});

document.getElementById('js-download-tpn').addEventListener('click', () => {
  petrinetio.exportTpn();
});

document.getElementById('js-download-svg').addEventListener('click', () => {
  petrinetio.exportSVG();
});

document.getElementById('js-download-pdf').addEventListener('click', () => {
  petrinetio.exportPDF();
});
