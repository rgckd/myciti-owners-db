// api.js — all communication with the Apps Script Web App

const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL || ''

let _idToken = ''
export function setToken(token) { _idToken = token }
export function getToken() { return _idToken }

async function call(action, params = {}) {
  if (!BASE_URL) throw new Error('VITE_APPS_SCRIPT_URL not configured')
  // Use GET with payload as a query param — avoids POST redirect body-loss with Apps Script
  const payload = JSON.stringify({ action, token: _idToken, ...params })
  const url = `${BASE_URL}?payload=${encodeURIComponent(payload)}`
  const res = await fetch(url, { redirect: 'follow' })
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Invalid response from server') }
  if (data.error) throw new Error(data.error)
  return data
}

async function resolvePostUrl() {
  const payload = encodeURIComponent(JSON.stringify({ action: 'verifyMember', membershipId: '' }))
  const probe = await fetch(`${BASE_URL}?payload=${payload}`, { redirect: 'follow' })
  const url = new URL(probe.url)
  url.searchParams.delete('payload')
  return url.toString()
}

async function callPost(action, params = {}) {
  if (!BASE_URL) throw new Error('VITE_APPS_SCRIPT_URL not configured')
  const payload = encodeURIComponent(JSON.stringify({ action, token: _idToken, ...params }))
  const body = new URLSearchParams({ payload }).toString()
  let res

  try {
    // Post directly to script URL using form encoding; Apps Script exposes payload in e.parameter.
    res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      redirect: 'follow',
    })
  } catch (e) {
    // Retry once against resolved googleusercontent endpoint if initial POST is blocked.
    const postUrl = await resolvePostUrl()
    res = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body,
      redirect: 'follow',
    })
  }

  if (!res.ok) {
    const raw = await res.text()
    throw new Error(`Upload request failed (${res.status}). ${raw.slice(0, 180)}`)
  }
  const text = await res.text()
  let data
  try { data = JSON.parse(text) } catch { throw new Error('Invalid response from server') }
  if (data.error) throw new Error(data.error)
  return data
}

// ── Sites ──────────────────────────────────────────────────────────────────
export const getSites       = (p={}) => call('getSites', p)
export const getSite        = (siteId) => call('getSite', { siteId })
export const createSite     = (p) => call('createSite', p)
export const updateSite     = (p) => call('updateSite', p)
export const flagSite       = (siteId, flag, comment='') => call('flagSite', { siteId, flag: String(flag), comment })

// ── People ─────────────────────────────────────────────────────────────────
export const getPeople      = (p={}) => call('getPeople', p)
export const getPerson      = (personId) => call('getPerson', { personId })
export const createPerson   = (p) => call('createPerson', p)
export const updatePerson   = (p) => call('updatePerson', p)

// ── Owners ─────────────────────────────────────────────────────────────────
export const getOwners      = (p={}) => call('getOwners', p)
export const createOwner    = (p) => call('createOwner', p)
export const updateOwner    = (p) => call('updateOwner', p)
export const flagOwner      = (ownerId, flag, comment='') => call('flagOwner', { ownerId, flag: String(flag), comment })
export const transferOwnership = (p) => call('transferOwnership', p)
export const removeOwnerFromSite = (p) => call('removeOwnerFromSite', p)

// ── Agents ─────────────────────────────────────────────────────────────────
export const getAgents      = () => call('getAgents')
export const createAgent    = (p) => call('createAgent', p)
export const updateAgent    = (p) => call('updateAgent', p)
export const softDeleteAgent= (agentId) => call('softDeleteAgent', { agentId })

// ── Payments ───────────────────────────────────────────────────────────────
export const getPayments       = (p={}) => call('getPayments', p)
export const createPayment     = (p) => call('createPayment', p)
export const updatePayment     = (p) => call('updatePayment', p)
export const deletePayment     = (paymentId) => call('deletePayment', { paymentId })
export const getPaymentHeads   = () => call('getPaymentHeads')
export const createPaymentHead = (p) => call('createPaymentHead', p)
export const updatePaymentHead = (p) => call('updatePaymentHead', p)

// ── Call Log ───────────────────────────────────────────────────────────────
export const getCallLog     = (p={}) => call('getCallLog', p)
export const createCallLog  = (p) => call('createCallLog', p)
export const updateCallLog  = (p) => call('updateCallLog', p)
export const markFollowUpDone = (logId, resolutionComment = '') =>
  call('markFollowUpDone', { logId, resolutionComment })
export const reopenFollowUp = (logId) => call('reopenFollowUp', { logId })
export const getFollowUps   = (p={}) => call('getFollowUps', p)
export const getAssignableUsers = () => call('getAssignableUsers')

// ── Dashboard ──────────────────────────────────────────────────────────────
export const getStats       = () => call('getStats')
export const getDefaulters  = (p={}) => call('getDefaulters', p)

// ── Audit ──────────────────────────────────────────────────────────────────
export const getAuditLog    = (p={}) => call('getAuditLog', p)

// ── Admin ──────────────────────────────────────────────────────────────────
export const getUsers          = () => call('getUsers')
export const addUser           = (p) => call('addUser', p)
export const updateUser        = (p) => call('updateUser', p)
export const removeUser        = (email) => call('removeUser', { email })
export const checkSheetAccess  = (email) => call('checkSheetAccess', { email })

// ── Verify (public) ────────────────────────────────────────────────────────
export const verifyMember = (membershipId) => call('verifyMember', { membershipId })

// ── Drive ──────────────────────────────────────────────────────────────────
export const getUploadFolder = (type, entityId) => call('getUploadFolder', { type, entityId })

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      if (comma < 0) return reject(new Error('Could not encode file'))
      resolve(result.slice(comma + 1))
    }
    reader.onerror = () => reject(new Error('Could not read selected file'))
    reader.readAsDataURL(file)
  })
}

export async function uploadFileToDrive(file, folderType, entityId) {
  const contentBase64 = await fileToBase64(file)
  const result = await callPost('uploadAttachment', {
    folderType,
    entityId,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    contentBase64,
  })
  return result.url
}
