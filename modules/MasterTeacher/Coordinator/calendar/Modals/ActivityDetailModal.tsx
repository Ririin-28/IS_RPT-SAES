import BaseModal, {
  ModalInfoItem,
  ModalSection,
} from "@/components/Common/Modals/BaseModal";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

interface Activity {
  id: number;
  title: string;
  roomNo: string;
  description?: string;
  date: Date;
  end: Date;
  type: string;
  gradeLevel?: string;
  subject?: string;
  day?: string;
}

interface ActivityDetailModalProps {
  activity: Activity | null;
  onClose: () => void;
  onDelete?: (id: number) => void;
}

export default function ActivityDetailModal({ activity, onClose, onDelete }: ActivityDetailModalProps) {
  if (!activity) return null;
  const gradeLabel = activity.gradeLevel ?? "Grade 3";
  const subjectLabel = activity.subject ?? activity.title;
  const timeRange = `${activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  const dayLabel = activity.day ?? activity.date.toLocaleDateString("en-US", { weekday: "long" });
  
  return (
    <BaseModal
      show={Boolean(activity)}
      onClose={onClose}
      title="Activity Details"
      maxWidth="lg"
      footer={(
        <>
          <DangerButton
            type="button"
            onClick={() => onDelete && onDelete(activity.id)}
            className="px-5 py-2.5"
          >
            Delete
          </DangerButton>
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
          <ModalInfoItem label="Time Slot" value={timeRange} />
        </div>
      </ModalSection>
    </BaseModal>
  );
}