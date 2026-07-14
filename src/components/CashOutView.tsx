import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, addDoc, doc, onSnapshot } from "firebase/firestore";
import { User } from "../types";
import { 
  ArrowLeft, 
  Copy, 
  Check, 
  Info, 
  Fingerprint, 
  DollarSign, 
  Smartphone, 
  ShieldCheck, 
  Clock, 
  HelpCircle,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface CashOutViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
  navigationParams?: any;
}

export default function CashOutView({ currentUser, onNavigate, navigationParams }: CashOutViewProps) {
  // Real-time savings balance subscription
  const [savingsBalance, setSavingsBalance] = useState<number>(currentUser.savingsBalance || 0);
  const [userDoc, setUserDoc] = useState<User | null>(null);

  useEffect(() => {
    if (!currentUser.docId) return;
    const unsub = onSnapshot(doc(db, "users", currentUser.docId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as User;
        setUserDoc(data);
        setSavingsBalance(data.savingsBalance || 0);
      }
    });
    return () => unsub();
  }, [currentUser]);

  // Form State
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"auto" | "manual" | null>(null);
  const [provider, setProvider] = useState<"bkash" | "nagad" | "rocket" | null>(null);
  const [walletNumber, setWalletNumber] = useState<string>("");
  const [trxId, setTrxId] = useState<string>("");
  const [pin, setPin] = useState<string>("");

  // UI state
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // References for Tap & Hold
  const holdIntervalRef = useRef<any>(null);

  // Constants
  const MIN_AMOUNT = 10;
  const MAX_AMOUNT = 5000;

  const officialNumbers = {
    bkash: "01743915883",
    nagad: "01843915883",
    rocket: "019843915883"
  };

  // Preset Amounts
  const presetAmounts = [100, 500, 1000, 2000, 5000];

  // Reset logic downstream if amount changes
  useEffect(() => {
    const amtNum = parseFloat(amount) || 0;
    if (amtNum < MIN_AMOUNT || amtNum > savingsBalance) {
      setMethod(null);
      setProvider(null);
      setWalletNumber("");
      setTrxId("");
      setPin("");
    }
  }, [amount, savingsBalance]);

  useEffect(() => {
    if (method !== "manual") {
      setProvider(null);
      setWalletNumber("");
      setTrxId("");
      setPin("");
    }
  }, [method]);

  useEffect(() => {
    if (!provider) {
      setWalletNumber("");
      setTrxId("");
      setPin("");
    }
  }, [provider]);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(key);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Validation Checkers
  const isAmountValid = parseFloat(amount) >= MIN_AMOUNT && parseFloat(amount) <= savingsBalance;
  const isWalletValid = /^01\d{9}$/.test(walletNumber);
  const isTrxIdValid = trxId.trim().length >= 6;
  const isPinValid = /^\d{4}$/.test(pin);

  // Tap & Hold Logic
  const startHold = () => {
    if (!isAmountValid || !isWalletValid || !isTrxIdValid || !isPinValid || submitting) return;
    setIsHolding(true);
    setHoldProgress(0);

    holdIntervalRef.current = setInterval(() => {
      setHoldProgress((prev) => {
        if (prev >= 100) {
          clearInterval(holdIntervalRef.current);
          setIsHolding(false);
          triggerSubmission();
          return 100;
        }
        return prev + 5; // Takes 1 second (20 steps of 50ms)
      });
    }, 50);
  };

  const endHold = () => {
    if (holdIntervalRef.current) {
      clearInterval(holdIntervalRef.current);
    }
    setIsHolding(false);
    setHoldProgress(0);
  };

  // Submit request to Firestore
  const triggerSubmission = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Security PIN verification (if userDoc has set a pin, we check it)
      // Otherwise we assume it matches a simulated verification
      if (userDoc && (userDoc as any).pin && (userDoc as any).pin !== pin) {
        throw new Error("আপনার ৪ ডিজিটের পিন নম্বরটি সঠিক নয়। অনুগ্রহ করে সঠিক পিন দিন।");
      }

      const reqPayload = {
        companyId: currentUser.companyId || currentUser.docId || "",
        userId: currentUser.docId,
        userName: currentUser.name,
        userEmail: currentUser.email || "",
        flow: "OUT",
        type: "saving",
        amount: parseFloat(amount),
        date: new Date().toISOString().split("T")[0],
        memo: "সঞ্চয় থেকে টাকা উত্তোলন (ক্যাশ-আউট - নতুন ডিজাইন)",
        paymentMethod: "mobile_banking",
        mobileProvider: provider || "",
        mobileAccountNo: walletNumber,
        mobileTrxId: trxId,
        status: "pending",
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, "transaction_requests"), reqPayload);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "ক্যাশ আউট রিকোয়েস্ট পাঠানো যায়নি। পুনরায় চেষ্টা করুন।");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 font-sans transition-colors">
      {/* Navbar Header */}
      <div className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-150 dark:border-slate-850 px-4 py-4 flex items-center justify-between shadow-sm">
        <button 
          onClick={() => onNavigate("dashboard")}
          className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer text-slate-600 dark:text-slate-300 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-black text-slate-800 dark:text-slate-100 text-base">ক্যাশ আউট (Cash Out)</h1>
        <div className="w-8"></div> {/* Placeholder spacer */}
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {/* User Balance Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-tr from-pink-600 to-rose-500 rounded-3xl p-5 text-white shadow-xl shadow-pink-500/10 relative overflow-hidden"
        >
          {/* Decorative background circle */}
          <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/10 rounded-full blur-xl" />
          
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-pink-100 block mb-1">
            বর্তমান সঞ্চয় ব্যালেন্স
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black tracking-tight">
              ৳{savingsBalance.toLocaleString("bn-BD")}
            </span>
            <span className="text-xs font-semibold text-pink-100">টাকা</span>
          </div>
          
          <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center gap-2 text-[10px] text-pink-50 font-bold">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>সঞ্চয় ব্যালেন্স থেকে মোবাইল ওয়ালেটে ক্যাশ আউট করতে পারবেন।</span>
          </div>
        </motion.div>

        {/* Amount Section */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-100 dark:border-slate-850 shadow-xs space-y-4"
        >
          <div>
            <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block mb-1.5">
              ক্যাশ আউটের পরিমাণ লিখুন
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-slate-400 dark:text-slate-500 font-extrabold text-lg">৳</span>
              <input
                type="number"
                min={MIN_AMOUNT}
                max={savingsBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3.5 pl-9 pr-4 text-base font-extrabold text-slate-800 dark:text-slate-100 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-2">
            {presetAmounts.map((preset) => (
              <button
                key={preset}
                onClick={() => setAmount(preset.toString())}
                disabled={preset > savingsBalance}
                className={`px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 ${
                  amount === preset.toString()
                    ? "bg-pink-600 text-white shadow-md shadow-pink-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-150 dark:hover:bg-slate-750 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                ৳{preset.toLocaleString("bn-BD")}
              </button>
            ))}
          </div>

          {/* Amount validations */}
          {amount && (
            <div className="text-xs font-bold transition-all">
              {parseFloat(amount) < MIN_AMOUNT ? (
                <p className="text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> সর্বনিম্ন ক্যাশ আউট ৳{MIN_AMOUNT} টাকা।
                </p>
              ) : parseFloat(amount) > savingsBalance ? (
                <p className="text-rose-500 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> আপনার সেভিংস ব্যালেন্সের চেয়ে বেশি ক্যাশ আউট করা সম্ভব নয়।
                </p>
              ) : (
                <p className="text-emerald-500 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5 stroke-[3px]" /> ক্যাশ আউট করার জন্য পর্যাপ্ত ব্যালেন্স রয়েছে।
                </p>
              )}
            </div>
          )}
        </motion.div>

        {/* Revealed: Select Cash Out Method */}
        <AnimatePresence>
          {isAmountValid && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4"
            >
              <h2 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                পেমেন্ট মেথড নির্বাচন করুন
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {/* Auto Checkout option */}
                <button
                  onClick={() => {
                    setMethod("auto");
                    window.open("https://sslcommerz.com/demo-checkout", "_blank");
                  }}
                  className={`p-4 rounded-3xl border text-left transition relative overflow-hidden cursor-pointer active:scale-95 ${
                    method === "auto"
                      ? "bg-pink-50/50 dark:bg-pink-950/10 border-pink-500 text-pink-700 dark:text-pink-400"
                      : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="w-8 h-8 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center mb-3">
                    <ShieldCheck className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-extrabold text-xs">অটোমেটিক (Gateway)</h3>
                  <p className="text-[9px] text-slate-400 mt-1 leading-snug">তাৎক্ষণিক অটোমেটিক উইথড্র গেটওয়ে</p>
                  {method === "auto" && (
                    <div className="absolute top-3 right-3 bg-pink-600 text-white p-0.5 rounded-full">
                      <Check className="w-3 h-3 stroke-[3px]" />
                    </div>
                  )}
                </button>

                {/* Manual Option */}
                <button
                  onClick={() => setMethod("manual")}
                  className={`p-4 rounded-3xl border text-left transition relative overflow-hidden cursor-pointer active:scale-95 ${
                    method === "manual"
                      ? "bg-pink-50/50 dark:bg-pink-950/10 border-pink-500 text-pink-700 dark:text-pink-400"
                      : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="w-8 h-8 rounded-2xl bg-pink-500/10 text-pink-600 flex items-center justify-center mb-3">
                    <Smartphone className="w-4.5 h-4.5" />
                  </div>
                  <h3 className="font-extrabold text-xs">ম্যানুয়াল ক্যাশ আউট</h3>
                  <p className="text-[9px] text-slate-400 mt-1 leading-snug">মোবাইল ব্যাংকিং ওয়ালেটের মাধ্যমে</p>
                  {method === "manual" && (
                    <div className="absolute top-3 right-3 bg-pink-600 text-white p-0.5 rounded-full">
                      <Check className="w-3 h-3 stroke-[3px]" />
                    </div>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revealed: Mobile Providers (Manual) */}
        <AnimatePresence>
          {isAmountValid && method === "manual" && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="space-y-4"
            >
              <h2 className="text-[11px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider">
                মোবাইল ওয়ালেট নির্বাচন করুন
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {/* bKash */}
                <button
                  onClick={() => setProvider("bkash")}
                  className={`py-3.5 px-2 rounded-2xl border flex flex-col items-center justify-center transition cursor-pointer active:scale-95 ${
                    provider === "bkash"
                      ? "bg-rose-50 dark:bg-rose-950/10 border-rose-500 text-rose-700 font-extrabold"
                      : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 text-slate-600 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="w-8 h-8 rounded-full bg-rose-600 text-white font-black text-sm flex items-center justify-center mb-1.5">b</span>
                  <span className="text-[10px] tracking-tight">বিকাশ</span>
                </button>

                {/* Nagad */}
                <button
                  onClick={() => setProvider("nagad")}
                  className={`py-3.5 px-2 rounded-2xl border flex flex-col items-center justify-center transition cursor-pointer active:scale-95 ${
                    provider === "nagad"
                      ? "bg-orange-50 dark:bg-orange-950/10 border-orange-500 text-orange-700 font-extrabold"
                      : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 text-slate-600 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="w-8 h-8 rounded-full bg-orange-500 text-white font-black text-sm flex items-center justify-center mb-1.5">n</span>
                  <span className="text-[10px] tracking-tight">নগদ</span>
                </button>

                {/* Rocket */}
                <button
                  onClick={() => setProvider("rocket")}
                  className={`py-3.5 px-2 rounded-2xl border flex flex-col items-center justify-center transition cursor-pointer active:scale-95 ${
                    provider === "rocket"
                      ? "bg-purple-50 dark:bg-purple-950/10 border-purple-500 text-purple-700 font-extrabold"
                      : "bg-white dark:bg-slate-900 border-slate-150 dark:border-slate-850 text-slate-600 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="w-8 h-8 rounded-full bg-purple-600 text-white font-black text-sm flex items-center justify-center mb-1.5">r</span>
                  <span className="text-[10px] tracking-tight">রকেট</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Revealed: Copy Official Number & Enter Info */}
        <AnimatePresence>
          {isAmountValid && method === "manual" && provider && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="space-y-4"
            >
              {/* Copy Official Number box */}
              <div className="bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 dark:text-slate-500 tracking-wider block">
                    কোম্পানির অফিসিয়াল ক্যাশ আউট নম্বর
                  </span>
                  <span className="text-base font-black text-slate-800 dark:text-slate-100 tracking-wide mt-0.5 block">
                    {officialNumbers[provider]}
                  </span>
                </div>
                <button
                  onClick={() => handleCopy(officialNumbers[provider], "official_num")}
                  className="p-2.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition cursor-pointer active:scale-95 shrink-0 border border-slate-150 dark:border-slate-750"
                >
                  {copiedText === "official_num" ? (
                    <Check className="w-4 h-4 text-emerald-500 stroke-[3px]" />
                  ) : (
                    <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  )}
                </button>
              </div>

              {/* Wallet fields box */}
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-3xl p-5 shadow-xs space-y-4">
                {/* Wallet number */}
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block mb-1.5">
                    আপনার {provider === "bkash" ? "বিকাশ" : provider === "nagad" ? "নগদ" : "রকেট"} ওয়ালেট নম্বর
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      maxLength={11}
                      value={walletNumber}
                      onChange={(e) => setWalletNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="01xxxxxxxxx"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all tracking-wider"
                    />
                    {isWalletValid && (
                      <span className="absolute right-3 text-emerald-500">
                        <Check className="w-4 h-4 stroke-[3px]" />
                      </span>
                    )}
                  </div>
                </div>

                {/* TrxID (Appears when wallet is valid) */}
                {isWalletValid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4 pt-1"
                  >
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block mb-1.5">
                        লেনদেনের ট্রানজেকশন আইডি (TrxID)
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          value={trxId}
                          onChange={(e) => setTrxId(e.target.value)}
                          placeholder="যেমন: B1A2C3D4"
                          className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all uppercase tracking-widest"
                        />
                        {isTrxIdValid && (
                          <span className="absolute right-3 text-emerald-500">
                            <Check className="w-4 h-4 stroke-[3px]" />
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 block">মোবাইল ওয়ালেটে ক্যাশ আউট করার পর প্রাপ্ত TrxID লিখুন।</span>
                    </div>
                  </motion.div>
                )}

                {/* PIN (Appears when TrxID is valid) */}
                {isWalletValid && isTrxIdValid && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="pt-1"
                  >
                    <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-wider block mb-1.5">
                      আপনার ৪ ডিজিটের পিন (PIN)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="password"
                        maxLength={4}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="••••"
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 px-4 text-center text-lg font-black text-slate-800 dark:text-slate-100 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all tracking-widest"
                      />
                      {isPinValid && (
                        <span className="absolute right-3 text-emerald-500">
                          <Check className="w-4 h-4 stroke-[3px]" />
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error messaging */}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="p-3.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </motion.div>
        )}

        {/* Tap & Hold Checkout (Appears when everything is valid) */}
        <AnimatePresence>
          {isAmountValid && method === "manual" && provider && isWalletValid && isTrxIdValid && isPinValid && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex flex-col items-center justify-center py-6"
            >
              <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest block mb-4 animate-pulse">
                ক্যাশ আউট করতে ধরে রাখুন
              </span>

              {/* Hold Trigger Widget */}
              <div 
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                className="relative w-28 h-28 flex items-center justify-center select-none active:scale-95 transition-transform duration-100 cursor-pointer"
              >
                {/* Outer Progress SVG Circle */}
                <svg className="absolute inset-0 w-full h-full -rotate-90">
                  <circle
                    cx="56"
                    cy="56"
                    r="50"
                    className="stroke-slate-200 dark:stroke-slate-800 fill-transparent"
                    strokeWidth="6"
                  />
                  <circle
                    cx="56"
                    cy="56"
                    r="50"
                    className="stroke-pink-600 fill-transparent transition-all duration-75"
                    strokeWidth="6"
                    strokeDasharray="314"
                    strokeDashoffset={314 - (314 * holdProgress) / 100}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Inner Button Circle */}
                <div className={`w-22 h-22 rounded-full flex flex-col items-center justify-center transition-all ${
                  isHolding 
                    ? "bg-pink-700 shadow-inner scale-95" 
                    : "bg-gradient-to-tr from-pink-600 to-rose-500 shadow-lg shadow-pink-500/35"
                } text-white`}>
                  <Fingerprint className="w-9 h-9" />
                  <span className="text-[8px] font-black uppercase tracking-widest mt-1">
                    {isHolding ? `${holdProgress}%` : "TAP & HOLD"}
                  </span>
                </div>
              </div>

              <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[200px] mt-4 font-bold leading-relaxed">
                ১ সেকেন্ড ধরে রাখলে ক্যাশ আউট রিকোয়েস্ট সাবমিট হবে।
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Success Modal Backdrop Overlay */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm text-center border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden space-y-5"
            >
              {/* Confetti simulation decoration circles */}
              <div className="absolute top-0 left-0 w-20 h-20 bg-pink-500/10 rounded-full -translate-x-10 -translate-y-10" />
              <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/10 rounded-full translate-x-10 -translate-y-10" />

              {/* Animated check circle */}
              <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-md">
                <Check className="w-8 h-8 stroke-[3.5px] animate-bounce" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">ক্যাশ আউট সফল হয়েছে!</h3>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 leading-relaxed">
                  আপনার ক্যাশ আউট রিকোয়েস্টটি সফলভাবে সিস্টেমে পাঠানো হয়েছে।
                </p>
              </div>

              {/* Receipt Style breakdown */}
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 text-left text-xs space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">ক্যাশ আউট পরিমাণ:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold text-sm text-pink-600">৳{parseFloat(amount).toLocaleString("bn-BD")}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">ওয়ালেট চ্যানেল:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold uppercase">{provider} ({walletNumber})</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">ট্রানজেকশন আইডি:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-extrabold text-[11px] tracking-wide uppercase">{trxId}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-200/50 dark:border-slate-800/50">
                  <span className="text-slate-400 font-bold">স্ট্যাটাস:</span>
                  <span className="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 font-extrabold text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" /> পেন্ডিং (Pending)
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold leading-relaxed">
                কোম্পানির এডমিন বা ম্যানেজার ট্রানজেকশন আইডিটি মিলিয়ে দেখবার পর আপনার সেভিংস অ্যাকাউন্ট ব্যালেন্স থেকে সমপরিমাণ অর্থ চূড়ান্তভাবে কর্তন করা হবে।
              </p>

              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  onNavigate("transactions");
                }}
                className="w-full py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-black shadow-md shadow-pink-500/20 active:scale-95 transition cursor-pointer"
              >
                ট্রানজেকশন লিস্টে ফিরে যান
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
