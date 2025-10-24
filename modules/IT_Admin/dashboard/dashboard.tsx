"use client";
import Sidebar from "@/components/IT_Admin/Sidebar";
import Header from "@/components/IT_Admin/Header";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";

import TableList from "@/components/Common/Tables/TableList";

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
  // Sanitize string values to prevent XSS
  const sanitizeContent = (content: any): React.ReactNode => {
    if (typeof content === 'string') {
      // For strings, create a text node instead of rendering HTML
      return content;
    }
    return content;
  };

  return (
    <div
      className={`
      /* Mobile */
      bg-gradient-to-br bg-green-50 rounded-xl shadow-lg
      flex flex-col items-center justify-center p-5 min-w-[160px] min-h-[110px]
      transition-transform duration-200

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
          {sanitizeContent(value)}
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
        {sanitizeContent(label)}
      </div>
    </div>
  );
}


export default function ITAdminDashboard() {
  // Sample data for recent logins
  const recentLogins = [
    { id: 1, user: "Juan Dela Cruz", role: "Teacher", loginTime: "2025-09-08 08:15", status: "Success" },
    { id: 2, user: "Maria Santos", role: "Principal", loginTime: "2025-09-08 08:10", status: "Success" },
    { id: 3, user: "Ana Reyes", role: "Parent", loginTime: "2025-09-08 07:55", status: "Failed" },
    { id: 4, user: "IT Admin", role: "IT Admin", loginTime: "2025-09-08 07:50", status: "Success" },
  ];
  function formatDateTime(dt: string) {
    const date = new Date(dt.replace(' ', 'T'));
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }
  const columns = [
    { key: "user", title: "User" },
    { key: "role", title: "Role" },
    { key: "loginTime", title: "Login Time", render: (row: any) => formatDateTime(row.loginTime) },
    { key: "status", title: "Status", render: (row: any) => (
      <span className={row.status === "Success" ? "text-[#013300] font-semibold" : "text-red-600 font-semibold"}>
        {row.status}
      </span>
    ) },
  ];

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
              {/* Overview Cards Section */}
              <SecondaryHeader title="User Overview" />
              <div className="grid grid-cols-1 gap-4 mb-6 sm:grid-cols-2 sm:gap-5 sm:mb-7 lg:grid-cols-4 lg:gap-6 lg:mb-8">
                <OverviewCard
                  value={128}
                  label="Total Users"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <path d="M16 3.128a4 4 0 0 1 0 7.744" />
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                      <circle cx="9" cy="7" r="4" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={18}
                  label="New Users This Week"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" x2="19" y1="8" y2="14" />
                      <line x1="22" x2="16" y1="11" y2="11" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={12}
                  label="Pending Onboarding"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 14v2.2l1.6 1" />
                      <path d="M16 4h2a2 2 0 0 1 2 2v.832" />
                      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2" />
                      <circle cx="16" cy="16" r="6" />
                      <rect x="8" y="2" width="8" height="4" rx="1" />
                    </svg>
                  }
                />
                <OverviewCard

                  value={3}
                  label="Archived Accounts"
                  icon={
                    <svg width="38" height="38" fill="none" viewBox="0 0 24 24" stroke="#013300" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4.929 4.929 19.07 19.071" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                  }
                />
              </div>
              {/* Recent Logins Table Section */}
              <div className="mt-8">
                <TertiaryHeader title="Recent Logins" />
                <TableList columns={columns} data={recentLogins} pageSize={5} hidePagination={true} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
