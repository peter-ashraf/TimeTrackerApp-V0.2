import assert from 'node:assert/strict';
import test from 'node:test';

import { createInTabLock } from '../src/utils/inTabLock.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('runs operations one at a time, in call order', async () => {
  const lock = createInTabLock();
  const events = [];

  const a = lock('x', 0, async () => { events.push('a:start'); await sleep(20); events.push('a:end'); return 'A'; });
  const b = lock('x', 0, async () => { events.push('b:start'); await sleep(5); events.push('b:end'); return 'B'; });

  assert.deepEqual(await Promise.all([a, b]), ['A', 'B']);
  assert.deepEqual(events, ['a:start', 'a:end', 'b:start', 'b:end']);
});

test('a failing operation rejects its caller but does not block the queue', async () => {
  const lock = createInTabLock();

  const failing = lock('x', 0, async () => { throw new Error('boom'); });
  const after = lock('x', 0, async () => 'still runs');

  await assert.rejects(failing, /boom/);
  assert.equal(await after, 'still runs');
});

test('never waits on anything outside this tab', async () => {
  const lock = createInTabLock();
  const started = Date.now();
  assert.equal(await lock('x', 10000, async () => 42), 42);
  assert.ok(Date.now() - started < 500);
});
