// SheetUtils.gs — Shared helpers for reading/writing Sheets

function getSheet(tabName) {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(tabName);
}

// Normalise a raw cell value from getValues():
// booleans → 'TRUE'/'FALSE' strings (Sheets auto-converts setValue('TRUE') to boolean true)
// empty    → null
// Date     → ISO string (so JSON serialisation is predictable)
function normCell(v) {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString();
  return v;
}

function sheetToObjects(tabName) {
  const sheet = getSheet(tabName);
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = normCell(row[i]); });
      return obj;
    })
    .filter(obj => obj['IsDeleted'] !== 'TRUE');
}

function findRow(tabName, pkCol, pkVal) {
  const sheet = getSheet(tabName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const pkIdx = headers.indexOf(pkCol);
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][pkIdx]).trim() === String(pkVal).trim()) {
      return { rowIndex: i + 1, headers, row: data[i] };
    }
  }
  return null;
}

function appendRow(tabName, obj, caller) {
  const sheet = getSheet(tabName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const now = new Date().toISOString();
  obj['CreatedBy'] = caller.email;
  obj['CreatedAt'] = now;
  obj['ModifiedBy'] = '';
  obj['ModifiedAt'] = '';
  obj['IsDeleted'] = 'FALSE';
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  sheet.appendRow(row);
}

function updateRowField(tabName, pkCol, pkVal, fieldName, newValue, caller) {
  const found = findRow(tabName, pkCol, pkVal);
  if (!found) throw new Error(`Record ${pkVal} not found in ${tabName}`);
  const { rowIndex, headers, row } = found;
  const sheet = getSheet(tabName);
  const colIdx = headers.indexOf(fieldName);
  if (colIdx < 0) throw new Error(`Field ${fieldName} not found in ${tabName}`);
  const oldValue = row[colIdx];
  sheet.getRange(rowIndex, colIdx + 1).setValue(newValue);
  // Update ModifiedBy / ModifiedAt
  const modByIdx = headers.indexOf('ModifiedBy');
  const modAtIdx = headers.indexOf('ModifiedAt');
  if (modByIdx >= 0) sheet.getRange(rowIndex, modByIdx + 1).setValue(caller.email);
  if (modAtIdx >= 0) sheet.getRange(rowIndex, modAtIdx + 1).setValue(new Date().toISOString());
  return { oldValue, newValue };
}

function updateRowFields(tabName, pkCol, pkVal, fieldsObj, caller) {
  const found = findRow(tabName, pkCol, pkVal);
  if (!found) throw new Error(`Record ${pkVal} not found in ${tabName}`);
  const { rowIndex, headers, row } = found;
  const sheet = getSheet(tabName);
  const changes = [];
  Object.entries(fieldsObj).forEach(([field, newVal]) => {
    const colIdx = headers.indexOf(field);
    if (colIdx < 0) return;
    const oldVal = row[colIdx];
    // Normalise both sides: sheet may store boolean true where we wrote 'TRUE'
    if (String(normCell(oldVal) ?? '') === String(newVal ?? '')) return;
    sheet.getRange(rowIndex, colIdx + 1).setValue(newVal);
    changes.push({ field, oldVal: normCell(oldVal), newVal });
  });
  const modByIdx = headers.indexOf('ModifiedBy');
  const modAtIdx = headers.indexOf('ModifiedAt');
  if (modByIdx >= 0) sheet.getRange(rowIndex, modByIdx + 1).setValue(caller.email);
  if (modAtIdx >= 0) sheet.getRange(rowIndex, modAtIdx + 1).setValue(new Date().toISOString());
  return changes;
}

function softDelete(tabName, pkCol, pkVal, caller) {
  updateRowField(tabName, pkCol, pkVal, 'IsDeleted', 'TRUE', caller);
  writeAudit(caller, 'SoftDelete', tabName, pkVal, 'IsDeleted', 'FALSE', 'TRUE');
  return { deleted: true };
}

function nextId(prefix, tabName, pkCol) {
  const sheet = getSheet(tabName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const pkIdx = headers.indexOf(pkCol);
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const val = String(data[i][pkIdx]).trim();
    const m = val.match(/\d+/);
    if (m) max = Math.max(max, parseInt(m[0]));
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

function nextMembershipNo() {
  const sheet = getSheet(CONFIG.TABS.OWNERS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const midIdx = headers.indexOf('MembershipNo');
  let max = 0;
  for (let i = 1; i < data.length; i++) {
    const val = String(data[i][midIdx]).trim();
    const m = val.match(/MC(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return `MC${String(max + 1).padStart(3, '0')}`;
}
