// Auth.gs — Token verification and role enforcement

function authenticateCaller(idToken) {
  if (!idToken) return { ok: false, error: 'No auth token provided' };
  try {
    const url = CONFIG.TOKENINFO_URL + encodeURIComponent(idToken);
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, error: 'Invalid token' };
    const info = JSON.parse(res.getContentText());
    const email = info.email;
    if (!email) return { ok: false, error: 'Token has no email' };

    // Check if App Admin
    const adminEmail = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAIL');
    if (email === adminEmail) {
      return { ok: true, email, role: 'Admin', displayName: info.name || email };
    }

    // Look up role in Roles tab
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const rolesSheet = ss.getSheetByName(CONFIG.TABS.ROLES);
    const data = rolesSheet.getDataRange().getValues();
    const headers = data[0].map(h => String(h).trim());
    const emailIdx = headers.indexOf('UserEmail');
    const roleIdx  = headers.indexOf('Role');
    const nameIdx  = headers.indexOf('DisplayName');
    const delIdx   = headers.indexOf('IsDeleted');

    for (let i = 1; i < data.length; i++) {
      const rowEmail = String(data[i][emailIdx]).trim().toLowerCase();
      if (rowEmail === email.toLowerCase()) {
        if (delIdx >= 0 && data[i][delIdx] === 'TRUE') {
          return { ok: false, error: 'Account has been removed' };
        }
        const role = String(data[i][roleIdx]).trim();
        const displayName = nameIdx >= 0 ? String(data[i][nameIdx]).trim() : email;
        return { ok: true, email, role, displayName };
      }
    }
    return { ok: false, error: 'Account not found. Contact the App Admin.' };
  } catch(e) {
    console.error('authenticateCaller error:', e.message);
    return { ok: false, error: 'Auth check failed: ' + e.message };
  }
}

function requireDomain(role, domain, level) {
  if (role === 'Admin') return; // Admin bypasses all checks
  const perms = CONFIG.PERMISSIONS[role];
  if (!perms) throw new Error('Unknown role: ' + role);
  const actual = perms[domain];
  if (!actual) throw new Error('Role has no access to domain: ' + domain);
  if (level === 'edit' && actual !== 'edit') {
    throw new Error('This action requires Edit access to ' + domain);
  }
}

function requireFlag(role) {
  // Flagging allowed for Edit, Payments, Caller (anyone with calllog edit or owners edit)
  if (role === 'Admin') return;
  const perms = CONFIG.PERMISSIONS[role];
  if (!perms) throw new Error('Unknown role');
  if (perms.calllog !== 'edit' && perms.owners !== 'edit') {
    throw new Error('Flagging requires Call Log Edit or Owners Edit access');
  }
}

function requireAdmin(role) {
  if (role !== 'Admin') throw new Error('Admin access required');
}

function requireRole(role, required) {
  if (role === 'Admin') return;
  if (role !== required) throw new Error(`${required} role required`);
}

function checkSheetAccess(email) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const viewers = ss.getViewers().map(u => u.getEmail().toLowerCase());
    const editors = ss.getEditors().map(u => u.getEmail().toLowerCase());
    const all = [...viewers, ...editors];
    const hasAccess = all.includes(email.toLowerCase());
    return { hasAccess, email };
  } catch(e) {
    return { hasAccess: false, error: e.message };
  }
}
