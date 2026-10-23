/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FullQuestionnaire, ProductionRow, NonAgriRow } from '../types/questionnaire';

export interface IncomeBreakdown {
  muc1: number; // Tiền lương, tiền công
  muc2: number; // Trồng trọt
  muc3: number; // Chăn nuôi
  muc4: number; // Lâm nghiệp
  muc5: number; // Thủy sản
  muc6: number; // SXKD phi nông nghiệp
  muc7: number; // Thu nhập khác
  total: number; // Tổng cộng 7 mục
}

// Tính thu nhập 1 dòng sản xuất: Thu nhập (Cột 8) = Tổng thu (Cột 3) - Tổng chi (Cột 7)
export const calcProductionRowIncome = (r: ProductionRow): number => {
  const col3_tongThu = (Number(r.col1_ban) || 0) + (Number(r.col2_tuDung) || 0);
  const col7_tongChi = (Number(r.col4_giong) || 0) + (Number(r.col5_vatTu) || 0) + (Number(r.col6_chiKhac) || 0);
  return Math.max(0, col3_tongThu - col7_tongChi);
};

// Tính thu nhập 1 dòng SXKD phi nông nghiệp
export const calcNonAgriRowIncome = (r: NonAgriRow): number => {
  const col3_tongThu = (Number(r.col1_ban) || 0) + (Number(r.col2_tuDung) || 0);
  const col7_tongChi = (Number(r.col4_nguyenLieu) || 0) + (Number(r.col5_nangLuong) || 0) + (Number(r.col6_chiKhac) || 0);
  return Math.max(0, col3_tongThu - col7_tongChi);
};

export const calculateFullIncome = (q?: FullQuestionnaire | any): IncomeBreakdown => {
  if (!q) {
    return { muc1: 0, muc2: 0, muc3: 0, muc4: 0, muc5: 0, muc6: 0, muc7: 0, total: 0 };
  }

  // Mục 1: Lương, công + Lương hưu, trợ cấp
  let muc1 = 0;
  if (q.muc1_has && Array.isArray(q.muc1_rows)) {
    muc1 = q.muc1_rows.reduce((sum: number, r: any) => {
      const luong = Number(r.col1_luong ?? r.income) || 0;
      const troCap = Number(r.col2_troCap ?? r.pension) || 0;
      return sum + luong + troCap;
    }, 0);
  }

  // Mục 2: Trồng trọt
  let muc2 = 0;
  if (q.muc2_has) {
    // 1. Cây trồng các loại
    if (Array.isArray(q.muc2_cayTrongRows)) {
      muc2 += q.muc2_cayTrongRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    }
    // 2. Giống
    if (q.muc2_giong) {
      const thu = (Number(q.muc2_giong.col1) || 0) + (Number(q.muc2_giong.col2) || 0);
      const chi = (Number(q.muc2_giong.col4) || 0) + (Number(q.muc2_giong.col5) || 0) + (Number(q.muc2_giong.col6) || 0);
      muc2 += Math.max(0, thu - chi);
    }
    // 3. Sản phẩm phụ
    if (q.muc2_sanPhamPhu) {
      const thu = (Number(q.muc2_sanPhamPhu.col1) || 0) + (Number(q.muc2_sanPhamPhu.col2) || 0);
      const chi = Number(q.muc2_sanPhamPhu.col6) || 0;
      muc2 += Math.max(0, thu - chi);
    }
    // 4. Dịch vụ trồng trọt
    if (q.muc2_dichVu) {
      const thu = Number(q.muc2_dichVu.col3) || 0;
      const chi = Number(q.muc2_dichVu.col6) || 0;
      muc2 += Math.max(0, thu - chi);
    }
    // 5. Đền bù
    muc2 += Number(q.muc2_denBu) || 0;

    // Tương thích ngược nếu dữ liệu cũ ở dạng phẳng
    if (muc2 === 0 && q.muc2_data) {
      const d = q.muc2_data;
      const thu = (Number(d.cayTrongSell) || 0) + (Number(d.cayTrongUse) || 0) + (Number(d.nhanGiangSell) || 0) + (Number(d.nhanGiangUse) || 0);
      const chi = (Number(d.cayTrongSeed) || 0) + (Number(d.cayTrongFert) || 0);
      muc2 = Math.max(0, thu - chi);
    }
  }

  // Mục 3: Chăn nuôi
  let muc3 = 0;
  if (q.muc3_has) {
    if (Array.isArray(q.muc3_giaSucRows)) muc3 += q.muc3_giaSucRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (Array.isArray(q.muc3_giaCamRows)) muc3 += q.muc3_giaCamRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (Array.isArray(q.muc3_khacRows)) muc3 += q.muc3_khacRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (Array.isArray(q.muc3_khongGietMoRows)) muc3 += q.muc3_khongGietMoRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (Array.isArray(q.muc3_giongRows)) muc3 += q.muc3_giongRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);

    if (q.muc3_sanPhamPhu) {
      const thu = (Number(q.muc3_sanPhamPhu.col1) || 0) + (Number(q.muc3_sanPhamPhu.col2) || 0);
      const chi = Number(q.muc3_sanPhamPhu.col6) || 0;
      muc3 += Math.max(0, thu - chi);
    }
    if (q.muc3_dichVu) {
      muc3 += Math.max(0, (Number(q.muc3_dichVu.col3) || 0) - (Number(q.muc3_dichVu.col6) || 0));
    }
    if (q.muc3_sanBat) {
      muc3 += Math.max(0, (Number(q.muc3_sanBat.col3) || 0) - (Number(q.muc3_sanBat.col6) || 0));
    }
    muc3 += Number(q.muc3_denBu) || 0;

    // Tương thích ngược
    if (muc3 === 0 && q.muc3_data) {
      const d = q.muc3_data;
      const thu = (Number(d.giaSucSell) || 0) + (Number(d.giaSucUse) || 0) + (Number(d.giaCamSell) || 0) + (Number(d.giaCamUse) || 0);
      const chi = (Number(d.giaSucSeed) || 0) + (Number(d.giaSucFood) || 0);
      muc3 = Math.max(0, thu - chi);
    }
  }

  // Mục 4: Lâm nghiệp
  let muc4 = 0;
  if (q.muc4_has) {
    if (Array.isArray(q.muc4_khaiThacRows)) muc4 += q.muc4_khaiThacRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (q.muc4_uomGiong) {
      const thu = (Number(q.muc4_uomGiong.col1) || 0) + (Number(q.muc4_uomGiong.col2) || 0);
      const chi = (Number(q.muc4_uomGiong.col4) || 0) + (Number(q.muc4_uomGiong.col5) || 0) + (Number(q.muc4_uomGiong.col6) || 0);
      muc4 += Math.max(0, thu - chi);
    }
    if (q.muc4_trongRung) {
      const thu = (Number(q.muc4_trongRung.col1) || 0) + (Number(q.muc4_trongRung.col2) || 0);
      const chi = (Number(q.muc4_trongRung.col4) || 0) + (Number(q.muc4_trongRung.col5) || 0) + (Number(q.muc4_trongRung.col6) || 0);
      muc4 += Math.max(0, thu - chi);
    }
    if (q.muc4_dichVu) {
      muc4 += Math.max(0, (Number(q.muc4_dichVu.col3) || 0) - (Number(q.muc4_dichVu.col6) || 0));
    }
    muc4 += Number(q.muc4_denBu) || 0;

    // Tương thích ngược
    if (muc4 === 0 && q.muc4_data) {
      muc4 = Number(q.muc4_data.khaiThacSell) || 0;
    }
  }

  // Mục 5: Thủy sản
  let muc5 = 0;
  if (q.muc5_has) {
    if (Array.isArray(q.muc5_nuoiTrongRows)) muc5 += q.muc5_nuoiTrongRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (Array.isArray(q.muc5_danhBatRows)) muc5 += q.muc5_danhBatRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    if (Array.isArray(q.muc5_sanXuatGiongRows)) muc5 += q.muc5_sanXuatGiongRows.reduce((sum: number, r: ProductionRow) => sum + calcProductionRowIncome(r), 0);
    muc5 += Number(q.muc5_denBu) || 0;

    // Tương thích ngược
    if (muc5 === 0 && q.muc5_data) {
      muc5 = Number(q.muc5_data.nuoiSell) || 0;
    }
  }

  // Mục 6: SXKD phi nông nghiệp hoặc chế biến
  let muc6 = 0;
  if (q.muc6_has && Array.isArray(q.muc6_rows)) {
    muc6 = q.muc6_rows.reduce((sum: number, r: any) => {
      if (r.col1_ban !== undefined) return sum + calcNonAgriRowIncome(r);
      return sum + Math.max(0, (Number(r.sell) || 0) - (Number(r.mat) || 0));
    }, 0);
  }

  // Mục 7: Thu nhập khác
  let muc7 = 0;
  muc7 += Number(q.muc7_1_1) || 0; // Biếu, tặng, mừng, giúp
  muc7 += Number(q.muc7_1_2) || 0; // Trợ cấp xã hội, thiên tai
  muc7 += Number(q.muc7_1_3) || 0; // Học bổng, giáo dục, y tế
  muc7 += Number(q.muc7_2_1) || 0; // Cho thuê tài sản, đất đai, nhà ở
  muc7 += Number(q.muc7_2_2) || 0; // Lãi đầu tư, tiết kiệm, cổ tức
  muc7 += Number(q.muc7_3) || 0;   // Trúng số, vui chơi có thưởng, khác

  const total = muc1 + muc2 + muc3 + muc4 + muc5 + muc6 + muc7;

  return { muc1, muc2, muc3, muc4, muc5, muc6, muc7, total };
};
