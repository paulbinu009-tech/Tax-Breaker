import { create } from 'zustand';
import { UserProfile, TaxAnalysisResult, TaxDocument } from '../types';
import { User } from 'firebase/auth';

interface AppState {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  appError: string | null;
  isOnline: boolean;
  currentView: 'landing' | 'onboarding' | 'dashboard' | 'vault' | 'simulator' | 'profile' | 'privacy' | 'terms' | 'guide' | 'summary';
  mobileMenuOpen: boolean;
  isAssistantOpen: boolean;
  discovery: TaxAnalysisResult | null;
  activeDocumentId: string | null;
  documents: TaxDocument[];
  hasConsented: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setAppError: (error: string | null) => void;
  setIsOnline: (isOnline: boolean) => void;
  setCurrentView: (view: AppState['currentView']) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setIsAssistantOpen: (open: boolean) => void;
  setDiscovery: (discovery: TaxAnalysisResult | null) => void;
  setActiveDocumentId: (id: string | null) => void;
  setDocuments: (documents: TaxDocument[]) => void;
  setHasConsented: (consented: boolean) => void;
}

export const useStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  loading: true,
  appError: null,
  isOnline: navigator.onLine,
  currentView: 'landing',
  mobileMenuOpen: false,
  isAssistantOpen: false,
  discovery: null,
  activeDocumentId: null,
  documents: [],
  hasConsented: localStorage.getItem('taxbreaker_consent') === 'true',

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  setAppError: (appError) => set({ appError }),
  setIsOnline: (isOnline) => set({ isOnline }),
  setCurrentView: (currentView) => set({ currentView }),
  setMobileMenuOpen: (mobileMenuOpen) => set({ mobileMenuOpen }),
  setIsAssistantOpen: (isAssistantOpen) => set({ isAssistantOpen }),
  setDiscovery: (discovery) => set({ discovery }),
  setActiveDocumentId: (activeDocumentId) => set({ activeDocumentId }),
  setDocuments: (documents) => set({ documents }),
  setHasConsented: (hasConsented) => {
    localStorage.setItem('taxbreaker_consent', String(hasConsented));
    set({ hasConsented });
  },
}));
