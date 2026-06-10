import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateHoursSpentOutsideFromIntervals,
  calculateHoursWorkedFromIntervals,
  calculateOvertimeDetailsForEntries,
  timeToSeconds
} from '../src/hooks/useCalculations.js';
import { isValidTimeRange } from '../src/utils/calculations.js';

test('timeToSeconds parses HH:mm and HH:mm:ss values', () => {
  assert.equal(timeToSeconds('09:15'), 33300);
  assert.equal(timeToSeconds('09:15:30'), 33330);
  assert.equal(timeToSeconds(''), 0);
});

test('calculateHoursWorkedFromIntervals subtracts break intervals from the main work interval', () => {
  const intervals = [
    { in: '09:00:00', out: '18:30:00' },
    { in: '13:00:00', out: '13:30:00' }
  ];

  assert.equal(calculateHoursWorkedFromIntervals(intervals), 9);
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
