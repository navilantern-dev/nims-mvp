// ====== CONFIG ======
const SHEET_ID      = '1hJ1--EVZXHCjhgF_UkaA0wkG-PXljWQR1WXLd76kExM';     // string between /d/ and /edit
const SHEET_NAME    = 'login_credential';        // tab name
const LOGO_FILE_ID  = '1HhSFus3XntlBY2HQq-5KkM7oVoFvei8a';// banner image stored in Drive

// Levels: 0 superuser, 1 admin, 2 user
const LEVEL = { SUPER: 0, ADMIN: 1, USER: 2 };
const CACHE_TTL = 60 * 60; // seconds (1 hour) for session tokens

// ====== ENTRY ======
function doGet() {
  try {
    const t = HtmlService.createTemplateFromFile('login');
    t.logoSrc = getLogoDataUrl_();           // embed logo privately
    return t.evaluate().setTitle('NIMS Login');
  } catch (err) {
    return HtmlService.createHtmlOutput('<h3>doGet error</h3><pre>' + (err.message || err) + '</pre>');
  }
}

// Used by client to redraw login without reload (e.g., after logout)
function renderLogin() {
  try {
    const t = HtmlService.createTemplateFromFile('login');
    t.logoSrc = getLogoDataUrl_();
    return t.evaluate().setTitle('NIMS Login').getContent();
  } catch (e) {
    return '<h3>Login render error</h3><pre>' + (e.message || e) + '</pre>';
  }
}

// ====== AUTH / SESSION ======
function authenticate(payload) {
  try {
    const { username, password } = payload || {};
    if (!username || !password) return { ok:false, message:'Username and password are required.' };

    const row = findUserRow_(String(username));
    if (!row || String(row.password) !== String(password)) {
      return { ok:false, message:'Invalid username or password.' };
    }

    const user = {
      user_id: row.user_id,
      username: row.username,
      user_level: Number(row.user_level),
      user_group: Number(row.user_group || 0)
    };

    const token = Utilities.getUuid();
    CacheService.getScriptCache().put(token, JSON.stringify(user), CACHE_TTL);
    return { ok:true, token, user };
  } catch (e) {
    return { ok:false, message:'Auth error: ' + e.message };
  }
}

function getSessionUser(token) {
  if (!token) return null;
  const s = CacheService.getScriptCache().get(token);
  return s ? JSON.parse(s) : null;
}

function logout(token) {
  try {
    if (token) CacheService.getScriptCache().remove(token);
    return { ok:true };
  } catch (e) {
    return { ok:false, message:'Logout error: ' + e.message };
  }
}

// ====== DASHBOARD RENDER (uses your existing dashboard.html) ======
function renderDashboard(token) {
  const user = getSessionUser(token);
  if (!user) return '<h3>Session expired. Please <a href="">log in</a> again.</h3>';

  const t = HtmlService.createTemplateFromFile('dashboard');
  t.user = user;
  t.levelText = ['Superuser','Admin','User'][user.user_level] || 'User';
  t.groupText = ['Client','Staff'][user.user_group] || 'Client';
  t.token = token;
  return t.evaluate().setTitle('NIMS Dashboard').getContent();
}

// ====== PROTECTED API EXAMPLES (optional) ======
function adminAction(token) {
  const user = getSessionUser(token);
  requireLevel_(user, [LEVEL.SUPER, LEVEL.ADMIN]);
  return { ok:true, message:'Admin/Super action at ' + new Date().toISOString() };
}
function superAction(token) {
  const user = getSessionUser(token);
  requireLevel_(user, [LEVEL.SUPER]);
  return { ok:true, message:'Super-only action at ' + new Date().toISOString() };
}
function requireLevel_(user, allowed) {
  if (!user) throw new Error('Not authenticated.');
  if (!allowed.includes(Number(user.user_level))) throw new Error('Forbidden: insufficient level.');
}

// ====== SHEET HELPERS ======
function getLoginSheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);                 // correct API
  const sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) throw new Error('Missing tab: ' + SHEET_NAME);
  return sh;
}
function findUserRow_(username) {
  const sh = getLoginSheet_();
  const data = sh.getDataRange().getValues();
  if (!data.length) return null;
  const header = data[0].map(h => String(h).trim().toLowerCase());
  const idx = Object.fromEntries(header.map((h,i)=>[h,i]));
  const get = (row, key) => row[idx[key]];

  for (let r=1; r<data.length; r++) {
    const row = data[r];
    const uname = String(get(row,'username')||'').trim();
    if (uname.toLowerCase() === username.toLowerCase()) {
      return {
        user_id:    get(row,'user_id'),
        username:   uname,
        password:   get(row,'password'),
        user_level: get(row,'user_level'),
        user_group: get(row,'user_group')
      };
    }
  }
  return null;
}

// ====== PRIVATE LOGO EMBED (Drive -> data URL) ======
function getLogoDataUrl_() {
  // Cache the data URL to avoid reading Drive on every request
  const cache = CacheService.getScriptCache();
  const key = 'logoDataUrl_' + LOGO_FILE_ID;
  const cached = cache.get(key);
  if (cached) return cached;

  const blob = DriveApp.getFileById(LOGO_FILE_ID).getBlob();    // requires Drive scope
  const dataUrl = 'data:' + blob.getContentType() + ';base64,' +
                  Utilities.base64Encode(blob.getBytes());
  // Cache for 6 hours (max per put is 6h)
  cache.put(key, dataUrl, 6 * 60 * 60);
  return dataUrl;
}
