import * as React from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove, 
  deleteDoc,
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  ChevronRight, 
  User as UserIcon, 
  FileText, 
  LayoutDashboard, 
  Zap, 
  MessageSquare, 
  Plus, 
  LogOut,
  TrendingUp,
  AlertCircle,
  Activity,
  CheckCircle2,
  Lock,
  Menu,
  X,
  Loader2,
  ChevronDown,
  Check,
  Send,
  Calculator,
  WifiOff,
  Trash2,
  ClipboardList
} from 'lucide-react';
import { auth, googleProvider, db } from './lib/firebase';
import { cn } from './lib/utils';
import { UserProfile, TaxDocument, OptimizationStep, TaxDeductions, TaxCalculationResult, TaxAnalysisResult } from './types';
import { analyzeTaxDocuments } from './lib/gemini';
import Assistant from './components/Assistant';
import { calculateTax } from './lib/taxCalculations';
import { generateTaxStrategy } from './lib/strategyEngine';
import { TAX_RULES, updateTaxRules } from './config/taxRules';
import { PrivacyPolicyScreen, TermsScreen } from './components/LegalScreens';
import WealthTips from './components/WealthTips';
import ConfirmationModal from './components/ConfirmationModal';
import FilingGuide from './components/FilingGuide';
import SummaryView from './components/SummaryView';
import ReadinessScore from './components/ReadinessScore';
import TaxCalculator from './components/TaxCalculator';
import { NavLink, SectionHeader } from './components/Common';

import { useStore } from './store/useStore';

export default function App() {
  const { 
    user, setUser, 
    profile, setProfile, 
    loading, setLoading,
    appError, setAppError,
    isOnline, setIsOnline,
    currentView, setCurrentView,
    mobileMenuOpen, setMobileMenuOpen,
    isAssistantOpen, setIsAssistantOpen,
    discovery, setDiscovery,
    activeDocumentId, setActiveDocumentId,
    documents, setDocuments,
    hasConsented, setHasConsented
  } = useStore();

  const docsUnsubscribeRef = React.useRef<(() => void) | null>(null);
  
  React.useEffect(() => {
    let timeoutId: any;
    let isMounted = true;

    const initializeProtocol = async () => {
      // 1. Fetch Strategic Configuration
      try {
        const res = await fetch('/api/config').catch(() => null);
        if (res && res.ok && isMounted) {
          const data = await res.json();
          updateTaxRules(data);
          console.log("Strategic config synchronized:", data.lastUpdated);
        }
      } catch (err) {
        console.warn("Configuration sync delayed. Using base rules.", err);
      }

      // 2. Setup Auth Listener
      const unsubscribe = onAuthStateChanged(auth, async (u) => {
        if (!isMounted) return;
        try {
          setUser(u);
          if (u) {
            const userDocRef = doc(db, 'users', u.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const data = userDoc.data() as UserProfile;
              setProfile(data);
              if (data.lastAnalysis) setDiscovery(data.lastAnalysis);
              setCurrentView(data.onboardingComplete ? 'dashboard' : 'onboarding');
            } else {
              // Initialize empty profile
              const newProfile: UserProfile = {
                uid: u.uid,
                email: u.email || '',
                displayName: u.displayName || u.email?.split('@')[0] || 'Tax Optimizer',
                onboardingComplete: false,
                goals: [],
                taxScore: 0,
                completedStepIds: []
              };
              await setDoc(userDocRef, newProfile);
              setProfile(newProfile);
              setCurrentView('onboarding');
            }

            // Listen to documents
            if (docsUnsubscribeRef.current) docsUnsubscribeRef.current();

            const docsQuery = query(
              collection(db, 'users', u.uid, 'documents'),
              orderBy('createdAt', 'desc')
            );
            docsUnsubscribeRef.current = onSnapshot(docsQuery, (snapshot) => {
              if (isMounted) {
                const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as TaxDocument));
                setDocuments(docs);
              }
            }, (err) => {
              if (err.message.includes('permission-denied')) {
                console.warn('[VAULT_SECURITY]: Login required or access denied.');
                setAppError("Login required or access denied");
              } else {
                console.error("Documents sync error:", err);
              }
            });
          } else {
            setProfile(null);
            setCurrentView('landing');
            if (docsUnsubscribeRef.current) {
              docsUnsubscribeRef.current();
              docsUnsubscribeRef.current = null;
            }
          }
        } catch (err) {
          console.error("Auth initialization error:", err);
          setAppError("System initialization failed. Our security protocols or network connection might be unstable.");
        } finally {
          if (isMounted) {
            setLoading(false);
            if (timeoutId) clearTimeout(timeoutId);
          }
        }
      });

      return unsubscribe;
    };

    // Global load timeout
    timeoutId = setTimeout(() => {
      if (loading && isMounted) {
        setAppError("The protocol is taking longer than expected to synchronize. Please verify your connection.");
        setLoading(false);
      }
    }, 15000);

    const authUnsubscribePromise = initializeProtocol();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      authUnsubscribePromise.then(unsub => unsub && unsub());
      if (docsUnsubscribeRef.current) {
        docsUnsubscribeRef.current();
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  const handleLogin = async () => {
    if (!hasConsented) return;
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleConsent = (consented: boolean) => {
    setHasConsented(consented);
  };

  const handleToggleFilingStep = async (stepId: string) => {
    const u = auth.currentUser;
    if (!u || !profile) {
       setAppError("Login required or access denied");
       return;
    }

    const currentSteps = profile.completedFilingStepIds || [];
    const isDone = currentSteps.includes(stepId);
    const updated = isDone 
      ? currentSteps.filter(id => id !== stepId)
      : [...currentSteps, stepId];
    
    setProfile({ ...profile, completedFilingStepIds: updated });
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        completedFilingStepIds: updated
      });
    } catch (err: any) {
      if (err.message?.includes('permission-denied')) {
        setAppError("Login required or access denied");
      }
    }
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    const u = auth.currentUser;
    if (!u || !profile) {
      console.error("[SECURITY]: Profile update attempt without verified auth.");
      setAppError("Login required or access denied");
      return;
    }
    
    try {
      const updated = { ...profile, ...updates };
      setProfile(updated);
      await updateDoc(doc(db, 'users', u.uid), updates as any);
    } catch (err: any) {
      if (err.message?.includes('permission-denied')) {
        setAppError("Login required or access denied");
      }
      throw err;
    }
  };

  const handleDiscovery = async (result: TaxAnalysisResult) => {
    setDiscovery(result);
    // Persist to global profile as well
    if (profile) {
      await handleUpdateProfile({ lastAnalysis: result });
    }
  };

  const handleDocumentSelect = (doc: TaxDocument) => {
    if (doc.analysis) {
      setDiscovery(doc.analysis);
      setActiveDocumentId(doc.id);
      setCurrentView('summary');
    }
  };

  const handleUpdateAnalysis = async (updatedAnalysis: TaxAnalysisResult) => {
    const u = auth.currentUser;
    if (!u) {
      setAppError("Login required or access denied");
      return;
    }

    setDiscovery(updatedAnalysis);
    if (activeDocumentId) {
      try {
        await updateDoc(doc(db, 'users', u.uid, 'documents', activeDocumentId), {
          analysis: updatedAnalysis
        });
      } catch (err: any) {
        if (err.message?.includes('permission-denied')) {
          setAppError("Login required or access denied");
        }
      }
    }
    // Also update profile for consistency
    if (profile) {
      await handleUpdateProfile({ lastAnalysis: updatedAnalysis });
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const handleDeleteAllData = async () => {
    const u = auth.currentUser;
    if (!u || !profile) return;
    try {
      await deleteDoc(doc(db, 'users', u.uid));
      setHasConsented(false);
      setProfile(null);
      setDiscovery(null);
      await signOut(auth);
      setCurrentView('landing');
    } catch (error: any) {
      console.error("Data deletion failed:", error);
      if (error.message?.includes('permission-denied')) {
        setAppError("Login required or access denied");
      }
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-apple-black overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-teal/5 blur-[150px] rounded-full animate-pulse" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal/5 blur-[150px] rounded-full animate-pulse [animation-delay:1s]" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex flex-col items-center"
        >
          <div className="relative mb-12">
            <div className="w-20 h-20 bg-teal/10 rounded-3xl flex items-center justify-center text-teal shadow-[0_0_40px_rgba(45,212,191,0.2)] border border-teal/20 relative z-10">
              <Activity className="w-10 h-10 animate-pulse" />
            </div>
            <div className="absolute -inset-4 border-2 border-teal/5 rounded-[40px] animate-spin [animation-duration:10s]" />
          </div>
          <h2 className="text-white text-xl font-bold tracking-tight mb-3">TaxBreaker</h2>
          <div className="flex items-center gap-3">
             <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div 
                    key={i}
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ repeat: Infinity, duration: 1.5, delay: i * 0.2 }}
                    className="w-1 h-1 bg-teal rounded-full"
                  />
                ))}
             </div>
             <p className="text-apple-text-tertiary text-[10px] uppercase tracking-[0.3em] font-bold">Synchronizing Protocols</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (appError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-apple-black p-8 text-center">
        <div className="w-20 h-20 bg-apple-error/10 rounded-full flex items-center justify-center mb-10 border border-apple-error/20">
          <Activity className="w-10 h-10 text-apple-error" />
        </div>
        <h1 className="text-title font-bold text-white mb-4">System Disruption</h1>
        <p className="text-body text-apple-text-tertiary max-w-sm mb-12">
          {appError}
        </p>
        <button 
          onClick={() => window.location.reload()}
          className="premium-btn-primary"
        >
          Re-initialize System
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-apple-black text-white font-sans overflow-x-hidden flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      {user && profile?.onboardingComplete && (
        <aside className="hidden md:flex w-80 h-screen sticky top-0 flex-col bg-apple-secondary border-r border-white/5 z-50">
          <div className="p-10">
            <div 
              className="flex items-center gap-4 cursor-pointer group"
              onClick={() => setCurrentView('dashboard')}
            >
              <div className="w-8 h-8 border border-teal/40 flex items-center justify-center rotate-45 group-hover:rotate-90 transition-transform duration-700">
                <Shield className="w-4 h-4 text-teal -rotate-45 group-hover:-rotate-90 transition-transform duration-700" strokeWidth={1.5} />
              </div>
              <span className="text-caption font-bold uppercase tracking-[0.4em]">TaxBreaker</span>
            </div>
          </div>

          <nav className="flex-1 px-6 space-y-2 mt-8">
            <SidebarLink icon={<LayoutDashboard size={20} />} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')}>Concierge</SidebarLink>
            <SidebarLink icon={<FileText size={20} />} active={currentView === 'vault'} onClick={() => setCurrentView('vault')}>Vault</SidebarLink>
            <SidebarLink icon={<Calculator size={20} />} active={currentView === 'simulator'} onClick={() => setCurrentView('simulator')}>Simulator</SidebarLink>
            <SidebarLink icon={<ClipboardList size={20} />} active={currentView === 'guide'} onClick={() => setCurrentView('guide')}>Guide</SidebarLink>
            <SidebarLink icon={<UserIcon size={20} />} active={currentView === 'profile'} onClick={() => setCurrentView('profile')}>Profile</SidebarLink>
          </nav>

          <div className="p-8 border-t border-white/5">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-apple-card border border-white/5 flex items-center justify-center text-teal/40">
                <UserIcon size={22} strokeWidth={1.5} />
              </div>
              <div className="flex flex-col">
                <span className="text-caption font-bold uppercase tracking-widest truncate max-w-[140px] text-white">
                  {profile?.displayName?.split(' ')[0] || 'User'}
                </span>
                <span className="text-[10px] text-apple-text-tertiary uppercase font-bold tracking-widest mt-0.5">Premium Strategist</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full h-12 rounded-xl border border-white/5 text-apple-text-tertiary text-caption font-bold uppercase tracking-widest hover:text-apple-error hover:border-apple-error/20 transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </aside>
      )}

      {/* Mobile Header */}
      {user && profile?.onboardingComplete && (
        <header className="md:hidden fixed top-0 w-full h-20 bg-apple-black/80 backdrop-blur-2xl border-b border-white/5 z-50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-teal" />
            <span className="text-[11px] font-bold uppercase tracking-[0.3em]">TaxBreaker</span>
          </div>
          <button onClick={() => setCurrentView('profile')} className="w-10 h-10 rounded-full bg-apple-card border border-white/5 flex items-center justify-center">
            <UserIcon size={18} className="text-teal/40" />
          </button>
        </header>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        <main className={cn(
          "flex-1 md:pb-12",
          user && profile?.onboardingComplete ? "pt-20 md:pt-0" : "pt-0",
          user && profile?.onboardingComplete && "pb-24 md:pb-12"
        )}>
          <AnimatePresence mode="wait">
            {currentView === 'landing' && (
              <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LandingView 
                  onStart={handleLogin} 
                  hasConsented={hasConsented} 
                  onConsent={handleConsent}
                  onOpenTerms={() => setCurrentView('terms')}
                  onOpenPrivacy={() => setCurrentView('privacy')}
                />
              </motion.div>
            )}
            {currentView === 'privacy' && (
              <motion.div key="privacy" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <PrivacyPolicyScreen onBack={() => setCurrentView(user ? 'profile' : 'landing')} />
              </motion.div>
            )}
            {currentView === 'terms' && (
              <motion.div key="terms" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}>
                <TermsScreen onBack={() => setCurrentView(user ? 'profile' : 'landing')} />
              </motion.div>
            )}
            {currentView === 'onboarding' && profile && (
              <motion.div key="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <OnboardingView 
                  profile={profile} 
                  onComplete={(updated) => {
                    setProfile(updated);
                    setCurrentView('dashboard');
                  }} 
                />
              </motion.div>
            )}
            {currentView === 'dashboard' && profile && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DashboardView 
                  profile={profile} 
                  discovery={discovery} 
                  isOnline={isOnline} 
                  onOpenSummary={() => setCurrentView('summary')}
                  onOpenGuide={() => setCurrentView('guide')}
                  onUpdateProfile={handleUpdateProfile}
                />
              </motion.div>
            )}
            {currentView === 'vault' && profile && (
              <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VaultView 
                  userId={profile.uid} 
                  documents={documents}
                  onDiscover={handleDiscovery} 
                  onSelect={handleDocumentSelect}
                  isOnline={isOnline} 
                />
              </motion.div>
            )}
            {currentView === 'simulator' && profile && (
              <motion.div key="simulator" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TaxCalculator profile={profile} discovery={discovery?.extractedValues || null} />
              </motion.div>
            )}
            {currentView === 'guide' && profile && (
              <motion.div key="guide" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FilingGuide 
                  completedIds={profile.completedFilingStepIds || []} 
                  onToggle={handleToggleFilingStep} 
                />
              </motion.div>
            )}
            {currentView === 'profile' && profile && (
              <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ProfileView 
                  profile={profile} 
                  onLogout={handleLogout} 
                  onDeleteData={handleDeleteAllData}
                  onOpenPrivacy={() => setCurrentView('privacy')}
                  onOpenTerms={() => setCurrentView('terms')}
                />
              </motion.div>
            )}
            {currentView === 'summary' && profile && (
              <motion.div key="summary" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SummaryView 
                  profile={profile} 
                  analysis={discovery} 
                  onBack={() => setCurrentView('dashboard')} 
                  onUpdateAnalysis={handleUpdateAnalysis}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      {user && profile?.onboardingComplete && (
        <nav className="md:hidden fixed bottom-10 left-6 right-6 h-18 bg-apple-card/90 backdrop-blur-3xl border border-white/5 rounded-3xl z-50 flex items-center justify-around px-2 shadow-2xl">
          <MobileNavLink icon={<LayoutDashboard size={20} />} active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
          <MobileNavLink icon={<FileText size={20} />} active={currentView === 'vault'} onClick={() => setCurrentView('vault')} />
          <div className="relative -top-4">
             <button 
               onClick={() => setIsAssistantOpen(true)}
               className="w-16 h-16 rounded-full bg-teal shadow-2xl shadow-teal/20 flex items-center justify-center text-black"
             >
               <MessageSquare size={24} />
             </button>
          </div>
          <MobileNavLink icon={<Calculator size={20} />} active={currentView === 'simulator'} onClick={() => setCurrentView('simulator')} />
          <MobileNavLink icon={<ClipboardList size={20} />} active={currentView === 'guide'} onClick={() => setCurrentView('guide')} />
        </nav>
      )}

      {/* Assistant Overlay Portal */}
      {user && profile?.onboardingComplete && (
        <AnimatePresence>
          {isAssistantOpen && profile && (
            <Assistant 
              profile={profile} 
              discovery={discovery} 
              onClose={() => setIsAssistantOpen(false)} 
              isOnline={isOnline} 
            />
          )}
        </AnimatePresence>
      )}

      {/* Desktop Assistant Trigger */}
      {user && profile?.onboardingComplete && !isAssistantOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsAssistantOpen(true)}
          className="hidden md:flex fixed bottom-12 right-12 w-16 h-16 bg-teal rounded-3xl shadow-2xl shadow-teal/20 items-center justify-center text-black z-40 cursor-pointer"
          whileHover={{ scale: 1.1, borderRadius: "20px" }}
          whileTap={{ scale: 0.9 }}
        >
          <MessageSquare strokeWidth={2.5} size={24} />
        </motion.button>
      )}
    </div>
  );
}

function SidebarLink({ children, icon, active, onClick }: { children: React.ReactNode, icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full h-14 flex items-center gap-4 px-4 rounded-xl transition-all duration-300",
        active ? "bg-teal/10 text-teal border-l-4 border-teal" : "text-apple-text-tertiary hover:bg-white/5 hover:text-white"
      )}
    >
      {icon}
      <span className="text-subtext font-bold uppercase tracking-widest">{children}</span>
    </button>
  );
}

function MobileNavLink({ icon, active, onClick }: { icon: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300",
        active ? "text-teal" : "text-apple-text-tertiary"
      )}
    >
      {icon}
    </button>
  );
}


function LandingView({ 
  onStart, 
  hasConsented, 
  onConsent, 
  onOpenTerms, 
  onOpenPrivacy 
}: { 
  onStart: () => Promise<void>, 
  hasConsented: boolean,
  onConsent: (v: boolean) => void,
  onOpenTerms: () => void,
  onOpenPrivacy: () => void
}) {
  return (
    <div className="max-w-7xl mx-auto px-8 py-32 flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="text-caption font-bold uppercase tracking-widest border border-white/10 px-6 py-2 rounded-full mb-8 text-apple-text-secondary"
      >
        <span className="text-teal mr-2">✦</span>
        Establish your digital tax vault
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="text-large-title md:text-[120px] font-bold tracking-tight mb-12 leading-[1.1]"
      >
        The Future <br />
        <span className="text-apple-text-tertiary">of Wealth</span>
      </motion.h1>

      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.4 }}
        className="text-body md:text-headline text-apple-text-secondary max-w-xl mb-16 font-light leading-relaxed"
      >
        A private concierge for world-class tax optimization. 
        Engineered for those who value absolute precision and 
        discretion in financial compliance.
      </motion.p>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex flex-col items-center gap-10 mb-24"
      >
        <div className="flex flex-col gap-6">
          <button 
            onClick={onStart} 
            disabled={!hasConsented}
            className="premium-btn-primary text-headline px-16 h-16 flex items-center justify-center gap-3 disabled:opacity-20 disabled:cursor-not-allowed group transition-all"
          >
            Authenticate <Shield className={cn("w-5 h-5 transition-transform", hasConsented && "group-hover:scale-110")} />
          </button>
          
          <div className="flex items-center gap-3 px-4">
            <input 
              type="checkbox" 
              id="consent" 
              checked={hasConsented}
              onChange={(e) => onConsent(e.target.checked)}
              className="w-5 h-5 accent-teal cursor-pointer"
            />
            <label htmlFor="consent" className="text-caption text-apple-text-tertiary font-medium cursor-pointer">
              I agree to the 
              <button onClick={onOpenTerms} className="text-teal hover:underline mx-1">Terms of Use</button> 
              & 
              <button onClick={onOpenPrivacy} className="text-teal hover:underline ml-1">Privacy Policy</button>
            </label>
          </div>
          <p className="text-[10px] text-apple-text-tertiary uppercase tracking-widest font-bold mt-4">
            <Shield className="w-3 h-3 inline-block mr-2 text-teal align-middle" /> 
            Zero-Data Architecture: Your financials remain in your control. Never shared.
          </p>
        </div>

        <button className="premium-btn-secondary text-body px-12 h-16 border border-white/5">
          View Compliance Rules
        </button>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full"
      >
        <StatCard label="Hallucination Risk" value="<0.1%" sub="Verified references" />
        <StatCard label="Avg. Savings" value="$2.4k" sub="Per user strategy" />
        <StatCard label="Audit Protection" value="100%" sub="Rule-based validation" />
      </motion.div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string, value: string, sub: string }) {
  return (
    <div className="apple-card text-left group hover:bg-apple-elevated transition-colors duration-300">
      <p className="text-caption font-bold uppercase tracking-widest text-apple-text-tertiary mb-2">{label}</p>
      <p className="text-title font-bold text-teal mb-1">{value}</p>
      <p className="text-subtext text-apple-text-secondary">{sub}</p>
    </div>
  );
}

function OnboardingView({ profile, onComplete }: { profile: UserProfile, onComplete: (u: UserProfile) => void }) {
  const { setProfile, setCurrentView } = useStore();
  const [step, setStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    country: 'India',
    employmentType: '',
    income: 0,
    assets: '',
    goals: [] as string[],
    taxRegime: 'new' as 'old' | 'new'
  });

  const countries = ['India', 'USA', 'UK', 'Canada', 'Australia'];
  const jobTypes = ['Salaried', 'Self-Employed', 'Business Owner', 'Professional'];

  const handleFinish = async () => {
    const updated: UserProfile = {
      ...profile,
      ...formData,
      onboardingComplete: true
    };
    await updateDoc(doc(db, 'users', profile.uid), updated as any);
    setProfile(updated);
    setCurrentView('dashboard');
    onComplete(updated);
  };

  return (
    <div className="max-w-xl mx-auto px-8 py-32 min-h-[80vh] flex flex-col justify-center">
      <div className="mb-20">
         <div className="flex gap-3 mb-10">
            {[1, 2, 3].map(s => (
               <div key={s} className={cn(
                 "h-1.5 transition-all duration-700 rounded-full",
                 step >= s ? "w-16 bg-teal" : "w-8 bg-white/5"
               )} />
            ))}
         </div>
         <span className="small-caps mb-4 block text-teal/60">Initialization Sequence</span>
         <h1 className="text-title md:text-large-title font-bold tracking-tight text-white leading-tight">Configure your <br/>intelligence profile.</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
            <div className="space-y-6">
              <label className="text-caption font-bold uppercase tracking-widest text-apple-text-tertiary">Jurisdiction</label>
              <div className="grid grid-cols-2 gap-4">
                {countries.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormData({ ...formData, country: c })}
                    className={cn(
                      "h-14 rounded-xl border transition-all text-caption font-bold uppercase tracking-widest",
                      formData.country === c ? "border-teal bg-teal/10 text-teal" : "border-white/5 bg-apple-card text-apple-text-tertiary hover:border-white/20"
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => setStep(2)} className="premium-btn-primary w-full shadow-2xl shadow-teal/20">Continue Process</button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
             <div className="space-y-6">
              <label className="text-caption font-bold uppercase tracking-widest text-apple-text-tertiary">Engagement Model</label>
              <div className="grid grid-cols-2 gap-4">
                {jobTypes.map(t => (
                  <button
                    key={t}
                    onClick={() => setFormData({ ...formData, employmentType: t })}
                    className={cn(
                      "h-14 rounded-xl border transition-all text-caption font-bold uppercase tracking-widest",
                      formData.employmentType === t ? "border-teal bg-teal/10 text-teal" : "border-white/5 bg-apple-card text-apple-text-tertiary hover:border-white/20"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <label className="text-caption font-bold uppercase tracking-widest text-apple-text-tertiary">Annual Yield (Gross)</label>
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-teal font-bold text-headline">₹</span>
                <input 
                  type="number"
                  value={formData.income || ''}
                  onChange={(e) => setFormData({ ...formData, income: Number(e.target.value) })}
                  placeholder="0.00"
                  className="w-full h-16 bg-apple-card border border-white/5 rounded-xl px-6 pl-12 text-headline focus:border-teal outline-none transition-all placeholder:text-white/10 font-bold"
                />
              </div>
            </div>
            <button onClick={() => setStep(3)} disabled={!formData.employmentType || !formData.income} className="premium-btn-primary w-full shadow-2xl shadow-teal/20">Finalize Parameters</button>
            <button onClick={() => setStep(1)} className="w-full text-caption text-apple-text-tertiary font-bold uppercase tracking-widest hover:text-white transition-colors">Return to Step 1</button>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-12"
          >
            <div className="p-8 bg-teal/5 border border-teal/10 rounded-2xl">
               <Zap className="w-8 h-8 text-teal mb-6" />
               <p className="text-headline font-bold mb-4 text-white">Security Protocol Initialized</p>
               <p className="text-body text-apple-text-tertiary leading-relaxed">
                 By finalizing your profile, you establish a private local vault. All strategic calculations are performed within this secure environment.
               </p>
            </div>
            <div className="flex flex-col gap-6">
              <button onClick={handleFinish} className="premium-btn-primary w-full shadow-2xl shadow-teal/20">Enter Sanctuary</button>
              <button onClick={() => setStep(2)} className="text-caption text-apple-text-tertiary font-bold uppercase tracking-widest hover:text-white transition-colors">Return to Step 2</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashboardView({ 
  profile, 
  discovery: fullDiscovery, 
  isOnline,
  onOpenSummary,
  onOpenGuide,
  onUpdateProfile
}: { 
  profile: UserProfile, 
  discovery: TaxAnalysisResult | null, 
  isOnline: boolean,
  onOpenSummary: () => void,
  onOpenGuide: () => void,
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<void>
}) {
  const discoveryValues = fullDiscovery?.extractedValues;
  const deductions = profile.deductions || {};

  // Merge discovery and manually entered profile deductions
  // Manual entries in profile.deductions take precedence
  const deductionsData = {
    section80C: deductions.section80C ?? discoveryValues?.section80C ?? 0,
    section80D: deductions.section80D ?? discoveryValues?.section80D ?? 0,
    section80CCD1B: deductions.section80CCD1B ?? discoveryValues?.nps ?? 0,
    section24: deductions.section24 ?? discoveryValues?.section24 ?? 0,
    hra: deductions.hra ?? discoveryValues?.hra ?? 0,
  };

  // Logic for dynamic alerts
  const show80CWarning = deductionsData.section80C < 150000;
  const showTDSWarning = (discoveryValues?.tds || 0) > 0;
  
  const remaining80C = Math.max(0, 150000 - deductionsData.section80C);

  // Dynamic advice
  const oldResult = calculateTax(profile.income || 0, 'old', deductionsData);
  const newResult = calculateTax(profile.income || 0, 'new', deductionsData);
  const savings = Math.round(Math.abs(oldResult.totalTax - newResult.totalTax));
  const betterRegime = oldResult.totalTax < newResult.totalTax ? "Old" : "New";
  const worseRegime = betterRegime === "Old" ? "New" : "Old";
  const sectionCode = betterRegime === "New" ? "§115BAC" : "Traditional";

  const handleDeductionChange = (field: keyof TaxDeductions, value: number) => {
    onUpdateProfile({
      deductions: {
        ...deductions,
        [field]: value
      }
    });
  };

  // Readiness checklist logic
  const completedSteps = profile.completedFilingStepIds || [];

  return (
    <div className="max-w-7xl mx-auto px-8 py-16">
      {/* Privacy Badge */}
      <div className="flex justify-end mb-8">
        <div className="flex items-center gap-3 px-4 py-2 bg-apple-success/5 border border-apple-success/20 rounded-full">
           <Shield className="w-3.5 h-3.5 text-apple-success" />
           <span className="text-[10px] font-bold text-apple-success uppercase tracking-widest">End-to-End Privacy Active</span>
        </div>
      </div>

      {/* Compliance Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-10 bg-apple-warning/5 border border-apple-warning/20 p-6 rounded-2xl flex items-center gap-4"
          >
            <WifiOff className="w-5 h-5 text-apple-warning" />
            <p className="text-subtext text-apple-warning font-medium">
              You are currently in Local Mode. Strategy and Advisor sync is paused.
            </p>
          </motion.div>
        )}
        {discoveryValues && (show80CWarning || showTDSWarning) && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-20 bg-apple-warning/10 border border-apple-warning/20 p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8"
          >
            <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-apple-warning/20 rounded-full flex items-center justify-center text-apple-warning">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-body font-bold text-white">Compliance Action Required</h3>
                <p className="text-apple-text-tertiary text-subtext">
                  {show80CWarning 
                    ? `You have ₹${remaining80C.toLocaleString('en-IN')} remaining in your 80C threshold.`
                    : `TDS of ₹${discoveryValues?.tds?.toLocaleString('en-IN')} detected. Prepare for July 31 filing.`}
                </p>
              </div>
            </div>
            <button className="h-12 px-8 bg-white text-black rounded-xl font-bold hover:shadow-xl transition-all">
              Optimize Now
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 mb-20">
        <div>
          <span className="small-caps mb-4 block">Portfolio Overview</span>
          <h1 className="text-title md:text-large-title font-bold tracking-tight">
            Welcome, <span className="text-teal">{profile.displayName?.split(' ')[0] || 'Strategist'}</span>
          </h1>
        </div>
        <div className="flex gap-8 items-center">
          <div className="w-12 h-12 rounded-full border border-white/5 bg-apple-card flex items-center justify-center">
             <Shield className="w-5 h-5 text-teal/60" />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-8 space-y-20">
          <div>
            <SectionHeader title="Priority Intelligence" icon={<Zap className="w-4 h-4" />} />
            <motion.div 
              whileHover={{ scale: 1.01 }}
              className="apple-card overflow-hidden"
            >
              <div className="p-8 md:p-12">
                 <div className="flex justify-between items-start mb-8">
                   <div className="space-y-4">
                     <span className="text-teal/60 text-caption font-bold uppercase tracking-widest">Immediate Optimization</span>
                     <h3 className="text-headline font-bold">Tax Regime Optimization</h3>
                   </div>
                   <span className="text-caption font-bold px-4 py-1.5 bg-teal/10 border border-teal/30 rounded-full text-teal">High Impact</span>
                 </div>
                 <p className="text-apple-text-secondary mb-12 text-body leading-relaxed max-w-2xl">
                   Based on your {profile.employmentType} structure, opting for the {betterRegime} Regime {betterRegime === 'New' ? '(Section 115BAC)' : ''} could realize a ₹{savings.toLocaleString('en-IN')} tax reduction compared to the {worseRegime} Regime.
                 </p>
                 <div className="flex flex-col md:flex-row items-center gap-8 pt-8 border-t border-white/5">
                   <button onClick={onOpenSummary} className="premium-btn-primary">Generate Final Summary</button>
                   <span className="text-caption font-mono text-apple-text-tertiary truncate">REF: Income Tax Act {sectionCode}</span>
                 </div>
              </div>
            </motion.div>
          </div>

          <WealthTips profile={profile} discovery={fullDiscovery} />

          <div>
            <SectionHeader title="Strategic Deduction Control" icon={<TrendingUp className="w-4 h-4" />} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <DashboardField 
                label="Section 80C" 
                value={deductionsData.section80C} 
                onChange={(v) => handleDeductionChange('section80C', v)}
                max={150000}
                description="PPF, ELSS, Insurance..."
              />
              <DashboardField 
                label="Section 80D" 
                value={deductionsData.section80D} 
                onChange={(v) => handleDeductionChange('section80D', v)}
                description="Health Insurance..."
              />
              <DashboardField 
                label="NPS (80CCD)" 
                value={deductionsData.section80CCD1B} 
                onChange={(v) => handleDeductionChange('section80CCD1B', v)}
                max={50000}
                description="Voluntary Pension..."
              />
            </div>
          </div>

          <div>
            <SectionHeader title="Strategic Timeline" icon={<TrendingUp className="w-4 h-4" />} />
            <div className="apple-card p-0 divide-y divide-white/5">
              <TimelineItem 
                date="MAR 31" 
                title="Investment Deadline" 
                status={discoveryValues ? (show80CWarning ? "warning" : "success") : "pending"} 
                sub={discoveryValues ? (show80CWarning ? `₹${remaining80C.toLocaleString('en-IN')} headroom available` : "80C Threshold Maximized") : "Awaiting document analysis"} 
              />
              <TimelineItem 
                date="JUL 31" 
                title="ITR Filing Deadline" 
                status={discoveryValues ? (showTDSWarning ? "pending" : "success") : "pending"} 
                sub={discoveryValues ? (showTDSWarning ? `Filing ready for ₹${discoveryValues?.tds?.toLocaleString('en-IN')} TDS` : "Profile optimized for filing") : "Synchronize Vault to track"} 
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-16">
          <ReadinessScore 
            completedStepIds={completedSteps} 
            onOpenGuide={onOpenGuide} 
          />

          <div className="space-y-6">
            <SectionHeader title="Recent Assets" icon={<FileText className="w-4 h-4" />} />
            <div className="apple-card border-dashed border-white/10 text-center bg-transparent">
               <p className="text-apple-text-tertiary text-subtext mb-6">Secure vault is current.</p>
               <button className="text-teal text-caption font-bold uppercase tracking-widest hover:tracking-widest transition-all">
                  Access Vault
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardField({ 
  label, 
  value, 
  onChange, 
  max, 
  description 
}: { 
  label: string, 
  value: number, 
  onChange: (v: number) => void,
  max?: number,
  description: string
}) {
  return (
    <div className="apple-card p-6 space-y-4 hover:border-teal/20 transition-all">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-apple-text-tertiary uppercase tracking-widest">{label}</label>
        {max && <span className="text-[9px] font-mono text-teal/60">Limit: ₹{max/1000}k</span>}
      </div>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-teal font-bold text-body">₹</span>
        <input 
          type="number" 
          value={value || ''} 
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val < 0) onChange(0);
            else if (max && val > max) onChange(max);
            else onChange(val);
          }}
          className="w-full bg-apple-elevated border border-white/5 h-12 rounded-xl pl-10 pr-4 outline-none text-body font-bold focus:border-teal/30 transition-all"
        />
      </div>
      <p className="text-[9px] text-apple-text-tertiary italic">{description}</p>
    </div>
  );
}

function TimelineItem({ date, title, status, sub }: { date: string, title: string, status: 'pending' | 'success' | 'warning', sub: string }) {
  return (
    <div className="p-8 flex items-center gap-8 group hover:bg-apple-elevated transition-colors duration-200">
      <div className="text-center w-12 shrink-0">
        <p className="text-caption font-bold text-apple-text-tertiary">{date.split(' ')[0]}</p>
        <p className="text-headline font-bold text-teal">{date.split(' ')[1]}</p>
      </div>
      <div className="flex-1">
        <p className="text-body font-bold text-white mb-1 leading-tight">{title}</p>
        <p className="text-subtext text-apple-text-tertiary leading-tight">{sub}</p>
      </div>
      <div className={cn(
        "w-2.5 h-2.5 rounded-full",
        status === 'pending' ? 'bg-blue-500' : status === 'warning' ? 'bg-apple-warning' : 'bg-apple-success'
      )} />
    </div>
  );
}

function VaultView({ 
  userId, 
  documents,
  onDiscover, 
  onSelect,
  isOnline 
}: { 
  userId: string, 
  documents: TaxDocument[],
  onDiscover: (result: TaxAnalysisResult) => void, 
  onSelect: (doc: TaxDocument) => void,
  isOnline: boolean 
}) {
  const [analyzing, setAnalyzing] = React.useState(false);
  const [result, setResult] = React.useState<TaxAnalysisResult | null>(null);
  const [stagedFile, setStagedFile] = React.useState<File | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = React.useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = React.useState(false);
  const [permissionDeniedMessage, setPermissionDeniedMessage] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleRequestPermission = () => {
    setShowPermissionModal(true);
  };

  const handleContinueToUpload = () => {
    setShowPermissionModal(false);
    setPermissionDeniedMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setPermissionDeniedMessage("Selection cancelled.");
      return;
    }

    const validTypes = ['text/plain', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!validTypes.includes(file.type)) {
      setPermissionDeniedMessage("Unsupported file type. Please upload PDF, DOCX, or TXT documents.");
      return;
    }

    setStagedFile(file);
    setPermissionDeniedMessage(null);
    setAnalysisError(null);
  };

  const handleStartAnalysis = async () => {
    const u = auth.currentUser;
    if (!stagedFile || !u) {
      setAnalysisError("Login required or access denied");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    setPermissionDeniedMessage(null);
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const currentUid = u.uid;
        const analysis = await analyzeTaxDocuments({ uid: currentUid }, [text]);
        
        // Save to Firestore
        await addDoc(collection(db, 'users', currentUid, 'documents'), {
          userId: currentUid,
          name: stagedFile.name,
          type: stagedFile.type,
          size: stagedFile.size,
          status: 'parsed',
          createdAt: Date.now(),
          analysis: analysis
        });

        setResult(analysis);
        onDiscover(analysis);
        setAnalyzing(false);
        setStagedFile(null); 
        setAnalysisError(null);
      } catch (err) {
        console.error("Analysis failed:", err);
        const msg = (err as any).message || "";
        if (msg.includes('permission-denied')) {
          setAnalysisError("Login required or access denied");
        } else {
          setAnalysisError("Analysis failed, try again");
        }
        setAnalyzing(false);
      }
    };
    reader.onerror = () => {
      setAnalysisError("File reading failed, try again");
      setAnalyzing(false);
    };
    reader.readAsText(stagedFile);
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-20">
      <SectionHeader title="Encrypted Vault" icon={<Lock className="w-4 h-4" />} />
      
      {!isOnline && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12 bg-apple-warning/5 border border-apple-warning/20 p-6 rounded-2xl flex items-center gap-4"
        >
          <WifiOff className="w-5 h-5 text-apple-warning" />
          <p className="text-subtext text-apple-warning font-medium">
            AI Document Categorization is disabled in Offline Mode. Restored on reconnection.
          </p>
        </motion.div>
      )}
      
      {/* File Permission Modal */}
      <AnimatePresence>
        {showPermissionModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="apple-card-elevated max-w-sm w-full text-center p-12 border border-white/5"
            >
              <div className="w-16 h-16 bg-teal/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Shield className="text-teal w-8 h-8" />
              </div>
              <h2 className="text-headline font-bold mb-4">Data Privacy Consent</h2>
              <div className="space-y-6 mb-10">
                <p className="text-apple-text-secondary text-body leading-relaxed">
                  To provide optimized tax intelligence, we need your consent to process uploaded documents. This allows our AI to categorize assets and identify savings.
                </p>
                <div className="p-4 bg-apple-elevated rounded-2xl border border-white/5 space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    <p className="text-subtext text-white font-medium">Your data is strictly private and encrypted.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    <p className="text-subtext text-white font-medium">You maintain full control and can delete your data at any time.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    <p className="text-subtext text-white font-medium">We never share your financial profile with third parties.</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <button onClick={handleContinueToUpload} className="premium-btn-primary w-full">
                  Agree & Continue
                </button>
                <button onClick={() => setShowPermissionModal(false)} className="premium-btn-secondary w-full border-none">
                  Not Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
         <div className="lg:col-span-1 space-y-8">
            <div className="space-y-4">
              <FilterBtn active icon={<FileText className="w-4 h-4" />}>All Assets</FilterBtn>
              <FilterBtn icon={<TrendingUp className="w-4 h-4" />}>Investments</FilterBtn>
              <FilterBtn icon={<Zap className="w-4 h-4" />}>Strategy</FilterBtn>
            </div>

            <div className="apple-card p-6 bg-teal/[0.02] border-teal/10 hidden lg:block">
              <p className="text-[10px] font-bold text-teal uppercase tracking-[0.2em] mb-4">Mobile Connectivity</p>
              <div className="aspect-square bg-white p-2 rounded-xl mb-4 overflow-hidden">
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://ais-pre-2z2teuckfhcelspwtt72vb-602455049138.asia-southeast1.run.app')}`} 
                  alt="Mobile Access QR"
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-caption text-apple-text-secondary leading-relaxed mb-3">
                Scan to sync this audit directly to your mobile device.
              </p>
              <div className="flex items-center gap-2 text-teal">
                <Shield className="w-3 h-3" />
                <span className="text-[9px] font-bold uppercase tracking-widest">Secure Link</span>
              </div>
            </div>
         </div>
        <div className="lg:col-span-3">
          <div className="apple-card mb-12 py-32 text-center border-dashed border-white/10 hover:bg-apple-elevated transition-all duration-500">
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".txt,.pdf,.docx" />
             
             <AnimatePresence mode="wait">
               {analyzing ? (
                 <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                   <div className="w-20 h-20 bg-apple-elevated rounded-full flex items-center justify-center mx-auto mb-10">
                     <Loader2 className="w-10 h-10 text-teal animate-spin" />
                   </div>
                   <h3 className="text-title font-bold mb-4 tracking-tight">AI Evaluation in Progress</h3>
                   <p className="text-apple-text-secondary mb-12 max-w-sm mx-auto text-body leading-relaxed">
                     Synthesizing document data with global tax frameworks.
                   </p>
                 </motion.div>
               ) : stagedFile ? (
                 <motion.div key="staged" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                   <div className={cn("w-20 h-20 border rounded-full flex items-center justify-center mx-auto mb-10 transition-colors", analysisError ? "bg-apple-error/5 border-apple-error/20" : "bg-teal/5 border-teal/20")}>
                     {analysisError ? <AlertCircle className="w-10 h-10 text-apple-error" /> : <FileText className="w-10 h-10 text-teal" />}
                   </div>
                   <h3 className="text-title font-bold mb-2 tracking-tight">{stagedFile.name}</h3>
                   <p className="text-apple-text-tertiary mb-12 font-bold uppercase tracking-widest text-caption">{analysisError || "Locally Staged • Awaiting Instructions"}</p>
                   <div className="flex flex-col md:flex-row items-center justify-center gap-6">
                     <button onClick={handleStartAnalysis} className="premium-btn-primary px-16">
                       {analysisError ? "Retry Analysis" : "Start Intelligence Analysis"}
                     </button>
                     <button onClick={() => setShowDiscardConfirm(true)} className="text-apple-text-tertiary font-bold uppercase tracking-widest text-caption hover:text-white transition-colors">
                       Discard
                     </button>
                   </div>
                 </motion.div>
               ) : (
                 <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                   <div className="w-20 h-20 border border-white/5 bg-apple-elevated rounded-full flex items-center justify-center mx-auto mb-10">
                     <Plus className="w-10 h-10 text-apple-text-tertiary" />
                   </div>
                   <h3 className="text-title font-bold mb-4 tracking-tight">Secure Deposition</h3>
                   <p className="text-apple-text-secondary mb-12 max-w-sm mx-auto text-body leading-relaxed">
                     Upload sensitive documentation for AI categorization and gap analysis.
                   </p>
                   <div className="space-y-6">
                     <button onClick={handleRequestPermission} className="premium-btn-primary px-16">
                       Upload Document
                     </button>
                     {permissionDeniedMessage && (
                       <p className="text-caption text-apple-error font-medium">
                         {permissionDeniedMessage}
                       </p>
                     )}
                   </div>
                 </motion.div>
               )}
             </AnimatePresence>
          </div>
          
          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-16">
                <div className="apple-card-elevated relative overflow-hidden" >
                  <div className="absolute top-0 right-0 p-8">
                    <CheckCircle2 className="w-6 h-6 text-apple-success" />
                  </div>
                  <span className="small-caps text-teal mb-12 block">Executive Summary</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                       <p className="text-apple-text-tertiary text-caption font-bold uppercase tracking-[0.2em]">Audit Risk Coefficient</p>
                       <div className="text-large-title font-bold text-white">{result.auditRiskScore}%</div>
                    </div>
                    <div className="space-y-6">
                       <p className="text-apple-text-tertiary text-caption font-bold uppercase tracking-[0.2em]">Deployment Strategy</p>
                       <p className="text-body text-apple-text-secondary leading-relaxed">{result.reasoning}</p>
                    </div>
                  </div>
                </div>

                {result.extractedValues && (
                  <div className="apple-card border border-teal/30 bg-teal/[0.03] overflow-hidden">
                    <div className="p-8 border-b border-teal/10 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-teal" />
                        <h3 className="text-headline font-bold">Data Discovered</h3>
                      </div>
                      <span className="text-[10px] font-bold text-teal uppercase tracking-[0.2em]">Ready for Simulator</span>
                    </div>
                    <div className="p-8">
                      <p className="text-apple-text-secondary text-subtext mb-8">
                        The following values were identified in your documentation. These can be auto-filled into the Simulator for a precision breakdown.
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        {result.extractedValues.salary && <DiscoveryItem label="Salary" value={result.extractedValues.salary} />}
                        {result.extractedValues.tds && <DiscoveryItem label="TDS Paid" value={result.extractedValues.tds} />}
                        {result.extractedValues.section80C && <DiscoveryItem label="80C" value={result.extractedValues.section80C} />}
                        {result.extractedValues.section80D && <DiscoveryItem label="80D" value={result.extractedValues.section80D} />}
                        {result.extractedValues.section24 && <DiscoveryItem label="Home Loan" value={result.extractedValues.section24} />}
                        {result.extractedValues.hra && <DiscoveryItem label="HRA" value={result.extractedValues.hra} />}
                        {result.extractedValues.nps && <DiscoveryItem label="NPS" value={result.extractedValues.nps} />}
                      </div>
                    </div>
                  </div>
                )}

                {result.actionPlan && (
                  <ActionPlanSection 
                    userId={userId} 
                    plan={Array.from(new Map([
                      ...(result.actionPlan || []),
                      ...generateTaxStrategy(profile.income || 0, profile.deductions || {})
                    ].map(item => [item.title, item])).values()).sort((a, b) => (b.benefit || 0) - (a.benefit || 0))} 
                  />
                )}

                <div className="space-y-8">
                  <SectionHeader title="Intelligence Vectors" icon={<Zap className="w-4 h-4" />} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {result.optimizationOpportunities.map((opt: any, i: number) => (
                      <div key={i} className="apple-card p-8 space-y-6">
                        <div className="flex justify-between items-start">
                          <h4 className="text-headline font-bold">{opt.title}</h4>
                          <span className={cn(
                            "text-[10px] font-bold px-3 py-1 bg-white/5 rounded-full uppercase tracking-widest",
                            opt.impact === 'High' ? 'text-teal' : 'text-apple-text-tertiary'
                          )}>{opt.impact} Impact</span>
                        </div>
                        <p className="text-apple-text-secondary text-subtext leading-relaxed">{opt.description}</p>
                        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                           <span className="text-caption font-mono text-apple-text-tertiary">{opt.lawReference}</span>
                           <span className="text-caption font-bold text-teal">{opt.confidence}% Confidence</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            <SectionHeader title="Recently Processed Assets" icon={<FileText className="w-4 h-4" />} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {documents.length > 0 ? documents.map((doc) => (
                <div 
                  key={doc.id} 
                  onClick={() => onSelect(doc)}
                  className="apple-card flex items-center gap-8 group hover:bg-apple-elevated transition-colors cursor-pointer border-white/5 active:scale-[0.98]"
                >
                   <div className="w-14 h-14 bg-apple-elevated rounded-full flex items-center justify-center text-teal group-hover:bg-teal group-hover:text-black transition-all">
                     <FileText className="w-6 h-6" />
                   </div>
                   <div>
                      <h4 className="font-bold text-body truncate max-w-[200px]">{doc.name}</h4>
                      <p className="text-caption text-apple-text-tertiary font-bold uppercase tracking-widest mt-1">
                        {doc.type.split('/')[1] || 'Document'} • {doc.status === 'parsed' ? 'VERIFIED' : 'PENDING'}
                      </p>
                   </div>
                </div>
              )) : (
                <div className="apple-card border-dashed border-white/10 text-center bg-transparent py-12">
                   <p className="text-apple-text-tertiary text-subtext">Secure vault is current. No assets indexed.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setStagedFile(null);
          setAnalysisError(null);
          setShowDiscardConfirm(false);
        }}
        title="Discard Document?"
        message="This will remove the staged file from the intelligence queue. This action cannot be undone."
        variant="danger"
        confirmText="Discard Anyway"
      />
    </div>
  );
}

function ProfileView({ 
  profile, 
  onLogout, 
  onDeleteData,
  onOpenPrivacy, 
  onOpenTerms 
}: { 
  profile: UserProfile, 
  onLogout: () => void,
  onDeleteData: () => void,
  onOpenPrivacy: () => void,
  onOpenTerms: () => void
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

  return (
    <div className="max-w-3xl mx-auto px-8 py-20">
      <SectionHeader title="Identity & Access" icon={<UserIcon className="w-4 h-4" />} />
      
      <div className="space-y-12">
        <div className="apple-card-elevated flex flex-col items-center text-center">
           <Shield className="w-12 h-12 text-teal/20 absolute top-8 right-8" />
           <div className="w-24 h-24 rounded-full bg-apple-card border border-white/5 flex items-center justify-center text-teal mb-8">
              <UserIcon size={40} strokeWidth={1} />
           </div>
           <h2 className="text-title font-bold mb-2">{profile.displayName}</h2>
           <p className="text-subtext text-apple-text-tertiary font-medium mb-8">{profile.email}</p>
           <div className="flex gap-4">
              <div className="px-6 py-2 bg-teal/10 border border-teal/20 rounded-full">
                 <span className="text-caption font-bold text-teal uppercase tracking-widest">Premium Tier</span>
              </div>
           </div>
        </div>

        <div className="apple-card p-6 bg-apple-success/5 border border-apple-success/20 flex items-start gap-4">
          <Shield className="w-5 h-5 text-apple-success shrink-0 mt-1" />
          <div>
            <p className="text-body font-bold text-apple-success mb-1">Your Privacy is Native</p>
            <p className="text-subtext text-apple-text-secondary leading-relaxed">
              TaxBreaker is engineered with a private-by-default architecture. Your financial inputs, uploaded documents, 
              and AI-generated strategies are encrypted and stored solely in your personal cloud vault. 
              We never sell or share your data.
            </p>
          </div>
        </div>

        <div className="apple-card p-0 divide-y divide-white/5 overflow-hidden">
           <ProfileItem label="Jurisdiction" value={profile.country} />
           <ProfileItem label="Entity Type" value={profile.employmentType} />
           <ProfileItem label="Reported Income" value={`₹${profile.income?.toLocaleString('en-IN')}`} />
           <ProfileItem label="Primary Goal" value={profile.goals[0] || 'Not Set'} />
        </div>

        <div className="apple-card p-0 divide-y divide-white/5 overflow-hidden">
           <button 
             onClick={onOpenPrivacy}
             className="w-full p-8 flex items-center justify-between hover:bg-white/[0.01] transition-colors group"
           >
              <span className="small-caps">Privacy Policy</span>
              <ChevronRight className="w-4 h-4 text-apple-text-tertiary group-hover:text-teal transition-colors" />
           </button>
           <button 
             onClick={onOpenTerms}
             className="w-full p-8 flex items-center justify-between hover:bg-white/[0.01] transition-colors group"
           >
              <span className="small-caps">Terms of Use</span>
              <ChevronRight className="w-4 h-4 text-apple-text-tertiary group-hover:text-teal transition-colors" />
           </button>
        </div>

        <div className="flex flex-col gap-4">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="premium-btn-secondary w-full border border-white/10 hover:bg-white/5"
          >
            Terminate Session
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="text-caption font-bold text-apple-error uppercase tracking-widest mt-4 p-4 hover:bg-apple-error/5 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Purge Digital Identity & Clear All Data
          </button>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={onLogout}
        title="Terminate Session?"
        message="Are you sure you want to exit your encrypted work environment? You'll need to re-authenticate to regain access."
        variant="danger"
        confirmText="Terminate Now"
      />

      <ConfirmationModal 
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={onDeleteData}
        title="Purge Digital Identity?"
        message="CRITICAL: This will permanently delete your profile, all uploaded documents, and optimization strategies from our secure servers and local storage. This action is IRREVERSIBLE."
        variant="danger"
        confirmText="Purge My Data Forever"
      />
    </div>
  );
}

function ProfileItem({ label, value }: { label: string, value: string | undefined }) {
  return (
    <div className="p-8 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
       <span className="small-caps">{label}</span>
       <span className="text-body font-semibold text-white">{value || 'N/A'}</span>
    </div>
  );
}

function ActionPlanSection({ userId, plan }: { userId: string, plan: any[] }) {
  const [completedIds, setCompletedIds] = React.useState<string[]>([]);
  const [pendingToggleId, setPendingToggleId] = React.useState<string | null>(null);
  
  React.useEffect(() => {
    const fetchProgress = async () => {
      const u = auth.currentUser;
      if (!u || u.uid !== userId) return;

      try {
        const docRef = doc(db, 'users', u.uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setCompletedIds(snap.data().completedStepIds || []);
        }
      } catch (err: any) {
        if (err.message?.includes('permission-denied')) {
          console.error("[ACTION_PLAN]: Permission denied.");
        }
      }
    };
    fetchProgress();
  }, [userId]);

  const toggleStep = async (stepId: string) => {
    const step = plan.find(s => s.id === stepId);
    
    // Show confirmation for high impact moves if not already done
    if (step && step.priority === 'High' && !completedIds.includes(stepId)) {
      setPendingToggleId(stepId);
      return;
    }

    executeToggle(stepId);
  };

  const executeToggle = async (stepId: string) => {
    const u = auth.currentUser;
    if (!u || u.uid !== userId) return;

    const isDone = completedIds.includes(stepId);
    const newCompleted = isDone 
      ? completedIds.filter(id => id !== stepId)
      : [...completedIds, stepId];
    
    setCompletedIds(newCompleted);
    try {
      await updateDoc(doc(db, 'users', u.uid), {
        completedStepIds: isDone ? arrayRemove(stepId) : arrayUnion(stepId)
      });
    } catch (err: any) {
      if (err.message?.includes('permission-denied')) {
        console.error("[ACTION_PLAN]: Permission denied.");
      }
    }
  };

  const progress = (completedIds.length / plan.length) * 100;

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div>
          <SectionHeader title="Your Action Plan" icon={<CheckCircle2 className="w-4 h-4" />} />
          <p className="text-apple-text-secondary text-body max-w-xl">
            Sequential roadmap optimized for the FY 2024-25 Indian Tax Framework.
          </p>
        </div>
        <div className="w-full md:w-64 space-y-4">
          <div className="flex justify-between items-center text-caption font-bold uppercase tracking-widest text-apple-text-tertiary">
            <span>Optimization Progress</span>
            <span className="text-teal">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-teal shadow-[0_0_10px_rgba(0,128,128,0.4)]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {plan.map((step, idx) => (
          <ActionPlanCard 
            key={step.id || idx} 
            step={step} 
            number={idx + 1} 
            done={completedIds.includes(step.id)}
            onToggle={() => toggleStep(step.id)}
          />
        ))}
      </div>

      <ConfirmationModal 
        isOpen={!!pendingToggleId}
        onClose={() => setPendingToggleId(null)}
        onConfirm={() => {
          if (pendingToggleId) executeToggle(pendingToggleId);
          setPendingToggleId(null);
        }}
        title="Apply Strategic Move?"
        message="Marking this high-impact action as completed signifies you have executed this tax strategy. Ensure compliance before proceeding."
        variant="primary"
        confirmText="Confirm Execution"
      />
    </div>
  );
}

interface ActionPlanCardProps {
  key?: React.Key;
  step: any;
  number: number;
  done: boolean;
  onToggle: () => void | Promise<void>;
}

function ActionPlanCard({ step, number, done, onToggle }: ActionPlanCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div className={cn(
      "apple-card p-0 overflow-hidden border transition-all duration-300",
      done ? "border-apple-success/20 bg-apple-success/[0.02]" : "border-white/5",
      isExpanded ? "ring-1 ring-teal/20" : ""
    )}>
      <div 
        className="p-8 flex items-center gap-8 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className={cn(
          "w-12 h-12 rounded-full border flex items-center justify-center shrink-0 transition-all duration-500",
          done ? "bg-apple-success border-apple-success text-black" : "bg-apple-card border-white/10 text-apple-text-tertiary"
        )} onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {done ? <Check className="w-6 h-6 stroke-[3]" /> : <span className="font-bold font-mono">{number}</span>}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-4 mb-1">
             <h4 className={cn("text-headline font-bold truncate", done && "text-apple-text-tertiary line-through")}>{step.title}</h4>
             <span className={cn(
               "text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest",
               step.priority === 'High' ? 'bg-teal/10 text-teal shadow-[0_0_10px_rgba(0,128,128,0.15)]' : 'bg-white/5 text-apple-text-tertiary'
             )}>{step.priority} Priority</span>
          </div>
          {!isExpanded && <p className="text-subtext text-apple-text-tertiary truncate">{step.action}</p>}
        </div>

        <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
          <ChevronDown className="w-5 h-5 text-apple-text-tertiary" />
        </motion.div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/5"
          >
            <div className="p-10 space-y-12 bg-apple-black/40">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-4">
                     <label className="small-caps decoration-teal/40 underline underline-offset-8 decoration-2">Protocol Action</label>
                     <p className="text-body text-white font-medium leading-relaxed">{step.action}</p>
                  </div>
                  <div className="space-y-4">
                     <label className="small-caps decoration-teal/40 underline underline-offset-8 decoration-2">Strategic Rationale</label>
                     <p className="text-body text-apple-text-secondary leading-relaxed">{step.why}</p>
                  </div>
               </div>

               <div className="flex flex-wrap items-center gap-12 pt-8 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-teal" />
                    <span className="text-caption font-mono text-teal uppercase tracking-widest">{step.law}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-4 h-4 text-apple-success" />
                    <span className="text-body font-bold text-apple-success">Est. Benefit: ₹{step.benefit?.toLocaleString()}</span>
                  </div>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterBtn({ children, active, icon }: { children: React.ReactNode, active?: boolean, icon: React.ReactNode }) {
  return (
    <button className={cn(
      "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-subtext font-bold transition-all duration-500 border",
      active 
        ? "bg-teal/10 border-teal/30 text-teal shadow-[0_0_20px_rgba(0,128,128,0.1)]" 
        : "bg-apple-card border-white/5 text-apple-text-tertiary hover:bg-apple-elevated hover:text-white"
    )}>
      <div className={cn(
        "p-2 rounded-lg transition-colors",
        active ? "bg-teal text-black" : "bg-apple-elevated text-apple-text-tertiary"
      )}>
        {icon}
      </div>
      {children}
    </button>
  );
}

function DiscoveryItem({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
      <span className="text-caption font-bold text-apple-text-tertiary uppercase tracking-widest">{label}</span>
      <span className="text-subtext font-bold text-white">₹{value.toLocaleString()}</span>
    </div>
  );
}
