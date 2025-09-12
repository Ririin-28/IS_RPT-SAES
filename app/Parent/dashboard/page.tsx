"use client";
import { useState } from 'react';
import Sidebar from "@/components/Parent/Sidebar";
import Header from "@/components/Parent/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
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
import { Bar, Line, Doughnut } from 'react-chartjs-2';

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
      className={`
      /* Mobile */
      bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition-transform duration-200 hover:scale-105

      /* Tablet */
      sm:p-6 sm:min-w-[180px] sm:min-h-[120px]

      /* Desktop */
      lg:p-7
      ${className}
    `}
    >
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
    </div>
  );
}

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
        className="w-full px-4 py-2.5 bg-white border border-green-400 text-green-900 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 appearance-none pr-10 cursor-pointer transition-colors duration-150 hover:border-green-600 hover:bg-green-50"
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

export default function ParentDashboard() {
  const [selectedChild, setSelectedChild] = useState('John Doe');
  const [selectedSubject, setSelectedSubject] = useState('English');

  // Sample data for children
  const children = [
    {
      name: "John Doe",
      grade: "Grade 5",
      age: 10,
      teacher: "Ms. Johnson",
      attendance: 94,
      currentLevel: {
        English: "Phrase Reader",
        Filipino: "Word Reader", 
        Math: "Developing - Nearly Proficient"
      }
    },
    {
      name: "Sarah Doe", 
      grade: "Grade 3",
      age: 8,
      teacher: "Mr. Thompson",
      attendance: 88,
      currentLevel: {
        English: "Word Reader",
        Filipino: "Syllable Reader",
        Math: "Emerging - Low Proficient"
      }
    }
  ];

  // Months data
  const months = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];
  
  // Get current child data
  const currentChild = children.find(child => child.name === selectedChild) || children[0];
  
  // Progress data by subject
  const progressData = {
    English: {
      labels: months,
      datasets: [
        {
          label: 'Proficiency Level',
          data: [1.2, 1.8, 2.3, 2.7, 3.2, 3.8, 4.2],
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
    Filipino: {
      labels: months,
      datasets: [
        {
          label: 'Proficiency Level',
          data: [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0],
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
    Math: {
      labels: months,
      datasets: [
        {
          label: 'Proficiency Level',
          data: [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5],
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
  };

  // Remedial week schedule
  const remedialSchedule = [
    { day: 'Monday', subject: 'Filipino', time: '8:00-9:30 AM' },
    { day: 'Tuesday', subject: 'Filipino', time: '8:00-9:30 AM' },
    { day: 'Wednesday', subject: 'English', time: '8:00-9:30 AM' },
    { day: 'Thursday', subject: 'Math', time: '8:00-9:30 AM' },
    { day: 'Friday', subject: 'Quiz', time: '8:00-9:00 AM' },
  ];

  // Chart options
  const lineOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Progression Over Time',
        font: {
          size: 16,
          weight: "bold" as const,
        }
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
            <div className="bg-white rounded-lg shadow-md border border-gray-200 w-full h-full min-h-[380px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Child Selection */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <SecondaryHeader title="Parent Dashboard" />
                <div className="w-48 mt-2 md:mt-0">
                  <CustomDropdown
                    value={selectedChild}
                    onChange={(e) => setSelectedChild(e.target.value)}
                    options={children.map(child => child.name)}
                  />
                </div>
              </div>

              {/* Child Details Section */}
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6 mb-6">
                <TertiaryHeader title="Child Details" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div>
                    <TertiaryHeader title="Name:" className="text-sm text-green-800" />
                    <BodyText title={currentChild.name} />
                  </div>
                  <div>
                    <TertiaryHeader title="Grade:" className="text-sm text-green-800" />
                    <BodyText title={currentChild.grade} />
                  </div>
                  <div>
                    <TertiaryHeader title="Age:" className="text-sm text-green-800" />
                    <BodyText title={String(currentChild.age)} />
                  </div>
                  <div>
                    <TertiaryHeader title="Teacher:" className="text-sm text-green-800" />
                    <BodyText title={currentChild.teacher} />
                  </div>
                </div>
              </div>

              <hr className="border-gray-300 mb-6" />

              {/* Overview Cards Section */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                <SecondaryHeader title="Academic Overview" />
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
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.English.split(' ')[0]}</span>}
                  label="English Level"
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.Filipino.split(' ')[0]}</span>}
                  label="Filipino Level"
                />
                <OverviewCard
                  value={<span className="text-3xl sm:text-4xl font-extrabold text-[#013300]">{currentChild.currentLevel.Math.split(' ')[0]}</span>}
                  label="Math Level"
                />
              </div>

              <hr className="border-gray-300 mb-6" />

              {/* Charts Section */}
              <div className="space-y-8">
                {/* Academic Performance */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <TertiaryHeader title="Academic Performance" />
                    <div className="flex space-x-2 mt-2 md:mt-0">
                      <div className="w-36">
                        <CustomDropdown
                          value={selectedSubject}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                          options={['English', 'Filipino', 'Math']}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="h-96 mt-4">
                    <Line 
                      options={lineOptions} 
                      data={progressData[selectedSubject as keyof typeof progressData]} 
                    />
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">Current level: {currentChild.currentLevel[selectedSubject as keyof typeof currentChild.currentLevel]}</p>
                    <p className="mt-1">Showing progress from {months[0]} to {months[months.length - 1]}</p>
                  </div>
                </div>

                {/* Remedial Schedule */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Remedial Schedule" />
                  <div className="mt-4">
                    <div className="grid grid-cols-1 gap-3">
                      {remedialSchedule.map((item, index) => (
                        <div key={index} className="bg-white p-4 rounded-lg shadow flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold text-green-900">{item.day}</h4>
                            <p className="text-sm text-gray-600">{item.subject}</p>
                          </div>
                          <div className="text-sm text-gray-500">{item.time}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">Please ensure your child attends all remedial sessions</p>
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