const test = require('node:test');
const assert = require('node:assert/strict');
const googleOAuthService = require('./googleOAuthService');

const credentials = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret'
};

function fakeResponse(body, ok = true) {
  return {
    ok,
    json: async () => body
  };
}

test('Google authorization URL includes callback, requested identity scopes, and CSRF state', () => {
  const authorizationUrl = new URL(googleOAuthService.getAuthorizationUrl('state-value', {
    clientId: credentials.clientId,
    redirectUri: 'https://club.example/api/auth/google/callback'
  }));

  assert.equal(authorizationUrl.origin, 'https://accounts.google.com');
  assert.equal(authorizationUrl.pathname, '/o/oauth2/v2/auth');
  assert.equal(authorizationUrl.searchParams.get('client_id'), credentials.clientId);
  assert.equal(authorizationUrl.searchParams.get('redirect_uri'), 'https://club.example/api/auth/google/callback');
  assert.equal(authorizationUrl.searchParams.get('response_type'), 'code');
  assert.equal(authorizationUrl.searchParams.get('scope'), 'openid email profile');
  assert.equal(authorizationUrl.searchParams.get('state'), 'state-value');
  assert.equal(authorizationUrl.searchParams.get('prompt'), 'select_account');
});

test('Google authorization URL rejects missing client configuration, callback, or state', () => {
  assert.throws(() => googleOAuthService.getAuthorizationUrl('state', {
    clientId: '',
    redirectUri: 'https://club.example/api/auth/google/callback'
  }), /not configured/);
  assert.throws(() => googleOAuthService.getAuthorizationUrl('state', {
    clientId: credentials.clientId,
    redirectUri: ''
  }), /not configured/);
  assert.throws(() => googleOAuthService.getAuthorizationUrl('', {
    clientId: credentials.clientId,
    redirectUri: 'https://club.example/api/auth/google/callback'
  }), /not configured/);
});

test('Google profile exchange uses a timeout and accepts only verified email', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://oauth2.googleapis.com/token') {
      return fakeResponse({ access_token: 'access-token' });
    }
    return fakeResponse({
      sub: 'google-subject',
      email: ' Person@Example.com ',
      email_verified: true
    });
  };

  assert.deepEqual(await googleOAuthService.getGoogleProfile(
    'authorization-code',
    'https://club.example/api/auth/google/callback',
    { ...credentials, fetchImpl }
  ), {
    subject: 'google-subject',
    email: 'person@example.com'
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.method, 'POST');
  assert.match(calls[0].options.body.toString(), /code=authorization-code/);
  assert.match(calls[0].options.body.toString(), /client_secret=test-client-secret/);
  assert.equal(calls[0].options.signal.aborted, false);
  assert.equal(calls[1].options.headers.Authorization, 'Bearer access-token');
  assert.equal(calls[1].options.signal.aborted, false);
});

test('Google profile exchange defaults credentials from environment', async (t) => {
  const previousClientId = process.env.GOOGLE_CLIENT_ID;
  const previousClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  process.env.GOOGLE_CLIENT_ID = credentials.clientId;
  process.env.GOOGLE_CLIENT_SECRET = credentials.clientSecret;
  t.after(() => {
    if (previousClientId === undefined) {
      delete process.env.GOOGLE_CLIENT_ID;
    } else {
      process.env.GOOGLE_CLIENT_ID = previousClientId;
    }
    if (previousClientSecret === undefined) {
      delete process.env.GOOGLE_CLIENT_SECRET;
    } else {
      process.env.GOOGLE_CLIENT_SECRET = previousClientSecret;
    }
  });

  const fetchImpl = async (url) => url === 'https://oauth2.googleapis.com/token'
    ? fakeResponse({ access_token: 'access-token' })
    : fakeResponse({ sub: 'subject', email: 'user@example.com', email_verified: true });

  const authorizationUrl = new URL(googleOAuthService.getAuthorizationUrl('state', {
    redirectUri: 'https://club.example/api/auth/google/callback'
  }));
  assert.equal(authorizationUrl.searchParams.get('client_id'), credentials.clientId);
  assert.equal((await googleOAuthService.getGoogleProfile(
    'code',
    'https://club.example/api/auth/google/callback',
    { fetchImpl }
  )).email, 'user@example.com');
});

test('Google profile exchange reports missing credentials and missing network client', async () => {
  await assert.rejects(googleOAuthService.getGoogleProfile('', 'callback', credentials), /not configured/);
  await assert.rejects(googleOAuthService.getGoogleProfile('code', '', credentials), /not configured/);
  await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
    clientSecret: credentials.clientSecret
  }), /not configured/);
  await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
    clientId: credentials.clientId
  }), /not configured/);
  await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
    ...credentials,
    fetchImpl: null
  }), /network client is unavailable/);
});

test('Google profile exchange rejects failed token requests and missing access tokens', async () => {
  await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
    ...credentials,
    fetchImpl: async () => fakeResponse({}, false)
  }), /rejected the authorization code/);
  await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
    ...credentials,
    fetchImpl: async () => fakeResponse({})
  }), /did not return an access token/);
});

test('Google profile exchange rejects failed profile requests', async () => {
  let callCount = 0;
  await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
    ...credentials,
    fetchImpl: async () => {
      callCount += 1;
      return callCount === 1 ? fakeResponse({ access_token: 'token' }) : fakeResponse({}, false);
    }
  }), /profile could not be retrieved/);
});

test('Google profile exchange rejects unverified or malformed email profiles', async (t) => {
  const invalidProfiles = [
    { sub: null, email: 'user@example.com', email_verified: true },
    { sub: '', email: 'user@example.com', email_verified: true },
    { sub: 'subject', email: null, email_verified: true },
    { sub: 'subject', email: '', email_verified: true },
    { sub: 'subject', email: '   ', email_verified: true },
    { sub: 'subject', email: 'user@example.com', email_verified: false },
    { sub: 'subject', email: 'user@example.com', email_verified: 'true' }
  ];

  for (const profile of invalidProfiles) {
    await t.test(JSON.stringify(profile), async () => {
      let callCount = 0;
      await assert.rejects(googleOAuthService.getGoogleProfile('code', 'callback', {
        ...credentials,
        fetchImpl: async () => {
          callCount += 1;
          return callCount === 1
            ? fakeResponse({ access_token: 'token' })
            : fakeResponse(profile);
        }
      }), /verified email address/);
    });
  }
});
