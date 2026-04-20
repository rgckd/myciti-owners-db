// Audit.gs — Append-only audit log writer

function writeAudit(caller, action, tab, recordId, fieldName, oldValue, newValue) {
  try {
    const sheet = getSheet(CONFIG.TABS.AUDIT_LOG);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['AuditID','Timestamp','UserEmail','UserName','Action','Tab','RecordID','FieldName','OldValue','NewValue']);
    }
    const auditId = 'AU' + new Date().getTime();
    sheet.appendRow([
      auditId,
      new Date().toISOString(),
      caller.email,
      caller.displayName || caller.email,
      action,
      tab,
      recordId,
      fieldName || '',
      oldValue !== undefined && oldValue !== null ? String(oldValue) : '',
      newValue !== undefined && newValue !== null ? String(newValue) : '',
    ]);
  } catch(e) {
    console.error('writeAudit failed:', e.message);
    // Compensating entry
    try {
      const sheet = getSheet(CONFIG.TABS.AUDIT_LOG);
      sheet.appendRow([
        'AU_ERR_' + new Date().getTime(),
        new Date().toISOString(),
        caller.email,
        caller.displayName || '',
        'AuditWriteError',
        tab,
        recordId,
        'error',
        '',
        e.message,
      ]);
    } catch(_) {}
  }
}

function writeAuditCreate(caller, tab, recordId, recordObj) {
  writeAudit(caller, 'Create', tab, recordId, null, null, JSON.stringify(recordObj));
}

function writeAuditChanges(caller, tab, recordId, changes) {
  changes.forEach(c => {
    writeAudit(caller, 'Update', tab, recordId, c.field, c.oldVal, c.newVal);
  });
}

function getAuditLog(params) {
  const sheet = getSheet(CONFIG.TABS.AUDIT_LOG);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  let rows = data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i]; });
    return obj;
  });

  if (params.tab)        rows = rows.filter(r => r.Tab === params.tab);
  if (params.action)     rows = rows.filter(r => r.Action === params.action);
  if (params.userEmail)  rows = rows.filter(r => r.UserEmail === params.userEmail);
  if (params.recordId)   rows = rows.filter(r => r.RecordID === params.recordId);
  if (params.dateFrom)   rows = rows.filter(r => r.Timestamp >= params.dateFrom);
  if (params.dateTo)     rows = rows.filter(r => r.Timestamp <= params.dateTo);

  // Newest first
  rows.sort((a, b) => b.Timestamp > a.Timestamp ? 1 : -1);
  return rows.slice(0, params.limit || 500);
}
