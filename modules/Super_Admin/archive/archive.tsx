"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import ITAdminSidebar from "@/components/Super_Admin/Sidebar";
import ITAdminHeader from "@/components/Super_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
// Teacher Tab
import TeacherArchiveTab from "./TeacherTab/TeacherTab";
// Master Teacher Tab
import MasterTeacherTab from "./MasterTeacherTab/MasterTeacherTab";
// Principal Tab
import PrincipalTab from "./PrincipalTab/PrincipalTab";
// Super Admin Tab
import ITAdminArchiveTab from "./ITAdminTab/ITAdminTab";
// Student Tab
import StudentArchiveTab from "./StudentTab/StudentTab";

const GRADE_OPTIONS = ["All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"] as const;
const ACCOUNT_OPTIONS = ["Super Admin", "Principal", "Master Teachers", "Teachers"] as const;

type AccountOption = (typeof ACCOUNT_OPTIONS)[number];

type ArchiveRoleKey = "super_admin" | "principal" | "master_teacher" | "teacher" | "student";

const ACCOUNT_TYPE_TO_ROLE: Record<AccountOption, ArchiveRoleKey> = {
  "Super Admin": "super_admin",
  Principal: "principal",
  "Master Teachers": "master_teacher",
  Teachers: "teacher",
};

interface ArchiveEntry {
  archiveId: number;
  userId: number | null;
  roleKey: ArchiveRoleKey | null;
  roleLabel: string;
  name: string | null;
  email?: string;
  reason?: string;
  archivedDate: string | null;
  archivedDateDisplay: string;
  grade?: string | null;
  section?: string | null;
  contactNumber?: string | null;
  [key: string]: unknown;
}

const normalizeRoleKey = (role: string | null | undefined): ArchiveRoleKey | null => {
  if (!role) return null;
  const value = role.toLowerCase();
  if (
    value === "super_admin" ||
    value === "super-admin" ||
    value === "super admin" ||
    value === "superadmin" ||
    value === "admin" ||
    value === "it_admin" ||
    value === "it-admin" ||
    value === "it admin"
  ) return "super_admin";
  if (value === "principal") return "principal";
  if (value === "master_teacher" || value === "master-teacher" || value === "masterteacher") return "master_teacher";
  if (value === "teacher" || value === "faculty") return "teacher";
  if (value === "student") return "student";
  return null;
};

const parseGradeFilter = (label: string): number | undefined => {
  if (label === "All Grades") return undefined;
  const match = /(\d+)/.exec(label.trim());
  if (!match) {
    return undefined;
  }
  const value = Number.parseInt(match[1], 10);
  return Number.isNaN(value) ? undefined : value;
};

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  return String(value).trim() || null;
}

function normalizeIsoTimestamp(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  const parsed = new Date(value as string);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  try {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return "Invalid Date";
    }

    return parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  } catch {
    return "Invalid Date";
  }
}

function buildFullName(record: any): string | null {
  const first = toStringOrNull(record.firstName ?? record.first_name);
  const middle = toStringOrNull(record.middleName ?? record.middle_name);
  const last = toStringOrNull(record.lastName ?? record.last_name);
  const combined = `${first ?? ""} ${middle ?? ""} ${last ?? ""}`.replace(/\s+/g, " ").trim();
  if (combined.length > 0) {
    return combined;
  }

  const nameCandidate = toStringOrNull(record.name ?? record.fullName ?? record.full_name);
  if (nameCandidate) {
    return nameCandidate;
  }

  const username = toStringOrNull(record.username);
  if (username) {
    return username;
  }

  const email = toStringOrNull(record.email ?? record.user_email);
  if (email) {
    return email;
  }

  const userId = record.userId ?? record.user_id;
  if (userId !== null && userId !== undefined) {
    return `User ${userId}`;
  }

  return "Unknown User";
}

function normalizeArchiveRecord(record: any): ArchiveEntry {
  const archiveId = record.archiveId ?? record.archive_id ?? 0;
  const userId = record.userId ?? record.user_id ?? null;
  const roleKey = normalizeRoleKey(record.role ?? record.roleKey);
  const roleLabel = record.roleLabel ?? record.role ?? "Unknown";
  const archivedIso = normalizeIsoTimestamp(record.archivedDate ?? record.timestamp ?? record.archived_at ?? null);
  const archivedDisplay = formatTimestamp(archivedIso);
  const email = toStringOrNull(record.email ?? record.user_email ?? record.contactEmail);
  const contactNumber = toStringOrNull(
    record.contactNumber ??
      record.contact_number ??
      record.contactNo ??
      record.phoneNumber ??
      record.phone_number ??
      record.phone ??
      record.mobile
  );
  const grade = record.grade != null ? toStringOrNull(record.grade) : null;
  const section = record.section != null ? toStringOrNull(record.section) : null;

  return {
    ...record,
    archiveId,
    userId,
    principalId: toStringOrNull(record.principalId ?? record.user_code ?? record.userCode) ?? undefined,
    masterTeacherId: toStringOrNull(record.masterTeacherId ?? record.master_teacher_id ?? record.user_code ?? record.userCode) ?? undefined,
    teacherId: toStringOrNull(record.teacherId ?? record.teacher_id ?? record.user_code ?? record.userCode) ?? undefined,
    roleKey,
    roleLabel,
    name: buildFullName(record),
    middleName: toStringOrNull(record.middleName ?? record.middle_name) ?? undefined,
    email: email ?? undefined,
    reason: toStringOrNull(record.reason) ?? undefined,
    archivedDate: archivedIso,
    archivedDateDisplay: archivedDisplay,
    coordinatorHandledGrades: Array.isArray(record.coordinatorHandledGrades) ? record.coordinatorHandledGrades : undefined,
    coordinatorHandledSubjects: Array.isArray(record.coordinatorHandledSubjects) ? record.coordinatorHandledSubjects : undefined,
    remedialHandledSubjects: Array.isArray(record.remedialHandledSubjects) ? record.remedialHandledSubjects : undefined,
    handledGrades: Array.isArray(record.handledGrades) ? record.handledGrades : undefined,
    grade,
    section,
    contactNumber: contactNumber ?? null,
    phoneNumber: toStringOrNull(record.phoneNumber ?? record.phone_number ?? record.contact_number) ?? undefined,
  };
}

export default function ITAdminArchive() {
  const [activeTab, setActiveTab] = useState<string>("All Grades");
  const [accountType, setAccountType] = useState<AccountOption>("Super Admin");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [archiveRecords, setArchiveRecords] = useState<ArchiveEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleArchiveRemoval = useCallback((removedArchiveIds: number[]) => {
    if (!removedArchiveIds || removedArchiveIds.length === 0) {
      return;
    }
    setArchiveRecords((prev) => prev.filter((entry) => !removedArchiveIds.includes(entry.archiveId)));
  }, []);

  const showGradeDropdown = useMemo(() => {
    return accountType === "Master Teachers" || accountType === "Teachers";
  }, [accountType]);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const fetchArchive = async () => {
      setIsLoading(true);
      setError(null);
      try {
  const response = await fetch("/api/super_admin/archive", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = await response.json();
        if (!isActive) return;
        const records: ArchiveEntry[] = (payload.records ?? []).map((record: any) => normalizeArchiveRecord(record));
        setArchiveRecords(records);
      } catch (err) {
        if (!isActive) return;
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load archived accounts.");
        setArchiveRecords([]);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchArchive();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, []);

  const handleAccountTypeChange = (next: string) => {
    const selected = ACCOUNT_OPTIONS.find((option) => option === next) ?? ACCOUNT_OPTIONS[0];
    setAccountType(selected);
    if (!(selected === "Master Teachers" || selected === "Teachers")) {
      setActiveTab("All Grades");
    }
  };

  const handleGradeChange = (next: string) => {
    const selected = GRADE_OPTIONS.find((option) => option === next) ?? GRADE_OPTIONS[0];
    setActiveTab(selected);
  };

  useEffect(() => {
    const roleKey = ACCOUNT_TYPE_TO_ROLE[accountType];
    const filtered = archiveRecords.filter((entry) => entry.roleKey === roleKey);
    setAccounts(filtered);
  }, [accountType, archiveRecords]);

  return (
	<div className="flex h-screen bg-linear-to-br from-[#edf9f1] via-[#f5fbf7] to-[#e7f4ec] overflow-hidden">
	  {/*---------------------------------Sidebar---------------------------------*/}
	  <ITAdminSidebar />

	  {/*---------------------------------Main Content---------------------------------*/}
	  <div className="flex-1 pt-16 flex flex-col overflow-hidden">
		<ITAdminHeader title="Archive" />
		<main className="flex-1">
		  <div className="p-4 h-full sm:p-5 md:p-6">
			{/*---------------------------------Main Container---------------------------------*/}
      <div className="relative h-full min-h-[400px] overflow-y-auto rounded-2xl border border-white/70 bg-white/45 p-4 shadow-[0_14px_38px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-5 md:p-6">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex items-center gap-0">
                  <HeaderDropdown
                    options={[...ACCOUNT_OPTIONS]}
                    value={accountType}
                    onChange={handleAccountTypeChange}
                  />
                  {showGradeDropdown ? (
                    <>
                      <SecondaryHeader title="in" />
                      <HeaderDropdown
                        options={[...GRADE_OPTIONS]}
                        value={activeTab}
                        onChange={handleGradeChange}
                        className="pl-2"
                      />
                    </>
                  ) : (
                    <SecondaryHeader title="Accounts" />
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0">
                  <div className="relative flex-1 sm:flex-initial">
                    <input
                      type="text"
                      placeholder={`Search ${accountType.toLowerCase()}...`}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 pr-10 text-black"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        onClick={() => setSearchTerm("")}
                      >
                        <FaTimes />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/*---------------------------------Tab Content---------------------------------*/}
              {isLoading && (
                <p className="text-sm text-gray-500">Loading archived accounts…</p>
              )}
              {!isLoading && error && (
                <p className="text-sm text-red-600" role="alert">{error}</p>
              )}
              <div className="mt-4 sm:mt-6">
                {accountType === "Super Admin" && (
                  <ITAdminArchiveTab
                    itAdmins={accounts}
                    setItAdmins={setAccounts}
                    searchTerm={searchTerm}
                    onEntriesRemoved={handleArchiveRemoval}
                  />
                )}

                {accountType === "Principal" && (
                  <PrincipalTab
                    principals={accounts}
                    setPrincipals={setAccounts}
                    searchTerm={searchTerm}
                    onEntriesRemoved={handleArchiveRemoval}
                  />
                )}

                {accountType === "Master Teachers" && (
                  <MasterTeacherTab
                    teachers={accounts}
                    setTeachers={setAccounts}
                    searchTerm={searchTerm}
                    gradeFilter={parseGradeFilter(activeTab)}
                    gradeLabel={activeTab}
                    onEntriesRemoved={handleArchiveRemoval}
                  />
                )}
                
                {accountType === "Teachers" && (
                  <TeacherArchiveTab
                    teachers={accounts}
                    setTeachers={setAccounts}
                    searchTerm={searchTerm}
                    gradeFilter={parseGradeFilter(activeTab)}
                    gradeLabel={activeTab}
                    onEntriesRemoved={handleArchiveRemoval}
                  />
                )}
              </div>
			</div>
		  </div>
		</main>
	  </div>
	</div>
  );
}
