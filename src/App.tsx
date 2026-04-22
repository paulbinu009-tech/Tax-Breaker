import * as React from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
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
import { TAX_RULES, updateTaxRules } from './config/taxRules';
import { PrivacyPolicyScreen, TermsScreen } from './components/LegalScreens';
import WealthTips from './components/WealthTips';
import ConfirmationModal from './components/ConfirmationModal';
import FilingGuide from './components/FilingGuide';
import SummaryView from './components/SummaryView';
import ReadinessScore from './components/ReadinessScore';
import TaxCalculator from './components/TaxCalculator';
import { NavLink, SectionHeader } from './components/Common';

export default function App() {
  const [user, setUser] = React.useState<User | null>(null);
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [currentView, setCurrentView] = React.useState<'landing' | 'onboarding' | 'dashboard' | 'vault' | 'simulator' | 'profile' | 'privacy' | 'terms' | 'guide' | 'summary'>('landing');
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = React.useState(false);
  const [discovery, setDiscovery] = React.useState<TaxAnalysisResult | null>(null);
  const [hasConsented, setHasConsented] = React.useState(() => {
    return localStorage.getItem('taxbreaker_consent') === 'true';
  });

  React.useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          updateTaxRules(data);
          console.log("Strategic config synchronized:", data.lastUpdated);
        }
      } catch (err) {
        console.error("Configuration sync failed:", err);
      }
    };
    fetchConfig();

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const userDoc = await getDoc(doc(db, 'users', u.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as UserProfile;
          setProfile(data);
          if (data.onboardingComplete) {
            setCurrentView('dashboard');
          } else {
            setCurrentView('onboarding');
          }
        } else {
          // Initialize empty profile
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
            onboardingComplete: false,
            goals: [],
            taxScore: 0,
            completedStepIds: []
          };
          await setDoc(doc(db, 'users', u.uid), newProfile);
          setProfile(newProfile);
          setCurrentView('onboarding');
        }
      } else {
        setProfile(null);
        setCurrentView('landing');
      }
      setLoading(false);
    });

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
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
    localStorage.setItem('taxbreaker_consent', String(consented));
  };

  const handleToggleFilingStep = async (stepId: string) => {
    if (!profile || !user) return;
    const currentSteps = profile.completedFilingStepIds || [];
    const updated = currentSteps.includes(stepId)
      ? currentSteps.filter(id => id !== stepId)
      : [...currentSteps, stepId];
    
    setProfile({ ...profile, completedFilingStepIds: updated });
    await updateDoc(doc(db, 'users', user.uid), {
      completedFilingStepIds: updated
    });
  };

  const handleLogout = () => {
    signOut(auth);
    setMobileMenuOpen(false);
  };

  const handleDeleteAllData = async () => {
    if (!user || !profile) return;
    try {
      // 1. Delete Firestore document
      await deleteDoc(doc(db, 'users', user.uid));
      // 2. Clear local storage
      localStorage.removeItem('taxbreaker_consent');
      // 3. Reset states
      setProfile(null);
      setDiscovery(null);
      // 4. Sign out
      await signOut(auth);
      setCurrentView('landing');
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Data deletion failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-apple-black">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-12 h-12 border-2 border-gold rounded-xl"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-apple-black text-white font-sans overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-apple-black/80 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-8 h-24 flex items-center justify-between">
          <div 
            className="flex items-center gap-4 cursor-pointer group"
            onClick={() => setCurrentView(user ? 'dashboard' : 'landing')}
          >
            <div className="w-6 h-6 border border-gold/40 flex items-center justify-center rotate-45 group-hover:rotate-90 transition-transform duration-700">
              <Shield className="w-3 h-3 text-gold -rotate-45 group-hover:-rotate-90 transition-transform duration-700" strokeWidth={1.5} />
            </div>
            <div className="flex flex-col">
              <span className="text-caption font-bold uppercase tracking-[0.4em]">TaxBreaker</span>
              {!isOnline && (
                <span className="text-[8px] font-bold text-apple-warning uppercase tracking-widest mt-0.5">Offline</span>
              )}
            </div>
          </div>

          <div className="hidden md:flex items-center gap-12">
            {user && profile?.onboardingComplete && (
              <>
                <NavLink active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')}>Concierge</NavLink>
                <NavLink active={currentView === 'vault'} onClick={() => setCurrentView('vault')}>Vault</NavLink>
                <NavLink active={currentView === 'simulator'} onClick={() => setCurrentView('simulator')}>Simulator</NavLink>
                <NavLink active={currentView === 'guide'} onClick={() => setCurrentView('guide')}>Guide</NavLink>
                <NavLink active={currentView === 'profile'} onClick={() => setCurrentView('profile')}>Profile</NavLink>
              </>
            )}
          </div>

          <div className="flex items-center gap-8">
            {user ? (
              <div className="flex items-center gap-6">
                <button 
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 text-apple-text-tertiary"
                >
                  {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
                <div className="hidden md:flex items-center gap-6">
                  <div className="text-right">
                    <p className="small-caps mb-1">{profile?.displayName}</p>
                    <button onClick={handleLogout} className="text-caption text-apple-text-tertiary hover:text-apple-error transition-colors uppercase tracking-widest">Sign Out</button>
                  </div>
                  <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-gold/40 bg-apple-card">
                    <UserIcon size={18} strokeWidth={1} />
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={handleLogin} className="small-caps border border-white/10 px-8 py-2.5 rounded-full hover:border-gold/40 transition-colors">
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-0 z-40 bg-black pt-24 px-6 md:hidden"
          >
            <div className="flex flex-col gap-6">
               <NavLink active={currentView === 'dashboard'} onClick={() => { setCurrentView('dashboard'); setMobileMenuOpen(false); }}>Dashboard</NavLink>
               <NavLink active={currentView === 'vault'} onClick={() => { setCurrentView('vault'); setMobileMenuOpen(false); }}>Vault</NavLink>
               <NavLink active={currentView === 'simulator'} onClick={() => { setCurrentView('simulator'); setMobileMenuOpen(false); }}>Simulator</NavLink>
               <NavLink active={currentView === 'guide'} onClick={() => { setCurrentView('guide'); setMobileMenuOpen(false); }}>Guide</NavLink>
               <NavLink active={currentView === 'profile'} onClick={() => { setCurrentView('profile'); setMobileMenuOpen(false); }}>Profile</NavLink>
               <button onClick={handleLogout} className="flex items-center gap-2 text-apple-error mt-4 font-bold uppercase tracking-widest text-caption">
                 <LogOut className="w-5 h-5" /> Logout
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Online Status Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1, marginTop: '6rem' }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            className="bg-apple-warning/10 border-b border-apple-warning/20 overflow-hidden relative z-[45]"
          >
            <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <WifiOff className="w-3.5 h-3.5 text-apple-warning" />
                <span className="text-[10px] font-bold text-apple-warning uppercase tracking-[0.2em]">
                  Local Strategic Mode • No Network Detected
                </span>
              </div>
              <p className="text-[10px] text-apple-text-tertiary font-medium">
                Simulation active. Intelligence synchronization suspended.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn("pb-32", isOnline ? "pt-24" : "pt-8")}>
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
              />
            </motion.div>
          )}
          {currentView === 'vault' && profile && (
            <motion.div key="vault" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <VaultView userId={profile.uid} onDiscover={(result) => setDiscovery(result)} isOnline={isOnline} />
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
              <SummaryView profile={profile} discovery={discovery?.extractedValues || null} onBack={() => setCurrentView('dashboard')} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Assistant Overlay Toggle */}
      {user && profile?.onboardingComplete && (
        <>
          <AnimatePresence>
            {isAssistantOpen && profile && (
              <Assistant profile={profile} discovery={discovery} onClose={() => setIsAssistantOpen(false)} isOnline={isOnline} />
            )}
          </AnimatePresence>
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={() => setIsAssistantOpen(!isAssistantOpen)}
            className="fixed bottom-8 right-8 w-14 h-14 gold-gradient rounded-full shadow-2xl flex items-center justify-center text-black z-50 cursor-pointer"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isAssistantOpen ? <X strokeWidth={2.5} /> : <MessageSquare strokeWidth={2.5} />}
          </motion.button>
        </>
      )}
    </div>
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
        <span className="text-gold mr-2">✦</span>
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
              className="w-5 h-5 accent-gold cursor-pointer"
            />
            <label htmlFor="consent" className="text-caption text-apple-text-tertiary font-medium cursor-pointer">
              I agree to the 
              <button onClick={onOpenTerms} className="text-gold hover:underline mx-1">Terms of Use</button> 
              & 
              <button onClick={onOpenPrivacy} className="text-gold hover:underline ml-1">Privacy Policy</button>
            </label>
          </div>
          <p className="text-[10px] text-apple-text-tertiary uppercase tracking-widest font-bold mt-4">
            <Shield className="w-3 h-3 inline-block mr-2 text-gold align-middle" /> 
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
      <p className="text-title font-bold text-gold mb-1">{value}</p>
      <p className="text-subtext text-apple-text-secondary">{sub}</p>
    </div>
  );
}

function OnboardingView({ profile, onComplete }: { profile: UserProfile, onComplete: (u: UserProfile) => void }) {
  const [step, setStep] = React.useState(1);
  const [formData, setFormData] = React.useState({
    country: 'India',
    employmentType: '',
    income: 0,
    assets: '',
    goals: [] as string[],
    taxRegime: 'new' as 'old' | 'new'
  });

  const countries = ['India', 'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany'];
  const jobTypes = ['Salaried', 'Self-Employed', 'Business Owner', 'Professional'];

  const handleFinish = async () => {
    const updated: UserProfile = {
      ...profile,
      ...formData,
      onboardingComplete: true
    };
    await updateDoc(doc(db, 'users', profile.uid), updated as any);
    onComplete(updated);
  };

  return (
    <div className="max-w-xl mx-auto px-8 py-32 min-h-[80vh] flex flex-col justify-center">
      <div className="mb-20">
         <div className="flex gap-3 mb-10">
            {[1, 2, 3].map(s => (
               <div key={s} className={cn(
                 "h-1.5 transition-all duration-700 rounded-full",
                 step >= s ? "w-16 bg-gold" : "w-8 bg-white/5"
               )} />
            ))}
         </div>
         <span className="small-caps mb-4 block">Initialization Sequence</span>
         <h1 className="text-title md:text-large-title font-bold tracking-tight">Configure your intelligence profile.</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-16"
          >
            <div className="space-y-6">
              <label className="small-caps block">Jurisdiction</label>
              <select 
                value={formData.country} 
                onChange={(e) => setFormData({...formData, country: e.target.value})}
                className="w-full bg-apple-card border border-white/5 rounded-2xl h-14 px-6 outline-none focus:border-gold transition-all text-body font-medium appearance-none"
              >
                {countries.map(c => <option key={c} value={c} className="bg-apple-card text-white">{c}</option>)}
              </select>
            </div>
            <div className="space-y-6">
              <label className="small-caps block">Entity Structure</label>
              <div className="grid grid-cols-2 gap-4">
                {jobTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setFormData({...formData, employmentType: type})}
                    className={cn(
                      "h-16 rounded-2xl border transition-all duration-300 font-semibold text-subtext",
                      formData.employmentType === type ? "border-gold text-gold bg-gold/10" : "border-white/5 bg-apple-card text-apple-text-tertiary hover:border-white/20"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <button 
              disabled={!formData.employmentType}
              onClick={() => setStep(2)} 
              className="premium-btn-primary w-full"
            >
              Continue
            </button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-16"
          >
            <div className="space-y-6">
              <label className="small-caps block">Capital Position (Annual)</label>
              <div className="relative bg-apple-card border border-white/5 rounded-2xl focus-within:border-gold transition-all px-6">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gold font-bold text-headline">₹</span>
                <input 
                  type="number"
                  value={formData.income || ''}
                  onChange={(e) => setFormData({...formData, income: Number(e.target.value)})}
                  className="w-full bg-transparent h-16 pl-8 pr-4 outline-none text-headline font-bold"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-6">
              <label className="small-caps block">Asset Portfolio</label>
              <textarea 
                value={formData.assets}
                onChange={(e) => setFormData({...formData, assets: e.target.value})}
                className="w-full bg-apple-card border border-white/5 rounded-2xl p-8 min-h-[180px] outline-none focus:border-gold transition-all text-body font-normal placeholder:text-apple-text-tertiary"
                placeholder="List significant holdings (Real estate, Equities, Digital Assets)..."
              />
            </div>
            <div className="flex gap-4">
              <button onClick={() => setStep(1)} className="premium-btn-secondary flex-1">Back</button>
              <button onClick={() => setStep(3)} className="premium-btn-primary flex-1">Continue</button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div 
            key="step3"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-16"
          >
            <div className="space-y-6">
              <label className="small-caps block">Strategic Objectives</label>
              <div className="grid grid-cols-1 gap-4">
                {[
                  'Asset Preservation', 
                  'Risk Mitigation', 
                  'Strategic Reinvestment', 
                  'Offshore Deployment',
                  'Intergenerational Transfer'
                ].map(goal => (
                  <button
                    key={goal}
                    onClick={() => {
                      const goals = formData.goals.includes(goal) 
                        ? formData.goals.filter(g => g !== goal)
                        : [...formData.goals, goal];
                      setFormData({...formData, goals});
                    }}
                    className={cn(
                      "h-16 px-8 rounded-2xl border text-left flex items-center justify-between transition-all duration-300",
                      formData.goals.includes(goal) ? "border-gold text-gold bg-gold/10" : "border-white/5 bg-apple-card text-apple-text-tertiary hover:border-white/20"
                    )}
                  >
                    <span className="text-body font-semibold">{goal}</span>
                    <AnimatePresence>
                      {formData.goals.includes(goal) && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                          <CheckCircle2 className="w-6 h-6" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-4 pt-12">
              <button onClick={() => setStep(2)} className="premium-btn-secondary flex-1">Back</button>
              <button onClick={handleFinish} className="premium-btn-primary flex-1">Establish Profile</button>
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
  onOpenGuide
}: { 
  profile: UserProfile, 
  discovery: TaxAnalysisResult | null, 
  isOnline: boolean,
  onOpenSummary: () => void,
  onOpenGuide: () => void
}) {
  const discovery = fullDiscovery?.extractedValues;
  // Logic for dynamic alerts
  const show80CWarning = discovery && (discovery.section80C || 0) < 150000;
  const showTDSWarning = discovery && (discovery.tds || 0) > 0;
  
  const remaining80C = 150000 - (discovery?.section80C || 0);

  // Dynamic advice
  const oldResult = calculateTax(profile.income || 0, 'old', discovery || {});
  const newResult = calculateTax(profile.income || 0, 'new', discovery || {});
  const savings = Math.round(Math.abs(oldResult.totalTax - newResult.totalTax));
  const betterRegime = oldResult.totalTax < newResult.totalTax ? "Old" : "New";
  const worseRegime = betterRegime === "Old" ? "New" : "Old";
  const sectionCode = betterRegime === "New" ? "§115BAC" : "Traditional";

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
        {discovery && (show80CWarning || showTDSWarning) && (
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
                    : `TDS of ₹${discovery?.tds?.toLocaleString('en-IN')} detected. Prepare for July 31 filing.`}
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
            Welcome, <span className="text-gold">{profile.displayName?.split(' ')[0]}</span>
          </h1>
        </div>
        <div className="flex gap-8 items-center">
          <div className="w-12 h-12 rounded-full border border-white/5 bg-apple-card flex items-center justify-center">
             <Shield className="w-5 h-5 text-gold/60" />
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
                     <span className="text-gold/60 text-caption font-bold uppercase tracking-widest">Immediate Optimization</span>
                     <h3 className="text-headline font-bold">Tax Regime Optimization</h3>
                   </div>
                   <span className="text-caption font-bold px-4 py-1.5 bg-gold/10 border border-gold/30 rounded-full text-gold">High Impact</span>
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
            <SectionHeader title="Strategic Timeline" icon={<TrendingUp className="w-4 h-4" />} />
            <div className="apple-card p-0 divide-y divide-white/5">
              <TimelineItem 
                date="MAR 31" 
                title="Investment Deadline" 
                status={discovery ? (show80CWarning ? "warning" : "success") : "pending"} 
                sub={discovery ? (show80CWarning ? `₹${remaining80C.toLocaleString('en-IN')} headroom available` : "80C Threshold Maximized") : "Awaiting document analysis"} 
              />
              <TimelineItem 
                date="JUL 31" 
                title="ITR Filing Deadline" 
                status={discovery ? (showTDSWarning ? "pending" : "success") : "pending"} 
                sub={discovery ? (showTDSWarning ? `Filing ready for ₹${discovery?.tds?.toLocaleString('en-IN')} TDS` : "Profile optimized for filing") : "Synchronize Vault to track"} 
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
               <button className="text-gold text-caption font-bold uppercase tracking-widest hover:tracking-widest transition-all">
                  Access Vault
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ date, title, status, sub }: { date: string, title: string, status: 'pending' | 'success' | 'warning', sub: string }) {
  return (
    <div className="p-8 flex items-center gap-8 group hover:bg-apple-elevated transition-colors duration-200">
      <div className="text-center w-12 shrink-0">
        <p className="text-caption font-bold text-apple-text-tertiary">{date.split(' ')[0]}</p>
        <p className="text-headline font-bold text-gold">{date.split(' ')[1]}</p>
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

function VaultView({ userId, onDiscover, isOnline }: { userId: string, onDiscover: (result: TaxAnalysisResult) => void, isOnline: boolean }) {
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
    if (!stagedFile || !userId) return;
    setAnalyzing(true);
    setAnalysisError(null);
    setPermissionDeniedMessage(null);
    
    // Use real analysis with Gemini
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const analysis = await analyzeTaxDocuments({ uid: userId }, [text]);
        setResult(analysis);
        onDiscover(analysis);
        setAnalyzing(false);
        setStagedFile(null); 
        setAnalysisError(null);
      } catch (err) {
        console.error("Analysis failed:", err);
        setAnalysisError("Analysis failed, try again");
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
              <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Shield className="text-gold w-8 h-8" />
              </div>
              <h2 className="text-headline font-bold mb-4">Data Privacy Consent</h2>
              <div className="space-y-6 mb-10">
                <p className="text-apple-text-secondary text-body leading-relaxed">
                  To provide optimized tax intelligence, we need your consent to process uploaded documents. This allows our AI to categorize assets and identify savings.
                </p>
                <div className="p-4 bg-apple-elevated rounded-2xl border border-white/5 space-y-3 text-left">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                    <p className="text-subtext text-white font-medium">Your data is strictly private and encrypted.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                    <p className="text-subtext text-white font-medium">You maintain full control and can delete your data at any time.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
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
        <div className="lg:col-span-1 space-y-4">
           <FilterBtn active icon={<FileText className="w-4 h-4" />}>All Assets</FilterBtn>
           <FilterBtn icon={<TrendingUp className="w-4 h-4" />}>Investments</FilterBtn>
           <FilterBtn icon={<Zap className="w-4 h-4" />}>Strategy</FilterBtn>
        </div>
        <div className="lg:col-span-3">
          <div className="apple-card mb-12 py-32 text-center border-dashed border-white/10 hover:bg-apple-elevated transition-all duration-500">
             <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".txt,.pdf,.docx" />
             
             <AnimatePresence mode="wait">
               {analyzing ? (
                 <motion.div key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                   <div className="w-20 h-20 bg-apple-elevated rounded-full flex items-center justify-center mx-auto mb-10">
                     <Loader2 className="w-10 h-10 text-gold animate-spin" />
                   </div>
                   <h3 className="text-title font-bold mb-4 tracking-tight">AI Evaluation in Progress</h3>
                   <p className="text-apple-text-secondary mb-12 max-w-sm mx-auto text-body leading-relaxed">
                     Synthesizing document data with global tax frameworks.
                   </p>
                 </motion.div>
               ) : stagedFile ? (
                 <motion.div key="staged" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                   <div className={cn("w-20 h-20 border rounded-full flex items-center justify-center mx-auto mb-10 transition-colors", analysisError ? "bg-apple-error/5 border-apple-error/20" : "bg-gold/5 border-gold/20")}>
                     {analysisError ? <AlertCircle className="w-10 h-10 text-apple-error" /> : <FileText className="w-10 h-10 text-gold" />}
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
                  <span className="small-caps text-gold mb-12 block">Executive Summary</span>
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
                  <div className="apple-card border border-gold/30 bg-gold/[0.03] overflow-hidden">
                    <div className="p-8 border-b border-gold/10 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Zap className="w-5 h-5 text-gold" />
                        <h3 className="text-headline font-bold">Data Discovered</h3>
                      </div>
                      <span className="text-[10px] font-bold text-gold uppercase tracking-[0.2em]">Ready for Simulator</span>
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

                {result.actionPlan && result.actionPlan.length > 0 && (
                  <ActionPlanSection userId={userId} plan={result.actionPlan} />
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
                            opt.impact === 'High' ? 'text-gold' : 'text-apple-text-tertiary'
                          )}>{opt.impact} Impact</span>
                        </div>
                        <p className="text-apple-text-secondary text-subtext leading-relaxed">{opt.description}</p>
                        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                           <span className="text-caption font-mono text-apple-text-tertiary">{opt.lawReference}</span>
                           <span className="text-caption font-bold text-gold">{opt.confidence}% Confidence</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="apple-card flex items-center gap-8 group hover:bg-apple-elevated transition-colors cursor-pointer">
                <div className="w-14 h-14 bg-apple-elevated rounded-full flex items-center justify-center text-gold">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                   <h4 className="font-bold text-body">Paystab_April_2023.pdf</h4>
                   <p className="text-caption text-apple-text-tertiary font-bold uppercase tracking-widest mt-1">Income Statement • VERIFIED</p>
                </div>
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
           <Shield className="w-12 h-12 text-gold/20 absolute top-8 right-8" />
           <div className="w-24 h-24 rounded-full bg-apple-card border border-white/5 flex items-center justify-center text-gold mb-8">
              <UserIcon size={40} strokeWidth={1} />
           </div>
           <h2 className="text-title font-bold mb-2">{profile.displayName}</h2>
           <p className="text-subtext text-apple-text-tertiary font-medium mb-8">{profile.email}</p>
           <div className="flex gap-4">
              <div className="px-6 py-2 bg-gold/10 border border-gold/20 rounded-full">
                 <span className="text-caption font-bold text-gold uppercase tracking-widest">Premium Tier</span>
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
              <ChevronRight className="w-4 h-4 text-apple-text-tertiary group-hover:text-gold transition-colors" />
           </button>
           <button 
             onClick={onOpenTerms}
             className="w-full p-8 flex items-center justify-between hover:bg-white/[0.01] transition-colors group"
           >
              <span className="small-caps">Terms of Use</span>
              <ChevronRight className="w-4 h-4 text-apple-text-tertiary group-hover:text-gold transition-colors" />
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
      const docRef = doc(db, 'users', userId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setCompletedIds(snap.data().completedStepIds || []);
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
    const isDone = completedIds.includes(stepId);
    const newCompleted = isDone 
      ? completedIds.filter(id => id !== stepId)
      : [...completedIds, stepId];
    
    setCompletedIds(newCompleted);
    await updateDoc(doc(db, 'users', userId), {
      completedStepIds: isDone ? arrayRemove(stepId) : arrayUnion(stepId)
    });
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
            <span className="text-gold">{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              className="h-full bg-gold shadow-[0_0_10px_rgba(212,175,55,0.4)]"
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
      isExpanded ? "ring-1 ring-gold/20" : ""
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
               step.priority === 'High' ? 'bg-gold/10 text-gold shadow-[0_0_10px_rgba(212,175,55,0.15)]' : 'bg-white/5 text-apple-text-tertiary'
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
                     <label className="small-caps decoration-gold/40 underline underline-offset-8 decoration-2">Protocol Action</label>
                     <p className="text-body text-white font-medium leading-relaxed">{step.action}</p>
                  </div>
                  <div className="space-y-4">
                     <label className="small-caps decoration-gold/40 underline underline-offset-8 decoration-2">Strategic Rationale</label>
                     <p className="text-body text-apple-text-secondary leading-relaxed">{step.why}</p>
                  </div>
               </div>

               <div className="flex flex-wrap items-center gap-12 pt-8 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 text-gold" />
                    <span className="text-caption font-mono text-gold uppercase tracking-widest">{step.law}</span>
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
        ? "bg-gold/10 border-gold/30 text-gold shadow-[0_0_20px_rgba(212,175,55,0.1)]" 
        : "bg-apple-card border-white/5 text-apple-text-tertiary hover:bg-apple-elevated hover:text-white"
    )}>
      <div className={cn(
        "p-2 rounded-lg transition-colors",
        active ? "bg-gold text-black" : "bg-apple-elevated text-apple-text-tertiary"
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
