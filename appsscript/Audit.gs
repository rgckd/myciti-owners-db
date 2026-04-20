// Audit.gs — Append-only audit log writer

function auditVal(v) {
  if (v === undefined || v === null || v === '') return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function writeAudit(caller, action, tab, recordId, fieldName, oldValue, newValue) {
  try {
    const sheet = getSheet(CONFIG.TABS.AUDIT_LOG);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['AuditID','Timestamp','UserEmail','UserName','Action','Tab','RecordID','FieldName','OldValue','NewValue']);
    }
    sheet.appendRow([
      'AU' + new Date().getTime(),
      new Date().toISOString(),
      caller.email,
      caller.displayName || caller.email,
      action,
      tab,
      recordId,
      fieldName || '',
      auditVal(oldValue),
      auditVal(newValue),
    ]);
  } catch(e) {
    console.error('writeAudit failed:', e.message);
    try {
      const sheet = getSheet(CONFIG.TABS.AUDIT_LOG);
      sheet.appendRow(['AU_ERR_' + new Date().getTime(), new Date().toISOString(),
        caller.email, caller.displayName || '', 'AuditWriteError', tab, recordId, 'error', '', e.message]);
    } catch(_) {}
  }
}

function writeAuditCreate(caller, tab, recordId, recordObj) {
  writeAudit(caller, 'Create', tab, recordId, null, null, JSON.stringify(recordObj));
}

function writeAuditChanges(caller, tab, recordId, changes) {
  if (changes.length === 0) return;
  if (changes.length === 1) {
    writeAudit(caller, 'Update', tab, recordId, changes[0].field, changes[0].oldVal, changes[0].newVal);
  } else {
    const fields   = changes.map(c => c.field).join(', ');
    const oldVals  = JSON.stringify(Object.fromEntries(changes.map(c => [c.field, auditVal(c.oldVal)])));
    const newVals  = JSON.stringify(Object.fromEntries(changes.map(c => [c.field, auditVal(c.newVal)])));
    writeAudit(caller, 'Update', tab, recordId, fields, oldVals, newVals);
  }
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

  if (params.tab)          rows = rows.filter(r => r.Tab === params.tab);
  if (params.filterAction) rows = rows.filter(r => r.Action === params.filterAction);
  if (params.userEmail)    rows = rows.filter(r => r.UserEmail === params.userEmail);
  if (params.recordId)     rows = rows.filter(r => r.RecordID === params.recordId);
  if (params.dateFrom)     rows = rows.filter(r => r.Timestamp >= params.dateFrom);
  if (params.dateTo)       rows = rows.filter(r => r.Timestamp <= params.dateTo);

  rows.sort((a, b) => b.Timestamp > a.Timestamp ? 1 : -1);
  rows = rows.slice(0, params.limit || 500);

  // Enrich with human-readable record names
  const sites      = sheetToObjects(CONFIG.TABS.SITES);
  const people     = sheetToObjects(CONFIG.TABS.PEOPLE);
  const owners     = sheetToObjects(CONFIG.TABS.OWNERS);
  const payments   = sheetToObjects(CONFIG.TABS.PAYMENTS);
  const heads      = sheetToObjects(CONFIG.TABS.PAYMENT_HEADS);
  const agents     = sheetToObjects(CONFIG.TABS.AGENTS);

  const siteMap    = Object.fromEntries(sites.map(s   => [s.SiteID,    s]));
  const peopleMap  = Object.fromEntries(people.map(p  => [p.PersonID,  p]));
  const ownerMap   = Object.fromEntries(owners.map(o  => [o.OwnerID,   o]));
  const payMap     = Object.fromEntries(payments.map(p => [p.PaymentID, p]));
  const headMap    = Object.fromEntries(heads.map(h   => [h.HeadID,    h]));
  const agentMap   = Object.fromEntries(agents.map(a  => [a.AgentID,   a]));

  rows = rows.map(r => {
    let name = String(r.RecordID);
    const id = r.RecordID;
    switch (r.Tab) {
      case 'Sites': {
        const s = siteMap[id];
        if (s) name = 'Site ' + s.SiteNo + ' · Ph' + s.Phase;
        break;
      }
      case 'People': {
        const p = peopleMap[id];
        if (p) name = p.FullName;
        break;
      }
      case 'Owners': {
        const o = ownerMap[id];
        if (o) {
          const s = siteMap[o.SiteID];
          const p = peopleMap[o.PersonID];
          name = [s ? 'Site ' + s.SiteNo : '', p ? p.FullName : ''].filter(Boolean).join(' · ');
        }
        break;
      }
      case 'Payments': {
        const pay = payMap[id];
        if (pay) {
          const s = siteMap[pay.SiteID];
          name = s ? 'Site ' + s.SiteNo : id;
        }
        break;
      }
      case 'PaymentHeads': {
        const h = headMap[id];
        if (h) name = h.HeadName;
        break;
      }
      case 'Agents': {
        const a = agentMap[id];
        if (a) name = a.Name;
        break;
      }
    }
    return { ...r, RecordName: name };
  });

  return rows;
}
