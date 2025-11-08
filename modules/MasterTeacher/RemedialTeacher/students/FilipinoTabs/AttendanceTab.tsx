"use client";

import AttendanceTabBase from "../components/AttendanceTabBase";

type AttendanceTabProps = {
  students: any[];
  searchTerm: string;
};

export default function AttendanceTab({ students, searchTerm }: AttendanceTabProps) {
  return (
    <AttendanceTabBase
      subjectKey="filipino"
      subjectLabel="Filipino"
      students={students}
      searchTerm={searchTerm}
    />
  );
}