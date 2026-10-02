import { normalizeDateKey } from './timeEntrySyncPlanner.js';

/**
 * Pay periods exist in two shapes: { start, end } (local/import) and
 * { start_date, end_date } (Supabase / Settings). Accept both.
 */
export const getPeriodBounds = (period) => ({
  start: normalizeDateKey(period?.start ?? period?.start_date),
  end: normalizeDateKey(period?.end ?? period?.end_date),
});

/**
 * Pure planner for the Excel import. Guarantees:
 *  - one entry per date in the result (no duplicates, even if the file or the
 *    current list already contains duplicates),
 *  - entries outside the chosen period are never touched,
 *  - file rows outside the chosen period are skipped (and counted),
 *  - an imported row keeps the database id of the entry it replaces, so cloud
 *    saves update that row and later deletes can find it.
 *
 * mode 'merge':   imported rows replace/add by date, other entries stay.
 * mode 'replace': every existing entry inside the period is removed (and
 *                 reported in `toDelete`) unless the file has that date.
 */
export function planImport({ existingEntries = [], importedEntries = [], period, mode = 'merge', now = new Date() }) {
  const { start, end } = getPeriodBounds(period);
  if (!start || !end) throw new Error('Import period needs a start and end date');

  const inPeriod = (date) => date >= start && date <= end;
  const nowIso = now.toISOString();

  // Collapse existing entries to one per date, preferring one that has an id.
  const existingByDate = new Map();
  for (const entry of existingEntries) {
    const date = normalizeDateKey(entry.date);
    if (!date) continue;
    const current = existingByDate.get(date);
    if (!current || (!current.id && entry.id)) {
      existingByDate.set(date, { ...entry, date });
    }
  }

  // Imported rows: keep only those inside the period, last row per date wins.
  const importedByDate = new Map();
  let skippedOutsidePeriod = 0;
  let duplicateRowsInFile = 0;
  for (const entry of importedEntries) {
    const date = normalizeDateKey(entry.date);
    if (!date) continue;
    if (!inPeriod(date)) {
      skippedOutsidePeriod += 1;
      continue;
    }
    if (importedByDate.has(date)) duplicateRowsInFile += 1;
    const replaced = existingByDate.get(date);
    importedByDate.set(date, {
      ...entry,
      date,
      ...(replaced?.id ? { id: replaced.id } : {}),
      lastModified: nowIso,
    });
  }

  const finalByDate = new Map();
  const toDelete = [];

  for (const [date, entry] of existingByDate) {
    if (!inPeriod(date)) {
      finalByDate.set(date, entry); // outside the period: never touched
    } else if (mode === 'merge') {
      finalByDate.set(date, entry);
    } else if (!importedByDate.has(date)) {
      toDelete.push({ id: entry.id ?? null, date });
    }
  }
  for (const [date, entry] of importedByDate) finalByDate.set(date, entry);

  const finalEntries = [...finalByDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  return {
    finalEntries,
    toSave: [...importedByDate.values()],
    toDelete,
    skippedOutsidePeriod,
    duplicateRowsInFile,
  };
}
