/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =====================================================================
// CÔNG THỨC DUY NHẤT cho Thu nhập bình quân (TNBQ) và Suy rộng.
// Mọi màn hình (tab Nhập tin, màn kiểm soát vĩ mô của Admin) đều gọi file này
// để cùng một số liệu luôn ra cùng một kết quả. Đơn vị: NGHÌN ĐỒNG.
//
// 1. Thu nhập hộ  = tổng 7 mục (calculateFullIncome).
//    Hộ chỉ được tính khi: có số nhân khẩu > 0, tổng thu nhập > 0 và không có dòng nào chi > thu.
// 2. TNBQ nhóm hộ (năm)  = Tổng thu nhập các hộ hợp lệ của nhóm / Tổng nhân khẩu của chính các hộ đó.
// 3. TNBQ toàn xã (năm)  = Tổng(tỷ trọng đã chia lại x TNBQ nhóm) của các nhóm CÓ số liệu.
//    Tỷ trọng đã chia lại = tỷ trọng cố định của nhóm / tổng tỷ trọng cố định của các nhóm có số liệu.
// 4. TNBQ tháng = TNBQ năm / 12.
// 5. Cấp nhiều xã / toàn tỉnh = Tổng(TNBQ năm xã x dân số xã) / Tổng dân số của các xã CÓ số liệu.
// 6. Chỉ làm tròn khi hiển thị, không làm tròn giữa chừng.
// =====================================================================

import { calculateFullIncome } from './incomeCalculator';

export type SectorCode = 1 | 2 | 3 | 4;
export const SECTOR_CODES: SectorCode[] = [1, 2, 3, 4];

export interface HouseholdLike {
  sectorCode?: any;
  membersCount?: any;
  questionnaire?: any;
}

// -------------------- KIỂM TRA THU NHẬP (dòng chi > thu, tổng <= 0) --------------------

export interface IncomeLineIssue {
  section: string;   // Tên mục (VD: "Mục 2 - Trồng trọt")
  label: string;     // Tên dòng (VD: "Lúa")
  thu: number;
  chi: number;
}

const n = (v: any): number => Number(v) || 0;

/** Liệt kê các dòng có Chi lớn hơn Thu (thu nhập âm) trong những mục đang được tích "Có". */
export const findNegativeIncomeLines = (q?: any): IncomeLineIssue[] => {
  const issues: IncomeLineIssue[] = [];
  if (!q) return issues;

  const checkRows = (section: string, rows: any, kind: 'prod' | 'nonagri' = 'prod') => {
    if (!Array.isArray(rows)) return;
    rows.forEach((r: any, idx: number) => {
      if (!r) return;
      const thu = n(r.col1_ban) + n(r.col2_tuDung);
      const chi = kind === 'nonagri'
        ? n(r.col4_nguyenLieu) + n(r.col5_nangLuong) + n(r.col6_chiKhac)
        : n(r.col4_giong) + n(r.col5_vatTu) + n(r.col6_chiKhac);
      if (chi > thu) issues.push({ section, label: r.name || `Dòng ${idx + 1}`, thu, chi });
    });
  };
  const checkBlock = (section: string, label: string, thu: number, chi: number) => {
    if (chi > thu) issues.push({ section, label, thu, chi });
  };
  const sumC1C2 = (b: any) => n(b?.col1) + n(b?.col2);

  if (q.muc2_has) {
    const s = 'Mục 2 - Trồng trọt';
    checkRows(s, q.muc2_cayTrongRows);
    if (q.muc2_giong) checkBlock(s, 'Nhân giống', sumC1C2(q.muc2_giong), n(q.muc2_giong.col4) + n(q.muc2_giong.col5) + n(q.muc2_giong.col6));
    if (q.muc2_sanPhamPhu) checkBlock(s, 'Sản phẩm phụ', sumC1C2(q.muc2_sanPhamPhu), n(q.muc2_sanPhamPhu.col6));
    if (q.muc2_dichVu) checkBlock(s, 'Dịch vụ trồng trọt', n(q.muc2_dichVu.col3), n(q.muc2_dichVu.col6));
  }
  if (q.muc3_has) {
    const s = 'Mục 3 - Chăn nuôi';
    checkRows(s, q.muc3_giaSucRows);
    checkRows(s, q.muc3_giaCamRows);
    checkRows(s, q.muc3_khacRows);
    checkRows(s, q.muc3_khongGietMoRows);
    checkRows(s, q.muc3_giongRows);
    if (q.muc3_sanPhamPhu) checkBlock(s, 'Sản phẩm phụ chăn nuôi', sumC1C2(q.muc3_sanPhamPhu), n(q.muc3_sanPhamPhu.col6));
    if (q.muc3_dichVu) checkBlock(s, 'Dịch vụ chăn nuôi', n(q.muc3_dichVu.col3), n(q.muc3_dichVu.col6));
    if (q.muc3_sanBat) checkBlock(s, 'Săn bắt, đánh bẫy', n(q.muc3_sanBat.col3), n(q.muc3_sanBat.col6));
  }
  if (q.muc4_has) {
    const s = 'Mục 4 - Lâm nghiệp';
    checkRows(s, q.muc4_khaiThacRows);
    if (q.muc4_uomGiong) checkBlock(s, 'Ươm giống', sumC1C2(q.muc4_uomGiong), n(q.muc4_uomGiong.col4) + n(q.muc4_uomGiong.col5) + n(q.muc4_uomGiong.col6));
    if (q.muc4_trongRung) checkBlock(s, 'Trồng rừng', sumC1C2(q.muc4_trongRung), n(q.muc4_trongRung.col4) + n(q.muc4_trongRung.col5) + n(q.muc4_trongRung.col6));
    if (q.muc4_dichVu) checkBlock(s, 'Dịch vụ lâm nghiệp', n(q.muc4_dichVu.col3), n(q.muc4_dichVu.col6));
  }
  if (q.muc5_has) {
    const s = 'Mục 5 - Thủy sản';
    checkRows(s, q.muc5_nuoiTrongRows);
    checkRows(s, q.muc5_danhBatRows);
    checkRows(s, q.muc5_sanXuatGiongRows);
  }
  if (q.muc6_has && Array.isArray(q.muc6_rows)) {
    const s = 'Mục 6 - SXKD phi nông nghiệp';
    q.muc6_rows.forEach((r: any, idx: number) => {
      if (!r) return;
      if (r.col1_ban !== undefined) {
        const thu = n(r.col1_ban) + n(r.col2_tuDung);
        const chi = n(r.col4_nguyenLieu) + n(r.col5_nangLuong) + n(r.col6_chiKhac);
        if (chi > thu) issues.push({ section: s, label: r.name || `Dòng ${idx + 1}`, thu, chi });
      } else {
        const thu = n(r.sell);
        const chi = n(r.mat);
        if (chi > thu) issues.push({ section: s, label: r.name || `Dòng ${idx + 1}`, thu, chi });
      }
    });
  }
  return issues;
};

export interface IncomeValidation {
  ok: boolean;
  total: number;
  issues: IncomeLineIssue[];
  /** Thông báo lỗi tổng hợp để hiển thị cho người nhập (rỗng nếu hợp lệ) */
  message: string;
}

/** Thu nhập hộ phải > 0 và không dòng nào có chi lớn hơn thu. */
export const validateHouseholdIncome = (q?: any): IncomeValidation => {
  const total = calculateFullIncome(q).total;
  const issues = findNegativeIncomeLines(q);
  const parts: string[] = [];
  if (issues.length > 0) {
    const list = issues.slice(0, 6).map(i => `• ${i.section} - ${i.label}: thu ${i.thu.toLocaleString('vi-VN')} < chi ${i.chi.toLocaleString('vi-VN')}`).join('\n');
    parts.push(`Có ${issues.length} dòng Chi lớn hơn Thu (thu nhập âm):\n${list}${issues.length > 6 ? '\n• ...' : ''}`);
  }
  if (total <= 0) {
    parts.push('Tổng thu nhập của hộ phải lớn hơn 0. Hiện tổng thu nhập đang bằng 0, vui lòng kiểm tra lại các mục đã nhập.');
  }
  return { ok: parts.length === 0, total, issues, message: parts.join('\n\n') };
};

/** Hộ được tính vào bình quân: có nhân khẩu > 0 và thu nhập hợp lệ. */
export const isHouseholdCountedForAverage = (h: HouseholdLike): boolean => {
  if (!h || !h.questionnaire) return false;
  if (!(Number(h.membersCount) > 0)) return false;
  return validateHouseholdIncome(h.questionnaire).ok;
};

// -------------------- BÌNH QUÂN NHÓM VÀ SUY RỘNG TOÀN XÃ --------------------

export interface SectorStat {
  code: SectorCode;
  households: number;       // số hộ hợp lệ
  members: number;          // tổng nhân khẩu của các hộ hợp lệ
  income: number;           // tổng thu nhập các hộ hợp lệ (nghìn đồng/năm)
  perCapitaYear: number | null; // null nếu chưa có hộ
}

export interface SectorContribution extends SectorStat {
  fixedWeight: number;      // tỷ trọng cố định (%), VD 22.62
  adjustedWeight: number;   // tỷ trọng đã chia lại (0-1) trên các nhóm có số liệu
  contributionYear: number; // adjustedWeight x perCapitaYear
}

export interface CommuneExtrapolation {
  sectors: SectorContribution[];
  usedCodes: SectorCode[];
  missingCodes: SectorCode[];   // nhóm có tỷ trọng > 0 nhưng chưa có hộ hợp lệ
  hasData: boolean;
  isPartial: boolean;           // còn thiếu nhóm => số tạm tính
  perCapitaYear: number;
  perCapitaMonth: number;
  countedHouseholds: number;
  countedMembers: number;
}

export const SECTOR_SHORT_NAMES: Record<SectorCode, string> = {
  1: 'Nông, lâm, thủy sản',
  2: 'Công nghiệp, xây dựng',
  3: 'Thương mại, dịch vụ',
  4: 'Thu khác, tiền lương'
};

export const calcSectorStats = (households: HouseholdLike[]): SectorStat[] => {
  return SECTOR_CODES.map(code => {
    let count = 0, members = 0, income = 0;
    households.forEach(h => {
      if (Number(h.sectorCode) !== code) return;
      if (!isHouseholdCountedForAverage(h)) return;
      count += 1;
      members += Number(h.membersCount) || 0;
      income += calculateFullIncome(h.questionnaire).total;
    });
    return { code, households: count, members, income, perCapitaYear: members > 0 ? income / members : null };
  });
};

/**
 * Suy rộng 1 xã.
 * weightsPercent: 4 tỷ trọng cố định (%) của xã theo thứ tự nhóm 1,2,3,4.
 */
export const extrapolateCommune = (
  households: HouseholdLike[],
  weightsPercent: [number, number, number, number]
): CommuneExtrapolation => {
  const stats = calcSectorStats(households);
  const used = stats.filter((s, i) => s.perCapitaYear !== null && (Number(weightsPercent[i]) || 0) > 0);
  const usedWeightSum = used.reduce((acc, s) => acc + (Number(weightsPercent[s.code - 1]) || 0), 0);

  const sectors: SectorContribution[] = stats.map((s, i) => {
    const fixedWeight = Number(weightsPercent[i]) || 0;
    const isUsed = s.perCapitaYear !== null && fixedWeight > 0 && usedWeightSum > 0;
    const adjustedWeight = isUsed ? fixedWeight / usedWeightSum : 0;
    return {
      ...s,
      fixedWeight,
      adjustedWeight,
      contributionYear: isUsed && s.perCapitaYear !== null ? adjustedWeight * s.perCapitaYear : 0
    };
  });

  const perCapitaYear = sectors.reduce((acc, s) => acc + s.contributionYear, 0);
  const usedCodes = sectors.filter(s => s.adjustedWeight > 0).map(s => s.code);
  const missingCodes = sectors.filter(s => s.fixedWeight > 0 && s.adjustedWeight === 0).map(s => s.code);

  return {
    sectors,
    usedCodes,
    missingCodes,
    hasData: usedCodes.length > 0,
    isPartial: usedCodes.length > 0 && missingCodes.length > 0,
    perCapitaYear,
    perCapitaMonth: perCapitaYear / 12,
    countedHouseholds: stats.reduce((a, s) => a + s.households, 0),
    countedMembers: stats.reduce((a, s) => a + s.members, 0)
  };
};

// -------------------- GỘP NHIỀU XÃ (TKCS / TOÀN TỈNH) THEO DÂN SỐ --------------------

export interface CommuneInput {
  key: string;
  population: number;
  weights: [number, number, number, number];
  households: HouseholdLike[];
}

export interface ScopeExtrapolation {
  communes: Array<CommuneInput & { result: CommuneExtrapolation; fundYear: number }>;
  surveyedCommunes: number;
  surveyedPopulation: number;   // tổng dân số của các xã đã có số liệu
  totalPopulation: number;      // tổng dân số tất cả xã trong phạm vi
  perCapitaYear: number;
  perCapitaMonth: number;
  fundYear: number;             // tổng thu nhập năm của các xã đã có số liệu (nghìn đồng)
  fundMonth: number;
  /** Đóng góp của từng nhóm vào TNBQ chung (năm), tổng 4 nhóm = perCapitaYear */
  sectorContributionYear: Record<SectorCode, number>;
  /** Số liệu gộp thực tế của từng nhóm trên toàn phạm vi (để hiển thị) */
  pooled: SectorStat[];
  isPartial: boolean;           // còn xã chưa có số liệu hoặc xã thiếu nhóm
}

export const extrapolateScope = (inputs: CommuneInput[]): ScopeExtrapolation => {
  const communes = inputs.map(i => {
    const result = extrapolateCommune(i.households, i.weights);
    return { ...i, result, fundYear: result.perCapitaYear * (Number(i.population) || 0) };
  });
  const withData = communes.filter(c => c.result.hasData && (Number(c.population) || 0) > 0);
  const surveyedPopulation = withData.reduce((a, c) => a + (Number(c.population) || 0), 0);
  const totalPopulation = communes.reduce((a, c) => a + (Number(c.population) || 0), 0);
  const fundYear = withData.reduce((a, c) => a + c.fundYear, 0);
  const perCapitaYear = surveyedPopulation > 0 ? fundYear / surveyedPopulation : 0;

  const sectorContributionYear: Record<SectorCode, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  if (surveyedPopulation > 0) {
    withData.forEach(c => {
      const pop = Number(c.population) || 0;
      c.result.sectors.forEach(s => {
        sectorContributionYear[s.code] += (pop * s.contributionYear) / surveyedPopulation;
      });
    });
  }

  const allHouseholds: HouseholdLike[] = communes.flatMap(c => c.households);
  return {
    communes,
    surveyedCommunes: withData.length,
    surveyedPopulation,
    totalPopulation,
    perCapitaYear,
    perCapitaMonth: perCapitaYear / 12,
    fundYear,
    fundMonth: fundYear / 12,
    sectorContributionYear,
    pooled: calcSectorStats(allHouseholds),
    isPartial: withData.length < communes.length || withData.some(c => c.result.isPartial)
  };
};
