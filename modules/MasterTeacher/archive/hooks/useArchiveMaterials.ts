"use client";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

type WithId = {
  id: string | number;
  [key: string]: unknown;
};

type Collection = "archive" | "materials";

const STORAGE_PREFIX = "mt-materials";

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const buildKey = (subject: string, category: string, collection: Collection) =>
  `${STORAGE_PREFIX}:${slugify(subject)}:${slugify(category)}:${collection}`;

const readFromStorage = <T,>(key: string): T | null => {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    return JSON.parse(stored) as T;
  } catch (error) {
    console.warn(`Failed to parse storage for key ${key}`, error);
    return null;
  }
};

const writeToStorage = <T,>(key: string, value: T) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to write storage for key ${key}`, error);
  }
};

type UsePersistentListResult<T> = {
  items: T[];
  setItems: Dispatch<SetStateAction<T[]>>;
  hydrated: boolean;
};

const usePersistentList = <T extends WithId>(
  key: string,
  initialData: readonly T[]
): UsePersistentListResult<T> => {
  const initialRef = useRef(initialData.map((item) => ({ ...item })) as T[]);
  const [items, setItems] = useState<T[]>(initialRef.current);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = readFromStorage<T[]>(key);
    if (stored) {
      setItems(stored);
    } else {
      setItems(initialRef.current);
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    writeToStorage(key, items);
  }, [items, hydrated, key]);

  return { items, setItems, hydrated };
};

type UseArchiveMaterialsOptions<TArchive extends WithId, TMaterial extends WithId> = {
  subject: string;
  category: string;
  initialArchive: readonly TArchive[];
  initialMaterials?: readonly TMaterial[];
  mapToMaterial?: (item: TArchive) => TMaterial;
};

type UseArchiveMaterialsResult<TArchive extends WithId, TMaterial extends WithId> = {
  archiveItems: TArchive[];
  restoreItem: (id: TArchive["id"]) => void;
  restoreAll: () => void;
  setArchiveItems: Dispatch<SetStateAction<TArchive[]>>;
  hydrated: boolean;
};

export const useArchiveMaterials = <TArchive extends WithId, TMaterial extends WithId = TArchive>(
  { subject, category, initialArchive, initialMaterials = [], mapToMaterial }: UseArchiveMaterialsOptions<TArchive, TMaterial>
): UseArchiveMaterialsResult<TArchive, TMaterial> => {
  const archiveKey = buildKey(subject, category, "archive");
  const materialsKey = buildKey(subject, category, "materials");

  const {
    items: archiveItems,
    setItems: setArchiveItems,
    hydrated: archiveHydrated,
  } = usePersistentList<TArchive>(archiveKey, initialArchive);

  const {
    items: materialItems,
    setItems: setMaterials,
    hydrated: materialsHydrated,
  } = usePersistentList<TMaterial>(materialsKey, initialMaterials);

  const mapItem = useCallback(
    (item: TArchive): TMaterial => {
      if (mapToMaterial) {
        return mapToMaterial(item);
      }
      return item as unknown as TMaterial;
    },
    [mapToMaterial]
  );

  const restoreItem = useCallback(
    (id: TArchive["id"]) => {
      let restored: TArchive | undefined;
      setArchiveItems((prev) => {
        const index = prev.findIndex((entry) => String(entry.id) === String(id));
        if (index === -1) return prev;
        const next = [...prev];
        [restored] = next.splice(index, 1);
        return next;
      });

      if (!restored) return;

      const materialCandidate = mapItem(restored);
      setMaterials((prev) => {
        const exists = prev.some((entry) => String(entry.id) === String(materialCandidate.id));
        if (exists) return prev;
        return [...prev, materialCandidate];
      });
    },
    [mapItem, setArchiveItems, setMaterials]
  );

  const restoreAll = useCallback(() => {
    setArchiveItems((prev) => {
      if (prev.length === 0) return prev;
      const mapped = prev.map((entry) => mapItem(entry));
      setMaterials((materials) => {
        const existingIds = new Set(materials.map((entry) => String(entry.id)));
        const additions = mapped.filter((entry) => !existingIds.has(String(entry.id)));
        if (additions.length === 0) return materials;
        return [...materials, ...additions];
      });
      return [];
    });
  }, [mapItem, setArchiveItems, setMaterials]);

  return {
    archiveItems,
    restoreItem,
    restoreAll,
    setArchiveItems,
    hydrated: archiveHydrated && materialsHydrated,
  };
};

type UseMaterialsListOptions<TMaterial extends WithId> = {
  subject: string;
  category: string;
  initialMaterials?: readonly TMaterial[];
};

type UseMaterialsListResult<TMaterial extends WithId> = {
  materials: TMaterial[];
  setMaterials: Dispatch<SetStateAction<TMaterial[]>>;
  hydrated: boolean;
};

export const useMaterialsList = <TMaterial extends WithId>({
  subject,
  category,
  initialMaterials = [],
}: UseMaterialsListOptions<TMaterial>): UseMaterialsListResult<TMaterial> => {
  const materialsKey = buildKey(subject, category, "materials");
  const { items, setItems, hydrated } = usePersistentList<TMaterial>(materialsKey, initialMaterials);
  return { materials: items, setMaterials: setItems, hydrated };
};
