"use client";
import React from "react";

export const OnlineStatus: React.FC = () => {
  const [online, setOnline] = React.useState<boolean>(true);

  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      background: "#d32f2f",
      color: "#fff",
      padding: "6px 12px",
      fontSize: "0.85rem",
      fontWeight: 600,
      textAlign: "center",
      zIndex: 1000,
    }}>
      You are offline. Some features may be unavailable.
    </div>
  );
};
