import BaseModal, { ModalInfoItem, ModalSection } from "@/components/Common/Modals/BaseModal";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface Activity {
  id: string;
  title: string;
  day: string | null;
  date: Date;
  end: Date;
  subject: string | null;
  grade: string | null;
}

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  remedialTime?: string | null;
}

const formatGradeLabel = (value: string | null | undefined): string => {
  const match = String(value ?? "").match(/(\d+)/);
  const digit = match?.[1] ?? "";
  return digit ? `Grade ${digit}` : "Grade 3";
};

export default function ActivityDetailModal({ activity, onClose, remedialTime }: ActivityDetailModalProps) {
  if (!activity) return null;

  const timeRange = `${activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const timeLabel = remedialTime && remedialTime.trim().length > 0 ? remedialTime : timeRange;
  const dayLabel = activity.day ?? activity.date.toLocaleDateString("en-US", { weekday: "long" });
  const subjectLabel = activity.subject ?? activity.title;
  const gradeLabel = formatGradeLabel(activity.grade);

  return (
    <BaseModal
      show={Boolean(activity)}
      onClose={onClose}
      title="Activity Details"
      maxWidth="lg"
      footer={(
        <>
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
          <ModalInfoItem label="Time" value={timeLabel} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}
