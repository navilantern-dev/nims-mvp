/**
 * Google Apps Script — AMS Login (Spreadsheet Auth)
 * Reads Google Sheet: `login_credential` (converted from login_credential.xlsx)
 * Columns: user_id, username, password, user_level, user_group
 *
 * SECURITY: Plaintext password compare for starter only. Replace with hash verify in production.
 */

// CONFIG — Either set SHEET_ID or leave null to search by name.
const SHEET_ID   = null; // e.g., '1A2b3C...'; set if you know it
const SHEET_NAME = 'login_credential'; // tab name inside the spreadsheet
const CACHE_TTL  = 60 * 60; // seconds (1 hour)

function doGet(e) {
  return HtmlService
    .createTemplateFromFile('login')
    .evaluate()
    .setTitle('AMS Login')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Utilities to include partials from HTML templates
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Authenticate against the login_credential sheet. */
function authenticate(payload) {
  const { username, password } = payload || {};
  if (!username || !password) {
    return { ok: false, message: 'Username and password are required.' };
  }

  const row = findUserRow_(String(username));
  if (!row) {
    return { ok: false, message: 'Invalid username or password.' };
  }

  // Plaintext compare (starter). Replace with a secure hash verify in prod.
  if (String(row.password) !== String(password)) {
    return { ok: false, message: 'Invalid username or password.' };
  }

  const token = Utilities.getUuid();
  const user = {
    user_id:    row.user_id,
    username:   row.username,
    user_level: Number(row.user_level), // 0 superuser, 1 admin, 2 user
    user_group: Number(row.user_group)  // 0 client, 1 staff
  };

  CacheService.getScriptCache().put(token, JSON.stringify(user), CACHE_TTL);
  return { ok: true, token, user };
}

/** Validate a session token and return the user object or null. */
function getSessionUser(token) {
  if (!token) return null;
  const s = CacheService.getScriptCache().get(token);
  return s ? JSON.parse(s) : null;
}

/** Render dashboard HTML (server-side) after successful login. */
function renderDashboard(token) {
  const user = getSessionUser(token);
  if (!user) return '<h3>Session expired. Please <a href=\"\">log in</a> again.</h3>';
  const t = HtmlService.createTemplateFromFile('dashboard');
  t.user = user;
  t.levelText = ['Superuser','Admin','User'][user.user_level] || 'User';
  t.groupText = ['Client','Staff'][user.user_group] || 'Client';
  return t.evaluate().getContent();
}

// ------------------ Sheet helpers ------------------
function getLoginSheet_() {
  if (SHEET_ID) return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME) || SpreadsheetApp.openById(SHEET_ID).getSheets()[0];

  // Search Drive for a Google Sheet named login_credential (or the converted xlsx)
  const files = DriveApp.getFilesByName('login_credential');
  while (files.hasNext()) {
    const f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.open(f).getSheetByName(SHEET_NAME) || SpreadsheetApp.open(f).getSheets()[0];
    }
  }
  // Fallback: also try exact .xlsx name in case it was converted keeping the name
  const files2 = DriveApp.getFilesByName('login_credential.xlsx');
  while (files2.hasNext()) {
    const f2 = files2.next();
    if (f2.getMimeType() === MimeType.GOOGLE_SHEETS) {
      return SpreadsheetApp.open(f2).getSheetByName(SHEET_NAME) || SpreadsheetApp.open(f2).getSheets()[0];
    }
  }
  throw new Error('Could not find a Google Sheet named \"login_credential\". Convert your XLSX to Google Sheets.');
}

function findUserRow_(username) {
  const sh = getLoginSheet_();
  const data = sh.getDataRange().getValues();
  if (data.length === 0) return null;
  const header = data[0].map(String);
  const idx = Object.fromEntries(header.map((h, i) => [h.trim().toLowerCase(), i]));

  const get = (row, key) => row[idx[key]];
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    if (!row || row.length === 0) continue;
    const uname = String(get(row, 'username') || '').trim();
    if (uname.toLowerCase() === String(username).toLowerCase()) {
      return {
        user_id:    get(row, 'user_id'),
        username:   uname,
        password:   get(row, 'password'),
        user_level: get(row, 'user_level'),
        user_group: get(row, 'user_group')
      };
    }
  }
  return null;
}
