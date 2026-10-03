import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getDocs,
  getDocsFromCache,
  getDoc,
  getDocFromCache,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2Ev5TIzRVC43duz-1vZFztJ6jYPD6528",
  authDomain: "nagorikeshomiti.firebaseapp.com",
  projectId: "nagorikeshomiti",
  storageBucket: "nagorikeshomiti.firebasestorage.app",
  messagingSenderId: "1033150392916",
  appId: "1:1033150392916:web:0d7bc99727c4f80e5ddbc1",
  measurementId: "G-4RHDJ7SZWP"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// COMMENT: Enable Firestore Offline Cache (Persistence) using IndexedDB
// This local cache retains read documents, lowering overall database read operations and facilitating rapid load times.
// If the environment blocks IndexedDB, it falls back smoothly to memory caching.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});

export const auth = getAuth(app);

const secondaryApp = getApps().find(a => a.name === "Secondary") || initializeApp(firebaseConfig, "Secondary");
export const secondaryAuth = getAuth(secondaryApp);

/**
 * Safely fetches Firestore documents with instant offline cache-first lookup
 * and network fallback with timeout. NEVER hangs indefinitely in offline or poor network.
 */
export async function safeGetDocs(queryOrRef: any, timeoutMs = 2500): Promise<any> {
  // 1. Try cache first - instant if cached (works offline & online)
  try {
    const cacheSnap = await getDocsFromCache(queryOrRef);
    if (cacheSnap && !cacheSnap.empty) {
      return cacheSnap;
    }
  } catch {
    // Cache miss or not cached yet, continue
  }

  // 2. If online, race getDocs against a timeout so it never hangs
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const snap = await Promise.race([
        getDocs(queryOrRef),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Network timeout")), timeoutMs)
        ),
      ]);
      return snap;
    } catch {
      // Network timeout or network error, fall through to cache
    }
  }

  // 3. Fallback to cache even if empty
  try {
    return await getDocsFromCache(queryOrRef);
  } catch {
    // If cache also fails, return an empty snapshot shape
    return {
      docs: [],
      empty: true,
      size: 0,
      forEach: () => {},
    } as any;
  }
}

/**
 * Safely fetches a single Firestore document with instant offline cache-first lookup
 * and network fallback with timeout. NEVER hangs indefinitely.
 */
export async function safeGetDoc(docRef: any, timeoutMs = 2500): Promise<any> {
  // 1. Try cache first
  try {
    const cacheSnap = await getDocFromCache(docRef);
    if (cacheSnap && cacheSnap.exists()) {
      return cacheSnap;
    }
  } catch {
    // Cache miss
  }

  // 2. If online, race getDoc against timeout
  if (typeof navigator === "undefined" || navigator.onLine) {
    try {
      const snap = await Promise.race([
        getDoc(docRef),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Network timeout")), timeoutMs)
        ),
      ]);
      return snap;
    } catch {
      // Timeout or error
    }
  }

  // 3. Fallback to cache
  try {
    return await getDocFromCache(docRef);
  } catch {
    return {
      exists: () => false,
      data: () => undefined,
      id: docRef.id,
    } as any;
  }
}
