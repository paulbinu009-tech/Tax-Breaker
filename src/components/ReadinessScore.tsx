import * as React from 'react';
import { motion } from 'motion/react';
import { Shield, CheckCircle2, AlertCircle, Circle, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export interface ReadinessScoreProps {
  completedStepIds: string[];
  onOpenGuide: () => void;
}

export default function ReadinessScore({ completedStepIds, onOpenGuide }: ReadinessScoreProps) {
  const coreSteps = [
    { id: 'pan-linked', label: 'PAN Linked' },
    { id: 'aadhaar-linked', label: 'Aadhaar Linked' },
    { id: 'verify-26as', label: 'Form 26AS Verified' },
    { id: 'collect-proofs', label: 'Deductions Complete' },
  ];

  const completedCore = coreSteps.filter(step => completedStepIds.includes(step.id));
  const score = Math.round((completedCore.length / coreSteps.length) * 100);

  const getStatus = () => {
    if (score === 100) return { label: 'Ready', color: 'text-apple-success', icon: <CheckCircle2 className="w-5 h-5 text-apple-success" /> };
    
    const criticalMissing = ['pan-linked', 'aadhaar-linked'].some(id => !completedStepIds.includes(id));
    if (criticalMissing || completedCore.length === 0) return { label: 'Missing', color: 'text-apple-error', icon: <AlertCircle className="w-5 h-5 text-apple-error" /> };
    
    return { label: 'At Risk', color: 'text-apple-warning', icon: <AlertCircle className="w-5 h-5 text-apple-warning" /> };
  };

  const status = getStatus();

  return (
    <div 
      onClick={onOpenGuide}
      className="apple-card-elevated group cursor-pointer hover:border-gold/30 transition-all duration-500"
    >
      <div className="p-8 space-y-8">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <span className="small-caps text-apple-text-tertiary">Filing Readiness Score</span>
            <div className="flex items-center gap-3">
              <h3 className="text-large-title font-bold text-white">{score}%</h3>
              <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-widest", 
                status.label === 'Ready' ? 'border-apple-success/20 bg-apple-success/5' : 
                status.label === 'Missing' ? 'border-apple-error/20 bg-apple-error/5' : 'border-apple-warning/20 bg-apple-warning/5'
              )}>
                {status.icon}
                <span className={status.color}>{status.label}</span>
              </div>
            </div>
          </div>
          <div className="w-12 h-12 bg-apple-elevated rounded-2xl flex items-center justify-center text-gold/40 group-hover:text-gold transition-colors">
            <Shield className="w-6 h-6" />
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-caption font-bold uppercase tracking-[0.2em] text-white/40">Checklist Sequence</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coreSteps.map((step) => {
              const checked = completedStepIds.includes(step.id);
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div className={cn(
                    "w-5 h-5 rounded-full border flex items-center justify-center transition-all",
                    checked ? "bg-apple-success border-apple-success text-black" : "border-white/10 text-white/5"
                  )}>
                    {checked ? <Check className="w-3 h-3 stroke-[4px]" /> : <Circle className="w-3 h-3" />}
                  </div>
                  <span className={cn("text-subtext font-medium", checked ? "text-white" : "text-apple-text-tertiary")}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex items-center justify-between">
           <span className="text-[10px] font-bold text-apple-text-tertiary uppercase tracking-widest">Mandatory Compliance Path</span>
           <span className="text-gold text-[10px] font-bold uppercase tracking-widest group-hover:translate-x-1 transition-transform inline-flex items-center gap-2">
             Configure Protocol <Shield className="w-3 h-3" />
           </span>
        </div>
      </div>
    </div>
  );
}
