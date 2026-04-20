import PetriNetIO from '../lib/index'; // or from 'petrinet-io' after install
import { showRulesDialog } from '../lib/services/DialogService.js';
import { showDocumentationDialog } from '../lib/providers/DocumentationProvider.js';

const petrinetio = new PetriNetIO({
  container: '#container'
});

function loadDocumentation() {
  showDocumentationDialog().catch((error) => {
    console.error('Failed to show documentation dialog:', error);
  });
}

document.getElementById('rules').addEventListener('click', showRulesDialog);

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
