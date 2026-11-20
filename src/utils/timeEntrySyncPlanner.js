export const normalizeDateKey = (date) => {
  if (!date) return "";
  return String(date).split("T")[0].trim();
};

export const normalizeTimeValue = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";

  if (text.includes("T") || text.includes("Z")) {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toTimeString().split(" ")[0];
    }
  }

  const parts = text.split(":");
  if (parts.length === 2) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:00`;
  }
  if (parts.length >= 3) {
    return `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
  }
  return text;
};

export const normalizeIntervals = (intervals) => {
  let parsedIntervals = intervals;

  if (typeof parsedIntervals === "string") {
    try {
      parsedIntervals = JSON.parse(parsedIntervals);
    } catch (error) {
      parsedIntervals = [];
    }
  }

  if (!Array.isArray(parsedIntervals)) return [];

  return parsedIntervals.map((interval) => ({
    in: normalizeTimeValue(interval?.in),
    out: normalizeTimeValue(interval?.out),
  }));
};

export const timeEntriesAreDifferent = (localEntry, remoteEntry) => {
  const localType = localEntry?.type || "Regular";
  const remoteType = remoteEntry?.type || "Regular";

  const localIntervals = JSON.stringify(normalizeIntervals(localEntry?.intervals));
  const remoteIntervals = JSON.stringify(normalizeIntervals(remoteEntry?.intervals));

  const localNotes = (localEntry?.notes || "").trim();
  const remoteNotes = (remoteEntry?.notes || "").trim();

  const localDuration = localEntry?.duration || 1;
  const remoteDuration = remoteEntry?.duration || 1;

  const localDouble = !!(localEntry?.doubleHours || localEntry?.double_hours);
  const remoteDouble = !!(remoteEntry?.doubleHours || remoteEntry?.double_hours);

  return (
    localType !== remoteType ||
    localIntervals !== remoteIntervals ||
    localNotes !== remoteNotes ||
    localDuration !== remoteDuration ||
    localDouble !== remoteDouble
  );
};

export const normalizeRemoteEntry = (remoteEntry) => {
  if (!remoteEntry) return remoteEntry;
  let parsedIntervals = remoteEntry.intervals;
  if (typeof parsedIntervals === "string") {
    try {
      parsedIntervals = JSON.parse(parsedIntervals);
    } catch {
      parsedIntervals = [];
    }
  }

  if (
    Array.isArray(remoteEntry.intervals) &&
    remoteEntry.hours_worked === undefined &&
    remoteEntry.extra_hours === undefined &&
    remoteEntry.extra_hours_with_factor === undefined &&
    remoteEntry.hours_spent_outside === undefined &&
    remoteEntry.double_hours === undefined
  ) {
    return remoteEntry;
  }

  const result = {
    ...remoteEntry,
    intervals: Array.isArray(parsedIntervals) ? parsedIntervals : (remoteEntry.intervals || []),
  };

  if (remoteEntry.hours_worked != null && result.hoursWorked === undefined) {
    result.hoursWorked = parseFloat(remoteEntry.hours_worked);
  }
  if (remoteEntry.extra_hours != null && result.extraHours === undefined) {
    result.extraHours = parseFloat(remoteEntry.extra_hours);
  }
  if (remoteEntry.extra_hours_with_factor != null && result.extraHoursWithFactor === undefined) {
    result.extraHoursWithFactor = parseFloat(remoteEntry.extra_hours_with_factor);
  }
  if (remoteEntry.hours_spent_outside != null && result.hoursSpentOutside === undefined) {
    result.hoursSpentOutside = parseFloat(remoteEntry.hours_spent_outside);
  }
  if (remoteEntry.double_hours != null && result.doubleHours === undefined) {
    result.doubleHours = Boolean(remoteEntry.double_hours);
  }

  return result;
};

export const buildTimeEntrySyncPlan = ({ localEntries = [], remoteEntries = [] }) => {
  const localMap = new Map(localEntries.map((entry) => [normalizeDateKey(entry.date), entry]));
  const remoteMap = new Map(remoteEntries.map((entry) => [normalizeDateKey(entry.date), entry]));

  const entriesToUpload = [];
  const finalEntries = [];
  const conflicts = [];
  let pulledCount = 0;

  for (const [date, rawRemoteEntry] of remoteMap) {
    const remoteEntry = normalizeRemoteEntry(rawRemoteEntry);
    const localEntry = localMap.get(date);

    if (!localEntry) {
      finalEntries.push(remoteEntry);
      pulledCount += 1;
    } else if (timeEntriesAreDifferent(localEntry, remoteEntry)) {
      const localTime = new Date(localEntry.lastModified || localEntry.updated_at || 0).getTime();
      const remoteTime = new Date(remoteEntry.updated_at || remoteEntry.lastModified || 0).getTime();

      if (remoteTime > localTime + 2000) {
        // Remote is newer, auto-resolve to remote
        finalEntries.push({ ...remoteEntry });
        pulledCount += 1;
      } else if (localTime > remoteTime + 2000) {
        // Local is newer, auto-resolve to local
        finalEntries.push(localEntry);
        entriesToUpload.push(localEntry);
      } else {
        // Genuine conflict, or timestamps are missing/too close
        conflicts.push({
          entryId: rawRemoteEntry.id || localEntry.id,
          date,
          localEntry,
          remoteEntry: rawRemoteEntry,
        });
      }
    } else {
      finalEntries.push({
        ...localEntry,
        id: remoteEntry.id,
      });
    }
  }

  for (const [date, localEntry] of localMap) {
    if (!remoteMap.has(date)) {
      finalEntries.push(localEntry);
      entriesToUpload.push(localEntry);
    }
  }

  return {
    finalEntries,
    conflicts,
    entriesToUpload,
    pulledCount,
  };
};
