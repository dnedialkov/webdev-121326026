const test = require('node:test');
const assert = require('node:assert');
const app = require('../server');
const db = require('../db/db');

test('GET /health returns 200 ok when database is up', async (t) => {
  t.mock.method(db, 'query', async () => ({ rows: [{ '?column?': 1 }] }));
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/health`);

  assert.strictEqual(res.status, 200);
  const json = await res.json();
  assert.deepStrictEqual(json, { status: 'ok', db: 'ok' });
});

test('GET /health returns 503 error when database is down', async (t) => {
  t.mock.method(db, 'query', async () => { throw new Error('DB connection failed'); });
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/health`);

  assert.strictEqual(res.status, 503);
  const json = await res.json();
  assert.deepStrictEqual(json, { status: 'error', db: 'down' });
});

test('Unknown route returns 404', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/no-such-page`);

  assert.strictEqual(res.status, 404);
  const json = await res.json();
  assert.deepStrictEqual(json, { error: 'Not found' });
});

test('Malformed JSON in POST request returns 400 and generic message without stack trace', async (t) => {
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const port = server.address().port;
  const res = await fetch(`http://localhost:${port}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"title": 12'
  });
  assert.strictEqual(res.status, 400);
  const json = await res.json();
  assert.strictEqual(json.error, 'That request is not valid');
  assert.strictEqual(json.stack, undefined);
});
