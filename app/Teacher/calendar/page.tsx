import dynamic from "next/dynamic";
import TeacherPageSkeleton from "@/components/Teacher/TeacherPageSkeleton";

const TeacherCalendar = dynamic(() => import("@/modules/Teacher/calendar/calendar"), {
  loading: () => <TeacherPageSkeleton title="Calendar" />,
});

export default function Calendar() {
  return <TeacherCalendar />;
}
