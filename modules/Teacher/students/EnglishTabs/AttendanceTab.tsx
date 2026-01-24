"use client";

import AttendanceTabBase from "@/components/Common/AttendanceTab/AttendanceTabBase";

type AttendanceTabProps = {
  students: any[];
  searchTerm: string;
};

export default function AttendanceTab({ students, searchTerm }: AttendanceTabProps) {
  return (
    <AttendanceTabBase
      subjectKey="english"
      subjectLabel="English"
      students={students}
      searchTerm={searchTerm}
      attendanceApiBase="/api/teacher/remedial/attendance"
    />
  );
}