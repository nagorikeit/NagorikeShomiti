import React, { useState, useEffect } from "react";
import { useSyncStatus } from "../utils/syncManager";
import { CloudOff, CheckCircle2, RefreshCw, X, Wifi } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function NetworkAlertToast() {
  const { isOnline, isSyncing, syncMessage, triggerSync } = useSyncStatus();
  const [showToast, setShowToast] = useState(!isOnline);
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowToast(true);
      setJustCameOnline(false);
    } else {
      // User just came back online
      setJustCameOnline(true);
      setShowToast(true);
      const timer = setTimeout(() => {
        setShowToast(false);
        setJustCameOnline(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  if (!showToast) return null;

  return (
    <AnimatePresence>
      <motion.aside
        aria-label="নেটওয়ার্ক সিঙ্ক অবস্থা"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`w-full py-2 px-4 select-none text-xs font-medium flex items-center justify-between gap-3 shadow-xs transition-colors duration-300 ${
          !isOnline
            ? "bg-amber-500 text-amber-950 border-b border-amber-600"
            : isSyncing
            ? "bg-blue-600 text-white border-b border-blue-700"
            : "bg-emerald-600 text-white border-b border-emerald-700"
        }`}
      >
        <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
          {!isOnline ? (
            <>
              <CloudOff className="w-4 h-4 shrink-0 text-amber-900 animate-pulse" />
              <div className="flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-bold">অফলাইন মোড সক্রিয়:</span>
                <span className="opacity-90">
                  ইন্টারনেট নেই, তবে সব হিসাব, জমা ও ডিলিট এই মোবাইলে সেভ হচ্ছে। অনলাইন হলেই অটো সিঙ্ক হবে।
                </span>
              </div>
            </>
          ) : isSyncing ? (
            <>
              <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-white" />
              <div className="flex-1 flex items-center gap-2">
                <span className="font-bold">অনলাইন সংযোগ পাওয়া গেছে:</span>
                <span>অফলাইনের সকল আপডেট সার্ভারে সিঙ্ক হচ্ছে...</span>
              </div>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-200" />
              <div className="flex-1 flex items-center gap-2">
                <span className="font-bold">সিঙ্ক সফল:</span>
                <span>সকল হিসাব ক্লাউড ডাটাবেজে সুরক্ষিত ও হালনাগাদ করা হয়েছে!</span>
              </div>
            </>
          )}

          {isOnline && !isSyncing && (
            <button
              onClick={() => setShowToast(false)}
              className="p-1 rounded-md hover:bg-black/10 transition-colors ml-auto shrink-0"
              title="বন্ধ করুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
