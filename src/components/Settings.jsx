import React, { useState, useEffect, useCallback, useMemo } from "react";
import ConfirmModal from "./ConfirmModal";
import { useTimeTracker } from "../context/TimeTrackerContext";
import { useSupabaseAuth, supabase } from "../context/SupabaseAuthContext";
import { usePayPeriod } from "../context/PayPeriodContext";
import { supabaseData } from "../utils/supabaseData";
import hapticFeedback from "../utils/hapticFeedback";
import cacheManager from "../utils/cacheManager";
import { backgroundSync } from "../utils/backgroundSync";
import { offlineQueue } from "../utils/offlineQueue";
const ExportModal = React.lazy(() => import("./ExportModal"));
const ImportModal = React.lazy(() => import("./ImportModal"));
import ModalShell, { useSheetClose } from "./ModalShell";
import AlertModal from "./AlertModal";
import ConflictResolutionModal from "./ConflictResolutionModal";
import { setSimpleEncryptedItem } from "../utils/simple-encryption";
import { useUserPreferences } from "../context/UserPreferencesContext";
import { notificationManager } from "../utils/notificationManager";
import CustomSelect from "./CustomSelect";
import {
  clearPendingTimeEntrySync,
  getPendingTimeEntrySyncStatus,
} from "../utils/timeEntrySyncStatus";
// Defined locally to avoid a cross-chunk named-export that fails in some bundler configurations.
// Must match the string dispatched by timeEntrySyncStatus.js.
const SYNC_STATUS_EVENT = "time-entry-sync-status-changed";
import '../styles/settings.css';
import './bento-settings.css';

const SETTINGS_TABS = [
  { id: "profile", label: "Profile", icon: "fa-user" },
  { id: "reminders", label: "Reminders", icon: "fa-bell" },
  { id: "periods", label: "Periods", icon: "fa-calendar-days" },
  { id: "data", label: "Data", icon: "fa-database" },
  { id: "advanced", label: "Advanced", icon: "fa-screwdriver-wrench" },
];

const IS_DEV_MODE = import.meta.env.DEV;
const REMINDER_COUNT_PRESETS = ["1", "2", "3", "4", "5"];
const REMINDER_INTERVAL_PRESETS = ["5", "10", "15", "30"];
const REMINDER_SAVE_TIMEOUT_MS = 12000;
const SETTINGS_SAVE_TIMEOUT_MS = 20000;
const MANUAL_SYNC_TIMEOUT_MS = 35000;

const withTimeout = (promise, timeoutMs, message) =>
  new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });

const getLeaveSettingsUpdatedAtKey = (userId) =>
  `leaveSettingsUpdatedAt_${userId}`;

const normalizeReminderTime = (value, fallback = "09:00") => {
  if (typeof value !== "string") return fallback;
  const match = value.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : fallback;
};

const getPresetOrCustomValue = (value, presets, fallback) => {
  const normalized = String(value ?? fallback);
  return presets.includes(normalized) ? normalized : "custom";
};

const getNumericString = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : fallback;
};

const DEV_SAMPLE_CONFLICTS = [
  {
    entryId: "dev-conflict-2026-06-08",
    date: "2026-06-08",
    localEntry: {
      id: "local-dev-2026-06-08",
      date: "2026-06-08",
      intervals: [{ in: "09:51:37", out: "" }],
      notes: "Checked in offline from the phone.",
    },
    remoteEntry: {
      id: "remote-dev-2026-06-08",
      date: "2026-06-08",
      intervals: [{ in: "09:51:37", out: "19:02:09" }],
      notes: "Online entry has checkout from another device.",
    },
  },
  {
    entryId: "dev-conflict-2026-06-09",
    date: "2026-06-09",
    localEntry: {
      id: "local-dev-2026-06-09",
      date: "2026-06-09",
      intervals: [
        { in: "09:03:00", out: "13:05:00" },
        { in: "13:54:00", out: "18:20:00" },
      ],
      notes: "Local edit includes a longer lunch break.",
    },
    remoteEntry: {
      id: "remote-dev-2026-06-09",
      date: "2026-06-09",
      intervals: [
        { in: "09:00:00", out: "13:10:00" },
        { in: "13:40:00", out: "18:10:00" },
      ],
      notes: "Online edit came from desktop.",
    },
  },
  {
    entryId: "dev-conflict-2026-06-10",
    date: "2026-06-10",
    localEntry: {
      id: "local-dev-2026-06-10",
      date: "2026-06-10",
      intervals: [{ in: "10:15:00", out: "16:45:00" }],
      notes: "Marked as sick leave locally.",
    },
    remoteEntry: {
      id: "remote-dev-2026-06-10",
      date: "2026-06-10",
      intervals: [{ in: "09:30:00", out: "18:30:00" }],
      notes: "Online version has a normal work day.",
    },
  },
];

const getDevSampleConflicts = (count) => {
  const safeCount = Math.max(1, Math.min(20, count || 1));
  const startDate = new Date("2026-06-08T00:00:00");

  return Array.from({ length: safeCount }, (_, index) => {
    const source = DEV_SAMPLE_CONFLICTS[index % DEV_SAMPLE_CONFLICTS.length];
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    const dateString = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");

    return {
      ...source,
      entryId: `dev-conflict-${dateString}`,
      date: dateString,
      localEntry: {
        ...source.localEntry,
        id: `local-dev-${dateString}`,
        date: dateString,
      },
      remoteEntry: {
        ...source.remoteEntry,
        id: `remote-dev-${dateString}`,
        date: dateString,
      },
    };
  });
};

const getStoredQueueLength = (key) => {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return 0;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch (error) {
    return 0;
  }
};

const getSyncStatusSnapshot = (currentUser, entries) => {
  const backgroundStatus = backgroundSync.getStatus();
  const offlineStatus = offlineQueue.getStatus();
  const appSaveQueue = getStoredQueueLength("dbSaveQueue");
  const timeEntrySync = getPendingTimeEntrySyncStatus(currentUser?.id);

  return {
    isOnline: navigator.onLine,
    isSyncing:
      backgroundStatus.isSyncing ||
      backgroundStatus.syncInProgress ||
      offlineStatus.isProcessing,
    backgroundQueue: Math.max(
      backgroundStatus.queueLength || 0,
      backgroundStatus.queueStatus?.pending || 0,
      timeEntrySync.pending,
    ),
    appSaveQueue,
    offlineQueue: offlineStatus,
    timeEntrySync,
    checkedAt: new Date(),
  };
};

// Validation helper
const validateEmployeeData = (
  name,
  salary,
  annualVacation,
  sickDays,
  employeeType,
  dailyHours,
  workDaysPerWeek,
  monthlyHours,
) => {
  const errors = [];

  // Validate name (optional - user may not have set one yet)
  if (name && name.trim().length > 0 && name.trim().length < 2) {
    errors.push("Employee name must be at least 2 characters");
  }

  // Validate salary
  if (isNaN(salary)) {
    errors.push("Salary must be a valid number");
  } else if (salary < 0) {
    errors.push("Salary cannot be negative");
  } else if (salary > 10000000) {
    errors.push("Salary seems unrealistically high (max 10,000,000)");
  }

  // Validate annual vacation
  if (isNaN(annualVacation)) {
    errors.push("Annual vacation days must be a valid number");
  } else if (annualVacation < 0) {
    errors.push("Annual vacation days cannot be negative");
  } else if (annualVacation > 365) {
    errors.push("Annual vacation days cannot exceed 365");
  }

  // Validate sick days
  if (isNaN(sickDays)) {
    errors.push("Sick days must be a valid number");
  } else if (sickDays < 0) {
    errors.push("Sick days cannot be negative");
  } else if (sickDays > 365) {
    errors.push("Sick days cannot exceed 365");
  }

  // Validate employee type
  if (!employeeType || !["full-time", "part-time"].includes(employeeType)) {
    errors.push("Employee type must be either full-time or part-time");
  }

  // Validate daily hours
  if (employeeType === "part-time") {
    if (!dailyHours || dailyHours < 6 || dailyHours > 9) {
      errors.push("Part-time daily hours must be between 6 and 9");
    }
  } else {
    if (dailyHours && dailyHours !== 9) {
      errors.push("Full-time daily hours must be 9");
    }
  }

  // Validate work days per week
  if (employeeType === "part-time") {
    if (!workDaysPerWeek || workDaysPerWeek < 3 || workDaysPerWeek > 5) {
      errors.push("Part-time work days must be between 3 and 5");
    }
  } else {
    if (workDaysPerWeek && workDaysPerWeek !== 5) {
      errors.push("Full-time work days must be 5");
    }
  }

  // Note: Monthly hours validation removed for part-time employees since it's calculated based on actual hours worked per period

  return errors;
};

const validatePeriodDates = (start, end, existingPeriods, editingId = null) => {
  const errors = [];

  // Check if dates are provided
  if (!start || !end) {
    errors.push("Both start and end dates are required");
    return errors;
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  // Check if start is before end
  if (startDate >= endDate) {
    errors.push("End date must be after start date");
    return errors; // Stop here if dates are reversed
  }

  // FIXED: Calculate duration in days (corrected calculation)
  const durationDays =
    Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;

  // FIXED: Check for reasonable duration (1 to 35 days)
  if (durationDays < 1) {
    errors.push("Period must be at least 1 day long");
  }
  if (durationDays > 35) {
    errors.push(
      `Period cannot exceed 35 days (currently ${durationDays} days)`,
    );
  }

  // Only check overlaps if duration is valid (to avoid confusing error messages)
  if (errors.length > 0) {
    return errors; // Return duration errors first
  }

  // FIXED: Now check for overlaps AFTER duration validation
  const periodsToCheck = existingPeriods.filter((p) => p.id !== editingId);

  for (const period of periodsToCheck) {
    const periodStart = new Date(period.start_date || period.start);
    const periodEnd = new Date(period.end_date || period.end);

    // Check overlap: two periods overlap if one starts before the other ends
    const overlaps = startDate <= periodEnd && endDate >= periodStart;

    if (overlaps) {
      errors.push(`Period overlaps with "${period.label}"`);
      break; // Only show first overlap
    }
  }

  return errors;
};

// ── Animated close helpers (module-level so React keeps a stable identity) ──
// These consume SheetCloseContext to trigger the slide-down animation before
// calling setActiveModal(null). Defining them inside Settings() would give
// them a new component type on every render, breaking context consumption.
function SpokeDoneBtn() {
  const close = useSheetClose();
  return <button type="button" className="spoke-done-btn" onClick={close}>Done</button>;
}
function SpokeCancelBtn() {
  const close = useSheetClose();
  return <button type="button" className="spoke-btn-outline" onClick={close}>Cancel</button>;
}
function SpokeSaveBtn({ onSave, children }) {
  const close = useSheetClose();
  return (
    <button type="button" className="spoke-btn-primary" onClick={(e) => { onSave(e); close(); }}>
      {children ?? 'Save Changes'}
    </button>
  );
}

function Settings() {

  const {
    employee,
    leaveSettings,
    entries,
    periods,
    currentPeriodId,
    hideSalary,
    lastSaved,
    lastRefreshed,
    saveStatus,
    pendingConflicts,
    loadTimeEntriesData,
    setEmployee,
    setLeaveSettings,
    clearAllData,
    confirmModal,
    setConfirmModal,
    setCurrentPeriod,
    setEntries,
    setLastRefreshed,
    validateEmployeeType,
    calculateMonthlyHours,
  } = useTimeTracker();

  const { setPeriods, markPeriodDirty } = usePayPeriod();
  const { reminderSettings, setReminderSettings, userPreferences, updatePreferences } = useUserPreferences();

  // ✅ ADDED: Get auth functions
  const { currentUser, deleteUser, verifyPassword } = useSupabaseAuth();

  // Employee form
  const [name, setName] = useState(employee.name ?? "");
  const [salary, setSalary] = useState(employee.salary ?? 0);
  const [employeeType, setEmployeeType] = useState(
    employee.employeeType ?? "full-time",
  );
  const [dailyHours, setDailyHours] = useState(employee.dailyHours ?? 9);
  const [monthlyHours, setMonthlyHours] = useState(
    employee.monthlyHours ?? 187,
  );
  const [workDaysPerWeek, setWorkDaysPerWeek] = useState(
    employee.workDaysPerWeek ?? 5,
  );
  const [breakStartTime, setBreakStartTime] = useState(
    employee.breakStartTime ?? "13:00",
  );

  // Leave settings form
  const [annualVacation, setAnnualVacation] = useState(
    leaveSettings.annualVacation ?? 10,
  );
  const [sickDays, setSickDays] = useState(leaveSettings.sickDays ?? 7);
  const [leaveInputsDirty, setLeaveInputsDirty] = useState(false);

  // Reminder settings form
  const [remindersEnabled, setRemindersEnabled] = useState(
    reminderSettings?.enabled ?? false,
  );
  const [reminderStartTime, setReminderStartTime] = useState(
    normalizeReminderTime(reminderSettings?.startTime),
  );
  const [reminderCount, setReminderCount] = useState(
    getPresetOrCustomValue(
      getNumericString(reminderSettings?.reminderCount, "3"),
      REMINDER_COUNT_PRESETS,
      "3",
    ),
  );
  const [reminderInterval, setReminderInterval] = useState(
    getPresetOrCustomValue(
      getNumericString(reminderSettings?.intervalMinutes, "15"),
      REMINDER_INTERVAL_PRESETS,
      "15",
    ),
  );
  const [customReminderCount, setCustomReminderCount] = useState(
    getNumericString(reminderSettings?.reminderCount, "3"),
  );
  const [customReminderInterval, setCustomReminderInterval] = useState(
    getNumericString(reminderSettings?.intervalMinutes, "15"),
  );
  const [reminderSaveStatus, setReminderSaveStatus] = useState({
    type: "",
    message: "",
  });
  // Period management
  
  const [activeModal, setActiveModal] = useState(null);

  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [editingPeriodId, setEditingPeriodId] = useState(null);
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");

  // Accordion states
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  // NEW: Export/Import modal states
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Notification feedback modal
  const [notifModal, setNotifModal] = useState({
    isOpen: false,
    isError: false,
    title: "",
    message: "",
  });

  // Test notification modal state
  const [showTestNotifModal, setShowTestNotifModal] = useState(false);
  const [showConflictPreview, setShowConflictPreview] = useState(false);
  const [conflictPreviewCount, setConflictPreviewCount] = useState("3");
  const [testPattern, setTestPattern] = useState("single");
  const [testCount, setTestCount] = useState("1");
  const [testInterval, setTestInterval] = useState("5");
  const [customTestCount, setCustomTestCount] = useState("3");
  const [customTestInterval, setCustomTestInterval] = useState("10");
  const [isNotificationSubscribed, setIsNotificationSubscribed] =
    useState(false);
  const [isNotificationBusy, setIsNotificationBusy] = useState(false);

  // Haptic feedback state
  const [hapticEnabled, setHapticEnabled] = useState(
    hapticFeedback.isEnabled(),
  );

  // Diagnostics state
  const [cacheStatus, setCacheStatus] = useState({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState("profile");
  const [isDangerUnlocked, setIsDangerUnlocked] = useState(false);
  const [dangerPassword, setDangerPassword] = useState("");
  const [dangerUnlockError, setDangerUnlockError] = useState("");
  const [isUnlockingDanger, setIsUnlockingDanger] = useState(false);
  const [isSyncingNow, setIsSyncingNow] = useState(false);
  const [isCheckingVersion, setIsCheckingVersion] = useState(false);
  const [versionCheckStatus, setVersionCheckStatus] = useState("");
  const [pendingUpdateRegistration, setPendingUpdateRegistration] =
    useState(null);
  const [settingCurrentPeriodId, setSettingCurrentPeriodId] = useState(null);
  const [syncStatus, setSyncStatus] = useState(() =>
    getSyncStatusSnapshot(currentUser, entries),
  );
  const appVersion =
    typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.1.0";
  const previewConflictCount = Math.max(
    1,
    Math.min(20, parseInt(conflictPreviewCount, 10) || 1),
  );
  const previewConflicts = useMemo(
    () => getDevSampleConflicts(previewConflictCount),
    [previewConflictCount],
  );

  const refreshSyncStatus = useCallback((entriesOverride = entries) => {
    setSyncStatus(getSyncStatusSnapshot(currentUser, entriesOverride));
  }, [currentUser, entries]);

  const reconcilePendingTimeEntries = useCallback(async (entriesOverride = entries) => {
    if (!currentUser?.id || currentUser.isLocalOnly || !navigator.onLine) {
      return { cleared: 0 };
    }

    const pendingStatus = getPendingTimeEntrySyncStatus(currentUser.id);
    if (!pendingStatus.pending) {
      return { cleared: 0 };
    }

    const remoteEntries = await supabaseData.getTimeEntries(currentUser.id, {
      timeoutMs: 15000,
    });
    const pendingDates = new Set(pendingStatus.dates);
    const entriesToClear = (remoteEntries || []).filter((remoteEntry) => {
      const date = String(remoteEntry?.date || "").split("T")[0];
      return remoteEntry?.id && pendingDates.has(date);
    });

    if (entriesToClear.length > 0) {
      clearPendingTimeEntrySync(currentUser.id, entriesToClear);
    }

    return { cleared: entriesToClear.length };
  }, [currentUser, entries]);

  const handleRefreshSyncStatus = useCallback(async () => {
    hapticFeedback.buttonClick();

    try {
      await reconcilePendingTimeEntries();
    } catch (error) {
      console.warn("Pending time entry reconciliation failed:", error);
    } finally {
      refreshSyncStatus();
    }
  }, [reconcilePendingTimeEntries, refreshSyncStatus]);

  const handleSyncNow = useCallback(async () => {
    hapticFeedback.buttonClick();
    setIsSyncingNow(true);

    try {
      if (!navigator.onLine) {
        refreshSyncStatus();
        setNotifModal({
          isOpen: true,
          isError: false,
          message: "You are offline. Pending changes will upload when the connection returns.",
        });
        return;
      }

      const result = await withTimeout(
        loadTimeEntriesData({
          forceConflictCheck: true,
          waitForCurrentSyncMs: 10000,
        }),
        MANUAL_SYNC_TIMEOUT_MS,
        "Sync took too long. Status has been refreshed; please try again.",
      );
      if (!result?.success) {
        setNotifModal({
          isOpen: true,
          isError: result?.reason !== "already_loading",
          message: result?.message || "Sync failed. Please try again.",
        });
        return;
      }

      setLastRefreshed(new Date().toISOString());
      const entriesForStatus = result.mergedEntries || entries;
      await reconcilePendingTimeEntries(entriesForStatus);
      refreshSyncStatus(entriesForStatus);
      setNotifModal({
        isOpen: true,
        isError: false,
        message: result.message || "Sync completed.",
      });
    } catch (error) {
      try {
        await reconcilePendingTimeEntries();
      } catch (reconcileError) {
        console.warn("Pending time entry reconciliation failed:", reconcileError);
      }
      refreshSyncStatus();
      setNotifModal({
        isOpen: true,
        isError: true,
        message: error.message || "Sync failed. Please try again.",
      });
    } finally {
      setIsSyncingNow(false);
    }
  }, [entries, loadTimeEntriesData, reconcilePendingTimeEntries, refreshSyncStatus, setLastRefreshed]);

  const handleCheckForAppUpdate = useCallback(async () => {
    hapticFeedback.buttonClick();
    setIsCheckingVersion(true);
    setVersionCheckStatus("");

    try {
      if (!("serviceWorker" in navigator)) {
        setVersionCheckStatus("Update checks are not supported in this browser.");
        return;
      }

      if (!import.meta.env.PROD) {
        setVersionCheckStatus("Manual update checks are available in the installed production app.");
        return;
      }

      if (!navigator.onLine) {
        setVersionCheckStatus("You are offline. Connect to the internet and try again.");
        return;
      }

      const registration =
        (await navigator.serviceWorker.getRegistration("/TimeTrackerApp-V0.2/")) ||
        (await navigator.serviceWorker.ready);

      if (!registration) {
        setVersionCheckStatus("No app service worker is registered yet.");
        return;
      }

      await registration.update();

      if (registration.waiting && navigator.serviceWorker.controller) {
        setPendingUpdateRegistration(registration);
        window.dispatchEvent(
          new CustomEvent("app-update-available", {
            detail: { registration },
          }),
        );
        window.dispatchEvent(new Event("app-update-show-prompt"));
        setVersionCheckStatus("New version found. Reload it now or use the reload prompt.");
        return;
      }

      setPendingUpdateRegistration(null);
      setVersionCheckStatus("You are already on the latest available version.");
    } catch (error) {
      setVersionCheckStatus(error.message || "Could not check for updates.");
    } finally {
      setIsCheckingVersion(false);
    }
  }, []);

  const handleReloadAppUpdate = useCallback(async () => {
    hapticFeedback.buttonClick();

    try {
      const registration =
        pendingUpdateRegistration ||
        (await navigator.serviceWorker.getRegistration("/TimeTrackerApp-V0.2/")) ||
        (await navigator.serviceWorker.ready);

      if (registration?.waiting) {
        setVersionCheckStatus("Reloading update...");
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        window.setTimeout(() => {
          window.location.reload();
        }, 1500);
        return;
      }

      window.location.reload();
    } catch (error) {
      setVersionCheckStatus(error.message || "Could not reload the update.");
    }
  }, [pendingUpdateRegistration]);

  const handleOpenExport = () => {
    setShowExportModal(true);
    // Mark that user is attempting to backup
    localStorage.setItem("lastBackupDate", new Date().toISOString());
  };

  // Handle haptic feedback toggle
  const handleHapticToggle = () => {
    const newValue = !hapticEnabled;
    setHapticEnabled(newValue);
    hapticFeedback.setEnabled(newValue);
    if (newValue) {
      hapticFeedback.success(); // Test vibration when enabling
    }
  };

  // Handle test notification
  const handleTestNotification = async () => {
    try {
      let count, interval;

      if (testPattern === "single") {
        count = 1;
        interval = 0;
      } else if (testPattern === "repeating") {
        count = parseInt(testCount, 10);
        interval = parseInt(testInterval, 10);
      } else if (testPattern === "custom") {
        count = parseInt(customTestCount, 10);
        interval = parseInt(customTestInterval, 10);
      }

      const result = await notificationManager.testNotification(testPattern, {
        count,
        interval,
      });

      setNotifModal({
        isOpen: true,
        isError: false,
        message: result.message,
      });
      setShowTestNotifModal(false);
    } catch (err) {
      setNotifModal({
        isOpen: true,
        isError: true,
        message: err.message,
      });
    }
  };

  const refreshNotificationSubscription = useCallback(async () => {
    try {
      const subscribed = await notificationManager.isSubscribed();
      setIsNotificationSubscribed(subscribed);
    } catch (error) {
      console.warn("Failed to read notification subscription status:", error);
      setIsNotificationSubscribed(false);
    }
  }, []);

  const handleTogglePushNotifications = async () => {
    try {
      setIsNotificationBusy(true);

      if (!currentUser) {
        throw new Error("Please log in first");
      }

      if (isNotificationSubscribed) {
        const unsubscribed = await notificationManager.unsubscribeUser(
          currentUser.id,
        );
        await refreshNotificationSubscription();
        setNotifModal({
          isOpen: true,
          isError: false,
          message: unsubscribed
            ? "Push notifications disabled on this device."
            : "No active push subscription was found on this device.",
        });
        return;
      }

      const sub = await notificationManager.subscribeUser(currentUser.id);
      await refreshNotificationSubscription();
      if (sub) {
        setNotifModal({
          isOpen: true,
          isError: false,
          message:
            "Push notifications enabled on this device. Reminder delivery still depends on the server sending scheduled pushes.",
        });
      }
    } catch (err) {
      setNotifModal({
        isOpen: true,
        isError: true,
        message: err.message,
      });
    } finally {
      setIsNotificationBusy(false);
    }
  };

  const handleConflictPreviewResolve = (resolutions) => {
    const localCount = resolutions.filter(
      (resolution) => resolution.choice === "local",
    ).length;
    const remoteCount = resolutions.filter(
      (resolution) => resolution.choice === "remote",
    ).length;

    setShowConflictPreview(false);
    setNotifModal({
      isOpen: true,
      isError: false,
      message: `Preview only: ${localCount} local and ${remoteCount} online choices resolved. No data was saved.`,
    });
  };

  const handleUnlockDangerZone = async (event) => {
    event.preventDefault();
    setDangerUnlockError("");

    try {
      setIsUnlockingDanger(true);
      await withTimeout(
        verifyPassword(dangerPassword),
        10000,
        "Password verification timed out. Please check your connection and try again.",
      );
      setIsDangerUnlocked(true);
      setDangerPassword("");
      hapticFeedback.success();
    } catch (error) {
      setIsDangerUnlocked(false);
      setDangerUnlockError(error.message || "Password could not be verified");
      hapticFeedback.error();
    } finally {
      setIsUnlockingDanger(false);
    }
  };

  const handleLockDangerZone = () => {
    setIsDangerUnlocked(false);
    setDangerPassword("");
    setDangerUnlockError("");
    hapticFeedback.buttonClick();
  };

  // Read cache status (read-only, no modifications)
  const readCacheStatus = async () => {
    const cacheKeys = [
      "timeEntries",
      "payPeriods",
      "currentPeriod",
      "userProfile",
    ];
    const status = {};

    for (const key of cacheKeys) {
      try {
        const data = await cacheManager.getCachedData(key, null);
        const cacheInfo = cacheManager.getCacheStatus()[key];

        if (data && (Array.isArray(data) ? data.length > 0 : data !== null)) {
          const entryCount = Array.isArray(data) ? data.length : "-";
          const lastCached = cacheInfo?.lastCached
            ? formatRelativeTime(new Date(cacheInfo.lastCached))
            : "Unknown";

          status[key] = {
            status: "cached",
            entryCount,
            lastCached,
          };
        } else {
          status[key] = {
            status: "empty",
            entryCount: "-",
            lastCached: "-",
          };
        }
      } catch (error) {
        status[key] = {
          status: "empty",
          entryCount: "-",
          lastCached: "-",
        };
      }
    }

    setCacheStatus(status);
  };

  // Format relative time (e.g., "2 mins ago", "1 hour ago")
  const formatRelativeTime = (date) => {
    if (!date) return "-";
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  // Load cache status when Settings page opens
  useEffect(() => {
    if (IS_DEV_MODE) {
      readCacheStatus();
    }
  }, []);

  useEffect(() => {
    setIsDangerUnlocked(false);
    setDangerPassword("");
    setDangerUnlockError("");
  }, [currentUser?.id]);

  useEffect(() => {
    let isMounted = true;
    const updateStatus = () => {
      if (isMounted) refreshSyncStatus();
    };

    offlineQueue.init().finally(updateStatus);
    updateStatus();

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    window.addEventListener(SYNC_STATUS_EVENT, updateStatus);
    window.addEventListener("storage", updateStatus);
    backgroundSync.addListener(updateStatus);
    offlineQueue.addListener(updateStatus);

    const intervalId = window.setInterval(updateStatus, 30000);

    return () => {
      isMounted = false;
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
      window.removeEventListener(SYNC_STATUS_EVENT, updateStatus);
      window.removeEventListener("storage", updateStatus);
      backgroundSync.removeListener(updateStatus);
      offlineQueue.removeListener(updateStatus);
      window.clearInterval(intervalId);
    };
  }, [refreshSyncStatus]);

  useEffect(() => {
    setName(employee.name ?? "");
    setSalary(employee.salary ?? 0);
    setEmployeeType(employee.employeeType ?? "full-time");
    setDailyHours(employee.dailyHours ?? 9);
    setMonthlyHours(employee.monthlyHours ?? 187);
    setWorkDaysPerWeek(employee.workDaysPerWeek ?? 5);
    setBreakStartTime(employee.breakStartTime ?? "13:00");
  }, [employee]);

  useEffect(() => {
    if (leaveInputsDirty) return;
    setAnnualVacation(leaveSettings.annualVacation ?? 10);
    setSickDays(leaveSettings.sickDays ?? 7);
  }, [leaveSettings, leaveInputsDirty]);

  useEffect(() => {
    if (reminderSettings) {
      const reminderCountValue = getNumericString(
        reminderSettings.reminderCount,
        "3",
      );
      const reminderIntervalValue = getNumericString(
        reminderSettings.intervalMinutes,
        "15",
      );

      setRemindersEnabled(reminderSettings.enabled ?? false);
      setReminderStartTime(normalizeReminderTime(reminderSettings.startTime));
      setReminderCount(
        getPresetOrCustomValue(reminderCountValue, REMINDER_COUNT_PRESETS, "3"),
      );
      setReminderInterval(
        getPresetOrCustomValue(
          reminderIntervalValue,
          REMINDER_INTERVAL_PRESETS,
          "15",
        ),
      );
      setCustomReminderCount(reminderCountValue);
      setCustomReminderInterval(reminderIntervalValue);
    }
  }, [reminderSettings]);

  useEffect(() => {
    if (activeSettingsTab === "reminders") {
      refreshNotificationSubscription();
    }
  }, [activeSettingsTab, currentUser?.id, refreshNotificationSubscription]);

  const openAddPeriodFlow = useCallback(() => {
    localStorage.removeItem("shouldOpenAddPeriod");
    setActiveSettingsTab("periods");
    setEditingPeriodId(null);
    setNewPeriodStart("");
    setNewPeriodEnd("");
    setShowAddPeriod(true);

    setTimeout(() => {
      const periodSection = document.querySelector(
        ".pay-period-settings-section h3",
      );
      if (periodSection) {
        periodSection.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  }, []);

  // Check if we should open the Add Period modal (from Timesheet navigation)
  useEffect(() => {
    const handleOpenAddPeriod = () => openAddPeriodFlow();

    if (localStorage.getItem("shouldOpenAddPeriod") === "true") {
      openAddPeriodFlow();
    }

    window.addEventListener("open-add-period-settings", handleOpenAddPeriod);

    return () => {
      window.removeEventListener("open-add-period-settings", handleOpenAddPeriod);
    };
  }, [openAddPeriodFlow]);

  // Auto-set full-time employee values when employee type changes
  useEffect(() => {
    if (employeeType === "full-time") {
      setDailyHours(9);
      setWorkDaysPerWeek(5);
      setMonthlyHours(187);
    }
  }, [employeeType]);

  const handleSaveAll = async (e, options = {}) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    try {
      const forceReminderSave = options.forceReminderSave === true;
      if (forceReminderSave) {
        setReminderSaveStatus({
          type: "saving",
          message: "Saving reminder settings...",
        });
      }

      // Parse values
      const parsedSalary = parseFloat(salary) || 0;
      const parsedVacation = parseFloat(annualVacation) || 0;
      const parsedSickDays = parseFloat(sickDays) || 0;
      const parsedDailyHours = parseFloat(dailyHours) || 9;
      const parsedWorkDaysPerWeek = parseFloat(workDaysPerWeek) || 5;
      const parsedMonthlyHours = parseFloat(monthlyHours) || 187;
      const normalizedReminderStartTime =
        normalizeReminderTime(reminderStartTime);
      const finalReminderCount =
        reminderCount === "custom"
          ? parseInt(customReminderCount, 10)
          : parseInt(reminderCount, 10);
      const finalReminderInterval =
        reminderInterval === "custom"
          ? parseInt(customReminderInterval, 10)
          : parseInt(reminderInterval, 10);

      // Run validation
      const errors = validateEmployeeData(
        name,
        parsedSalary,
        parsedVacation,
        parsedSickDays,
        employeeType,
        parsedDailyHours,
        parsedWorkDaysPerWeek,
        parsedMonthlyHours,
      );

      // If validation fails, show errors
      if (errors.length > 0) {
        if (forceReminderSave) {
          setReminderSaveStatus({
            type: "error",
            message: "Reminder settings were not saved. Please fix the validation errors.",
          });
        }
        setConfirmModal({
          isOpen: true,
          title: "⚠️ Validation Error",
          message: `Please fix the following errors:\n\n${errors.join("\n")}`,
          type: "danger",
          confirmText: "OK",
          showCancel: false,
          onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
        });
        return; // Stop - don't save
      }

      // Check what changed (exclude salary if it's hidden) - use original employee state
      const originalName = employee?.name;
      const nameChanged = name !== originalName;

      const salaryChanged = !hideSalary && parsedSalary !== employee?.salary;
      const vacationChanged = parsedVacation !== leaveSettings?.annualVacation;
      const sickDaysChanged = parsedSickDays !== leaveSettings?.sickDays;
      const employeeTypeChanged = employeeType !== employee?.employeeType;
      const dailyHoursChanged = parsedDailyHours !== employee?.dailyHours;
      const workDaysPerWeekChanged =
        parsedWorkDaysPerWeek !== employee?.workDaysPerWeek;
      const monthlyHoursChanged = parsedMonthlyHours !== employee?.monthlyHours;
      const breakStartTimeChanged = breakStartTime !== employee?.breakStartTime;

      const remindersEnabledChanged =
        remindersEnabled !== reminderSettings?.enabled;
      const reminderStartTimeChanged =
        normalizedReminderStartTime !==
        normalizeReminderTime(reminderSettings?.startTime);
      const reminderCountChanged =
        finalReminderCount !== Number(reminderSettings?.reminderCount);
      const reminderIntervalChanged =
        finalReminderInterval !== Number(reminderSettings?.intervalMinutes);

      const anyChanges =
        nameChanged ||
        salaryChanged ||
        vacationChanged ||
        sickDaysChanged ||
        employeeTypeChanged ||
        dailyHoursChanged ||
        workDaysPerWeekChanged ||
        monthlyHoursChanged ||
        breakStartTimeChanged ||
        remindersEnabledChanged ||
        reminderStartTimeChanged ||
        reminderCountChanged ||
        reminderIntervalChanged ||
        forceReminderSave;

      // If nothing changed, alert user
      if (!anyChanges) {
        if (forceReminderSave) {
          setReminderSaveStatus({
            type: "info",
            message: "Reminder settings are already up to date.",
          });
        }
        setConfirmModal({
          isOpen: true,
          title: "No Changes Detected",
          message: "You haven't made any changes to save.",
          type: "info",
          confirmText: "OK",
          showCancel: false,
          onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
        });
        return;
      }

      // Build list of what changed (exclude salary if hidden)
      const changedItems = [];
      if (nameChanged) changedItems.push(`• Name: ${employee?.name} → ${name}`);
      if (salaryChanged)
        changedItems.push(`• Salary: ${employee?.salary} → ${parsedSalary}`);
      if (employeeTypeChanged)
        changedItems.push(
          `• Employee Type: ${employee?.employeeType} → ${employeeType}`,
        );
      if (dailyHoursChanged)
        changedItems.push(
          `• Daily Hours: ${employee?.dailyHours} → ${parsedDailyHours}`,
        );
      if (workDaysPerWeekChanged)
        changedItems.push(
          `• Work Days/Week: ${employee?.workDaysPerWeek} → ${parsedWorkDaysPerWeek}`,
        );
      if (monthlyHoursChanged)
        changedItems.push(
          `• Monthly Hours: ${employee?.monthlyHours} → ${parsedMonthlyHours}`,
        );
      if (breakStartTimeChanged)
        changedItems.push(
          `• Break Start Time: ${employee?.breakStartTime} → ${breakStartTime}`,
        );
      if (vacationChanged)
        changedItems.push(
          `• Vacation Days: ${leaveSettings?.annualVacation} → ${parsedVacation}`,
        );
      if (sickDaysChanged)
        changedItems.push(
          `• Sick Days: ${leaveSettings?.sickDays} → ${parsedSickDays}`,
        );
      if (remindersEnabledChanged)
        changedItems.push(
          `• Check-in Reminders: ${reminderSettings?.enabled ? "On" : "Off"} → ${remindersEnabled ? "On" : "Off"}`,
        );
      if (reminderStartTimeChanged)
        changedItems.push(
          `• Reminder Start Time: ${normalizeReminderTime(reminderSettings?.startTime)} → ${normalizedReminderStartTime}`,
        );
      if (forceReminderSave && changedItems.length === 0) {
        changedItems.push("• Reminder settings synced to cloud");
      }

      // Save all data (preserves unchanged values automatically, excludes salary if hidden)
      const employeeData = {
        name: name,
        employeeType: employeeType,
        dailyHours: parsedDailyHours,
        monthlyHours: parsedMonthlyHours,
        workDaysPerWeek: parsedWorkDaysPerWeek,
        breakStartTime: breakStartTime,
      };
      if (!hideSalary) {
        employeeData.salary = parsedSalary;
      }

      // IMPORTANT: Save to database FIRST before updating local state
      // This prevents conflicts with TimeTrackerContext's auto-save useEffect
      // Set flag to prevent auto-save during manual name changes
      localStorage.setItem("manualNameChange", "true");

      // NEW: Save display name to localStorage and DB when name changes
      if (nameChanged && name.trim()) {
        localStorage.setItem("userDisplayName", name.trim());
        localStorage.setItem("userDisplayNameTimestamp", Date.now().toString());

        // Also save full_name to database when user explicitly changes it in Settings
        if (currentUser) {
          try {
            // Use direct Supabase client to bypass any potential wrapper issues
            const { error } = await supabase
              .from("profiles")
              .update({
                full_name: name.trim(),
                employee_type: employeeType,
                daily_hours: parsedDailyHours,
                monthly_hours: parsedMonthlyHours,
                work_days_per_week: parsedWorkDaysPerWeek,
                break_start_time: breakStartTime,
                updated_at: new Date().toISOString(),
              })
              .eq("id", currentUser.id);

            if (error) {
              console.error(
                "[Settings] Failed to save display name to database:",
                error.message,
              );
            } else {
              setEmployee((prev) => ({ ...prev, name: name.trim() }));

              // Set flag to disable background sync permanently (until page refresh)
              localStorage.setItem("disableBackgroundSync", "true");
              // Don't auto-remove - let user refresh page to reset

              // Clear manual name change flag after save is complete
              setTimeout(() => {
                localStorage.removeItem("manualNameChange");
              }, 1000);
            }
          } catch (error) {
            console.error(
              "[Settings] Failed to save display name to database:",
              error.message,
            );
          }
        } else {
          console.warn("[Settings] No currentUser, skipping DB save");
        }
      } else {
        // Only save employee type fields if name didn't change but other fields did
        if (
          employeeTypeChanged ||
          dailyHoursChanged ||
          workDaysPerWeekChanged ||
          monthlyHoursChanged ||
          breakStartTimeChanged
        ) {
          if (currentUser) {
            try {
              const result = await supabaseData.saveUserProfile(currentUser.id, {
                employee_type: employeeType,
                daily_hours: parsedDailyHours,
                monthly_hours: parsedMonthlyHours,
                work_days_per_week: parsedWorkDaysPerWeek,
                break_start_time: breakStartTime,
              });
            } catch (error) {
              console.error(
                "[Settings] Failed to save employee settings to database:",
                error,
              );
            }
          }
        }
      }

      const nextLeaveSettings = {
        ...leaveSettings,
        annualVacation: parsedVacation,
        sickDays: parsedSickDays,
      };
      let leaveSettingsCloudWarning = "";

      if ((vacationChanged || sickDaysChanged) && currentUser) {
        const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
        localStorage.setItem(
          getLeaveSettingsUpdatedAtKey(currentUser.id),
          String(Date.now()),
        );
        setSimpleEncryptedItem(
          leaveSettingsKey,
          nextLeaveSettings,
          currentUser.username,
        );
        cacheManager.setCachedData(
          `leaveSettings_${currentUser.id}`,
          nextLeaveSettings,
        );

        try {
          const savedLeaveSettings = await supabaseData.saveLeaveSettings(
            currentUser.id,
            {
              annual_vacation: nextLeaveSettings.annualVacation,
              sick_days: nextLeaveSettings.sickDays,
              personal_days: nextLeaveSettings.personalDays,
              used_vacation_days: nextLeaveSettings.usedVacationDays,
              used_sick_days: nextLeaveSettings.usedSickDays,
              used_personal_days: nextLeaveSettings.usedPersonalDays,
            },
            { timeoutMs: REMINDER_SAVE_TIMEOUT_MS },
          );
          if (!savedLeaveSettings) {
            leaveSettingsCloudWarning =
              "Leave settings were saved on this device, but Supabase did not confirm the update.";
          }
        } catch (error) {
          leaveSettingsCloudWarning =
            error.message ||
            "Leave settings were saved on this device, but Supabase did not update.";
        }
      }

      // NOW update local state after database save (or queue)
      setEmployee((prev) => ({ ...prev, ...employeeData }));
      setLeaveSettings(nextLeaveSettings);
      setAnnualVacation(nextLeaveSettings.annualVacation);
      setSickDays(nextLeaveSettings.sickDays);
      setLeaveInputsDirty(false);

      // Update reminder settings
      if (
        remindersEnabledChanged ||
        reminderStartTimeChanged ||
        reminderCountChanged ||
        reminderIntervalChanged ||
        forceReminderSave
      ) {
        const nextReminderSettings = {
          enabled: remindersEnabled,
          startTime: normalizedReminderStartTime,
          reminderCount: finalReminderCount,
          intervalMinutes: finalReminderInterval,
          timezone:
            reminderSettings?.timezone ||
            Intl.DateTimeFormat().resolvedOptions().timeZone ||
            "UTC",
        };

        setReminderSettings((prev) => ({
          ...prev,
          ...nextReminderSettings,
        }));

        if (currentUser) {
          try {
            await withTimeout(
              supabaseData.saveReminderPreferences(currentUser.id, {
                enabled: nextReminderSettings.enabled,
                start_time: nextReminderSettings.startTime,
                reminder_count: nextReminderSettings.reminderCount,
                interval_minutes: nextReminderSettings.intervalMinutes,
                timezone: nextReminderSettings.timezone,
              }),
              REMINDER_SAVE_TIMEOUT_MS,
              "Reminder settings save timed out. Please check your connection and try again.",
            );
          } catch (error) {
            if (forceReminderSave) {
              setReminderSaveStatus({
                type: "error",
                message:
                  error.message ||
                  "Reminder settings were saved locally, but Supabase did not update.",
              });
            }
            leaveSettingsCloudWarning = (leaveSettingsCloudWarning ? leaveSettingsCloudWarning + "\n" : "") + 
              (error.message || "Reminder settings were saved locally, but Supabase did not update.");
          }
        }

        if (forceReminderSave) {
          setReminderSaveStatus({
            type: "success",
            message: `Reminder settings saved at ${new Date().toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}.`,
          });
        }
      }

      // ✅ IMMEDIATE SAVE: Force immediate salary save to localStorage
      if (salaryChanged && !hideSalary && currentUser) {
        const salaryKey = `salary_${currentUser.id}`;
        // Save using the same encryption method as the TimeTrackerContext
        setSimpleEncryptedItem(salaryKey, parsedSalary, currentUser.username);
      }

      // Show success with what changed
      let summaryMessage;
      if (changedItems.length === 1) {
        // Single change - simple message
        const item = changedItems[0].replace("• ", "");
        summaryMessage = item;
      } else {
        // Multiple changes - formatted list
        summaryMessage = `${changedItems.length} settings updated:\n\n${changedItems.join("\n")}`;
      }

      // Check if there are queued database saves to add warning
      const queue = JSON.parse(localStorage.getItem("dbSaveQueue") || "[]");
      if (queue.length > 0) {
        summaryMessage +=
          "\n\n⚠️ Note: Database connectivity issues detected. Changes will sync when connection is restored.";
      }

      if (leaveSettingsCloudWarning) {
        summaryMessage += `\n\nWarning: ${leaveSettingsCloudWarning}`;
      }

      setConfirmModal({
        isOpen: true,
        title: "✓ Settings Saved",
        message: summaryMessage,
        type: queue.length > 0 || leaveSettingsCloudWarning ? "warning" : "success",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    } catch (error) {
      console.error("[Settings] Unhandled error during save:", error);
      setConfirmModal({
        isOpen: true,
        title: "❌ Error Saving Settings",
        message: `An unexpected error occurred while saving: ${error.message}`,
        type: "danger",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    }
  };

  const categorizePeriods = () => {
    let current = periods.find((p) => String(p.id) === String(currentPeriodId));

    if (!current) {
      current = periods.find((p) => p.is_current === true);
    }

    const otherPeriods = periods.filter(
      (p) => String(p.id) !== String(current?.id),
    );

    if (!current) {
      return { current, upcoming: [], previous: otherPeriods };
    }

    const currentStart = current.start_date || current.start || "";

    const upcoming = otherPeriods.filter(
      (p) => (p.start_date || p.start || "") > currentStart,
    );
    const previous = otherPeriods.filter(
      (p) => (p.start_date || p.start || "") <= currentStart,
    );

    return { current, upcoming, previous };
  };

  const { current, upcoming, previous } = categorizePeriods();

  const handleSetCurrentPeriod = async (period) => {
    if (!period || period.id?.startsWith("period-") || settingCurrentPeriodId) {
      return;
    }

    setSettingCurrentPeriodId(period.id);

    try {
      const result = await setCurrentPeriod(period.id);
      const changedLocally = result?.success;

      setConfirmModal({
        isOpen: true,
        title: changedLocally
          ? result.cloudSynced
            ? "Period Updated"
            : "Period Updated Locally"
          : "Period Update Failed",
        message: changedLocally
          ? result.cloudSynced
            ? `"${period.label}" is now the current period.`
            : `"${period.label}" is now current on this device, but cloud sync did not complete. It will retry through the normal sync flow.`
          : result?.error || "Could not set this period as current.",
        type: changedLocally ? (result.cloudSynced ? "success" : "warning") : "danger",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setSettingCurrentPeriodId(null);
    }
  };

  const handleAddPeriod = (e) => {
    e.preventDefault();

    // Basic check
    if (!newPeriodStart || !newPeriodEnd) {
      setConfirmModal({
        isOpen: true,
        title: "Missing Dates",
        message: "Please fill in both start and end dates",
        type: "warning",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Run validation
    const errors = validatePeriodDates(
      newPeriodStart,
      newPeriodEnd,
      periods,
      editingPeriodId, // Pass editingPeriodId to exclude from overlap check
    );

    // If validation fails, show errors
    if (errors.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: "Invalid Period",
        message: `Cannot add period:\n\n${errors.join("\n")}`,
        type: "danger",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Validation passed - create period
    const startDate = new Date(newPeriodStart);
    const endDate = new Date(newPeriodEnd);

    const formatDate = (date) => {
      const day = date.getDate();
      const month = date.toLocaleString("en-US", { month: "short" });
      return `${day} ${month}`;
    };

    const autoLabel = `${formatDate(startDate)} - ${formatDate(endDate)} ${endDate.getFullYear()}`;

    if (editingPeriodId) {
      // Edit existing period — mark it dirty so it gets synced to Supabase
      markPeriodDirty(editingPeriodId);
      setPeriods(
        periods.map((p) =>
          p.id === editingPeriodId
            ? {
                ...p,
                label: autoLabel,
                start_date: newPeriodStart,
                end_date: newPeriodEnd,
              }
            : p,
        ),
      );
    } else {
      // Add new period
      const newPeriod = {
        id: `period-${Date.now()}`,
        label: autoLabel,
        start_date: newPeriodStart,
        end_date: newPeriodEnd,
      };
      setPeriods([...periods, newPeriod]);
    }

    setShowAddPeriod(false);
    setEditingPeriodId(null);
    setNewPeriodStart("");
    setNewPeriodEnd("");

    // Show success modal
    setConfirmModal({
      isOpen: true,
      title: editingPeriodId ? "✓ Period Updated" : "✓ Period Added",
      message: `Period "${autoLabel}" ${editingPeriodId ? "updated" : "added"} successfully!`,
      type: "success",
      confirmText: "OK",
      showCancel: false,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
    });
  };

  const handleDeletePeriod = (periodId) => {
    // Can't delete last period
    if (periods.length === 1) {
      setConfirmModal({
        isOpen: true,
        title: "Cannot Delete",
        message:
          "Cannot delete the last period! You must have at least one pay period.",
        type: "warning",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    const periodToDelete = periods.find((p) => p.id === periodId);

    // Ask for confirmation
    setConfirmModal({
      isOpen: true,
      title: "Delete Period",
      message: `Are you sure you want to delete "${periodToDelete.label}"? This cannot be undone.`,
      type: "danger",
      confirmText: "Delete",
      cancelText: "Cancel",
      showCancel: true,
      onConfirm: async () => {
        try {
          // Delete from Supabase first
          if (currentUser) {
            await supabaseData.deletePayPeriod(currentUser.id, periodId);
          }

          // Update local state
          const newPeriods = periods.filter((p) => p.id !== periodId);
          setPeriods(newPeriods);

          // If deleting current period, switch to first available
          if (String(currentPeriodId) === String(periodId)) {
            setCurrentPeriodId(newPeriods[0]?.id || null);
          }

          // Show success
          setConfirmModal({
            isOpen: true,
            title: "✓ Period Deleted",
            message: `Period "${periodToDelete.label}" has been deleted.`,
            type: "success",
            confirmText: "OK",
            showCancel: false,
            onConfirm: () =>
              setConfirmModal(prev => ({ ...prev, isOpen: false })),
          });
        } catch (error) {
          // Still delete from local state even if Supabase fails
          const newPeriods = periods.filter((p) => p.id !== periodId);
          setPeriods(newPeriods);

          // If deleting current period, switch to first available
          if (String(currentPeriodId) === String(periodId)) {
            setCurrentPeriodId(newPeriods[0]?.id || null);
          }

          // Show warning
          setConfirmModal({
            isOpen: true,
            title: "⚠️ Period Deleted (Local Only)",
            message: `Period "${periodToDelete.label}" deleted locally but there was an error deleting from the cloud. Your local data is safe.`,
            type: "warning",
            confirmText: "OK",
            showCancel: false,
            onConfirm: () =>
              setConfirmModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  const handleClearCurrentDay = () => {
    const today = new Date().toISOString().split("T")[0];
    const todayEntry = entries.find((e) => e.date === today);

    if (!todayEntry) {
      setConfirmModal({
        isOpen: true,
        title: "No Data Found",
        message: `No data found for today (${today}).`,
        type: "info",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Clear Today's Data?",
      message:
        `Are you sure you want to clear all data for today?\n\n` +
        `• ${today}\n` +
        `• ${todayEntry.type}\n\n` +
        `⛔ This action cannot be undone.\n\n` +
        `💡 Tip: Consider exporting your data first.`,
      type: "danger",
      confirmText: "Clear Today",
      cancelText: "Cancel",
      showCancel: true,
      onConfirm: () => {
        clearCurrentDay();
        setConfirmModal({
          isOpen: true,
          title: "✓ Data Cleared",
          message: "Today's data has been cleared.",
          type: "success",
          confirmText: "OK",
          showCancel: false,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        });
      },
    });
  };

  const handleClearCurrentPeriod = () => {
    const currentPeriod = periods.find(
      (p) => String(p.id) === String(currentPeriodId),
    );
    const periodEntries = entries.filter(
      (e) =>
        e.date >= (currentPeriod.start_date || currentPeriod.start) &&
        e.date <= (currentPeriod.end_date || currentPeriod.end),
    );

    if (periodEntries.length === 0) {
      setConfirmModal({
        isOpen: true,
        title: "No Data Found",
        message: `No data found for the current period (${currentPeriod.label}).`,
        type: "info",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Clear Period Data?",
      message:
        `Are you sure you want to clear all data for this period?\n\n` +
        `• ${currentPeriod.label}\n` +
        `• ${periodEntries.length} entries\n\n` +
        `⛔ This action cannot be undone.\n\n` +
        `🔒 Recommended: Export this period first to avoid data loss.`,
      type: "danger",
      confirmText: "Clear Period",
      cancelText: "Cancel",
      showCancel: true,
      onConfirm: () => {
        // Clear the data directly
        const pStart = currentPeriod.start_date || currentPeriod.start;
        const pEnd = currentPeriod.end_date || currentPeriod.end;
        const newEntries = entries.filter(
          (e) => e.date < pStart || e.date > pEnd,
        );
        setEntries(newEntries);
        setConfirmModal({
          isOpen: true,
          title: "✓ Period Cleared",
          message: `All data for ${currentPeriod.label} has been cleared.`,
          type: "success",
          confirmText: "OK",
          showCancel: false,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
        });
      },
    });
  };

  // ✅ FIXED: Clear All Data
  const handleClearAllData = () => {
    const totalEntries = entries.length;

    setConfirmModal({
      isOpen: true,
      title: "⚠️ DELETE ALL DATA?",
      message:
        `You are about to delete ALL your timesheet data!\n\n` +
        `• ${totalEntries} entries\n` +
        `• ${periods.length} periods\n\n` +
        `⛔ THIS ACTION CANNOT BE UNDONE!\n\n` +
        `🔒 STRONGLY RECOMMENDED: Export your data first!`,
      type: "danger",
      confirmText: "I understand, Delete All",
      cancelText: "Cancel",
      showCancel: true,
      onConfirm: () => {
        const confirmation = window.prompt(
          "Type DELETE to confirm (all caps):",
        );

        if (confirmation === "DELETE") {
          clearAllData();

          setConfirmModal({
            isOpen: true,
            title: "✓ All Data Deleted",
            message: "All your timesheet data has been permanently deleted.",
            type: "success",
            confirmText: "OK",
            showCancel: false,
            onConfirm: () =>
              setConfirmModal(prev => ({ ...prev, isOpen: false })),
          });
        } else {
          setConfirmModal({
            isOpen: true,
            title: "Deletion Cancelled",
            message: "No data was deleted.",
            type: "info",
            confirmText: "OK",
            showCancel: false,
            onConfirm: () =>
              setConfirmModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
    });
  };

  // ✅ NEW: Delete Account
  const handleDeleteAccount = () => {
    if (!currentUser) return;

    setConfirmModal({
      isOpen: true,
      title: "🗑️ DELETE ACCOUNT?",
      message:
        `⚠️ WARNING: This will permanently delete your account "${currentUser.username}" and ALL your data!\n\n` +
        `This includes:\n` +
        `• ${entries.length} time entries\n` +
        `• ${periods.length} pay periods\n` +
        `• All employee settings\n\n` +
        `⛔ THIS ACTION CANNOT BE UNDONE!\n\n` +
        `🔒 STRONGLY RECOMMENDED: Export your data first!`,
      type: "danger",
      confirmText: "Delete My Account",
      cancelText: "Cancel",
      showCancel: true,
      onConfirm: () => {
        const typedUsername = window.prompt(
          `Type your username "${currentUser.username}" to confirm deletion (case-sensitive):`,
        );

        if (typedUsername === currentUser.username) {
          try {
            deleteUser(currentUser.username);

            setConfirmModal({
              isOpen: true,
              title: "✓ Account Deleted",
              message:
                "Your account has been permanently deleted. You will now be logged out.",
              type: "success",
              confirmText: "OK",
              showCancel: false,
              onConfirm: () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                window.location.reload();
              },
            });
          } catch (error) {
            setConfirmModal({
              isOpen: true,
              title: "Error",
              message: `Failed to delete account: ${error.message}`,
              type: "danger",
              confirmText: "OK",
              showCancel: false,
              onConfirm: () =>
                setConfirmModal(prev => ({ ...prev, isOpen: false })),
            });
          }
        } else {
          setConfirmModal({
            isOpen: true,
            title: "Deletion Cancelled",
            message: "Username does not match. Your account was not deleted.",
            type: "info",
            confirmText: "OK",
            showCancel: false,
            onConfirm: () =>
              setConfirmModal(prev => ({ ...prev, isOpen: false })),
          });
        }
      },
      onCancel: () => setConfirmModal(prev => ({ ...prev, isOpen: false })),
    });
  };


  return (
    <main className="settings-page main-content">
      {/* ── Page Header ── */}
      <div style={{ padding: '24px 20px 12px' }}>
        <h1 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>Settings</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage your preferences, data &amp; account</p>
      </div>

      {/* ── Hub Menu ── */}
      {activeModal === null && (
        <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button type="button" className="settings-menu-item" onClick={() => setActiveModal('theme')}>
            <div className="settings-menu-left"><i className="fa-solid fa-palette" /><span>Theme &amp; Design</span></div>
            <i className="fa-solid fa-chevron-right chevron-icon" />
          </button>
          <button type="button" className="settings-menu-item" onClick={() => setActiveModal('employee')}>
            <div className="settings-menu-left"><i className="fa-solid fa-user" /><span>Employee Information</span></div>
            <i className="fa-solid fa-chevron-right chevron-icon" />
          </button>
          <button type="button" className="settings-menu-item" onClick={() => setActiveModal('reminders')}>
            <div className="settings-menu-left"><i className="fa-solid fa-bell" /><span>Check-in Reminders</span></div>
            <i className="fa-solid fa-chevron-right chevron-icon" />
          </button>
          <button type="button" className="settings-menu-item" onClick={() => setActiveModal('periods')}>
            <div className="settings-menu-left"><i className="fa-solid fa-calendar-days" /><span>Pay Period Management</span></div>
            <i className="fa-solid fa-chevron-right chevron-icon" />
          </button>
          <button type="button" className="settings-menu-item" onClick={() => setActiveModal('data')}>
            <div className="settings-menu-left"><i className="fa-solid fa-database" /><span>Data Management</span></div>
            <i className="fa-solid fa-chevron-right chevron-icon" />
          </button>
          <button type="button" className="settings-menu-item danger-item" onClick={() => setActiveModal('danger')}>
            <div className="settings-menu-left"><i className="fa-solid fa-triangle-exclamation" /><span>Danger Zone</span></div>
            <i className="fa-solid fa-chevron-right chevron-icon" />
          </button>
        </div>
      )}

      {/* ═══ SPOKE: Theme & Design ═══ */}
      {activeModal === 'theme' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="spoke-header">
            <h2 className="spoke-header-title"><i className="fa-solid fa-palette" />Theme &amp; Design</h2>
            <SpokeDoneBtn />
          </div>
          <div className="spoke-content">
            <div className="spoke-section">
              <div className="spoke-section-label">UI Version</div>
              <div className="spoke-card">
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Bento Grid (V2)</span>
                    <span className="spoke-row-hint">Modern glassmorphism layout</span>
                  </div>
                  <button type="button" onClick={() => updatePreferences({ designVersion: 'bento' })}
                    style={{ padding: '6px 16px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: userPreferences?.designVersion !== 'legacy' ? 'var(--accent-cyan)' : 'var(--bg-tertiary)', color: userPreferences?.designVersion !== 'legacy' ? '#000' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                    {userPreferences?.designVersion !== 'legacy' ? '✓ Active' : 'Switch'}
                  </button>
                </div>
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Legacy (V1)</span>
                    <span className="spoke-row-hint">Classic tabbed layout</span>
                  </div>
                  <button type="button" onClick={() => updatePreferences({ designVersion: 'legacy' })}
                    style={{ padding: '6px 16px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: userPreferences?.designVersion === 'legacy' ? 'var(--accent-cyan)' : 'var(--bg-tertiary)', color: userPreferences?.designVersion === 'legacy' ? '#000' : 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                    {userPreferences?.designVersion === 'legacy' ? '✓ Active' : 'Switch'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </ModalShell>
      )}


      {/* ═══ SPOKE: Employee Information ═══ */}
      {activeModal === 'employee' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="spoke-header">
            <h2 className="spoke-header-title"><i className="fa-solid fa-user" />Employee Information</h2>
            <SpokeDoneBtn />
          </div>
          <div className="spoke-content" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="spoke-section">
              <div className="spoke-section-label">Personal Details</div>
              <div className="spoke-card">
                <div className="spoke-row spoke-row-full">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Display Name</span>
                    <span className="spoke-row-hint">Login stays as <strong>{currentUser?.username}</strong></span>
                  </div>
                  <div className="spoke-row-control">
                    <input type="text" className="bento-input" value={name ?? ''} onChange={(e) => setName(e.target.value)} placeholder="Your display name" />
                  </div>
                </div>
                {!hideSalary && (
                  <div className="spoke-row spoke-row-full">
                    <div className="spoke-row-left"><span className="spoke-row-label">Monthly Salary (L.E.)</span></div>
                    <div className="spoke-row-control">
                      <input type="number" inputMode="decimal" className="bento-input" value={salary ?? 0} onChange={(e) => setSalary(e.target.value)} placeholder="0.00" min="0" step="0.01" />
                    </div>
                  </div>
                )}
                {hideSalary && (
                  <div className="spoke-row">
                    <div className="spoke-row-left">
                      <span className="spoke-row-label">Monthly Salary</span>
                      <span className="spoke-row-hint">Toggle visibility on Dashboard to edit</span>
                    </div>
                    <span style={{ color: 'var(--text-tertiary)', letterSpacing: '0.15em' }}>••••••</span>
                  </div>
                )}
              </div>
            </div>
            <div className="spoke-section">
              <div className="spoke-section-label">Work Schedule</div>
              <div className="spoke-card">
                <div className="spoke-row spoke-row-full">
                  <div className="spoke-row-left"><span className="spoke-row-label">Employee Type</span></div>
                  <div className="spoke-row-control">
                    <CustomSelect id="employee-type-select" name="employeeType" value={employeeType ?? 'full-time'} onChange={(e) => setEmployeeType(e.target.value)}
                      options={[{ label: 'Full-Time', value: 'full-time' }, { label: 'Part-Time', value: 'part-time' }]} />
                  </div>
                </div>
                {employeeType === 'part-time' && (
                  <>
                    <div className="spoke-row spoke-row-full">
                      <div className="spoke-row-left">
                        <span className="spoke-row-label">Daily Hours</span>
                        <span className="spoke-row-hint">6–9 hours/day</span>
                      </div>
                      <div className="spoke-row-control">
                        <input type="number" inputMode="decimal" className="bento-input" value={dailyHours ?? 9} onChange={(e) => setDailyHours(e.target.value)} min="6" max="9" step="0.5" />
                      </div>
                    </div>
                    <div className="spoke-row spoke-row-full">
                      <div className="spoke-row-left">
                        <span className="spoke-row-label">Work Days / Week</span>
                        <span className="spoke-row-hint">3–5 days</span>
                      </div>
                      <div className="spoke-row-control">
                        <CustomSelect id="work-days-per-week-select" name="workDaysPerWeek" value={workDaysPerWeek ?? 5} onChange={(e) => setWorkDaysPerWeek(e.target.value)}
                          options={[{ label: '3 days', value: '3' }, { label: '4 days', value: '4' }, { label: '5 days', value: '5' }]} />
                      </div>
                    </div>
                  </>
                )}
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Monthly Hours</span>
                    <span className="spoke-row-hint">{employeeType === 'part-time' ? 'Calculated from actual hours' : 'Fixed 187h for full-time'}</span>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{employeeType === 'part-time' ? 'Auto' : (monthlyHours ?? 187)}</span>
                </div>
              </div>
            </div>
            <div className="spoke-section">
              <div className="spoke-section-label">Leave Policy &amp; Breaks</div>
              <div className="spoke-card">
                <div className="spoke-row spoke-row-full">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Daily Break Start</span>
                    <span className="spoke-row-hint">30-min unpaid break each workday</span>
                  </div>
                  <div className="spoke-row-control">
                    <input
                      type="tel"
                      placeholder="HH:MM:SS"
                      className="bento-input"
                      value={breakStartTime || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        let res = '';
                        if (val.length > 0) res += val.substring(0, 2);
                        if (val.length > 2) res += ':' + val.substring(2, 4);
                        if (val.length > 4) res += ':' + val.substring(4, 6);
                        setBreakStartTime(res);
                      }}
                      onBlur={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        if (!val) return;
                        let res = '';
                        if (val.length === 1) res = `0${val}:00:00`;
                        else if (val.length === 2) res = `${val}:00:00`;
                        else if (val.length === 3) res = `${val.substring(0,2)}:0${val.substring(2,3)}:00`;
                        else if (val.length === 4) res = `${val.substring(0,2)}:${val.substring(2,4)}:00`;
                        else if (val.length === 5) res = `${val.substring(0,2)}:${val.substring(2,4)}:0${val.substring(4,5)}`;
                        else if (val.length >= 6) res = `${val.substring(0,2)}:${val.substring(2,4)}:${val.substring(4,6)}`;
                        setBreakStartTime(res);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="spoke-row spoke-row-full">
                  <div className="spoke-row-left"><span className="spoke-row-label">Annual Vacation Days</span></div>
                  <div className="spoke-row-control">
                    <input type="number" inputMode="numeric" className="bento-input" value={annualVacation ?? 10} onChange={(e) => { setLeaveInputsDirty(true); setAnnualVacation(e.target.value); }} min="0" max="365" />
                  </div>
                </div>
                <div className="spoke-row spoke-row-full">
                  <div className="spoke-row-left"><span className="spoke-row-label">Sick Days</span></div>
                  <div className="spoke-row-control">
                    <input type="number" inputMode="numeric" className="bento-input" value={sickDays ?? 7} onChange={(e) => { setLeaveInputsDirty(true); setSickDays(e.target.value); }} min="0" max="365" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="spoke-footer">
            <SpokeCancelBtn />
            <SpokeSaveBtn onSave={(e) => { hapticFeedback.buttonClick(); handleSaveAll(e); }}>Save Changes</SpokeSaveBtn>
          </div>
        </ModalShell>
      )}

      {/* ═══ SPOKE: Check-in Reminders ═══ */}
      {activeModal === 'reminders' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="spoke-header">
            <h2 className="spoke-header-title"><i className="fa-solid fa-bell" />Check-in Reminders</h2>
            <SpokeDoneBtn />
          </div>
          <div className="spoke-content" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="spoke-section">
              <div className="spoke-section-label">Reminder Settings</div>
              <div className="spoke-card">
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Enable Reminders</span>
                    <span className="spoke-row-hint">Daily automated check-in notifications</span>
                  </div>
                  <label className="bento-toggle-wrapper">
                    <input type="checkbox" checked={remindersEnabled} onChange={(e) => setRemindersEnabled(e.target.checked)} />
                    <span className="bento-toggle-track" />
                  </label>
                </div>
                {remindersEnabled && (
                  <>
                    <div className="spoke-row spoke-row-full">
                      <div className="spoke-row-left"><span className="spoke-row-label">Start Time</span></div>
                      <div className="spoke-row-control">
                        <input
                          type="tel"
                          placeholder="HH:MM:SS"
                          className="bento-input"
                          value={reminderStartTime || ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            let res = '';
                            if (val.length > 0) res += val.substring(0, 2);
                            if (val.length > 2) res += ':' + val.substring(2, 4);
                            if (val.length > 4) res += ':' + val.substring(4, 6);
                            setReminderStartTime(res);
                          }}
                          onBlur={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            if (!val) return;
                            let res = '';
                            if (val.length === 1) res = `0${val}:00:00`;
                            else if (val.length === 2) res = `${val}:00:00`;
                            else if (val.length === 3) res = `${val.substring(0,2)}:0${val.substring(2,3)}:00`;
                            else if (val.length === 4) res = `${val.substring(0,2)}:${val.substring(2,4)}:00`;
                            else if (val.length === 5) res = `${val.substring(0,2)}:${val.substring(2,4)}:0${val.substring(4,5)}`;
                            else if (val.length >= 6) res = `${val.substring(0,2)}:${val.substring(2,4)}:${val.substring(4,6)}`;
                            setReminderStartTime(res);
                          }}
                          required
                        />
                      </div>
                    </div>
                    <div className="spoke-row spoke-row-full">
                      <div className="spoke-row-left"><span className="spoke-row-label">Number of Reminders</span></div>
                      <div className="spoke-row-control">
                        {reminderCount === 'custom' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="number" inputMode="numeric" className="bento-input" style={{ flex: 1 }} value={customReminderCount} onChange={(e) => setCustomReminderCount(e.target.value)} min="1" max="100" />
                            <button type="button" className="spoke-btn-outline" style={{ flex: '0 0 auto', padding: '10px 14px' }} onClick={() => setReminderCount('3')}>Reset</button>
                          </div>
                        ) : (
                          <CustomSelect id="reminder-count" name="reminderCount" value={reminderCount} onChange={(e) => setReminderCount(e.target.value)}
                            options={[{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '4', value: '4' }, { label: '5', value: '5' }, { label: 'Custom', value: 'custom' }]} />
                        )}
                      </div>
                    </div>
                    <div className="spoke-row spoke-row-full">
                      <div className="spoke-row-left"><span className="spoke-row-label">Interval Between Reminders</span></div>
                      <div className="spoke-row-control">
                        {reminderInterval === 'custom' ? (
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="number" inputMode="numeric" className="bento-input" style={{ flex: 1 }} value={customReminderInterval} onChange={(e) => setCustomReminderInterval(e.target.value)} min="1" max="1440" />
                            <button type="button" className="spoke-btn-outline" style={{ flex: '0 0 auto', padding: '10px 14px' }} onClick={() => setReminderInterval('15')}>Reset</button>
                          </div>
                        ) : (
                          <CustomSelect id="reminder-interval" name="reminderInterval" value={reminderInterval} onChange={(e) => setReminderInterval(e.target.value)}
                            options={[{ label: '5 min', value: '5' }, { label: '10 min', value: '10' }, { label: '15 min', value: '15' }, { label: '30 min', value: '30' }, { label: 'Custom', value: 'custom' }]} />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            {remindersEnabled && (
              <div className="spoke-section">
                <div className="spoke-section-label">Push Notifications</div>
                <div className="spoke-card">
                  <div className="spoke-row">
                    <div className="spoke-row-left">
                      <span className="spoke-row-label">Push Notifications</span>
                      <span className="spoke-row-hint">{!import.meta.env.PROD ? 'Production only (HTTPS required)' : 'Requires Home Screen install (iOS)'}</span>
                    </div>
                    <button type="button" disabled={!import.meta.env.PROD || isNotificationBusy} onClick={handleTogglePushNotifications}
                      style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: isNotificationSubscribed ? 'rgba(239,68,68,0.15)' : 'rgba(0,240,255,0.12)', color: isNotificationSubscribed ? '#ef4444' : 'var(--accent-cyan)', border: `1px solid ${isNotificationSubscribed ? 'rgba(239,68,68,0.3)' : 'rgba(0,240,255,0.25)'}`, cursor: 'pointer', opacity: !import.meta.env.PROD || isNotificationBusy ? 0.5 : 1 }}>
                      {isNotificationBusy ? 'Updating…' : isNotificationSubscribed ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                  <div className="spoke-row">
                    <div className="spoke-row-left">
                      <span className="spoke-row-label">Test Notifications</span>
                      <span className="spoke-row-hint">Verify your setup works</span>
                    </div>
                    <button type="button" onClick={() => setShowTestNotifModal(true)} style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>Test</button>
                  </div>
                </div>
              </div>
            )}
            <div className="spoke-section">
              <div className="spoke-section-label">Feedback</div>
              <div className="spoke-card">
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Haptic Feedback</span>
                    <span className="spoke-row-hint">{hapticFeedback.isSupported() ? 'Vibration on button taps' : '⚠️ Not supported on this device'}</span>
                  </div>
                  <label className="bento-toggle-wrapper">
                    <input type="checkbox" checked={hapticEnabled} disabled={!hapticFeedback.isSupported()} onChange={() => { hapticFeedback.toggleSwitch(); handleHapticToggle(); }} />
                    <span className="bento-toggle-track" />
                  </label>
                </div>
                {hapticEnabled && hapticFeedback.isSupported() && (
                  <div className="spoke-row">
                    <div className="spoke-row-left"><span className="spoke-row-label">Test Vibration</span></div>
                    <button type="button" onClick={() => { hapticFeedback.buttonClick(); hapticFeedback.testAll(); }} style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>Test</button>
                  </div>
                )}
              </div>
            </div>
            {reminderSaveStatus.message && (
              <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: '12px', background: reminderSaveStatus.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(57,255,20,0.08)', color: reminderSaveStatus.type === 'error' ? '#ef4444' : 'var(--accent-neon-green)', fontSize: '0.85rem', fontWeight: 600 }}>
                {reminderSaveStatus.message}
              </div>
            )}
          </div>
          <div className="spoke-footer">
            <SpokeCancelBtn />
            <SpokeSaveBtn onSave={(e) => { hapticFeedback.buttonClick(); handleSaveAll(e, { forceReminderSave: true }); }}>Save</SpokeSaveBtn>
          </div>
        </ModalShell>
      )}

      {/* ═══ SPOKE: Pay Period Management ═══ */}
      {activeModal === 'periods' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="spoke-header">
            <h2 className="spoke-header-title"><i className="fa-solid fa-calendar-days" />Pay Periods</h2>
            <SpokeDoneBtn />
          </div>
          <div className="spoke-content" style={{ overflowY: 'auto', flex: 1 }}>
            {current && (
              <div className="spoke-section">
                <div className="spoke-section-label">Current Period</div>
                <div className="spoke-card">
                  <div className="bento-period-item">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                      <span className="bento-period-label">{current.label}</span>
                      <span className="bento-period-badge">Active</span>
                    </div>
                    <div className="bento-period-actions">
                      <button className="bento-period-btn" onClick={() => { setEditingPeriodId(current.id); setNewPeriodStart(current.start_date || current.start); setNewPeriodEnd(current.end_date || current.end); setShowAddPeriod(true); }}>Edit</button>
                      <button className="bento-period-btn danger" onClick={() => handleDeletePeriod(current.id)} disabled={periods.length === 1}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {upcoming.length > 0 && (
              <div className="spoke-section">
                <div className="spoke-section-label">Upcoming</div>
                <div className="spoke-card">
                  <button className="bento-accordion-btn" onClick={() => setShowUpcoming(!showUpcoming)}>
                    <i className={`fa-solid fa-chevron-${showUpcoming ? 'down' : 'right'}`} style={{ fontSize: '0.7rem' }} />
                    {upcoming.length} period{upcoming.length !== 1 ? 's' : ''}
                  </button>
                  {showUpcoming && upcoming.map((period) => (
                    <div key={period.id} className="bento-period-item">
                      <span className="bento-period-label" style={{ flex: 1 }}>{period.label}</span>
                      <div className="bento-period-actions">
                        <button className="bento-period-btn" onClick={() => handleSetCurrentPeriod(period)} disabled={period.id.startsWith('period-') || settingCurrentPeriodId === period.id}>{settingCurrentPeriodId === period.id ? '…' : 'Set Current'}</button>
                        <button className="bento-period-btn" onClick={() => { setEditingPeriodId(period.id); setNewPeriodStart(period.start_date || period.start); setNewPeriodEnd(period.end_date || period.end); setShowAddPeriod(true); }}>Edit</button>
                        <button className="bento-period-btn danger" onClick={() => handleDeletePeriod(period.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {previous.length > 0 && (
              <div className="spoke-section">
                <div className="spoke-section-label">Previous</div>
                <div className="spoke-card">
                  <button className="bento-accordion-btn" onClick={() => setShowPrevious(!showPrevious)}>
                    <i className={`fa-solid fa-chevron-${showPrevious ? 'down' : 'right'}`} style={{ fontSize: '0.7rem' }} />
                    {previous.length} period{previous.length !== 1 ? 's' : ''}
                  </button>
                  {showPrevious && previous.map((period) => (
                    <div key={period.id} className="bento-period-item">
                      <span className="bento-period-label" style={{ flex: 1 }}>{period.label}</span>
                      <div className="bento-period-actions">
                        <button className="bento-period-btn" onClick={() => handleSetCurrentPeriod(period)} disabled={period.id.startsWith('period-') || settingCurrentPeriodId === period.id}>{settingCurrentPeriodId === period.id ? '…' : 'Set Current'}</button>
                        <button className="bento-period-btn" onClick={() => { setEditingPeriodId(period.id); setNewPeriodStart(period.start_date || period.start); setNewPeriodEnd(period.end_date || period.end); setShowAddPeriod(true); }}>Edit</button>
                        <button className="bento-period-btn danger" onClick={() => handleDeletePeriod(period.id)}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="spoke-section">
              <button type="button" className="spoke-btn-primary" style={{ width: '100%' }} onClick={() => { setEditingPeriodId(null); setNewPeriodStart(''); setNewPeriodEnd(''); setShowAddPeriod(true); }}>
                <i className="fa-solid fa-plus" style={{ marginRight: '8px' }} />Add Pay Period
              </button>
            </div>
          </div>
          {showAddPeriod && (
            <ModalShell onClose={() => setShowAddPeriod(false)}>
              <div style={{ padding: '24px 20px' }}>
                <h2 style={{ margin: '0 0 20px', fontSize: '1.3rem', fontWeight: 800 }}>{editingPeriodId ? 'Edit Period' : 'Add Pay Period'}</h2>
                <form onSubmit={handleSavePeriod} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <label className="spoke-row-label" style={{ display: 'block', marginBottom: '8px' }}>Start Date</label>
                    <input type="date" className="bento-input" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)} required />
                  </div>
                  <div>
                    <label className="spoke-row-label" style={{ display: 'block', marginBottom: '8px' }}>End Date</label>
                    <input type="date" className="bento-input" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)} required />
                  </div>
                  {periodError && <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{periodError}</p>}
                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button type="button" className="spoke-btn-outline" style={{ flex: 1 }} onClick={() => { setShowAddPeriod(false); setEditingPeriodId(null); setNewPeriodStart(''); setNewPeriodEnd(''); }}>Cancel</button>
                    <button type="submit" className="spoke-btn-primary" style={{ flex: 2 }}>{editingPeriodId ? 'Update' : 'Add Period'}</button>
                  </div>
                </form>
              </div>
            </ModalShell>
          )}
        </ModalShell>
      )}

      {/* ═══ SPOKE: Data Management ═══ */}
      {activeModal === 'data' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="spoke-header">
            <h2 className="spoke-header-title"><i className="fa-solid fa-database" />Data Management</h2>
            <SpokeDoneBtn />
          </div>
          <div className="spoke-content" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="spoke-section">
              <div className="spoke-section-label">Backup &amp; Restore</div>
              <div className="spoke-card">
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Export Data</span>
                    <span className="spoke-row-hint">Download timesheet as Excel</span>
                  </div>
                  <button type="button" onClick={() => { hapticFeedback.buttonClick(); handleOpenExport(); }} style={{ padding: '7px 16px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(0,240,255,0.25)', cursor: 'pointer' }}>Export</button>
                </div>
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Import Data</span>
                    <span className="spoke-row-hint">Restore from a previous backup</span>
                  </div>
                  <button type="button" onClick={() => { hapticFeedback.buttonClick(); setShowImportModal(true); }} style={{ padding: '7px 16px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>Import</button>
                </div>
              </div>
            </div>
            <div className="spoke-section">
              <div className="spoke-section-label">Sync Status</div>
              <div className="spoke-card">
                <div className="bento-stat-grid">
                  <div className="bento-stat-cell"><span className="bento-stat-label">Connection</span><span className={`bento-stat-value ${syncStatus.isOnline ? 'is-online' : 'is-offline'}`}>{syncStatus.isOnline ? 'Online' : 'Offline'}</span></div>
                  <div className="bento-stat-cell"><span className="bento-stat-label">Activity</span><span className="bento-stat-value">{syncStatus.isSyncing ? 'Syncing' : 'Idle'}</span></div>
                  <div className="bento-stat-cell"><span className="bento-stat-label">Last Saved</span><span className="bento-stat-value">{lastSaved ? formatRelativeTime(new Date(lastSaved)) : '—'}</span></div>
                  <div className="bento-stat-cell"><span className="bento-stat-label">Conflicts</span><span className={`bento-stat-value ${pendingConflicts?.length ? 'has-warning' : ''}`}>{pendingConflicts?.length || 0}</span></div>
                  <div className="bento-stat-cell"><span className="bento-stat-label">Pending Uploads</span><span className={`bento-stat-value ${syncStatus.backgroundQueue ? 'has-warning' : ''}`}>{syncStatus.backgroundQueue || 0}</span></div>
                  <div className="bento-stat-cell"><span className="bento-stat-label">Offline Changes</span><span className={`bento-stat-value ${(syncStatus.timeEntrySync?.pending || syncStatus.offlineQueue?.pending) ? 'has-warning' : ''}`}>{(syncStatus.timeEntrySync?.pending || 0) + (syncStatus.offlineQueue?.pending || 0)}</span></div>
                </div>
                <div className="spoke-row" style={{ borderTop: '1px solid var(--border-light)' }}>
                  <span className="spoke-row-hint">Updated {syncStatus.checkedAt ? formatRelativeTime(new Date(syncStatus.checkedAt)) : '—'}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" onClick={handleRefreshSyncStatus} style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-light)', cursor: 'pointer' }}>Refresh</button>
                    <button type="button" onClick={handleSyncNow} disabled={isSyncingNow} style={{ padding: '6px 12px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 600, background: 'rgba(0,240,255,0.12)', color: 'var(--accent-cyan)', border: '1px solid rgba(0,240,255,0.25)', cursor: 'pointer', opacity: isSyncingNow ? 0.5 : 1 }}>{isSyncingNow ? 'Syncing…' : 'Sync Now'}</button>
                  </div>
                </div>
              </div>
            </div>
            <div className="spoke-section">
              <div className="spoke-section-label">App Updates</div>
              <div className="spoke-card">
                <div className="spoke-row">
                  <div className="spoke-row-left">
                    <span className="spoke-row-label">Current Version</span>
                    <span className="spoke-row-hint">v{appVersion} · {import.meta.env.PROD ? 'Installed' : 'Dev preview'}</span>
                  </div>
                  <button type="button" onClick={handleCheckForAppUpdate} disabled={isCheckingVersion} style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-light)', cursor: 'pointer', opacity: isCheckingVersion ? 0.5 : 1 }}>{isCheckingVersion ? 'Checking…' : 'Check'}</button>
                </div>
                {pendingUpdateRegistration && (
                  <div className="spoke-row">
                    <div className="spoke-row-left"><span className="spoke-row-label">Update Ready</span></div>
                    <button type="button" onClick={handleReloadAppUpdate} style={{ padding: '6px 14px', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 700, background: 'rgba(57,255,20,0.12)', color: 'var(--accent-neon-green)', border: '1px solid rgba(57,255,20,0.25)', cursor: 'pointer' }}>Reload</button>
                  </div>
                )}
                {versionCheckStatus && <div style={{ padding: '8px 16px 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{versionCheckStatus}</div>}
              </div>
            </div>
          </div>
        </ModalShell>
      )}

      {/* ═══ SPOKE: Danger Zone ═══ */}
      {activeModal === 'danger' && (
        <ModalShell onClose={() => setActiveModal(null)} closeOnOverlay={true} contentClassName="settings-spoke-modal" showCloseButton={false}>
          <div className="spoke-header">
            <h2 className="spoke-header-title" style={{ color: '#ef4444' }}><i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444' }} />Danger Zone</h2>
            <SpokeDoneBtn />
          </div>
          <div className="spoke-content" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="spoke-section">
              <div className="danger-lock-card">
                <div className="danger-lock-header">
                  <span className="danger-lock-title">
                    <i className={`fa-solid ${isDangerUnlocked ? 'fa-lock-open' : 'fa-lock'}`} />
                    {isDangerUnlocked ? 'Actions unlocked' : 'Enter password to unlock'}
                  </span>
                  {isDangerUnlocked
                    ? <button type="button" className="danger-lock-badge unlocked" onClick={handleLockDangerZone}>Lock</button>
                    : <span className="danger-lock-badge locked">Locked</span>}
                </div>
                {!isDangerUnlocked && (
                  <form onSubmit={handleUnlockDangerZone} style={{ padding: '14px 16px', display: 'flex', gap: '8px' }}>
                    <input id="danger-password" type="password" className="bento-input" style={{ flex: 1, borderColor: dangerUnlockError ? '#ef4444' : undefined }}
                      value={dangerPassword} onChange={(e) => { setDangerPassword(e.target.value); setDangerUnlockError(''); }} placeholder="Password" autoComplete="current-password" />
                    <button type="submit" disabled={isUnlockingDanger || !dangerPassword.trim()}
                      style={{ padding: '10px 18px', borderRadius: '12px', fontWeight: 700, fontSize: '0.9rem', background: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', opacity: isUnlockingDanger || !dangerPassword.trim() ? 0.5 : 1 }}>
                      {isUnlockingDanger ? '…' : 'Unlock'}
                    </button>
                  </form>
                )}
                {dangerUnlockError && <p style={{ padding: '0 16px 12px', margin: 0, color: '#ef4444', fontSize: '0.82rem' }}>{dangerUnlockError}</p>}
              </div>
            </div>
            <div className="spoke-section">
              <div className="spoke-section-label">Destructive Actions</div>
              <fieldset disabled={!isDangerUnlocked} aria-disabled={!isDangerUnlocked}
                style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px', opacity: isDangerUnlocked ? 1 : 0.45, transition: 'opacity 0.2s' }}>
                {[
                  { label: "Clear Today's Data", hint: 'Delete all entries for today only', action: handleClearCurrentDay, text: 'Clear' },
                  { label: 'Clear Current Period', hint: 'Delete all entries in active period', action: handleClearCurrentPeriod, text: 'Clear' },
                  { label: 'Delete All Data', hint: 'Wipe all entries, periods & settings', action: handleClearAllData, text: 'Delete' },
                ].map(({ label, hint, action, text }) => (
                  <div key={label} style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <div><div className="spoke-row-label">{label}</div><div className="spoke-row-hint">{hint}</div></div>
                    <button type="button" className="spoke-btn-danger" style={{ width: 'auto' }} onClick={() => { hapticFeedback.error(); action(); }}>{text}</button>
                  </div>
                ))}
                <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: '16px', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div>
                    <div className="spoke-row-label" style={{ color: '#ef4444' }}>Delete Account</div>
                    <div className="spoke-row-hint">Permanently remove "<strong>{currentUser?.username}</strong>" — cannot be undone</div>
                  </div>
                  <button type="button" className="spoke-btn-danger" style={{ width: 'auto' }} onClick={() => { hapticFeedback.error(); handleDeleteAccount(); }}>Delete</button>
                </div>
              </fieldset>
            </div>
          </div>
        </ModalShell>
      )}



      {/* Export Modal */}
      <React.Suspense
        fallback={<div className="modal-loading-overlay">Loading...</div>}
      >
        {showExportModal && (
          <ExportModal onClose={() => setShowExportModal(false)} />
        )}

        {/* Import Modal */}
        {showImportModal && (
          <ImportModal onClose={() => setShowImportModal(false)} />
        )}
      </React.Suspense>

      {import.meta.env.DEV && showConflictPreview && (
        <ConflictResolutionModal
          conflicts={previewConflicts}
          onResolve={handleConflictPreviewResolve}
          onClose={() => setShowConflictPreview(false)}
        />
      )}

      {/* Notification Feedback Modal */}
      <AlertModal
        isOpen={notifModal.isOpen}
        title={notifModal.title || (notifModal.isError ? "Settings Error" : "Success")}
        message={notifModal.message}
        type={notifModal.isError ? "error" : "success"}
        onClose={() => setNotifModal({ ...notifModal, isOpen: false })}
      />

      {/* Test Notification Modal */}
      {showTestNotifModal && (
        <ModalShell onClose={() => setShowTestNotifModal(false)}>
          <div style={{ 
            display: "flex", 
            flexDirection: "column", 
            maxHeight: "80vh",
            maxWidth: "500px",
            width: "100%"
          }}>
            {/* Fixed Header */}
            <div style={{ padding: "20px", borderBottom: "1px solid #e0e0e0" }}>
              <h2 style={{ marginBottom: "10px" }}>🧪 Test Notifications</h2>
              <p className="help-text" style={{ marginBottom: "0" }}>
                Test different notification patterns to verify they work correctly
                on your device.
              </p>
              {!import.meta.env.PROD && (
                <p className="help-text" style={{ marginTop: "10px", fontSize: "12px", color: "#f57c00" }}>
                  ⚠️ Note: Browser notifications may be blocked in development mode (localhost).
                  Notifications will work properly in production (HTTPS).
                </p>
              )}
            </div>

            {/* Scrollable Content */}
            <div style={{
              padding: "20px",
              flex: 1,
              overflow: "visible"
            }}>
              <div className="form-group" style={{ marginBottom: "20px" }}>
                <label className="form-label">Test Pattern</label>
                <CustomSelect
                  value={testPattern}
                  onChange={(e) => setTestPattern(e.target.value)}
                  options={[
                    { label: "Single Notification", value: "single" },
                    { label: "Repeating Notifications", value: "repeating" },
                    { label: "Custom Pattern", value: "custom" },
                  ]}
                />
              </div>

              {testPattern === "repeating" && (
                <>
                  <div className="form-group" style={{ marginBottom: "20px" }}>
                    <label className="form-label">Number of Notifications</label>
                    <CustomSelect
                      value={testCount}
                      onChange={(e) => setTestCount(e.target.value)}
                      options={[
                        { label: "1", value: "1" },
                        { label: "2", value: "2" },
                        { label: "3", value: "3" },
                        { label: "5", value: "5" },
                        { label: "10", value: "10" },
                      ]}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: "20px" }}>
                    <label className="form-label">Interval (minutes)</label>
                    <CustomSelect
                      value={testInterval}
                      onChange={(e) => setTestInterval(e.target.value)}
                      options={[
                        { label: "1 minute", value: "1" },
                        { label: "5 minutes", value: "5" },
                        { label: "10 minutes", value: "10" },
                        { label: "15 minutes", value: "15" },
                        { label: "30 minutes", value: "30" },
                      ]}
                    />
                  </div>
                </>
              )}

              {testPattern === "custom" && (
                <>
                  <div className="form-group" style={{ marginBottom: "20px" }}>
                    <label className="form-label">Number of Notifications</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="form-input"
                      value={customTestCount}
                      onChange={(e) => setCustomTestCount(e.target.value)}
                      min="1"
                      max="100"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "16px"
                      }}
                    />
                    <p className="help-text" style={{ marginTop: "5px", fontSize: "12px" }}>
                      Enter the number of notifications to send (1-100)
                    </p>
                  </div>

                  <div className="form-group" style={{ marginBottom: "20px" }}>
                    <label className="form-label">Interval (minutes)</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="form-input"
                      value={customTestInterval}
                      onChange={(e) => setCustomTestInterval(e.target.value)}
                      min="1"
                      max="1440"
                      style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "16px"
                      }}
                    />
                    <p className="help-text" style={{ marginTop: "5px", fontSize: "12px" }}>
                      Enter the interval between notifications in minutes (1-1440)
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Fixed Footer */}
            <div style={{ 
              padding: "20px", 
              borderTop: "1px solid #e0e0e0",
              display: "flex", 
              gap: "10px" 
            }}>
              <button
                className="btn btn-primary"
                onClick={handleTestNotification}
                style={{ flex: 1 }}
              >
                Send Test
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setShowTestNotifModal(false)}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>
      )}

    </main>

  );
}

export default Settings;
