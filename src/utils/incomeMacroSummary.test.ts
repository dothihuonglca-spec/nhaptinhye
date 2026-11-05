import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMUNE_POPULATION_MAP,
  OFFICIAL_COMMUNES_CATALOG,
  PROVINCE_TOTAL_POPULATION
} from '../data/communesCatalog';
import { summarizeIncomeByTkcs } from './incomeMacroSummary';

test('official commune catalog has 104 unique codes with population for each', () => {
  assert.equal(OFFICIAL_COMMUNES_CATALOG.length, 104);
  assert.equal(new Set(OFFICIAL_COMMUNES_CATALOG.map(commune => commune.communeCode)).size, 104);
  assert.equal(new Set(OFFICIAL_COMMUNES_CATALOG.map(commune => commune.tkcsCode)).size, 14);
  assert.equal(
    OFFICIAL_COMMUNES_CATALOG.reduce(
      (sum, commune) => sum + (COMMUNE_POPULATION_MAP[commune.communeCode] ?? commune.population ?? 0),
      0
    ),
    PROVINCE_TOTAL_POPULATION
  );
  OFFICIAL_COMMUNES_CATALOG.forEach(commune => {
    assert.ok(COMMUNE_POPULATION_MAP[commune.communeCode] || commune.population, `Missing population for ${commune.communeCode}`);
    const weightTotal = commune.ttNongLamThuySan + commune.ttCongNghiepXayDung +
      commune.ttThuongMaiDichVu + commune.ttThuKhacLuong;
    assert.ok(Math.abs(weightTotal - 100) < 0.02, `Invalid fixed weights for ${commune.communeCode}`);
  });
});

test('TKCS summary weights commune extrapolations by surveyed population', () => {
  const summaries = summarizeIncomeByTkcs([
    {
      tkcsCode: 'TK001',
      tkcsName: 'Tổ 1',
      communeCode: '001',
      population: 100,
      hasSurveyData: true,
      isPartial: false,
      surveyedCount: 5,
      totalSample: 10,
      fundYearRaw: 1000,
      sectorContributionsYear: [1, 2, 3, 4]
    },
    {
      tkcsCode: 'TK001',
      tkcsName: 'Tổ 1',
      communeCode: '002',
      population: 300,
      hasSurveyData: true,
      isPartial: true,
      surveyedCount: 7,
      totalSample: 10,
      fundYearRaw: 9000,
      sectorContributionsYear: [5, 6, 7, 8]
    },
    {
      tkcsCode: 'TK001',
      tkcsName: 'Tổ 1',
      communeCode: '003',
      population: 200,
      hasSurveyData: false,
      isPartial: false,
      surveyedCount: 0,
      totalSample: 10,
      fundYearRaw: 0,
      sectorContributionsYear: [0, 0, 0, 0]
    }
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].communeCount, 3);
  assert.equal(summaries[0].surveyedCommunesCount, 2);
  assert.equal(summaries[0].population, 600);
  assert.equal(summaries[0].surveyedPopulation, 400);
  assert.equal(summaries[0].surveyedHouseholds, 12);
  assert.equal(summaries[0].perCapitaYear, 25);
  assert.deepEqual(summaries[0].sectorContributionsYear, [4, 5, 6, 7]);
  assert.equal(summaries[0].fundYear, 10000);
  assert.equal(summaries[0].isPartial, true);
});
