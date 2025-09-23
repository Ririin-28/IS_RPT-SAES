"use client";
import { useState } from 'react';
import Sidebar from "@/components/MasterTeacher/Sidebar";
import Header from "@/components/MasterTeacher/Header";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";

// Import Chart components
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

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

// OverviewCard component with responsive styles
function OverviewCard({
  value,
  label,
  icon,
  className = "",
}: {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition-transform duration-200 hover:scale-105
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]
      lg:p-7 ${className}`}
    >
      <div className="flex flex-row items-center">
        <span
          className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl"
        >
          {value}
        </span>
        {icon && (
          <span
            className="ml-1 sm:ml-2"
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className="text-green-900 text-sm font-semibold mt-1 tracking-wide sm:text-base sm:mt-2"
      >
        {label}
      </div>
    </div>
  );
}

export default function MasterTeacherDashboard() {
  // Get today's date in simplified month format (same as Principal)
  const today = new Date();
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [selectedSubject, setSelectedSubject] = useState('Math');
  const [selectedMonth, setSelectedMonth] = useState('March');

  // Sample data for the teacher's own students
  const [pendingApprovals] = useState(3);
  
  // Months data
  const months = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];
  
  // Enhanced student performance data by month for each subject
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

  // Student distribution by level for current month
  const getMonthlyLevelData = () => {
    switch(selectedSubject) {
      case 'English':
        return {
          labels: ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'],
          datasets: [
            {
              label: 'Students',
              data: [2, 3, 4, 5, 4, 2], // March data for English
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
              data: [1, 2, 5, 6, 4, 2], // March data for Filipino
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
              data: [1, 2, 5, 7, 5], // March data for Math
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

  // Pending approvals data
  const approvalsData = {
    labels: ['Pending', 'Approved'],
    datasets: [
      {
        data: [pendingApprovals, 12 - pendingApprovals],
        backgroundColor: [
          'rgba(234, 179, 8, 0.8)',
          'rgba(34, 197, 94, 0.8)',
        ],
        borderColor: [
          'rgba(234, 179, 8, 1)',
          'rgba(34, 197, 94, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  // Chart options
  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    maintainAspectRatio: false,
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
            // Custom labels for y-axis based on subject
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

  const pieOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
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
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[380px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Teacher Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Teacher Overview" />
                <div className="flex space-x-2 mt-2 md:mt-0">
                  <PrimaryButton 
                    onClick={() => {}} 
                    className="text-sm py-1.5 px-3"
                  >
                    Student Progress
                  </PrimaryButton>
                  <SecondaryButton 
                    onClick={() => {}} 
                    className="text-sm py-1.5 px-3"
                  >
                    View Materials
                  </SecondaryButton>
                </div>
              </div>

              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-4 mb-6 min-w-full min-h-[120px] sm:p-5 sm:mb-7 md:p-6 md:mb-8">
                <div className="flex flex-col w-full">
                  <div className="flex flex-col mb-2 md:flex-row md:items-start md:justify-between md:mb-0">
                    <div className="mb-3 md:mb-0 md:w-1/3">
                      <TertiaryHeader title="Full Name:" />
                      <BodyText title="Jane Smith" />
                    </div>
                    <div className="mb-3 md:mb-0 md:w-1/3">
                      <TertiaryHeader title="Position:" />
                      <BodyText title="Master Teacher" />
                    </div>
                    <div className="mb-3 md:mb-0 md:w-1/3">
                      <TertiaryHeader title="Grade Assigned:" />
                      <BodyText title="Grades 4-6" />
                    </div>
                  </div>
                  <div className="mt-3 md:mt-2">
                    <TertiaryHeader title="Subject Assigned:" />
                    <BodyText title="Mathematics, English, Filipino" />
                  </div>
                </div>
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Remedial Overview" />
              </div>
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={20}
                  label="Handled Students"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={pendingApprovals}
                  label="Pending Approvals"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <path d="M12 15V17M12 7V13M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={"20"}
                  label="Materials Uploaded"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
                      <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                />
                <OverviewCard value={<span className="text-2xl">{dateToday}</span>} label="Date Today" />
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Charts Section */}
              <div className="space-y-8">
                {/* Pending Approvals */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Pending Approvals this Week" />
                  <div className="h-64 mt-2">
                    <Pie options={pieOptions} data={approvalsData} />
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">{pendingApprovals} approvals awaiting your review</p>
                  </div>
                  <div className="mt-3">
                    <UtilityButton 
                      onClick={() => {}} 
                      className="w-full text-center justify-center"
                    >
                      Review Approvals
                    </UtilityButton>
                  </div>
                </div>

                {/* Student Performance */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
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
          </div>
        </main>
      </div>
    </div>
  );

}