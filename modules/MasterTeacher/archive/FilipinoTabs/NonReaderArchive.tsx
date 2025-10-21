"use client";
import UtilityButton from "@/components/Common/Buttons/UtilityButton";
import TableList from "@/components/Common/Tables/TableList";
import { useArchiveMaterials } from "../hooks/useArchiveMaterials";

type ArchiveItem = {
  id: number;
  title: string;
  phonemic: string;
  dateToUse: string;
};

type MaterialItem = {
  id: number;
  title: string;
  phonemic: string;
  dateAttached: string;
};

const INITIAL_ARCHIVE: readonly ArchiveItem[] = [
  {
    id: 1,
    title: "Aralin 1 - Katinig",
    phonemic: "Non-Reader",
    dateToUse: "2024-06-01",
  },
  {
    id: 2,
    title: "Aralin 2 - Patinig",
    phonemic: "Non-Reader",
    dateToUse: "2024-06-02",
  },
  {
    id: 3,
    title: "Aralin 3 - Pantig",
    phonemic: "Non-Reader",
    dateToUse: "2024-06-03",
  },
];

export default function FilipinoNonReaderArchive() {
  const { archiveItems, restoreItem } = useArchiveMaterials<ArchiveItem, MaterialItem>({
    subject: "Filipino",
    category: "Non Reader",
    initialArchive: INITIAL_ARCHIVE,
    mapToMaterial: (item) => ({
      id: item.id,
      title: item.title,
      phonemic: item.phonemic,
      dateAttached: item.dateToUse,
    }),
  });

  return (
    <div>
      <div className="flex flex-row justify-between items-center mb-4 sm:mb-6 md:mb-2">
        <p className="text-gray-600 text-md font-medium">
          Kabuuan: {archiveItems.length}
        </p>
      </div>
      <TableList
        columns={[
          { key: "no", title: "No#" },
          { key: "title", title: "Pamagat" },
          { key: "phonemic", title: "Phonemic" },
          { key: "dateToUse", title: "Date Archived" },
        ]}
        data={archiveItems.map((remedial, idx) => ({ ...remedial, no: idx + 1 }))}
        actions={(row: ArchiveItem) => (
          <UtilityButton small onClick={() => restoreItem(row.id)}>Restore</UtilityButton>
        )}
        pageSize={10}
      />
    </div>
  );
}
