"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import ITAdminHeader from "@/components/IT_Admin/Header";

type EmergencyAccessPayload = {
  active: boolean;
  emergency_access_id: number | null;
  reason: string | null;
  activated_at: string | null;
  expires_at: string | null;
  scope_modules: string[];
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "--";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString();
}

export default function ITAdminEmergencyAccessPage() {
  const [status, setStatus] = useState<EmergencyAccessPayload | null>(null);
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/it_admin/emergency-access/current", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        emergency_access?: EmergencyAccessPayload;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to load emergency status.");
      }
      setStatus(payload.emergency_access ?? null);
    } catch (err) {
      setError((err as Error)?.message ?? "Unable to load emergency status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const canActivate = useMemo(() => {
    return !status?.active;
  }, [status]);

  const onActivate = useCallback(async () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10) {
      setError("Provide a reason with at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/it_admin/emergency-access/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: trimmedReason,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to activate emergency access.");
      }

      setMessage("Emergency Access activated.");
      setReason("");
      setExpiresAt("");
      await loadStatus();
    } catch (err) {
      setError((err as Error)?.message ?? "Unable to activate emergency access.");
    } finally {
      setSubmitting(false);
    }
  }, [expiresAt, loadStatus, reason]);

  const onDeactivate = useCallback(async () => {
    if (!status?.active || !status.emergency_access_id) {
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/it_admin/emergency-access/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emergency_access_id: status.emergency_access_id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error ?? "Unable to deactivate emergency access.");
      }

      setMessage("Emergency Access deactivated.");
      await loadStatus();
    } catch (err) {
      setError((err as Error)?.message ?? "Unable to deactivate emergency access.");
    } finally {
      setSubmitting(false);
    }
  }, [loadStatus, status]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec]">
      <ITAdminSidebar />
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden pt-16">
        <ITAdminHeader title="Emergency Access" />

        <main className="relative flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="pointer-events-none absolute -top-16 right-10 h-52 w-52 rounded-full bg-emerald-200/55 blur-3xl" />
          <div className="pointer-events-none absolute bottom-8 left-8 h-56 w-56 rounded-full bg-emerald-100/45 blur-3xl" />
          <div className="relative h-full min-h-100 overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
            {status?.active ? (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-semibold text-amber-900">Emergency Access Active</p>
                <p className="mt-2 text-sm text-amber-900">Reason: {status.reason ?? "--"}</p>
                <p className="mt-1 text-sm text-amber-900">Activated at: {formatDateTime(status.activated_at)}</p>
                <p className="mt-1 text-sm text-amber-900">Expires at: {formatDateTime(status.expires_at)}</p>
              </div>
            ) : null}

            {error ? <p className="mb-3 text-sm font-medium text-red-700">{error}</p> : null}
            {message ? <p className="mb-3 text-sm font-medium text-green-700">{message}</p> : null}

            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-[#0f3b2e]">Activate Emergency Access</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Requires reason. Access is limited to Principal-managed Calendars and Requests.
                </p>

                <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="emergency-reason">
                  Reason
                </label>
                <textarea
                  id="emergency-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  disabled={!canActivate || submitting || loading}
                  className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                  placeholder="Principal unavailable due to emergency..."
                />

                <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="emergency-expiry">
                  Optional expiry
                </label>
                <input
                  id="emergency-expiry"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  disabled={!canActivate || submitting || loading}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                />

                <button
                  type="button"
                  onClick={onActivate}
                  disabled={!canActivate || submitting || loading}
                  className="mt-4 rounded-lg bg-[#013300] px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Activating..." : "Activate Emergency Access"}
                </button>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-semibold text-[#0f3b2e]">Current Status</h2>
                {loading ? <p className="mt-3 text-sm text-slate-600">Loading status...</p> : null}
                {!loading && !status?.active ? (
                  <p className="mt-3 text-sm text-slate-600">No active emergency access session.</p>
                ) : null}
                {!loading && status?.active ? (
                  <div className="mt-3 space-y-1 text-sm text-slate-700">
                    <p>Emergency Access ID: {status.emergency_access_id}</p>
                    <p>Scope: {(status.scope_modules ?? []).join(", ") || "--"}</p>
                    <p>Activated at: {formatDateTime(status.activated_at)}</p>
                    <p>Expires at: {formatDateTime(status.expires_at)}</p>
                    <button
                      type="button"
                      onClick={onDeactivate}
                      disabled={submitting}
                      className="mt-3 rounded-lg border border-red-400 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {submitting ? "Deactivating..." : "Deactivate Emergency Access"}
                    </button>
                  </div>
                ) : null}
              </section>
            </div>

            <section className="mt-6 grid gap-4 md:grid-cols-2">
              <Link
                href="/IT_Admin/emergency-access/requests"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
              >
                <p className="text-base font-semibold text-[#0f3b2e]">Emergency Requests Access</p>
                <p className="mt-1 text-sm text-slate-600">Review pending requests and approve/reject during an active emergency session.</p>
              </Link>
              <Link
                href="/IT_Admin/emergency-access/calendars"
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
              >
                <p className="text-base font-semibold text-[#0f3b2e]">Emergency Calendar Access</p>
                <p className="mt-1 text-sm text-slate-600">Adjust Principal-managed calendar records using the same underlying tables.</p>
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
