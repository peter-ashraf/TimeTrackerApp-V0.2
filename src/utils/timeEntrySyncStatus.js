const PENDING_TIME_ENTRY_SYNC_PREFIX = "pendingTimeEntrySync_";
const SYNC_STATUS_EVENT = "time-entry-sync-status-changed";

const normalizeDateKey = (date) => {
  if (!date) return "";
  return String(date).split("T")[0].trim();
};

const normalizeEntries = (entries) => {
  const list = Array.isArray(entries) ? entries : [entries];
  return list
    .map((entry) => {
      if (typeof entry === "string") return normalizeDateKey(entry);
      return normalizeDateKey(entry?.date);
    })
    .filter(Boolean);
};

const emitSyncStatusChange = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT));
};

export const getPendingTimeEntrySyncKey = (userId) =>
  `${PENDING_TIME_ENTRY_SYNC_PREFIX}${userId}`;

export const readPendingTimeEntrySync = (userId) => {
  if (!userId || typeof localStorage === "undefined") return [];

  try {
    const stored = localStorage.getItem(getPendingTimeEntrySyncKey(userId));
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => {
        if (typeof item === "string") {
          return {
            date: normalizeDateKey(item),
            reason: "local",
            updatedAt: null,
          };
        }

        return {
          date: normalizeDateKey(item?.date),
          reason: item?.reason || "local",
          updatedAt: item?.updatedAt || null,
        };
      })
      .filter((item) => item.date);
  } catch (error) {
    return [];
  }
};

export const markPendingTimeEntrySync = (
  userId,
  entries,
  reason = "local",
) => {
  if (!userId || typeof localStorage === "undefined") return;

  const dates = normalizeEntries(entries);
  if (dates.length === 0) return;

  const existing = readPendingTimeEntrySync(userId);
  const byDate = new Map(existing.map((item) => [item.date, item]));
  const updatedAt = new Date().toISOString();

  dates.forEach((date) => {
    byDate.set(date, {
      date,
      reason,
      updatedAt,
    });
  });

  localStorage.setItem(
    getPendingTimeEntrySyncKey(userId),
    JSON.stringify(Array.from(byDate.values())),
  );
  emitSyncStatusChange();
};

export const clearPendingTimeEntrySync = (userId, entries) => {
  if (!userId || typeof localStorage === "undefined") return;

  const dates = normalizeEntries(entries);
  if (dates.length === 0) return;

  const datesToClear = new Set(dates);
  const remaining = readPendingTimeEntrySync(userId).filter(
    (item) => !datesToClear.has(item.date),
  );

  if (remaining.length > 0) {
    localStorage.setItem(
      getPendingTimeEntrySyncKey(userId),
      JSON.stringify(remaining),
    );
  } else {
    localStorage.removeItem(getPendingTimeEntrySyncKey(userId));
  }

  emitSyncStatusChange();
};

export const getPendingTimeEntrySyncStatus = (userId) => {
  const items = readPendingTimeEntrySync(userId);

  return {
    pending: items.length,
    dates: items.map((item) => item.date),
    items,
  };
};

export const getInferredPendingTimeEntries = (entries = []) => {
  if (!Array.isArray(entries)) return [];

  return entries
    .filter((entry) => entry?.date && !entry?.id)
    .map((entry) => ({
      date: normalizeDateKey(entry.date),
      reason: "local_entry_without_cloud_id",
      updatedAt: entry.lastModified || null,
    }));
};

export const mergePendingTimeEntrySync = (storedStatus, inferredItems) => {
  const byDate = new Map();

  [...(storedStatus?.items || []), ...(inferredItems || [])].forEach((item) => {
    if (!item?.date) return;
    byDate.set(normalizeDateKey(item.date), {
      ...item,
      date: normalizeDateKey(item.date),
    });
  });

  const items = Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date),
  );

  return {
    pending: items.length,
    dates: items.map((item) => item.date),
    items,
  };
};

export { SYNC_STATUS_EVENT };
