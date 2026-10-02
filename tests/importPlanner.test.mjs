import assert from 'node:assert/strict';
import test from 'node:test';

import { planImport, getPeriodBounds } from '../src/utils/importPlanner.js';

const entry = (date, extra = {}) => ({
  date,
  type: 'Regular',
  intervals: [{ in: '09:00:00', out: '17:00:00' }],
  ...extra,
});

const period = { start: '2026-09-25', end: '2026-10-24' };
const NOW = new Date('2026-10-02T12:00:00Z');

const datesOf = (entries) => entries.map((e) => e.date);
const assertUnique = (entries) =>
  assert.equal(new Set(datesOf(entries)).size, entries.length, 'dates must be unique');

test('replace never duplicates dates that sit outside the chosen period', () => {
  // File covers 09-23..09-26 but the chosen period starts 09-25.
  const existing = [entry('2026-09-23', { id: 'a' }), entry('2026-09-24', { id: 'b' }), entry('2026-09-25', { id: 'c' })];
  const imported = [entry('2026-09-23'), entry('2026-09-24'), entry('2026-09-25'), entry('2026-09-26')];

  const plan = planImport({ existingEntries: existing, importedEntries: imported, period, mode: 'replace', now: NOW });

  assertUnique(plan.finalEntries);
  assert.deepEqual(datesOf(plan.finalEntries), ['2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']);
  assert.equal(plan.skippedOutsidePeriod, 2);
  // outside entries keep their original database ids and data
  assert.equal(plan.finalEntries[0].id, 'a');
  assert.equal(plan.finalEntries[1].id, 'b');
});

test('duplicate rows in the file collapse to one entry per date (last wins)', () => {
  const imported = [
    entry('2026-09-28', { notes: 'first' }),
    entry('2026-09-28', { notes: 'second' }),
  ];
  const plan = planImport({ existingEntries: [], importedEntries: imported, period, mode: 'replace', now: NOW });

  assert.equal(plan.finalEntries.length, 1);
  assert.equal(plan.finalEntries[0].notes, 'second');
  assert.equal(plan.duplicateRowsInFile, 1);
});

test('already-duplicated existing entries are collapsed, keeping the one with an id', () => {
  const existing = [entry('2026-09-23'), entry('2026-09-23', { id: 'x' })];
  const plan = planImport({ existingEntries: existing, importedEntries: [], period, mode: 'merge', now: NOW });

  assert.equal(plan.finalEntries.length, 1);
  assert.equal(plan.finalEntries[0].id, 'x');
});

test('an imported row inherits the id of the entry it replaces and is marked modified', () => {
  const existing = [entry('2026-09-28', { id: 'row-1' })];
  const plan = planImport({ existingEntries: existing, importedEntries: [entry('2026-09-28', { notes: 'fixed' })], period, mode: 'merge', now: NOW });

  assert.equal(plan.toSave.length, 1);
  assert.equal(plan.toSave[0].id, 'row-1');
  assert.equal(plan.toSave[0].notes, 'fixed');
  assert.equal(plan.toSave[0].lastModified, NOW.toISOString());
});

test('merge keeps existing in-period entries that are not in the file; replace reports them for deletion', () => {
  const existing = [entry('2026-09-27', { id: 'fake' }), entry('2026-09-28', { id: 'real' })];
  const imported = [entry('2026-09-28')];

  const merge = planImport({ existingEntries: existing, importedEntries: imported, period, mode: 'merge', now: NOW });
  assert.deepEqual(datesOf(merge.finalEntries), ['2026-09-27', '2026-09-28']);
  assert.deepEqual(merge.toDelete, []);

  const replace = planImport({ existingEntries: existing, importedEntries: imported, period, mode: 'replace', now: NOW });
  assert.deepEqual(datesOf(replace.finalEntries), ['2026-09-28']);
  assert.deepEqual(replace.toDelete, [{ id: 'fake', date: '2026-09-27' }]);
  assertUnique(replace.finalEntries);
});

test('entries outside the period are never touched, even in replace mode', () => {
  const existing = [entry('2026-08-01', { id: 'old' }), entry('2026-11-01', { id: 'future' })];
  const plan = planImport({ existingEntries: existing, importedEntries: [entry('2026-09-30')], period, mode: 'replace', now: NOW });

  assert.deepEqual(datesOf(plan.finalEntries), ['2026-08-01', '2026-09-30', '2026-11-01']);
  assert.deepEqual(plan.toDelete, []);
});

test('dates with a time part are normalised so they cannot duplicate', () => {
  const existing = [entry('2026-09-28T00:00:00', { id: 'r' })];
  const plan = planImport({ existingEntries: existing, importedEntries: [entry('2026-09-28')], period, mode: 'replace', now: NOW });

  assert.equal(plan.finalEntries.length, 1);
  assert.equal(plan.finalEntries[0].id, 'r');
});

test('period bounds accept both { start, end } and { start_date, end_date }', () => {
  assert.deepEqual(getPeriodBounds({ start: '2026-09-25', end: '2026-10-24' }), { start: '2026-09-25', end: '2026-10-24' });
  assert.deepEqual(getPeriodBounds({ start_date: '2026-09-25', end_date: '2026-10-24' }), { start: '2026-09-25', end: '2026-10-24' });

  const plan = planImport({
    existingEntries: [],
    importedEntries: [entry('2026-09-30')],
    period: { start_date: '2026-09-25', end_date: '2026-10-24' },
    mode: 'merge',
    now: NOW,
  });
  assert.equal(plan.finalEntries.length, 1);
});
