"use client";
import { useMemo, useState } from "react";
import ITAdminHeader from "@/components/IT_Admin/Header";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import TableList from "@/components/Common/Tables/TableList";

const ROLE_OPTIONS = [
	"All Users",
	"IT Admin",
	"Principal",
	"Master Teacher",
	"Teacher",
	"Parent",
	"Student",
] as const;

export default function ITAdminLogs() {
	// Example log data, replace with real data from backend/API
	const [logs] = useState([
		{
			id: 1,
			name: "Isabella Cruz",
			email: "isabella.cruz@district.gov",
			role: "IT Admin",
			loginTime: "2025-09-04 08:15:23",
		},
		{
			id: 2,
			name: "Anthony Rivera",
			email: "anthony.rivera@school.edu",
			role: "Principal",
			loginTime: "2025-09-04 08:45:01",
		},
		{
			id: 3,
			name: "Maria Santos",
			email: "maria.santos@school.edu",
			role: "Master Teacher",
			loginTime: "2025-09-04 09:02:10",
		},
		{
			id: 4,
			name: "Jacob Miller",
			email: "jacob.miller@school.edu",
			role: "Teacher",
			loginTime: "2025-09-04 09:37:18",
		},
		{
			id: 5,
			name: "Camille Lopez",
			email: "camille.lopez@home.com",
			role: "Parent",
			loginTime: "2025-09-03 17:45:00",
		},
		{
			id: 6,
			name: "Ethan Johnson",
			email: "ethan.johnson@student.edu",
			role: "Student",
			loginTime: "2025-09-03 18:12:44",
		},
	]);
	const [roleFilter, setRoleFilter] = useState<(typeof ROLE_OPTIONS)[number]>(ROLE_OPTIONS[0]);

	const filteredLogs = useMemo(() => {
		if (roleFilter === "All Users") return logs;
		return logs.filter((log) => log.role === roleFilter);
	}, [logs, roleFilter]);

		// Helper to format timestamp
		const formatTimestamp = (ts: string) => {
			const d = new Date(ts.replace(/-/g, '/'));
			if (isNaN(d.getTime())) return ts;
			return d.toLocaleString('en-US', {
				year: 'numeric',
				month: 'short',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: true
			});
		};

		return (
			<div className="flex h-screen bg-white overflow-hidden">
				<ITAdminSidebar />
				<div className="flex-1 flex flex-col min-h-screen">
					<ITAdminHeader title="Account Login Logs" />
					<main className="flex-1 overflow-y-auto pt-16">
									<div className="p-4 h-full sm:p-5 md:p-6">
										<div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
											<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
												<div className="flex flex-col gap-2">
													<div className="flex items-center gap-0">
														<HeaderDropdown
															options={[...ROLE_OPTIONS]}
															value={roleFilter}
															onChange={(value) => {
																const next = ROLE_OPTIONS.find((option) => option === value) ?? ROLE_OPTIONS[0];
																setRoleFilter(next);
															}}
														/>
														<SecondaryHeader title="Login Activity" />
													</div>
													<p className="text-gray-600 text-md font-medium">Total: {filteredLogs.length}</p>
												</div>
											</div>
											<TableList
												columns={[ 
													{ key: "no", title: "No#" },
													{ key: "name", title: "Name" },
													{ key: "email", title: "Email" },
													{ key: "role", title: "Role" },
													{ key: "loginTime", title: "Login Time", render: (row) => formatTimestamp(row.loginTime) },
												]}
												data={filteredLogs.map((log, idx) => ({
													...log,
													no: idx + 1,
												}))}
												pageSize={10}
											/>
										</div>
									</div>
					</main>
				</div>
			</div>
		);
}
