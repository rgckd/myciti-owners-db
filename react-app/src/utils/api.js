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

// ── Agents ─────────────────────────────────────────────────────────────────
export const getAgents      = () => call('getAgents')
export const createAgent    = (p) => call('createAgent', p)
export const updateAgent    = (p) => call('updateAgent', p)
export const softDeleteAgent= (agentId) => call('softDeleteAgent', { agentId })

// ── Payments ───────────────────────────────────────────────────────────────
export const getPayments       = (p={}) => call('getPayments', p)
export const createPayment     = (p) => call('createPayment', p)
export const updatePayment     = (p) => call('updatePayment', p)
export const getPaymentHeads   = () => call('getPaymentHeads')
export const createPaymentHead = (p) => call('createPaymentHead', p)
export const updatePaymentHead = (p) => call('updatePaymentHead', p)

// ── Call Log ───────────────────────────────────────────────────────────────
export const getCallLog     = (p={}) => call('getCallLog', p)
export const createCallLog  = (p) => call('createCallLog', p)
export const updateCallLog  = (p) => call('updateCallLog', p)
export const markFollowUpDone = (logId) => call('markFollowUpDone', { logId })
export const getFollowUps   = (p={}) => call('getFollowUps', p)

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

function getDriveAccessToken() {
  return new Promise((resolve, reject) => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google OAuth2 library not loaded'))
      return
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => {
        if (resp.error) reject(new Error(resp.error_description || resp.error))
        else resolve(resp.access_token)
      },
    })
    client.requestAccessToken()
  })
}

export async function uploadFileToDrive(file, paymentId) {
  const [{ folderId }, accessToken] = await Promise.all([
    getUploadFolder('Payments', paymentId),
    getDriveAccessToken(),
  ])

  const metadata = { name: file.name, parents: [folderId] }
  const form = new FormData()
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
  form.append('file', file)

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form }
  )
  if (!uploadRes.ok) throw new Error(`Drive upload failed: ${uploadRes.status}`)
  const { id } = await uploadRes.json()

  await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  })

  return `https://drive.google.com/file/d/${id}/view`
}
