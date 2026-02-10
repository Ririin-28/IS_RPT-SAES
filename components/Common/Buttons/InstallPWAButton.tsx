"use client";
import React, { useEffect, useState } from "react";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

// Minimal typing for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const InstallPWAButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    // Detect already installed (standalone)
    if (typeof window !== "undefined") {
      if (
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone
      ) {
        setInstalled(true);
      }
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setCanInstall(false);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.warn("PWA install prompt error", err);
    }
  };

  if (installed) {
    return (
      <div className="flex items-center gap-2 text-green-700 font-semibold mt-2" aria-live="polite">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        App Installed
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch">
      <button
        onClick={() => {
          if (canInstall && deferredPrompt) {
            void triggerInstall();
          }
        }}
        className="flex w-full items-center justify-center rounded-lg bg-green-900 px-6 py-3 text-base font-bold text-white border-0 transition hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label="Download RPT-Quiz"
        disabled={!canInstall}
      >
        <svg
          className="mr-2 h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4"
          />
        </svg>
        <span>Download RPT-Quiz</span>
      </button>

      <button
        type="button"
        onClick={() => setShowHelp((h) => !h)}
        aria-expanded={showHelp}
        aria-controls="pwa-install-help"
        className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900 self-center"
      >
        {showHelp ? "Hide install instructions" : "How to install?"}
      </button>
      {showHelp && (
        <div className="mt-3 w-full rounded-2xl bg-white/95 p-4 text-left shadow-lg border border-green-100">
          <h4 className="font-semibold text-green-900 mb-2 text-sm">How to Install</h4>
          <ul className="text-green-800 text-xs list-disc list-inside space-y-1">
            <li><span className="font-medium">Desktop Chrome / Edge:</span> Menu (⋮) → Install.</li>
            <li><span className="font-medium">Android Chrome:</span> Menu (⋮) → Add to Home Screen.</li>
            <li><span className="font-medium">iOS Safari:</span> Share → Add to Home Screen.</li>
          </ul>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900"
            aria-label="Close installation help"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
};

export default InstallPWAButton;
