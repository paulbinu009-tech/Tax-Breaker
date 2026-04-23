export interface OptimizationStep {
  id: string;
  title: string;
  action: string;
  why: string;
  law: string;
  benefit: number;
  priority: 'High' | 'Medium' | 'Low';
  done: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  onboardingComplete: boolean;
  country?: string;
  employmentType?: string;
  income?: number;
  assets?: string;
  goals: string[];
  taxScore?: number;
  completedStepIds?: string[];
  completedFilingStepIds?: string[];
  deductions?: TaxDeductions;
  lastAnalysis?: TaxAnalysisResult;
}

export interface FilingStep {
  id: string;
  title: string;
  description: string;
  details: string[];
}

export interface TaxDeductions {
  section80C?: number;
  section80D?: number;
  section80CCD1B?: number;
  section24?: number;
  hra?: number;
  lta?: number;
  section80G?: number;
  section80EE?: number;
  otherDeductions?: number;
}

export interface TaxCalculationResult {
  taxableIncome: number;
  taxBeforeCess: number;
  surcharge: number;
  cess: number;
  totalTax: number;
  rebate: number;
  slabsUsed: Array<{
    slab: string;
    rate: number;
    amount: number;
    tax: number;
  }>;
  standardDeduction: number;
}

export interface TaxAnalysisResult {
  optimizationOpportunities: Array<{
    title: string;
    description: string;
    lawReference: string;
    confidence: number;
    impact: "High" | "Medium" | "Low";
  }>;
  actionPlan: Array<{
    id: string;
    title: string;
    action: string;
    why: string;
    law: string;
    benefit: number;
    priority: "High" | "Medium" | "Low";
  }>;
  extractedValues?: {
    salary?: number;
    tds?: number;
    section80C?: number;
    section80D?: number;
    section24?: number;
    hra?: number;
    nps?: number;
  };
  complianceGaps: Array<{
    title: string;
    description: string;
    riskLevel: "High" | "Medium" | "Low";
    action: string;
  }>;
  auditRiskScore: number;
  missedDeductions: string[];
  nextBestAction: {
    title: string;
    description: string;
    potentialSavings: number;
  };
  reasoning: string;
}

export interface TaxDocument {
  id: string;
  userId: string;
  name: string;
  type: string;
  size: number;
  status: 'pending' | 'processing' | 'parsed' | 'error';
  category?: string;
  createdAt: number;
  analysis?: TaxAnalysisResult;
}
