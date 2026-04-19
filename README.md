# MyCiti Owners Database

**MyCiti Owners Association · Bidadi Layout · Ramanagara**

---

## What's in this repo

```
myciti-app/
├── migration/          Python script to migrate Excel data → Google Sheets CSVs
├── appsscript/         Google Apps Script backend (5 .gs files)
├── react-app/          React frontend (Vite)
└── .github/workflows/  GitHub Actions deploy to GitHub Pages
```

---

## Setup order

### 1. Google Sheets workbook

Create a new Google Sheets workbook and add **10 tabs** named exactly:

```
Sites  People  Owners  Agents  Payments  PaymentHeads  Transfers  CallLog  Roles  AuditLog
```

Note the Spreadsheet ID from the URL: `docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

### 2. Run the migration script

```bash
cd migration
pip install pandas openpyxl
python migrate.py --dryrun        # Review report first
python migrate.py                 # Writes 10 CSVs to ./output/
```

Import each CSV into its corresponding Sheets tab (File → Import → Upload → Replace current sheet).

Complete the 4 action items in the reconciliation report before going live.

### 3. Google Apps Script

1. In your Sheets workbook, go to **Extensions → Apps Script**
2. Delete the default `Code.gs` content
3. Create files for each `.gs` file in `appsscript/`:
   - `Code.gs`, `Auth.gs`, `SheetUtils.gs`, `Audit.gs`, `Handlers.gs`
4. Paste each file's content into the corresponding Apps Script file

**Set Script Properties** (Project Settings → Script Properties):
```
SPREADSHEET_ID    →  your Sheets workbook ID
DRIVE_ROOT_ID     →  ID of a Google Drive folder called "MyCiti"
ADMIN_EMAIL       →  your Google email (App Admin account)
```

5. Deploy: **Deploy → New deployment → Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the deployment URL (looks like `https://script.google.com/macros/s/.../exec`)

### 4. Google OAuth Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project (or use existing)
3. Enable: **Google Identity Services API**
4. Create OAuth 2.0 credentials → **Web application**
5. Add authorised JavaScript origins:
   - `https://database.mycitibidadi.com`
   - `http://localhost:5173` (for dev)
6. Copy the Client ID

### 5. GitHub repo

1. Create a public GitHub repo
2. Push this entire `myciti-app/` folder as the repo root
3. Go to repo **Settings → Pages → Source: GitHub Actions**
4. Go to **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_APPS_SCRIPT_URL` → your Apps Script deployment URL
   - `VITE_GOOGLE_CLIENT_ID` → your OAuth client ID
5. Go to **Settings → Pages → Custom domain** → enter `database.mycitibidadi.com`
6. Add a CNAME DNS record at your domain registrar:
   - Type: CNAME
   - Name: www
   - Value: `YOUR_GITHUB_USERNAME.github.io`

### 6. First deploy

Push to `main` branch — GitHub Actions will build and deploy automatically.
Check Actions tab for build status. Site will be live at `database.mycitibidadi.com`.

### 7. Add first user

1. Sign in with the ADMIN_EMAIL account
2. Go to Admin → Users → Add user
3. Add all committee members

---

## Local development

```bash
cd react-app
cp .env.example .env         # Fill in your values
npm install
npm run dev                  # http://localhost:5173
```

---

## Role summary

| Role     | Owners | Payments | Call Log | Who                              |
|----------|--------|----------|----------|----------------------------------|
| Edit     | Edit   | Edit     | Edit     | Secretary, Jt. Secretary, Treasurer |
| Payments | View   | Edit     | Edit     | Office assistant, collections    |
| Caller   | View   | View     | Edit     | Committee members                |
| View     | View   | View     | View     | Auditors, read-only              |

**Admin** is a separate superuser — manages users and payment heads only.

---

## Key files

- `appsscript/Code.gs` — router, all actions dispatched here
- `appsscript/Auth.gs` — token verification + role enforcement
- `appsscript/Handlers.gs` — all domain operations
- `appsscript/Audit.gs` — immutable audit log writer
- `react-app/src/utils/api.js` — all frontend API calls
- `react-app/src/utils/constants.js` — roles, helpers, formatting
