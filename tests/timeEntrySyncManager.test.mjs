import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import {
  getPendingTimeEntrySyncStatus,
  markPendingTimeEntrySync
} from '../src/utils/timeEntrySyncStatus.js';
import { syncTimeEntryToCloud } from '../src/utils/timeEntrySyncManager.js';

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
}

beforeEach(() => {
  globalThis.localStorage = new MemoryStorage();
  globalThis.window = {
    dispatchEvent() {}
  };
});

test('syncTimeEntryToCloud clears pending date after a successful upload', async () => {
  const entry = { date: '2026-06-15' };
  markPendingTimeEntrySync('user-1', entry, 'offline');

  const result = await syncTimeEntryToCloud({
    userId: 'user-1',
    entry,
    saveTimeEntry: async () => ({ ...entry, id: 'cloud-id' })
  });

  assert.equal(result.success, true);
  assert.equal(result.returnedEntry.id, 'cloud-id');
  assert.equal(getPendingTimeEntrySyncStatus('user-1').pending, 0);
});

test('syncTimeEntryToCloud keeps date pending after a failed upload', async () => {
  const entry = { date: '2026-06-15' };

  const result = await syncTimeEntryToCloud({
    userId: 'user-1',
    entry,
    saveTimeEntry: async () => {
      throw new Error('offline');
    }
  });

  assert.equal(result.success, false);
  assert.deepEqual(getPendingTimeEntrySyncStatus('user-1').dates, [
    '2026-06-15'
  ]);
});
