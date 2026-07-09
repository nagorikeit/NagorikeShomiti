import React from "react";
import { X, Smartphone, Globe, Apple, Chrome, ChevronRight, Share, PlusSquare } from "lucide-react";

interface InstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  appName: string;
}

export default function InstallGuideModal({ isOpen, onClose, appName }: InstallGuideModalProps) {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      onClick={handleBackdropClick}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[2100] p-4 overflow-y-auto animate-fadeIn font-sans"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-100 dark:border-slate-800 space-y-5 text-left relative overflow-hidden transition-all duration-200 max-h-[90vh] overflow-y-auto">
        
        {/* Decorative background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-3xl" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 relative">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400">
              <Smartphone className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-black text-slate-800 dark:text-slate-100 text-sm sm:text-base">
                {appName} ইন্সটল করুন
              </h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition cursor-pointer text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Warning/Helper Info */}
        <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-amber-800 dark:text-amber-400">
          প্রচলিত প্লে-স্টোরের জটিলতা ও হেভি ফাইল ডাউনলোড ছাড়াই আপনি সরাসরি গুগল ক্রোম বা সাফারি ব্রাউজার দিয়ে যেকোনো মোবাইল বা কম্পিউটারে এই অ্যাপটি ইনস্টল করতে পারেন। নিচে ব্রাউজার অনুযায়ী সহজ নিয়ম দেওয়া হলোঃ
        </p>

        {/* Steps for Android / Chrome / Windows */}
        <div className="space-y-3.5">
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Chrome className="w-4 h-4 text-emerald-500" />
              <span>গুগল ক্রোম বা এজ (Android / Windows / Chrome)</span>
            </h4>
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-2.5 text-[11px] sm:text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">১</span>
                <p className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                  ব্রাউজারের একদম উপরে ডান কোণায় থাকা থ্রি-ডট (<span className="font-extrabold text-slate-900 dark:text-white">⋮</span>) আইকনে ক্লিক করুন।
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">২</span>
                <p className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed flex flex-wrap items-center gap-1">
                  মেনু থেকে <span>"ইন্সটল করুন"</span> বা <span>"Install App"</span> অথবা <span>"Add to Home Screen"</span> সিলেক্ট করুন।
                </p>
              </div>
            </div>
          </div>

          {/* Steps for iPhone / Safari */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Apple className="w-4 h-4 text-slate-400" />
              <span>আইফোন ও আইপ্যাড (iOS Safari)</span>
            </h4>
            <div className="bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-2.5 text-[11px] sm:text-xs">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">১</span>
                <p className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed flex items-center gap-1">
                  সাফারি ব্রাউজারের নিচে থাকা শেয়ার বাটনে (<Share className="w-3.5 h-3.5 inline text-sky-500" /> Share) চাপুন।
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">২</span>
                <p className="text-slate-600 dark:text-slate-300 font-semibold leading-relaxed flex items-center gap-1">
                  একটু স্ক্রোল করে নিচে নেমে <span>"Add to Home Screen"</span> (<PlusSquare className="w-3.5 h-3.5 inline text-slate-500" /> হোম স্ক্রিনে যোগ করুন) বাটনে ট্যাপ করুন।
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="w-full bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white py-2.5 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 text-center shadow-md shadow-sky-500/10"
          >
            বুঝেছি, ধন্যবাদ
          </button>
        </div>
      </div>
    </div>
  );
}
