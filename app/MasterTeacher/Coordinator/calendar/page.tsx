import dynamic from "next/dynamic";
import MasterTeacherPageSkeleton from "@/components/MasterTeacher/MasterTeacherPageSkeleton";

const MasterTeacherCalendar = dynamic(() => import("@/modules/MasterTeacher/Coordinator/calendar/calendar"), {
  loading: () => <MasterTeacherPageSkeleton title="Calendar" variant="coordinator" />,
});

export default function Calendar() {
  return <MasterTeacherCalendar />;
}
