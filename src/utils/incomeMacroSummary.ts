export interface IncomeMacroSummaryInput {
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  population: number;
  hasSurveyData: boolean;
  isPartial: boolean;
  surveyedCount: number;
  totalSample: number;
  fundYearRaw: number;
  sectorContributionsYear: [number, number, number, number];
}

export interface IncomeTkcsSummary {
  tkcsCode: string;
  tkcsName: string;
  communeCount: number;
  surveyedCommunesCount: number;
  population: number;
  surveyedPopulation: number;
  surveyedHouseholds: number;
  totalSampleHouseholds: number;
  sectorContributionsYear: [number, number, number, number];
  perCapitaYear: number;
  perCapitaMonth: number;
  fundYear: number;
  fundMonth: number;
  isPartial: boolean;
}

export const summarizeIncomeByTkcs = (rows: IncomeMacroSummaryInput[]): IncomeTkcsSummary[] => {
  const grouped = new Map<string, IncomeMacroSummaryInput[]>();
  rows.forEach(row => {
    const group = grouped.get(row.tkcsCode) || [];
    group.push(row);
    grouped.set(row.tkcsCode, group);
  });

  return Array.from(grouped.entries()).map(([tkcsCode, groupRows]) => {
    const withData = groupRows.filter(row => row.hasSurveyData && row.population > 0);
    const surveyedPopulation = withData.reduce((sum, row) => sum + row.population, 0);
    const fundYear = withData.reduce((sum, row) => sum + row.fundYearRaw, 0);
    const sectorContributionsYear: [number, number, number, number] = [0, 0, 0, 0];

    if (surveyedPopulation > 0) {
      withData.forEach(row => {
        row.sectorContributionsYear.forEach((value, index) => {
          sectorContributionsYear[index] += value * row.population / surveyedPopulation;
        });
      });
    }

    return {
      tkcsCode,
      tkcsName: groupRows[0]?.tkcsName || tkcsCode,
      communeCount: groupRows.length,
      surveyedCommunesCount: withData.length,
      population: groupRows.reduce((sum, row) => sum + row.population, 0),
      surveyedPopulation,
      surveyedHouseholds: groupRows.reduce((sum, row) => sum + row.surveyedCount, 0),
      totalSampleHouseholds: groupRows.reduce((sum, row) => sum + row.totalSample, 0),
      sectorContributionsYear,
      perCapitaYear: surveyedPopulation > 0 ? fundYear / surveyedPopulation : 0,
      perCapitaMonth: surveyedPopulation > 0 ? fundYear / surveyedPopulation / 12 : 0,
      fundYear,
      fundMonth: fundYear / 12,
      isPartial: withData.length < groupRows.length || groupRows.some(row => row.isPartial)
    };
  }).sort((a, b) => a.tkcsCode.localeCompare(b.tkcsCode, 'vi', { numeric: true }));
};
