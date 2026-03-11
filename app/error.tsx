"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    console.error(error);

    const syncConnection = () => {
      setIsOffline(!window.navigator.onLine);
    };

    syncConnection();
    window.addEventListener("online", syncConnection);
    window.addEventListener("offline", syncConnection);

    return () => {
      window.removeEventListener("online", syncConnection);
      window.removeEventListener("offline", syncConnection);
    };
  }, [error]);

  return (
    <div className="min-h-dvh bg-slate-950 px-6 py-12 text-slate-100">
      <div className="mx-auto flex min-h-[calc(100dvh-6rem)] max-w-3xl items-center justify-center">
        <div className="w-full rounded-[28px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-300">
            RPT-SAES
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white">
            {isOffline ? "No internet connection" : "Something went wrong"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            {isOffline
              ? "The page cannot continue because this device is offline. Reconnect to the internet, then try again."
              : "The page hit an unexpected error while loading. You can retry the request or return to the home page."}
          </p>
          {error.digest ? (
            <p className="mt-5 text-sm text-slate-500">Reference: {error.digest}</p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={reset}
              className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              Try again
            </button>
            <Link
              href="/"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
