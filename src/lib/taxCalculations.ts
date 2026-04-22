import { TAX_RULES, TaxRegime } from '../config/taxRules';
import { TaxDeductions, TaxCalculationResult } from '../types';

const rules = TAX_RULES.FY_2024_25;

export function calculateTax(
  grossIncome: number,
  regime: TaxRegime,
  deductions: TaxDeductions = {}
): TaxCalculationResult {
  const isNewRegime = regime === 'new';
  
  // 1. Standard Deduction
  const standardDeduction = isNewRegime 
    ? rules.standardDeduction.newRegime 
    : rules.standardDeduction.oldRegime;
  
  let taxableIncome = Math.max(0, grossIncome - standardDeduction);
  
  // 2. Apply deductions (Only for Old Regime)
  if (!isNewRegime) {
    const s80C = Math.min(deductions.section80C || 0, rules.section80C.maxLimit);
    const s80D = deductions.section80D || 0;
    const nps = Math.min(deductions.section80CCD1B || 0, rules.section80CCD1B.maxLimit);
    const homeLoan = Math.min(deductions.section24 || 0, rules.section24.maxLimit);
    const hra = deductions.hra || 0;
    const lta = deductions.lta || 0;
    const s80G = deductions.section80G || 0;
    const s80EE = Math.min(deductions.section80EE || 0, rules.section80EE.maxLimit);
    const other = deductions.otherDeductions || 0;
    
    taxableIncome = Math.max(0, taxableIncome - s80C - s80D - nps - homeLoan - hra - lta - s80G - s80EE - other);
  }

  // 3. Simple Slab Calculation
  const slabs = isNewRegime ? rules.slabs.newRegime : rules.slabs.oldRegime;
  let remainingIncome = taxableIncome;
  let previousLimit = 0;
  let taxBeforeRebate = 0;
  const slabsUsed: TaxCalculationResult['slabsUsed'] = [];

  for (const slab of slabs) {
    if (remainingIncome <= 0) break;
    
    const slabRange = slab.limit - previousLimit;
    const amountInSlab = Math.min(remainingIncome, slabRange);
    const slabTax = amountInSlab * slab.rate;
    
    if (amountInSlab > 0) {
      slabsUsed.push({
        slab: `${(previousLimit/100000).toFixed(1)}L - ${slab.limit === Infinity ? 'Above' : (slab.limit/100000).toFixed(1) + 'L'}`,
        amount: amountInSlab,
        rate: Math.round(slab.rate * 100),
        tax: slabTax
      });
      taxBeforeRebate += slabTax;
      remainingIncome -= amountInSlab;
    }
    previousLimit = slab.limit;
  }

  // 4. Section 87A Rebate
  let rebate = 0;
  const rebateRules = isNewRegime ? rules.section87A.newRegime : rules.section87A.oldRegime;
  
  if (taxableIncome <= rebateRules.incomeThreshold) {
    rebate = Math.min(taxBeforeRebate, rebateRules.rebateMaxAmount);
  }

  const taxAfterRebate = Math.max(0, taxBeforeRebate - rebate);
  
  // 4.1 Marginal Relief for New Regime (FY 2024-25)
  // If income exceeds 7L, the tax should not exceed the amount by which income exceeds 7L.
  let taxAfterMarginalRelief = taxAfterRebate;
  if (isNewRegime && taxableIncome > 700000 && taxAfterRebate > (taxableIncome - 700000)) {
    taxAfterMarginalRelief = taxableIncome - 700000;
  }

  // 5. Surcharge Calculation
  let surcharge = 0;
  if (taxableIncome > 5000000) {
    let surchargeRate = 0;
    const levels = rules.surcharge.levels;
    
    for (const level of levels) {
      if (taxableIncome > level.threshold) {
        if (level.rate !== undefined) {
          surchargeRate = level.rate;
        } else {
          surchargeRate = isNewRegime ? level.rateNew : level.rateOld;
        }
      }
    }
    surcharge = taxAfterMarginalRelief * surchargeRate;
    
    // Marginal Relief for Surcharge (50L, 1Cr, etc)
    const currentThreshold = taxableIncome > 50000000 ? 50000000 : taxableIncome > 20000000 ? 20000000 : taxableIncome > 10000000 ? 10000000 : 5000000;
    // (Complex so skipping detailed surcharge marginal relief for now, but adding the 7L one is critical for masses)
  }

  // 6. Health & Education Cess
  const cess = (taxAfterMarginalRelief + surcharge) * rules.cessRate;
  const totalTax = taxAfterMarginalRelief + surcharge + cess;

  return {
    taxableIncome,
    taxBeforeCess: taxAfterMarginalRelief,
    surcharge,
    cess,
    totalTax,
    rebate,
    slabsUsed,
    standardDeduction
  };
}
