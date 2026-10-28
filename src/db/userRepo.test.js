const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('./db');
const userRepo = require('./userRepo');

test('user repository finds users by email and id and handles missing email', async (t) => {
  const user = { id: 1, email: 'member@example.com', role: 'member' };
  const query = t.mock.method(db, 'query', async () => ({ rows: [user] }));

  assert.equal(await userRepo.findByEmail(user.email), user);
  assert.deepEqual(query.mock.calls[0].arguments, [
    'SELECT * FROM users WHERE email = $1',
    [user.email]
  ]);
  assert.equal(await userRepo.findById(user.id), user);
  query.mock.mockImplementation(async () => ({ rows: [] }));
  assert.equal(await userRepo.findByEmail('missing@example.com'), null);
});

test('user repository creates users with default and explicit roles', async (t) => {
  const user = { id: 2, email: 'new@example.com', role: 'member' };
  const query = t.mock.method(db, 'query', async () => ({ rows: [user] }));

  assert.equal(await userRepo.createUser(user.email, 'hash'), user);
  assert.deepEqual(query.mock.calls[0].arguments[1], [user.email, 'hash', 'member']);
  await userRepo.createUser('organizer@example.com', 'other-hash', 'organizer');
  assert.deepEqual(query.mock.calls[1].arguments[1], ['organizer@example.com', 'other-hash', 'organizer']);
});
