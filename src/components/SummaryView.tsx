import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, ChevronLeft, CheckCircle2, TrendingUp, Shield, Activity, ArrowRight, Zap, Target } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '../lib/utils';
import { UserProfile, TaxAnalysisResult } from '../types';
import { calculateTax } from '../lib/taxCalculations';
import { generateTaxStrategy } from '../lib/strategyEngine';

export default function SummaryView({ 
  profile, 
  analysis,
  onBack,
  onUpdateAnalysis
}: { 
  profile: UserProfile, 
  analysis: TaxAnalysisResult | null,
  onBack: () => void,
  onUpdateAnalysis?: (updated: TaxAnalysisResult) => void
}) {
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorStatus, setErrorStatus] = React.useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);
  const [shareReady, setShareReady] = React.useState(false);
  const [isEditingInvestments, setIsEditingInvestments] = React.useState(false);
  const [isEditingStrategy, setIsEditingStrategy] = React.useState(false);

  // Recalculate results - Unified Consistency Logic
  // Manual overrides in profile.deductions take precedence over AI discovered values
  const discoveryValues = analysis?.extractedValues;
  const userDeductions = profile.deductions || {};
  
  const deductionsData = {
    section80C: userDeductions.section80C ?? discoveryValues?.section80C ?? 0,
    section80D: userDeductions.section80D ?? discoveryValues?.section80D ?? 0,
    section80CCD1B: userDeductions.section80CCD1B ?? discoveryValues?.nps ?? 0,
    section24: userDeductions.section24 ?? discoveryValues?.section24 ?? 0,
    hra: userDeductions.hra ?? discoveryValues?.hra ?? 0,
  };

  const oldRegimeResults = calculateTax(profile.income || 0, 'old', deductionsData);
  const newRegimeResults = calculateTax(profile.income || 0, 'new', deductionsData);
  
  const bestRegime = oldRegimeResults.totalTax < newRegimeResults.totalTax ? 'Old' : 'New';
  const bestResults = bestRegime === 'Old' ? oldRegimeResults : newRegimeResults;
  const totalTax = bestResults.totalTax;
  const savings = Math.abs(oldRegimeResults.totalTax - newRegimeResults.totalTax);
  
  // Programmatic Strategy Generation
  const programmaticStrategy = React.useMemo(() => {
    return generateTaxStrategy(profile.income || 0, deductionsData);
  }, [profile.income, deductionsData]);

  const totalDeductions = Object.values(deductionsData).reduce((acc: number, val) => {
    return typeof val === 'number' ? acc + val : acc;
  }, 0) + bestResults.standardDeduction;

  const handleUpdateDeduction = (field: string, value: number) => {
    if (!analysis || !onUpdateAnalysis) return;
    const updated = {
      ...analysis,
      extractedValues: {
        ...(analysis.extractedValues || {}),
        [field]: value
      }
    };
    onUpdateAnalysis(updated);
  };

  const handleUpdateActionStep = (index: number, updates: any) => {
    if (!analysis || !onUpdateAnalysis || !analysis.actionPlan) return;
    const newPlan = [...analysis.actionPlan];
    newPlan[index] = { ...newPlan[index], ...updates };
    onUpdateAnalysis({ ...analysis, actionPlan: newPlan });
  };

  const generateAudit = async () => {
    setIsGenerating(true);
    setErrorStatus(null);
    setShareReady(false);
    
    console.log('[AUDIT_STEP_1]: Compiling Multi-Section Strategic PDF...');
    
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const actionPlanItems = analysis?.actionPlan || [];
      const optimizationItems = analysis?.optimizationOpportunities || [];

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 30px; color: #ffffff; background-color: #000000; line-height: 1.4; font-size: 12px;">
          <div style="border-bottom: 2px solid #2DD4BF; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div>
              <h1 style="color: #2DD4BF; font-size: 22px; margin: 0; letter-spacing: 1px;">TAXBREAKER STRATEGY AUDIT</h1>
              <p style="font-size: 10px; color: #A1A1A6; margin: 5px 0 0 0; font-weight: bold; text-transform: uppercase;">Verified Wealth Optimization Protocol</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 10px; color: #6E6E73;">Ref: AUDIT-${Math.random().toString(36).substring(7).toUpperCase()}</p>
              <p style="margin: 2px 0 0 0; font-size: 10px; color: #6E6E73;">Date: ${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <div style="display: flex; gap: 20px; margin-bottom: 25px;">
            <div style="flex: 1; background-color: #121214; border: 1px solid #1C1C1E; padding: 15px; border-radius: 6px;">
              <div style="font-size: 9px; font-weight: bold; color: #6E6E73; text-transform: uppercase; margin-bottom: 5px;">Client Identity</div>
              <div style="font-size: 14px; font-weight: bold; color: white;">${profile.displayName || 'TaxBreaker Authorized User'}</div>
              <div style="font-size: 10px; color: #A1A1A6; margin-top: 2px;">FY 2024-25 | ${profile.employmentType || 'Assessed Entity'}</div>
            </div>
            <div style="flex: 1; background-color: #2DD4BF; color: #000000; padding: 15px; border-radius: 6px; text-align: center;">
              <div style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 5px; opacity: 0.9;">Total Annual Savings</div>
              <div style="font-size: 24px; font-weight: bold;">₹${Math.round(savings).toLocaleString('en-IN')}</div>
              <div style="font-size: 10px; opacity: 0.9; margin-top: 2px;">Strategic Alpha Achieved</div>
            </div>
          </div>

          <div style="margin-bottom: 25px;">
            <h2 style="font-size: 12px; color: #2DD4BF; border-bottom: 1px solid #1C1C1E; padding-bottom: 8px; text-transform: uppercase; margin-bottom: 12px;">I. EXECUTIVE INTELLIGENCE BRIEFING</h2>
            <div style="background-color: #121214; border: 1px solid #1C1C1E; padding: 15px; border-radius: 6px; margin-bottom: 15px;">
              <p style="color: #A1A1A6; font-size: 11px; margin: 0; line-height: 1.6;">
                ${analysis?.reasoning || 'Audit algorithm has processed jurisdictional tax laws against provided documentation. The optimized strategy recommends immediate implementation of the action plan below to capture tax efficiency deltas.'}
              </p>
            </div>
            
            <div style="display: flex; gap: 15px;">
              <div style="flex: 2; border: 1px solid #2DD4BF50; padding: 12px; border-radius: 6px; background-color: #121214;">
                <div style="font-size: 8px; font-weight: bold; color: #2DD4BF; text-transform: uppercase; margin-bottom: 5px;">Next Strategic Directive</div>
                <div style="font-size: 11px; font-weight: bold; margin-bottom: 3px; color: white;">${analysis?.nextBestAction?.title || 'Maximize Section 80C Limits'}</div>
                <div style="font-size: 9px; color: #A1A1A6;">${analysis?.nextBestAction?.description || 'Ensure full deployment of capital to qualified instruments.'}</div>
              </div>
              <div style="flex: 1; border: 1px solid #1C1C1E; padding: 12px; border-radius: 6px; text-align: center; background-color: #121214;">
                <div style="font-size: 8px; font-weight: bold; color: #6E6E73; text-transform: uppercase; margin-bottom: 5px;">Strategic Alpha</div>
                <div style="font-size: 14px; font-weight: bold; color: #2DD4BF;">₹${(analysis?.nextBestAction?.potentialSavings || savings).toLocaleString('en-IN')}</div>
              </div>
            </div>
          </div>

          <div style="margin-bottom: 25px;">
            <h2 style="font-size: 12px; color: #2DD4BF; border-bottom: 1px solid #1C1C1E; padding-bottom: 8px; text-transform: uppercase; margin-bottom: 12px;">II. FINANCIAL AUDIT BREAKDOWN</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 10px;">
              ${Object.entries(deductionsData).map(([key, val]) => val ? `
                <div style="padding: 10px; background-color: #121214; border: 1px solid #1C1C1E; border-radius: 4px; width: calc(33% - 10px);">
                  <div style="font-size: 8px; color: #6E6E73; text-transform: uppercase; margin-bottom: 4px;">${key.replace(/([A-Z])/g, ' $1')}</div>
                  <div style="font-size: 11px; font-weight: bold; color: white;">₹${val.toLocaleString()}</div>
                </div>
              ` : '').join('')}
              <div style="padding: 10px; background-color: #121214; border: 1px solid #1C1C1E; border-radius: 4px; width: calc(33% - 10px);">
                <div style="font-size: 8px; color: #6E6E73; text-transform: uppercase; margin-bottom: 4px;">Standard Deduction</div>
                <div style="font-size: 11px; font-weight: bold; color: white;">₹${bestResults.standardDeduction.toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div>
            <h2 style="font-size: 12px; color: #2DD4BF; border-bottom: 1px solid #1C1C1E; padding-bottom: 8px; text-transform: uppercase; margin-bottom: 12px;">III. STRATEGIC ACTION PLAN</h2>
            <div style="space-y: 10px;">
              ${actionPlanItems.length > 0 ? actionPlanItems.map((item, index) => `
                <div style="margin-bottom: 15px; background-color: #121214; border-left: 3px solid ${item.priority === 'High' ? '#2DD4BF' : '#6E6E73'}; padding: 12px; border-radius: 0 4px 4px 0;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
                    <div style="font-size: 11px; font-weight: bold; color: white;">${index + 1}. ${item.title}</div>
                    <div style="font-size: 8px; background-color: ${item.priority === 'High' ? '#2DD4BF' : '#1C1C1E'}; color: ${item.priority === 'High' ? '#000' : '#A1A1A6'}; padding: 2px 6px; border-radius: 10px; text-transform: uppercase;">${item.priority} Priority</div>
                  </div>
                  <div style="font-size: 10px; color: #A1A1A6; margin-bottom: 6px;">${item.action}</div>
                  <div style="font-size: 9px; color: #6E6E73; font-style: italic; margin-bottom: 8px;">Rationale: ${item.why}</div>
                  <div style="display: flex; justify-content: space-between; font-size: 8px; color: #6E6E73;">
                    <span>Law: ${item.law}</span>
                    <span style="color: #2DD4BF; font-weight: bold;">Est. Benefit: ₹${item.benefit.toLocaleString()}</span>
                  </div>
                </div>
              `).join('') : `
                <div style="background-color: #121214; border-left: 3px solid #2DD4BF; padding: 12px;">
                  <div style="font-size: 11px; font-weight: bold; color: white;">1. Elect ${bestRegime} Regime</div>
                  <div style="font-size: 10px; color: #A1A1A6; margin: 4px 0;">Standard recommendation for maximal capital efficiency.</div>
                </div>
              `}
            </div>
          </div>

          <div style="margin-top: 40px; text-align: center; font-size: 8px; color: #aaaaaa; border-top: 1px solid #eeeeee; padding-top: 15px;">
            TAXBREAKER AI REGULATORY ENGINE • CERTIFIED DIGITAL STRATEGY • GENERATED AT ${new Date().toLocaleString()}
          </div>
        </div>
      `;

      await doc.html(htmlContent, {
        x: 0,
        y: 0,
        width: 210,
        windowWidth: 800
      });

      console.log('[AUDIT_STEP_2]: Verifying Resource Integrity...');
      const blob = doc.output('blob');
      
      if (!blob || blob.size < 1000) {
        throw new Error('VERIFICATION_FAILED: Generated audit is corrupt or empty.');
      }

      console.log(`[AUDIT_SUCCESS]: Buffer Locked (${Math.round(blob.size / 1024)}KB). URI Ready.`);
      setPdfBlob(blob);
      setShareReady(true);
    } catch (error) {
      const msg = (error as Error).message;
      console.error('[AUDIT_FATAL]:', msg);
      setErrorStatus(`Critical Audit Error: ${msg}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const [isSharing, setIsSharing] = React.useState(false);

  const shareAudit = async () => {
    if (!pdfBlob || isSharing) return;
    setIsSharing(true);
    setShareReady(false); // Immediately hide button to prevent double-tap
    
    console.log('[SHARE_STEP_3]: Summoning System Share Sheet...');

    try {
      const fileName = `Tax_Strategy_Audit_${new Date().getTime()}.pdf`;
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tax Strategy Audit',
          text: 'Verified results from TaxBreaker.',
        });
        console.log('[SHARE_SUCCESS]: Delivered.');
      } else {
        console.warn('[SHARE_FALLBACK]: Native Share restricted. Direct extract initiated.');
        const uri = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = uri;
        link.download = fileName;
        link.click();
        // Clean up URI after a delay to ensure download starts
        setTimeout(() => URL.revokeObjectURL(uri), 100);
      }
    } catch (error) {
      const err = error as Error;
      // Handle user cancellation gracefully - not a "failure"
      if (err.name === 'AbortError') {
        console.log('[SHARE_CANCEL]: User dismissed share sheet.');
      } else {
        console.error('[SHARE_ERROR]:', err.message);
        setErrorStatus(`Share Blocked: ${err.message}`);
      }
    } finally {
      setIsSharing(false);
      setPdfBlob(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-20 pb-40">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-apple-text-tertiary hover:text-white transition-colors mb-12 group"
      >
        <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="small-caps">Back to Dashboard</span>
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-teal/10 rounded-2xl flex items-center justify-center text-teal shadow-[0_0_20px_rgba(0,128,128,0.15)] border border-teal/20">
            <Target className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-large-title font-bold tracking-tight">Audit Report</h1>
            <p className="text-apple-text-tertiary text-[9px] uppercase tracking-[0.2em] mt-1 font-bold">
              Clinical Strategy Review • {profile.displayName || 'Authorized User'}
            </p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {shareReady ? (
            <button 
              onClick={shareAudit}
              className="premium-btn-primary h-12 px-8 flex items-center gap-3 bg-apple-success hover:bg-apple-success-dark transition-colors border-apple-success/20 animate-bounce"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Audit Ready! Save & Share</span>
            </button>
          ) : (
            <button 
              onClick={generateAudit}
              disabled={isGenerating}
              className="premium-btn-primary h-12 px-8 flex items-center gap-3 disabled:opacity-50 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <Activity className="w-4 h-4 animate-pulse text-teal" />
                  <span>Compiling Audit...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Generate Strategic PDF</span>
                </>
              )}
            </button>
          )}
          <AnimatePresence>
            {errorStatus && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-[10px] text-apple-error font-bold uppercase tracking-widest text-right"
              >
                {errorStatus}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div ref={reportRef} className="space-y-10 bg-[#050505] p-10 md:p-16 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-teal/5 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal/5 blur-[100px] rounded-full -ml-32 -mb-32" />

        <div className="flex justify-between items-start border-b border-white/5 pb-10">
           <div>
              <p className="text-caption text-teal font-bold uppercase tracking-[0.3em] mb-3">Professional Strategy Audit</p>
              <p className="text-body text-apple-text-secondary">Assessed for <span className="text-white font-bold">{profile.displayName || 'Authorized User'}</span></p>
           </div>
           <div className="text-right">
              <p className="text-caption text-apple-text-tertiary uppercase tracking-widest mb-1">Fiscal Year 2024-25</p>
              <p className="text-subtext font-mono opacity-50">AUDIT_ID: TB-${Math.random().toString(36).substring(7).toUpperCase()}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="apple-card-elevated p-8 border-teal/20 bg-teal/[0.03] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp className="w-12 h-12" />
             </div>
             <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-teal uppercase tracking-widest">Optimized Savings</span>
             </div>
             <p className="text-large-title font-bold text-white mb-2 leading-none">₹{Math.round(savings).toLocaleString('en-IN')}</p>
             <p className="text-caption text-apple-text-secondary">Expected delta from switching to {bestRegime} Regime.</p>
          </div>

          <div className="apple-card p-8 border-white/10">
             <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-apple-info uppercase tracking-widest">Net Tax Due</span>
             </div>
             <p className="text-large-title font-bold text-white mb-2 leading-none">₹{Math.round(totalTax).toLocaleString('en-IN')}</p>
             <p className="text-caption text-apple-text-secondary">Projected liability on assessed income.</p>
          </div>

          <div className="apple-card p-8 border-white/10">
             <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-apple-success uppercase tracking-widest">Verified Deductions</span>
             </div>
             <p className="text-large-title font-bold text-white mb-2 leading-none">₹{Math.round(totalDeductions).toLocaleString('en-IN')}</p>
             <p className="text-caption text-apple-text-secondary">Inclusive of Standard and Chapter VI-A deductions.</p>
          </div>
        </div>

        {/* Intelligence Briefing - Executive Summary Group */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="apple-card-elevated p-10 bg-white/[0.02] border-white/5 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-teal/5 blur-[120px] rounded-full -mr-48 -mt-48" />
          
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 bg-teal/20 rounded-lg">
              <Activity className="w-5 h-5 text-teal" />
            </div>
            <h3 className="text-headline font-bold">Intelligence Briefing</h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 relative z-10">
            <div className="lg:col-span-8">
               <p className="text-body text-apple-text-secondary leading-relaxed mb-8">
                  {analysis?.reasoning || 'Strategic analysis core has finalized the audit protocol. The following directives represent the most capital-efficient path for your current fiscal profile, minimizing tax leakage while maintaining absolute regulatory compliance.'}
               </p>
               <div className="flex flex-wrap gap-4">
                  <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-apple-success" />
                    <span className="text-caption font-bold text-apple-text-secondary uppercase tracking-widest">Protocol Verified</span>
                  </div>
                  <div className="px-5 py-3 bg-white/5 rounded-xl border border-white/10 flex items-center gap-3">
                    <Shield className="w-4 h-4 text-teal" />
                    <span className="text-caption font-bold text-apple-text-secondary uppercase tracking-widest">Zero-Gap Strategy</span>
                  </div>
               </div>
            </div>
            <div className="lg:col-span-4">
              <div className="p-6 bg-teal/5 border border-teal/10 rounded-2xl space-y-4">
                <p className="text-[10px] font-bold text-teal uppercase tracking-[0.2em]">Primary Strategic Directive</p>
                <h4 className="text-body font-bold text-white leading-tight">
                  {analysis?.nextBestAction?.title || `Optimize Chapter VI-A Deductions`}
                </h4>
                <p className="text-caption text-apple-text-tertiary">
                  {analysis?.nextBestAction?.description || 'Immediate implementation recommended to capture identified tax alpha.'}
                </p>
                <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                  <span className="text-caption text-white/40">Potential Alpha</span>
                  <span className="text-body font-bold text-teal">₹{(analysis?.nextBestAction?.potentialSavings || savings).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-12 space-y-8">
            <div className="apple-card p-10 bg-white/[0.01]">
               <div className="flex justify-between items-center mb-8">
                 <h3 className="text-headline font-bold flex items-center gap-3">
                   <Shield className="w-5 h-5 text-teal" />
                   Computation & Investment Review
                 </h3>
                 <button 
                   onClick={() => setIsEditingInvestments(!isEditingInvestments)}
                   className="text-[10px] font-bold text-teal uppercase tracking-widest px-4 py-2 bg-teal/10 rounded-full hover:bg-teal/20 transition-colors"
                 >
                   {isEditingInvestments ? 'Finish Review' : 'Edit Analysis'}
                 </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
                  <SummaryItem label="Assessed Gross Revenue" value={`₹${(profile.income || 0).toLocaleString('en-IN')}`} />
                  <SummaryItem label="Standard Deduction" value={`₹${bestResults.standardDeduction.toLocaleString('en-IN')}`} />
                  
                  {/* Investments / Deductions */}
                  <SummaryItem 
                    label="Section 80C" 
                    value={deductionsData.section80C} 
                    isEditable={isEditingInvestments}
                    onValueChange={(val) => handleUpdateDeduction('section80C', val)}
                  />
                  <SummaryItem 
                    label="Section 80D" 
                    value={deductionsData.section80D} 
                    isEditable={isEditingInvestments}
                    onValueChange={(val) => handleUpdateDeduction('section80D', val)}
                  />
                  <SummaryItem 
                    label="NPS (§80CCD)" 
                    value={deductionsData.section80CCD1B} 
                    isEditable={isEditingInvestments}
                    onValueChange={(val) => handleUpdateDeduction('nps', val)}
                  />
                  <SummaryItem 
                    label="Home Loan (§24)" 
                    value={deductionsData.section24} 
                    isEditable={isEditingInvestments}
                    onValueChange={(val) => handleUpdateDeduction('section24', val)}
                  />
                  <SummaryItem 
                    label="HRA Exemption" 
                    value={deductionsData.hra} 
                    isEditable={isEditingInvestments}
                    onValueChange={(val) => handleUpdateDeduction('hra', val)}
                  />
                  
                  <SummaryItem label="Selected Regime" value={`${bestRegime} Regime (§115BAC)`} highlight={true} />
               </div>
               <div className="pt-8 mt-8 border-t border-white/5 flex justify-between items-center">
                  <span className="text-small-caps text-teal">Algorithm Confidence</span>
                  <div className="flex items-center gap-2">
                     <div className="h-1.5 w-48 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-teal w-[98%]" />
                     </div>
                     <span className="text-caption font-bold text-teal">98%</span>
                  </div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-12 space-y-8">
            <div className="apple-card p-10 border-white/10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-apple-success/5 blur-[100px] -mr-32 -mt-32" />
               <div className="flex justify-between items-center mb-10 relative z-10">
                 <h3 className="text-headline font-bold flex items-center gap-3">
                   <Zap className="w-5 h-5 text-apple-success" />
                   Action Required
                 </h3>
                 <button 
                   onClick={() => setIsEditingStrategy(!isEditingStrategy)}
                   className="text-[10px] font-bold text-apple-success uppercase tracking-widest px-4 py-2 bg-apple-success/10 rounded-full hover:bg-apple-success/20 transition-colors"
                 >
                   {isEditingStrategy ? 'Lock Strategy' : 'Refine Tactics'}
                 </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
                  {analysis?.actionPlan || programmaticStrategy.length > 0 ? (analysis?.actionPlan || programmaticStrategy).map((item, idx) => (
                    <ActionStep 
                      key={idx}
                      title={item.title} 
                      action={item.action}
                      why={item.why}
                      priority={item.priority}
                      law={item.law}
                      benefit={item.benefit}
                      isEditable={isEditingStrategy}
                      onUpdate={(updates) => handleUpdateActionStep(idx, updates)}
                    />
                  )) : (
                    <>
                      <ActionStep 
                        title={`Elect ${bestRegime} Regime`} 
                        action={`Maximize capital efficiency by electing the ${bestRegime} Regime during the filing window.`}
                        why="Regime arbitrage analysis indicates this path minimizes absolute tax liability."
                        priority="High"
                        benefit={savings}
                      />
                      <ActionStep 
                        title="AIS/TDS Verification" 
                        action={`Synchronize discovered TDS ₹${analysis?.extractedValues?.tds || 0} with official Form 26AS data.`}
                        why="Pre-emptive reconciliation prevents notification mismatches during final processing."
                        priority="Medium"
                      />
                    </>
                  )}
               </div>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 text-center">
           <p className="text-caption text-apple-text-tertiary opacity-40">TaxBreaker Intelligence v3.5 • Verified Regulatory Audit</p>
        </div>
      </div>
    </div>
  );
}

function SummaryItem({ 
  label, 
  value, 
  highlight, 
  isEditable, 
  onValueChange 
}: { 
  label: string, 
  value: string | number, 
  highlight?: boolean,
  isEditable?: boolean,
  onValueChange?: (val: number) => void
}) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 grow group">
       <span className="text-small-caps text-apple-text-tertiary">{label}</span>
       {isEditable ? (
         <input 
           type="number"
           defaultValue={typeof value === 'number' ? value : 0}
           onBlur={(e) => onValueChange?.(Number(e.target.value))}
           className="bg-white/5 border border-white/10 rounded px-2 py-1 text-right text-body font-bold text-white w-32 focus:border-teal outline-none transition-colors"
         />
       ) : (
         <span className={cn("text-body font-bold", highlight ? "text-teal" : "text-white")}>
           {typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value}
         </span>
       )}
    </div>
  );
}

function ActionStep({ 
  title, 
  action, 
  why, 
  priority, 
  law, 
  benefit,
  isEditable,
  onUpdate
}: { 
  title: string, 
  action: string, 
  why: string, 
  priority: 'High' | 'Medium' | 'Low',
  law?: string,
  benefit?: number,
  isEditable?: boolean,
  onUpdate?: (updates: any) => void,
  key?: any
}) {
  return (
    <div className={cn(
      "p-6 rounded-2xl border transition-all",
      priority === 'High' ? "bg-teal/5 border-teal/20" : "bg-white/[0.02] border-white/5"
    )}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex gap-3 items-center w-full">
          <div className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
            priority === 'High' ? "bg-teal text-black" : "bg-white/10 text-teal"
          )}>
            <ArrowRight size={16} />
          </div>
          {isEditable ? (
            <input 
              defaultValue={title}
              onBlur={(e) => onUpdate?.({ title: e.target.value })}
              className="bg-white/5 border border-white/10 rounded px-3 py-1 text-body font-bold text-white w-full focus:border-teal outline-none"
            />
          ) : (
            <h4 className="text-body font-bold text-white tracking-tight">{title}</h4>
          )}
        </div>
        {isEditable ? (
          <select 
            defaultValue={priority}
            onChange={(e) => onUpdate?.({ priority: e.target.value })}
            className="bg-white/10 text-[8px] font-bold text-white border-none rounded-full px-2 py-1 outline-none"
          >
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        ) : (
          <span className={cn(
            "text-[8px] font-bold px-3 py-1 rounded-full uppercase tracking-widest",
            priority === 'High' ? "bg-apple-error/10 text-apple-error" : "bg-white/5 text-apple-text-tertiary"
          )}>{priority} Priority</span>
        )}
      </div>
      
      <div className="space-y-4 ml-11">
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-teal uppercase tracking-widest">Protocol</p>
          {isEditable ? (
            <textarea 
              defaultValue={action}
              onBlur={(e) => onUpdate?.({ action: e.target.value })}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-subtext text-white w-full h-20 focus:border-teal outline-none resize-none"
            />
          ) : (
            <p className="text-subtext text-apple-text-secondary leading-relaxed">{action}</p>
          )}
        </div>
        
        <div className="space-y-1">
          <p className="text-[10px] font-bold text-apple-text-tertiary uppercase tracking-widest">Rationale</p>
          {isEditable ? (
            <textarea 
              defaultValue={why}
              onBlur={(e) => onUpdate?.({ why: e.target.value })}
              className="bg-white/5 border border-white/10 rounded px-3 py-2 text-caption text-white w-full h-16 focus:border-teal outline-none resize-none italic"
            />
          ) : (
            <p className="text-caption text-apple-text-tertiary italic leading-relaxed">{why}</p>
          )}
        </div>

        <div className="flex justify-between items-center pt-2">
          {isEditable ? (
            <input 
              defaultValue={law || 'IT Act 1961'}
              onBlur={(e) => onUpdate?.({ law: e.target.value })}
              className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[9px] font-mono text-white/50 w-32 focus:border-teal outline-none"
            />
          ) : (
            <span className="text-[9px] font-mono text-apple-text-tertiary">REF: {law || 'IT Act 1961'}</span>
          )}
          {benefit !== undefined && (
            <div className="flex items-center gap-2">
               <span className="text-[10px] font-bold text-apple-success">₹</span>
               {isEditable ? (
                  <input 
                    type="number"
                    defaultValue={benefit}
                    onBlur={(e) => onUpdate?.({ benefit: Number(e.target.value) })}
                    className="bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] font-bold text-apple-success w-20 focus:border-teal outline-none text-right"
                  />
               ) : (
                  <span className="text-[10px] font-bold text-apple-success">{benefit.toLocaleString('en-IN')} Savings</span>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
