import { useState, useEffect } from "react";
import { collection, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { User, Installment, HistoryEntry, InstallmentStep } from "../types";
import { formatBDT } from "../utils/firestore";
import { Search, Calendar, Info, AlertCircle, Landmark, CreditCard, ChevronRight, User as UserIcon } from "lucide-react";

interface ArrearsViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
}

export default function ArrearsView({ currentUser, onNavigate }: ArrearsViewProps) {
  const [activeTab, setActiveTab] = useState<"savings" | "installments">("savings");
  const [searchQuery, setSearchQuery] = useState("");

  // Real-time Lists
  const [membersArrears, setMembersArrears] = useState<any[]>([]);
  const [loadingSavings, setLoadingSavings] = useState(false);

  const [installments, setInstallments] = useState<Installment[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(true);

  // Selected details overlay modals
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [selectedInstallment, setSelectedInstallment] = useState<Installment | null>(null);

  const toBanglaDigits = (num: number | string) => {
    const banglaDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return num.toString().replace(/\d/g, (d) => banglaDigits[parseInt(d)]);
  };

  const formatNum = (num: number) => {
    return toBanglaDigits(formatBDT(num));
  };

  const formatBanglaDate = (dateStr: string) => {
    if (!dateStr) return "কোনো তথ্য নেই";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = toBanglaDigits(d.getDate());
      const year = toBanglaDigits(d.getFullYear());
      const month = d.toLocaleDateString("bn-BD", { month: "long" });
      return `${day} ${month}, ${year}`;
    } catch {
      return dateStr;
    }
  };

  // 1. Fetch & Listen to Savings Arrears
  useEffect(() => {
    setLoadingSavings(true);
    const unsub = onSnapshot(collection(db, "users"), async (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        const u = { docId: d.id, ...d.data() } as User;
        if (u.role === "member") {
          list.push(u);
        }
      });

      // Filter members based on Role (Admins see all, company users see only their members)
      let myMembers = list;
      if (currentUser.role !== "admin") {
        myMembers = list.filter((m) => m.companyId === currentUser.docId);
      }

      try {
        const arrearsData = await Promise.all(
          myMembers.map(async (member) => {
            const histSnap = await getDocs(collection(db, "users", member.docId, "history"));
            let arrearsSum = 0;
            let latestPayDate = "";
            const historyList: HistoryEntry[] = [];

            histSnap.forEach((doc) => {
              const h = { docId: doc.id, ...doc.data() } as HistoryEntry;
              historyList.push(h);
              if (h.type === "savings_arrears") {
                arrearsSum += Number(h.arrears || 0);
              } else if (h.date) {
                if (!latestPayDate || h.date > latestPayDate) {
                  latestPayDate = h.date;
                }
              }
            });

            return {
              member,
              arrearsSum,
              latestPayDate,
              historyList,
            };
          })
        );

        // Filter: Keep members who have outstanding savings arrears > 0
        setMembersArrears(arrearsData.filter((item) => item.arrearsSum > 0));
      } catch (err) {
        console.error("Error loading savings arrears:", err);
      } finally {
        setLoadingSavings(false);
      }
    });

    return () => unsub();
  }, [currentUser]);

  // 2. Fetch & Listen to Project Installments
  useEffect(() => {
    setLoadingInstallments(true);
    const unsub = onSnapshot(collection(db, "installments"), (snap) => {
      const list: Installment[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Installment);
      });
      setInstallments(list);
      setLoadingInstallments(false);
    });
    return () => unsub();
  }, []);

  // Helper: Next Scheduled Savings Date preview
  const getNextSavingsDate = (investType?: string, investDate?: string) => {
    if (!investType || !investDate) return "N/A";
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (investType === "monthly") {
      const selectedDay = parseInt(investDate, 10);
      if (isNaN(selectedDay) || selectedDay < 1 || selectedDay > 31) return "N/A";

      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth();
      let candidate = new Date(currentYear, currentMonth, selectedDay);

      if (candidate.getTime() < today.getTime()) {
        candidate = new Date(currentYear, currentMonth + 1, selectedDay);
      }
      return candidate.toISOString().split("T")[0];
    } else {
      const target = new Date(investDate);
      if (isNaN(target.getTime())) return "N/A";
      return target.toISOString().split("T")[0];
    }
  };

  // --- Filtering calculations ---
  const filteredSavings = membersArrears.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      item.member.name.toLowerCase().includes(q) ||
      (item.member.userId && item.member.userId.toLowerCase().includes(q)) ||
      (item.member.mobile && item.member.mobile.includes(q))
    );
  });

  const filteredInstallments = installments
    .map((inst) => {
      const paidTotal = (inst.schedule || [])
        .reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
      const remainingDue = (inst.schedule || []).reduce((sum, s) => sum + Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0)), 0);

      // Find last paid installment step date
      let lastPaidDate = "";
      (inst.schedule || []).forEach((s) => {
        if (s.status === "paid" && s.paidDate) {
          if (!lastPaidDate || s.paidDate > lastPaidDate) {
            lastPaidDate = s.paidDate;
          }
        }
      });
      if (!lastPaidDate) lastPaidDate = inst.startDate; // fallback to start date

      // Find next unpaid installment step date
      const nextUnpaidStep = (inst.schedule || []).find((s) => s.status !== "paid");
      const nextDueDate = nextUnpaidStep ? nextUnpaidStep.dueDate : "";

      return {
        inst,
        remainingDue,
        lastPaidDate,
        nextDueDate,
      };
    })
    .filter((item) => {
      if (item.remainingDue <= 0) return false;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        item.inst.customerName.toLowerCase().includes(q) ||
        item.inst.productName.toLowerCase().includes(q)
      );
    });

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 select-none font-sans min-h-[calc(100vh-4rem)] bg-slate-50">
      
      {/* Title Header */}
      <div className="flex items-center gap-2.5 mb-6">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-600 flex items-center justify-center text-white shadow-md">
          <AlertCircle className="w-5 h-5 animate-pulse" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-800 tracking-tight">বকেয়া তালিকা (বকেয়া কেন্দ্র)</h2>
          <p className="text-[10px] text-slate-400 font-bold -mt-0.5">বকেয়া সেভিংস এবং কিস্তি লেজারের একনজরে তালিকা</p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex bg-white p-1.5 rounded-2xl border border-slate-200/60 shadow-xs mb-5">
        <button
          onClick={() => {
            setActiveTab("savings");
            setSearchQuery("");
          }}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "savings"
              ? "bg-rose-50 text-rose-600 shadow-xs"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <Landmark className="w-4 h-4" />
          📊 সেভিংস বকেয়া
          {membersArrears.length > 0 && (
            <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">
              {toBanglaDigits(membersArrears.length)}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("installments");
            setSearchQuery("");
          }}
          className={`flex-1 py-3 text-center text-xs font-bold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === "installments"
              ? "bg-rose-50 text-rose-600 shadow-xs"
              : "text-slate-400 hover:text-slate-600"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          💳 কিস্তি বকেয়া
          {installments.filter(i => {
            const due = (i.schedule || []).reduce((sum, s) => sum + Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0)), 0);
            return due > 0;
          }).length > 0 && (
            <span className="text-[9px] bg-rose-600 text-white font-extrabold px-1.5 py-0.2 rounded-full">
              {toBanglaDigits(installments.filter(i => {
                const due = (i.schedule || []).reduce((sum, s) => sum + Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0)), 0);
                return due > 0;
              }).length)}
            </span>
          )}
        </button>
      </div>

      {/* Dynamic Search Box */}
      <div className="relative mb-5">
        <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            activeTab === "savings"
              ? "সদস্য নাম, ইউজার আইডি অথবা মোবাইল নম্বর দিয়ে খুঁজুন..."
              : "কাস্টমার নাম অথবা পণ্যের নাম দিয়ে খুঁজুন..."
          }
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:border-rose-500 shadow-xs transition-all"
        />
      </div>

      {/* --- CONTENT AREA --- */}
      {activeTab === "savings" ? (
        loadingSavings ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/50 shadow-sm">
            <div className="w-10 h-10 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400 mt-4">বকেয়া সেভিংস লোড হচ্ছে...</p>
          </div>
        ) : filteredSavings.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/50 shadow-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
              <Landmark className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">কোনো সেভিংস বকেয়া নেই</h4>
            <p className="text-[10px] text-slate-400 font-bold mt-1">সব সদস্যের সেভিংস সময়মতো পরিশোধিত রয়েছে!</p>
          </div>
        ) : (
          <div className="bg-slate-50/50 p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSavings.map((item) => {
                const u = item.member;
                const nextDate = getNextSavingsDate(u.InvestType, u.investDate || u.InvestDate);
                return (
                  <div key={u.docId} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-2xs flex flex-col justify-between hover:border-rose-300 hover:shadow-xs transition duration-200">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs sm:text-sm block leading-tight">{u.name}</span>
                          <span className="text-[9px] text-slate-400 font-mono block mt-1.5 font-bold">আইডি: {u.userId || "N/A"} • {u.mobile}</span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-100">
                          ৳{formatNum(item.arrearsSum)}
                        </span>
                      </div>

                      {/* Details list */}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] font-bold">
                        <div className="flex justify-between text-slate-500">
                          <span>সর্বশেষ জমাঃ</span>
                          <span>
                            {item.latestPayDate ? (
                              <span className="text-slate-700 flex items-center gap-1 font-extrabold">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatBanglaDate(item.latestPayDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">কোনো সঞ্চয় জমা নেই</span>
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-500">
                          <span>পরবর্তী সময়সূচীঃ</span>
                          <span>
                            {nextDate !== "N/A" ? (
                              <span className="text-slate-700 flex items-center gap-1 font-extrabold">
                                <Calendar className="w-3 h-3 text-rose-500" />
                                {formatBanglaDate(nextDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => onNavigate("profile", { id: u.docId })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100/60 rounded-xl font-black transition text-[10px] cursor-pointer"
                      >
                        বিস্তারিত প্রোফাইল <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      ) : (
        loadingInstallments ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/50 shadow-sm">
            <div className="w-10 h-10 border-4 border-rose-100 border-t-rose-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-xs font-bold text-slate-400 mt-4">বকেয়া কিস্তি লোড হচ্ছে...</p>
          </div>
        ) : filteredInstallments.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/50 shadow-sm flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-slate-700 text-sm">কোনো কিস্তি বকেয়া নেই</h4>
            <p className="text-[10px] text-slate-400 font-bold mt-1">সব কাস্টমারের প্রজেক্ট কিস্তি সম্পূর্ণ পরিশোধিত রয়েছে!</p>
          </div>
        ) : (
          <div className="bg-slate-50/50 p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredInstallments.map((item) => {
                const inst = item.inst;
                return (
                  <div key={inst.id} className="bg-white rounded-2xl border border-slate-200/60 p-4 shadow-2xs flex flex-col justify-between hover:border-indigo-300 hover:shadow-xs transition duration-200">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="font-extrabold text-slate-800 text-xs sm:text-sm block leading-tight">{inst.customerName}</span>
                          <span className="text-[9px] bg-slate-100 border border-slate-200/50 text-slate-500 font-bold px-2 py-0.5 rounded-md mt-1.5 inline-block">
                            📦 {inst.productName}
                          </span>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-600 border border-rose-100">
                          ৳{formatNum(item.remainingDue)}
                        </span>
                      </div>

                      {/* Details list */}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-[11px] font-bold">
                        <div className="flex justify-between text-slate-500">
                          <span>সর্বশেষ কিস্তি জমাঃ</span>
                          <span>
                            {item.lastPaidDate ? (
                              <span className="text-slate-700 flex items-center gap-1 font-extrabold">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                {formatBanglaDate(item.lastPaidDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">কোনো জমা নেই</span>
                            )}
                          </span>
                        </div>

                        <div className="flex justify-between text-slate-500">
                          <span>পরবর্তী কিস্তির তারিখঃ</span>
                          <span>
                            {item.nextDueDate ? (
                              <span className="text-rose-600 flex items-center gap-1 font-extrabold">
                                <Calendar className="w-3 h-3 text-rose-500" />
                                {formatBanglaDate(item.nextDueDate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">—</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => setSelectedInstallment(inst)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-150 rounded-xl font-black transition text-[10px] cursor-pointer"
                      >
                        তালিক সিডিউল <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* ======================================================= */}
      {/* 1. OVERLAY MODAL: INSTALLMENT SCHEDULE VIEW */}
      {/* ======================================================= */}
      {selectedInstallment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-scaleIn">
            <div className="flex justify-between items-center border-b pb-3.5 mb-3">
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wide">কিস্তি সিডিউল বিস্তারিত</h3>
                <h4 className="text-sm font-extrabold text-blue-700 mt-0.5">{selectedInstallment.customerName}</h4>
              </div>
              <span className="text-[10px] bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold px-2 py-0.5 rounded-lg">
                📦 {selectedInstallment.productName}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
              <div className="grid grid-cols-2 gap-3.5 p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold">
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">মোট পরিমাণ</span>
                  <span className="text-slate-800 font-extrabold text-xs block mt-0.5">৳{formatNum(selectedInstallment.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-slate-400 text-[10px] uppercase font-bold block">বাকি পরিমাণ</span>
                  <span className="text-rose-600 font-extrabold text-xs block mt-0.5">
                    ৳{formatNum(
                      (selectedInstallment.schedule || [])
                        .reduce((sum, s) => sum + Math.max(0, Number(s.amount || 0) - Number(s.paidAmount || 0)), 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                {(selectedInstallment.schedule || []).map((s) => {
                  const due = Math.max(0, s.amount - s.paidAmount);
                  const isPaid = s.status === "paid" || due <= 0;
                  return (
                    <div key={s.month} className={`p-3 rounded-2xl border transition-all ${
                      isPaid 
                        ? "bg-emerald-50/50 border-emerald-100 text-emerald-950" 
                        : "bg-slate-50/50 border-slate-200/80 text-slate-800"
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-xs text-slate-800">কিস্তি {toBanglaDigits(s.month)}</span>
                        <span className={`px-2 py-0.5 rounded font-black text-[9px] uppercase tracking-wide ${
                          isPaid ? "bg-emerald-100 text-emerald-800 border border-emerald-200/50" : "bg-rose-100 text-rose-800 border border-rose-200/50"
                        }`}>
                          {isPaid ? "পরিশোধিত" : "বকেয়া"}
                        </span>
                      </div>

                      <div className="mt-2.5 flex justify-between items-end text-[10px] font-bold text-slate-400">
                        <div>
                          <div>তারিখঃ <span className="font-mono text-slate-700 font-extrabold">{s.dueDate}</span></div>
                          {s.paidDate && (
                            <div className="text-emerald-600 font-extrabold mt-0.5">জমাঃ {formatBanglaDate(s.paidDate)}</div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-slate-800 text-xs font-black">৳{formatNum(s.amount)}</div>
                          {due > 0 && (
                            <div className="text-rose-600 font-black mt-0.5">বকেয়াঃ ৳{formatNum(due)}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3 -mx-5 -mb-5 mt-4">
              <button
                onClick={() => setSelectedInstallment(null)}
                className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 py-3 rounded-2xl font-bold transition text-xs text-center cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
