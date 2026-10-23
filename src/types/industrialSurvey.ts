/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SurveyStatus } from './user';

// ============================================================================
// PHIẾU SỐ 01/TGTSP-DNCN: DOANH NGHIỆP / HTX HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP
// ============================================================================

export interface LocationRow {
  id: string;
  stt: number | string;
  name: string; // Tên địa điểm SXKD (dòng 1: Trụ sở chính công ty)
  address: string; // Địa chỉ địa điểm SXKD (Ghi xã/phường)
  mainIndustry: string; // Ngành sản xuất kinh doanh chính
  industryCodeLevel2: string; // Mã ngành cấp 2 (2 chữ số)
  laborJan01: number; // Số lao động thời điểm 01/01/20...
  laborDec31Expected: number; // Dự kiến số lao động thời điểm 31/12/20...
}

export interface EnterpriseProductRow {
  id: string;
  productName: string; // Cột A: Tên sản phẩm
  productCode: string; // Cột B: Mã sản phẩm (theo DM sản phẩm công nghiệp VN)
  unit: string; // Cột C: Đơn vị tính sản phẩm
  prod9Months: number; // Cột 1: Sản phẩm sản xuất trong 9 tháng đầu năm báo cáo
  sales9MonthsQty: number; // Cột 2: Tiêu thụ trong 9 tháng đầu năm - Số lượng
  sales9MonthsValue: number; // Cột 3: Tiêu thụ trong 9 tháng đầu năm - Giá trị (Triệu đồng)
  prodYearEst: number; // Cột 4: Ước tính sản phẩm sản xuất cả năm báo cáo
  salesYearQtyEst: number; // Cột 5: Ước tính sản phẩm tiêu thụ cả năm báo cáo
  salesYearValueEst: number; // Cột 6: Ước giá trị sản phẩm tiêu thụ cả năm (Triệu đồng)
  prodPrevYear: number; // Cột 7: Sản phẩm sản xuất của năm trước năm báo cáo
}

export interface FinancialResultRow {
  code: string; // 01, 02, 03, 04...
  title: string;
  exec9Months: number; // Cột 1: Thực hiện 9 tháng đầu năm
  estYear: number; // Cột 2: Ước cả năm
  prevYear: number; // Cột 3: Năm trước năm báo cáo
  comparePercent?: number; // Cột 4: % so sánh = (estYear / prevYear) * 100
}

export interface OtherIndustryItem {
  id: string;
  name: string;
  code: string; // 5 chữ số
}

export interface EnterpriseSurvey01 {
  id: string;
  taxCode: string; // Mã số thuế (10 - 13 ký tự)
  enterpriseCode?: string; // STT / Mã doanh nghiệp
  surveyYear: string; // Năm báo cáo (VD: 2026)
  decisionNumber?: string; // Số QĐ ban hành
  
  // I. THÔNG TIN CHUNG
  enterpriseName: string; // 1. Tên doanh nghiệp (theo ĐKKD)
  communeCode: string; // Mã xã, phường (5 ô)
  communeName: string; // Tên Xã, phường
  districtName?: string; // Huyện/thị xã/thành phố (Hưng Yên)
  address: string; // Địa chỉ (số nhà, đường phố/thôn)
  phone: string; // Số điện thoại
  email: string; // Email

  // II. NGÀNH HOẠT ĐỘNG CỦA DOANH NGHIỆP
  mainIndustryName: string; // 1. Ngành SXKD chính
  mainIndustryCode: string; // Mã ngành (5 ô mã)
  otherIndustries: OtherIndustryItem[]; // 2. Ngành SXKD khác

  // III. THÔNG TIN VỀ LAO ĐỘNG
  laborJan01: number; // 1. Thời điểm 01/01 năm báo cáo (người)
  laborDec31Expected: number; // 2. Dự kiến thời điểm 31/12 năm báo cáo (người)

  // IV. THÔNG TIN VỀ KẾT QUẢ SẢN XUẤT KINH DOANH
  // Câu 1: Doanh nghiệp có cơ sở SXKD ngoài xã/phường không?
  hasExternalLocations: boolean; // true: Có (chuyển câu 2), false: Không (chuyển câu 3)

  // Câu 2: Thông tin về địa điểm SXKD (nếu hasExternalLocations === true)
  locations: LocationRow[];

  // Câu 3: Sản xuất, tiêu thụ của doanh nghiệp
  products: EnterpriseProductRow[];

  // Câu 4: Kết quả sản xuất kinh doanh (Đơn vị tính: Triệu đồng)
  financialTotal: FinancialResultRow; // Mã 01: Tổng doanh thu
  financialMainIndustry: FinancialResultRow; // Mã 02: Ngành SXKD chính
  financialOther1: FinancialResultRow; // Mã 03: Ngành khác 1
  financialOther2: FinancialResultRow; // Mã 04: Ngành khác 2

  // Người trả lời phiếu & Điều tra viên
  respondentName: string;
  respondentPhone: string;
  surveyorName: string;
  surveyorPhone: string;
  surveyDate: string; // Ngày... tháng... năm...
  directorSigned?: boolean;

  // Metadata quản lý
  surveyStatus: SurveyStatus;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ============================================================================
// PHIẾU SỐ 02/TGTSP-CTCN: CƠ SỞ CÁ THỂ SẢN XUẤT CÔNG NGHIỆP
// ============================================================================

export interface IndividualEstablishment02 {
  id: string;
  establishmentOrder: string; // STT cơ sở: 4 ô chữ số
  surveyYear: string; // Năm báo cáo
  
  // 1. Tên cơ sở
  establishmentName: string;

  // 2. Địa chỉ cơ sở
  communeCode: string; // Mã xã, phường (5 ô)
  communeName: string;
  districtName?: string;
  address: string; // Địa chỉ (số nhà, đường phố, thôn)
  phone: string;
  email: string;

  // 3. Ngành SXKD chính
  mainIndustryName: string;
  mainIndustryCode: string; // Mã ngành (5 ô mã)

  // 4. Số lao động
  laborJan01: number; // Thời điểm 01/01 năm báo cáo (người)
  laborDec31Expected: number; // Dự kiến thời điểm 31/12 năm báo cáo (người)

  // 5. Doanh thu thuần của hoạt động sản xuất công nghiệp (Đơn vị tính: Triệu đồng)
  netRevenue: {
    code: '01';
    title: string;
    prevYear: number; // Cột 1: Thực hiện năm trước năm báo cáo
    exec9Months: number; // Cột 2: Thực hiện 9 tháng đầu năm
    estYear: number; // Cột 3: Ước cả năm
    comparePercent?: number; // % so sánh ước cả năm / năm trước
  };

  // Người trả lời phiếu & Điều tra viên
  respondentName: string;
  respondentPhone: string;
  surveyorName: string;
  surveyorPhone: string;
  surveyDate: string;

  // Metadata quản lý
  surveyStatus: SurveyStatus;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// ============================================================================
// BIỂU SỐ 03/TH-CN & 04/TH-CN: BIỂU TỔNG HỢP ĐẦU RA GTSP NGÀNH CÔNG NGHIỆP
// ============================================================================

export interface IndustrialSummaryIndicator {
  code: string; // 01, 02, 03, 04, 05
  name: string;
  currentYearValue: number; // Cột 1: Năm báo cáo (triệu đồng)
  prevYearValue: number; // Cột 2: Năm trước năm báo cáo (triệu đồng)
  growthRatePercent?: number; // Cột 3: Năm báo cáo so với năm trước (%)
}

export interface IndustrialSummaryReport {
  id: string;
  communeCode: string;
  communeName: string;
  surveyYear: string;
  reportType: '03_HIEN_HANH' | '04_SO_SANH';
  reportTitle: string; // Giá hiện hành / Giá so sánh
  
  indicators: IndustrialSummaryIndicator[];
  // Mã 01: Tổng GTSP ngành Công nghiệp
  // Mã 02: B. Khai khoáng
  // Mã 03: C. Công nghiệp chế biến, chế tạo
  // Mã 04: D. Sản xuất và phân phối điện, khí đốt, nước nóng, hơi nước và điều hòa không khí
  // Mã 05: E. Cung cấp nước; Hoạt động quản lý và xử lý rác thải, nước thải

  updatedAt?: string;
  updatedBy?: string;
}

// Khởi tạo phiếu 01 mặc định
export const createDefaultEnterprise01 = (communeCode = '11200', communeName = 'Ân Thi'): EnterpriseSurvey01 => ({
  id: 'dn_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
  taxCode: '',
  enterpriseCode: '',
  surveyYear: '2026',
  decisionNumber: '.../QĐ-UBND',
  
  enterpriseName: '',
  communeCode,
  communeName,
  districtName: 'Hưng Yên',
  address: '',
  phone: '',
  email: '',

  mainIndustryName: '',
  mainIndustryCode: '',
  otherIndustries: [
    { id: '1', name: '', code: '' },
    { id: '2', name: '', code: '' }
  ],

  laborJan01: 0,
  laborDec31Expected: 0,

  hasExternalLocations: false,
  locations: [
    {
      id: 'loc_1',
      stt: 1,
      name: 'Trụ sở chính công ty',
      address: '',
      mainIndustry: '',
      industryCodeLevel2: '',
      laborJan01: 0,
      laborDec31Expected: 0
    }
  ],

  products: [
    {
      id: 'prod_1',
      productName: '',
      productCode: '',
      unit: '',
      prod9Months: 0,
      sales9MonthsQty: 0,
      sales9MonthsValue: 0,
      prodYearEst: 0,
      salesYearQtyEst: 0,
      salesYearValueEst: 0,
      prodPrevYear: 0
    }
  ],

  financialTotal: {
    code: '01',
    title: 'Tổng doanh thu bán hàng và cung cấp dịch vụ',
    exec9Months: 0,
    estYear: 0,
    prevYear: 0,
    comparePercent: 0
  },
  financialMainIndustry: {
    code: '02',
    title: 'Ngành SXKD chính',
    exec9Months: 0,
    estYear: 0,
    prevYear: 0,
    comparePercent: 0
  },
  financialOther1: {
    code: '03',
    title: 'Ngành SXKD khác 1',
    exec9Months: 0,
    estYear: 0,
    prevYear: 0,
    comparePercent: 0
  },
  financialOther2: {
    code: '04',
    title: 'Ngành SXKD khác 2',
    exec9Months: 0,
    estYear: 0,
    prevYear: 0,
    comparePercent: 0
  },

  respondentName: '',
  respondentPhone: '',
  surveyorName: '',
  surveyorPhone: '',
  surveyDate: new Date().toLocaleDateString('vi-VN'),
  directorSigned: false,

  surveyStatus: 'CHUA_NHAP'
});

// Khởi tạo phiếu 02 mặc định
export const createDefaultEstablishment02 = (communeCode = '11200', communeName = 'Ân Thi'): IndividualEstablishment02 => ({
  id: 'cs_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
  establishmentOrder: '',
  surveyYear: '2026',

  establishmentName: '',
  communeCode,
  communeName,
  districtName: 'Hưng Yên',
  address: '',
  phone: '',
  email: '',

  mainIndustryName: '',
  mainIndustryCode: '',

  laborJan01: 0,
  laborDec31Expected: 0,

  netRevenue: {
    code: '01',
    title: 'Doanh thu thuần của hoạt động sản xuất công nghiệp (*)',
    prevYear: 0,
    exec9Months: 0,
    estYear: 0,
    comparePercent: 0
  },

  respondentName: '',
  respondentPhone: '',
  surveyorName: '',
  surveyorPhone: '',
  surveyDate: new Date().toLocaleDateString('vi-VN'),

  surveyStatus: 'CHUA_NHAP'
});

// Khởi tạo Biểu 03 / 04 mặc định
export const createDefaultSummaryReport = (
  communeCode = '11200', 
  communeName = 'Ân Thi', 
  reportType: '03_HIEN_HANH' | '04_SO_SANH' = '03_HIEN_HANH'
): IndustrialSummaryReport => ({
  id: `sum_${reportType}_${communeCode}`,
  communeCode,
  communeName,
  surveyYear: '2026',
  reportType,
  reportTitle: reportType === '03_HIEN_HANH' ? 'THEO GIÁ HIỆN HÀNH' : 'THEO GIÁ SO SÁNH',
  indicators: [
    {
      code: '01',
      name: 'Tổng GTSP ngành Công nghiệp',
      currentYearValue: 0,
      prevYearValue: 0,
      growthRatePercent: 0
    },
    {
      code: '02',
      name: 'B. Khai khoáng',
      currentYearValue: 0,
      prevYearValue: 0,
      growthRatePercent: 0
    },
    {
      code: '03',
      name: 'C. Công nghiệp chế biến, chế tạo',
      currentYearValue: 0,
      prevYearValue: 0,
      growthRatePercent: 0
    },
    {
      code: '04',
      name: 'D. Sản xuất và phân phối điện, khí đốt, nước nóng, hơi nước và điều hòa không khí',
      currentYearValue: 0,
      prevYearValue: 0,
      growthRatePercent: 0
    },
    {
      code: '05',
      name: 'E. Cung cấp nước; Hoạt động quản lý và xử lý rác thải, nước thải',
      currentYearValue: 0,
      prevYearValue: 0,
      growthRatePercent: 0
    }
  ]
});
