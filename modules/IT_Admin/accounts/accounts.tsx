"use client";
import Sidebar from "@/components/IT_Admin/Sidebar";
import Header from "@/components/IT_Admin/Header";
import { useCallback, useEffect, useState } from "react";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import HeaderDropdown from "@/components/Common/GradeNavigation/HeaderDropdown";
import { FaTimes } from "react-icons/fa";
// Teacher Tab
import TeacherTab from "./TeacherTab/TeacherTab";
// Master Teacher Tab
import MasterTeacherTab from "./MasterTeacherTab/MasterTeacherTab";
// IT Admin Tab
import ITAdminTab from "./ITAdminTab/ITAdminTab";
// Principal Tab
import PrincipalTab from "./PrincipalTab/PrincipalTab";
import type { AccountType } from "./components/AccountActionsMenu";

type ApiRole = "admin" | "principal" | "master_teacher" | "teacher";

const ACCOUNT_TYPE_TO_ROLE: Record<AccountType, ApiRole> = {
  "IT Admin": "admin",
  Principal: "principal",
  "Master Teachers": "master_teacher",
  Teachers: "teacher",
};

const NAME_COLLATOR = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const parseGradeFilter = (label: string): number | undefined => {
  const match = /^Grade\s+(\d+)$/i.exec(label.trim());
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
  const str = String(value).trim();
  return str.length > 0 ? str : null;
}

function toDigitsOrNull(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  let digits = String(value).replace(/\D/g, "");
  if (digits.length === 0) {
    return null;
  }

  if (digits.startsWith("63") && digits.length >= 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith("0") && digits.length >= 11) {
    digits = digits.slice(1);
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return digits.length > 0 ? digits : null;
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

function buildFullName(record: any): string {
  const nameCandidates = [
    record.name,
    record.fullName,
    record.full_name,
  ];

  for (const candidate of nameCandidates) {
    const value = toStringOrNull(candidate);
    if (value) {
      return value;
    }
  }

  const first = toStringOrNull(record.firstName ?? record.first_name);
  const last = toStringOrNull(record.lastName ?? record.last_name);
  const combined = `${first ?? ""} ${last ?? ""}`.trim();
  if (combined.length > 0) {
    return combined;
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

function normalizeAccountRecord(record: any) {
  const userId = record.userId ?? record.user_id ?? null;
  const normalized: any = {
    ...record,
    userId,
  };

  normalized.name = buildFullName(record);
  normalized.email = toStringOrNull(record.email ?? record.user_email);
  const contactValue = record.contactNumber ??
    record.contact_number ??
    record.contactNo ??
    record.contact_no ??
    record.phone ??
    record.phoneNumber ??
    record.phone_number ??
    record.mobile ??
    record.user_contact_number ??
    record.user_phone_number ??
    null;

  normalized.contactNumber = toStringOrNull(contactValue);
  normalized.contactNumberRaw = toDigitsOrNull(contactValue);
  normalized.contactNumberLocal =
    normalized.contactNumberRaw && normalized.contactNumberRaw.length === 10
      ? `0${normalized.contactNumberRaw}`
      : normalized.contactNumber;
  normalized.status = toStringOrNull(record.status) ?? "Active";
  normalized.grade = record.grade != null ? String(record.grade) : null;
  normalized.section = record.section != null ? String(record.section) : null;
  normalized.school = toStringOrNull(record.school);
  normalized.lastLogin = record.lastLogin ?? null;
  normalized.lastLoginDisplay = formatTimestamp(record.lastLogin);

  if (userId !== null && userId !== undefined) {
    const userIdString = String(userId);
    normalized.adminId = toStringOrNull(record.adminId) ?? userIdString;
    normalized.principalId = toStringOrNull(record.principalId) ?? userIdString;
    normalized.masterTeacherId = toStringOrNull(record.masterTeacherId) ?? userIdString;
  } else {
    normalized.adminId = toStringOrNull(record.adminId);
    normalized.principalId = toStringOrNull(record.principalId);
    normalized.masterTeacherId = toStringOrNull(record.masterTeacherId);
  }

  const teacherIdSource =
    toStringOrNull(record.teacherId) ??
    normalized.masterTeacherId ??
    (userId !== null && userId !== undefined ? String(userId) : null);

  normalized.teacherId = teacherIdSource;

  return normalized;
}

function sortAccounts(records: any[]) {
  return [...records].sort((a, b) => {
    const nameA = toStringOrNull(a.name);
    const nameB = toStringOrNull(b.name);

    if (nameA && nameB) {
      const cmp = NAME_COLLATOR.compare(nameA, nameB);
      if (cmp !== 0) {
        return cmp;
      }
    } else if (nameA) {
      return -1;
    } else if (nameB) {
      return 1;
    }

    const idA = typeof a.userId === "number" ? a.userId : Number.parseInt(String(a.userId ?? 0), 10) || 0;
    const idB = typeof b.userId === "number" ? b.userId : Number.parseInt(String(b.userId ?? 0), 10) || 0;
    return idA - idB;
  });
}

export default function ITAdminAccounts() {
  const [activeTab, setActiveTab] = useState("All Grades");
  const [accountType, setAccountType] = useState<AccountType>("IT Admin");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccountTypeChange = useCallback((value: string) => {
    setAccountType(value as AccountType);
  }, []);

  useEffect(() => {
    const role = ACCOUNT_TYPE_TO_ROLE[accountType];
    if (!role) {
      setAccounts([]);
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    const fetchAccounts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const endpoint = accountType === "IT Admin"
          ? "/api/it_admin/accounts/it_admin"
          : `/api/it_admin/accounts?role=${role}`;

        const response = await fetch(endpoint, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const payload = await response.json();
        if (!isActive) return;
        const normalizedRecords = (payload.records ?? []).map((record: any) => normalizeAccountRecord(record));
        const sortedRecords = sortAccounts(normalizedRecords);
        setAccounts(sortedRecords);
      } catch (err) {
        if (!isActive) return;
        if ((err as Error).name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Unable to load accounts.");
        setAccounts([]);
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    fetchAccounts();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [accountType]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      {/*---------------------------------Sidebar---------------------------------*/}
      <Sidebar />

      {/*---------------------------------Main Content---------------------------------*/}
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <Header title="Accounts" />
        <main className="flex-1">
          <div className="p-4 h-full sm:p-5 md:p-6">
            {/*---------------------------------Main Container---------------------------------*/}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div className="flex items-center gap-0">
                  <HeaderDropdown
                    options={["IT Admin", "Principal", "Master Teachers", "Teachers"]}
                    value={accountType}
                    onChange={handleAccountTypeChange}
                  />
                  {(accountType === "IT Admin" || accountType === "Principal") ? (
                    <SecondaryHeader title="Accounts" />
                  ) : (
                    <>
                      <SecondaryHeader title="in" />
                      <HeaderDropdown
                        options={["All Grades", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"]}
                        value={activeTab}
                        onChange={setActiveTab}
                        className="pl-2"
                      />
                    </>
                  )}
                </div>
                <div className="flex gap-3 w-full sm:w-auto mt-4 sm:mt-0 items-center justify-end">
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
                <p className="text-sm text-gray-500">Loading accounts…</p>
              )}
              {!isLoading && error && (
                <p className="text-sm text-red-600" role="alert">{error}</p>
              )}
              <div className="mt-4 sm:mt-6">
                {accountType === "IT Admin" && (
                  <ITAdminTab itAdmins={accounts} setITAdmins={setAccounts} searchTerm={searchTerm} />
                )}

                {accountType === "Principal" && (
                  <PrincipalTab principals={accounts} setPrincipals={setAccounts} searchTerm={searchTerm} />
                )}

                {accountType === "Master Teachers" && (
                  <MasterTeacherTab
                    teachers={accounts}
                    setTeachers={setAccounts}
                    searchTerm={searchTerm}
                  />
                )}
                {accountType === "Teachers" && (
                  <TeacherTab
                    teachers={accounts}
                    setTeachers={setAccounts}
                    searchTerm={searchTerm}
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