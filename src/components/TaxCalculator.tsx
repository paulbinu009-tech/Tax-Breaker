import * as React from 'react';
import * as d3 from 'd3';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calculator, 
  Zap, 
  TrendingUp, 
  Plus, 
  X, 
  AlertCircle 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile, TaxAnalysisResult } from '../types';
import { calculateTax } from '../lib/taxCalculations';
import { TAX_RULES } from '../config/taxRules';
import { SectionHeader } from './Common';

interface TaxCalculatorProps {
  profile: UserProfile;
  discovery: TaxAnalysisResult['extractedValues'] | null;
}

export default function TaxCalculator({ profile, discovery }: TaxCalculatorProps) {
  const [income, setIncome] = React.useState(profile.income || 0);
  const [isAdvanced, setIsAdvanced] = React.useState(false);
  const [discoveryApplied, setDiscoveryApplied] = React.useState(false);

  // Core Deduction States
  const [has80C, setHas80C] = React.useState(true);
  const [s80C, setS80C] = React.useState(0);

  const [has80D, setHas80D] = React.useState(false);
  const [s80D, setS80D] = React.useState(0);

  const [hasNPS, setHasNPS] = React.useState(false);
  const [nps, setNps] = React.useState(0);

  const [hasHomeLoan, setHasHomeLoan] = React.useState(false);
  const [section24, setSection24] = React.useState(0);

  const [hasHRA, setHasHRA] = React.useState(false);
  const [hra, setHra] = React.useState(0);

  // Advanced Deduction States
  const [lta, setLta] = React.useState(0);
  const [s80G, setS80G] = React.useState(0);
  const [s80EE, setS80EE] = React.useState(0);

  const applyDiscovery = () => {
    if (!discovery) return;
    if (discovery.salary) setIncome(discovery.salary || 0);
    if (discovery.section80C) {
      setHas80C(true);
      setS80C(discovery.section80C);
    }
    if (discovery.section80D) {
      setHas80D(true);
      setS80D(discovery.section80D);
    }
    if (discovery.nps) {
      setHasNPS(true);
      setNps(discovery.nps);
    }
    if (discovery.section24) {
      setHasHomeLoan(true);
      setSection24(discovery.section24);
    }
    if (discovery.hra) {
      setHasHRA(true);
      setHra(discovery.hra);
    }
    setDiscoveryApplied(true);
  };

  // Validation Engine
  const errors = React.useMemo(() => {
    const errs: Record<string, string | null> = {};
    if (income > 1000000000) errs.income = "Suspiciously high income detected (>₹100 Cr)";
    if (income < 10000 && income !== 0) errs.income = "Income below threshold for analysis (₹10,000)";
    
    if (has80D && s80D > 100000 && s80D <= 200000) errs.s80D = "Consider auditing. Standard limit is ₹1L.";
    if (has80D && s80D > 200000) errs.s80D = "Extremely high premium detected for 80D.";
    
    if (hasHRA && hra > income * 0.5) errs.hra = "HRA exceeds 50% of gross income. Non-standard.";
    
    if (isAdvanced && lta > 200000) errs.lta = "LTA exceeds typical limits (~₹2L). Verify with company policy.";
    if (isAdvanced && s80G > income * 0.1) errs.s80G = "Donations exceed 10% of income. Audit risk high.";

    const totalDeductions = (has80C ? s80C : 0) + (has80D ? s80D : 0) + (hasNPS ? nps : 0) + (hasHomeLoan ? section24 : 0) + (hasHRA ? hra : 0) + (isAdvanced ? (lta + s80G + s80EE) : 0);
    if (totalDeductions > income && income > 0) errs.global = "Total deductions exceed gross income. Results may be skewed.";

    return errs;
  }, [income, has80C, s80C, has80D, s80D, hasNPS, nps, hasHomeLoan, section24, hasHRA, hra, isAdvanced, lta, s80G, s80EE]);

  const [results, setResults] = React.useState<{ old: any, new: any } | null>(null);
  const [snapshots, setSnapshots] = React.useState<Array<{ name: string, results: any, inputs: any }>>([]);
  const [snapshotName, setSnapshotName] = React.useState("");

  const calculateResults = React.useCallback(() => {
    const deductions = {
      section80C: has80C ? s80C : 0,
      section80D: has80D ? s80D : 0,
      section80CCD1B: hasNPS ? nps : 0,
      section24: hasHomeLoan ? section24 : 0,
      hra: hasHRA ? hra : 0,
      lta: isAdvanced ? lta : 0,
      section80G: isAdvanced ? s80G : 0,
      section80EE: isAdvanced ? s80EE : 0
    };

    const oldResult = calculateTax(income, 'old', deductions);
    const newResult = calculateTax(income, 'new', deductions);
    return { old: oldResult, new: newResult };
  }, [income, has80C, s80C, has80D, s80D, hasNPS, nps, hasHomeLoan, section24, hasHRA, hra, isAdvanced, lta, s80G, s80EE]);

  React.useEffect(() => {
    setResults(calculateResults());
  }, [calculateResults]);

  const saveSnapshot = () => {
    if (!snapshotName) return;
    const currentInputs = { income, s80C, s80D, nps, section24, hra, lta, s80G, s80EE };
    setSnapshots([...snapshots, { name: snapshotName, results, inputs: currentInputs }]);
    setSnapshotName("");
  };

  const deleteSnapshot = (idx: number) => {
    setSnapshots(snapshots.filter((_, i) => i !== idx));
  };

  return (
    <div className="max-w-7xl mx-auto px-8 py-20">
      {/* Sticky Comparison Header */}
      {results && (
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          className="sticky top-24 z-30 mb-16 bg-apple-black/60 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-2xl"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex items-center gap-8">
               <div className="w-16 h-16 bg-apple-elevated rounded-2xl flex items-center justify-center border border-white/5">
                 <Calculator className="w-8 h-8 text-gold" />
               </div>
               <div>
                 <p className="small-caps text-apple-text-tertiary mb-1">Live Optimal Regime</p>
                 <h2 className="text-title font-bold text-white">
                   {results.old.totalTax < results.new.totalTax ? "Old Regime" : "New Regime"}
                 </h2>
               </div>
            </div>
            
            <div className="flex-1 max-w-md w-full px-8">
              <RegimeGauge oldTax={results.old.totalTax} newTax={results.new.totalTax} />
            </div>

            <div className="text-center md:text-right">
              <p className="small-caps text-apple-text-tertiary mb-1">Instant Savings</p>
              <p className="text-title font-bold text-apple-success">
                ₹{Math.abs(Math.round(results.old.totalTax - results.new.totalTax)).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {discovery && !discoveryApplied && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-12 overflow-hidden"
          >
            <div className="bg-gold p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6">
                 <div className="w-14 h-14 bg-black/10 rounded-full flex items-center justify-center">
                    <Zap className="w-6 h-6 text-black" />
                 </div>
                 <div>
                    <h3 className="text-headline font-bold text-black">Discovery Available</h3>
                    <p className="text-black/60 font-medium text-subtext">We found tax data in your Vault. Auto-fill the simulator?</p>
                 </div>
              </div>
              <div className="flex gap-4">
                 <button 
                   onClick={applyDiscovery}
                   className="h-12 px-8 bg-black text-white rounded-xl font-bold hover:shadow-2xl transition-all"
                 >
                   Apply Values
                 </button>
                 <button 
                   onClick={() => setDiscoveryApplied(true)}
                   className="h-12 px-6 bg-black/5 text-black rounded-xl font-bold hover:bg-black/10 transition-all border border-black/10"
                 >
                   Dismiss
                 </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-16">
        <SectionHeader title="Simulation Engine" icon={<Calculator className="w-4 h-4" />} />
        <div className="flex items-center gap-4 bg-apple-card px-6 py-3 rounded-2xl border border-white/5">
          <span className="small-caps text-apple-text-tertiary">Standard Deduction</span>
          <span className="text-body font-bold text-gold">Applied</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Input Panel */}
        <div className="lg:col-span-5 space-y-12">
          <AnimatePresence>
            {errors.global && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-6 bg-apple-error/10 border border-apple-error/20 rounded-[24px] flex items-start gap-4 text-apple-error"
              >
                <AlertCircle className="shrink-0 w-5 h-5 mt-0.5" />
                <p className="text-caption font-bold uppercase tracking-widest leading-loose">
                  Data Leak: {errors.global}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <section className="space-y-8">
            <span className="small-caps opacity-50 block">Income Baseline</span>
            <SimulatorField 
              label="Annual Gross Income (₹)"
              description="Your total salary/earnings before any taxes or deductions."
              value={income}
              onChange={setIncome}
              placeholder="e.g. 15,00,000"
              error={errors.income}
            />
          </section>

          <section className="space-y-10">
            <span className="small-caps opacity-50 block">Guided Optimization</span>
            
            <div className="space-y-10">
              {/* 80C */}
              <div className="space-y-6">
                <ConditionalToggle 
                  label="Do you invest in 80C instruments?"
                  description="EPF, PPF, ELSS, Life Insurance, Home Loan Principal."
                  active={has80C}
                  onToggle={setHas80C}
                />
                <AnimatePresence>
                  {has80C && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <SimulatorField 
                        label="Section 80C Total" 
                        value={s80C} 
                        onChange={setS80C} 
                        max={TAX_RULES.FY_2024_25.section80C.maxLimit}
                        placeholder="Upto ₹1.5L"
                        error={errors.s80C}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 80D */}
              <div className="space-y-6">
                <ConditionalToggle 
                  label="Health Insurance premium payments?"
                  description="Premiums for self, family or parents."
                  active={has80D}
                  onToggle={setHas80D}
                />
                <AnimatePresence>
                  {has80D && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <SimulatorField 
                        label="Section 80D Deduction" 
                        value={s80D} 
                        onChange={setS80D} 
                        placeholder="e.g. 25,000"
                        error={errors.s80D}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* NPS */}
              <div className="space-y-6">
                <ConditionalToggle 
                  label="Contributions to NPS?"
                  description="Additional deduction under Section 80CCD(1B)."
                  active={hasNPS}
                  onToggle={setHasNPS}
                />
                <AnimatePresence>
                  {hasNPS && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <SimulatorField 
                        label="NPS Voluntary Contribution" 
                        value={nps} 
                        onChange={setNps} 
                        max={TAX_RULES.FY_2024_25.section80CCD1B.maxLimit}
                        placeholder="Upto ₹50,000"
                        error={errors.nps}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Home Loan */}
              <div className="space-y-6">
                <ConditionalToggle 
                  label="Repaying a Home Loan?"
                  description="Interest portion of the EMI (Section 24)."
                  active={hasHomeLoan}
                  onToggle={setHasHomeLoan}
                />
                <AnimatePresence>
                  {hasHomeLoan && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <SimulatorField 
                        label="Interest on Housing Loan" 
                        value={section24} 
                        onChange={setSection24} 
                        max={TAX_RULES.FY_2024_25.section24.maxLimit}
                        placeholder="Upto ₹2L"
                        error={errors.section24}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* HRA */}
              <div className="space-y-6">
                <ConditionalToggle 
                  label="Do you receive HRA and pay Rent?"
                  description="Enter the estimated exempt HRA amount."
                  active={hasHRA}
                  onToggle={setHasHRA}
                />
                <AnimatePresence>
                  {hasHRA && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                      <SimulatorField 
                        label="Exempt HRA Amount" 
                        value={hra} 
                        onChange={setHra} 
                        placeholder="e.g. 1,20,000"
                        error={errors.hra}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </section>

          {/* Advanced Toggler */}
          <button 
            onClick={() => setIsAdvanced(!isAdvanced)}
            className="flex items-center gap-3 text-caption font-bold text-apple-text-tertiary uppercase tracking-widest hover:text-white transition-colors"
          >
            <Plus className={cn("w-4 h-4 transition-transform", isAdvanced && "rotate-45")} />
            {isAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}
          </button>

          <AnimatePresence>
            {isAdvanced && (
              <motion.section 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                exit={{ height: 0, opacity: 0 }}
                className="space-y-8 pt-4 border-t border-white/5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <SimulatorField 
                    label="Donations (80G)" 
                    value={s80G} 
                    onChange={setS80G} 
                    placeholder="Charitable donations"
                    error={errors.s80G}
                  />
                  <SimulatorField 
                    label="LTA" 
                    value={lta} 
                    onChange={setLta} 
                    placeholder="Leave Travel Allowance"
                    error={errors.lta}
                  />
                  <SimulatorField 
                    label="80EE / 80EEA" 
                    value={s80EE} 
                    onChange={setS80EE} 
                    max={TAX_RULES.FY_2024_25.section80EE.maxLimit}
                    placeholder="First home interest"
                    error={errors.s80EE}
                  />
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          <div className="pt-8 border-t border-white/5 space-y-6">
            <span className="small-caps opacity-50 block">Strategic Snapshot</span>
            <div className="flex gap-4">
              <input 
                type="text"
                value={snapshotName}
                onChange={(e) => setSnapshotName(e.target.value)}
                placeholder="Scenario Name (e.g. 'Optimized')"
                className="flex-1 bg-apple-elevated border border-white/5 h-14 rounded-xl px-6 outline-none focus:border-gold/30 text-subtext font-medium"
              />
              <button 
                onClick={saveSnapshot}
                disabled={!snapshotName}
                className="px-8 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed border border-white/5"
              >
                Snapshot
              </button>
            </div>
          </div>
        </div>
        
        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-16">
           {results ? (
             <div className="flex flex-col gap-10">
               <div className="bg-apple-card-elevated border border-gold/20 p-10 rounded-[40px] flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-gold/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                  <div className="relative z-10">
                    <span className="small-caps text-gold mb-3 block">Optimal Strategy</span>
                    <h3 className="text-large-title font-medium">
                      {results.old.totalTax < results.new.totalTax ? "Old Regime" : "New Regime"}
                    </h3>
                  </div>
                  <div className="relative z-10 text-center md:text-right">
                    <span className="small-caps text-apple-text-tertiary mb-3 block">Realized Savings</span>
                    <p className="text-large-title font-bold text-apple-success tracking-tight">
                      ₹{Math.abs(Math.round(results.old.totalTax - results.new.totalTax)).toLocaleString('en-IN')}
                    </p>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 <SimResultCard title="Old Regime" data={results.old} highlight={results.old.totalTax < results.new.totalTax} />
                 <SimResultCard title="New Regime" data={results.new} highlight={results.new.totalTax <= results.old.totalTax} />
               </div>
               
               <div className="space-y-12 pt-8">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-gold/10 text-gold rounded-lg">
                     <TrendingUp className="w-4 h-4" />
                   </div>
                   <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Slab Dynamics Analysis</h2>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-12">
                   <div className="apple-card p-10 space-y-8">
                     <div className="flex justify-between items-center">
                       <span className="small-caps text-apple-text-tertiary">Old Regime Distribution</span>
                       <span className="text-caption font-mono text-apple-text-secondary italic">Effective: {((results.old.totalTax/results.old.taxableIncome)*100 || 0).toFixed(1)}%</span>
                     </div>
                     <SlabVisualizer slabs={results.old.slabsUsed} taxableIncome={results.old.taxableIncome} />
                   </div>

                   <div className="apple-card p-10 space-y-8">
                     <div className="flex justify-between items-center">
                       <span className="small-caps text-apple-text-tertiary">New Regime Distribution</span>
                       <span className="text-caption font-mono text-apple-text-secondary italic">Effective: {((results.new.totalTax/results.new.taxableIncome)*100 || 0).toFixed(1)}%</span>
                     </div>
                     <SlabVisualizer slabs={results.new.slabsUsed} taxableIncome={results.new.taxableIncome} />
                   </div>
                 </div>
               </div>
             </div>
           ) : (
             <div className="h-full min-h-[600px] bg-apple-card border border-dashed border-white/10 rounded-[48px] flex flex-col items-center justify-center text-center p-12">
                <div className="w-24 h-24 bg-apple-elevated border border-white/5 rounded-full flex items-center justify-center mb-10">
                  <TrendingUp className="w-10 h-10 text-gold/40" />
                </div>
                <h3 className="text-headline font-bold mb-4">Ready for Analysis</h3>
                <p className="text-apple-text-tertiary text-body font-normal max-w-sm leading-relaxed">
                  Adjust the parameters to the left. We'll crunch the numbers across both regimes instantly.
                </p>
             </div>
           )}
        </div>
      </div>

      <AnimatePresence>
        {snapshots.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12 mt-32 pt-20 border-t border-white/5"
          >
            <div className="flex items-center justify-between">
              <SectionHeader title="Scenario Comparison" icon={<Zap className="w-4 h-4" />} />
              <button 
                onClick={() => setSnapshots([])}
                className="text-caption font-bold text-apple-error uppercase tracking-[0.2em] hover:opacity-70 transition-opacity"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {snapshots.map((snap, i) => {
                const savings = Math.abs(snap.results.old.totalTax - snap.results.new.totalTax);
                const betterRegime = snap.results.old.totalTax < snap.results.new.totalTax ? "Old" : "New";
                return (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="apple-card p-10 group relative border border-white/5 hover:border-gold/20 transition-all"
                  >
                    <div className="flex justify-between items-start mb-10">
                      <div>
                        <h4 className="text-headline font-bold mb-1 tracking-tight">{snap.name}</h4>
                        <p className="text-caption text-apple-text-tertiary font-mono tracking-widest opacity-60">
                          ₹{(snap.inputs.income/100000).toFixed(1)}L INCOME
                        </p>
                      </div>
                      <button 
                        onClick={() => deleteSnapshot(i)}
                        className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-apple-text-tertiary hover:text-apple-error md:opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[10px] font-bold text-apple-text-tertiary uppercase tracking-[0.2em] mb-2">Max Savings</p>
                        <p className="text-title font-bold text-apple-success tracking-tight">₹{Math.round(savings).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-apple-text-tertiary uppercase tracking-[0.2em] mb-2">Optimal</p>
                        <p className="text-body font-bold text-gold uppercase tracking-widest">{betterRegime}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RegimeGauge({ oldTax, newTax }: { oldTax: number, newTax: number }) {
  const d3Container = React.useRef(null);
  const total = oldTax + newTax;
  const oldPct = (oldTax / total) * 100 || 50;
  const newPct = (newTax / total) * 100 || 50;

  React.useEffect(() => {
    if (d3Container.current) {
      const svg = d3.select(d3Container.current);
      svg.selectAll("*").remove();

      const width = 400;
      const height = 12;
      const radius = 6;

      const g = svg.append("g");

      // Old Regime Bar (Left)
      g.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("rx", radius)
        .attr("fill", "rgba(255,255,255,0.05)");

      // Progress Clip
      const clipId = "bar-clip-" + Math.random().toString(36).substr(2, 9);
      svg.append("defs").append("clipPath")
        .attr("id", clipId)
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", (oldTax / (oldTax + newTax)) * width || width/2)
        .attr("height", height)
        .attr("rx", radius);

      g.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("rx", radius)
        .attr("fill", "#D4AF37")
        .attr("clip-path", `url(#${clipId})`)
        .style("opacity", 0.8);
        
      // Threshold Marker (Mid)
      g.append("line")
        .attr("x1", width/2)
        .attr("y1", -4)
        .attr("x2", width/2)
        .attr("y2", height + 4)
        .attr("stroke", "rgba(255,255,255,0.2)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,2");
    }
  }, [oldTax, newTax]);

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-apple-text-tertiary">
        <span>Old {Math.round(oldPct)}%</span>
        <span>New {Math.round(newPct)}%</span>
      </div>
      <svg
        ref={d3Container}
        className="w-full h-4 overflow-visible"
        viewBox="0 0 400 12"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}

function SlabVisualizer({ slabs, taxableIncome }: { slabs: any[], taxableIncome: number }) {
  const d3Container = React.useRef(null);

  React.useEffect(() => {
    if (d3Container.current && taxableIncome > 0) {
      const svg = d3.select(d3Container.current);
      svg.selectAll("*").remove();

      const width = 800;
      const height = 120;
      const margin = { top: 20, right: 20, bottom: 40, left: 20 };
      const innerWidth = width - margin.left - margin.right;
      
      const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

      // Filter out slabs with 0 amount to avoid cluttering but keep logic consistent
      const activeSlabs = slabs.filter(s => s.amount > 0);
      
      const x = d3.scaleLinear()
        .domain([0, taxableIncome])
        .range([0, innerWidth]);

      const colors = d3.scaleLinear<string>()
        .domain([0, 0.05, 0.1, 0.15, 0.2, 0.3])
        .range(["#D4AF3710", "#D4AF3720", "#D4AF3740", "#D4AF3760", "#D4AF3780", "#D4AF37"]);

      let currentX = 0;
      
      activeSlabs.forEach((slab, i) => {
        const slabWidth = x(slab.amount);
        const barHeight = 40;
        
        // Slab Rect
        const rect = g.append("rect")
          .attr("x", currentX)
          .attr("y", height/2 - barHeight/2)
          .attr("width", slabWidth)
          .attr("height", barHeight)
          .attr("fill", colors(slab.rate) as string)
          .attr("stroke", "rgba(255,255,255,0.05)")
          .attr("rx", 4);

        // Hover Effect
        rect.on("mouseenter", function() {
          d3.select(this).attr("stroke", "#D4AF37").attr("stroke-width", 2);
        }).on("mouseleave", function() {
          d3.select(this).attr("stroke", "rgba(255,255,255,0.05)").attr("stroke-width", 1);
        });

        // Slab Label (Rate)
        if (slabWidth > 40) {
          g.append("text")
            .attr("x", currentX + slabWidth/2)
            .attr("y", height/2 + 4)
            .attr("text-anchor", "middle")
            .attr("fill", "white")
            .attr("font-size", "10px")
            .attr("font-weight", "bold")
            .text(`${(slab.rate * 100).toFixed(0)}%`);
        }

        // Amount Label
        if (slabWidth > 60) {
          g.append("text")
            .attr("x", currentX + slabWidth/2)
            .attr("y", height/2 + barHeight + 15)
            .attr("text-anchor", "middle")
            .attr("fill", "rgba(255,255,255,0.4)")
            .attr("font-size", "9px")
            .attr("font-weight", "bold")
            .text(`₹${(slab.amount/1000).toFixed(0)}k`);
        }

        currentX += slabWidth;
      });

      // Axis Line
      g.append("line")
        .attr("x1", 0)
        .attr("y1", height/2 + 25)
        .attr("x2", innerWidth)
        .attr("y2", height/2 + 25)
        .attr("stroke", "rgba(255,255,255,0.1)");

    }
  }, [slabs, taxableIncome]);

  return (
    <div className="w-full overflow-x-auto no-scrollbar">
      <svg
        ref={d3Container}
        className="min-w-[500px] w-full h-[120px]"
        viewBox="0 0 800 120"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
}

function SimulatorField({ 
  label, 
  description, 
  value, 
  onChange, 
  max, 
  placeholder,
  error
}: { 
  label: string; 
  description?: string; 
  value: number; 
  onChange: (v: number) => void;
  max?: number;
  placeholder?: string;
  error?: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <label className={cn(
          "text-[10px] font-bold uppercase tracking-[0.2em]",
          error ? "text-apple-error" : "text-apple-text-tertiary"
        )}>{label}</label>
        {max && <span className="text-[10px] font-mono text-gold/60">Limit: ₹{max.toLocaleString('en-IN')}</span>}
      </div>
      <div className="relative group">
        <div className={cn(
          "absolute left-6 top-1/2 -translate-y-1/2 font-medium transition-colors",
          error ? "text-apple-error" : "text-apple-text-tertiary group-focus-within:text-gold"
        )}>₹</div>
        <input 
          type="number" 
          value={value || ''} 
          onChange={(e) => {
            const val = Number(e.target.value);
            if (val < 0) onChange(0);
            else if (max && val > max) onChange(max);
            else onChange(val);
          }}
          className={cn(
            "w-full bg-apple-elevated border h-16 rounded-[20px] pl-12 pr-6 outline-none text-body font-bold transition-all",
            error 
              ? "border-apple-error text-apple-error" 
              : "border-white/5 focus:border-gold/30 hover:border-white/10 text-white"
          )}
          placeholder={placeholder}
        />
        <AnimatePresence>
          {error && (
            <motion.p 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-2 text-[10px] font-bold text-apple-error uppercase tracking-widest flex items-center gap-2"
            >
              <AlertCircle size={12} /> {error}
            </motion.p>
          )}
        </AnimatePresence>
        {!error && description && <p className="mt-2 text-[10px] text-apple-text-tertiary/60 italic">{description}</p>}
      </div>
    </div>
  );
}

function ConditionalToggle({ 
  label, 
  description, 
  active, 
  onToggle 
}: { 
  label: string; 
  description: string; 
  active: boolean; 
  onToggle: (v: boolean) => void 
}) {
  return (
    <div className="flex items-start justify-between gap-6 group">
      <div className="space-y-1">
        <label className="text-body font-bold text-white group-hover:text-gold transition-colors">{label}</label>
        <p className="text-caption text-apple-text-tertiary font-medium">{description}</p>
      </div>
      <div className="flex bg-apple-card p-1 rounded-xl border border-white/5">
        <button 
          onClick={() => onToggle(true)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-caption font-bold transition-all",
            active ? "bg-white text-black shadow-lg" : "text-apple-text-tertiary hover:text-white"
          )}
        >
          YES
        </button>
        <button 
          onClick={() => onToggle(false)}
          className={cn(
            "px-4 py-1.5 rounded-lg text-caption font-bold transition-all",
            !active ? "bg-white/10 text-white" : "text-apple-text-tertiary hover:text-white"
          )}
        >
          NO
        </button>
      </div>
    </div>
  );
}

function SimResultCard({ title, data, highlight }: { title: string, data: any, highlight: boolean }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "apple-card flex flex-col h-full border-2",
        highlight ? "border-gold/30 bg-gold/[0.02]" : "border-white/5"
      )}
    >
      <div className="p-8 border-b border-white/5 flex justify-between items-center">
        <h4 className="text-headline font-bold">{title}</h4>
        {highlight && <span className="text-[10px] font-bold px-3 py-1 bg-gold text-black rounded-full uppercase tracking-widest">Optimized</span>}
      </div>
      <div className="p-8 flex-1 space-y-8">
        <div className="space-y-2">
          <p className="text-caption font-bold text-apple-text-tertiary uppercase tracking-widest">Total Liability</p>
          <p className={cn("text-title font-bold", highlight ? "text-gold" : "text-white")}>₹{Math.round(data.totalTax).toLocaleString('en-IN')}</p>
        </div>
        <div className="space-y-4">
          <p className="text-caption font-bold text-apple-text-tertiary uppercase tracking-widest">Slab Breakdown</p>
          <div className="space-y-3">
             {data.slabsUsed.map((s: any, i: number) => (
               <div key={i} className="flex justify-between text-subtext">
                 <span className="text-apple-text-secondary">{s.slab} ({s.rate}%)</span>
                 <span className="font-mono">₹{Math.round(s.tax).toLocaleString('en-IN')}</span>
               </div>
             ))}
          </div>
        </div>
      </div>
      <div className="p-8 bg-white/[0.02] border-t border-white/5 text-center">
         <p className="text-caption font-bold text-apple-text-tertiary">Effective Rate: {((data.totalTax/data.taxableIncome)*100 || 0).toFixed(1)}%</p>
      </div>
    </motion.div>
  );
}
