"use client";

import { useEffect, useState } from "react";
import Toast, { ToastTone } from "@/components/Toast";

type NetworkInformationLike = EventTarget & {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
};

type NavigatorWithConnection = Navigator & {
  connection?: NetworkInformationLike;
  mozConnection?: NetworkInformationLike;
  webkitConnection?: NetworkInformationLike;
};

type NetworkToastState =
  | {
      kind: "online";
    }
  | {
      kind: "offline" | "slow";
      title: string;
      message: string;
      tone: ToastTone;
    };

const getConnection = () => {
  const currentNavigator = navigator as NavigatorWithConnection;
  return currentNavigator.connection ?? currentNavigator.mozConnection ?? currentNavigator.webkitConnection;
};

const isSlowConnection = (connection?: NetworkInformationLike) => {
  if (!connection) {
    return false;
  }

  if (connection.saveData) {
    return true;
  }

  const effectiveType = connection.effectiveType?.toLowerCase();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") {
    return true;
  }

  if (typeof connection.downlink === "number" && connection.downlink > 0 && connection.downlink < 1.5) {
    return true;
  }

  if (typeof connection.rtt === "number" && connection.rtt >= 350) {
    return true;
  }

  return false;
};

const getNetworkState = (): NetworkToastState => {
  if (!navigator.onLine) {
    return {
      kind: "offline",
      title: "No internet connection",
      message: "You are offline. Some pages and actions may not load until the connection returns.",
      tone: "error",
    };
  }

  const connection = getConnection();
  if (isSlowConnection(connection)) {
    return {
      kind: "slow",
      title: "Slow internet detected",
      message: "The connection looks unstable or slow. Loading and syncing may take longer than usual.",
      tone: "info",
    };
  }

  return { kind: "online" };
};

export default function NetworkStatusToast() {
  const [state, setState] = useState<NetworkToastState>({ kind: "online" });

  useEffect(() => {
    const syncNetworkState = () => {
      setState(getNetworkState());
    };

    syncNetworkState();

    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    const connection = getConnection();
    connection?.addEventListener?.("change", syncNetworkState);

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
      connection?.removeEventListener?.("change", syncNetworkState);
    };
  }, []);

  if (state.kind === "online") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[1300] flex justify-center px-4">
      <Toast
        title={state.title}
        message={state.message}
        tone={state.tone}
        className="pointer-events-auto w-full max-w-lg border border-white/70 bg-white/95 shadow-2xl shadow-slate-900/15"
      />
    </div>
  );
}
