/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =====================================================================
// XUẤT BẢNG TỔNG HỢP DẠNG PIVOT (giống bảng Excel PivotTable):
//   Tổ TKCS (dòng tổng) -> các Xã/Phường thuộc TKCS đó.
// Phạm vi xuất: 1 TKCS hoặc TẤT CẢ (104 xã/phường).
// Số liệu lấy từ dữ liệu phiếu đang có TRÊN MÁY (không đọc Firebase) và dùng
// CÔNG THỨC DUY NHẤT trong incomeExtrapolation.ts nên khớp với màn Kiểm soát của Admin.
// Đơn vị tiền: NGHÌN ĐỒNG (1.000đ).
// =====================================================================

import * as XLSX from 'xlsx';
import type { Commune, Household } from '../types';
import { OFFICIAL_COMMUNES_CATALOG, COMMUNE_POPULATION_MAP } from '../data/communesCatalog';
import { calculateFullIncome } from './incomeCalculator';
import {
  extrapolateCommune,
  extrapolateScope,
  isHouseholdCountedForAverage,
  type CommuneInput
} from './incomeExtrapolation';
import { selectOfficialHouseholdsByArea } from './areaDataTransfer';

export const ALL_TKCS = 'ALL';

type Weights = [number, number, number, number];
type SectorYear = [number | null, number | null, number | null, number | null];

export interface PivotCommuneRow {
  kind: 'commune';
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  communeName: string;
  population: number;
  /** Số hộ mẫu chính thức (tối đa 10 hộ / địa bàn) */
  sampleHouseholds: number;
  /** Số hộ có phiếu hợp lệ (nhân khẩu > 0, thu nhập > 0, không dòng nào chi > thu) */
  validHouseholds: number;
  /** Tổng nhân khẩu của các hộ hợp lệ */
  members: number;
  /** Tổng thu nhập các hộ hợp lệ (1.000đ/năm) */
  income: number;
  /** TNBQ trực tiếp = Tổng thu nhập / Tổng nhân khẩu (chưa suy rộng) */
  directYear: number | null;
  directMonth: number | null;
  weights: Weights;
  sectorYear: SectorYear;
  /** TNBQ suy rộng toàn xã */
  extYear: number | null;
  extMonth: number | null;
  /** Thu nhập địa phương = TNBQ năm x dân số */
  fundYear: number | null;
  fundMonth: number | null;
  hasData: boolean;
  isPartial: boolean;
}

export interface PivotGroupRow {
  kind: 'tkcs' | 'total';
  tkcsCode: string;
  tkcsName: string;
  label: string;
  communeCount: number;
  surveyedCommunes: number;
  population: number;
  sampleHouseholds: number;
  validHouseholds: number;
  members: number;
  income: number;
  directYear: number | null;
  directMonth: number | null;
  extYear: number | null;
  extMonth: number | null;
  fundYear: number | null;
  fundMonth: number | null;
  isPartial: boolean;
}

export type PivotRow = PivotCommuneRow | PivotGroupRow;

export interface PivotResult {
  rows: PivotRow[];
  total: PivotGroupRow;
  communeCount: number;
  scopeLabel: string;
}

export interface TkcsOption {
  code: string;
  name: string;
  communeCount: number;
}

/** Danh sách Tổ TKCS (theo danh mục 104 xã) để làm bộ lọc xuất. */
export const getTkcsOptions = (): TkcsOption[] => {
  const map = new Map<string, TkcsOption>();
  OFFICIAL_COMMUNES_CATALOG.forEach(c => {
    if (!c.tkcsCode) return;
    const cur = map.get(c.tkcsCode);
    if (cur) cur.communeCount += 1;
    else map.set(c.tkcsCode, { code: c.tkcsCode, name: c.tkcsName || c.tkcsCode, communeCount: 1 });
  });
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code, 'vi', { numeric: true }));
};

/** Hộ chính thức của một xã: tối đa 10 hộ/địa bàn, có tính hộ dự phòng đã dùng thay mẫu (xem selectOfficialHouseholds). */
export const selectOfficialHouseholdsOfCommune = (communeHouseholds: Household[]): Household[] =>
  selectOfficialHouseholdsByArea(communeHouseholds);

const num = (v: unknown): number => Number(v) || 0;

/** Dựng các dòng pivot. tkcsCode = 'ALL' => toàn bộ 104 xã/phường. */
export const buildPivotRows = (
  households: Household[],
  communes: Commune[],
  tkcsCode: string = ALL_TKCS
): PivotResult => {
  const stateByCode = new Map<string, Commune>();
  communes.forEach(c => { if (c.communeCode) stateByCode.set(c.communeCode, c); });

  // Gom hộ theo mã xã một lần (O(N))
  const idToCode = new Map<string, string>();
  communes.forEach(c => { if (c.id && c.communeCode) idToCode.set(c.id, c.communeCode); });
  const hhByCommune = new Map<string, Household[]>();
  households.forEach(h => {
    const code = h.communeCode || idToCode.get(h.communeId) || '';
    if (!code) return;
    const list = hhByCommune.get(code);
    if (list) list.push(h);
    else hhByCommune.set(code, [h]);
  });

  const catalog = OFFICIAL_COMMUNES_CATALOG.filter(c => tkcsCode === ALL_TKCS || c.tkcsCode === tkcsCode);

  type Prepared = {
    row: PivotCommuneRow;
    input: CommuneInput;
  };
  const prepared: Prepared[] = catalog.map(cat => {
    const st = stateByCode.get(cat.communeCode);
    const population = COMMUNE_POPULATION_MAP[cat.communeCode] || cat.population || 25000;
    const weights: Weights = [
      num(st?.ttNongLamThuySan ?? cat.ttNongLamThuySan),
      num(st?.ttCongNghiepXayDung ?? cat.ttCongNghiepXayDung),
      num(st?.ttThuongMaiDichVu ?? cat.ttThuongMaiDichVu),
      num(st?.ttThuKhacLuong ?? cat.ttThuKhacLuong)
    ];
    const official = selectOfficialHouseholdsOfCommune(hhByCommune.get(cat.communeCode) || []);
    const valid = official.filter(isHouseholdCountedForAverage);
    const members = valid.reduce((a, h) => a + num(h.membersCount), 0);
    const income = valid.reduce((a, h) => a + calculateFullIncome(h.questionnaire).total, 0);

    const ext = extrapolateCommune(official, weights);
    const fundYear = ext.hasData ? ext.perCapitaYear * population : null;

    const row: PivotCommuneRow = {
      kind: 'commune',
      tkcsCode: cat.tkcsCode,
      tkcsName: cat.tkcsName,
      communeCode: cat.communeCode,
      communeName: cat.communeName,
      population,
      sampleHouseholds: official.length,
      validHouseholds: valid.length,
      members,
      income,
      directYear: members > 0 ? income / members : null,
      directMonth: members > 0 ? income / members / 12 : null,
      weights,
      sectorYear: ext.sectors.map(s => s.perCapitaYear) as SectorYear,
      extYear: ext.hasData ? ext.perCapitaYear : null,
      extMonth: ext.hasData ? ext.perCapitaMonth : null,
      fundYear,
      fundMonth: fundYear !== null ? fundYear / 12 : null,
      hasData: ext.hasData,
      isPartial: ext.isPartial
    };
    return { row, input: { key: cat.communeCode, population, weights, households: official } };
  });

  const makeGroup = (
    kind: 'tkcs' | 'total',
    code: string,
    name: string,
    label: string,
    items: Prepared[]
  ): PivotGroupRow => {
    const scope = extrapolateScope(items.map(i => i.input));
    const rows = items.map(i => i.row);
    const members = rows.reduce((a, r) => a + r.members, 0);
    const income = rows.reduce((a, r) => a + r.income, 0);
    const has = scope.surveyedCommunes > 0;
    return {
      kind,
      tkcsCode: code,
      tkcsName: name,
      label,
      communeCount: rows.length,
      surveyedCommunes: scope.surveyedCommunes,
      population: scope.totalPopulation,
      sampleHouseholds: rows.reduce((a, r) => a + r.sampleHouseholds, 0),
      validHouseholds: rows.reduce((a, r) => a + r.validHouseholds, 0),
      members,
      income,
      directYear: members > 0 ? income / members : null,
      directMonth: members > 0 ? income / members / 12 : null,
      extYear: has ? scope.perCapitaYear : null,
      extMonth: has ? scope.perCapitaMonth : null,
      fundYear: has ? scope.fundYear : null,
      fundMonth: has ? scope.fundMonth : null,
      isPartial: scope.isPartial
    };
  };

  // Nhóm theo TKCS, giữ thứ tự mã TKCS rồi mã xã
  const groups = new Map<string, Prepared[]>();
  prepared.forEach(p => {
    const list = groups.get(p.row.tkcsCode);
    if (list) list.push(p);
    else groups.set(p.row.tkcsCode, [p]);
  });
  const sortedCodes = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true }));

  const rows: PivotRow[] = [];
  sortedCodes.forEach(code => {
    const items = groups.get(code)!.sort((a, b) =>
      a.row.communeName.localeCompare(b.row.communeName, 'vi', { numeric: true })
    );
    rows.push(makeGroup('tkcs', code, items[0].row.tkcsName, items[0].row.tkcsName, items));
    items.forEach(i => rows.push(i.row));
  });

  const scopeName = tkcsCode === ALL_TKCS
    ? 'Toàn tỉnh'
    : (catalog[0]?.tkcsName || tkcsCode);
  const total = makeGroup('total', '', '', `TỔNG CỘNG (${scopeName})`, prepared);

  return {
    rows,
    total,
    communeCount: prepared.length,
    scopeLabel: tkcsCode === ALL_TKCS ? `Tất cả ${prepared.length} xã/phường` : `${scopeName} (${prepared.length} xã/phường)`
  };
};

// -------------------- GHI RA EXCEL --------------------

const HEADERS = [
  'Row Labels',
  'Mã xã',
  'Dân số (người)',
  'Số hộ mẫu (chính thức)',
  'Count of TNBQ/người/năm (số hộ có phiếu hợp lệ)',
  'Sum of Số nhân khẩu',
  'Sum of TỔNG THU NHẬP HỘ (1.000đ)',
  'TNBQ/người/năm (1.000đ) = Thu nhập / Nhân khẩu',
  'TNBQ/người/tháng (1.000đ)',
  'Tỷ trọng NLTS (%)',
  'Tỷ trọng CNXD (%)',
  'Tỷ trọng TMDV (%)',
  'Tỷ trọng Thu khác/Lương (%)',
  'TNBQ năm - Nhóm NLTS (1.000đ)',
  'TNBQ năm - Nhóm CNXD (1.000đ)',
  'TNBQ năm - Nhóm TMDV (1.000đ)',
  'TNBQ năm - Nhóm Thu khác/Lương (1.000đ)',
  'SUY RỘNG TNBQ/người/năm (1.000đ)',
  'SUY RỘNG TNBQ/người/tháng (1.000đ)',
  'Thu nhập địa phương/năm (1.000đ) = TNBQ năm x Dân số',
  'Thu nhập địa phương/tháng (1.000đ)',
  'Ghi chú'
];

const noteOf = (r: PivotRow): string => {
  if (r.kind === 'commune') {
    if (!r.hasData) return 'Chưa có phiếu hợp lệ';
    return r.isPartial ? 'Tạm tính (thiếu nhóm ngành)' : '';
  }
  if (r.surveyedCommunes === 0) return 'Chưa có xã nào có số liệu';
  const parts = [`${r.surveyedCommunes}/${r.communeCount} xã có số liệu`];
  if (r.isPartial) parts.push('tạm tính');
  return parts.join(', ');
};

export const exportPivotToExcel = (result: PivotResult, tkcsCode: string): string => {
  const today = new Date();
  const aoa: any[][] = [];
  aoa.push(['TỔNG HỢP THU NHẬP BÌNH QUÂN ĐẦU NGƯỜI - CÓ SUY RỘNG']);
  aoa.push([`Phạm vi: ${result.scopeLabel} • Ngày xuất: ${today.toLocaleDateString('vi-VN')} • Đơn vị tiền: 1.000đ • Nguồn: dữ liệu phiếu trên máy Admin`]);
  aoa.push([]);
  aoa.push(HEADERS);
  const headerRow = 3;

  const toCell = (v: number | null): number | string => (v === null ? '' : v);
  const levels: number[] = [];

  const pushRow = (r: PivotRow, level: number) => {
    levels[aoa.length] = level;
    if (r.kind === 'commune') {
      aoa.push([
        r.communeName,
        r.communeCode,
        r.population,
        r.sampleHouseholds,
        r.validHouseholds,
        r.members,
        r.income,
        toCell(r.directYear),
        toCell(r.directMonth),
        ...r.weights.map(w => (w > 0 ? w : '')),
        ...r.sectorYear.map(toCell),
        toCell(r.extYear),
        toCell(r.extMonth),
        toCell(r.fundYear),
        toCell(r.fundMonth),
        noteOf(r)
      ]);
    } else {
      aoa.push([
        r.label,
        '',
        r.population,
        r.sampleHouseholds,
        r.validHouseholds,
        r.members,
        r.income,
        toCell(r.directYear),
        toCell(r.directMonth),
        '', '', '', '',
        '', '', '', '',
        toCell(r.extYear),
        toCell(r.extMonth),
        toCell(r.fundYear),
        toCell(r.fundMonth),
        noteOf(r)
      ]);
    }
  };

  result.rows.forEach(r => pushRow(r, r.kind === 'tkcs' ? 0 : 1));
  pushRow(result.total, 0);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Định dạng số: số nguyên có dấu phân cách; TNBQ 2 số lẻ; tỷ trọng 2 số lẻ
  const intCols = [2, 3, 4, 5, 6, 19, 20];
  const decCols = [7, 8, 13, 14, 15, 16, 17, 18];
  const pctCols = [9, 10, 11, 12];
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const apply = (cols: number[], fmt: string) => cols.forEach(c => {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = fmt;
    });
    apply(intCols, '#,##0');
    apply(decCols, '#,##0.00');
    apply(pctCols, '0.00');
  }

  ws['!cols'] = [
    { wch: 34 }, { wch: 9 }, { wch: 13 }, { wch: 12 }, { wch: 16 }, { wch: 13 }, { wch: 20 },
    { wch: 18 }, { wch: 16 },
    { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 13 },
    { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 28 }
  ];
  // Dòng xã nằm trong nhóm TKCS để người dùng bấm +/- thu gọn như PivotTable
  ws['!rows'] = aoa.map((_, i) => (levels[i] ? { level: levels[i] } : {}));
  (ws as any)['!outline'] = { above: true };
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: HEADERS.length - 1 } }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TongHop_SuyRong');

  const scopeFile = tkcsCode === ALL_TKCS ? 'Tat_ca_104_xa_phuong' : tkcsCode;
  const fileName = `Tong_Hop_Suy_Rong_${scopeFile}_${today.toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
  return fileName;
};
