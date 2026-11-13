
//income tax bands for the UK for the tax year 2026-27

const incomeTaxBands = [
    { upTo: 37700, rate: 0.20},
    { upTo: 125140, rate: 0.40},
    {upTo: Infinity,rate: 0.45}
];

//national insurance bands for the UK for the tax year 2026-27
const nationalInsuranceBands = [
    { upTo: 12570, rate: 0 },
    { upTo: 50270, rate: 0.08 },
    { upTo: Infinity, rate: 0.02 }
];

// Export the tax rules for the UK for the tax year 2026-27

export const uk2026TaxRules = {
    // Your properties go here
    country: "UK",
    taxYear: "2026-27",
    personalAllowance: 12570,
    personalAllowanceTaperThreshold: 100000,
    personalAllowanceTaperRate: 0.50,
    incomeTaxBands: incomeTaxBands,
    nationalInsuranceBands: nationalInsuranceBands,
    // HMRC 2026-27 payroll technical specification (annual GBP thresholds).
    // https://www.gov.uk/government/publications/payroll-technical-specifications-student-loans/collection-of-student-loans-from-6-april-2026
    studentLoans: {
        plan1: { annualThreshold: 26900, rate: 0.09 },
        plan2: { annualThreshold: 29385, rate: 0.09 },
        plan4: { annualThreshold: 33795, rate: 0.09 },
        plan5: { annualThreshold: 25000, rate: 0.09 },
        postgraduate: { annualThreshold: 21000, rate: 0.06 }
    }
};
