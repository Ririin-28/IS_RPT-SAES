import PrincipalHeader from "@/components/Principal/Header";
import PrincipalSidebar from "@/components/Principal/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";


type OverviewCardProps = {
  value: React.ReactNode;
  label: string;
  icon?: React.ReactNode;
  className?: string;
};

function OverviewCard({ value, label, icon, className = "" }: OverviewCardProps) {
  return (
    <div
      className={`bg-gradient-to-br bg-green-50 rounded-xl shadow-lg flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px] transition-transform duration-200 sm:p-6 sm:min-w-[180px] sm:min-h-[120px] lg:p-7 ${className}`}
    >
      <div className="flex flex-row items-center">
        <span className="text-4xl font-extrabold text-[#013300] drop-shadow sm:text-5xl">{value}</span>
        {icon && <span className="ml-1 sm:ml-2">{icon}</span>}
      </div>
      <div className="text-green-900 text-sm font-semibold mt-1 tracking-wide sm:text-base sm:mt-2">{label}</div>
    </div>
  );
}


import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import BodyText from "@/components/Common/Texts/BodyText";


export default function PrincipalDashboard() {

  // Get today's date in simplified month format (e.g., Jan., Feb., ...)
  const today = new Date();
  const monthShort = [
    'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.',
    'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
  ];
  const dateToday = `${monthShort[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`;

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <PrincipalSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <PrincipalHeader title="Dashboard" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              {/* Info Section (optional, for future expansion) */}
              <div className="flex flex-col mb-3 md:flex-row md:items-center md:justify-between">
                <SecondaryHeader title="Principal Overview" />
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
                <OverviewCard value={<span className="text-2xl">April 07, 2025</span>} label="Date Today" />
              </div>

              <hr className="border-gray-300 mb-4 sm:mb-5 md:mb-6" />

              {/* Progress/Graph Section */}
              <div className="bg-gradient-to-br bg-green-50 rounded-xl shadow-lg p-6 mt-4">
                <TertiaryHeader title="Student Progress Over Time" />
                {/* TODO: Add line graph here */}
                <div className="h-48 flex items-center justify-center text-green-400">[Line Graph Placeholder]</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
