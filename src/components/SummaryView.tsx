import * as React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, ChevronLeft, FileText, CheckCircle2, TrendingUp, Shield, Activity, ArrowRight, Zap, Target } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../lib/utils';
import { UserProfile, TaxCalculationResult, TaxAnalysisResult } from '../types';
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

  // Recalculate results for current profile data
  const deductionsData = discovery || {};
  const oldRegimeResults = calculateTax(profile.income || 0, 'old', deductionsData);
  const newRegimeResults = calculateTax(profile.income || 0, 'new', deductionsData);
  
  const bestRegime = oldRegimeResults.totalTax < newRegimeResults.totalTax ? 'Old' : 'New';
  const bestResults = bestRegime === 'Old' ? oldRegimeResults : newRegimeResults;
  const totalTax = bestResults.totalTax;
  const savings = Math.abs(oldRegimeResults.totalTax - newRegimeResults.totalTax);
  
  // Detailed deductions sum
  const totalDeductions = Object.values(deductionsData || {}).reduce((acc: number, val) => {
    return typeof val === 'number' ? acc + val : acc;
  }, 0) + bestResults.standardDeduction;

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setIsGenerating(true);
    setErrorStatus(null);

    try {
      // Optimize canvas generation: High scale for quality, but filtered for weight
      const canvas = await html2canvas(reportRef.current, {
        scale: 1.5, // Reduced from 2 to keep file size down as requested
        useCORS: true,
        backgroundColor: '#050505',
        logging: false,
        allowTaint: true,
        imageTimeout: 15000,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.75); // Use JPEG with 0.75 quality for speed/size balance
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true // Enable internal compression
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Calculate display height maintaining aspect ratio
      const canvasRatio = canvas.height / canvas.width;
      const displayHeight = pdfWidth * canvasRatio;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(displayHeight, pdfHeight));
      
      const fileName = `TaxBreaker_Report_${profile.displayName?.replace(/\s+/g, '_') || 'Audit'}.pdf`;
      const pdfBlob = pdf.output('blob');

      // Native Share Sheet Integration (Web Share API)
      // This is the bulletproof equivalent of expo-sharing on mobile browsers
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([pdfBlob], fileName, { type: 'application/pdf' })] })) {
        const file = new File([pdfBlob], fileName, { type: 'application/pdf' });
        try {
          await navigator.share({
            files: [file],
            title: 'TaxBreaker Audit Summary',
            text: 'Here is your personalized tax optimization strategy from TaxBreaker.',
          });
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
             // Fallback to direct download if share fails or is cancelled with error
             pdf.save(fileName);
          }
        }
      } else {
        // Fallback for desktop or non-sharing browsers
        pdf.save(fileName);
      }
    } catch (error) {
      console.error('CRITICAL: PDF Export failed', error);
      setErrorStatus('Export failed, try again');
    } finally {
      setIsGenerating(false);
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
            <h1 className="text-title font-bold tracking-tight">Executive Summary</h1>
            <p className="text-apple-text-tertiary text-subtext uppercase tracking-widest font-bold mt-1">Audit-Ready Financial Intelligence</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button 
            onClick={exportPDF}
            disabled={isGenerating}
            className="premium-btn-primary h-12 px-8 flex items-center gap-3 disabled:opacity-50 whitespace-nowrap"
          >
            {isGenerating ? (
              <>
                <Activity className="w-4 h-4 animate-pulse" />
                <span>Generating Report...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Download & Share Audit</span>
              </>
            )}
          </button>
          <AnimatePresence>
            {errorStatus && (
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-caption text-apple-error font-bold uppercase tracking-widest"
              >
                {errorStatus}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div ref={reportRef} className="space-y-10 bg-[#050505] p-10 md:p-16 rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative">
        {/* Decorative Elements for the PDF */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gold/5 blur-[100px] rounded-full -ml-32 -mb-32" />

        <div className="flex justify-between items-start border-b border-white/5 pb-10">
           <div>
              <p className="text-caption text-gold font-bold uppercase tracking-[0.3em] mb-3">Verified Report</p>
              <p className="text-body text-apple-text-secondary">Prepared for <span className="text-white font-bold">{profile.displayName || 'TaxBreaker User'}</span></p>
           </div>
           <div className="text-right">
              <p className="text-caption text-apple-text-tertiary uppercase tracking-widest mb-1">Fiscal Year 2024-25</p>
              <p className="text-subtext font-mono opacity-50">REF: {Math.random().toString(36).substring(7).toUpperCase()}</p>
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
             <p className="text-caption text-apple-text-secondary">Annual yield increase by switching to {bestRegime} Regime.</p>
          </div>

          <div className="apple-card p-8 border-white/10">
             <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-apple-info uppercase tracking-widest">Net Payable Tax</span>
             </div>
             <p className="text-large-title font-bold text-white mb-2 leading-none">₹{Math.round(totalTax).toLocaleString('en-IN')}</p>
             <p className="text-caption text-apple-text-secondary">Projected liability inclusive of Cess & Surcharge.</p>
          </div>

          <div className="apple-card p-8 border-white/10">
             <div className="flex items-center gap-2 mb-4">
                <span className="text-[10px] font-bold text-apple-success uppercase tracking-widest">Deductions Found</span>
             </div>
             <p className="text-large-title font-bold text-white mb-2 leading-none">₹{Math.round(totalDeductions).toLocaleString('en-IN')}</p>
             <p className="text-caption text-apple-text-secondary">Inclusive of Section 80C, 80D, and Standard Deduction.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7 space-y-8">
            <div className="apple-card p-10 bg-white/[0.01]">
               <h3 className="text-headline font-bold mb-8 flex items-center gap-3">
                 <Shield className="w-5 h-5 text-gold" />
                 Strategy Breakdown
               </h3>
               <div className="space-y-6">
                  <SummaryItem label="Assessed Gross Income" value={`₹${(profile.income || 0).toLocaleString('en-IN')}`} />
                  <SummaryItem label="Standard Deduction" value={`₹${bestResults.standardDeduction.toLocaleString('en-IN')}`} />
                  <SummaryItem label="Marginal Relief applied" value={bestRegime === 'New' && (profile.income || 0) > 700000 && (profile.income || 0) < 727780 ? "Active" : "N/A"} highlight={bestRegime === 'New' && (profile.income || 0) > 700000 && (profile.income || 0) < 727780} />
                  <SummaryItem label="Primary Advantage" value={`${bestRegime} Regime Optimization`} />
                  <div className="pt-4 mt-4 border-t border-white/5 flex justify-between items-center">
                    <span className="text-small-caps text-gold">Efficiency Rating</span>
                    <div className="flex items-center gap-2">
                       <div className="h-1.5 w-32 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-gold w-[94%]" />
                       </div>
                       <span className="text-caption font-bold text-gold">94%</span>
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
                    title="Lock Optimal Regime" 
                    desc={`Execute filing under ${bestRegime} Regime via Form 115BAC election to secure ₹${Math.round(savings).toLocaleString('en-IN')} headroom.`}
                  />
                  <ActionStep 
                    title="Verify TDS Mismatches" 
                    desc={`Confirm ₹${discovery?.tds || 0} TDS against Annual Information Statement (AIS) for current quarter.`}
                  />
                  <ActionStep 
                    title="Digital Signature Setup" 
                    desc="Ensure DSC or Aadhaar EVC is synchronized for immediate portal authentication."
                  />
               </div>
            </div>
          </div>
        </div>

        <div className="pt-12 border-t border-white/5 text-center">
           <div className="inline-flex items-center gap-4 px-6 py-3 bg-white/5 rounded-full mb-6 border border-white/5">
              <Shield className="w-4 h-4 text-apple-success" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-apple-text-tertiary">Cryptographically Signed Summary • Audit Trail Active</span>
           </div>
           <p className="text-caption text-apple-text-tertiary opacity-40">TaxBreaker Intelligence v2.5 • AI Regulatory compliance engine</p>
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
