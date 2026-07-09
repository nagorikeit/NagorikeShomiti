import { useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot, collectionGroup, doc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { User } from "./types";
import AuthView from "./components/AuthView";
import DashboardView from "./components/DashboardView";
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
import { motion, AnimatePresence } from "motion/react";
import { Download, X, Smartphone, Sparkles } from "lucide-react";
import InstallGuideModal from "./components/InstallGuideModal";

type RouteView = "login" | "dashboard" | "member-list" | "member-add" | "profile" | "arrears" | "notifications" | "transactions" | "settings" | "activity" | "subscription-requests" | "deposit-withdraw";

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
  const [isNavVisible, setIsNavVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Hide on scroll down, show on scroll up
      if (currentScrollY > lastScrollY && currentScrollY > 60) {
        setIsNavVisible(false);
      } else {
        setIsNavVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

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
      console.error("Error loading subscription limits in App:", err);
    });
    return () => unsub();
  }, []);

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
  const [appName, setAppName] = useState("Remix: নগরীক সমিতি");

  useEffect(() => {
    if (!currentUser) {
      setAppName("Remix: নগরীক সমিতি");
      return;
    }

    if (currentUser.role === "admin") {
      setAppName("Remix: সুপার এডমিন");
      return;
    }

    if (currentUser.role === "company") {
      const name = currentUser.companyName || currentUser.name || "Remix: নগরীক সমিতি";
      setAppName(name);
      return;
    }

    if (currentUser.role === "member" && currentUser.companyId) {
      const companyRef = doc(db, "users", currentUser.companyId);
      const unsub = onSnapshot(companyRef, (snap) => {
        if (snap.exists()) {
          const companyData = snap.data();
          const name = companyData.companyName || companyData.name || "Remix: নগরীক সমিতি";
          setAppName(name);
        } else {
          setAppName("Remix: নগরীক সমিতি");
        }
      }, (err) => {
        console.error("Error listening to company name for manifest:", err);
        setAppName("Remix: নগরীক সমিতি");
      });
      return () => unsub();
    } else {
      setAppName("Remix: নগরীক সমিতি");
    }
  }, [currentUser]);

  // Handle dynamic manifest.json generation and browser title update
  useEffect(() => {
    // Update Document Title
    document.title = appName;

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
          src: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=192&h=192&q=80",
          sizes: "192x192",
          type: "image/jpeg",
          purpose: "any"
        },
        {
          src: "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?auto=format&fit=crop&w=512&h=512&q=80",
          sizes: "512x512",
          type: "image/jpeg",
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
  }, [appName]);

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
      const histCount = hList.filter((h) => companyMemberIds.has(h.userDocId)).length;

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
      unsubAllHistory = onSnapshot(collectionGroup(db, "history"), (snap) => {
        latestHistories = [];
        snap.forEach((d) => {
          const parentUserDocId = d.ref.parent?.parent?.id || "";
          latestHistories.push({ docId: d.id, userDocId: parentUserDocId });
        });
        computeTotal(usersList, projectsList, installmentsCount, latestLedgerCount, latestHistories);
      });
    }

    return () => {
      unsubUsers();
      unsubProjects();
      unsubInstallments();
      unsubAccounts();
      unsubAllHistory();
    };
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

  if (!firebaseUser || !currentUser) {
    return <AuthView onSuccess={() => {}} language={language} setLanguage={setLanguage} />;
  }

  // Render correct view based on state
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 select-none pb-20 md:pb-0 transition-colors duration-200">
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
                <span className="inline-flex items-center gap-0.5 text-[8px] bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Chrome App</span>
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
            <DashboardView currentUser={currentUser} onNavigate={handleNavigate} navigationParams={navigationParams} totalEntries={totalEntries} isNavVisible={isNavVisible} language={language} companyPlan={companyPlan} />
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
