import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, collectionGroup, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User } from "./types";
import AuthView from "./components/AuthView";
import { CompleteProfileView } from "./components/CompleteProfileView";
import DashboardView from "./components/DashboardView";
import AdminDashboardView from "./components/AdminDashboardView";
import MemberListView from "./components/MemberListView";
import MemberAddView from "./components/MemberAddView";
import ProfileView from "./components/ProfileView";
import GlobalHeader from "./components/GlobalHeader";
import GlobalSlider from "./components/GlobalSlider";
import ArrearsView from "./components/ArrearsView";
import NotificationsView from "./components/NotificationsView";
import TransactionsView from "./components/TransactionsView";
import SettingsView from "./components/SettingsView";
import ActivityView from "./components/ActivityView";
import SubscriptionRequestsView from "./components/SubscriptionRequestsView";
import DepositWithdrawView from "./components/DepositWithdrawView";
import AdManagementView from "./components/AdManagementView";
import CashOutView from "./components/CashOutView";
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Smartphone, Sparkles } from "lucide-react";
import InstallGuideModal from "./components/InstallGuideModal";

type RouteView = "login" | "dashboard" | "member-list" | "member-add" | "profile" | "arrears" | "notifications" | "transactions" | "settings" | "activity" | "subscription-requests" | "deposit-withdraw" | "ad-management" | "cashout";

export default function App() {
  const [authStateLoading, setAuthStateLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Language selection state (defaults to "bn")
  const [language, setLanguage] = useState<"bn" | "en">(() => {
    return (localStorage.getItem("app_language") as "bn" | "en") || "bn";
  });

  useEffect(() => {
    localStorage.setItem("app_language", language);
  }, [language]);

  // Theme selection state (defaults to "light")
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("app_theme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    localStorage.setItem("app_theme", theme);
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // Mobile bottom navigation bar and FAB visibility state
  const isNavVisible = true;

  // Router-like state variables
  const [currentView, setCurrentView] = useState<RouteView>("login");
  const [navigationParams, setNavigationParams] = useState<any>(null);

  // PWA Install State & Event listeners
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If already running in standalone (installed) mode, hide the banner
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBanner(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User install choice: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } else {
      // Fallback: If prompt is not deferred, show the step-by-step install guide modal
      setShowInstallGuide(true);
    }
  };

  // Monitor Auth State
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCurrentUser(null);
        setCurrentView("login");
        setAuthStateLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Sync user profile document from Firestore
  useEffect(() => {
    if (!firebaseUser) return;

    setAuthStateLoading(true);
    const q = query(collection(db, "users"), where("uid", "==", firebaseUser.uid));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const docData = snapshot.docs[0];
          const u = { docId: docData.id, ...docData.data() } as User;
          setCurrentUser(u);

          // Role & status safety locks
          const isActive = u.status === "active";
          const isAdmin = u.role === "admin";

          if (!isActive && !isAdmin) {
            // Pending/deactive users can only view their own profile
            setCurrentView("profile");
            setNavigationParams(null);
          } else if (u.requirePasswordChange) {
            // Users requiring password change are locked to the profile view
            setCurrentView("profile");
            setNavigationParams(null);
          } else {
            // Active users or Admins default to dashboard if they are coming from login
            setCurrentView((prev) => (prev === "login" ? "dashboard" : prev));
          }
        } else {
          // No profile doc found (could be newly registered/lag)
          setCurrentUser(null);
        }
        setAuthStateLoading(false);
      },
      (error) => {
        console.error("Firestore user monitor error:", error);
        setAuthStateLoading(false);
      }
    );

    return () => unsub();
  }, [firebaseUser]);

  // Subscription system entry limits
  const [subscriptionLimits, setSubscriptionLimits] = useState({
    freeLimit: 50,
    monthlyLimit: 1000,
    yearlyLimit: 10000
  });

  useEffect(() => {
    if (!firebaseUser) return;

    const limitsRef = doc(db, "settings", "subscription_limits");
    const unsub = onSnapshot(limitsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setSubscriptionLimits({
          freeLimit: data.freeLimit ?? 50,
          monthlyLimit: data.monthlyLimit ?? 1000,
          yearlyLimit: data.yearlyLimit ?? 10000
        });
      }
    }, (err) => {
      // Gracefully log as warning with clean fallbacks to prevent fatal console error reports
      console.warn("Gracefully handled subscription limits loading. Using offline default limits:", err.message);
    });
    return () => unsub();
  }, [firebaseUser]);

  // Real-time parent company plan state for members, or own plan for companies
  const [companyPlan, setCompanyPlan] = useState<"free" | "monthly" | "yearly">("free");

  useEffect(() => {
    if (!currentUser) {
      setCompanyPlan("free");
      return;
    }

    if (currentUser.role === "admin") {
      setCompanyPlan("yearly"); // Admins are always premium / ad-free
      return;
    }

    if (currentUser.role === "company") {
      setCompanyPlan(currentUser.plan || "free");
      return;
    }

    // If member, listen to the parent company document in real-time
    if (currentUser.role === "member" && currentUser.companyId) {
      const companyRef = doc(db, "users", currentUser.companyId);
      const unsub = onSnapshot(companyRef, (snap) => {
        if (snap.exists()) {
          const companyData = snap.data();
          setCompanyPlan(companyData.plan || "free");
        } else {
          setCompanyPlan("free");
        }
      }, (err) => {
        console.error("Error listening to company subscription plan:", err);
        setCompanyPlan("free");
      });
      return () => unsub();
    } else {
      setCompanyPlan("free");
    }
  }, [currentUser]);

  // Dynamic application name and manifest based on user's company
  const [appName, setAppName] = useState("নগরীক সমিতি");
  const [appIcon, setAppIcon] = useState("/app_icon.jpg");

  useEffect(() => {
    if (!currentUser) {
      setAppName("নগরীক সমিতি");
      setAppIcon("/app_icon.jpg");
      return;
    }

    if (currentUser.role === "admin") {
      setAppName(currentUser.name || "সুপার এডমিন");
      setAppIcon(currentUser.profilePic || "/app_icon.jpg");
      return;
    }

    if (currentUser.role === "company") {
      const name = currentUser.companyName || currentUser.name || "নগরীক সমিতি";
      setAppName(name);
      setAppIcon(currentUser.profilePic || "/app_icon.jpg");
      return;
    }

    if (currentUser.role === "member" && currentUser.companyId) {
      const companyRef = doc(db, "users", currentUser.companyId);
      const unsub = onSnapshot(companyRef, (snap) => {
        if (snap.exists()) {
          const companyData = snap.data();
          const name = companyData.companyName || companyData.name || "নগরীক সমিতি";
          setAppName(name);
          setAppIcon(companyData.profilePic || "/app_icon.jpg");
        } else {
          setAppName("নগরীক সমিতি");
          setAppIcon("/app_icon.jpg");
        }
      }, (err) => {
        console.error("Error listening to company name for manifest:", err);
        setAppName("নগরীক সমিতি");
        setAppIcon("/app_icon.jpg");
      });
      return () => unsub();
    } else {
      setAppName("নগরীক সমিতি");
      setAppIcon("/app_icon.jpg");
    }
  }, [currentUser]);

  // Handle dynamic manifest.json generation and browser title/favicon update
  useEffect(() => {
    // Update Document Title
    document.title = appName;

    // Update Favicon and Apple Touch Icon in document head
    let faviconLink = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (!faviconLink) {
      faviconLink = document.createElement("link");
      faviconLink.rel = "icon";
      faviconLink.type = "image/jpeg";
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = appIcon;

    let appleIconLink = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
    if (!appleIconLink) {
      appleIconLink = document.createElement("link");
      appleIconLink.rel = "apple-touch-icon";
      document.head.appendChild(appleIconLink);
    }
    appleIconLink.href = appIcon;

    // Build customized dynamic manifest object
    const manifest = {
      name: appName,
      short_name: appName.length > 15 ? appName.substring(0, 15) : appName,
      description: `${appName} - ডিজিটাল মেম্বার খাতা ও সঞ্চয় ড্যাশবোর্ড`,
      start_url: "/",
      display: "standalone",
      background_color: "#0f172a",
      theme_color: "#0284c7",
      orientation: "portrait-primary",
      icons: [
        {
          src: appIcon,
          sizes: "192x192",
          type: appIcon.endsWith(".jpg") || appIcon.endsWith(".jpeg") ? "image/jpeg" : "image/png",
          purpose: "any"
        },
        {
          src: appIcon,
          sizes: "512x512",
          type: appIcon.endsWith(".jpg") || appIcon.endsWith(".jpeg") ? "image/jpeg" : "image/png",
          purpose: "any"
        }
      ]
    };

    const stringManifest = JSON.stringify(manifest);
    const blob = new Blob([stringManifest], { type: "application/json" });
    const manifestURL = URL.createObjectURL(blob);

    // Swap or insert the <link rel="manifest"> tag in document head
    let linkElement = document.querySelector('link[rel="manifest"]') as HTMLLinkElement;
    if (linkElement) {
      linkElement.href = manifestURL;
    } else {
      linkElement = document.createElement("link");
      linkElement.rel = "manifest";
      linkElement.href = manifestURL;
      document.head.appendChild(linkElement);
    }

    return () => {
      URL.revokeObjectURL(manifestURL);
    };
  }, [appName, appIcon]);

  // Track company member history document counts for accurate subscription limit enforcement
  const [memberHistoryCounts, setMemberHistoryCounts] = useState<{[userId: string]: number}>({});

  useEffect(() => {
    setMemberHistoryCounts({});
  }, [currentUser]);

  // Live sync of all company members' history counts for Company role
  useEffect(() => {
    if (!currentUser || currentUser.role !== "company") return;

    const q = query(collection(db, "users"), where("companyId", "==", currentUser.docId));
    const activeUnsubs = new Map<string, () => void>();

    const unsubUsersList = onSnapshot(q, (snap) => {
      const currentMemberIds = new Set<string>();
      snap.forEach((d) => {
        const u = d.data();
        if (u.role === "member") {
          currentMemberIds.add(d.id);
        }
      });

      // Remove unsubs for users no longer in company
      for (const [userId, unsub] of activeUnsubs.entries()) {
        if (!currentMemberIds.has(userId)) {
          unsub();
          activeUnsubs.delete(userId);
          setMemberHistoryCounts((prev) => {
            const updated = { ...prev };
            delete updated[userId];
            return updated;
          });
        }
      }

      // Add unsubs for new members
      currentMemberIds.forEach((userId) => {
        if (!activeUnsubs.has(userId)) {
          const unsubHist = onSnapshot(collection(db, "users", userId, "history"), (histSnap) => {
            setMemberHistoryCounts((prev) => ({
              ...prev,
              [userId]: histSnap.docs.length
            }));
          }, (err) => {
            console.warn(`Failed to listen to history count for member ${userId}:`, err.message);
          });
          activeUnsubs.set(userId, unsubHist);
        }
      });
    }, (err) => {
      console.warn("Failed to listen to company members list in App:", err.message);
    });

    return () => {
      unsubUsersList();
      activeUnsubs.forEach((unsub) => unsub());
    };
  }, [currentUser]);

  const companyHistoriesCount: number = (Object.values(memberHistoryCounts) as number[]).reduce((sum: number, val: number) => sum + val, 0);

  // Subscription system entry counting
  const [totalEntries, setTotalEntries] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setTotalEntries(0);
      return;
    }

    const companyId = currentUser.role === "company" ? currentUser.docId : (currentUser.companyId || "");
    if (!companyId) {
      setTotalEntries(0);
      return;
    }

    let usersList: any[] = [];
    let projectsList: any[] = [];
    let installmentsCount = 0;
    let latestLedgerCount = 0;
    let latestHistories: any[] = [];

    const computeTotal = (uList: any[], pList: any[], iCount: number, lCount: number, hList: any[]) => {
      const companyMemberIds = new Set(
        uList.filter((u) => u.role === "member" && u.companyId === companyId).map((u) => u.docId)
      );
      const mCount = companyMemberIds.size;
      const projCount = pList.filter((p) => p.companyId === companyId).length;
      
      let histCount = 0;
      if (currentUser.role === "admin") {
        histCount = hList.filter((h) => companyMemberIds.has(h.userDocId)).length;
      } else if (currentUser.role === "member") {
        histCount = hList.filter((h) => h.userDocId === currentUser.docId).length;
      } else {
        // For company, we sum the real-time member history counts
        histCount = companyHistoriesCount;
      }

      const total = mCount + projCount + iCount + histCount + lCount;
      setTotalEntries(total);
    };

    // Role-based Users Query
    const userQuery = currentUser.role === "admin"
      ? collection(db, "users")
      : query(collection(db, "users"), where("companyId", "==", companyId));

    const unsubUsers = onSnapshot(userQuery, (snap) => {
      usersList = [];
      snap.forEach((d) => {
        usersList.push({ docId: d.id, ...d.data() });
      });
      if (currentUser.role === "company" && !usersList.some((u) => u.docId === currentUser.docId)) {
        usersList.push(currentUser);
      }
      computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
    });

    // Role-based Projects Query
    const projectQuery = currentUser.role === "admin"
      ? collection(db, "projects")
      : query(collection(db, "projects"), where("companyId", "==", companyId));

    const unsubProjects = onSnapshot(projectQuery, (snap) => {
      projectsList = [];
      snap.forEach((d) => {
        projectsList.push({ id: d.id, ...d.data() });
      });
      computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
    });

    // Role-based Installments Query
    const installmentQuery = currentUser.role === "admin"
      ? collection(db, "installments")
      : query(collection(db, "installments"), where("companyId", "==", companyId));

    const unsubInstallments = onSnapshot(installmentQuery, (snap) => {
      installmentsCount = snap.docs.length;
      computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
    });

    // Role-based Accounts Query
    const accountQuery = currentUser.role === "admin"
      ? collection(db, "accounts")
      : query(collection(db, "accounts"), where("companyId", "==", companyId));

    const unsubAccounts = onSnapshot(accountQuery, (snap) => {
      latestLedgerCount = snap.docs.length;
      computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
    });

    // Role-based History Query
    let unsubAllHistory: () => void;
    if (currentUser.role === "admin") {
      unsubAllHistory = onSnapshot(collectionGroup(db, "history"), (snap) => {
        latestHistories = [];
        snap.forEach((d) => {
          const parentUserDocId = d.ref.parent?.parent?.id || "";
          latestHistories.push({ docId: d.id, userDocId: parentUserDocId });
        });
        computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
      });
    } else if (currentUser.role === "member") {
      unsubAllHistory = onSnapshot(collection(db, "users", currentUser.docId, "history"), (snap) => {
        latestHistories = [];
        snap.forEach((d) => {
          latestHistories.push({ docId: d.id, userDocId: currentUser.docId });
        });
        computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
      });
    } else {
      // Company role handles history counts reactively outside to prevent collectionGroup permission errors
      unsubAllHistory = () => {};
      // We still need to call computeTotal to initialize/update when the other queries snapshot
      computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
    }

    return () => {
      unsubUsers();
      unsubProjects();
      unsubInstallments();
      unsubAccounts();
      unsubAllHistory();
    };
  }, [currentUser, companyHistoriesCount]);

  // Background sync of phone to email mappings for unauthenticated lookup during login
  useEffect(() => {
    if (!currentUser) return;
    const syncPhoneMappings = async () => {
      if (currentUser.role === "admin" || currentUser.role === "company") {
        try {
          const usersSnap = await getDocs(collection(db, "users"));
          const usersMap = new Map(usersSnap.docs.map(docSnap => [docSnap.id, docSnap.data()]));
          
          for (const d of usersSnap.docs) {
            const data = d.data();
            if (data.mobile) {
              const companyData = data.companyId ? usersMap.get(data.companyId) : null;
              const companyWhatsapp = companyData?.whatsapp || companyData?.mobile || "";
              const memberResetSetting = companyData?.memberResetSetting || "both";

              const phoneRef = doc(db, "phone_to_email", data.mobile);
              const phoneSnap = await getDoc(phoneRef);
              const existingMapping = phoneSnap.exists() ? phoneSnap.data() : null;
              
              if (
                !existingMapping || 
                existingMapping.email !== (data.email || "") || 
                !existingMapping.name || 
                !existingMapping.password || 
                !existingMapping.firebaseAuthEmail || 
                !existingMapping.role ||
                existingMapping.companyId !== (data.companyId || "") ||
                existingMapping.companyWhatsapp !== companyWhatsapp ||
                existingMapping.memberResetSetting !== memberResetSetting
              ) {
                await setDoc(phoneRef, {
                  email: data.email || "",
                  firebaseAuthEmail: data.firebaseAuthEmail || (data.email && data.email.includes("@") ? data.email : `${data.mobile}@samitymanager.com`),
                  userId: d.id,
                  name: data.name || "",
                  password: data.password || "",
                  role: data.role || "member",
                  companyId: data.companyId || "",
                  companyWhatsapp: companyWhatsapp,
                  memberResetSetting: memberResetSetting,
                }, { merge: true });
              }
            }
          }
        } catch (err: any) {
          console.warn("Background phone mapping sync postponed/skipped due to permissions:", err.message);
        }
      }
    };
    syncPhoneMappings();
  }, [currentUser]);

  const handleNavigate = (view: string, params: any = null) => {
    if (currentUser) {
      const isActive = currentUser.status === "active";
      const isAdmin = currentUser.role === "admin";
      if (!isActive && !isAdmin && view !== "profile") {
        setNavigationParams(null);
        setCurrentView("profile");
        return;
      }
      if (currentUser.requirePasswordChange && view !== "profile") {
        setNavigationParams(null);
        setCurrentView("profile");
        return;
      }
    }
    setNavigationParams(params);
    setCurrentView(view as RouteView);
  };

  if (authStateLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-bold text-slate-400">লোডিং হচ্ছে...</p>
      </div>
    );
  }

  if (firebaseUser && !currentUser) {
    return <CompleteProfileView firebaseUser={firebaseUser} language={language} />;
  }

  if (!firebaseUser) {
    return <AuthView onSuccess={() => {}} language={language} setLanguage={setLanguage} />;
  }

  // Render correct view based on state
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 select-none transition-colors duration-200 flex flex-col">
      <GlobalHeader
        currentUser={currentUser}
        currentView={currentView}
        onNavigate={handleNavigate}
        language={language}
        setLanguage={setLanguage}
        theme={theme}
        setTheme={setTheme}
        isNavVisible={isNavVisible}
        showInstallBtn={true}
        onInstallApp={handleInstallApp}
        appName={appName}
      />
      <InstallGuideModal 
        isOpen={showInstallGuide} 
        onClose={() => setShowInstallGuide(false)} 
        appName={appName} 
      />
      {showInstallBanner && (
        <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/50 py-3 px-4 font-sans flex items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-sky-500/10 text-sky-600 dark:text-sky-400 rounded-2xl shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <span>{appName} অ্যাপ ইন্সটল করুন</span>
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                সহজে ও দ্রুত ব্যবহারের জন্য সরাসরি আপনার মোবাইলের হোম স্ক্রিনে যুক্ত করুন।
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleInstallApp}
              className="py-1.5 px-3 bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white text-[10px] font-black rounded-xl transition cursor-pointer flex items-center gap-1 shadow-sm"
            >
              <Download className="w-3 h-3" />
              <span>ইন্সটল করুন</span>
            </button>
            <button
              onClick={() => setShowInstallBanner(false)}
              className="p-2 hover:bg-sky-500/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition cursor-pointer"
              title="বন্ধ করুন"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <GlobalSlider currentUser={currentUser} language={language} />
      <AnimatePresence mode="wait">
        <motion.div
          key={currentView + (navigationParams?.id || "")}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {currentView === "dashboard" && (
            currentUser.role === "admin" ? (
              <AdminDashboardView currentUser={currentUser} onNavigate={handleNavigate} language={language} />
            ) : (
              <DashboardView currentUser={currentUser} onNavigate={handleNavigate} navigationParams={navigationParams} totalEntries={totalEntries} isNavVisible={isNavVisible} language={language} companyPlan={companyPlan} />
            )
          )}

          {currentView === "member-list" && (
            <MemberListView currentUser={currentUser} onNavigate={handleNavigate} />
          )}

          {currentView === "member-add" && (
            <MemberAddView currentUser={currentUser} onNavigate={handleNavigate} totalEntries={totalEntries} subscriptionLimits={subscriptionLimits} />
          )}

          {currentView === "profile" && (
            <ProfileView
              currentUser={currentUser}
              targetId={navigationParams?.id}
              onNavigate={handleNavigate}
              totalEntries={totalEntries}
              subscriptionLimits={subscriptionLimits}
            />
          )}

          {currentView === "arrears" && (
            <ArrearsView
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === "notifications" && (
            <NotificationsView
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === "transactions" && (
            <TransactionsView
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === "deposit-withdraw" && (
            <DepositWithdrawView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              navigationParams={navigationParams}
            />
          )}

          {currentView === "cashout" && (
            <CashOutView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              navigationParams={navigationParams}
            />
          )}

          {currentView === "subscription-requests" && (
            <SubscriptionRequestsView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              subscriptionLimits={subscriptionLimits}
            />
          )}

          {currentView === "settings" && (
            <SettingsView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              language={language}
              setLanguage={setLanguage}
              theme={theme}
              setTheme={setTheme}
              subscriptionLimits={subscriptionLimits}
            />
          )}

          {currentView === "activity" && (
            <ActivityView
              currentUser={currentUser}
              onNavigate={handleNavigate}
            />
          )}

          {currentView === "ad-management" && currentUser && (
            <AdManagementView
              currentUser={currentUser}
              onNavigate={handleNavigate}
              language={language}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Global Powered by NagorikeIT Footer */}
      <footer className={`w-full pt-3 mt-auto border-t border-slate-200/50 dark:border-slate-800/40 flex flex-col items-center justify-center gap-0.5 bg-slate-50/50 dark:bg-slate-950/20 backdrop-blur-sm ${
        currentUser && (currentUser.status === "active" || currentUser.role === "admin") ? "pb-20 md:pb-3" : "pb-3"
      }`}>
        <a 
          href="https://www.nagorike.com" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[11px] font-black tracking-wide text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-1"
        >
          <span>Powered by</span>
          <span className="text-slate-600 dark:text-slate-300 font-extrabold hover:underline">NagorikeIT</span>
        </a>
        <p className="text-[9px] text-slate-400/80 dark:text-slate-500/80">নাগরিক আইটি সেবা কর্তৃক সর্বস্বত্ব সংরক্ষিত</p>
      </footer>
    </div>
  );
}
