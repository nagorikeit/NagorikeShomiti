import React, { useState, useEffect, FormEvent } from "react";
import {
  collection,
  doc,
  addDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db, auth } from "../firebase";
import { User, Installment, CompanyPaymentAccount, TransactionRequest, Project } from "../types";
import {
  TrendingUp,
  TrendingDown,
  Coins,
  Smartphone,
  CreditCard,
  Copy,
  Check,
  Info,
  ArrowLeft,
  X,
  AlertTriangle,
  User as UserIcon,
  CheckCircle2,
  Calendar,
  Sparkles,
} from "lucide-react";
import { formatNum } from "../utils/firestore";

interface DepositWithdrawViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
  navigationParams?: any;
}

export default function DepositWithdrawView({ currentUser, onNavigate, navigationParams }: DepositWithdrawViewProps) {
  // Navigation & Basic Details
  const targetCompanyId = currentUser.role === "company" ? currentUser.docId : currentUser.companyId;
  const isAdminOrCompany = currentUser.role === "admin" || currentUser.role === "company";

  // Real-time states
  const [users, setUsers] = useState<User[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyPaymentAccount[]>([]);
  const [companyGateway, setCompanyGateway] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form State Variables
  const [trxFlow, setTrxFlow] = useState<"IN" | "OUT">("IN");
  const [selectedUserId, setSelectedUserId] = useState<string>(
    currentUser.role === "member" ? currentUser.docId : ""
  );
  const [trxType, setTrxType] = useState<"saving" | "installment" | "project">("saving");
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [trxAmount, setTrxAmount] = useState<string>("");
  const [trxDate, setTrxDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentMethod, setPaymentMethod] = useState<"mobile_banking" | "bank" | "cash" | "online_gateway">(
    currentUser.role === "member" ? "online_gateway" : "mobile_banking"
  );

  // Payment Channel details
  const [mobileProvider, setMobileProvider] = useState<"bkash" | "nagad" | "rocket" | "upay">("bkash");
  const [mobileAccountNo, setMobileAccountNo] = useState<string>("");
  const [mobileTrxId, setMobileTrxId] = useState<string>("");

  const [bankName, setBankName] = useState<string>("Dutch-Bangla Bank");
  const [bankBranch, setBankBranch] = useState<string>("");
  const [bankAccountNo, setBankAccountNo] = useState<string>("");
  const [bankTrxId, setBankTrxId] = useState<string>("");

  const [trxMemo, setTrxMemo] = useState<string>("");

  // Feedback states
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);
  const [showGatewayCheckout, setShowGatewayCheckout] = useState(false);

  // Adjust default paymentMethod based on trxFlow
  useEffect(() => {
    if (trxFlow === "OUT") {
      setPaymentMethod("mobile_banking");
      setTrxType("saving"); // Cash-Out is only for Savings
    } else {
      if (currentUser.role === "member") {
        setPaymentMethod("online_gateway");
      } else {
        setPaymentMethod("mobile_banking");
      }
    }
  }, [trxFlow, currentUser]);

  // Firestore Subscriptions
  useEffect(() => {
    setLoading(true);

    // 1. Members Query
    const userQuery = currentUser.role === "admin"
      ? collection(db, "users")
      : query(collection(db, "users"), where("companyId", "==", targetCompanyId || ""));

    const unsubUsers = onSnapshot(userQuery, (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        list.push({ docId: d.id, ...d.data() } as User);
      });
      setUsers(list);
    });

    // 2. Installments Query
    const installmentQuery = currentUser.role === "admin"
      ? collection(db, "installments")
      : query(collection(db, "installments"), where("companyId", "==", targetCompanyId || ""));

    const unsubInstallments = onSnapshot(installmentQuery, (snap) => {
      const list: Installment[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Installment);
      });
      setInstallments(list);
      setLoading(false);
    });

    // 3. Company Payment Accounts Query
    const paymentAccountQuery = currentUser.role === "admin"
      ? collection(db, "company_payment_accounts")
      : query(collection(db, "company_payment_accounts"), where("companyId", "==", targetCompanyId || ""));

    const unsubCompanyAccounts = onSnapshot(paymentAccountQuery, (snap) => {
      const list: CompanyPaymentAccount[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as CompanyPaymentAccount);
      });
      setCompanyAccounts(list);
    });

    // 4. Company Gateway Settings Query
    let unsubGateway = () => {};
    if (targetCompanyId) {
      unsubGateway = onSnapshot(doc(db, "gateway_settings", targetCompanyId), (snap) => {
        if (snap.exists()) {
          setCompanyGateway(snap.data());
        } else {
          setCompanyGateway(null);
        }
      });
    }

    // 5. Projects Query
    const projectsQuery = currentUser.role === "admin"
      ? collection(db, "projects")
      : query(collection(db, "projects"), where("companyId", "==", targetCompanyId || ""));

    const unsubProjects = onSnapshot(projectsQuery, (snap) => {
      const list: Project[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Project);
      });
      setProjects(list);
    });

    return () => {
      unsubUsers();
      unsubInstallments();
      unsubCompanyAccounts();
      unsubGateway();
      unsubProjects();
    };
  }, [currentUser, targetCompanyId]);

  // Filtering Logic
  const activeCompanyMembers = users.filter((u) => {
    if (currentUser.role === "admin") return true;
    return u.companyId === targetCompanyId && u.status === "active" && u.role === "member";
  });

  const selectedMember = users.find((u) => u.docId === selectedUserId);

  // Installments for selected member
  const selectedUserInstallments = installments.filter(
    (inst) => inst.status === "open" && inst.dueAmount > 0 && inst.customerName === selectedMember?.name
  );

  // Set default installment ID if list changes
  useEffect(() => {
    if (selectedUserInstallments.length > 0) {
      if (!selectedInstallmentId || !selectedUserInstallments.some(inst => inst.id === selectedInstallmentId)) {
        setSelectedInstallmentId(selectedUserInstallments[0].id);
      }
    } else {
      setSelectedInstallmentId("");
    }
  }, [selectedUserId, trxType, installments]);

  // Set default project ID if list changes
  useEffect(() => {
    const activeProjects = projects.filter(p => p.status !== "closed");
    if (activeProjects.length > 0) {
      if (!selectedProjectId || !activeProjects.some(p => p.id === selectedProjectId)) {
        setSelectedProjectId(activeProjects[0].id);
      }
    } else {
      setSelectedProjectId("");
    }
  }, [projects, trxType]);

  // Handle navigation params for quick auto-population (e.g. from Dashboard installment payment button)
  useEffect(() => {
    if (navigationParams) {
      if (navigationParams.trxFlow) {
        if (navigationParams.trxFlow === "OUT") {
          onNavigate("cashout");
          return;
        } else {
          setTrxFlow(navigationParams.trxFlow);
        }
      }
      if (navigationParams.trxType) {
        setTrxType(navigationParams.trxType);
      }
      if (navigationParams.selectedUserId) {
        setSelectedUserId(navigationParams.selectedUserId);
      }
      if (navigationParams.selectedInstallmentId) {
        setSelectedInstallmentId(navigationParams.selectedInstallmentId);
      }
      if (navigationParams.selectedProjectId) {
        setSelectedProjectId(navigationParams.selectedProjectId);
      }
      if (navigationParams.trxAmount) {
        setTrxAmount(String(navigationParams.trxAmount));
      }
    }
  }, [navigationParams]);

  const handleFlowToggle = (flow: "IN" | "OUT") => {
    if (flow === "OUT") {
      onNavigate("cashout");
    } else {
      setTrxFlow("IN");
      setToastMsg(null);
    }
  };

  const handleCreateTransaction = async (e: FormEvent) => {
    e.preventDefault();

    // Validations
    const amountNum = parseFloat(trxAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setToastMsg({ text: "অনুগ্রহ করে সঠিক পরিমাণ ইনপুট দিন।", type: "error" });
      return;
    }

    if (!selectedUserId) {
      setToastMsg({ text: "অনুগ্রহ করে সদস্য নির্বাচন করুন।", type: "error" });
      return;
    }

    const member = users.find((u) => u.docId === selectedUserId);
    if (!member) {
      setToastMsg({ text: "সদস্য পাওয়া যায়নি।", type: "error" });
      return;
    }

    // Online Gateway flow trigger
    if (trxFlow === "IN" && paymentMethod === "online_gateway") {
      if (!companyGateway || !companyGateway.enabled) {
        setToastMsg({
          text: "কোম্পানির অনলাইন গেটওয়ে বর্তমানে নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে ম্যানুয়াল পেমেন্ট করুন।",
          type: "error",
        });
        return;
      }
      setShowGatewayCheckout(true);
      return;
    }

    if (!trxDate) {
      setToastMsg({ text: "অনুগ্রহ করে তারিখ নির্বাচন করুন।", type: "error" });
      return;
    }

    // Manual payment validation
    if (trxFlow === "IN") {
      if (paymentMethod === "mobile_banking") {
        if (!mobileAccountNo) {
          setToastMsg({ text: "মোবাইল ব্যাংকিং অ্যাকাউন্ট নম্বর দিন।", type: "error" });
          return;
        }
        if (!mobileTrxId) {
          setToastMsg({ text: "মোবাইল ব্যাংকিং ট্রানজেকশন আইডি (TxID) দিন।", type: "error" });
          return;
        }
      } else if (paymentMethod === "bank") {
        if (!bankName) {
          setToastMsg({ text: "ব্যাংকের নাম দিন।", type: "error" });
          return;
        }
        if (!bankAccountNo) {
          setToastMsg({ text: "ব্যাংক হিসাব নম্বর দিন।", type: "error" });
          return;
        }
        if (!bankTrxId) {
          setToastMsg({ text: "ব্যাংক রেফারেন্স / ট্রানজেকশন আইডি দিন।", type: "error" });
          return;
        }
      }
    } else {
      // CASH OUT (Withdrawal) validation
      if (paymentMethod === "mobile_banking") {
        if (!mobileAccountNo) {
          setToastMsg({ text: "যে মোবাইল ব্যাংকিং নম্বরে টাকা উত্তোলন করবেন তা দিন।", type: "error" });
          return;
        }
      } else if (paymentMethod === "bank") {
        if (!bankName) {
          setToastMsg({ text: "ব্যাংকের নাম দিন।", type: "error" });
          return;
        }
        if (!bankAccountNo) {
          setToastMsg({ text: "ব্যাংক হিসাব নম্বর দিন।", type: "error" });
          return;
        }
      }
    }

    setSubmitting(true);
    setToastMsg(null);

    try {
      if (trxFlow === "OUT") {
        const isCompanyOrAdmin = currentUser.role === "company" || currentUser.role === "admin";
        const savingsBal = member.savingsBalance !== undefined ? member.savingsBalance : Number(member.amount || 0);
        const incomeBal = member.incomeBalance || 0;

        if (isCompanyOrAdmin) {
          const totalAvailable = savingsBal + incomeBal;
          if (totalAvailable < amountNum) {
            throw new Error(
              `উত্তোলনের জন্য পর্যাপ্ত ব্যালেন্স নেই। মোট উপলব্ধ ব্যালেন্স: ৳${formatNum(
                totalAvailable
              )} (সেভিংস: ৳${formatNum(savingsBal)}, ইনকাম: ৳${formatNum(incomeBal)})`
            );
          }
        } else {
          if (member.accountType === "saving") {
            if (savingsBal < amountNum) {
              throw new Error(
                `উত্তোলনের জন্য পর্যাপ্ত সেভিংস ব্যালেন্স নেই। আপনার বর্তমান সেভিংস ব্যালেন্স: ৳${formatNum(
                  savingsBal
                )}`
              );
            }
          } else if (member.accountType === "business") {
            if (incomeBal < amountNum) {
              throw new Error(
                `উত্তোলনের জন্য পর্যাপ্ত ইনকাম ব্যালেন্স নেই। আপনার বর্তমান ইনকাম ব্যালেন্স: ৳${formatNum(
                  incomeBal
                )}`
              );
            }
          } else {
            if (savingsBal < amountNum) {
              throw new Error(
                `উত্তোলনের জন্য পর্যাপ্ত সেভিংস ব্যালেন্স নেই। আপনার বর্তমান সেভিংস ব্যালেন্স: ৳${formatNum(
                  savingsBal
                )}`
              );
            }
          }
        }
      }

      // Create standard pending transaction request
      const reqPayload: any = {
        companyId: member.companyId || targetCompanyId,
        userId: selectedUserId,
        userName: member.name,
        userEmail: member.email || "",
        flow: trxFlow,
        type: trxType,
        amount: amountNum,
        date: trxDate,
        memo:
          trxMemo ||
          (trxFlow === "OUT"
            ? "সঞ্চয় থেকে টাকা উত্তোলন (ক্যাশ-আউট)"
            : trxType === "saving"
            ? "সাধারণ সঞ্চয় ডিপোজিট"
            : trxType === "project"
            ? `প্রজেক্টে বিনিয়োগ - ${projects.find((p) => p.id === selectedProjectId)?.name || "কোম্পানি (সাধারণ)"}`
            : "কিস্তি পরিশোধ"),
        paymentMethod,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      if (paymentMethod === "mobile_banking") {
        reqPayload.mobileProvider = mobileProvider;
        reqPayload.mobileAccountNo = mobileAccountNo;
        reqPayload.mobileTrxId = trxFlow === "IN" ? mobileTrxId : "";
      } else if (paymentMethod === "bank") {
        reqPayload.bankName = bankName;
        reqPayload.bankBranch = bankBranch;
        reqPayload.bankAccountNo = bankAccountNo;
        reqPayload.bankTrxId = trxFlow === "IN" ? bankTrxId : "";
      }

      if (trxFlow === "IN" && trxType === "installment") {
        reqPayload.installmentId = selectedInstallmentId;
        const instObj = installments.find((i) => i.id === selectedInstallmentId);
        if (instObj) {
          reqPayload.installmentName = instObj.productName;
        }
      }

      if (trxFlow === "IN" && trxType === "project") {
        reqPayload.projectId = selectedProjectId;
        const projObj = projects.find((p) => p.id === selectedProjectId);
        if (projObj) {
          reqPayload.projectName = projObj.name;
        }
      }

      await addDoc(collection(db, "transaction_requests"), reqPayload);

      setToastMsg({
        text: "✅ ট্রানজেকশন রিকোয়েস্ট সফলভাবে জমা দেওয়া হয়েছে! কোম্পানির ম্যানেজার বা এডমিন এপ্রুভ করার পর ব্যালেন্স আপডেট হবে।",
        type: "success",
      });

      // Reset form fields
      setTrxAmount("");
      setTrxMemo("");
      setMobileAccountNo("");
      setMobileTrxId("");
      setBankBranch("");
      setBankAccountNo("");
      setBankTrxId("");

      // Automatically redirect to transactions queue page after success
      setTimeout(() => {
        setToastMsg(null);
        onNavigate("transactions");
      }, 2500);
    } catch (err: any) {
      console.error(err);
      setToastMsg({
        text: err.message || "লেনদেন রিকোয়েস্ট পাঠানো সম্ভব হয়নি। পুনরায় চেষ্টা করুন।",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-slate-400">অপেক্ষা করুন...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate("dashboard")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-3xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          ড্যাশবোর্ডে ফিরে যান
        </button>
        <span className="text-[10px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
          <Sparkles className="w-3 h-3 animate-spin" />
          ট্রানজাকশন পোর্টাল
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left main card containing the transaction Form */}
        <div className="md:col-span-8 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden animate-fadeIn">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-5">
            <h3 className="text-md sm:text-lg font-black flex items-center gap-2">
              <Coins className="w-5 h-5" />
              জমা বা উত্তোলন ফর্ম (Deposit / Withdrawal Portal)
            </h3>
            <p className="text-[11px] text-blue-100 font-semibold mt-1">
              আপনার সেভিংস ফান্ডে সঞ্চয় জমা করতে বা তহবিল থেকে টাকা উত্তোলন করতে নিচের তথ্যগুলো পূরণ করে রিকোয়েস্ট পাঠান।
            </p>
          </div>

          <form onSubmit={handleCreateTransaction} className="p-6 space-y-5">
            {/* IN or OUT toggle */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                লেনদেনের ধরণ (Transaction Mode)
              </label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => handleFlowToggle("IN")}
                  className={`py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    trxFlow === "IN"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <TrendingUp className="w-4 h-4" />
                  টাকা জমা (Cash-In)
                </button>
                <button
                  type="button"
                  onClick={() => handleFlowToggle("OUT")}
                  className={`py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    trxFlow === "OUT"
                      ? "bg-rose-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  <TrendingDown className="w-4 h-4" />
                  টাকা উত্তোলন (Cash-Out)
                </button>
              </div>
            </div>

            {/* User and Category Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Member Selector */}
              {isAdminOrCompany ? (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    সদস্য নির্বাচন করুন
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                    className="w-full text-xs font-extrabold border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition"
                  >
                    <option value="">-- সদস্য সিলেক্ট করুন --</option>
                    {activeCompanyMembers.map((member) => (
                      <option key={member.docId} value={member.docId}>
                        {member.name} (সেভিংস: ৳
                        {formatNum(
                          member.savingsBalance !== undefined ? member.savingsBalance : member.amount || 0
                        )}{" "}
                        | ইনকাম: ৳{formatNum(member.incomeBalance || 0)})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                    সদস্য (আপনি)
                  </label>
                  <div className="w-full text-xs font-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5" />
                    {currentUser.name} (সেভিংস: ৳
                    {formatNum(
                      currentUser.savingsBalance !== undefined ? currentUser.savingsBalance : currentUser.amount || 0
                    )}{" "}
                    | ইনকাম: ৳{formatNum(currentUser.incomeBalance || 0)})
                  </div>
                </div>
              )}

              {/* Purpose / Category */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  উদ্দেশ্য / ক্যাটাগরি
                </label>
                {trxFlow === "OUT" ? (
                  <div className="w-full text-xs font-black border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-100 dark:bg-slate-950 text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Coins className="w-3.5 h-3.5" />
                    সেভিংস ফান্ড উত্তোলন
                  </div>
                ) : (
                  <select
                    value={trxType}
                    onChange={(e) => setTrxType(e.target.value as any)}
                    required
                    className="w-full text-xs font-extrabold border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition"
                  >
                    <option value="saving">সঞ্চয় জমা (ইনভেস্টর / সেভিংস মোড)</option>
                    <option value="project">প্রজেক্ট বিনিয়োগ (প্রজেক্ট মোড)</option>
                    <option value="installment">কিস্তি পরিশোধ (কিস্তি মোড)</option>
                  </select>
                )}
              </div>
            </div>

            {/* Installment Selector dropdown (Cash In + Installment only) */}
            {trxFlow === "IN" && trxType === "installment" && (
              <div className="p-4 bg-purple-50/50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900 rounded-2xl space-y-2">
                <label className="block text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider">
                  পরিশোধযোগ্য কিস্তি চুক্তি
                </label>
                {selectedUserInstallments.length > 0 ? (
                  <select
                    value={selectedInstallmentId}
                    onChange={(e) => setSelectedInstallmentId(e.target.value)}
                    required
                    className="w-full text-xs font-extrabold border border-purple-200 dark:border-purple-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-purple-900 dark:text-purple-300 outline-none focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-950/50 transition"
                  >
                    {selectedUserInstallments.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.productName} (বকেয়া কিস্তিঃ ৳{formatNum(inst.dueAmount)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    নির্বাচিত সদস্যের কোনো বকেয়া কিস্তি চুক্তি পাওয়া যায়নি। সাধারণ সঞ্চয় জমা করুন।
                  </div>
                )}
              </div>
            )}

            {/* Project Selector dropdown (Cash In + Project only) */}
            {trxFlow === "IN" && trxType === "project" && (
              <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900 rounded-2xl space-y-2">
                <label className="block text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  বিনিয়োগের জন্য প্রজেক্ট নির্বাচন করুন
                </label>
                {projects.filter(p => p.status !== "closed").length > 0 ? (
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                    className="w-full text-xs font-extrabold border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-2 bg-white dark:bg-slate-950 text-emerald-900 dark:text-emerald-300 outline-none focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-950/50 transition"
                  >
                    {projects.filter(p => p.status !== "closed").map((proj) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name} ({proj.duration || "N/A"})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    কোনো সক্রিয় প্রজেক্ট পাওয়া যায়নি। সাধারণ সঞ্চয় জমা করুন।
                  </div>
                )}
              </div>
            )}

            {/* Amount and Date Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  টাকার পরিমাণ (Amount ৳)
                </label>
                <input
                  type="number"
                  value={trxAmount}
                  onChange={(e) => setTrxAmount(e.target.value)}
                  placeholder="পরিমাণ (৳)"
                  required
                  min="1"
                  className="w-full text-xs font-extrabold border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  তারিখ (Date)
                </label>
                <input
                  type="date"
                  value={trxDate}
                  onChange={(e) => setTrxDate(e.target.value)}
                  required
                  className="w-full text-xs font-extrabold border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition"
                />
              </div>
            </div>

            {/* Payment Method selector */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2.5">
                লেনদেন মাধ্যম (Payment Method)
              </label>
              <div
                className={`grid gap-2 ${
                  trxFlow === "OUT"
                    ? "grid-cols-3"
                    : companyGateway?.enabled
                    ? "grid-cols-3"
                    : "grid-cols-2"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPaymentMethod("mobile_banking")}
                  className={`py-2.5 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1.5 justify-center transition cursor-pointer ${
                    paymentMethod === "mobile_banking"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-extrabold"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
                  }`}
                >
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                  মোবাইল ব্যাংকিং
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={`py-2.5 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1.5 justify-center transition cursor-pointer ${
                    paymentMethod === "bank"
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-extrabold"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
                  }`}
                >
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                  ব্যাংক ট্রান্সফার
                </button>
                {trxFlow === "IN" && companyGateway?.enabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online_gateway")}
                    className={`py-2.5 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1.5 justify-center transition cursor-pointer ${
                      paymentMethod === "online_gateway"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-extrabold"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-emerald-500 animate-pulse" />
                    গেটওয়ে পে (Online)
                  </button>
                )}
                {trxFlow === "OUT" && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`py-2.5 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1.5 justify-center transition cursor-pointer ${
                      paymentMethod === "cash"
                        ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-extrabold"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900"
                    }`}
                  >
                    <Coins className="w-4 h-4 text-indigo-500" />
                    ক্যাশ কাউন্টার
                  </button>
                )}
              </div>
            </div>

            {/* Simulated Online Gateway Explainer Box */}
            {trxFlow === "IN" && paymentMethod === "online_gateway" && (
              <div className="bg-emerald-50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 space-y-3 animate-fadeIn text-left">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-extrabold text-xs">
                  <span className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  </span>
                  ইনস্ট্যান্ট অনলাইন গেটওয়ে পেমেন্ট
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
                  আপনি <span className="text-emerald-700 dark:text-emerald-400 font-black">{companyGateway?.displayName || "অনলাইন পেমেন্ট গেটওয়ে"}</span> নির্বাচন করেছেন। সাবমিট বাটনে চাপ দিলে একটি সিকিউর পেমেন্ট উইন্ডো ওপেন হবে। পেমেন্ট সম্পন্ন হওয়ার পর ট্রানজেকশনটি স্বয়ংক্রিয়ভাবে ডেটাবেজে যুক্ত হয়ে যাবে।
                </p>
                <div className="bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-dashed border-emerald-200 dark:border-emerald-900 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-bold">গেটওয়ে প্রোভাইডার:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-extrabold uppercase bg-slate-50 dark:bg-slate-900 px-2 py-0.5 rounded border dark:border-slate-800">
                    {companyGateway?.provider || "bKash"}
                  </span>
                </div>
              </div>
            )}

            {/* Display Company payment accounts for Manual Payment */}
            {trxFlow === "IN" && paymentMethod !== "online_gateway" && (
              <div className="bg-amber-50/60 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900 rounded-2xl p-4 space-y-2 text-left">
                <div className="flex items-center gap-1 text-amber-800 dark:text-amber-400 font-extrabold text-[10px]">
                  <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  টাকা পাঠানোর জন্য কোম্পানির পেমেন্ট অ্যাকাউন্ট তালিকাঃ
                </div>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {companyAccounts
                    .filter((acc) => acc.companyId === targetCompanyId && acc.type === paymentMethod && acc.isActive)
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className="bg-white dark:bg-slate-950 border border-slate-150 dark:border-slate-850 rounded-xl p-3 flex items-center justify-between gap-2 shadow-3xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-[9px] font-black">
                            <span className="text-pink-600 bg-pink-50 dark:bg-pink-950/20 px-1.5 py-0.5 rounded">
                              {acc.providerName}
                            </span>
                            <span className="text-slate-400">({acc.accountType || "N/A"})</span>
                          </div>
                          <div className="text-[11px] font-black text-slate-700 dark:text-slate-300 select-all tracking-wide">
                            {acc.accountNumber}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(acc.accountNumber);
                            setCopiedAccountId(acc.id);
                            setTimeout(() => setCopiedAccountId(null), 1500);
                          }}
                          className="p-1.5 border border-slate-200 dark:border-slate-800 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 rounded-lg text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer bg-white dark:bg-slate-900"
                        >
                          {copiedAccountId === acc.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          Copy
                        </button>
                      </div>
                    ))}
                  {companyAccounts.filter(
                    (acc) => acc.companyId === targetCompanyId && acc.type === paymentMethod && acc.isActive
                  ).length === 0 && (
                    <div className="text-center py-4 text-[10px] font-bold text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950">
                      কোনো সক্রিয় একাউন্ট পাওয়া যায়নি।
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Inputs for Mobile Banking detail */}
            {paymentMethod === "mobile_banking" && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="flex gap-1.5">
                  {["bkash", "nagad", "rocket", "upay"].map((provider) => (
                    <button
                      key={provider}
                      type="button"
                      onClick={() => setMobileProvider(provider as any)}
                      className={`flex-1 py-1.5 text-[9px] font-black uppercase rounded-lg border transition cursor-pointer ${
                        mobileProvider === provider
                          ? "bg-pink-50 border-pink-300 dark:bg-pink-950/20 text-pink-700 dark:text-pink-400 font-bold"
                          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {provider === "bkash"
                        ? "bKash"
                        : provider === "nagad"
                        ? "Nagad"
                        : provider === "rocket"
                        ? "Rocket"
                        : "Upay"}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500 uppercase">অ্যাকাউন্ট নম্বর</label>
                    <input
                      type="tel"
                      value={mobileAccountNo}
                      onChange={(e) => setMobileAccountNo(e.target.value)}
                      placeholder="017XXXXXXXX"
                      required
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-950"
                    />
                  </div>
                  {trxFlow === "IN" && (
                    <div>
                      <label className="block text-[8px] font-black text-slate-500 uppercase">TxID (ট্রানজেকশন আইডি)</label>
                      <input
                        type="text"
                        value={mobileTrxId}
                        onChange={(e) => setMobileTrxId(e.target.value)}
                        placeholder="AX9K2H7F"
                        required={trxFlow === "IN"}
                        className="w-full text-xs font-mono font-bold border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-950"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Inputs for Bank transfer detail */}
            {paymentMethod === "bank" && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500">ব্যাংকের নাম</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full text-[10px] font-bold border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-950"
                    >
                      <option value="Dutch-Bangla Bank">Dutch-Bangla Bank (DBBL)</option>
                      <option value="Islami Bank Bangladesh">Islami Bank Bangladesh</option>
                      <option value="BRAC Bank">BRAC Bank</option>
                      <option value="Sonali Bank">Sonali Bank</option>
                      <option value="The City Bank">The City Bank</option>
                      <option value="Other Bank">অন্যান্য ব্যাংক</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-500">শাখার নাম</label>
                    <input
                      type="text"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      placeholder="শাখার নাম"
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-950"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-slate-500">হিসাব নম্বর</label>
                    <input
                      type="text"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      placeholder="Bank Account Number"
                      required
                      className="w-full text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-950"
                    />
                  </div>
                  {trxFlow === "IN" && (
                    <div>
                      <label className="block text-[8px] font-black text-slate-500">রেফারেন্স / স্লিপ আইডি</label>
                      <input
                        type="text"
                        value={bankTrxId}
                        onChange={(e) => setBankTrxId(e.target.value)}
                        placeholder="SLIP-XXXX"
                        required={trxFlow === "IN"}
                        className="w-full text-xs font-mono font-bold border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-2 bg-white dark:bg-slate-950"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Memo Text area */}
            <div>
              <label className="block text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1.5">
                মন্তব্য / মেমো / বিবরণ (Optional)
              </label>
              <textarea
                value={trxMemo}
                onChange={(e) => setTrxMemo(e.target.value)}
                placeholder="অতিরিক্ত বিবরণ বা রেফারেন্স নোট লিখতে পারেন..."
                rows={2}
                className="w-full text-xs font-bold border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/50 transition resize-none"
              />
            </div>

            {toastMsg && (
              <div
                className={`p-3.5 rounded-2xl text-[10px] sm:text-xs font-bold flex items-center gap-2 ${
                  toastMsg.type === "success"
                    ? "bg-emerald-50 border border-emerald-100 text-emerald-800"
                    : "bg-rose-50 border border-rose-100 text-rose-800"
                }`}
              >
                <span>{toastMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3.5 text-white rounded-2xl text-xs sm:text-sm font-black transition-all cursor-pointer shadow-md hover:shadow-lg active:scale-98 ${
                submitting
                  ? "bg-slate-300"
                  : trxFlow === "OUT"
                  ? "bg-rose-600 hover:bg-rose-700"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              }`}
            >
              {submitting
                ? "প্রসেসিং হচ্ছে..."
                : trxFlow === "OUT"
                ? "উত্তোলন রিকোয়েস্ট পাঠান (Request Cashout)"
                : "জমা রিকোয়েস্ট পাঠান (Request Cashin)"}
            </button>
          </form>
        </div>

        {/* Right column helper box: User balance card & Checklist instructions */}
        <div className="md:col-span-4 space-y-6">
          {/* User Account summary card */}
          {selectedMember && (
            <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-sm space-y-4 animate-scaleUp">
              <div>
                <span className="text-[8px] bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  নির্বাচিত সদস্য বিবরণ
                </span>
                <h4 className="text-sm font-black mt-1 tracking-tight truncate">{selectedMember.name}</h4>
                <p className="text-[10px] text-slate-400 font-bold">{selectedMember.email || "কোনো ইমেইল নেই"}</p>
              </div>

              <hr className="border-slate-800" />

              <div className="space-y-2.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">সেভিংস ব্যালেন্সঃ</span>
                  <span className="font-extrabold text-white text-sm font-mono">
                    ৳{formatNum(
                      selectedMember.savingsBalance !== undefined
                        ? selectedMember.savingsBalance
                        : selectedMember.amount || 0
                    )}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold">ইনকাম ব্যালেন্সঃ</span>
                  <span className="font-extrabold text-emerald-400 text-sm font-mono">
                    ৳{formatNum(selectedMember.incomeBalance || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs border-t border-slate-800/60 pt-2.5">
                  <span className="text-slate-400 font-bold">মোট সঞ্চয়ঃ</span>
                  <span className="font-black text-indigo-400 text-base font-mono">
                    ৳{formatNum(
                      (selectedMember.savingsBalance !== undefined
                        ? selectedMember.savingsBalance
                        : selectedMember.amount || 0) + (selectedMember.incomeBalance || 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick instructions checklist */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 text-left space-y-3">
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wide">
              📌 নির্দেশনা ও নিয়মাবলীঃ
            </h4>
            <ul className="space-y-2.5 text-[11px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed list-disc list-inside">
              <li>
                টাকা জমার ক্ষেত্রে অবশ্যই কপি করা কোম্পানির বিকাশ/নগদ নম্বরে প্রথমে টাকা সেন্ড করুন, তারপর সঠিক ট্রানজেকশন আইডি (TxID) সাবমিট করুন।
              </li>
              <li>
                অনলাইন গেটওয়ে (Gateway Pay) অপশনটি ব্যবহার করলে ট্রানজেকশনটি সাথে সাথে ডেটাবেজে ভেরিফাই ও স্বয়ংক্রিয় অ্যাপ্রুভ হবে।
              </li>
              <li>
                উত্তোলনের ক্ষেত্রে কোনো ফেক ট্রানজেকশন আইডি বা অতিরিক্ত উইথড্রয়াল রিকোয়েস্ট পাঠাবেন না, এটি সরাসরি বাতিল হতে পারে।
              </li>
              <li>
                কোম্পানির ম্যানেজার বা অ্যাডমিন রিকোয়েস্টটি যাচাই করে ৫ থেকে ৩০ মিনিটের মধ্যে অনুমোদন (Approve) করে দিবেন।
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Online Gateway Simulation Overlay Modal */}
      {showGatewayCheckout && (
        <GatewayCheckoutModal
          isOpen={showGatewayCheckout}
          onClose={() => setShowGatewayCheckout(false)}
          amount={parseFloat(trxAmount)}
          gateway={companyGateway}
          currentUser={currentUser}
          onSubmit={async (generatedTxId) => {
            const member = users.find((u) => u.docId === selectedUserId);
            if (!member) {
              setToastMsg({ text: "সদস্য পাওয়া যায়নি।", type: "error" });
              return;
            }

            try {
              // 1. Create a transaction request in Firestore
              await addDoc(collection(db, "transaction_requests"), {
                companyId: targetCompanyId || "",
                userId: selectedUserId,
                userName: member.name,
                userEmail: member.email || "",
                flow: "IN",
                type: trxType,
                amount: parseFloat(trxAmount),
                date: trxDate,
                memo: trxMemo || `অনলাইন গেটওয়ে পেমেন্ট (${companyGateway?.displayName || "প্রোভাইডার"})`,
                paymentMethod: "online_gateway",
                status: "pending",
                createdAt: new Date().toISOString(),
                installmentId: trxType === "installment" ? selectedInstallmentId : "",
                installmentName:
                  trxType === "installment"
                    ? selectedUserInstallments.find((i) => i.id === selectedInstallmentId)?.productName || ""
                    : "",
                mobileProvider: companyGateway?.provider || "bkash",
                mobileAccountNo: "Online Gateway",
                mobileTrxId: generatedTxId,
              });

              setToastMsg({
                text: "✅ গেটওয়ে পেমেন্ট সফল! ট্রানজেকশন রিকোয়েস্ট পেন্ডিং তালিকায় যুক্ত করা হয়েছে।",
                type: "success",
              });

              setTrxAmount("");
              setTrxMemo("");
              setShowGatewayCheckout(false);

              setTimeout(() => {
                setToastMsg(null);
                onNavigate("transactions");
              }, 2500);
            } catch (err: any) {
              console.error(err);
              alert("অনলাইন পেমেন্ট সম্পন্ন করা সম্ভব হয়নি।");
            }
          }}
        />
      )}
    </div>
  );
}

// SIMULATED GATEWAY CHECKOUT MODAL
interface GatewayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  gateway: any;
  currentUser: any;
  onSubmit: (trxId: string) => Promise<void>;
}

function GatewayCheckoutModal({
  isOpen,
  onClose,
  amount,
  gateway,
  currentUser,
  onSubmit,
}: GatewayCheckoutModalProps) {
  const [step, setStep] = useState<"channel" | "details" | "otp" | "pin" | "processing" | "completed">("channel");
  const [channel, setChannel] = useState<"bkash" | "nagad" | "rocket" | "card">("bkash");
  const [phone, setPhone] = useState(currentUser?.mobile || "");
  const [otp, setOtp] = useState("");
  const [pin, setPin] = useState("");
  const [cardNo, setCardNo] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCVV, setCardCVV] = useState("");
  const [cardName, setCardName] = useState("");
  const [mockOtp, setMockOtp] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (gateway?.provider) {
      const prov = gateway.provider.toLowerCase();
      if (prov.includes("bkash")) setChannel("bkash");
      else if (prov.includes("nagad")) setChannel("nagad");
      else if (prov.includes("rocket")) setChannel("rocket");
      else setChannel("card");
    }
  }, [gateway]);

  const generateMockOtp = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setMockOtp(code);
    alert(`[Gateway Demo OTP] Your verification code is: ${code}`);
  };

  const handleChannelSelect = (ch: typeof channel) => {
    setChannel(ch);
    setStep("details");
  };

  const handleDetailsSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (channel === "card") {
      if (!cardNo || !cardExpiry || !cardCVV) {
        alert("সবগুলো কার্ডের তথ্য পূরণ করুন।");
        return;
      }
      setStep("otp");
      generateMockOtp();
    } else {
      if (!phone || phone.length < 11) {
        alert("সদস্যর সঠিক মোবাইল নম্বর দিন।");
        return;
      }
      setStep("otp");
      generateMockOtp();
    }
  };

  const handleOtpSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (otp !== mockOtp && otp !== "123456") {
      alert("ভুল ওটিপি (OTP) কোড দিয়েছেন। সঠিক ওটিপি দিন অথবা টেস্ট কোড '123456' ব্যবহার করুন।");
      return;
    }
    if (channel === "card") {
      handleFinalPay();
    } else {
      setStep("pin");
    }
  };

  const handlePinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!pin || pin.length < 4) {
      alert("সদস্যর সঠিক পিন (PIN) নম্বর দিন।");
      return;
    }
    handleFinalPay();
  };

  const handleFinalPay = async () => {
    setStep("processing");
    setLoading(true);

    setTimeout(async () => {
      try {
        const randomTxId = "PG_" + Math.random().toString(36).substring(2, 10).toUpperCase();
        await onSubmit(randomTxId);
        setStep("completed");
      } catch (err) {
        console.error(err);
        setStep("details");
      } finally {
        setLoading(false);
      }
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 text-left">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-150 flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-pink-500 flex items-center justify-center text-white font-black text-sm">
              ৳
            </div>
            <div>
              <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">
                SECURE CHECKOUT
              </div>
              <div className="text-xs font-black text-slate-100">{gateway?.displayName || "Online Gateway"}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Merchant Bar */}
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between text-xs font-bold text-slate-600">
          <div>
            <div className="text-[9px] text-slate-400 uppercase tracking-wide">Merchant:</div>
            <div className="font-extrabold text-slate-800">{gateway?.merchantId || "Merchant Admin"}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-slate-400 uppercase tracking-wide">Amount:</div>
            <div className="font-black text-pink-600 text-sm">৳{amount.toLocaleString("bn-BD")}</div>
          </div>
        </div>

        {/* Wizard Panel */}
        <div className="p-5 flex-1 min-h-[260px] flex flex-col justify-center text-slate-800">
          {step === "channel" && (
            <div className="space-y-4 text-center">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">পেমেন্ট মেথড নির্বাচন করুন</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleChannelSelect("bkash")}
                  className="p-3 border border-pink-100 hover:border-pink-300 rounded-2xl bg-pink-50/20 text-pink-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-pink-50/40"
                >
                  <span className="w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-black text-xs">
                    b
                  </span>
                  <span className="text-[10px] font-black uppercase">bKash</span>
                </button>

                <button
                  onClick={() => handleChannelSelect("nagad")}
                  className="p-3 border border-orange-100 hover:border-orange-300 rounded-2xl bg-orange-50/20 text-orange-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-orange-50/40"
                >
                  <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-black text-xs">
                    N
                  </span>
                  <span className="text-[10px] font-black uppercase">Nagad</span>
                </button>

                <button
                  onClick={() => handleChannelSelect("rocket")}
                  className="p-3 border border-indigo-100 hover:border-indigo-300 rounded-2xl bg-indigo-50/20 text-indigo-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-indigo-50/40"
                >
                  <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-xs">
                    R
                  </span>
                  <span className="text-[10px] font-black uppercase">Rocket</span>
                </button>

                <button
                  onClick={() => handleChannelSelect("card")}
                  className="p-3 border border-slate-200 hover:border-slate-400 rounded-2xl bg-slate-50 text-slate-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-slate-100"
                >
                  <CreditCard className="w-6 h-6 text-slate-600" />
                  <span className="text-[10px] font-black uppercase">Cards</span>
                </button>
              </div>
            </div>
          )}

          {step === "details" && (
            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="text-center">
                <span className="px-3 py-1 text-[9px] font-black uppercase rounded-full bg-slate-100 text-slate-600">
                  {channel} পেমেন্ট
                </span>
              </div>

              {channel === "card" ? (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                      কার্ডহোল্ডারের নাম
                    </label>
                    <input
                      type="text"
                      placeholder="CARDHOLDER NAME"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value.toUpperCase())}
                      required
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">কার্ড নম্বর</label>
                    <input
                      type="text"
                      placeholder="4111 2222 3333 4444"
                      value={cardNo}
                      onChange={(e) => setCardNo(e.target.value)}
                      required
                      className="w-full text-xs font-mono font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">
                        মেয়াদ শেষ (MM/YY)
                      </label>
                      <input
                        type="text"
                        placeholder="12/29"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
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
                        value={cardCVV}
                        onChange={(e) => setCardCVV(e.target.value)}
                        required
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider text-center">
                    আপনার {channel} পার্সোনাল অ্যাকাউন্ট নম্বরটি দিন
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. 017XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    className="w-full text-center text-sm font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white transition"
                  />
                  <p className="text-[8px] font-bold text-slate-400 text-center leading-relaxed">
                    এই পেমেন্ট উইন্ডোটি একটি পরীক্ষামূলক গেটওয়ে সিমুলেশন। সম্পূর্ণ সুরক্ষিত উপায়ে ডেটাবেজে ভেরিফাই
                    হচ্ছে।
                  </p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("channel")}
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

          {step === "otp" && (
            <form onSubmit={handleOtpSubmit} className="space-y-4">
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
                  maxLength={6}
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="w-full text-center text-xl font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-600 focus:bg-white"
                />
                <p className="text-[8px] font-bold text-slate-400 text-center leading-relaxed">
                  সঠিক ওটিপি দিন অথবা টেস্ট কোড <span className="text-indigo-600 font-extrabold">123456</span> ব্যবহার করুন।
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm active:scale-95"
              >
                কোড ভেরিফাই করুন
              </button>
            </form>
          )}

          {step === "pin" && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <span className="px-2.5 py-0.5 text-[8px] font-black uppercase rounded-full bg-pink-50 text-pink-700">
                  পিন ভেরিফিকেশন (Wallet PIN)
                </span>
                <p className="text-[10px] font-bold text-slate-500">
                  আপনার {channel} ওয়ালেট পিন কোড দিয়ে লেনদেন সম্পন্ন করুন।
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  maxLength={5}
                  placeholder="*****"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  className="w-full text-center text-xl font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white"
                />
                <p className="text-[8px] font-bold text-rose-500 text-center leading-relaxed">
                  নিরাপত্তা সতর্কীকরণঃ কখনও আপনার পিন কোড অন্য কারো সাথে শেয়ার করবেন না। এটি সম্পূর্ণ ডেমো মোড।
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm active:scale-95"
              >
                লেনদেন সম্পন্ন করুন
              </button>
            </form>
          )}

          {step === "processing" && (
            <div className="space-y-4 py-8 text-center animate-pulse">
              <div className="w-12 h-12 border-4 border-pink-200 border-t-pink-600 rounded-full animate-spin mx-auto"></div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800">লেনদেন প্রসেসিং হচ্ছে...</h4>
                <p className="text-[10px] font-bold text-slate-400">
                  অনুগ্রহ করে অপেক্ষা করুন। গেটওয়ে সার্ভারের সাথে নিরাপদ সংযোগে কাজ চলছে।
                </p>
              </div>
            </div>
          )}

          {step === "completed" && (
            <div className="space-y-4 py-8 text-center animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-50 rounded-full border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800">পেমেন্ট সফল সম্পন্ন!</h4>
                <p className="text-[10px] font-bold text-slate-400">
                  আপনার পেমেন্ট আইডি সংরক্ষিত হয়েছে। ট্রানজাকশন পেইজে ফিরে যাওয়া হচ্ছে...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
