"use client";
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import RemedialTeacherSidebar from "@/components/MasterTeacher/RemedialTeacher/Sidebar";
import MasterTeacherHeader from "@/components/MasterTeacher/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { getStoredUserProfile } from "@/lib/utils/user-profile";

// Custom styled dropdown component
function CustomDropdown({ value, onChange, options, className = "" }: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <select 
        value={value}
        onChange={onChange}
        className="w-full px-4 py-2.5 bg-white text-green-900 rounded-lg shadow-sm focus:outline-none focus:ring-1 appearance-none pr-10 cursor-pointer transition-colors duration-150 hover:border-[#013300]"
      >
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-green-700">
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </div>
    </div>
  );
}

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// OverviewCard component with responsive styles
function OverviewCard({
  value,
  label,
  icon,
  className = "",
  onClick,
  tooltip,
}: {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
  onClick?: () => void;
  tooltip?: string;
}) {
  const sanitizeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      return content;
    }
    return content;
  };

  const baseClasses = `relative group bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px] 
      transition-transform duration-200 hover:scale-105
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]
      lg:p-7 ${className}`;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-[#013300] px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex flex-row items-center">
        <span className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl">
          {sanitizeContent(value)}
        </span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-green-900 text-sm font-semibold mt-1 tracking-wide sm:text-base sm:mt-2">
        {sanitizeContent(label)}
      </div>
    </>
  );

  if (typeof onClick === "function") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClasses} focus:outline-none cursor-pointer text-left`}
      >
        {content}
      </button>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

type TeacherProfile = {
  fullName: string;
  role: string;
  gradeHandled: string;
  subjectAssigned: string;
};

type TeacherApiResponse = {
  success: boolean;
  profile?: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    grade?: string | null;
    gradeLabel?: string | null;
    subjectHandled?: string | null;
    role?: string | null;
  } | null;
  error?: string;
};

const ROLE_LABELS: Record<string, string> = {
  teacher: "Teacher",
  master_teacher: "Master Teacher",
  coordinator: "Coordinator",
};

function formatRoleLabel(role?: string | null): string {
  if (!role) return "Teacher";
  const key = role.toLowerCase().replace(/[\s-]+/g, "_");
  return ROLE_LABELS[key] ?? role;
}

export default function TeacherDashboard() {
  const router = useRouter();
  const handleNavigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

  const [teacherProfile, setTeacherProfile] = useState<TeacherProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTeacherProfile() {
      setIsLoadingProfile(true);
      setProfileError(null);
      try {
        const storedProfile = getStoredUserProfile();
        const userId = storedProfile?.userId;

        if (!userId) {
          throw new Error("Missing user information. Please log in again.");
        }

        const response = await fetch(
          `/api/master_teacher/profile?userId=${encodeURIComponent(String(userId))}`,
          { cache: "no-store" },
        );

        const payload: TeacherApiResponse | null = await response.json().catch(() => null);

        if (cancelled) return;

        if (!response.ok || !payload?.success || !payload.profile) {
          const message = payload?.error ?? "Unable to load teacher profile.";
          throw new Error(message);
        }

        const nameParts = [
          payload.profile.firstName,
          payload.profile.middleName,
          payload.profile.lastName,
        ].filter((part): part is string => typeof part === "string" && part.trim().length > 0);

        const teacherName = nameParts.length > 0 ? nameParts.join(" ") : "Teacher";

        setTeacherProfile({
          fullName: teacherName,
          role: formatRoleLabel(payload.profile.role ?? storedProfile?.role),
          gradeHandled: payload.profile.gradeLabel?.trim() || payload.profile.grade?.trim() || "Not assigned",
          subjectAssigned: payload.profile.subjectHandled?.trim() || "English, Filipino, Math",
        });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Failed to load profile.";
          setProfileError(message);
          setTeacherProfile(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    }

    loadTeacherProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  // Get today's date in simplified month format (same as Principal)
  const today = new Date();
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${dayShort[today.getDay()]}, ${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const endOfMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endOfMonthLabel = `${monthShort[endOfMonthDate.getMonth()]} ${endOfMonthDate.getDate()}, ${endOfMonthDate.getFullYear()}`;
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const [selectedMonth, setSelectedMonth] = useState('March');
  const months = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];
  
  const performanceData = {
    Math: {
      weekly: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Average Proficiency Level',
            data: [1.8, 2.2, 2.7, 3.1],
            borderColor: 'rgba(79, 70, 229, 1)',
            backgroundColor: 'rgba(79, 70, 229, 0.2)',
            tension: 0.4,
            pointBackgroundColor: 'rgba(79, 70, 229, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
      monthly: {
        labels: months,
        datasets: [
          {
            label: 'Average Proficiency Level',
            data: [1.2, 1.8, 2.3, 2.7, 3.2, 3.8, 4.2],
            borderColor: 'rgba(79, 70, 229, 1)',
            backgroundColor: 'rgba(79, 70, 229, 0.2)',
            tension: 0.4,
            pointBackgroundColor: 'rgba(79, 70, 229, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
    },
    English: {
      weekly: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Average Proficiency Level',
            data: [2.1, 2.5, 3.0, 3.4],
            borderColor: 'rgba(220, 38, 38, 1)',
            backgroundColor: 'rgba(220, 38, 38, 0.2)',
            tension: 0.4,
            pointBackgroundColor: 'rgba(220, 38, 38, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
      monthly: {
        labels: months,
        datasets: [
          {
            label: 'Average Proficiency Level',
            data: [1.5, 2.0, 2.6, 3.1, 3.5, 4.0, 4.4],
            borderColor: 'rgba(220, 38, 38, 1)',
            backgroundColor: 'rgba(220, 38, 38, 0.2)',
            tension: 0.4,
            pointBackgroundColor: 'rgba(220, 38, 38, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
    },
    Filipino: {
      weekly: {
        labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
        datasets: [
          {
            label: 'Average Proficiency Level',
            data: [1.9, 2.3, 2.8, 3.2],
            borderColor: 'rgba(234, 88, 12, 1)',
            backgroundColor: 'rgba(234, 88, 12, 0.2)',
            tension: 0.4,
            pointBackgroundColor: 'rgba(234, 88, 12, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
      monthly: {
        labels: months,
        datasets: [
          {
            label: 'Average Proficiency Level',
            data: [1.4, 1.9, 2.4, 2.9, 3.3, 3.7, 4.0],
            borderColor: 'rgba(234, 88, 12, 1)',
            backgroundColor: 'rgba(234, 88, 12, 0.2)',
            tension: 0.4,
            pointBackgroundColor: 'rgba(234, 88, 12, 1)',
            pointBorderColor: '#fff',
            pointHoverRadius: 6,
            pointRadius: 4,
          },
        ],
      },
    },
  };

  const getMonthlyLevelData = () => {
    switch(selectedSubject) {
      case 'English':
        return {
          labels: ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'],
          datasets: [
            {
              label: 'Students',
              data: [2, 3, 4, 5, 4, 2],
              backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(139, 92, 246, 0.8)',
              ],
              borderColor: [
                'rgba(239, 68, 68, 1)',
                'rgba(249, 115, 22, 1)',
                'rgba(234, 179, 8, 1)',
                'rgba(34, 197, 94, 1)',
                'rgba(59, 130, 246, 1)',
                'rgba(139, 92, 246, 1)',
              ],
              borderWidth: 1,
            },
          ],
        };
      case 'Filipino':
        return {
          labels: ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'],
          datasets: [
            {
              label: 'Students',
              data: [1, 2, 5, 6, 4, 2],
              backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(139, 92, 246, 0.8)',
              ],
              borderColor: [
                'rgba(239, 68, 68, 1)',
                'rgba(249, 115, 22, 1)',
                'rgba(234, 179, 8, 1)',
                'rgba(34, 197, 94, 1)',
                'rgba(59, 130, 246, 1)',
                'rgba(139, 92, 246, 1)',
              ],
              borderWidth: 1,
            },
          ],
        };
      case 'Math':
        return {
          labels: ['Emerging - Not Proficient', 'Emerging - Low Proficient', 'Developing - Nearly Proficient', 'Transitioning - Proficient', 'At Grade Level - Highly Proficient'],
          datasets: [
            {
              label: 'Students',
              data: [1, 2, 5, 7, 5],
              backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(249, 115, 22, 0.8)',
                'rgba(234, 179, 8, 0.8)',
                'rgba(34, 197, 94, 0.8)',
                'rgba(139, 92, 246, 0.8)',
              ],
              borderColor: [
                'rgba(239, 68, 68, 1)',
                'rgba(249, 115, 22, 1)',
                'rgba(234, 179, 8, 1)',
                'rgba(34, 197, 94, 1)',
                'rgba(139, 92, 246, 1)',
              ],
              borderWidth: 1,
            },
          ],
        };
      default:
        return {
          labels: [],
          datasets: [],
        };
    }
  };

  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 6,
        ticks: {
          stepSize: 1,
          callback: function(value: any) {
            if (selectedSubject === 'Math') {
              const mathLevels = [
                '',
                'Emerging - Not Proficient',
                'Emerging - Low Proficient',
                'Developing - Nearly Proficient',
                'Transitioning - Proficient',
                'At Grade Level',
                ''
              ];
              return mathLevels[value] || '';
            } else {
              const literacyLevels = [
                '',
                'Non-Reader',
                'Syllable Reader',
                'Word Reader',
                'Phrase Reader',
                'Sentence Reader',
                'Paragraph Reader'
              ];
              return literacyLevels[value] || '';
            }
          }
        }
      },
    },
    maintainAspectRatio: false,
  };

  const monthlyBarOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <RemedialTeacherSidebar />

      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <MasterTeacherHeader title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Teacher Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher Overview" />
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-4 mb-6 min-w-full min-h-[120px] sm:p-5 sm:mb-7 md:p-6 md:mb-8">
                {isLoadingProfile ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="Loading profile..." />
                  </div>
                ) : profileError ? (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title={profileError} />
                  </div>
                ) : teacherProfile ? (
                  <div className="flex flex-col w-full">
                    <div className="flex flex-col mb-2 md:flex-row md:items-start md:justify-between md:mb-0">
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Full Name:" />
                        <BodyText title={teacherProfile.fullName} />
                      </div>
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Position:" />
                        <BodyText title={teacherProfile.role} />
                      </div>
                      <div className="mb-3 md:mb-0 md:w-1/3">
                        <TertiaryHeader title="Grade Assigned:" />
                        <BodyText title={teacherProfile.gradeHandled} />
                      </div>
                    </div>
                    <div className="mt-3 md:mt-2">
                      <TertiaryHeader title="Subject Assigned:" />
                      <BodyText title={teacherProfile.subjectAssigned} />
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BodyText title="No profile data available." />
                  </div>
                )}
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Remedial Overview" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={12}
                  label="Handled Students"
                  tooltip="Total handled students."
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/students")}
                />
                <OverviewCard
                  value={4}
                  label="Reports Submitted"
                  tooltip={`Deadline: ${endOfMonthLabel}`}
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                      <rect width="16" height="20" x="4" y="2" rx="2" stroke="#013300" strokeWidth="2" />
                      <path d="M2 6h4" stroke="#013300" strokeWidth="2" />
                      <path d="M2 10h4" stroke="#013300" strokeWidth="2" />
                      <path d="M2 14h4" stroke="#013300" strokeWidth="2" />
                      <path d="M2 18h4" stroke="#013300" strokeWidth="2" />
                      <path d="M9.5 8h5" stroke="#013300" strokeWidth="2" />
                      <path d="M9.5 12H16" stroke="#013300" strokeWidth="2" />
                      <path d="M9.5 16H14" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/report")}
                />
                <OverviewCard
                  value={5}
                  label="Submitted Materials"
                  tooltip="Total submitted materials."
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
                      <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/materials")}
                />
                <OverviewCard
                  value={<span className="text-xl">{dateToday}</span>}
                  label="Date Today"
                  onClick={() => handleNavigate("/MasterTeacher/RemedialTeacher/calendar")}
                />
                </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Student Performance */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 mb-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <TertiaryHeader title="Student Performance" />
                  <div className="flex space-x-2 mt-2 md:mt-0">
                    <div className="w-32">
                      <CustomDropdown
                        value={selectedPeriod.charAt(0).toUpperCase() + selectedPeriod.slice(1)}
                        onChange={(e) => setSelectedPeriod(e.target.value.toLowerCase())}
                        options={['Monthly', 'Weekly']}
                      />
                    </div>
                    <div className="w-32">
                      <CustomDropdown
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        options={['Math', 'English', 'Filipino']}
                      />
                    </div>
                    {selectedPeriod === 'monthly' && (
                      <div className="w-36">
                        <CustomDropdown
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          options={months}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-96 mt-4">
                  <Line
                    options={{
                      ...lineOptions,
                      plugins: {
                        ...lineOptions.plugins,
                        title: {
                          display: true,
                          text: `Average ${selectedSubject} Proficiency`,
                          font: {
                            size: 16,
                            weight: 'bold',
                          }
                        },
                      }
                    }}
                    data={performanceData[selectedSubject as keyof typeof performanceData][selectedPeriod as keyof typeof performanceData.Math]}
                  />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p className="font-medium">Overall improvement: +3.0 levels since September</p>
                </div>
              </div>

              {/* Student Distribution by Level */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <TertiaryHeader title="Student Distribution by Level" />
                  <div className="flex space-x-2 mt-2 md:mt-0">
                    <div className="w-32">
                      <CustomDropdown
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        options={['Math', 'English', 'Filipino']}
                      />
                    </div>
                    <div className="w-36">
                      <CustomDropdown
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        options={months}
                      />
                    </div>
                  </div>
                </div>
                <div className="h-96 mt-4">
                  <Bar
                    options={{
                      ...monthlyBarOptions,
                      plugins: {
                        ...monthlyBarOptions.plugins,
                        title: {
                          display: true,
                          text: `${selectedSubject} Levels for ${selectedMonth}`,
                          font: {
                            size: 16,
                            weight: 'bold',
                          }
                        },
                      }
                    }}
                    data={getMonthlyLevelData()}
                  />
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  <p className="font-medium">Most students are at {selectedSubject === 'Math' ? 'Transitioning - Proficient' : 'Phrase Reader'} level</p>
                </div>
              </div>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
  