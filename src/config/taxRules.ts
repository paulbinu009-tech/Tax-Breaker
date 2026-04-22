// Default configuration for FY 2024-25
export let TAX_RULES: any = {
  FY_2024_25: {
    standardDeduction: {
      oldRegime: 50000,
      newRegime: 75000,
    },
    section80C: {
      maxLimit: 150000,
    },
    section80D: {
      under60: 25000,
      over60: 50000,
      parentsUnder60: 25000,
      parentsOver60: 50000,
    },
    section80CCD1B: {
      maxLimit: 50000,
    },
    section24: {
      maxLimit: 200000,
    },
    section80G: {
      description: "Donations to charitable institutions",
    },
    section80EE: {
      maxLimit: 50000,
    },
    lta: {
      description: "Leave Travel Allowance",
    },
    section87A: {
      oldRegime: {
        rebateMaxAmount: 12500,
        incomeThreshold: 500000,
      },
      newRegime: {
        rebateMaxAmount: 25000,
        incomeThreshold: 700000,
      },
    },
    slabs: {
      oldRegime: [
        { limit: 250000, rate: 0 },
        { limit: 500000, rate: 0.05 },
        { limit: 1000000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
      newRegime: [
        { limit: 300000, rate: 0 },
        { limit: 700000, rate: 0.05 },
        { limit: 1000000, rate: 0.10 },
        { limit: 1200000, rate: 0.15 },
        { limit: 1500000, rate: 0.20 },
        { limit: Infinity, rate: 0.30 },
      ],
    },
    surcharge: {
      levels: [
        { threshold: 5000000, rate: 0.10 },
        { threshold: 10000000, rate: 0.15 },
        { threshold: 20000000, rate: 0.25 },
        // Cap for new regime is 25%, old regime still has 37% for > 5Cr
        { threshold: 50000000, rateOld: 0.37, rateNew: 0.25 },
      ]
    },
    cessRate: 0.04,
  },
  lastUpdated: new Date().toISOString()
};

export function updateTaxRules(newRules: any) {
  TAX_RULES = newRules;
}

export type TaxRegime = 'old' | 'new';
