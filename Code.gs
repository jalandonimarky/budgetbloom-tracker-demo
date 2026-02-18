/**
 * BudgetBloom — Google Sheets Backend
 * Deploy as Web App: Execute as Me, Anyone can access
 */

// ── TRANSACTION COLUMNS ──
const TXN_COLS = ['id', 'date', 'card', 'vendor', 'amount', 'category', 'notes', 'needsReview', 'declined', 'month'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── HELPERS ──

function formatDate(val) {
  if (val instanceof Date) {
    return val.getFullYear() + '-' + String(val.getMonth() + 1).padStart(2, '0') + '-' + String(val.getDate()).padStart(2, '0');
  }
  var s = String(val);
  // If already YYYY-MM-DD, return as-is
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Try parsing as date string
  var d = new Date(s);
  if (!isNaN(d.getTime())) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  return s;
}

function dateToMonth(dateStr) {
  var d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return MONTH_NAMES[d.getMonth()] + ' ' + d.getFullYear();
}

// ── WEB APP ENDPOINTS ──

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'loadAll';
    if (action === 'ping') return respond({ status: 'ok', timestamp: new Date().toISOString() });
    if (action === 'loadAll') return respond(loadAllData());
    return respond({ error: 'Unknown action' });
  } catch (err) {
    return respond({ error: err.message });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    switch (payload.action) {
      case 'addTransaction':    return respond(addTransactionRow(payload.data));
      case 'updateTransaction': return respond(updateTransactionRow(payload.data));
      case 'deleteTransaction': return respond(deleteTransactionRow(payload.id));
      case 'syncAll':           return respond(syncAllData(payload));
      case 'saveCategories':    return respond(saveCategoriesData(payload.categories, payload.groupColors, payload.creditCards));
      default:                  return respond({ error: 'Unknown action: ' + payload.action });
    }
  } catch (err) {
    return respond({ error: err.message });
  }
}

// ── LOAD ALL DATA ──

function loadAllData() {
  const txnSheet = getSheet('Transactions');
  const settingsSheet = getSheet('Settings');

  const transactions = [];
  if (txnSheet && txnSheet.getLastRow() > 1) {
    const data = txnSheet.getRange(2, 1, txnSheet.getLastRow() - 1, TXN_COLS.length).getValues();
    data.forEach(row => {
      if (!row[0]) return;
      const txn = {};
      TXN_COLS.forEach((col, i) => {
        if (col === 'id') {
          txn[col] = String(row[i]);
        } else if (col === 'date') {
          txn[col] = formatDate(row[i]);
        } else if (col === 'amount') {
          txn[col] = Number(row[i]) || 0;
        } else if (col === 'needsReview' || col === 'declined') {
          txn[col] = (row[i] === true || row[i] === 'TRUE' || row[i] === 'true');
        } else {
          txn[col] = String(row[i]);
        }
      });
      // Always recalculate month from date to ensure consistency
      txn.month = dateToMonth(txn.date);
      transactions.push(txn);
    });
  }

  let categories = null, groupColors = null, creditCards = null;
  if (settingsSheet) {
    try { categories = JSON.parse(settingsSheet.getRange('B1').getValue()); } catch (e) {}
    try { groupColors = JSON.parse(settingsSheet.getRange('B2').getValue()); } catch (e) {}
    try { creditCards = JSON.parse(settingsSheet.getRange('B3').getValue()); } catch (e) {}
  }

  return { success: true, transactions, categories, groupColors, creditCards, count: transactions.length };
}

// ── INDIVIDUAL TRANSACTION OPERATIONS ──

function addTransactionRow(data) {
  const sheet = getSheet('Transactions');
  const row = TXN_COLS.map(col => {
    if (col === 'needsReview' || col === 'declined') return data[col] ? 'TRUE' : 'FALSE';
    return data[col] !== undefined ? String(data[col]) : '';
  });
  sheet.appendRow(row);
  return { success: true, id: data.id };
}

function updateTransactionRow(data) {
  const sheet = getSheet('Transactions');
  if (sheet.getLastRow() < 2) return { success: false, error: 'No transactions' };

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(data.id)) {
      const row = TXN_COLS.map(col => {
        if (col === 'needsReview' || col === 'declined') return data[col] ? 'TRUE' : 'FALSE';
        return data[col] !== undefined ? String(data[col]) : '';
      });
      sheet.getRange(i + 2, 1, 1, TXN_COLS.length).setValues([row]);
      return { success: true, id: data.id };
    }
  }
  return { success: false, error: 'Transaction not found' };
}

function deleteTransactionRow(id) {
  const sheet = getSheet('Transactions');
  if (sheet.getLastRow() < 2) return { success: false, error: 'No transactions' };

  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) {
      sheet.deleteRow(i + 2);
      return { success: true };
    }
  }
  return { success: false, error: 'Transaction not found' };
}

// ── FULL SYNC ──

function syncAllData(payload) {
  const sheet = getSheet('Transactions');

  // Clear existing data (keep headers)
  if (sheet.getLastRow() > 1) {
    sheet.deleteRows(2, sheet.getLastRow() - 1);
  }

  // Write all transactions as plain strings to prevent Sheets auto-formatting
  const txns = payload.transactions || [];
  if (txns.length > 0) {
    const rows = txns.map(t => TXN_COLS.map(col => {
      if (col === 'needsReview' || col === 'declined') return t[col] ? 'TRUE' : 'FALSE';
      return t[col] !== undefined ? String(t[col]) : '';
    }));
    const range = sheet.getRange(2, 1, rows.length, TXN_COLS.length);
    range.setNumberFormat('@'); // Force plain text to prevent date auto-conversion
    range.setValues(rows);
  }

  // Save categories, colors, and credit cards
  if (payload.categories || payload.groupColors || payload.creditCards) {
    saveCategoriesData(payload.categories, payload.groupColors, payload.creditCards);
  }

  return { success: true, count: txns.length };
}

// ── CATEGORIES ──

function saveCategoriesData(categories, groupColors, creditCards) {
  const sheet = getSheet('Settings');
  if (categories) sheet.getRange('B1').setValue(JSON.stringify(categories));
  if (groupColors) sheet.getRange('B2').setValue(JSON.stringify(groupColors));
  if (creditCards) sheet.getRange('B3').setValue(JSON.stringify(creditCards));
  return { success: true };
}

// ── INITIAL SETUP ──

function initialSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Transactions tab
  let txnSheet = ss.getSheetByName('Transactions');
  if (!txnSheet) txnSheet = ss.insertSheet('Transactions');

  const headers = ['ID', 'Date', 'Card', 'Vendor', 'Amount', 'Category', 'Notes', 'NeedsReview', 'Declined', 'Month'];
  txnSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  txnSheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#1e293b')
    .setFontColor('#f1f5f9');
  txnSheet.setFrozenRows(1);

  // Force all data columns to plain text to prevent auto-formatting
  txnSheet.getRange('A2:J').setNumberFormat('@');

  const widths = [160, 110, 150, 220, 100, 200, 200, 100, 100, 100];
  widths.forEach((w, i) => txnSheet.setColumnWidth(i + 1, w));

  // Settings tab
  let settingsSheet = ss.getSheetByName('Settings');
  if (!settingsSheet) settingsSheet = ss.insertSheet('Settings');
  settingsSheet.getRange('A1').setValue('categories');
  settingsSheet.getRange('A2').setValue('groupColors');
  settingsSheet.getRange('A3').setValue('creditCards');
  settingsSheet.getRange('A1:A3').setFontWeight('bold');
  settingsSheet.setColumnWidth(1, 120);
  settingsSheet.setColumnWidth(2, 600);

  // Clean up
  const sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && ss.getSheets().length > 1) {
    try { ss.deleteSheet(sheet1); } catch (e) {}
  }

  SpreadsheetApp.getUi().alert(
    'BudgetBloom database is ready!\n\n' +
    'Next step: Deploy as Web App\n' +
    '1. Click Deploy > New deployment\n' +
    '2. Type: Web app\n' +
    '3. Execute as: Me\n' +
    '4. Access: Anyone\n' +
    '5. Click Deploy and copy the URL'
  );
}

// ── MENU ──
function onOpen() {
  SpreadsheetApp.getUi().createMenu('BudgetBloom')
    .addItem('Initial Setup', 'initialSetup')
    .addToUi();
}
