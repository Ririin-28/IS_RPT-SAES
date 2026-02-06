"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { FaCloudUploadAlt, FaSpinner, FaEye } from "react-icons/fa";
import PrimaryButton from "@/components/Common/Buttons/PrimaryButton";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import { getStoredUserProfile } from "@/lib/utils/user-profile";
import BaseModal from "@/components/Common/Modals/BaseModal";
import type { CalendarActivity } from "./ScheduledActivitiesList";

interface PhonemicLevel {
  phonemic_id: number;
  level_name: string;
}

interface MaterialGridModalProps {
  isOpen: boolean;
  onClose: () => void;
  activity: CalendarActivity;
  subject: string;
}

interface LevelStatus {
  level: PhonemicLevel;
  material: any | null;
  uploading: boolean;
}

export default function MaterialGridModal({ isOpen, onClose, activity, subject }: MaterialGridModalProps) {
  const [levels, setLevels] = useState<LevelStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [targetLevelId, setTargetLevelId] = useState<number | null>(null);

  // Memoized load function to handle both initial load and quiet refreshes
  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    
    try {
      const profile = getStoredUserProfile();
      const teacherUserId = profile?.userId || "UNKNOWN";

      const [levelsRes, materialsRes] = await Promise.all([
        fetch(`/api/subject-levels?subject=${subject}`),
        fetch(`/api/remedial-materials?requestId=${activity.id}&submittedBy=${teacherUserId}`)
      ]);

      const levelsData = await levelsRes.json();
      const materialsData = await materialsRes.json();

      if (!levelsRes.ok) throw new Error(levelsData.error || "Failed to load levels");
      if (!materialsRes.ok) throw new Error(materialsData.error || "Failed to load materials");

      const mappedLevels: LevelStatus[] = levelsData.levels.map((level: PhonemicLevel) => ({
        level,
        material: materialsData.materials.find((m: any) => m.phonemic_id === level.phonemic_id) || null,
        uploading: false
      }));

      setLevels(mappedLevels);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [activity.id, subject]);

  useEffect(() => {
    if (isOpen) {
      void loadData(true);
    }
  }, [isOpen, loadData]);

  const handleUploadClick = (levelId: number) => {
    setTargetLevelId(levelId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || targetLevelId === null) return;

    // Set ONLY the specific item to uploading state
    setLevels(prev => prev.map(l => l.level.phonemic_id === targetLevelId ? { ...l, uploading: true } : l));

    try {
      const formData = new FormData();
      formData.append("files", file);

      const uploadRes = await fetch("/api/materials/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) throw new Error(uploadData.error || "Upload failed");

      const uploadedFile = uploadData.files[0];
      const profile = getStoredUserProfile();
      const teacherUserId = profile?.userId || "UNKNOWN";

      const saveRes = await fetch("/api/remedial-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: activity.id,
          phonemicId: targetLevelId,
          fileName: uploadedFile.fileName,
          filePath: uploadedFile.storagePath,
          submittedBy: String(teacherUserId),
        }),
      });

      if (!saveRes.ok) throw new Error("Failed to save material record");

      // Quietly refresh just the data
      await loadData(false);
    } catch (err: any) {
      alert(err.message);
      // Reset uploading state on error
      setLevels(prev => prev.map(l => l.level.phonemic_id === targetLevelId ? { ...l, uploading: false } : l));
    } finally {
      setTargetLevelId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemove = async (materialId: number) => {
    if (!confirm("Are you sure you want to remove this material?")) return;
    
    try {
      const res = await fetch(`/api/remedial-materials?id=${materialId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove material");
      
      await loadData(false);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const modalFooter = (
    <div className="flex gap-2">
      <SecondaryButton onClick={onClose}>Close</SecondaryButton>
      <PrimaryButton onClick={onClose} disabled={levels.every(l => !l.material)}>Done</PrimaryButton>
    </div>
  );

  return (
    <BaseModal
      show={isOpen}
      onClose={onClose}
      title="Upload Materials"
      maxWidth="2xl"
      footer={modalFooter}
    >
      <div className="space-y-6">
        {/* Activity Details Header */}
        <div className="flex justify-between items-center text-sm text-[#013300]/90 font-bold uppercase tracking-wider border-b border-gray-100 pb-3">
            <span>Title: <span className="text-[#013300]">{activity.title}</span></span>
            <span>Subject: <span className="text-[#013300]">{subject}</span></span>
        </div>
        <p className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[10px] italic font-semibold">i</span>
          <span>Max file size: 10MB per file.</span>
        </p>

        {/* Level List Table */}
        <div className="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-widest border-b border-gray-200">
              <tr>
                <th className="px-5 py-3">Phonemic Level</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-gray-400">
                    <FaSpinner className="animate-spin inline-block mr-2 text-[#013300]" />
                    <span className="text-sm font-medium">Loading details...</span>
                  </td>
                </tr>
              ) : levels.map(({ level, material, uploading }) => (
                <tr key={level.phonemic_id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <span className="font-extrabold text-base text-[#013300] block leading-tight">
                        {level.level_name}
                    </span>
                    {material && (
                      <p className="text-xs text-gray-500 truncate max-w-[200px] font-medium mt-1" title={material.file_name}>
                        {material.file_name}
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    {uploading ? (
                      <div className="flex justify-center flex-col items-center gap-1">
                        <FaSpinner className="animate-spin text-[#013300]" />
                        <span className="text-[10px] uppercase font-bold text-[#013300]">Saving</span>
                      </div>
                    ) : material ? (
                      <span className={`inline-block px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider
                        ${material.status === 'Approved' ? 'bg-green-100 text-green-700' : 
                          material.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {material.status}
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded text-[10px] font-black uppercase tracking-wider">
                        Missing
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {material ? (
                      <div className="flex justify-end gap-2">
                        <UtilityButton small onClick={() => {
                          const absoluteUrl = /^https?:\/\//i.test(material.file_path)
                            ? material.file_path
                            : `${window.location.origin}${material.file_path.startsWith("/") ? "" : "/"}${material.file_path}`;
                          const isOfficeFile = /\.(docx|doc|pptx|ppt|xlsx|xls)$/i.test(material.file_path);
                          if (isOfficeFile) {
                            window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`, '_blank');
                          } else {
                            window.open(absoluteUrl, '_blank');
                          }
                        }} className="!px-4 !py-1.5 font-bold">
                          View
                        </UtilityButton>
                        <DangerButton small onClick={() => handleRemove(material.material_id)} className="!px-4 !py-1.5 font-bold" disabled={uploading}>
                          Remove
                        </DangerButton>
                      </div>
                    ) : (
                      <PrimaryButton 
                        small 
                        onClick={() => handleUploadClick(level.phonemic_id)}
                        className="!px-6 !py-2"
                      >
                        Upload
                      </PrimaryButton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <input 
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png"
        />
      </div>
    </BaseModal>
  );
}
