import React, { useState } from "react";
import { User, Mail, Phone, Building2, ChevronRight } from "lucide-react";
import { doc, setDoc, getDoc, runTransaction } from "firebase/firestore";
import { auth, db } from "../firebase";
import { normalizePhoneNumber } from "../utils/firestore";

interface CompleteProfileViewProps {
  firebaseUser: any;
  language: "bn" | "en";
}

export const CompleteProfileView: React.FC<CompleteProfileViewProps> = ({
  firebaseUser,
  language,
}) => {
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const t = {
    bn: {
      title: "প্রোফাইল সম্পূর্ণ করুন",
      subtitle: "আপনার অ্যাকাউন্ট সেটআপ সম্পন্ন করতে অনুগ্রহ করে নিচের তথ্যগুলো পূরণ করুন।",
      companyLabel: "সমিতি বা কোম্পানির নাম *",
      companyPlaceholder: "যেমন: আদর্শ কো-অপারেটিভ সোসাইটি",
      ownerLabel: "মালিক বা প্রোপাইটরের নাম *",
      ownerPlaceholder: "আপনার পুরো নাম লিখুন",
      phoneLabel: "মোবাইল নম্বর *",
      phonePlaceholder: "যেমন: 017XXXXXXXX",
      btnText: "সেটআপ সম্পন্ন করুন",
      btnLoading: "প্রক্রিয়াধীন...",
      phoneError: "❌ অনুগ্রহ করে একটি সঠিক বাংলাদেশী মোবাইল নম্বর দিন (যেমনঃ 01712345678)",
      allFieldsRequired: "❌ সবগুলো ফিল্ড পূরণ করা আবশ্যক",
      successMsg: "🎉 সেটআপ সফল হয়েছে! ড্যাশবোর্ড লোড হচ্ছে...",
    },
    en: {
      title: "Complete Profile",
      subtitle: "Please fill in the details below to complete your account setup.",
      companyLabel: "Society or Company Name *",
      companyPlaceholder: "e.g. Adarsha Co-operative Society",
      ownerLabel: "Owner or Proprietor Name *",
      ownerPlaceholder: "Enter your full name",
      phoneLabel: "Mobile Number *",
      phonePlaceholder: "e.g. 017XXXXXXXX",
      btnText: "Complete Setup",
      btnLoading: "Processing...",
      phoneError: "❌ Please enter a valid Bangladeshi mobile number (e.g. 01712345678)",
      allFieldsRequired: "❌ All fields are required",
      successMsg: "🎉 Setup successful! Loading dashboard...",
    }
  }[language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !ownerName.trim() || !phone.trim()) {
      setError(t.allFieldsRequired);
      return;
    }

    const normalizedPhone = normalizePhoneNumber(phone);
    const validPhone = /^01[3-9]\d{8}$/.test(normalizedPhone);
    if (!validPhone) {
      setError(t.phoneError);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const email = firebaseUser.email || "";

      const initialRole = "company";
      const initialStatus = "pending";

      // 1. Generate unique user Id (C001 etc.)
      const newUserId = await runTransaction(db, async (transaction) => {
        const counterRef = doc(db, "counters", "userCounter");
        const snap = await transaction.get(counterRef);
        const nextId = snap.exists() ? (snap.data().currentId || 0) + 1 : 1;
        transaction.set(counterRef, { currentId: nextId }, { merge: true });
        return "C" + nextId.toString().padStart(3, "0");
      });

      // 2. Set user document
      await setDoc(doc(db, "users", newUserId), {
        uid: firebaseUser.uid,
        userId: newUserId,
        companyName: companyName.trim(),
        name: ownerName.trim(),
        mobile: normalizedPhone,
        email: email,
        role: initialRole,
        status: initialStatus,
        joinedDate: Date.now(),
        createdAt: Date.now(),
      });

      // 3. Write phone mapping
      try {
        await setDoc(doc(db, "phone_to_email", normalizedPhone), {
          email: email,
          userId: newUserId,
        });
      } catch (err) {
        console.error("Error writing phone_to_email mapping:", err);
      }

      setSuccess(true);
      // Wait a moment for onSnapshot in App.tsx to catch the profile and reload automatically
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during setup.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg">
            <Building2 className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl font-black text-slate-800 tracking-tight">
          {t.title}
        </h2>
        <p className="mt-2 text-center text-xs font-semibold text-slate-500 max-w-xs mx-auto">
          {t.subtitle}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl rounded-3xl border border-slate-100 sm:px-10">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-emerald-50 text-emerald-700 text-xs font-black rounded-2xl border border-emerald-100 animate-pulse text-center">
              {t.successMsg}
            </div>
          )}

          {!success && (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.companyLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t.companyPlaceholder}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-slate-50/50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.ownerLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder={t.ownerPlaceholder}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-slate-50/50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {t.phoneLabel}
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Phone className="w-4 h-4" />
                  </div>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t.phonePlaceholder}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 hover:bg-slate-50/50 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1.5">
                  ইমেইল (অপরিবর্তনশীল)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={firebaseUser.email || ""}
                    className="block w-full pl-10 pr-4 py-3 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-400 bg-slate-100 select-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3.5 px-4 border border-transparent rounded-2xl shadow-lg hover:shadow-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>{t.btnLoading}</span>
                ) : (
                  <>
                    <span>{t.btnText}</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-6 flex justify-center">
            <button
              onClick={() => auth.signOut()}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 cursor-pointer transition"
            >
              লগআউট করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
