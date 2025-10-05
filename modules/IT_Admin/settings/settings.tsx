"use client";
import { useState } from "react";
import ITAdminHeader from "@/components/IT_Admin/Header";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

export default function ITAdminSettings() {
	// Additional state for new settings
	const [systemVersion] = useState("v1.0.0");
	const [adminUsers, setAdminUsers] = useState(["admin@email.com"]);
	const [newAdmin, setNewAdmin] = useState("");
// Removed password modification state
	const [backupMsg, setBackupMsg] = useState("");
	const [restoreMsg, setRestoreMsg] = useState("");
	const [maintenanceMsg, setMaintenanceMsg] = useState("");

	// Handlers for new settings
	const handleAddAdmin = () => {
		if (newAdmin && !adminUsers.includes(newAdmin)) {
			setAdminUsers([...adminUsers, newAdmin]);
			setNewAdmin("");
		}
	};
		const handleRemoveAdmin = (email: string) => {
		setAdminUsers(adminUsers.filter(u => u !== email));
	};
	const handleBackup = () => {
		setBackupMsg("Backup completed successfully!");
		setTimeout(() => setBackupMsg(""), 3000);
	};
	const handleRestore = () => {
		setRestoreMsg("System restored from backup!");
		setTimeout(() => setRestoreMsg(""), 3000);
	};
	const handleMaintenance = () => {
		setMaintenanceMsg("System cache cleared and services restarted!");
		setTimeout(() => setMaintenanceMsg(""), 3000);
	};
	const [siteName, setSiteName] = useState("RPTracker");
	const [logo, setLogo] = useState("");
	const [contact, setContact] = useState("admin@email.com");
	const [systemMsg, setSystemMsg] = useState("");
// Removed theme and log settings state

	const handleUpdateSystem = () => {
		setSystemMsg("System settings updated successfully!");
	};

// Removed theme and log handlers

		return (
			<div className="flex h-screen bg-white overflow-hidden">
				<ITAdminSidebar />
				<div className="flex-1 pt-16 flex flex-col overflow-auto min-h-0">
					<ITAdminHeader title="Settings" />
					<main className="flex-1">
						<div className="p-4 h-full sm:p-5 md:p-6">
							<div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6 space-y-6">

							{/* User Management */}
						<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
								<TertiaryHeader title="Admin User Management" />
								<div className="mt-4 space-y-2">
									<div className="flex gap-2">
										<input type="email" className="flex-1 border rounded px-3 py-2 bg-green-100 text-green-900" placeholder="Add admin email" value={newAdmin} onChange={e => setNewAdmin(e.target.value)} />
										<PrimaryButton onClick={handleAddAdmin}>Add</PrimaryButton>
									</div>
									<ul className="mt-2">
										{adminUsers.map(email => (
											<li key={email} className="flex items-center justify-between py-1">
												<span className="text-green-900 text-sm">{email}</span>
												<UtilityButton onClick={() => handleRemoveAdmin(email)}>Remove</UtilityButton>
											</li>
										))}
									</ul>
								</div>
							</div>



								{/* System Configuration */}
								<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
									<TertiaryHeader title="System Configuration" />
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
										<div>
											<label className="block text-sm font-semibold mb-1 text-green-900">Site Name</label>
											<input type="text" className="w-full border rounded px-3 py-2 bg-white text-green-900" value={siteName} onChange={e => setSiteName(e.target.value)} />
										</div>
										<div>
											<label className="block text-sm font-semibold mb-1 text-green-900">Logo</label>
											<input type="file" className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" onChange={e => setLogo(e.target.value)} />
										</div>
										<div className="md:col-span-2">
											<label className="block text-sm font-semibold mb-1 text-green-900">Contact Info</label>
											<input type="text" className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={contact} onChange={e => setContact(e.target.value)} />
										</div>
									</div>
									<PrimaryButton className="mt-4 w-auto px-4 py-2" onClick={handleUpdateSystem}>Update System</PrimaryButton>
									{systemMsg && <div className="text-green-700 mt-2 text-sm">{systemMsg}</div>}
								</div>




							{/* Landing Page Details & Contacts */}
							<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
								<TertiaryHeader title="Landing Page Details & Contacts" />
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
									<div>
										<label className="block text-sm font-semibold mb-1 text-green-900">Landing Page Title</label>
										<input type="text" className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={siteName} onChange={e => setSiteName(e.target.value)} />
									</div>
									<div>
										<label className="block text-sm font-semibold mb-1 text-green-900">Contact Email</label>
										<input type="email" className="w-full border rounded px-3 py-2 bg-white text-green-900" value={contact} onChange={e => setContact(e.target.value)} />
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-semibold mb-1 text-green-900">Contact Number</label>
										<input type="text" className="w-full border rounded px-3 py-2 bg-white text-green-900" placeholder="e.g. +63 900 000 0000" />
									</div>
									<div className="md:col-span-2">
										<label className="block text-sm font-semibold mb-1 text-green-900">Landing Page Description</label>
										<textarea className="w-full border rounded px-3 py-2 bg-white text-green-900" rows={3} placeholder="Enter a short description for the landing page..." />
									</div>
								</div>
								<PrimaryButton className="mt-4 w-auto px-4 py-2">Save Landing Page Details</PrimaryButton>
							</div>

							{/* Landing Page Picture */}
							<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
								<TertiaryHeader title="Landing Page Picture" />
								<div className="mt-4">
									  <input type="file" accept="image/*" className="w-full border rounded px-3 py-2 bg-white text-green-900" />
								</div>
								<PrimaryButton className="mt-4 w-auto px-4 py-2">Upload Picture</PrimaryButton>
							</div>

							{/* Privacy Policy File */}
							<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
								<TertiaryHeader title="Privacy Policy File" />
								<div className="mt-4">
									  <input type="file" accept="application/pdf,.doc,.docx,.txt" className="w-full border rounded px-3 py-2 bg-white text-green-900" />
								</div>
								<PrimaryButton className="mt-4 w-auto px-4 py-2">Upload Privacy Policy</PrimaryButton>
							</div>
							</div>
						</div>
					</main>
				</div>
			</div>
	);
}
