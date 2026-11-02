/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// =====================================================================
// XUẤT EXCEL CHI TIẾT PHIẾU ĐÃ HOÀN THÀNH (dành cho Admin)
// File gồm 4 trang:
//  1. Tong_hop_ho     : mỗi hộ 1 dòng, thu nhập theo 7 mục, tổng thu nhập, TNBQ
//  2. Thanh_vien      : các thành viên trong hộ (Mục 1: họ tên, công việc, lương, trợ cấp)
//  3. Chi_tiet_thu_chi: từng dòng sản phẩm/dịch vụ của các mục 1-7 với đủ cột thu và chi
//  4. Huong_dan       : giải thích cột, công thức, đơn vị
// Đơn vị tiền: NGHÌN ĐỒNG. Thu nhập từng dòng = Tổng thu - Tổng chi (không âm), đúng như phần mềm đang tính.
// =====================================================================

import * as XLSX from 'xlsx';
import { calculateFullIncome } from './incomeCalculator';
import { validateHouseholdIncome } from './incomeExtrapolation';

export interface ExportLocation {
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  communeName: string;
  areaCode: string;
  areaName: string;
}

export interface QuestionnaireExportContext {
  resolveLocation: (household: any) => ExportLocation;
  statusLabel: (status?: string) => string;
}

const n = (v: any): number => Number(v) || 0;
const fmtDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour12: false });
};

// ---------- Dòng chi tiết thu - chi ----------
interface DetailLine {
  muc: string;
  nhom: string;
  ten: string;
  c1: number | '';     // Bán ra
  c2: number | '';     // Để lại dùng
  c3: number | '';     // Tổng thu
  c4: number | '';     // Giống / Nguyên vật liệu
  c5: number | '';     // Vật tư, thức ăn / Năng lượng
  c6: number | '';     // Chi khác
  c7: number | '';     // Tổng chi
  c8: number;          // Thu nhập
  ghiChu: string;
}

const MUC_LABEL = {
  1: 'Mục 1 - Tiền lương, tiền công',
  2: 'Mục 2 - Trồng trọt',
  3: 'Mục 3 - Chăn nuôi',
  4: 'Mục 4 - Lâm nghiệp',
  5: 'Mục 5 - Thủy sản',
  6: 'Mục 6 - SXKD phi nông nghiệp',
  7: 'Mục 7 - Thu nhập khác'
} as const;

/** Dựng các dòng chi tiết thu - chi của 1 phiếu, theo đúng quy tắc của incomeCalculator. */
export const buildDetailLines = (q: any): DetailLine[] => {
  const lines: DetailLine[] = [];
  if (!q) return lines;

  // Dòng có đủ cột 1,2,4,5,6 (thu = c1+c2, chi = c4+c5+c6)
  const addFull = (muc: string, nhom: string, ten: string, c1: any, c2: any, c4: any, c5: any, c6: any) => {
    const v1 = n(c1), v2 = n(c2), v4 = n(c4), v5 = n(c5), v6 = n(c6);
    if (!v1 && !v2 && !v4 && !v5 && !v6) return;
    const c3 = v1 + v2;
    const c7 = v4 + v5 + v6;
    const c8 = Math.max(0, c3 - c7);
    lines.push({ muc, nhom, ten, c1: v1, c2: v2, c3, c4: v4, c5: v5, c6: v6, c7, c8, ghiChu: c7 > c3 ? 'Chi lớn hơn thu (thu nhập tính bằng 0)' : '' });
  };
  // Dòng chỉ có Tổng thu (cột 3) và Chi khác (cột 6): dịch vụ, săn bắt
  const addServiceLike = (muc: string, nhom: string, ten: string, c3: any, c6: any) => {
    const v3 = n(c3), v6 = n(c6);
    if (!v3 && !v6) return;
    const c8 = Math.max(0, v3 - v6);
    lines.push({ muc, nhom, ten, c1: '', c2: '', c3: v3, c4: '', c5: '', c6: v6, c7: v6, c8, ghiChu: v6 > v3 ? 'Chi lớn hơn thu (thu nhập tính bằng 0)' : '' });
  };
  // Sản phẩm phụ: cột 1, 2 và 6
  const addByproduct = (muc: string, nhom: string, ten: string, b: any) => {
    addFull(muc, nhom, ten, b?.col1, b?.col2, 0, 0, b?.col6);
  };
  // Tiền đền bù/hỗ trợ: cộng thẳng vào thu nhập
  const addCompensation = (muc: string, nhom: string, value: any) => {
    const v = n(value);
    if (!v) return;
    lines.push({ muc, nhom, ten: 'Tiền được đền bù/hỗ trợ thiệt hại', c1: '', c2: '', c3: '', c4: '', c5: '', c6: '', c7: '', c8: v, ghiChu: 'Cộng thẳng vào thu nhập' });
  };
  const addRows = (muc: string, nhom: string, rows: any, kind: 'prod' | 'nonagri' = 'prod') => {
    if (!Array.isArray(rows)) return;
    rows.forEach((r: any, idx: number) => {
      if (!r) return;
      const ten = (r.name || '').toString().trim() || `(Dòng ${idx + 1} chưa đặt tên)`;
      if (kind === 'nonagri') {
        if (r.col1_ban !== undefined || r.col4_nguyenLieu !== undefined) {
          addFull(muc, nhom, ten, r.col1_ban, r.col2_tuDung, r.col4_nguyenLieu, r.col5_nangLuong, r.col6_chiKhac);
        } else {
          // Dữ liệu phiếu cũ: sell / mat
          addServiceLike(muc, nhom, ten, r.sell, r.mat);
        }
      } else {
        addFull(muc, nhom, ten, r.col1_ban, r.col2_tuDung, r.col4_giong, r.col5_vatTu, r.col6_chiKhac);
      }
    });
  };

  // Mục 1: mỗi thành viên có thu nhập là 1 dòng (tiền lương + lương hưu/trợ cấp)
  if (q.muc1_has && Array.isArray(q.muc1_rows)) {
    q.muc1_rows.forEach((r: any, idx: number) => {
      if (!r) return;
      const luong = n(r.col1_luong ?? r.income);
      const troCap = n(r.col2_troCap ?? r.pension);
      if (!luong && !troCap) return;
      const ten = [r.name, r.job].filter(Boolean).join(' - ') || `(Thành viên ${idx + 1})`;
      lines.push({ muc: MUC_LABEL[1], nhom: 'Tiền lương, tiền công, lương hưu, trợ cấp', ten, c1: '', c2: '', c3: luong + troCap, c4: '', c5: '', c6: '', c7: '', c8: luong + troCap, ghiChu: '' });
    });
  }

  if (q.muc2_has) {
    const m = MUC_LABEL[2];
    addRows(m, '1. Cây trồng các loại', q.muc2_cayTrongRows);
    addFull(m, '2. Nhân giống', 'Nhân giống cây trồng', q.muc2_giong?.col1, q.muc2_giong?.col2, q.muc2_giong?.col4, q.muc2_giong?.col5, q.muc2_giong?.col6);
    addByproduct(m, '3. Sản phẩm phụ trồng trọt', 'Sản phẩm phụ trồng trọt', q.muc2_sanPhamPhu);
    addServiceLike(m, '4. Dịch vụ trồng trọt', 'Dịch vụ trồng trọt', q.muc2_dichVu?.col3, q.muc2_dichVu?.col6);
    addCompensation(m, '5. Tiền đền bù/hỗ trợ', q.muc2_denBu);
  }
  if (q.muc3_has) {
    const m = MUC_LABEL[3];
    addRows(m, '1. Gia súc', q.muc3_giaSucRows);
    addRows(m, '2. Gia cầm', q.muc3_giaCamRows);
    addRows(m, '3. Chăn nuôi khác', q.muc3_khacRows);
    addRows(m, '4. Sản phẩm không qua giết mổ', q.muc3_khongGietMoRows);
    addRows(m, '5. Giống gia súc, gia cầm, vật nuôi', q.muc3_giongRows);
    addByproduct(m, '6. Sản phẩm phụ chăn nuôi', 'Sản phẩm phụ chăn nuôi', q.muc3_sanPhamPhu);
    addServiceLike(m, '7. Dịch vụ chăn nuôi', 'Dịch vụ chăn nuôi', q.muc3_dichVu?.col3, q.muc3_dichVu?.col6);
    addServiceLike(m, '8. Săn bắt, đánh bẫy', 'Săn bắt, đánh bẫy', q.muc3_sanBat?.col3, q.muc3_sanBat?.col6);
    addCompensation(m, '9. Tiền đền bù/hỗ trợ', q.muc3_denBu);
  }
  if (q.muc4_has) {
    const m = MUC_LABEL[4];
    addRows(m, '1. Khai thác, thu nhặt lâm sản', q.muc4_khaiThacRows);
    addFull(m, '2. Ươm giống', 'Ươm giống cây lâm nghiệp', q.muc4_uomGiong?.col1, q.muc4_uomGiong?.col2, q.muc4_uomGiong?.col4, q.muc4_uomGiong?.col5, q.muc4_uomGiong?.col6);
    addFull(m, '3. Trồng rừng, chăm sóc', 'Trồng rừng, chăm sóc rừng', q.muc4_trongRung?.col1, q.muc4_trongRung?.col2, q.muc4_trongRung?.col4, q.muc4_trongRung?.col5, q.muc4_trongRung?.col6);
    addServiceLike(m, '4. Dịch vụ lâm nghiệp', 'Dịch vụ lâm nghiệp', q.muc4_dichVu?.col3, q.muc4_dichVu?.col6);
    addCompensation(m, '5. Tiền đền bù/hỗ trợ', q.muc4_denBu);
  }
  if (q.muc5_has) {
    const m = MUC_LABEL[5];
    addRows(m, '1. Nuôi trồng thủy sản', q.muc5_nuoiTrongRows);
    addRows(m, '2. Đánh bắt thủy sản', q.muc5_danhBatRows);
    addRows(m, '3. Sản xuất giống thủy sản', q.muc5_sanXuatGiongRows);
    addCompensation(m, '4. Tiền đền bù/hỗ trợ', q.muc5_denBu);
  }
  if (q.muc6_has) {
    addRows(MUC_LABEL[6], 'SXKD phi nông nghiệp, dịch vụ, chế biến', q.muc6_rows, 'nonagri');
  }
  // Mục 7 luôn được cộng vào thu nhập (không phụ thuộc ô "Có")
  const m7 = MUC_LABEL[7];
  const addIncomeOnly = (nhom: string, ten: string, v: any) => {
    const x = n(v);
    if (!x) return;
    lines.push({ muc: m7, nhom, ten, c1: '', c2: '', c3: x, c4: '', c5: '', c6: '', c7: '', c8: x, ghiChu: '' });
  };
  addIncomeOnly('7.1 Thu từ biếu, tặng, trợ cấp', '7.1.1 Biếu, tặng, mừng, giúp', q.muc7_1_1);
  addIncomeOnly('7.1 Thu từ biếu, tặng, trợ cấp', '7.1.2 Trợ cấp xã hội, chính sách, thiên tai', q.muc7_1_2);
  addIncomeOnly('7.1 Thu từ biếu, tặng, trợ cấp', '7.1.3 Học bổng, giáo dục, y tế', q.muc7_1_3);
  addIncomeOnly('7.2 Thu từ tài sản', '7.2.1 Cho thuê tài sản, đất đai, nhà ở', q.muc7_2_1);
  addIncomeOnly('7.2 Thu từ tài sản', '7.2.2 Lãi đầu tư, tiết kiệm, cổ tức, cho vay', q.muc7_2_2);
  addIncomeOnly('7.3 Thu khác', '7.3 Trúng số, vui chơi có thưởng, khác', q.muc7_3);

  return lines;
};

// ---------- Dựng 3 bảng dữ liệu ----------
export interface QuestionnaireExportTables {
  tongHop: (string | number | { t: string; f: string; v: number })[][];
  thanhVien: (string | number)[][];
  chiTiet: (string | number)[][];
  householdCount: number;
  memberRowCount: number;
  detailRowCount: number;
  /** Tổng thu nhập các mục (để đối chiếu với trang Tổng hợp) */
  grandTotal: number;
}

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

export const buildQuestionnaireExportTables = (
  households: any[],
  ctx: QuestionnaireExportContext
): QuestionnaireExportTables => {
  const tongHopHeader = [
    'STT', 'Mã TKCS', 'Tên TKCS', 'Mã xã', 'Tên xã/phường', 'Mã địa bàn', 'Tên địa bàn',
    'STT mẫu', 'STT gốc', 'Loại mẫu', 'Họ tên chủ hộ', 'Địa chỉ', 'Điện thoại', 'Nhóm ngành',
    'Số nhân khẩu', 'Số người làm việc', 'Điều tra viên', 'Trạng thái', 'Cập nhật lần cuối',
    'Mục 1: Lương, công (1.000đ)', 'Mục 2: Trồng trọt (1.000đ)', 'Mục 3: Chăn nuôi (1.000đ)',
    'Mục 4: Lâm nghiệp (1.000đ)', 'Mục 5: Thủy sản (1.000đ)', 'Mục 6: Phi nông nghiệp (1.000đ)',
    'Mục 7: Thu khác (1.000đ)', 'TỔNG THU NHẬP HỘ (1.000đ)',
    'TNBQ/người/năm (1.000đ)', 'TNBQ/người/tháng (1.000đ)', 'Kiểm tra số liệu'
  ];
  const incomeColStart = 19; // cột "Mục 1" (0-based)
  const incomeColEnd = 26;   // cột "Tổng thu nhập"

  const tongHop: QuestionnaireExportTables['tongHop'] = [tongHopHeader];
  const thanhVien: (string | number)[][] = [[
    'Mã xã', 'Tên xã/phường', 'Mã địa bàn', 'STT mẫu', 'Họ tên chủ hộ', 'STT thành viên',
    'Họ tên thành viên', 'Công việc chính', 'Tiền lương, tiền công (1.000đ)', 'Lương hưu, trợ cấp (1.000đ)', 'Cộng thu nhập (1.000đ)'
  ]];
  const chiTiet: (string | number)[][] = [[
    'Mã xã', 'Tên xã/phường', 'Mã địa bàn', 'STT mẫu', 'Họ tên chủ hộ',
    'Mục', 'Nhóm', 'Sản phẩm / dịch vụ / khoản thu',
    '1. Giá trị bán ra, đổi, cho, biếu, tặng', '2. Giá trị để lại sử dụng', '3 = 1+2. TỔNG THU',
    '4. Giống / Nguyên vật liệu', '5. Vật tư, thức ăn / Năng lượng', '6. Chi khác', '7 = 4+5+6. TỔNG CHI',
    '8 = 3-7. THU NHẬP', 'Ghi chú'
  ]];

  let grandTotal = 0;
  const sums = new Array(incomeColEnd - incomeColStart + 1).fill(0);

  households.forEach((h, idx) => {
    const q = h.questionnaire;
    const loc = ctx.resolveLocation(h);
    const inc = calculateFullIncome(q);
    const members = n(h.membersCount);
    const perYear = members > 0 ? inc.total / members : 0;
    const check = validateHouseholdIncome(q);
    let kiemTra = 'Hợp lệ';
    if (!(members > 0)) kiemTra = 'Thiếu số nhân khẩu';
    else if (!check.ok) kiemTra = check.issues.length > 0 ? `Có ${check.issues.length} dòng chi lớn hơn thu` : 'Tổng thu nhập bằng 0';

    const vals = [inc.muc1, inc.muc2, inc.muc3, inc.muc4, inc.muc5, inc.muc6, inc.muc7, inc.total];
    vals.forEach((v, i) => { sums[i] += v; });
    grandTotal += inc.total;

    tongHop.push([
      idx + 1, loc.tkcsCode, loc.tkcsName, loc.communeCode, loc.communeName, loc.areaCode, loc.areaName,
      h.sttMau ?? '', h.sttGoc ?? '', h.sampleStatus || 'CHÍNH THỨC', h.householdHead || '', h.address || '', h.phone || '',
      h.sectorName || '', members, n(h.workingMembersCount), h.assignedSurveyorName || '',
      ctx.statusLabel(h.surveyStatus), fmtDate(h.updatedAt),
      ...vals,
      Math.round(perYear * 100) / 100, Math.round((perYear / 12) * 100) / 100, kiemTra
    ]);

    // Thành viên (Mục 1)
    if (Array.isArray(q?.muc1_rows)) {
      q.muc1_rows.forEach((r: any, i: number) => {
        if (!r) return;
        const luong = n(r.col1_luong ?? r.income);
        const troCap = n(r.col2_troCap ?? r.pension);
        thanhVien.push([
          loc.communeCode, loc.communeName, loc.areaCode, h.sttMau ?? '', h.householdHead || '',
          i + 1, r.name || '', r.job || '', luong, troCap, luong + troCap
        ]);
      });
    }

    // Chi tiết thu - chi
    buildDetailLines(q).forEach(line => {
      chiTiet.push([
        loc.communeCode, loc.communeName, loc.areaCode, h.sttMau ?? '', h.householdHead || '',
        line.muc, line.nhom, line.ten, line.c1, line.c2, line.c3, line.c4, line.c5, line.c6, line.c7, line.c8, line.ghiChu
      ]);
    });
  });

  // Dòng tổng cộng (dùng công thức SUM để Excel tự tính lại khi lọc/sửa)
  if (households.length > 0) {
    const last = households.length + 1; // dòng cuối của dữ liệu (1-based, tính cả dòng tiêu đề)
    const totalRow: any[] = new Array(tongHopHeader.length).fill('');
    totalRow[10] = 'TỔNG CỘNG';
    totalRow[14] = { t: 'n', f: `SUM(${colLetter(14)}2:${colLetter(14)}${last})`, v: households.reduce((a, h) => a + n(h.membersCount), 0) };
    for (let c = incomeColStart; c <= incomeColEnd; c++) {
      totalRow[c] = { t: 'n', f: `SUM(${colLetter(c)}2:${colLetter(c)}${last})`, v: sums[c - incomeColStart] };
    }
    tongHop.push(totalRow);
  }

  return {
    tongHop,
    thanhVien,
    chiTiet,
    householdCount: households.length,
    memberRowCount: thanhVien.length - 1,
    detailRowCount: chiTiet.length - 1,
    grandTotal
  };
};

// ---------- Xuất file ----------
const setColumnWidths = (ws: XLSX.WorkSheet, widths: number[]) => {
  ws['!cols'] = widths.map(wch => ({ wch }));
};

export const exportCompletedQuestionnairesToExcel = (
  households: any[],
  ctx: QuestionnaireExportContext,
  fileLabel: string
): QuestionnaireExportTables => {
  const tables = buildQuestionnaireExportTables(households, ctx);
  const wb = XLSX.utils.book_new();

  const wsTongHop = XLSX.utils.aoa_to_sheet(tables.tongHop as any[][]);
  setColumnWidths(wsTongHop, [6, 10, 22, 9, 22, 9, 20, 8, 8, 12, 24, 30, 14, 20, 10, 10, 22, 16, 18, 16, 16, 16, 16, 16, 16, 16, 18, 16, 16, 28]);
  wsTongHop['!autofilter'] = { ref: `A1:${colLetter(29)}${Math.max(2, tables.householdCount + 1)}` };
  XLSX.utils.book_append_sheet(wb, wsTongHop, 'Tong_hop_ho');

  const wsThanhVien = XLSX.utils.aoa_to_sheet(tables.thanhVien);
  setColumnWidths(wsThanhVien, [9, 22, 10, 8, 24, 10, 26, 28, 18, 18, 18]);
  wsThanhVien['!autofilter'] = { ref: `A1:K${Math.max(2, tables.thanhVien.length)}` };
  XLSX.utils.book_append_sheet(wb, wsThanhVien, 'Thanh_vien');

  const wsChiTiet = XLSX.utils.aoa_to_sheet(tables.chiTiet);
  setColumnWidths(wsChiTiet, [9, 22, 10, 8, 24, 30, 34, 40, 16, 16, 16, 16, 16, 14, 16, 16, 34]);
  wsChiTiet['!autofilter'] = { ref: `A1:Q${Math.max(2, tables.chiTiet.length)}` };
  XLSX.utils.book_append_sheet(wb, wsChiTiet, 'Chi_tiet_thu_chi');

  const guide: string[][] = [
    ['HƯỚNG DẪN ĐỌC FILE'],
    [''],
    [`Xuất lúc: ${new Date().toLocaleString('vi-VN', { hour12: false })} | Số hộ: ${tables.householdCount} | Số thành viên: ${tables.memberRowCount} | Số dòng thu chi: ${tables.detailRowCount}`],
    ['Chỉ gồm các hộ đã hoàn thành hoặc đã duyệt phiếu. Hộ đã bị thay thế không được xuất.'],
    ['Đơn vị tiền: nghìn đồng (1.000đ). Thu nhập tính cho cả năm.'],
    [''],
    ['Trang Tong_hop_ho: mỗi hộ 1 dòng, thu nhập theo 7 mục, tổng thu nhập và thu nhập bình quân đầu người. Có dòng TỔNG CỘNG cuối bảng (cộng bằng công thức, dùng bộ lọc rồi chọn SUBTOTAL nếu cần cộng riêng phần đã lọc).'],
    ['Trang Thanh_vien: danh sách thành viên có kê khai ở Mục 1 (họ tên, công việc, tiền lương, lương hưu/trợ cấp). Phiếu không có danh sách nhân khẩu riêng; tổng số nhân khẩu và số người làm việc nằm ở trang Tong_hop_ho.'],
    ['Trang Chi_tiet_thu_chi: từng dòng sản phẩm/dịch vụ của các mục 1-7 với đủ các cột như phiếu giấy.'],
    ['   Cột 1: bán ra, đổi, cho, biếu, tặng | Cột 2: để lại sử dụng | Cột 3 = 1+2: TỔNG THU'],
    ['   Cột 4: giống hoặc nguyên vật liệu | Cột 5: vật tư, thức ăn hoặc năng lượng | Cột 6: chi khác | Cột 7 = 4+5+6: TỔNG CHI'],
    ['   Cột 8 = 3-7: THU NHẬP. Dòng nào chi lớn hơn thu thì thu nhập tính bằng 0 và có ghi chú.'],
    ['   Dịch vụ, săn bắt, đánh bẫy chỉ có Tổng thu (cột 3) và Chi khác (cột 6). Tiền đền bù/hỗ trợ cộng thẳng vào thu nhập.'],
    ['Cột "Kiểm tra số liệu": Hợp lệ / Thiếu số nhân khẩu / Tổng thu nhập bằng 0 / Có dòng chi lớn hơn thu. Các hộ không hợp lệ không được tính vào thu nhập bình quân.']
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guide);
  setColumnWidths(wsGuide, [140]);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Huong_dan');

  const safe = fileLabel.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_') || 'ToanBo';
  XLSX.writeFile(wb, `Phieu_Chi_Tiet_Da_Hoan_Thanh_${safe}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return tables;
};
