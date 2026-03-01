import BaseModal, {
  ModalInfoItem,
  ModalSection,
} from "@/components/Common/Modals/BaseModal";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface Activity {
  id: number;
  title: string;
  date: Date;
  end: Date;
  type: string;
  gradeLevel?: string;
  subject?: string;
  day?: string;
  status?: string | null;
}

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  onDelete?: (id: number) => void;
  remedialTime?: string | null;
}

export default function ActivityDetailModal({ activity, onClose, onDelete, remedialTime }: ActivityDetailModalProps) {
  if (!activity) return null;
  const normalizeStatusLabel = (value: string | null | undefined): string => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["1", "approved", "accept", "accepted", "granted", "true", "yes", "ok"].includes(normalized)) {
      return "Approved";
    }
    if (["0", "pending", "awaiting", "submitted", "for approval", "waiting"].includes(normalized)) {
      return "Pending";
    }
    if (["rejected", "declined", "denied", "cancelled", "canceled", "void"].includes(normalized)) {
      return "Declined";
    }
    if (!normalized) {
      return "Pending";
    }
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
  };

  const formatGradeLabel = (value: unknown): string => {
    const match = String(value ?? "").match(/(\d+)/);
    const digit = match?.[1] ?? "";
    return digit ? `Grade ${digit}` : "Grade 3";
  };

  const gradeLabel = formatGradeLabel(activity.gradeLevel);
  const subjectLabel = activity.subject ?? activity.title;
  const timeRange = `${activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const remedialTimeLabel = remedialTime && remedialTime.trim().length > 0 ? remedialTime : timeRange;
  const dayLabel = activity.day ?? activity.date.toLocaleDateString("en-US", { weekday: "long" });
  const statusLabel = normalizeStatusLabel(activity.status);
  const isLocked = statusLabel === "Approved";
  const statusDisplay = statusLabel;

  return (
    <BaseModal
      show={Boolean(activity)}
      onClose={onClose}
      title="Activity Details"
      maxWidth="lg"
      footer={(
        <>
          {!isLocked && onDelete && (
            <DangerButton
              type="button"
              onClick={() => onDelete(activity.id)}
              className="px-5 py-2.5"
            >
              Delete
            </DangerButton>
          )}
          <SecondaryButton type="button" onClick={onClose} className="px-5 py-2.5">
            Close
          </SecondaryButton>
        </>
      )}
    >
      <ModalSection title="Grade and Subject">
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalInfoItem label="Subject" value={subjectLabel} />
          <ModalInfoItem label="Grade Level" value={gradeLabel} />
          {!isLocked && <ModalInfoItem label="Status" value={statusDisplay} />}
        </div>
      </ModalSection>

      <ModalSection title="Date and Time">
        <div className="grid gap-4 sm:grid-cols-2">
          <ModalInfoItem
            label="Date"
            value={activity.date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <ModalInfoItem label="Day" value={dayLabel} />
          <ModalInfoItem label="Time" value={remedialTimeLabel} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}
