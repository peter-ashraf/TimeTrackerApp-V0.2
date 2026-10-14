// "To Be Added" marks an official holiday that was worked anyway: the company adds the day to the
// vacation balance, and the check-in/out times on it still count as a normal working day.

export const TO_BE_ADDED = 'To Be Added';

export const hasWorkedTimes = (entry) =>
  Array.isArray(entry?.intervals) && entry.intervals.some((i) => i?.in || i?.out);

// True when the entry's hours should be counted like a regular working day.
export const isWorkedDay = (entry) =>
  entry?.type === 'Regular' || (entry?.type === TO_BE_ADDED && hasWorkedTimes(entry));
