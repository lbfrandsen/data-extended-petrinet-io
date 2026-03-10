import PetriNetIO from '../lib/index'; // or from 'petrinet-io' after install
import { showAlert } from '../lib/services/DialogService.js';

const petrinetio = new PetriNetIO({
  container: '#container'
});

// TODO: Make this msg show the markdown text instead of just the raw markdown, don't know how tho
document.getElementById('js-docs').addEventListener('click', async () => {
  const msg = `
  ___
  ### Bachelor Thesis (Spring 2026)
  ___
  Joschka Eckert-Boulet
  Elias Storm Vedel Jørgensen
  Lucas Bjerg Frandsen

  ___
  ### Original project
  ___
  Andrea Burattin
  
  ___
  # DOCUMENTATION
  ___

  honestly we don't know, good luck

  According to all known laws of aviation,     
  there is no way a bee should be able to fly.     
  Its wings are too small to get its fat little body off the ground.     
  The bee, of course, flies anyway     
  because bees don’t care what humans think is impossible.`

  showAlert({
    title: 'Documentation and Credit',
    message: msg
  });
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