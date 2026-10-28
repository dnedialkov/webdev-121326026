const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const authService = require('./authService');
const userRepo = require('../db/userRepo');

test('AC-4 authentication rejects missing credentials and unknown users', async (t) => {
  const findByEmail = t.mock.method(userRepo, 'findByEmail', async () => null);

  assert.deepEqual(await authService.authenticateUser('', 'password'), {
    success: false,
    error: 'Invalid email or password'
  });
  assert.deepEqual(await authService.authenticateUser('person@example.com', ''), {
    success: false,
    error: 'Invalid email or password'
  });
  assert.deepEqual(await authService.authenticateUser('missing@example.com', 'password'), {
    success: false,
    error: 'Invalid email or password'
  });
  assert.equal(findByEmail.mock.callCount(), 1);
});

test('authentication rejects mismatched passwords and returns only public user fields', async (t) => {
  t.mock.method(userRepo, 'findByEmail', async () => ({
    id: 2,
    email: 'person@example.com',
    role: 'organizer',
    password_hash: 'hash'
  }));
  const compare = t.mock.method(bcrypt, 'compare', async () => false);

  assert.deepEqual(await authService.authenticateUser('person@example.com', 'wrong'), {
    success: false,
    error: 'Invalid email or password'
  });
  assert.deepEqual(compare.mock.calls[0].arguments, ['wrong', 'hash']);

  compare.mock.mockImplementation(async () => true);
  assert.deepEqual(await authService.authenticateUser('person@example.com', 'correct'), {
    success: true,
    user: {
      id: 2,
      email: 'person@example.com',
      role: 'organizer'
    }
  });
});

test('AC-6 registration validates required fields and rejects duplicate email', async (t) => {
  const findByEmail = t.mock.method(userRepo, 'findByEmail', async () => ({ id: 1 }));

  assert.deepEqual(await authService.registerUser('', 'password'), {
    success: false,
    error: 'Email and password are required'
  });
  assert.deepEqual(await authService.registerUser('person@example.com', ''), {
    success: false,
    error: 'Email and password are required'
  });
  assert.deepEqual(await authService.registerUser('person@example.com', 'password'), {
    success: false,
    error: 'Email already registered'
  });
  assert.equal(findByEmail.mock.callCount(), 1);
});

test('registration hashes passwords and creates users with default or selected roles', async (t) => {
  t.mock.method(userRepo, 'findByEmail', async () => null);
  const hash = t.mock.method(bcrypt, 'hash', async (password, saltRounds) => `${password}:${saltRounds}`);
  const createUser = t.mock.method(userRepo, 'createUser', async (email, passwordHash, role) => ({
    id: 3,
    email,
    role,
    password_hash: passwordHash
  }));

  assert.deepEqual(await authService.registerUser('member@example.com', 'password'), {
    success: true,
    user: {
      id: 3,
      email: 'member@example.com',
      role: 'member',
      password_hash: 'password:10'
    }
  });
  assert.deepEqual(await authService.registerUser('organizer@example.com', 'secret', 'organizer'), {
    success: true,
    user: {
      id: 3,
      email: 'organizer@example.com',
      role: 'organizer',
      password_hash: 'secret:10'
    }
  });
  assert.deepEqual(hash.mock.calls.map((call) => call.arguments), [
    ['password', 10],
    ['secret', 10]
  ]);
  assert.deepEqual(createUser.mock.calls.map((call) => call.arguments), [
    ['member@example.com', 'password:10', 'member'],
    ['organizer@example.com', 'secret:10', 'organizer']
  ]);
});

test('AC-15 Google sign-in reuses an existing account and its role', async (t) => {
  const existingUser = {
    id: 8,
    email: 'organizer@example.com',
    role: 'organizer',
    password_hash: 'not-returned'
  };
  const findByEmail = t.mock.method(userRepo, 'findByEmail', async () => existingUser);
  const hash = t.mock.method(bcrypt, 'hash', async () => {
    throw new Error('Existing Google users must not be re-created');
  });

  assert.deepEqual(await authService.authenticateGoogleUser(existingUser.email), {
    id: 8,
    email: 'organizer@example.com',
    role: 'organizer'
  });
  assert.equal(findByEmail.mock.callCount(), 1);
  assert.equal(hash.mock.callCount(), 0);
});

test('AC-15 Google sign-in creates a member account with an unusable random password', async (t) => {
  t.mock.method(userRepo, 'findByEmail', async () => null);
  const hash = t.mock.method(bcrypt, 'hash', async (password, saltRounds) => {
    assert.match(password, /^[0-9a-f]{64}$/);
    assert.equal(saltRounds, 10);
    return 'hashed-random-password';
  });
  const createUser = t.mock.method(userRepo, 'createUser', async (email, passwordHash, role) => ({
    id: 9,
    email,
    role
  }));

  assert.deepEqual(await authService.authenticateGoogleUser('new@example.com'), {
    id: 9,
    email: 'new@example.com',
    role: 'member'
  });
  assert.equal(hash.mock.callCount(), 1);
  assert.deepEqual(createUser.mock.calls[0].arguments.slice(1), [
    'hashed-random-password',
    'member'
  ]);
});

test('Google sign-in rejects missing email and propagates ordinary repository failures', async (t) => {
  await assert.rejects(authService.authenticateGoogleUser(''), /verified Google email/);

  t.mock.method(userRepo, 'findByEmail', async () => null);
  t.mock.method(bcrypt, 'hash', async () => 'hash');
  t.mock.method(userRepo, 'createUser', async () => {
    throw new Error('database unavailable');
  });
  await assert.rejects(authService.authenticateGoogleUser('person@example.com'), /database unavailable/);
});

test('Google sign-in reloads an account created concurrently', async (t) => {
  const existingUser = { id: 10, email: 'person@example.com', role: 'organizer' };
  let lookupCount = 0;
  const findByEmail = t.mock.method(userRepo, 'findByEmail', async () => {
    lookupCount += 1;
    return lookupCount === 1 ? null : existingUser;
  });
  t.mock.method(bcrypt, 'hash', async () => 'hash');
  const duplicateError = Object.assign(new Error('duplicate email'), { code: '23505' });
  t.mock.method(userRepo, 'createUser', async () => { throw duplicateError; });

  assert.deepEqual(await authService.authenticateGoogleUser(existingUser.email), {
    id: 10,
    email: existingUser.email,
    role: existingUser.role
  });
  assert.equal(findByEmail.mock.callCount(), 2);
});

test('Google sign-in rethrows a duplicate error if the account is still missing', async (t) => {
  t.mock.method(userRepo, 'findByEmail', async () => null);
  t.mock.method(bcrypt, 'hash', async () => 'hash');
  const duplicateError = Object.assign(new Error('duplicate email'), { code: '23505' });
  t.mock.method(userRepo, 'createUser', async () => { throw duplicateError; });

  await assert.rejects(authService.authenticateGoogleUser('person@example.com'), (error) => error === duplicateError);
});
