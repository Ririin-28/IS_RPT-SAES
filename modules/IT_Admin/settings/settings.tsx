"use client";
import { useRef, useState, useEffect, ChangeEvent } from "react";
import ITAdminSidebar from "@/components/IT_Admin/Sidebar";
import ITAdminHeader from "@/components/IT_Admin/Header";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";

const retentionOptions = ["7", "14", "30", "60", "90"] as const;
const scheduleOptions = ["daily", "weekly"] as const;
type RetentionOption = (typeof retentionOptions)[number];
type ScheduleOption = (typeof scheduleOptions)[number];
type ExportFormat = "sql" | "csv";

export default function SystemConfiguration() {
  const [databaseEditing, setDatabaseEditing] = useState(false);
  const [backupEditing, setBackupEditing] = useState(false);
  const [themeEditing, setThemeEditing] = useState(false);
  const [landingEditing, setLandingEditing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [backupSettings, setBackupSettings] = useState({
    autoBackup: true,
    schedule: "daily" as ScheduleOption,
    retentionDays: "30" as RetentionOption,
    exportFormat: "sql" as ExportFormat,
  });

  const [themeSettings, setThemeSettings] = useState({
    systemName: "SAES Portal",
    welcomeMessage: "Welcome to our school portal",
    primaryColor: "#013300",
    accentColor: "#0f766e",
    backgroundColor: "#ffffff",
    logoFile: null as File | null,
  });

  const [contactDetails, setContactDetails] = useState({
    address: "",
    phone: "",
    email: "",
    facebook: "",
  });

  const [landingAssets, setLandingAssets] = useState({
    carouselFiles: [] as File[],
    privacyPolicyFile: null as File | null,
  });

  const [publishedLandingAssets, setPublishedLandingAssets] = useState({
    carouselUrls: [] as string[],
    privacyPolicyName: "RPT-SAES_Privacy-Policy.docx",
    logoUrl: "",
  });

  const [backups, setBackups] = useState<{ id: string; label: string }[]>([]);
  const [selectedBackupId, setSelectedBackupId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState("");
  const [carouselPreviews, setCarouselPreviews] = useState<string[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const privacyPolicyInputRef = useRef<HTMLInputElement>(null);

  const lastBackupDisplay = backups.length > 0 ? backups[0].label : "Never";
  const accentColorNote = "Used for secondary buttons and highlights";

  const fileTriggerClasses = (disabled: boolean) =>
    `cursor-pointer rounded-lg border border-green-200 bg-white px-3 py-2 text-sm text-[#013300] transition hover:bg-green-50 focus:outline-none focus:ring-2 focus:ring-[#013300] ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

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
  const handleBackupCancel = () => setBackupEditing(false);
  const handleBackupSave = () => {
    setBackupEditing(false);
    setStatusMessage("Backup settings saved successfully");
  };
  const handleBackupNow = () => {
    setStatusMessage("Manual backup initiated...");
  };
  const handleRestore = () => {
    if (selectedBackupId) {
      setStatusMessage(`Restoring backup: ${selectedBackupId}`);
    }
  };
  const handleBackupExport = () => {
    setStatusMessage("Exporting backup for migration...");
  };
  const handleImportSubmit = () => {
    if (importFile) {
      setStatusMessage(`Importing backup file: ${importFile.name}`);
    }
  };

  // Theme section handlers
  const handleThemeEdit = () => setThemeEditing(true);
  const handleThemeCancel = () => setThemeEditing(false);
  const handleThemeSave = () => {
    setThemeEditing(false);
    setStatusMessage("Theme settings saved successfully");
  };

  const handleLogoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setThemeSettings(prev => ({ ...prev, logoFile: file }));
      const previewUrl = URL.createObjectURL(file);
      setLogoPreviewUrl(previewUrl);
    }
  };

  // Landing section handlers
  const handleLandingEdit = () => setLandingEditing(true);
  const handleLandingCancel = () => setLandingEditing(false);
  const handleLandingSave = () => {
    setLandingEditing(false);
    setStatusMessage("Landing page configuration saved successfully");
  };

  const handleCarouselChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setLandingAssets(prev => ({ ...prev, carouselFiles: files }));
      const previewUrls = files.map(file => URL.createObjectURL(file));
      setCarouselPreviews(previewUrls);
    }
  };

  const handlePrivacyPolicyChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLandingAssets(prev => ({ ...prev, privacyPolicyFile: file }));
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
      if (logoPreviewUrl) URL.revokeObjectURL(logoPreviewUrl);
      carouselPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [logoPreviewUrl, carouselPreviews]);

  return (
    <div className="flex h-screen bg-gray-50">
      <ITAdminSidebar />
      <div className="flex flex-1 flex-col">
        <ITAdminHeader title="Settings" />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-[5.5rem] sm:px-6 md:pt-24">
          <div className="mx-auto max-w-7xl">
            <form className="bg-white rounded-lg shadow-md border border-gray-200 h-full min-h-[400px] overflow-y-auto p-4 sm:p-6">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <SecondaryHeader title="System Configuration" />
              </div>

              {statusMessage && (
                <div className="mt-3 rounded-md border border-green-200 bg-green-50 px-4 py-2 text-sm text-[#013300]">
                  {statusMessage}
                </div>
              )}

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
                      {themeSettings.logoFile && (
                        <span className="text-xs text-gray-600 truncate max-w-[160px]">
                          {themeSettings.logoFile.name}
                        </span>
                      )}
                    </div>
                    {!themeSettings.logoFile && (
                      <span className="text-xs text-gray-400">No file selected yet.</span>
                    )}
                  </div>
                </div>

                {publishedLandingAssets.logoUrl && (
                  <div className="mt-4 flex flex-col text-sm text-[#013300] gap-1">
                    <span>Currently published logo</span>
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-green-100 bg-white shadow-sm">
                        <img
                          src={publishedLandingAssets.logoUrl}
                          alt="Published logo"
                          className="h-full w-full object-contain p-2"
                        />
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
                        {themeSettings.logoFile ? "Logo" : "SA"}
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
                    {publishedLandingAssets.carouselUrls.length > 0 && (
                      <div className="mt-4">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[#013300]">
                          Live carousel
                        </span>
                        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {publishedLandingAssets.carouselUrls.map((url, index) => (
                            <div
                              key={`published-${url}-${index}`}
                              className={`overflow-hidden rounded-lg border border-green-100 bg-white shadow-sm ${
                                index === 0 ? "ring-2 ring-[#0f766e]" : ""
                              }`}
                            >
                              <img src={url} alt={`Published carousel ${index + 1}`} className="h-32 w-full object-cover" />
                              <div className="border-t border-green-50 px-3 py-2">
                                <span className="block text-xs text-gray-500">
                                  {index === 0 ? "Lead slide" : `Slide ${index + 1}`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {carouselPreviews.map((url, index) => (
                          <div
                            key={`${url}-${index}`}
                            className="overflow-hidden rounded-lg border border-green-100 bg-white shadow-sm"
                          >
                            <img src={url} alt={`Carousel preview ${index + 1}`} className="h-32 w-full object-cover" />
                            <div className="border-t border-green-50 px-3 py-2">
                              <span className="block truncate text-xs text-gray-600">
                                {landingAssets.carouselFiles[index]?.name}
                              </span>
                            </div>
                          </div>
                        ))}
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
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}