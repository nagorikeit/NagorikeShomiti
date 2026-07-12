import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { User } from "../types";
import { 
  Megaphone, 
  Check, 
  Settings, 
  AlertCircle, 
  Eye, 
  Sparkles, 
  Radio, 
  Tv, 
  Info, 
  Lock, 
  ExternalLink,
  Volume2,
  VolumeX,
  X,
  Play
} from "lucide-react";
import { translations, Language } from "../utils/translations";
import GoogleAdComponent from "./GoogleAdComponent";

interface AdManagementViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
  language?: Language;
}

export default function AdManagementView({ 
  currentUser, 
  onNavigate, 
  language = "bn" 
}: AdManagementViewProps) {
  const t = translations[language];

  // Restrict access to Admins only
  const isAdmin = currentUser?.role === "admin" || currentUser?.email === "nagorikeitsheba@gmail.com";

  const [enabled, setEnabled] = useState<boolean>(true);
  const [provider, setProvider] = useState<"manual" | "adsense">("manual");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Load current Ad settings from Firestore in real-time
  useEffect(() => {
    if (!isAdmin) return;

    const adSettingsRef = doc(db, "settings", "ad_settings");
    const unsub = onSnapshot(adSettingsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setEnabled(data.enabled !== false);
        setProvider(data.provider || "manual");
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading ad settings in Admin:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [isAdmin]);

  // Handle Save
  const handleSaveSettings = async (nextEnabled: boolean, nextProvider: "manual" | "adsense") => {
    if (!isAdmin) return;
    
    setSaving(true);
    setSavedSuccess(false);

    try {
      const adSettingsRef = doc(db, "settings", "ad_settings");
      await setDoc(adSettingsRef, {
        enabled: nextEnabled,
        provider: nextProvider,
        updatedBy: currentUser.email || "Admin",
        updatedAt: Date.now()
      }, { merge: true });

      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving ad settings:", error);
      setSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center font-sans">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-100 dark:border-rose-900/50">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
          {language === "bn" ? "অ্যাক্সেস অনুমোদিত নয়" : "Access Denied"}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
          {language === "bn" 
            ? "এই পেজটি শুধুমাত্র সিস্টেম এডমিনিস্ট্রেটরের জন্য সংরক্ষিত। অন্য কোনো অ্যাকাউন্ট দিয়ে এই পেজ অ্যাক্সেস করা যাবে না।"
            : "This page is strictly reserved for the system administrator. Other accounts cannot access this area."}
        </p>
        <button
          onClick={() => onNavigate("dashboard")}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl transition shadow-md cursor-pointer"
        >
          {language === "bn" ? "ড্যাশবোর্ডে ফিরে যান" : "Return to Dashboard"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 font-sans">
      {/* View Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-400/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
            <Megaphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>{language === "bn" ? "অ্যাড ম্যানেজমেন্ট ও কন্ট্রোল সেন্টার" : "Ad Management & Control Center"}</span>
              <Sparkles className="w-4 h-4 text-amber-500 animate-spin-slow" />
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {language === "bn" 
                ? "সমিতির ফ্রী ইউজারদের জন্য বিজ্ঞাপন বন্ধ/চালু এবং বিজ্ঞাপনের ধরন নির্ধারণ করুন।"
                : "Manage ad active states and choose between Manual Campaigns or Google AdSense for free plan users."}
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigate("dashboard")}
          className="self-start md:self-auto px-4 py-2 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 text-slate-600 dark:text-slate-300"
        >
          {language === "bn" ? "ড্যাশবোর্ড" : "Dashboard"}
        </button>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-800 shadow-sm">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs text-slate-400 font-bold">লোড হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Side: Controls Form */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-150 dark:border-slate-850 p-6 shadow-sm space-y-6 relative overflow-hidden">
              
              {/* Card Decoration */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />

              <div>
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-indigo-500" />
                  <span>{language === "bn" ? "বিজ্ঞাপন কনফিগারেশন" : "Ad Configuration"}</span>
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  {language === "bn" 
                    ? "পরিবর্তনগুলো সাথে সাথে সেভ হয়ে সারা দেশে সক্রিয় হয়ে যাবে।"
                    : "Changes are automatically synced and deployed in real-time."}
                </p>
              </div>

              <hr className="border-slate-100 dark:border-slate-800" />

              {/* Option 1: Start/Stop Ads */}
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {language === "bn" ? "১. বিজ্ঞাপন প্রদর্শন অবস্থা (Status)" : "1. Ad Visibility Status"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setEnabled(true);
                      handleSaveSettings(true, provider);
                    }}
                    className={`p-4 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      enabled
                        ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-xs"
                        : "bg-slate-50/50 dark:bg-slate-950/10 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-emerald-500 block animate-pulse" />
                    <span className="text-xs font-black">{language === "bn" ? "বিজ্ঞাপন চালু" : "Ads Active"}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      {language === "bn" ? "বিজ্ঞাপন দেখানো হবে" : "Show Ads"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEnabled(false);
                      handleSaveSettings(false, provider);
                    }}
                    className={`p-4 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      !enabled
                        ? "bg-rose-50/70 dark:bg-rose-950/20 border-rose-500 text-rose-700 dark:text-rose-400 shadow-xs"
                        : "bg-slate-50/50 dark:bg-slate-950/10 border-slate-200 dark:border-slate-800 text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full bg-rose-500 block" />
                    <span className="text-xs font-black">{language === "bn" ? "বিজ্ঞাপন বন্ধ" : "Ads Stopped"}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold">
                      {language === "bn" ? "১০০% বিজ্ঞাপন-মুক্ত" : "Ad-Free"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Option 2: Ad Type / Provider Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {language === "bn" ? "২. বিজ্ঞাপনের ধরন / প্রোভাইডার" : "2. Ad Provider Selection"}
                </label>
                <div className="space-y-3">
                  {/* Manual Campaigns Card */}
                  <div
                    onClick={() => {
                      setProvider("manual");
                      handleSaveSettings(enabled, "manual");
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                      provider === "manual"
                        ? "bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-500 text-slate-800 dark:text-slate-100"
                        : "bg-slate-50/40 dark:bg-slate-950/10 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${provider === "manual" ? "bg-indigo-500/10 text-indigo-600" : "bg-slate-200/50 dark:bg-slate-800 text-slate-400"}`}>
                      <Radio className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">{language === "bn" ? "ম্যানুয়াল লোকাল অ্যাড" : "Manual Local Campaigns"}</span>
                        {provider === "manual" && <span className="p-0.5 rounded-full bg-indigo-500 text-white"><Check className="w-3 h-3" /></span>}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold leading-relaxed">
                        {language === "bn"
                          ? "বিকাশ, ট্যাপ ট্যাপ সেন্ড এবং স্থানীয় খাতা প্রচারের কাস্টম-ডিজাইন করা স্থানীয় স্পন্সরড বিজ্ঞাপন।"
                          : "Show highly-styled bKash, Taptap Send, and Digital Khata custom local promotions."}
                      </p>
                    </div>
                  </div>

                  {/* AdSense Card */}
                  <div
                    onClick={() => {
                      setProvider("adsense");
                      handleSaveSettings(enabled, "adsense");
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer flex items-start gap-3 ${
                      provider === "adsense"
                        ? "bg-blue-50/40 dark:bg-blue-950/20 border-blue-500 text-slate-800 dark:text-slate-100"
                        : "bg-slate-50/40 dark:bg-slate-950/10 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${provider === "adsense" ? "bg-blue-500/10 text-blue-600" : "bg-slate-200/50 dark:bg-slate-800 text-slate-400"}`}>
                      <Tv className="w-5 h-5" />
                    </div>
                    <div className="flex-1 text-left">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black">{language === "bn" ? "গুগল অ্যাডসেন্স (Google AdSense)" : "Google AdSense System"}</span>
                        {provider === "adsense" && <span className="p-0.5 rounded-full bg-blue-500 text-white"><Check className="w-3 h-3" /></span>}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-semibold leading-relaxed">
                        {language === "bn"
                          ? "গুগল অ্যাডসেন্স বিজ্ঞাপন ইউনিট প্রদর্শন করুন। এআই ভিত্তিক রিয়েল-টাইম অ্যাড কোয়েরি ও অপ্টিমাইজেশন সুবিধা।"
                          : "Display simulated Google AdSense banners and interstitial video integrations with standard Google tags."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Message */}
              <div className="transition-all duration-300">
                {saving ? (
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                    <div className="w-4.5 h-4.5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                    <span>{language === "bn" ? "ক্লাউডে সেটিংস আপডেট হচ্ছে..." : "Updating settings in Firestore..."}</span>
                  </div>
                ) : savedSuccess ? (
                  <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center gap-2 text-xs font-black text-emerald-700 dark:text-emerald-400 animate-fadeIn">
                    <div className="p-1 rounded-full bg-emerald-500 text-white"><Check className="w-3 h-3" /></div>
                    <span>{language === "bn" ? "বিজ্ঞাপন সেটিংস সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে!" : "Ad Settings successfully saved to Cloud!"}</span>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-850 flex items-center gap-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                    <Info className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>
                      {language === "bn"
                        ? "এই সেটিংস শুধুমাত্র সাধারণ (ফ্রি) প্ল্যান ব্যবহারকারীদের জন্য কাজ করবে। যারা প্রিমিয়াম প্ল্যান কিনেছেন তারা সম্পূর্ণ বিজ্ঞাপন-মুক্ত সেবা পাবেন।"
                        : "Note: Advertising controls only affect free tier users. Premium members will continue to receive a completely ad-free workspace."}
                    </span>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Right Side: Interactive Real-Time Preview Sandbox */}
          <div className="lg:col-span-7 space-y-6">
            
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 shadow-xs space-y-6">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-200">
                    {language === "bn" ? "লাইভ বিজ্ঞাপন স্যান্ডবক্স প্রিভিউ" : "Interactive Live Ad Sandbox"}
                  </h3>
                </div>
                <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                  {language === "bn" ? "অ্যাডমিন ভিউ" : "Admin Preview Mode"}
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                {language === "bn"
                  ? "নিচে ড্যাশবোর্ডে যেভাবে বিজ্ঞাপনগুলো দেখাবে তার লাইভ ডেমো রয়েছে। বামপাশের সুইচে পরিবর্তন করে বিজ্ঞপ্তির আচরণ পরীক্ষা করুন।"
                  : "Below is a real-time interactive simulation of how advertisements appear to normal users inside the app dashboard."}
              </p>

              <hr className="border-slate-200 dark:border-slate-800" />

              {/* Status Indicator Banner */}
              <div className="flex items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-150 dark:border-slate-850">
                <div className={`w-3.5 h-3.5 rounded-full ${enabled ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
                <div className="text-left">
                  <p className="text-xs font-black text-slate-800 dark:text-slate-200">
                    {language === "bn" ? "বর্তমান অবস্থাঃ" : "Current Active State:"} {" "}
                    {enabled ? (
                      <span className="text-emerald-600 dark:text-emerald-400">{language === "bn" ? "চলমান বিজ্ঞাপন (বিজ্ঞাপন দেখানো হচ্ছে)" : "Active (Displaying Ads)"}</span>
                    ) : (
                      <span className="text-rose-600 dark:text-rose-400">{language === "bn" ? "স্থগিত বিজ্ঞাপন (বিজ্ঞাপন সম্পূর্ণ বন্ধ)" : "Stopped (System-wide Ad-free)"}</span>
                    )}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-semibold">
                    {language === "bn" ? "বিজ্ঞাপন প্রোভাইডারঃ" : "Selected Ad Provider:"} {" "}
                    <span className="text-slate-700 dark:text-slate-300 capitalize font-extrabold">{provider === "manual" ? "লোকাল ম্যানুয়াল বিজ্ঞাপন" : "Google AdSense"}</span>
                  </p>
                </div>
              </div>

              {/* Preview Container */}
              <div className="space-y-6">
                
                {/* 1. Banner Ad Section */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
                    {language === "bn" ? "১. ব্যানার বিজ্ঞাপন (Banner Ad Area)" : "1. Banner Ad Area"}
                  </h4>
                  
                  {!enabled ? (
                    <div className="bg-white/60 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-xs font-bold text-slate-400">
                      {language === "bn" ? "❌ বিজ্ঞাপন নিষ্ক্রিয় করা আছে। কোনো ব্যানার বিজ্ঞাপন দেখা যাবে না।" : "❌ Ads are globally disabled. No banner will render."}
                    </div>
                  ) : provider === "manual" ? (
                    /* Render standard Local campaign component (or a mock layout of GoogleAdComponent in local mode) */
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 shadow-xs relative overflow-hidden flex flex-col md:flex-row items-center gap-4">
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                        <span>Sponsored</span>
                        <Info className="w-3 h-3 text-slate-400" />
                      </div>
                      <div className="w-full md:w-24 h-16 shrink-0 rounded-xl overflow-hidden bg-indigo-50 border border-slate-200/60">
                        <img 
                          src="https://images.unsplash.com/photo-1563013544-824ae1d704d3?auto=format&fit=crop&w=300&q=80" 
                          alt="bKash" 
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 text-center md:text-left space-y-1">
                        <span className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">bKash Limited</span>
                        <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-tight">বিকাশ অ্যাপ ডাউনলোড করুন</h4>
                        <p className="text-[10px] text-slate-400 leading-normal line-clamp-1">সহজ ও নিরাপদ লেনদেনের জন্য আজই ডাউনলোড করুন বিকাশ অ্যাপ।</p>
                      </div>
                      <button className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-lg transition shrink-0">
                        অ্যাপ ডাউনলোড
                      </button>
                    </div>
                  ) : (
                    /* Google AdSense style banner */
                    <div className="bg-amber-50/20 dark:bg-amber-950/5 border border-dashed border-amber-300/60 rounded-3xl p-4 relative overflow-hidden flex flex-col items-center justify-center min-h-[90px] text-center">
                      <div className="absolute top-2 right-2 flex items-center gap-1 text-[8px] font-extrabold text-amber-500/70 uppercase tracking-widest">
                        <span>AdSense Responsive Unit</span>
                        <X className="w-3 h-3 text-amber-500/70" />
                      </div>
                      <div className="space-y-1 py-2">
                        <p className="text-[9px] text-amber-500 dark:text-amber-400 font-black tracking-widest uppercase">GOOGLE ADSENSE BANNER AD</p>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">হোস্টিং ও ক্লাউড সার্ভার অফার - ৫০% পর্যন্ত ছাড়!</h4>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">আপনার সমিতি বা সোশ্যাল সাইট ক্লাউডে তুলুন নিরাপদভাবে।</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Video Ad Section */}
                <div className="space-y-2">
                  <h4 className="text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-left">
                    {language === "bn" ? "২. ভিডিও বিজ্ঞাপন (Video Interstitial/Compact Ad)" : "2. Video Interstitial Ad Area"}
                  </h4>

                  {!enabled ? (
                    <div className="bg-white/60 dark:bg-slate-950/20 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center text-xs font-bold text-slate-400">
                      {language === "bn" ? "❌ বিজ্ঞাপন নিষ্ক্রিয় করা আছে। কোনো ভিডিও বিজ্ঞাপন দেখা যাবে না।" : "❌ Ads are globally disabled. No video will render."}
                    </div>
                  ) : provider === "manual" ? (
                    /* Manual local video ad campaign preview */
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl p-4 relative text-left">
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-indigo-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">ম্যানুয়াল ভিডিও</span>
                        <span className="text-[10px] text-slate-400">ট্যাপ ট্যাপ সেন্ড - মুহূর্তেই টাকা পাঠান</span>
                      </div>
                      <div className="aspect-video bg-slate-950 rounded-2xl flex items-center justify-center relative overflow-hidden">
                        <video 
                          src="https://assets.mixkit.co/videos/preview/mixkit-hand-holding-a-smartphone-with-a-yellow-background-41484-large.mp4"
                          autoPlay
                          muted
                          loop
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-4">
                          <span className="text-[8px] text-indigo-400 font-extrabold uppercase">Taptap Send</span>
                          <h4 className="text-xs font-black text-white">প্রবাসী ভাইবোনদের জন্য সেরা অ্যাপ</h4>
                          <a href="#" className="self-start mt-2 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-lg flex items-center gap-1">
                            <span>টাকা পাঠান এখনই</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Google AdSense/AdManager video ad */
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl p-4 relative text-left">
                      <div className="flex items-center justify-between mb-2">
                        <span className="bg-amber-500 text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider">AdSense Outstream Video</span>
                        <span className="text-[10px] text-slate-400">Google Ads Matchmaker</span>
                      </div>
                      <div className="aspect-video bg-slate-950 rounded-2xl flex items-center justify-center relative overflow-hidden">
                        <video 
                          src="https://assets.mixkit.co/videos/preview/mixkit-businesswoman-analyzing-charts-on-a-tablet-40436-large.mp4"
                          autoPlay
                          muted
                          loop
                          className="w-full h-full object-cover opacity-80"
                        />
                        <div className="absolute inset-0 bg-black/50 flex flex-col justify-end p-4">
                          <span className="text-[8px] text-amber-400 font-extrabold uppercase">Google Workspace</span>
                          <h4 className="text-xs font-black text-white">আপনার টিমকে সংযুক্ত রাখুন ইন্টেলিজেন্ট ওয়ার্কস্পেসে</h4>
                          <a href="#" className="self-start mt-2 px-3 py-1.5 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg flex items-center gap-1">
                            <span>ফ্রি ট্রায়াল শুরু করুন</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}
