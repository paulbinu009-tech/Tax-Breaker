import { TAX_RULES } from '../config/taxRules';
import { TaxDeductions, OptimizationStep } from '../types';
import { calculateTax } from './taxCalculations';

const rules = TAX_RULES.FY_2024_25;

/**
 * Strategy Engine: Programmatic generator for tax optimization maneuvers.
 * This ruthlessly analyzes the current profile and identifies the most impactful legal moves.
 */
export function generateTaxStrategy(
  income: number,
  currentDeductions: TaxDeductions
): OptimizationStep[] {
  const strategies: OptimizationStep[] = [];
  
  // Base calculations
  const oldResult = calculateTax(income, 'old', currentDeductions);
  const newResult = calculateTax(income, 'new', currentDeductions);
  
  // 1. Regime Arbitrage Strategy
  const regimeDiff = oldResult.totalTax - newResult.totalTax;
  if (regimeDiff > 1000) {
    strategies.push({
      id: 'regime-switch-new',
      title: 'Regime Pivot: Section 115BAC',
      action: 'Switch to New Tax Regime',
      why: `Your current profile incurs ₹${Math.round(regimeDiff).toLocaleString('en-IN')} excess liability under the traditional system. The New Regime (Section 115BAC) provides lower slab rates that outweigh your current deductions.`,
      law: 'Section 115BAC',
      benefit: Math.round(regimeDiff),
      priority: regimeDiff > 25000 ? 'High' : 'Medium',
      done: false
    });
  } else if (regimeDiff < -1000) {
    strategies.push({
      id: 'regime-stay-old',
      title: 'Preserve Traditional Gating',
      action: 'Maintain Old Tax Regime',
      why: `The traditional regime remains ₹${Math.round(Math.abs(regimeDiff)).toLocaleString('en-IN')} more efficient due to your existing deduction stack. Switching to the default New Regime would be a wealth-negative move.`,
      law: 'Standard Regime Logic',
      benefit: Math.round(Math.abs(regimeDiff)),
      priority: Math.abs(regimeDiff) > 25000 ? 'High' : 'Medium',
      done: false
    });
  }

  // 2. Section 80C Maximization (Only relevant if Old Regime is viable)
  const current80C = currentDeductions.section80C || 0;
  if (current80C < rules.section80C.maxLimit) {
    const targetDeductions = { ...currentDeductions, section80C: rules.section80C.maxLimit };
    const targetResult = calculateTax(income, 'old', targetDeductions);
    const potentialSaving = oldResult.totalTax - targetResult.totalTax;
    
    if (potentialSaving > 0) {
      strategies.push({
        id: 'opt-80c',
        title: '80C Threshold Saturation',
        action: `Deploy ₹${(rules.section80C.maxLimit - current80C).toLocaleString('en-IN')} into 80C instruments`,
        why: `You haven't saturated the ₹1.5L limit. Deploying capital into ELSS, PPF, or EPF will shave off significant liability from your highest taxable slab.`,
        law: 'Section 80C',
        benefit: Math.round(potentialSaving),
        priority: potentialSaving > 15000 ? 'High' : 'Medium',
        done: false
      });
    }
  }

  // 3. Section 80D Health Guard
  const current80D = currentDeductions.section80D || 0;
  // Assume a reasonable max for family + parents (e.g. 25k + 50k = 75k)
  const target80DLimit = 75000; 
  if (current80D < target80DLimit) {
    const targetDeductions = { ...currentDeductions, section80D: target80DLimit };
    const targetResult = calculateTax(income, 'old', targetDeductions);
    const potentialSaving = oldResult.totalTax - targetResult.totalTax;
    
    if (potentialSaving > 500) {
      strategies.push({
        id: 'opt-80d',
        title: 'Medical Premium Hedging',
        action: 'Acquire/Increase Health Insurance for Family & Parents',
        why: 'Health insurance premiums are triple-benefit moves: risk mitigation, wealth preservation, and direct tax deduction. You are currently under-utilizing this strategic gate.',
        law: 'Section 80D',
        benefit: Math.round(potentialSaving),
        priority: potentialSaving > 10000 ? 'High' : 'Medium',
        done: false
      });
    }
  }

  // 4. NPS Voluntary Tier-1 (CCD1B)
  const currentNPS = currentDeductions.section80CCD1B || 0;
  if (currentNPS < rules.section80CCD1B.maxLimit) {
    const targetDeductions = { ...currentDeductions, section80CCD1B: rules.section80CCD1B.maxLimit };
    const targetResult = calculateTax(income, 'old', targetDeductions);
    const potentialSaving = oldResult.totalTax - targetResult.totalTax;
    
    if (potentialSaving > 0) {
      strategies.push({
        id: 'opt-nps',
        title: 'NPS Voluntary Alpha',
        action: `Inject ₹${(rules.section80CCD1B.maxLimit - currentNPS).toLocaleString('en-IN')} into NPS Tier-1`,
        why: 'Section 80CCD(1B) is a unique ₹50k window. Utilizing this is a pure tactical move to reduce taxable income at your top marginal rate.',
        law: 'Section 80CCD(1B)',
        benefit: Math.round(potentialSaving),
        priority: potentialSaving > 10000 ? 'High' : 'Medium',
        done: false
      });
    }
  }

  // 5. Home Loan Interest Optimization (Section 24)
  const currentS24 = currentDeductions.section24 || 0;
  if (currentS24 < rules.section24.maxLimit && income > 1200000) {
      const targetDeductions = { ...currentDeductions, section24: rules.section24.maxLimit };
      const targetResult = calculateTax(income, 'old', targetDeductions);
      const potentialSaving = oldResult.totalTax - targetResult.totalTax;

      if (potentialSaving > 1000) {
          strategies.push({
              id: 'opt-s24',
              title: 'Leveraged Asset Strategy',
              action: 'Maximize Home Loan Interest Deduction',
              why: 'Mortgage interest is a powerful tax shield. If you have a home loan, ensure all interest paid (up to 2L) is fully captured in your declaration.',
              law: 'Section 24(b)',
              benefit: Math.round(potentialSaving),
              priority: potentialSaving > 20000 ? 'High' : 'Medium',
              done: false
          });
      }
  }

  // 6. Section 80G Philanthropy
  if (income > 2000000) {
      strategies.push({
          id: 'opt-80g',
          title: 'Strategic Philanthropy',
          action: 'Utilize Section 80G for Impact & Relief',
          why: 'Donations to specified funds (PM Cares, etc.) can provide 50-100% tax relief on the donated amount. This is a final-stage technique for high earners.',
          law: 'Section 80G',
          benefit: 0, // Variable
          priority: 'Low',
          done: false
      });
  }

  // 5. Section 87A Rebate Trap (Marginal Income Strategy)
  const rebateThreshold = newResult.taxableIncome > 700000 && newResult.taxableIncome < 727777 ;
  if (rebateThreshold) {
      // Mention Marginal Relief in New Regime
      strategies.push({
          id: 'marginal-relief-new',
          title: 'Section 87A Marginal Trap',
          action: 'Monitor Income Thresholds strictly',
          why: 'You are in the "Marginal Relief" zone specifically engineered for the New Regime. Every ₹1 earned above 7L might be taxed heavily until 7.27L. Strategy: Defer bonuses or utilize exemptions if available.',
          law: 'Section 87A (Marginal Relief)',
          benefit: 25000,
          priority: 'High',
          done: false
      });
  }

  // Sort by benefit descending
  return strategies.sort((a, b) => b.benefit - a.benefit);
}
