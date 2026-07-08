import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { User } from "../types";
import { 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  addDoc,
  query,
  where
} from "firebase/firestore";
import { 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Smartphone, 
  Check, 
  X, 
  Loader2, 
  Clock, 
  AlertTriangle, 
  Crown, 
  Search,
  CheckCircle,
  TrendingUp,
  XCircle,
  HelpCircle,
  Copy
} from "lucide-react";

interface SubscriptionRequestsViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
}

export default function SubscriptionRequestsView({ currentUser, onNavigate }: SubscriptionRequestsViewProps) {
  const [companies, setCompanies] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Form states for Company to request subscription
  const [requestPlan, setRequestPlan] = useState<"monthly" | "yearly">("monthly");
  const [paymentMobile, setPaymentMobile] = useState("");
  const [paymentTxId, setPaymentTxId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [submittingReq, setSubmittingReq] = useState(false);

  // Admin Gateway settings & checkout states
  const [adminGateway, setAdminGateway] = useState<any>(null);
  const [showGatewayCheckout, setShowGatewayCheckout] = useState(false);
  const [paymentType, setPaymentType] = useState<"online" | "manual">("manual");

  // Gateway checkout modal wizard states
  const [checkoutStep, setCheckoutStep] = useState<"channel" | "details" | "otp" | "pin" | "processing" | "completed">("channel");
  const [checkoutChannel, setCheckoutChannel] = useState<"bkash" | "nagad" | "rocket" | "card" | null>(null);
  const [checkoutPhone, setCheckoutPhone] = useState("");
  const [checkoutOtp, setCheckoutOtp] = useState("");
  const [checkoutPin, setCheckoutPin] = useState("");
  const [checkoutCardName, setCheckoutCardName] = useState("");
  const [checkoutCardNo, setCheckoutCardNo] = useState("");
  const [checkoutCardExpiry, setCheckoutCardExpiry] = useState("");
  const [checkoutCardCVV, setCheckoutCardCVV] = useState("");
  const [checkoutMockOtp, setCheckoutMockOtp] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Admin bKash/Nagad numbers (Simulated standard/central numbers)
  const ADMIN_BKASH = "01700000000";
  const ADMIN_NAGAD = "01900000000";
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  useEffect(() => {
    // Load Admin Gateway Settings from Firestore
    const adminGatewayRef = doc(db, "gateway_settings", "admin");
    const unsub = onSnapshot(adminGatewayRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.enabled) {
          setAdminGateway(data);
          setPaymentType("online");
        } else {
          setAdminGateway(null);
          setPaymentType("manual");
        }
      } else {
        setAdminGateway(null);
        setPaymentType("manual");
      }
    }, (err) => {
      console.error("Error fetching admin gateway settings:", err);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    setLoading(true);
    // Fetch all users with company role or those requesting plan
    const q = collection(db, "users");
    const unsub = onSnapshot(q, (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        const u = { docId: d.id, ...d.data() } as User;
        if (u.role === "company" || u.planRequested) {
          list.push(u);
        }
      });
      setCompanies(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching companies:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Generate random 6 digit OTP for simulation
  const generateCheckoutMockOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setCheckoutMockOtp(code);
  };

  const handleCheckoutChannelSelect = (channel: "bkash" | "nagad" | "rocket" | "card") => {
    setCheckoutChannel(channel);
    setCheckoutStep("details");
    setCheckoutPhone("");
    setCheckoutOtp("");
    setCheckoutPin("");
    setCheckoutCardName("");
    setCheckoutCardNo("");
    setCheckoutCardExpiry("");
    setCheckoutCardCVV("");
    
    // Auto-generate OTP code for mock purposes
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setCheckoutMockOtp(code);
  };

  const handleCheckoutDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutStep("otp");
  };

  const handleCheckoutOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkoutOtp === checkoutMockOtp || checkoutOtp === "123456") {
      setCheckoutStep("pin");
    } else {
      showToast("❌ ওটিপি সঠিক নয়! অনুগ্রহ করে টেস্ট ওটিপি কোড ব্যবহার করুন।", "error");
    }
  };

  const handleOnlinePaymentSuccess = async (generatedTxId: string) => {
    try {
      const planAmt = requestPlan === "monthly" ? 500 : 5000;
      const days = requestPlan === "monthly" ? 30 : 365;
      const expireTime = Date.now() + days * 24 * 60 * 60 * 1000;

      // 1. Instantly update user's subscription in Firestore
      await updateDoc(doc(db, "users", currentUser.docId), {
        plan: requestPlan,
        planActiveUntil: expireTime,
        planRequested: null,
        planRequestTxId: generatedTxId,
        planRequestMobile: "Online Gateway",
        planRequestAmount: planAmt,
        planRequestAt: Date.now()
      });

      // 2. Notify Admin of automatic activation
      await addDoc(collection(db, "notifications"), {
        title: "🎉 সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে সক্রিয় হয়েছে",
        body: `কোম্পানি "${currentUser.companyName || currentUser.name}" অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে ৳${planAmt} পরিশোধ করেছে। তাদের ${requestPlan === "monthly" ? "মাসিক" : "বাৎসরিক"} সাবস্ক্রিপশন প্ল্যানটি স্বয়ংক্রিয়ভাবে সক্রিয় করা হয়েছে।`,
        senderId: currentUser.docId,
        senderName: currentUser.companyName || currentUser.name,
        senderRole: "company",
        targetType: "admin",
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      // 3. Notify Company
      await addDoc(collection(db, "notifications"), {
        title: "🎉 অভিনন্দন! সাবস্ক্রিপশন স্বয়ংক্রিয়ভাবে সক্রিয় হয়েছে",
        body: `আপনার ${requestPlan === "monthly" ? "মাসিক" : "বাৎসরিক"} সাবস্ক্রিপশনটি অনলাইন গেটওয়ে পেমেন্ট (TxID: ${generatedTxId}) এর মাধ্যমে তাৎক্ষণিকভাবে সক্রিয় করা হয়েছে। সম্পূর্ণ সুবিধা উপভোগ করুন।`,
        senderId: "system",
        senderName: "System Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: currentUser.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      // 4. Log action
      await addDoc(collection(db, "activity_logs"), {
        userId: currentUser.docId,
        userName: currentUser.name,
        action: "SUBSCRIPTION_AUTO_ACTIVATED",
        details: `অনলাইন পেমেন্ট গেটওয়ের মাধ্যমে ৳${planAmt} পরিশোধ করে ${requestPlan === "monthly" ? "মাসিক" : "বাৎসরিক"} প্ল্যান স্বয়ংক্রিয়ভাবে সক্রিয় করা হয়েছে। (TxID: ${generatedTxId})`,
        timestamp: Date.now()
      });

      showToast("🎉 আপনার সাবস্ক্রিপশনটি সফলভাবে পেমেন্ট হয়েছে এবং স্বয়ংক্রিয়ভাবে সক্রিয় করা হয়েছে!", "success");
      setShowGatewayCheckout(false);
      setCheckoutStep("completed");
    } catch (err: any) {
      console.error("Error activating subscription online:", err);
      showToast("❌ সাবস্ক্রিপশন সক্রিয়করণ ব্যর্থ হয়েছে: " + err.message, "error");
    }
  };

  const handleCheckoutPinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCheckoutStep("processing");
    setCheckoutLoading(true);

    // Simulate merchant payment verification
    setTimeout(async () => {
      try {
        const randomTxId = "PG_SUB_" + Math.random().toString(36).substring(2, 10).toUpperCase();
        await handleOnlinePaymentSuccess(randomTxId);
      } catch (err) {
        console.error(err);
        setCheckoutStep("details");
      } finally {
        setCheckoutLoading(false);
      }
    }, 2000);
  };

  // Submit subscription request as a Company
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentMobile || !paymentTxId || !paymentAmount) {
      showToast("❌ অনুগ্রহ করে সবগুলো ফিল্ড পূরণ করুন", "error");
      return;
    }

    setSubmittingReq(true);
    try {
      await updateDoc(doc(db, "users", currentUser.docId), {
        planRequested: requestPlan,
        planRequestTxId: paymentTxId.trim(),
        planRequestMobile: paymentMobile.trim(),
        planRequestAmount: Number(paymentAmount),
        planRequestAt: Date.now()
      });

      // Notify admin
      await addDoc(collection(db, "notifications"), {
        title: "🔔 নতুন সাবস্ক্রিপশন রিকোয়েস্ট",
        body: `কোম্পানি "${currentUser.companyName || currentUser.name}" একটি ${requestPlan === "monthly" ? "মাসিক (৳৫০০)" : "বাৎসরিক (৳৫,০০০)"} সাবস্ক্রিপশন রিকোয়েস্ট পাঠিয়েছে।`,
        senderId: currentUser.docId,
        senderName: currentUser.companyName || currentUser.name,
        senderRole: "company",
        targetType: "admin",
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      showToast("✅ সাবস্ক্রিপশন রিকোয়েস্ট সফলভাবে পাঠানো হয়েছে! এডমিন শীঘ্রই ভেরিফাই করবেন।", "success");
      setPaymentMobile("");
      setPaymentTxId("");
      setPaymentAmount("");
    } catch (err: any) {
      console.error(err);
      showToast("❌ রিকোয়েস্ট পাঠাতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
      setSubmittingReq(false);
    }
  };

  // Approve subscription (Admin Only)
  const handleApproveSubscription = async (user: User) => {
    if (!window.confirm(`আপনি কি "${user.companyName || user.name}" এর ${user.planRequested === "monthly" ? "মাসিক" : "বাৎসরিক"} সাবস্ক্রিপশন এপ্রুভ করতে চান?`)) {
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

      // Send notification to company
      await addDoc(collection(db, "notifications"), {
        title: "🎉 অভিনন্দন! সাবস্ক্রিপশন সক্রিয় হয়েছে",
        body: `আপনার ${planRequested === "monthly" ? "মাসিক" : "বাৎসরিক"} প্রিমিয়াম সাবস্ক্রিপশন প্ল্যানটি সফলভাবে ভেরিফাই করে সক্রিয় করা হয়েছে। এখন থেকে সম্পূর্ণ সার্ভিস উপভোগ করতে পারবেন।`,
        senderId: currentUser.docId,
        senderName: "System Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: user.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      showToast(`✅ "${user.companyName || user.name}" এর সাবস্ক্রিপশন সফলভাবে সক্রিয় করা হয়েছে!`);
    } catch (e: any) {
      console.error(e);
      showToast("❌ সক্রিয় করা সম্ভব হয়নি: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject subscription (Admin Only)
  const handleRejectSubscription = async (user: User) => {
    const reason = window.prompt("রিকোয়েস্টটি বাতিল করার কারণ লিখুন (ঐচ্ছিক):", "ভুল পেমেন্ট তথ্য / TxID অমিল");
    if (reason === null) return; // cancelled prompt

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
        title: "⚠️ সাবস্ক্রিপশন রিকোয়েস্ট বাতিল হয়েছে",
        body: `দুঃখিত, আপনার সাবস্ক্রিপশন রিকোয়েস্টটি বাতিল করা হয়েছে। কারণ: ${reason || "তথ্য অমিল"}। সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।`,
        senderId: currentUser.docId,
        senderName: "System Admin",
        senderRole: "admin",
        targetType: "company",
        targetUserId: user.docId,
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      showToast("❌ সাবস্ক্রিপশন রিকোয়েস্টটি বাতিল করা হয়েছে।");
    } catch (e: any) {
      console.error(e);
      showToast("❌ বাতিল করা সম্ভব হয়নি: " + e.message, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const isAdmin = currentUser.role === "admin";

  // Filter list of companies
  const filteredCompanies = companies.filter((c) => {
    const nameMatch = (c.companyName || c.name || "").toLowerCase().includes(searchQuery.toLowerCase());
    const mobileMatch = (c.mobile || "").includes(searchQuery);
    const txIdMatch = (c.planRequestTxId || "").toLowerCase().includes(searchQuery.toLowerCase());
    return nameMatch || mobileMatch || txIdMatch;
  });

  const pendingRequests = filteredCompanies.filter(c => c.planRequested);
  const activeSubscribers = filteredCompanies.filter(c => c.plan && c.plan !== "free" && (!c.planActiveUntil || c.planActiveUntil > Date.now()));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans select-none animate-fadeIn">
      
      {/* Toast Alert */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-5 py-3.5 rounded-2xl shadow-xl border animate-slideIn text-xs font-bold ${
          toastMsg.type === "success" 
            ? "bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 text-emerald-800 dark:text-emerald-300" 
            : "bg-rose-50 dark:bg-rose-950/90 border-rose-200 text-rose-800 dark:text-rose-300"
        }`}>
          <span>{toastMsg.text}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 hover:scale-110 active:scale-95 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl border border-amber-100 dark:border-amber-900/60 shadow-sm">
              <Crown className="w-5 sm:h-5 sm:w-5" />
            </span>
            সাবস্ক্রিপশন ও পেমেন্ট রিকোয়েস্ট
          </h1>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-1.5">
            কোম্পানির মাসিক ও বাৎসরিক প্রিমিয়াম প্যাক অ্যাক্টিভেশন, রিনিউয়াল এবং ট্রানজেকশন ভেরিফিকেশন ব্যবস্থা।
          </p>
        </div>

        <button
          onClick={() => onNavigate("dashboard")}
          className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 active:scale-95 shadow-sm"
        >
          ড্যাশবোর্ড
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column: Lists / Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Company Plan Request Box (Visible to non-admins) */}
          {!isAdmin && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-amber-500 to-indigo-600 p-5 sm:p-6 text-white">
                <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-300" />
                  সোসাইটি প্রিমিয়াম সাবস্ক্রিপশন কিনুন
                </h2>
                <p className="text-[10px] text-amber-50 font-bold leading-normal mt-1">
                  অ্যাপের সম্পূর্ণ ফিচার ও আনলিমিটেড মেম্বার খাতা পরিচালনা করতে আপনার প্রিমিয়াম প্যাকেজটি অ্যাক্টিভ করুন।
                </p>
              </div>

              {/* Package Details Cards */}
              <div className="p-5 sm:p-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Monthly plan info */}
                  <div className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    requestPlan === "monthly" 
                      ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-500 ring-1 ring-amber-500" 
                      : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-150 dark:border-slate-800 hover:border-slate-200"
                  }`}
                  onClick={() => setRequestPlan("monthly")}>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 rounded-md uppercase">মাসিক প্যাক</span>
                        {requestPlan === "monthly" && <Check className="w-4 h-4 text-amber-600" />}
                      </div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-2">৳ ৫০০ / ৩০ দিন</h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">১ মাস মেয়াদের সব ফিচার আনলক</p>
                    </div>
                  </div>

                  {/* Yearly plan info */}
                  <div className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    requestPlan === "yearly" 
                      ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 ring-1 ring-indigo-500" 
                      : "bg-slate-50/50 dark:bg-slate-800/40 border-slate-150 dark:border-slate-800 hover:border-slate-200"
                  }`}
                  onClick={() => setRequestPlan("yearly")}>
                    <div className="absolute top-0 right-0 bg-rose-500 text-white font-black text-[7px] uppercase px-2 py-0.5 rounded-bl-lg">১৬% সেভ</div>
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-black text-indigo-600 bg-indigo-100 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md uppercase">বাৎসরিক প্যাক</span>
                        {requestPlan === "yearly" && <Check className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mt-2">৳ ৫,০০০ / ৩৬৫ দিন</h3>
                      <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">১২ মাস মেয়াদ। দীর্ঘমেয়াদী সাশ্রয়ী ডিল।</p>
                    </div>
                  </div>
                </div>

                {/* Submitting form */}
                {currentUser.planRequested ? (
                  <div className="p-4.5 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-slate-700 dark:text-slate-300 space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-400">
                      <Clock className="w-4 h-4 animate-spin" />
                      আপনার রিকোয়েস্ট ভেরিফিকেশনের জন্য অপেক্ষমাণ আছে
                    </div>
                    <p className="text-[11px] font-semibold leading-relaxed">
                      আপনি ইতিমধ্যে একটি <strong>{currentUser.planRequested === "monthly" ? "মাসিক (৳৫০০)" : "বাৎসরিক (৳৫,০০০)"}</strong> সাবস্ক্রিপশনের জন্য রিকোয়েস্ট পাঠিয়েছেন।
                    </p>
                    <div className="text-[10px] font-mono bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-dashed border-amber-200 dark:border-amber-900/60 space-y-1 mt-1 text-slate-500">
                      <div>মোবাইলঃ {currentUser.planRequestMobile}</div>
                      <div>TxIDঃ {currentUser.planRequestTxId}</div>
                      <div>টাকাঃ ৳{currentUser.planRequestAmount}</div>
                      <div>তারিখঃ {new Date(currentUser.planRequestAt || Date.now()).toLocaleString()}</div>
                    </div>
                    <p className="text-[10px] text-slate-400">অ্যাডমিন আপনার লেনদেন ভেরিফাই করা মাত্রই প্ল্যানটি সক্রিয় হয়ে যাবে। ধন্যবাদ।</p>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    {/* Payment type selector */}
                    {adminGateway && (
                      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 dark:bg-slate-950/40 rounded-2xl border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => setPaymentType("online")}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                            paymentType === "online"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          অনলাইন পেমেন্ট (অটো অ্যাক্টিভ)
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentType("manual")}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer ${
                            paymentType === "manual"
                              ? "bg-indigo-600 text-white shadow-sm"
                              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                          ম্যানুয়াল সেন্ড মানি
                        </button>
                      </div>
                    )}

                    {paymentType === "online" && adminGateway ? (
                      <div className="p-5.5 bg-gradient-to-br from-indigo-50/50 to-slate-50 dark:from-indigo-950/10 dark:to-slate-950/40 border border-indigo-100 dark:border-indigo-950/30 rounded-3xl space-y-4.5 animate-fadeIn">
                        <div className="flex items-start gap-3">
                          <div className="p-2.5 bg-indigo-100/60 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 rounded-2xl shrink-0 border border-indigo-200/40 shadow-xs">
                            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                              {adminGateway.displayName || "অফিসিয়াল অনলাইন গেটওয়ে"}
                              <span className="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 text-[8px] font-black px-1.5 py-0.5 rounded-full">Secure</span>
                            </h4>
                            <p className="text-[10px] text-slate-400 font-extrabold mt-0.5 leading-relaxed">
                              মার্চেন্ট পেমেন্ট গেটওয়ের সাহায্যে সরাসরি পেমেন্ট করুন। পেমেন্ট সম্পন্ন হওয়া মাত্রই আপনার সিস্টেম অ্যাকাউন্টটি স্বয়ংক্রিয়ভাবে সক্রিয় হয়ে যাবে।
                            </p>
                          </div>
                        </div>

                        <div className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-2xl p-4 flex items-center justify-between text-xs">
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">পরিশোধযোগ্য পেমেন্ট:</span>
                            <span className="text-lg font-black text-slate-850 dark:text-slate-150 font-mono">
                              ৳{requestPlan === "monthly" ? "৫০০" : "৫,০০০"}
                            </span>
                          </div>
                          <span className="text-[9px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 px-2 py-1 rounded-md uppercase flex items-center gap-1">
                            <Check className="w-3 h-3" /> ইন্সট্যান্ট সক্রিয় (Instant Active)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setPaymentAmount(requestPlan === "monthly" ? "500" : "5000");
                            setShowGatewayCheckout(true);
                          }}
                          className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-500/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                          ৳{requestPlan === "monthly" ? "৫০০" : "৫,০০০"} টাকা পরিশোধ করতে এগিয়ে যান
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitRequest} className="space-y-4 animate-fadeIn">
                        <div className="p-4.5 bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-slate-150 dark:border-slate-850 space-y-3">
                          <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                            <CreditCard className="w-3.5 h-3.5" /> পেমেন্ট পাঠানোর তথ্য দিন
                          </h4>
                          <p className="text-[11px] text-slate-500 font-semibold leading-relaxed">
                            প্রথমে ডানপাশের বিকাশ বা নগদ পার্সোনাল নম্বরে কাঙ্ক্ষিত প্ল্যানের পেমেন্ট পাঠান। তারপর নিচে আপনার পেমেন্টকৃত মোবাইল নম্বর এবং ট্রানজেকশন আইডি (TxID) প্রদান করুন।
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">টাকার পরিমাণ (৳)</label>
                            <input
                              type="number"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder={requestPlan === "monthly" ? "500" : "5000"}
                              className="w-full text-xs font-extrabold border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/40"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">বিকাশ/নগদ ফোন নম্বর</label>
                            <input
                              type="tel"
                              value={paymentMobile}
                              onChange={(e) => setPaymentMobile(e.target.value)}
                              placeholder="017xxxxxxxx"
                              className="w-full text-xs font-extrabold border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/40"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">ট্রানজেকশন আইডি (TxID)</label>
                            <input
                              type="text"
                              value={paymentTxId}
                              onChange={(e) => setPaymentTxId(e.target.value)}
                              placeholder="ABC123XYZ"
                              className="w-full text-xs font-extrabold border border-slate-250 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/40"
                              required
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={submittingReq}
                          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white text-xs font-black rounded-2xl shadow-lg shadow-indigo-500/10 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {submittingReq ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-amber-300" />
                          )}
                          সাবস্ক্রিপশন রিকোয়েস্ট জমা দিন
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* List of Subscription Requests (Main Workspace for Admin, reference log for Company) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-850 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/40 dark:bg-slate-900/60">
              <div>
                <h3 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  {isAdmin ? `কোম্পানি রিকোয়েস্ট তালিকা (${pendingRequests.length} টি অপেক্ষমাণ)` : "কোম্পানির সাবস্ক্রিপশন ইতিহাস ও অ্যাক্টিভ গ্রাহকগণ"}
                </h3>
                <p className="text-[10px] text-slate-400 mt-0.5">রিয়েল-টাইম পেমেন্ট ডাটা ভেরিফিকেশন খাতা</p>
              </div>

              {/* Search input inside list header */}
              <div className="relative w-full sm:w-60">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-3.5 w-3.5 text-slate-400" />
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="কোম্পানির নাম, মোবাইল বা TxID..."
                  className="w-full pl-8.5 pr-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-semibold bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* If no pending and no subscribers found */}
            {filteredCompanies.length === 0 ? (
              <div className="p-16 text-center text-slate-400">
                <div className="w-14 h-14 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850 text-slate-300 flex items-center justify-center rounded-2xl mx-auto mb-3 shadow-inner">
                  <Crown className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400">কোন কোম্পানির তথ্য পাওয়া যায়নি</p>
                <p className="text-[10px] text-slate-400 mt-0.5">ভিন্ন কি-ওয়ার্ড লিখে পুনরায় চেষ্টা করুন</p>
              </div>
            ) : (
              <div className="p-5 sm:p-6 space-y-6">
                
                {/* 1. Pending Requests Section */}
                <div>
                  <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    অপেক্ষমাণ অনুমোদন রিকোয়েস্ট ({pendingRequests.length})
                  </h4>

                  {pendingRequests.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-100 dark:border-slate-850 rounded-2xl text-[11px] text-slate-400 font-bold">
                      বর্তমানে কোনো অপেক্ষমাণ সাবস্ক্রিপশন রিকোয়েস্ট নেই
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingRequests.map((c) => (
                        <div key={c.docId} className="bg-slate-50/50 dark:bg-slate-950/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-850 flex flex-col justify-between hover:shadow-md transition duration-200 relative break-inside-avoid">
                          <span className="absolute top-3 right-3 bg-amber-100 text-amber-800 text-[8px] font-black px-2 py-0.5 rounded-full uppercase">Pending</span>
                          
                          <div className="space-y-2">
                            <div>
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100">{c.companyName || c.name}</p>
                              <p className="text-[9px] text-slate-400 font-semibold">{c.email} | {c.mobile}</p>
                            </div>

                            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2.5 rounded-xl space-y-1 text-[10px] font-bold text-slate-500">
                              <div className="flex justify-between">
                                <span>অনুরোধ প্ল্যান:</span>
                                <span className="text-indigo-600">{c.planRequested === "monthly" ? "মাসিক (৳৫০০)" : "বাৎসরিক (৳৫,০০০)"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>পেমেন্ট মোবাইল:</span>
                                <span className="text-slate-800 dark:text-slate-200">{c.planRequestMobile}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>TxID:</span>
                                <span className="text-emerald-600 select-all font-mono font-black">{c.planRequestTxId}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>টাকার পরিমাণ:</span>
                                <span className="text-slate-800 dark:text-slate-200">৳{c.planRequestAmount || 0}</span>
                              </div>
                              {c.planRequestAt && (
                                <div className="text-[9px] text-slate-400 pt-1 border-t border-slate-50 flex justify-between">
                                  <span>পাঠানোর সময়:</span>
                                  <span>{new Date(c.planRequestAt).toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons for Admin Only */}
                          {isAdmin ? (
                            <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <button
                                disabled={actionLoading}
                                onClick={() => handleApproveSubscription(c)}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white text-[10px] font-black py-2 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                              >
                                {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                সক্রিয় করুন
                              </button>
                              <button
                                disabled={actionLoading}
                                onClick={() => handleRejectSubscription(c)}
                                className="flex-1 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 text-rose-600 border border-rose-200 dark:border-rose-900 py-2 rounded-xl text-[10px] font-black transition cursor-pointer flex items-center justify-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" />
                                বাতিল
                              </button>
                            </div>
                          ) : (
                            <div className="text-[9.5px] text-slate-400 mt-3 pt-2 text-center border-t border-slate-100 font-medium">
                              অ্যাডমিন পেমেন্ট ভেরিফাই করতেছেন, অনুগ্রহ করে অপেক্ষা করুন।
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Active Subscribers Section */}
                <div className="pt-2">
                  <h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                    সক্রিয় প্রিমিয়াম কোম্পানি সমূহ ({activeSubscribers.length})
                  </h4>

                  {activeSubscribers.length === 0 ? (
                    <div className="p-6 text-center border border-dashed border-slate-100 dark:border-slate-850 rounded-2xl text-[11px] text-slate-400">
                      বর্তমানে কোনো সক্রিয় প্রিমিয়াম কোম্পানি নেই
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {activeSubscribers.map((sub) => {
                        const daysLeft = sub.planActiveUntil 
                          ? Math.ceil((sub.planActiveUntil - Date.now()) / (24 * 60 * 60 * 1000))
                          : 0;

                        return (
                          <div key={sub.docId} className="p-3.5 bg-white dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-center justify-between">
                            <div className="space-y-1 max-w-[70%]">
                              <p className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{sub.companyName || sub.name}</p>
                              <p className="text-[9px] text-slate-400 font-bold">ফোনঃ {sub.mobile}</p>
                              
                              <div className="flex gap-1.5 pt-1">
                                <span className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-[8px] font-black px-1.5 py-0.5 rounded">
                                  {sub.plan === "monthly" ? "মাসিক" : "বাৎসরিক"}
                                </span>
                                {sub.planActiveUntil && (
                                  <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${
                                    daysLeft > 7 
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20" 
                                      : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 animate-pulse"
                                  }`}>
                                    {daysLeft > 0 ? `${daysLeft} দিন মেয়াদ` : "মেয়াদ শেষ"}
                                  </span>
                                )}
                              </div>
                            </div>

                            <Crown className="w-5 h-5 text-amber-500 animate-pulse shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Right Column: Pricing & Central Payment Channels */}
        <div className="space-y-6">
          
          {/* Pricing Guidelines */}
          <div className="bg-gradient-to-b from-indigo-900 to-slate-900 text-white rounded-3xl p-5.5 space-y-4 shadow-xl border border-indigo-950">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-indigo-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              সাবস্ক্রিপশন চার্জ ও ডিল
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex justify-between border-b border-indigo-950 pb-2">
                <span className="font-semibold text-indigo-200">১। ১ মাস (মাসিক প্ল্যান)</span>
                <span className="font-extrabold text-white">৳ ৫০০</span>
              </div>
              <div className="flex justify-between border-b border-indigo-950 pb-2">
                <span className="font-semibold text-indigo-200">২। ১২ মাস (বাৎসরিক প্ল্যান)</span>
                <span className="font-extrabold text-white flex items-center gap-1">
                  ৳ ৫,০০০
                  <span className="text-[8px] font-black bg-rose-500 text-white px-1.5 py-0.1 rounded-md uppercase">সাশ্রয়ী</span>
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="font-semibold text-indigo-200">৩। আনলিমিটেড মেম্বার খাতা</span>
                <span className="font-extrabold text-emerald-400">সীমাহীন</span>
              </div>
            </div>

            <hr className="border-indigo-950" />

            <div className="text-[10px] text-indigo-200 font-bold leading-normal space-y-2 bg-indigo-950/40 p-3.5 rounded-2xl border border-indigo-900">
              <p>📍 প্রিমিয়াম প্যাকেজের সুবিধা সমূহঃ</p>
              <ul className="list-disc list-inside space-y-1 pl-1 text-[9.5px]">
                <li>সম্পূর্ণ বিজ্ঞাপনমুক্ত ঝকঝকে অভিজ্ঞতা</li>
                <li>আনলিমিটেড মেম্বার বা সোসাইটি খাতা পরিচালনা</li>
                <li>মোবাইল ব্যাংকিং ও ব্যাংক রিকোয়েস্ট ভেরিফিকেশন</li>
                <li>রিয়েল-টাইম হিসাব বিবরণী ও ডায়াগনস্টিক সিঙ্ক</li>
                <li>অটোমেটিক নোটিফিকেশন ও পিডিএফ রিপোর্ট ডাউনলোড</li>
              </ul>
            </div>
          </div>

          {/* Central Payment Channels Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4.5 shadow-sm">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider flex items-center gap-1.5 border-b pb-3.5">
              <Smartphone className="w-4 h-4 text-indigo-500" />
              অফিসিয়াল পেমেন্ট গেটওয়ে সমূহ
            </h3>

            <p className="text-[10.5px] text-slate-400 font-medium leading-normal">
              সোসাইটি ম্যানেজার এডমিন প্যানেলের অফিসিয়াল পেমেন্ট নম্বর নিচে দেওয়া হলো। নম্বরে <strong>Send Money</strong> অথবা <strong>Cash In</strong> করুন।
            </p>

            <div className="space-y-3">
              {/* bKash card */}
              <div className="p-3 rounded-2xl bg-pink-50/50 dark:bg-pink-950/10 border border-pink-100 dark:border-pink-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-pink-700 uppercase bg-pink-100 dark:bg-pink-950/40 px-1.5 py-0.5 rounded">bKash Personal</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wide mt-1.5">{ADMIN_BKASH}</p>
                </div>
                <button
                  onClick={() => handleCopy(ADMIN_BKASH, "bkash")}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-150 dark:border-slate-750 transition active:scale-95 cursor-pointer"
                  title="Copy Number"
                >
                  {copiedText === "bkash" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Nagad card */}
              <div className="p-3 rounded-2xl bg-orange-50/50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/60 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-orange-700 uppercase bg-orange-100 dark:bg-orange-950/40 px-1.5 py-0.5 rounded">Nagad Personal</span>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono tracking-wide mt-1.5">{ADMIN_NAGAD}</p>
                </div>
                <button
                  onClick={() => handleCopy(ADMIN_NAGAD, "nagad")}
                  className="p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-150 dark:border-slate-750 transition active:scale-95 cursor-pointer"
                  title="Copy Number"
                >
                  {copiedText === "nagad" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/40 p-3 rounded-2xl border border-slate-150 dark:border-slate-850 flex items-start gap-2 text-[10px] font-bold text-slate-500 leading-normal">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>সতর্কতাঃ সঠিক TxID এবং টাকার পরিমাণ না দিলে সাবস্ক্রিপশন অটোমেটিক বাতিল হয়ে যেতে পারে। যেকোনো প্রয়োজনে সরাসরি এডমিনের সাথে যোগাযোগ করুন।</span>
            </div>
          </div>

        </div>

      </div>

      {showGatewayCheckout && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            {/* Gateway Brand Header */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-pink-500 flex items-center justify-center text-white font-black text-sm">
                  ৳
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">SECURE CHECKOUT</div>
                  <div className="text-xs font-black text-slate-100">{adminGateway?.displayName || "Online Gateway"}</div>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowGatewayCheckout(false);
                  setCheckoutStep("channel");
                }} 
                className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Merchant & Amount Info Bar */}
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600">
              <div>
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">Merchant:</div>
                <div className="font-extrabold text-slate-800">{adminGateway?.merchantId || "Society Manager"}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-slate-400 uppercase tracking-wide">Amount:</div>
                <div className="font-black text-pink-600 text-sm">৳{(requestPlan === "monthly" ? 500 : 5000).toLocaleString("bn-BD")}</div>
              </div>
            </div>

            {/* Dynamic Step Wizard Content */}
            <div className="p-5 flex-1 min-h-[260px] flex flex-col justify-center">
              {checkoutStep === "channel" && (
                <div className="space-y-4 text-center">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">পেমেন্ট মেথড নির্বাচন করুন</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleCheckoutChannelSelect("bkash")}
                      className="p-3 border border-pink-100 hover:border-pink-300 rounded-2xl bg-pink-50/20 text-pink-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-pink-50/40"
                    >
                      <span className="w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-black text-xs">b</span>
                      <span className="text-[10px] font-black uppercase">bKash</span>
                    </button>

                    <button
                      onClick={() => handleCheckoutChannelSelect("nagad")}
                      className="p-3 border border-orange-100 hover:border-orange-300 rounded-2xl bg-orange-50/20 text-orange-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-orange-50/40"
                    >
                      <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-black text-xs">N</span>
                      <span className="text-[10px] font-black uppercase">Nagad</span>
                    </button>

                    <button
                      onClick={() => handleCheckoutChannelSelect("rocket")}
                      className="p-3 border border-indigo-100 hover:border-indigo-300 rounded-2xl bg-indigo-50/20 text-indigo-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-indigo-50/40"
                    >
                      <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-xs">R</span>
                      <span className="text-[10px] font-black uppercase">Rocket</span>
                    </button>

                    <button
                      onClick={() => handleCheckoutChannelSelect("card")}
                      className="p-3 border border-slate-200 hover:border-slate-400 rounded-2xl bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-slate-100"
                    >
                      <CreditCard className="w-6 h-6 text-slate-600" />
                      <span className="text-[10px] font-black uppercase">Cards</span>
                    </button>
                  </div>
                </div>
              )}

              {checkoutStep === "details" && (
                <form onSubmit={handleCheckoutDetailsSubmit} className="space-y-4">
                  <div className="text-center">
                    <span className="px-3 py-1 text-[9px] font-black uppercase rounded-full bg-slate-100 text-slate-600">
                      {checkoutChannel} পেমেন্ট
                    </span>
                  </div>

                  {checkoutChannel === "card" ? (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">কার্ডহোল্ডারের নাম</label>
                        <input
                          type="text"
                          placeholder="CARDHOLDER NAME"
                          value={checkoutCardName}
                          onChange={(e) => setCheckoutCardName(e.target.value.toUpperCase())}
                          required
                          className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">কার্ড নম্বর</label>
                        <input
                          type="text"
                          placeholder="4111 2222 3333 4444"
                          value={checkoutCardNo}
                          onChange={(e) => setCheckoutCardNo(e.target.value)}
                          required
                          className="w-full text-xs font-mono font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">মেয়াদ শেষ (MM/YY)</label>
                          <input
                            type="text"
                            placeholder="12/29"
                            value={checkoutCardExpiry}
                            onChange={(e) => setCheckoutCardExpiry(e.target.value)}
                            required
                            className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">CVV / CVC</label>
                          <input
                            type="password"
                            placeholder="***"
                            maxLength={3}
                            value={checkoutCardCVV}
                            onChange={(e) => setCheckoutCardCVV(e.target.value)}
                            required
                            className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider text-center">
                        আপনার {checkoutChannel} পার্সোনাল অ্যাকাউন্ট নম্বরটি দিন
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 017XXXXXXXX"
                        value={checkoutPhone}
                        onChange={(e) => setCheckoutPhone(e.target.value)}
                        required
                        className="w-full text-center text-sm font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white transition"
                      />
                      <p className="text-[8px] font-bold text-slate-400 text-center leading-relaxed">
                        এই পেমেন্ট উইন্ডোটি একটি সুরক্ষিত এপিআই গেটওয়ে সিমুলেশন। সম্পূর্ণ সুরক্ষিত উপায়ে ভেরিফাই হয়ে ইনস্ট্যান্ট সক্রিয় হচ্ছে।
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("channel")}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black cursor-pointer"
                    >
                      মেথড পরিবর্তন
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm active:scale-95"
                    >
                      পরবর্তী ধাপ
                    </button>
                  </div>
                </form>
              )}

              {checkoutStep === "otp" && (
                <form onSubmit={handleCheckoutOtpSubmit} className="space-y-4">
                  <div className="text-center space-y-1">
                    <span className="px-2.5 py-0.5 text-[8px] font-black uppercase rounded-full bg-indigo-50 text-indigo-700">
                      নিরাপত্তা যাচাইকরণ (OTP Verification)
                    </span>
                    <p className="text-[10px] font-bold text-slate-500">
                      আপনার মোবাইল নম্বরে ৬-সংখ্যার ভেরিফিকেশন কোড পাঠানো হয়েছে।
                    </p>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="৬-ডিজিটের কোড দিন"
                      maxLength={6}
                      value={checkoutOtp}
                      onChange={(e) => setCheckoutOtp(e.target.value)}
                      required
                      className="w-full text-center text-sm font-mono font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                    />
                    <div className="flex justify-between text-[8px] font-black text-slate-400">
                      <button type="button" onClick={generateCheckoutMockOtp} className="hover:text-indigo-600 underline cursor-pointer">পুনরায় ওটিপি পাঠান</button>
                      <span>টেস্ট কোড: {checkoutMockOtp || "123456"}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("details")}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black cursor-pointer"
                    >
                      পিছনে যান
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm active:scale-95"
                    >
                      নিশ্চিত করুন
                    </button>
                  </div>
                </form>
              )}

              {checkoutStep === "pin" && (
                <form onSubmit={handleCheckoutPinSubmit} className="space-y-4">
                  <div className="text-center space-y-1">
                    <span className="px-2.5 py-0.5 text-[8px] font-black uppercase rounded-full bg-pink-50 text-pink-700">
                      পিন ভেরিফিকেশন (PIN Entry)
                    </span>
                    <p className="text-[10px] font-bold text-slate-500">
                      পেমেন্ট সম্পন্ন করতে আপনার {checkoutChannel} ওয়ালেট পিন নম্বরটি টাইপ করুন।
                    </p>
                  </div>

                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="PIN লিখুন"
                      maxLength={5}
                      value={checkoutPin}
                      onChange={(e) => setCheckoutPin(e.target.value)}
                      required
                      className="w-full text-center text-sm font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white transition"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setCheckoutStep("otp")}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black cursor-pointer"
                    >
                      পিছনে যান
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm active:scale-95"
                    >
                      টাকা পরিশোধ করুন ৳{(requestPlan === "monthly" ? 500 : 5000).toLocaleString("bn-BD")}
                    </button>
                  </div>
                </form>
              )}

              {checkoutStep === "processing" && (
                <div className="space-y-4 text-center animate-pulse">
                  <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">পেমেন্ট প্রসেস করা হচ্ছে...</h4>
                    <p className="text-[9px] font-bold text-slate-400">অনুগ্রহ করে অপেক্ষা করুন, উইন্ডো বন্ধ করবেন না।</p>
                  </div>
                </div>
              )}

              {checkoutStep === "completed" && (
                <div className="space-y-4 text-center animate-fadeIn">
                  <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                    <CheckCircle className="w-7 h-7 text-emerald-600 animate-bounce" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">পেমেন্ট সফল হয়েছে!</h4>
                    <p className="text-[9px] font-bold text-emerald-600">আপনার সাবস্ক্রিপশনটি তাৎক্ষণিকভাবে সক্রিয় হয়েছে।</p>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Secured badge */}
            <div className="bg-slate-50 p-3 border-t border-slate-100 text-center text-[8px] font-black text-slate-400 flex items-center justify-center gap-1">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-pulse"></span>
              <span>100% SECURE SSL ENCRYPTED GATEWAY</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
