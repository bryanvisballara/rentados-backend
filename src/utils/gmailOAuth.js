const { google } = require('googleapis');

const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

function isGmailOAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      (process.env.GOOGLE_REDIRECT_URI || process.env.APP_API_URL)
  );
}

function getRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const base = process.env.APP_API_URL || `http://localhost:${process.env.PORT || 3000}`;
  return `${base.replace(/\/$/, '')}/api/v1/auth/gmail/callback`;
}

function getWebAppUrl() {
  return (process.env.APP_WEB_URL || process.env.CORS_ORIGIN || 'http://localhost:5578').replace(
    /\/$/,
    ''
  );
}

function createOAuthClient() {
  if (!isGmailOAuthConfigured()) {
    throw new Error(
      'Gmail no está configurado. Define GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET y GOOGLE_REDIRECT_URI.'
    );
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
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
