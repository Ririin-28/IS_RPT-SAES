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
	const [passwordPolicy, setPasswordPolicy] = useState({ minLength: 8, requireSpecial: true, expireDays: 90 });
	const [sessionTimeout, setSessionTimeout] = useState(30);
	const [twoFactor, setTwoFactor] = useState(false);
	const [allowedIPs, setAllowedIPs] = useState("");
	const [notificationEmail, setNotificationEmail] = useState(true);
	const [notificationSMS, setNotificationSMS] = useState(false);
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
	const [theme, setTheme] = useState("Default");
	const [themeMsg, setThemeMsg] = useState("");
	const [logRetention, setLogRetention] = useState(30);
	const [logMsg, setLogMsg] = useState("");

	const handleUpdateSystem = () => {
		setSystemMsg("System settings updated successfully!");
	};

	const handleApplyTheme = () => {
		setThemeMsg(`Theme changed to ${theme}!`);
	};

	const handleExportLogs = () => {
		setLogMsg("Logs exported successfully!");
	};

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

							{/* Security Settings */}
						<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
								<TertiaryHeader title="Security Settings" />
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
									<div className="md:col-span-2 grid grid-cols-2 gap-6">
										<div>
											<label className="block text-sm font-semibold mb-1 text-green-900">Password Min Length</label>
											<input type="number" min={6} className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={passwordPolicy.minLength} onChange={e => setPasswordPolicy({ ...passwordPolicy, minLength: Number(e.target.value) })} />
										</div>
										<div>
											<label className="block text-sm font-semibold mb-1 text-green-900">Password Expiry (days)</label>
											<input type="number" min={1} className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={passwordPolicy.expireDays} onChange={e => setPasswordPolicy({ ...passwordPolicy, expireDays: Number(e.target.value) })} />
										</div>
									</div>
								</div>
							</div>

								{/* System Configuration */}
								<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
									<TertiaryHeader title="System Configuration" />
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
										<div>
											<label className="block text-sm font-semibold mb-1 text-green-900">Site Name</label>
											<input type="text" className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={siteName} onChange={e => setSiteName(e.target.value)} />
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

								{/* Theme & Appearance */}
								<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
									<TertiaryHeader title="Theme & Appearance" />
									<div className="mt-4">
										<label className="block text-sm font-semibold mb-1 text-green-900">Theme</label>
										<select className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={theme} onChange={e => setTheme(e.target.value)}>
											<option value="Default">Default</option>
											<option value="Dark">Dark</option>
											<option value="Light">Light</option>
										</select>
									</div>
									<PrimaryButton className="mt-4 w-auto px-4 py-2" onClick={handleApplyTheme}>Apply Theme</PrimaryButton>
									{themeMsg && <div className="text-green-700 mt-2 text-sm">{themeMsg}</div>}
								</div>

								{/* Audit Log Settings */}
								<div className="bg-green-50 rounded-lg shadow-md border border-green-200 p-6">
									<TertiaryHeader title="Audit Log Settings" />
									<div className="mt-4">
										<label className="block text-sm font-semibold mb-1 text-green-900">Log Retention (days)</label>
										<input type="number" min={1} className="w-full border rounded px-3 py-2 bg-green-100 text-green-900" value={logRetention} onChange={e => setLogRetention(Number(e.target.value))} />
									</div>
									<UtilityButton className="mt-4 w-auto px-4 py-2" onClick={handleExportLogs}>Export Logs</UtilityButton>
									{logMsg && <div className="text-green-700 mt-2 text-sm">{logMsg}</div>}
								</div>
							</div>
						</div>
					</main>
				</div>
			</div>
	);
}
