import { showAlert } from './DialogService.js';

const PAGE_SIZE = 100;

function escapeIdentifier(name) {
  return `"${String(name || '').replace(/"/g, '""')}"`;
}

function createCell(text, tag = 'td') {
  const cell = document.createElement(tag);
  cell.style.border = '1px solid #d0d0d0';
  cell.style.padding = '6px 8px';
  cell.style.fontSize = '12px';
  cell.style.verticalAlign = 'top';
  cell.style.whiteSpace = 'nowrap';
  cell.style.maxWidth = '280px';
  cell.style.overflow = 'hidden';
  cell.style.textOverflow = 'ellipsis';
  cell.textContent = String(text ?? '');
  return cell;
}

function queryOrThrow(databaseService, sql) {
  const result = databaseService.queryWithStatus(sql);
  if (!result?.ok) {
    throw new Error(result?.error || 'Query failed');
  }
  return Array.isArray(result.rows) ? result.rows : [];
}

export async function showDatabaseExplorerDialog(databaseService) {
  if (!databaseService?.getDbName?.()) {
    await showAlert({
      title: 'No Database Loaded',
      message: 'Upload a .db/.sqlite file first, then open Preview DB.'
    });
    return;
  }

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(0, 0, 0, 0.35)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const modal = document.createElement('div');
  modal.style.width = 'min(1080px, 94vw)';
  modal.style.height = 'min(78vh, 760px)';
  modal.style.background = '#fff';
  modal.style.borderRadius = '10px';
  modal.style.boxShadow = '0 12px 40px rgba(0,0,0,0.2)';
  modal.style.padding = '14px';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.gap = '10px';
  modal.style.color = '#222';
  modal.style.fontFamily = 'Arial, sans-serif';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.alignItems = 'center';
  header.style.justifyContent = 'space-between';

  const title = document.createElement('h3');
  title.style.margin = '0';
  title.style.fontSize = '18px';
  title.textContent = `Database Explorer (${databaseService.getDbName()})`;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = 'Close';
  closeButton.style.padding = '6px 10px';
  closeButton.style.borderRadius = '8px';
  closeButton.style.border = '1px solid #1976d2';
  closeButton.style.background = '#1976d2';
  closeButton.style.color = '#fff';
  closeButton.style.fontSize = '14px';
  closeButton.style.cursor = 'pointer';

  const content = document.createElement('div');
  content.style.flex = '1';
  content.style.minHeight = '0';
  content.style.display = 'grid';
  content.style.gridTemplateColumns = '240px 1fr';
  content.style.gap = '12px';

  const leftPane = document.createElement('div');
  leftPane.style.border = '1px solid #ddd';
  leftPane.style.borderRadius = '8px';
  leftPane.style.padding = '8px';
  leftPane.style.overflow = 'auto';

  const leftTitle = document.createElement('div');
  leftTitle.textContent = 'Tables';
  leftTitle.style.fontWeight = '700';
  leftTitle.style.marginBottom = '8px';

  const tableList = document.createElement('div');
  tableList.style.display = 'flex';
  tableList.style.flexDirection = 'column';
  tableList.style.gap = '4px';

  const rightPane = document.createElement('div');
  rightPane.style.display = 'grid';
  rightPane.style.gridTemplateRows = 'auto auto 1fr auto';
  rightPane.style.gap = '8px';
  rightPane.style.minWidth = '0';
  rightPane.style.minHeight = '0';

  const selectedTableLabel = document.createElement('div');
  selectedTableLabel.style.fontWeight = '700';
  selectedTableLabel.textContent = 'Selected table: none';

  const schemaWrap = document.createElement('div');
  schemaWrap.style.border = '1px solid #ddd';
  schemaWrap.style.borderRadius = '8px';
  schemaWrap.style.padding = '8px';

  const schemaTitle = document.createElement('div');
  schemaTitle.style.fontWeight = '700';
  schemaTitle.style.marginBottom = '6px';
  schemaTitle.textContent = 'Columns';

  const schemaContent = document.createElement('div');
  schemaContent.style.overflow = 'auto';
  schemaContent.style.maxHeight = '180px';

  const rowsWrap = document.createElement('div');
  rowsWrap.style.border = '1px solid #ddd';
  rowsWrap.style.borderRadius = '8px';
  rowsWrap.style.padding = '8px';
  rowsWrap.style.overflow = 'auto';
  rowsWrap.style.minHeight = '0';

  const paginationRow = document.createElement('div');
  paginationRow.style.display = 'flex';
  paginationRow.style.alignItems = 'center';
  paginationRow.style.justifyContent = 'space-between';

  const pageInfo = document.createElement('div');
  pageInfo.style.fontSize = '12px';
  pageInfo.textContent = 'No table selected';

  const pagerButtons = document.createElement('div');
  pagerButtons.style.display = 'flex';
  pagerButtons.style.gap = '8px';

  const prevButton = document.createElement('button');
  prevButton.type = 'button';
  prevButton.textContent = 'Prev';
  prevButton.style.padding = '6px 10px';

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = 'Next';
  nextButton.style.padding = '6px 10px';

  let selectedTable = null;
  let currentPage = 0;
  let currentRowCount = null;

  const closeDialog = () => {
    overlay.remove();
  };

  const renderSchema = (columns) => {
    schemaContent.innerHTML = '';

    if (!columns.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No columns found.';
      schemaContent.appendChild(empty);
      return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const headerRow = document.createElement('tr');
    ['name', 'type', 'notnull', 'dflt_value', 'pk'].forEach((key) => {
      const th = createCell(key, 'th');
      th.style.background = '#f3f3f3';
      headerRow.appendChild(th);
    });

    const thead = document.createElement('thead');
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    columns.forEach((column) => {
      const tr = document.createElement('tr');
      tr.appendChild(createCell(column.name));
      tr.appendChild(createCell(column.type));
      tr.appendChild(createCell(column.notnull));
      tr.appendChild(createCell(column.dflt_value));
      tr.appendChild(createCell(column.pk));
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    schemaContent.appendChild(table);
  };

  const renderRows = (rows) => {
    rowsWrap.innerHTML = '';

    if (!rows.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No rows found.';
      rowsWrap.appendChild(empty);
      return;
    }

    const columns = Object.keys(rows[0] || {});
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';

    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    columns.forEach((column) => {
      const th = createCell(column, 'th');
      th.style.background = '#f3f3f3';
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach((row) => {
      const tr = document.createElement('tr');
      columns.forEach((column) => {
        tr.appendChild(createCell(row[column]));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    rowsWrap.appendChild(table);
  };

  const updatePagerState = (rowsLength) => {
    const pageIndex = currentPage + 1;
    const countText = Number.isFinite(currentRowCount) ? `${currentRowCount} total` : 'unknown total';
    pageInfo.textContent = selectedTable
      ? `Page ${pageIndex} · ${rowsLength} row(s) shown · ${countText}`
      : 'No table selected';

    prevButton.disabled = currentPage === 0;

    if (Number.isFinite(currentRowCount)) {
      nextButton.disabled = ((currentPage + 1) * PAGE_SIZE) >= currentRowCount;
      return;
    }

    nextButton.disabled = rowsLength < PAGE_SIZE;
  };

  const loadRows = () => {
    if (!selectedTable) {
      return;
    }

    const sql = `SELECT * FROM ${escapeIdentifier(selectedTable)} LIMIT ${PAGE_SIZE} OFFSET ${currentPage * PAGE_SIZE}`;
    const rows = queryOrThrow(databaseService, sql);
    renderRows(rows);
    updatePagerState(rows.length);
  };

  const selectTable = (tableName) => {
    selectedTable = tableName;
    currentPage = 0;
    selectedTableLabel.textContent = `Selected table: ${tableName}`;

    const columns = queryOrThrow(databaseService, `PRAGMA table_info(${escapeIdentifier(tableName)})`);
    renderSchema(columns);

    const countRows = queryOrThrow(databaseService, `SELECT COUNT(*) AS count FROM ${escapeIdentifier(tableName)}`);
    const rawCount = countRows?.[0]?.count;
    const parsedCount = Number(rawCount);
    currentRowCount = Number.isFinite(parsedCount) ? parsedCount : null;

    loadRows();

    Array.from(tableList.querySelectorAll('button')).forEach((button) => {
      const isActive = button.dataset.tableName === tableName;
      button.style.fontWeight = isActive ? '700' : '400';
      button.style.background = isActive ? '#ececec' : '#fff';
    });
  };

  const loadTables = () => {
    const tables = queryOrThrow(
      databaseService,
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    ).map((row) => String(row.name || '').trim()).filter(Boolean);

    tableList.innerHTML = '';

    if (!tables.length) {
      const empty = document.createElement('div');
      empty.textContent = 'No user tables found.';
      tableList.appendChild(empty);
      return;
    }

    tables.forEach((tableName) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.tableName = tableName;
      button.textContent = tableName;
      button.style.textAlign = 'left';
      button.style.padding = '6px 8px';
      button.style.border = '1px solid #d0d0d0';
      button.style.background = '#fff';
      button.style.cursor = 'pointer';
      button.style.borderRadius = '6px';
      button.addEventListener('click', () => {
        selectTable(tableName);
      });
      tableList.appendChild(button);
    });

    selectTable(tables[0]);
  };

  prevButton.addEventListener('click', () => {
    if (!selectedTable || currentPage === 0) {
      return;
    }
    currentPage -= 1;
    loadRows();
  });

  nextButton.addEventListener('click', () => {
    if (!selectedTable) {
      return;
    }
    currentPage += 1;
    loadRows();
  });

  closeButton.addEventListener('click', closeDialog);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeDialog();
    }
  });

  pagerButtons.appendChild(prevButton);
  pagerButtons.appendChild(nextButton);
  paginationRow.appendChild(pageInfo);
  paginationRow.appendChild(pagerButtons);

  schemaWrap.appendChild(schemaTitle);
  schemaWrap.appendChild(schemaContent);

  leftPane.appendChild(leftTitle);
  leftPane.appendChild(tableList);

  rightPane.appendChild(selectedTableLabel);
  rightPane.appendChild(schemaWrap);
  rightPane.appendChild(rowsWrap);
  rightPane.appendChild(paginationRow);

  content.appendChild(leftPane);
  content.appendChild(rightPane);

  header.appendChild(title);
  header.appendChild(closeButton);

  modal.appendChild(header);
  modal.appendChild(content);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  try {
    loadTables();
  } catch (error) {
    closeDialog();
    await showAlert({
      title: 'Preview DB Failed',
      message: error?.message || String(error)
    });
  }
}
