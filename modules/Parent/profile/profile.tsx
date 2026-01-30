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
  const [editing, setEditing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleUpdate = (e: any) => {
    e.preventDefault();
    if (editing) {
      setShowConfirmModal(true);
    } else {
      setEditing(true);
      setMsg("");
    }
  };

  const handleConfirmUpdate = () => {
    setShowConfirmModal(false);
    setEditing(false);
    setShowSuccessModal(true);
  };

  const handleCloseSuccess = () => {
    setShowSuccessModal(false);
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
  <div className="flex h-screen bg-white overflow-hidden">
      <ParentSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <ParentHeader title="Profile" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-100 overflow-y-auto p-4 sm:p-5 md:p-6">
              <SecondaryHeader title="Parent Details" />
              <form className="flex flex-col gap-8" onSubmit={handleUpdate}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Name</label>
                    <input type="text" className={`w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 bg-white ${editing ? 'text-black' : 'text-gray-400'} placeholder-gray-400 transition`} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} placeholder="Enter your name" readOnly={!editing} />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Address</label>
                    <input type="text" className={`w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 bg-white ${editing ? 'text-black' : 'text-gray-400'} placeholder-gray-400 transition`} value={profile.address} onChange={e => setProfile({ ...profile, address: e.target.value })} placeholder="Enter your address" readOnly={!editing} />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Contact Number</label>
                    <input type="text" className={`w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 bg-white ${editing ? 'text-black' : 'text-gray-400'} placeholder-gray-400 transition`} value={profile.contact} onChange={e => setProfile({ ...profile, contact: e.target.value })} placeholder="Enter your contact number" readOnly={!editing} />
                  </div>
                  <div>
                    <label className="block text-base font-semibold mb-2 text-green-900">Email</label>
                    <input type="email" className={`w-full border-2 border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:border-gray-500 bg-white ${editing ? 'text-black' : 'text-gray-400'} placeholder-gray-400 transition`} value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} placeholder="Enter your email" readOnly={!editing} />
                  </div>
                </div>
                <div className="flex justify-center mt-4">
                  <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-semibold px-5 py-2 rounded-lg shadow transition-all duration-150 border border-green-700 focus:outline-none focus:ring-2 focus:ring-green-400">
                    {editing ? 'Save Profile' : 'Edit Profile'}
                  </button>
                </div>
                {msg && <div className="text-green-700 mt-2 text-base font-semibold">{msg}</div>}

                {/* Confirmation Modal */}
                {showConfirmModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center overlay-500 bg-opacity-20 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
                      <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl" onClick={() => setShowConfirmModal(false)}>&times;</button>
                      <h3 className="text-xl font-bold mb-4 text-green-700">Confirm Update</h3>
                      <p className="mb-6 text-gray-700">Are you sure you want to save these changes to your profile?</p>
                      <div className="flex justify-end gap-3">
                        <button className="px-5 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 font-semibold hover:bg-gray-200 transition" onClick={() => setShowConfirmModal(false)}>
                          Cancel
                        </button>
                        <button className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 border border-green-700 shadow transition" onClick={handleConfirmUpdate}>
                          Confirm
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Modal */}
                {showSuccessModal && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center overlay-500 bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md relative">
                      <button className="absolute top-2 right-2 text-gray-500 hover:text-gray-700 text-xl" onClick={handleCloseSuccess}>&times;</button>
                      <h3 className="text-xl font-bold mb-4 text-green-700">Profile Updated</h3>
                      <p className="mb-6 text-gray-700">Your profile has been successfully updated.</p>
                      <div className="flex justify-end">
                        <button className="px-5 py-2 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 border border-green-700 shadow transition" onClick={handleCloseSuccess}>
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </form>

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}