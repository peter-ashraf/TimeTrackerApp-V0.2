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

export const buildTimeEntrySyncPlan = ({ localEntries = [], remoteEntries = [] }) => {
  const localMap = new Map(localEntries.map((entry) => [normalizeDateKey(entry.date), entry]));
  const remoteMap = new Map(remoteEntries.map((entry) => [normalizeDateKey(entry.date), entry]));

  const entriesToUpload = [];
  const finalEntries = [];
  const conflicts = [];
  let pulledCount = 0;

  for (const [date, remoteEntry] of remoteMap) {
    const localEntry = localMap.get(date);

    if (!localEntry) {
      finalEntries.push(remoteEntry);
      pulledCount += 1;
    } else if (timeEntriesAreDifferent(localEntry, remoteEntry)) {
      conflicts.push({
        entryId: remoteEntry.id || localEntry.id,
        date,
        localEntry,
        remoteEntry,
      });
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
