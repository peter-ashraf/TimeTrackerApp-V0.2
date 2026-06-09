import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
} from "react";

import { Routes, Route, Navigate } from "react-router-dom";

import { useTimeTracker } from "./context/TimeTrackerContext";

import { useSupabaseAuth } from "./context/SupabaseAuthContext";

import { useTimeEntry } from "./context/TimeEntryContext";

import { useInstantData } from "./hooks/useInstantData";

import { backgroundSync } from "./utils/backgroundSync-enhanced";

import { supabaseData } from "./utils/supabaseData";
import { notificationManager } from "./utils/notificationManager";
import Header from "./components/Header";

import AppLoading from "./components/AppLoading";

import RefreshIndicator from "./components/RefreshIndicator";

import ConfirmModal from "./components/ConfirmModal";

import NetworkStatus from "./components/NetworkStatus";

import ConflictResolutionModal from "./components/ConflictResolutionModal";

import "./styles/app-transitions.css";

import "./styles/fixed-header.css";

// Lazy load major view components

const Dashboard = React.lazy(() => import("./components/Dashboard"));

import DashboardSkeleton from "./components/DashboardSkeleton";

const Timesheet = React.lazy(() => import("./components/Timesheet"));

const Settings = React.lazy(() => import("./components/Settings"));

const LoginScreen = React.lazy(() => import("./components/LoginScreen"));

const PasswordResetPage = React.lazy(
  () => import("./components/PasswordResetPage"),
);

function App() {
  const [currentView, setCurrentView] = useState("dashboard");

  const [isSwiping, setIsSwiping] = useState(false);

  const [swipeOffset, setSwipeOffset] = useState(0);

  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  const [swipeDirection, setSwipeDirection] = useState(null);

  const [isTransitioning, setIsTransitioning] = useState(false);

  const [showScrollTop, setShowScrollTop] = useState(false);

  const [isHidingScrollTop, setIsHidingScrollTop] = useState(false);

  const swipeTimeoutRef = useRef(null);

  const {
    lastSaved,
    lastRefreshed,
    entries,
    theme,
    setEntries,
    setLastRefreshed,
    setRefreshing,
    refreshEmployeeData,
    isSaving,
    saveStatus,
  } = useTimeTracker();

  const {
    currentUser,
    isAuthenticated,
    getUserData,
    saveUserData,
    isAppLoading,
    isLoading: authLoading,
  } = useSupabaseAuth();

  const {
    loadTimeEntriesData,
    pendingConflicts,
    conflictResolver,
    isConflictModalOpen,
    closeConflictModal,
  } = useTimeEntry();

  const {
    data: instantData,
    cacheStatus,
    forceRefresh,
    isOnline,
  } = useInstantData();

  const [refreshing, setRefreshingState] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [pendingAction, setPendingAction] = useState(null);

  const containerRef = useRef(null);

  // Initialize service worker for notifications
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          notificationManager.setRegistration(registration);
        })
        .catch((err) => {
          console.error("Service Worker ready check failed:", err);
        });
    }
  }, []);

  // Apply fixed header styles directly to document

  useEffect(() => {
    const style = document.createElement("style");

    style.textContent = `

      #header {

        position: fixed !important;

        top: 0 !important;

        left: 0 !important;

        right: 0 !important;

        z-index: 9999 !important;

        background: var(--color-surface) !important;

        border-bottom: 1px solid var(--color-border) !important;

        width: 100% !important;

      }

    `;

    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Scroll to top button functionality

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;

      if (scrollY > 90) {
        if (!showScrollTop && !isHidingScrollTop) {
          setShowScrollTop(true);

          setIsHidingScrollTop(false);
        }
      } else {
        if (showScrollTop && !isHidingScrollTop) {
          setIsHidingScrollTop(true);

          setTimeout(() => {
            setShowScrollTop(false);

            setIsHidingScrollTop(false);
          }, 300); // Match fade-out duration
        }
      }
    };

    window.addEventListener("scroll", handleScroll);

    return () => window.removeEventListener("scroll", handleScroll);
  }, [showScrollTop, isHidingScrollTop]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,

      behavior: "smooth",
    });
  };

  const startXRef = useRef(0);

  const startYRef = useRef(0);

  const lastScrollYRef = useRef(0);

  const views = ["dashboard", "timesheet", "settings"];

  const [showTest, setShowTest] = useState(false);

  // ✅ MOVE ALL CALLBACKS HERE - BEFORE ANY CONDITIONAL RETURNS

  const isMobile = useCallback(() => {
    return typeof window !== "undefined" && window.innerWidth <= 768;
  }, []);

  const handleViewChange = useCallback(
    (newView) => {
      if (newView === currentView || isTransitioning) return;

      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentView(newView);

        setTimeout(() => {
          setIsTransitioning(false);
        }, 100);
      }, 50);
    },
    [currentView, isTransitioning],
  );

  const handleRefresh = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;
    try {
      const refreshWithTimeout = Promise.race([
        loadTimeEntriesData({ forceConflictCheck: true }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Refresh timed out")), 10000),
        ),
      ]);
      await refreshWithTimeout;
    } catch (err) {
      console.warn("[Refresh] Timed out or failed:", err.message);
    } finally {
      setLastRefreshed(new Date().toISOString());
    }
  }, [currentUser, isAuthenticated, loadTimeEntriesData, setLastRefreshed]);

  const getNextView = useCallback(
    (direction) => {
      const currentIndex = views.indexOf(currentView);

      if (direction === "left") {
        return views[(currentIndex + 1) % views.length];
      }

      return views[(currentIndex - 1 + views.length) % views.length];
    },
    [currentView],
  );

  const handleNavClick = useCallback(
    (view, event) => {
      handleViewChange(view);

      if (event && event.currentTarget) {
        event.currentTarget.blur();
      }
    },
    [handleViewChange],
  );

  const handleTouchStart = useCallback(
    (e) => {
      if (!isMobile()) return;

      if (!e.touches || e.touches.length === 0) return;

      // Clear any existing timeout

      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }

      startXRef.current = e.touches[0].clientX;

      startYRef.current = e.touches[0].clientY;

      setSwipeDirection(null);

      setSwipeOffset(0);

      setIsSwiping(false); // Reset swiping state
    },
    [isMobile],
  );

  const handleTouchMove = useCallback(
    (e) => {
      if (!isMobile()) return;

      if (!e.touches || e.touches.length === 0) return;

      const currentX = e.touches[0].clientX;

      const currentY = e.touches[0].clientY;

      const deltaX = currentX - startXRef.current;

      const deltaY = currentY - startYRef.current;

      const absDeltaX = Math.abs(deltaX);

      const absDeltaY = Math.abs(deltaY);

      const swipeThreshold = 15;

      if (swipeDirection === null) {
        if (absDeltaX > swipeThreshold || absDeltaY > swipeThreshold) {
          const target = e.target.closest(
            '.data-table, .table-container, table, [data-no-swipe], .modal-content, input, textarea, select, button, [contenteditable="true"], .form-group, .entry-form',
          );

          if (target && absDeltaX > absDeltaY) {
            setSwipeDirection("blocked");

            return;
          }

          if (absDeltaX > absDeltaY && absDeltaX > swipeThreshold) {
            setSwipeDirection("horizontal");

            setIsSwiping(true);

            // Don't preventDefault - let it scroll but track the swipe
          } else if (absDeltaY > swipeThreshold) {
            setSwipeDirection("vertical");
          }
        }
      }

      if (swipeDirection === "horizontal") {
        // Don't preventDefault - just track the swipe

        const clampedOffset = Math.max(-120, Math.min(120, deltaX));

        setSwipeOffset(clampedOffset);
      }
    },
    [swipeDirection, isMobile],
  );

  const handleTouchEnd = useEffect(() => {
    const handleResize = () => {
      // IMPORTANT: Don't reset authentication during resize

      // Only reset UI-related state, not authentication state

      setIsSwiping(false);

      setSwipeOffset(0);

      setSwipeDirection(null);

      // Clear any existing timeout

      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);

        swipeTimeoutRef.current = null;
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);

      // Clear timeout on cleanup

      if (swipeTimeoutRef.current) {
        clearTimeout(swipeTimeoutRef.current);
      }
    };
  }, []);

  // Validate time entries data integrity

  const validateTimeEntries = (entries) => {
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries.filter((entry) => {
      // Check if entry has required fields

      if (!entry || typeof entry !== "object") {
        return false;
      }

      if (!entry.date || typeof entry.date !== "string") {
        return false;
      }

      // Validate date format

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (!dateRegex.test(entry.date)) {
        return false;
      }

      // Check for valid hours (can be null/undefined for unpaid days)

      if (entry.hours !== null && entry.hours !== undefined) {
        if (
          typeof entry.hours !== "number" ||
          entry.hours < 0 ||
          entry.hours > 24
        ) {
          return false;
        }
      }

      // Validate entry type if present - handle both lowercase and capitalized versions

      if (entry.type) {
        const validTypes = [
          "regular",
          "vacation",
          "sick",
          "unpaid",
          "holiday",
          "Regular",
          "Leave",
        ];

        if (!validTypes.includes(entry.type)) {
          return false;
        }
      }

      return true;
    });
  };

  // Merge entries function to prevent data loss during refresh

  const mergeEntries = (currentEntries, loadedEntries) => {
    const currentEntriesMap = new Map();

    currentEntries.forEach((entry) => {
      if (entry && entry.date) {
        currentEntriesMap.set(entry.date, entry);
      }
    });

    const loadedEntriesMap = new Map();

    loadedEntries.forEach((entry) => {
      if (entry && entry.date) {
        loadedEntriesMap.set(entry.date, entry);
      }
    });

    const mergedEntries = [];

    const allDates = new Set([
      ...currentEntriesMap.keys(),
      ...loadedEntriesMap.keys(),
    ]);

    allDates.forEach((date) => {
      const currentEntry = currentEntriesMap.get(date);

      const loadedEntry = loadedEntriesMap.get(date);

      if (currentEntry && loadedEntry) {
        const currentModified = new Date(currentEntry.lastModified || 0);

        const loadedModified = new Date(loadedEntry.lastModified || 0);

        if (currentModified >= loadedModified) {
          mergedEntries.push(currentEntry);
        } else {
          mergedEntries.push(loadedEntry);
        }
      } else if (currentEntry) {
        mergedEntries.push(currentEntry);
      } else if (loadedEntry) {
        mergedEntries.push(loadedEntry);
      }
    });

    mergedEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

    return mergedEntries;
  };

  // Enhanced refresh data function with proper PWA integration

  const refreshData = useCallback(async () => {
    if (!currentUser || !isAuthenticated) return;

    try {
      setRefreshing(true);

      // Use instant data refresh if available

      if (instantData.timeEntries.length > 0 || !navigator.onLine) {
        // If we have cached data or are offline, use instant refresh

        console.log("App: Calling refreshEmployeeData directly...");
        // Skip forceRefresh since it's timing out and go straight to TimeTrackerContext refresh
        await refreshEmployeeData();

        // DO NOT set entries here - TimeEntryContext manages entries with conflict resolution
        // useInstantData only updates cacheManager, not the entries state
        // setEntries(instantData.timeEntries || []);

        setLastRefreshed(new Date().toISOString());

        return {
          success: true,

          entriesCount: instantData.timeEntries?.length || 0,

          isOnline: navigator.onLine,

          fromCache: true,
        };
      }

      // Try background sync first

      try {
        await backgroundSync.forceSync();
      } catch (syncError) {
        console.warn("Background sync failed, using fallback:", syncError);
      }

      const syncStatus = backgroundSync.getStatus();

      const loadedEmployee = {
        name: getUserData("fullName") || "",

        salary: parseFloat(getUserData("salary")) || 0,
      };

      const loadedLeaveSettings = {
        annualVacation: parseFloat(getUserData("annualVacation")) || 10,

        sickDays: parseFloat(getUserData("sickDays")) || 7,
      };

      let loadedEntries = [];

      // Try to get fresh data from Supabase first

      try {
        if (currentUser && !currentUser.isLocalOnly && syncStatus.isOnline) {
          const supabaseEntries = await supabaseData
            .getTimeEntries(currentUser.id)
            .catch((err) => {
              if (
                err.message?.includes("Unauthorized") ||
                err.message?.includes("401")
              ) {
                console.warn(
                  "Session expired during time entries fetch in App refresh",
                );
                return [];
              }
              throw err;
            });

          if (supabaseEntries && supabaseEntries.length > 0) {
            // Save Supabase data to localStorage for offline use

            if (getUserData("timeEntries")) {
              saveUserData("timeEntries", supabaseEntries);
            }

            loadedEntries = supabaseEntries;
          }
        }
      } catch (supabaseError) {
        console.warn(
          "Supabase fetch failed, using localStorage:",
          supabaseError,
        );
      }

      // Fallback to localStorage if Supabase failed or user is local-only

      if (loadedEntries.length === 0) {
        loadedEntries = getUserData("timeEntries") || [];
      }

      const validatedLoadedEntries = validateTimeEntries(loadedEntries);

      // Merge current entries with loaded entries, prioritizing Supabase data

      const mergedEntries = mergeEntries(entries, validatedLoadedEntries);

      // Additional merge logic to handle deleted entries

      if (currentUser && !currentUser.isLocalOnly && syncStatus.isOnline) {
        try {
          const freshSupabaseEntries = await supabaseData
            .getTimeEntries(currentUser.id)
            .catch((err) => {
              if (
                err.message?.includes("Unauthorized") ||
                err.message?.includes("401")
              ) {
                console.warn(
                  "Session expired during fresh time entries fetch in App",
                );
                return [];
              }
              throw err;
            });

          const supabaseDates = new Set(
            freshSupabaseEntries.map((entry) => entry.date),
          );

          // Remove entries that no longer exist in Supabase

          const cleanedEntries = mergedEntries.filter(
            (entry) => !entry.date || supabaseDates.has(entry.date),
          );

          setEntries(cleanedEntries);

          // Update localStorage with cleaned data

          if (cleanedEntries.length !== mergedEntries.length) {
            saveUserData("timeEntries", cleanedEntries);
          }
        } catch (cleanupError) {
          console.warn("Failed to clean up deleted entries:", cleanupError);

          setEntries(mergedEntries);
        }
      } else {
        setEntries(mergedEntries);
      }

      setLastRefreshed(new Date().toISOString());

      return {
        success: true,

        entriesCount: mergedEntries.length,

        syncStatus,

        isOnline: syncStatus.isOnline,

        fromCache: false,
      };
    } catch (error) {
      console.error("Refresh data failed:", error);

      throw error;
    } finally {
      setRefreshing(false);
    }
  }, [
    currentUser,
    isAuthenticated,
    entries,
    instantData,
    getUserData,
    setEntries,
    setLastRefreshed,
    setRefreshing,
    saveUserData,
    forceRefresh,
  ]);

  // ✅ ALL EFFECTS ARE NOW AT TOP LEVEL

  useEffect(() => {
    // Initialize enhanced background sync

    const initTimer = setTimeout(() => {
      backgroundSync.init().catch((error) => {
        console.warn("Background sync initialization failed:", error);
      });
    }, 1000);

    return () => clearTimeout(initTimer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const shouldNavigateToExport = localStorage.getItem("navigateToExport");

    if (shouldNavigateToExport === "true") {
      localStorage.removeItem("navigateToExport");

      setCurrentView("settings");

      setTimeout(() => {
        const exportBtn = document.querySelector("[data-export-btn]");

        if (exportBtn) exportBtn.click();
      }, 100);
    }
  }, [setCurrentView]);

  useEffect(() => {
    const shouldNavigateToAddPeriod = localStorage.getItem(
      "navigateToAddPeriod",
    );

    if (shouldNavigateToAddPeriod === "true") {
      localStorage.removeItem("navigateToAddPeriod");

      localStorage.setItem("shouldOpenAddPeriod", "true");

      setCurrentView("settings");
    }
  }, [setCurrentView]);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;

          if (currentScrollY > lastScrollY && currentScrollY > 10) {
            setIsHeaderCollapsed(true);
          } else if (currentScrollY <= 30) {
            setIsHeaderCollapsed(false);
          }

          lastScrollY = currentScrollY;

          ticking = false;
        });

        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      const today = new Date().toISOString().split("T")[0];

      const todayEntry = entries.find((e) => e.date === today);

      if (
        todayEntry &&
        todayEntry.intervals &&
        todayEntry.intervals.length > 0
      ) {
        const lastInterval =
          todayEntry.intervals[todayEntry.intervals.length - 1];

        if (lastInterval.in && !lastInterval.out) {
          e.preventDefault();

          e.returnValue = "";

          return "";
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [entries]);

  // ✅ NOW CONDITIONAL RENDERING IS SAFE - ALL HOOKS ARE ABOVE

  if (authLoading) {
    return (
      <div className="app-loading">
        <div className="loading-spinner">
          <div className="spinner"></div>

          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Public routes that don't require authentication

  return (
    <Routes>
      <Route
        path="/reset-password"
        element={
          <Suspense fallback={<div>Loading reset page...</div>}>
            <PasswordResetPage />
          </Suspense>
        }
      />

      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Suspense fallback={<div>Loading login...</div>}>
              <LoginScreen />
            </Suspense>
          )
        }
      />

      <Route
        path="/"
        element={
          isAuthenticated ? (
            isAppLoading ? (
              <AppLoading />
            ) : (
              <div
                className={`app ${isSwiping ? "swiping" : ""}`}
                ref={containerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  minHeight: "100vh",

                  display: "flex",

                  flexDirection: "column",
                }}
              >
                <Header
                  currentView={currentView}
                  setCurrentView={setCurrentView}
                  isHeaderCollapsed={isHeaderCollapsed}
                  onRefresh={handleRefresh}
                  style={{
                    position: "fixed",

                    top: 0,

                    left: 0,

                    right: 0,

                    zIndex: 1000,

                    background: "var(--color-surface)",

                    borderBottom: "1px solid var(--color-border)",
                  }}
                />

                <div
                  className="main-content"
                  data-scrollable
                  style={{
                    paddingTop: "140px",

                    flex: 1,

                    overflowY: "auto",

                    WebkitOverflowScrolling: "touch",
                  }}
                >
                  <Suspense fallback={<DashboardSkeleton />}>
                    <div
                      className={`view-container dashboard-container ${currentView === "dashboard" ? "active" : ""}`}
                      data-scrollable
                    >
                      <Dashboard />
                    </div>
                  </Suspense>

                  <Suspense fallback={<div>Loading timesheet...</div>}>
                    <div
                      className={`view-container timesheet-container ${currentView === "timesheet" ? "active" : ""}`}
                      data-scrollable
                    >
                      <Timesheet />
                    </div>
                  </Suspense>

                  <Suspense fallback={<div>Loading settings...</div>}>
                    <div
                      className={`view-container settings-container ${currentView === "settings" ? "active" : ""}`}
                      data-scrollable
                    >
                      <Settings />
                    </div>
                  </Suspense>
                </div>

                <ConflictResolutionModal
                  conflicts={isConflictModalOpen ? pendingConflicts : []}
                  onResolve={(resolutions) => {
                    if (conflictResolver) {
                      conflictResolver(resolutions);
                    }
                  }}
                  onClose={closeConflictModal}
                />

                <RefreshIndicator lastRefreshed={lastRefreshed} />
                <NetworkStatus onRefresh={forceRefresh} />

                {/* Scroll to Top Button - Completely outside all containers */}

                {(showScrollTop || isHidingScrollTop) && (
                  <button
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: "smooth" });

                      setIsHidingScrollTop(true);

                      setTimeout(() => setIsHidingScrollTop(false), 300);
                    }}
                    style={{
                      position: "fixed",

                      bottom: "30px",

                      right: "30px",

                      width: "50px",

                      height: "50px",

                      borderRadius: "50%",

                      border: "none",

                      cursor: "pointer",

                      alignItems: "center",

                      justifyContent: "center",

                      fontSize: "20px",

                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",

                      transition: "all 0.3s ease, opacity 0.3s ease",

                      zIndex: 1000,

                      opacity: isHidingScrollTop ? 0 : 0.5,

                      transform: isHidingScrollTop
                        ? "translateY(20px)"
                        : "translateY(0)",

                      animation: !isHidingScrollTop
                        ? "fadeIn 0.3s ease-in"
                        : "none",

                      pointerEvents: isHidingScrollTop ? "none" : "auto",
                    }}
                    onMouseEnter={(e) => {
                      if (!isHidingScrollTop) {
                        e.target.style.transform = "scale(1.1)";

                        e.target.style.boxShadow =
                          "0 6px 16px rgba(0, 0, 0, 0.4)";

                        e.target.style.opacity = "0.8";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isHidingScrollTop) {
                        e.target.style.transform = "scale(1)";

                        e.target.style.boxShadow =
                          "0 4px 12px rgba(0, 0, 0, 0.3)";

                        e.target.style.opacity = "0.5";
                      }
                    }}
                    aria-label="Scroll to top"
                  >
                    ↑
                  </button>
                )}

                {/* Add fade-in and fade-out animation styles */}

                <style>{`

                @keyframes fadeIn {

                  from {

                    opacity: 0;

                    transform: translateY(20px);

                  }

                  to {

                    opacity: 0.5;

                    transform: translateY(0);

                  }

                }

              `}</style>
              </div>
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
}

export default App;
