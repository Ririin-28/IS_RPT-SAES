"use client";
import ParentHeader from "@/components/Parent/Header";
import ParentSidebar from "@/components/Parent/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";

const notifications = [
  { date: "2025-09-01", message: "Juan Dela Cruz was absent today. Please provide a reason." },
];

export default function ParentNotifications() {
  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ParentSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Notifications" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Notifications" />
              <div className="mt-6">
                {notifications.map((note, idx) => (
                  <div key={idx} className="mb-4 p-4 bg-green-50 rounded shadow flex flex-col gap-2">
                    <TertiaryHeader title={
                      new Date(note.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    } />
                    <div className="text-green-900 font-semibold">{note.message}</div>
                    <form className="flex gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="Reason for absence..."
                        className="border-2 border-gray-300 rounded-lg px-4 py-3 flex-1 bg-white text-black placeholder-green-700 focus:outline-none focus:border-gray-500 transition"
                      />
                      <PrimaryButton type="submit">Send</PrimaryButton>
                    </form>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
