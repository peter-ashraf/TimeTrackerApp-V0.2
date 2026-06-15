import {
  clearPendingTimeEntrySync,
  markPendingTimeEntrySync,
} from "./timeEntrySyncStatus.js";

export const normalizeSavedTimeEntry = (saved) =>
  Array.isArray(saved) ? saved[0] : saved;

export const syncTimeEntryToCloud = async ({
  userId,
  entry,
  saveTimeEntry,
  pendingReason = "upload_failed",
}) => {
  if (!userId || !entry || typeof saveTimeEntry !== "function") {
    throw new Error("Missing time entry sync requirements");
  }

  try {
    const saved = await saveTimeEntry(userId, entry);
    const returnedEntry = normalizeSavedTimeEntry(saved);
    clearPendingTimeEntrySync(userId, entry);

    return {
      success: true,
      returnedEntry,
    };
  } catch (error) {
    markPendingTimeEntrySync(userId, entry, pendingReason);

    return {
      success: false,
      error,
    };
  }
};
