import PetriNetIO from '../lib/index'; // or from 'petrinet-io' after install
import { showAlert } from '../lib/services/DialogService.js';
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
