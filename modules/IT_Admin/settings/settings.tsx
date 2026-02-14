"use client";
import Image from "next/image";
import { useRef, useState, useEffect, useMemo, useCallback, ChangeEvent } from "react";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import ITAdminHeader from "@/components/IT_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import {
  getDefaultLandingConfig,
  type ThemeSettings,
  type ContactDetails,
  type CarouselImage,
} from "@/lib/utils/landing-config";

const retentionOptions = ["7", "14", "30", "60", "90"] as const;
const scheduleOptions = ["daily", "weekly"] as const;
type RetentionOption = (typeof retentionOptions)[number];
type ScheduleOption = (typeof scheduleOptions)[number];
type ExportFormat = "sql" | "csv";

const formatShortDate = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Unable to process file"));
    reader.readAsDataURL(file);
  });

const generateCarouselId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `carousel-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const formatBackupLabel = (timestamp: Date) => {
  const date = timestamp.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
  const time = timestamp.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Backup - ${date} ${time}`;
};

export default function SystemConfiguration() {
  const [databaseEditing, setDatabaseEditing] = useState(false);
  const [backupEditing, setBackupEditing] = useState(false);
  const [themeEditing, setThemeEditing] = useState(false);
  const [landingEditing, setLandingEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const defaultLandingConfig = useMemo(() => getDefaultLandingConfig(), []);

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    schedule: "daily" as ScheduleOption,
    retentionDays: "30" as RetentionOption,
    exportFormat: "sql" as ExportFormat,
  });

  const [appliedTheme, setAppliedTheme] = useState<ThemeSettings>(() => ({ ...defaultLandingConfig.theme }));
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => ({ ...defaultLandingConfig.theme }));

  const [publishedContactDetails, setPublishedContactDetails] = useState<ContactDetails>(() => ({
    ...defaultLandingConfig.contact,
  }));
  const [contactDetails, setContactDetails] = useState<ContactDetails>(() => ({
    ...defaultLandingConfig.contact,
  }));

  const [landingAssets, setLandingAssets] = useState({
    carouselFiles: [] as File[],
    privacyPolicyFile: null as File | null,
  });

  const [backups, setBackups] = useState<{ id: string; label: string }[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [carouselPreviews, setCarouselPreviews] = useState<string[]>([]);
  const [publishedLandingAssets, setPublishedLandingAssets] = useState({
    carouselImages: defaultLandingConfig.carouselImages.map((image) => ({ ...image })),
    privacyPolicyName: defaultLandingConfig.privacyPolicyName,
  });
  const [carouselDraft, setCarouselDraft] = useState<CarouselImage[]>(() =>
    defaultLandingConfig.carouselImages.map((image) => ({ ...image }))
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const privacyPolicyInputRef = useRef<HTMLInputElement>(null);
  const [isLandingLoading, setIsLandingLoading] = useState(false);

  const lastBackupDisplay = backups.length > 0 ? backups[0].label : "Never";
  const accentColorNote = "Used for secondary buttons and highlights";

  const fileTriggerClasses = (disabled: boolean) =>
    `cursor-pointer rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-[#013300] transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-[#013300] ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

  const liveCarousel = landingEditing ? carouselDraft : publishedLandingAssets.carouselImages;

  const parseStoredAsset = (value: string | null | undefined) => {
    if (!value) return null;
    if (typeof value !== "string") return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && typeof parsed.dataUrl === "string") {
        return {
          dataUrl: parsed.dataUrl as string,
          name: typeof parsed.name === "string" ? parsed.name : null,
        } as const;
      }
    } catch (error) {
      // Treat value as plain string path or data URL.
    }
    return {
      dataUrl: value,
      name: null,
    } as const;
  };

  const formatTimestamp = (input?: string | Date | null) => {
    if (!input) {
      return formatShortDate(new Date());
    }
    const candidate = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(candidate.getTime())) {
      return formatShortDate(new Date());
    }
    return formatShortDate(candidate);
  };

  const loadLandingConfiguration = useCallback(async () => {
    setIsLandingLoading(true);
    try {
      const response = await fetch("/api/it_admin/landing");
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }
      const payload = await response.json();
      const data = payload?.data ?? {};

      const fallbackCarousel = defaultLandingConfig.carouselImages.map((image) => ({ ...image }));
      const carouselRows: unknown[] = Array.isArray(data.carouselImages) ? data.carouselImages : [];
      const mappedCarousel: CarouselImage[] = carouselRows.length
        ? carouselRows.map((row: any) => {
            const parsed = parseStoredAsset(row?.image ?? row?.dataUrl ?? "");
            const rawName =
              parsed?.name ??
              row?.name ??
              (typeof row?.image === "string" ? row.image.split(/[\\/]/).pop() : undefined) ??
              `Carousel-${row?.id ?? generateCarouselId()}`;
            return {
              id: String(row?.id ?? generateCarouselId()),
              url: parsed?.dataUrl ?? row?.image ?? "",
              name: rawName,
              uploadedAt: formatTimestamp(row?.createdAt ?? row?.created_at ?? null),
            };
          })
        : fallbackCarousel;

      const logoAsset = parseStoredAsset(data?.logo?.logo ?? null);
      setAppliedTheme((prev) => ({
        ...prev,
        logoUrl: logoAsset?.dataUrl ?? prev.logoUrl ?? defaultLandingConfig.theme.logoUrl,
        logoFileName: logoAsset?.name ?? prev.logoFileName ?? defaultLandingConfig.theme.logoFileName ?? null,
      }));
      setThemeSettings((prev) => ({
        ...prev,
        logoUrl: logoAsset?.dataUrl ?? prev.logoUrl ?? defaultLandingConfig.theme.logoUrl,
        logoFileName: logoAsset?.name ?? prev.logoFileName ?? defaultLandingConfig.theme.logoFileName ?? null,
      }));
      setLogoPreviewUrl("");
      setLogoFile(null);

      const details = data?.saesDetails;
      const fallbackContact = defaultLandingConfig.contact;
      const nextContact: ContactDetails = {
        address: details?.location ?? fallbackContact.address,
        phone: details?.contact_no ?? fallbackContact.phone,
        email: details?.email ?? fallbackContact.email,
        facebook: details?.facebook ?? fallbackContact.facebook,
      };
      setPublishedContactDetails(nextContact);
      setContactDetails(nextContact);

      const privacyAsset = parseStoredAsset(data?.privacyPolicy?.file ?? null);
      const privacyName =
        privacyAsset?.name ??
        data?.privacyPolicy?.fileName ??
        (typeof data?.privacyPolicy?.file === "string" ? data.privacyPolicy.file : undefined) ??
        defaultLandingConfig.privacyPolicyName;

      setPublishedLandingAssets({
        carouselImages: mappedCarousel.map((image) => ({ ...image })),
        privacyPolicyName: privacyName,
      });
      setCarouselDraft(mappedCarousel.map((image) => ({ ...image })));
      setLandingAssets({ carouselFiles: [], privacyPolicyFile: null });
      setCarouselPreviews([]);

      if (payload?.message) {
        setStatusMessage(payload.message);
      }
    } catch (error) {
      console.error("Failed to load landing configuration", error);
      setStatusMessage("Unable to load landing configuration. Using default values.");
      setAppliedTheme({ ...defaultLandingConfig.theme });
      setThemeSettings({ ...defaultLandingConfig.theme });
      setPublishedContactDetails({ ...defaultLandingConfig.contact });
      setContactDetails({ ...defaultLandingConfig.contact });
      setPublishedLandingAssets({
        carouselImages: defaultLandingConfig.carouselImages.map((image) => ({ ...image })),
        privacyPolicyName: defaultLandingConfig.privacyPolicyName,
      });
      setCarouselDraft(defaultLandingConfig.carouselImages.map((image) => ({ ...image })));
    } finally {
      setIsLandingLoading(false);
    }
  }, [defaultLandingConfig]);

  useEffect(() => {
    loadLandingConfiguration();
  }, [loadLandingConfiguration]);

  // Database section handlers
  const handleDatabaseEdit = () => setDatabaseEditing(true);
  const handleDatabaseCancel = () => setDatabaseEditing(false);
  const handleDatabaseSave = () => {
    setDatabaseEditing(false);
    setStatusMessage("Database configuration updated successfully");
  };
  const handleDatabaseExport = () => {
    setStatusMessage("Database export started...");
  };

  // Backup section handlers
  const handleBackupEdit = () => setBackupEditing(true);
  const handleBackupCancel = () => {
    setBackupEditing(false);
  };
  const handleBackupSave = () => {
    setBackupEditing(false);
    setStatusMessage("Backup preferences updated successfully");
  };
  const handleBackupNow = () => {
    const timestamp = new Date();
    const newBackup = {
      id: `manual-${timestamp.getTime()}`,
      label: formatBackupLabel(timestamp),
    };
    setBackups((prev) => [newBackup, ...prev]);
    setSelectedBackupId(newBackup.id);
    setStatusMessage("Manual backup request queued successfully");
  };
  const handleRestore = () => {
    if (!selectedBackupId) {
      setStatusMessage("Select a backup point before restoring");
      return;
    }
    const selected = backups.find((backup) => backup.id === selectedBackupId);
    if (!selected) {
      setStatusMessage("Selected backup could not be found. Refresh the list and try again.");
      return;
    }
    setStatusMessage(`Restore started for ${selected.label}. You will be notified when it completes.`);
  };
  const handleBackupExport = () => {
    setStatusMessage(`Exporting backups as ${backupSettings.exportFormat.toUpperCase()}…`);
  };

  // Theme section handlers
  const handleThemeEdit = () => {
    setThemeSettings({ ...appliedTheme });
    setLogoPreviewUrl("");
    setLogoFile(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    setThemeEditing(true);
  };
  const handleThemeCancel = () => {
    setThemeSettings({ ...appliedTheme });
    setLogoPreviewUrl("");
    setLogoFile(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    setThemeEditing(false);
    setStatusMessage("Theme changes discarded");
  };
  const handleThemeSave = async () => {
    const nextLogoUrl = logoPreviewUrl || themeSettings.logoUrl || appliedTheme.logoUrl;
    const nextLogoFileName = logoFile?.name ?? themeSettings.logoFileName ?? appliedTheme.logoFileName ?? null;
    const nextTheme: ThemeSettings = {
      ...themeSettings,
      logoUrl: nextLogoUrl,
      logoFileName: nextLogoFileName,
    };
    setAppliedTheme({ ...nextTheme });
    setThemeSettings({ ...nextTheme });
    setLogoPreviewUrl("");
    setThemeEditing(false);

    if (logoFile) {
      try {
        const logoDataUrl = await fileToDataUrl(logoFile);
        const response = await fetch("/api/it_admin/landing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "updateLogo",
            logo: {
              name: logoFile.name,
              dataUrl: logoDataUrl,
            },
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to update logo");
        }
        await loadLandingConfiguration();
        setStatusMessage("Theme settings and logo saved successfully");
      } catch (error) {
        console.error("Unable to update logo", error);
        setStatusMessage("Theme settings saved, but uploading the new logo failed. Please try again.");
      } finally {
        setLogoFile(null);
        if (logoInputRef.current) {
          logoInputRef.current.value = "";
        }
      }
    } else {
      setStatusMessage("Theme settings saved successfully");
    }
  };

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setLogoFile(null);
      return;
    }
    try {
      const previewUrl = await fileToDataUrl(file);
      setThemeSettings((prev) => ({ ...prev, logoUrl: previewUrl, logoFileName: file.name }));
      setLogoPreviewUrl(previewUrl);
      setLogoFile(file);
    } catch (error) {
      console.warn("Unable to preview logo", error);
      setStatusMessage("Unable to process the selected logo. Please try a different file.");
      setLogoFile(null);
    }
  };

  // Landing section handlers
  const handleLandingEdit = () => {
    setContactDetails({ ...publishedContactDetails });
    setCarouselDraft(publishedLandingAssets.carouselImages.map((image) => ({ ...image })));
    setLandingAssets({ carouselFiles: [], privacyPolicyFile: null });
    setCarouselPreviews([]);
    setLandingEditing(true);
  };
  const handleLandingCancel = () => {
    setCarouselPreviews([]);
    setLandingAssets({ carouselFiles: [], privacyPolicyFile: null });
    setContactDetails({ ...publishedContactDetails });
    setCarouselDraft(publishedLandingAssets.carouselImages.map((image) => ({ ...image })));
    if (carouselInputRef.current) {
      carouselInputRef.current.value = "";
    }
    if (privacyPolicyInputRef.current) {
      privacyPolicyInputRef.current.value = "";
    }
    setLandingEditing(false);
    setStatusMessage("Landing configuration changes discarded");
  };
  const handleLandingSave = async () => {
    setStatusMessage("Saving landing page configuration...");
    try {
      const existingIds = publishedLandingAssets.carouselImages
        .map((image) => Number(image.id))
        .filter((id) => Number.isFinite(id));
      const draftIds = carouselDraft
        .map((image) => Number(image.id))
        .filter((id) => Number.isFinite(id));
      const removedIds = existingIds.filter((id) => !draftIds.includes(id));
      const keepIds = draftIds;

      const newImages = await Promise.all(
        landingAssets.carouselFiles.map(async (file, index) => {
          const previewUrl = carouselPreviews[index] ?? (await fileToDataUrl(file));
          return {
            name: file.name,
            dataUrl: previewUrl,
          };
        })
      );

      const privacyPolicyPayload = landingAssets.privacyPolicyFile
        ? {
            name: landingAssets.privacyPolicyFile.name,
            dataUrl: await fileToDataUrl(landingAssets.privacyPolicyFile),
          }
        : null;

      const response = await fetch("/api/it_admin/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "updateLanding",
          contact: {
            location: contactDetails.address,
            contactNo: contactDetails.phone,
            email: contactDetails.email,
            facebook: contactDetails.facebook,
          },
          carousel: {
            keepIds,
            removedIds,
            newImages,
          },
          privacyPolicy: privacyPolicyPayload,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`);
      }

      setStatusMessage("Landing page configuration saved successfully");
      setLandingAssets({ carouselFiles: [], privacyPolicyFile: null });
      setCarouselPreviews([]);
      setLandingEditing(false);
      if (carouselInputRef.current) {
        carouselInputRef.current.value = "";
      }
      if (privacyPolicyInputRef.current) {
        privacyPolicyInputRef.current.value = "";
      }
      await loadLandingConfiguration();
    } catch (error) {
      console.error("Failed to save landing configuration", error);
      setStatusMessage("Unable to save landing configuration. Please try again.");
    }
  };

  const handleCarouselChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      const previewUrls = await Promise.all(files.map((file) => fileToDataUrl(file)));
      setLandingAssets((prev) => ({ ...prev, carouselFiles: files }));
      setCarouselPreviews(previewUrls);
    } catch (error) {
      console.warn("Unable to process carousel images", error);
      setStatusMessage("Some carousel images could not be processed. Please try again.");
    }
  };

  const handleRemovePublishedCarousel = (imageId: string) => {
    if (!landingEditing) return;
    setCarouselDraft((prev) => prev.filter((image) => image.id !== imageId));
    setStatusMessage("Carousel image removed. Save changes to publish.");
  };

  const handleRemovePendingCarousel = (index: number) => {
    if (!landingEditing) return;
    setLandingAssets((prev) => {
      const updatedFiles = [...prev.carouselFiles];
      updatedFiles.splice(index, 1);
      return { ...prev, carouselFiles: updatedFiles };
    });
    setCarouselPreviews((prev) => {
      const updatedPreviews = [...prev];
      updatedPreviews.splice(index, 1);
      return updatedPreviews;
    });
  };

  const handlePrivacyPolicyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLandingAssets((prev) => ({ ...prev, privacyPolicyFile: file }));
    }
  };
  const handleImportSubmit = () => {
    if (!importFile) {
      setStatusMessage("Choose a backup file to import before submitting.");
      return;
    }
    setStatusMessage(`Imported ${importFile.name}. It will appear in the restore list once processed.`);
    setImportFile(null);
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  // Initialize with sample data
  useEffect(() => {
    setBackups([
      { id: "1", label: "Backup - Today, 02:30 AM" },
      { id: "2", label: "Backup - Yesterday, 02:30 AM" },
    ]);
    setSelectedBackupId("1");
  }, []);

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (logoPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
      carouselPreviews.forEach((preview) => {
        if (preview.startsWith("blob:")) {
          URL.revokeObjectURL(preview);
        }
      });
    };
  }, [logoPreviewUrl, carouselPreviews]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <ITAdminSidebar />
      <div className="flex-1 pt-16 flex flex-col overflow-hidden">
        <ITAdminHeader title="Settings" />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 h-full sm:p-5 md:p-6">
            <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-5 md:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <SecondaryHeader title="System Configuration" />
              </div>

              {statusMessage && (
                <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-[#013300]">
                  {statusMessage}
                </div>
              )}

              {/*
              <section className="mt-6 rounded-lg border border-green-100 bg-green-50/60 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#013300]">Database Configuration &amp; Maintenance</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Need a full copy of the production database? Export the latest snapshot whenever change freeze windows open.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!databaseEditing ? (
                      <SecondaryButton type="button" small onClick={handleDatabaseEdit}>
                        Edit
                      </SecondaryButton>
                    ) : (
                      <>
                        <SecondaryButton type="button" small onClick={handleDatabaseCancel}>
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton type="button" small onClick={handleDatabaseSave}>
                          Finish editing
                        </PrimaryButton>
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <PrimaryButton type="button" small onClick={handleDatabaseExport} disabled={!databaseEditing}>
                    Export database
                  </PrimaryButton>
                </div>
              </section>

              <section className="mt-6 rounded-lg border border-green-100 bg-green-50/60 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#013300]">Backup &amp; Recovery</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Protect the platform from data loss. Start a backup, schedule automatic runs, or restore when needed.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!backupEditing ? (
                      <SecondaryButton type="button" small onClick={handleBackupEdit}>
                        Edit
                      </SecondaryButton>
                    ) : (
                      <>
                        <SecondaryButton type="button" small onClick={handleBackupCancel}>
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton type="button" small onClick={handleBackupSave}>
                          Save changes
                        </PrimaryButton>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center justify-between gap-3 rounded-lg bg-white px-4 py-3 shadow-sm border border-green-100">
                    <span className="text-sm font-semibold text-[#013300]">
                      Automatic backups
                      <span className="block text-xs text-gray-500 font-normal">Runs backups in the background.</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[#013300]"
                      checked={backupSettings.autoBackup}
                      onChange={(event) =>
                        setBackupSettings((prev) => ({ ...prev, autoBackup: event.target.checked }))
                      }
                      disabled={!backupEditing}
                    />
                  </label>

                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Backup schedule
                    <select
                      value={backupSettings.schedule}
                      onChange={(event) =>
                        setBackupSettings((prev) => ({
                          ...prev,
                          schedule: event.target.value as ScheduleOption,
                        }))
                      }
                      className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                      disabled={!backupEditing}
                    >
                      {scheduleOptions.map((option) => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Retention window
                    <select
                      value={backupSettings.retentionDays}
                      onChange={(event) =>
                        setBackupSettings((prev) => ({
                          ...prev,
                          retentionDays: event.target.value as RetentionOption,
                        }))
                      }
                      className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                      disabled={!backupEditing}
                    >
                      {retentionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option} days
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Export format
                    <select
                      value={backupSettings.exportFormat}
                      onChange={(event) =>
                        setBackupSettings((prev) => ({
                          ...prev,
                          exportFormat: event.target.value as ExportFormat,
                        }))
                      }
                      className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                      disabled={!backupEditing}
                    >
                      <option value="sql">SQL</option>
                      <option value="csv">CSV</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 rounded-lg border border-green-100 bg-white p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <span className="text-sm font-semibold text-[#013300]">Available backup points</span>
                    <span className="text-xs text-gray-500">Last backup: {lastBackupDisplay}</span>
                  </div>
                  <div className="mt-3 flex flex-col gap-2">
                    {backups.length === 0 && (
                      <span className="text-sm text-gray-500">No backups recorded yet.</span>
                    )}
                    {backups.map((backup) => (
                      <label
                        key={backup.id}
                        className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                          selectedBackupId === backup.id ? "border-[#013300] bg-green-50" : "border-green-100"
                        }`}
                      >
                        <input
                          type="radio"
                          name="backupPoint"
                          value={backup.id}
                          checked={selectedBackupId === backup.id}
                          onChange={(event) => setSelectedBackupId(event.target.value)}
                          className="accent-[#013300]"
                          disabled={!backupEditing}
                        />
                        <span className="flex-1 text-[#013300]">{backup.label}</span>
                      </label>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <PrimaryButton type="button" small onClick={handleBackupNow} disabled={!backupEditing}>
                      Run Manual Backup
                    </PrimaryButton>
                    <SecondaryButton type="button" small onClick={handleRestore} disabled={!backupEditing}>
                      Restore Selected Backup
                    </SecondaryButton>
                    <SecondaryButton type="button" small onClick={handleBackupExport} disabled={!backupEditing}>
                      Export for Migration
                    </SecondaryButton>
                  </div>
                </div>

                <div className="mt-4 rounded-lg border border-green-100 bg-white p-4">
                  <span className="text-sm font-semibold text-[#013300]">Import a backup file</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Accepts .zip, .sql, or .json exports. Uploading keeps the file ready for restore but does not run it automatically.
                  </p>
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div>
                      <input
                        ref={importInputRef}
                        id="backupImportInput"
                        type="file"
                        accept=".zip,.sql,.json"
                        onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                        className="hidden"
                        disabled={!backupEditing}
                      />
                      <label
                        htmlFor="backupImportInput"
                        className={fileTriggerClasses(!backupEditing)}
                        aria-disabled={!backupEditing}
                      >
                        Choose backup file
                      </label>
                    </div>
                    <SecondaryButton type="button" small onClick={handleImportSubmit} disabled={!backupEditing}>
                      Import Backup
                    </SecondaryButton>
                  </div>
                  <span className="mt-1 text-xs text-gray-500">
                    {importFile ? `Ready to import: ${importFile.name}` : "No file selected yet."}
                  </span>
                </div>
              </section>
              */}

              <section className="mt-6 rounded-lg border border-green-100 bg-green-50/60 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#013300]">System Theme Customization</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Adjust the primary brand elements shown on every landing page visit. Changes appear in the preview.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!themeEditing ? (
                      <SecondaryButton type="button" small onClick={handleThemeEdit}>
                        Edit
                      </SecondaryButton>
                    ) : (
                      <>
                        <SecondaryButton type="button" small onClick={handleThemeCancel}>
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton type="button" small onClick={handleThemeSave}>
                          Save changes
                        </PrimaryButton>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    System name
                    <input
                      type="text"
                      value={themeSettings.systemName}
                      onChange={(event) =>
                        setThemeSettings((prev) => ({ ...prev, systemName: event.target.value }))
                      }
                      className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                      placeholder="e.g. SAES Portal"
                      disabled={!themeEditing}
                    />
                  </label>
                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Welcome message
                    <input
                      type="text"
                      value={themeSettings.welcomeMessage}
                      onChange={(event) =>
                        setThemeSettings((prev) => ({ ...prev, welcomeMessage: event.target.value }))
                      }
                      className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                      placeholder="Short friendly greeting"
                      disabled={!themeEditing}
                    />
                  </label>

                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Primary colour
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={themeSettings.primaryColor}
                        onChange={(event) =>
                          setThemeSettings((prev) => ({ ...prev, primaryColor: event.target.value }))
                        }
                        className="h-10 w-16 rounded border border-green-200"
                        aria-label="Primary colour"
                        disabled={!themeEditing}
                      />
                      <span className="text-xs text-gray-600">{themeSettings.primaryColor}</span>
                    </div>
                  </label>

                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Accent colour
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={themeSettings.accentColor}
                        onChange={(event) =>
                          setThemeSettings((prev) => ({ ...prev, accentColor: event.target.value }))
                        }
                        className="h-10 w-16 rounded border border-green-200"
                        aria-label="Accent colour"
                        disabled={!themeEditing}
                      />
                      <span className="text-xs text-gray-600">{themeSettings.accentColor}</span>
                    </div>
                    <span className="text-xs text-gray-500 mt-1">{accentColorNote}</span>
                  </label>

                  <label className="flex flex-col text-sm text-[#013300] gap-1">
                    Background colour
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={themeSettings.backgroundColor}
                        onChange={(event) =>
                          setThemeSettings((prev) => ({ ...prev, backgroundColor: event.target.value }))
                        }
                        className="h-10 w-16 rounded border border-green-200"
                        aria-label="Background colour"
                        disabled={!themeEditing}
                      />
                      <span className="text-xs text-gray-600">{themeSettings.backgroundColor}</span>
                    </div>
                  </label>

                  <div className="flex flex-col text-sm text-[#013300] gap-1">
                    <span>Upload logo</span>
                    <div className="flex items-center gap-3">
                      <input
                        ref={logoInputRef}
                        id="landingLogoInput"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                        disabled={!themeEditing}
                      />
                      <label
                        htmlFor="landingLogoInput"
                        className={fileTriggerClasses(!themeEditing)}
                        aria-disabled={!themeEditing}
                      >
                        Browse image
                      </label>
                      {themeSettings.logoFileName && (
                        <span className="text-xs text-gray-600 truncate max-w-[160px]">
                          {themeSettings.logoFileName}
                        </span>
                      )}
                    </div>
                    {!themeSettings.logoFileName && (
                      <span className="text-xs text-gray-400">No file selected yet.</span>
                    )}
                  </div>
                </div>

                {appliedTheme.logoUrl && (
                  <div className="mt-4 flex flex-col text-sm text-[#013300] gap-1">
                    <span>Currently published logo</span>
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-green-100 bg-white shadow-sm">
                        <img src={appliedTheme.logoUrl} alt="Published logo" className="h-full w-full object-contain p-2" />
                      </div>
                      <span className="text-xs text-gray-500">Visible on the live landing page header.</span>
                    </div>
                  </div>
                )}

                {logoPreviewUrl && (
                  <div className="mt-4 flex flex-col text-sm text-[#013300] gap-1">
                    <span>Next upload preview</span>
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-green-100 bg-white shadow-sm">
                        <img src={logoPreviewUrl} alt="Selected logo" className="h-full w-full object-contain p-2" />
                      </div>
                      <span className="text-xs text-gray-500">Save changes to push this logo on the next deploy.</span>
                    </div>
                  </div>
                )}

                <div
                  className="mt-4 rounded-lg border border-green-100 bg-white p-4"
                  style={{ background: themeSettings.backgroundColor }}
                >
                  <span className="text-sm font-semibold text-[#013300]">Preview</span>
                  <p className="text-xs text-gray-600 mt-1">Shows the text and colours rendered on the landing page header.</p>
                  <div className="mt-4 rounded-lg border border-white/60 bg-white/70 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-12 w-12 rounded-lg border border-green-200 flex items-center justify-center text-xs font-semibold"
                        style={{ background: themeSettings.primaryColor, color: "#ffffff" }}
                      >
                        {logoPreviewUrl || appliedTheme.logoUrl ? "Logo" : "SA"}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-semibold" style={{ color: themeSettings.primaryColor }}>
                          {themeSettings.systemName || "System name"}
                        </span>
                        <span className="text-sm" style={{ color: themeSettings.accentColor }}>
                          {themeSettings.welcomeMessage || "Welcome message"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-6 rounded-lg border border-green-100 bg-green-50/60 p-4 sm:p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-[#013300]">Landing Page Configuration</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Keep the public site current: refresh carousel photos, contact information, and policy documents.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {!landingEditing ? (
                      <SecondaryButton type="button" small onClick={handleLandingEdit}>
                        Edit
                      </SecondaryButton>
                    ) : (
                      <>
                        <SecondaryButton type="button" small onClick={handleLandingCancel}>
                          Cancel
                        </SecondaryButton>
                        <PrimaryButton type="button" small onClick={handleLandingSave}>
                          Save changes
                        </PrimaryButton>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-4">
                  <div className="rounded-lg border border-green-100 bg-white p-4">
                    <h4 className="text-sm font-semibold text-[#013300]">Carousel images</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended size: 1600×900px (16:9). Larger images are automatically scaled but may impact load time.
                    </p>
                    <div className="mt-4">
                      <span className="text-xs font-semibold uppercase tracking-wide text-[#013300]">
                        Live carousel
                      </span>
                      {liveCarousel.length > 0 ? (
                        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {liveCarousel.map((image, index) => (
                            <figure
                              key={image.id}
                              className="group relative overflow-hidden rounded-2xl border border-green-100 bg-white shadow-md ring-1 ring-transparent transition hover:ring-[#0f766e]/50"
                            >
                              <img
                                src={image.url}
                                alt={`Carousel slide ${index + 1}`}
                                className="h-44 w-full object-cover transition duration-300 group-hover:scale-105"
                              />
                              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/0 to-transparent px-4 pb-4 pt-10 text-white">
                                <div className="space-y-0.5">
                                  <p className="text-sm font-semibold">
                                    {index === 0 ? "Lead slide" : `Slide ${index + 1}`}
                                  </p>
                                  <p className="text-xs text-white/80">{image.name}</p>
                                  <p className="text-[10px] uppercase tracking-wide text-white/60">Updated {image.uploadedAt}</p>
                                </div>
                                {landingEditing && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePublishedCarousel(image.id)}
                                    className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-[#013300] shadow-sm transition hover:bg-white"
                                    aria-label={`Remove ${image.name}`}
                                  >
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      width="18"
                                      height="18"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <polyline points="3 6 5 6 21 6" />
                                      <path d="M19 6v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                                      <path d="M10 11v6" />
                                      <path d="M14 11v6" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </figure>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-3 rounded-2xl border border-dashed border-green-200 bg-green-50/40 p-6 text-center text-sm text-gray-500">
                          No carousel images have been published yet.
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                      <div>
                        <input
                          ref={carouselInputRef}
                          id="carouselImagesInput"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleCarouselChange}
                          className="hidden"
                          disabled={!landingEditing}
                        />
                        <label
                          htmlFor="carouselImagesInput"
                          className={fileTriggerClasses(!landingEditing)}
                          aria-disabled={!landingEditing}
                        >
                          Upload images
                        </label>
                      </div>
                      <span className="text-xs text-gray-500">
                        Select multiple JPG or PNG files; the first image becomes the lead slide.
                      </span>
                    </div>
                    <span className="mt-2 text-xs text-gray-500">
                      {landingAssets.carouselFiles.length > 0
                        ? `${landingAssets.carouselFiles.length} image${landingAssets.carouselFiles.length > 1 ? "s" : ""} loaded for the carousel.`
                        : "No images selected yet."}
                    </span>
                    {carouselPreviews.length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#013300]">
                          Pending uploads
                        </span>
                        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {carouselPreviews.map((url, index) => (
                            <figure
                              key={`${url}-${index}`}
                              className="group relative overflow-hidden rounded-2xl border border-dashed border-green-200 bg-white shadow-sm"
                            >
                              <div className="relative h-44 w-full">
                                <Image
                                  src={url}
                                  alt={`Carousel preview ${index + 1}`}
                                  fill
                                  className="object-cover opacity-90 transition duration-300 group-hover:opacity-100"
                                  unoptimized
                                />
                              </div>
                              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 via-black/0 to-transparent px-4 pb-4 pt-10 text-white">
                                <div className="space-y-0.5">
                                  <p className="text-sm font-medium text-white">
                                    {landingAssets.carouselFiles[index]?.name ?? `Image ${index + 1}`}
                                  </p>
                                  <p className="text-[10px] uppercase tracking-wide text-white/70">Ready to upload</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePendingCarousel(index)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#013300] shadow-sm transition hover:bg-white"
                                  aria-label="Remove pending upload"
                                >
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
                                  >
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                  </svg>
                                </button>
                              </div>
                            </figure>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-green-100 bg-white p-4">
                    <h4 className="text-sm font-semibold text-[#013300]">Contact details</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      These values appear in the landing page footer so parents and teachers can reach the school.
                    </p>
                    <div className="mt-3 grid gap-3">
                      <label className="flex flex-col text-sm text-[#013300] gap-1">
                        Address
                        <textarea
                          value={contactDetails.address}
                          onChange={(event) =>
                            setContactDetails((prev) => ({ ...prev, address: event.target.value }))
                          }
                          rows={2}
                          className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                          disabled={!landingEditing}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-[#013300] gap-1">
                        Phone number
                        <input
                          type="text"
                          value={contactDetails.phone}
                          onChange={(event) =>
                            setContactDetails((prev) => ({ ...prev, phone: event.target.value }))
                          }
                          className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                          disabled={!landingEditing}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-[#013300] gap-1">
                        Email
                        <input
                          type="email"
                          value={contactDetails.email}
                          onChange={(event) =>
                            setContactDetails((prev) => ({ ...prev, email: event.target.value }))
                          }
                          className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                          disabled={!landingEditing}
                        />
                      </label>
                      <label className="flex flex-col text-sm text-[#013300] gap-1">
                        Facebook / Messenger link
                        <input
                          type="url"
                          value={contactDetails.facebook}
                          onChange={(event) =>
                            setContactDetails((prev) => ({ ...prev, facebook: event.target.value }))
                          }
                          className="rounded-lg border border-green-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#013300]"
                          placeholder="https://"
                          disabled={!landingEditing}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-green-100 bg-white p-4">
                    <h4 className="text-sm font-semibold text-[#013300]">Privacy policy document</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      Upload a replacement for the public privacy policy (accepts .pdf, .doc, .docx). The previous file is stored in <code>/public/RPT-SAES_Privacy-Policy.docx</code>.
                    </p>
                    <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-green-100 bg-green-50 px-3 py-1 text-xs text-[#013300]">
                      Current file: {publishedLandingAssets.privacyPolicyName ?? "Not uploaded"}
                    </span>
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div>
                        <input
                          ref={privacyPolicyInputRef}
                          id="privacyPolicyInput"
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handlePrivacyPolicyChange}
                          className="hidden"
                          disabled={!landingEditing}
                        />
                        <label
                          htmlFor="privacyPolicyInput"
                          className={fileTriggerClasses(!landingEditing)}
                          aria-disabled={!landingEditing}
                        >
                          Replace document
                        </label>
                      </div>
                    </div>
                    <span className="mt-2 text-xs text-gray-500">
                      {landingAssets.privacyPolicyFile
                        ? `Ready to upload: ${landingAssets.privacyPolicyFile.name}`
                        : "No document selected yet."}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}