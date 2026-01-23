import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import BaseModal, { ModalInfoItem, ModalSection } from "@/components/Common/Modals/BaseModal";
import { useMemo } from "react";

type ActivityPreview = {
  id: number | string;
  title: string;
  date: Date;
  end?: Date | null;
  subject?: string | null;
};

interface SendActivitiesModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
  activities: ActivityPreview[];
  gradeLabel: string;
  subjectSummary: string | null;
}

const formatDateLabel = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

const formatDayLabel = (date: Date) => date.toLocaleDateString("en-US", { weekday: "long" });

const buildDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};


export default function SendActivitiesModal({
  show,
  onClose,
  onConfirm,
  loading,
  error,
  activities,
  gradeLabel,
  subjectSummary,
}: SendActivitiesModalProps) {
  const groupedActivities = useMemo(() => {
    const map = new Map<string, ActivityPreview[]>();

    for (const activity of activities) {
      const key = buildDateKey(activity.date);
      const list = map.get(key) ?? [];
      list.push(activity);
      map.set(key, list);
    }

    return Array.from(map.entries())
      .map(([dateKey, entries]) => {
        const parts = dateKey.split("-");
        const date = parts.length === 3 ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])) : new Date();
        return {
          isoDate: dateKey,
          date,
          dayLabel: formatDayLabel(date),
          dateLabel: formatDateLabel(date),
          entries: [...entries].sort((a, b) => a.date.getTime() - b.date.getTime()),
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [activities]);

  const footer = (
    <>
      <SecondaryButton type="button" onClick={onClose}>
        Cancel
      </SecondaryButton>
      <PrimaryButton
        type="button"
        onClick={onConfirm}
        disabled={loading || activities.length === 0}
      >
        {loading ? "Sending..." : `Send ${activities.length || ""} Activities`}
      </PrimaryButton>
    </>
  );

  return (
    <BaseModal
      show={show}
      onClose={onClose}
      title="Send Activities to Principal"
      footer={footer}
      maxWidth="3xl"
    >
      <div className="space-y-6">
        <ModalSection title="Summary">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ModalInfoItem label="Grade Level" value={gradeLabel} />
            <ModalInfoItem label="Subject Focus" value={subjectSummary ?? "Not assigned"} />
            <ModalInfoItem
              label="Activities Prepared"
              value={activities.length > 0 ? `${activities.length}` : "No activities scheduled"}
            />
          </div>
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
        </ModalSection>

        <ModalSection title="Schedule Preview">
          {groupedActivities.length > 0 ? (
            <div className="space-y-3">
              {groupedActivities.map(({ isoDate, dayLabel, dateLabel, entries }) => (
                <div key={isoDate} className="rounded-lg border border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div className="text-sm font-semibold uppercase tracking-wide text-gray-600">{dayLabel}</div>
                    <div className="text-sm text-gray-700">{dateLabel}</div>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {entries.map((activity) => (
                      <li key={activity.id} className="px-4 py-3 text-sm text-gray-700">
                        <div className="font-medium text-gray-900">{activity.title}</div>
                        {activity.subject && (
                          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                            <span>• {activity.subject}</span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600">
              No activities are currently planned. Add calendar entries to build your submission.
            </div>
          )}
        </ModalSection>
      </div>
    </BaseModal>
  );
}
