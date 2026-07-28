const { google } = require('googleapis');

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function envValue(name) {
  const raw = process.env[name];
  if (raw == null) return '';
  return String(raw).trim().replace(/^['"]|['"]$/g, '');
}

/** Si pegaron varias URLs separadas por coma, toma la primera válida. */
function firstUrl(value) {
  if (!value) return '';
  const parts = String(value)
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const withScheme = parts.find((part) => /^https?:\/\//i.test(part));
  return (withScheme || parts[0] || '').replace(/\/$/, '');
}

function isGmailOAuthConfigured() {
  return Boolean(
    envValue('GOOGLE_CLIENT_ID') &&
      envValue('GOOGLE_CLIENT_SECRET') &&
      (firstUrl(envValue('GOOGLE_REDIRECT_URI')) || firstUrl(envValue('APP_API_URL')))
  );
}

function getRedirectUri() {
  const explicit = firstUrl(envValue('GOOGLE_REDIRECT_URI'));
  if (explicit) {
    // Si solo pusieron el origen, completa el path del callback.
    if (!/\/api\/v1\/auth\/gmail\/callback\/?$/i.test(explicit)) {
      return `${explicit.replace(/\/$/, '')}/api/v1/auth/gmail/callback`;
    }
    return explicit;
  }
  const base = firstUrl(envValue('APP_API_URL')) || `http://localhost:${process.env.PORT || 3000}`;
  return `${base.replace(/\/$/, '')}/api/v1/auth/gmail/callback`;
}

function getWebAppUrl() {
  return (
    firstUrl(envValue('APP_WEB_URL')) ||
    firstUrl(envValue('CORS_ORIGIN')) ||
    'http://localhost:5578'
  );
}

function createOAuthClient() {
  if (!isGmailOAuthConfigured()) {
    throw new Error(
      'Gmail no está configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI.'
    );
  }
  return new google.auth.OAuth2(
    envValue('GOOGLE_CLIENT_ID'),
    envValue('GOOGLE_CLIENT_SECRET'),
    getRedirectUri()
  );
}

function buildGmailAuthUrl(state) {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
    include_granted_scopes: true,
  });
}

async function exchangeCodeForTokens(code) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function gmailClientFromRefreshToken(refreshToken) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: 'v1', auth: client });
}

module.exports = {
  GMAIL_SCOPES,
  isGmailOAuthConfigured,
  getRedirectUri,
  getWebAppUrl,
  createOAuthClient,
  buildGmailAuthUrl,
  exchangeCodeForTokens,
  gmailClientFromRefreshToken,
};
