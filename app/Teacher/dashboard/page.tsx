import TeacherSidebar from "@/components/Teacher/Sidebar";
import TeacherHeader from "@/components/Teacher/Header";
// Button Components
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
// Text Components
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import BodyText from "@/components/Common/Texts/BodyText";

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

export default function TeacherDashboard() {
  return (
    <div
      className="
      /* Mobile */
      flex h-screen bg-white overflow-hidden
    "
    >
      {/*---------------------------------Sidebar---------------------------------*/}
      <TeacherSidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div
        className="
        /* Mobile */
        flex-1 pt-16 flex flex-col overflow-hidden
        

      "
      >
        <TeacherHeader title="Dashboard" />

        <main className="flex-1 overflow-y-auto">
          <div
            className="
            /* Mobile */
            p-4 h-full
            
            /* Tablet */
            sm:p-5
            
            /* Desktop */
            md:p-6
          "
          >
            {/*---------------------------------Main Container---------------------------------*/}
            <div
              className="
              /* Mobile */
              bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] 
              overflow-y-auto p-4
              
              /* Tablet */
              sm:p-5
              
              /* Desktop */
              md:p-6
            "
            >
              {/* Teacher Info Section */}
              <div
                className="
                /* Mobile */
                flex flex-col mb-3
                
                /* Tablet */
                md:flex-row md:items-center md:justify-between
              "
              >
                <SecondaryHeader title="Teacher Overview" />
              </div>

              <div
                className="
                /* Mobile */
                bg-gradient-to-br bg-green-50 rounded-xl shadow-lg 
                p-4 mb-6 min-w-full min-h-[120px]
                
                /* Tablet */
                sm:p-5 sm:mb-7
                
                /* Desktop */
                md:p-6 md:mb-8
              "
              >
                <div className="flex flex-col w-full">
                  <div
                    className="
                    /* Mobile */
                    flex flex-col mb-2
                    
                    /* Tablet */
                    md:flex-row md:items-start md:justify-between md:mb-0
                  "
                  >
                    <div
                      className="
                      /* Mobile */
                      mb-3
                      
                      /* Tablet */
                      md:mb-0 md:w-1/3
                    "
                    >
                      <TertiaryHeader title="Full Name:" />
                      <BodyText title="Maria Santos" />
                    </div>
                    <div
                      className="
                      /* Mobile */
                      mb-3
                      
                      /* Tablet */
                      md:mb-0 md:w-1/3
                    "
                    >
                      <TertiaryHeader title="Position:" />
                      <BodyText title="Teacher" />
                    </div>
                    <div
                      className="
                      /* Mobile */
                      mb-3
                      
                      /* Tablet */
                      md:mb-0 md:w-1/3
                    "
                    >
                      <TertiaryHeader title="Grade Assigned:" />
                      <BodyText title="Grade 4" />
                    </div>
                  </div>
                  <div
                    className="
                    /* Mobile */
                    mt-3
                    
                    /* Tablet */
                    md:mt-2
                  "
                  >
                    <TertiaryHeader title="Subject Assigned:" />
                    <BodyText title="English & Reading" />
                  </div>
                </div>
              </div>

              <hr
                className="
                /* Mobile */
                border-gray-300 mb-4
                
                /* Tablet */
                sm:mb-5
                
                /* Desktop */
                md:mb-6
              "
              />

              {/* Overview Cards Section */}
              <SecondaryHeader title="Class Overview" />
              <div
                className="
                /* Mobile */
                grid grid-cols-1 gap-4 mb-6
                
                /* Small Tablet */
                sm:grid-cols-2 sm:gap-5 sm:mb-7
                
                /* Desktop */
                lg:grid-cols-4 lg:gap-6 lg:mb-8
              "
              >
                <OverviewCard
                  value={32}
                  label="Students in Class"
                  icon={
                    <svg width="42" height="42" fill="none" viewBox="0 0 24 24">
                      <ellipse cx="12" cy="8" rx="4" ry="4" stroke="#013300" strokeWidth="2" />
                      <path d="M4 18v-2c0-2.66 5.33-4 8-4s8 1.34 8 4v2" stroke="#013300" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  }
                />
                <OverviewCard
                  value={8}
                  label="Remedial Students"
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
                />
                <OverviewCard
                  value={15}
                  label="Materials Created"
                  icon={
                    <svg width="40" height="40" fill="none" viewBox="0 0 24 24">
                      <rect x="3" y="7" width="18" height="14" rx="2" stroke="#013300" strokeWidth="2" />
                      <rect x="7" y="3" width="10" height="4" rx="1" stroke="#013300" strokeWidth="2" />
                    </svg>
                  }
                />
                <OverviewCard value={<span className="text-2xl">April 07, 2025</span>} label="Date Today" />
              </div>

              <hr
                className="
                /* Mobile */
                border-gray-300 mb-4
                
                /* Tablet */
                sm:mb-5
                
                /* Desktop */
                md:mb-6
              "
              />

              {/* ...existing or future content... */}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}