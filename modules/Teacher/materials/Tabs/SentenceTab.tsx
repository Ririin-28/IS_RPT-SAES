"use client";
import { useState, useRef, useEffect } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import DangerButton from "@/components/Common/Buttons/DangerButton";
import SecondaryHeader from "@/components/Common/Texts/SecondaryHeader";
import TableList from "@/components/Common/Tables/TableList";
import SecondaryButton from "@/components/Common/Buttons/SecondaryButton";
import KebabMenu from "@/components/Common/Menus/KebabMenu";
import FilterDropdown from "@/components/Common/Inputs/FilterDropdown";

interface MaterialsTabProps {
  selectedSubject?: string;
}

export default function SentenceTab({ selectedSubject = "All Subjects" }: MaterialsTabProps) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [selectedMaterials, setSelectedMaterials] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = ['.docx', '.doc', '.xlsx', '.xls'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validTypes.includes(fileExtension)) {
      alert('Please upload only Word (.docx, .doc) or Excel (.xlsx, .xls) files');
      return;
    }

    const newMaterial = {
      id: Date.now(),
      title: file.name,
      dateAttached: new Date().toLocaleDateString(),
      subject: selectedSubject !== "All Subjects" ? selectedSubject : "Unassigned"
    };

    setMaterials([...materials, newMaterial]);
    alert(`File "${file.name}" uploaded successfully!`);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = (id: number) => {
    setMaterials(materials.filter((m) => m.id !== id));
  };

  const handleDeleteAll = () => {
    setMaterials([]);
  };

  const handleSelectMaterial = (id: number, checked: boolean) => {
    const newSelected = new Set(selectedMaterials);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedMaterials(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMaterials(new Set(filteredMaterials.map(m => m.id)));
    } else {
      setSelectedMaterials(new Set());
    }
  };

  // Outside clicks handled by KebabMenu

  const handleEnterSelectMode = () => {
    setSelectMode(true);
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelectedMaterials(new Set());
  };

  const handleDeleteSelected = () => {
    if (selectedMaterials.size === 0) return;
    setMaterials(materials.filter(m => !selectedMaterials.has(m.id)));
    setSelectedMaterials(new Set());
    setSelectMode(false);
  };

  const filteredMaterials = selectedSubject !== "All Subjects"
    ? materials.filter((material) => (material.subject ?? "Unassigned") === selectedSubject)
    : materials;

  useEffect(() => {
    setSelectedMaterials((prev) => {
      const visibleIds = new Set(filteredMaterials.map((material) => material.id));
      let changed = false;
      const next = new Set<number>();
      prev.forEach((id) => {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      if (!changed && next.size === prev.size) {
        return prev;
      }
      return next;
    });
  }, [filteredMaterials]);

  return (
    <div>
      <div
        className="
        /* Mobile */
        flex flex-row justify-between items-center mb-4
        /* Tablet */
        sm:mb-6
        /* Desktop */
        md:mb-2
      "
      >
  <p className="text-gray-600 text-md font-medium">Total: {filteredMaterials.length}</p>
        <div className="flex items-center gap-3">
          {selectMode ? (
            <>
              <SecondaryButton small onClick={handleCancelSelect}>
                Cancel
              </SecondaryButton>
              {selectedMaterials.size > 0 && (
                <>
              <DangerButton small onClick={handleDeleteSelected} className="flex items-center gap-1">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
                Delete ({selectedMaterials.size})
              </DangerButton>
                </>
              )}
            </>
          ) : (
            <KebabMenu
              small
              align="right"
              renderItems={(close) => (
                <div className="py-1">
                  <button
                    onClick={() => {
                      fileInputRef.current?.click();
                      close();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="m17 8-5-5-5 5" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    </svg>
                    Upload File
                  </button>
                  <button
                    onClick={() => {
                      handleEnterSelectMode();
                      close();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[#013300] hover:bg-gray-50 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Select
                  </button>
                </div>
              )}
            />
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No." },
          { key: "title", title: "Title" },
          { key: "gradeSection", title: "Grade" },
          { key: "teacher", title: "Teacher" },
          { key: "dateAttached", title: "Date Attached" },
        ]}
        data={filteredMaterials.map((material, idx) => ({
          ...material,
          no: idx + 1,
        }))}
        actions={(row: any) => (
          <UtilityButton small>View Details</UtilityButton>
        )}
        selectable={selectMode}
        selectedItems={selectedMaterials}
        onSelectAll={handleSelectAll}
        onSelectItem={handleSelectMaterial}
        pageSize={10}
      />
    </div>
  );
}