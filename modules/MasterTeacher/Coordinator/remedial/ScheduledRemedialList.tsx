"use client";

import { useMemo } from "react";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";

export type RemedialEntry = {
  id: number;
  title: string;
  time: string;
  date: string;
};

type Props = {
  remedials: RemedialEntry[];
  showPlayButton: boolean;
  playPath?: string;
  allowSeeAll?: boolean;
  allowFlashcardEdit?: boolean;
  inlineEditable: boolean;
  editingId: number | null;
  draft: RemedialEntry | null;
  onStartEdit: (id: number) => void;
  onCancelEdit: () => void;
  onUpdateDraft: (key: keyof RemedialEntry, value: string) => void;
  onSave: () => void;
  onOpenFlashcardEdit: () => void;
};

const getWeekNumber = (dateStr: string): number => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0;
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

export default function ScheduledRemedialList({
  remedials,
  showPlayButton,
  playPath,
  allowSeeAll,
  allowFlashcardEdit,
  inlineEditable,
  editingId,
  draft,
  onStartEdit,
  onCancelEdit,
  onUpdateDraft,
  onSave,
  onOpenFlashcardEdit,
}: Props) {
  const groupedSchedule = useMemo(() => {
    const grouped: Record<string, { weekNumber: number; year: number; items: RemedialEntry[] }> = {};
    
    remedials.forEach((remedial) => {
      const date = new Date(remedial.date);
      const weekNumber = getWeekNumber(remedial.date);
      const year = isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
      const key = `${year}-W${weekNumber}`;
      if (!grouped[key]) {
        grouped[key] = { weekNumber, year, items: [] };
      }
      grouped[key].items.push(remedial);
    });

    return Object.values(grouped)
      .sort((a, b) => (a.year === b.year ? a.weekNumber - b.weekNumber : a.year - b.year))
      .map((entry) => ({
        label: `Week ${entry.weekNumber}, ${entry.year}`,
        remedials: entry.items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
      }));
  }, [remedials]);

  if (remedials.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center border border-dashed border-gray-300 rounded-xl bg-gray-50">
        <p className="text-gray-500 font-medium">No scheduled remedial activities.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto pr-2 pb-10 custom-scrollbar">
      <div className="space-y-8">
        {groupedSchedule.map((group) => (
          <div key={group.label} className="space-y-3">
            <h3 className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm py-2 text-xs font-bold text-gray-400 uppercase tracking-widest px-1 border-b border-gray-100">
              {group.label}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {group.remedials.map((remedial, index) => {
                const dateObj = new Date(remedial.date);
                const month = isNaN(dateObj.getTime()) ? "---" : dateObj.toLocaleDateString("en-PH", { month: "short" });
                const day = isNaN(dateObj.getTime()) ? "--" : dateObj.toLocaleDateString("en-PH", { day: "numeric" });
                const weekday = isNaN(dateObj.getTime()) ? "---" : dateObj.toLocaleDateString("en-PH", { weekday: "short" });
                const isEditing = editingId === remedial.id;

                return (
                  <div
                    key={remedial.id}
                    className="group flex flex-row items-center justify-between w-full bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg hover:border-[#013300]/30 transition-all duration-300"
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      {/* Date Box */}
                      <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-14 bg-[#013300]/5 text-[#013300] rounded-lg border border-[#013300]/10">
                        <span className="text-[0.65rem] font-bold uppercase tracking-wide leading-none">{month}</span>
                        <span className="text-xl font-extrabold leading-none mt-0.5">{day}</span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[0.65rem] font-medium text-gray-400 uppercase">
                            {weekday}
                          </span>
                        </div>
                        
                        {isEditing && draft ? (
                          <div className="space-y-2">
                             <input
                              value={draft.title}
                              onChange={(e) => onUpdateDraft("title", e.target.value)}
                              className="w-full rounded-md border border-gray-300 px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                              placeholder="Title"
                            />
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={draft.date}
                                onChange={(e) => onUpdateDraft("date", e.target.value)}
                                className="w-1/2 rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-700"
                              />
                               <input
                                type="time"
                                value={draft.time}
                                onChange={(e) => onUpdateDraft("time", e.target.value)}
                                className="w-1/2 rounded-md border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-green-700"
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="text-sm font-bold text-gray-900 truncate leading-tight transition-colors">
                              {remedial.title}
                            </h4>
                            
                            {remedial.time && (
                              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {remedial.time}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex-shrink-0 flex gap-2">
                      {isEditing ? (
                        <>
                          <UtilityButton small onClick={onSave} className="!py-1.5 !px-3">Save</UtilityButton>
                          <UtilityButton small onClick={onCancelEdit} className="bg-white text-[#013300] border-[#013300] hover:bg-gray-100 !py-1.5 !px-3">Cancel</UtilityButton>
                        </>
                      ) : (
                        <>
                          {showPlayButton && (
                            <a href={`${playPath}?start=${index}`}>
                              <UtilityButton small title="Click to play remedial session" className="!py-1.5 !px-3">Play</UtilityButton>
                            </a>
                          )}
                          {allowSeeAll && <UtilityButton small className="!py-1.5 !px-3">See All</UtilityButton>}
                          {allowFlashcardEdit && (
                            <UtilityButton
                              small
                              className="bg-[#013300] hover:bg-green-900 !py-1.5 !px-3"
                              onClick={onOpenFlashcardEdit} title="Click to edit remedial contents">
                              Edit
                            </UtilityButton>
                          )}
                          {inlineEditable && (
                            <UtilityButton small onClick={() => onStartEdit(remedial.id)} className="!py-1.5 !px-3">
                              Edit
                            </UtilityButton>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
