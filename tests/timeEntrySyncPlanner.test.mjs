import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildTimeEntrySyncPlan,
  timeEntriesAreDifferent,
} from '../src/utils/timeEntrySyncPlanner.js';

test('remote-only cloud entries are pulled silently', () => {
  const cloudEntry = {
    id: 'cloud-1',
    date: '2026-06-15',
    intervals: [{ in: '08:43:17', out: '18:07:01' }],
  };

  const plan = buildTimeEntrySyncPlan({
    localEntries: [],
    remoteEntries: [cloudEntry],
  });

  assert.equal(plan.pulledCount, 1);
  assert.deepEqual(plan.finalEntries, [cloudEntry]);
  assert.deepEqual(plan.entriesToUpload, []);
  assert.deepEqual(plan.conflicts, []);
});

test('local-only entries are kept visible and queued for upload', () => {
  const localEntry = {
    date: '2026-06-15',
    intervals: [{ in: '08:43:17', out: null }],
  };

  const plan = buildTimeEntrySyncPlan({
    localEntries: [localEntry],
    remoteEntries: [],
  });

  assert.equal(plan.pulledCount, 0);
  assert.deepEqual(plan.finalEntries, [localEntry]);
  assert.deepEqual(plan.entriesToUpload, [localEntry]);
  assert.deepEqual(plan.conflicts, []);
});

test('matching local and cloud entries merge the cloud id without conflict', () => {
  const localEntry = {
    date: '2026-06-15',
    intervals: [{ in: '08:43', out: '18:07' }],
    notes: 'Same',
  };
  const remoteEntry = {
    id: 'cloud-1',
    date: '2026-06-15',
    intervals: [{ in: '08:43:00', out: '18:07:00' }],
    notes: 'Same',
  };

  const plan = buildTimeEntrySyncPlan({
    localEntries: [localEntry],
    remoteEntries: [remoteEntry],
  });

  assert.deepEqual(plan.conflicts, []);
  assert.deepEqual(plan.entriesToUpload, []);
  assert.deepEqual(plan.finalEntries, [{ ...localEntry, id: 'cloud-1' }]);
});

test('same-date differences create a conflict and do not silently overwrite', () => {
  const localEntry = {
    date: '2026-06-15',
    intervals: [{ in: '08:43:17', out: '18:07:01' }],
    notes: 'Phone checkout',
  };
  const remoteEntry = {
    id: 'cloud-1',
    date: '2026-06-15',
    intervals: [{ in: '08:43:17', out: '18:00:00' }],
    notes: 'Cloud checkout',
  };

  const plan = buildTimeEntrySyncPlan({
    localEntries: [localEntry],
    remoteEntries: [remoteEntry],
  });

  assert.equal(plan.finalEntries.length, 0);
  assert.deepEqual(plan.entriesToUpload, []);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].date, '2026-06-15');
  assert.equal(plan.conflicts[0].localEntry, localEntry);
  assert.equal(plan.conflicts[0].remoteEntry, remoteEntry);
});

test('normalization avoids false conflicts for equivalent time formats', () => {
  assert.equal(
    timeEntriesAreDifferent(
      { date: '2026-06-15', intervals: [{ in: '8:03', out: '18:07' }] },
      { date: '2026-06-15', intervals: [{ in: '08:03:00', out: '18:07:00' }] },
    ),
    false,
  );
});
