/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =====================================================================
// PHIẾU CẦN LÀM LẠI: Admin xuất file Excel gửi xã -> xã sửa -> Admin nhập lại.
//
// 1. Quét nội dung phiếu đã hoàn thành, tìm hộ có số liệu không hợp lý:
//      - LỖI (hộ bị loại khỏi bình quân): thiếu nhân khẩu, dòng chi > thu, tổng thu nhập = 0,
//        số người làm việc > nhân khẩu.
//      - NGHI VẤN (cần xã đối chiếu phiếu giấy): mục có số liệu nhưng chưa tích "Có" (số liệu bị bỏ qua),
//        mục tích "Có" nhưng trống, nhóm ngành của hộ lệch nguồn thu thực tế trong phiếu,
//        TNBQ lệch quá xa các hộ cùng xã cùng nhóm ngành, Mục 1 kê nhiều người hơn nhân khẩu.
// 2. Xuất mỗi xã 1 file Excel: danh sách hộ + từng dòng thu - chi, mỗi dòng có "Mã dòng" để ghép ngược.
// 3. Nhập file xã đã sửa: ghép theo Mã hộ + ID địa bàn + STT mẫu + tên chủ hộ, xem trước rồi mới ghi.
// Đơn vị tiền: NGHÌN ĐỒNG (1.000đ).
// =====================================================================

import * as XLSX from 'xlsx';
import type { Commune, Household } from '../types';
import { createDefaultQuestionnaire } from '../types/questionnaire';
import { OFFICIAL_COMMUNES_CATALOG } from '../data/communesCatalog';
import { calculateFullIncome } from './incomeCalculator';
import { findNegativeIncomeLines, validateHouseholdIncome } from './incomeExtrapolation';
import {
  isCompletedSurveyStatus,
  sameHouseholdName,
  selectOfficialHouseholdsByArea
} from './areaDataTransfer';

// -------------------- CẤU HÌNH NGƯỠNG (có thể chỉnh) --------------------
/** Cần tối thiểu bao nhiêu hộ hợp lệ cùng xã + cùng nhóm ngành mới xét "TNBQ lệch xa". */
export const OUTLIER_MIN_GROUP = 5;
/** TNBQ/người của hộ > bội số này x trung vị của nhóm => nghi vấn. */
export const OUTLIER_HIGH_RATIO = 3;
/** TNBQ/người của hộ < trung vị của nhóm / bội số này => nghi vấn. */
export const OUTLIER_LOW_RATIO = 3;

const n = (v: any): number => Number(v) || 0;

// -------------------- ĐỊNH NGHĨA CÁC NHÓM DÒNG TRONG PHIẾU --------------------
type Kind = 'salary' | 'prod' | 'nonagri' | 'block5' | 'byproduct' | 'service' | 'income';

interface GroupDef {
  code: string;      // tên trường trong phiếu, dùng làm "Mã nhóm"
  section: number;   // 1..7
  kind: Kind;
  isArray: boolean;
  muc: string;
  nhom: string;
  ten: string;       // tên hiển thị cho nhóm không phải mảng
}

const MUC_LABEL: Record<number, string> = {
  1: 'Mục 1 - Tiền lương, tiền công',
  2: 'Mục 2 - Trồng trọt',
  3: 'Mục 3 - Chăn nuôi',
  4: 'Mục 4 - Lâm nghiệp',
  5: 'Mục 5 - Thủy sản',
  6: 'Mục 6 - SXKD phi nông nghiệp',
  7: 'Mục 7 - Thu nhập khác'
};

const g = (code: string, section: number, kind: Kind, isArray: boolean, nhom: string, ten = ''): GroupDef =>
  ({ code, section, kind, isArray, muc: MUC_LABEL[section], nhom, ten: ten || nhom });

const GROUP_LIST: GroupDef[] = [
  g('muc1_rows', 1, 'salary', true, 'Tiền lương, tiền công, lương hưu, trợ cấp'),

  g('muc2_cayTrongRows', 2, 'prod', true, '1. Cây trồng các loại'),
  g('muc2_giong', 2, 'block5', false, '2. Nhân giống', 'Nhân giống cây trồng'),
  g('muc2_sanPhamPhu', 2, 'byproduct', false, '3. Sản phẩm phụ trồng trọt'),
  g('muc2_dichVu', 2, 'service', false, '4. Dịch vụ trồng trọt'),
  g('muc2_denBu', 2, 'income', false, '5. Tiền đền bù/hỗ trợ', 'Tiền được đền bù/hỗ trợ thiệt hại'),

  g('muc3_giaSucRows', 3, 'prod', true, '1. Gia súc'),
  g('muc3_giaCamRows', 3, 'prod', true, '2. Gia cầm'),
  g('muc3_khacRows', 3, 'prod', true, '3. Chăn nuôi khác'),
  g('muc3_khongGietMoRows', 3, 'prod', true, '4. Sản phẩm không qua giết mổ'),
  g('muc3_giongRows', 3, 'prod', true, '5. Giống gia súc, gia cầm, vật nuôi'),
  g('muc3_sanPhamPhu', 3, 'byproduct', false, '6. Sản phẩm phụ chăn nuôi'),
  g('muc3_dichVu', 3, 'service', false, '7. Dịch vụ chăn nuôi'),
  g('muc3_sanBat', 3, 'service', false, '8. Săn bắt, đánh bẫy'),
  g('muc3_denBu', 3, 'income', false, '9. Tiền đền bù/hỗ trợ', 'Tiền được đền bù/hỗ trợ thiệt hại'),

  g('muc4_khaiThacRows', 4, 'prod', true, '1. Khai thác, thu nhặt lâm sản'),
  g('muc4_uomGiong', 4, 'block5', false, '2. Ươm giống', 'Ươm giống cây lâm nghiệp'),
  g('muc4_trongRung', 4, 'block5', false, '3. Trồng rừng, chăm sóc', 'Trồng rừng, chăm sóc rừng'),
  g('muc4_dichVu', 4, 'service', false, '4. Dịch vụ lâm nghiệp'),
  g('muc4_denBu', 4, 'income', false, '5. Tiền đền bù/hỗ trợ', 'Tiền được đền bù/hỗ trợ thiệt hại'),

  g('muc5_nuoiTrongRows', 5, 'prod', true, '1. Nuôi trồng thủy sản'),
  g('muc5_danhBatRows', 5, 'prod', true, '2. Đánh bắt thủy sản'),
  g('muc5_sanXuatGiongRows', 5, 'prod', true, '3. Sản xuất giống thủy sản'),
  g('muc5_denBu', 5, 'income', false, '4. Tiền đền bù/hỗ trợ', 'Tiền được đền bù/hỗ trợ thiệt hại'),

  g('muc6_rows', 6, 'nonagri', true, 'SXKD phi nông nghiệp, dịch vụ, chế biến'),

  g('muc7_1_1', 7, 'income', false, '7.1 Thu từ biếu, tặng, trợ cấp', '7.1.1 Biếu, tặng, mừng, giúp'),
  g('muc7_1_2', 7, 'income', false, '7.1 Thu từ biếu, tặng, trợ cấp', '7.1.2 Trợ cấp xã hội, chính sách, thiên tai'),
  g('muc7_1_3', 7, 'income', false, '7.1 Thu từ biếu, tặng, trợ cấp', '7.1.3 Học bổng, giáo dục, y tế'),
  g('muc7_2_1', 7, 'income', false, '7.2 Thu từ tài sản', '7.2.1 Cho thuê tài sản, đất đai, nhà ở'),
  g('muc7_2_2', 7, 'income', false, '7.2 Thu từ tài sản', '7.2.2 Lãi đầu tư, tiết kiệm, cổ tức, cho vay'),
  g('muc7_3', 7, 'income', false, '7.3 Thu khác', '7.3 Trúng số, vui chơi có thưởng, khác')
];
const GROUPS: Record<string, GroupDef> = Object.fromEntries(GROUP_LIST.map(d => [d.code, d]));

/** Trường số của từng kiểu dòng: [cột Excel, tên trường trong phiếu]. */
const FIELD_MAP: Partial<Record<Kind, [CellKey, string][]>> = {
  salary: [['c1', 'col1_luong'], ['c2', 'col2_troCap']],
  prod: [['c1', 'col1_ban'], ['c2', 'col2_tuDung'], ['c4', 'col4_giong'], ['c5', 'col5_vatTu'], ['c6', 'col6_chiKhac']],
  nonagri: [['c1', 'col1_ban'], ['c2', 'col2_tuDung'], ['c4', 'col4_nguyenLieu'], ['c5', 'col5_nangLuong'], ['c6', 'col6_chiKhac']],
  block5: [['c1', 'col1'], ['c2', 'col2'], ['c4', 'col4'], ['c5', 'col5'], ['c6', 'col6']],
  byproduct: [['c1', 'col1'], ['c2', 'col2'], ['c6', 'col6']],
  service: [['c3', 'col3'], ['c6', 'col6']]
};

type CellKey = 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6';
type Vals = Record<CellKey, number>;

const emptyVals = (): Vals => ({ c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 });
const isZero = (v: Vals) => !v.c1 && !v.c2 && !v.c3 && !v.c4 && !v.c5 && !v.c6;

/** Đọc các cột số của một dòng/khối trong phiếu (có hỗ trợ dữ liệu phiếu cũ). */
const readValues = (kind: Kind, obj: any): Vals => {
  const v = emptyVals();
  if (!obj) return v;
  if (kind === 'salary') {
    v.c1 = n(obj.col1_luong ?? obj.income);
    v.c2 = n(obj.col2_troCap ?? obj.pension);
    return v;
  }
  if (kind === 'nonagri' && obj.col1_ban === undefined && obj.col4_nguyenLieu === undefined && (obj.sell !== undefined || obj.mat !== undefined)) {
    v.c1 = n(obj.sell);
    v.c4 = n(obj.mat);
    return v;
  }
  (FIELD_MAP[kind] || []).forEach(([key, field]) => { v[key] = n(obj[field]); });
  return v;
};

/** Cột 3 (tổng thu), cột 7 (tổng chi), cột 8 (thu nhập) theo đúng incomeCalculator. */
const derive = (kind: Kind, v: Vals) => {
  let c3: number;
  let c7: number;
  switch (kind) {
    case 'salary': c3 = v.c1 + v.c2; c7 = 0; break;
    case 'service': c3 = v.c3; c7 = v.c6; break;
    case 'income': c3 = v.c3; c7 = 0; break;
    case 'byproduct': c3 = v.c1 + v.c2; c7 = v.c6; break;
    default: c3 = v.c1 + v.c2; c7 = v.c4 + v.c5 + v.c6;
  }
  const c8 = kind === 'salary' || kind === 'income' ? c3 : Math.max(0, c3 - c7);
  return { c3, c7, c8 };
};

interface LineItem {
  def: GroupDef;
  rowId: string;     // rỗng với nhóm không phải mảng
  name: string;
  job: string;
  v: Vals;
}

/** Liệt kê mọi dòng có số liệu của phiếu, KHÔNG phụ thuộc ô "Có" của từng mục. */
const enumerateLines = (q: any): LineItem[] => {
  const out: LineItem[] = [];
  if (!q) return out;
  GROUP_LIST.forEach(def => {
    if (def.isArray) {
      const rows = q[def.code];
      if (!Array.isArray(rows)) return;
      rows.forEach((r: any, idx: number) => {
        if (!r) return;
        const v = readValues(def.kind, r);
        if (isZero(v)) return;
        out.push({ def, rowId: r.id ? String(r.id) : `idx${idx}`, name: String(r.name || '').trim(), job: String(r.job || '').trim(), v });
      });
    } else if (def.kind === 'income') {
      const x = n(q[def.code]);
      if (!x) return;
      out.push({ def, rowId: '', name: def.ten, job: '', v: { ...emptyVals(), c3: x } });
    } else {
      const v = readValues(def.kind, q[def.code]);
      if (isZero(v)) return;
      out.push({ def, rowId: '', name: def.ten, job: '', v });
    }
  });
  return out;
};

const sectionHasData = (q: any, section: number): boolean =>
  enumerateLines(q).some(l => l.def.section === section);

// -------------------- PHÁT HIỆN PHIẾU CẦN LÀM LẠI --------------------
export type IssueLevel = 'LOI' | 'NGHI_VAN';

export interface PhieuIssue {
  level: IssueLevel;
  code: string;
  text: string;
}

const median = (arr: number[]): number => {
  const a = [...arr].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};

const fmt = (x: number) => Math.round(x).toLocaleString('vi-VN');

/** Kiểm tra một phiếu. groupMedian = trung vị TNBQ/người của hộ hợp lệ cùng xã, cùng nhóm ngành (nếu đủ mẫu). */
export const detectPhieuIssues = (h: Household, groupMedian?: number): PhieuIssue[] => {
  const issues: PhieuIssue[] = [];
  const q: any = h.questionnaire;
  const members = n(h.membersCount);
  const working = n(h.workingMembersCount);
  const inc = calculateFullIncome(q);

  // ---- LỖI ----
  if (!(members > 0)) {
    issues.push({ level: 'LOI', code: 'THIEU_NHAN_KHAU', text: 'Thiếu số nhân khẩu (đang bằng 0)' });
  }
  if (working > members && members > 0) {
    issues.push({ level: 'LOI', code: 'LAM_VIEC_LON_HON_NHAN_KHAU', text: `Số người làm việc (${working}) lớn hơn số nhân khẩu (${members})` });
  }
  const neg = findNegativeIncomeLines(q);
  if (neg.length > 0) {
    const list = neg.slice(0, 4).map(i => `${i.section.replace(/^Mục \d - /, 'M')} - ${i.label}: thu ${fmt(i.thu)} < chi ${fmt(i.chi)}`).join('; ');
    issues.push({ level: 'LOI', code: 'CHI_LON_HON_THU', text: `Có ${neg.length} dòng chi lớn hơn thu (${list}${neg.length > 4 ? '; ...' : ''})` });
  }
  if (inc.total <= 0) {
    issues.push({ level: 'LOI', code: 'THU_NHAP_0', text: 'Tổng thu nhập của hộ bằng 0' });
  }

  // ---- NGHI VẤN ----
  const lines = enumerateLines(q);
  for (let s = 1; s <= 6; s++) {
    const has = Boolean(q?.[`muc${s}_has`]);
    const data = lines.some(l => l.def.section === s);
    if (!has && data) {
      issues.push({ level: 'NGHI_VAN', code: 'MUC_CO_SO_LIEU_CHUA_TICH', text: `${MUC_LABEL[s]} có số liệu nhưng chưa tích "Có" nên số liệu KHÔNG được tính (nếu phiếu giấy đúng là có, thêm số ${s} vào cột "Các mục tích Có")` });
    } else if (has && !data) {
      issues.push({ level: 'NGHI_VAN', code: 'MUC_TICH_CO_NHUNG_TRONG', text: `${MUC_LABEL[s]} tích "Có" nhưng không có số liệu (nếu hộ không làm, bỏ số ${s} khỏi cột "Các mục tích Có"; nếu có làm, thêm dòng ở trang Chi_tiet_thu_chi)` });
    }
  }

  if (inc.total > 0) {
    const agri = inc.muc2 + inc.muc3 + inc.muc4 + inc.muc5;
    const sector = Number(h.sectorCode);
    if (sector === 1 && agri <= 0) {
      issues.push({ level: 'NGHI_VAN', code: 'NHOM_NGANH_LECH', text: 'Hộ thuộc nhóm Nông, lâm, thủy sản nhưng phiếu không có thu nhập từ Mục 2-5' });
    } else if ((sector === 2 || sector === 3) && inc.muc6 <= 0) {
      issues.push({ level: 'NGHI_VAN', code: 'NHOM_NGANH_LECH', text: `Hộ thuộc nhóm ${sector === 2 ? 'Công nghiệp, xây dựng' : 'Thương mại, dịch vụ'} nhưng phiếu không có thu nhập từ Mục 6` });
    } else if (sector === 4 && inc.muc1 + inc.muc7 <= 0) {
      issues.push({ level: 'NGHI_VAN', code: 'NHOM_NGANH_LECH', text: 'Hộ thuộc nhóm Thu khác, tiền lương nhưng phiếu không có thu từ Mục 1 hoặc Mục 7' });
    }
  }

  if (members > 0 && groupMedian && groupMedian > 0 && inc.total > 0) {
    const pc = inc.total / members;
    if (pc > groupMedian * OUTLIER_HIGH_RATIO) {
      issues.push({ level: 'NGHI_VAN', code: 'TNBQ_QUA_CAO', text: `TNBQ/người/năm ${fmt(pc)} cao hơn ${OUTLIER_HIGH_RATIO} lần mức trung vị ${fmt(groupMedian)} của các hộ cùng xã, cùng nhóm ngành` });
    } else if (pc < groupMedian / OUTLIER_LOW_RATIO) {
      issues.push({ level: 'NGHI_VAN', code: 'TNBQ_QUA_THAP', text: `TNBQ/người/năm ${fmt(pc)} thấp hơn 1/${OUTLIER_LOW_RATIO} mức trung vị ${fmt(groupMedian)} của các hộ cùng xã, cùng nhóm ngành` });
    }
  }

  if (members > 0 && q?.muc1_has && Array.isArray(q.muc1_rows)) {
    const earners = q.muc1_rows.filter((r: any) => r && (n(r.col1_luong ?? r.income) > 0 || n(r.col2_troCap ?? r.pension) > 0)).length;
    if (earners > members) {
      issues.push({ level: 'NGHI_VAN', code: 'MUC1_NHIEU_NGUOI', text: `Mục 1 kê ${earners} người có thu nhập nhưng số nhân khẩu chỉ ${members}` });
    }
  }

  return issues;
};

// -------------------- GOM HỘ CẦN LÀM LẠI THEO PHẠM VI --------------------
export interface RedoScope {
  tkcsCode: string;        // 'ALL' hoặc mã TKCS
  communeCode: string;     // 'ALL' hoặc mã xã
  includeSuspect: boolean; // true: lỗi + nghi vấn; false: chỉ lỗi
}

export interface RedoItem {
  household: Household;
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  communeName: string;
  areaCode: string;
  areaName: string;
  idDiaBan: string;
  level: IssueLevel;
  issues: PhieuIssue[];
}

export const getIdDiaBan = (h: Pick<Household, 'communeCode' | 'areaCode'>): string =>
  `${(h.communeCode || '').trim()}${(h.areaCode || '').trim()}`;

export const collectRedoHouseholds = (
  households: Household[],
  communes: Commune[],
  scope: RedoScope
): RedoItem[] => {
  const catByCode = new Map(OFFICIAL_COMMUNES_CATALOG.map(c => [c.communeCode, c]));
  const idToCode = new Map<string, string>();
  communes.forEach(c => { if (c.id && c.communeCode) idToCode.set(c.id, c.communeCode); });
  const codeOf = (h: Household) => (h.communeCode || idToCode.get(h.communeId) || '').trim();

  const inScope = households.filter(h => {
    const code = codeOf(h);
    if (!code) return false;
    if (scope.communeCode !== 'ALL' && code !== scope.communeCode) return false;
    if (scope.tkcsCode !== 'ALL') {
      const tkcs = catByCode.get(code)?.tkcsCode || h.tkcsCode;
      if (tkcs !== scope.tkcsCode) return false;
    }
    return true;
  }).map(h => (h.communeCode ? h : { ...h, communeCode: codeOf(h) }));

  // Chỉ xét hộ chính thức đã hoàn thành / đã duyệt (hộ đang nhập dở chưa phải phiếu cuối)
  const official = selectOfficialHouseholdsByArea(inScope)
    .filter(h => isCompletedSurveyStatus(h.surveyStatus) && h.questionnaire);

  // Trung vị TNBQ/người theo (xã, nhóm ngành) từ các hộ hợp lệ
  const groups = new Map<string, number[]>();
  official.forEach(h => {
    const members = n(h.membersCount);
    if (!(members > 0) || !validateHouseholdIncome(h.questionnaire).ok) return;
    const key = `${h.communeCode}|${Number(h.sectorCode) || 0}`;
    const list = groups.get(key) || [];
    list.push(calculateFullIncome(h.questionnaire).total / members);
    groups.set(key, list);
  });
  const medians = new Map<string, number>();
  groups.forEach((list, key) => { if (list.length >= OUTLIER_MIN_GROUP) medians.set(key, median(list)); });

  const items: RedoItem[] = [];
  official.forEach(h => {
    const med = medians.get(`${h.communeCode}|${Number(h.sectorCode) || 0}`);
    let issues = detectPhieuIssues(h, med);
    if (!scope.includeSuspect) issues = issues.filter(i => i.level === 'LOI');
    if (issues.length === 0) return;
    const cat = catByCode.get(h.communeCode);
    items.push({
      household: h,
      tkcsCode: cat?.tkcsCode || h.tkcsCode || '',
      tkcsName: cat?.tkcsName || h.tkcsName || '',
      communeCode: h.communeCode,
      communeName: cat?.communeName || h.communeName || h.communeCode,
      areaCode: h.areaCode || '',
      areaName: (h.areaName && h.areaName !== 'Địa bàn' ? h.areaName : '') || h.sheetName || (h.areaCode ? `Địa bàn ${h.areaCode}` : ''),
      idDiaBan: getIdDiaBan(h),
      level: issues.some(i => i.level === 'LOI') ? 'LOI' : 'NGHI_VAN',
      issues
    });
  });

  const sttNum = (h: Household) => (/^\d+$/.test((h.sttMau || '').trim()) ? Number(h.sttMau) : 9999);
  items.sort((a, b) =>
    a.tkcsCode.localeCompare(b.tkcsCode, 'vi', { numeric: true }) ||
    a.communeName.localeCompare(b.communeName, 'vi', { numeric: true }) ||
    a.areaCode.localeCompare(b.areaCode, 'vi', { numeric: true }) ||
    sttNum(a.household) - sttNum(b.household)
  );
  return items;
};

export interface RedoAreaSummary {
  communeCode: string;
  communeName: string;
  tkcsName: string;
  areaCode: string;
  areaName: string;
  idDiaBan: string;
  total: number;
  errors: number;
  suspects: number;
  sttList: string[];
}

export const summarizeRedoByArea = (items: RedoItem[]): RedoAreaSummary[] => {
  const map = new Map<string, RedoAreaSummary>();
  items.forEach(it => {
    let s = map.get(it.idDiaBan);
    if (!s) {
      s = {
        communeCode: it.communeCode, communeName: it.communeName, tkcsName: it.tkcsName,
        areaCode: it.areaCode, areaName: it.areaName, idDiaBan: it.idDiaBan,
        total: 0, errors: 0, suspects: 0, sttList: []
      };
      map.set(it.idDiaBan, s);
    }
    s.total += 1;
    if (it.level === 'LOI') s.errors += 1; else s.suspects += 1;
    s.sttList.push(it.household.sttMau || '');
  });
  return Array.from(map.values());
};

// -------------------- GHI RA EXCEL (1 file / 1 xã) --------------------
const SHEET_GUIDE = 'Huong_dan';
const SHEET_HO = 'Ho_can_lam_lai';
const SHEET_LINES = 'Chi_tiet_thu_chi';
const SHEET_AREAS = 'Tong_hop_dia_ban';
const SHEET_CODES = 'Ma_nhom';

const HO_HEADERS = [
  'ID địa bàn', 'Mã xã', 'Tên xã/phường', 'Mã địa bàn', 'Tên địa bàn', 'STT mẫu', 'Họ tên chủ hộ', 'Địa chỉ',
  'Mã hộ (hệ thống - KHÔNG SỬA)', 'Mức độ', 'Lý do cần làm lại',
  'Số nhân khẩu (SỬA)', 'Số người làm việc (SỬA)', 'Các mục tích Có (SỬA)', 'Ghi chú của xã'
];

const LINE_HEADERS = [
  'ID địa bàn', 'STT mẫu', 'Họ tên chủ hộ', 'Mã hộ (hệ thống - KHÔNG SỬA)', 'Mã dòng (KHÔNG SỬA)',
  'Mục', 'Nhóm', 'Tên sản phẩm / dịch vụ / thành viên (SỬA)', 'Công việc (chỉ Mục 1)',
  'Cột 1: Bán ra, đổi, cho (Mục 1: Tiền lương)',
  'Cột 2: Để lại dùng (Mục 1: Lương hưu, trợ cấp)',
  'Cột 3 = 1+2: TỔNG THU (nhập trực tiếp với dịch vụ, săn bắt, đền bù, Mục 7)',
  'Cột 4: Giống / Nguyên vật liệu',
  'Cột 5: Vật tư, thức ăn / Năng lượng',
  'Cột 6: Chi khác',
  'Cột 7 = 4+5+6: TỔNG CHI',
  'Cột 8 = 3-7: THU NHẬP',
  'Xóa dòng (gõ X)',
  'Cảnh báo'
];

const colLetter = (idx: number): string => {
  let s = '';
  let x = idx + 1;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
};

const slug = (s: string): string =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd')
    .replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

const KIND_HELP: Record<Kind, string> = {
  salary: 'Cột 1 = tiền lương, tiền công; Cột 2 = lương hưu, trợ cấp. Có thêm Tên thành viên và Công việc.',
  prod: 'Điền Cột 1, 2 (thu) và Cột 4, 5, 6 (chi). Cột 3, 7, 8 tự tính.',
  nonagri: 'Điền Cột 1, 2 (thu) và Cột 4, 5, 6 (chi: nguyên vật liệu, năng lượng, chi khác). Cột 3, 7, 8 tự tính.',
  block5: 'Điền Cột 1, 2 (thu) và Cột 4, 5, 6 (chi). Một dòng duy nhất cho mỗi hộ.',
  byproduct: 'Điền Cột 1, 2 (thu) và Cột 6 (chi khác). Một dòng duy nhất cho mỗi hộ.',
  service: 'Điền Cột 3 (tổng thu) và Cột 6 (chi khác). Một dòng duy nhất cho mỗi hộ.',
  income: 'Chỉ điền Cột 3 (số tiền được cộng thẳng vào thu nhập). Một dòng duy nhất cho mỗi hộ.'
};

/** Các mục (1-6) đang tích "Có" trong phiếu, dạng "2, 3" hoặc "Không". */
const tickedSectionsText = (q: any): string => {
  const list: number[] = [];
  for (let s = 1; s <= 6; s++) if (q?.[`muc${s}_has`]) list.push(s);
  return list.length ? list.join(', ') : 'Không';
};

/** Đọc cột "Các mục tích Có": null nếu để trống (không thay đổi), ngược lại là tập mục 1-6. */
const parseTickedSections = (raw: Raw): Set<number> | null => {
  const t = norm(raw);
  if (!t) return null;
  const set = new Set<number>();
  if (/kh[oô]ng/.test(t)) return set;
  (t.match(/\d+/g) || []).forEach(d => { const k = Number(d); if (k >= 1 && k <= 6) set.add(k); });
  return set;
};

export const buildRedoWorkbook = (items: RedoItem[]): XLSX.WorkBook => {
  const first = items[0];
  const today = new Date();
  const wb = XLSX.utils.book_new();

  // ---- Hướng dẫn ----
  const guide: string[][] = [
    ['PHIẾU CẦN LÀM LẠI - FILE GỬI XÃ CẬP NHẬT'],
    [`Xã/phường: ${first?.communeName || ''} (${first?.communeCode || ''}) • ${first?.tkcsName || ''} • Xuất ngày ${today.toLocaleDateString('vi-VN')} • Đơn vị tiền: nghìn đồng (1.000đ), thu nhập cả năm`],
    [''],
    ['CÁCH LÀM'],
    ['1. Mở trang Ho_can_lam_lai: mỗi dòng là một hộ có số liệu chưa hợp lý, cột "Lý do cần làm lại" cho biết hộ sai/nghi sai ở đâu.'],
    ['2. Đối chiếu với PHIẾU GIẤY của hộ. Nếu phiếu trong file đúng thực tế thì không phải sửa gì, ghi rõ vào cột "Ghi chú của xã".'],
    ['3. Sửa số liệu ở trang Chi_tiet_thu_chi (các cột số, tên sản phẩm). Số nhân khẩu và số người làm việc sửa ở trang Ho_can_lam_lai.'],
    ['   Cột "Các mục tích Có": các mục (1-6) hộ có phát sinh thu nhập. Mục nào có số liệu mà không nằm trong cột này thì số liệu bị bỏ qua. Sửa lại cho đúng phiếu giấy, VD: 2, 3 hoặc gõ Không.'],
    ['4. Cột 3, 7, 8 của các dòng sản xuất tự tính bằng công thức, không gõ đè. Dòng nào chi lớn hơn thu thì thu nhập tính bằng 0 và hộ bị loại khỏi bình quân.'],
    [''],
    ['XÓA DÒNG: gõ chữ X vào cột "Xóa dòng" của dòng đó. Dòng không gõ X sẽ được giữ lại (kể cả khi bạn xóa hẳn dòng trong Excel thì hệ thống KHÔNG hiểu là xóa).'],
    ['THÊM DÒNG MỚI: sao chép nguyên một dòng cùng nhóm của hộ đó, dán thêm xuống dưới, xóa phần từ dấu # trở đi trong cột "Mã dòng" (VD: muc2_cayTrongRows#abc123 sửa thành muc2_cayTrongRows), rồi nhập tên và số liệu. Danh sách mã nhóm xem ở trang Ma_nhom.'],
    ['   Nhóm chỉ có 1 dòng/hộ (nhân giống, sản phẩm phụ, dịch vụ, đền bù, Mục 7) thì sửa trực tiếp trên dòng đang có, hoặc thêm dòng với đúng mã nhóm đó nếu hộ chưa có dòng.'],
    [''],
    ['TUYỆT ĐỐI KHÔNG SỬA các cột ghi "KHÔNG SỬA" (Mã hộ, Mã dòng), không đổi ID địa bàn, STT mẫu, Họ tên chủ hộ: hệ thống dùng các cột này để đưa số liệu về đúng hộ, đúng địa bàn. Không đổi tên các trang (sheet) và không đổi tên cột tiêu đề.'],
    ['Không nhập số âm. Ô để trống ở các cột số của dòng sản xuất được hiểu là 0.'],
    ['Sau khi sửa xong, lưu file (giữ định dạng .xlsx, giữ nguyên tên file) và gửi lại cho Admin.'],
    [''],
    ['Số hộ cần làm lại trong file: ' + items.length],
    ['Các mức độ: LỖI = hộ đang bị loại khỏi bình quân (thiếu nhân khẩu, chi lớn hơn thu, tổng thu nhập bằng 0...). NGHI VẤN = cần đối chiếu lại phiếu giấy (số liệu lệch so với nhóm ngành hoặc lệch xa các hộ cùng xã...).']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  wsGuide['!cols'] = [{ wch: 150 }];
  XLSX.utils.book_append_sheet(wb, wsGuide, SHEET_GUIDE);

  // ---- Hộ cần làm lại ----
  const hoRows: any[][] = [HO_HEADERS];
  items.forEach(it => {
    const h = it.household;
    hoRows.push([
      it.idDiaBan, it.communeCode, it.communeName, it.areaCode, it.areaName, h.sttMau ?? '',
      h.householdHead || '', h.address || '', h.id,
      it.level === 'LOI' ? 'LỖI' : 'NGHI VẤN',
      it.issues.map(i => `[${i.level === 'LOI' ? 'Lỗi' : 'Nghi vấn'}] ${i.text}`).join('; '),
      n(h.membersCount), n(h.workingMembersCount), tickedSectionsText(h.questionnaire), ''
    ]);
  });
  const wsHo = XLSX.utils.aoa_to_sheet(hoRows);
  wsHo['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 9 }, { wch: 20 }, { wch: 8 }, { wch: 24 }, { wch: 28 },
    { wch: 26 }, { wch: 11 }, { wch: 90 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 40 }
  ];
  wsHo['!autofilter'] = { ref: `A1:${colLetter(HO_HEADERS.length - 1)}${Math.max(2, hoRows.length)}` };
  XLSX.utils.book_append_sheet(wb, wsHo, SHEET_HO);

  // ---- Chi tiết thu - chi (đúng nội dung phiếu hiện có) ----
  const lineRows: any[][] = [LINE_HEADERS];
  items.forEach(it => {
    const h = it.household;
    enumerateLines(h.questionnaire).forEach(line => {
      const r = lineRows.length + 1; // số dòng Excel (1-based) của dòng sắp thêm
      const { kind } = line.def;
      const { c3, c7, c8 } = derive(kind, line.v);
      const J = `J${r}`, K = `K${r}`, L = `L${r}`, M = `M${r}`, N = `N${r}`, O = `O${r}`, P = `P${r}`;
      const num = (f: string | null, v: number) => (f ? { t: 'n', f, v } : v);
      const blank = '';

      let c1: any = blank, c2: any = blank, c3Cell: any = blank, c4: any = blank, c5: any = blank, c6: any = blank, c7Cell: any = blank, c8Cell: any = blank;
      if (kind === 'salary') {
        c1 = line.v.c1; c2 = line.v.c2;
        c3Cell = num(`${J}+${K}`, c3);
        c8Cell = num(L, c8);
      } else if (kind === 'service') {
        c3Cell = line.v.c3; c6 = line.v.c6;
        c7Cell = num(O, c7);
        c8Cell = num(`MAX(0,${L}-${P})`, c8);
      } else if (kind === 'income') {
        c3Cell = line.v.c3;
        c8Cell = num(L, c8);
      } else if (kind === 'byproduct') {
        c1 = line.v.c1; c2 = line.v.c2; c6 = line.v.c6;
        c3Cell = num(`${J}+${K}`, c3);
        c7Cell = num(O, c7);
        c8Cell = num(`MAX(0,${L}-${P})`, c8);
      } else {
        c1 = line.v.c1; c2 = line.v.c2; c4 = line.v.c4; c5 = line.v.c5; c6 = line.v.c6;
        c3Cell = num(`${J}+${K}`, c3);
        c7Cell = num(`${M}+${N}+${O}`, c7);
        c8Cell = num(`MAX(0,${L}-${P})`, c8);
      }

      const key = line.def.isArray ? `${line.def.code}#${line.rowId}` : line.def.code;
      lineRows.push([
        it.idDiaBan, h.sttMau ?? '', h.householdHead || '', h.id, key,
        line.def.muc, line.def.nhom, line.name || '(chưa đặt tên)', line.job,
        c1, c2, c3Cell, c4, c5, c6, c7Cell, c8Cell,
        '', c7 > c3 && kind !== 'income' && kind !== 'salary' ? 'Chi lớn hơn thu (thu nhập tính bằng 0)' : ''
      ]);
    });
  });
  const wsLines = XLSX.utils.aoa_to_sheet(lineRows);
  for (let r = 1; r < lineRows.length; r++) {
    for (let c = 9; c <= 16; c++) {
      const cell = wsLines[XLSX.utils.encode_cell({ r, c })];
      if (cell && cell.t === 'n') cell.z = '#,##0';
    }
  }
  wsLines['!cols'] = [
    { wch: 12 }, { wch: 8 }, { wch: 24 }, { wch: 26 }, { wch: 34 }, { wch: 30 }, { wch: 34 }, { wch: 40 }, { wch: 22 },
    { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 36 }
  ];
  wsLines['!autofilter'] = { ref: `A1:${colLetter(LINE_HEADERS.length - 1)}${Math.max(2, lineRows.length)}` };
  XLSX.utils.book_append_sheet(wb, wsLines, SHEET_LINES);

  // ---- Tổng hợp địa bàn ----
  const areaRows: any[][] = [[
    'ID địa bàn', 'Mã xã', 'Tên xã/phường', 'Mã địa bàn', 'Tên địa bàn', 'Số hộ cần làm lại', 'Số hộ LỖI', 'Số hộ NGHI VẤN', 'STT mẫu các hộ cần làm lại'
  ]];
  summarizeRedoByArea(items).forEach(s => {
    areaRows.push([s.idDiaBan, s.communeCode, s.communeName, s.areaCode, s.areaName, s.total, s.errors, s.suspects, s.sttList.join(', ')]);
  });
  const wsAreas = XLSX.utils.aoa_to_sheet(areaRows);
  wsAreas['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 22 }, { wch: 9 }, { wch: 22 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsAreas, SHEET_AREAS);

  // ---- Mã nhóm ----
  const codeRows: any[][] = [['Mã nhóm', 'Mục', 'Nhóm', 'Có nhiều dòng/hộ?', 'Cách điền']];
  GROUP_LIST.forEach(d => codeRows.push([d.code, d.muc, d.nhom, d.isArray ? 'Có (mỗi dòng 1 mã #...)' : 'Không (1 dòng/hộ)', KIND_HELP[d.kind]]));
  const wsCodes = XLSX.utils.aoa_to_sheet(codeRows);
  wsCodes['!cols'] = [{ wch: 26 }, { wch: 30 }, { wch: 40 }, { wch: 24 }, { wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wsCodes, SHEET_CODES);

  return wb;
};

export const redoFileName = (communeCode: string, communeName: string): string =>
  `Phieu_can_lam_lai_${communeCode}_${slug(communeName)}_${new Date().toISOString().slice(0, 10)}.xlsx`;

export interface RedoExportResult {
  files: { fileName: string; communeName: string; households: number }[];
  totalHouseholds: number;
  totalAreas: number;
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

/** Xuất mỗi xã 1 file (các file tải về lần lượt, cách nhau một chút để trình duyệt không chặn). */
export const exportRedoFiles = async (items: RedoItem[]): Promise<RedoExportResult> => {
  const byCommune = new Map<string, RedoItem[]>();
  items.forEach(it => {
    const list = byCommune.get(it.communeCode) || [];
    list.push(it);
    byCommune.set(it.communeCode, list);
  });
  const result: RedoExportResult = {
    files: [],
    totalHouseholds: items.length,
    totalAreas: summarizeRedoByArea(items).length
  };
  let i = 0;
  for (const [code, list] of byCommune) {
    if (i > 0) await sleep(600);
    const fileName = redoFileName(code, list[0].communeName);
    XLSX.writeFile(buildRedoWorkbook(list), fileName);
    result.files.push({ fileName, communeName: list[0].communeName, households: list.length });
    i += 1;
  }
  return result;
};

// -------------------- ĐỌC FILE XÃ ĐÃ SỬA --------------------
type Raw = any;

interface HoEdit {
  file?: string;
  rowNo: number;
  idDiaBan: string;
  stt: string;
  chuHo: string;
  maHo: string;
  nhanKhau: Raw;
  lamViec: Raw;
  muc: Raw;
  ghiChu: string;
}

interface LineEdit {
  file?: string;
  rowNo: number;
  idDiaBan: string;
  stt: string;
  chuHo: string;
  maHo: string;
  key: string;
  name: string;
  job: string;
  cells: Record<CellKey, Raw>;
  del: boolean;
}

export interface ParsedRedoFile {
  hoEdits: HoEdit[];
  lineEdits: LineEdit[];
  fileErrors: string[];
}

const norm = (s: any): string =>
  String(s ?? '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
const text = (v: any): string => String(v ?? '').trim();

const findCol = (headers: any[], prefix: string): number => {
  const p = norm(prefix);
  return headers.findIndex(h => norm(h).startsWith(p));
};

export const parseRedoWorkbook = (data: ArrayBuffer, fileName = ''): ParsedRedoFile => {
  const out: ParsedRedoFile = { hoEdits: [], lineEdits: [], fileErrors: [] };
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(data, { type: 'array' });
  } catch (e: any) {
    out.fileErrors.push(`${fileName ? fileName + ': ' : ''}Không đọc được file Excel: ` + (e?.message || e));
    return out;
  }
  const sheetRows = (name: string): any[][] | null => {
    const ws = wb.Sheets[name];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '', raw: true });
  };

  const hoRows = sheetRows(SHEET_HO);
  const lineRows = sheetRows(SHEET_LINES);
  if (!hoRows && !lineRows) {
    out.fileErrors.push(`${fileName ? fileName + ': ' : ''}File không có trang "${SHEET_HO}" hoặc "${SHEET_LINES}". Có thể không phải file do hệ thống xuất ra, hoặc xã đã đổi tên trang.`);
    return out;
  }

  if (hoRows && hoRows.length > 0) {
    const h = hoRows[0];
    const col = {
      id: findCol(h, 'ID địa bàn'), stt: findCol(h, 'STT mẫu'), chuHo: findCol(h, 'Họ tên chủ hộ'),
      maHo: findCol(h, 'Mã hộ'), nk: findCol(h, 'Số nhân khẩu'), lv: findCol(h, 'Số người làm việc'), mc: findCol(h, 'Các mục tích Có'), gc: findCol(h, 'Ghi chú của xã')
    };
    if ([col.id, col.stt, col.chuHo, col.maHo].some(c => c < 0)) {
      out.fileErrors.push(`${fileName ? fileName + ': ' : ''}Trang "${SHEET_HO}" thiếu cột định danh (ID địa bàn, STT mẫu, Họ tên chủ hộ, Mã hộ). Không thể ghép về đúng hộ.`);
    } else {
      for (let i = 1; i < hoRows.length; i++) {
        const r = hoRows[i];
        if (!text(r[col.maHo]) && !text(r[col.chuHo])) continue;
        out.hoEdits.push({
          file: fileName, rowNo: i + 1, idDiaBan: text(r[col.id]), stt: text(r[col.stt]), chuHo: text(r[col.chuHo]), maHo: text(r[col.maHo]),
          nhanKhau: col.nk >= 0 ? r[col.nk] : '', lamViec: col.lv >= 0 ? r[col.lv] : '', muc: col.mc >= 0 ? r[col.mc] : '', ghiChu: col.gc >= 0 ? text(r[col.gc]) : ''
        });
      }
    }
  }

  if (lineRows && lineRows.length > 0) {
    const h = lineRows[0];
    const col = {
      id: findCol(h, 'ID địa bàn'), stt: findCol(h, 'STT mẫu'), chuHo: findCol(h, 'Họ tên chủ hộ'),
      maHo: findCol(h, 'Mã hộ'), key: findCol(h, 'Mã dòng'), name: findCol(h, 'Tên sản phẩm'), job: findCol(h, 'Công việc'),
      c1: findCol(h, 'Cột 1'), c2: findCol(h, 'Cột 2'), c3: findCol(h, 'Cột 3'), c4: findCol(h, 'Cột 4'),
      c5: findCol(h, 'Cột 5'), c6: findCol(h, 'Cột 6'), del: findCol(h, 'Xóa dòng')
    };
    const missing = Object.entries(col).filter(([, v]) => v < 0).map(([k]) => k);
    if (missing.length > 0) {
      out.fileErrors.push(`${fileName ? fileName + ': ' : ''}Trang "${SHEET_LINES}" thiếu cột (${missing.join(', ')}). Có thể xã đã đổi tên hoặc xóa cột tiêu đề.`);
    } else {
      for (let i = 1; i < lineRows.length; i++) {
        const r = lineRows[i];
        if (!text(r[col.key]) && !text(r[col.maHo])) continue;
        out.lineEdits.push({
          file: fileName, rowNo: i + 1, idDiaBan: text(r[col.id]), stt: text(r[col.stt]), chuHo: text(r[col.chuHo]), maHo: text(r[col.maHo]),
          key: text(r[col.key]), name: text(r[col.name]), job: text(r[col.job]),
          cells: { c1: r[col.c1], c2: r[col.c2], c3: r[col.c3], c4: r[col.c4], c5: r[col.c5], c6: r[col.c6] },
          del: text(r[col.del]).toUpperCase() === 'X'
        });
      }
    }
  }
  return out;
};

/** Gộp kết quả đọc của nhiều file xã để xem trước một lượt. */
export const mergeParsedRedoFiles = (list: ParsedRedoFile[]): ParsedRedoFile => ({
  hoEdits: list.flatMap(p => p.hoEdits),
  lineEdits: list.flatMap(p => p.lineEdits),
  fileErrors: list.flatMap(p => p.fileErrors)
});

/** Đọc số từ ô Excel: trả về { blank } nếu trống, { bad } nếu không phải số. */
const parseCell = (raw: Raw): { blank: boolean; bad: boolean; value: number } => {
  if (raw === '' || raw === null || raw === undefined) return { blank: true, bad: false, value: 0 };
  if (typeof raw === 'number') return Number.isFinite(raw) ? { blank: false, bad: false, value: raw } : { blank: false, bad: true, value: 0 };
  let t = String(raw).trim().replace(/\s/g, '');
  if (!t) return { blank: true, bad: false, value: 0 };
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  else if (/^-?\d+,\d+$/.test(t)) t = t.replace(',', '.');
  const v = Number(t);
  return Number.isFinite(v) ? { blank: false, bad: false, value: v } : { blank: false, bad: true, value: 0 };
};

// -------------------- XEM TRƯỚC & GHÉP VỀ ĐÚNG HỘ --------------------
export interface RedoImportItem {
  status: 'UPDATE' | 'NO_CHANGE' | 'ERROR';
  idDiaBan: string;
  communeName: string;
  areaName: string;
  stt: string;
  chuHo: string;
  errors: string[];
  changedLines: number;
  membersBefore: number;
  membersAfter: number;
  incomeBefore: number;
  incomeAfter: number;
  validBefore: boolean;
  validAfter: boolean;
  remainingIssues: string[];
  xaNote: string;
  next?: Household;
}

export interface RedoImportPreview {
  items: RedoImportItem[];
  update: number;
  noChange: number;
  error: number;
  fileErrors: string[];
}

const isValidForAverage = (h: { membersCount?: any; questionnaire?: any }): boolean =>
  n(h.membersCount) > 0 && validateHouseholdIncome(h.questionnaire).ok;

const parseKey = (key: string): { code: string; rowId: string } => {
  const i = key.indexOf('#');
  return i < 0 ? { code: key.trim(), rowId: '' } : { code: key.slice(0, i).trim(), rowId: key.slice(i + 1).trim() };
};

let rowCounter = 0;
const newRowId = () => `redo-${Date.now().toString(36)}-${(rowCounter++).toString(36)}`;

const at = (e: { file?: string; rowNo: number }): string =>
  e.file ? `[${e.file}] dòng ${e.rowNo}` : `Dòng ${e.rowNo}`;

const keyNum = (v: Raw) => text(v).replace(/^0+(?=\d)/, '');

/** Tìm hộ trong hệ thống: ưu tiên Mã hộ, rồi (ID địa bàn + STT mẫu + tên chủ hộ). */
const resolveHousehold = (
  idx: { byId: Map<string, Household>; byAreaStt: Map<string, Household[]> },
  e: { maHo: string; idDiaBan: string; stt: string; chuHo: string }
): { h?: Household; error?: string } => {
  if (e.maHo) {
    const h = idx.byId.get(e.maHo);
    if (h) {
      if (e.idDiaBan && getIdDiaBan(h) !== e.idDiaBan) {
        return { error: `Mã hộ thuộc địa bàn ${getIdDiaBan(h)} nhưng file ghi ID địa bàn ${e.idDiaBan}` };
      }
      if (!sameHouseholdName(h.householdHead, e.chuHo)) {
        return { error: `Tên chủ hộ không khớp (file: "${e.chuHo}", hệ thống: "${h.householdHead}")` };
      }
      return { h };
    }
  }
  const list = (idx.byAreaStt.get(`${e.idDiaBan}|${keyNum(e.stt)}`) || []).filter(h => sameHouseholdName(h.householdHead, e.chuHo));
  if (list.length === 1) return { h: list[0] };
  if (list.length > 1) return { error: `Có ${list.length} hộ trùng ID địa bàn ${e.idDiaBan}, STT mẫu ${e.stt}, tên "${e.chuHo}". Không xác định được hộ.` };
  return { error: `Không tìm thấy hộ trên hệ thống (ID địa bàn ${e.idDiaBan}, STT mẫu ${e.stt}, chủ hộ "${e.chuHo}")` };
};

export const previewRedoImport = (
  parsed: ParsedRedoFile,
  households: Household[],
  communes: Commune[]
): RedoImportPreview => {
  const preview: RedoImportPreview = { items: [], update: 0, noChange: 0, error: 0, fileErrors: [...parsed.fileErrors] };
  if (preview.fileErrors.length > 0 && parsed.hoEdits.length === 0 && parsed.lineEdits.length === 0) return preview;

  const idToCode = new Map<string, string>();
  communes.forEach(c => { if (c.id && c.communeCode) idToCode.set(c.id, c.communeCode); });
  const byId = new Map<string, Household>();
  const byAreaStt = new Map<string, Household[]>();
  households.forEach(h => {
    byId.set(h.id, h);
    const hh = h.communeCode ? h : { ...h, communeCode: idToCode.get(h.communeId) || '' };
    const k = `${getIdDiaBan(hh)}|${keyNum(h.sttMau)}`;
    const list = byAreaStt.get(k) || [];
    list.push(h);
    byAreaStt.set(k, list);
  });
  const idx = { byId, byAreaStt };

  // Gom chỉnh sửa theo hộ (khóa: Mã hộ | ID địa bàn | STT mẫu)
  interface Bucket { ho?: HoEdit; lines: LineEdit[]; ref: { maHo: string; idDiaBan: string; stt: string; chuHo: string } }
  const buckets = new Map<string, Bucket>();
  const bucketOf = (ref: Bucket['ref']): Bucket => {
    const k = `${ref.maHo}|${ref.idDiaBan}|${keyNum(ref.stt)}`;
    let b = buckets.get(k);
    if (!b) { b = { lines: [], ref }; buckets.set(k, b); }
    return b;
  };
  parsed.hoEdits.forEach(e => { bucketOf(e).ho = e; });
  parsed.lineEdits.forEach(e => { bucketOf(e).lines.push(e); });

  const resolvedIds = new Set<string>();
  buckets.forEach(b => {
    const ref = b.ref;
    const cat = OFFICIAL_COMMUNES_CATALOG.find(c => c.communeCode && ref.idDiaBan.startsWith(c.communeCode));
    const item: RedoImportItem = {
      status: 'ERROR', idDiaBan: ref.idDiaBan, communeName: cat?.communeName || '', areaName: '', stt: ref.stt, chuHo: ref.chuHo,
      errors: [], changedLines: 0, membersBefore: 0, membersAfter: 0, incomeBefore: 0, incomeAfter: 0,
      validBefore: false, validAfter: false, remainingIssues: [], xaNote: b.ho?.ghiChu || ''
    };

    const found = resolveHousehold(idx, ref);
    if (!found.h) {
      item.errors.push(found.error || 'Không tìm thấy hộ');
      preview.items.push(item); preview.error += 1; return;
    }
    const h = found.h;
    if (resolvedIds.has(h.id)) {
      item.errors.push('Hộ này xuất hiện nhiều lần trong file với thông tin định danh khác nhau (có thể xã đã sửa STT mẫu / ID địa bàn / Mã hộ). Không áp dụng để tránh ghi nhầm.');
      preview.items.push(item); preview.error += 1; return;
    }
    resolvedIds.add(h.id);
    item.communeName = h.communeName || item.communeName;
    item.areaName = h.areaName || h.sheetName || '';
    item.membersBefore = n(h.membersCount);
    item.incomeBefore = calculateFullIncome(h.questionnaire).total;
    item.validBefore = isValidForAverage(h);

    const q: any = JSON.parse(JSON.stringify(h.questionnaire || createDefaultQuestionnaire()));
    const changedSections = new Set<number>();
    const seenFixed = new Set<string>();
    let changedLines = 0;
    const markChanged = (section: number) => { changedLines += 1; changedSections.add(section); };

    const readCell = (e: LineEdit, key: CellKey, label: string): number | null => {
      const c = parseCell(e.cells[key]);
      if (c.bad) { item.errors.push(`${at(e)} (${label}): ô "${String(e.cells[key])}" không phải số`); return null; }
      if (c.value < 0) { item.errors.push(`${at(e)} (${label}): không được nhập số âm`); return null; }
      return c.value;
    };

    b.lines.forEach(e => {
      const { code, rowId } = parseKey(e.key);
      const def = GROUPS[code];
      if (!def) { item.errors.push(`${at(e)}: mã nhóm "${code}" không hợp lệ (xem trang ${SHEET_CODES})`); return; }
      const label = e.name || def.nhom;

      // --- đọc số theo đúng các cột của kiểu dòng ---
      const fields = def.kind === 'income' ? ([['c3', def.code]] as [CellKey, string][]) : (FIELD_MAP[def.kind] || []);
      const vals: Partial<Record<CellKey, number>> = {};
      if (!e.del) {
        for (const [key] of fields) {
          const v = readCell(e, key, label);
          if (v === null) return;
          vals[key] = v;
        }
      }

      if (def.isArray) {
        const rows: any[] = Array.isArray(q[def.code]) ? q[def.code] : (q[def.code] = []);
        if (rowId) {
          const pos = rowId.startsWith('idx') && /^idx\d+$/.test(rowId)
            ? Number(rowId.slice(3))
            : rows.findIndex(r => r && String(r.id) === rowId);
          const row = pos >= 0 ? rows[pos] : undefined;
          if (!row) {
            if (e.del) return; // dòng đã không còn: coi như đã xóa
            item.errors.push(`${at(e)} (${label}): dòng này không còn trong phiếu trên hệ thống (phiếu có thể đã được sửa sau khi xuất file)`);
            return;
          }
          if (e.del) { rows.splice(pos, 1); markChanged(def.section); return; }
          const before = JSON.stringify(row);
          if (e.name) row.name = e.name;
          if (def.kind === 'salary' && e.job) row.job = e.job;
          if (def.kind === 'nonagri' && row.col1_ban === undefined && row.col4_nguyenLieu === undefined) {
            delete row.sell; delete row.mat; // chuyển dòng phiếu cũ sang cấu trúc mới
          }
          if (def.kind === 'salary') { delete row.income; delete row.pension; }
          (FIELD_MAP[def.kind] || []).forEach(([key, field]) => { row[field] = vals[key] ?? 0; });
          if (JSON.stringify(row) !== before) markChanged(def.section);
        } else {
          if (e.del) return;
          if (!e.name) { item.errors.push(`${at(e)}: dòng mới thêm phải có tên (cột "Tên sản phẩm / dịch vụ / thành viên")`); return; }
          const row: any = { id: newRowId(), name: e.name };
          if (def.kind === 'salary') row.job = e.job;
          (FIELD_MAP[def.kind] || []).forEach(([key, field]) => { row[field] = vals[key] ?? 0; });
          rows.push(row);
          markChanged(def.section);
        }
        return;
      }

      // --- nhóm không phải mảng: 1 dòng/hộ ---
      if (seenFixed.has(def.code)) { item.errors.push(`${at(e)}: nhóm "${def.code}" xuất hiện nhiều lần trong cùng một hộ`); return; }
      seenFixed.add(def.code);
      if (def.kind === 'income') {
        const before = n(q[def.code]);
        const after = e.del ? 0 : (vals.c3 ?? 0);
        q[def.code] = after;
        if (after !== before) markChanged(def.section);
        return;
      }
      const obj = q[def.code] && typeof q[def.code] === 'object' ? q[def.code] : (q[def.code] = {});
      const before = JSON.stringify(obj);
      (FIELD_MAP[def.kind] || []).forEach(([key, field]) => { obj[field] = e.del ? 0 : (vals[key] ?? 0); });
      if (JSON.stringify(obj) !== before) markChanged(def.section);
    });

    // --- số nhân khẩu / số người làm việc ---
    let members = n(h.membersCount);
    let working = n(h.workingMembersCount);
    let membersChanged = false;
    if (b.ho) {
      const nk = parseCell(b.ho.nhanKhau);
      if (nk.bad || (!nk.blank && (nk.value <= 0 || !Number.isInteger(nk.value)))) {
        item.errors.push(`Số nhân khẩu phải là số nguyên lớn hơn 0 (${at(b.ho)}, trang ${SHEET_HO})`);
      } else if (!nk.blank && nk.value !== members) { members = nk.value; membersChanged = true; }
      const lv = parseCell(b.ho.lamViec);
      if (lv.bad || (!lv.blank && (lv.value < 0 || !Number.isInteger(lv.value)))) {
        item.errors.push(`Số người làm việc phải là số nguyên từ 0 trở lên (${at(b.ho)}, trang ${SHEET_HO})`);
      } else if (!lv.blank && lv.value !== working) { working = lv.value; membersChanged = true; }
    }
    if (membersChanged && working > members) {
      item.errors.push(`Số người làm việc (${working}) lớn hơn số nhân khẩu (${members})`);
    }

    // --- cờ "Có" của từng mục ---
    // 1) Cột "Các mục tích Có" (nếu xã điền) là căn cứ rõ ràng nhất; 2) mục nào có dòng bị đổi thì cờ theo số liệu thực tế.
    const explicit = b.ho ? parseTickedSections(b.ho.muc) : null;
    for (let s2 = 1; s2 <= 6; s2++) {
      const key = `muc${s2}_has`;
      const current = Boolean(h.questionnaire && (h.questionnaire as any)[key]);
      if (explicit && explicit.has(s2) !== current) q[key] = explicit.has(s2);
      else if (changedSections.has(s2)) q[key] = sectionHasData(q, s2);
    }
    if (changedSections.has(7) && sectionHasData(q, 7)) q.muc7_has = true;
    const flagsChanged = JSON.stringify(q) !== JSON.stringify(h.questionnaire || {}) && changedLines === 0;

    if (item.errors.length > 0) {
      preview.items.push(item); preview.error += 1; return;
    }

    item.changedLines = changedLines;
    item.membersAfter = members;
    const next: Household = {
      ...h,
      membersCount: members,
      workingMembersCount: working,
      ...(membersChanged ? { membersCountEntered: true } : {}),
      surveyStatus: h.surveyStatus === 'DA_DUYET' ? 'DA_HOAN_THANH' : h.surveyStatus,
      updatedBy: 'Nhập file Excel xã sửa lại',
      updatedAt: new Date().toISOString(),
      questionnaire: q
    };
    item.incomeAfter = calculateFullIncome(q).total;
    item.validAfter = isValidForAverage(next);
    item.remainingIssues = detectPhieuIssues(next).filter(i => i.level === 'LOI').map(i => i.text);

    if (changedLines === 0 && !membersChanged && !flagsChanged) {
      item.status = 'NO_CHANGE'; preview.noChange += 1;
    } else {
      item.status = 'UPDATE'; item.next = next; preview.update += 1;
    }
    preview.items.push(item);
  });

  const order = { ERROR: 0, UPDATE: 1, NO_CHANGE: 2 } as const;
  preview.items.sort((a, b) => order[a.status] - order[b.status] || a.idDiaBan.localeCompare(b.idDiaBan) || a.stt.localeCompare(b.stt, 'vi', { numeric: true }));
  return preview;
};
