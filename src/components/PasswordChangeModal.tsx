import React, { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { auth, db } from "../firebase";
import { User } from "../types";
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle, X } from "lucide-react";

interface PasswordChangeModalProps {
  currentUser: User;
  onSuccess: (newPassword: string) => void;
  onDismiss?: () => void;
}

export default function PasswordChangeModal({
  currentUser,
  onSuccess,
  onDismiss,
}: PasswordChangeModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = newPassword.trim();
    if (trimmed.length < 6) {
      setError("পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে।");
      return;
    }

    if (trimmed !== confirmPassword.trim()) {
      setError("উভয় পাসওয়ার্ডের মিল নেই! আবার চেক করুন।");
      return;
    }

    setLoading(true);

    try {
      // 1. Update Firebase Auth Password if user is logged in
      if (auth.currentUser) {
        try {
          await updatePassword(auth.currentUser, trimmed);
        } catch (authErr: any) {
          console.warn("Auth updatePassword warning:", authErr);
          // If requires recent login, ignore and proceed to firestore if needed
        }
      }

      // 2. Update user doc in Firestore
      const userDocId = currentUser.docId || currentUser.userId;
      if (userDocId) {
        await updateDoc(doc(db, "users", userDocId), {
          password: trimmed,
          requirePasswordChange: false,
        });
      }

      // 3. Update phone_to_email mapping if mobile exists
      const normMobile = (currentUser.mobile || "").replace(/[^0-9]/g, "");
      if (normMobile) {
        try {
          await updateDoc(doc(db, "phone_to_email", normMobile), {
            password: trimmed,
            requirePasswordChange: false,
          });
        } catch (mappingErr) {
          console.warn("phone_to_email mapping update skipped:", mappingErr);
        }
      }

      onSuccess(trimmed);
    } catch (err: any) {
      console.error("Password change failed:", err);
      setError("পাসওয়ার্ড পরিবর্তন করতে সমস্যা হয়েছে: " + (err.message || "আবার চেষ্টা করুন"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Top accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

        {/* Optional dismiss button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="পরে করুন"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Icon & Title */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">
              পাসওয়ার্ড পরিবর্তন করুন
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              নিরাপত্তার স্বার্থে নতুন পাসওয়ার্ড নির্ধারণ করুন
            </p>
          </div>
        </div>

        {/* Informative Note */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-3.5 mb-4 text-xs text-amber-900 dark:text-amber-300 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            ওয়ান-টাইম পাসওয়ার্ড (OTP) পরিবর্তিত হচ্ছে
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-400/90 leading-relaxed">
            আপনার অ্যাকাউন্টে একটি সাময়িক পাসওয়ার্ড দেওয়া হয়েছিল। ভবিষ্যতে সহজে লগইন করতে এখনই আপনার পছন্দের একটি স্থায়ী পাসওয়ার্ড লিখুন।
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 mb-4 animate-shake">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              নতুন পাসওয়ার্ড
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="কমপক্ষে ৬ অক্ষরের নতুন পাসওয়ার্ড"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-3 rounded-2xl text-sm font-semibold text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 outline-none transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              নতুন পাসওয়ার্ড নিশ্চিত করুন
            </label>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="আগের পাসওয়ার্ডটি পুনরায় লিখুন"
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3.5 py-3 rounded-2xl text-sm font-semibold text-slate-800 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-indigo-500 outline-none transition-all"
            />
          </div>

          <div className="pt-2 flex gap-2">
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-colors"
              >
                পরে পরিবর্তন করব
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
            >
              {loading ? (
                "সংরক্ষণ করা হচ্ছে..."
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  পাসওয়ার্ড সংরক্ষণ করুন
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
