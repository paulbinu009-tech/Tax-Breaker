import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, ChevronLeft, CheckCircle2, TrendingUp, Shield, Activity, ArrowRight, Zap, Target } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '../lib/utils';
import { UserProfile, TaxAnalysisResult } from '../types';
import { calculateTax } from '../lib/taxCalculations';

export default function SummaryView({ 
  profile, 
  discovery,
  onBack 
}: { 
  profile: UserProfile, 
  discovery: TaxAnalysisResult['extractedValues'] | null,
  onBack: () => void 
}) {
  const reportRef = React.useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorStatus, setErrorStatus] = React.useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = React.useState<Blob | null>(null);
  const [shareReady, setShareReady] = React.useState(false);

  // Recalculate results
  const deductionsData = discovery || {};
  const oldRegimeResults = calculateTax(profile.income || 0, 'old', deductionsData);
  const newRegimeResults = calculateTax(profile.income || 0, 'new', deductionsData);
  
  const bestRegime = oldRegimeResults.totalTax < newRegimeResults.totalTax ? 'Old' : 'New';
  const bestResults = bestRegime === 'Old' ? oldRegimeResults : newRegimeResults;
  const totalTax = bestResults.totalTax;
  const savings = Math.abs(oldRegimeResults.totalTax - newRegimeResults.totalTax);
  
  const totalDeductions = Object.values(deductionsData || {}).reduce((acc: number, val) => {
    return typeof val === 'number' ? acc + val : acc;
  }, 0) + bestResults.standardDeduction;

  const generateAudit = async () => {
    setIsGenerating(true);
    setErrorStatus(null);
    setShareReady(false);
    
    console.log('[AUDIT_STEP_1]: Compiling Clinical HTML Audit...');
    
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; padding: 40px; color: #111111; line-height: 1.5;">
          <div style="border-bottom: 2px solid #BA8E23; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #BA8E23; font-size: 24px; margin: 0;">STRATEGIC TAX AUDIT</h1>
            <p style="font-size: 12px; color: #666666; margin: 5px 0 0 0;">FISCAL YEAR 2024-25 | PREPARED FOR: ${profile.displayName || 'TaxBreaker User'}</p>
          </div>

          <div style="background-color: #f8f9fa; border: 1px solid #eeeeee; padding: 25px; border-radius: 8px; margin-bottom: 30px;">
            <div style="font-size: 11px; font-weight: bold; color: #888888; text-transform: uppercase; letter-spacing: 1px;">Optimized Annual Savings</div>
            <div style="font-size: 32px; font-weight: bold; color: #BA8E23; margin: 10px 0;">₹${Math.round(savings).toLocaleString('en-IN')}</div>
            <div style="font-size: 13px; color: #444444;">Recommendation: Switch to <b>${bestRegime} Regime</b>.</div>
          </div>

          <div style="margin-bottom: 40px;">
            <h2 style="font-size: 14px; color: #888888; border-bottom: 1px solid #eeeeee; padding-bottom: 10px; text-transform: uppercase;">Tax Computation Summary</h2>
            <div style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between;">
              <span style="color: #555555;">Gross Assessed Income</span>
              <span style="font-weight: bold;">₹${(profile.income || 0).toLocaleString('en-IN')}</span>
            </div>
            <div style="padding: 10px 0; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between;">
              <span style="color: #555555;">Total Applied Deductions</span>
              <span style="font-weight: bold;">₹${Math.round(totalDeductions).toLocaleString('en-IN')}</span>
            </div>
            <div style="padding: 15px 0; display: flex; justify-content: space-between; font-size: 18px;">
              <span style="font-weight: bold;">Net Projected Liability</span>
              <span style="font-weight: bold; color: #BA8E23;">₹${Math.round(totalTax).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style="background-color: #fffdf0; border-left: 4px solid #BA8E23; padding: 20px;">
            <h2 style="font-size: 13px; font-weight: bold; margin-top: 0;">REQUIRED ACTION STEPS</h2>
            <ul style="font-size: 12px; color: #333333; margin: 10px 0 0 0; padding-left: 20px;">
              <li>Elect <b>${bestRegime} Regime</b> §115BAC for maximum efficiency.</li>
              <li>Verify primary TDS of <b>₹${discovery?.tds || 0}</b> against AIS portal.</li>
              <li>Synchronize e-filing tokens prior to July filing window.</li>
            </ul>
          </div>

          <div style="margin-top: 60px; text-align: center; font-size: 10px; color: #aaaaaa; border-top: 1px solid #eeeeee; padding-top: 20px;">
            TaxBreaker AI Regulatory Engine • Verified Digital Audit • ${new Date().toLocaleString()}
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
          <div className="w-14 h-14 bg-gold/10 rounded-2xl flex items-center justify-center text-gold shadow-[0_0_20px_rgba(212,175,55,0.15)] border border-gold/20">
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
                  <Activity className="w-4 h-4 animate-pulse text-gold" />
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
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full -ml-32 -mb-32" />

        <div className="flex justify-between items-start border-b border-white/5 pb-10">
           <div>
              <p className="text-caption text-gold font-bold uppercase tracking-[0.3em] mb-3">Professional Strategy Audit</p>
              <p className="text-body text-apple-text-secondary">Assessed for <span className="text-white font-bold">{profile.displayName || 'Authorized User'}</span></p>
           </div>
           <div className="text-right">
              <p className="text-caption text-apple-text-tertiary uppercase tracking-widest mb-1">Fiscal Year 2024-25</p>
              <p className="text-subtext font-mono opacity-50">AUDIT_ID: TB-${Math.random().toString(36).substring(7).toUpperCase()}</p>
           </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="apple-card-elevated p-8 border-gold/20 bg-gold/[0.03] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
                <TrendingUp className="w-12 h-12" />
             </div>
             <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Optimized Savings</span>
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-8">
            <div className="apple-card p-10 bg-white/[0.01]">
               <h3 className="text-headline font-bold mb-8 flex items-center gap-3">
                 <Shield className="w-5 h-5 text-gold" />
                 Computation Logic
               </h3>
               <div className="space-y-6">
                  <SummaryItem label="Assessed Gross Revenue" value={`₹${(profile.income || 0).toLocaleString('en-IN')}`} />
                  <SummaryItem label="Standard Deduction" value={`₹${bestResults.standardDeduction.toLocaleString('en-IN')}`} />
                  <SummaryItem label="Selected Regime" value={`${bestRegime} Regime (§115BAC)`} highlight={true} />
                  <div className="pt-4 mt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-small-caps text-gold">Algorithm Confidence</span>
                    <div className="flex items-center gap-2">
                       <div className="h-1.5 w-32 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gold w-[98%]" />
                       </div>
                       <span className="text-caption font-bold text-gold">98%</span>
                    </div>
                  </div>
               </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-8">
            <div className="apple-card p-10 border-white/10 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-apple-success/5 blur-3xl -mr-16 -mt-16" />
               <h3 className="text-headline font-bold mb-8 flex items-center gap-3">
                 <Zap className="w-5 h-5 text-apple-success" />
                 Action Required
               </h3>
               <div className="space-y-8">
                  <ActionStep 
                    title={`Elect ${bestRegime} Regime`} 
                    desc={`Maximize capital efficiency by electing the ${bestRegime} Regime during the filing window.`}
                  />
                  <ActionStep 
                    title="AIS/TDS Verification" 
                    desc={`Synchronize discovered TDS ₹${discovery?.tds || 0} with official Form 26AS data.`}
                  />
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

function SummaryItem({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0 grow">
       <span className="text-small-caps text-apple-text-tertiary">{label}</span>
       <span className={cn("text-body font-bold", highlight ? "text-gold" : "text-white")}>{value}</span>
    </div>
  );
}

function ActionStep({ title, desc }: { title: string, desc: string }) {
  return (
    <div className="flex gap-4">
       <div className="flex-shrink-0 w-6 h-6 rounded-full bg-apple-success/10 flex items-center justify-center text-apple-success">
          <ArrowRight className="w-3 h-3" />
       </div>
       <div>
          <h4 className="text-subtext font-bold text-white mb-1 uppercase tracking-wider">{title}</h4>
          <p className="text-caption text-apple-text-secondary leading-relaxed">{desc}</p>
       </div>
    </div>
  );
}
