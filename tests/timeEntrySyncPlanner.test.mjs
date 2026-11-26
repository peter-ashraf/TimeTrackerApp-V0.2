import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildPullTimeEntryPlan,
  buildPushTimeEntryPlan,
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

test('push plan uploads local-only entries, leaves remote-only untouched, and conflicts on any divergence', () => {
  const localNew = { date: '2026-06-15', intervals: [{ in: '08:30:00', out: '17:30:00' }] };
  const localEdit = {
    id: 'cloud-16',
    date: '2026-06-16',
    intervals: [{ in: '09:00:00', out: '18:30:00' }],
    lastModified: '2026-06-16T20:00:00.000Z',
  };
  const remoteDiverged = {
    id: 'cloud-16',
    date: '2026-06-16',
    intervals: [{ in: '09:00:00', out: '18:00:00' }],
    updated_at: '2026-06-16T18:05:00.000Z',
  };
  const remoteOnly = {
    id: 'cloud-17',
    date: '2026-06-17',
    intervals: [{ in: '08:00:00', out: '17:00:00' }],
  };

  const plan = buildPushTimeEntryPlan({
    localEntries: [localNew, localEdit],
    remoteEntries: [remoteDiverged, remoteOnly],
    pendingDeletes: [],
  });

  assert.deepEqual(plan.entriesToUpload, [localNew]);
  assert.equal(plan.remoteOnlyCount, 1);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].date, '2026-06-16');
});

test('push plan queues pending deletes unless cloud was updated after local delete', () => {
  const safeDeleteCloud = {
    id: 'cloud-10',
    date: '2026-06-10',
    intervals: [{ in: '08:00:00', out: '17:00:00' }],
    updated_at: '2026-06-10T17:00:00.000Z',
  };
  const newerCloud = {
    id: 'cloud-11',
    date: '2026-06-11',
    intervals: [{ in: '08:00:00', out: '17:30:00' }],
    updated_at: '2026-06-12T09:00:00.000Z',
  };

  const plan = buildPushTimeEntryPlan({
    localEntries: [],
    remoteEntries: [safeDeleteCloud, newerCloud],
    pendingDeletes: [
      { date: '2026-06-10', id: 'cloud-10', deletedAt: '2026-06-11T10:00:00.000Z' },
      { date: '2026-06-11', id: 'cloud-11', deletedAt: '2026-06-11T10:00:00.000Z' },
    ],
  });

  assert.equal(plan.entriesToDeleteFromCloud.length, 1);
  assert.equal(plan.entriesToDeleteFromCloud[0].date, '2026-06-10');
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].date, '2026-06-11');
  assert.equal(plan.conflicts[0].localEntry._isDeleted, true);
});

test('pull plan pulls cloud entries, preserves unuploaded local entries, and flags conflicts', () => {
  const unuploadedLocal = { date: '2026-06-18', intervals: [{ in: '08:15:00', out: null }] };
  const localDiverged = { id: 'cloud-19', date: '2026-06-19', intervals: [{ in: '09:00:00', out: '18:00:00' }] };
  const remoteDiverged = { id: 'cloud-19', date: '2026-06-19', intervals: [{ in: '09:00:00', out: '17:30:00' }] };
  const remoteNew = { id: 'cloud-20', date: '2026-06-20', intervals: [{ in: '08:30:00', out: '17:30:00' }] };

  const plan = buildPullTimeEntryPlan({
    localEntries: [unuploadedLocal, localDiverged],
    remoteEntries: [remoteDiverged, remoteNew],
    pendingSyncDates: ['2026-06-18'],
  });

  assert.equal(plan.pulledCount, 1);
  assert.equal(plan.preservedLocalCount, 1);
  assert.equal(plan.conflicts.length, 1);
  assert.equal(plan.conflicts[0].date, '2026-06-19');
  assert.ok(plan.finalEntries.some((e) => e.date === '2026-06-18'));
  assert.ok(plan.finalEntries.some((e) => e.date === '2026-06-20'));
});
