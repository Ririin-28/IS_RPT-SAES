import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherCalendar = dynamic(() => import("@/modules/MasterTeacher/RemedialTeacher/calendar/calendar"), {
  loading: () => <MasterTeacherPageSkeleton title="Calendar" variant="remedial" />,
});

export default function Calendar() {
  return <MasterTeacherCalendar />;
}
