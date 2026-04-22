import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lightbulb, ArrowRight, ShieldCheck, TrendingUp, AlertTriangle, Target, Zap } from 'lucide-react';
import { UserProfile, TaxAnalysisResult } from '../types';
import { cn } from '../lib/utils';

interface Tip {
  id: string;
  title: string;
  action: string;
  why: string;
  icon: React.ReactNode;
  relevance: (p: UserProfile) => boolean;
  priority?: 'High' | 'Medium' | 'Low';
  benefit?: number;
}

const STATIC_TIPS: Tip[] = [
  {
    id: 'nps-extra',
    title: 'NPS Tier 1 Strategic Alpha',
    action: 'Commit ₹50,000 annually to NPS (National Pension System).',
    why: 'Direct deduction under Section 80CCD(1B) lowers taxable income by ₹50k, saving ₹15.6k in the 30% bracket.',
    icon: <ShieldCheck className="w-5 h-5 text-gold" />,
    relevance: (p) => p.employmentType === 'Salaried' && (p.income || 0) > 750000,
    priority: 'High',
    benefit: 15600
  },
  {
    id: '80d-parents',
    title: 'Parental Health Shield',
    action: 'Pay for your parents\' health insurance directly via bank transfer.',
    why: 'Claim an additional ₹25,000 to ₹50,000 deduction under Section 80D.',
    icon: <ShieldCheck className="w-5 h-5 text-gold" />,
    relevance: (p) => (p.income || 0) > 500000,
    priority: 'Medium'
  },
  {
    id: 'tax-loss-harvesting',
    title: 'Tax Loss Harvesting',
    action: 'Sell underperforming assets to offset capital gains before March 31.',
    why: 'Directly reduces tax on realized gains. REF: Section 70/71.',
    icon: <AlertTriangle className="w-5 h-5 text-apple-warning" />,
    relevance: (p) => p.assets?.toLowerCase().includes('stock') || p.assets?.toLowerCase().includes('equity'),
    priority: 'High'
  }
];

export default function WealthTips({ 
  profile, 
  discovery 
}: { 
  profile: UserProfile, 
  discovery: TaxAnalysisResult | null 
}) {
  // Use AI action plan if available, otherwise fallback to static tips
  const aiTips = discovery?.actionPlan?.map(a => ({
    id: a.id,
    title: a.title,
    action: a.action,
    why: a.why,
    law: a.law,
    priority: a.priority,
    benefit: a.benefit,
    icon: <Zap className="w-5 h-5 text-gold" />
  })) || [];

  const relevantStaticTips = STATIC_TIPS.filter(tip => tip.relevance(profile)).map(t => ({
    ...t,
    priority: 'Medium' as const
  }));

  const displayTips = aiTips.length > 0 ? aiTips.slice(0, 3) : relevantStaticTips.slice(0, 3);

  if (displayTips.length === 0) return null;

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gold/10 text-gold rounded-lg animate-pulse">
            <Target className="w-4 h-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Personalized Tax Strategy</h2>
        </div>
        {aiTips.length > 0 && (
          <span className="text-[10px] bg-gold/10 text-gold px-3 py-1 rounded-full font-bold uppercase tracking-widest border border-gold/20">
            AI Generated • High Impact
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <AnimatePresence mode="wait">
          {displayTips.map((tip, idx) => (
            <motion.div
              key={tip.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: idx * 0.1 }}
              className="apple-card p-8 flex flex-col h-full hover:border-gold/30 transition-all duration-500 group relative overflow-hidden"
            >
              {tip.priority === 'High' && (
                <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 blur-[50px] -mr-16 -mt-16 group-hover:bg-gold/10 transition-colors" />
              )}
              
              <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 rounded-xl bg-apple-elevated flex items-center justify-center text-gold/60 group-hover:bg-gold group-hover:text-black transition-all">
                  {tip.icon || <ShieldCheck className="w-5 h-5" />}
                </div>
                <div className={cn(
                  "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest",
                  tip.priority === 'High' ? "bg-apple-error/10 text-apple-error" : 
                  tip.priority === 'Medium' ? "bg-gold/10 text-gold" : "bg-apple-info/10 text-apple-info"
                )}>
                  {tip.priority} Priority
                </div>
              </div>

              <h4 className="text-headline font-bold mb-4">{tip.title}</h4>
              
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-gold uppercase tracking-widest">Protocol</p>
                  <p className="text-body text-white font-medium">{tip.action}</p>
                </div>
                
                {tip.benefit && (
                  <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-apple-success uppercase tracking-widest mb-1">Projected Yield</p>
                    <p className="text-headline font-bold text-white">₹{tip.benefit.toLocaleString('en-IN')}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-apple-text-tertiary uppercase tracking-widest">Rationale</p>
                  <p className="text-subtext text-apple-text-secondary leading-relaxed font-normal">
                    {tip.why} {tip.law && <span className="text-gold opacity-60 ml-1">REF: {tip.law}</span>}
                  </p>
                </div>
              </div>

              <div className="pt-8 mt-auto flex items-center gap-2 text-gold group-hover:translate-x-2 transition-transform">
                <span className="text-[10px] font-bold uppercase tracking-widest">Execute Plan</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
