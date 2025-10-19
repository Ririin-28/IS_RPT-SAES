import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

export type ArchiveActionType = "restore" | "delete";

type KeySelector<T> = (item: T) => string | undefined;

type UseArchiveRestoreDeleteOptions<T> = {
  keySelector: KeySelector<T>;
  onRestore?: (selectedKeys: string[], reset: () => void) => void;
  onDelete?: (selectedKeys: string[], reset: () => void) => void;
};

export function useArchiveRestoreDelete<T>(
  setItems: Dispatch<SetStateAction<T[]>>,
  { keySelector, onRestore, onDelete }: UseArchiveRestoreDeleteOptions<T>
) {
  const [action, setAction] = useState<ArchiveActionType | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const reset = () => {
    setAction(null);
    setSelectedKeys(new Set());
    setRestoreModalOpen(false);
    setDeleteModalOpen(false);
  };

  const enterAction = (type: ArchiveActionType) => {
    setAction(type);
    setSelectedKeys(new Set());
    setRestoreModalOpen(false);
    setDeleteModalOpen(false);
  };

  const cancelSelection = () => {
    reset();
  };

  const toggleItem = (key: string | number, checked: boolean) => {
    const stringKey = String(key);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(stringKey);
      } else {
        next.delete(stringKey);
      }
      return next;
    });
  };

  const toggleAll = (keys: Array<string | number>, checked: boolean) => {
    if (!checked) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(keys.map((key) => String(key))));
  };

  const requestConfirmation = () => {
    if (!action || selectedKeys.size === 0) return;
    if (action === "restore") {
      setRestoreModalOpen(true);
    } else {
      setDeleteModalOpen(true);
    }
  };

  const removeSelected = (keys: Set<string>) => {
    setItems((prev) =>
      prev.filter((item) => {
        const key = keySelector(item);
        if (key === undefined) return true;
        return !keys.has(String(key));
      })
    );
  };

  const confirmRestore = () => {
    if (selectedKeys.size === 0) return;
    if (onRestore) {
      onRestore(Array.from(selectedKeys), reset);
    } else {
      removeSelected(selectedKeys);
      reset();
    }
  };

  const confirmDelete = () => {
    if (selectedKeys.size === 0) return;
    if (onDelete) {
      onDelete(Array.from(selectedKeys), reset);
    } else {
      removeSelected(selectedKeys);
      reset();
    }
  };

  const selectedCount = useMemo(() => selectedKeys.size, [selectedKeys]);

  return {
    action,
    selectMode: action !== null,
    selectedKeys,
    selectedCount,
    enterAction,
    cancelSelection,
    toggleItem,
    toggleAll,
    requestConfirmation,
    restoreModalOpen,
    deleteModalOpen,
    setRestoreModalOpen,
    setDeleteModalOpen,
    confirmRestore,
    confirmDelete,
  };
}
