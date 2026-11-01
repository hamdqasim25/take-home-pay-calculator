
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
    nationalInsuranceBands: nationalInsuranceBands
};