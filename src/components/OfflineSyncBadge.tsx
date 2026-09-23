import { useState } from "react";
import { useSyncStatus } from "../utils/syncManager";
import { Cloud, CloudOff, RefreshCw, CheckCircle2, Wifi, WifiOff, Info, X, ShieldCheck } from "lucide-react";

interface OfflineSyncBadgeProps {
  compact?: boolean;
}

export default function OfflineSyncBadge({ compact = false }: OfflineSyncBadgeProps) {
  const { isOnline, isSyncing, lastSyncedAt, syncMessage, triggerSync } = useSyncStatus();
  const [showModal, setShowModal] = useState(false);
  const [manualSyncing, setManualSyncing] = useState(false);

  const handleManualSync = async () => {
    setManualSyncing(true);
    await triggerSync();
    setTimeout(() => {
      setManualSyncing(false);
    }, 600);
  };

  const formatLastSync = (date: Date | null) => {
    if (!date) return "এইমাত্র";
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const seconds = date.getSeconds().toString().padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <>
      {/* Visual Badge Indicator */}
      <button
        onClick={() => setShowModal(true)}
        type="button"
        title="সিঙ্ক ও নেটওয়ার্ক স্ট্যাটাস"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm active:scale-95 ${
          !isOnline
            ? "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 animate-pulse"
            : isSyncing || manualSyncing
            ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/60"
            : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100"
        }`}
      >
        {!isOnline ? (
          <>
            <CloudOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="hidden sm:inline">অফলাইন মোড</span>
            <span className="sm:hidden">অফলাইন</span>
          </>
        ) : isSyncing || manualSyncing ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-spin shrink-0" />
            <span className="hidden sm:inline">সিঙ্ক হচ্ছে...</span>
            <span className="sm:hidden">সিঙ্ক...</span>
          </>
        ) : (
          <>
            <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">ক্লাউড সিঙ্কড</span>
            <span className="sm:hidden">সিঙ্কড</span>
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
          </>
        )}
      </button>

      {/* Info & Sync Management Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative overflow-hidden">
            {/* Top decorative gradient bar */}
            <div
              className={`absolute top-0 left-0 right-0 h-1.5 ${
                !isOnline
                  ? "bg-amber-500"
                  : isSyncing || manualSyncing
                  ? "bg-blue-500 animate-pulse"
                  : "bg-emerald-500"
              }`}
            />

            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon Header */}
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                  !isOnline
                    ? "bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400"
                    : isSyncing || manualSyncing
                    ? "bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400"
                    : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {!isOnline ? (
                  <WifiOff className="w-6 h-6" />
                ) : isSyncing || manualSyncing ? (
                  <RefreshCw className="w-6 h-6 animate-spin" />
                ) : (
                  <ShieldCheck className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  {!isOnline
                    ? "অফলাইন মোড সক্রিয়"
                    : isSyncing || manualSyncing
                    ? "ডাটা সিঙ্ক হচ্ছে"
                    : "ক্লাউড সিঙ্কড ও নিরাপদ"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isOnline ? "ইন্টারনেট সংযোগ স্বাভাবিক" : "ডিভাইস ইন্টারনেট সংযোগ বিচ্ছিন্ন"}
                </p>
              </div>
            </div>

            {/* How it works info box */}
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3.5 mb-4 text-xs text-slate-600 dark:text-slate-300 space-y-2 border border-slate-100 dark:border-slate-800">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p>
                  <strong>টালি খাতার মতো অফলাইন প্রযুক্তি:</strong> ইন্টারনেট না থাকলেও আপনি নিশ্চিন্তে কিস্তি জমা, উত্তোলন, সদস্য যোগ বা ডিলিট করতে পারবেন।
                </p>
              </div>
              <p className="text-slate-500 dark:text-slate-400 pl-6">
                ইন্টারনেট পাওয়ার সাথে সাথে সার্ভারের সাথে মিলিয়ে সব ডেটা অটোমেটিক সিঙ্ক এবং ক্লাউড ডাটাবেজে আপডেট হয়ে যাবে।
              </p>
            </div>

            {/* Status Details */}
            <div className="space-y-2 mb-5 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">বর্তমান অবস্থা:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  {isOnline ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-ping" />
                      অনলাইন
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                      অফলাইন
                    </>
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">সর্বশেষ সফল সিঙ্ক:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {formatLastSync(lastSyncedAt)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleManualSync}
                disabled={!isOnline || isSyncing || manualSyncing}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing || manualSyncing ? "animate-spin" : ""}`} />
                {isSyncing || manualSyncing ? "সিঙ্ক করা হচ্ছে..." : "এখনই সিঙ্ক করুন"}
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs transition-colors"
              >
                ঠিক আছে
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
