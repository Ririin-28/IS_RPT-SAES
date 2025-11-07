"use client";
import { useState, useEffect, useMemo } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import type { CoordinatorTeacher } from "../useCoordinatorTeachers";

interface AttendanceTabProps {
  teachers: CoordinatorTeacher[];
  searchTerm: string;
}

export default function AttendanceTab({ teachers, searchTerm }: AttendanceTabProps) {
  const [view, setView] = useState("Week");
  const [isEditing, setIsEditing] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentMonth = monthNames[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  // Generate days for current month using useMemo
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: any[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({ day, dayName, key: `${dayName} ${day}`, fullDate: date });
    }

    return days;
  }, [currentDate]);

  // Generate days for current week using useMemo
  const weekDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();
    const startOfWeek = new Date(year, month, day - currentDate.getDay());
    const days: any[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      days.push({ day: dayNum, dayName, key: `${dayName} ${dayNum}`, fullDate: date });
    }

    return days;
  }, [currentDate]);

  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToPreviousWeek = () => { const d = new Date(currentDate); d.setDate(currentDate.getDate() - 7); setCurrentDate(d); };
  const goToNextWeek = () => { const d = new Date(currentDate); d.setDate(currentDate.getDate() + 7); setCurrentDate(d); };

  // Filter teachers based on search term using useMemo
  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        teacher.name?.toLowerCase().includes(searchLower) ||
        teacher.teacherId?.toLowerCase().includes(searchLower) ||
        teacher.email?.toLowerCase().includes(searchLower) ||
        teacher.contactNumber?.toLowerCase().includes(searchLower)
      );
    });
  }, [teachers, searchTerm]);

  // Initialize attendance when filteredTeachers, currentDate or view changes
  useEffect(() => {
    const daysToUse = view === "Month" ? monthDays : weekDays;
    const initial = filteredTeachers.map((t, idx) => {
      const record: any = { id: t.id, name: t.name, no: idx + 1 };
      daysToUse.forEach(d => { record[d.key] = "unmarked"; });
      return record;
    });
    setAttendanceData(initial);
  }, [filteredTeachers, currentDate, view, monthDays, weekDays]);

  const toggleAttendance = (teacherId: number, day: string) => {
    setAttendanceData(prev => prev.map(row => {
      if (row.id === teacherId) {
        const current = row[day];
        let next;
        if (current === "unmarked") next = "present";
        else if (current === "present") next = "absent";
        else next = "unmarked";
        return { ...row, [day]: next };
      }
      return row;
    }));
  };

  const getAttendanceDisplay = (status: string, teacherId: number, day: string) => {
    const getStatusColor = (s: string) => {
      switch (s) {
        case "present": return "bg-[#013300] text-white";
        case "absent": return "bg-red-600 text-white";
        case "unmarked": return "bg-gray-200 text-gray-500";
        default: return "bg-gray-300 text-gray-600";
      }
    };

    const getIcon = (s: string) => {
      switch (s) {
        case "present":
          return (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          );
        case "absent":
          return (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          );
        case "unmarked":
          return <div className="w-2 h-2 rounded-full bg-current opacity-40" />;
        default:
          return null;
      }
    };

    if (isEditing) {
      return (
        <button
          onClick={() => toggleAttendance(teacherId, day)}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all hover:scale-110 hover:shadow-md ${getStatusColor(status)}`}
          title={status === "unmarked" ? "Click to mark present" : status === "present" ? "Click to mark absent" : "Click to clear"}
        >
          {getIcon(status)}
        </button>
      );
    }

    return (
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${getStatusColor(status)}`}>
        {getIcon(status)}
      </div>
    );
  };

  // Use useMemo for columns to prevent unnecessary recalculations
  const columns = useMemo(() => [
    {
      key: "no",
      title: "No#",
      render: (row: any) => row.no,
      headerClassName: "py-4"
    },
    {
      key: "name",
      title: "NAME",
      headerClassName: "py-4"
    },
    ...(view === "Month" ? monthDays : weekDays).map(day => ({
      key: day.key,
      title: `${day.dayName} ${day.day}`,
      render: (row: any) => getAttendanceDisplay(row[day.key], row.id, day.key),
      headerClassName: "py-4"
    }))
  ], [view, monthDays, weekDays]);

  // Format week title to show the full week range
  const weekTitle = useMemo(() => {
    if (weekDays.length === 0) return `Week of ${currentDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
    return `Week of ${weekDays[0].dayName} ${weekDays[0].day} - ${weekDays[6].dayName} ${weekDays[6].day}, ${currentYear}`;
  }, [weekDays, currentYear]);

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-3">
          <button
            onClick={view === "Month" ? goToPreviousMonth : goToPreviousWeek}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <SecondaryHeader title={view === "Month" ? `${currentMonth} ${currentYear}` : weekTitle} />

          <button
            onClick={view === "Month" ? goToNextMonth : goToNextWeek}
            className="p-2 rounded-md bg-white border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView("Week")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Week" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("Month")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Month" ? "bg-white text-[#013300] shadow-sm" : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Month
            </button>
          </div>

          {isEditing ? (
            <div className="flex gap-2">
              <UtilityButton small onClick={() => setIsEditing(false)}>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </span>
              </UtilityButton>
              <PrimaryButton small onClick={() => setIsEditing(false)}>
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Save
                </span>
              </PrimaryButton>
            </div>
          ) : (
            <UtilityButton small onClick={() => setIsEditing(true)}>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span className="hidden sm:inline">Edit</span>
              </span>
            </UtilityButton>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-center gap-6 text-sm text-gray-600">
        <span className="font-medium">Legend:</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-gray-300"></div>
          <span>Unmarked</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#013300]"></div>
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-red-600"></div>
          <span>Absent</span>
        </div>
      </div>

      {/* Add custom styling to the table header */}
      <div className="[&_th]:py-2">
        <TableList columns={columns} data={attendanceData} pageSize={10} />
      </div>
    </div>
  );
}