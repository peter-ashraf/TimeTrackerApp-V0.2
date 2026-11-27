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

export const parseIntervals = (raw) => {
  let parsed = raw;
  let depth = 0;

  while (typeof parsed === "string" && depth < 3) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
    depth += 1;
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      ...item,
      in: item?.in || null,
      out: item?.out || null,
    }));
};

export const hasOpenInterval = (intervals) =>
  parseIntervals(intervals).some((interval) => Boolean(interval?.in) && !interval?.out);

export const normalizeIntervals = (intervals) => {
  const parsedIntervals = parseIntervals(intervals);

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

export const isRemoteProgressionOfLocal = (localEntry, remoteEntry) => {
  if (!timeEntriesAreDifferent(localEntry, remoteEntry)) return false;

  const localType = localEntry?.type || "Regular";
  const remoteType = remoteEntry?.type || "Regular";
  const localNotes = (localEntry?.notes || "").trim();
  const remoteNotes = (remoteEntry?.notes || "").trim();
  const localDuration = localEntry?.duration || 1;
  const remoteDuration = remoteEntry?.duration || 1;
  const localDouble = !!(localEntry?.doubleHours || localEntry?.double_hours);
  const remoteDouble = !!(remoteEntry?.doubleHours || remoteEntry?.double_hours);

  if (
    localType !== remoteType ||
    localNotes !== remoteNotes ||
    localDuration !== remoteDuration ||
    localDouble !== remoteDouble
  ) {
    return false;
  }

  const localIntervals = normalizeIntervals(localEntry?.intervals);
  const remoteIntervals = normalizeIntervals(remoteEntry?.intervals);

  if (localIntervals.length === 0 || remoteIntervals.length < localIntervals.length) {
    return false;
  }

  for (let i = 0; i < localIntervals.length; i += 1) {
    const localItem = localIntervals[i];
    const remoteItem = remoteIntervals[i];
    const isLastLocal = i === localIntervals.length - 1;

    if (!isLastLocal) {
      if (
        !localItem.in ||
        !localItem.out ||
        localItem.in !== remoteItem.in ||
        localItem.out !== remoteItem.out
      ) {
        return false;
      }
    } else {
      if (!localItem.in || localItem.in !== remoteItem.in) {
        return false;
      }

      if (localItem.out) {
        if (localItem.out !== remoteItem.out || remoteIntervals.length <= localIntervals.length) {
          return false;
        }
      } else if (!remoteItem.out) {
        return false;
      }
    }
  }

  return true;
};

export const normalizeRemoteEntry = (remoteEntry) => {
  if (!remoteEntry) return remoteEntry;
  const parsedIntervals = parseIntervals(remoteEntry.intervals);
  const openInterval = hasOpenInterval(parsedIntervals);

  if (
    Array.isArray(remoteEntry.intervals) &&
    !openInterval &&
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
    intervals: parsedIntervals,
  };

  if (openInterval) {
    result.hoursWorked = 0;
  } else if (remoteEntry.hours_worked != null && result.hoursWorked === undefined) {
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

export const buildTimeEntrySyncPlan = ({
  localEntries = [],
  remoteEntries = [],
  pendingSyncDates = [],
}) => {
  const localMap = new Map(localEntries.map((entry) => [normalizeDateKey(entry.date), entry]));
  const remoteMap = new Map(remoteEntries.map((entry) => [normalizeDateKey(entry.date), entry]));
  const pendingSet = new Set((pendingSyncDates || []).map(normalizeDateKey).filter(Boolean));

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
      const hasPendingLocalEdit = pendingSet.has(date);
      const isProgression = !hasPendingLocalEdit && isRemoteProgressionOfLocal(localEntry, remoteEntry);

      if ((remoteTime > 0 && remoteTime > localTime + 2000 && !hasPendingLocalEdit) || isProgression) {
        // Remote is newer or a direct continuation of the day's sessions, auto-resolve to remote
        finalEntries.push({ ...remoteEntry });
        pulledCount += 1;
      } else if (localTime > 0 && localTime > remoteTime + 2000 && !isProgression) {
        // Local is newer, auto-resolve to local
        finalEntries.push(localEntry);
        entriesToUpload.push(localEntry);
      } else {
        // Genuine conflict, or timestamps are missing/too close
        conflicts.push({
          entryId: remoteEntry.id || localEntry.id,
          date,
          localEntry,
          remoteEntry,
        });
      }
    } else {
      finalEntries.push({
        ...localEntry,
        id: remoteEntry.id,
        ...(remoteEntry.updated_at ? { updated_at: remoteEntry.updated_at } : {}),
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

const buildDeleteMap = (pendingDeletes = [], localMap = new Map()) => {
  const deleteMap = new Map();
  (pendingDeletes || []).forEach((item) => {
    const date = normalizeDateKey(typeof item === "string" ? item : item?.date);
    if (!date || localMap.has(date)) return;
    deleteMap.set(date, typeof item === "string" ? { date, id: null, deletedAt: null } : { ...item, date });
  });
  return deleteMap;
};

/**
 * Plan a Sync to Cloud (Push) operation.
 * Never overwrites divergent cloud entries or deletes cloud records modified after local deletion.
 */
export const buildPushTimeEntryPlan = ({
  localEntries = [],
  remoteEntries = [],
  pendingDeletes = [],
}) => {
  const localMap = new Map(localEntries.map((entry) => [normalizeDateKey(entry.date), entry]));
  const remoteMap = new Map(
    remoteEntries.map((entry) => [normalizeDateKey(entry.date), normalizeRemoteEntry(entry)]),
  );
  const deleteMap = buildDeleteMap(pendingDeletes, localMap);

  const finalEntries = [];
  const entriesToUpload = [];
  const entriesToDeleteFromCloud = [];
  const resolvedDeleteDates = [];
  const conflicts = [];
  let alreadySyncedCount = 0;
  let remoteOnlyCount = 0;

  for (const [date, localEntry] of localMap) {
    const remoteEntry = remoteMap.get(date);
    if (!remoteEntry) {
      finalEntries.push(localEntry);
      entriesToUpload.push(localEntry);
    } else if (timeEntriesAreDifferent(localEntry, remoteEntry)) {
      conflicts.push({
        entryId: remoteEntry.id || localEntry.id || date,
        date,
        localEntry,
        remoteEntry,
      });
    } else {
      finalEntries.push({
        ...localEntry,
        id: remoteEntry.id,
      });
      alreadySyncedCount += 1;
    }
  }

  for (const [date, deleteItem] of deleteMap) {
    const remoteEntry = remoteMap.get(date);
    if (!remoteEntry) {
      resolvedDeleteDates.push(date);
      continue;
    }

    const remoteTime = new Date(remoteEntry.updated_at || remoteEntry.lastModified || 0).getTime();
    const deletedAtTime = new Date(deleteItem.deletedAt || 0).getTime();

    if (deletedAtTime > 0 && remoteTime > deletedAtTime + 1000) {
      conflicts.push({
        entryId: remoteEntry.id || date,
        date,
        localEntry: {
          date,
          intervals: [],
          type: "Deleted",
          notes: "(Deleted locally)",
          _isDeleted: true,
        },
        remoteEntry,
      });
    } else {
      entriesToDeleteFromCloud.push(remoteEntry);
    }
  }

  for (const date of remoteMap.keys()) {
    if (!localMap.has(date) && !deleteMap.has(date)) {
      remoteOnlyCount += 1;
    }
  }

  return {
    finalEntries,
    entriesToUpload,
    entriesToDeleteFromCloud,
    resolvedDeleteDates,
    conflicts,
    alreadySyncedCount,
    remoteOnlyCount,
  };
};

/**
 * Plan a Sync from Cloud (Pull) operation.
 * Preserves unuploaded local-only entries and triggers conflicts whenever local data diverges.
 */
export const buildPullTimeEntryPlan = ({
  localEntries = [],
  remoteEntries = [],
  pendingSyncDates = [],
  pendingDeletes = [],
}) => {
  const localMap = new Map(localEntries.map((entry) => [normalizeDateKey(entry.date), entry]));
  const remoteMap = new Map(
    remoteEntries.map((entry) => [normalizeDateKey(entry.date), normalizeRemoteEntry(entry)]),
  );
  const pendingSet = new Set((pendingSyncDates || []).map(normalizeDateKey).filter(Boolean));
  const deleteMap = buildDeleteMap(pendingDeletes, localMap);

  const finalEntries = [];
  const conflicts = [];
  let pulledCount = 0;
  let preservedLocalCount = 0;

  for (const [date, remoteEntry] of remoteMap) {
    const localEntry = localMap.get(date);

    if (!localEntry) {
      if (deleteMap.has(date)) {
        conflicts.push({
          entryId: remoteEntry.id || date,
          date,
          localEntry: {
            date,
            intervals: [],
            type: "Deleted",
            notes: "(Deleted locally)",
            _isDeleted: true,
          },
          remoteEntry,
        });
      } else {
        finalEntries.push(remoteEntry);
        pulledCount += 1;
      }
    } else if (timeEntriesAreDifferent(localEntry, remoteEntry)) {
      const localTime = new Date(localEntry.lastModified || localEntry.updated_at || 0).getTime();
      const remoteTime = new Date(remoteEntry.updated_at || remoteEntry.lastModified || 0).getTime();
      const hasPendingLocalEdit = pendingSet.has(date);

      if (
        !hasPendingLocalEdit &&
        ((remoteTime > 0 && remoteTime > localTime + 2000) ||
          isRemoteProgressionOfLocal(localEntry, remoteEntry))
      ) {
        finalEntries.push({ ...remoteEntry });
        pulledCount += 1;
      } else {
        conflicts.push({
          entryId: remoteEntry.id || localEntry.id || date,
          date,
          localEntry,
          remoteEntry,
        });
      }
    } else {
      finalEntries.push({
        ...localEntry,
        ...remoteEntry,
        id: remoteEntry.id,
      });
    }
  }

  for (const [date, localEntry] of localMap) {
    if (!remoteMap.has(date)) {
      if (!localEntry.id || pendingSet.has(date)) {
        finalEntries.push(localEntry);
        preservedLocalCount += 1;
      } else {
        conflicts.push({
          entryId: localEntry.id || date,
          date,
          localEntry,
          remoteEntry: {
            id: null,
            date,
            intervals: [],
            type: "Deleted",
            notes: "(Not in cloud)",
            _isMissingRemote: true,
          },
        });
      }
    }
  }

  return {
    finalEntries,
    conflicts,
    pulledCount,
    preservedLocalCount,
  };
};
