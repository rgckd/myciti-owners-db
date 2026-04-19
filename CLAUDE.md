# MyCiti Owners Database — Project Context

## What this is
A web app for MyCiti Owners Association (730+ plot layout, Bidadi, Ramanagara) to manage owner records, membership, payments, and call logs. Built for committee members (5–12 people) across desktop and mobile.

## Architecture
- **Frontend**: React (Vite) → hosted on GitHub Pages at `adminapp.mycitibidadi.com`
- **Backend**: Google Apps Script Web App — handles all Sheets API, Drive API, auth, and role checks. No credentials in this repo.
- **Data**: Google Sheets workbook (10 tabs). Sheets stays directly accessible to committee.
- **Auth**: Google Sign-In (OAuth 2.0). Token sent with every request; Apps Script verifies via Google tokeninfo API.
- **Files**: Google Drive — photos, ID proofs, payment proof images. Only URLs stored in Sheets.

## Key architectural decisions
- All API calls use GET with `?payload=encodeURIComponent(JSON.stringify({action, token, ...params}))` — POST body gets dropped on Apps Script redirect, GET avoids this.
- Apps Script is the true security boundary — client-side role hiding is UX only.
- No credentials anywhere in this repo. `VITE_APPS_SCRIPT_URL` and `VITE_GOOGLE_CLIENT_ID` are GitHub Actions secrets, injected at build time.

## Roles (fixed, not configurable)
| Role | Owners | Payments | Call Log |
|---|---|---|---|
| Edit | Edit | Edit | Edit |
| Payments | View | Edit | Edit |
| Caller | View | View | Edit |
| View | View | View | View |
| Admin | superuser — manages users + payment heads only |

Flagging a site or owner requires Call Log Edit or higher (Edit, Payments, Caller).

## Data model — 10 Sheets tabs
- **People** — canonical person record (PersonID). One row per real person.
- **Sites** — one row per plot. SiteNo is alphanumeric (e.g. 36-A). SiteType enum: 30x40, 30x50, 40x60, 50x80, non-standard. Sizesqft for per-sqft payment heads.
- **Owners** — junction: PersonID + SiteID + MembershipNo. IsCurrent=TRUE = active owner. Multiple rows can be TRUE (co-owners). OwnershipStartDate/EndDate for history.
- **Agents** — optional representatives linked from Owners via AgentID.
- **Payments** — one row per payment event. HeadID FK to PaymentHeads. Partial payments supported.
- **PaymentHeads** — dues schedule. AmountType: Flat (ExpectedAmountFlat per site) or PerSqft (ExpectedAmountPerSqft × site Sizesqft). Changing AmountType blocked after payments recorded.
- **Transfers** — immutable ownership transfer history.
- **CallLog** — conversation notes. NOT audited (intentional).
- **Roles** — UserEmail, DisplayName, Role, AddedBy, AddedAt. App Admin checks Sheet-level access before assigning.
- **AuditLog** — append-only, immutable. Covers all tabs except CallLog.

## File structure
```
appsscript/          5 .gs files — paste into Google Apps Script editor
  Code.gs            router + doGet/doPost handlers
  Auth.gs            token verification, role enforcement
  SheetUtils.gs      Sheets read/write helpers
  Audit.gs           immutable audit log writer
  Handlers.gs        all domain operations (36 functions)

react-app/
  src/
    App.jsx                    router, protected routes
    main.jsx                   entry point
    index.css                  global styles + CSS variables
    context/AuthContext.jsx    Google Sign-In, role fetch via whoami
    utils/api.js               all API calls (GET + payload pattern)
    utils/constants.js         roles, helpers, formatCurrency, formatDate
    components/
      Layout.jsx + .module.css sidebar nav, mobile bottom nav
      SiteCard.jsx             card with status edge + flag indicators
      SitePanel.jsx            5-tab profile: Overview, Dues, Payments, Call log, Attachments
      PaymentModal.jsx         payment recording form
      TransferModal.jsx        3-step ownership transfer
      IDCard.jsx               Canvas-rendered membership card + download + WhatsApp
    pages/
      Login.jsx                Google Sign-In button
      SiteRegistry.jsx         home screen — filterable card grid
      People.jsx               owner list + detail panel + ID card trigger
      Agents.jsx               agent list + add/edit
      Defaulters.jsx           defaulters report with CSV export
      FollowUps.jsx            open follow-ups view
      AuditView.jsx            audit log table (Edit role only)
      Admin.jsx                user management + payment heads (Admin only)
      Verify.jsx               public unauthenticated membership verify page

migration/
  migrate.py         one-time migration from Excel → 10 CSVs (already run)
  output/            10 CSVs already imported into Google Sheets

.github/workflows/deploy.yml   GitHub Actions → GitHub Pages
public/CNAME                   adminapp.mycitibidadi.com
public/404.html                GitHub Pages SPA redirect
```

## Current deploy state (as of handoff)
- GitHub Pages deployed at `adminapp.mycitibidadi.com` ✓
- Google OAuth configured for `adminapp.mycitibidadi.com` ✓
- Apps Script Web App deployed ✓
- Google Sheets workbook populated with migrated data ✓
- **Last known issue being debugged**: `Failed to fetch` on login — root cause was Apps Script POST redirect dropping body. Fix applied: switched all API calls to GET with `?payload=` query param. Code.gs `doGet` updated to parse `e.parameter.payload`. Apps Script needs to be redeployed (new version) for this to take effect.

## CSS variables (design tokens)
```css
--tc: #D85A30          /* terracotta — primary brand */
--tc-light: #FAECE7    /* terracotta tint — badges, flags */
--paid: #3B6D11        /* green — paid status */
--partial: #854F0B     /* amber — partial/unpaid */
--disputed: #A32D2D    /* red — disputed */
--nocontact: #5F5E5A   /* grey — no contact info */
--surface-2: #F8F7F4   /* off-white — page background */
```

## Apps Script deployment note
Every time Code.gs or any .gs file is changed, you must create a new version in Apps Script (Deploy → Manage deployments → edit → New version). The Web App URL stays the same.

## Environment variables (never commit these)
```
VITE_APPS_SCRIPT_URL    = Apps Script Web App URL (GitHub secret)
VITE_GOOGLE_CLIENT_ID   = OAuth Client ID (GitHub secret)
```
Local dev: copy `.env.example` to `.env` and fill in values.
