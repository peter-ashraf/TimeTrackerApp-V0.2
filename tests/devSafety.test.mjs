import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { splitForeignEntries } from '../src/utils/timeEntrySyncPlanner.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the default dev script uses the fake local backend, never the real database', () => {
  assert.match(pkg.scripts.dev, /--mode localdev/);
  assert.match(pkg.scripts['dev:local'], /--mode localdev/);
});

test('the real database needs the explicit dev:real script', () => {
  assert.match(pkg.scripts['dev:real'], /--mode realdev/);
});

test('no script starts a bare dev server without a named mode', () => {
  const devServers = Object.entries(pkg.scripts).filter(([, cmd]) => /^vite(\s|$)/.test(cmd) && !/^vite (build|preview)/.test(cmd));
  assert.ok(devServers.length >= 3);
  for (const [name, cmd] of devServers) {
    assert.match(cmd, /--mode (localdev|realdev)/, `script "${name}" must pick a mode`);
  }
});

test('splitForeignEntries separates entries owned by another account', () => {
  const entries = [
    { date: '2026-09-28', user_id: 'me' },
    { date: '2026-09-29', user_id: 'someone-else' },
    { date: '2026-09-30' }, // created locally, owner unknown: kept
  ];
  const { own, foreign } = splitForeignEntries(entries, 'me');

  assert.deepEqual(own.map((e) => e.date), ['2026-09-28', '2026-09-30']);
  assert.deepEqual(foreign.map((e) => e.date), ['2026-09-29']);
});

test('the dev test user can never look like the real account', () => {
  const seededDevUserId = '00000000-0000-4000-8000-000000000001';
  const { foreign } = splitForeignEntries([{ date: '2026-09-28', user_id: seededDevUserId }], 'dc8182fb-8cb2-45c0-8da9-cc3cec8ad66c');
  assert.equal(foreign.length, 1);
});
