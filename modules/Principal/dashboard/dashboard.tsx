"use client";
import { useState, useEffect } from 'react';
import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
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
import PrimaryButton from '@/components/Common/Buttons/PrimaryButton';
import SecondaryButton from '@/components/Common/Buttons/SecondaryButton';

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

type OverviewCardProps = {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
};

function OverviewCard({ value, label, icon, className = "" }: OverviewCardProps) {
  return (
    <div
      className={`bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px] transition-transform duration-200 hover:scale-105 sm:p-6 sm:min-w-[180px] sm:min-h-[120px] lg:p-7 ${className}`}
    >
      <div className="flex flex-row items-center">
        <span className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl">{value}</span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-green-900 text-sm font-semibold mt-1 tracking-wide sm:text-base sm:mt-2">{label}</div>
    </div>
  );
}

export default function PrincipalDashboard() {
  // Get today's date in simplified month format
  const today = new Date();
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

  // State for view mode (summary or detailed)
  const [viewMode, setViewMode] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState('March');
  const [selectedLevel, setSelectedLevel] = useState('All Levels');
  const [selectedSubject, setSelectedSubject] = useState('English');

  // Months data
  const months = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];

  // English Literacy Data - Showing progression through levels
  const [englishData] = useState({
    labels: months,
    datasets: [
      {
        label: 'Non-Reader',
        data: [30, 25, 20, 15, 10, 5, 2],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Syllable Reader',
        data: [25, 30, 25, 20, 15, 10, 5],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
      },
      {
        label: 'Word Reader',
        data: [20, 25, 30, 25, 20, 15, 10],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
        borderColor: 'rgba(234, 179, 8, 1)',
        borderWidth: 1,
      },
      {
        label: 'Phrase Reader',
        data: [15, 10, 15, 20, 25, 30, 25],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Sentence Reader',
        data: [8, 8, 8, 12, 18, 25, 30],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
      {
        label: 'Paragraph Reader',
        data: [2, 2, 2, 8, 12, 15, 28],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  });

  // Filipino Literacy Data - Showing progression through levels
  const [filipinoData] = useState({
    labels: months,
    datasets: [
      {
        label: 'Non-Reader',
        data: [35, 30, 25, 20, 15, 10, 5],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Syllable Reader',
        data: [30, 35, 30, 25, 20, 15, 10],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
      },
      {
        label: 'Word Reader',
        data: [20, 25, 30, 25, 20, 15, 12],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
        borderColor: 'rgba(234, 179, 8, 1)',
        borderWidth: 1,
      },
      {
        label: 'Phrase Reader',
        data: [10, 8, 10, 15, 20, 25, 28],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Sentence Reader',
        data: [4, 2, 4, 8, 15, 20, 25],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
      {
        label: 'Paragraph Reader',
        data: [1, 0, 1, 7, 15, 20, 30],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  });

  // Math Numeracy Data - Showing progression through levels
  const [mathData] = useState({
    labels: months,
    datasets: [
      {
        label: 'Emerging - Not Proficient',
        data: [40, 35, 30, 25, 20, 15, 10],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Emerging - Low Proficient',
        data: [30, 35, 30, 25, 20, 15, 10],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
      },
      {
        label: 'Developing - Nearly Proficient',
        data: [20, 20, 25, 30, 25, 20, 15],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
        borderColor: 'rgba(234, 179, 8, 1)',
        borderWidth: 1,
      },
      {
        label: 'Transitioning - Proficient',
        data: [8, 8, 12, 15, 20, 25, 30],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'At Grade Level - Highly Proficient',
        data: [2, 2, 3, 5, 15, 25, 35],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  });

  // Data for line charts (showing progression of each level over time)
  const [englishLineData] = useState({
    labels: months,
    datasets: [
      {
        label: 'Non-Reader',
        data: [30, 25, 20, 15, 10, 5, 2],
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Syllable Reader',
        data: [25, 30, 25, 20, 15, 10, 5],
        borderColor: 'rgba(249, 115, 22, 1)',
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Word Reader',
        data: [20, 25, 30, 25, 20, 15, 10],
        borderColor: 'rgba(234, 179, 8, 1)',
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Phrase Reader',
        data: [15, 10, 15, 20, 25, 30, 25],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Sentence Reader',
        data: [8, 8, 8, 12, 18, 25, 30],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Paragraph Reader',
        data: [2, 2, 2, 8, 12, 15, 28],
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.3,
      },
    ],
  });

  const [filipinoLineData] = useState({
    labels: months,
    datasets: [
      {
        label: 'Non-Reader',
        data: [35, 30, 25, 20, 15, 10, 5],
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Syllable Reader',
        data: [30, 35, 30, 25, 20, 15, 10],
        borderColor: 'rgba(249, 115, 22, 1)',
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Word Reader',
        data: [20, 25, 30, 25, 20, 15, 12],
        borderColor: 'rgba(234, 179, 8, 1)',
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Phrase Reader',
        data: [10, 8, 10, 15, 20, 25, 28],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Sentence Reader',
        data: [4, 2, 4, 8, 15, 20, 25],
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Paragraph Reader',
        data: [1, 0, 1, 7, 15, 20, 30],
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.3,
      },
    ],
  });

  const [mathLineData] = useState({
    labels: months,
    datasets: [
      {
        label: 'Emerging - Not Proficient',
        data: [40, 35, 30, 25, 20, 15, 10],
        borderColor: 'rgba(239, 68, 68, 1)',
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Emerging - Low Proficient',
        data: [30, 35, 30, 25, 20, 15, 10],
        borderColor: 'rgba(249, 115, 22, 1)',
        backgroundColor: 'rgba(249, 115, 22, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Developing - Nearly Proficient',
        data: [20, 20, 25, 30, 25, 20, 15],
        borderColor: 'rgba(234, 179, 8, 1)',
        backgroundColor: 'rgba(234, 179, 8, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Transitioning - Proficient',
        data: [8, 8, 12, 15, 20, 25, 30],
        borderColor: 'rgba(34, 197, 94, 1)',
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        tension: 0.3,
      },
      {
        label: 'At Grade Level - Highly Proficient',
        data: [2, 2, 3, 5, 15, 25, 35],
        borderColor: 'rgba(139, 92, 246, 1)',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        tension: 0.3,
      },
    ],
  });

  // Data for single month view
  const monthlyEnglishData = {
    labels: ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'],
    datasets: [
      {
        label: 'Students',
        data: [2, 5, 10, 25, 30, 28], // March data
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

  const monthlyFilipinoData = {
    labels: ['Non-Reader', 'Syllable Reader', 'Word Reader', 'Phrase Reader', 'Sentence Reader', 'Paragraph Reader'],
    datasets: [
      {
        label: 'Students',
        data: [5, 10, 12, 28, 25, 30], // March data
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

  const monthlyMathData = {
    labels: ['Emerging - Not Proficient', 'Emerging - Low Proficient', 'Developing - Nearly Proficient', 'Transitioning - Proficient', 'At Grade Level - Highly Proficient'],
    datasets: [
      {
        label: 'Students',
        data: [10, 10, 15, 30, 35], // March data
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

  // Teacher Report Submissions Data
  const [reportData] = useState({
    labels: ['Submitted', 'Pending'],
    datasets: [
      {
        data: [75, 25],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 1,
      },
    ],
  });

  // Get current subject data based on selection
  const getSubjectData = () => {
    switch(selectedSubject) {
      case 'English': return englishData;
      case 'Filipino': return filipinoData;
      case 'Math': return mathData;
      default: return englishData;
    }
  };

  const getLineData = () => {
    switch(selectedSubject) {
      case 'English': return englishLineData;
      case 'Filipino': return filipinoLineData;
      case 'Math': return mathLineData;
      default: return englishLineData;
    }
  };

  const getMonthlyData = () => {
    switch(selectedSubject) {
      case 'English': return monthlyEnglishData;
      case 'Filipino': return monthlyFilipinoData;
      case 'Math': return monthlyMathData;
      default: return monthlyEnglishData;
    }
  };

  const getLevelOptions = () => {
    switch(selectedSubject) {
      case 'English':
      case 'Filipino':
        return [
          'All Levels',
          'Non-Reader',
          'Syllable Reader',
          'Word Reader',
          'Phrase Reader',
          'Sentence Reader',
          'Paragraph Reader'
        ];
      case 'Math':
        return [
          'All Levels',
          'Emerging - Not Proficient',
          'Emerging - Low Proficient',
          'Developing - Nearly Proficient',
          'Transitioning - Proficient',
          'At Grade Level - Highly Proficient'
        ];
      default:
        return ['All Levels'];
    }
  };

  // Chart options
  const barOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Months',
          font: {
            weight: 'bold' as const,
          }
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Number of Students',
          font: {
            weight: 'bold' as const,
          }
        },
        beginAtZero: true,
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
      x: {
        title: {
          display: true,
          text: 'Months',
          font: {
            weight: 'bold' as const,
          }
        },
      },
      y: {
        title: {
          display: true,
          text: 'Number of Students',
          font: {
            weight: 'bold' as const,
          }
        },
        beginAtZero: true,
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
    scales: {
      x: {
        title: {
          display: true,
          text: 'Proficiency Levels',
          font: {
            weight: 'bold' as const,
          }
        },
      },
      y: {
        title: {
          display: true,
          text: 'Number of Students',
          font: {
            weight: 'bold' as const,
          }
        },
        beginAtZero: true,
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Dashboard" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Info Section */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Principal Overview" />
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

              {/* Overview Cards Section */}
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={120}
                  label="Total Students"
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={15}
                  label="Total Teachers"
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                      <circle cx="8" cy="8" r="4" stroke="#013300" strokeWidth="2" />
                      <circle cx="16" cy="8" r="4" stroke="#013300" strokeWidth="2" />
                      <rect x="2" y="16" width="20" height="4" rx="2" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={8}
                  label="Monthly Reports"
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
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
                {/* Subject Navigation and Chart */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
                      <TertiaryHeader title={`${selectedSubject} Progress`} />
                      <div className="flex space-x-2">
                        <div className="relative">
                          <select 
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white text-green-900 rounded-lg shadow-sm focus:outline-none focus:ring-1 appearance-none pr-10 cursor-pointer transition-colors duration-150 hover:border-[#013300]"
                          >
                            <option value="English">English</option>
                            <option value="Filipino">Filipino</option>
                            <option value="Math">Math</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {viewMode === 'detailed' && (
                      <div className="flex space-x-2 mt-2 md:mt-0">
                        <div className="relative">
                          <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-green-400 text-green-900 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 appearance-none pr-10 cursor-pointer transition-colors duration-150 hover:border-green-600 hover:bg-green-50"
                          >
                            {months.map(month => (
                              <option key={month} value={month}>{month}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="relative">
                          <select 
                            value={selectedLevel}
                            onChange={(e) => setSelectedLevel(e.target.value)}
                            className="px-4 py-2.5 bg-white border border-green-400 text-green-900 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600 appearance-none pr-10 cursor-pointer transition-colors duration-150 hover:border-green-600 hover:bg-green-50"
                          >
                            {getLevelOptions().map(level => (
                              <option key={level} value={level}>{level}</option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {viewMode === 'summary' ? (
                    <>
                      <div className="h-96 mt-4">
                        <Bar 
                          options={{
                            ...barOptions,
                            plugins: {
                              ...barOptions.plugins,
                              title: {
                                display: true,
                                text: `${selectedSubject} Levels Progression Over Time`,
                                font: {
                                  size: 16,
                                  weight: 'bold',
                                }
                              },
                            }
                          }} 
                          data={getSubjectData()} 
                        />
                      </div>
                      <div className="mt-4 text-sm text-gray-600">
                        <p className="font-medium">Summary View: Shows how students progress from lower to higher proficiency levels over the school year.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="h-96">
                          <Bar 
                            options={{
                              ...monthlyBarOptions,
                              plugins: {
                                ...monthlyBarOptions.plugins,
                                title: {
                                  display: true,
                                  text: `${selectedSubject} Distribution for ${selectedMonth}`,
                                  font: {
                                    size: 16,
                                    weight: 'bold',
                                  }
                                },
                              }
                            }} 
                            data={getMonthlyData()} 
                          />
                        </div>
                        <div className="h-96">
                          <Line 
                            options={{
                              ...lineOptions,
                              plugins: {
                                ...lineOptions.plugins,
                                title: {
                                  display: true,
                                  text: `${selectedSubject} Progress Over Time`,
                                  font: {
                                    size: 16,
                                    weight: 'bold',
                                  }
                                },
                              }
                            }} 
                            data={getLineData()} 
                          />
                        </div>
                      </div>
                      <div className="mt-4 text-sm text-gray-600">
                        <p className="font-medium">Detailed View: Compare monthly distribution with progression trends for each level.</p>
                      </div>
                    </>
                  )}
                </div>

                {/* Teacher Report Submissions Chart */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Teacher Report Submissions" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                    <div className="h-64 flex justify-center md:col-span-1">
                      <Pie options={pieOptions} data={reportData} />
                    </div>
                    <div className="md:col-span-2">
                      <div className="bg-white p-4 rounded-lg shadow">
                        <h4 className="font-semibold text-green-900 mb-2">Submission Status</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm">Submitted Reports</span>
                            <span className="font-bold text-green-700">75%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-green-600 h-2.5 rounded-full" style={{width: '75%'}}></div>
                          </div>
                                                    <div className="flex justify-between items-center mt-3">
                            <span className="text-sm">Pending Reports</span>
                            <span className="font-bold text-red-700">25%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="bg-red-600 h-2.5 rounded-full" style={{width: '25%'}}></div>
                          </div>
                        </div>
                        <div className="mt-4 text-sm text-gray-600">
                          <p className="font-medium">6 out of 8 teachers have submitted their monthly reports.</p>
                          <p className="mt-1">2 teachers still need to submit their reports for March.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Additional Insights Section */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Key Insights & Recommendations" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h4 className="font-semibold text-green-900 mb-3">Positive Trends</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>English literacy improved by 35% since September</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>Paragraph readers increased from 2 to 28 students</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>Math proficiency shows steady monthly improvement</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-600 mr-2">✓</span>
                          <span>75% teacher compliance with reporting requirements</span>
                        </li>
                      </ul>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                      <h4 className="font-semibold text-green-900 mb-3">Areas for Attention</h4>
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex items-start">
                          <span className="text-red-600 mr-2">⚠️</span>
                          <span>25% of teachers still pending report submissions</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-600 mr-2">⚠️</span>
                          <span>Filipino literacy progress lags behind English</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-600 mr-2">⚠️</span>
                          <span>7 students remain non-readers across subjects</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-600 mr-2">⚠️</span>
                          <span>Math emerging level students need additional support</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-4 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold text-yellow-800 mb-2">Recommended Actions</h4>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>• Follow up with 2 teachers who haven't submitted reports</li>
                      <li>• Schedule focused intervention for remaining non-readers</li>
                      <li>• Share best practices from English to Filipino teachers</li>
                      <li>• Plan math reinforcement activities for emerging students</li>
                    </ul>
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