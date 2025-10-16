"use client";
import { useEffect, useState } from "react";
import ITAdminHeader from "@/components/IT_Admin/Header";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TertiaryHeader from "@/components/Common/Texts/TertiaryHeader";
import TableList from "@/components/Common/Tables/TableList";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

export default function ITAdminLogs() {
	// Example log data, replace with real data from backend/API
	const [logs] = useState([
		{
			id: 1,
			name: "John Doe",
			email: "john.doe@email.com",
			role: "Admin",
			loginTime: "2025-09-04 08:15:23",
		},
		{
			id: 2,
			name: "Jane Smith",
			email: "jane.smith@email.com",
			role: "Teacher",
			loginTime: "2025-09-04 09:02:10",
		},
		{
			id: 3,
			name: "Peter Jones",
			email: "peter.jones@email.com",
			role: "Parent",
			loginTime: "2025-09-03 17:45:00",
		},
	]);

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
											<div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
												<TertiaryHeader title={`Total: ${logs.length}`} />
											</div>
											<TableList
												columns={[ 
													{ key: "no", title: "No#" },
													{ key: "name", title: "Name" },
													{ key: "email", title: "Email" },
													{ key: "role", title: "Role" },
													{ key: "loginTime", title: "Login Time", render: (row) => formatTimestamp(row.loginTime) },
												]}
												data={logs.map((log, idx) => ({
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
