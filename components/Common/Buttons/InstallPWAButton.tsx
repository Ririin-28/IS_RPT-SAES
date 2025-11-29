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

  const HelpPanel = () => (
    <div className="mt-3 w-full max-w-sm bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-md text-left">
      <h4 className="font-semibold text-green-900 mb-2 text-sm">How to Install</h4>
      <ul className="text-green-800 text-xs list-disc list-inside space-y-1">
        <li><span className="font-medium">Desktop Chrome / Edge:</span> Menu (⋮) → Cast, Save, and Share → Install.</li>
        <li><span className="font-medium">Android Chrome:</span> Menu (⋮) → Add to Home Screen / Install app.</li>
        <li><span className="font-medium">iOS Safari:</span> Share button → Add to Home Screen.</li>
      </ul>
      <button
        onClick={() => setShowHelp(false)}
        className="mt-3 text-xs font-semibold text-green-700 hover:text-green-900"
        aria-label="Close installation help"
      >
        Close
      </button>
    </div>
  );

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
    <div className="flex flex-col items-center md:items-start">
      {canInstall ? (
        <button
          onClick={triggerInstall}
          className="flex items-center px-4 py-2 bg-green-900 text-white text-base font-bold rounded-lg hover:bg-green-800 transition md:px-6 md:py-3 md:text-lg"
          aria-label="Install RPT-SAES Application"
        >
          <svg className="w-5 h-5 mr-2 md:w-6 md:h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
          Install RPT-SAES
        </button>
      ) : (
        <PrimaryButton
          onClick={() => setShowHelp(h => !h)}
          aria-expanded={showHelp}
          aria-controls="pwa-install-help"
        >
          How to Install
        </PrimaryButton>
      )}
      {showHelp && <HelpPanel />}
    </div>
  );
};

export default InstallPWAButton;
