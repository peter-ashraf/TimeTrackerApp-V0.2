import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateHoursSpentOutsideFromIntervals,
  calculateHoursWorkedFromIntervals,
  calculateOvertimeDetailsForEntries,
  extractBreaksFromIntervals,
  applyBreakToIntervals,
  timeToSeconds
} from '../src/hooks/useCalculations.js';
import { isValidTimeRange } from '../src/utils/calculations.js';

test('timeToSeconds parses HH:mm and HH:mm:ss values', () => {
  assert.equal(timeToSeconds('09:15'), 33300);
  assert.equal(timeToSeconds('09:15:30'), 33330);
  assert.equal(timeToSeconds(''), 0);
});

test('calculateHoursWorkedFromIntervals keeps the allowed break inside the paid day', () => {
  const intervals = [
    { in: '09:00:00', out: '18:30:00' },
    { in: '13:00:00', out: '13:30:00' }
  ];

  assert.equal(calculateHoursWorkedFromIntervals(intervals), 9.5);
});

test('calculateHoursWorkedFromIntervals returns zero for incomplete entries', () => {
  const intervals = [
    { in: '09:00:00', out: null }
  ];

  assert.equal(calculateHoursWorkedFromIntervals(intervals), 0);
});

test('calculateHoursSpentOutsideFromIntervals ignores the allowed lunch window', () => {
  const intervals = [
    { in: '09:00:00', out: '18:30:00' },
    { in: '13:00:00', out: '13:30:00' },
    { in: '16:00:00', out: '16:20:00' }
  ];

  assert.equal(calculateHoursSpentOutsideFromIntervals(intervals), 1 / 3);
});

test('calculateOvertimeDetailsForEntries applies weekday and weekend overtime factors', () => {
  const entries = [
    {
      date: '2026-06-08',
      type: 'Regular',
      intervals: [{ in: '09:00:00', out: '19:00:00' }]
    },
    {
      date: '2026-06-13',
      type: 'Regular',
      intervals: [{ in: '10:00:00', out: '12:00:00' }]
    }
  ];

  assert.deepEqual(
    calculateOvertimeDetailsForEntries(entries, '2026-06-01', '2026-06-30'),
    {
      totalHoursWorked: 12,
      totalExtraHours: 3,
      totalExtraHoursWithFactor: 5.5
    }
  );
});

test('calculateOvertimeDetailsForEntries skips incomplete and out-of-period entries', () => {
  const entries = [
    {
      date: '2026-06-08',
      type: 'Regular',
      intervals: [{ in: '09:00:00', out: null }]
    },
    {
      date: '2026-07-01',
      type: 'Regular',
      intervals: [{ in: '09:00:00', out: '19:00:00' }]
    }
  ];

  assert.deepEqual(
    calculateOvertimeDetailsForEntries(entries, '2026-06-01', '2026-06-30'),
    {
      totalHoursWorked: 0,
      totalExtraHours: 0,
      totalExtraHoursWithFactor: 0
    }
  );
});

test('isValidTimeRange rejects equal or reversed ranges', () => {
  assert.equal(isValidTimeRange('09:00', '17:00'), true);
  assert.equal(isValidTimeRange('09:00', '09:00'), false);
  assert.equal(isValidTimeRange('17:00', '09:00'), false);
});

test('calculateHoursWorkedFromIntervals sums sequential work sessions correctly', () => {
  // Morning session (15m 21s) + Afternoon session (6h)
  const intervals = [
    { in: '10:41:02', out: '10:56:23' },
    { in: '11:05:59', out: '17:05:59' }
  ];

  // 15m 21s = 921s, 6h = 21600s, total = 22521s = 6.25583h
  const hours = calculateHoursWorkedFromIntervals(intervals);
  assert.equal(Math.round(hours * 100) / 100, 6.26);
});

test('extractBreaksFromIntervals detects break gap between sequential sessions', () => {
  const intervals = [
    { in: '10:41:02', out: '10:56:23' },
    { in: '11:05:59', out: null }
  ];

  const breaks = extractBreaksFromIntervals(intervals);
  assert.equal(breaks.length, 1);
  assert.equal(breaks[0].in, '10:56:23');
  assert.equal(breaks[0].out, '11:05:59');
});

test('applyBreakToIntervals splits open work session cleanly', () => {
  const intervals = [
    { in: '10:41:02', out: null }
  ];

  const updated = applyBreakToIntervals(intervals, '10:56:23', '11:05:59');
  assert.deepEqual(updated, [
    { in: '10:41:02', out: '10:56:23' },
    { in: '11:05:59', out: null }
  ]);
});

test('calculateHoursSpentOutsideFromIntervals measures outside gap between sequential sessions', () => {
  const intervals = [
    { in: '10:41:02', out: '10:56:23' },
    { in: '11:05:59', out: '17:00:00' }
  ];

  // 10:56:23 to 11:05:59 = 9m 36s = 576s = 0.16h
  const outside = calculateHoursSpentOutsideFromIntervals(intervals);
  assert.equal(Math.round(outside * 100) / 100, 0.16);
});
