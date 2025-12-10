"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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
import { Bar, Pie, Line, Doughnut } from 'react-chartjs-2';
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
  onClick?: () => void;
  tooltip?: string;
};

type DashboardTotals = {
  students: number;
  teachers: number;
  breakdown: {
    teachers: number;
    masterTeachers: number;
  };
};

type ReportMonthStat = {
  label: string;
  month: number;
  year: number | null;
  total: number;
  submitted: number;
  pending: number;
};

type DashboardApiResponse = {
  totals: DashboardTotals;
  reports: {
    monthStats: ReportMonthStat[];
    currentMonth: ReportMonthStat;
  };
};

function OverviewCard({ value, label, icon, className = "", onClick, tooltip }: OverviewCardProps) {
  const baseClasses = `relative group bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px] transition-transform duration-200 hover:scale-105 sm:p-6 sm:min-w-[180px] sm:min-h-[120px] lg:p-7 ${className}`;

  const tooltipNode = tooltip ? (
    <span className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden w-56 -translate-x-1/2 -translate-y-full rounded-md bg-[#013300] px-3 py-2 text-center text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:block group-hover:opacity-100">
      {tooltip}
    </span>
  ) : null;

  const content = (
    <>
      {tooltipNode}
      <div className="flex flex-row items-center">
        <span className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl">{value}</span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-green-900 text-sm font-semibold mt-1 tracking-wide sm:text-base sm:mt-2">{label}</div>
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

export default function PrincipalDashboard() {
  const router = useRouter();
  // Get today's date in simplified month format
  const today = new Date();
  const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${dayShort[today.getDay()]}, ${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;
  const currentMonthName = today.toLocaleString('default', { month: 'long' });

  // State for view mode (summary or detailed)
  const [viewMode, setViewMode] = useState('summary');
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedLevel, setSelectedLevel] = useState('All Levels');
  const [selectedSubject, setSelectedSubject] = useState('English');
  const [overviewTotals, setOverviewTotals] = useState<DashboardTotals | null>(null);
  const [reportStats, setReportStats] = useState<{ currentMonth: ReportMonthStat | null; monthStats: ReportMonthStat[] }>(
    {
      currentMonth: null,
      monthStats: [],
    },
  );
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Months data
  const months = ['September', 'October', 'November', 'December', 'January', 'February', 'March'];

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsDashboardLoading(true);
      try {
        const response = await fetch('/api/principal/dashboard');
        if (!response.ok) {
          throw new Error(`Failed to load dashboard data (status ${response.status})`);
        }

        const data: DashboardApiResponse = await response.json();
        if (!isMounted) {
          return;
        }

        setOverviewTotals(data?.totals ?? null);
        const currentMonthStat = data?.reports?.currentMonth ?? null;
        const monthStats = data?.reports?.monthStats ?? [];
        setReportStats({ currentMonth: currentMonthStat, monthStats });

        if (currentMonthStat?.label) {
          setSelectedMonth(currentMonthStat.label);
        } else if (monthStats.length > 0 && monthStats[0]?.label) {
          setSelectedMonth(monthStats[0].label);
        }

        setDashboardError(null);
      } catch (error) {
        console.error('Failed to load principal dashboard overview', error);
        if (isMounted) {
          setOverviewTotals(null);
          setReportStats({ currentMonth: null, monthStats: [] });
          setDashboardError('Unable to load dashboard overview. Please try again later.');
        }
      } finally {
        if (isMounted) {
          setIsDashboardLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const formatCount = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString() : '—';

  const currentReport = reportStats.currentMonth;
  const submittedReports = currentReport?.submitted ?? 0;
  const pendingReports = currentReport?.pending ?? Math.max((currentReport?.total ?? 0) - (currentReport?.submitted ?? 0), 0);
  const totalReports = currentReport?.total ?? submittedReports + pendingReports;
  const submissionRate = totalReports > 0 ? Math.round((submittedReports / totalReports) * 100) : 0;
  const submissionRateDisplay = isDashboardLoading ? '...' : `${submissionRate}%`;
  const teachersBreakdown = overviewTotals?.breakdown ?? { teachers: 0, masterTeachers: 0 };
  const combinedTeachersCount = typeof overviewTotals?.teachers === 'number'
    ? overviewTotals.teachers
    : (teachersBreakdown.teachers ?? 0) + (teachersBreakdown.masterTeachers ?? 0);
  const totalStudentsDisplay = isDashboardLoading ? '...' : formatCount(overviewTotals?.students);
  const totalTeachersDisplay = isDashboardLoading ? '...' : formatCount(combinedTeachersCount);
  const monthlyReportsDisplay = isDashboardLoading ? '...' : formatCount(submittedReports);
  const submittedTeachersDisplay = isDashboardLoading ? '...' : formatCount(submittedReports);
  const pendingTeachersDisplay = isDashboardLoading ? '...' : formatCount(pendingReports);
  const totalTeachersExpectedDisplay = isDashboardLoading ? '...' : formatCount(totalReports);
  const submittedProgressWidth = totalReports > 0 ? `${Math.min(100, Math.round((submittedReports / totalReports) * 100))}%` : '0%';
  const pendingProgressWidth = totalReports > 0 ? `${Math.min(100, Math.round((pendingReports / totalReports) * 100))}%` : '0%';
  const monthlyReportsMonthLabel = currentReport?.label ?? currentMonthName;
  const totalStudentsTooltip = "Total students in all grades and subjects.";
  const totalTeachersTooltip = "Total teachers in all grades.";
  const monthlyReportsTooltip = `Total submitted reports in ${monthlyReportsMonthLabel}.`;

  // Grade levels for student progress chart
  const gradeLevels = ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6'];

  // Student Progress Data - 100% Stacked Bar Chart by Grade Level for each subject with original levels
  const [englishProgressData] = useState({
    labels: gradeLevels,
    datasets: [
      {
        label: 'Non-Reader',
        data: [15, 12, 8, 5, 3, 2],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Syllable Reader',
        data: [25, 22, 18, 15, 12, 8],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
      },
      {
        label: 'Word Reader',
        data: [20, 25, 30, 25, 20, 15],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
        borderColor: 'rgba(234, 179, 8, 1)',
        borderWidth: 1,
      },
      {
        label: 'Phrase Reader',
        data: [15, 18, 20, 25, 28, 30],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Sentence Reader',
        data: [15, 13, 14, 18, 22, 25],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
      {
        label: 'Paragraph Reader',
        data: [10, 10, 10, 12, 15, 20],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  });

  const [filipinoProgressData] = useState({
    labels: gradeLevels,
    datasets: [
      {
        label: 'Non-Reader',
        data: [18, 15, 10, 7, 4, 3],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Syllable Reader',
        data: [22, 20, 18, 15, 12, 10],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
      },
      {
        label: 'Word Reader',
        data: [20, 22, 25, 23, 20, 18],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
        borderColor: 'rgba(234, 179, 8, 1)',
        borderWidth: 1,
      },
      {
        label: 'Phrase Reader',
        data: [18, 20, 22, 25, 28, 30],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'Sentence Reader',
        data: [12, 13, 15, 18, 21, 24],
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
      },
      {
        label: 'Paragraph Reader',
        data: [10, 10, 10, 12, 15, 15],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  });

  const [mathProgressData] = useState({
    labels: gradeLevels,
    datasets: [
      {
        label: 'Emerging - Not Proficient',
        data: [20, 16, 12, 8, 5, 3],
        backgroundColor: 'rgba(239, 68, 68, 0.8)',
        borderColor: 'rgba(239, 68, 68, 1)',
        borderWidth: 1,
      },
      {
        label: 'Emerging - Low Proficient',
        data: [25, 22, 20, 18, 15, 12],
        backgroundColor: 'rgba(249, 115, 22, 0.8)',
        borderColor: 'rgba(249, 115, 22, 1)',
        borderWidth: 1,
      },
      {
        label: 'Developing - Nearly Proficient',
        data: [25, 26, 28, 27, 25, 23],
        backgroundColor: 'rgba(234, 179, 8, 0.8)',
        borderColor: 'rgba(234, 179, 8, 1)',
        borderWidth: 1,
      },
      {
        label: 'Transitioning - Proficient',
        data: [18, 20, 22, 25, 28, 30],
        backgroundColor: 'rgba(34, 197, 94, 0.8)',
        borderColor: 'rgba(34, 197, 94, 1)',
        borderWidth: 1,
      },
      {
        label: 'At Grade Level - Highly Proficient',
        data: [12, 16, 18, 22, 27, 32],
        backgroundColor: 'rgba(139, 92, 246, 0.8)',
        borderColor: 'rgba(139, 92, 246, 1)',
        borderWidth: 1,
      },
    ],
  });

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

  // Teacher Report Submissions Data for Donut Chart
  const reportData = useMemo(() => ({
    labels: ['Submitted', 'Pending'],
    datasets: [
      {
        data: [submittedReports, pendingReports],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(34, 197, 94, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 2,
        cutout: '70%',
      },
    ],
  }), [submittedReports, pendingReports]);

  // Get current subject progress data based on selection
  const getSubjectProgressData = () => {
    switch(selectedSubject) {
      case 'English': return englishProgressData;
      case 'Filipino': return filipinoProgressData;
      case 'Math': return mathProgressData;
      default: return englishProgressData;
    }
  };

  const getSubjectData = () => {
    switch(selectedSubject) {
      case 'English': return englishData;
      case 'Filipino': return englishData; // Using English as placeholder
      case 'Math': return englishData; // Using English as placeholder
      default: return englishData;
    }
  };

  const getLineData = () => {
    switch(selectedSubject) {
      case 'English': return englishLineData;
      case 'Filipino': return englishLineData; // Using English as placeholder
      case 'Math': return englishLineData; // Using English as placeholder
      default: return englishLineData;
    }
  };

  const getMonthlyData = () => {
    switch(selectedSubject) {
      case 'English': return monthlyEnglishData;
      case 'Filipino': return monthlyEnglishData; // Using English as placeholder
      case 'Math': return monthlyEnglishData; // Using English as placeholder
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

  // 100% Stacked Bar Chart Options for Student Progress
  const studentProgressOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.dataset.label || '';
            const rawData = Array.isArray(context.dataset.data) ? context.dataset.data[context.dataIndex] : undefined;
            const numericValue = typeof rawData === 'number'
              ? rawData
              : typeof context.parsed?.y === 'number'
                ? context.parsed.y
                : typeof context.parsed === 'number'
                  ? context.parsed
                  : typeof rawData?.y === 'number'
                    ? rawData.y
                    : 0;
            return `${label}: ${numericValue}%`;
          }
        }
      }
    },
    scales: {
      x: {
        stacked: true,
        title: {
          display: true,
          text: 'Grade Level',
          font: {
            weight: 'bold' as const,
          }
        },
      },
      y: {
        stacked: true,
        title: {
          display: true,
          text: 'Percentage of Students',
          font: {
            weight: 'bold' as const,
          }
        },
        beginAtZero: true,
        max: 100,
        ticks: {
          callback: function(value: any) {
            return value + '%';
          }
        }
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

  // Donut Chart Options for Teacher Submission
  const donutOptions = useMemo(() => ({
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.label || '';
            const value = typeof context.parsed === 'number' ? context.parsed : Number(context.parsed ?? 0);
            const data = Array.isArray(context.dataset?.data) ? context.dataset.data : [];
            const total = data.reduce((sum: number, entry: any) => {
              const numericEntry = typeof entry === 'number' ? entry : Number(entry ?? 0);
              return sum + (Number.isFinite(numericEntry) ? numericEntry : 0);
            }, 0);
            const percent = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
            return `${label}: ${value} (${percent}%)`;
          },
        },
      },
    },
    cutout: '70%',
    maintainAspectRatio: false,
  }), [submittedReports, pendingReports, totalReports]);

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

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
  }, [router]);

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
                {/* No action buttons */}
              </div>

              {dashboardError && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {dashboardError}
                </div>
              )}

              {/* Overview Cards Section */}
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={totalStudentsDisplay}
                  label="Total Students"
                  tooltip={totalStudentsTooltip}
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/Principal/students")}
                />
                <OverviewCard
                  value={totalTeachersDisplay}
                  label="Total Teachers"
                  tooltip={totalTeachersTooltip}
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                      <circle cx="8" cy="8" r="4" stroke="#013300" strokeWidth="2" />
                      <circle cx="16" cy="8" r="4" stroke="#013300" strokeWidth="2" />
                      <rect x="2" y="16" width="20" height="4" rx="2" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/Principal/teachers")}
                />
                <OverviewCard
                  value={monthlyReportsDisplay}
                  label="Monthly Reports"
                  tooltip={monthlyReportsTooltip}
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
                      <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                  onClick={() => handleNavigate("/Principal/reports")}
                />
                <OverviewCard
                  value={<span className="text-xl">{dateToday}</span>}
                  label="Date Today"
                  onClick={() => handleNavigate("/Principal/calendar")}
                />
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Charts Section */}
              <div className="space-y-8">
                {/* Subject Progress Chart - 100% Stacked Bar */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                    <div className="flex flex-col md:flex-row md:items-center space-y-2 md:space-y-0 md:space-x-4">
                      <TertiaryHeader title={`${selectedSubject} Student Progress by Grade Level`} />
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
                  </div>
                  
                  <div className="h-96 mt-4">
                    <Bar 
                      options={{
                        ...studentProgressOptions,
                        plugins: {
                          ...studentProgressOptions.plugins,
                          title: {
                            display: true,
                            text: `${selectedSubject} Proficiency Distribution by Grade Level`,
                            font: {
                              size: 16,
                              weight: 'bold',
                            }
                          },
                        }
                      }} 
                      data={getSubjectProgressData()} 
                    />
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <p className="font-medium">Shows the distribution of proficiency levels within each grade level for {selectedSubject}. Each bar represents 100% of students in that grade.</p>
                  </div>
                </div>

                {/* Teacher Report Submissions Chart - Donut with Center Label */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl shadow-lg p-6">
                  <TertiaryHeader title="Teacher Report Submissions" />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
                    {/* Donut Chart Section */}
                    <div className="h-64 flex flex-col items-center justify-center md:col-span-1 relative">
                      <div className="relative h-48 w-48">
                        <Doughnut options={donutOptions} data={reportData} />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-900">{submissionRateDisplay}</div>
                            <div className="text-sm text-gray-600 font-medium">Submitted</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Enhanced Metrics Section */}
                    <div className="md:col-span-2">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Submitted Reports */}
                        <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-5 transition-all duration-300 hover:shadow-xl hover:scale-105">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-4 h-4 bg-green-500 rounded-full mr-3 shadow-sm"></div>
                              <span className="text-sm font-semibold text-gray-700">Submitted</span>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-green-600">{submittedTeachersDisplay}</div>
                              <div className="text-xs text-gray-500 font-medium">Teachers</div>
                            </div>
                          </div>
                          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: submittedProgressWidth }}></div>
                          </div>
                        </div>
                        
                        {/* Pending Reports */}
                        <div className="bg-white rounded-2xl shadow-lg border border-red-100 p-5 transition-all duration-300 hover:shadow-xl hover:scale-105">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-4 h-4 bg-red-500 rounded-full mr-3 shadow-sm"></div>
                              <span className="text-sm font-semibold text-gray-700">Pending</span>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-red-600">{pendingTeachersDisplay}</div>
                              <div className="text-xs text-gray-500 font-medium">Teachers</div>
                            </div>
                          </div>
                          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                            <div className="bg-red-500 h-2 rounded-full" style={{ width: pendingProgressWidth }}></div>
                          </div>
                        </div>
                        
                        {/* Total Teachers */}
                        <div className="bg-white rounded-2xl shadow-lg border border-blue-100 p-5 transition-all duration-300 hover:shadow-xl hover:scale-105">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-4 h-4 bg-blue-500 rounded-full mr-3 shadow-sm"></div>
                              <span className="text-sm font-semibold text-gray-700">Total</span>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-blue-600">{totalTeachersExpectedDisplay}</div>
                              <div className="text-xs text-gray-500 font-medium">Teachers</div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-center">
                            <div className="text-xs text-gray-500 bg-blue-50 px-2 py-1 rounded-full font-medium">
                              All Faculty
                            </div>
                          </div>
                        </div>
                        
                        {/* Deadline */}
                        <div className="bg-white rounded-2xl shadow-lg border border-purple-100 p-5 transition-all duration-300 hover:shadow-xl hover:scale-105">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center">
                              <div className="w-4 h-4 bg-purple-500 rounded-full mr-3 shadow-sm"></div>
                              <span className="text-sm font-semibold text-gray-700">Deadline</span>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-purple-600">Mar 31</div>
                              <div className="text-xs text-gray-500 font-medium">2024</div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-center">
                            <div className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded-full font-medium border border-purple-200">
                              This Month
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
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