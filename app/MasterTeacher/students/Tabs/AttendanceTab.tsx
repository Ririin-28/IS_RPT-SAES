"use client";
import { useState, useEffect, useMemo } from "react";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

interface AttendanceTab {
  students: any[];
  setStudents: React.Dispatch<React.SetStateAction<any[]>>;
  searchTerm: string;
}

export default function AttendanceTab({ students, searchTerm }: AttendanceTab) {
  const [view, setView] = useState("Week"); // Default to Week view
  const [isEditing, setIsEditing] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get month name and year
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const currentMonth = monthNames[currentDate.getMonth()];
  const currentYear = currentDate.getFullYear();

  // Generate days for the current month using useMemo to prevent recreation on every render
  const generateMonthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      days.push({
        day: day,
        dayName: dayName,
        key: `${dayName} ${day}`,
        fullDate: date
      });
    }

    return days;
  }, [currentDate]);

  // Generate days for the current week using useMemo to prevent recreation on every render
  const generateWeekDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const day = currentDate.getDate();

    // Find the start of the week (Sunday)
    const startOfWeek = new Date(year, month, day - currentDate.getDay());
    const days = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNum = date.getDate();
      days.push({
        day: dayNum,
        dayName: dayName,
        key: `${dayName} ${dayNum}`,
        fullDate: date
      });
    }

    return days;
  }, [currentDate]);

  const monthDays = generateMonthDays;
  const weekDays = generateWeekDays;

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  // Filter students based on search term
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        student.name?.toLowerCase().includes(searchLower) ||
        student.studentId?.toLowerCase().includes(searchLower) ||
        student.grade?.toString().includes(searchLower) ||
        student.section?.toLowerCase().includes(searchLower)
      );
    });
  }, [students, searchTerm]);

  // Initialize attendance data when students, date, or view changes
  useEffect(() => {
    const daysToUse = view === "Month" ? monthDays : weekDays;
    const initialAttendance = filteredStudents.map((student, idx) => {
      const attendanceRecord: any = {
        id: student.id,
        name: student.name,
        no: idx + 1,
      };
      // Initialize all days with "unmarked" status
      daysToUse.forEach(day => {
        attendanceRecord[day.key] = "unmarked";
      });
      return attendanceRecord;
    });
    setAttendanceData(initialAttendance);
  }, [filteredStudents, currentDate, view, monthDays, weekDays]);

  const toggleAttendance = (studentId: number, day: string) => {
    setAttendanceData(prev => prev.map(student => {
      if (student.id === studentId) {
        const currentStatus = student[day];
        let newStatus;
        if (currentStatus === "unmarked") {
          newStatus = "present";
        } else if (currentStatus === "present") {
          newStatus = "absent";
        } else {
          newStatus = "unmarked";
        }
        return { ...student, [day]: newStatus };
      }
      return student;
    }));
  };

  const getAttendanceDisplay = (status: string, studentId: number, day: string) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case "present": return "bg-[#013300] text-white";
        case "absent": return "bg-red-600 text-white";
        case "unmarked": return "bg-gray-200 text-gray-500";
        default: return "bg-gray-300 text-gray-600";
      }
    };

    const getIcon = (status: string) => {
      switch (status) {
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
          return (
            <div className="w-2 h-2 rounded-full bg-current opacity-40"></div>
          );
        default:
          return null;
      }
    };

    if (isEditing) {
      return (
        <button
          onClick={() => toggleAttendance(studentId, day)}
          className={`w-8 h-8 rounded-md flex items-center justify-center transition-all hover:scale-110 hover:shadow-md ${
            getStatusColor(status)
          }`}
          title={status === "unmarked" ? "Click to mark as present" : status === "present" ? "Click to mark as absent" : "Click to clear"}
        >
          {getIcon(status)}
        </button>
      );
    }

    return (
      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
        getStatusColor(status)
      }`}>
        {getIcon(status)}
      </div>
    );
  };
  
  // Generate dynamic columns based on view
  const columns = useMemo(() => [
    { key: "no", title: "No#", render: (row: any) => row.no },
    { key: "name", title: "NAME" },
    ...(view === "Month" ? monthDays : weekDays).map(day => ({
      key: day.key,
      title: `${day.dayName} ${day.day}`,
      render: (row: any) => getAttendanceDisplay(row[day.key], row.id, day.key)
    }))
  ], [view, monthDays, weekDays]);
  
  return (
    <div>
      {/* Clean Header with Navigation */}
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
          <SecondaryHeader title={view === "Month" ? `${currentMonth} ${currentYear}` : `Week of ${weekDays[0]?.dayName} ${weekDays[0]?.day} - ${weekDays[6]?.dayName} ${weekDays[6]?.day}, ${currentYear}`} />
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
          {/* View Toggle Buttons - Moved to the right side */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView("Week")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Week"
                  ? "bg-white text-[#013300] shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setView("Month")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                view === "Month"
                  ? "bg-white text-[#013300] shadow-sm"
                  : "text-gray-600 hover:text-gray-800"
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

      {/* Simple Legend */}
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