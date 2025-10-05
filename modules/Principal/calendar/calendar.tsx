"use client";
import Sidebar from "@/components/Principal/Sidebar";
import Header from "@/components/Principal/Header";
import { useState, useEffect } from "react";
// Button Component
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
// Modal Component
import AddScheduleModal from "./Modals/AddScheduleModal";

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

interface RemedialPeriod {
  id: number;
  title: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
}

export default function PrincipalCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [remedialPeriods, setRemedialPeriods] = useState<RemedialPeriod[]>([]);
  const [showAddScheduleModal, setShowAddScheduleModal] = useState(false);
  // Recently added schedule activation prompt
  const [recentlyAddedId, setRecentlyAddedId] = useState<number | null>(null);
  const [showActivationPrompt, setShowActivationPrompt] = useState(false);

  // Activities array for calendar
  const [activities, setActivities] = useState<Activity[]>([]);

  // Initialize remedial periods
  useEffect(() => {
    // Try to load from localStorage if available
    const savedPeriods = localStorage.getItem('remedialPeriods');
    if (savedPeriods) {
      const parsedPeriods = JSON.parse(savedPeriods).map((period: any) => ({
        ...period,
        startDate: new Date(period.startDate),
        endDate: new Date(period.endDate)
      }));
      setRemedialPeriods(parsedPeriods);
    } else {
      // Default empty array if no saved periods
      setRemedialPeriods([]);
    }
  }, []);

  // Save to localStorage whenever periods change
  useEffect(() => {
    localStorage.setItem('remedialPeriods', JSON.stringify(remedialPeriods));
  }, [remedialPeriods]);

  // Check if current date is within a remedial period
  const isRemedialPeriodActive = () => {
    return remedialPeriods.some(period => {
      const now = new Date();
      return period.isActive && now >= period.startDate && now <= period.endDate;
    });
  };

  // Add new schedule
  const handleAddSchedule = (schedule: RemedialPeriod) => {
    setRemedialPeriods(prev => [...prev, schedule]);
    setRecentlyAddedId(schedule.id);
    setShowActivationPrompt(true);
  };

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
    newDate.setMonth(newDate.getMonth() - 1);
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
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

  // Check if a date is within any remedial period
  const isDateInRemedialPeriod = (date: Date) => {
    return remedialPeriods.some(period => {
      if (!period.startDate || !period.endDate || isNaN(period.startDate.getTime()) || isNaN(period.endDate.getTime())) return false;
      return period.isActive && date >= period.startDate && date <= period.endDate;
    });
  };

  // Render the calendar - only month view now
  const renderCalendar = () => {
    return renderMonthView();
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
                    className="p-3 border-l-4 border-[#013300] bg-white rounded-lg shadow-sm"
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center text-gray-500 py-8">
            No activities scheduled.
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

          // Check if this day is within a remedial period
          const isRemedialDay = isDateInRemedialPeriod(currentDay);

          days.push(
            <div
              key={`day-${day}`}
              className={`h-20 p-1 border border-gray-100 overflow-hidden relative ${
                isRemedialDay ? "bg-green-50" : ""
              }`}
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
                    className={`text-xs p-1 rounded truncate border ${getActivityColor(activity.type)}`}
                  >
                    <span className="truncate">{activity.title}</span>
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

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Calendar" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Simplified Remedial Period Controls */}
              <div className="mb-4 p-4 bg-gray-100 rounded-lg">
                <h3 className="text-lg font-semibold text-black mb-2">Remedial Period Management</h3>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-black">
                      Status: {isRemedialPeriodActive() ? (
                        <span className="font-semibold text-green-600">Active</span>
                      ) : (
                        <span className="font-semibold text-gray-600">Inactive</span>
                      )}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <UtilityButton small onClick={() => setShowAddScheduleModal(true)}>
                      Add Schedule
                    </UtilityButton>
                  </div>
                </div>
                {showActivationPrompt && recentlyAddedId && (
                  <div className="mb-4 p-3 rounded-md border border-blue-200 bg-blue-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="text-sm text-blue-800">
                      Indicated schedule? Activate it now so it appears highlighted on the calendar.
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setRemedialPeriods(prev => prev.map(p => ({ ...p, isActive: p.id === recentlyAddedId })));
                          setShowActivationPrompt(false);
                        }}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Activate Now
                      </button>
                      <button
                        onClick={() => setShowActivationPrompt(false)}
                        className="px-3 py-1.5 text-xs font-medium rounded-md bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                )}
              </div>

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
                    {currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </h2>
                  <button onClick={goToToday} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700">
                    Today
                  </button>
                </div>
              </div>

              {/* Calendar View */}
              <div className="border rounded-lg overflow-hidden bg-white">
                {renderCalendar()}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Schedule Modal */}
      <AddScheduleModal
        show={showAddScheduleModal}
        onClose={() => setShowAddScheduleModal(false)}
        onSave={handleAddSchedule}
      />
    </div>
  );
}