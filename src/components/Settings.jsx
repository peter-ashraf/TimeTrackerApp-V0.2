import React, { useState, useEffect } from "react";
import { useTimeTracker } from "../context/TimeTrackerContext";
import { useSupabaseAuth, supabase } from "../context/SupabaseAuthContext";
import { usePayPeriod } from "../context/PayPeriodContext";
import { supabaseData } from "../utils/supabaseData";
import hapticFeedback from "../utils/hapticFeedback";
import cacheManager from "../utils/cacheManager";
const ExportModal = React.lazy(() => import("./ExportModal"));
const ImportModal = React.lazy(() => import("./ImportModal"));
import ModalShell from "./ModalShell";
import { setSimpleEncryptedItem } from "../utils/simple-encryption";
import { useUserPreferences } from "../context/UserPreferencesContext";
import { notificationManager } from "../utils/notificationManager";
import CustomSelect from "./CustomSelect";
import "../styles/settings.css";

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

  // Validate name
  if (!name || name.trim().length === 0) {
    errors.push("Employee name is required");
  } else if (name.trim().length < 2) {
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

function Settings() {
  const {
    employee,
    leaveSettings,
    entries,
    periods,
    currentPeriodId,
    hideSalary,
    setEmployee,
    setLeaveSettings,
    clearAllData,
    confirmModal,
    setConfirmModal,
    setCurrentPeriod,
    setEntries,
    validateEmployeeType,
    calculateMonthlyHours,
  } = useTimeTracker();

  const { setPeriods } = usePayPeriod();
  const { reminderSettings, setReminderSettings } = useUserPreferences();

  // ✅ ADDED: Get auth functions
  const { currentUser, deleteUser } = useSupabaseAuth();

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

  // Leave settings form
  const [annualVacation, setAnnualVacation] = useState(
    leaveSettings.annualVacation ?? 10,
  );
  const [sickDays, setSickDays] = useState(leaveSettings.sickDays ?? 7);

  // Reminder settings form
  const [remindersEnabled, setRemindersEnabled] = useState(
    reminderSettings?.enabled ?? false,
  );
  const [reminderStartTime, setReminderStartTime] = useState(
    reminderSettings?.startTime ?? "09:00",
  );
  const [reminderCount, setReminderCount] = useState(
    reminderSettings?.reminderCount ?? 3,
  );
  const [reminderInterval, setReminderInterval] = useState(
    reminderSettings?.intervalMinutes ?? 15,
  );
  const [customReminderCount, setCustomReminderCount] = useState(
    reminderSettings?.reminderCount ?? 3,
  );
  const [customReminderInterval, setCustomReminderInterval] = useState(
    reminderSettings?.intervalMinutes ?? 15,
  );
  // Period management
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
    message: "",
  });

  // Test notification modal state
  const [showTestNotifModal, setShowTestNotifModal] = useState(false);
  const [testPattern, setTestPattern] = useState("single");
  const [testCount, setTestCount] = useState("1");
  const [testInterval, setTestInterval] = useState("5");
  const [customTestCount, setCustomTestCount] = useState("3");
  const [customTestInterval, setCustomTestInterval] = useState("10");

  // Haptic feedback state
  const [hapticEnabled, setHapticEnabled] = useState(
    hapticFeedback.isEnabled(),
  );

  // Diagnostics state
  const [cacheStatus, setCacheStatus] = useState({});
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
    readCacheStatus();
  }, []);

  useEffect(() => {
    setName(employee.name ?? "");
    setSalary(employee.salary ?? 0);
    setEmployeeType(employee.employeeType ?? "full-time");
    setDailyHours(employee.dailyHours ?? 9);
    setMonthlyHours(employee.monthlyHours ?? 187);
    setWorkDaysPerWeek(employee.workDaysPerWeek ?? 5);
  }, [employee]);

  useEffect(() => {
    setAnnualVacation(leaveSettings.annualVacation ?? 10);
    setSickDays(leaveSettings.sickDays ?? 7);
  }, [leaveSettings]);

  useEffect(() => {
    if (reminderSettings) {
      setRemindersEnabled(reminderSettings.enabled ?? false);
      setReminderStartTime(reminderSettings.startTime ?? "09:00");
      setReminderCount(reminderSettings.reminderCount ?? 3);
      setReminderInterval(reminderSettings.intervalMinutes ?? 15);
    }
  }, [reminderSettings]);

  // Check if we should open the Add Period modal (from Timesheet navigation)
  useEffect(() => {
    const shouldOpenAddPeriod = localStorage.getItem("shouldOpenAddPeriod");
    if (shouldOpenAddPeriod === "true") {
      localStorage.removeItem("shouldOpenAddPeriod");
      setEditingPeriodId(null);
      setNewPeriodStart("");
      setNewPeriodEnd("");
      setShowAddPeriod(true);
      // Scroll to the Pay Period Management section
      setTimeout(() => {
        const periodSection = document.querySelector(".settings-section h3");
        if (periodSection) {
          periodSection.scrollIntoView({ behavior: "smooth" });
        }
      }, 100);
    }
  }, []);

  // Auto-set full-time employee values when employee type changes
  useEffect(() => {
    if (employeeType === "full-time") {
      setDailyHours(9);
      setWorkDaysPerWeek(5);
      setMonthlyHours(187);
    }
  }, [employeeType]);

  const handleSaveAll = async (e) => {
    e.preventDefault();

    // Parse values
    const parsedSalary = parseFloat(salary) || 0;
    const parsedVacation = parseFloat(annualVacation) || 0;
    const parsedSickDays = parseFloat(sickDays) || 0;
    const parsedDailyHours = parseFloat(dailyHours) || 9;
    const parsedWorkDaysPerWeek = parseFloat(workDaysPerWeek) || 5;
    const parsedMonthlyHours = parseFloat(monthlyHours) || 187;

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
      setConfirmModal({
        isOpen: true,
        title: "⚠️ Validation Error",
        message: `Please fix the following errors:\n\n${errors.join("\n")}`,
        type: "danger",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
      });
      return; // Stop - don't save
    }

    // Check what changed (exclude salary if it's hidden) - use original employee state
    const originalName = employee.name;
    const nameChanged = name !== originalName;

    const salaryChanged = !hideSalary && parsedSalary !== employee.salary;
    const vacationChanged = parsedVacation !== leaveSettings.annualVacation;
    const sickDaysChanged = parsedSickDays !== leaveSettings.sickDays;
    const employeeTypeChanged = employeeType !== employee.employeeType;
    const dailyHoursChanged = parsedDailyHours !== employee.dailyHours;
    const workDaysPerWeekChanged =
      parsedWorkDaysPerWeek !== employee.workDaysPerWeek;
    const monthlyHoursChanged = parsedMonthlyHours !== employee.monthlyHours;

    const remindersEnabledChanged =
      remindersEnabled !== reminderSettings.enabled;
    const reminderStartTimeChanged =
      reminderStartTime !== reminderSettings.startTime;
    const reminderCountChanged =
      reminderCount !== reminderSettings.reminderCount;
    const reminderIntervalChanged =
      reminderInterval !== reminderSettings.intervalMinutes;

    const anyChanges =
      nameChanged ||
      salaryChanged ||
      vacationChanged ||
      sickDaysChanged ||
      employeeTypeChanged ||
      dailyHoursChanged ||
      workDaysPerWeekChanged ||
      monthlyHoursChanged ||
      remindersEnabledChanged ||
      reminderStartTimeChanged ||
      reminderCountChanged ||
      reminderIntervalChanged;

    // If nothing changed, alert user
    if (!anyChanges) {
      setConfirmModal({
        isOpen: true,
        title: "No Changes Detected",
        message: "You haven't made any changes to save.",
        type: "info",
        confirmText: "OK",
        showCancel: false,
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
      });
      return;
    }

    // Build list of what changed (exclude salary if hidden)
    const changedItems = [];
    if (nameChanged) changedItems.push(`• Name: ${employee.name} → ${name}`);
    if (salaryChanged)
      changedItems.push(`• Salary: ${employee.salary} → ${parsedSalary}`);
    if (employeeTypeChanged)
      changedItems.push(
        `• Employee Type: ${employee.employeeType} → ${employeeType}`,
      );
    if (dailyHoursChanged)
      changedItems.push(
        `• Daily Hours: ${employee.dailyHours} → ${parsedDailyHours}`,
      );
    if (workDaysPerWeekChanged)
      changedItems.push(
        `• Work Days/Week: ${employee.workDaysPerWeek} → ${parsedWorkDaysPerWeek}`,
      );
    if (monthlyHoursChanged)
      changedItems.push(
        `• Monthly Hours: ${employee.monthlyHours} → ${parsedMonthlyHours}`,
      );
    if (vacationChanged)
      changedItems.push(
        `• Vacation Days: ${leaveSettings.annualVacation} → ${parsedVacation}`,
      );
    if (sickDaysChanged)
      changedItems.push(
        `• Sick Days: ${leaveSettings.sickDays} → ${parsedSickDays}`,
      );
    if (remindersEnabledChanged)
      changedItems.push(
        `• Check-in Reminders: ${reminderSettings.enabled ? "On" : "Off"} → ${remindersEnabled ? "On" : "Off"}`,
      );
    if (reminderStartTimeChanged)
      changedItems.push(
        `• Reminder Start Time: ${reminderSettings.startTime} → ${reminderStartTime}`,
      );

    // Save all data (preserves unchanged values automatically, excludes salary if hidden)
    const employeeData = {
      name: name,
      employeeType: employeeType,
      dailyHours: parsedDailyHours,
      monthlyHours: parsedMonthlyHours,
      workDaysPerWeek: parsedWorkDaysPerWeek,
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
        monthlyHoursChanged
      ) {
        if (currentUser) {
          try {
            const result = await supabaseData.saveUserProfile(currentUser.id, {
              employee_type: employeeType,
              daily_hours: parsedDailyHours,
              monthly_hours: parsedMonthlyHours,
              work_days_per_week: parsedWorkDaysPerWeek,
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

    // NOW update local state after database save (or queue)
    setEmployee((prev) => ({ ...prev, ...employeeData }));
    setLeaveSettings((prev) => ({
      ...prev,
      annualVacation: parsedVacation,
      sickDays: parsedSickDays,
    }));

    // Update reminder settings
    if (
      remindersEnabledChanged ||
      reminderStartTimeChanged ||
      reminderCountChanged ||
      reminderIntervalChanged
    ) {
      const finalReminderCount = reminderCount === "custom" 
        ? parseInt(customReminderCount, 10) 
        : parseInt(reminderCount, 10);
      const finalReminderInterval = reminderInterval === "custom" 
        ? parseInt(customReminderInterval, 10) 
        : parseInt(reminderInterval, 10);

      setReminderSettings((prev) => ({
        ...prev,
        enabled: remindersEnabled,
        startTime: reminderStartTime,
        reminderCount: finalReminderCount,
        intervalMinutes: finalReminderInterval,
      }));
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

    setConfirmModal({
      isOpen: true,
      title: "✓ Settings Saved",
      message: summaryMessage,
      type: queue.length > 0 ? "warning" : "success",
      confirmText: "OK",
      showCancel: false,
      onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
    });
  };

  const categorizePeriods = () => {
    // First try to find current period using is_current flag
    let current = periods.find((p) => p.is_current === true);

    // Fallback to currentPeriodId if no is_current flag found
    if (!current) {
      current = periods.find((p) => String(p.id) === String(currentPeriodId));
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
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
      // Edit existing period
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
      onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
              setConfirmModal({ ...confirmModal, isOpen: false }),
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
              setConfirmModal({ ...confirmModal, isOpen: false }),
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
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
        onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
          onConfirm: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
              setConfirmModal({ ...confirmModal, isOpen: false }),
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
              setConfirmModal({ ...confirmModal, isOpen: false }),
          });
        }
      },
      onCancel: () => setConfirmModal({ ...confirmModal, isOpen: false }),
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
                setConfirmModal({ ...confirmModal, isOpen: false });
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
                setConfirmModal({ ...confirmModal, isOpen: false }),
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
              setConfirmModal({ ...confirmModal, isOpen: false }),
          });
        }
      },
      onCancel: () => setConfirmModal({ ...confirmModal, isOpen: false }),
    });
  };

  return (
    <main className="main-content">
      <h1>⚙️ Settings</h1>

      {/* ✅ UNIFIED EMPLOYEE INFORMATION & LEAVE SETTINGS */}
      <div className="settings-section">
        <h2>👤 Employee Information</h2>

        <form onSubmit={handleSaveAll}>
          {/* Full Name (Display Name) */}
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input
              type="text"
              className="form-control"
              value={name ?? ""}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your display name"
            />
            <small className="form-help">
              This is how your name appears throughout the app. Your login
              username (<strong>{currentUser?.username}</strong>) remains
              unchanged.
            </small>
          </div>

          {/* Monthly Salary */}
          {!hideSalary && (
            <div className="form-group">
              <label className="form-label">Monthly Salary (L.E.)</label>
              <input
                type="number"
                className="form-control"
                value={salary ?? 0}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="Enter monthly salary"
                min="0"
                step="0.01"
              />
            </div>
          )}

          {hideSalary && (
            <div className="form-group">
              <label className="form-label">Monthly Salary (L.E.)</label>
              <input
                type="text"
                className="form-control"
                value="******"
                disabled
                style={{
                  backgroundColor: "transparent",
                  color: "#6c757d",
                  cursor: "not-allowed",
                  filter: "blur(4px)",
                  userSelect: "none",
                }}
                readOnly
              />
              <p
                className="help-text"
                style={{
                  color: "#6c757d",
                  marginTop: "8px",
                  fontSize: "0.875rem",
                }}
              >
                💡 Salary is hidden for privacy. Toggle visibility in Dashboard
                to edit.
              </p>
            </div>
          )}

          {/* Employee Type */}
          <div className="form-group">
            <label className="form-label">Employee Type</label>
            <CustomSelect
              id="employee-type-select"
              name="employeeType"
              value={employeeType ?? "full-time"}
              onChange={(e) => setEmployeeType(e.target.value)}
              options={[
                { label: "Full-Time", value: "full-time" },
                { label: "Part-Time", value: "part-time" },
              ]}
            />
          </div>

          {/* Conditional fields for part-time employees */}
          {employeeType === "part-time" && (
            <>
              <div className="form-group">
                <label className="form-label">Daily Hours</label>
                <input
                  type="number"
                  className="form-control"
                  value={dailyHours ?? 9}
                  onChange={(e) => setDailyHours(e.target.value)}
                  placeholder="Enter daily work hours"
                  min="6"
                  max="9"
                  step="0.5"
                />
                <p
                  className="help-text"
                  style={{
                    color: "#6c757d",
                    marginTop: "8px",
                    fontSize: "0.875rem",
                  }}
                >
                  💡 Part-time employees work between 6-9 hours per day
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Work Days per Week</label>
                <CustomSelect
                  id="work-days-per-week-select"
                  name="workDaysPerWeek"
                  value={workDaysPerWeek ?? 5}
                  onChange={(e) => setWorkDaysPerWeek(e.target.value)}
                  options={[
                    { label: "3 days", value: "3" },
                    { label: "4 days", value: "4" },
                    { label: "5 days", value: "5" },
                  ]}
                />
                <p
                  className="help-text"
                  style={{
                    color: "#6c757d",
                    marginTop: "8px",
                    fontSize: "0.875rem",
                  }}
                >
                  💡 Part-time employees work between 3-5 days per week
                </p>
              </div>
            </>
          )}

          {/* Monthly Hours (display only - calculated differently per employee type) */}
          <div className="form-group">
            <label className="form-label">Monthly Hours</label>
            <input
              type="text"
              className="form-control"
              value={
                employeeType === "part-time"
                  ? "Calculated based on actual hours worked"
                  : (monthlyHours ?? 187)
              }
              disabled
              style={{
                backgroundColor: "transparent",
                color: "#6c757d",
                cursor: "not-allowed",
                userSelect: "none",
              }}
              readOnly
            />
            <p
              className="help-text"
              style={{
                color: "#6c757d",
                marginTop: "8px",
                fontSize: "0.875rem",
              }}
            >
              💡{" "}
              {employeeType === "part-time"
                ? `Monthly hours will be calculated based on actual hours worked during each pay period. This ensures accurate hourly rates for overtime calculations.`
                : "Fixed at 187 hours for full-time employees"}
            </p>
          </div>

          {/* Annual Vacation Days */}
          <div className="form-group">
            <label className="form-label">Annual Vacation Days</label>
            <input
              type="number"
              className="form-control"
              value={annualVacation ?? 10}
              onChange={(e) => setAnnualVacation(e.target.value)}
              placeholder="Enter annual vacation days"
              min="0"
              max="365"
            />
          </div>

          {/* Sick Days */}
          <div className="form-group">
            <label className="form-label">Sick Days</label>
            <input
              type="number"
              className="form-control"
              value={sickDays ?? 7}
              onChange={(e) => setSickDays(e.target.value)}
              placeholder="Enter sick days"
              min="0"
              max="365"
            />
          </div>

          {/* Single Save Button */}
          <button
            type="submit"
            className="btn btn-primary"
            onClick={() => hapticFeedback.buttonClick()}
          >
            💾 Save All Settings
          </button>
        </form>
      </div>

      {/* Check-in Reminders Settings */}
      <section className="settings-section">
        <h2>⏰ Check-in Reminders</h2>
        <p className="settings-description">
          Configure daily check-in reminders so you never forget to log your
          time.
        </p>

        <form onSubmit={handleSaveAll}>
          <div className="form-group">
            <div className="haptic-feedback-toggle">
              <label htmlFor="reminders-toggle" className="form-label">
                Enable Reminders
              </label>
              <div className="toggle-wrapper">
                <div className="haptic-toggle-switch">
                  <input
                    type="checkbox"
                    id="reminders-toggle"
                    checked={remindersEnabled}
                    onChange={(e) => setRemindersEnabled(e.target.checked)}
                  />
                  <label
                    htmlFor="reminders-toggle"
                    className="haptic-toggle-label"
                  >
                    <span className="haptic-toggle-slider"></span>
                  </label>
                </div>
                <span className="haptic-toggle-status-text">
                  {remindersEnabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </div>

          {remindersEnabled && (
            <>
              <div className="form-group">
                <label className="form-label">Start Time</label>
                <input
                  type="time"
                  className="form-control"
                  value={reminderStartTime}
                  onChange={(e) => setReminderStartTime(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Number of Reminders</label>
                {reminderCount === "custom" ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="number"
                      className="form-control"
                      value={customReminderCount}
                      onChange={(e) => setCustomReminderCount(e.target.value)}
                      min="1"
                      max="100"
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "16px"
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setReminderCount("3")}
                      style={{ padding: "10px 15px" }}
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    id="reminder-count"
                    name="reminderCount"
                    value={reminderCount}
                    onChange={(e) => setReminderCount(e.target.value)}
                    options={[
                      { label: "1 Reminder", value: "1" },
                      { label: "2 Reminders", value: "2" },
                      { label: "3 Reminders", value: "3" },
                      { label: "4 Reminders", value: "4" },
                      { label: "5 Reminders", value: "5" },
                      { label: "Custom", value: "custom" },
                    ]}
                  />
                )}
              </div>
              <div className="form-group">
                <label className="form-label">Interval between Reminders</label>
                {reminderInterval === "custom" ? (
                  <div style={{ display: "flex", gap: "10px" }}>
                    <input
                      type="number"
                      className="form-control"
                      value={customReminderInterval}
                      onChange={(e) => setCustomReminderInterval(e.target.value)}
                      min="1"
                      max="1440"
                      style={{
                        flex: 1,
                        padding: "10px",
                        border: "1px solid #ddd",
                        borderRadius: "4px",
                        fontSize: "16px"
                      }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setReminderInterval("15")}
                      style={{ padding: "10px 15px" }}
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <CustomSelect
                    id="reminder-interval"
                    name="reminderInterval"
                    value={reminderInterval}
                    onChange={(e) => setReminderInterval(e.target.value)}
                    options={[
                      { label: "5 Minutes", value: "5" },
                      { label: "10 Minutes", value: "10" },
                      { label: "15 Minutes", value: "15" },
                      { label: "30 Minutes", value: "30" },
                      { label: "Custom", value: "custom" },
                    ]}
                  />
                )}
              </div>

              <div style={{ marginTop: "15px", marginBottom: "20px" }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  disabled={!import.meta.env.PROD}
                  onClick={async () => {
                    try {
                      if (!currentUser) throw new Error("Please log in first");
                      const sub = await notificationManager.subscribeUser(
                        currentUser.id,
                      );
                      if (sub) {
                        setNotifModal({
                          isOpen: true,
                          isError: false,
                          message:
                            "Push notifications enabled successfully! You'll receive check-in reminders as configured.",
                        });
                      }
                    } catch (err) {
                      setNotifModal({
                        isOpen: true,
                        isError: true,
                        message: err.message,
                      });
                    }
                  }}
                >
                  🔔 Enable Push Notifications
                </button>
                {!import.meta.env.PROD && (
                  <p className="help-text" style={{ marginTop: "8px", fontSize: "12px", color: "#666" }}>
                    Push notifications are only available in production mode. Use the Test Notifications button below to test notifications in development.
                  </p>
                )}
                <p className="help-text" style={{ marginTop: "8px" }}>
                  <strong>Notes:<br /></strong>- Notifications only work if your phone is
                  connected to the internet and the app is added to your home
                  screen. <br/>- iOS requires this app to be added to the Home Screen
                  to receive notifications.
                </p>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: "15px", width: "100%" }}
                  onClick={() => setShowTestNotifModal(true)}
                >
                  🧪 Test Notifications
                </button>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                onClick={() => hapticFeedback.buttonClick()}
              >
                💾 Save Reminder Settings
              </button>
            </>
          )}
        </form>
      </section>

      {/* Haptic Feedback Settings */}
      <section className="settings-section">
        <h2>📳 Haptic Feedback</h2>
        <p className="settings-description">
          Control vibration feedback for button interactions and other UI
          actions.
        </p>

        <div className="form-group">
          <div className="haptic-feedback-toggle">
            <label htmlFor="haptic-toggle" className="form-label">
              Enable Haptic Feedback
            </label>
            <div className="toggle-wrapper">
              <div className="haptic-toggle-switch">
                <input
                  type="checkbox"
                  id="haptic-toggle"
                  checked={hapticEnabled}
                  onChange={() => {
                    hapticFeedback.toggleSwitch();
                    handleHapticToggle();
                  }}
                  disabled={!hapticFeedback.isSupported()}
                />
                <label htmlFor="haptic-toggle" className="haptic-toggle-label">
                  <span className="haptic-toggle-slider"></span>
                </label>
              </div>
              <span className="haptic-toggle-status-text">
                {hapticEnabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
          {!hapticFeedback.isSupported() && (
            <p
              className="help-text"
              style={{ color: "#6c757d", marginTop: "8px" }}
            >
              ⚠️ Haptic feedback is not supported on this device/browser.
            </p>
          )}
          {hapticFeedback.isSupported() && (
            <p
              className="help-text"
              style={{ color: "#6c757d", marginTop: "8px" }}
            >
              💡 Provides vibration feedback for button clicks, check-in/out
              actions, and other interactions.
            </p>
          )}
        </div>

        {hapticEnabled && hapticFeedback.isSupported() && (
          <div className="form-group">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => {
                hapticFeedback.buttonClick();
                hapticFeedback.testAll();
              }}
            >
              🎯 Test All Vibration Patterns
            </button>
            <p className="help-text" style={{ marginTop: "8px" }}>
              Test different vibration patterns used throughout the app.
            </p>
          </div>
        )}
      </section>

      {/* Pay Periods Management */}
      <section className="settings-section">
        <h3>📅 Pay Period Management</h3>
        <p className="settings-description">
          Define custom pay periods for your timesheet. Periods must be
          continuous with no gaps or overlaps.
        </p>

        <div className="periods-list">
          {/* Previous Periods Accordion */}
          {previous.length > 0 && (
            <div className="period-section">
              <button
                className="period-accordion-header"
                onClick={() => setShowPrevious(!showPrevious)}
              >
                <span className="accordion-icon">
                  {showPrevious ? "▼" : "▶"}
                </span>
                <span className="period-section-header-text">
                  PREVIOUS PERIODS ({previous.length})
                </span>
              </button>

              {showPrevious && (
                <div className="period-section-content accordion-content">
                  {previous.map((period) => (
                    <div key={period.id} className="period-item">
                      <div className="period-info">
                        <span className="period-label">{period.label}</span>
                      </div>
                      <div className="period-actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setCurrentPeriod(period.id)}
                          disabled={period.id.startsWith("period-")}
                        >
                          {period.id.startsWith("period-")
                            ? "Saving..."
                            : "Set as Current"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setEditingPeriodId(period.id);
                            setNewPeriodStart(
                              period.start_date || period.start,
                            );
                            setNewPeriodEnd(period.end_date || period.end);
                            setShowAddPeriod(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeletePeriod(period.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current Period Section */}
          {current && (
            <div className="period-section">
              <h4 className="period-section-header current-period-header">
                📅 CURRENT PERIOD
              </h4>
              <div className="period-section-content">
                <div className="period-item period-current">
                  <div className="period-info">
                    <span className="period-label">{current.label}</span>
                    <span className="period-badge">Current</span>
                  </div>
                  <div className="period-actions">
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        setEditingPeriodId(current.id);
                        setNewPeriodStart(current.start_date || current.start);
                        setNewPeriodEnd(current.end_date || current.end);
                        setShowAddPeriod(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDeletePeriod(current.id)}
                      disabled={periods.length === 1}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Periods Accordion */}
          {upcoming.length > 0 && (
            <div className="period-section">
              <button
                className="period-accordion-header"
                onClick={() => setShowUpcoming(!showUpcoming)}
              >
                <span className="accordion-icon">
                  {showUpcoming ? "▼" : "▶"}
                </span>
                <span className="period-section-header-text">
                  UPCOMING PERIODS ({upcoming.length})
                </span>
              </button>

              {showUpcoming && (
                <div className="period-section-content accordion-content">
                  {upcoming.map((period) => (
                    <div key={period.id} className="period-item">
                      <div className="period-info">
                        <span className="period-label">{period.label}</span>
                      </div>
                      <div className="period-actions">
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setCurrentPeriod(period.id)}
                          disabled={period.id.startsWith("period-")}
                        >
                          {period.id.startsWith("period-")
                            ? "Saving..."
                            : "Set as Current"}
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => {
                            setEditingPeriodId(period.id);
                            setNewPeriodStart(
                              period.start_date || period.start,
                            );
                            setNewPeriodEnd(period.end_date || period.end);
                            setShowAddPeriod(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleDeletePeriod(period.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="period-actions-bar">
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingPeriodId(null);
              setNewPeriodStart("");
              setNewPeriodEnd("");
              setShowAddPeriod(true);
            }}
          >
            ➕ Add Pay Period
          </button>
        </div>

        {/* Add Period Modal */}
        {showAddPeriod && (
          <ModalShell
            onClose={() => setShowAddPeriod(false)}
            closeOnOverlay={false}
          >
            <form onSubmit={handleAddPeriod}>
              <h3>
                {editingPeriodId ? "Edit Pay Period" : "Add New Pay Period"}
              </h3>
              <p className="settings-description">
                Period label will be automatically generated from the dates
              </p>

              <div className="form-group">
                <label className="form-label">Start Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newPeriodStart}
                  onChange={(e) => setNewPeriodStart(e.target.value)}
                  max={newPeriodEnd || undefined}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">End Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newPeriodEnd}
                  onChange={(e) => setNewPeriodEnd(e.target.value)}
                  min={newPeriodStart || undefined}
                  required
                />
              </div>

              {newPeriodStart && newPeriodEnd && (
                <div className="form-group">
                  <label className="form-label">Generated Label Preview</label>
                  <div className="period-preview">
                    {(() => {
                      const startDate = new Date(newPeriodStart);
                      const endDate = new Date(newPeriodEnd);
                      const formatDate = (date) => {
                        const day = date.getDate();
                        const month = date.toLocaleString("en-US", {
                          month: "short",
                        });
                        return `${day} ${month}`;
                      };
                      return `${formatDate(startDate)} - ${formatDate(endDate)} ${endDate.getFullYear()}`;
                    })()}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" className="btn btn-primary">
                  {editingPeriodId ? "Update Period" : "Add Period"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddPeriod(false);
                    setEditingPeriodId(null);
                    setNewPeriodStart("");
                    setNewPeriodEnd("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </ModalShell>
        )}
      </section>

      {/* NEW: Export/Import Data Section */}
      <section className="settings-section">
        <h2>📊 Data Management</h2>
        <p className="settings-description">
          Export your timesheet data to Excel or import data from a previous
          backup.
        </p>

        <div className="data-management-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              hapticFeedback.buttonClick();
              handleOpenExport();
            }}
            data-export-btn
          >
            📥 Export Data
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => {
              hapticFeedback.buttonClick();
              setShowImportModal(true);
            }}
          >
            📤 Import Data
          </button>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="settings-section danger-zone">
        <h2>⚠️ Danger Zone</h2>

        <div className="danger-actions">
          <button
            className="btn btn-danger"
            onClick={() => {
              hapticFeedback.error();
              handleClearCurrentDay();
            }}
          >
            🗑️ Clear Today's Data
          </button>
          <p className="help-text">Delete all time entries for today only.</p>

          <button
            className="btn btn-danger"
            onClick={() => {
              hapticFeedback.error();
              handleClearCurrentPeriod();
            }}
          >
            🗑️ Clear Current Period Data
          </button>
          <p className="help-text">
            Delete all entries in the current pay period.
          </p>

          <button
            className="btn btn-danger"
            onClick={() => {
              hapticFeedback.error();
              handleClearAllData();
            }}
          >
            🗑️ Delete All Data
          </button>
          <p className="help-text">
            Delete all your timesheet data (entries, periods, settings).
          </p>

          {/* ✅ NEW: Delete Account */}
          <button
            className="btn btn-danger"
            onClick={() => {
              hapticFeedback.error();
              handleDeleteAccount();
            }}
            style={{
              marginTop: "20px",
              borderTop: "2px solid #dc3545",
              paddingTop: "20px",
            }}
          >
            ☠️ Delete Account
          </button>
          <p
            className="help-text"
            style={{ marginTop: "20px", color: "#dc3545", fontWeight: "bold" }}
          >
            ⚠️ PERMANENTLY delete your account "{currentUser?.username}" and ALL
            associated data. This cannot be undone!
          </p>
        </div>
      </section>

      {/* Diagnostics Section */}
      <section className="settings-section">
        <h2>🔧 Diagnostics</h2>
        <p className="settings-description">
          Developer tools for troubleshooting and deployment verification.
        </p>

        {/* Cache Status Panel */}
        <div className="diagnostics-panel">
          <div className="diagnostics-panel-header">
            <h3>Cache Status</h3>
            <button
              className="btn btn-sm btn-outline"
              onClick={() => {
                hapticFeedback.buttonClick();
                readCacheStatus();
              }}
            >
              🔄 Refresh
            </button>
          </div>
          <table className="diagnostics-table">
            <thead>
              <tr>
                <th>Cache Key</th>
                <th>Status</th>
                <th>Entry Count / Size</th>
                <th>Last Cached</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>timeEntries</td>
                <td>
                  {cacheStatus.timeEntries?.status === "cached" ? (
                    <span style={{ color: "#28a745" }}>✅ Cached</span>
                  ) : (
                    <span style={{ color: "#dc3545" }}>❌ Empty</span>
                  )}
                </td>
                <td>{cacheStatus.timeEntries?.entryCount || "-"}</td>
                <td>{cacheStatus.timeEntries?.lastCached || "-"}</td>
              </tr>
              <tr>
                <td>payPeriods</td>
                <td>
                  {cacheStatus.payPeriods?.status === "cached" ? (
                    <span style={{ color: "#28a745" }}>✅ Cached</span>
                  ) : (
                    <span style={{ color: "#dc3545" }}>❌ Empty</span>
                  )}
                </td>
                <td>{cacheStatus.payPeriods?.entryCount || "-"}</td>
                <td>{cacheStatus.payPeriods?.lastCached || "-"}</td>
              </tr>
              <tr>
                <td>currentPeriod</td>
                <td>
                  {cacheStatus.currentPeriod?.status === "cached" ? (
                    <span style={{ color: "#28a745" }}>✅ Cached</span>
                  ) : (
                    <span style={{ color: "#dc3545" }}>❌ Empty</span>
                  )}
                </td>
                <td>{cacheStatus.currentPeriod?.entryCount || "-"}</td>
                <td>{cacheStatus.currentPeriod?.lastCached || "-"}</td>
              </tr>
              <tr>
                <td>userProfile</td>
                <td>
                  {cacheStatus.userProfile?.status === "cached" ? (
                    <span style={{ color: "#28a745" }}>✅ Cached</span>
                  ) : (
                    <span style={{ color: "#dc3545" }}>❌ Empty</span>
                  )}
                </td>
                <td>{cacheStatus.userProfile?.entryCount || "-"}</td>
                <td>{cacheStatus.userProfile?.lastCached || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Build Info Panel */}
        <div className="diagnostics-panel" style={{ marginTop: "20px" }}>
          <div className="diagnostics-panel-header">
            <h3>Build Info</h3>
          </div>
          <table className="diagnostics-table">
            <tbody>
              <tr>
                <td>
                  <strong>App Version</strong>
                </td>
                <td>
                  v
                  {typeof __APP_VERSION__ !== "undefined"
                    ? __APP_VERSION__
                    : "0.1.0"}
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Built At</strong>
                </td>
                <td>
                  {typeof __BUILD_TIME__ !== "undefined"
                    ? new Date(__BUILD_TIME__).toLocaleString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Unknown"}
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Commit</strong>
                </td>
                <td>
                  {typeof __GIT_COMMIT__ !== "undefined"
                    ? __GIT_COMMIT__.substring(0, 7)
                    : "local"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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

      {/* Notification Feedback Modal */}
      {notifModal.isOpen && (
        <ModalShell onClose={() => setNotifModal({ ...notifModal, isOpen: false })}>
          <div style={{ padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "20px" }}>
              {notifModal.isError ? "❌" : "✅"}
            </div>
            <h2 style={{ marginBottom: "15px", color: notifModal.isError ? "#dc3545" : "#28a745" }}>
              {notifModal.isError ? "Notification Error" : "Success"}
            </h2>
            <p style={{ fontSize: "16px", lineHeight: "1.5", color: "#666" }}>
              {notifModal.message}
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: "25px" }}
              onClick={() => setNotifModal({ ...notifModal, isOpen: false })}
            >
              OK
            </button>
          </div>
        </ModalShell>
      )}

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
