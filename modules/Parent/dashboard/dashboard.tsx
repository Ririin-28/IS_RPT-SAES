"use client";
import { useState, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import Header from "@/components/Parent/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

// OverviewCard component with responsive styles
function OverviewCard({
  value,
  label,
  icon,
  className = "",
  onClick,
}: {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const containerClasses = `
      /* Mobile */
      bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition-transform duration-200 hover:scale-105

      /* Tablet */
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]

      /* Desktop */
      lg:p-7
      ${className}
    `;

  const content = (
    <>
      <div className="flex flex-row items-center">
        <span
          className="
          /* Mobile */
          text-4xl font-extrabold text-[#013300] drop-shadow

          /* Tablet */
          sm:text-5xl
        "
        >
          {value}
        </span>
        {icon && (
          <span
            className="
          /* Mobile */
          ml-1

          /* Tablet */
          sm:ml-2
        "
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className="
        /* Mobile */
        text-green-900 text-sm font-semibold mt-1 tracking-wide

        /* Tablet */
        sm:text-base sm:mt-2
      "
      >
        {label}
      </div>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${containerClasses} focus:outline-none cursor-pointer text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={containerClasses}>{content}</div>;
}

// Simplified Schedule Card Component (without icons)
function ScheduleCard({ day, subject, time, isToday = false }: {
  day: string;
  subject: string;
  time: string;
  isToday?: boolean;
}) {
  return (
    <div className={`
      bg-white p-4 rounded-lg shadow flex justify-between items-center border border-gray-200
      ${isToday ? 'border-gray-300 bg-green-50' : ''}
    `}>
      <div>
        <h4 className={`font-semibold ${isToday ? 'text-green-900' : 'text-green-900'}`}>
          {day}
        </h4>
        <p className="text-sm text-gray-600">{subject}</p>
      </div>
      <div className="text-sm text-gray-500">{time}</div>
    </div>
  );
}

// Attendance Calendar Component
function AttendanceCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Sample attendance data (present: true, absent: false)
  const attendanceData = {
    1: true, 2: true, 3: true, 4: false, 5: true, 6: true, 7: true,
    8: true, 9: true, 10: true, 11: true, 12: false, 13: true, 14: true,
    15: true, 16: true, 17: true, 18: true, 19: false, 20: true, 21: true,
    22: true, 23: true, 24: true, 25: true, 26: true, 27: false, 28: true,
    29: true, 30: true, 31: true
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getDayOfWeek = (dayIndex: number, firstDayOfMonth: number) => {
    return (firstDayOfMonth + dayIndex) % 7;
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth, currentYear);

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const days = [];
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
  days.push(<div key={`empty-${i}`} className="h-12"></div>);
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const isPresent = attendanceData[day as keyof typeof attendanceData];
    const isToday = new Date().getDate() === day && 
                   new Date().getMonth() === currentMonth && 
                   new Date().getFullYear() === currentYear;
    
    const dayOfWeek = getDayOfWeek(day - 1, firstDayOfMonth);
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday (0) or Saturday (6)
    
    days.push(
      <div
        key={day}
        className={`
          h-12 flex items-center justify-center rounded text-sm font-medium border border-gray-100
          ${isToday ? 'ring-1 ring-gray-300' : ''}
          ${isWeekend ? 'bg-gray-50 text-gray-400' : 'bg-green-50 text-green-900'}
          ${!isWeekend && isPresent === true ? 'bg-green-100 text-green-800' : ''}
          ${!isWeekend && isPresent === false ? 'bg-red-100 text-red-800' : ''}
          ${!isWeekend && isPresent === undefined ? 'bg-gray-100 text-gray-400' : ''}
        `}
      >
        {day}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h4 className="font-bold text-gray-800">Monthly Attendance</h4>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-1 rounded hover:bg-gray-100 text-black font-bold text-lg"
          >
            ‹
          </button>
          <span className="font-semibold text-gray-700">
            {months[currentMonth]} {currentYear}
          </span>
          <button
            onClick={() => navigateMonth('next')}
            className="p-1 rounded hover:bg-gray-100 text-black font-bold text-lg"
          >
            ›
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-6">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
            {day}
          </div>
        ))}
        {days}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-4 text-xs mb-6">
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-green-100 rounded border border-green-200"></div>
          <span className="text-gray-700 font-medium">Present</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-red-100 rounded border border-red-200"></div>
          <span className="text-gray-700 font-medium">Absent</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-3 h-3 bg-gray-100 rounded border border-gray-200"></div>
          <span className="text-gray-700 font-medium">No Data</span>
        </div>
      </div>

      <div className="p-4 rounded-lg border border-gray-200 bg-white">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-800">Monthly Attendance Rate</span>
          <span className="px-3 py-1 text-base font-bold text-gray-800">
            {currentChild.attendance}%
          </span>
        </div>
        <p className="text-xs text-gray-600 mt-1">
          Based on {Object.values(attendanceData).filter(Boolean).length} out of {daysInMonth} school days.
        </p>
      </div>
    </div>
  );
}

// Progress Card Component
function ProgressCard({ title, value, description, icon, color = "green" }: {
  title: string;
  value: string;
  description: string;
  icon?: React.ReactNode;
  color?: "green" | "blue" | "orange" | "yellow";
}) {
  const colorClasses = {
    green: "bg-gradient-to-br from-green-50 to-green-100 border border-gray-200",
    blue: "bg-gradient-to-br from-blue-50 to-blue-100 border border-gray-200",
    orange: "bg-gradient-to-br from-orange-50 to-orange-100 border border-gray-200",
    yellow: "bg-gradient-to-br from-yellow-50 to-yellow-100 border border-gray-200"
  };

  return (
    <div className={`p-4 rounded-xl ${colorClasses[color]} shadow-sm`}>
      <div className="flex items-center mb-2">
        {icon && <div className="mr-3 text-2xl">{icon}</div>}
        <h4 className="font-bold text-gray-800">{title}</h4>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

// Sample data for a single child
const currentChild = {
  firstName: "John",
  middleName: "Michael",
  lastName: "Doe",
  grade: "Grade 5",
  section: "Section A",
  age: 10,
  teacher: "Ms. Johnson",
  attendance: 94,
  currentLevel: {
    English: "Phrase Reader",
    Filipino: "Word Reader", 
    Math: "Developing - Nearly Proficient"
  },
  progressDetails: {
    English: {
      currentLevel: "Phrase Reader",
      startingLevel: "Word Reader",
      improvement: "+1 level",
      strengths: ["Excellent reading comprehension skills", "Strong vocabulary development", "Good participation in class"],
      areasForImprovement: ["Grammar and sentence structure", "Writing longer compositions"],
      recentActivities: [
        "Completed short stories reading assignment with 90% score",
        "Active participation in group discussions",
        "Improved vocabulary quiz from 75% to 88%"
      ],
      teacherComments: "John is making excellent progress in reading. He's becoming more confident with longer texts and his vocabulary is expanding nicely. Let's continue practicing writing skills at home.",
      nextGoals: "Move to Sentence Reader level by improving writing skills",
      teacher: "Ms. Smith"
    },
    Filipino: {
      currentLevel: "Word Reader", 
      startingLevel: "Syllable Reader",
      improvement: "+1 level",
      strengths: ["Clear pronunciation", "Good understanding of basic sentences", "Enthusiastic during oral reading"],
      areasForImprovement: ["Reading fluency and speed", "Writing short paragraphs"],
      recentActivities: [
        "Successfully mastered all basic syllables",
        "Can now read simple sentences fluently",
        "Improved oral reading confidence"
      ],
      teacherComments: "John has shown great improvement in Filipino. His pronunciation is clear and he's becoming more comfortable with the language. Regular reading practice will help build fluency.",
      nextGoals: "Achieve Phrase Reader level by end of semester",
      teacher: "Ms. Garcia"
    },
    Math: {
      currentLevel: "Developing - Nearly Proficient",
      startingLevel: "Emerging - Low Proficient", 
      improvement: "+1 level",
      strengths: ["Strong basic arithmetic skills", "Quick number recognition", "Good problem-solving approach"],
      areasForImprovement: ["Word problem comprehension", "Multiplication tables mastery"],
      recentActivities: [
        "Completed addition/subtraction exercises with 95% accuracy",
        "Improved number sequencing skills",
        "Started multiplication with 80% success rate"
      ],
      teacherComments: "John's math skills are developing well. He shows good logical thinking and enjoys math activities. Practice with word problems and multiplication will help him reach the next level.",
      nextGoals: "Become proficient in multiplication and division",
      teacher: "Mr. Rodriguez"
    }
  }
};

export default function ParentDashboard() {
  const [selectedSubject, setSelectedSubject] = useState('English');
  const progressSectionRef = useRef<HTMLDivElement | null>(null);
  const attendanceSectionRef = useRef<HTMLDivElement | null>(null);

  const scrollToSection = useCallback((sectionRef: RefObject<HTMLDivElement | null>) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleSubjectCardClick = useCallback(
    (subject: string) => {
      setSelectedSubject(subject);
      scrollToSection(progressSectionRef);
    },
    [scrollToSection, progressSectionRef, setSelectedSubject],
  );

  const handleAttendanceCardClick = useCallback(() => {
    scrollToSection(attendanceSectionRef);
  }, [scrollToSection, attendanceSectionRef]);

  // Get current day for highlighting
  const getCurrentDay = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  };

  const currentDay = getCurrentDay();

  // Remedial week schedule
  const remedialSchedule = [
    { day: 'Monday', subject: 'Filipino', time: '8:00-9:30 AM' },
    { day: 'Tuesday', subject: 'Filipino', time: '8:00-9:30 AM' },
    { day: 'Wednesday', subject: 'English', time: '8:00-9:30 AM' },
    { day: 'Thursday', subject: 'Math', time: '8:00-9:30 AM' },
    { day: 'Friday', subject: 'Quiz', time: '8:00-9:00 AM' },
  ];

  const subjects = ['English', 'Filipino', 'Math'];
  const currentProgress = currentChild.progressDetails[selectedSubject as keyof typeof currentChild.progressDetails];

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Main Content---------------------------------*/}
      <div className="w-full pt-16 flex flex-col overflow-hidden">
        <Header title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 w-full h-full min-h-[380px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Child Selection Removed */}
              <div className="mb-6">
                <SecondaryHeader title="Child Profile" />
              </div>

              {/* Child Details Section */}
              <div className="bg-[#E9FDF2] rounded-xl shadow-lg p-6 mb-8 min-h-[160px] flex flex-col gap-6 md:flex-row md:items-start md:px-8">
                <div className="flex-shrink-0 self-center md:ml-15 md:mr-20">
                  <img
                    src="/public/SAES/SAESImg.png"
                    alt="Child profile"
                    className="w-32 h-32 md:w-45 md:h-45 object-cover border-4 border-white shadow-lg bg-white"
                  />
                </div>

                <div className="flex-1 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4">
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">First Name:</span>
                      <span className="block text-base text-black">{currentChild.firstName}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Grade:</span>
                      <span className="block text-base text-black">{currentChild.grade}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Middle Name:</span>
                      <span className="block text-base text-black">{currentChild.middleName}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Section:</span>
                      <span className="block text-base text-black">{currentChild.section}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Surname:</span>
                      <span className="block text-base text-black">{currentChild.lastName}</span>
                    </div>
                    <div>
                      <span className="block text-lg font-bold text-[#014421]">Age:</span>
                      <span className="block text-base text-black">{currentChild.age}</span>
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-gray-300 mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Child Performance" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={`${currentChild.attendance}%`}
                  label="Attendance Rate"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <path d="M12 8V12L15 15M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  }
                  onClick={handleAttendanceCardClick}
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.English.split(' ')[0]}</span>}
                  label="English Level"
                  onClick={() => handleSubjectCardClick('English')}
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.Filipino.split(' ')[0]}</span>}
                  label="Filipino Level"
                  onClick={() => handleSubjectCardClick('Filipino')}
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.Math.split(' ')[0]}</span>}
                  label="Math Level"
                  onClick={() => handleSubjectCardClick('Math')}
                />
              </div>

              <hr className="border-gray-300 mb-6" />

              {/* Remedial Subjects Section */}
              <div className="space-y-8">
                <div ref={progressSectionRef} className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Learning Progress" />
                  
                  {/* Subject Buttons */}
                  <div className="flex flex-wrap gap-4 mt-6 mb-8">
                    {subjects.map((subject) => {
                      const isActive = selectedSubject === subject;
                      return (
                        <UtilityButton
                          key={subject}
                          onClick={() => setSelectedSubject(subject)}
                          className={`transition-all duration-200 ${isActive ? 'shadow-lg' : '!bg-white !text-[#013300] border-[#013300] hover:!bg-green-50 hover:!text-[#013300]'}`}
                        >
                          {subject}
                        </UtilityButton>
                      );
                    })}
                  </div>

                  {/* Teacher Information */}
                  <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
                    <h4 className="font-bold text-green-800 mb-2">
                      Subject Teacher: {currentProgress.teacher}
                    </h4>
                    <p className="text-sm text-gray-600">
                      Your child's progress in {selectedSubject} is guided by {currentProgress.teacher}
                    </p>
                  </div>

                  {/* Subject Details Container */}
                  <div className="space-y-6">
                    {/* Progress Overview Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <ProgressCard
                        title="Current Level"
                        value={currentProgress.currentLevel}
                        description="Where your child is now"
                        color="yellow"
                      />
                      <ProgressCard
                        title="Progress Made"
                        value={currentProgress.improvement}
                        description="Since starting remedial classes"
                        color="blue"
                      />
                      <ProgressCard
                        title="Starting Level"
                        value={currentProgress.startingLevel}
                        description="When remedial classes began"
                        color="orange"
                      />
                    </div>

                    {/* Strengths & Areas for Improvement */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h4 className="font-bold text-green-800 mb-3 flex items-center">
                          What's Going Well
                        </h4>
                        <div className="space-y-2">
                          {currentProgress.strengths.map((strength, index) => (
                            <div key={index} className="flex items-start">
                              <span className="mr-2 mt-2 inline-block h-2 w-2 rounded-full bg-green-500" aria-hidden="true"></span>
                              <span className="text-gray-700">{strength}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                        <h4 className="font-bold text-blue-800 mb-3 flex items-center">
                          Areas to Focus On
                        </h4>
                        <div className="space-y-2">
                          {currentProgress.areasForImprovement.map((area, index) => (
                            <div key={index} className="flex items-start">
                              <span className="mr-2 mt-2 inline-block h-2 w-2 rounded-full bg-blue-500" aria-hidden="true"></span>
                              <span className="text-gray-700">{area}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Teacher Feedback */}
                    <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                      <h4 className="font-bold text-gray-800">Teacher's Comment</h4>
                      <p className="mt-2 text-sm leading-relaxed text-gray-700">
                        {currentProgress.teacherComments}
                      </p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-green-700">
                        — {currentProgress.teacher}
                      </p>
                    </div>

                    {/* Next Goals */}
                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                      <h4 className="font-bold text-gray-800 mb-2 flex items-center">
                        Next Learning Goals
                      </h4>
                      <p className="text-gray-700">{currentProgress.nextGoals}</p>
                    </div>
                  </div>
                </div>

                {/* Updated Schedule Section with Calendar */}
                <div ref={attendanceSectionRef} className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Schedule Cards */}
                    <div>
                      <TertiaryHeader title="Weekly Schedule" />
                      <div className="mt-4 space-y-3">
                        {remedialSchedule.map((item, index) => (
                          <ScheduleCard
                            key={index}
                            day={item.day}
                            subject={item.subject}
                            time={item.time}
                            isToday={item.day === currentDay}
                          />
                        ))}
                      </div>
                      <div className="mt-4 text-sm text-gray-600 space-y-1">
                        <p className="font-medium">Please ensure your child attends all remedial sessions.</p>
                        <p className="italic">Siguraduhin na dumadalo ang inyong anak sa lahat ng remedial sessions.</p>
                      </div>
                    </div>
                    
                    {/* Attendance Calendar */}
                    <AttendanceCalendar />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}