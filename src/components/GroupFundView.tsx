import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  getDocs,
  getDoc,
  writeBatch
} from "firebase/firestore";
import { User, GroupFund, GroupMember, GroupPayment, GroupHistory } from "../types";
import {
  Users,
  Plus,
  TrendingUp,
  AlertCircle,
  Calendar,
  Gift,
  HelpCircle,
  Eye,
  Trash2,
  Check,
  ChevronRight,
  UserPlus,
  Coins,
  History,
  FileText,
  Clock,
  Settings,
  X,
  Play,
  Award,
  ListOrdered,
  DollarSign
} from "lucide-react";

interface GroupFundViewProps {
  currentUser: User;
  language?: "bn" | "en";
}

const BN_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
const toBnNum = (n: number | string) => {
  return String(n)
    .split("")
    .map((c) => BN_DIGITS[parseInt(c, 10)] || c)
    .join("");
};

export default function GroupFundView({ currentUser, language = "bn" }: GroupFundViewProps) {
  const companyId = currentUser.role === "company" ? currentUser.docId : (currentUser.companyId || "");

  // Real-time states
  const [groupFunds, setGroupFunds] = useState<GroupFund[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupFund | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [allCompanyUsers, setAllCompanyUsers] = useState<User[]>([]);
  const [payments, setPayments] = useState<GroupPayment[]>([]);
  const [historyLogs, setHistoryLogs] = useState<GroupHistory[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"members" | "installments" | "lottery" | "history">("members");

  // Create Group Form States
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<GroupFund["type"]>("lottery");
  const [newTotalMembers, setNewTotalMembers] = useState<number>(10);
  const [newInstallmentAmount, setNewInstallmentAmount] = useState<number>(1000);
  const [newCycle, setNewCycle] = useState<GroupFund["cycle"]>("monthly");
  const [newStartDate, setNewStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [newDuration, setNewDuration] = useState<number>(10);
  const [newDistributionMethod, setNewDistributionMethod] = useState<GroupFund["distributionMethod"]>("lottery");
  const [newLotteryDate, setNewLotteryDate] = useState("");
  const [newPenaltyRule, setNewPenaltyRule] = useState("");
  const [newPenaltyAmount, setNewPenaltyAmount] = useState<number>(0);
  const [newMinMembers, setNewMinMembers] = useState<number>(5);
  const [newDescription, setNewDescription] = useState("");

  // Add Member Form States
  const [selectedUserForGroup, setSelectedUserForGroup] = useState("");
  const [selectedSerialForMember, setSelectedSerialForMember] = useState<number>(0);

  // Installment collection interactive states
  const [selectedInstallmentIndex, setSelectedInstallmentIndex] = useState<number>(1);
  const [lotteryRunning, setLotteryRunning] = useState(false);
  const [lotteryWinner, setLotteryWinner] = useState<GroupMember | null>(null);

  // Watch group funds
  useEffect(() => {
    if (!companyId) return;

    setLoading(true);
    const q = query(collection(db, "group_funds"), where("companyId", "==", companyId));
    const unsub = onSnapshot(q, (snap) => {
      const list: GroupFund[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as GroupFund);
      });
      setGroupFunds(list);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching group funds:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [companyId]);

  // Watch company users for membership selection
  useEffect(() => {
    if (!companyId) return;

    const q = query(collection(db, "users"), where("companyId", "==", companyId), where("role", "==", "member"), where("status", "==", "active"));
    const unsub = onSnapshot(q, (snap) => {
      const list: User[] = [];
      snap.forEach((d) => {
        list.push({ docId: d.id, ...d.data() } as User);
      });
      setAllCompanyUsers(list);
    });

    return () => unsub();
  }, [companyId]);

  // Watch active group details
  useEffect(() => {
    if (!activeGroup) {
      setGroupMembers([]);
      setPayments([]);
      setHistoryLogs([]);
      return;
    }

    // 1. Members
    const qMembers = query(collection(db, "group_members"), where("groupFundId", "==", activeGroup.id));
    const unsubMembers = onSnapshot(qMembers, (snap) => {
      const list: GroupMember[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as GroupMember);
      });
      // Sort members by serial or joined date
      list.sort((a, b) => (a.serialNumber || 999) - (b.serialNumber || 999));
      setGroupMembers(list);
    });

    // 2. Payments
    const qPayments = query(collection(db, "group_payments"), where("groupFundId", "==", activeGroup.id));
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      const list: GroupPayment[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as GroupPayment);
      });
      setPayments(list);
    });

    // 3. History Logs
    const qHistory = query(collection(db, "group_history"), where("groupFundId", "==", activeGroup.id));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const list: GroupHistory[] = [];
      snap.forEach((d) => {
        list.push({ id: d.id, ...d.data() } as GroupHistory);
      });
      // Sort newest first
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      setHistoryLogs(list);
    });

    return () => {
      unsubMembers();
      unsubPayments();
      unsubHistory();
    };
  }, [activeGroup]);

  // Auto calculate end date when duration, start date, or cycle changes
  useEffect(() => {
    if (!newStartDate || !newDuration) return;
    const start = new Date(newStartDate);
    if (newCycle === "daily") {
      start.setDate(start.getDate() + newDuration);
    } else if (newCycle === "weekly") {
      start.setDate(start.getDate() + newDuration * 7);
    } else {
      start.setMonth(start.getMonth() + newDuration);
    }
    setNewEndDate(start.toISOString().split("T")[0]);
  }, [newStartDate, newDuration, newCycle]);

  const [newEndDate, setNewEndDate] = useState("");

  // Create Group Fund Action
  const handleCreateGroupFund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      alert("গ্রুপের নাম অবশ্যই দিতে হবে।");
      return;
    }

    try {
      const payload: Omit<GroupFund, "id"> = {
        companyId,
        name: newName,
        type: newType,
        totalMembers: Number(newTotalMembers),
        installmentAmount: Number(newInstallmentAmount),
        cycle: newCycle,
        startDate: newStartDate,
        endDate: newEndDate,
        durationValue: Number(newDuration),
        distributionMethod: newDistributionMethod,
        lotteryDate: newLotteryDate || undefined,
        penaltyRule: newPenaltyRule || undefined,
        penaltyAmount: Number(newPenaltyAmount),
        minMembers: Number(newMinMembers),
        description: newDescription || undefined,
        status: "active",
        createdAt: new Date().toISOString(),
        collectedAmount: 0,
        distributedAmount: 0,
      };

      const docRef = await addDoc(collection(db, "group_funds"), payload);

      // Create initial history entry
      await addDoc(collection(db, "group_history"), {
        groupFundId: docRef.id,
        type: "create",
        message: `"${newName}" গ্রুপ ফান্ড সফলভাবে তৈরি করা হয়েছে।`,
        createdAt: new Date().toISOString(),
        operatorId: currentUser.docId,
        operatorName: currentUser.name,
      });

      alert("গ্রুপ ফান্ড সফলভাবে তৈরি হয়েছে!");
      setShowCreateModal(false);
      
      // Clear form
      setNewName("");
      setNewDescription("");
      setNewLotteryDate("");
      setNewPenaltyRule("");
      setNewPenaltyAmount(0);
    } catch (err: any) {
      console.error("Error creating group fund:", err);
      alert("ত্রুটিঃ " + err.message);
    }
  };

  // Add Member to Group Fund Action
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeGroup) return;
    if (!selectedUserForGroup) {
      alert("সদস্য নির্বাচন করুন।");
      return;
    }

    if (groupMembers.length >= activeGroup.totalMembers) {
      alert(`গ্রুপের সদস্য সংখ্যা ইতিমধ্যে সর্বোচ্চ সীমায় (${activeGroup.totalMembers}) পৌঁছে গেছে।`);
      return;
    }

    // Check if user is already a member
    if (groupMembers.some((m) => m.userId === selectedUserForGroup)) {
      alert("এই সদস্য ইতিমধ্যে এই গ্রুপে যুক্ত আছেন।");
      return;
    }

    const targetUser = allCompanyUsers.find((u) => u.docId === selectedUserForGroup);
    if (!targetUser) return;

    try {
      const payload: Omit<GroupMember, "id"> = {
        groupFundId: activeGroup.id,
        companyId,
        userId: targetUser.docId,
        userName: targetUser.name,
        userMobile: targetUser.mobile,
        serialNumber: selectedSerialForMember || groupMembers.length + 1,
        joinedAt: new Date().toISOString(),
        totalPaid: 0,
        hasReceivedPayout: false,
      };

      await addDoc(collection(db, "group_members"), payload);

      await addDoc(collection(db, "group_history"), {
        groupFundId: activeGroup.id,
        type: "join",
        message: `${targetUser.name} গ্রুপে যুক্ত হয়েছেন। সিরিয়াল নম্বরঃ ${payload.serialNumber}`,
        createdAt: new Date().toISOString(),
        operatorId: currentUser.docId,
        operatorName: currentUser.name,
      });

      alert("সদস্য সফলভাবে যুক্ত করা হয়েছে!");
      setShowAddMemberModal(false);
      setSelectedUserForGroup("");
      setSelectedSerialForMember(0);
    } catch (err: any) {
      console.error("Error adding member:", err);
      alert("ত্রুটিঃ " + err.message);
    }
  };

  // Remove Member Action
  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!activeGroup) return;
    if (!window.confirm(`আপনি কি নিশ্চিত যে ${memberName}-কে গ্রুপ থেকে বাদ দিতে চান?`)) return;

    try {
      await deleteDoc(doc(db, "group_members", memberId));

      await addDoc(collection(db, "group_history"), {
        groupFundId: activeGroup.id,
        type: "status_change",
        message: `${memberName}-কে গ্রুপ থেকে বাদ দেওয়া হয়েছে।`,
        createdAt: new Date().toISOString(),
        operatorId: currentUser.docId,
        operatorName: currentUser.name,
      });

      alert("সদস্য বাদ দেওয়া হয়েছে।");
    } catch (err: any) {
      console.error("Error deleting member:", err);
    }
  };

  // Collect/Pay Installment Action
  const handlePayInstallment = async (member: GroupMember, installmentIndex: number) => {
    if (!activeGroup) return;

    const existingPayment = payments.find(
      (p) => p.userId === member.userId && p.installmentIndex === installmentIndex
    );

    if (existingPayment && existingPayment.status === "paid") {
      alert("এই কিস্তিটি ইতিমধ্যে পরিশোধিত।");
      return;
    }

    const payAmount = activeGroup.installmentAmount;
    const memoMsg = `কিস্তি #${installmentIndex} সংগ্রহ করা হয়েছে।`;

    if (!window.confirm(`${member.userName}-এর নিকট হতে কিস্তি #${installmentIndex}-এর জন্য ৳${payAmount} সংগ্রহ করতে চান?`)) {
      return;
    }

    try {
      const paymentPayload: Omit<GroupPayment, "id"> = {
        groupFundId: activeGroup.id,
        installmentIndex,
        userId: member.userId,
        userName: member.userName,
        amount: payAmount,
        paymentDate: new Date().toISOString().split("T")[0],
        status: "paid",
        notes: memoMsg,
      };

      await addDoc(collection(db, "group_payments"), paymentPayload);

      // Update GroupMember total paid
      const memberRef = doc(db, "group_members", member.id);
      await updateDoc(memberRef, {
        totalPaid: member.totalPaid + payAmount,
      });

      // Update GroupFund total collected
      const fundRef = doc(db, "group_funds", activeGroup.id);
      const newCollected = activeGroup.collectedAmount + payAmount;
      await updateDoc(fundRef, {
        collectedAmount: newCollected,
      });

      // Log History
      await addDoc(collection(db, "group_history"), {
        groupFundId: activeGroup.id,
        type: "payment",
        message: `${member.userName}-এর নিকট হতে কিস্তি #${installmentIndex}-এর জন্য ৳${payAmount} সংগ্রহ করা হয়েছে।`,
        createdAt: new Date().toISOString(),
        operatorId: currentUser.docId,
        operatorName: currentUser.name,
      });

      // Update local state copy to keep UI synchronized
      setActiveGroup((prev) => (prev ? { ...prev, collectedAmount: newCollected } : null));

      alert("কিস্তি সফলভাবে সংগ্রহ করা হয়েছে!");
    } catch (err: any) {
      console.error("Error collecting payment:", err);
      alert("ত্রুটিঃ " + err.message);
    }
  };

  // Run Lottery Draft Action
  const handleDrawLottery = async () => {
    if (!activeGroup) return;

    // Filter paid members for current index
    const eligibleMembers = groupMembers.filter((m) => {
      // Must not have received a payout already
      if (m.hasReceivedPayout) return false;

      // Must have paid for this installment cycle
      const hasPaid = payments.some(
        (p) => p.userId === m.userId && p.installmentIndex === selectedInstallmentIndex && p.status === "paid"
      );
      return hasPaid;
    });

    if (eligibleMembers.length === 0) {
      alert("এই কিস্তির কিস্তির অর্থ পরিশোধ করেছেন এবং পূর্বে কোনো ড্র জেতেননি এমন কোনো যোগ্য সদস্য পাওয়া যায়নি।");
      return;
    }

    setLotteryRunning(true);
    setLotteryWinner(null);

    // Simulated visual cycle animation
    let tickCount = 0;
    const interval = setInterval(() => {
      const tempWinner = eligibleMembers[Math.floor(Math.random() * eligibleMembers.length)];
      setLotteryWinner(tempWinner);
      tickCount++;
      if (tickCount > 15) {
        clearInterval(interval);
        finalizeLottery(eligibleMembers);
      }
    }, 150);
  };

  const finalizeLottery = async (eligibleList: GroupMember[]) => {
    if (!activeGroup) return;

    const winner = eligibleList[Math.floor(Math.random() * eligibleList.length)];
    setLotteryWinner(winner);
    setLotteryRunning(false);

    // Total payout amount is normally totalMembers * installmentAmount
    const totalPayoutAmount = groupMembers.length * activeGroup.installmentAmount;

    if (!window.confirm(`লটারি সম্পন্ন হয়েছে! বিজয়ী হলেন: ${winner.userName} 🎉\n\n৳${totalPayoutAmount} বিতরণ করতে চান?`)) {
      return;
    }

    try {
      // 1. Record Payout
      await addDoc(collection(db, "group_payouts"), {
        groupFundId: activeGroup.id,
        installmentIndex: selectedInstallmentIndex,
        userId: winner.userId,
        userName: winner.userName,
        amount: totalPayoutAmount,
        payoutDate: new Date().toISOString().split("T")[0],
        notes: `লটারি ড্র এর মাধ্যমে বিজয়ী হিসেবে অর্থ গ্রহণ করেছেন।`,
      });

      // 2. Update Member status
      const memberRef = doc(db, "group_members", winner.id);
      await updateDoc(memberRef, {
        hasReceivedPayout: true,
        receivedPayoutAmount: totalPayoutAmount,
        receivedPayoutDate: new Date().toISOString().split("T")[0],
      });

      // 3. Update GroupFund total distributed
      const fundRef = doc(db, "group_funds", activeGroup.id);
      const newDistributed = activeGroup.distributedAmount + totalPayoutAmount;
      await updateDoc(fundRef, {
        distributedAmount: newDistributed,
      });

      // 4. Log history logs
      await addDoc(collection(db, "group_history"), {
        groupFundId: activeGroup.id,
        type: "lottery",
        message: `কিস্তি #${selectedInstallmentIndex}-এর লটারি সম্পন্ন হয়েছে। বিজয়ী ${winner.userName} পেয়েছেন ৳${totalPayoutAmount}।`,
        createdAt: new Date().toISOString(),
        operatorId: currentUser.docId,
        operatorName: currentUser.name,
      });

      // Update local state copy
      setActiveGroup((prev) => (prev ? { ...prev, distributedAmount: newDistributed } : null));

      alert(`অভিনন্দন! লটারির বিজয়ী ${winner.userName}-এর কাছে অর্থ সফলভাবে বিতরণ করা হয়েছে।`);
    } catch (err: any) {
      console.error("Error finalizing lottery payout:", err);
      alert("ত্রুটিঃ " + err.message);
    }
  };

  // Perform Serial Distribution Payout
  const handleSerialPayout = async (member: GroupMember, installmentIndex: number) => {
    if (!activeGroup) return;

    if (member.hasReceivedPayout) {
      alert("এই সদস্য ইতিমধ্যে অর্থ গ্রহণ করেছেন।");
      return;
    }

    const totalPayoutAmount = groupMembers.length * activeGroup.installmentAmount;

    if (!window.confirm(`সিরিয়াল #${member.serialNumber} অনুযায়ী ${member.userName}-কে ৳${totalPayoutAmount} প্রদান করতে চান?`)) {
      return;
    }

    try {
      // 1. Record Payout
      await addDoc(collection(db, "group_payouts"), {
        groupFundId: activeGroup.id,
        installmentIndex,
        userId: member.userId,
        userName: member.userName,
        amount: totalPayoutAmount,
        payoutDate: new Date().toISOString().split("T")[0],
        notes: `সিরিয়াল অনুযায়ী নির্ধারিত অর্থ গ্রহণ করেছেন।`,
      });

      // 2. Update Member state
      const memberRef = doc(db, "group_members", member.id);
      await updateDoc(memberRef, {
        hasReceivedPayout: true,
        receivedPayoutAmount: totalPayoutAmount,
        receivedPayoutDate: new Date().toISOString().split("T")[0],
      });

      // 3. Update Group Fund total distributed
      const fundRef = doc(db, "group_funds", activeGroup.id);
      const newDistributed = activeGroup.distributedAmount + totalPayoutAmount;
      await updateDoc(fundRef, {
        distributedAmount: newDistributed,
      });

      // 4. History log
      await addDoc(collection(db, "group_history"), {
        groupFundId: activeGroup.id,
        type: "payout",
        message: `সিরিয়াল #${member.serialNumber} অনুযায়ী ${member.userName}-কে কিস্তি #${installmentIndex}-এর ৳${totalPayoutAmount} বিতরণ করা হয়েছে।`,
        createdAt: new Date().toISOString(),
        operatorId: currentUser.docId,
        operatorName: currentUser.name,
      });

      // Update local state
      setActiveGroup((prev) => (prev ? { ...prev, distributedAmount: newDistributed } : null));

      alert(`${member.userName}-কে সফলভাবে অর্থ বিতরণ করা হয়েছে!`);
    } catch (err: any) {
      console.error("Error distributing serial payout:", err);
      alert("ত্রুটিঃ " + err.message);
    }
  };

  // Delete Group Fund Action (Admin/Company only)
  const handleDeleteGroupFund = async (fundId: string, fundName: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিত যে "${fundName}" গ্রুপ ফান্ডটি চিরতরে মুছে ফেলতে চান? এতে সংশ্লিষ্ট সকল মেম্বার ও কিস্তি রেকর্ড মুছে যাবে!`)) {
      return;
    }

    try {
      // Perform a cleanup of subrecords
      const membersSnap = await getDocs(query(collection(db, "group_members"), where("groupFundId", "==", fundId)));
      const paymentsSnap = await getDocs(query(collection(db, "group_payments"), where("groupFundId", "==", fundId)));
      const historySnap = await getDocs(query(collection(db, "group_history"), where("groupFundId", "==", fundId)));

      const batch = writeBatch(db);
      membersSnap.forEach((d) => batch.delete(d.ref));
      paymentsSnap.forEach((d) => batch.delete(d.ref));
      historySnap.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "group_funds", fundId));

      await batch.commit();

      alert("গ্রুপ ফান্ড সফলভাবে মুছে ফেলা হয়েছে।");
      setActiveGroup(null);
    } catch (err: any) {
      console.error("Error deleting group fund:", err);
      alert("মুছে ফেলতে ত্রুটিঃ " + err.message);
    }
  };

  // Global Statistics computed from list
  const totalGroupsCount = groupFunds.length;
  const activeGroupsCount = groupFunds.filter((g) => g.status === "active").length;
  const totalCollectedFundsSum = groupFunds.reduce((sum, g) => sum + (g.collectedAmount || 0), 0);
  const totalDistributedFundsSum = groupFunds.reduce((sum, g) => sum + (g.distributedAmount || 0), 0);

  // Filter payments collected today
  const todayStr = new Date().toISOString().split("T")[0];
  const collectedTodaySum = payments
    .filter((p) => p.paymentDate === todayStr)
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Compute total members across active group funds
  const totalGroupMembersCount = groupMembers.length; // Active group selected members count

  return (
    <div className="font-sans text-slate-800 dark:text-slate-100 max-w-7xl mx-auto p-4 space-y-6">
      
      {/* 1. Header with custom visual banner */}
      <div className="bg-gradient-to-br from-indigo-800 via-violet-700 to-purple-800 text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fadeIn">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
              {language === "bn" ? "নতুন স্বাধীন আর্থিক মডিউল" : "Independent Financial Module"}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            👥 {language === "bn" ? "গ্রুপ ফান্ড ম্যানেজমেন্ট" : "Group Fund Management"}
          </h1>
          <p className="text-xs text-indigo-100 leading-relaxed max-w-2xl font-medium">
            সদস্যদের জন্য একটি আধুনিক ও নমনীয় আর্থিক সুবিধা। একাধিক সদস্য একটি নির্দিষ্ট উদ্দেশ্যে নির্ধারিত সময় অন্তর নির্দিষ্ট পরিমাণ অর্থ জমা করবেন এবং নিয়ম অনুযায়ী বিতরণ করা হবে।
          </p>
        </div>
        
        {/* Create group CTA button */}
        {(currentUser.role === "company" || currentUser.role === "admin") && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-3 bg-white text-indigo-800 hover:bg-slate-50 text-xs font-black rounded-2xl transition shadow-lg shrink-0 flex items-center gap-2 active:scale-95 cursor-pointer border-none"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>নতুন গ্রুপ ফান্ড তৈরি করুন</span>
          </button>
        )}
      </div>

      {/* 2. Group Fund Dashboard Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">মোট গ্রুপ ফান্ড সংখ্যা</span>
            <span className="p-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 rounded-2xl"><Users className="w-4 h-4" /></span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
              {toBnNum(totalGroupsCount)}টি
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              সক্রিয় গ্রুপঃ {toBnNum(activeGroupsCount)}টি
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">মোট জমাকৃত ফান্ড</span>
            <span className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 rounded-2xl"><TrendingUp className="w-4 h-4" /></span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              ৳{toBnNum(totalCollectedFundsSum.toLocaleString())}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              মোট বিতরণকৃত ফান্ডঃ ৳{toBnNum(totalDistributedFundsSum.toLocaleString())}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">আজকের কিস্তি সংগ্রহ</span>
            <span className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-2xl"><Coins className="w-4 h-4" /></span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
              ৳{toBnNum(collectedTodaySum.toLocaleString())}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              আজকে সংগৃহীত হয়েছে
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">আসন্ন অর্থ বিতরণের তারিখ</span>
            <span className="p-2 bg-pink-50 dark:bg-pink-950/40 text-pink-600 rounded-2xl"><Calendar className="w-4 h-4" /></span>
          </div>
          <div className="space-y-0.5">
            <h3 className="text-base sm:text-lg font-black text-pink-600 dark:text-pink-400 truncate">
              {activeGroup?.lotteryDate ? toBnNum(activeGroup.lotteryDate) : "নির্ধারিত নেই"}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              পরবর্তী বিতরণ বা ড্র তারিখ
            </p>
          </div>
        </div>
      </div>

      {/* 3. Main Content: Grid Split between groups list and detailed panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Interactive Groups List (4 Columns) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4.5 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider border-b pb-2 border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span>🗂️ গ্রুপ ফান্ড তালিকা</span>
              <span className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded-full">{toBnNum(groupFunds.length)}টি</span>
            </h3>

            {groupFunds.length === 0 ? (
              <div className="text-center py-10 text-slate-400">
                <AlertCircle className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold">কোনো গ্রুপ ফান্ড পাওয়া যায়নি।</p>
                <p className="text-[10px] text-slate-400 mt-1">উপরে "নতুন গ্রুপ ফান্ড তৈরি করুন" বাটনে ক্লিক করে শুরু করুন।</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
                {groupFunds.map((g) => {
                  const isActive = activeGroup?.id === g.id;
                  return (
                    <div
                      key={g.id}
                      onClick={() => setActiveGroup(g)}
                      className={`p-3.5 rounded-2xl border text-left cursor-pointer transition flex items-center justify-between gap-3 ${
                        isActive
                          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800"
                          : "bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border-slate-150 dark:border-slate-850"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            g.type === "lottery" 
                              ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400" 
                              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400"
                          }`}>
                            {g.type === "lottery" ? "🎲 লটারিভিত্তিক" : "🔢 সিরিয়ালভিত্তিক"}
                          </span>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {g.cycle === "monthly" ? "মাসিক" : g.cycle === "weekly" ? "সাপ্তাহিক" : "দৈনিক"}
                          </span>
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                          {g.name}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-semibold">
                          প্রতি কিস্তিঃ ৳{toBnNum(g.installmentAmount)} • মোটঃ {toBnNum(g.durationValue)}টি
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isActive ? "translate-x-1 text-indigo-500" : ""}`} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Active Group Details Workspace (8 Columns) */}
        <div className="lg:col-span-8 space-y-4">
          {!activeGroup ? (
            <div className="bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center text-slate-400 space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
                <Users className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-extrabold text-slate-700 dark:text-white">গ্রুপ ফান্ড বিবরণ ও কর্মক্ষেত্র</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto">সদস্যদের কিস্তির হিসাব পরিচালনা, লটারি ড্র করা, অর্থ বিতরণ এবং গ্রুপের ইতিহাস দেখার জন্য বাম পাশের তালিকা হতে যেকোনো একটি গ্রুপ নির্বাচন করুন।</p>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-5 animate-fadeIn">
              
              {/* Workspace Header Panel */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4 border-slate-150 dark:border-slate-850">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                      {activeGroup.name}
                    </h2>
                    <span className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full">
                      সক্রিয়
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {activeGroup.description || "এই গ্রুপের জন্য কোনো বিবরণ প্রদান করা হয়নি।"}
                  </p>
                </div>

                {/* Admin Delete CTA */}
                {(currentUser.role === "company" || currentUser.role === "admin") && (
                  <button
                    onClick={() => handleDeleteGroupFund(activeGroup.id, activeGroup.name)}
                    className="p-2 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-slate-400 hover:text-rose-600 rounded-xl transition cursor-pointer"
                    title="গ্রুপ ফান্ড মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Grid with Group properties & metadata */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-150 dark:border-slate-850 text-xs font-semibold">
                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-slate-400 block uppercase">প্রতি কিস্তির পরিমাণ</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">৳{toBnNum(activeGroup.installmentAmount)}</span>
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-slate-400 block uppercase">কিস্তির ধরন ও সংখ্যা</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">
                    {activeGroup.cycle === "monthly" ? "মাসিক" : activeGroup.cycle === "weekly" ? "সাপ্তাহিক" : "দৈনিক"} ({toBnNum(activeGroup.durationValue)}টি)
                  </span>
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-slate-400 block uppercase">মোট সংগৃহীত ফান্ড</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">৳{toBnNum(activeGroup.collectedAmount || 0)}</span>
                </div>
                <div className="space-y-1 text-left">
                  <span className="text-[10px] text-slate-400 block uppercase">মেয়াদ বা শেষ তারিখ</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{toBnNum(activeGroup.endDate)}</span>
                </div>
              </div>

              {/* Sub tabs for Workspace workspace */}
              <div className="flex border-b border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setActiveSubTab("members")}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === "members"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  সদস্য তালিকা ({toBnNum(groupMembers.length)} / {toBnNum(activeGroup.totalMembers)})
                </button>
                <button
                  onClick={() => setActiveSubTab("installments")}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === "installments"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <Coins className="w-3.5 h-3.5" />
                  কিস্তি সংগ্রহ ও ট্র্যাকার
                </button>
                <button
                  onClick={() => setActiveSubTab("lottery")}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === "lottery"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <Gift className="w-3.5 h-3.5" />
                  {activeGroup.distributionMethod === "lottery" ? "লটারি ড্র" : "সিরিয়াল পেমেন্ট"}
                </button>
                <button
                  onClick={() => setActiveSubTab("history")}
                  className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeSubTab === "history"
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                      : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  গ্রুপের ইতিহাস
                </button>
              </div>

              {/* Subtab Panels */}
              <div className="space-y-4 min-h-[300px]">
                
                {/* A. MEMBERS TAB */}
                {activeSubTab === "members" && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center flex-wrap gap-2">
                      <h4 className="text-xs font-extrabold text-slate-700 dark:text-white">গ্রুপ সদস্যদের তথ্য ও সঞ্চয়</h4>
                      {(currentUser.role === "company" || currentUser.role === "admin") && (
                        <button
                          onClick={() => setShowAddMemberModal(true)}
                          className="py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black rounded-xl transition flex items-center gap-1 cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>সদস্য যুক্ত করুন</span>
                        </button>
                      )}
                    </div>

                    {groupMembers.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400">
                        <UserPlus className="w-8 h-8 mx-auto text-slate-300 mb-1.5" />
                        <p className="text-xs font-bold">এই গ্রুপে এখনো কোনো সদস্য যুক্ত করা হয়নি।</p>
                        <p className="text-[10px] text-slate-400 mt-1">উপরে "সদস্য যুক্ত করুন" বাটনে ক্লিক করে প্রথম সদস্য যুক্ত করুন।</p>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-2xl overflow-x-auto">
                        <table className="min-w-max w-full text-xs text-left divide-y divide-slate-100 dark:divide-slate-800">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wide font-extrabold text-[10px]">
                            <tr>
                              <th className="p-3">সিরিয়াল</th>
                              <th className="p-3">সদস্যের নাম</th>
                              <th className="p-3">মোবাইল</th>
                              <th className="p-3 text-right">জমাকৃত অর্থ</th>
                              <th className="p-3 text-center">অর্থ গ্রহণ করেছেন?</th>
                              <th className="p-3 text-right">গৃহীত অর্থ</th>
                              <th className="p-3 text-center">অ্যাকশন</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {groupMembers.map((m, idx) => (
                              <tr key={m.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 font-medium">
                                <td className="p-3 font-bold text-slate-500">#{toBnNum(m.serialNumber || idx + 1)}</td>
                                <td className="p-3 font-bold text-indigo-600 dark:text-indigo-400">{m.userName}</td>
                                <td className="p-3 text-slate-500">{m.userMobile ? toBnNum(m.userMobile) : "নেই"}</td>
                                <td className="p-3 text-right font-bold text-slate-700 dark:text-slate-200">৳{toBnNum(m.totalPaid || 0)}</td>
                                <td className="p-3 text-center">
                                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                    m.hasReceivedPayout 
                                      ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" 
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                  }`}>
                                    {m.hasReceivedPayout ? "হ্যাঁ (Yes)" : "না (No)"}
                                  </span>
                                </td>
                                <td className="p-3 text-right font-black text-slate-800 dark:text-slate-100">
                                  {m.hasReceivedPayout && m.receivedPayoutAmount ? `৳${toBnNum(m.receivedPayoutAmount)}` : "-"}
                                </td>
                                <td className="p-3 text-center">
                                  {(currentUser.role === "company" || currentUser.role === "admin") && (
                                    <button
                                      onClick={() => handleRemoveMember(m.id, m.userName)}
                                      className="p-1 hover:bg-rose-50 text-rose-500 rounded transition cursor-pointer"
                                      title="গ্রুপ থেকে বাদ দিন"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* B. INSTALLMENTS COLLECT TAB */}
                {activeSubTab === "installments" && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 border-slate-100 dark:border-slate-800">
                      <div className="space-y-1">
                        <h4 className="text-xs font-extrabold text-slate-700 dark:text-white">কিস্তির কিস্তি নির্বাচন করুন ও সংগ্রহ করুন</h4>
                        <p className="text-[10px] text-slate-400 font-bold">নির্ধারিত কিস্তি নম্বর অনুযায়ী সদস্যদের জমার পেমেন্ট স্ট্যাটাস রেকর্ড করুন।</p>
                      </div>

                      {/* Select cycle picker */}
                      <div className="flex items-center gap-1.5 text-xs">
                        <label className="font-bold text-slate-500">কিস্তি চক্রঃ</label>
                        <select
                          value={selectedInstallmentIndex}
                          onChange={(e) => setSelectedInstallmentIndex(Number(e.target.value))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-extrabold"
                        >
                          {Array.from({ length: activeGroup.durationValue }).map((_, i) => (
                            <option key={i} value={i + 1}>
                              কিস্তি #{toBnNum(i + 1)}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {groupMembers.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 bg-slate-50 dark:bg-slate-800/20 rounded-2xl">
                        <AlertCircle className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                        <p className="text-xs font-bold">কিস্তি সংগ্রহ করার পূর্বে সদস্য তালিকা ট্যাবে গিয়ে সদস্য যুক্ত করুন।</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {groupMembers.map((member, idx) => {
                          const paidRecord = payments.find(
                            (p) => p.userId === member.userId && p.installmentIndex === selectedInstallmentIndex
                          );
                          const isPaid = paidRecord?.status === "paid";

                          return (
                            <div
                              key={member.id}
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${
                                isPaid
                                  ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50"
                                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-150 dark:border-slate-850"
                              }`}
                            >
                              <div className="text-left space-y-1 min-w-0">
                                <span className="text-[9px] font-bold text-slate-400">সিরিয়াল #{toBnNum(member.serialNumber || idx + 1)}</span>
                                <h5 className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                                  {member.userName}
                                </h5>
                                <p className="text-[10px] font-bold text-slate-500">
                                  কিস্তি মূল্যঃ ৳{toBnNum(activeGroup.installmentAmount)} • জমাকৃতঃ ৳{toBnNum(member.totalPaid || 0)}
                                </p>
                              </div>

                              <div className="shrink-0">
                                {isPaid ? (
                                  <span className="py-1 px-2.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 text-[10px] font-black rounded-lg flex items-center gap-1 shadow-xs">
                                    <Check className="w-3.5 h-3.5 stroke-[3.5px]" />
                                    <span>পরিশোধিত</span>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handlePayInstallment(member, selectedInstallmentIndex)}
                                    className="py-1.5 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black rounded-xl transition shadow-md shadow-indigo-600/10 active:scale-95 cursor-pointer border-none"
                                  >
                                    সংগ্রহ করুন
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* C. LOTTERY DRAW & DISTRIBUTIONS TAB */}
                {activeSubTab === "lottery" && (
                  <div className="space-y-5">
                    <div className="space-y-1 text-left border-b pb-3 border-slate-150 dark:border-slate-850">
                      <h4 className="text-xs font-extrabold text-slate-700 dark:text-white">
                        {activeGroup.distributionMethod === "lottery" ? "🎲 লটারিভিত্তিক বিতরণ ড্র" : "🔢 সিরিয়ালভিত্তিক নিয়মিত বিতরণ"}
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold">
                        {activeGroup.distributionMethod === "lottery"
                          ? "নির্ধারিত কিস্তি পরিশোধ করেছেন এবং পূর্বে অর্থ পাননি এমন যোগ্য মেম্বারদের নিয়ে ড্র করা হবে।"
                          : "পূর্বনির্ধারিত ক্রমানুসার সিরিয়াল অনুযায়ী সদস্যদের ফান্ড বিতরণ ও ইতিহাস ট্র্যাকিং।"}
                      </p>
                    </div>

                    {/* Selector of which installment/cycle's lottery we are drawing */}
                    <div className="flex items-center gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-150 dark:border-slate-850 justify-between flex-wrap">
                      <div className="flex items-center gap-2">
                        <label className="font-extrabold text-slate-500">কোন কিস্তির অর্থ বিতরণঃ</label>
                        <select
                          value={selectedInstallmentIndex}
                          onChange={(e) => setSelectedInstallmentIndex(Number(e.target.value))}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-xs font-bold"
                        >
                          {Array.from({ length: activeGroup.durationValue }).map((_, i) => (
                            <option key={i} value={i + 1}>
                              কিস্তি #{toBnNum(i + 1)} (৳{toBnNum(groupMembers.length * activeGroup.installmentAmount)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="text-[11px] font-bold text-slate-500">
                        বিতরণযোগ্য ফান্ড সাইজঃ <span className="text-indigo-600 dark:text-indigo-400 font-black">৳{toBnNum(groupMembers.length * activeGroup.installmentAmount)}</span>
                      </div>
                    </div>

                    {/* LOTTERY SPECIFIC WRAPPER */}
                    {activeGroup.distributionMethod === "lottery" ? (
                      <div className="bg-slate-50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-850 rounded-2xl p-6 text-center space-y-5 flex flex-col items-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-xl animate-pulse">
                          <Gift className="w-10 h-10 stroke-[2px]" />
                        </div>

                        <div className="space-y-1.5 max-w-sm">
                          <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">র্যান্ডম ও স্বচ্ছ ডিজিটাল লটারি ড্র</h4>
                          <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
                            শুধুমাত্র যেসব সদস্য কিস্তি #{toBnNum(selectedInstallmentIndex)} পরিশোধ করেছেন এবং পূর্বে কোনো কিস্তিতে লটারি বিজয়ী হননি, কেবল তারাই এই ড্র-তে স্বয়ংক্রিয়ভাবে অংশগ্রহণ করতে পারবেন।
                          </p>
                        </div>

                        {/* Interactive anim display */}
                        {lotteryWinner && (
                          <div className="bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-indigo-950 p-4.5 rounded-3xl w-full max-w-xs shadow-md animate-fadeIn text-center space-y-2">
                            <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 rounded-full inline-block"><Award className="w-6 h-6" /></span>
                            <h5 className="text-sm font-black text-indigo-700 dark:text-indigo-400">{lotteryWinner.userName}</h5>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">মোবাইলঃ {lotteryWinner.userMobile ? toBnNum(lotteryWinner.userMobile) : "নেই"}</p>
                            {lotteryRunning && (
                              <p className="text-[10px] text-indigo-500 font-black tracking-widest animate-pulse">ড্র হচ্ছে...</p>
                            )}
                          </div>
                        )}

                        <button
                          onClick={handleDrawLottery}
                          disabled={lotteryRunning || groupMembers.length === 0}
                          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 font-black rounded-2xl text-xs shadow-lg shadow-indigo-500/20 transition active:scale-95 cursor-pointer disabled:bg-slate-300 disabled:from-slate-300 disabled:to-slate-300 border-none"
                        >
                          {lotteryRunning ? "ড্র হচ্ছে, অপেক্ষা করুন..." : `🎲 ড্র করুন (কিস্তি #${toBnNum(selectedInstallmentIndex)})`}
                        </button>
                      </div>
                    ) : (
                      // SERIAL BASED SPECIFIC WRAPPER
                      <div className="space-y-3.5">
                        <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/40 px-3.5 py-2.5 rounded-xl border text-[11px] font-bold text-slate-500 justify-start">
                          <ListOrdered className="w-4 h-4 text-indigo-500" />
                          <span>নিচে পূর্বনির্ধারিত সিরিয়াল ক্রমানুসারে মেম্বারদের তালিকা দেওয়া হলো। ক্রমানুযায়ী অর্থ প্রদানের জন্য বিতরণ বাটনে ক্লিক করুন।</span>
                        </div>

                        <div className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-2xl overflow-x-auto">
                          <table className="min-w-max w-full text-xs text-left divide-y divide-slate-100 dark:divide-slate-800">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 uppercase tracking-wide font-extrabold text-[10px]">
                              <tr>
                                <th className="p-3">ক্রমিক নং</th>
                                <th className="p-3">মেম্বার নাম</th>
                                <th className="p-3 text-right">জমাকৃত অর্থ</th>
                                <th className="p-3 text-center">বিতরণ স্ট্যাটাস</th>
                                <th className="p-3 text-right">অ্যাকশন পেমেন্ট</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                              {groupMembers.map((member) => (
                                <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 font-medium">
                                  <td className="p-3 font-black text-indigo-600 dark:text-indigo-400">#{toBnNum(member.serialNumber || 0)}</td>
                                  <td className="p-3 font-bold text-slate-800 dark:text-white">{member.userName}</td>
                                  <td className="p-3 text-right text-slate-600 dark:text-slate-300">৳{toBnNum(member.totalPaid || 0)}</td>
                                  <td className="p-3 text-center">
                                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                      member.hasReceivedPayout
                                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                        : "bg-slate-100 text-slate-500"
                                    }`}>
                                      {member.hasReceivedPayout ? `বিতরণকৃত (৳${toBnNum(member.receivedPayoutAmount || 0)})` : "অবিতরণকৃত"}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    {!member.hasReceivedPayout ? (
                                      <button
                                        onClick={() => handleSerialPayout(member, selectedInstallmentIndex)}
                                        className="py-1 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black rounded-lg transition active:scale-95 cursor-pointer border-none"
                                      >
                                        অর্থ প্রদান করুন
                                      </button>
                                    ) : (
                                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold">পরিশোধিত</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* D. HISTORY TAB */}
                {activeSubTab === "history" && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-extrabold text-slate-700 dark:text-white">গ্রুপ ফান্ডের সম্পূর্ণ ইতিহাসের লগ বিবরণী</h4>
                    
                    {historyLogs.length === 0 ? (
                      <div className="text-center py-10 text-slate-400 bg-slate-50 dark:bg-slate-800/20 rounded-2xl">
                        <History className="w-8 h-8 mx-auto mb-1 text-slate-300" />
                        <p className="text-xs font-bold">এই গ্রুপের জন্য কোনো ইতিহাস এখনো সংরক্ষিত নেই।</p>
                      </div>
                    ) : (
                      <div className="relative border-l border-indigo-200 dark:border-indigo-950 ml-3 pl-5 space-y-4 max-h-[400px] overflow-y-auto pr-1 py-1">
                        {historyLogs.map((h) => (
                          <div key={h.id} className="relative text-left text-xs font-semibold space-y-1">
                            {/* Dot */}
                            <span className="absolute -left-[26px] top-1.5 w-3.5 h-3.5 rounded-full bg-indigo-100 dark:bg-indigo-950 border-2 border-indigo-600 shrink-0" />
                            
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                                {h.type === "create" ? "🆕 নতুন গ্রুপ" : h.type === "join" ? "➕ সদস্য যুক্ত" : h.type === "payment" ? "💰 পেমেন্ট সংগ্রহ" : "🎁 ড্র/বিতরণ"}
                              </span>
                              <span className="text-[9px] text-slate-400 font-extrabold">
                                {toBnNum(new Date(h.createdAt).toLocaleDateString())} • {new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 text-[11px] font-medium leading-relaxed">
                              {h.message}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold">
                              অপারেটরঃ {h.operatorName}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>
          )}
        </div>

      </div>

      {/* ======================================================== */}
      {/* MODALS SECTION */}
      {/* ======================================================== */}

      {/* 1. Create Group Fund Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[2000] p-4 animate-fadeIn text-left">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 w-full max-w-lg shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"><Plus className="w-5 h-5 stroke-[3px]" /></span>
                <h3 className="font-extrabold text-slate-800 dark:text-white text-sm sm:text-base">নতুন গ্রুপ ফান্ড যোগ করুন</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateGroupFund} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">গ্রুপের নাম *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none focus:border-indigo-500"
                  placeholder="যেমনঃ বন্ধন লটারি সমিতি ২০২৬"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">গ্রুপ ফান্ডের ধরন *</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as GroupFund["type"])}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="lottery">লটারিভিত্তিক গ্রুপ ফান্ড</option>
                    <option value="serial">সিরিয়ালভিত্তিক গ্রুপ ফান্ড</option>
                    <option value="emergency">জরুরি সহায়তা গ্রুপ ফান্ড</option>
                    <option value="education">শিক্ষা সঞ্চয় গ্রুপ ফান্ড</option>
                    <option value="qurbani">কোরবানি গ্রুপ ফান্ড</option>
                    <option value="travel">ভ্রমণ গ্রুপ ফান্ড</option>
                    <option value="custom">কাস্টম নিয়মভিত্তিক গ্রুপ ফান্ড</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">অর্থ বিতরণ পদ্ধতি *</label>
                  <select
                    value={newDistributionMethod}
                    onChange={(e) => setNewDistributionMethod(e.target.value as GroupFund["distributionMethod"])}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="lottery">লটারি (🎲 Draw)</option>
                    <option value="serial">সিরিয়াল অনুযায়ী (🔢 Pre-defined Sequence)</option>
                    <option value="custom">কাস্টম / অ্যাডমিন নিয়ম</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">মোট সদস্য সংখ্যা *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newTotalMembers}
                    onChange={(e) => setNewTotalMembers(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">ন্যূনতম সদস্য সংখ্যা</label>
                  <input
                    type="number"
                    min={1}
                    value={newMinMembers}
                    onChange={(e) => setNewMinMembers(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="text-[10px] font-bold text-slate-500 block">প্রতি কিস্তির টাকার পরিমাণ (৳) *</label>
                  <input
                    type="number"
                    required
                    min={100}
                    value={newInstallmentAmount}
                    onChange={(e) => setNewInstallmentAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">কিস্তির চক্র *</label>
                  <select
                    value={newCycle}
                    onChange={(e) => setNewCycle(e.target.value as GroupFund["cycle"])}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="daily">দৈনিক (Daily)</option>
                    <option value="weekly">সাপ্তাহিক (Weekly)</option>
                    <option value="monthly">মাসিক (Monthly)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">শুরুর তারিখ *</label>
                  <input
                    type="date"
                    required
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">কিস্তির মেয়াদ (Duration) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">শেষের তারিখ (Auto)</label>
                  <input
                    type="date"
                    disabled
                    value={newEndDate}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">লটারির তারিখ (ঐচ্ছিক)</label>
                  <input
                    type="date"
                    value={newLotteryDate}
                    onChange={(e) => setNewLotteryDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 block">জরিমানার নিয়ম / পরিমাণ (৳)</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newPenaltyRule}
                      onChange={(e) => setNewPenaltyRule(e.target.value)}
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                      placeholder="বিলম্ব ফি"
                    />
                    <input
                      type="number"
                      value={newPenaltyAmount}
                      onChange={(e) => setNewPenaltyAmount(Number(e.target.value))}
                      className="w-16 px-1.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-center"
                      placeholder="৳"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 block">গ্রুপের সংক্ষিপ্ত বিবরণ</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none resize-none"
                  placeholder="গ্রুপের উদ্দেশ্য ও সংক্ষিপ্ত বিবরণ এখানে লিখুন।"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-md border-none"
                >
                  সংরক্ষণ করুন
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  বাতিল করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Add Member to Group Fund Modal */}
      {showAddMemberModal && activeGroup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[2000] p-4 animate-fadeIn text-left">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4 border border-slate-100 dark:border-slate-800">
            <div className="flex justify-between items-center border-b pb-3 border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400"><UserPlus className="w-5 h-5 stroke-[2.5px]" /></span>
                <h3 className="font-extrabold text-slate-800 dark:text-white text-xs sm:text-sm">গ্রুপে নতুন মেম্বার যুক্ত করুন</h3>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4 text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">মেম্বার নির্বাচন করুন *</label>
                <select
                  required
                  value={selectedUserForGroup}
                  onChange={(e) => setSelectedUserForGroup(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                >
                  <option value="">নির্বাচন করুন</option>
                  {allCompanyUsers.map((u) => (
                    <option key={u.docId} value={u.docId}>
                      {u.name} ({u.mobile})
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-400 mt-0.5">শুধুমাত্র আপনার কোম্পানির সক্রিয় মেম্বারদের এখানে দেখাবে।</p>
              </div>

              {activeGroup.distributionMethod === "serial" && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">অর্থ গ্রহণের সিরিয়াল ক্রমানুসার (Serial) *</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={selectedSerialForMember || groupMembers.length + 1}
                    onChange={(e) => setSelectedSerialForMember(Number(e.target.value))}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:outline-none"
                  />
                  <p className="text-[9px] text-slate-400 mt-0.5">এই ক্রমিক নম্বর অনুযায়ী সদস্য নির্ধারিত কিস্তির দিন টাকা গ্রহণ করবেন।</p>
                </div>
              )}

              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-md border-none"
                >
                  যুক্ত করুন
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  বাতিল
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
