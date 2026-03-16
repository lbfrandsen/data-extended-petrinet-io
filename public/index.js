import PetriNetIO from '../lib/index'; // or from 'petrinet-io' after install
import { showAlert } from '../lib/services/DialogService.js';

const petrinetio = new PetriNetIO({
  container: '#container'
});

let documentationCache = null;

async function loadDocumentation() {
  if (documentationCache !== null) {
    return documentationCache;
  }

  const response = await fetch('/docs/documentation.md');

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  documentationCache = await response.text();
  return documentationCache;
}

document.getElementById('js-docs').addEventListener('click', async () => {
  try {
    const documentation = await loadDocumentation();

    showAlert({
      title: 'Documentation and Credit',
      message: documentation,
      markdown: true
    });
  } catch (error) {
    showAlert({
      title: 'Documentation and Credit',
      message: `Failed to load docs/documentation.md (${error.message}).`
    });
  }
});


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
