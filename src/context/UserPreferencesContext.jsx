import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useSupabaseAuth } from "./SupabaseAuthContext";
import { supabaseData } from "../utils/supabaseData";
import {
  setSimpleEncryptedItem,
  getSimpleEncryptedItem,
} from "../utils/simple-encryption";
import { multiTabSync } from "../utils/multiTabSync";
import cacheManager from "../utils/cacheManager";

const UserPreferencesContext = createContext();

const DEFAULT_LEAVE_SETTINGS = {
  annualVacation: 10,
  sickDays: 7,
  personalDays: 2,
  usedVacationDays: 0,
  usedSickDays: 0,
  usedPersonalDays: 0,
};

const toFiniteNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeLeaveSettings = (settings = {}) => ({
  annualVacation: toFiniteNumber(
    settings.annualVacation ?? settings.annual_vacation,
    DEFAULT_LEAVE_SETTINGS.annualVacation,
  ),
  sickDays: toFiniteNumber(
    settings.sickDays ?? settings.sick_days,
    DEFAULT_LEAVE_SETTINGS.sickDays,
  ),
  personalDays: toFiniteNumber(
    settings.personalDays ?? settings.personal_days,
    DEFAULT_LEAVE_SETTINGS.personalDays,
  ),
  usedVacationDays: toFiniteNumber(
    settings.usedVacationDays ?? settings.used_vacation_days,
    DEFAULT_LEAVE_SETTINGS.usedVacationDays,
  ),
  usedSickDays: toFiniteNumber(
    settings.usedSickDays ?? settings.used_sick_days,
    DEFAULT_LEAVE_SETTINGS.usedSickDays,
  ),
  usedPersonalDays: toFiniteNumber(
    settings.usedPersonalDays ?? settings.used_personal_days,
    DEFAULT_LEAVE_SETTINGS.usedPersonalDays,
  ),
});

const normalizeReminderTime = (value, fallback = "09:00") => {
  if (typeof value !== "string") return fallback;
  const match = value.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : fallback;
};

const getLeaveSettingsUpdatedAtKey = (userId) =>
  `leaveSettingsUpdatedAt_${userId}`;

const getTimestampMs = (value) => {
  if (!value) return 0;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider",
    );
  }
  return context;
};

export const UserPreferencesProvider = ({ children }) => {
  const { currentUser, isAuthenticated, getUserData, saveUserData } =
    useSupabaseAuth();

  // Theme State (app-wide)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("theme") || "system";
  });

  // Helper to get active theme (light or dark)
  const getActiveTheme = useCallback((baseTheme) => {
    if (baseTheme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return baseTheme;
  }, []);

  const [activeTheme, setActiveTheme] = useState(() => getActiveTheme(theme));

  // UI Preferences
  const [hideSalary, setHideSalary] = useState(() => {
    const saved = localStorage.getItem("hideSalary");
    return saved === "true";
  });

  const [use12Hour, setUse12Hour] = useState(() => {
    const saved = localStorage.getItem("use12HourFormat");
    return saved !== "false";
  });

  const [detailedView, setDetailedView] = useState(() => {
    const saved = localStorage.getItem("detailedView");
    return saved === "true";
  });

  // Employee Data
  const [employee, setEmployee] = useState({
    name: "",
    salary: 0,
    employeeType: "full-time",
    dailyHours: 9,
    monthlyHours: 187,
    workDaysPerWeek: 5,
  });

  // Leave Settings
  const [leaveSettings, setLeaveSettings] = useState(DEFAULT_LEAVE_SETTINGS);

  // Reminder Settings
  const [reminderSettings, setReminderSettings] = useState({
    enabled: false,
    startTime: "09:00",
    reminderCount: 3,
    intervalMinutes: 15,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  const isInitialSyncCompleted = useRef(false);

  // Load user preferences
  const loadUserPreferences = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;

    try {
      // Load from local storage immediately
      const salaryKey = `salary_${currentUser.id}`;
      const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
      const reminderSettingsKey = `reminderSettings_${currentUser.id}`;
      const leaveSettingsCacheKey = `leaveSettings_${currentUser.id}`;

      let localSalary =
        getSimpleEncryptedItem(salaryKey, currentUser.username) ?? 0;

      // Try cacheManager first for instant loading
      let localLeaveSettings = null;
      try {
        const cachedLeaveSettings = await cacheManager.getCachedData(
          leaveSettingsCacheKey,
          null,
        );
        if (cachedLeaveSettings) {
          localLeaveSettings = cachedLeaveSettings;
        }
      } catch (cacheError) {
        console.warn(
          "CacheManager failed for leaveSettings, falling back to localStorage:",
          cacheError,
        );
      }

      // Fallback to encrypted localStorage if cacheManager fails or returns empty
      if (!localLeaveSettings) {
        localLeaveSettings = getSimpleEncryptedItem(
          leaveSettingsKey,
          currentUser.username,
        ) ?? DEFAULT_LEAVE_SETTINGS;
      }

      setEmployee((prev) => ({
        ...prev,
        name:
          localStorage.getItem("userDisplayName") ??
          currentUser.fullName ??
          currentUser.username ??
          "User",
        salary: localSalary ?? 0,
      }));
      setLeaveSettings(normalizeLeaveSettings(localLeaveSettings));

      let localReminderSettings = null;
      try {
        const cachedReminderSettings = await cacheManager.getCachedData(
          "reminderSettings",
          null,
        );
        if (cachedReminderSettings)
          localReminderSettings = cachedReminderSettings;
      } catch (e) {
        console.warn("CacheManager failed for reminderSettings", e);
      }
      if (!localReminderSettings) {
        localReminderSettings = getSimpleEncryptedItem(
          reminderSettingsKey,
          currentUser.username,
        ) ?? {
          enabled: false,
          startTime: "09:00",
          reminderCount: 3,
          intervalMinutes: 15,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        };
      }
      setReminderSettings(localReminderSettings);

      // Defer Supabase sync
      setTimeout(async () => {
        if (navigator.onLine && currentUser && !currentUser.isLocalOnly) {
          try {
            const [profileData, leaveSettingsData, reminderData] =
              await Promise.all([
                supabaseData.getUserProfile(currentUser.id).catch((err) => {
                  if (
                    err.message?.includes("Unauthorized") ||
                    err.message?.includes("401")
                  ) {
                    console.warn(
                      "Session expired during profile fetch in UserPreferencesContext",
                    );
                    return null;
                  }
                  throw err;
                }),
                supabaseData.getLeaveSettings(currentUser.id).catch((err) => {
                  if (
                    err.message?.includes("Unauthorized") ||
                    err.message?.includes("401")
                  ) {
                    console.warn(
                      "Session expired during leave settings fetch in UserPreferencesContext",
                    );
                    return null;
                  }
                  throw err;
                }),
                supabaseData
                  .getReminderPreferences(currentUser.id)
                  .catch((err) => {
                    if (
                      err.message?.includes("Unauthorized") ||
                      err.message?.includes("401")
                    ) {
                      console.warn(
                        "Session expired during reminder settings fetch in UserPreferencesContext",
                      );
                      return null;
                    }
                    throw err;
                  }),
              ]);

            if (profileData) {
              // Check if user recently changed name locally (within last 5 seconds)
              const lastNameChange = localStorage.getItem(
                "userDisplayNameTimestamp",
              );
              const recentlyChanged =
                lastNameChange && Date.now() - parseInt(lastNameChange) < 5000;

              setEmployee((prev) => ({
                ...prev,
                // Don't overwrite local name if user just changed it
                name: recentlyChanged
                  ? prev.name
                  : (profileData.full_name ?? prev.name),
                employeeType: profileData.employee_type ?? "full-time",
                dailyHours: profileData.daily_hours ?? 9,
                monthlyHours: profileData.monthly_hours ?? 187,
                workDaysPerWeek: profileData.work_days_per_week ?? 5,
              }));
            }

            if (leaveSettingsData) {
              const normalizedCloudLeaveSettings =
                normalizeLeaveSettings(leaveSettingsData);
              const localUpdatedAt = getTimestampMs(
                localStorage.getItem(getLeaveSettingsUpdatedAtKey(currentUser.id)),
              );
              const cloudUpdatedAt = getTimestampMs(leaveSettingsData.updated_at);
              const localIsNewer =
                localUpdatedAt > 0 && cloudUpdatedAt > 0 && localUpdatedAt > cloudUpdatedAt + 1000;

              if (localIsNewer) {
                const normalizedLocal =
                  normalizeLeaveSettings(localLeaveSettings);

                try {
                  await supabaseData.saveLeaveSettings(currentUser.id, {
                    annual_vacation: normalizedLocal.annualVacation,
                    sick_days: normalizedLocal.sickDays,
                    personal_days: normalizedLocal.personalDays,
                    used_vacation_days: normalizedLocal.usedVacationDays,
                    used_sick_days: normalizedLocal.usedSickDays,
                    used_personal_days: normalizedLocal.usedPersonalDays,
                  });
                } catch (saveError) {
                  console.error(
                    "Failed to push newer local leave settings to Supabase:",
                    saveError,
                  );
                }
              } else {
                setLeaveSettings(normalizedCloudLeaveSettings);
                setSimpleEncryptedItem(
                  leaveSettingsKey,
                  normalizedCloudLeaveSettings,
                  currentUser.username,
                );
                localStorage.setItem(
                  getLeaveSettingsUpdatedAtKey(currentUser.id),
                  String(cloudUpdatedAt || Date.now()),
                );
                cacheManager.setCachedData(
                  leaveSettingsCacheKey,
                  normalizedCloudLeaveSettings,
                );
              }
            } else {
              // If no settings exist on Supabase, initialize the DB record with local/default data
              const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
              const currentLocal = getSimpleEncryptedItem(
                leaveSettingsKey,
                currentUser.username,
              ) ?? DEFAULT_LEAVE_SETTINGS;
              const normalizedLocal = normalizeLeaveSettings(currentLocal);

              try {
                await supabaseData.saveLeaveSettings(currentUser.id, {
                  annual_vacation: normalizedLocal.annualVacation,
                  sick_days: normalizedLocal.sickDays,
                  personal_days: normalizedLocal.personalDays,
                  used_vacation_days: normalizedLocal.usedVacationDays,
                  used_sick_days: normalizedLocal.usedSickDays,
                  used_personal_days: normalizedLocal.usedPersonalDays,
                });
                cacheManager.setCachedData(
                  leaveSettingsCacheKey,
                  normalizedLocal,
                );
              } catch (saveError) {
                console.error(
                  "Failed to initialize leave settings on Supabase:",
                  saveError,
                );
              }
            }

            if (reminderData) {
              setReminderSettings({
                enabled: reminderData.enabled ?? false,
                startTime: normalizeReminderTime(reminderData.start_time),
                reminderCount: reminderData.reminder_count ?? 3,
                intervalMinutes: reminderData.interval_minutes ?? 15,
                timezone:
                  reminderData.timezone ??
                  (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
              });
            } else {
              const rKey = `reminderSettings_${currentUser.id}`;
              const currentLocalR = getSimpleEncryptedItem(
                rKey,
                currentUser.username,
              ) ?? {
                enabled: false,
                startTime: "09:00",
                reminderCount: 3,
                intervalMinutes: 15,
                timezone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
              };
              try {
                await supabaseData.saveReminderPreferences(currentUser.id, {
                  enabled: currentLocalR.enabled,
                  start_time: normalizeReminderTime(currentLocalR.startTime),
                  reminder_count: currentLocalR.reminderCount,
                  interval_minutes: currentLocalR.intervalMinutes,
                  timezone: currentLocalR.timezone,
                });
              } catch (saveError) {
                console.error(
                  "Failed to initialize reminder settings on Supabase:",
                  saveError,
                );
              }
            }
          } catch (onlineError) {
            console.error(
              "Failed to fetch user preferences from Supabase, staying with local data",
              onlineError,
            );
          } finally {
            isInitialSyncCompleted.current = true;
          }
        } else {
          isInitialSyncCompleted.current = true;
        }
      }, 300);
    } catch (error) {
      console.error("loadUserPreferences critical error:", error);
      isInitialSyncCompleted.current = true;
    }
  }, [currentUser, isAuthenticated]);

  // Save employee data
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted.current) return;

    const saveEmployeeData = async () => {
      // Save salary to encrypted localStorage immediately
      const salaryKey = `salary_${currentUser.id}`;
      setSimpleEncryptedItem(salaryKey, employee.salary, currentUser.username);

      try {
        // Only save employee type fields to Supabase - NEVER save full_name automatically!
        // full_name should only be updated when user explicitly changes it in Settings
        await supabaseData.saveUserProfile(currentUser.id, {
          // ❌ CRITICAL: Never save full_name automatically - it overwrites database!
          // full_name: employee.name, // REMOVED - this was overwriting the database!
          employee_type: employee.employeeType,
          daily_hours: employee.dailyHours,
          monthly_hours: employee.monthlyHours,
          work_days_per_week: employee.workDaysPerWeek,
        });
      } catch (error) {
        console.error("Failed to save employee data:", error);
      }
    };

    saveEmployeeData();
    multiTabSync.notifyDataChange("employee", employee, currentUser.username);
  }, [employee, currentUser]);

  // Save leave settings
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted.current) return;

    const saveLeaveSettingsData = async () => {
      const normalizedLeaveSettings = normalizeLeaveSettings(leaveSettings);

      // Always save to localStorage immediately to keep local cache sync'd
      const leaveSettingsKey = `leaveSettings_${currentUser.id}`;
      setSimpleEncryptedItem(
        leaveSettingsKey,
        normalizedLeaveSettings,
        currentUser.username,
      );
      localStorage.setItem(
        getLeaveSettingsUpdatedAtKey(currentUser.id),
        String(Date.now()),
      );

      // Also save to cacheManager for offline access
      try {
        cacheManager.setCachedData(
          `leaveSettings_${currentUser.id}`,
          normalizedLeaveSettings,
        );
      } catch (cacheError) {
        console.warn(
          "Failed to save leaveSettings to cacheManager:",
          cacheError,
        );
      }

      try {
        await supabaseData.saveLeaveSettings(currentUser.id, {
          annual_vacation: normalizedLeaveSettings.annualVacation,
          sick_days: normalizedLeaveSettings.sickDays,
          personal_days: normalizedLeaveSettings.personalDays,
          used_vacation_days: normalizedLeaveSettings.usedVacationDays,
          used_sick_days: normalizedLeaveSettings.usedSickDays,
          used_personal_days: normalizedLeaveSettings.usedPersonalDays,
        });
      } catch (error) {
        console.error("Failed to save leave settings:", error);
      }
    };

    saveLeaveSettingsData();
    multiTabSync.notifyDataChange(
      "leaveSettings",
      leaveSettings,
      currentUser.username,
    );
  }, [leaveSettings, currentUser]);

  // Save reminder settings
  useEffect(() => {
    if (!currentUser || !isInitialSyncCompleted.current) return;

    const saveReminderSettingsData = async () => {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      // Ensure timezone is valid and up to date
      const settingsToSave = {
        ...reminderSettings,
        timezone: reminderSettings.timezone || timezone,
      };

      const remKey = `reminderSettings_${currentUser.id}`;
      setSimpleEncryptedItem(remKey, settingsToSave, currentUser.username);

      try {
        cacheManager.setCachedData("reminderSettings", settingsToSave);
      } catch (cacheError) {
        console.warn(
          "Failed to save reminderSettings to cacheManager:",
          cacheError,
        );
      }

      try {
        await supabaseData.saveReminderPreferences(currentUser.id, {
          enabled: settingsToSave.enabled,
          start_time: normalizeReminderTime(settingsToSave.startTime),
          reminder_count: settingsToSave.reminderCount,
          interval_minutes: settingsToSave.intervalMinutes,
          timezone: settingsToSave.timezone,
        });
      } catch (error) {
        console.error("Failed to save reminder settings:", error);
      }
    };

    saveReminderSettingsData();
    multiTabSync.notifyDataChange(
      "reminderSettings",
      reminderSettings,
      currentUser.username,
    );
  }, [reminderSettings, currentUser]);

  // Update theme-color meta tag for PWA and iOS status bar
  const updateThemeColorMeta = useCallback((currentActiveTheme) => {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.getElementsByTagName("head")[0].appendChild(meta);
    }

    // Exact colors from public/css/styles.css
    // Light: var(--color-background) -> #fcfcf9 (Cream 50)
    // Dark: var(--color-background) -> #1f2121 (Charcoal 700)
    const color = currentActiveTheme === "dark" ? "#1f2121" : "#fcfcf9";
    meta.setAttribute("content", color);
  }, []);

  // Persist UI preferences and handle theme changes
  useEffect(() => {
    localStorage.setItem("theme", theme);

    const handleThemeChange = () => {
      const newActiveTheme = getActiveTheme(theme);
      setActiveTheme(newActiveTheme);
      document.documentElement.setAttribute("data-theme", newActiveTheme);
      updateThemeColorMeta(newActiveTheme);
    };

    handleThemeChange();

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", handleThemeChange);
      return () => mediaQuery.removeEventListener("change", handleThemeChange);
    }
  }, [theme, getActiveTheme, updateThemeColorMeta]);

  useEffect(() => {
    localStorage.setItem("hideSalary", hideSalary);
  }, [hideSalary]);

  useEffect(() => {
    localStorage.setItem("use12HourFormat", use12Hour);
  }, [use12Hour]);

  useEffect(() => {
    localStorage.setItem("detailedView", detailedView);
  }, [detailedView]);

  // Load preferences when user changes
  useEffect(() => {
    if (currentUser && isAuthenticated) {
      loadUserPreferences();
    } else {
      // Reset to defaults
      setEmployee({
        name: "",
        salary: 0,
        employeeType: "full-time",
        dailyHours: 9,
        monthlyHours: 187,
        workDaysPerWeek: 5,
      });
      setLeaveSettings(DEFAULT_LEAVE_SETTINGS);
      isInitialSyncCompleted.current = false;
    }
  }, [currentUser, isAuthenticated, loadUserPreferences]);

  const contextValue = {
    // Employee data
    employee,
    setEmployee,

    // Leave settings
    leaveSettings,
    setLeaveSettings,

    // Reminder settings
    reminderSettings,
    setReminderSettings,

    // UI preferences
    theme,
    setTheme,
    activeTheme,
    hideSalary,
    setHideSalary,
    use12Hour,
    setUse12Hour,
    detailedView,
    setDetailedView,

    // Data operations
    loadUserPreferences,
  };

  return (
    <UserPreferencesContext.Provider value={contextValue}>
      {children}
    </UserPreferencesContext.Provider>
  );
};
