// MyCiti Owners Database — Google Apps Script Web App
// Deploy as: Execute as Me | Access: Anyone
// All credentials stored in Script Properties (not here)

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const CONFIG = {
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  DRIVE_ROOT_ID:  PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_ID'),
  TOKENINFO_URL:  'https://oauth2.googleapis.com/tokeninfo?id_token=',
  ROLES: { EDIT: 'Edit', PAYMENTS: 'Payments', CALLER: 'Caller', VIEW: 'View' },
  TABS: {
    SITES: 'Sites', PEOPLE: 'People', OWNERS: 'Owners', AGENTS: 'Agents',
    PAYMENTS: 'Payments', PAYMENT_HEADS: 'PaymentHeads', TRANSFERS: 'Transfers',
    CALL_LOG: 'CallLog', ROLES: 'Roles', AUDIT_LOG: 'AuditLog'
  },
  // Domains: which tabs each domain governs
  DOMAIN_TABS: {
    owners:   ['Sites', 'People', 'Owners', 'Agents', 'Transfers'],
    payments: ['Payments', 'PaymentHeads'],
    calllog:  ['CallLog']
  },
  // Role permissions: what each role can do per domain
  PERMISSIONS: {
    Edit:     { owners: 'edit', payments: 'edit', calllog: 'edit' },
    Payments: { owners: 'view', payments: 'edit', calllog: 'edit' },
    Caller:   { owners: 'view', payments: 'view', calllog: 'edit' },
    View:     { owners: 'view', payments: 'view', calllog: 'view' },
  }
};

// Keep public actions empty by default. Add here only when explicitly needed.
const PUBLIC_ACTIONS = new Set([]);

// Central action policy map so new routes do not accidentally skip auth checks.
const ACTION_POLICY = {
  // Sites
  getSites: { type: 'domain', domain: 'owners', level: 'view' },
  getArchivedSites: { type: 'admin' },
  getSite: { type: 'domain', domain: 'owners', level: 'view' },
  createSite: { type: 'admin' },
  updateSite: { type: 'domain', domain: 'owners', level: 'edit' },
  archiveSite: { type: 'admin' },
  unarchiveSite: { type: 'admin' },
  flagSite: { type: 'flag' },

  // People
  getPeople: { type: 'domain', domain: 'owners', level: 'view' },
  getPerson: { type: 'domain', domain: 'owners', level: 'view' },
  createPerson: { type: 'domain', domain: 'owners', level: 'edit' },
  updatePerson: { type: 'domain', domain: 'owners', level: 'edit' },

  // Owners
  getOwners: { type: 'domain', domain: 'owners', level: 'view' },
  createOwner: { type: 'domain', domain: 'owners', level: 'edit' },
  updateOwner: { type: 'domain', domain: 'owners', level: 'edit' },
  removeOwnerFromSite: { type: 'domain', domain: 'owners', level: 'edit' },
  addOwnersToSite: { type: 'domain', domain: 'owners', level: 'edit' },
  transferOwnership: { type: 'domain', domain: 'owners', level: 'edit' },

  // Agents
  getAgents: { type: 'domain', domain: 'owners', level: 'view' },
  createAgent: { type: 'domain', domain: 'owners', level: 'edit' },
  updateAgent: { type: 'domain', domain: 'owners', level: 'edit' },
  softDeleteAgent: { type: 'domain', domain: 'owners', level: 'edit' },

  // Payments
  getPayments: { type: 'domain', domain: 'payments', level: 'view' },
  createPayment: { type: 'domain', domain: 'payments', level: 'edit' },
  updatePayment: { type: 'domain', domain: 'payments', level: 'edit' },
  deletePayment: { type: 'domain', domain: 'payments', level: 'edit' },
  generatePaymentReceipt: { type: 'domain', domain: 'payments', level: 'edit' },
  getPaymentHeads: { type: 'domain', domain: 'payments', level: 'view' },
  createPaymentHead: { type: 'admin' },
  updatePaymentHead: { type: 'admin' },

  // Call log
  getCallLog: { type: 'domain', domain: 'calllog', level: 'view' },
  createCallLog: { type: 'domain', domain: 'calllog', level: 'edit' },
  updateCallLog: { type: 'domain', domain: 'calllog', level: 'edit' },
  markFollowUpDone: { type: 'domain', domain: 'calllog', level: 'edit' },
  reopenFollowUp: { type: 'domain', domain: 'calllog', level: 'edit' },
  getFollowUps: { type: 'domain', domain: 'calllog', level: 'view' },
  getAssignableUsers: { type: 'domain', domain: 'calllog', level: 'view' },

  // Audit
  getAuditLog: { type: 'role', requiredRole: CONFIG.ROLES.EDIT },

  // Admin
  getUsers: { type: 'admin' },
  addUser: { type: 'admin' },
  updateUser: { type: 'admin' },
  removeUser: { type: 'admin' },
  checkSheetAccess: { type: 'admin' },

  // Profile
  whoami: { type: 'authenticated' },

  // Dashboard
  getStats: { type: 'domain', domain: 'owners', level: 'view' },
  getDefaulters: { type: 'domain', domain: 'payments', level: 'view' },

  // Verify
  verifyMember: { type: 'domain', domain: 'owners', level: 'view' },

  // Uploads
  getUploadFolder: { type: 'uploadFolder' },
  uploadAttachment: { type: 'uploadAttachment' },
};

function enforceActionPolicy(action, role, params) {
  const policy = ACTION_POLICY[action];
  if (!policy) throw new Error(`Unknown or unprotected action: ${action}`);

  switch (policy.type) {
    case 'authenticated':
      return;
    case 'admin':
      return requireAdmin(role);
    case 'flag':
      return requireFlag(role);
    case 'role':
      return requireRole(role, policy.requiredRole);
    case 'domain':
      return requireDomain(role, policy.domain, policy.level);
    case 'uploadFolder': {
      const folderType = String(params.type || '').trim();
      if (folderType === 'Payments') return requireDomain(role, 'payments', 'edit');
      return requireDomain(role, 'owners', 'edit');
    }
    case 'uploadAttachment': {
      const folderType = String(params.folderType || '').trim();
      if (folderType === 'Payments') return requireDomain(role, 'payments', 'edit');
      return requireDomain(role, 'owners', 'edit');
    }
    default:
      throw new Error(`Unhandled policy type: ${policy.type}`);
  }
}

// ─── MAIN HANDLERS ───────────────────────────────────────────────────────────

function doGet(e) {
  try {
    // All requests come as GET with payload as a query param
    const raw = e.parameter && e.parameter.payload
    if (!raw) return jsonResponse({ error: 'No payload provided' }, 400)
    const params = JSON.parse(decodeURIComponent(raw))
    return handleRequest(e, 'GET', params)
  } catch(err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

function doPost(e) {
  // Keep doPost for completeness but redirect everything through doGet pattern
  try {
    let params = {}

    // Preferred path for browser form-encoded uploads: payload=<encoded JSON>
    if (e.parameter && e.parameter.payload) {
      params = JSON.parse(decodeURIComponent(e.parameter.payload))
    } else if (e.postData && e.postData.contents) {
      // Backward compatibility: raw JSON in body
      const raw = String(e.postData.contents || '')
      try {
        params = JSON.parse(raw)
      } catch (_) {
        // Fallback: body might be payload=<encoded JSON>
        const m = raw.match(/(?:^|&)payload=([^&]+)/)
        if (m && m[1]) {
          params = JSON.parse(decodeURIComponent(m[1].replace(/\+/g, '%20')))
        } else {
          throw new Error('Invalid POST payload')
        }
      }
    }
    return handleRequest(e, 'POST', params)
  } catch(err) {
    return jsonResponse({ error: err.message }, 500)
  }
}

function handleRequest(e, method, params) {
  try {
    const action = params.action;

    // Public routes — explicitly allowlisted only.
    if (PUBLIC_ACTIONS.has(action)) {
      if (action === 'verifyMember') {
        return jsonResponse(verifyMember(params.membershipId));
      }
      return jsonResponse({ error: `Unknown public action: ${action}` }, 400);
    }

    // Auth required for all non-public routes
    const idToken = (e.parameter && e.parameter.token) || params.token || '';
    const caller = authenticateCaller(idToken);
    if (!caller.ok) return jsonResponse({ error: caller.error }, 401);

    const role = caller.role;
    enforceActionPolicy(action, role, params);

    switch (action) {
      // ── SITES ──
      case 'getSites':          requireDomain(role,'owners','view');  return jsonResponse(getSites(params));
      case 'getArchivedSites':  requireAdmin(role);                    return jsonResponse(getArchivedSites(params));
      case 'getSite':           requireDomain(role,'owners','view');  return jsonResponse(getSite(params.siteId));
      case 'createSite':        requireAdmin(role);                    return jsonResponse(createSite(params, caller));
      case 'updateSite':        requireDomain(role,'owners','edit');  return jsonResponse(updateSite(params, caller));
      case 'archiveSite':       requireAdmin(role);                    return jsonResponse(archiveSite(params, caller));
      case 'unarchiveSite':     requireAdmin(role);                    return jsonResponse(unarchiveSite(params, caller));
      case 'flagSite':          requireFlag(role);                    return jsonResponse(flagSite(params, caller));

      // ── PEOPLE ──
      case 'getPeople':         requireDomain(role,'owners','view');  return jsonResponse(getPeople(params));
      case 'getPerson':         requireDomain(role,'owners','view');  return jsonResponse(getPerson(params.personId));
      case 'createPerson':      requireDomain(role,'owners','edit');  return jsonResponse(createPerson(params, caller));
      case 'updatePerson':      requireDomain(role,'owners','edit');  return jsonResponse(updatePerson(params, caller));

      // ── OWNERS ──
      case 'getOwners':         requireDomain(role,'owners','view');  return jsonResponse(getOwners(params));
      case 'createOwner':       requireDomain(role,'owners','edit');  return jsonResponse(createOwner(params, caller));
      case 'updateOwner':       requireDomain(role,'owners','edit');  return jsonResponse(updateOwner(params, caller));
      case 'removeOwnerFromSite': requireDomain(role,'owners','edit'); return jsonResponse(removeOwnerFromSite(params, caller));
      case 'addOwnersToSite':   requireDomain(role,'owners','edit');  return jsonResponse(addOwnersToSite(params, caller));
      case 'transferOwnership': requireDomain(role,'owners','edit');  return jsonResponse(transferOwnership(params, caller));

      // ── AGENTS ──
      case 'getAgents':         requireDomain(role,'owners','view');  return jsonResponse(getAgents());
      case 'createAgent':       requireDomain(role,'owners','edit');  return jsonResponse(createAgent(params, caller));
      case 'updateAgent':       requireDomain(role,'owners','edit');  return jsonResponse(updateAgent(params, caller));
      case 'softDeleteAgent':   requireDomain(role,'owners','edit');  return jsonResponse(softDelete('Agents','AgentID',params.agentId,caller));

      // ── PAYMENTS ──
      case 'getPayments':       requireDomain(role,'payments','view'); return jsonResponse(getPayments(params));
      case 'createPayment':     requireDomain(role,'payments','edit'); return jsonResponse(createPayment(params, caller));
      case 'updatePayment':     requireDomain(role,'payments','edit'); return jsonResponse(updatePayment(params, caller, role));
      case 'deletePayment':     requireDomain(role,'payments','edit'); return jsonResponse(softDelete(CONFIG.TABS.PAYMENTS,'PaymentID',params.paymentId,caller));
      case 'generatePaymentReceipt': requireDomain(role,'payments','edit'); return jsonResponse(generatePaymentReceipt(params, caller));
      case 'getPaymentHeads':   requireDomain(role,'payments','view'); return jsonResponse(getPaymentHeads());
      case 'createPaymentHead': requireAdmin(role);                    return jsonResponse(createPaymentHead(params, caller));
      case 'updatePaymentHead': requireAdmin(role);                    return jsonResponse(updatePaymentHead(params, caller));

      // ── CALL LOG ──
      case 'getCallLog':        requireDomain(role,'calllog','view');  return jsonResponse(getCallLog(params));
      case 'createCallLog':     requireDomain(role,'calllog','edit');  return jsonResponse(createCallLog(params, caller));
      case 'updateCallLog':     requireDomain(role,'calllog','edit');  return jsonResponse(updateCallLog(params, caller, role));
      case 'markFollowUpDone':  requireDomain(role,'calllog','edit');  return jsonResponse(markFollowUpDone(params, caller));
      case 'reopenFollowUp':    requireDomain(role,'calllog','edit');  return jsonResponse(reopenFollowUp(params, caller));
      case 'getFollowUps':      requireDomain(role,'calllog','view');  return jsonResponse(getFollowUps(params));
      case 'getAssignableUsers':requireDomain(role,'calllog','view');  return jsonResponse(getAssignableUsers());

      // ── AUDIT ──
      case 'getAuditLog':       requireRole(role, CONFIG.ROLES.EDIT);  return jsonResponse(getAuditLog(params));

      // ── ADMIN ──
      case 'getUsers':          requireAdmin(role); return jsonResponse(getUsers());
      case 'addUser':           requireAdmin(role); return jsonResponse(addUser(params, caller));
      case 'updateUser':        requireAdmin(role); return jsonResponse(updateUser(params, caller));
      case 'removeUser':        requireAdmin(role); return jsonResponse(removeUser(params, caller));
      case 'checkSheetAccess':  requireAdmin(role); return jsonResponse(checkSheetAccess(params.email));

    // ── WHOAMI ──
      case 'whoami': {
        return jsonResponse({ role: caller.role, email: caller.email, displayName: caller.displayName });
      }

      // ── DASHBOARD ──
      case 'getStats':          return jsonResponse(getStats());
      case 'getDefaulters':     requireDomain(role,'payments','view'); return jsonResponse(getDefaulters(params));

      // ── VERIFY ──
      case 'verifyMember':      return jsonResponse(verifyMember(params.membershipId));

      // ── FILE UPLOAD URL ──
      case 'getUploadFolder':   return jsonResponse(getUploadFolder(params));
      case 'uploadAttachment': {
        if (params.folderType === 'Payments') {
          requireDomain(role,'payments','edit');
        } else {
          requireDomain(role,'owners','edit');
        }
        return jsonResponse(uploadAttachment(params));
      }

      default: return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch(e) {
    console.error('handleRequest error:', e.message, e.stack);
    return jsonResponse({ error: e.message }, 500);
  }
}

function jsonResponse(data, code) {
  const out = ContentService.createTextOutput(JSON.stringify(data));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}
