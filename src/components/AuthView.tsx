import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  runTransaction,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { motion, AnimatePresence } from "motion/react";
import { Lock, Building2, Eye, EyeOff, Mail, Phone, User, Landmark } from "lucide-react";
import { normalizePhoneNumber } from "../utils/firestore";
import { translations, Language } from "../utils/translations";

interface AuthViewProps {
  onSuccess: () => void;
  language?: Language;
  setLanguage?: (lang: Language) => void;
}

export default function AuthView({ onSuccess, language = "bn", setLanguage }: AuthViewProps) {
  const t = translations[language];
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Login inputs
  const [loginIdentifier, setLoginIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPass, setShowLoginPass] = useState(false);

  // Register inputs
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetIdentifier, setResetIdentifier] = useState(""); // Can be email or phone
  const [recoveryStep, setRecoveryStep] = useState<"IDENTIFIER" | "OTP" | "SHOW_PASS">("IDENTIFIER");
  const [recoveredUser, setRecoveredUser] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("1234");

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getEmailFromIdentifier = async (identifier: string) => {
    const trimmed = identifier.trim();
    if (trimmed.includes("@")) return trimmed;
    const normalized = normalizePhoneNumber(trimmed);
    
    // First, try fast, unauthenticated-safe direct lookup in phone_to_email collection
    try {
      const mappingRef = doc(db, "phone_to_email", normalized);
      const mappingSnap = await getDoc(mappingRef);
      if (mappingSnap.exists()) {
        return mappingSnap.data().email as string;
      }
    } catch (e) {
      console.warn("Fast phone mapping lookup not available:", e);
    }

    // Direct construction fallback for standard format
    if (/^01[3-9]\d{8}$/.test(normalized)) {
      const constructedEmail = `${normalized}@samitymanager.com`;
      try {
        const q = query(collection(db, "users"), where("mobile", "==", normalized));
        const snap = await getDocs(q);
        if (!snap.empty) {
          return snap.docs[0].data().email as string || constructedEmail;
        }
      } catch (e) {
        console.warn("Fallback query failed:", e);
      }
      return constructedEmail;
    }

    // Fallback if the mapping does not exist (e.g. legacy/unsynced users)
    try {
      const q = query(collection(db, "users"), where("mobile", "==", normalized));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data().email as string;
      }
    } catch (e) {
      console.warn("Unable to perform fallback users query:", e);
    }

    return null;
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier || !loginPassword) {
      setError(language === "bn" ? "সবগুলো ফিল্ড পূরণ করুন" : "Please fill in all fields");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const targetEmail = await getEmailFromIdentifier(loginIdentifier.trim());
      if (!targetEmail) {
        throw new Error("User not found");
      }

      await signInWithEmailAndPassword(auth, targetEmail, loginPassword);
      showToast(t.loginSuccess);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.message === "User not found") {
        setError(language === "bn" ? "❌ এই মোবাইল নম্বর বা ইমেইল দিয়ে কোনো অ্যাকাউন্ট পাওয়া যায়নি!" : "❌ No account found with this mobile number or email!");
      } else if (err.code === "auth/invalid-credential") {
        setError(language === "bn" ? "❌ পাসওয়ার্ডটি ভুল হয়েছে!" : "❌ Incorrect password!");
      } else {
        setError(err.message || t.loginError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !ownerName || !phone || !password || !confirmPassword) {
      showToast(t.allFieldsRequired, "error");
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const validPhone = /^01[3-9]\d{8}$/.test(normalizedPhone);
    if (!validPhone) {
      showToast(t.phoneError, "error");
      return;
    }

    if (!email.trim()) {
      showToast(language === "bn" ? "❌ অনুগ্রহ করে একটি ইমেইল এড্রেস দিন" : "❌ Please enter an email address", "error");
      return;
    }
    const validEmail = email.includes("@") && email.includes(".");
    if (!validEmail) {
      showToast(language === "bn" ? "❌ সঠিক ইমেইল এড্রেস দিন" : "❌ Enter a valid email address", "error");
      return;
    }

    if (password.length < 6) {
      showToast(t.passwordLengthError, "error");
      return;
    }

    if (password !== confirmPassword) {
      showToast(t.passwordMismatch, "error");
      return;
    }

    if (!agree) {
      showToast(t.agreeTermsError, "error");
      return;
    }

    setLoading(true);
    try {
      // Every user registering via the signup page is a company and is pending initially
      const initialRole = "company";
      const initialStatus = "pending";
      const companyEmail = email.trim() ? email.trim() : `${normalizedPhone}@samitymanager.com`;

      const cred = await createUserWithEmailAndPassword(auth, companyEmail, password);

      const newUserId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "counters", "userCounter");
        const snap = await transaction.get(counterRef);
        const nextId = snap.exists() ? (snap.data().currentId || 0) + 1 : 1;
        transaction.set(counterRef, { currentId: nextId }, { merge: true });
        return "C" + nextId.toString().padStart(3, "0");
      });

      const cleanEmail = email.trim() ? email.trim() : "";

      await setDoc(doc(db, "users", newUserId), {
        uid: cred.user.uid,
        userId: newUserId,
        companyName: companyName,
        name: ownerName,
        mobile: normalizedPhone,
        email: cleanEmail,
        firebaseAuthEmail: companyEmail,
        role: initialRole,
        status: initialStatus,
        joinedDate: Date.now(),
        createdAt: Date.now(),
        password: password, // Store plaintext password for lookup/recovery
      });

      // Write phone to email mapping for easy lookup before login
      try {
        await setDoc(doc(db, "phone_to_email", normalizedPhone), {
          email: cleanEmail,
          firebaseAuthEmail: companyEmail,
          userId: newUserId,
          name: ownerName,
          password: password,
          role: initialRole,
        });
      } catch (e) {
        console.error("Error setting phone_to_email mapping:", e);
      }

      showToast("🎉 রেজিস্ট্রেশন সফল! অ্যাডমিন অ্যাপ্রুভ করলে ড্যাশবোর্ড ব্যবহার করতে পারবেন।");
      onSuccess();
    } catch (err: any) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        showToast("❌ এই ইমেইলে বা মোবাইল নম্বরে আগেই অ্যাকাউন্ট আছে", "error");
      } else {
        showToast("❌ রেজিস্ট্রেশন ব্যর্থ হয়েছে", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverPassword = async () => {
    if (!resetIdentifier.trim()) {
      showToast(language === "bn" ? "মোবাইল নম্বর বা ইমেইল দিন" : "Please enter mobile number or email", "error");
      return;
    }

    const trimmed = resetIdentifier.trim();
    setLoading(true);
    try {
      if (trimmed.includes("@")) {
        // First check if a user with this email exists in Firestore
        let userExists = false;
        try {
          const q1 = query(collection(db, "users"), where("email", "==", trimmed));
          const q2 = query(collection(db, "users"), where("firebaseAuthEmail", "==", trimmed));
          const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          if (!snap1.empty || !snap2.empty) {
            userExists = true;
          }
        } catch (e) {
          console.warn("Email existence check failed:", e);
        }

        if (!userExists) {
          showToast(
            language === "bn" 
              ? "❌ এই ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি!" 
              : "❌ No account found with this email!", 
            "error"
          );
          setLoading(false);
          return;
        }

        // Real email reset
        await sendPasswordResetEmail(auth, trimmed);
        showToast(language === "bn" ? "✅ ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে" : "✅ Password reset link sent to your email");
        setShowForgotModal(false);
        setResetIdentifier("");
      } else {
        // Mobile number recovery
        const normalized = normalizePhoneNumber(trimmed);
        const validPhone = /^01[3-9]\d{8}$/.test(normalized);
        if (!validPhone) {
          showToast(language === "bn" ? "❌ সঠিক মোবাইল নম্বর দিন" : "❌ Enter a valid mobile number", "error");
          setLoading(false);
          return;
        }

        // Look up mapping
        let targetEmail = null;
        let mappedData = null;
        try {
          const mappingRef = doc(db, "phone_to_email", normalized);
          const mappingSnap = await getDoc(mappingRef);
          if (mappingSnap.exists()) {
            mappedData = mappingSnap.data();
            targetEmail = mappedData.email as string;
          }
        } catch (e) {
          console.warn(e);
        }

        // Search in users
        let userDoc = null;
        if (mappedData && mappedData.userId) {
          try {
            const uSnap = await getDoc(doc(db, "users", mappedData.userId));
            if (uSnap.exists()) {
              userDoc = { id: uSnap.id, ...uSnap.data() } as any;
            }
          } catch (e) {
            console.warn("Direct doc fetch failed:", e);
          }
        }

        // Fallback or direct phone search in users collection
        if (!userDoc) {
          try {
            const q = query(collection(db, "users"), where("mobile", "==", normalized));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const uData = snap.docs[0].data();
              userDoc = { id: snap.docs[0].id, ...uData } as any;
              targetEmail = userDoc.email;
            }
          } catch (err) {
            console.warn("Fallback query failed:", err);
          }
        }

        // Merge password from mapping if available
        if (userDoc) {
          if (!userDoc.password && mappedData?.password) {
            userDoc.password = mappedData.password;
          }
        }

        // Fallback to mappedData if direct collection read was denied by rules while unauthenticated
        if (!userDoc && mappedData) {
          userDoc = {
            id: mappedData.userId,
            userId: mappedData.userId,
            name: mappedData.name || "",
            email: mappedData.email || "",
            firebaseAuthEmail: mappedData.firebaseAuthEmail || "",
            role: mappedData.role || "member",
            password: mappedData.password || "",
            companyId: mappedData.companyId || null,
          };
          targetEmail = mappedData.email || mappedData.firebaseAuthEmail;
          
          if (mappedData.companyId) {
            setCompanyData({
              whatsapp: mappedData.companyWhatsapp || "",
              memberResetSetting: mappedData.memberResetSetting || "both",
            });
          } else {
            setCompanyData(null);
          }
        }

        if (!userDoc) {
          showToast(
            language === "bn" 
              ? "❌ এই মোবাইল নম্বরে কোনো অ্যাকাউন্ট পাওয়া যায়নি!" 
              : "❌ No account found with this mobile number!", 
            "error"
          );
          setLoading(false);
          return;
        }

        // Fetch company settings if the recovered user is a member
        let currentMemberResetSetting = "both";
        if (userDoc.role === "member" && userDoc.companyId && !companyData) {
          try {
            const compSnap = await getDoc(doc(db, "users", userDoc.companyId));
            if (compSnap.exists()) {
              const compData = compSnap.data();
              setCompanyData(compData);
              currentMemberResetSetting = compData.memberResetSetting || "both";
            } else {
              setCompanyData(null);
            }
          } catch (compErr) {
            console.warn("Error fetching company settings, using mappedData backup if available:", compErr);
            if (mappedData?.companyId === userDoc.companyId) {
              setCompanyData({
                whatsapp: mappedData.companyWhatsapp || "",
                memberResetSetting: mappedData.memberResetSetting || "both",
              });
              currentMemberResetSetting = mappedData.memberResetSetting || "both";
            } else {
              setCompanyData(null);
            }
          }
        } else if (!userDoc.companyId) {
          setCompanyData(null);
        } else if (companyData) {
          currentMemberResetSetting = companyData.memberResetSetting || "both";
        }

        // Save recovered user data
        setRecoveredUser(userDoc);
        setRecoveryStep("SHOW_PASS");
      }
    } catch (err: any) {
      console.error(err);
      showToast(language === "bn" ? "❌ রিকভারি ব্যর্থ হয়েছে" : "❌ Recovery failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailResetFallback = async () => {
    if (!recoveredUser) return;
    const cleanEmail = recoveredUser.email && recoveredUser.email.trim() && !recoveredUser.email.includes("@samitymanager.com")
      ? recoveredUser.email.trim()
      : null;

    if (!cleanEmail) {
      showToast(language === "bn" ? "❌ কোনো ইমেইল পাওয়া যায়নি" : "❌ No registered email found", "error");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
      showToast(language === "bn" ? "✅ ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে" : "✅ Password reset link sent to your email");
      setShowForgotModal(false);
      setResetIdentifier("");
      setRecoveryStep("IDENTIFIER");
      setRecoveredUser(null);
      setOtpInput("");
    } catch (err) {
      console.error(err);
      showToast(language === "bn" ? "❌ লিংক পাঠাতে ব্যর্থ হয়েছে" : "❌ Failed to send link", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={`fixed top-5 right-5 px-5 py-3 rounded-2xl shadow-xl text-white z-[9999] text-sm font-bold ${
              toast.type === "success" ? "bg-emerald-500" : "bg-rose-500"
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-white animate-pulse" />
          <h1 className="text-lg font-bold tracking-tight">সমিতি ম্যানেজার</h1>
        </div>
        <button
          onClick={() => {
            setIsLogin(!isLogin);
            setError("");
          }}
          className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 transition text-xs font-bold"
        >
          {isLogin ? "রেজিস্ট্রেশন" : "লগইন"}
        </button>
      </header>

      {/* Loader Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-600 text-sm font-semibold">লোড হচ্ছে...</p>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">
            {isLogin ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white border border-slate-200 shadow-xl rounded-3xl p-7"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-r from-blue-500 to-indigo-500 shadow-lg">
                    <Lock className="text-white w-6 h-6" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">স্বাগতম</h2>

                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">ফোন নম্বর বা ইমেইল</label>
                    <div className="relative mt-1">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        value={loginIdentifier}
                        onChange={(e) => setLoginIdentifier(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-400 outline-none text-sm transition"
                        placeholder="01XXXXXXXXX বা ইমেইল"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">পাসওয়ার্ড</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type={showLoginPass ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-400 outline-none text-sm transition"
                        placeholder="••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPass(!showLoginPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showLoginPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="text-rose-500 text-xs font-bold p-3 bg-rose-50 rounded-xl text-center">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl text-white font-bold bg-gradient-to-r from-blue-500 to-indigo-500 hover:opacity-90 active:scale-95 transition shadow-lg text-sm"
                  >
                    লগইন করুন
                  </button>
                </form>

                <div className="text-center text-sm text-slate-500 mt-5">
                  <button
                    onClick={() => setShowForgotModal(true)}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    পাসওয়ার্ড ভুলে গেছেন?
                  </button>
                </div>
                <p className="text-center text-sm text-slate-500 mt-3">
                  অ্যাকাউন্ট নেই?{" "}
                  <button
                    onClick={() => setIsLogin(false)}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    রেজিস্ট্রেশন করুন
                  </button>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="register"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="bg-white border border-slate-200 shadow-xl rounded-3xl p-7"
              >
                <div className="flex justify-center mb-4">
                  <div className="w-14 h-14 flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 shadow-lg">
                    <Building2 className="text-white w-6 h-6" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-center text-slate-800">কোম্পানি রেজিস্ট্রেশন</h2>
                <p className="text-center text-[11px] text-slate-500 mt-1.5 mb-5 leading-normal">
                  রেজিস্ট্রেশনের পর অ্যাডমিন অ্যাপ্রুভ করলে ড্যাশবোর্ড ব্যবহার করতে পারবেন
                </p>

                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">কোম্পানির নাম *</label>
                    <div className="relative mt-1">
                      <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 outline-none text-sm transition"
                        placeholder="আপনার কোম্পানির নাম"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">মালিকের নাম *</label>
                    <div className="relative mt-1">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        value={ownerName}
                        onChange={(e) => setOwnerName(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 outline-none text-sm transition"
                        placeholder="মালিকের পূর্ণ নাম"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">ফোন নম্বর *</label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 outline-none text-sm transition"
                        placeholder="01XXXXXXXXX"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">ইমেইল *</label>
                    <div className="relative mt-1">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 outline-none text-sm transition"
                        placeholder="example@gmail.com"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">পাসওয়ার্ড *</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type={showRegPass ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 outline-none text-sm transition"
                        placeholder="কমপক্ষে ৬ অক্ষর"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPass(!showRegPass)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showRegPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-slate-600 font-bold ml-1">পাসওয়ার্ড নিশ্চিত করুন *</label>
                    <div className="relative mt-1">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-400 outline-none text-sm transition"
                        placeholder="পাসওয়ার্ড নিশ্চিত করুন"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      id="agreeCheckbox"
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <label htmlFor="agreeCheckbox" className="text-xs text-slate-600 select-none">
                      শর্তাবলী মেনে নিচ্ছি
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3.5 rounded-xl text-white font-bold bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 active:scale-95 transition shadow-lg text-sm"
                  >
                    রেজিস্ট্রেশন করুন
                  </button>
                </form>

                <p class="text-center text-sm text-slate-500 mt-4">
                  অ্যাকাউন্ট আছে?{" "}
                  <button
                    onClick={() => setIsLogin(true)}
                    className="text-indigo-600 font-bold hover:underline"
                  >
                    লগইন করুন
                  </button>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Forgot Password Modal */}
      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 flex items-end justify-center z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowForgotModal(false);
                setRecoveryStep("IDENTIFIER");
                setRecoveredUser(null);
                setOtpInput("");
                setResetIdentifier("");
              }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-md mx-auto rounded-t-3xl p-6 bg-slate-900 border border-slate-800 shadow-2xl text-white z-10 font-sans"
            >
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-4"></div>

              {recoveryStep === "IDENTIFIER" && (
                <>
                  <h3 className="text-xl font-bold mb-1">
                    {language === "bn" ? "পাসওয়ার্ড রিসেট ও রিকভারি" : "Password Reset & Recovery"}
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    {language === "bn" 
                      ? "আপনার নিবন্ধিত মোবাইল নম্বর বা ইমেইল এড্রেসটি লিখুন" 
                      : "Enter your registered mobile number or email address"}
                  </p>
                  <input
                    type="text"
                    value={resetIdentifier}
                    onChange={(e) => setResetIdentifier(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
                    placeholder={language === "bn" ? "01XXXXXXXXX বা ইমেইল" : "01XXXXXXXXX or email"}
                  />
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => {
                        setShowForgotModal(false);
                        setResetIdentifier("");
                      }}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition font-bold text-sm"
                    >
                      {language === "bn" ? "বাতিল" : "Cancel"}
                    </button>
                    <button
                      onClick={handleRecoverPassword}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-sm"
                    >
                      {language === "bn" ? "এগিয়ে যান" : "Continue"}
                    </button>
                  </div>
                </>
              )}

              {recoveryStep === "OTP" && (
                <>
                  <h3 className="text-xl font-bold mb-1">
                    {language === "bn" ? "মোবাইল ওটিপি যাচাইকরণ" : "Mobile OTP Verification"}
                  </h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                    {language === "bn"
                      ? `আপনার মোবাইল নম্বরে (${resetIdentifier}) একটি ৪-ডিজিটের ওটিপি কোড পাঠানো হয়েছে। অনুগ্রহ করে কোডটি লিখুন।`
                      : `A 4-digit OTP code has been sent to your mobile number (${resetIdentifier}). Please enter it below.`}
                  </p>
                  
                  {/* Test OTP Assist Bubble */}
                  <div className="mb-4 p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-indigo-400">🔔 {language === "bn" ? "টেস্ট ওটিপি কোড:" : "Test OTP Code:"}</span>{" "}
                      <span className="font-mono font-bold text-lg text-white tracking-widest ml-1">{generatedOtp}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800 font-bold">
                      {language === "bn" ? "সিমুলেশন" : "Simulation"}
                    </span>
                  </div>

                  <input
                    type="text"
                    maxLength={4}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ""))}
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-center font-mono text-2xl tracking-widest"
                    placeholder="XXXX"
                  />
                  
                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => {
                        setRecoveryStep("IDENTIFIER");
                        setOtpInput("");
                      }}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition font-bold text-sm"
                    >
                      {language === "bn" ? "পিছনে" : "Back"}
                    </button>
                    <button
                      onClick={() => {
                        if (otpInput === generatedOtp || otpInput === "1234") {
                          setRecoveryStep("SHOW_PASS");
                          showToast(
                            language === "bn"
                              ? "✅ ওটিপি সফলভাবে যাচাই করা হয়েছে!"
                              : "✅ OTP verified successfully!",
                            "success"
                          );
                        } else {
                          showToast(
                            language === "bn"
                              ? "❌ ভুল ওটিপি! আবার চেষ্টা করুন।"
                              : "❌ Incorrect OTP! Please try again.",
                            "error"
                          );
                        }
                      }}
                      className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition text-sm"
                    >
                      {language === "bn" ? "যাচাই করুন" : "Verify"}
                    </button>
                  </div>
                </>
              )}

              {recoveryStep === "SHOW_PASS" && (
                <>
                  {(() => {
                    const isMemberUser = recoveredUser?.role === "member";
                    const memberResetSetting = companyData?.memberResetSetting || "both"; // "both" | "email" | "mobile" | "disabled"
                    const companyWhatsapp = companyData?.whatsapp || "";

                    const hasValidEmail = recoveredUser?.email && recoveredUser.email.trim() && !recoveredUser.email.includes("@samitymanager.com");

                    // Decide allowed modes
                    let allowEmail = true;
                    let allowMobile = true;

                    if (isMemberUser) {
                      if (memberResetSetting === "disabled") {
                        allowEmail = false;
                        allowMobile = false;
                      } else if (memberResetSetting === "email") {
                        allowEmail = true;
                        allowMobile = false;
                      } else if (memberResetSetting === "mobile") {
                        allowEmail = false;
                        allowMobile = true;
                      }
                    }

                    const whatsappMsg = `আসসালামু আলাইকুম, আমি ${recoveredUser?.name || ""}${recoveredUser?.userId ? ` (আইডি: ${recoveredUser.userId})` : ""}${recoveredUser?.mobile ? ` (মোবাইল: ${recoveredUser.mobile})` : ""}। আমার অ্যাকাউন্টের পাসওয়ার্ড রিসেট করতে সাহায্য চাচ্ছি। ধন্যবাদ।`;
                    const whatsappUrl = companyWhatsapp ? `https://wa.me/${companyWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(whatsappMsg)}` : "";

                    return (
                      <>
                        <h3 className="text-xl font-bold mb-1 text-indigo-400 flex items-center gap-1.5 justify-center sm:justify-start">
                          🔐 {language === "bn" ? "পাসওয়ার্ড রিসেট ও পুনরুদ্ধার" : "Password Reset & Recovery"}
                        </h3>
                  <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700/80 mt-3 space-y-4">
                    <div className="text-xs text-slate-300">
                      <span className="font-bold block text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">
                        {language === "bn" ? "ব্যবহারকারীর নাম" : "User Name"}
                      </span>
                      <span className="font-extrabold text-sm text-slate-100">{recoveredUser?.name || ""}</span>
                    </div>

                    {/* Render according to role */}
                    {!isMemberUser ? (
                      <div className="text-xs text-slate-300 space-y-3">
                        <span className="font-bold block text-[10px] uppercase tracking-wider text-rose-400">
                          {language === "bn" ? "কোম্পানি পাসওয়ার্ড পুনরুদ্ধার" : "Company Password Recovery"}
                        </span>
                        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 text-[11px] leading-relaxed text-rose-200">
                          {language === "bn" ? (
                            "🔐 নিরাপত্তার স্বার্থে মোবাইল নম্বর দিয়ে কোম্পানির পাসওয়ার্ড দেখা যাবে না। অনুগ্রহ করে আপনার রেজিস্টার্ড ইমেইল ব্যবহার করুন।"
                          ) : (
                            "🔐 For security reasons, company passwords cannot be retrieved using a mobile number. Please use your registered email."
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-300 space-y-3">
                        <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-400">
                          {language === "bn" ? "মেম্বার পাসওয়ার্ড পুনরুদ্ধার" : "Member Password Recovery"}
                        </span>
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-[11px] leading-relaxed text-amber-200">
                          {language === "bn" ? (
                            "🔐 নিরাপত্তার স্বার্থে সরাসরি মেম্বার পাসওয়ার্ড দেখার নিয়ম বন্ধ রয়েছে। অনুগ্রহ করে নিচের বাটনে ক্লিক করে কোম্পানির হোয়াটসঅ্যাপ নম্বরে অনুরোধ পাঠান।"
                          ) : (
                            "🔐 For security reasons, direct member password viewing is disabled. Please click the button below to send a WhatsApp request to the company owner/admin."
                          )}
                        </div>
                        {companyWhatsapp ? (
                          <div className="pt-1">
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer no-underline text-center"
                            >
                              💬 {language === "bn" ? "বাটনে ক্লিক করে হোয়াটসঅ্যাপে অনুরোধ পাঠান" : "Click to Send WhatsApp Request"}
                            </a>
                          </div>
                        ) : (
                          <div className="bg-slate-950/40 border border-slate-700/50 p-3 rounded-xl text-slate-400 text-center text-[10px]">
                            {language === "bn" ? "⚠️ আপনার কোম্পানির হোয়াটসঅ্যাপ নম্বর সেট করা নেই। অনুগ্রহ করে সমিতির প্রধান অ্যাডমিনের সাথে সরাসরি যোগাযোগ করুন।" : "⚠️ Your company's WhatsApp number is not configured. Please contact your admin directly."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

                  <div className="mt-5">
                    <button
                      onClick={() => {
                        setShowForgotModal(false);
                        setRecoveryStep("IDENTIFIER");
                        setRecoveredUser(null);
                        setOtpInput("");
                        setResetIdentifier("");
                      }}
                      className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 transition font-bold text-sm text-center cursor-pointer"
                    >
                      {language === "bn" ? "লগইন স্ক্রিনে ফিরে যান" : "Go to Login"}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-slate-100 text-center py-4 text-slate-500 text-xs border-t border-slate-200">
        © 2026 সমিতি ম্যানেজার
      </footer>
    </div>
  );
}
