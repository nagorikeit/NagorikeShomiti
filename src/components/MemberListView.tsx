import { useState, useEffect } from "react";
import { collection, doc, deleteDoc, updateDoc, onSnapshot, getDocs, addDoc } from "firebase/firestore";
import { db, secondaryAuth } from "../firebase";
import { User } from "../types";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  ROLE_LABELS,
  ACCT_LABELS,
  INVEST_LABELS,
  formatBDT,
} from "../utils/firestore";
import { Search, Plus, ArrowLeft, Trash2, ToggleRight, User as UserIcon, Key, Mail, MessageSquare, Copy, Check, ShieldAlert } from "lucide-react";

interface MemberListViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
}

export default function MemberListView({ currentUser, onNavigate }: MemberListViewProps) {
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");

  // Modals/Overlays
  const [statusTarget, setStatusTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // OTP management states
  const [otpTarget, setOtpTarget] = useState<User | null>(null);
  const [otpPass, setOtpPass] = useState("");
  const [otpRequireChange, setOtpRequireChange] = useState(true);
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);

  const toBanglaDigits = (num: number | string) => {
    const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return num.toString().replace(/\d/g, (d) => banglaDigits[parseInt(d)]);
  };

  useEffect(() => {
    setLoading(true);
    // Realtime listeners
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const usersList: User[] = [];
      const companyList: { id: string; name: string }[] = [];

      snapshot.forEach((d) => {
        const u = { docId: d.id, ...d.data() } as User;
        usersList.push(u);
        if (u.role === "company") {
          companyList.push({ id: d.id, name: u.companyName || u.name || d.id });
        }
      });

      // Filter based on loggedIn user role
      let filtered: User[] = [];
      if (currentUser.role === "admin") {
        // Admin sees all companies and members
        filtered = usersList.filter((u) => u.role === "member" || u.role === "company");
      } else if (currentUser.role === "company") {
        // Company sees only their members
        filtered = usersList.filter((u) => u.companyId === currentUser.docId && u.role === "member");
      } else if (currentUser.role === "member") {
        // Member sees depending on permission
        if (currentUser.canSeeAllData) {
          filtered = usersList.filter((u) => u.companyId === currentUser.companyId && u.role === "member");
        } else {
          filtered = usersList.filter((u) => u.docId === currentUser.docId);
        }
      }

      // Sort by creation time desc
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      setAllUsers(filtered);
      setCompanies(companyList);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser]);

  // No arrears or savings computations are loaded here, as arrears has its own dedicated page.

  const handleStatusChange = async (newStatus: "active" | "pending" | "request" | "deactive") => {
    if (!statusTarget) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", statusTarget.docId), { status: newStatus });
      setStatusTarget(null);
    } catch (e) {
      console.error(e);
      alert("স্ট্যাটাস আপডেট করা যায়নি");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      // 1. Delete history subcollection documents
      const histSnap = await getDocs(collection(db, "users", deleteTarget.docId, "history"));
      for (const d of histSnap.docs) {
        await deleteDoc(d.ref);
      }
      // 2. Delete user document
      await deleteDoc(doc(db, "users", deleteTarget.docId));
      setDeleteTarget(null);
    } catch (e) {
      console.error(e);
      alert("ডিলিট করা যায়নি");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenOtpModal = (user: User) => {
    setOtpTarget(user);
    // Generate a secure 6-digit random number as OTP by default
    const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpPass(randomOtp);
    setOtpRequireChange(true);
    setOtpSuccess(false);
    setOtpCopied(false);
  };

  const handleSaveOtp = async () => {
    if (!otpTarget) return;
    const trimmedPass = otpPass.trim();
    if (!trimmedPass) {
      alert("অনুগ্রহ করে একটি ওটিপি পাসওয়ার্ড লিখুন");
      return;
    }
    setOtpSending(true);
    try {
      // Normalize mobile number
      const rawMobile = otpTarget.mobile || "";
      const normMobile = rawMobile.replace(/\D/g, "");
      const memberEmail = otpTarget.firebaseAuthEmail || otpTarget.email || `${normMobile}@samitymanager.com`;
      const oldPassword = otpTarget.password || "";

      // 1. Update in secondaryAuth
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut } = await import("firebase/auth");
      
      if (oldPassword) {
        try {
          const secCred = await signInWithEmailAndPassword(secondaryAuth, memberEmail, oldPassword);
          await updatePassword(secCred.user, trimmedPass);
          await signOut(secondaryAuth);
          console.log("Successfully updated password in Firebase Auth via secondaryAuth");
        } catch (authErr: any) {
          console.warn("Could not update secondary password via login, trying creation:", authErr);
          if (authErr.code === "auth/user-not-found" || authErr.code === "auth/invalid-credential" || authErr.code === "auth/cannot-delete-owner") {
            try {
              await createUserWithEmailAndPassword(secondaryAuth, memberEmail, trimmedPass);
              await signOut(secondaryAuth);
            } catch (createErr) {
              console.warn("Failed to create secondaryAuth account on-demand:", createErr);
            }
          }
        }
      } else {
        try {
          await createUserWithEmailAndPassword(secondaryAuth, memberEmail, trimmedPass);
          await signOut(secondaryAuth);
        } catch (createErr) {
          console.warn("Failed to create secondaryAuth account for new password:", createErr);
        }
      }

      // 2. Update user collection doc
      await updateDoc(doc(db, "users", otpTarget.docId), {
        password: trimmedPass,
        requirePasswordChange: otpRequireChange,
      });

      // 3. Update phone_to_email mapping
      if (normMobile) {
        await updateDoc(doc(db, "phone_to_email", normMobile), {
          password: trimmedPass,
        }).catch((err) => console.warn("Failed to update phone_to_email password mapping:", err));
      }

      setOtpSuccess(true);
      alert("মেম্বারের জন্য পাসওয়ার্ড/ওটিপি সফলভাবে সেট করা হয়েছে!");
    } catch (e: any) {
      console.error(e);
      alert("ওটিপি সেট করতে সমস্যা হয়েছে: " + e.message);
    } finally {
      setOtpSending(false);
    }
  };

  const handleApproveSubscription = async (user: User) => {
    if (!window.confirm(`আপনি কি এই কোম্পানির ${user.planRequested === "monthly" ? "মাসিক" : "বাৎসরিক"} সাবস্ক্রিপশন সফলভাবে সক্রিয় করতে চান?`)) {
      return;
    }
    setActionLoading(true);
    try {
      const planRequested = user.planRequested || "monthly";
      const days = planRequested === "monthly" ? 30 : 365;
      const expireTime = Date.now() + days * 24 * 60 * 60 * 1000;

      await updateDoc(doc(db, "users", user.docId), {
        plan: planRequested,
        planActiveUntil: expireTime,
        planRequested: null,
        planRequestTxId: "",
        planRequestMobile: "",
        planRequestAmount: 0,
        planRequestAt: 0,
      });

      // Send a notification to the company
      await addDoc(collection(db, "notifications"), {
        title: "🎉 অভিনন্দন! আপনার সাবস্ক্রিপশন অ্যাক্টিভ হয়েছে",
        body: `আপনার ${planRequested === "monthly" ? "মাসিক" : "বাৎসরিক"} প্রিমিয়াম সাবস্ক্রিপশন প্ল্যানটি সফলভাবে ভেরিফাই করে সক্রিয় করা হয়েছে। এখন থেকে আনলিমিটেড সার্ভিস ব্যবহার করতে পারবেন।`,
        senderId: currentUser.docId,
        senderName: "Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: user.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      alert("সাবস্ক্রিপশন সফলভাবে সক্রিয় করা হয়েছে!");
    } catch (e) {
      console.error(e);
      alert("সাবস্ক্রিপশন সক্রিয় করা যায়নি");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubscription = async (user: User) => {
    if (!window.confirm("আপনি কি এই কোম্পানির সাবস্ক্রিপশন রিকোয়েস্ট বাতিল করতে চান?")) {
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, "users", user.docId), {
        planRequested: null,
        planRequestTxId: "",
        planRequestMobile: "",
        planRequestAmount: 0,
        planRequestAt: 0,
      });

      // Send notification to company
      await addDoc(collection(db, "notifications"), {
        title: "⚠️ সাবস্ক্রিপশন রিকোয়েস্ট বাতিল করা হয়েছে",
        body: "দুঃখিত, আপনার সাবস্ক্রিপশন রিকোয়েস্টটি বাতিল করা হয়েছে। অনুগ্রহ করে সঠিক ট্রানজেকশন তথ্য দিয়ে আবার চেষ্টা করুন বা অ্যাডমিনের সাথে যোগাযোগ করুন।",
        senderId: currentUser.docId,
        senderName: "Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: user.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      alert("রিকোয়েস্ট সফলভাবে বাতিল করা হয়েছে");
    } catch (e) {
      console.error(e);
      alert("রিকোয়েস্ট বাতিল করা যায়নি");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter application
  const filteredList = allUsers.filter((u) => {
    // Search filter
    const matchesSearch =
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.mobile?.includes(searchQuery) ||
      u.userId?.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter
    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "subscription" ? !!u.planRequested : u.status === selectedStatus);

    // Company filter (For Admin only)
    const matchesCompany =
      currentUser.role !== "admin" ||
      selectedCompany === "all" ||
      u.companyId === selectedCompany ||
      u.docId === selectedCompany;

    return matchesSearch && matchesStatus && matchesCompany;
  });

  return (
    <div className="pb-6 flex-1">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-5 rounded-b-3xl shadow-lg mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">সদস্য তালিকা</h1>
          <p className="text-xs text-blue-100 mt-0.5">
            {loading ? "লোড হচ্ছে..." : `মোট ${filteredList.length} জন`}
          </p>
        </div>
        <div className="flex gap-2">
          {currentUser.role !== "member" && (
            <button
              onClick={() => onNavigate("member-add")}
              className="text-xs bg-white text-blue-600 hover:bg-blue-50 transition px-3 py-1.5 rounded-full font-bold flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> নতুন
            </button>
          )}
          <button
            onClick={() => onNavigate("dashboard")}
            className="text-xs bg-white/20 hover:bg-white/30 transition px-3 py-1.5 rounded-full font-semibold flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> ড্যাশবোর্ড
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="নাম বা ফোন বা ইউজার আইডি দিয়ে খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-medium shadow-sm focus:border-blue-400"
          />
        </div>

        {/* Company Filters (Admin only) */}
        {currentUser.role === "admin" && companies.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">কোম্পানি ফিল্টার</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCompany("all")}
                className={`text-[11px] px-3.5 py-1.5 rounded-full font-bold transition whitespace-nowrap shrink-0 ${
                  selectedCompany === "all" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                }`}
              >
                সব কোম্পানি
              </button>
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCompany(c.id)}
                  className={`text-[11px] px-3.5 py-1.5 rounded-full font-bold transition whitespace-nowrap shrink-0 ${
                    selectedCompany === c.id ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Overview Grid */}
        <div className="bg-white p-4.5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">সদস্য স্ট্যাটাস সারসংক্ষেপ</span>
            {allUsers.filter((u) => u.status === "request").length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 text-[9px] font-bold animate-pulse border border-blue-100">
                ● নতুন অ্যাক্টিভেশন রিকোয়েস্ট পেন্ডিং
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Active Card */}
            <div 
              onClick={() => setSelectedStatus("active")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedStatus === "active" ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300" : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>সক্রিয়</span>
              </div>
              <p className="text-base font-black text-slate-800 mt-2">
                {toBanglaDigits(allUsers.filter((u) => u.status === "active").length)} জন
              </p>
            </div>

            {/* Request Card */}
            <div 
              onClick={() => setSelectedStatus("request")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedStatus === "request" ? "bg-blue-50/50 border-blue-300 ring-1 ring-blue-300" : "bg-slate-50/50 border-slate-100 hover:border-blue-200/60"
              } ${allUsers.filter((u) => u.status === "request").length > 0 ? "relative overflow-hidden" : ""}`}
            >
              {allUsers.filter((u) => u.status === "request").length > 0 && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-bl-lg" />
              )}
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600">
                <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 ${allUsers.filter((u) => u.status === "request").length > 0 ? "animate-ping" : ""}`} />
                <span>রিকোয়েস্ট</span>
              </div>
              <p className="text-base font-black text-slate-800 mt-2">
                {toBanglaDigits(allUsers.filter((u) => u.status === "request").length)} জন
              </p>
            </div>

            {/* Pending Card */}
            <div 
              onClick={() => setSelectedStatus("pending")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedStatus === "pending" ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-300" : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>পেন্ডিং</span>
              </div>
              <p className="text-base font-black text-slate-800 mt-2">
                {toBanglaDigits(allUsers.filter((u) => u.status === "pending").length)} জন
              </p>
            </div>

            {/* Deactive Card */}
            <div 
              onClick={() => setSelectedStatus("deactive")}
              className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedStatus === "deactive" ? "bg-red-50/50 border-red-300 ring-1 ring-red-300" : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
              }`}
            >
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-red-500">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span>নিষ্ক্রিয়</span>
              </div>
              <p className="text-base font-black text-slate-800 mt-2">
                {toBanglaDigits(allUsers.filter((u) => u.status === "deactive").length)} জন
              </p>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {["all", "active", "pending", "request", "deactive"].map((status) => {
            const count = status === "all"
              ? allUsers.length
              : allUsers.filter((u) => u.status === status).length;
            return (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`text-[11px] px-3.5 py-1.5 rounded-full font-bold transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  selectedStatus === status
                    ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                    : "bg-white text-slate-500 border border-slate-200 hover:border-slate-300"
                }`}
              >
                <span>{status === "all" ? "সবাই" : STATUS_LABELS[status] || status}</span>
                <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-black ${
                  selectedStatus === status ? "bg-white/30 text-white" : "bg-slate-100 text-slate-500"
                }`}>
                  {toBanglaDigits(count)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Members Cards List (Card View) */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-slate-400 text-xs">লোড হচ্ছে...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl">
            <p className="text-slate-400 text-sm">কোনো সদস্য পাওয়া যায়নি</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 xl:columns-4 gap-3">
            {filteredList.map((m) => {
              const displayName = m.companyName || m.name || "—";
              const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
                displayName
              )}&backgroundColor=${m.role === "company" ? "7c3aed" : "2563eb"}&textColor=ffffff`;

              const companyObj = companies.find((c) => c.id === m.companyId);

              return (
                <div key={m.docId} className="break-inside-avoid w-full mb-3">
                  <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-2xs flex flex-col justify-between hover:shadow-xs transition-all gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <img src={avatar} className="w-9 h-9 rounded-xl shrink-0 object-cover" alt="" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-slate-800 text-xs truncate" title={displayName}>{displayName}</h4>
                          {m.role === "company" && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-bold border border-purple-100/50">কোম্পানি</span>
                          )}
                          {m.role === "member" && (
                            m.canSeeAllData ? (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded font-bold border border-emerald-100/60">সকল ডাটা</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded font-bold border border-slate-200">শুধু নিজের ডাটা</span>
                            )
                          )}
                        </div>
                        <p className="text-[9px] text-slate-400 font-mono leading-none mt-1">{m.userId || m.docId}</p>

                        {/* Account Type and status tags row */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-2">
                          {m.accountType && (
                            <span className="text-[9px] bg-blue-50 text-blue-600 font-bold px-1.5 py-0.5 rounded border border-blue-100/50">
                              {ACCT_LABELS[m.accountType] || m.accountType}
                            </span>
                          )}
                          {m.InvestType && (
                            <span className="text-[9px] bg-purple-50 text-purple-600 font-bold px-1.5 py-0.5 rounded border border-purple-100/50">
                              {INVEST_LABELS[m.InvestType] || m.InvestType}
                            </span>
                          )}
                          {selectedStatus !== "subscription" && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${STATUS_COLORS[m.status] || "bg-slate-400 text-white"}`}>
                              {STATUS_LABELS[m.status] || m.status}
                            </span>
                          )}
                        </div>

                        {currentUser.role === "admin" && m.role === "member" && companyObj && (
                          <span className="text-[8px] bg-slate-50 text-slate-500 font-bold px-1.5 py-0.5 rounded mt-1.5 inline-block">
                            🏢 {companyObj.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {selectedStatus === "subscription" && (
                      <div className="text-slate-600 text-[10px] border-t border-slate-100/80 pt-2.5 mt-1 space-y-1">
                        <div className="flex justify-between">
                          <span className="text-[8px] text-indigo-600 font-bold">অনুরোধকৃত প্ল্যান:</span>
                          <span className="font-bold text-indigo-800">{m.planRequested === "monthly" ? "মাসিক প্ল্যান (৳৫০০)" : "বাৎসরিক প্ল্যান (৳৫,০০০)"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[8px] text-indigo-600 font-bold">পেমেন্ট নম্বর:</span>
                          <span className="font-mono font-bold text-slate-800">{m.planRequestMobile || "—"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[8px] text-indigo-600 font-bold">TxID:</span>
                          <span className="font-mono font-bold text-slate-800">{m.planRequestTxId || "—"}</span>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Footer */}
                    <div className="flex items-center justify-end gap-1.5 border-t border-slate-100/80 pt-2 mt-1">
                      {selectedStatus === "subscription" ? (
                        <div className="flex gap-1.5 w-full">
                          <button
                            onClick={() => handleApproveSubscription(m)}
                            className="flex-1 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[10px] transition active:scale-95 shadow-xs cursor-pointer text-center"
                          >
                            সক্রিয় করুন
                          </button>
                          <button
                            onClick={() => handleRejectSubscription(m)}
                            className="flex-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-white font-bold text-[10px] transition active:scale-95 shadow-xs cursor-pointer text-center"
                          >
                            বাতিল করুন
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 w-full justify-end">
                          <button
                            onClick={() => onNavigate("profile", { id: m.docId })}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition flex items-center justify-center gap-1 cursor-pointer text-[10px] font-bold"
                            title="প্রোফাইল"
                          >
                            <UserIcon className="w-3.5 h-3.5" />
                            <span>প্রোফাইল</span>
                          </button>
                          {(currentUser.role === "admin" || (currentUser.role === "company" && m.role === "member")) && (
                            <>
                              <button
                                onClick={() => handleOpenOtpModal(m)}
                                className="flex-1 px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition flex items-center justify-center gap-1 cursor-pointer text-[10px] font-bold"
                                title="ওটিপি সেট করুন"
                              >
                                <Key className="w-3.5 h-3.5" />
                                <span>ওটিপি</span>
                              </button>
                              <button
                                onClick={() => setStatusTarget(m)}
                                className="flex-1 px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-600 transition flex items-center justify-center gap-1 cursor-pointer text-[10px] font-bold"
                                title="স্ট্যাটাস পরিবর্তন"
                              >
                                <ToggleRight className="w-3.5 h-3.5" />
                                <span>স্ট্যাটাস</span>
                              </button>
                              <button
                                onClick={() => setDeleteTarget(m)}
                                className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition flex items-center justify-center cursor-pointer"
                                title="মুছে ফেলুন"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Modal Overlay */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-bold text-slate-800 text-center text-base">স্ট্যাটাস পরিবর্তন করুন</h3>
            <p className="text-center text-blue-600 font-bold text-sm">
              {statusTarget.name || statusTarget.companyName}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["active", "pending", "request", "deactive"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`py-3 rounded-xl text-white font-bold text-xs shadow-sm transition active:scale-95 ${
                    status === "active"
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : status === "pending"
                      ? "bg-amber-500 hover:bg-amber-600"
                      : status === "request"
                      ? "bg-blue-500 hover:bg-blue-600"
                      : "bg-red-500 hover:bg-red-600"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStatusTarget(null)}
              className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs transition"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 text-center">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">সদস্য ডিলিট করুন</h3>
              <p className="text-xs text-slate-500 mt-1">
                &quot;{deleteTarget.name || deleteTarget.companyName}&quot; স্থায়ীভাবে মুছে যাবে।
                এই অ্যাকশন বাতিল করা যাবে না।
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-xs transition"
              >
                বাতিল
              </button>
              <button
                onClick={handleDeleteMember}
                className="flex-1 py-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs transition"
              >
                ডিলিট করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Loader Overlay */}
      {actionLoading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[9999]">
          <div className="bg-white px-5 py-4 rounded-xl shadow-xl flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-600 text-xs font-semibold">প্রসেসিং হচ্ছে...</p>
          </div>
        </div>
      )}

      {/* OTP/Password Management Modal */}
      {otpTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-5 border border-slate-100 overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                <Key className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-slate-800 text-sm">মেম্বার ওটিপি ও পাসওয়ার্ড সেট</h3>
                <p className="text-[10px] text-slate-500">{otpTarget.name || ""}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Password Setting Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 text-left">
                  ওয়ান-টাইম পাসওয়ার্ড (OTP)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={otpPass}
                    onChange={(e) => {
                      setOtpPass(e.target.value);
                      setOtpSuccess(false);
                    }}
                    className="w-full px-3.5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-base font-extrabold tracking-widest text-slate-800 focus:outline-none focus:border-indigo-500 transition text-center"
                    placeholder="পাসওয়ার্ড লিখুন"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const randomOtp = Math.floor(100000 + Math.random() * 900000).toString();
                      setOtpPass(randomOtp);
                      setOtpSuccess(false);
                    }}
                    className="absolute right-2 top-2 px-2 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[9px] transition active:scale-95 cursor-pointer"
                  >
                    নতুন জেনারেট
                  </button>
                </div>
              </div>

              {/* Force Password Change Option */}
              <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-100 text-left">
                <input
                  type="checkbox"
                  id="otpRequireChange"
                  checked={otpRequireChange}
                  onChange={(e) => {
                    setOtpRequireChange(e.target.checked);
                    setOtpSuccess(false);
                  }}
                  className="mt-0.5 w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="otpRequireChange" className="text-[10px] text-slate-600 leading-normal font-semibold cursor-pointer select-none">
                  🔐 এটি একটি ওটিপি হিসেবে চিহ্নিত করুন (লগইন করে মেম্বারের জন্য পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক)
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOtpTarget(null)}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold text-xs transition cursor-pointer"
                >
                  বন্ধ করুন
                </button>
                <button
                  type="button"
                  onClick={handleSaveOtp}
                  disabled={otpSending}
                  className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/10"
                >
                  {otpSending ? (
                    <>
                      <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>সেভ হচ্ছে...</span>
                    </>
                  ) : (
                    <span>পাসওয়ার্ড সেট করুন</span>
                  )}
                </button>
              </div>

              {/* Message sending area when set successfully */}
              {otpSuccess && (
                <div className="border-t border-slate-100 pt-4 mt-4 space-y-3 text-left">
                  <span className="font-bold block text-[10px] uppercase tracking-wider text-emerald-600">
                    ✉️ ওটিপি / পাসওয়ার্ড মেসেজ পাঠান
                  </span>
                  
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[10px] font-medium rounded-xl p-3 leading-relaxed">
                    পাসওয়ার্ড সফলভাবে ডেটাবেজে সংরক্ষিত হয়েছে। এখন মেম্বারের ইমেল বা মোবাইলে এটি প্রেরণ করার জন্য নিচের মাধ্যমগুলো ব্যবহার করতে পারেন:
                  </div>

                  <div className="space-y-2">
                    {/* Send WhatsApp Message */}
                    {(() => {
                      const waPhone = otpTarget.mobile ? otpTarget.mobile.replace(/\D/g, "") : "";
                      const formattedWaPhone = waPhone.startsWith("0") && waPhone.length === 11 ? "88" + waPhone : waPhone;
                      const textMsg = `আসসালামু আলাইকুম ${otpTarget.name || ""},\nআপনার সমিতির একাউন্টের ওয়ান-টাইম পাসওয়ার্ড (OTP) সেট করা হয়েছে।\n\n🔑 নতুন পাসওয়ার্ড: ${otpPass}\n🌐 লগইন করুন: ${window.location.origin}\n\nধন্যবাদ!`;
                      const waUrl = `https://wa.me/${formattedWaPhone}?text=${encodeURIComponent(textMsg)}`;

                      return (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer no-underline text-center shadow-sm"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>হোয়াটসঅ্যাপের মাধ্যমে ওটিপি পাঠান</span>
                        </a>
                      );
                    })()}

                    {/* Send Email */}
                    {otpTarget.email && (
                      <a
                        href={`mailto:${otpTarget.email}?subject=${encodeURIComponent("সমিতির একাউন্টের ওটিপি পাসওয়ার্ড")}&body=${encodeURIComponent(
                          `আসসালামু আলাইকুম ${otpTarget.name || ""},\nআপনার সমিতির একাউন্টের ওয়ান-টাইম পাসওয়ার্ড (OTP) সেট করা হয়েছে।\n\n🔑 নতুন পাসওয়ার্ড: ${otpPass}\n🌐 লগইন করুন: ${window.location.origin}\n\nধন্যবাদ!`
                        )}`}
                        className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer no-underline text-center shadow-sm"
                      >
                        <Mail className="w-4 h-4" />
                        <span>ইমেলের মাধ্যমে ওটিপি পাঠান</span>
                      </a>
                    )}

                    {/* Copy Text for SMS */}
                    <button
                      type="button"
                      onClick={() => {
                        const textToCopy = `আসসালামু আলাইকুম ${otpTarget.name || ""}, আপনার সমিতির একাউন্টের ওয়ান-টাইম পাসওয়ার্ড (OTP) সেট করা হয়েছে। নতুন পাসওয়ার্ড: ${otpPass}। লগইন করুন: ${window.location.origin}। ধন্যবাদ!`;
                        navigator.clipboard.writeText(textToCopy);
                        setOtpCopied(true);
                        setTimeout(() => setOtpCopied(false), 2000);
                      }}
                      className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      {otpCopied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400">মেসেজ কপি হয়েছে!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>এসএমএস হিসেবে কপি করুন</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
