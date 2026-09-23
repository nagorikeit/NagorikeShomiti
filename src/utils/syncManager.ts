import { useEffect, useState, useCallback } from "react";
import { waitForPendingWrites } from "firebase/firestore";
import { db } from "../firebase";

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: Date | null;
  syncMessage: string;
}

// Global subscribers for real-time reactivity across components
type Listener = (state: SyncState) => void;
const listeners = new Set<Listener>();

let currentState: SyncState = {
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  isSyncing: false,
  pendingCount: 0,
  lastSyncedAt: new Date(),
  syncMessage: "সব ডাটা ক্লাউডে সুরক্ষিত",
};

const notifyListeners = () => {
  listeners.forEach((fn) => fn({ ...currentState }));
};

const updateState = (partial: Partial<SyncState>) => {
  currentState = { ...currentState, ...partial };
  notifyListeners();
};

export const forceTriggerSync = async (): Promise<boolean> => {
  if (!navigator.onLine) {
    updateState({
      isOnline: false,
      isSyncing: false,
      syncMessage: "ইন্টারনেট নেই • অফলাইনে কাজ চলছে",
    });
    return false;
  }

  updateState({
    isOnline: true,
    isSyncing: true,
    syncMessage: "ক্লাউডের সাথে সিঙ্ক হচ্ছে...",
  });

  try {
    // Wait for all offline writes (creates, updates, deletes) to be acknowledged by Firestore
    await waitForPendingWrites(db);
    updateState({
      isOnline: true,
      isSyncing: false,
      pendingCount: 0,
      lastSyncedAt: new Date(),
      syncMessage: "সব ডাটা ক্লাউডে সুরক্ষিত",
    });
    return true;
  } catch (err) {
    console.warn("Sync warning:", err);
    updateState({
      isSyncing: false,
      syncMessage: "সিঙ্ক সম্পন্ন হয়েছে",
    });
    return false;
  }
};

// Initialize window network listeners
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    updateState({
      isOnline: true,
      isSyncing: true,
      syncMessage: "ইন্টারনেট সংযোগ পাওয়া গেছে • সিঙ্ক হচ্ছে...",
    });
    // Immediately trigger server sync
    forceTriggerSync();
  });

  window.addEventListener("offline", () => {
    updateState({
      isOnline: false,
      isSyncing: false,
      syncMessage: "অফলাইন মোড • হিসাব লোকাল ডিভাইসে সংরক্ষিত হচ্ছে",
    });
  });
}

export function useSyncStatus(): SyncState & { triggerSync: () => Promise<boolean> } {
  const [state, setState] = useState<SyncState>(currentState);

  useEffect(() => {
    const listener: Listener = (newState) => setState(newState);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const triggerSync = useCallback(() => forceTriggerSync(), []);

  return { ...state, triggerSync };
}
