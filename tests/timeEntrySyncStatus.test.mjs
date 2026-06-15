import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  clearPendingTimeEntrySync,
  getInferredPendingTimeEntries,
  getPendingTimeEntrySyncKey,
  getPendingTimeEntrySyncStatus,
  markPendingTimeEntrySync,
  mergePendingTimeEntrySync
} from '../src/utils/timeEntrySyncStatus.js';

class MemoryStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(key, String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = {
    dispatchEvent() {}
  };
});

test('infers pending sync entries from local entries without cloud ids', () => {
  const inferred = getInferredPendingTimeEntries([
    { date: '2026-06-15', intervals: [{ in: '08:43:17', out: null }] },
    { id: 'cloud-id', date: '2026-06-14' },
    { intervals: [] }
  ]);

  assert.deepEqual(inferred, [
    {
      date: '2026-06-15',
      reason: 'local_entry_without_cloud_id',
      updatedAt: null
    }
  ]);
});

test('merges stored pending markers with inferred local entries by date', () => {
  const merged = mergePendingTimeEntrySync(
    {
      pending: 2,
      dates: ['2026-06-14', '2026-06-15'],
      items: [
        { date: '2026-06-14', reason: 'offline' },
        { date: '2026-06-15', reason: 'offline' }
      ]
    },
    [
      { date: '2026-06-15', reason: 'local_entry_without_cloud_id' },
      { date: '2026-06-16', reason: 'local_entry_without_cloud_id' }
    ]
  );

  assert.equal(merged.pending, 3);
  assert.deepEqual(merged.dates, [
    '2026-06-14',
    '2026-06-15',
    '2026-06-16'
  ]);
});

test('marks and clears pending time entry sync dates', () => {
  markPendingTimeEntrySync('user-1', { date: '2026-06-15' }, 'offline');
  markPendingTimeEntrySync('user-1', { date: '2026-06-16' }, 'offline');

  assert.equal(getPendingTimeEntrySyncStatus('user-1').pending, 2);
  assert.ok(localStorage.getItem(getPendingTimeEntrySyncKey('user-1')));

  clearPendingTimeEntrySync('user-1', { date: '2026-06-15' });

  assert.deepEqual(getPendingTimeEntrySyncStatus('user-1').dates, [
    '2026-06-16'
  ]);

  clearPendingTimeEntrySync('user-1', { date: '2026-06-16' });

  assert.equal(getPendingTimeEntrySyncStatus('user-1').pending, 0);
  assert.equal(localStorage.getItem(getPendingTimeEntrySyncKey('user-1')), null);
});
