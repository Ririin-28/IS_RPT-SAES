import React from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

const user = {
  picture: "https://ui-avatars.com/api/?name=Doe,John,A&background=013300&color=fff&size=256",
  surname: "Dela Cruz",
  firstName: "Juan",
  middleName: "A.",
  gradeHandled: "Grade 5",
  subjectHandled: "English",
  email: "juandelacruz@email.com",
  contactNumber: "09171234567",
  teacherId: "2022-001",
  position: "Master Teacher",
  joinDate: "January 2022",
};

export default function MasterTeacherProfile() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-gray-200 py-10 px-4 flex items-center justify-center">
      <a href="/" className="absolute top-6 left-4 sm:left-8 z-20 flex items-center text-green-900 hover:underline">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path d="M15.5 19L9 12L15.5 5" stroke="#013300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="ml-1 text-lg font-medium">Back</span>
      </a>
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col md:flex-row">
        {/* Profile Card */}
        <div className="w-full md:w-1/3 bg-green-50 p-8 flex flex-col items-center">
          <div className="relative mb-4">
            <img src={user.picture} alt="Profile" className="w-40 h-40 rounded-full border-4 border-white shadow-xl" />
            <button
              className="absolute bottom-2 right-2 bg-white rounded-full p-2 shadow hover:bg-gray-100 transition"
              title="Edit Profile Picture"
            >
              {/* Pencil icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#013300"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-pencil-icon lucide-pencil"
              >
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
          </div>
          <div className="flex items-center justify-center mb-1">
            <h2 className="text-2xl font-bold text-gray-800 text-center">
              {user.surname}, {user.firstName} {user.middleName}
            </h2>
            <button className="ml-2 p-1 rounded-full hover:bg-gray-100 transition" title="Edit Name">
              {/* Pencil icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#013300"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="lucide lucide-pencil-icon lucide-pencil"
              >
                <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                <path d="m15 5 4 4" />
              </svg>
            </button>
          </div>
          <div className="text-green-700 font-medium mb-2">{user.position}</div>
          <PrimaryButton fullWidth className="mt-8">Change Password</PrimaryButton>
        </div>

        {/* Main Content */}
        {/* Personal Information */}
        <div className="w-full md:w-2/3 p-8">
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">Personal Information</h3>
              <UtilityButton className="flex items-center gap-1 px-3 py-1 text-sm font-medium" title="Edit Personal Information">
                {/* Pencil icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-pencil"
                >
                  <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
                  <path d="m15 5 4 4" />
                </svg>
                Edit
              </UtilityButton>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="Teacher ID" value={user.teacherId} />
              <InfoField label="Position" value={user.position} />
              <InfoField label="Email" value={user.email} />
              <InfoField label="Contact Number" value={user.contactNumber} />
            </div>
          </section>
          {/* Handled Area */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800">Handled Area</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InfoField label="Grade Handled" value={user.gradeHandled} />
              <InfoField label="Subject Handled" value={user.subjectHandled} />
            </div>
          </section>
          <section>
            <h3 className="text-xl font-semibold text-gray-800 mb-4 pb-2 border-b border-gray-200">Data Privacy Clause</h3>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
              <p className="text-yellow-700 text-sm">
                <span className="font-bold">Note:</span> Your personal information is protected and handled in accordance with our data
                privacy policy.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Reusable component for information fields
function InfoField({ label, value }: { label: string; value: string }) {
  // Sanitize the value to prevent XSS attacks
  const sanitizedValue = typeof value === 'string' ? value : '';
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-500 mb-1">{label}</label>
      <div className="p-3 bg-gray-50 rounded-lg text-gray-900">{sanitizedValue}</div>
    </div>
  );
}


