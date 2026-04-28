import PetriNetIO from '../lib/index'; // or from 'petrinet-io' after install
import { showAlert, showRulesDialog, showMultiPrompt, showBugReportDialog } from '../lib/services/DialogService.js';
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
document.getElementById('js-report-bug').addEventListener('click', async () => {
  const bugReport = await showBugReportDialog();

  if (!bugReport) {
    return;
  }

  try {
    const response = await fetch('/api/report-bug', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: bugReport.title,
        description: bugReport.description,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.error || 'Could not submit bug report');
    }

    await showAlert({
      title: 'Bug report submitted',
      message: `Issue #${result.number} created.\n${result.url}`
    });
  } catch (error) {
    await showAlert({
      title: 'Submission failed',
      message: error?.message || String(error)
    });
  }
});

document.getElementById('js-open-pnml').addEventListener('click', () => {
  petrinetio.loadFromFile({
    importNetMetadata: false,
    importQueryBindings: false,
    resetExternalState: true
  });
});

document.getElementById('js-download-pnml').addEventListener('click', () => {
  petrinetio.exportPNML('petri-net.pnml', {
    includeNetMetadata: false,
    includeQueryBindings: false
  });
});

async function promptOpenPnmlAndDb() {
  const choice = await showMultiPrompt({
    title: 'Open PNML + DB',
    message: 'Choose whether to restore from one combined .dbpnml file or from two separate files.',
    fields: [
      {
        key: 'mode',
        label: 'Open mode',
        options: [
          { value: 'combined', label: 'Single combined .dbpnml file' },
          { value: 'separate', label: 'Two separate files (.pnml + .db)' }
        ],
        initialValue: 'combined'
      }
    ]
  });

  if (!choice) {
    return;
  }

  if (choice.mode === 'combined') {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dbpnml,application/json';
    input.onchange = async (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        await petrinetio.importCombinedDBPNML(file);
      } catch (error) {
        await showAlert({
          title: 'Open Failed',
          message: error?.message || String(error)
        });
      }
    };
    input.click();
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pnml,.db,.sqlite';
  input.multiple = true;
  input.onchange = async (event) => {
    const files = Array.from(event.target.files || []);
    const pnmlFile = files.find((file) => file.name.toLowerCase().endsWith('.pnml'));
    const dbFile = files.find((file) => /\.(db|sqlite)$/i.test(file.name));

    if (!pnmlFile || !dbFile) {
      await showAlert({
        title: 'Missing Files',
        message: 'Please select both one .pnml file and one .db/.sqlite file.'
      });
      return;
    }

    try {
      await petrinetio.importPNMLAndDB({ pnmlFile, dbFile });
    } catch (error) {
      await showAlert({
        title: 'Open Failed',
        message: error?.message || String(error)
      });
    }
  };
  input.click();
}

async function promptDownloadPnmlAndDb() {
  const choice = await showMultiPrompt({
    title: 'Download PNML + DB',
    message: 'Choose whether to save one combined .dbpnml file or two separate files.',
    fields: [
      {
        key: 'mode',
        label: 'Download mode',
        options: [
          { value: 'combined', label: 'Single combined .dbpnml file' },
          { value: 'separate', label: 'Two separate files (.pnml + .db)' }
        ],
        initialValue: 'combined'
      }
    ]
  });

  if (!choice) {
    return;
  }

  try {
    if (choice.mode === 'combined') {
      petrinetio.exportCombinedDBPNML('petri-net.dbpnml');
      return;
    }

    petrinetio.exportPNMLAndDB('petri-net-with-db.pnml');
  } catch (error) {
    await showAlert({
      title: 'Export Failed',
      message: error?.message || String(error)
    });
  }
}

document.getElementById('js-open-dbpnml').addEventListener('click', promptOpenPnmlAndDb);
document.getElementById('js-download-dbpnml').addEventListener('click', promptDownloadPnmlAndDb);

document.getElementById('js-download-tpn').addEventListener('click', () => {
  petrinetio.exportTpn();
});

document.getElementById('js-download-svg').addEventListener('click', () => {
  petrinetio.exportSVG();
});

document.getElementById('js-download-pdf').addEventListener('click', () => {
  petrinetio.exportPDF();
});
