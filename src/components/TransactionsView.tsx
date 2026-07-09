import { useState, useEffect, FormEvent } from "react";
import { db } from "../firebase";
import { User, HistoryEntry, Project, Transaction, Installment, InstallmentStep, TransactionRequest, CompanyPaymentAccount } from "../types";
import { 
  collection, 
  onSnapshot, 
  collectionGroup, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  increment,
  query,
  where
} from "firebase/firestore";
import { 
  ArrowLeftRight, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown, 
  User as UserIcon, 
  Calendar, 
  Building,
  FileSpreadsheet,
  Download,
  X,
  Plus,
  Coins,
  CreditCard,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Check,
  XCircle,
  Eye,
  FileText,
  Settings,
  Copy,
  Trash,
  CheckSquare,
  Edit3
} from "lucide-react";

interface TransactionsViewProps {
  currentUser: User;
  onNavigate: (view: string, params?: any) => void;
}

interface ComputedLedgerItem {
  id: string;
  date: string;
  userDocId: string;
  userName: string;
  type: "saving" | "project_expense" | "project_sale" | "installment_income" | "saving_withdraw";
  typeLabel: string;
  memo: string;
  flow: "IN" | "OUT";
  amount: number;
  projectName: string;
  status?: "pending" | "approved" | "rejected";
}

export default function TransactionsView({ currentUser, onNavigate }: TransactionsViewProps) {
  // FireStore raw data states
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [companyTransactions, setCompanyTransactions] = useState<Transaction[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [allHistories, setAllHistories] = useState<(HistoryEntry & { userDocId: string })[]>([]);
  const [transactionRequests, setTransactionRequests] = useState<TransactionRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterUser, setFilterUser] = useState<string>("all");
  const [filterFlow, setFilterFlow] = useState<"all" | "IN" | "OUT">("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Transaction Modal state
  const [showTrxModal, setShowTrxModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [trxFlow, setTrxFlow] = useState<"IN" | "OUT">("IN");
  const [trxType, setTrxType] = useState<"saving" | "installment">("saving");
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser.role === "member" ? currentUser.docId : "");
  const [trxAmount, setTrxAmount] = useState<string>("");
  const [trxDate, setTrxDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [trxMemo, setTrxMemo] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"mobile_banking" | "bank" | "cash">("mobile_banking");

  // Mobile Banking details
  const [mobileProvider, setMobileProvider] = useState<"bkash" | "nagad" | "rocket" | "upay">("bkash");
  const [mobileAccountNo, setMobileAccountNo] = useState<string>("");
  const [mobileTrxId, setMobileTrxId] = useState<string>("");

  // Bank Transfer details
  const [bankName, setBankName] = useState<string>("Dutch-Bangla Bank");
  const [bankBranch, setBankBranch] = useState<string>("");
  const [bankAccountNo, setBankAccountNo] = useState<string>("");
  const [bankTrxId, setBankTrxId] = useState<string>("");

  // Toast / Status state
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Installment reference selection
  const [selectedInstallmentId, setSelectedInstallmentId] = useState<string>("");

  // Rejection & Request UI state
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [requestFilterTab, setRequestFilterTab] = useState<"pending" | "all_history">("pending");

  // Company Payment Accounts State
  const [companyAccounts, setCompanyAccounts] = useState<CompanyPaymentAccount[]>([]);
  const [copiedAccountId, setCopiedAccountId] = useState<string | null>(null);

  // Company Gateway settings state
  const [companyGateway, setCompanyGateway] = useState<any>(null);
  const [showGatewayCheckout, setShowGatewayCheckout] = useState(false);

  // Navigation tabs for separating transaction concerns (Ledger, Savings, Installments, Settings)
  const [activeSubTab, setActiveSubTab] = useState<"ledger" | "savings" | "installments" | "settings">("ledger");

  // Setup real-time listeners for all required collections
  useEffect(() => {
    setLoading(true);

    const targetCompanyId = currentUser.role === "company" ? currentUser.docId : currentUser.companyId;

    // 1. Role-based Users Query
    const userQuery = currentUser.role === "admin"
      ? collection(db, "users")
      : query(collection(db, "users"), where("companyId", "==", targetCompanyId || ""));

    const unsubUsers = onSnapshot(userQuery, (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        list.push({ docId: d.id, ...d.data() } as User);
      });
      if (currentUser.role === "company" && !list.some((u) => u.docId === currentUser.docId)) {
        list.push(currentUser);
      }
      setUsers(list);
    });

    // 2. Role-based Projects Query
    const projectQuery = currentUser.role === "admin"
      ? collection(db, "projects")
      : query(collection(db, "projects"), where("companyId", "==", targetCompanyId || ""));

    const unsubProjects = onSnapshot(projectQuery, (snap) => {
      const list: Project[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Project);
      });
      setProjects(list);
    });

    // 3. Role-based Accounts (Transactions) Query
    const accountQuery = currentUser.role === "admin"
      ? collection(db, "accounts")
      : query(collection(db, "accounts"), where("companyId", "==", targetCompanyId || ""));

    const unsubAccounts = onSnapshot(accountQuery, (snap) => {
      const list: Transaction[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Transaction);
      });
      setCompanyTransactions(list);
    });

    // 4. Role-based Installments Query
    const installmentQuery = currentUser.role === "admin"
      ? collection(db, "installments")
      : query(collection(db, "installments"), where("companyId", "==", targetCompanyId || ""));

    const unsubInstallments = onSnapshot(installmentQuery, (snap) => {
      const list: Installment[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as Installment);
      });
      setInstallments(list);
    });

    // 5. Role-based History Query
    let unsubAllHistory: () => void;
    if (currentUser.role === "admin") {
      unsubAllHistory = onSnapshot(collectionGroup(db, "history"), (snap) => {
        const list: (HistoryEntry & { userDocId: string })[] = [];
        snap.forEach((d) => {
          const parentUserDocId = d.ref.parent?.parent?.id || "";
          list.push({ docId: d.id, userDocId: parentUserDocId, ...d.data() } as any);
        });
        setAllHistories(list);
        setLoading(false);
      });
    } else if (currentUser.role === "member") {
      unsubAllHistory = onSnapshot(collection(db, "users", currentUser.docId, "history"), (snap) => {
        const list: (HistoryEntry & { userDocId: string })[] = [];
        snap.forEach((d) => {
          list.push({ docId: d.id, userDocId: currentUser.docId, ...d.data() } as any);
        });
        setAllHistories(list);
        setLoading(false);
      });
    } else {
      unsubAllHistory = () => {
        setLoading(false);
      };
    }

    // 6. Role-based Transaction Requests Query
    const requestQuery = currentUser.role === "admin"
      ? collection(db, "transaction_requests")
      : query(collection(db, "transaction_requests"), where("companyId", "==", targetCompanyId || ""));

    const unsubRequests = onSnapshot(requestQuery, (snap) => {
      const list: TransactionRequest[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as TransactionRequest);
      });
      setTransactionRequests(list);
    });

    // 7. Role-based Company Payment Accounts Query
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

    // 8. Company Gateway Settings Query
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

    return () => {
      unsubUsers();
      unsubProjects();
      unsubAccounts();
      unsubInstallments();
      unsubAllHistory();
      unsubRequests();
      unsubCompanyAccounts();
      unsubGateway();
    };
  }, [currentUser]);

  // Live sync of all company members' histories for Company role
  useEffect(() => {
    if (currentUser.role !== "company") return;
    if (users.length === 0) return;

    // Filter company members
    const companyMembers = users.filter((u) => u.role === "member" && u.companyId === currentUser.docId);

    if (companyMembers.length === 0) {
      setLoading(false);
      return;
    }

    let loadedCount = 0;
    const unsubs = companyMembers.map((m) => {
      return onSnapshot(collection(db, "users", m.docId, "history"), (snap) => {
        setAllHistories((prev) => {
          const filtered = prev.filter((h) => h.userDocId !== m.docId);
          const newEntries: any[] = [];
          snap.forEach((docSnap) => {
            newEntries.push({ docId: docSnap.id, userDocId: m.docId, ...docSnap.data() });
          });
          return [...filtered, ...newEntries];
        });

        loadedCount++;
        if (loadedCount >= companyMembers.length) {
          setLoading(false);
        }
      }, (err) => {
        console.error("Error loading member history:", err);
        loadedCount++;
        if (loadedCount >= companyMembers.length) {
          setLoading(false);
        }
      });
    });

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [users, currentUser]);

  // If the user is a standard member, lock their user filter & transaction form to their own docId
  useEffect(() => {
    if (currentUser.role === "member") {
      setFilterUser(currentUser.docId);
      setSelectedUserId(currentUser.docId);
    }
  }, [currentUser]);

  // Determine current active company details
  const targetCompanyId = currentUser.role === "company" ? currentUser.docId : currentUser.companyId;
  const isAdminOrCompany = currentUser.role === "admin" || currentUser.role === "company";

  // Filter members belonging to the current user's company (unless Admin who sees everything)
  const activeCompanyMembers = users.filter((u) => {
    if (currentUser.role === "admin") return true;
    return u.companyId === targetCompanyId && u.status === "active";
  });

  // Filter projects belonging to current company
  const activeCompanyProjects = projects.filter((p) => {
    if (currentUser.role === "admin") return true;
    return p.companyId === targetCompanyId;
  });

  // Filter company accounts (transactions)
  const activeCompanyTransactions = companyTransactions.filter((t) => {
    if (currentUser.role === "admin") return true;
    const p = projects.find((proj) => proj.id === t.projectId);
    return p && p.companyId === targetCompanyId;
  });

  // Filter company installments
  const activeCompanyInstallments = installments.filter((inst) => {
    if (currentUser.role === "admin") return true;
    return inst.companyId === targetCompanyId;
  });

  // Dynaimcally query active installments of the selected user
  const selectedUserObj = users.find((u) => u.docId === selectedUserId);
  const selectedUserInstallments = installments.filter((inst) => {
    if (!selectedUserObj) return false;
    // Match customer name exactly or handle mapping
    return inst.customerName === selectedUserObj.name && inst.status !== "closed";
  });

  // Update selected installment whenever selectedUserId or active list changes
  useEffect(() => {
    if (selectedUserInstallments.length > 0) {
      setSelectedInstallmentId(selectedUserInstallments[0].id);
    } else {
      setSelectedInstallmentId("");
    }
  }, [selectedUserId, installments]);

  // Handle flow state toggle in form
  const handleFlowToggle = (flow: "IN" | "OUT") => {
    setTrxFlow(flow);
    // If Cash Out (OUT) is selected, force category to general savings withdrawal
    if (flow === "OUT") {
      setTrxType("saving");
    } else {
      // If Cash In is selected, reset payment method from "cash" to "mobile_banking"
      if (paymentMethod === "cash") {
        setPaymentMethod("mobile_banking");
      }
    }
  };

  // ==========================================
  // MATHEMATICAL SHARE CALCULATOR & LEDGER BUILDER
  // ==========================================
  const buildTransactionsLedger = (): ComputedLedgerItem[] => {
    const ledger: ComputedLedgerItem[] = [];

    // 1. Build special investment maps & general company pool
    const memberSpecialInvMap: Record<string, Record<string, number>> = {};
    const memberTotalSpecialInv: Record<string, number> = {};

    allHistories.forEach((h) => {
      const uId = h.userDocId;
      if (!uId) return;

      const amt = Number(h.amount || 0);
      if (h.type === "savings_arrears" || amt === 0) return;

      if (!memberSpecialInvMap[uId]) {
        memberSpecialInvMap[uId] = {};
      }

      // Filter only positive direct savings for special calculations
      if (amt > 0 && h.projectId && h.projectId !== "company") {
        memberSpecialInvMap[uId][h.projectId] = (memberSpecialInvMap[uId][h.projectId] || 0) + amt;
        memberTotalSpecialInv[uId] = (memberTotalSpecialInv[uId] || 0) + amt;
      }
    });

    // 2. Compute participating amounts per project
    const memberGeneralInv: Record<string, number> = {};
    const memberProjectsInv: Record<string, Record<string, number>> = {};
    const projectTotalParticipating: Record<string, number> = {};

    activeCompanyMembers.forEach((u) => {
      const uAmt = Number(u.amount || 0);
      if (u.accountType === "saving") return;

      const totalSpecial = memberTotalSpecialInv[u.docId] || 0;
      const generalAmt = Math.max(0, uAmt - totalSpecial);
      memberGeneralInv[u.docId] = generalAmt;

      memberProjectsInv[u.docId] = {};
      activeCompanyProjects.forEach((p) => {
        const specAmt = (memberSpecialInvMap[u.docId] || {})[p.id] || 0;
        const partAmt = specAmt + generalAmt;
        memberProjectsInv[u.docId][p.id] = partAmt;
        projectTotalParticipating[p.id] = (projectTotalParticipating[p.id] || 0) + partAmt;
      });
    });

    // 3. Compute share fraction per member per project
    const memberProjectsShare: Record<string, Record<string, number>> = {};

    activeCompanyMembers.forEach((u) => {
      memberProjectsShare[u.docId] = {};
      if (u.accountType === "saving") {
        activeCompanyProjects.forEach((p) => {
          memberProjectsShare[u.docId][p.id] = 0;
        });
        return;
      }

      activeCompanyProjects.forEach((p) => {
        let share = 0;
        if (u.customShare !== undefined && u.customShare !== null) {
          share = u.customShare / 100;
        } else {
          const partAmt = (memberProjectsInv[u.docId] || {})[p.id] || 0;
          const projTotal = projectTotalParticipating[p.id] || 0;
          share = projTotal > 0 ? partAmt / projTotal : 0;
        }
        memberProjectsShare[u.docId][p.id] = share;
      });
    });

    // Now, let's assemble all ledger transactions for each member in activeCompanyMembers
    activeCompanyMembers.forEach((member) => {
      const shareData = memberProjectsShare[member.docId] || {};

      // A. DIRECT SAVINGS & GENERAL CASH DEPOSITS & WITHDRAWALS
      const userHistories = allHistories.filter(
        (h) => h.userDocId === member.docId && h.type !== "savings_arrears"
      );

      userHistories.forEach((h) => {
        const amt = Number(h.amount || 0);
        if (amt === 0) return;

        const isWithdraw = h.type === "withdraw" || h.flow === "OUT" || amt < 0;
        const absAmt = Math.abs(amt);

        let typeLabel = "সঞ্চয় জমা (Deposit)";
        let typeVal: "saving" | "saving_withdraw" = "saving";
        if (isWithdraw) {
          typeLabel = "টাকা উত্তোলন (Withdrawal)";
          typeVal = "saving_withdraw";
          if (h.type === "invest_convert_out") {
            typeLabel = "সেভিংস স্থানান্তর (Transfer Out)";
          }
        } else if (h.type === "savings_arrears_paid") {
          typeLabel = "বকেয়া সঞ্চয় পরিশোধ";
        } else if (h.type === "installment_payment") {
          typeLabel = "কিস্তি পরিশোধ (Installment)";
        } else if (h.type === "invest_convert") {
          typeLabel = "সেভিংস রূপান্তর (Transfer In)";
        }

        // Build elegant details string for the memo
        let paymentInfo = "";
        if (h.paymentMethod === "mobile_banking") {
          paymentInfo = ` [মোবাইল ব্যাংকিং: ${String(h.mobileProvider || "বিকাশ").toUpperCase()}, নম্বর: ${h.accountNo || "N/A"}, TxID: ${h.trxId || "N/A"}]`;
        } else if (h.paymentMethod === "bank") {
          paymentInfo = ` [ব্যাংক ট্রান্সফার: ${h.bankName || "N/A"}, হিসাব: ${h.accountNo || "N/A"}, TxID: ${h.trxId || "N/A"}]`;
        }

        ledger.push({
          id: h.docId,
          date: h.date || new Date().toISOString().split("T")[0],
          userDocId: member.docId,
          userName: member.name,
          type: typeVal,
          typeLabel: typeLabel,
          memo: `${h.memo || "লেনদেন"} ${paymentInfo}`,
          flow: isWithdraw ? "OUT" : "IN",
          amount: absAmt,
          projectName: h.projectName || "কোম্পানি (সাধারণ)"
        });
      });

      // B. PROJECT EXPENSES (OUT)
      activeCompanyTransactions.forEach((t) => {
        if (t.type !== "expense") return;

        const shareFraction = shareData[t.projectId] || 0;
        if (shareFraction <= 0) return;

        const memberShareAmt = parseFloat((t.amount * shareFraction).toFixed(2));
        if (memberShareAmt <= 0) return;

        ledger.push({
          id: `${t.id}-expense-${member.docId}`,
          date: t.date || new Date().toISOString().split("T")[0],
          userDocId: member.docId,
          userName: member.name,
          type: "project_expense",
          typeLabel: "শেয়ার খরচ (Project Expense)",
          memo: `${t.desc || "প্রজেক্টের খরচ কোটা"} (শেয়ার: ${(shareFraction * 100).toFixed(1)}%)`,
          flow: "OUT",
          amount: memberShareAmt,
          projectName: t.projectName || "প্রজেক্ট ব্যয়"
        });
      });

      // C. PROJECT SALES (IN)
      activeCompanyTransactions.forEach((t) => {
        if (t.type !== "sale") return;

        const shareFraction = shareData[t.projectId] || 0;
        if (shareFraction <= 0) return;

        const memberShareAmt = parseFloat((t.amount * shareFraction).toFixed(2));
        if (memberShareAmt <= 0) return;

        ledger.push({
          id: `${t.id}-sale-${member.docId}`,
          date: t.date || new Date().toISOString().split("T")[0],
          userDocId: member.docId,
          userName: member.name,
          type: "project_sale",
          typeLabel: "শেয়ার লভ্যাংশ (Project Sale)",
          memo: `${t.desc || "প্রজেক্ট ফ্ল্যাট/প্লট বিক্রয়"} (শেয়ার: ${(shareFraction * 100).toFixed(1)}%)`,
          flow: "IN",
          amount: memberShareAmt,
          projectName: t.projectName || "প্রজেক্ট বিক্রয়"
        });
      });

      // D. CUSTOMER INSTALLMENT PAYMENTS (IN)
      activeCompanyInstallments.forEach((inst) => {
        const matchedProj = activeCompanyProjects.find((p) => p.name === inst.productName);
        if (!matchedProj) return;

        const shareFraction = shareData[matchedProj.id] || 0;
        if (shareFraction <= 0) return;

        // Downpayment share
        if (inst.downPayment > 0) {
          const dpShareAmt = parseFloat((inst.downPayment * shareFraction).toFixed(2));
          const instDate = inst.startDate || inst.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0];
          ledger.push({
            id: `${inst.id}-downpayment-${member.docId}`,
            date: instDate,
            userDocId: member.docId,
            userName: member.name,
            type: "installment_income",
            typeLabel: "ডাউনপেমেন্ট লভ্যাংশ",
            memo: `গ্রাহক: ${inst.customerName} এর ডাউনপেমেন্ট শেয়ার (${(shareFraction * 100).toFixed(1)}%)`,
            flow: "IN",
            amount: dpShareAmt,
            projectName: matchedProj.name
          });
        }

        // Paid monthly installment steps share
        const paidSteps = (inst.schedule || []).filter((s) => s.status === "paid" || s.paidAmount > 0);
        paidSteps.forEach((step) => {
          const stepPaidAmt = step.paidAmount || step.amount;
          const stepShareAmt = parseFloat((stepPaidAmt * shareFraction).toFixed(2));
          if (stepShareAmt <= 0) return;

          const stepDate = step.paidDate || step.dueDate || new Date().toISOString().split("T")[0];

          ledger.push({
            id: `${inst.id}-step-${step.month}-${member.docId}`,
            date: stepDate,
            userDocId: member.docId,
            userName: member.name,
            type: "installment_income",
            typeLabel: `কিস্তি আদায় লভ্যাংশ (${step.month} নং মাস)`,
            memo: `গ্রাহক: ${inst.customerName} এর কিস্তি শেয়ার (${(shareFraction * 100).toFixed(1)}%)`,
            flow: "IN",
            amount: stepShareAmt,
            projectName: matchedProj.name
          });
        });
      });

      // E. PENDING & REJECTED TRANSACTION REQUESTS (IN / OUT)
      const userRequests = transactionRequests.filter(
        (r) => r.userId === member.docId && (r.status === "pending" || r.status === "rejected")
      );

      userRequests.forEach((r) => {
        const amt = Number(r.amount || 0);
        if (amt === 0) return;

        const isWithdraw = r.flow === "OUT" || r.type === "withdraw";
        const absAmt = Math.abs(amt);

        let typeLabel = r.type === "saving" ? "সঞ্চয় জমা" : r.type === "installment" ? "কিস্তি পরিশোধ" : r.type === "project" ? "প্রজেক্ট বিনিয়োগ" : "লেনদেন";
        if (isWithdraw) {
          typeLabel = "টাকা উত্তোলন";
        }

        let paymentInfo = "";
        if (r.paymentMethod === "mobile_banking") {
          paymentInfo = ` [মোবাইল ব্যাংকিং: ${String(r.mobileProvider || "বিকাশ").toUpperCase()}, নম্বর: ${r.mobileAccountNo || "N/A"}, TxID: ${r.mobileTrxId || "N/A"}]`;
        } else if (r.paymentMethod === "bank") {
          paymentInfo = ` [ব্যাংক ট্রান্সফার: ${r.bankName || "N/A"}, হিসাব: ${r.bankAccountNo || "N/A"}, TxID: ${r.bankTrxId || "N/A"}]`;
        } else if (r.paymentMethod === "online_gateway") {
          paymentInfo = ` [অনлайн গেটওয়ে, TxID: ${r.mobileTrxId || "N/A"}]`;
        }

        ledger.push({
          id: r.id,
          date: r.date || r.createdAt?.split("T")[0] || new Date().toISOString().split("T")[0],
          userDocId: member.docId,
          userName: member.name,
          type: r.type === "saving" ? "saving" : isWithdraw ? "saving_withdraw" : r.type === "project" ? "project_sale" : "installment_income",
          typeLabel: typeLabel,
          memo: `${r.memo || "লেনদেন রিকোয়েস্ট"} ${paymentInfo}`,
          flow: isWithdraw ? "OUT" : "IN",
          amount: absAmt,
          projectName: r.projectName || "কোম্পানি (সাধারণ)",
          status: r.status as "pending" | "rejected"
        });
      });
    });

    // Sort by date desc (latest first), then by id to ensure stable sort
    return ledger.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.id.localeCompare(a.id);
    });
  };

  const fullLedger = buildTransactionsLedger();

  // Filtered Ledger based on selections
  const filteredLedger = fullLedger.filter((item) => {
    // 1. User Filter
    if (filterUser !== "all" && item.userDocId !== filterUser) {
      return false;
    }

    // 2. Flow Filter
    if (filterFlow !== "all" && item.flow !== filterFlow) {
      return false;
    }

    // 3. Type Filter
    if (filterType !== "all") {
      if (filterType === "saving" && item.type !== "saving" && item.type !== "saving_withdraw") {
        return false;
      }
      if (filterType === "project_expense" && item.type !== "project_expense") {
        return false;
      }
      if (filterType === "project_sale" && item.type !== "project_sale") {
        return false;
      }
      if (filterType === "installment_income" && item.type !== "installment_income") {
        return false;
      }
    }

    // 4. Date range filter
    if (dateFrom && item.date < dateFrom) return false;
    if (dateTo && item.date > dateTo) return false;

    // 5. Search Query (matches user name, memo, project name, or type label)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.userName.toLowerCase().includes(q);
      const matchMemo = item.memo.toLowerCase().includes(q);
      const matchProj = item.projectName.toLowerCase().includes(q);
      const matchLabel = item.typeLabel.toLowerCase().includes(q);
      return matchName || matchMemo || matchProj || matchLabel;
    }

    return true;
  });

  // Calculate Aggregations for the visible ledger
  const totalIn = filteredLedger
    .filter((item) => item.flow === "IN")
    .reduce((sum, item) => sum + item.amount, 0);

  const totalOut = filteredLedger
    .filter((item) => item.flow === "OUT")
    .reduce((sum, item) => sum + item.amount, 0);

  const netBalance = totalIn - totalOut;

  // Filter and sort transaction requests
  const filteredRequests = transactionRequests
    .filter((req) => {
      // 1. Role / Company filter
      if (currentUser.role === "company") {
        if (req.companyId !== targetCompanyId) return false;
      } else if (currentUser.role === "member") {
        if (req.userId !== currentUser.docId) return false;
      }

      // 2. Status Tab Filter
      if (requestFilterTab === "pending") {
        return req.status === "pending";
      }
      return true; // "all_history" shows all
    })
    .sort((a, b) => {
      const aTime = a.createdAt || "";
      const bTime = b.createdAt || "";
      return bTime.localeCompare(aTime);
    });

  // Formatting helpers
  const formatNum = (val: number) => {
    return new Intl.NumberFormat("bn-BD", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const handleExportCSV = () => {
    // Construct CSV content
    const headers = ["Date", "Member Name", "Type", "Description", "Project", "Flow", "Amount (BDT)"];
    const rows = filteredLedger.map((item) => [
      item.date,
      item.userName,
      item.typeLabel,
      item.memo.replace(/,/g, " "),
      item.projectName.replace(/,/g, " "),
      item.flow,
      item.amount
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Transactions_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      setToastMsg({ text: "পিডিএফ উইন্ডো ওপেন করা সম্ভব হয়নি। পপ-আপ ব্লকার চেক করুন।", type: "error" });
      return;
    }

    const companyName = currentUser.companyName || "কোম্পানি";
    const reportDate = new Date().toLocaleDateString("bn-BD");
    const dateRangeStr = (dateFrom || dateTo) 
      ? `তারিখঃ ${dateFrom || "শুরু"} হতে ${dateTo || "আজ"}`
      : "সকল সময়ের লেনদেন বিবরণী";

    let rowsHtml = filteredLedger.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 10px; font-weight: bold; font-family: monospace;">${item.date}</td>
        <td style="padding: 10px; font-weight: bold; color: #1e293b;">${item.userName}</td>
        <td style="padding: 10px;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 800; background-color: ${
            item.flow === "IN" ? "#ecfdf5" : "#fef2f2"
          }; color: ${item.flow === "IN" ? "#065f46" : "#991b1b"}; border: 1px solid ${
            item.flow === "IN" ? "#d1fae5" : "#fee2e2"
          };">
            ${item.typeLabel}
          </span>
        </td>
        <td style="padding: 10px; color: #475569;">${item.memo}</td>
        <td style="padding: 10px; color: #475569;">${item.projectName}</td>
        <td style="padding: 10px; font-weight: 800; color: ${item.flow === "IN" ? "#059669" : "#dc2626"};">
          ${item.flow === "IN" ? "জমা (IN)" : "উত্তোলন/খরচ (OUT)"}
        </td>
        <td style="padding: 10px; text-align: right; font-weight: bold; color: #0f172a;">৳${formatNum(item.amount)}</td>
      </tr>
    `).join("");

    if (filteredLedger.length === 0) {
      rowsHtml = `<tr><td colspan="7" style="padding: 30px; text-align: center; color: #94a3b8; font-weight: bold;">কোনো লেনদেন রেকর্ড পাওয়া যায়নি</td></tr>`;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${companyName} - ট্রানজেকশন রিপোর্ট</title>
          <meta charset="utf-8">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
            body {
              font-family: 'Inter', system-ui, -apple-system, sans-serif;
              color: #1e293b;
              margin: 40px;
              line-height: 1.5;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #6366f1;
              padding-bottom: 15px;
              margin-bottom: 25px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              color: #4f46e5;
              margin: 0;
            }
            .subtitle {
              font-size: 11px;
              color: #64748b;
              margin: 3px 0 0 0;
              font-weight: 600;
            }
            .meta-info {
              text-align: right;
              font-size: 11px;
              color: #475569;
            }
            .meta-info p {
              margin: 3px 0;
              font-weight: 500;
            }
            .summary-cards {
              display: grid;
              grid-template-cols: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 25px;
            }
            .card {
              border-radius: 12px;
              padding: 15px;
              border: 1px solid #e2e8f0;
            }
            .card-in {
              background-color: #f0fdf4;
              border-color: #bbf7d0;
            }
            .card-out {
              background-color: #fef2f2;
              border-color: #fecaca;
            }
            .card-net {
              background-color: #f5f3ff;
              border-color: #ddd6fe;
            }
            .card-title {
              font-size: 9px;
              text-transform: uppercase;
              font-weight: 800;
              letter-spacing: 0.5px;
              color: #475569;
              margin: 0;
            }
            .card-value {
              font-size: 18px;
              font-weight: 800;
              margin: 5px 0 0 0;
            }
            .card-in .card-value { color: #166534; }
            .card-out .card-value { color: #991b1b; }
            .card-net .card-value { color: #5b21b6; }
            
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 30px;
            }
            th {
              background-color: #f8fafc;
              color: #475569;
              font-weight: 700;
              text-align: left;
              padding: 10px;
              font-size: 11px;
              border-bottom: 2px solid #e2e8f0;
            }
            td {
              border-bottom: 1px solid #e2e8f0;
            }
            .footer {
              text-align: center;
              font-size: 10px;
              color: #94a3b8;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
              margin-top: 40px;
              font-weight: 500;
            }
            @media print {
              body { margin: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h1 class="title">${companyName}</h1>
              <p class="subtitle">লেনদেন বিবরণী খাতা (Ledger Sheet)</p>
            </div>
            <div class="meta-info">
              <p><strong>রিপোর্ট জেনারেট তারিখঃ</strong> ${reportDate}</p>
              <p><strong>ফিল্টার সময়সীমাঃ</strong> ${dateRangeStr}</p>
            </div>
          </div>

          <div class="summary-cards">
            <div class="card card-in">
              <h4 class="card-title">মোট জমা (Total IN)</h4>
              <p class="card-value">৳${formatNum(totalIn)}</p>
            </div>
            <div class="card card-out">
              <h4 class="card-title">মোট উত্তোলন/খরচ (Total OUT)</h4>
              <p class="card-value">৳${formatNum(totalOut)}</p>
            </div>
            <div class="card card-net">
              <h4 class="card-title">নিট ব্যালেন্স (Net Active Balance)</h4>
              <p class="card-value">৳${formatNum(totalIn - totalOut)}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 12%;">তারিখ (Date)</th>
                <th style="width: 18%;">সদস্য (Member)</th>
                <th style="width: 15%;">ধরণ (Type)</th>
                <th style="width: 25%;">বিবরণ (Description)</th>
                <th style="width: 15%;">প্রজেক্ট (Project)</th>
                <th style="width: 15%;">ফ্লো (Flow)</th>
                <th style="text-align: right; width: 15%;">পরিমাণ (Amount)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="footer">
            <p>এই রিপোর্টটি ডিজিটাল অ্যাপ্লিকেশন দ্বারা স্বয়ংক্রিয়ভাবে তৈরি করা হয়েছে। পৃষ্ঠা ১/১</p>
          </div>

          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  const handlePrint = () => {
    window.print();
  };

  const resetFilters = () => {
    setSearchQuery("");
    if (currentUser.role !== "member") {
      setFilterUser("all");
    }
    setFilterFlow("all");
    setFilterType("all");
    setDateFrom("");
    setDateTo("");
  };

  // Submit operations
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

    if (trxFlow === "IN" && paymentMethod === ("online_gateway" as any)) {
      if (!companyGateway || !companyGateway.enabled) {
        setToastMsg({ text: "কোম্পানির অনলাইন গেটওয়ে বর্তমানে নিষ্ক্রিয় রয়েছে। অনুগ্রহ করে ম্যানুয়াল পেমেন্ট করুন।", type: "error" });
        return;
      }
      setShowGatewayCheckout(true);
      return;
    }

    if (!trxDate) {
      setToastMsg({ text: "অনুগ্রহ করে তারিখ নির্বাচন করুন।", type: "error" });
      return;
    }

    // Payment validation
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
      } else {
        setToastMsg({ text: "ক্যাশ ইন এর জন্য মোবাইল ব্যাংকিং বা ব্যাংক ট্রান্সফার নির্বাচন করুন।", type: "error" });
        return;
      }
    } else {
      // CASH OUT validations
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
      // If cash, no additional bank info is required!
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
            throw new Error(`উত্তোলনের জন্য পর্যাপ্ত ব্যালেন্স নেই। মোট উপলব্ধ ব্যালেন্স: ৳${formatNum(totalAvailable)} (সেভিংস: ৳${formatNum(savingsBal)}, ইনকাম: ৳${formatNum(incomeBal)})`);
          }
        } else {
          if (member.accountType === "saving") {
            if (savingsBal < amountNum) {
              throw new Error(`উত্তোলনের জন্য পর্যাপ্ত সেভিংস ব্যালেন্স নেই। আপনার বর্তমান সেভিংস ব্যালেন্স: ৳${formatNum(savingsBal)}`);
            }
          } else if (member.accountType === "business") {
            if (incomeBal < amountNum) {
              throw new Error(`উত্তোলনের জন্য পর্যাপ্ত ইনকাম ব্যালেন্স নেই। আপনার বর্তমান ইনকাম ব্যালেন্স: ৳${formatNum(incomeBal)}`);
            }
          } else {
            if (savingsBal < amountNum) {
              throw new Error(`উত্তোলনের জন্য পর্যাপ্ত সেভিংস ব্যালেন্স নেই। আপনার বর্তমান সেভিংস ব্যালেন্স: ৳${formatNum(savingsBal)}`);
            }
          }
        }
      }

      // Create a pending transaction request
      const reqPayload: any = {
        companyId: member.companyId || targetCompanyId,
        userId: selectedUserId,
        userName: member.name,
        userEmail: member.email || "",
        flow: trxFlow,
        type: trxType,
        amount: amountNum,
        date: trxDate,
        memo: trxMemo || (trxFlow === "OUT" ? "সঞ্চয় থেকে টাকা উত্তোলন (ক্যাশ-আউট)" : (trxType === "saving" ? "সাধারণ সঞ্চয় ডিপোজিট" : "কিস্তি পরিশোধ")),
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

      await addDoc(collection(db, "transaction_requests"), reqPayload);

      setToastMsg({ 
        text: "✅ ট্রানজেকশন রিকোয়েস্ট সফলভাবে জমা দেওয়া হয়েছে! কোম্পানির ম্যানেজার বা এডমিন এপ্রুভ করার পর ব্যালেন্স আপডেট হবে।", 
        type: "success" 
      });

      // Reset form on success (except date & user selection to preserve workflow)
      setTrxAmount("");
      setTrxMemo("");
      setMobileAccountNo("");
      setMobileTrxId("");
      setBankBranch("");
      setBankAccountNo("");
      setBankTrxId("");

      // Automatically hide modal and switch tab after 2.5 seconds on success
      setTimeout(() => {
        setShowTrxModal(false);
        setActiveSubTab("requests");
        setToastMsg(null);
      }, 2500);

    } catch (err: any) {
      console.error(err);
      setToastMsg({ text: err.message || "লেনদেন রিকোয়েস্ট পাঠানো সম্ভব হয়নি। পুনরায় চেষ্টা করুন।", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // New company payment account states
  const [newAccType, setNewAccType] = useState<"mobile_banking" | "bank">("mobile_banking");
  const [newAccProvider, setNewAccProvider] = useState<string>("bKash");
  const [newAccNumber, setNewAccNumber] = useState<string>("");
  const [newAccTypeLabel, setNewAccTypeLabel] = useState<string>("Personal");
  const [newAccHolderName, setNewAccHolderName] = useState<string>("");

  const handleAddCompanyAccount = async (e: FormEvent) => {
    e.preventDefault();
    if (!newAccNumber.trim() || !newAccProvider.trim()) {
      setToastMsg({ text: "অনুগ্রহ করে অ্যাকাউন্ট নম্বর ও প্রদানকারী নির্বাচন করুন।", type: "error" });
      return;
    }
    setSubmitting(true);
    try {
      await addDoc(collection(db, "company_payment_accounts"), {
        companyId: targetCompanyId,
        type: newAccType,
        providerName: newAccProvider,
        accountNumber: newAccNumber.trim(),
        accountType: newAccTypeLabel.trim(),
        accountName: newAccHolderName.trim(),
        isActive: true,
        createdAt: new Date().toISOString()
      });
      setToastMsg({ text: "✅ কোম্পানি পেমেন্ট অ্যাকাউন্ট সফলভাবে যোগ করা হয়েছে!", type: "success" });
      setNewAccNumber("");
      setNewAccHolderName("");
    } catch (err: any) {
      console.error(err);
      setToastMsg({ text: "অ্যাকাউন্ট যোগ করা যায়নি।", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAccountStatus = async (accId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, "company_payment_accounts", accId), {
        isActive: !currentStatus
      });
      setToastMsg({ text: "✅ অ্যাকাউন্টের সক্রিয়তা পরিবর্তন করা হয়েছে।", type: "success" });
    } catch (err) {
      console.error(err);
      setToastMsg({ text: "স্ট্যাটাস পরিবর্তন করা যায়নি।", type: "error" });
    }
  };

  const handleDeleteCompanyAccount = async (accId: string) => {
    if (!window.confirm("আপনি কি নিশ্চিতভাবে এই পেমেন্ট অ্যাকাউন্টটি মুছে ফেলতে চান?")) return;
    try {
      await deleteDoc(doc(db, "company_payment_accounts", accId));
      setToastMsg({ text: "✅ অ্যাকাউন্টটি সফলভাবে মুছে ফেলা হয়েছে।", type: "success" });
    } catch (err) {
      console.error(err);
      setToastMsg({ text: "মুছে ফেলা সম্ভব হয়নি।", type: "error" });
    }
  };

  const handleApproveRequest = async (req: TransactionRequest) => {
    const member = users.find((u) => u.docId === req.userId);
    if (!member) {
      setToastMsg({ text: "সদস্য পাওয়া যায়নি।", type: "error" });
      return;
    }

    setSubmitting(true);
    setToastMsg(null);

    try {
      if (req.flow === "OUT") {
        const savingsBal = member.savingsBalance !== undefined ? member.savingsBalance : Number(member.amount || 0);
        const incomeBal = member.incomeBalance || 0;

        if (member.accountType === "saving") {
          if (savingsBal < req.amount) {
            throw new Error(`উত্তোলনের জন্য পর্যাপ্ত সেভিংস ব্যালেন্স নেই। বর্তমান সেভিংস ব্যালেন্স: ৳${formatNum(savingsBal)}`);
          }
        } else if (member.accountType === "business") {
          if (incomeBal < req.amount) {
            throw new Error(`উত্তোলনের জন্য পর্যাপ্ত ইনকাম ব্যালেন্স নেই। বর্তমান ইনকাম ব্যালেন্স: ৳${formatNum(incomeBal)}`);
          }
        } else {
          if (savingsBal < req.amount) {
            throw new Error(`উত্তোলনের জন্য পর্যাপ্ত সেভিংস ব্যালেন্স নেই। বর্তমান সেভিংস ব্যালেন্স: ৳${formatNum(savingsBal)}`);
          }
        }

        // Add history document
        const historyPayload: any = {
          amount: -req.amount,
          date: req.date,
          memo: req.memo || "সঞ্চয় থেকে টাকা উত্তোলন (ক্যাশ-আউট)",
          type: "withdraw",
          flow: "OUT",
          paymentMethod: req.paymentMethod,
          createdAt: new Date().toISOString(),
          projectName: "কোম্পানি (সাধারণ)",
        };

        if (req.paymentMethod === "mobile_banking") {
          historyPayload.mobileProvider = req.mobileProvider || "";
          historyPayload.accountNo = req.mobileAccountNo || "";
          historyPayload.trxId = req.mobileTrxId || "";
        } else if (req.paymentMethod === "bank") {
          historyPayload.bankName = req.bankName || "";
          historyPayload.bankBranch = req.bankBranch || "";
          historyPayload.accountNo = req.bankAccountNo || "";
          historyPayload.trxId = req.bankTrxId || "";
        }

        const historyCol = collection(db, "users", req.userId, "history");
        await addDoc(historyCol, historyPayload);

        // Update User amount (Decrement savings)
        const userRef = doc(db, "users", req.userId);
        await updateDoc(userRef, {
          amount: increment(-req.amount)
        });

      } else {
        // CASH IN (Deposit / Pay)
        if (req.type === "saving") {
          // Savings Deposit
          let remaining = req.amount;
          let totalSavingsArrearsPaid = 0;

          // Fetch savings arrears
          const histSnap = await getDocs(collection(db, "users", req.userId, "history"));
          const savingsArrearsDocs: any[] = [];
          histSnap.forEach((dDoc) => {
            const h = { docId: dDoc.id, ...dDoc.data() } as any;
            if (h.type === "savings_arrears") {
              savingsArrearsDocs.push(h);
            }
          });

          // Sort savings arrears by date (oldest first)
          savingsArrearsDocs.sort((a, b) => {
            const dateA = a.date || "";
            const dateB = b.date || "";
            return dateA.localeCompare(dateB);
          });

          // Pay off savings arrears
          for (const arrDoc of savingsArrearsDocs) {
            if (remaining <= 0) break;
            const dueAmt = Number(arrDoc.arrears || 0);
            if (dueAmt <= 0) continue;

            const payAmt = Math.min(remaining, dueAmt);
            remaining = parseFloat((remaining - payAmt).toFixed(2));
            totalSavingsArrearsPaid += payAmt;

            // Write paid history log
            await addDoc(collection(db, "users", req.userId, "history"), {
              amount: payAmt,
              date: req.date,
              memo: `বকেয়া সঞ্চয় সমন্বয়ঃ ${arrDoc.memo || "সেভিংস জমা"}`,
              InvestType: member.InvestType || "",
              accountType: member.accountType || "",
              type: "savings_arrears_paid",
              flow: "IN",
              paymentMethod: req.paymentMethod,
              mobileProvider: (req.paymentMethod === "mobile_banking" || req.paymentMethod === "online_gateway") ? req.mobileProvider : null,
              accountNo: (req.paymentMethod === "mobile_banking" || req.paymentMethod === "online_gateway") ? (req.mobileAccountNo || "Online Gateway") : req.bankAccountNo,
              trxId: (req.paymentMethod === "mobile_banking" || req.paymentMethod === "online_gateway") ? req.mobileTrxId : req.bankTrxId,
              bankName: req.paymentMethod === "bank" ? req.bankName : null,
              bankBranch: req.paymentMethod === "bank" ? req.bankBranch : null,
              createdAt: new Date().toISOString(),
              projectName: "কোম্পানি (সাধারণ)",
            });

            // Delete or update the original savings_arrears document
            const arrDocRef = doc(db, "users", req.userId, "history", arrDoc.docId);
            if (payAmt >= dueAmt) {
              await deleteDoc(arrDocRef);
            } else {
              await updateDoc(arrDocRef, {
                arrears: parseFloat((dueAmt - payAmt).toFixed(2)),
              });
            }
          }

          // Write remaining amount to new savings
          if (remaining > 0) {
            const historyPayload: any = {
              amount: remaining,
              date: req.date,
              memo: req.memo || "সাধারণ সঞ্চয় ডিপোজিট",
              InvestType: member.InvestType || "",
              accountType: member.accountType || "",
              type: "saving",
              flow: "IN",
              paymentMethod: req.paymentMethod,
              createdAt: new Date().toISOString(),
              projectName: "কোম্পানি (সাধারণ)",
            };

            if (req.paymentMethod === "mobile_banking" || req.paymentMethod === "online_gateway") {
              historyPayload.mobileProvider = req.mobileProvider;
              historyPayload.accountNo = req.mobileAccountNo || "Online Gateway";
              historyPayload.trxId = req.mobileTrxId;
            } else {
              historyPayload.bankName = req.bankName;
              historyPayload.bankBranch = req.bankBranch;
              historyPayload.accountNo = req.bankAccountNo;
              historyPayload.trxId = req.bankTrxId;
            }

            const historyCol = collection(db, "users", req.userId, "history");
            await addDoc(historyCol, historyPayload);
          }

          // Update the user's total investment balance
          const totalAddedToSavings = parseFloat((totalSavingsArrearsPaid + remaining).toFixed(2));
          const userRef = doc(db, "users", req.userId);
          await updateDoc(userRef, {
            amount: increment(totalAddedToSavings)
          });

        } else if (req.type === "project") {
          // Project Investment Payment
          const historyPayload: any = {
            amount: req.amount,
            date: req.date,
            memo: req.memo || `প্রজেক্ট ইনভেস্টমেন্ট - প্রজেক্ট: ${req.projectName || "কোম্পানি (সাধারণ)"}`,
            InvestType: member.InvestType || "",
            accountType: "business",
            type: "project_investment",
            flow: "IN",
            paymentMethod: req.paymentMethod,
            createdAt: new Date().toISOString(),
            projectId: req.projectId || "company",
            projectName: req.projectName || "কোম্পানি (সাধারণ)",
          };

          if (req.paymentMethod === "mobile_banking" || req.paymentMethod === "online_gateway") {
            historyPayload.mobileProvider = req.mobileProvider;
            historyPayload.accountNo = req.mobileAccountNo || "Online Gateway";
            historyPayload.trxId = req.mobileTrxId;
          } else {
            historyPayload.bankName = req.bankName;
            historyPayload.bankBranch = req.bankBranch;
            historyPayload.accountNo = req.bankAccountNo;
            historyPayload.trxId = req.bankTrxId;
          }

          const historyCol = collection(db, "users", req.userId, "history");
          await addDoc(historyCol, historyPayload);

          // Update User amount (which is legacy representation of total balance)
          const userRef = doc(db, "users", req.userId);
          await updateDoc(userRef, {
            amount: increment(req.amount)
          });

        } else {
          // Installment Payment
          if (!req.installmentId) {
            throw new Error("কিস্তি চুক্তি আইডি পাওয়া যায়নি।");
          }

          const inst = installments.find((i) => i.id === req.installmentId);
          if (!inst) {
            throw new Error("কিস্তি চুক্তিটি পাওয়া যায়নি।");
          }

          let remaining = req.amount;
          const scheduleCopy = JSON.parse(JSON.stringify(inst.schedule || [])) as InstallmentStep[];
          let instPaidThisTime = 0;

          // Settle schedule steps
          for (let i = 0; i < scheduleCopy.length; i++) {
            if (remaining <= 0) break;
            const step = scheduleCopy[i];

            // Ignore steps already paid
            if (step.status === "paid") continue;

            const stepTotal = Number(step.amount || 0);
            const stepPaid = Number(step.paidAmount || 0);
            const stepDue = Math.max(0, stepTotal - stepPaid);

            if (stepDue > 0) {
              const payAmt = Math.min(remaining, stepDue);
              step.paidAmount = parseFloat((stepPaid + payAmt).toFixed(2));
              remaining = parseFloat((remaining - payAmt).toFixed(2));
              instPaidThisTime += payAmt;

              if (step.paidAmount >= stepTotal) {
                step.status = "paid";
              } else {
                step.status = "partial";
              }
              step.paidDate = req.date;
            }
          }

          // Update installment in Firestore
          const allFullyPaid = scheduleCopy.every((s) => s.status === "paid");
          const computedDue = scheduleCopy.reduce(
            (sum, s) => sum + Math.max(0, s.amount - s.paidAmount),
            0
          );

          const instRef = doc(db, "installments", inst.id);
          await updateDoc(instRef, {
            schedule: scheduleCopy,
            dueAmount: computedDue,
            status: allFullyPaid ? "closed" : "open",
          });

          // Write paid log to user history for ledger tracing
          const historyPayload: any = {
            amount: instPaidThisTime,
            date: req.date,
            memo: req.memo || `কিস্তি পরিশোধ - প্রজেক্ট: ${inst.productName} (গ্রাহক: ${inst.customerName})`,
            type: "installment_payment",
            flow: "IN",
            paymentMethod: req.paymentMethod,
            createdAt: new Date().toISOString(),
            projectName: inst.productName,
          };

          if (req.paymentMethod === "mobile_banking" || req.paymentMethod === "online_gateway") {
            historyPayload.mobileProvider = req.mobileProvider;
            historyPayload.accountNo = req.mobileAccountNo || "Online Gateway";
            historyPayload.trxId = req.mobileTrxId;
          } else {
            historyPayload.bankName = req.bankName;
            historyPayload.bankBranch = req.bankBranch;
            historyPayload.accountNo = req.bankAccountNo;
            historyPayload.trxId = req.bankTrxId;
          }

          const historyCol = collection(db, "users", req.userId, "history");
          await addDoc(historyCol, historyPayload);

          if (remaining > 0) {
            // Leftover remains! Let's deposit it as general savings!
            const userRef = doc(db, "users", req.userId);
            await updateDoc(userRef, {
              amount: increment(remaining)
            });

            // Write leftover history
            const leftoverPayload = { ...historyPayload, amount: remaining, memo: `কিস্তি পরিশোধের অবশিষ্ট অংশ সঞ্চয়ে জমাকৃত`, type: "saving" };
            await addDoc(historyCol, leftoverPayload);
          }
        }
      }

      // Update Transaction Request status
      const requestRef = doc(db, "transaction_requests", req.id);
      await updateDoc(requestRef, {
        status: "approved",
        processedAt: new Date().toISOString(),
        processedBy: currentUser.name || currentUser.email || "কোম্পানি",
      });

      // Create Member notification
      await addDoc(collection(db, "notifications"), {
        title: `ট্রানজেকশন এপ্রুভ হয়েছে`,
        body: `আপনার ৳${formatNum(req.amount)} পরিমাণের ক্যাশ-${req.flow === "IN" ? "ইন" : "আউট"} রিকোয়েস্ট কোম্পানি কর্তৃক এপ্রুভ করা হয়েছে এবং হিসাব বিবরণীতে যোগ করা হয়েছে।`,
        senderId: currentUser.docId,
        senderName: currentUser.companyName || currentUser.name,
        senderRole: currentUser.role === "admin" ? "admin" : "company",
        targetType: "all_members",
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      setToastMsg({ text: "✅ ট্রানজেকশন রিকোয়েস্টটি সফলভাবে এপ্রুভ করা হয়েছে!", type: "success" });
    } catch (err: any) {
      console.error(err);
      setToastMsg({ text: err.message || "এপ্রুভ করা সম্ভব হয়নি।", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectRequest = async (req: TransactionRequest, reason: string) => {
    setSubmitting(true);
    setToastMsg(null);

    try {
      const requestRef = doc(db, "transaction_requests", req.id);
      await updateDoc(requestRef, {
        status: "rejected",
        rejectedReason: reason,
        processedAt: new Date().toISOString(),
        processedBy: currentUser.name || currentUser.email || "কোম্পানি",
      });

      // Create Member notification
      await addDoc(collection(db, "notifications"), {
        title: `ট্রানজেকশন প্রত্যাখ্যাত হয়েছে`,
        body: `আপনার ৳${formatNum(req.amount)} পরিমাণের ক্যাশ-${req.flow === "IN" ? "ইন" : "আউট"} রিকোয়েস্ট বাতিল করা হয়েছে। কারণ: ${reason || "তথ্য অমিল"}`,
        senderId: currentUser.docId,
        senderName: currentUser.companyName || currentUser.name,
        senderRole: currentUser.role === "admin" ? "admin" : "company",
        targetType: "all_members",
        createdAt: new Date().toISOString(),
        readBy: [],
      });

      setToastMsg({ text: "❌ ট্রানজেকশন রিকোয়েস্টটি বাতিল করা হয়েছে।", type: "success" });
    } catch (err: any) {
      console.error(err);
      setToastMsg({ text: err.message || "বাতিল করা সম্ভব হয়নি।", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans select-none animate-fadeIn">
      {/* Upper header action section */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-5 mb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            <span className="p-2 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100">
              <ArrowLeftRight className="w-5 sm:h-5 sm:w-5" />
            </span>
            লেনদেন ও অনুমোদন ব্যবস্থাপনা
          </h1>
          <p className="text-xs text-slate-400 font-bold mt-1.5">
            ব্যাংক বা মোবাইল ব্যাংকিং (বিকাশ/নগদ) ব্যবহার করে সেভিংস বা কিস্তি জমা, উত্তোলন এবং রিয়েল-টাইম হিসাব
          </p>
        </div>
      </div>

      {/* Modern Inner Navigation Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-2 sm:gap-4 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveSubTab("ledger")}
          className={`pb-4 px-2 text-xs sm:text-sm font-black transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeSubTab === "ledger"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          লেনদেন খাতা
        </button>
        {currentUser.role !== "member" && (
          <>
            <button
              onClick={() => {
                setActiveSubTab("savings");
                setTrxType("saving");
                setTrxFlow("IN");
              }}
              className={`pb-4 px-2 text-xs sm:text-sm font-black transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSubTab === "savings"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Coins className="w-4 h-4" />
              মেম্বার সেভিংস (সঞ্চয় জমা/উত্তোলন)
              {transactionRequests.filter(r => r.status === "pending" && (r.type === "saving" || r.type === "withdraw") && (isAdminOrCompany ? true : r.userId === currentUser.docId)).length > 0 && (
                <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1">
                  {transactionRequests.filter(r => r.status === "pending" && (r.type === "saving" || r.type === "withdraw") && (isAdminOrCompany ? true : r.userId === currentUser.docId)).length}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setActiveSubTab("installments");
                setTrxType("installment");
                setTrxFlow("IN");
              }}
              className={`pb-4 px-2 text-xs sm:text-sm font-black transition-all relative flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeSubTab === "installments"
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Clock className="w-4 h-4" />
              বকেয়া কিস্তি পরিশোধ রিকোয়েস্ট
              {transactionRequests.filter(r => r.status === "pending" && r.type === "installment" && (isAdminOrCompany ? true : r.userId === currentUser.docId)).length > 0 && (
                <span className="bg-rose-100 text-rose-800 text-[9px] font-black px-1.5 py-0.5 rounded-full ml-1 font-mono">
                  {transactionRequests.filter(r => r.status === "pending" && r.type === "installment" && (isAdminOrCompany ? true : r.userId === currentUser.docId)).length}
                </span>
              )}
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-20">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <p className="mt-4 text-xs font-bold text-slate-400">লেনদেন তথ্য লোড হচ্ছে...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeSubTab === "ledger" && (
            <>
              {/* Summary Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Total IN (Inflow Card) */}
            <div className="bg-emerald-50/50 border border-emerald-100 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 bg-emerald-500 rounded-full translate-x-4 -translate-y-4"></div>
              <div>
                <p className="text-[10px] text-emerald-600 uppercase font-black tracking-wider">মোট জমা ও লভ্যাংশ (Total IN)</p>
                <h3 className="text-2xl sm:text-3xl font-black text-emerald-700 mt-2">
                  ৳{formatNum(totalIn)}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 mt-4 bg-white/70 py-1.5 px-3 rounded-xl border border-emerald-100 self-start">
                <TrendingUp className="w-3.5 h-3.5" />
                ব্যালেন্স বৃদ্ধিকারী
              </div>
            </div>

            {/* Total OUT (Outflow Card) */}
            <div className="bg-rose-50/50 border border-rose-100 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 bg-rose-500 rounded-full translate-x-4 -translate-y-4"></div>
              <div>
                <p className="text-[10px] text-rose-500 uppercase font-black tracking-wider">মোট শেয়ার খরচ ও উত্তোলন (Total OUT)</p>
                <h3 className="text-2xl sm:text-3xl font-black text-rose-700 mt-2">
                  ৳{formatNum(totalOut)}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 mt-4 bg-white/70 py-1.5 px-3 rounded-xl border border-rose-100 self-start">
                <TrendingDown className="w-3.5 h-3.5" />
                ব্যালেন্স হ্রাসকারী
              </div>
            </div>

            {/* Net Worth/Active Balance Card */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-3xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 p-8 opacity-10 bg-indigo-500 rounded-full translate-x-4 -translate-y-4"></div>
              <div>
                <p className="text-[10px] text-indigo-600 uppercase font-black tracking-wider">সক্রিয় নিট ব্যালেন্স (Net Active Balance)</p>
                <h3 className="text-2xl sm:text-3xl font-black text-indigo-700 mt-2">
                  ৳{formatNum(netBalance)}
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 mt-4 bg-white/70 py-1.5 px-3 rounded-xl border border-indigo-100 self-start">
                <Building className="w-3.5 h-3.5" />
                বর্তমান নিট ফান্ড
              </div>
            </div>
          </div>
          </>
          )}

          {activeSubTab === "requests" && (
            /* Transaction Requests (Approval / Status Queue) */
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden space-y-4">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/40">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-amber-50 text-amber-600 rounded-2xl border border-amber-100 flex items-center justify-center">
                  <Clock className="w-5 h-5 animate-pulse" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-slate-800 tracking-tight flex items-center gap-1.5">
                    <span>{isAdminOrCompany ? "লেনদেন অনুমোদন ও যাচাইকরণ কিউ (Approval Queue)" : "আমার ট্রানজেকশন রিকোয়েস্ট সমূহ"}</span>
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                      {transactionRequests.filter(r => r.status === "pending" && (isAdminOrCompany ? true : r.userId === currentUser.docId)).length} টি পেন্ডিং
                    </span>
                  </h2>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                    {isAdminOrCompany ? "সদস্যদের ক্যাশ-ইন ও ক্যাশ-আউট রিকোয়েস্ট যাচাই করে এপ্রুভ করুন। এপ্রুভ ছাড়া হিসাব নিকাশ হবে না।" : "আপনার ক্যাশ-ইন বা ক্যাশ-আউট রিকোয়েস্ট সমূহের লাইভ অবস্থা"}
                  </p>
                </div>
              </div>

              {/* Toggle for Pending vs History */}
              <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
                <button
                  onClick={() => setRequestFilterTab("pending")}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-black transition-all ${
                    requestFilterTab === "pending"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  পেন্ডিং কিউ
                </button>
                <button
                  onClick={() => setRequestFilterTab("all_history")}
                  className={`text-[10px] px-3 py-1.5 rounded-lg font-black transition-all ${
                    requestFilterTab === "all_history"
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  রিকোয়েস্ট ইতিহাস
                </button>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-300 flex items-center justify-center rounded-full mx-auto mb-3">
                  <Clock className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-500">বর্তমানে কোনো অপেক্ষমান রিকোয়েস্ট পাওয়া যায়নি।</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {requestFilterTab === "pending" ? "নতুন ক্যাশ-ইন বা আউট সাবমিট করলে এখানে প্রদর্শিত হবে" : "কোনো ইতিহাস রেকর্ড নেই"}
                </p>
              </div>
            ) : (
              <div className="bg-slate-50/50 p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm">
                <div className="columns-1 md:columns-2 gap-4">
                  {filteredRequests.map((req, index) => {
                    const isRejectingThis = rejectingReqId === req.id;
                    return (
                      <div key={req.id} className="break-inside-avoid inline-block w-full mb-4 bg-white rounded-2xl border border-slate-200/60 p-4 shadow-2xs flex flex-col justify-between hover:border-indigo-200 hover:shadow-xs transition duration-200">
                        <div className="space-y-3">
                          {/* Header */}
                          <div className="flex justify-between items-start gap-2">
                            <div>
                              <p className="font-extrabold text-slate-800 text-xs sm:text-sm leading-tight">{req.date}</p>
                              <p className="text-[10px] text-indigo-600 font-bold flex items-center gap-1 mt-1.5">
                                <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                                {req.userName}
                              </p>
                            </div>
                            <span className="font-black text-xs text-slate-900">
                              ৳{formatNum(req.amount)}
                            </span>
                          </div>

                          {/* Flow/Type Badge */}
                          <div>
                            {req.flow === "IN" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[9px] font-black border border-emerald-100">
                                <TrendingUp className="w-3 h-3" />
                                ক্যাশ-ইন ({req.type === "saving" ? "সেভিংস" : "কিস্তি"})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-600 text-[9px] font-black border border-rose-100">
                                <TrendingDown className="w-3 h-3" />
                                ক্যাশ-আউট
                              </span>
                            )}
                          </div>

                          {/* Payment details */}
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[11px] font-bold">
                            {req.paymentMethod === "mobile_banking" ? (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[10px] text-indigo-600 uppercase">
                                  <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>{req.mobileProvider}</span>
                                </div>
                                <p className="text-slate-600 font-mono text-xs">No: {req.mobileAccountNo}</p>
                                <p className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded inline-block font-mono">TxID: {req.mobileTrxId}</p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1 text-[10px] text-teal-600 uppercase">
                                  <Building className="w-3.5 h-3.5 text-teal-500" />
                                  <span>{req.bankName}</span>
                                </div>
                                <p className="text-slate-500 text-[9px]">Branch: {req.bankBranch || "N/A"}</p>
                                <p className="text-slate-600 font-mono text-xs">Acc: {req.bankAccountNo}</p>
                                <p className="text-[10px] text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded inline-block font-mono">Ref: {req.bankTrxId}</p>
                              </div>
                            )}
                          </div>

                          {/* Description & install name */}
                          <div className="text-[11px] font-bold text-slate-600">
                            <span className="text-slate-800 block font-bold leading-normal">{req.memo}</span>
                            {req.installmentName && (
                              <span className="inline-block text-[9px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md mt-1 border border-indigo-100/40 font-bold">
                                কিস্তি চুক্তিঃ {req.installmentName}
                              </span>
                            )}
                          </div>

                          {/* Status */}
                          <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                            <span className="text-[10px] text-slate-400 font-bold">স্ট্যাটাসঃ</span>
                            {req.status === "pending" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 text-amber-600 text-[10px] font-extrabold border border-amber-100">
                                <Clock className="w-3.5 h-3.5 animate-pulse text-amber-500" /> অপেক্ষমান
                              </span>
                            ) : req.status === "approved" ? (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-600 text-[10px] font-extrabold border border-emerald-100">
                                  <Check className="w-3.5 h-3.5 text-emerald-500" /> এপ্রুভড
                                </span>
                                {req.processedBy && (
                                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">By: {req.processedBy}</p>
                                )}
                              </div>
                            ) : (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 text-[10px] font-extrabold border border-rose-100">
                                  <XCircle className="w-3.5 h-3.5 text-rose-500" /> বাতিল
                                </span>
                                {req.rejectedReason && (
                                  <p className="text-[9px] text-rose-400 max-w-[180px] leading-tight font-bold mt-0.5">কারণ: {req.rejectedReason}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin Action Buttons */}
                        {isAdminOrCompany && (
                          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                            {req.status === "pending" ? (
                              isRejectingThis ? (
                                <div className="flex flex-col gap-2 items-end w-full">
                                  <input
                                    type="text"
                                    placeholder="বাতিলের কারণ লিখুন..."
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="text-xs border border-rose-200 rounded-xl px-3 py-2 w-full outline-none focus:ring-2 focus:ring-rose-100 text-slate-700 font-bold"
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => {
                                        if (!rejectionReason.trim()) {
                                          setToastMsg({ text: "বাতিলের কারণ উল্লেখ করা আবশ্যক।", type: "error" });
                                          return;
                                        }
                                        handleRejectRequest(req, rejectionReason);
                                        setRejectingReqId(null);
                                        setRejectionReason("");
                                      }}
                                      className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white font-black px-3 py-1.5 rounded-xl shadow-xs cursor-pointer transition active:scale-95"
                                    >
                                      নিশ্চিত করুন
                                    </button>
                                    <button
                                      onClick={() => {
                                        setRejectingReqId(null);
                                        setRejectionReason("");
                                      }}
                                      className="text-[10px] bg-slate-100 text-slate-500 font-black px-3 py-1.5 rounded-xl border hover:bg-slate-200 cursor-pointer transition"
                                    >
                                      বাতিল
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex gap-2 w-full">
                                  <button
                                    onClick={() => handleApproveRequest(req)}
                                    className="flex-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2 rounded-xl shadow-xs cursor-pointer active:scale-95 transition flex items-center justify-center gap-1"
                                  >
                                    <Check className="w-3.5 h-3.5" /> এপ্রুভ করুন
                                  </button>
                                  <button
                                    onClick={() => setRejectingReqId(req.id)}
                                    className="flex-1 text-[10px] bg-rose-50 text-rose-600 hover:bg-rose-100 font-black py-2 rounded-xl border border-rose-100 cursor-pointer active:scale-95 transition flex items-center justify-center gap-1"
                                  >
                                    <XCircle className="w-3.5 h-3.5" /> বাতিল
                                  </button>
                                </div>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400 font-black bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150">
                                সম্পন্ন (Done)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}

          {activeSubTab === "ledger" && (
            <>
              {/* COMPACT & SMART FILTERING CONTROL CENTER */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-3.5 sm:p-5 space-y-3">
                <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
                  
                  {/* Search and Toggle Filters */}
                  <div className="flex flex-1 flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                    {/* Search input */}
                    <div className="relative flex-1">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-slate-400" />
                      </span>
                      <input
                        type="text"
                        placeholder="সদস্য নাম, বিবরণ, মোবাইল নম্বর, ট্রানজেকশন আইডি বা প্রজেক্ট দিয়ে খুঁজুন..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full text-xs font-bold pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>

                    {/* Filter Toggle Button */}
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-black border transition cursor-pointer active:scale-95 ${
                        showFilters || (filterUser !== "all" || filterFlow !== "all" || filterType !== "all" || dateFrom || dateTo)
                          ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Filter className="w-3.5 h-3.5" />
                      <span>ফিল্টার</span>
                      {(filterUser !== "all" ? 1 : 0) + (filterFlow !== "all" ? 1 : 0) + (filterType !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) > 0 && (
                        <span className="bg-indigo-600 text-white text-[9px] font-mono px-1.5 py-0.5 rounded-full font-black animate-pulse">
                          {(filterUser !== "all" ? 1 : 0) + (filterFlow !== "all" ? 1 : 0) + (filterType !== "all" ? 1 : 0) + (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)}
                        </span>
                      )}
                    </button>
                  </div>

                  {/* Smart Actions & Exports */}
                  <div className="flex items-center justify-end gap-2 border-t md:border-t-0 border-slate-100 pt-2 md:pt-0">
                    {(filterUser !== "all" || filterFlow !== "all" || filterType !== "all" || dateFrom || dateTo) && (
                      <button
                        onClick={resetFilters}
                        className="text-[11px] font-black text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-2 rounded-xl transition cursor-pointer"
                      >
                        রিসেট
                      </button>
                    )}

                    {/* PDF Download Button */}
                    <button
                      onClick={handleExportPDF}
                      title="পিডিএফ বা মুদ্রণ"
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    {/* CSV Export Button */}
                    <button
                      onClick={handleExportCSV}
                      title="CSV ডাউনলোড"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm cursor-pointer transition active:scale-95 flex items-center gap-1.5"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Smart Filter panel */}
                {showFilters && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-100 animate-fadeIn">
                    {/* Member selection (Admin/Company only) */}
                    {isAdminOrCompany ? (
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">সদস্য নির্বাচন</label>
                        <select
                          value={filterUser}
                          onChange={(e) => setFilterUser(e.target.value)}
                          className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                        >
                          <option value="all">সকল সদস্য (All Members)</option>
                          {activeCompanyMembers.map((member) => (
                            <option key={member.docId} value={member.docId}>
                              {member.name} ({member.accountType === "saving" ? "সঞ্চয়ী" : "বিজনেস"})
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">সদস্য</label>
                        <div className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 text-slate-500 flex items-center gap-1.5">
                          <UserIcon className="w-3.5 h-3.5" />
                          {currentUser.name}
                        </div>
                      </div>
                    )}

                    {/* Flow Selection */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">লেনদেনের ধরণ (Flow)</label>
                      <select
                        value={filterFlow}
                        onChange={(e) => setFilterFlow(e.target.value as any)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      >
                        <option value="all">সব ফ্লো (All In/Out)</option>
                        <option value="IN">শুধুমাত্র ইন (IN / জমা)</option>
                        <option value="OUT">শুধুমাত্র আউট (OUT / খরচ ও উত্তোলন)</option>
                      </select>
                    </div>

                    {/* Category Selection */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">ক্যাটাগরি</label>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      >
                        <option value="all">সব ক্যাটাগরি</option>
                        <option value="saving">সঞ্চয় জমা ও উত্তোলন</option>
                        <option value="project_expense">শেয়ার প্রজেক্ট খরচ</option>
                        <option value="project_sale">শেয়ার বিক্রয় আয়</option>
                        <option value="installment_income">শেয়ার কিস্তি আদায়</option>
                      </select>
                    </div>

                    {/* Date From */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">তারিখ হতে (From)</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <label className="block text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">তারিখ পর্যন্ত (To)</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>
                  </div>
                )}

                {/* Active Filter Badges */}
                {(filterUser !== "all" || filterFlow !== "all" || filterType !== "all" || dateFrom || dateTo) && (
                  <div className="flex flex-wrap gap-1.5 pt-2 items-center">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mr-1">সক্রিয় ফিল্টারঃ</span>
                    
                    {filterUser !== "all" && (
                      <span className="inline-flex items-center gap-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        <span>সদস্য: {users.find(u => u.docId === filterUser)?.name || "N/A"}</span>
                        <X className="w-3 h-3 cursor-pointer text-indigo-400 hover:text-indigo-600" onClick={() => setFilterUser("all")} />
                      </span>
                    )}

                    {filterFlow !== "all" && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        <span>ফ্লো: {filterFlow === "IN" ? "জমা (IN)" : "উত্তোলন (OUT)"}</span>
                        <X className="w-3 h-3 cursor-pointer text-emerald-400 hover:text-emerald-600" onClick={() => setFilterFlow("all")} />
                      </span>
                    )}

                    {filterType !== "all" && (
                      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        <span>ক্যাটাগরি: {filterType === "saving" ? "সঞ্চয়" : filterType === "project_expense" ? "প্রজেক্ট খরচ" : filterType === "project_sale" ? "বিক্রয়" : "কিস্তি আদায়"}</span>
                        <X className="w-3 h-3 cursor-pointer text-amber-400 hover:text-amber-600" onClick={() => setFilterType("all")} />
                      </span>
                    )}

                    {(dateFrom || dateTo) && (
                      <span className="inline-flex items-center gap-1 bg-purple-50 border border-purple-100 text-purple-700 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                        <Calendar className="w-3 h-3 text-purple-400" />
                        <span>{dateFrom || "শুরু"} ➔ {dateTo || "আজ"}</span>
                        <X className="w-3 h-3 cursor-pointer text-purple-400 hover:text-purple-600" onClick={() => { setDateFrom(""); setDateTo(""); }} />
                      </span>
                    )}
                  </div>
                )}
              </div>

            {/* Ledger Transactions List/Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/40 flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-black text-slate-800 tracking-wider uppercase">লেনদেন বিবরণী (Ledger Records)</h3>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">মোট প্রাপ্ত রেকর্ড সংখ্যাঃ {filteredLedger.length} টি</p>
                </div>
              </div>

              {filteredLedger.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                  <p className="text-xs font-black text-slate-500">কোনো লেনদেন রেকর্ড পাওয়া যায়নি</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/50 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                        <th className="px-5 py-3">তারিখ</th>
                        <th className="px-4 py-3">সদস্য</th>
                        <th className="px-4 py-3">খাত / উদ্দেশ্য</th>
                        <th className="px-4 py-3">বিবরণ</th>
                        <th className="px-4 py-3">প্রজেক্ট</th>
                        <th className="px-4 py-3 text-center">ফ্লো</th>
                        <th className="px-5 py-3 text-right">পরিমাণ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px] font-bold text-slate-600">
                      {filteredLedger.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition">
                          <td className="px-5 py-3.5 whitespace-nowrap text-slate-700 font-mono">{item.date}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-800 font-extrabold">{item.userName}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${
                                item.type === "saving" 
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100/40" 
                                  : item.type === "saving_withdraw"
                                  ? "bg-rose-50 text-rose-700 border border-rose-100/40"
                                  : item.type === "project_expense"
                                  ? "bg-amber-50 text-amber-700 border border-amber-100/40"
                                  : item.type === "project_sale"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100/40"
                                  : "bg-purple-50 text-purple-700 border border-purple-100/40"
                              }`}>
                                {item.typeLabel}
                              </span>
                              {item.status === "pending" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-black bg-amber-100 text-amber-800 uppercase animate-pulse border border-amber-200">
                                  পেন্ডিং
                                </span>
                              )}
                              {item.status === "rejected" && (
                                <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-800 uppercase border border-rose-200">
                                  প্রত্যাখ্যাত
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 min-w-[200px] max-w-xs text-slate-500 leading-normal font-medium">{item.memo}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">{item.projectName}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-center">
                            {item.flow === "IN" ? (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-100 text-emerald-800 uppercase">IN</span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[8px] font-black bg-rose-100 text-rose-800 uppercase">OUT</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 whitespace-nowrap text-right font-mono font-extrabold text-slate-800">
                            <span className={item.flow === "IN" ? "text-emerald-600" : "text-rose-600"}>
                              {item.flow === "IN" ? "+" : "-"}৳{formatNum(item.amount)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeSubTab === "savings" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Form Hidden (Moved to dedicated page) */}
              <div className="hidden lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
                <div className="bg-indigo-600 text-white px-5 py-4">
                  <h3 className="text-sm sm:text-md font-black flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    সেভিংস জমা ও উত্তোলন (Savings Form)
                  </h3>
                  <p className="text-[10px] text-indigo-100 font-semibold mt-0.5">
                    সেভিংস ফান্ডে টাকা জমা করুন (Cash-In) অথবা তহবিল থেকে টাকা উত্তোলনের জন্য (Cash-Out) রিকোয়েস্ট সাবমিট করুন
                  </p>
                </div>

                <form onSubmit={handleCreateTransaction} className="p-5 space-y-4">
                  {/* Flow Tab selector */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">লেনদেনের ধরণ (Transaction Mode)</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => handleFlowToggle("IN")}
                        className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          trxFlow === "IN"
                            ? "bg-emerald-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        জমা (Cash-In)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFlowToggle("OUT")}
                        className={`py-1.5 text-xs font-black rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                          trxFlow === "OUT"
                            ? "bg-rose-600 text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        <TrendingDown className="w-3.5 h-3.5" />
                        উত্তোলন (Cash-Out)
                      </button>
                    </div>
                  </div>

                  {/* Member/User Selection */}
                  {isAdminOrCompany ? (
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">সদস্য নির্বাচন করুন</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        required
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      >
                        <option value="">-- সদস্য সিলেক্ট করুন --</option>
                        {activeCompanyMembers.map((member) => (
                          <option key={member.docId} value={member.docId}>
                            {member.name} (সেভিংস: ৳{formatNum(member.savingsBalance !== undefined ? member.savingsBalance : (member.amount || 0))} | ইনকাম: ৳{formatNum(member.incomeBalance || 0)})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">সদস্য (আপনি)</label>
                      <div className="w-full text-xs font-black border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 text-slate-500 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {currentUser.name} (সেভিংস: ৳{formatNum(currentUser.savingsBalance !== undefined ? currentUser.savingsBalance : (currentUser.amount || 0))} | ইনকাম: ৳{formatNum(currentUser.incomeBalance || 0)})
                      </div>
                    </div>
                  )}

                  {/* Amount & Date Picker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">টাকার পরিমাণ (৳)</label>
                      <input
                        type="number"
                        value={trxAmount}
                        onChange={(e) => setTrxAmount(e.target.value)}
                        placeholder="পরিমাণ (৳)"
                        required
                        min="1"
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">তারিখ</label>
                      <input
                        type="date"
                        value={trxDate}
                        onChange={(e) => setTrxDate(e.target.value)}
                        required
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">লেনদেন মাধ্যম (Payment Method)</label>
                    <div className={`grid ${trxFlow === "OUT" ? "grid-cols-3" : (companyGateway?.enabled ? "grid-cols-3" : "grid-cols-2")} gap-2`}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("mobile_banking")}
                        className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                          paymentMethod === "mobile_banking"
                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-indigo-500" />
                        মোবাইল
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("bank")}
                        className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                          paymentMethod === "bank"
                            ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
                        ব্যাংক
                      </button>
                      {trxFlow === "IN" && companyGateway?.enabled && (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("online_gateway")}
                          className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                            paymentMethod === "online_gateway"
                              ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                              : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                          গেটওয়ে পে
                        </button>
                      )}
                      {trxFlow === "OUT" && (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("cash")}
                          className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                            paymentMethod === "cash"
                              ? "border-indigo-600 bg-indigo-50/50 text-indigo-700"
                              : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                          }`}
                        >
                          <Coins className="w-3.5 h-3.5 text-indigo-500" />
                          ক্যাশ
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Online Gateway Info Box */}
                  {trxFlow === "IN" && paymentMethod === "online_gateway" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
                      <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                        <span className="p-1.5 bg-emerald-100 rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        </span>
                        ইনস্ট্যান্ট অনলাইন গেটওয়ে পেমেন্ট
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        আপনি <span className="text-emerald-700 font-black">{companyGateway?.displayName || "অনলাইন পেমেন্ট গেটওয়ে"}</span> নির্বাচন করেছেন। সাবমিট বাটনে চাপ দিলে আপনার পেমেন্ট গেটওয়ে স্ক্রিনটি ওপেন হবে। গেটওয়েতে পেমেন্ট সম্পন্ন হওয়ার পর ট্রানজেকশনটি <span className="text-indigo-600 font-black">স্বয়ংক্রিয়ভাবে অনুমোদিত</span> ও যুক্ত হয়ে যাবে।
                      </p>
                      <div className="bg-white p-2.5 rounded-xl border border-dashed border-emerald-200 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-bold">প্রোভাইডার:</span>
                        <span className="text-slate-800 font-extrabold uppercase bg-slate-50 px-2 py-0.5 rounded border">{companyGateway?.provider || "bKash"}</span>
                      </div>
                    </div>
                  )}

                  {/* Display active accounts for copy-paste */}
                  {trxFlow === "IN" && paymentMethod !== "online_gateway" && (
                    <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center gap-1 text-amber-800 font-extrabold text-[10px]">
                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        টাকা পাঠানোর কোম্পানি একাউন্টস
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-none">
                        {companyAccounts
                          .filter((acc) => acc.companyId === targetCompanyId && acc.type === paymentMethod && acc.isActive)
                          .map((acc) => (
                            <div key={acc.id} className="bg-white border border-slate-100 rounded-lg p-2 flex items-center justify-between gap-2 shadow-3xs">
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1 text-[9px] font-black">
                                  <span className="text-pink-600 bg-pink-50 px-1 rounded">{acc.providerName}</span>
                                  <span className="text-slate-400">({acc.accountType || "N/A"})</span>
                                </div>
                                <div className="text-[10px] font-black text-slate-700 select-all tracking-wide">{acc.accountNumber}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(acc.accountNumber);
                                  setCopiedAccountId(acc.id);
                                  setTimeout(() => setCopiedAccountId(null), 1500);
                                }}
                                className="p-1 border border-slate-200 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                              >
                                {copiedAccountId === acc.id ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          ))}
                        {companyAccounts.filter((acc) => acc.companyId === targetCompanyId && acc.type === paymentMethod && acc.isActive).length === 0 && (
                          <div className="text-center py-2 text-[9px] font-bold text-slate-400 border border-dashed border-slate-200 rounded-lg">
                            কোনো সক্রিয় একাউন্ট পাওয়া যায়নি।
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Payment Info inputs */}
                  {paymentMethod === "mobile_banking" && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex gap-1">
                        {["bkash", "nagad", "rocket", "upay"].map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => setMobileProvider(provider as any)}
                            className={`flex-1 py-1 text-[8px] font-black uppercase rounded border transition cursor-pointer ${
                              mobileProvider === provider
                                ? "bg-pink-50 border-pink-300 text-pink-700 font-bold"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {provider === "bkash" ? "bKash" : provider === "nagad" ? "Nagad" : provider === "rocket" ? "Rocket" : "Upay"}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase">নম্বর</label>
                          <input
                            type="tel"
                            value={mobileAccountNo}
                            onChange={(e) => setMobileAccountNo(e.target.value)}
                            placeholder="017XXXXXXXX"
                            required
                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                        {trxFlow === "IN" && (
                          <div>
                            <label className="block text-[8px] font-black text-slate-500 uppercase">TxID</label>
                            <input
                              type="text"
                              value={mobileTrxId}
                              onChange={(e) => setMobileTrxId(e.target.value)}
                              placeholder="AX9K2H7F"
                              required={trxFlow === "IN"}
                              className="w-full text-xs font-mono font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {paymentMethod === "bank" && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">ব্যাংক</label>
                          <select
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          >
                            <option value="Dutch-Bangla Bank">DBBL</option>
                            <option value="Islami Bank Bangladesh">Islami Bank</option>
                            <option value="BRAC Bank">BRAC Bank</option>
                            <option value="Sonali Bank">Sonali Bank</option>
                            <option value="The City Bank">City Bank</option>
                            <option value="Other Bank">অন্যান্য</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">শাখা</label>
                          <input
                            type="text"
                            value={bankBranch}
                            onChange={(e) => setBankBranch(e.target.value)}
                            placeholder="শাখা"
                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">হিসাব নম্বর</label>
                          <input
                            type="text"
                            value={bankAccountNo}
                            onChange={(e) => setBankAccountNo(e.target.value)}
                            placeholder="হিসাব নম্বর"
                            required
                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                        {trxFlow === "IN" && (
                          <div>
                            <label className="block text-[8px] font-black text-slate-500">স্লিপ রেফারেন্স</label>
                            <input
                              type="text"
                              value={bankTrxId}
                              onChange={(e) => setBankTrxId(e.target.value)}
                              placeholder="SLIP-XXX"
                              required={trxFlow === "IN"}
                              className="w-full text-xs font-mono font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Memo */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">মন্তব্য / মেমো</label>
                    <textarea
                      value={trxMemo}
                      onChange={(e) => setTrxMemo(e.target.value)}
                      placeholder="অতিরিক্ত বিবরণ লিখুন..."
                      rows={1.5}
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
                    />
                  </div>

                  {toastMsg && (
                    <div className={`p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 ${
                      toastMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-rose-50 text-rose-800 border border-rose-100"
                    }`}>
                      <span>{toastMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-2.5 text-white rounded-xl text-xs font-black transition cursor-pointer ${
                      submitting ? "bg-slate-300" : trxFlow === "OUT" ? "bg-rose-600 hover:bg-rose-700" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {submitting ? "সাবমিট হচ্ছে..." : trxFlow === "OUT" ? "উত্তোলন রিকোয়েস্ট পাঠান" : "জমা রিকোয়েস্ট পাঠান"}
                  </button>
                </form>
              </div>

              {/* Right Column: Savings Requests Queue (Expanded to Full 12 columns) */}
              <div className="lg:col-span-12 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Redirection banner */}
                <div className="bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-150 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                  <div className="flex items-center gap-3.5 text-left">
                    <span className="p-3 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md">
                      <Coins className="w-5 h-5 text-white" />
                    </span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
                        সঞ্চয় জমা ও উত্তোলন এখন আলাদা পেজে!
                      </h4>
                      <p className="text-[10px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                        ইউজার ফ্রেন্ডলি এবং আরও সুরক্ষিত উপায়ে লেনদেনের জন্য জমা ও উত্তোলন ফাংশনটি নতুন ডেডিকেটেড পেজে স্থানান্তর করা হয়েছে।
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onNavigate("deposit-withdraw")}
                    className="w-full sm:w-auto px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    জমা বা উত্তোলন পোর্টাল
                  </button>
                </div>
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 animate-pulse" />
                    </span>
                    <div>
                      <h2 className="text-xs font-black text-slate-800">সেভিংস রিকোয়েস্ট কিউ</h2>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">জমা ও উত্তোলনের রিকোয়েস্ট যাচাইকরণ তালিকা</p>
                    </div>
                  </div>

                  {/* Toggle pending vs history */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRequestFilterTab("pending")}
                      className={`text-[9px] px-2 py-1 rounded font-black transition-all cursor-pointer ${
                        requestFilterTab === "pending" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 bg-transparent"
                      }`}
                    >
                      পেন্ডিং
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestFilterTab("all_history")}
                      className={`text-[9px] px-2 py-1 rounded font-black transition-all cursor-pointer ${
                        requestFilterTab === "all_history" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 bg-transparent"
                      }`}
                    >
                      ইতিহাস
                    </button>
                  </div>
                </div>

                {/* Queue Table */}
                {filteredRequests.filter((r) => r.type === "saving" || r.type === "withdraw").length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs font-black text-slate-500">কোনো সেভিংস রিকোয়েস্ট পাওয়া যায়নি</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto scrollbar-none">
                    {filteredRequests
                      .filter((r) => r.type === "saving" || r.type === "withdraw")
                      .map((req) => {
                        const rUser = users.find((u) => u.docId === req.userId);
                        return (
                          <div key={req.id} className="p-4 hover:bg-slate-50/50 transition space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-800">{rUser?.name || req.userName}</h4>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">তারিখ: {req.date || req.createdAt?.split("T")[0]}</p>
                              </div>
                              <div className="text-right">
                                <span className={`text-xs font-black ${req.type === "withdraw" ? "text-rose-600" : "text-emerald-600"}`}>
                                  {req.type === "withdraw" ? "-" : "+"}৳{formatNum(req.amount)}
                                </span>
                                <div className="mt-1">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                    req.status === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : req.status === "approved"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}>
                                    {req.status === "pending" ? "পেন্ডিং" : req.status === "approved" ? "অনুমোদিত" : "বাতিল"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Details of payment info */}
                            <div className="text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-xl border border-dashed border-slate-150 space-y-1">
                              <div>মাধ্যম: <span className="text-slate-700">{req.paymentMethod === "mobile_banking" ? "মোবাইল ব্যাংকিং" : req.paymentMethod === "bank" ? "ব্যাংক" : "ক্যাশ"}</span></div>
                              {req.providerName && <div>প্রদানকারী: <span className="text-slate-700">{req.providerName}</span></div>}
                              {req.accountNo && <div>অ্যাকাউন্ট নম্বর: <span className="text-slate-700 select-all">{req.accountNo}</span></div>}
                              {req.trxId && <div>TxID: <span className="text-indigo-600 font-mono select-all">{req.trxId}</span></div>}
                              {req.memo && <div className="border-t border-slate-200/50 pt-1 mt-1 text-slate-600 font-medium">মেমো: {req.memo}</div>}
                            </div>

                            {/* Approval/Rejection buttons for Admin/Company */}
                            {req.status === "pending" && isAdminOrCompany && (
                              <div className="flex gap-2 justify-end pt-1">
                                {rejectingReqId === req.id ? (
                                  <div className="w-full space-y-2">
                                    <input
                                      type="text"
                                      placeholder="বাতিল করার কারণ লিখুন..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      className="w-full text-[10px] font-semibold border border-rose-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-rose-200"
                                    />
                                    <div className="flex gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setRejectingReqId(null)}
                                        className="px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer"
                                      >
                                        পিছিয়ে যান
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleRejectRequest(req, rejectionReason);
                                          setRejectingReqId(null);
                                          setRejectionReason("");
                                        }}
                                        className="px-2.5 py-1 text-[9px] font-bold bg-rose-600 text-white rounded-md cursor-pointer"
                                      >
                                        বাতিল নিশ্চিত করুন
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setRejectingReqId(req.id)}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[9px] font-black transition cursor-pointer"
                                    >
                                      বাতিল করুন
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveRequest(req)}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      রিকোয়েস্ট অনুমোদন করুন
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeSubTab === "installments" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Form (5 columns) */}
              <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
                <div className="bg-purple-600 text-white px-5 py-4">
                  <h3 className="text-sm sm:text-md font-black flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    বকেয়া কিস্তি পরিশোধ (Arrears Installments Form)
                  </h3>
                  <p className="text-[10px] text-purple-100 font-semibold mt-0.5">
                    কোম্পানির গ্রাহক কিস্তি চুক্তির বকেয়া কিস্তি পরিশোধ রিকোয়েস্ট সাবমিট করুন। বাড়তি টাকা আপনার সেভিংসে জমা হবে।
                  </p>
                </div>

                <form onSubmit={handleCreateTransaction} className="p-5 space-y-4">
                  {/* Member/User Selection */}
                  {isAdminOrCompany ? (
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">সদস্য নির্বাচন করুন</label>
                      <select
                        value={selectedUserId}
                        onChange={(e) => setSelectedUserId(e.target.value)}
                        required
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      >
                        <option value="">-- সদস্য সিলেক্ট করুন --</option>
                        {activeCompanyMembers.map((member) => (
                          <option key={member.docId} value={member.docId}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">সদস্য (আপনি)</label>
                      <div className="w-full text-xs font-black border border-slate-200 rounded-xl px-3 py-2 bg-slate-100 text-slate-500 flex items-center gap-1.5">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        {currentUser.name}
                      </div>
                    </div>
                  )}

                  {/* Selected User's Installment Contracts Dropdown */}
                  <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl space-y-1.5">
                    <label className="block text-[9px] font-black text-purple-700 uppercase">পরিশোধযোগ্য কিস্তি চুক্তি</label>
                    {selectedUserInstallments.length > 0 ? (
                      <select
                        value={selectedInstallmentId}
                        onChange={(e) => setSelectedInstallmentId(e.target.value)}
                        required
                        className="w-full text-xs font-extrabold border border-purple-200 rounded-lg p-2 bg-white text-purple-900 outline-none focus:ring-2 focus:ring-purple-100 transition"
                      >
                        <option value="">-- কিস্তি চুক্তি নির্বাচন করুন --</option>
                        {selectedUserInstallments.map((inst) => (
                          <option key={inst.id} value={inst.id}>
                            {inst.productName} (বকেয়া কিস্তিঃ ৳{formatNum(inst.dueAmount)})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-[10px] font-bold text-rose-600 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        কোন বকেয়া কিস্তি চুক্তি পাওয়া যায়নি।
                      </div>
                    )}
                  </div>

                  {/* Amount & Date Picker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">টাকার পরিমাণ (৳)</label>
                      <input
                        type="number"
                        value={trxAmount}
                        onChange={(e) => setTrxAmount(e.target.value)}
                        placeholder="পরিমাণ (৳)"
                        required
                        min="1"
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1">তারিখ</label>
                      <input
                        type="date"
                        value={trxDate}
                        onChange={(e) => setTrxDate(e.target.value)}
                        required
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">লেনদেন মাধ্যম (Payment Method)</label>
                    <div className={`grid ${companyGateway?.enabled ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("mobile_banking")}
                        className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                          paymentMethod === "mobile_banking"
                            ? "border-purple-600 bg-purple-50/50 text-purple-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        <Smartphone className="w-3.5 h-3.5 text-purple-500" />
                        মোবাইল
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("bank")}
                        className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                          paymentMethod === "bank"
                            ? "border-purple-600 bg-purple-50/50 text-purple-700"
                            : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                        ব্যাংক
                      </button>
                      {companyGateway?.enabled && (
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("online_gateway")}
                          className={`py-2 px-1 border text-[10px] font-black rounded-xl flex items-center gap-1 justify-center transition cursor-pointer ${
                            paymentMethod === "online_gateway"
                              ? "border-purple-600 bg-purple-50/50 text-purple-700"
                              : "border-slate-200 hover:border-slate-300 text-slate-600 bg-white"
                          }`}
                        >
                          <CreditCard className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                          গেটওয়ে পে
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Online Gateway Info Box */}
                  {paymentMethod === "online_gateway" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-fadeIn">
                      <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-xs">
                        <span className="p-1.5 bg-emerald-100 rounded-xl">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        </span>
                        ইনস্ট্যান্ট অনলাইন গেটওয়ে পেমেন্ট
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                        আপনি <span className="text-emerald-700 font-black">{companyGateway?.displayName || "অনলাইন পেমেন্ট গেটওয়ে"}</span> নির্বাচন করেছেন। সাবমিট বাটনে চাপ দিলে আপনার পেমেন্ট গেটওয়ে স্ক্রিনটি ওপেন হবে। গেটওয়েতে পেমেন্ট সম্পন্ন হওয়ার পর কিস্তি পরিশোধটি <span className="text-indigo-600 font-black">স্বয়ংক্রিয়ভাবে অনুমোদিত</span> ও হিসাব খাতায় যুক্ত হয়ে যাবে।
                      </p>
                      <div className="bg-white p-2.5 rounded-xl border border-dashed border-emerald-200 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-bold">প্রোভাইডার:</span>
                        <span className="text-slate-800 font-extrabold uppercase bg-slate-50 px-2 py-0.5 rounded border">{companyGateway?.provider || "bKash"}</span>
                      </div>
                    </div>
                  )}

                  {/* Display active accounts for copy-paste */}
                  {paymentMethod !== "online_gateway" && (
                    <div className="bg-purple-50/40 border border-purple-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center gap-1 text-purple-800 font-extrabold text-[10px]">
                      <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      টাকা পাঠানোর কোম্পানি একাউন্টস
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto scrollbar-none">
                      {companyAccounts
                        .filter((acc) => acc.companyId === targetCompanyId && acc.type === paymentMethod && acc.isActive)
                        .map((acc) => (
                          <div key={acc.id} className="bg-white border border-slate-100 rounded-lg p-2 flex items-center justify-between gap-2 shadow-3xs">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-1 text-[9px] font-black">
                                <span className="text-purple-600 bg-purple-50 px-1 rounded">{acc.providerName}</span>
                                <span className="text-slate-400">({acc.accountType || "N/A"})</span>
                              </div>
                              <div className="text-[10px] font-black text-slate-700 select-all tracking-wide">{acc.accountNumber}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(acc.accountNumber);
                                setCopiedAccountId(acc.id);
                                setTimeout(() => setCopiedAccountId(null), 1500);
                              }}
                              className="p-1 border border-slate-200 hover:border-indigo-200 text-slate-500 hover:text-indigo-600 rounded text-[9px] font-bold transition flex items-center gap-0.5 cursor-pointer"
                            >
                              {copiedAccountId === acc.id ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                            </button>
                          </div>
                        ))}
                      {companyAccounts.filter((acc) => acc.companyId === targetCompanyId && acc.type === paymentMethod && acc.isActive).length === 0 && (
                        <div className="text-center py-2 text-[9px] font-bold text-slate-400 border border-dashed border-slate-200 rounded-lg">
                          কোনো সক্রিয় একাউন্ট পাওয়া যায়নি।
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {/* Payment Info inputs */}
                  {paymentMethod === "mobile_banking" && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex gap-1">
                        {["bkash", "nagad", "rocket", "upay"].map((provider) => (
                          <button
                            key={provider}
                            type="button"
                            onClick={() => setMobileProvider(provider as any)}
                            className={`flex-1 py-1 text-[8px] font-black uppercase rounded border transition cursor-pointer ${
                              mobileProvider === provider
                                ? "bg-purple-100 border-purple-300 text-purple-700 font-bold"
                                : "bg-white border-slate-200 text-slate-500 hover:text-slate-700"
                            }`}
                          >
                            {provider === "bkash" ? "bKash" : provider === "nagad" ? "Nagad" : provider === "rocket" ? "Rocket" : "Upay"}
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase">নম্বর</label>
                          <input
                            type="tel"
                            value={mobileAccountNo}
                            onChange={(e) => setMobileAccountNo(e.target.value)}
                            placeholder="017XXXXXXXX"
                            required
                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500 uppercase">TxID</label>
                          <input
                            type="text"
                            value={mobileTrxId}
                            onChange={(e) => setMobileTrxId(e.target.value)}
                            placeholder="AX9K2H7F"
                            required
                            className="w-full text-xs font-mono font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {paymentMethod === "bank" && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">ব্যাংক</label>
                          <select
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            className="w-full text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          >
                            <option value="Dutch-Bangla Bank">DBBL</option>
                            <option value="Islami Bank Bangladesh">Islami Bank</option>
                            <option value="BRAC Bank">BRAC Bank</option>
                            <option value="Sonali Bank">Sonali Bank</option>
                            <option value="The City Bank">City Bank</option>
                            <option value="Other Bank">অন্যান্য</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">শাখা</label>
                          <input
                            type="text"
                            value={bankBranch}
                            onChange={(e) => setBankBranch(e.target.value)}
                            placeholder="শাখা"
                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">হিসাব নম্বর</label>
                          <input
                            type="text"
                            value={bankAccountNo}
                            onChange={(e) => setBankAccountNo(e.target.value)}
                            placeholder="হিসাব নম্বর"
                            required
                            className="w-full text-xs font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-slate-500">স্লিপ রেফারেন্স</label>
                          <input
                            type="text"
                            value={bankTrxId}
                            onChange={(e) => setBankTrxId(e.target.value)}
                            placeholder="SLIP-XXX"
                            required
                            className="w-full text-xs font-mono font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Memo */}
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 uppercase mb-1">মন্তব্য / মেমো</label>
                    <textarea
                      value={trxMemo}
                      onChange={(e) => setTrxMemo(e.target.value)}
                      placeholder="অতিরিক্ত বিবরণ লিখুন..."
                      rows={1.5}
                      className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition resize-none"
                    />
                  </div>

                  {toastMsg && (
                    <div className={`p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 ${
                      toastMsg.type === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-rose-50 text-rose-800 border border-rose-100"
                    }`}>
                      <span>{toastMsg.text}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting || !selectedInstallmentId}
                    className={`w-full py-2.5 text-white rounded-xl text-xs font-black transition cursor-pointer ${
                      submitting || !selectedInstallmentId ? "bg-slate-300 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-700"
                    }`}
                  >
                    {submitting ? "সাবমিট হচ্ছে..." : "কিস্তি পরিশোধ রিকোয়েস্ট পাঠান"}
                  </button>
                </form>
              </div>

              {/* Right Column: Installment Requests Queue (7 columns) */}
              <div className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/40">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-purple-50 text-purple-600 rounded-xl border border-purple-100 flex items-center justify-center">
                      <Clock className="w-4 h-4 animate-pulse" />
                    </span>
                    <div>
                      <h2 className="text-xs font-black text-slate-800">কিস্তি পরিশোধ রিকোয়েস্ট কিউ</h2>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">বকেয়া কিস্তি পরিশোধ রিকোয়েস্ট যাচাইকরণ তালিকা</p>
                    </div>
                  </div>

                  {/* Toggle pending vs history */}
                  <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setRequestFilterTab("pending")}
                      className={`text-[9px] px-2 py-1 rounded font-black transition-all cursor-pointer ${
                        requestFilterTab === "pending" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 bg-transparent"
                      }`}
                    >
                      পেন্ডিং
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestFilterTab("all_history")}
                      className={`text-[9px] px-2 py-1 rounded font-black transition-all cursor-pointer ${
                        requestFilterTab === "all_history" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 bg-transparent"
                      }`}
                    >
                      ইতিহাস
                    </button>
                  </div>
                </div>

                {/* Queue Table */}
                {filteredRequests.filter((r) => r.type === "installment").length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
                    <p className="text-xs font-black text-slate-500">কোনো কিস্তি পরিশোধ রিকোয়েস্ট পাওয়া যায়নি</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto scrollbar-none">
                    {filteredRequests
                      .filter((r) => r.type === "installment")
                      .map((req) => {
                        const rUser = users.find((u) => u.docId === req.userId);
                        return (
                          <div key={req.id} className="p-4 hover:bg-slate-50/50 transition space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="text-xs font-extrabold text-slate-800">{rUser?.name || req.userName}</h4>
                                <p className="text-[9px] text-slate-400 font-bold mt-0.5">তারিখ: {req.date || req.createdAt?.split("T")[0]}</p>
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-black text-purple-600">৳{formatNum(req.amount)}</span>
                                <div className="mt-1">
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                                    req.status === "pending"
                                      ? "bg-amber-100 text-amber-800"
                                      : req.status === "approved"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}>
                                    {req.status === "pending" ? "পেন্ডিং" : req.status === "approved" ? "অনুমোদিত" : "বাতিল"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Details of payment info */}
                            <div className="text-[10px] font-bold text-slate-500 bg-slate-50 p-2 rounded-xl border border-dashed border-slate-150 space-y-1">
                              <div>কিস্তি চুক্তি আইডি বা নাম: <span className="text-purple-700 font-extrabold">{req.installmentId ? installments.find(inst => inst.id === req.installmentId)?.productName || "কিস্তি চুক্তি" : "কিস্তি চুক্তি"}</span></div>
                              <div>মাধ্যম: <span className="text-slate-700">{req.paymentMethod === "mobile_banking" ? "মোবাইল ব্যাংকিং" : "ব্যাংক"}</span></div>
                              {req.providerName && <div>প্রদানকারী: <span className="text-slate-700">{req.providerName}</span></div>}
                              {req.accountNo && <div>অ্যাকাউন্ট নম্বর: <span className="text-slate-700 select-all">{req.accountNo}</span></div>}
                              {req.trxId && <div>TxID: <span className="text-indigo-600 font-mono select-all">{req.trxId}</span></div>}
                              {req.memo && <div className="border-t border-slate-200/50 pt-1 mt-1 text-slate-600 font-medium">মেমো: {req.memo}</div>}
                            </div>

                            {/* Approval/Rejection buttons for Admin/Company */}
                            {req.status === "pending" && isAdminOrCompany && (
                              <div className="flex gap-2 justify-end pt-1">
                                {rejectingReqId === req.id ? (
                                  <div className="w-full space-y-2">
                                    <input
                                      type="text"
                                      placeholder="বাতিল করার কারণ লিখুন..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      className="w-full text-[10px] font-semibold border border-rose-200 rounded-lg p-2 outline-none focus:ring-1 focus:ring-rose-200"
                                    />
                                    <div className="flex gap-1.5 justify-end">
                                      <button
                                        type="button"
                                        onClick={() => setRejectingReqId(null)}
                                        className="px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 rounded-md cursor-pointer"
                                      >
                                        পিছিয়ে যান
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleRejectRequest(req, rejectionReason);
                                          setRejectingReqId(null);
                                          setRejectionReason("");
                                        }}
                                        className="px-2.5 py-1 text-[9px] font-bold bg-rose-600 text-white rounded-md cursor-pointer"
                                      >
                                        বাতিল নিশ্চিত করুন
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setRejectingReqId(req.id)}
                                      className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[9px] font-black transition cursor-pointer"
                                    >
                                      বাতিল করুন
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleApproveRequest(req)}
                                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[9px] font-black transition flex items-center gap-1 cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                      রিকোয়েস্ট অনুমোদন করুন
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeSubTab === "settings" && (
            <div className="space-y-6 animate-fadeIn">
              {/* ADMIN/COMPANY ONLY: Add Account Form */}
              {isAdminOrCompany && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden max-w-2xl mx-auto">
                  <div className="bg-indigo-600 text-white px-6 py-4">
                    <h3 className="text-sm sm:text-md font-black flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      নতুন পেমেন্ট অ্যাকাউন্ট যুক্ত করুন (Add Payment Account)
                    </h3>
                    <p className="text-[10px] text-indigo-100 font-bold mt-0.5">
                      মেম্বারদের ক্যাশ-ইন করার সুবিধার জন্য বিকাশ, নগদ বা ব্যাংক একাউন্ট যুক্ত করে রাখুন
                    </p>
                  </div>

                  <form onSubmit={handleAddCompanyAccount} className="p-6 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Account Type Selector */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">অ্যাকাউন্টের ধরণ</label>
                        <select
                          value={newAccType}
                          onChange={(e) => {
                            const val = e.target.value as "mobile_banking" | "bank";
                            setNewAccType(val);
                            setNewAccProvider(val === "mobile_banking" ? "bKash" : "Dutch-Bangla Bank");
                            setNewAccTypeLabel(val === "mobile_banking" ? "Personal" : "Savings");
                          }}
                          className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                        >
                          <option value="mobile_banking">মোবাইল ব্যাংকিং</option>
                          <option value="bank">ব্যাংক একাউন্ট</option>
                        </select>
                      </div>

                      {/* Provider Selection */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">প্রদানকারী (Provider Name)</label>
                        {newAccType === "mobile_banking" ? (
                          <select
                            value={newAccProvider}
                            onChange={(e) => setNewAccProvider(e.target.value)}
                            className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                          >
                            <option value="bKash">bKash</option>
                            <option value="Nagad">Nagad</option>
                            <option value="Rocket">Rocket</option>
                            <option value="Upay">Upay</option>
                          </select>
                        ) : (
                          <select
                            value={newAccProvider}
                            onChange={(e) => setNewAccProvider(e.target.value)}
                            className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                          >
                            <option value="Dutch-Bangla Bank">Dutch-Bangla Bank</option>
                            <option value="Islami Bank Bangladesh">Islami Bank Bangladesh</option>
                            <option value="BRAC Bank">BRAC Bank</option>
                            <option value="Sonali Bank">Sonali Bank</option>
                            <option value="The City Bank">The City Bank</option>
                            <option value="Mutual Trust Bank">Mutual Trust Bank</option>
                            <option value="Other Bank">অন্যান্য ব্যাংক</option>
                          </select>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Account Number */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">অ্যাকাউন্ট নম্বর</label>
                        <input
                          type="text"
                          value={newAccNumber}
                          onChange={(e) => setNewAccNumber(e.target.value)}
                          placeholder={newAccType === "mobile_banking" ? "যেমন: 017XXXXXXXX" : "ব্যাংক অ্যাকাউন্ট নম্বর"}
                          required
                          className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                        />
                      </div>

                      {/* Account Type Label (Personal/Agent/Branch) */}
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">
                          {newAccType === "mobile_banking" ? "প্রকার (যেমনঃ Personal/Merchant/Agent)" : "শাখার নাম (Branch)"}
                        </label>
                        <input
                          type="text"
                          value={newAccTypeLabel}
                          onChange={(e) => setNewAccTypeLabel(e.target.value)}
                          placeholder={newAccType === "mobile_banking" ? "Personal, Agent, Merchant" : "যেমন: মতিঝিল শাখা"}
                          className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                        />
                      </div>
                    </div>

                    {/* Account Name */}
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">হিসাবের নাম (Account Holder Name)</label>
                      <input
                        type="text"
                        value={newAccHolderName}
                        onChange={(e) => setNewAccHolderName(e.target.value)}
                        placeholder="যেমন: রহিম এন্টারপ্রাইজ / জনাব ফয়সাল"
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                      />
                    </div>

                    {/* Toast Alert Inside form if active */}
                    {toastMsg && (
                      <div className="p-3.5 bg-indigo-50 border border-indigo-100 text-indigo-800 text-xs font-bold rounded-xl flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                        <span>{toastMsg.text}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        "সংরক্ষণ করুন (Save Account)"
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* LIST OF SAVED PAYMENTS */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden max-w-4xl mx-auto p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm sm:text-md font-black text-slate-800">কোম্পানি পেমেন্ট অ্যাকাউন্টস তালিকা</h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">সব ধরনের মোবাইল ব্যাংকিং ও ব্যাংক ট্রান্সফারের ঠিকানা সমূহের বিবরণ</p>
                  </div>
                  <span className="bg-indigo-50 text-indigo-700 font-black text-[10px] px-2.5 py-1 rounded-full border border-indigo-100">
                    মোট সক্রিয় অ্যাকাউন্টঃ {companyAccounts.filter(a => a.companyId === targetCompanyId && a.isActive).length} টি
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {companyAccounts
                    .filter((acc) => acc.companyId === targetCompanyId)
                    .map((acc) => (
                      <div
                        key={acc.id}
                        className={`p-4 border rounded-2xl space-y-3 transition relative flex flex-col justify-between ${
                          acc.isActive 
                            ? "border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-xs" 
                            : "border-slate-100 bg-slate-100/30 text-slate-400"
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                              acc.type === "mobile_banking" 
                                ? "bg-pink-100 text-pink-700" 
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {acc.providerName}
                            </span>
                            
                            {!acc.isActive && (
                              <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                নিষ্ক্রিয় (Inactive)
                              </span>
                            )}
                          </div>

                          <div className="space-y-1">
                            <p className="text-[10px] text-slate-400 font-bold">অ্যাকাউন্ট নম্বরঃ</p>
                            <p className={`text-sm font-black tracking-wide ${acc.isActive ? "text-slate-800" : "text-slate-500"}`}>
                              {acc.accountNumber}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-slate-500 border-t border-dashed border-slate-200/60 pt-2">
                            <div>
                              <span className="text-slate-400">ধরন / শাখাঃ</span> <br />
                              <span className="font-extrabold text-slate-700">{acc.accountType || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">হিসাবের নামঃ</span> <br />
                              <span className="font-extrabold text-slate-700">{acc.accountName || "N/A"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action controllers */}
                        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(acc.accountNumber);
                              setCopiedAccountId(acc.id);
                              setTimeout(() => setCopiedAccountId(null), 1500);
                            }}
                            className="mr-auto px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                          >
                            {copiedAccountId === acc.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                কপি হয়েছে
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                কপি করুন
                              </>
                            )}
                          </button>

                          {isAdminOrCompany && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleAccountStatus(acc.id, acc.isActive)}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition border cursor-pointer ${
                                  acc.isActive
                                    ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                    : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                                }`}
                              >
                                {acc.isActive ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteCompanyAccount(acc.id)}
                                className="p-1 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg cursor-pointer transition"
                                title="মুছে ফেলুন"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}

                  {companyAccounts.filter(a => a.companyId === targetCompanyId).length === 0 && (
                    <div className="col-span-full text-center py-8 text-slate-400 font-extrabold text-xs border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      কোনো পেমেন্ট অ্যাকাউন্ট যুক্ত করা হয়নি।
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NEW TRANSACTION DIALOG MODAL */}
      {showTrxModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-white rounded-3xl w-full max-w-xl shadow-xl overflow-hidden animate-scaleUp">
            {/* Modal header */}
            <div className="bg-indigo-600 text-white px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-md sm:text-lg font-black flex items-center gap-2">
                  <Coins className="w-5 h-5" />
                  নতুন মোবাইল/ব্যাংক লেনদেন করুন
                </h3>
                <p className="text-[10px] text-indigo-100 font-bold mt-1">
                  ব্যাংক বা মোবাইল ব্যাংকিং দিয়ে ক্যাশ-ইন ও ক্যাশ-আউট করুন
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTrxModal(false);
                  setToastMsg(null);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white transition shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body & Form */}
            <form onSubmit={handleCreateTransaction} className="p-6 space-y-5">
              {/* Flow Tab selector: CASH IN or CASH OUT */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">লেনদেনের ধরণ (Transaction Mode)</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => handleFlowToggle("IN")}
                    className={`py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      trxFlow === "IN"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    ক্যাশ-ইন (টাকা জমা)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFlowToggle("OUT")}
                    className={`py-2 text-xs font-black rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      trxFlow === "OUT"
                        ? "bg-rose-600 text-white shadow-sm"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <TrendingDown className="w-4 h-4" />
                    ক্যাশ-আউট (উত্তোলন)
                  </button>
                </div>
              </div>

              {/* Grid: User selector & Subcategory Purpose */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Member selection */}
                {isAdminOrCompany ? (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">সদস্য নির্বাচন করুন</label>
                    <select
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      required
                      className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                    >
                      <option value="">-- সদস্য সিলেক্ট করুন --</option>
                      {activeCompanyMembers.map((member) => (
                        <option key={member.docId} value={member.docId}>
                          {member.name} (সেভিংস: ৳{formatNum(member.savingsBalance !== undefined ? member.savingsBalance : (member.amount || 0))} | ইনকাম: ৳{formatNum(member.incomeBalance || 0)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">সদস্য (আপনি)</label>
                    <div className="w-full text-xs font-black border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-100 text-slate-500 flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5" />
                      {currentUser.name} (সেভিংস: ৳{formatNum(currentUser.savingsBalance !== undefined ? currentUser.savingsBalance : (currentUser.amount || 0))} | ইনকাম: ৳{formatNum(currentUser.incomeBalance || 0)})
                    </div>
                  </div>
                )}

                {/* Sub category Selector (Depositing savings vs installment) */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">উদ্দেশ্য / ক্যাটাগরি</label>
                  {trxFlow === "OUT" ? (
                    <div className="w-full text-xs font-black border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-100 text-slate-500 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5" />
                      সেভিংস ফান্ড উত্তোলন
                    </div>
                  ) : (
                    <select
                      value={trxType}
                      onChange={(e) => setTrxType(e.target.value as any)}
                      required
                      className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                    >
                      <option value="saving">সাধারণ সেভিংস / সঞ্চয় জমা</option>
                      <option value="installment">গ্রাহক কিস্তি পরিশোধ</option>
                    </select>
                  )}
                </div>
              </div>

              {/* Installment selection dropdown if Cash In + Installment selected */}
              {trxFlow === "IN" && trxType === "installment" && (
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-2">
                  <label className="block text-[10px] font-black text-purple-700 uppercase tracking-wider">পরিশোধযোগ্য কিস্তি চুক্তি</label>
                  {selectedUserInstallments.length > 0 ? (
                    <select
                      value={selectedInstallmentId}
                      onChange={(e) => setSelectedInstallmentId(e.target.value)}
                      required
                      className="w-full text-xs font-extrabold border border-purple-200 rounded-xl px-3 py-2 bg-white text-purple-900 outline-none focus:ring-2 focus:ring-purple-100 transition"
                    >
                      {selectedUserInstallments.map((inst) => (
                        <option key={inst.id} value={inst.id}>
                          {inst.productName} (বকেয়া কিস্তিঃ ৳{formatNum(inst.dueAmount)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="text-[11px] font-bold text-rose-600 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      নির্বাচিত সদস্যের কোন বকেয়া কিস্তি চুক্তি পাওয়া যায়নি। সঞ্চয় জমা করুন।
                    </div>
                  )}
                </div>
              )}

              {/* Amount & Date Picker Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Amount field */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">টাকার পরিমাণ (Amount ৳)</label>
                  <input
                    type="number"
                    value={trxAmount}
                    onChange={(e) => setTrxAmount(e.target.value)}
                    placeholder="পরিমাণ (৳)"
                    required
                    min="1"
                    className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                  />
                </div>

                {/* Date field */}
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">তারিখ (Date)</label>
                  <input
                    type="date"
                    value={trxDate}
                    onChange={(e) => setTrxDate(e.target.value)}
                    required
                    className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition"
                  />
                </div>
              </div>

              {/* PAYMENT METHDOLODY SELECTOR (Mobile Banking or Bank) */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">লেনদেন মাধ্যম (Payment Method)</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("mobile_banking")}
                    className={`py-3 px-4 border text-xs font-black rounded-2xl flex items-center gap-2 justify-center transition cursor-pointer ${
                      paymentMethod === "mobile_banking"
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-extrabold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-indigo-500" />
                    মোবাইল ব্যাংকিং (বিকাশ/নগদ)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("bank")}
                    className={`py-3 px-4 border text-xs font-black rounded-2xl flex items-center gap-2 justify-center transition cursor-pointer ${
                      paymentMethod === "bank"
                        ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 font-extrabold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-indigo-500" />
                    ব্যাংক ট্রান্সফার
                  </button>
                </div>
              </div>

              {/* MOBILE BANKING DETAILS FORM */}
              {paymentMethod === "mobile_banking" ? (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3.5">
                  <div className="flex gap-2">
                    {/* Providers */}
                    {["bkash", "nagad", "rocket", "upay"].map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => setMobileProvider(provider as any)}
                        className={`flex-1 py-1 px-2 text-[10px] font-black uppercase rounded-lg border transition cursor-pointer ${
                          mobileProvider === provider
                            ? "bg-pink-100 border-pink-400 text-pink-700 font-black shadow-2xs"
                            : "bg-white border-slate-200 text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {provider === "bkash" ? "bKash" : provider === "nagad" ? "Nagad" : provider === "rocket" ? "Rocket" : "Upay"}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Mobile Account No */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">একাউন্ট নম্বর (Mobile Number)</label>
                      <input
                        type="tel"
                        value={mobileAccountNo}
                        onChange={(e) => setMobileAccountNo(e.target.value)}
                        placeholder="017XXXXXXXX"
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                    {/* Transaction ID */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">ট্রানজেকশন আইডি (TxID)</label>
                      <input
                        type="text"
                        value={mobileTrxId}
                        onChange={(e) => setMobileTrxId(e.target.value)}
                        placeholder="e.g. AX9K2H7F"
                        className="w-full text-xs font-mono font-extrabold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* BANK TRANSFER DETAILS FORM */
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Bank name select */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">ব্যাংকের নাম (Bank Name)</label>
                      <select
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                      >
                        <option value="Dutch-Bangla Bank">Dutch-Bangla Bank</option>
                        <option value="Islami Bank Bangladesh">Islami Bank Bangladesh</option>
                        <option value="BRAC Bank">BRAC Bank</option>
                        <option value="Sonali Bank">Sonali Bank</option>
                        <option value="The City Bank">The City Bank</option>
                        <option value="Mutual Trust Bank">Mutual Trust Bank</option>
                        <option value="Other Bank">অন্যান্য ব্যাংক</option>
                      </select>
                    </div>

                    {/* Branch Name */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">শাখার নাম (Branch)</label>
                      <input
                        type="text"
                        value={bankBranch}
                        onChange={(e) => setBankBranch(e.target.value)}
                        placeholder="যেমন: মতিঝিল শাখা"
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Bank Account Number */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">ব্যাংক হিসাব নম্বর (Account No)</label>
                      <input
                        type="text"
                        value={bankAccountNo}
                        onChange={(e) => setBankAccountNo(e.target.value)}
                        placeholder="হিসাব নম্বর লিখুন"
                        className="w-full text-xs font-extrabold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                    {/* Ref / Trx ID */}
                    <div>
                      <label className="block text-[9px] font-black text-slate-500 uppercase tracking-wider mb-1">রেফারেন্স / স্লিপ আইডি (Ref No)</label>
                      <input
                        type="text"
                        value={bankTrxId}
                        onChange={(e) => setBankTrxId(e.target.value)}
                        placeholder="যেমন: SLIP-7389"
                        className="w-full text-xs font-mono font-extrabold border border-slate-200 rounded-xl px-2.5 py-2 bg-white text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 transition"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Memo / Description */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">মন্তব্য / মেমো (Memo / Note)</label>
                <textarea
                  value={trxMemo}
                  onChange={(e) => setTrxMemo(e.target.value)}
                  placeholder="লেনদেনের অতিরিক্ত বিবরণ বা মেমো এখানে লিখুন..."
                  rows={2}
                  className="w-full text-xs font-bold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100 focus:bg-white transition resize-none"
                />
              </div>

              {/* Toast Message inside Modal */}
              {toastMsg && (
                <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2.5 ${
                  toastMsg.type === "success"
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-100 animate-fadeIn"
                    : "bg-rose-50 text-rose-800 border border-rose-100 animate-shake"
                }`}>
                  {toastMsg.type === "success" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                  )}
                  <span>{toastMsg.text}</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTrxModal(false);
                    setToastMsg(null);
                  }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black cursor-pointer transition active:scale-95"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={submitting || (trxFlow === "IN" && trxType === "installment" && !selectedInstallmentId)}
                  className={`flex-2 py-3 text-white rounded-2xl text-xs font-black transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer ${
                    submitting || (trxFlow === "IN" && trxType === "installment" && !selectedInstallmentId)
                      ? "bg-slate-300 cursor-not-allowed"
                      : trxFlow === "OUT"
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-indigo-600 hover:bg-indigo-700"
                  }`}
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : trxFlow === "OUT" ? (
                    "ক্যাশ-আউট নিশ্চিত করুন"
                  ) : (
                    "ক্যাশ-ইন নিশ্চিত করুন"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SIMULATED ONLINE PAYMENT GATEWAY CHECKOUT OVERLAY ================= */}
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
              const reqRef = await addDoc(collection(db, "transaction_requests"), {
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
                installmentName: trxType === "installment" ? (selectedUserInstallments.find(i => i.id === selectedInstallmentId)?.productName || "") : "",
                mobileProvider: companyGateway?.provider || "bkash",
                mobileAccountNo: "Online Gateway",
                mobileTrxId: generatedTxId,
              });

              // 2. Build the request object
              const newRequest: TransactionRequest = {
                id: reqRef.id,
                companyId: targetCompanyId || "",
                userId: selectedUserId,
                userName: member.name,
                userEmail: member.email || "",
                flow: "IN",
                type: trxType as any,
                amount: parseFloat(trxAmount),
                date: trxDate,
                memo: trxMemo || `অনলাইন গেটওয়ে পেমেন্ট (${companyGateway?.displayName || "প্রোভাইডার"})`,
                paymentMethod: "online_gateway",
                status: "pending",
                createdAt: new Date().toISOString(),
                installmentId: trxType === "installment" ? selectedInstallmentId : "",
                installmentName: trxType === "installment" ? (selectedUserInstallments.find(i => i.id === selectedInstallmentId)?.productName || "") : "",
                mobileProvider: companyGateway?.provider as any || "bkash",
                mobileAccountNo: "Online Gateway",
                mobileTrxId: generatedTxId,
              };

              // 3. Immediately trigger automatic approval logic
              await handleApproveRequest(newRequest);

              // 4. Close both modal overlays and clear inputs!
              setShowGatewayCheckout(false);
              setShowTrxModal(false);
              setTrxAmount("");
              setTrxMemo("");
              setMobileAccountNo("");
              setMobileTrxId("");
              setBankAccountNo("");
              setBankTrxId("");
            } catch (err: any) {
              console.error(err);
              alert("অনলাইন পেমেন্ট প্রসেস করতে ব্যর্থ হয়েছে: " + err.message);
            }
          }}
        />
      )}
    </div>
  );
}

interface GatewayCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  gateway: any;
  currentUser: any;
  onSubmit: (trxId: string) => Promise<void>;
}

function GatewayCheckoutModal({ isOpen, onClose, amount, gateway, currentUser, onSubmit }: GatewayCheckoutModalProps) {
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
    // Auto preset channel based on company's active gateway provider
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
        alert("সদস্যর মোবাইল নম্বর দিন।");
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
      // Cards don't need wallet PIN
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
    
    // Simulate API delay
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
              <div className="text-xs font-black text-slate-100">{gateway?.displayName || "Online Gateway"}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Merchant & Amount Info Bar */}
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

        {/* Dynamic Step Wizard Content */}
        <div className="p-5 flex-1 min-h-[260px] flex flex-col justify-center">
          {step === "channel" && (
            <div className="space-y-4 text-center">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">পেমেন্ট মেথড নির্বাচন করুন</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleChannelSelect("bkash")}
                  className="p-3 border border-pink-100 hover:border-pink-300 rounded-2xl bg-pink-50/20 text-pink-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-pink-50/40"
                >
                  <span className="w-8 h-8 bg-pink-600 text-white rounded-full flex items-center justify-center font-black text-xs">b</span>
                  <span className="text-[10px] font-black uppercase">bKash</span>
                </button>

                <button
                  onClick={() => handleChannelSelect("nagad")}
                  className="p-3 border border-orange-100 hover:border-orange-300 rounded-2xl bg-orange-50/20 text-orange-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-orange-50/40"
                >
                  <span className="w-8 h-8 bg-orange-600 text-white rounded-full flex items-center justify-center font-black text-xs">N</span>
                  <span className="text-[10px] font-black uppercase">Nagad</span>
                </button>

                <button
                  onClick={() => handleChannelSelect("rocket")}
                  className="p-3 border border-indigo-100 hover:border-indigo-300 rounded-2xl bg-indigo-50/20 text-indigo-700 flex flex-col items-center justify-center gap-1.5 transition cursor-pointer hover:bg-indigo-50/40"
                >
                  <span className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-black text-xs">R</span>
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
                    <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">কার্ডহোল্ডারের নাম</label>
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
                      <label className="block text-[8px] font-black text-slate-400 uppercase mb-1">মেয়াদ শেষ (MM/YY)</label>
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
                    এই পেমেন্ট উইন্ডোটি একটি পরীক্ষামূলক গেটওয়ে সিমুলেশন। সম্পূর্ণ সুরক্ষিত উপায়ে এপিআই কী ব্যবহার করে ডেটাবেজে ভেরিফাই হচ্ছে।
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
                  placeholder="৬-ডিজিটের কোড দিন"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="w-full text-center text-sm font-mono font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                />
                <div className="flex justify-between text-[8px] font-black text-slate-400">
                  <button type="button" onClick={generateMockOtp} className="hover:text-indigo-600 underline cursor-pointer">পুনরায় ওটিপি পাঠান</button>
                  <span>টেস্ট কোড: {mockOtp || "123456"}</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("details")}
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

          {step === "pin" && (
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <div className="text-center space-y-1">
                <span className="px-2.5 py-0.5 text-[8px] font-black uppercase rounded-full bg-pink-50 text-pink-700">
                  পিন ভেরিফিকেশন (PIN Entry)
                </span>
                <p className="text-[10px] font-bold text-slate-500">
                  পেমেন্ট সম্পন্ন করতে আপনার {channel} ওয়ালেট পিন নম্বরটি টাইপ করুন।
                </p>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="PIN লিখুন"
                  maxLength={5}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  className="w-full text-center text-sm font-black tracking-widest border border-slate-200 rounded-2xl px-3 py-2.5 bg-slate-50 text-slate-700 outline-none focus:ring-1 focus:ring-pink-500 focus:bg-white transition"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep("otp")}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black cursor-pointer"
                >
                  পিছনে যান
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-[10px] font-black cursor-pointer shadow-sm active:scale-95"
                >
                  টাকা পরিশোধ করুন ৳{amount.toLocaleString("bn-BD")}
                </button>
              </div>
            </form>
          )}

          {step === "processing" && (
            <div className="space-y-4 text-center animate-pulse">
              <div className="w-12 h-12 border-4 border-pink-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800">পেমেন্ট প্রসেস করা হচ্ছে...</h4>
                <p className="text-[9px] font-bold text-slate-400">অনুগ্রহ করে অপেক্ষা করুন, উইন্ডো বন্ধ করবেন না।</p>
              </div>
            </div>
          )}

          {step === "completed" && (
            <div className="space-y-4 text-center animate-fadeIn">
              <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border border-emerald-100">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 animate-bounce" />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-black text-slate-800">পেমেন্ট সফল হয়েছে!</h4>
                <p className="text-[9px] font-bold text-emerald-600">আপনার হিসাব স্বয়ংক্রিয়ভাবে আপডেট করা হয়েছে।</p>
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
  );
}
