import React, { useState, useEffect } from "react";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc
} from "firebase/firestore";
import { db } from "../firebase";
import { User } from "../types";
import { 
  ShieldCheck, 
  Crown, 
  Users, 
  Building2, 
  Clock, 
  Search, 
  CheckCircle, 
  XCircle, 
  Megaphone, 
  Settings, 
  CreditCard, 
  ToggleLeft, 
  ToggleRight, 
  History, 
  Activity, 
  Plus, 
  ArrowRight,
  ExternalLink,
  Smartphone,
  Calendar,
  AlertTriangle,
  FileText
} from "lucide-react";
import { motion } from "motion/react";

interface AdminDashboardViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
  language?: "bn" | "en";
}

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: number;
}

export default function AdminDashboardView({ 
  currentUser, 
  onNavigate, 
  language = "bn" 
}: AdminDashboardViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [transactionRequests, setTransactionRequests] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPlan, setFilterPlan] = useState<"all" | "free" | "monthly" | "yearly" | "requested" | "active" | "pending">("all");

  // Gateway Settings state
  const [gatewayEnabled, setGatewayEnabled] = useState(false);
  const [gatewayDisplayName, setGatewayDisplayName] = useState("অফিসিয়াল অনলাইন গেটওয়ে");
  const [updatingGateway, setUpdatingGateway] = useState(false);

  // Manual subscription modal state
  const [selectedCompany, setSelectedCompany] = useState<User | null>(null);
  const [modalPlan, setModalPlan] = useState<"free" | "monthly" | "yearly">("monthly");
  const [modalDurationDays, setModalDurationDays] = useState(30);
  const [manuallyUpdating, setManuallyUpdating] = useState(false);

  // Success/error messages
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // 1. Fetch Users in Realtime
  useEffect(() => {
    setLoading(true);
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        list.push({ docId: d.id, ...d.data() } as User);
      });
      setUsers(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching users for admin:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // 1b. Fetch Transaction Requests in Realtime
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "transaction_requests"), (snap) => {
      const list: any[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() });
      });
      setTransactionRequests(list);
    }, (err) => {
      console.error("Error fetching transaction requests:", err);
    });

    return () => unsub();
  }, []);

  // Handle General Company status update (Approve / Activate / Block)
  const handleUpdateCompanyStatus = async (company: User, newStatus: "active" | "pending" | "deactive") => {
    try {
      const companyRef = doc(db, "users", company.docId);
      await updateDoc(companyRef, {
        status: newStatus
      });

      // Write System Log
      await addDoc(collection(db, "activity_logs"), {
        userId: company.docId,
        userName: company.companyName || company.name || "কোম্পানি",
        action: `COMPANY_STATUS_${newStatus.toUpperCase()}`,
        details: `কোম্পানির অ্যাকাউন্ট স্ট্যাটাস পরিবর্তন করে "${newStatus === "active" ? "সক্রিয় (Active)" : newStatus === "pending" ? "পেন্ডিং (Pending)" : "নিষ্ক্রিয় (Deactive)"}" করা হয়েছে।`,
        timestamp: Date.now()
      });

      // Send Notification to company
      await addDoc(collection(db, "notifications"), {
        title: `⚙️ অ্যাকাউন্ট অ্যাক্টিভেশন স্ট্যাটাস আপডেট`,
        body: `সিস্টেম অ্যাডমিন কর্তৃক আপনার কোম্পানি খাতা অ্যাকাউন্টটি সফলভাবে "${newStatus === "active" ? "সক্রিয় করা হয়েছে" : newStatus === "pending" ? "পেন্ডিং করা হয়েছে" : "ব্লক/নিষ্ক্রিয় করা হয়েছে"}"।`,
        senderId: currentUser.docId,
        senderName: "System Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: company.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      showToast(`🎉 "${company.companyName || company.name}" এর স্ট্যাটাস সফলভাবে "${newStatus === "active" ? "সক্রিয়" : newStatus === "pending" ? "পেন্ডিং" : "নিষ্ক্রিয়"}" করা হয়েছে!`);
    } catch (err: any) {
      console.error("Error updating company status:", err);
      showToast("❌ স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে: " + err.message, "error");
    }
  };

  // 2. Fetch Activity Logs
  useEffect(() => {
    const q = query(
      collection(db, "activity_logs"),
      orderBy("timestamp", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, (snap) => {
      const logs: ActivityLog[] = [];
      snap.forEach((d) => {
        logs.push({ id: d.id, ...d.data() } as ActivityLog);
      });
      setActivityLogs(logs);
    }, (err) => {
      console.warn("Could not fetch activity logs (index may be building):", err.message);
    });

    return () => unsub();
  }, []);

  // 3. Fetch Gateway Settings
  useEffect(() => {
    const adminGatewayRef = doc(db, "gateway_settings", "admin");
    const unsub = onSnapshot(adminGatewayRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setGatewayEnabled(!!data.enabled);
        setGatewayDisplayName(data.displayName || "অফিসিয়াল অনলাইন গেটওয়ে");
      }
    }, (err) => {
      console.error("Error reading gateway settings:", err);
    });

    return () => unsub();
  }, []);

  // Handle Gateway Update
  const handleToggleGateway = async () => {
    setUpdatingGateway(true);
    try {
      const adminGatewayRef = doc(db, "gateway_settings", "admin");
      await setDoc(adminGatewayRef, {
        enabled: !gatewayEnabled,
        displayName: gatewayDisplayName,
        updatedAt: Date.now()
      }, { merge: true });
      showToast(`✅ পেমেন্ট গেটওয়ে ${!gatewayEnabled ? "চালু" : "বন্ধ"} করা হয়েছে।`);
    } catch (err: any) {
      console.error("Error updating gateway settings:", err);
      showToast("❌ গেটওয়ে আপডেট করতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
      setUpdatingGateway(false);
    }
  };

  const handleUpdateGatewayName = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingGateway(true);
    try {
      const adminGatewayRef = doc(db, "gateway_settings", "admin");
      await setDoc(adminGatewayRef, {
        displayName: gatewayDisplayName,
        updatedAt: Date.now()
      }, { merge: true });
      showToast("✅ গেটওয়ে ডিসপ্লে নাম সফলভাবে পরিবর্তন করা হয়েছে।");
    } catch (err: any) {
      console.error("Error updating gateway name:", err);
      showToast("❌ আপডেট করতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
      setUpdatingGateway(false);
    }
  };

  // Manual Plan Update for a Company
  const handleOpenManualPlan = (company: User) => {
    setSelectedCompany(company);
    setModalPlan(company.plan || "free");
    setModalDurationDays(company.plan === "yearly" ? 365 : 30);
  };

  const handleSaveManualPlan = async () => {
    if (!selectedCompany) return;
    setManuallyUpdating(true);
    try {
      const expireTime = modalPlan === "free" ? null : Date.now() + modalDurationDays * 24 * 60 * 60 * 1000;
      
      const companyRef = doc(db, "users", selectedCompany.docId);
      await updateDoc(companyRef, {
        plan: modalPlan,
        planActiveUntil: expireTime,
        planRequested: null // clear any requests
      });

      // Write System Log
      await addDoc(collection(db, "activity_logs"), {
        userId: selectedCompany.docId,
        userName: selectedCompany.companyName || selectedCompany.name,
        action: "ADMIN_MANUAL_PLAN_UPDATE",
        details: `অ্যাডমিন কর্তৃক ম্যানুয়ালি ${modalPlan === "free" ? "ফ্রি" : modalPlan === "monthly" ? "মাসিক" : "বাৎসরিক"} প্ল্যান সেট করা হয়েছে (মেয়াদঃ ${modalPlan === "free" ? "চলবে না" : `${modalDurationDays} দিন`})।`,
        timestamp: Date.now()
      });

      // Notify company
      await addDoc(collection(db, "notifications"), {
        title: "⚙️ আপনার সাবস্ক্রিপশন ম্যানুয়ালি আপডেট করা হয়েছে",
        body: `সিস্টেম অ্যাডমিন কর্তৃক আপনার কোম্পানি অ্যাকাউন্টটি "${modalPlan === "free" ? "ফ্রি" : modalPlan === "monthly" ? "মাসিক প্রিমিয়াম" : "বাৎসরিক ভিআইপি"}" প্ল্যানে স্থানান্তর করা হয়েছে।`,
        senderId: currentUser.docId,
        senderName: "System Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: selectedCompany.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      showToast(`🎉 "${selectedCompany.companyName || selectedCompany.name}" এর প্ল্যান সফলভাবে আপডেট হয়েছে!`);
      setSelectedCompany(null);
    } catch (err: any) {
      console.error("Error saving manual plan:", err);
      showToast("❌ প্ল্যান পরিবর্তন করতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
      setManuallyUpdating(false);
    }
  };

  // Metrics calculations
  const companies = users.filter(u => u.role === "company");
  const totalCompanies = companies.length;
  const totalMembers = users.filter(u => u.role === "member").length;

  // 1. active and pending companies counts
  const activeCompaniesCount = companies.filter(c => c.status === "active" || !c.status).length;
  const pendingCompaniesCount = companies.filter(c => c.status === "pending" || c.status === "request").length;

  const freeCompaniesCount = companies.filter(c => !c.plan || c.plan === "free").length;
  const monthlyCompaniesCount = companies.filter(c => c.plan === "monthly").length;
  const yearlyCompaniesCount = companies.filter(c => c.plan === "yearly").length;

  // 2. active subscriptions count
  const activePremiumCompanies = companies.filter(c => 
    c.plan && c.plan !== "free" && (!c.planActiveUntil || c.planActiveUntil > Date.now())
  );
  const activePremiumCount = activePremiumCompanies.length;

  // 3. pending subscription requests count
  const pendingRequestsCount = companies.filter(c => c.planRequested).length;

  // 4. payment requests count (subscription requests containing a TxID or payment method)
  const paymentRequestsCount = companies.filter(c => c.planRequested && (c.planRequestTxId || c.planRequestMobile)).length;

  // 5. active member requests count (from transaction_requests collection)
  const activeRequestsCount = transactionRequests.filter(r => r.status === "pending").length;

  // Filtered list of companies for directory
  const filteredCompaniesList = companies.filter(c => {
    const matchesSearch = 
      (c.companyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.mobile || "").includes(searchQuery) ||
      (c.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (filterPlan === "all") return matchesSearch;
    if (filterPlan === "free") return matchesSearch && (!c.plan || c.plan === "free");
    if (filterPlan === "monthly") return matchesSearch && c.plan === "monthly";
    if (filterPlan === "yearly") return matchesSearch && c.plan === "yearly";
    if (filterPlan === "requested") return matchesSearch && !!c.planRequested;
    if (filterPlan === "active") return matchesSearch && (c.status === "active" || !c.status);
    if (filterPlan === "pending") return matchesSearch && (c.status === "pending" || c.status === "request");

    return matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans select-none animate-fadeIn">
      
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl border animate-slideIn text-xs font-bold ${
          toastMsg.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 text-emerald-800 dark:text-emerald-300" 
            : "bg-rose-50 dark:bg-rose-950/90 border-rose-200 text-rose-800 dark:text-rose-300"
        }`}>
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 hover:scale-110 active:scale-95 transition">
            <XCircle className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        </div>
      )}

      {/* Main Admin Dashboard Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-5 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 shadow-sm animate-pulse">
              <ShieldCheck className="w-5 h-5" />
            </span>
            সুপার অ্যাডমিন ড্যাশবোর্ড
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1.5 leading-normal">
            মেম্বার খাতা ও সঞ্চয় ড্যাশবোর্ড প্ল্যাটফর্মের সেন্ট্রাল মনিটরিং এবং সাবস্ক্রিপশন কন্ট্রোল প্যানেল।
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onNavigate("subscription-requests")}
            className="text-xs bg-amber-600 hover:bg-amber-700 text-white transition px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 shadow-sm relative"
          >
            <Crown className="w-4 h-4 text-amber-200" />
            অনুমোদন অপেক্ষমাণ
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-bounce border-2 border-white dark:border-slate-900">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onNavigate("ad-management")}
            className="text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 active:scale-95"
          >
            <Megaphone className="w-4 h-4 text-indigo-500" />
            বিজ্ঞাপন কন্ট্রোল
          </button>
        </div>
      </div>

      {/* KPI Stats Bento Grid (6 core metrics requested by user) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        
        {/* 1. Active Companies Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-300 relative group">
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-wider uppercase text-emerald-605 dark:text-emerald-500">একটিভ কোম্পানি</p>
            <h3 className="text-xl sm:text-2xl font-black text-emerald-605 dark:text-emerald-400 font-mono">
              {activeCompaniesCount} <span className="text-[10px] font-bold text-slate-400">টি</span>
            </h3>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button 
              onClick={() => { setFilterPlan("active"); setSearchQuery(""); }} 
              className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
            >
              তালিকা দেখুন →
            </button>
            <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <Building2 className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* 2. Pending Companies Card */}
        <div className={`bg-white dark:bg-slate-900 border p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-300 relative group ${
          pendingCompaniesCount > 0 ? "border-amber-300 dark:border-amber-900 bg-amber-50/5 dark:bg-amber-950/5 animate-pulse" : "border-slate-200 dark:border-slate-800"
        }`}>
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-wider uppercase text-amber-500">পেন্ডিং কম্পানি</p>
            <h3 className={`text-xl sm:text-2xl font-black font-mono ${pendingCompaniesCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
              {pendingCompaniesCount} <span className="text-[10px] font-bold text-slate-400">টি</span>
            </h3>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button 
              onClick={() => { setFilterPlan("pending"); setSearchQuery(""); }} 
              className="text-[9px] font-black text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-0.5"
            >
              অনুমোদন দিন →
            </button>
            <span className={`p-1.5 rounded-lg ${pendingCompaniesCount > 0 ? "bg-amber-100 dark:bg-amber-900 text-amber-700" : "bg-slate-100 dark:bg-slate-950 text-slate-450"}`}>
              <Clock className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* 3. Active Requests Card (Member deposits/withdrawals) */}
        <div className={`bg-white dark:bg-slate-900 border p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-300 relative group ${
          activeRequestsCount > 0 ? "border-blue-300 dark:border-blue-900 bg-blue-50/5 dark:bg-blue-950/5" : "border-slate-200 dark:border-slate-800"
        }`}>
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-wider uppercase text-blue-500">একটিভ রিকোয়েস্ট</p>
            <h3 className="text-xl sm:text-2xl font-black text-blue-600 dark:text-blue-400 font-mono">
              {activeRequestsCount} <span className="text-[10px] font-bold text-slate-400">টি</span>
            </h3>
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[9px] text-slate-400 font-bold">সোসাইটি ট্রানজেকশন</p>
            <span className="p-1.5 bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Activity className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* 4. Active Subscriptions Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-300 relative group">
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-wider uppercase text-indigo-500">একটি সাবস্ক্রিপশন</p>
            <h3 className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {activePremiumCount} <span className="text-[10px] font-bold text-slate-400">টি</span>
            </h3>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button 
              onClick={() => { setFilterPlan("all"); setSearchQuery(""); }} 
              className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
            >
              কোম্পানি সমূহ →
            </button>
            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Crown className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* 5. Pending Subscription Requests Card */}
        <div className={`bg-white dark:bg-slate-900 border p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-300 relative group ${
          pendingRequestsCount > 0 ? "border-rose-300 dark:border-rose-900 bg-rose-50/5 dark:bg-rose-950/5 animate-pulse" : "border-slate-200 dark:border-slate-800"
        }`}>
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-wider uppercase text-rose-500">পেন্ডিং সাবস্ক্রিপশন</p>
            <h3 className={`text-xl sm:text-2xl font-black font-mono ${pendingRequestsCount > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-600 dark:text-slate-400"}`}>
              {pendingRequestsCount} <span className="text-[10px] font-bold text-slate-400">টি</span>
            </h3>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button 
              onClick={() => onNavigate("subscription-requests")}
              className="text-[9px] font-black text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-0.5"
            >
              অনুমোদন দিন →
            </button>
            <span className={`p-1.5 rounded-lg ${pendingRequestsCount > 0 ? "bg-rose-100 dark:bg-rose-950 text-rose-600" : "bg-slate-100 dark:bg-slate-950 text-slate-400"}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
        </div>

        {/* 6. Payment Requests Card */}
        <div className={`bg-white dark:bg-slate-900 border p-4 rounded-2xl shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition duration-300 relative group ${
          paymentRequestsCount > 0 ? "border-violet-300 dark:border-violet-900 bg-violet-50/5" : "border-slate-200 dark:border-slate-800"
        }`}>
          <div className="space-y-1">
            <p className="text-[9px] font-black tracking-wider uppercase text-violet-500">পেমেন্ট রিকোয়েস্ট</p>
            <h3 className="text-xl sm:text-2xl font-black text-violet-600 dark:text-violet-400 font-mono">
              {paymentRequestsCount} <span className="text-[10px] font-bold text-slate-400">টি</span>
            </h3>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button 
              onClick={() => onNavigate("subscription-requests")}
              className="text-[9px] font-black text-violet-600 dark:text-violet-400 hover:underline flex items-center gap-0.5"
            >
              TxID ভেরিফাই →
            </button>
            <span className="p-1.5 bg-violet-50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 rounded-lg">
              <CreditCard className="w-4 h-4" />
            </span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Company Directory & Configuration */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Company Plan Control & Search */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-150 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/40 dark:bg-slate-900/40">
              <div>
                <h3 className="text-xs font-black text-slate-750 dark:text-slate-250 uppercase tracking-wider">কোম্পানি সাবস্ক্রিপশন ও অ্যাকাউন্ট কন্ট্রোল</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">ম্যানুয়ালি কোম্পানির প্ল্যান পরিবর্তন, রিনিউ এবং সদস্য খাতা মনিটর করুন</p>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {/* Custom plan filter dropdown */}
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value as any)}
                  className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-black rounded-xl outline-none focus:border-indigo-500 cursor-pointer text-slate-700 dark:text-slate-300"
                >
                  <option value="all">সকল কোম্পানি</option>
                  <option value="active">সক্রিয় কোম্পানি</option>
                  <option value="pending">অপেক্ষমাণ কোম্পানি</option>
                  <option value="free">ফ্রি খাতা</option>
                  <option value="monthly">মাসিক প্রিমিয়াম</option>
                  <option value="yearly">বাৎসরিক ভিআইপি</option>
                  <option value="requested">সাবস্ক্রিপশন অপেক্ষমাণ</option>
                </select>

                <div className="relative w-full sm:w-52">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-3 w-3 text-slate-400" />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="নাম, মোবাইল বা ইমেইল..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[10px] font-semibold bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* Companies List */}
            {loading ? (
              <div className="p-16 text-center text-slate-400">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-3"></div>
                <p className="text-xs font-bold text-slate-450">কোম্পানি খাতা ডাটা লোড হচ্ছে...</p>
              </div>
            ) : filteredCompaniesList.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 border border-slate-150 dark:border-slate-850 text-slate-300 flex items-center justify-center rounded-2xl mx-auto mb-3">
                  <Building2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">কোনো কোম্পানির অ্যাকাউন্ট পাওয়া যায়নি</p>
                <p className="text-[10px] text-slate-400 mt-0.5">সার্চ কুয়েরি বা ফিল্টার পরিবর্তন করে পুনরায় চেষ্টা করুন।</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-150 dark:divide-slate-850 max-h-[500px] overflow-y-auto">
                {filteredCompaniesList.map((c) => {
                  const companyMembersCount = users.filter(m => m.role === "member" && m.companyId === c.docId).length;
                  const isActivePlan = c.plan && c.plan !== "free" && (!c.planActiveUntil || c.planActiveUntil > Date.now());
                  const isAccountPending = c.status === "pending" || c.status === "request";
                  const isAccountDeactive = c.status === "deactive";
                  const isAccountActive = !c.status || c.status === "active";
                  
                  return (
                    <div key={c.docId} className="p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-slate-50/40 dark:hover:bg-slate-900/25 transition">
                      
                      {/* Left side details */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{c.companyName || c.name || "নামহীন কোম্পানি"}</h4>
                          
                          {/* Plan pill */}
                          {c.plan === "monthly" ? (
                            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-amber-200/30">মাসিক প্রিমিয়াম</span>
                          ) : c.plan === "yearly" ? (
                            <span className="bg-indigo-100 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-400 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-indigo-200/30">বাৎসরিক ভিআইপি</span>
                          ) : (
                            <span className="bg-slate-100 dark:bg-slate-950 text-slate-500 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-slate-250">ফ্রি খাতা</span>
                          )}

                          {/* Account status pill */}
                          {isAccountActive && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-emerald-200/20">সক্রিয় অ্যাকাউন্ট</span>
                          )}
                          {isAccountPending && (
                            <span className="bg-amber-50 dark:bg-amber-950/30 text-amber-750 dark:text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-amber-200/20 animate-pulse">পেন্ডিং অ্যাকাউন্ট</span>
                          )}
                          {isAccountDeactive && (
                            <span className="bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 text-[8px] font-black px-1.5 py-0.5 rounded-md border border-rose-200/20">নিষ্ক্রিয় / ব্লক</span>
                          )}

                          {/* Plan request notification indicator */}
                          {c.planRequested && (
                            <span className="bg-rose-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full animate-pulse">সাবস্ক্রিপশন অপেক্ষমাণ</span>
                          )}
                        </div>
 
                        {/* Contact details */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-450 font-bold">
                          <div>মোবাইলঃ <span className="font-mono text-slate-600 dark:text-slate-350">{c.mobile || "প্রদান করা হয়নি"}</span></div>
                          <div>ইমেইলঃ <span className="font-mono text-slate-600 dark:text-slate-350">{c.email || "প্রদান করা হয়নি"}</span></div>
                          <div>সদস্য সংখ্যাঃ <span className="text-indigo-600 dark:text-indigo-450 font-black">{companyMembersCount} জন</span></div>
                          {c.planActiveUntil && c.plan !== "free" && (
                            <div className="text-emerald-600 dark:text-emerald-400">মেয়াদঃ {new Date(c.planActiveUntil).toLocaleDateString("bn-BD", { year: "numeric", month: "short", day: "numeric" })} পর্যন্ত</div>
                          )}
                        </div>
                      </div>
 
                      {/* Right side actions */}
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {/* Account status controls */}
                        {isAccountPending && (
                          <button
                            onClick={() => handleUpdateCompanyStatus(c, "active")}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black rounded-lg active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            অ্যাক্টিভ করুন
                          </button>
                        )}
                        {isAccountDeactive && (
                          <button
                            onClick={() => handleUpdateCompanyStatus(c, "active")}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black rounded-lg active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            আন-ব্লক করুন
                          </button>
                        )}
                        {isAccountActive && (
                          <button
                            onClick={() => handleUpdateCompanyStatus(c, "deactive")}
                            className="px-2.5 py-1.5 bg-white dark:bg-slate-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 border border-slate-200 dark:border-slate-800 text-rose-600 dark:text-rose-450 text-[9.5px] font-black rounded-lg active:scale-95 transition cursor-pointer flex items-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5 text-rose-500" />
                            ব্লক করুন
                          </button>
                        )}

                        {c.planRequested && (
                          <button
                            onClick={() => onNavigate("subscription-requests")}
                            className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-[9.5px] font-black rounded-lg active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            পেমেন্ট যাচাই
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenManualPlan(c)}
                          className="px-2.5 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 hover:border-indigo-500 text-slate-700 dark:text-slate-300 text-[9.5px] font-black rounded-lg active:scale-95 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-450" />
                          প্ল্যান পরিবর্তন
                        </button>
                      </div>
 
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Payment Gateway Configuration Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-850 pb-3 flex items-center gap-2">
              <span className="p-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <CreditCard className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-black text-slate-750 dark:text-slate-250 uppercase tracking-wider">সেন্ট্রাল অনলাইন পেমেন্ট গেটওয়ে সেটিংস</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">গ্রাহক কোম্পানির সাবস্ক্রিপশন অটো-অ্যাক্টিভেশন গেটওয়ে সেটিংস</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
              
              {/* Toggle switch state */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">অনলাইন পেমেন্ট গেটওয়ে</h4>
                  <p className="text-[10px] text-slate-450 font-semibold leading-normal">
                    গেটওয়ে অন থাকলে সোসাইটি পেমেন্ট সম্পন্ন করা মাত্রই প্রিমিয়াম সাবস্ক্রিপশন প্ল্যান অটো-অ্যাক্টিভ হয়ে যাবে।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleGateway}
                  disabled={updatingGateway}
                  className="text-indigo-600 hover:text-indigo-700 transition cursor-pointer disabled:opacity-50"
                >
                  {gatewayEnabled ? (
                    <ToggleRight className="w-12 h-12 stroke-[1.5px]" />
                  ) : (
                    <ToggleLeft className="w-12 h-12 stroke-[1.5px] text-slate-400" />
                  )}
                </button>
              </div>

              {/* Display name update */}
              <form onSubmit={handleUpdateGatewayName} className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-150 dark:border-slate-850 rounded-2xl space-y-3 flex flex-col justify-between">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">গেটওয়ে ডিসপ্লে নাম (বাংলায়)</label>
                  <input
                    type="text"
                    value={gatewayDisplayName}
                    onChange={(e) => setGatewayDisplayName(e.target.value)}
                    placeholder="Bkash/Nagad Online Checkout"
                    className="w-full text-xs font-extrabold border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingGateway}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-[10px] font-black rounded-lg shadow-sm active:scale-98 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  ডিসপ্লে নাম আপডেট করুন
                </button>
              </form>

            </div>
          </div>

        </div>

        {/* Right 1 Column: Platform Activity History Stream */}
        <div className="space-y-6">
          
          {/* Admin System & Activity Log Box */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden p-5 sm:p-6 space-y-4 flex flex-col h-full max-h-[820px]">
            <div className="border-b border-slate-100 dark:border-slate-850 pb-3 flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                <Activity className="w-4 h-4 animate-pulse" />
              </span>
              <div>
                <h3 className="text-xs font-black text-slate-750 dark:text-slate-250 uppercase tracking-wider">রিয়েল-টাইম প্ল্যাটফর্ম লগ</h3>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">প্ল্যাটফর্মের সাবস্ক্রিপশন, অ্যাক্টিভেশন ও পরিবর্তন হিস্ট্রি</p>
              </div>
            </div>

            {/* Log stream items */}
            <div className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
              {activityLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-450 border border-dashed border-slate-150 rounded-2xl">
                  <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold">বর্তমানে কোনো লগ হিস্ট্রি নেই</p>
                  <p className="text-[9px] text-slate-400 mt-0.5">কোম্পানি কার্যক্রম শুরু হলে এখানে লগ দেখতে পাবেন।</p>
                </div>
              ) : (
                <div className="relative border-l border-indigo-100 dark:border-indigo-950 pl-4.5 ml-2 space-y-5">
                  {activityLogs.map((log) => {
                    const dateObj = new Date(log.timestamp);
                    const formattedTime = dateObj.toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" });
                    const formattedDate = dateObj.toLocaleDateString("bn-BD", { month: "short", day: "numeric" });
                    
                    return (
                      <div key={log.id} className="relative group">
                        {/* Timeline bubble */}
                        <span className="absolute -left-[24.5px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white dark:border-slate-900 shadow-xs ring-4 ring-indigo-50 dark:ring-indigo-950/40 group-hover:scale-110 transition shrink-0" />
                        
                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-[9px] font-bold text-slate-400">
                            <span className="text-indigo-600 dark:text-indigo-400 font-black">{log.userName || "অজানা ইউজার"}</span>
                            <span>{formattedDate}, {formattedTime}</span>
                          </div>
                          
                          <p className="text-[10px] font-bold text-slate-700 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-150/50 dark:border-slate-850/40 leading-relaxed">
                            {log.details || log.action}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Manual Plan Configuration Modal Dialog */}
      {selectedCompany && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[2000] p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 text-left font-sans border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5 border-b dark:border-slate-800 pb-3 text-indigo-650 dark:text-indigo-400">
              <span className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                <Settings className="w-5 h-5" />
              </span>
              <div>
                <h3 className="font-black text-slate-800 dark:text-slate-100 text-xs sm:text-sm uppercase tracking-wide">ম্যানুয়াল সাবস্ক্রিপশন প্ল্যান আপডেট</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">কোম্পানিঃ {selectedCompany.companyName || selectedCompany.name}</p>
              </div>
            </div>

            <div className="space-y-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
              {/* Select target plan */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider">কাঙ্ক্ষিত প্ল্যান নির্বাচন করুন</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setModalPlan("free");
                      setModalDurationDays(0);
                    }}
                    className={`py-2 px-3 border rounded-xl text-[10px] font-black tracking-wide transition ${
                      modalPlan === "free"
                        ? "bg-slate-650 text-white border-slate-650"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    ফ্রি খাতা
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalPlan("monthly");
                      setModalDurationDays(30);
                    }}
                    className={`py-2 px-3 border rounded-xl text-[10px] font-black tracking-wide transition ${
                      modalPlan === "monthly"
                        ? "bg-amber-600 text-white border-amber-650"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    মাসিক প্রিমিয়াম
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalPlan("yearly");
                      setModalDurationDays(365);
                    }}
                    className={`py-2 px-3 border rounded-xl text-[10px] font-black tracking-wide transition ${
                      modalPlan === "yearly"
                        ? "bg-indigo-600 text-white border-indigo-650"
                        : "bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-350 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    বাৎসরিক ভিআইপি
                  </button>
                </div>
              </div>

              {/* Set custom validity duration in days (Only shown if monthly/yearly is selected) */}
              {modalPlan !== "free" && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-[10px] font-black text-slate-450 uppercase tracking-wider">প্যাকের মেয়াদ (কত দিনের জন্য সচল থাকবে)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={modalDurationDays}
                      onChange={(e) => setModalDurationDays(Math.max(1, parseInt(e.target.value) || 0))}
                      placeholder="30"
                      className="w-full text-xs font-extrabold border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                    <span className="text-xs text-slate-400 font-bold shrink-0">দিন</span>
                  </div>
                  <p className="text-[9px] text-slate-400">মেয়াদ উত্তীর্ণ হওয়ার পর অ্যাকাউন্টটি পুনরায় ফ্রি লেভেলে স্থানান্তরিত হবে।</p>
                </div>
              )}
            </div>

            {/* Buttons control footer */}
            <div className="flex gap-2.5 pt-3 border-t dark:border-slate-800">
              <button
                onClick={handleSaveManualPlan}
                disabled={manuallyUpdating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5"
              >
                {manuallyUpdating && <Clock className="w-3.5 h-3.5 animate-spin" />}
                সংরক্ষণ করুন
              </button>
              <button
                onClick={() => setSelectedCompany(null)}
                className="flex-1 bg-slate-150 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-400 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                বাতিল
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
