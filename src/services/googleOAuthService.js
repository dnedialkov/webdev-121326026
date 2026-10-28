const AUTHORIZATION_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USER_INFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const REQUEST_TIMEOUT_MS = 8000;

function getAuthorizationUrl(state, { clientId = process.env.GOOGLE_CLIENT_ID, redirectUri }) {
  if (!clientId || !redirectUri || !state) {
    throw new Error('Google OAuth is not configured');
  }

  const url = new URL(AUTHORIZATION_URL);
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  return url.toString();
}

async function getGoogleProfile(
  code,
  redirectUri,
  {
    clientId = process.env.GOOGLE_CLIENT_ID,
    clientSecret = process.env.GOOGLE_CLIENT_SECRET,
    fetchImpl = globalThis.fetch
  } = {}
) {
  if (!code || !redirectUri || !clientId || !clientSecret) {
    throw new Error('Google OAuth is not configured');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('Google OAuth network client is unavailable');
  }

  const tokenResponse = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!tokenResponse.ok) {
    throw new Error('Google rejected the authorization code');
  }

  const token = await tokenResponse.json();
  if (!token.access_token) {
    throw new Error('Google did not return an access token');
  }

  const profileResponse = await fetchImpl(USER_INFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  if (!profileResponse.ok) {
    throw new Error('Google profile could not be retrieved');
  }

  const profile = await profileResponse.json();
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : '';
  if (
    typeof profile.sub !== 'string' ||
    !profile.sub ||
    !email ||
    profile.email_verified !== true
  ) {
    throw new Error('Google did not return a verified email address');
  }

  return {
    subject: profile.sub,
    email
  };
}

module.exports = {
  getAuthorizationUrl,
  getGoogleProfile
};
