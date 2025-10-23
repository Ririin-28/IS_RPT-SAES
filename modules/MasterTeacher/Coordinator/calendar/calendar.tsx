"use client";
import Sidebar from "@/components/MasterTeacher/Coordinator/Sidebar";
import Header from "@/components/MasterTeacher/Header";
import { useState } from "react";
import { useForm } from "react-hook-form";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
// Modal Components
import AddScheduleModal from "./Modals/AddScheduleModal";
import ActivityDetailModal from "./Modals/ActivityDetailModal";
import DeleteConfirmationModal from "./Modals/DeleteConfirmationModal";

interface Activity {
  id: number;
  title: string;
  day: string;
  roomNo: string;
  description: string;
  date: Date;
  end: Date;
  type: string;
}

export default function MasterTeacherCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState("month");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);

  // React Hook Form setup
  const formMethods = useForm({
    defaultValues: {
      title: "",
      date: "",
      roomNo: "",
      description: "",
      teachers: [],
    },
  });
  const { reset, setValue } = formMethods;

  // Activities data in state - Start with empty array
  const [activities, setActivities] = useState<Activity[]>([]);

  // Get week number for a date
  const getWeekNumber = (date: Date): number => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
    return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
  };

  // Group activities by week
  const getActivitiesByWeek = () => {
    const grouped: { [key: string]: Activity[] } = {};
    
    activities.forEach(activity => {
      const weekNumber = getWeekNumber(activity.date);
      const weekKey = `Week ${weekNumber}`;
      
      if (!grouped[weekKey]) {
        grouped[weekKey] = [];
      }
      grouped[weekKey].push(activity);
    });

    // Sort weeks and activities within each week
    return Object.entries(grouped)
      .sort(([a], [b]) => parseInt(a.replace('Week ', '')) - parseInt(b.replace('Week ', '')))
      .map(([week, weekActivities]) => ({
        week,
        activities: weekActivities.sort((a, b) => a.date.getTime() - b.date.getTime())
      }));
  };

  // Navigation functions
  const prevPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (view === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Handle double click on date
  const handleDateDoubleClick = (date: Date) => {
    setSelectedDate(date);
    setValue("date", date.toLocaleDateString("en-CA")); 
    setShowAddModal(true);
  };

  // Add new schedule
  const handleAddSchedule = (data: any) => {
    const [year, month, day] = data.date.split("-").map(Number);
    const startDate = new Date(year, month - 1, day, 9, 0, 0);
    const endDate = new Date(year, month - 1, day, 10, 0, 0);

    const newActivity: Activity = {
      id: activities.length > 0 ? Math.max(...activities.map((a) => a.id)) + 1 : 1,
      ...data,
      day: startDate.toLocaleDateString("en-US", { weekday: "long" }),
      date: startDate,
      end: endDate,
      type: "class",
    };

    setActivities([...activities, newActivity]);
    setShowAddModal(false);
    reset();
  };

  // Delete schedule with confirmation
  const handleDeleteClick = (activity: Activity) => {
    setActivityToDelete(activity);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = () => {
    if (activityToDelete) {
      setActivities(activities.filter((activity) => activity.id !== activityToDelete.id));
      setSelectedActivity(null);
      setShowDeleteModal(false);
      setActivityToDelete(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setActivityToDelete(null);
  };

  // Activity type colors
  const getActivityColor = (type: string) => {
    switch(type) {
      case "class": return "bg-blue-100 text-blue-800 border-blue-200";
      case "meeting": return "bg-green-100 text-green-800 border-green-200";
      case "appointment": return "bg-purple-100 text-purple-800 border-purple-200";
      case "event": return "bg-amber-100 text-amber-800 border-amber-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Render the calendar based on view
  const renderCalendar = () => {
    if (view === "month") {
      return renderMonthView();
    } else if (view === "week") {
      return renderWeekView();
    } else {
      return renderListView();
    }
  };

  // List View
  const renderListView = () => {
    const activitiesByWeek = getActivitiesByWeek();

    return (
      <div className="space-y-6">
        {activitiesByWeek.length > 0 ? (
          activitiesByWeek.map(({ week, activities }) => (
            <div key={week} className="border rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 border-b pb-2">
                {week} - {activities[0].date.getFullYear()}
              </h3>
              <div className="space-y-3">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="p-3 border-l-4 border-[#013300] bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{activity.title}</div>
                        <div className="text-sm text-gray-600 mt-1">
                          {activity.date.toLocaleDateString("en-US", { 
                            month: "long", 
                            day: "numeric", 
                            year: "numeric" 
                          })}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">{activity.roomNo}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(activity);
                        }}
                        className="text-gray-400 hover:text-red-500 text-lg"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">
            No activities scheduled. Double-click on a date in month view to add activities.
          </div>
        )}
      </div>
    );
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const weeks = [];
    let day = 1;

    for (let i = 0; i < 6; i++) {
      if (day > daysInMonth) break;

      const days = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < firstDay) || day > daysInMonth) {
          days.push(<div key={`empty-${i}-${j}`} className="h-20 p-1 border border-gray-100"></div>);
        } else {
          const currentDay = new Date(year, month, day);
          const dayActivities = activities.filter(
            (a) => a.date.getDate() === day && a.date.getMonth() === month && a.date.getFullYear() === year
          );

          days.push(
            <div
              key={`day-${day}`}
              className="h-20 p-1 border border-gray-100 overflow-hidden relative hover:bg-gray-50 transition-colors cursor-pointer"
              onDoubleClick={() => handleDateDoubleClick(currentDay)}
            >
              <div className="text-right text-sm font-medium text-gray-800 mb-1">
                {day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear() ? (
                  <span className="inline-block w-6 h-6 bg-[#013300] text-white rounded-full text-center leading-6">
                    {day}
                  </span>
                ) : (
                  <span>{day}</span>
                )}
              </div>
              <div className="overflow-y-auto max-h-12 space-y-1">
                {dayActivities.slice(0, 2).map((activity) => (
                  <div
                    key={activity.id}
                    className={`text-xs p-1 rounded truncate cursor-pointer border ${getActivityColor(activity.type)}`}
                    onClick={() => setSelectedActivity(activity)}
                  >
                    <div className="flex justify-between items-center">
                      <span className="truncate">{activity.title}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(activity);
                        }}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
                {dayActivities.length > 2 && (
                  <div className="text-xs text-gray-500 text-center bg-gray-100 rounded p-1">
                    +{dayActivities.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
          day++;
        }
      }
      weeks.push(
        <div key={`week-${i}`} className="grid grid-cols-7">
          {days}
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 bg-gray-50 text-sm font-medium text-gray-700">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <div key={`${day}-${index}`} className="p-2 text-center">
              {day}
            </div>
          ))}
        </div>
        <div className="divide-y">{weeks}</div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const days = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(startDate.getDate() + i);

      const dayActivities = activities
        .filter(
          (a) =>
            a.date.getDate() === dayDate.getDate() &&
            a.date.getMonth() === dayDate.getMonth() &&
            a.date.getFullYear() === dayDate.getFullYear()
        )
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      days.push(
        <div 
          key={`weekday-${i}`} 
          className="border-b border-gray-200"
          onDoubleClick={() => handleDateDoubleClick(dayDate)}
        >
          <div className="p-2 bg-gray-50">
            <div>
              <div className="font-medium text-gray-800 text-sm">{dayNames[i]}</div>
              <div className="text-xs text-gray-600">
                {dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {dayDate.getDate() === new Date().getDate() &&
                  dayDate.getMonth() === new Date().getMonth() &&
                  dayDate.getFullYear() === new Date().getFullYear() && (
                    <span className="ml-2 text-xs bg-[#013300] text-white px-1.5 py-0.5 rounded-full">Today</span>
                  )}
              </div>
            </div>
          </div>
          <div className="p-2 space-y-2">
            {dayActivities.length > 0 ? (
              dayActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="p-2 rounded-lg border-l-4 shadow-sm bg-white cursor-pointer hover:shadow-md transition-shadow"
                  style={{
                    borderLeftColor: activity.type === "class" ? "#2563EB" : activity.type === "meeting" ? "#059669" : "#7C3AED",
                  }}
                  onClick={() => setSelectedActivity(activity)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 text-sm">{activity.title}</div>
                      <div className="text-xs text-gray-600 mt-1">
                        {activity.date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} -{" "}
                        {activity.end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{activity.roomNo}</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(activity);
                      }}
                      className="text-gray-400 hover:text-red-500 text-lg"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-400 py-4 text-sm">No activities scheduled</div>
            )}
          </div>
        </div>
      );
    }

    return <div className="divide-y">{days}</div>;
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Calendar Controls */}
              <div className="flex flex-col space-y-3 mb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <div className="flex items-center space-x-1">
                    <button onClick={prevPeriod} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button onClick={nextPeriod} className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
                    {view === "month"
                      ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                      : view === "week"
                      ? `Week of ${currentDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                      : "Activities by Week"}
                  </h2>
                  <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700">
                    Today
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="flex bg-gray-100 rounded-md p-1">
                    <button
                      onClick={() => setView("month")}
                      className={`px-3 py-1.5 text-xs rounded-md sm:text-sm ${
                        view === "month" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => setView("week")}
                      className={`px-3 py-1.5 text-xs rounded-md sm:text-sm ${
                        view === "week" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => setView("list")}
                      className={`px-3 py-1.5 text-xs rounded-md sm:text-sm ${
                        view === "list" ? "bg-white text-gray-800 shadow-sm" : "text-gray-600 hover:text-gray-800"
                      }`}
                    >
                      List
                    </button>
                  </div>
                </div>
              </div>

              {/* Add Schedule Modal */}
              <AddScheduleModal
                show={showAddModal}
                onClose={() => {
                  setShowAddModal(false);
                  reset();
                }}
                form={formMethods}
                onSubmit={handleAddSchedule}
                selectedDate={selectedDate}
              />

              {/* Activity Detail Modal */}
              <ActivityDetailModal 
                activity={selectedActivity} 
                onClose={() => setSelectedActivity(null)} 
                onDelete={(id) => {
                  const activity = activities.find(a => a.id === id);
                  if (activity) handleDeleteClick(activity);
                }}
              />

              {/* Delete Confirmation Modal */}
              <DeleteConfirmationModal
                show={showDeleteModal}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                activityTitle={activityToDelete?.title}
                activityDate={activityToDelete?.date.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                })}
              />

              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
                {renderCalendar()}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}