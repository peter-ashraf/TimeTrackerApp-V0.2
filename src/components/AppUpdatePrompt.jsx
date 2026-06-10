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

    const handleControllerChange = () => {
      if (hasReloadedRef.current) return;
      hasReloadedRef.current = true;
      window.location.reload();
    };

    window.addEventListener("app-update-available", handleUpdateAvailable);
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
      <div className="app-update-copy">
        <strong>Update available</strong>
        <span>Reload to use the latest version.</span>
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
