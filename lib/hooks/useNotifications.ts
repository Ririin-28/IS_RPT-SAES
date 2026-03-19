"use client";

import * as React from "react";

export type NotificationItem = {
  id: number;
  title: string;
  message: string;
  status: "unread" | "read";
  createdAt: string;
  targetUrl: string | null;
};

type UseNotificationsOptions = {
  endpoint: string;
  enabled?: boolean;
  pollIntervalMs?: number;
  queryParams?: Record<string, string | number | null | undefined>;
};

type NotificationsResponse = {
  success?: boolean;
  notifications?: Array<Record<string, unknown>>;
  unreadCount?: number;
  error?: string | null;
};

const toStringValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  return String(value);
};

const toStatusValue = (value: unknown): "unread" | "read" => {
  return value === "read" || value === true ? "read" : "unread";
};

const parseId = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed !== 0) {
    return parsed;
  }
  return fallback;
};

const normalizeNotification = (note: Record<string, unknown>, index: number): NotificationItem => {
  const createdRaw = note.createdAt ?? note.created_at ?? null;
  const createdAt = createdRaw ? new Date(String(createdRaw)).toISOString() : new Date().toISOString();
  const title = toStringValue(note.title).trim() || "Notification";
  const message = toStringValue(note.message).trim() || title;

  return {
    id: parseId(note.id, -(index + 1)),
    title,
    message,
    status: toStatusValue(note.status ?? note.isRead),
    createdAt,
    targetUrl: note.targetUrl ? String(note.targetUrl) : null,
  };
};

const buildEndpointWithParams = (
  endpoint: string,
  queryParams?: Record<string, string | number | null | undefined>,
): string => {
  if (!queryParams) {
    return endpoint;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (!text) {
      continue;
    }
    params.set(key, text);
  }

  const query = params.toString();
  if (!query) {
    return endpoint;
  }

  return `${endpoint}?${query}`;
};

export function useNotifications({
  endpoint,
  enabled = true,
  pollIntervalMs = 0,
  queryParams,
}: UseNotificationsOptions) {
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [remoteUnreadCount, setRemoteUnreadCount] = React.useState<number | null>(null);

  const requestUrl = React.useMemo(
    () => buildEndpointWithParams(endpoint, queryParams),
    [endpoint, queryParams],
  );

  const loadNotifications = React.useCallback(async () => {
    if (!enabled) {
      setNotifications([]);
      setError(null);
      setRemoteUnreadCount(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(requestUrl, {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as NotificationsResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Failed to load notifications.");
      }

      const mapped = Array.isArray(payload.notifications)
        ? payload.notifications.map((note, index) => normalizeNotification(note, index))
        : [];

      mapped.sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        return rightTime - leftTime;
      });

      setNotifications(mapped);
      setRemoteUnreadCount(Number.isFinite(payload.unreadCount) ? Number(payload.unreadCount) : null);
    } catch (loadError) {
      setNotifications([]);
      setRemoteUnreadCount(0);
      setError(loadError instanceof Error ? loadError.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [enabled, requestUrl]);

  React.useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  React.useEffect(() => {
    if (!enabled || !pollIntervalMs || pollIntervalMs <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadNotifications();
    }, pollIntervalMs);

    return () => window.clearInterval(timer);
  }, [enabled, loadNotifications, pollIntervalMs]);

  const markNotificationRead = React.useCallback(
    async (id: number, options?: { persist?: boolean }) => {
      setNotifications((prev) => prev.map((note) => (note.id === id ? { ...note, status: "read" } : note)));

      if (options?.persist === false || id <= 0) {
        return;
      }

      await fetch(endpoint, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    },
    [endpoint],
  );

  const markAllRead = React.useCallback(async () => {
    setNotifications((prev) => prev.map((note) => ({ ...note, status: "read" })));

    await fetch(endpoint, {
      method: "PATCH",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
  }, [endpoint]);

  const localUnreadCount = React.useMemo(
    () => notifications.reduce((count, note) => count + (note.status === "unread" ? 1 : 0), 0),
    [notifications],
  );

  const unreadCount = remoteUnreadCount === null ? localUnreadCount : Math.max(remoteUnreadCount, localUnreadCount);

  return {
    notifications,
    loading,
    error,
    unreadCount,
    loadNotifications,
    markNotificationRead,
    markAllRead,
  };
}
