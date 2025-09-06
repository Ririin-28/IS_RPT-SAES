"use client";
import Sidebar from "@/components/Parent/Sidebar";
import Header from "@/components/Parent/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const sampleChild = {
  name: "John Doe",
  grade: "Grade 5",
  age: 10,
  progress: [
    { date: "2025-08-01", score: 60 },
    { date: "2025-08-08", score: 70 },
    { date: "2025-08-15", score: 75 },
    { date: "2025-08-22", score: 80 },
    { date: "2025-08-29", score: 85 },
  ],
};

const getChartColor = (grade: string) => {
  if (grade === "Grade 5") {
    return {
      borderColor: "#13B300",
      backgroundColor: "rgba(19, 179, 0, 0.1)",
      pointBackgroundColor: "#13B300",
    };
  }
  return {
    borderColor: "#6B21A8",
    backgroundColor: "rgba(107, 33, 168, 0.1)",
    pointBackgroundColor: "#6B21A8",
  };
};

const chartColors = getChartColor(sampleChild.grade);

const chartData = {
  labels: sampleChild.progress.map((p) => p.date),
  datasets: [
    {
      label: "Progress Score",
      data: sampleChild.progress.map((p) => p.score),
      fill: true,
      borderColor: chartColors.borderColor,
      backgroundColor: chartColors.backgroundColor,
      pointBackgroundColor: chartColors.pointBackgroundColor,
      tension: 0.3,
    },
  ],
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true },
    title: { display: true, text: "Child Progress Report" },
  },
  scales: {
    y: {
      min: 0,
      max: 100,
      ticks: {
        stepSize: 10,
        callback: function(tickValue: string | number) {
          return tickValue;
        }
      }
    },
  },
};

export default function ParentDashboard() {
  return (
  <div className="flex h-screen bg-gradient-to-br from-green-100 via-white to-green-50">
      <Sidebar />
  <div className="flex-1 flex flex-col min-h-screen bg-green-50">
        <div className="sticky top-0 z-30 w-full">
          <Header title="Dashboard" />
        </div>
        {/* Add pt-16 to main to prevent header overlap (header height = 64px) */}
        <main className="flex-1 overflow-y-auto pt-16">
          <div className="p-4 sm:p-5 md:p-6 h-full">
            <div className="bg-green-50 rounded-lg shadow-md border border-green-200 flex flex-col justify-between min-h-[calc(100vh-120px)] mb-6 overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Child Details" />
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div className="mb-3 md:mb-0 md:w-1/3">
                  <TertiaryHeader title="Name:" />
                  <BodyText title={sampleChild.name} />
                </div>
                <div className="mb-3 md:mb-0 md:w-1/3">
                  <TertiaryHeader title="Grade:" />
                  <BodyText title={sampleChild.grade} />
                </div>
                <div className="mb-3 md:mb-0 md:w-1/3">
                  <TertiaryHeader title="Age:" />
                  <BodyText title={String(sampleChild.age)} />
                </div>
              </div>
              <SecondaryHeader title="Progress Report" />
              <div className="bg-green-100 rounded-xl shadow-lg p-4 flex-1 flex items-center justify-center" style={{ width: '100%', minHeight: 220 }}>
                <div style={{ width: '100%', height: '100%' }}>
                  <Line data={chartData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
