"use client";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import { useArchiveMaterials } from "@/modules/MasterTeacher/useArchiveMaterials";

type ArchiveItem = {
  id: number;
  title: string;
  phonemic: string;
  dateToUse: string;
};

type MaterialItem = {
  id: number;
  title: string;
  dateAttached: string;
};

const INITIAL_ARCHIVE: readonly ArchiveItem[] = [];

export default function EnglishSyllableArchive() {
  const { archiveItems, restoreItem } = useArchiveMaterials<ArchiveItem, MaterialItem>({
    subject: "English",
    category: "Syllable",
    initialArchive: INITIAL_ARCHIVE,
    mapToMaterial: (item) => ({
      id: item.id,
      title: item.title,
      dateAttached: item.dateToUse,
    }),
  });

  return (
    <div>
      {/* Remedial Table Section */}
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
        <p className="text-gray-600 text-md font-medium">
  Total: {archiveItems.length}
        </p>
        <div className="flex gap-2"></div>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Title" },
          { key: "phonemic", title: "Phonemic" },
          { key: "dateToUse", title: "Date Archived" },
        ]}
        data={archiveItems.map((remedial, idx) => ({
          ...remedial,
          no: idx + 1,
        }))}
        actions={(row: ArchiveItem) => (
          <UtilityButton small onClick={() => restoreItem(row.id)}>Restore</UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}


