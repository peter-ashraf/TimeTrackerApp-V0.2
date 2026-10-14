// "To Be Added" marks an official holiday that was worked anyway: the company adds the day to the
// vacation balance, and the check-in/out times on it still count as a normal working day.

export const TO_BE_ADDED = 'To Be Added';

export const hasWorkedTimes = (entry) =>
  Array.isArray(entry?.intervals) && entry.intervals.some((i) => i?.in || i?.out);

// True when the entry's hours should be counted like a regular working day.
export const isWorkedDay = (entry) =>
  entry?.type === 'Regular' || (entry?.type === TO_BE_ADDED && hasWorkedTimes(entry));

// One distinct colour per day type, shared by the timesheet tags and the calendar.
export const TYPE_COLORS = {
  Regular: { color: '#39FF14', rgb: '57, 255, 20' },
  Vacation: { color: '#00F0FF', rgb: '0, 240, 255' },
  'Sick Leave': { color: '#FF007F', rgb: '255, 0, 127' },
  Holiday: { color: '#FF9F0A', rgb: '255, 159, 10' },
  Leave: { color: '#B026FF', rgb: '176, 38, 255' },
  [TO_BE_ADDED]: { color: '#4D7CFF', rgb: '77, 124, 255' },
};

const FALLBACK_COLOR = { color: '#94A3B8', rgb: '148, 163, 184' };

export const typeColor = (type) => TYPE_COLORS[type] ?? FALLBACK_COLOR;

// Inline style for a status tag: coloured text with a faint fill and border of the same hue.
export const typeTagStyle = (type) => {
  const { color, rgb } = typeColor(type);
  return { color, background: `rgba(${rgb}, 0.12)`, border: `1px solid rgba(${rgb}, 0.35)` };
};
