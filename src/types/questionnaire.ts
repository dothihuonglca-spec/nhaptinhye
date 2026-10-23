/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Bảng dòng chi tiết cho Trồng trọt, Chăn nuôi, Lâm nghiệp, Thủy sản
export interface ProductionRow {
  id: string;
  name: string; // Tên sản phẩm / cây trồng / vật nuôi từ danh mục hoặc tự nhập
  catalogId?: number;
  col1_ban: number; // Giá trị đã bán/đổi/cho/biếu/tặng
  col2_tuDung: number; // Giá trị đã thu hoạch để lại sử dụng & tồn kho
  col4_giong: number; // Giống (bao gồm tự sản xuất)
  col5_vatTu: number; // Phân bón, BVTV / Thức ăn, thuốc phòng bệnh
  col6_chiKhac: number; // Chi khác
}

// Bảng dòng chi tiết Mục 6: SXKD phi nông nghiệp hoặc chế biến
export interface NonAgriRow {
  id: string;
  name: string; // Mô tả hoạt động
  col1_ban: number; // Giá trị bán
  col2_tuDung: number; // Giá trị để lại sử dụng
  col4_nguyenLieu: number; // Nguyên vật liệu chính, phụ
  col5_nangLuong: number; // Năng lượng, nhiên liệu
  col6_chiKhac: number; // Chi khác
}

// Mục 1: Tiền lương, tiền công
export interface SalaryRow {
  id: string;
  name: string; // Họ tên thành viên
  job: string; // Mô tả công việc chính
  col1_luong: number; // Thu nhập từ tiền lương, tiền công (kể cả hiện vật)
  col2_troCap: number; // Lương hưu, trợ cấp thôi việc
}

export interface FullQuestionnaire {
  // Mục 1: Tiền lương tiền công (Trang 1)
  muc1_has: boolean;
  muc1_rows: SalaryRow[];

  // Mục 2: Trồng trọt (Trang 2)
  muc2_has: boolean;
  muc2_cayTrongRows: ProductionRow[]; // 1. Cây trồng các loại (tra cứu 63 loại)
  muc2_giong: { col1: number; col2: number; col4: number; col5: number; col6: number }; // 2. Nhân giống
  muc2_sanPhamPhu: { col1: number; col2: number; col6: number }; // 3. Sản phẩm phụ
  muc2_dichVu: { col3: number; col6: number }; // 4. Dịch vụ trồng trọt
  muc2_denBu: number; // 5. Tiền đền bù/hỗ trợ

  // Mục 3: Chăn nuôi (Trang 4, 5)
  muc3_has: boolean;
  muc3_giaSucRows: ProductionRow[]; // 1. Gia súc
  muc3_giaCamRows: ProductionRow[]; // 2. Gia cầm
  muc3_khacRows: ProductionRow[]; // 3. Chăn nuôi khác
  muc3_khongGietMoRows: ProductionRow[]; // 4. Sản phẩm không qua giết mổ
  muc3_giongRows: ProductionRow[]; // 5. Giống vật nuôi
  muc3_sanPhamPhu: { col1: number; col2: number; col6: number }; // 6. Sản phẩm phụ
  muc3_dichVu: { col3: number; col6: number }; // 7. Dịch vụ chăn nuôi
  muc3_sanBat: { col3: number; col6: number }; // 8. Săn bắt, đánh bẫy
  muc3_denBu: number; // 9. Tiền đền bù/hỗ trợ

  // Mục 4: Lâm nghiệp (Trang 7)
  muc4_has: boolean;
  muc4_khaiThacRows: ProductionRow[]; // 1. Khai thác thu nhặt lâm sản
  muc4_uomGiong: { col1: number; col2: number; col4: number; col5: number; col6: number }; // 2. Ươm giống
  muc4_trongRung: { col1: number; col2: number; col4: number; col5: number; col6: number }; // 3. Trồng rừng, chăm sóc
  muc4_dichVu: { col3: number; col6: number }; // 4. Dịch vụ lâm nghiệp
  muc4_denBu: number; // 5. Tiền đền bù/hỗ trợ

  // Mục 5: Thủy sản (Trang 9, 10)
  muc5_has: boolean;
  muc5_nuoiTrongRows: ProductionRow[]; // 1. Nuôi trồng thủy sản
  muc5_danhBatRows: ProductionRow[]; // 2. Đánh bắt thủy sản
  muc5_sanXuatGiongRows: ProductionRow[]; // 3. Sản xuất giống thủy sản
  muc5_denBu: number; // 4. Tiền đền bù/hỗ trợ

  // Mục 6: SXKD phi nông nghiệp, dịch vụ hoặc chế biến (Trang 11)
  muc6_has: boolean;
  muc6_rows: NonAgriRow[];

  // Mục 7: Thu nhập khác (Trang 12)
  muc7_has: boolean;
  muc7_1_1: number; // Biếu, tặng, mừng, giúp
  muc7_1_2: number; // Trợ cấp xã hội, chính sách, thiên tai
  muc7_1_3: number; // Học bổng, giáo dục, y tế
  muc7_2_1: number; // Cho thuê tài sản, đất đai, nhà ở
  muc7_2_2: number; // Lãi đầu tư, tiết kiệm, cổ tức, cho vay
  muc7_3: number; // Trúng số, vui chơi có thưởng, khác

  // Điều tra viên (Trang 13)
  surveyorDate?: string;
  surveyorName?: string;
}

export const createDefaultQuestionnaire = (): FullQuestionnaire => ({
  muc1_has: false,
  muc1_rows: [],

  muc2_has: false,
  muc2_cayTrongRows: [],
  muc2_giong: { col1: 0, col2: 0, col4: 0, col5: 0, col6: 0 },
  muc2_sanPhamPhu: { col1: 0, col2: 0, col6: 0 },
  muc2_dichVu: { col3: 0, col6: 0 },
  muc2_denBu: 0,

  muc3_has: false,
  muc3_giaSucRows: [],
  muc3_giaCamRows: [],
  muc3_khacRows: [],
  muc3_khongGietMoRows: [],
  muc3_giongRows: [],
  muc3_sanPhamPhu: { col1: 0, col2: 0, col6: 0 },
  muc3_dichVu: { col3: 0, col6: 0 },
  muc3_sanBat: { col3: 0, col6: 0 },
  muc3_denBu: 0,

  muc4_has: false,
  muc4_khaiThacRows: [],
  muc4_uomGiong: { col1: 0, col2: 0, col4: 0, col5: 0, col6: 0 },
  muc4_trongRung: { col1: 0, col2: 0, col4: 0, col5: 0, col6: 0 },
  muc4_dichVu: { col3: 0, col6: 0 },
  muc4_denBu: 0,

  muc5_has: false,
  muc5_nuoiTrongRows: [],
  muc5_danhBatRows: [],
  muc5_sanXuatGiongRows: [],
  muc5_denBu: 0,

  muc6_has: false,
  muc6_rows: [],

  muc7_has: false,
  muc7_1_1: 0,
  muc7_1_2: 0,
  muc7_1_3: 0,
  muc7_2_1: 0,
  muc7_2_2: 0,
  muc7_3: 0,

  surveyorDate: new Date().toLocaleDateString('vi-VN'),
  surveyorName: ''
});
