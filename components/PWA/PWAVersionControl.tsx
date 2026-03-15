"use client";

import { useEffect, useMemo, useState } from "react";
import Toast from "@/components/Toast";

type PWAVersionControlProps = {
  versionLabel: string;
};

type VersionStatus = "idle" | "checking" | "up-to-date" | "update-ready" | "unsupported";

const formatCheckedAt = (value: Date | null) => {
  if (!value) {
    return "Not checked yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);
};

const getStatusCopy = (status: VersionStatus) => {
  switch (status) {
    case "checking":
      return {
        tone: "info" as const,
        message: "Checking for the latest PWA build.",
        summary: "Checking for updates",
      };
    case "up-to-date":
      return {
        tone: "success" as const,
        message: "This device already has the latest available PWA build.",
        summary: "Up to date",
      };
    case "update-ready":
      return {
        tone: "info" as const,
        message: "A newer PWA version is ready. Update now to load the latest files.",
        summary: "Update ready",
      };
    case "unsupported":
      return {
        tone: "error" as const,
        message: "This browser cannot manage PWA updates from the app interface.",
        summary: "Update checks unavailable",
      };
    default:
      return {
        tone: "info" as const,
        message: "Manage this installed PWA version and check when a new build is available.",
        summary: "Version controls",
      };
  }
};

export default function PWAVersionControl({ versionLabel }: PWAVersionControlProps) {
  const [status, setStatus] = useState<VersionStatus>("idle");
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [hasDismissedUpdate, setHasDismissedUpdate] = useState(false);

  const statusCopy = useMemo(() => getStatusCopy(status), [status]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    let isMounted = true;
    let observedInstallingWorker: ServiceWorker | null = null;
    const cleanupCallbacks: Array<() => void> = [];

    const markUpdateReady = () => {
      if (!isMounted) {
        return;
      }

      setStatus("update-ready");
      setHasDismissedUpdate(false);
    };

    const observeInstallingWorker = (worker: ServiceWorker | null) => {
      if (!worker || observedInstallingWorker === worker) {
        return;
      }

      observedInstallingWorker = worker;

      const handleStateChange = () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          markUpdateReady();
        }
      };

      worker.addEventListener("statechange", handleStateChange);
      cleanupCallbacks.push(() => worker.removeEventListener("statechange", handleStateChange));
    };

    const attachRegistration = async () => {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.ready.catch(() => null));

      if (!isMounted || !registration) {
        return;
      }

      if (registration.waiting && navigator.serviceWorker.controller) {
        markUpdateReady();
      } else if (isMounted) {
        setStatus((current) => (current === "checking" ? current : "idle"));
      }

      const handleUpdateFound = () => {
        observeInstallingWorker(registration.installing);
      };

      registration.addEventListener("updatefound", handleUpdateFound);
      cleanupCallbacks.push(() => registration.removeEventListener("updatefound", handleUpdateFound));
      observeInstallingWorker(registration.installing);

      registration.update().catch(() => undefined);
    };

    const handleControllerChange = () => {
      window.location.reload();
    };

    void attachRegistration();
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      cleanupCallbacks.forEach((callback) => callback());
      observedInstallingWorker = null;
    };
  }, []);

  const checkForUpdates = async () => {
    if (!("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    setStatus((current) => (current === "update-ready" ? current : "checking"));

    try {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.ready.catch(() => null));

      if (!registration) {
        setStatus("idle");
        return;
      }

      await registration.update();
      setLastCheckedAt(new Date());

      if (registration.waiting && navigator.serviceWorker.controller) {
        setStatus("update-ready");
        setHasDismissedUpdate(false);
        return;
      }

      setStatus("up-to-date");
    } catch (error) {
      console.warn("Unable to check for a new PWA version", error);
      setStatus("idle");
    }
  };

  const applyUpdate = async () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    try {
      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.ready.catch(() => null));

      if (!registration?.waiting) {
        await checkForUpdates();
        return;
      }

      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      console.warn("Unable to apply the new PWA version", error);
    }
  };

  const shouldShowPanel = status === "update-ready" && !hasDismissedUpdate;

  if (!shouldShowPanel) {
    return null;
  }

  return (
    <div
      id="pwa-version-panel"
      className="pointer-events-none fixed bottom-4 left-4 z-[1200] flex max-w-[calc(100vw-2rem)] items-end"
    >
      <Toast
        title={`PWA Version ${versionLabel}`}
        message={statusCopy.message}
        tone={statusCopy.tone}
        expandable
        defaultExpanded
        onClose={() => {
          setHasDismissedUpdate(true);
        }}
        details={
          <div className="space-y-1">
            <p>Status: {statusCopy.summary}</p>
            <p>Last checked: {formatCheckedAt(lastCheckedAt)}</p>
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void checkForUpdates()}
              className="rounded-full border border-[#013300]/10 bg-white px-3 py-1.5 text-xs font-semibold text-[#013300] transition hover:bg-[#f3f8f2]"
            >
              Check updates
            </button>
            {status === "update-ready" ? (
              <button
                type="button"
                onClick={() => void applyUpdate()}
                className="rounded-full bg-[#013300] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#025002]"
              >
                Update now
              </button>
            ) : null}
          </div>
        }
        className="pointer-events-auto w-full max-w-sm border border-white/80 bg-white/95 shadow-2xl shadow-[#013300]/10"
      />
    </div>
  );
}
