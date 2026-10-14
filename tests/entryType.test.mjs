import test from 'node:test';
import assert from 'node:assert/strict';
import { isWorkedDay } from '../src/utils/entryType.js';

test('a worked holiday tagged To Be Added still counts its hours', () => {
  assert.equal(isWorkedDay({ type: 'To Be Added', intervals: [{ in: '09:00:00', out: '18:00:00' }] }), true);
});

test('a To Be Added day without times is not a worked day', () => {
  assert.equal(isWorkedDay({ type: 'To Be Added', intervals: [] }), false);
  assert.equal(isWorkedDay({ type: 'Vacation', intervals: [] }), false);
  assert.equal(isWorkedDay({ type: 'Regular', intervals: [] }), true);
});
