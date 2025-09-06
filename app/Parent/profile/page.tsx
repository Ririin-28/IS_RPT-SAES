"use client";
import ParentHeader from "@/components/Parent/Header";
import ParentSidebar from "@/components/Parent/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import { useState } from "react";

export default function ParentProfile() {
  const [profile, setProfile] = useState({
    name: "Parent Name",
    email: "parent@email.com",
    address: "123 Main St, City, Country",
    contact: "09123456789"
  });
  const [msg, setMsg] = useState("");
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", new: "", confirm: "" });
  const [emailForm, setEmailForm] = useState({ current: profile.email, new: "", confirm: "" });

  const handleUpdate = (e: any) => {
    e.preventDefault();
    setMsg("Profile updated (demo only)");
  };

  const handlePasswordChange = (e: any) => {
    e.preventDefault();
    setMsg("Password changed (demo only)");
    setShowPasswordModal(false);
    setPasswordForm({ current: "", new: "", confirm: "" });
  };

  const handleEmailChange = (e: any) => {
    e.preventDefault();
    setMsg("Email changed (demo only)");
    setShowEmailModal(false);
    setEmailForm({ current: profile.email, new: "", confirm: "" });
  };

  return (
  <div className="flex h-screen bg-gradient-to-br from-green-100 via-white to-green-200 overflow-hidden">
      <ParentSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Profile" />
        <main className="flex-1 overflow-y-auto flex items-center justify-center">
          <div className="w-full max-w-4xl p-4 sm:p-8 md:p-10">
            <div className="rounded-2xl shadow-xl border border-gray-200 bg-white/90 backdrop-blur-lg h-full min-h-[600px] overflow-y-auto p-10 flex flex-col gap-8">
              <SecondaryHeader title="Profile Details" />
              <form className="flex flex-col gap-8" onSubmit={handleUpdate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Name</label>
                    <input type="text" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 focus:outline-none focus:border-green-400 bg-green-50 text-gray-900 placeholder-gray-400 transition" value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Enter your name" />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Address</label>
                    <input type="text" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 focus:outline-none focus:border-green-400 bg-green-50 text-gray-900 placeholder-gray-400 transition" value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder="Enter your address" />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Contact Number</label>
                    <input type="text" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 focus:outline-none focus:border-green-400 bg-green-50 text-gray-900 placeholder-gray-400 transition" value={profile.contact} onChange={e => setProfile({ ...profile, contact: e.target.value })} placeholder="Enter your contact number" />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Email</label>
                    <input type="email" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 focus:outline-none focus:border-green-400 bg-green-50 text-gray-900 placeholder-gray-400 transition" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="Enter your email" />
                  </div>
                </div>
                <div className="flex gap-6 mt-4">
                  <button type="button" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 border border-green-700 focus:outline-none focus:ring-2 focus:ring-green-400" onClick={() => setShowPasswordModal(true)}>
                    <span className="inline-flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.104.896-2 2-2s2 .896 2 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2c0-1.104.896-2 2-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 11V7a6 6 0 1112 0v4" /></svg>
                      Change Password
                    </span>
                  </button>
                  <button type="button" className="bg-gray-800 hover:bg-gray-900 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 border border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400" onClick={() => setShowEmailModal(true)}>
                    <span className="inline-flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12H8m8 0a4 4 0 10-8 0m8 0v4a4 4 0 01-8 0v-4" /></svg>
                      Change Email
                    </span>
                  </button>
                  <button type="submit" className="bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 border border-green-800 focus:outline-none focus:ring-2 focus:ring-green-400">
                    Update Profile
                  </button>
                </div>
                {msg && <div className="text-green-700 mt-2 text-base font-semibold">{msg}</div>}
              </form>

              {/* Password Modal */}
              {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
                    <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl" onClick={() => setShowPasswordModal(false)}>&times;</button>
                    <h3 className="text-xl font-bold mb-6 text-green-700">Change Password</h3>
                    <form className="flex flex-col gap-4" onSubmit={handlePasswordChange}>
                      <input type="password" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 bg-green-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400" value={passwordForm.current} onChange={e => setPasswordForm({ ...passwordForm, current: e.target.value })} placeholder="Current Password" required />
                      <input type="password" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 bg-green-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400" value={passwordForm.new} onChange={e => setPasswordForm({ ...passwordForm, new: e.target.value })} placeholder="New Password" required />
                      <input type="password" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 bg-green-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400" value={passwordForm.confirm} onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })} placeholder="Confirm New Password" required />
                      <button type="submit" className="bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl shadow-lg transition-all duration-200 border border-green-800 focus:outline-none focus:ring-2 focus:ring-green-400">Save Password</button>
                    </form>
                  </div>
                </div>
              )}

              {/* Email Modal */}
              {showEmailModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                  <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
                    <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl" onClick={() => setShowEmailModal(false)}>&times;</button>
                    <h3 className="text-xl font-bold mb-6 text-green-700">Change Email</h3>
                    <form className="flex flex-col gap-4" onSubmit={handleEmailChange}>
                      <input type="email" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 bg-green-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400" value={emailForm.current} onChange={e => setEmailForm({ ...emailForm, current: e.target.value })} placeholder="Current Email" required />
                      <input type="email" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 bg-green-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400" value={emailForm.new} onChange={e => setEmailForm({ ...emailForm, new: e.target.value })} placeholder="New Email" required />
                      <input type="email" className="w-full border-2 border-green-200 rounded-lg px-4 py-3 bg-green-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-green-400" value={emailForm.confirm} onChange={e => setEmailForm({ ...emailForm, confirm: e.target.value })} placeholder="Confirm New Email" required />
                      <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 rounded-lg shadow transition">Save Email</button>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
