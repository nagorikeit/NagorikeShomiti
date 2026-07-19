import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

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
