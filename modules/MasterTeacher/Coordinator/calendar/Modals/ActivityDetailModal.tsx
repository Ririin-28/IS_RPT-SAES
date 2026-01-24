import BaseModal, {
  ModalInfoItem,
  ModalSection,
} from "@/components/Common/Modals/BaseModal";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

const parseTimestamp = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const primary = new Date(trimmed);
  if (!Number.isNaN(primary.getTime())) {
    return primary;
  }
  const fallback = new Date(trimmed.replace(/\s/, "T"));
  if (!Number.isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
};

const formatDateLabel = (value: Date | null): string | null => {
  if (!value) {
    return null;
  }
  return value.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

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
  requestedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  sourceTable?: string | null;
  requester?: string | null;
}

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  onDelete?: (id: number) => void;
}

export default function ActivityDetailModal({ activity, onClose, onDelete }: ActivityDetailModalProps) {
  if (!activity) return null;
  const formatGradeLabel = (value: unknown): string => {
    const match = String(value ?? "").match(/(\d+)/);
    const digit = match?.[1] ?? "";
    return digit ? `Grade ${digit}` : "Grade 3";
  };

  const gradeLabel = formatGradeLabel(activity.gradeLevel);
  const subjectLabel = activity.subject ?? activity.title;
  const timeRange = `${activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const dayLabel = activity.day ?? activity.date.toLocaleDateString("en-US", { weekday: "long" });
  const statusLabel = activity.status ?? "Draft";
  const isLocked = statusLabel.toLowerCase().includes("approve");
  const statusDisplay = isLocked ? `${statusLabel} (View Only)` : statusLabel;
  const requestedDate = formatDateLabel(parseTimestamp(activity.requestedAt ?? null));
  const approvedDate = formatDateLabel(parseTimestamp(activity.approvedAt ?? null));
  const requestApprovalItems = [
    { label: "Submitted On", value: requestedDate },
    { label: "Submitted By", value: activity.requester },
    { label: "Approved On", value: approvedDate },
    { label: "Approved By", value: activity.approvedBy },
  ].filter((entry) => Boolean(entry.value && String(entry.value).trim().length));
  
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
          <ModalInfoItem label="Status" value={statusDisplay} />
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
          <ModalInfoItem label="Time Slot" value={timeRange} />
        </div>
      </ModalSection>

      {requestApprovalItems.length > 0 && (
        <ModalSection title="Request & Approval">
          <div className="grid gap-4 sm:grid-cols-2">
            {requestApprovalItems.map((item) => (
              <ModalInfoItem key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </ModalSection>
      )}
    </BaseModal>
  );
}