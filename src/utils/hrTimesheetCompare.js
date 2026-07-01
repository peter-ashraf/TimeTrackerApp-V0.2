const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];

const DAY_REGEX = '(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)';

export const emptyHrTimesheetData = () => ({
  workRows: [],
  dayOffRows: [],
  totalOvertime: '',
  rawText: '',
  confidence: null
});

export const normalizeDateValue = (value) => {
  if (!value) return '';
  const cleaned = String(value)
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const numeric = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const [, month, day, year] = numeric;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const parsed = new Date(cleaned);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
};

export const normalizeTimeValue = (value) => {
  if (!value) return '';
  const cleaned = String(value).replace(/\s+/g, ' ').trim();
  const twelveHour = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)$/i);
  if (twelveHour) {
    let hours = parseInt(twelveHour[1], 10);
    const minutes = twelveHour[2];
    const seconds = twelveHour[3] || '00';
    const period = twelveHour[4].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return `${String(hours).padStart(2, '0')}:${minutes}:${seconds}`;
  }

  const twentyFourHour = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (twentyFourHour) {
    return `${twentyFourHour[1].padStart(2, '0')}:${twentyFourHour[2]}:${twentyFourHour[3] || '00'}`;
  }

  return '';
};

export const normalizeDurationValue = (value) => {
  if (!value) return '';
  const cleaned = String(value).replace('*', '').trim();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return '';
  return `${match[1].padStart(2, '0')}:${match[2]}:${match[3] || '00'}`;
};

export const durationToHours = (duration) => {
  const normalized = normalizeDurationValue(duration);
  if (!normalized) return null;
  const [hours, minutes, seconds] = normalized.split(':').map(Number);
  return hours + minutes / 60 + seconds / 3600;
};

const getDayName = (date) => {
  if (!date) return '';
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return DAY_NAMES[parsed.getDay()];
};

const normalizeDayOffType = (value) => {
  const text = String(value || '').toLowerCase();
  if (text.includes('sick')) return 'Sick Leave';
  if (text.includes('holiday')) return 'Holiday';
  if (text.includes('vacation')) return 'Vacation';
  if (text.includes('leave')) return 'Leave';
  return 'Holiday';
};

const createWorkRow = ({
  id,
  date,
  checkIn,
  checkOut,
  hrDuration,
  hrOvertime,
  rawText,
  confidence
}) => ({
  id,
  date,
  day: getDayName(date),
  type: 'Regular',
  checkIn,
  checkOut,
  hrDuration,
  hrOvertime,
  rawText,
  confidence
});

const createDayOffRow = ({ id, date, type, rawText, confidence }) => ({
  id,
  date,
  day: getDayName(date),
  type,
  checkIn: '',
  checkOut: '',
  hrDuration: '',
  hrOvertime: '',
  rawText,
  confidence
});

export const parseHrTimesheetText = (text, options = {}) => {
  const rawText = text || '';
  const lines = rawText
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const parsed = emptyHrTimesheetData();
  parsed.rawText = rawText;
  parsed.confidence = options.confidence ?? null;

  const totalMatch = rawText.match(/Total\s+Over\s*Time\s+Hrs\s*=?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (totalMatch) {
    parsed.totalOvertime = totalMatch[1];
  }

  let inDaysOffSection = false;
  let inVacationSection = false;

  lines.forEach((line, index) => {
    if (/Days\s+Off/i.test(line)) {
      inDaysOffSection = true;
      return;
    }

    if (/Vacation/i.test(line) || /Sick\s+Days/i.test(line)) {
      inVacationSection = true;
    }

    if (!inVacationSection) {
      const rowMatch = line.match(new RegExp(`^${DAY_REGEX}\\s+(\\d{1,2}[/-]\\d{1,2}[/-]\\d{4})\\s+(.+)$`, 'i'));
      if (rowMatch) {
        const date = normalizeDateValue(rowMatch[2]);
        const remainder = rowMatch[3];
        const times = remainder.match(/\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M/gi) || [];

        if (date && times.length >= 2) {
          const durationCandidates = remainder
            .replace(/\d{1,2}:\d{2}(?::\d{2})?\s*[AP]M/gi, ' ')
            .match(/\d{1,2}:\d{2}(?::\d{2})?\s*\*?/g) || [];

          parsed.workRows.push(createWorkRow({
            id: `work-${index}-${date}`,
            date,
            checkIn: normalizeTimeValue(times[0]),
            checkOut: normalizeTimeValue(times[1]),
            hrDuration: normalizeDurationValue(durationCandidates[0]),
            hrOvertime: normalizeDurationValue(durationCandidates[1]),
            rawText: line,
            confidence: parsed.confidence
          }));
        }
      }
    }

    if (inDaysOffSection && !inVacationSection) {
      const dayOffMatch = line.match(new RegExp(`^${DAY_REGEX},?\\s+([A-Za-z]+\\s+\\d{1,2},\\s+\\d{4})\\s+(.+)$`, 'i'));
      if (dayOffMatch) {
        const date = normalizeDateValue(dayOffMatch[2]);
        if (date) {
          parsed.dayOffRows.push(createDayOffRow({
            id: `dayoff-${index}-${date}`,
            date,
            type: normalizeDayOffType(dayOffMatch[3]),
            rawText: line,
            confidence: parsed.confidence
          }));
        }
      }
    }
  });

  return parsed;
};

const secondsFromTime = (time) => {
  if (!time) return null;
  const normalized = normalizeTimeValue(time) || normalizeDurationValue(time);
  if (!normalized) return null;
  const [hours, minutes, seconds] = normalized.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

const formatAppType = (type) => type || 'Regular';

const isRegularType = (type) => formatAppType(type) === 'Regular';

const appEntryToComparable = (entry) => {
  const interval = entry?.intervals?.[0] || {};
  return {
    date: entry?.date || '',
    type: formatAppType(entry?.type),
    checkIn: normalizeTimeValue(interval.in),
    checkOut: normalizeTimeValue(interval.out)
  };
};

export const compareHrTimesheetToEntries = (reviewedData, appEntries, period) => {
  const periodStart = period?.start_date || period?.start || '';
  const periodEnd = period?.end_date || period?.end || '';
  const entriesByDate = new Map((appEntries || []).map(entry => [entry.date, entry]));
  const hrRows = [
    ...(reviewedData?.workRows || []),
    ...(reviewedData?.dayOffRows || [])
  ].filter(row => {
    if (!row.date) return false;
    if (periodStart && row.date < periodStart) return false;
    if (periodEnd && row.date > periodEnd) return false;
    return true;
  });

  const seenDates = new Set();
  const comparisons = hrRows.map((hrRow) => {
    seenDates.add(hrRow.date);
    const appEntry = entriesByDate.get(hrRow.date);
    const issues = [];

    if (!appEntry) {
      issues.push('App missing entry');
    } else {
      const app = appEntryToComparable(appEntry);
      if (app.type !== hrRow.type) {
        issues.push('Day type mismatch');
      }

      if (isRegularType(hrRow.type) && isRegularType(app.type)) {
        const checkInDiff = Math.abs((secondsFromTime(app.checkIn) ?? -1) - (secondsFromTime(hrRow.checkIn) ?? -2));
        const checkOutDiff = Math.abs((secondsFromTime(app.checkOut) ?? -1) - (secondsFromTime(hrRow.checkOut) ?? -2));

        if (checkInDiff > 60 || checkOutDiff > 60) {
          issues.push('Time mismatch');
        }

        const appDurationHours = app.checkIn && app.checkOut
          ? ((secondsFromTime(app.checkOut) || 0) - (secondsFromTime(app.checkIn) || 0)) / 3600
          : null;
        const hrDurationHours = durationToHours(hrRow.hrDuration);
        if (
          hrDurationHours !== null &&
          appDurationHours !== null &&
          Math.abs(appDurationHours - hrDurationHours) > 0.05
        ) {
          issues.push('Duration mismatch');
        }

      }
    }

    return {
      id: `comparison-${hrRow.date}`,
      date: hrRow.date,
      hrRow,
      appEntry,
      status: issues.length === 0 ? 'Match' : issues[0],
      issues,
      action: issues.length === 0 ? 'none' : 'none'
    };
  });

  (appEntries || []).forEach((entry) => {
    if (!entry.date || seenDates.has(entry.date)) return;
    if (periodStart && entry.date < periodStart) return;
    if (periodEnd && entry.date > periodEnd) return;

    comparisons.push({
      id: `app-only-${entry.date}`,
      date: entry.date,
      hrRow: null,
      appEntry: entry,
      status: 'HR missing entry',
      issues: ['HR missing entry'],
      action: 'none'
    });
  });

  return comparisons.sort((a, b) => a.date.localeCompare(b.date));
};

export const buildEntryUpdateFromHrRow = (hrRow, existingEntry = {}) => {
  if (!hrRow) return null;

  if (hrRow.type === 'Regular') {
    return {
      ...existingEntry,
      date: hrRow.date,
      type: 'Regular',
      intervals: [{
        in: normalizeTimeValue(hrRow.checkIn),
        out: normalizeTimeValue(hrRow.checkOut)
      }],
      notes: existingEntry.notes || ''
    };
  }

  return {
    ...existingEntry,
    date: hrRow.date,
    type: hrRow.type,
    intervals: [],
    duration: existingEntry.duration ?? 1,
    notes: existingEntry.notes || ''
  };
};

export const createBlankWorkRow = () => createWorkRow({
  id: `manual-work-${Date.now()}`,
  date: '',
  checkIn: '',
  checkOut: '',
  hrDuration: '',
  hrOvertime: '',
  rawText: 'Manual row',
  confidence: null
});

export const createBlankDayOffRow = () => createDayOffRow({
  id: `manual-dayoff-${Date.now()}`,
  date: '',
  type: 'Holiday',
  rawText: 'Manual day off',
  confidence: null
});
