import * as React from 'react';
import { motion } from 'motion/react';
import { Check, ChevronRight, ClipboardList, Shield, Info } from 'lucide-react';
import { cn } from '../lib/utils';
import { FilingStep } from '../types';

const FILING_STEPS: FilingStep[] = [
  {
    id: 'pan-linked',
    title: 'PAN Linked',
    description: 'Ensure your Permanent Account Number is active and properly mapped.',
    details: [
      'Verify PAN status on e-filing portal.',
      'Check if PAN is linked with your primary bank account.'
    ]
  },
  {
    id: 'aadhaar-linked',
    title: 'Aadhaar Linked',
    description: 'Aadhaar-PAN linking is mandatory for ITR processing.',
    details: [
      'Check linking status on IT portal.',
      'Ensure mobile number is linked with Aadhaar for OTP verification.'
    ]
  },
  {
    id: 'verify-26as',
    title: 'Form 26AS Verified',
    description: 'Ensure TDS/TCS reflected on the income tax portal matches your records.',
    details: [
      'Download Form 26AS from TRACES portal.',
      'Review Annual Information Statement (AIS) for all financial transactions.',
      'Check Taxpayer Information Summary (TIS) for summarized data.'
    ]
  },
  {
    id: 'collect-proofs',
    title: 'Deductions Complete',
    description: 'Gather and verify all evidence for Chapter VI-A deductions.',
    details: [
      '80C: LIC, PPF, ELSS, School Fees, Principal on Home Loan.',
      '80D: Health insurance premium receipts for self and parents.',
      'Section 24: Interest certificate from lender for home loan.'
    ]
  },
  {
    id: 'choose-regime',
    title: 'Final Regime Selection',
    description: 'Perform a final comparison between Old and New Tax Regimes.',
    details: [
      'Use the TaxBreaker Simulator for precision comparison.',
      'Evaluate if forgone exemptions in New Regime outweigh lower rates.',
      'Remember: Default is now New Regime (FY 2024-25).'
    ]
  },
  {
    id: 'capital-gains',
    title: 'Declare Capital Gains',
    description: 'Report sales of property, stocks, or mutual funds.',
    details: [
      'Calculate Long Term vs Short Term Capital Gains.',
      'Gather broker statements for equity transactions.',
      'Consider set-off and carry-forward of losses.'
    ]
  },
  {
    id: 'bank-verification',
    title: 'Bank Account Pre-validation',
    description: 'Verify your bank account for seamless refund processing.',
    details: [
      'Ensure account is pre-validated on the IT portal.',
      'Check if PAN is linked with the bank account.',
      'Confirm the account is active.'
    ]
  }
];

export default function FilingGuide({ 
  completedIds, 
  onToggle 
}: { 
  completedIds: string[], 
  onToggle: (id: string) => void 
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const coreSteps = ['pan-linked', 'aadhaar-linked', 'verify-26as', 'collect-proofs'];
  const completedCore = coreSteps.filter(id => completedIds.includes(id));
  const readinessScore = Math.round((completedCore.length / coreSteps.length) * 100);

  const getStatus = () => {
    if (completedCore.length === coreSteps.length) return { label: 'Ready', color: 'bg-apple-success text-black' };
    
    const criticalMissing = ['pan-linked', 'aadhaar-linked'].some(id => !completedIds.includes(id));
    if (criticalMissing || completedCore.length === 0) return { label: 'Missing', color: 'bg-apple-error text-white' };
    
    return { label: 'At Risk', color: 'bg-apple-warning text-black' };
  };

  const status = getStatus();

  return (
    <div className="max-w-4xl mx-auto px-8 py-20 pb-40">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-teal/10 rounded-xl flex items-center justify-center text-teal">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-title font-bold tracking-tight">Filing Preparation Protocol</h1>
            <p className="text-apple-text-tertiary text-subtext uppercase tracking-widest font-bold mt-1">Audit-Ready Workflow</p>
          </div>
        </div>
        <div className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest", status.color)}>
          Status: {status.label}
        </div>
      </div>

      <div className="apple-card mt-12 p-10 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-10 opacity-5">
           <Shield className="w-32 h-32 text-teal" />
        </div>
        
        <div className="flex justify-between items-end mb-8">
           <div>
              <p className="text-small-caps mb-2">Readiness Score</p>
              <h2 className="text-large-title font-bold text-white">{readinessScore}%</h2>
           </div>
           <div className="text-right">
              <p className="text-caption text-apple-text-tertiary font-bold uppercase tracking-widest mb-2">Mandates Verified</p>
              <p className="text-subtext font-medium">{completedCore.length} of {coreSteps.length} Critical Checks</p>
           </div>
        </div>

        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
           <motion.div 
             initial={{ width: 0 }}
             animate={{ width: `${readinessScore}%` }}
             className="h-full bg-teal shadow-[0_0_12px_rgba(0,128,128,0.4)]"
           />
        </div>
      </div>

      <div className="mt-16 space-y-4">
        {FILING_STEPS.map((step, index) => {
          const isDone = completedIds.includes(step.id);
          const isExpanded = expandedId === step.id;

          return (
            <div 
              key={step.id}
              className={cn(
                "apple-card p-0 overflow-hidden transition-all duration-500",
                isExpanded ? "border-teal/30 bg-teal/[0.02]" : "hover:bg-white/[0.02]"
              )}
            >
              <div 
                onClick={() => setExpandedId(isExpanded ? null : step.id)}
                className="p-8 flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-6">
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(step.id);
                    }}
                    className={cn(
                      "w-8 h-8 rounded-full border flex items-center justify-center transition-all duration-500",
                      isDone 
                        ? "bg-apple-success border-apple-success text-black scale-110 shadow-[0_0_12px_rgba(48,209,88,0.3)]" 
                        : "border-white/20 hover:border-teal"
                    )}
                  >
                    {isDone && <Check className="w-5 h-5 stroke-[3px]" />}
                  </div>
                  <div>
                    <h3 className={cn(
                      "text-headline font-bold transition-colors",
                      isDone ? "text-apple-text-tertiary line-through" : "text-white"
                    )}>
                      {index + 1}. {step.title}
                    </h3>
                    <p className="text-subtext text-apple-text-secondary mt-1">{step.description}</p>
                  </div>
                </div>
                <ChevronRight className={cn(
                  "w-5 h-5 text-apple-text-tertiary transition-transform duration-500",
                  isExpanded && "rotate-90 text-teal"
                )} />
              </div>

              {isExpanded && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="px-8 pb-8 border-t border-white/5 pt-8"
                >
                  <div className="space-y-4">
                    {step.details.map((detail, dIdx) => (
                      <div key={dIdx} className="flex gap-4">
                        <div className="w-1.5 h-1.5 rounded-full bg-teal shrink-0 mt-2" />
                        <p className="text-body text-apple-text-secondary leading-relaxed">{detail}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-8 border-t border-white/5 flex items-center gap-3">
                    <Info className="w-4 h-4 text-teal" />
                    <p className="text-caption text-apple-text-tertiary italic">
                      Verify these records against your bank statements for 100% audit durability.
                    </p>
                  </div>
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-20 apple-card p-12 text-center bg-apple-elevated/50 border border-white/5">
        <Shield className="w-12 h-12 text-teal/20 mx-auto mb-6" />
        <h3 className="text-headline font-bold mb-4">Precision Compliance Achieved?</h3>
        <p className="text-body text-apple-text-secondary mb-10 max-w-sm mx-auto">
          Once all mandates are verified, you are ready to transmit your digital tax profile to the ITR portal.
        </p>
        <button 
          onClick={() => window.open('https://www.incometax.gov.in/', '_blank')}
          className="premium-btn-secondary px-12"
        >
          Access E-Filing Portal
        </button>
      </div>
    </div>
  );
}
