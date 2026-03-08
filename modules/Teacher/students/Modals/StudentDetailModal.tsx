"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import ConfirmationModal from "@/components/Common/Modals/ConfirmationModal";
import BaseModal, { ModalSection, ModalInfoItem } from "@/components/Common/Modals/BaseModal";

type PromotionSubject = "English" | "Filipino" | "Math";

type PromotionRecommendation = {
  subject: PromotionSubject;
  status: "ready" | "not_ready" | "insufficient_data";
  trend: "up" | "down" | "neutral";
  canPromote: boolean;
  threshold: number;
  requiredSessions: number;
  qualifyingStreak: number;
  recentAverages: number[];
  message: string;
};

const PROMOTION_SUBJECTS: PromotionSubject[] = ["English", "Filipino", "Math"];

const getTrendIcon = (trend: PromotionRecommendation["trend"]) => {
  if (trend === "up") {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7h5v5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 7-7.5 7.5-4-4L3 17" />
      </svg>
    );
  }

  if (trend === "down") {
    return (
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 17h5v-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="m21 17-7.5-7.5-4 4L3 7" />
      </svg>
    );
  }

  return (
    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
};

const getRecommendationTone = (recommendation?: PromotionRecommendation | null) => {
  if (!recommendation) {
    return {
      card: "border-gray-200 bg-white",
      action: "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed",
      heading: "text-gray-600",
      body: "text-gray-500",
    };
  }

  if (recommendation.status === "ready") {
    return {
      card: "border-emerald-200 bg-emerald-50/50",
      action: "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100",
      heading: "text-emerald-800",
      body: "text-emerald-900/80",
    };
  }

  if (recommendation.status === "not_ready") {
    return {
      card: "border-amber-200 bg-amber-50/40",
      action: "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed",
      heading: "text-amber-800",
      body: "text-amber-900/85",
    };
  }

  return {
    card: "border-slate-200 bg-slate-50/70",
    action: "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed",
    heading: "text-slate-700",
    body: "text-slate-600",
  };
};

const getRecommendationHeadline = (recommendation?: PromotionRecommendation | null) => {
  if (!recommendation || recommendation.status === "insufficient_data") {
    return "Needs more data";
  }
  return recommendation.status === "ready" ? "Ready to promote" : "Not ready yet";
};

interface StudentDetailModalProps {
  show: boolean;
  onClose: () => void;
  student: any;
  onPromote?: (subject: PromotionSubject) => void;
  promoteLoading?: boolean;
  reportHref?: string;
  promotionRecommendationApiPath?: string;
  promotionRecommendationRefreshKey?: number;
}

export default function StudentDetailModal({
  show,
  onClose,
  student,
  onPromote,
  promoteLoading = false,
  reportHref,
  promotionRecommendationApiPath,
  promotionRecommendationRefreshKey = 0,
}: StudentDetailModalProps) {
  const [recommendations, setRecommendations] = useState<Record<PromotionSubject, PromotionRecommendation> | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [pendingPromotionSubject, setPendingPromotionSubject] = useState<PromotionSubject | null>(null);

  const studentId = String(student?.studentId ?? student?.id ?? "").trim();
  const studentName = useMemo(() => {
    const firstName = String(student?.firstName ?? student?.first_name ?? "").trim();
    const lastName = String(student?.lastName ?? student?.last_name ?? "").trim();
    const fallbackName = String(student?.name ?? "").trim();
    return `${firstName} ${lastName}`.trim() || fallbackName || "this student";
  }, [student]);

  useEffect(() => {
    setPendingPromotionSubject(null);

    if (!show || !studentId || !onPromote || !promotionRecommendationApiPath) {
      setRecommendations(null);
      setRecommendationError(null);
      setRecommendationLoading(false);
      return;
    }

    const controller = new AbortController();
    const loadRecommendations = async () => {
      setRecommendationLoading(true);
      setRecommendationError(null);
      try {
        const query = new URLSearchParams({
          studentId,
          englishLevel: String(student?.englishPhonemic ?? student?.english ?? "").trim(),
          filipinoLevel: String(student?.filipinoPhonemic ?? student?.filipino ?? "").trim(),
          mathLevel: String(student?.mathProficiency ?? student?.math ?? "").trim(),
        });
        const response = await fetch(
          `${promotionRecommendationApiPath}?${query.toString()}`,
          { signal: controller.signal },
        );

        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.success || !payload?.recommendations) {
          throw new Error(payload?.error ?? "Unable to evaluate promotion readiness.");
        }

        setRecommendations(payload.recommendations as Record<PromotionSubject, PromotionRecommendation>);
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        setRecommendations(null);
        setRecommendationError(
          error instanceof Error ? error.message : "Unable to evaluate promotion readiness.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setRecommendationLoading(false);
        }
      }
    };

    void loadRecommendations();
    return () => controller.abort();
  }, [show, studentId, student, onPromote, promotionRecommendationApiPath, promotionRecommendationRefreshKey]);

  if (!show || !student) return null;

  const footer = (
    <div className="flex flex-wrap gap-3 justify-end">
      {reportHref && (
        <Link
          href={reportHref}
          className="border border-[#013300] text-[#013300] px-6 py-2 rounded-lg hover:bg-[#013300]/5 transition-colors font-medium"
        >
          View Report
        </Link>
      )}
      <button
        onClick={onClose}
        className="bg-[#013300] text-white px-6 py-2 rounded-lg hover:bg-[#013300]/90 transition-colors font-medium"
      >
        Close
      </button>
    </div>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Student Details"
      maxWidth="2xl"
      footer={footer}
    >
      <ModalSection title="Personal Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <ModalInfoItem label="LRN" value={student.lrn} />
          <ModalInfoItem label="Student ID" value={student.studentId} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <ModalInfoItem label="First Name" value={student.firstName ?? student.first_name ?? ""} />
          <ModalInfoItem label="Middle Name" value={student.middleName ?? student.middle_name ?? ""} />
          <ModalInfoItem label="Last Name" value={student.lastName ?? student.last_name ?? ""} />
          <ModalInfoItem label="Suffix" value={student.suffix ?? student.suffix_name ?? student.suf ?? ""} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ModalInfoItem label="Grade" value={student.grade} />
          <ModalInfoItem label="Section" value={student.section} />
        </div>
      </ModalSection>

      <ModalSection title="Parent and Contact Information">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <ModalInfoItem
            label="First Name"
            value={
              student.parentFirstName ??
              student.parent_first_name ??
              student.guardianFirstName ??
              student.guardian_first_name ??
              ""
            }
          />
          <ModalInfoItem
            label="Middle Name"
            value={
              student.parentMiddleName ??
              student.parent_middle_name ??
              student.guardianMiddleName ??
              student.guardian_middle_name ??
              ""
            }
          />
          <ModalInfoItem
            label="Last Name"
            value={
              student.parentLastName ??
              student.parent_last_name ??
              student.guardianLastName ??
              student.guardian_last_name ??
              ""
            }
          />
          <ModalInfoItem
            label="Suffix"
            value={
              student.parentSuffix ??
              student.parent_suffix ??
              student.guardianSuffix ??
              student.guardian_suffix ??
              student.guardian_suf ??
              ""
            }
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <ModalInfoItem label="Relationship" value={student.relationship} />
          <ModalInfoItem label="Phone Number" value={student.guardianContact} />
          <ModalInfoItem label="Email" value={student.guardianEmail} />
        </div>
        <div className="grid grid-cols-1">
          <ModalInfoItem label="Address" value={student.address} />
        </div>
      </ModalSection>

      <ModalSection title="Assessment Levels">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ModalInfoItem label="English Phonemic" value={student.englishPhonemic} />
          <ModalInfoItem label="Filipino Phonemic" value={student.filipinoPhonemic} />
          <ModalInfoItem label="Math Proficiency" value={student.mathProficiency} />
        </div>
      </ModalSection>

      {onPromote && (
        <ModalSection title="Promote Level">
          <div className="space-y-3">
            {recommendationError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {recommendationError}
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {PROMOTION_SUBJECTS.map((subject) => {
              const item = {
                subject,
                level:
                  subject === "English"
                    ? student.englishPhonemic ?? student.english ?? ""
                    : subject === "Filipino"
                      ? student.filipinoPhonemic ?? student.filipino ?? ""
                      : student.mathProficiency ?? student.math ?? "",
              };
              const recommendation = recommendations?.[subject] ?? null;
              const tone = getRecommendationTone(recommendation);
              const levelLabel = String(item.level ?? "").trim();
              const isAvailable = levelLabel.length > 0 && levelLabel.toLowerCase() !== "n/a";
              const isDisabled =
                promoteLoading ||
                recommendationLoading ||
                !isAvailable ||
                !recommendation?.canPromote;
              const statusLabel = recommendationLoading
                ? "Checking"
                : recommendation?.status === "ready"
                  ? "Ready"
                  : recommendation?.status === "not_ready"
                    ? "Not Ready"
                    : "Needs Data";
              const actionLabel = recommendationLoading
                ? "Checking..."
                : promoteLoading
                  ? "Promoting..."
                  : recommendation?.canPromote
                    ? "Promote"
                    : "Locked";
              return (
                <div
                  key={item.subject}
                  className={`flex flex-col gap-3 rounded-xl border px-4 py-3 text-left ${tone.card}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`shrink-0 ${tone.heading}`}>
                      {recommendationLoading ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
                      ) : (
                        getTrendIcon(recommendation?.trend ?? "neutral")
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-gray-900">{item.subject}</div>
                      <div className={`text-sm font-bold ${tone.heading}`}>
                        {recommendationLoading ? "Checking promotion readiness..." : getRecommendationHeadline(recommendation)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className={`text-sm leading-6 ${tone.body}`}>
                      {recommendationLoading
                        ? "Evaluating the latest remedial session averages..."
                        : recommendation?.message ?? "Promotion readiness is unavailable."}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPendingPromotionSubject(item.subject)}
                    disabled={isDisabled}
                    className={`flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition ${tone.action}`}
                  >
                    {actionLabel}
                  </button>
                </div>
              );
            })}
            </div>
          </div>
        </ModalSection>
      )}
      <ConfirmationModal
        isOpen={Boolean(pendingPromotionSubject)}
        onClose={() => setPendingPromotionSubject(null)}
        onConfirm={() => {
          if (!pendingPromotionSubject) {
            return;
          }
          setPendingPromotionSubject(null);
          onPromote?.(pendingPromotionSubject);
        }}
        title="Confirm Promotion"
        message={
          pendingPromotionSubject
            ? `Promote ${studentName} to the next ${pendingPromotionSubject} level? ${recommendations?.[pendingPromotionSubject]?.message ?? ""}`
            : ""
        }
      />
    </BaseModal>
  );
}
