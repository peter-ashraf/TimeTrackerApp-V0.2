import React, { useEffect, useRef, useState } from "react";
import "../styles/app-update-prompt.css";

function AppUpdatePrompt() {
  const [registration, setRegistration] = useState(null);
  const [isApplying, setIsApplying] = useState(false);
  const hasReloadedRef = useRef(false);
  const fallbackReloadRef = useRef(null);

  useEffect(() => {
    const handleUpdateAvailable = (event) => {
      if (event.detail?.registration) {
        setRegistration(event.detail.registration);
      }
    };

    const handleShowUpdatePrompt = async () => {
      if (!("serviceWorker" in navigator)) return;

      try {
        const readyRegistration = await navigator.serviceWorker.ready;
        if (
          readyRegistration.waiting &&
          navigator.serviceWorker.controller
        ) {
          setRegistration(readyRegistration);
        }
      } catch {
        // Ignore prompt recovery errors; manual reload remains available.
      }
    };

    const handleControllerChange = () => {
      if (hasReloadedRef.current) return;
      hasReloadedRef.current = true;
      window.location.reload();
    };

    window.addEventListener("app-update-available", handleUpdateAvailable);
    window.addEventListener("app-update-show-prompt", handleShowUpdatePrompt);
    navigator.serviceWorker?.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready
        .then((readyRegistration) => {
          if (
            readyRegistration.waiting &&
            navigator.serviceWorker.controller
          ) {
            setRegistration(readyRegistration);
          }
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener("app-update-available", handleUpdateAvailable);
      window.removeEventListener("app-update-show-prompt", handleShowUpdatePrompt);
      navigator.serviceWorker?.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
      if (fallbackReloadRef.current) {
        clearTimeout(fallbackReloadRef.current);
      }
    };
  }, []);

  if (!registration) return null;

  const applyUpdate = () => {
    setIsApplying(true);

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
      fallbackReloadRef.current = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    window.location.reload();
  };

  return (
    <div
      className="app-update-prompt"
      role="status"
      aria-live="polite"
      aria-label="App update available"
    >
      <div className="app-update-icon" aria-hidden="true">
        <i className="fa-solid fa-arrow-rotate-right"></i>
      </div>
      <div className="app-update-copy">
        <strong>New version available</strong>
        <span>Reload now to get the latest fixes and offline improvements.</span>
      </div>
      <div className="app-update-actions">
        <button
          type="button"
          className="app-update-button app-update-button-primary"
          onClick={applyUpdate}
          disabled={isApplying}
        >
          {isApplying ? "Reloading" : "Reload"}
        </button>
        <button
          type="button"
          className="app-update-button"
          onClick={() => setRegistration(null)}
          disabled={isApplying}
          aria-label="Dismiss update prompt"
        >
          Later
        </button>
      </div>
    </div>
  );
}

export default AppUpdatePrompt;
