# AMS Login (Google Apps Script + Spreadsheet Auth)

Starter kit for a **Google Apps Script Web App** that authenticates users against a Google Sheet named **`login_credential`** (converted from `login_credential.xlsx`).

## Folder layout
```
gas-login-starter/
  src/
    appsscript.json      # GAS manifest
    Code.gs              # server code
    login.html           # login page
    dashboard.html       # post-login page
```

## Prereqs (macOS)
- Node.js LTS installed (`node -v` should print a version)
- Google Apps Script CLI: `npm i -g @google/clasp`
- A Google Sheet named **login_credential** with headers:
  `user_id, username, password, user_level, user_group`

## Link this folder to a new Apps Script project
```bash
# from the repo root
clasp login
clasp create --type webapp --title "AMS Login" --rootDir ./src
# This generates .clasp.json in the repo root
```

## Push code to Apps Script
```bash
clasp push
clasp open   # opens the project in browser
```

## Deploy the Web App
In the Apps Script editor:
- Deploy → **New deployment** → type **Web app**
- Execute as: **Me**
- Who has access: **Anyone** (or your domain)
- Copy the URL and test login.

## Publish to GitHub
```bash
git init
git add .
git commit -m "feat: initial GAS login (sheet auth)"
# create repo on GitHub first (or use gh CLI)
git branch -M main
git remote add origin https://github.com/<your-user>/gas-login-starter.git
git push -u origin main
```

## Security notes
- This starter compares **plaintext** passwords. For production, store **bcrypt hashes** in your sheet and verify server-side.
- Add CSRF protection, reCAPTCHA/rate limiting if publicly accessible.
- Limit scopes to the minimum needed; current manifest uses Drive (to find the sheet) and Spreadsheets read-only.
