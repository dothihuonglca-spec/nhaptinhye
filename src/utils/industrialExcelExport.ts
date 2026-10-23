/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as XLSX from 'xlsx';
import { 
  EnterpriseSurvey01, 
  IndividualEstablishment02, 
  IndustrialSummaryReport 
} from '../types/industrialSurvey';

/**
 * Xuất Phiếu 01/TGTSP-DNCN ra định dạng Excel chuẩn
 */
export function exportEnterprise01ToExcel(enterprise: EnterpriseSurvey01) {
  const wb = XLSX.utils.book_new();

  // Tạo sheet cho Phiếu 01
  const rows: (string | number)[][] = [
    ['UBND TỈNH HƯNG YÊN', '', '', '', '', '', 'Phiếu số 01/TGTSP-DNCN'],
    ['', '', '', '', '', '', `Mã số thuế: ${enterprise.taxCode || '...'}`],
    ['PHIẾU THU THẬP THÔNG TIN VỀ HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP CỦA DOANH NGHIỆP/HTX'],
    [`NĂM ${enterprise.surveyYear || '2026'}`],
    ['(Áp dụng cho các doanh nghiệp/HTX hoạt động trong ngành công nghiệp chế biến, chế tạo)'],
    [''],
    ['I. THÔNG TIN CHUNG'],
    ['1. Tên doanh nghiệp:', enterprise.enterpriseName || ''],
    ['2. Địa chỉ doanh nghiệp:'],
    ['- Xã, phường:', enterprise.communeName || '', 'Mã xã, phường:', enterprise.communeCode || ''],
    ['- Địa chỉ (số nhà, đường phố/thôn):', enterprise.address || ''],
    ['- Số điện thoại:', enterprise.phone || '', 'Email:', enterprise.email || ''],
    [''],
    ['II. NGÀNH HOẠT ĐỘNG CỦA DOANH NGHIỆP'],
    ['1. Ngành SXKD chính:', enterprise.mainIndustryName || '', 'Mã ngành:', enterprise.mainIndustryCode || ''],
    ['2. Ngành SXKD khác:'],
    ['- Ngành 1:', enterprise.otherIndustries?.[0]?.name || '', 'Mã ngành:', enterprise.otherIndustries?.[0]?.code || ''],
    ['- Ngành 2:', enterprise.otherIndustries?.[1]?.name || '', 'Mã ngành:', enterprise.otherIndustries?.[1]?.code || ''],
    [''],
    ['III. THÔNG TIN VỀ LAO ĐỘNG'],
    ['1. Thời điểm 01/01 năm báo cáo:', enterprise.laborJan01 || 0, 'người'],
    ['2. Dự kiến thời điểm 31/12 năm báo cáo:', enterprise.laborDec31Expected || 0, 'người'],
    [''],
    ['IV. THÔNG TIN VỀ KẾT QUẢ SẢN XUẤT KINH DOANH'],
    ['1. Doanh nghiệp có cơ sở SXKD ngoài xã/phường không?:', enterprise.hasExternalLocations ? 'CÓ (Xem câu 2)' : 'KHÔNG (Chuyển câu 3)'],
    [''],
    ['2. Thông tin về địa điểm SXKD:']
  ];

  // Bảng địa điểm SXKD (Câu 2)
  rows.push([
    'STT', 
    'Tên địa điểm SXKD', 
    'Địa chỉ địa điểm SXKD (Ghi xã/phường)', 
    'Ngành sản xuất kinh doanh chính', 
    'Mã ngành cấp 2', 
    'Số lao động thời điểm 01/01', 
    'Dự kiến số lao động 31/12'
  ]);

  if (enterprise.locations && enterprise.locations.length > 0) {
    enterprise.locations.forEach((loc, idx) => {
      rows.push([
        loc.stt || idx + 1,
        loc.name || '',
        loc.address || '',
        loc.mainIndustry || '',
        loc.industryCodeLevel2 || '',
        loc.laborJan01 || 0,
        loc.laborDec31Expected || 0
      ]);
    });
  } else {
    rows.push([1, 'Trụ sở chính công ty', enterprise.address || '', enterprise.mainIndustryName || '', '', enterprise.laborJan01 || 0, enterprise.laborDec31Expected || 0]);
  }

  rows.push(['']);
  rows.push(['3. Sản xuất, tiêu thụ của doanh nghiệp:']);
  rows.push([
    'Tên sản phẩm',
    'Mã sản phẩm',
    'Đơn vị tính sản phẩm',
    'Sản phẩm sản xuất trong 9 tháng đầu năm',
    'Tiêu thụ trong 9 tháng - Số lượng',
    'Tiêu thụ trong 9 tháng - Giá trị (Triệu đồng)',
    'Ước tính sản phẩm sản xuất cả năm',
    'Ước tính sản phẩm tiêu thụ cả năm',
    'Ước giá trị sản phẩm tiêu thụ cả năm (Triệu đồng)',
    'Sản phẩm sản xuất của năm trước'
  ]);
  rows.push(['A', 'B', 'C', '1', '2', '3', '4', '5', '6', '7']);

  if (enterprise.products && enterprise.products.length > 0) {
    enterprise.products.forEach(p => {
      rows.push([
        p.productName || '',
        p.productCode || '',
        p.unit || '',
        p.prod9Months || 0,
        p.sales9MonthsQty || 0,
        p.sales9MonthsValue || 0,
        p.prodYearEst || 0,
        p.salesYearQtyEst || 0,
        p.salesYearValueEst || 0,
        p.prodPrevYear || 0
      ]);
    });
  }

  rows.push(['']);
  rows.push(['4. Kết quả sản xuất kinh doanh (Đơn vị tính: Triệu đồng):']);
  rows.push([
    'Tên chỉ tiêu',
    'Mã số',
    'Thực hiện 9 tháng đầu năm',
    'Ước cả năm',
    'Năm trước năm báo cáo',
    '% so sánh'
  ]);
  rows.push(['A', 'B', '1', '2', '3', '4']);

  const ft = enterprise.financialTotal || { exec9Months: 0, estYear: 0, prevYear: 0 };
  const ratioTotal = ft.prevYear > 0 ? ((ft.estYear / ft.prevYear) * 100).toFixed(2) : '-';
  rows.push(['Tổng doanh thu bán hàng và cung cấp dịch vụ', '01', ft.exec9Months || 0, ft.estYear || 0, ft.prevYear || 0, ratioTotal]);

  const fm = enterprise.financialMainIndustry || { exec9Months: 0, estYear: 0, prevYear: 0 };
  const ratioMain = fm.prevYear > 0 ? ((fm.estYear / fm.prevYear) * 100).toFixed(2) : '-';
  rows.push(['- Ngành SXKD chính', '02', fm.exec9Months || 0, fm.estYear || 0, fm.prevYear || 0, ratioMain]);

  const fo1 = enterprise.financialOther1 || { exec9Months: 0, estYear: 0, prevYear: 0 };
  const ratioO1 = fo1.prevYear > 0 ? ((fo1.estYear / fo1.prevYear) * 100).toFixed(2) : '-';
  rows.push([`- Ngành khác 1: ${enterprise.otherIndustries?.[0]?.name || ''}`, '03', fo1.exec9Months || 0, fo1.estYear || 0, fo1.prevYear || 0, ratioO1]);

  const fo2 = enterprise.financialOther2 || { exec9Months: 0, estYear: 0, prevYear: 0 };
  const ratioO2 = fo2.prevYear > 0 ? ((fo2.estYear / fo2.prevYear) * 100).toFixed(2) : '-';
  rows.push([`- Ngành khác 2: ${enterprise.otherIndustries?.[1]?.name || ''}`, '04', fo2.exec9Months || 0, fo2.estYear || 0, fo2.prevYear || 0, ratioO2]);

  rows.push(['']);
  rows.push(['Người trả lời phiếu', '', 'Điều tra viên', '', '', `Ngày lập: ${enterprise.surveyDate || ''}`]);
  rows.push([`Họ và tên: ${enterprise.respondentName || '...'}`, '', `Họ và tên: ${enterprise.surveyorName || '...'}`, '', '', 'Giám đốc (Ký, đóng dấu)']);
  rows.push([`Điện thoại: ${enterprise.respondentPhone || '...'}`, '', `Điện thoại: ${enterprise.surveyorPhone || '...'}`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Phieu_01_DNCN');
  
  const cleanName = (enterprise.enterpriseName || 'Doanh_nghiep').replace(/[/\\?%*:|"<>]/g, '_');
  XLSX.writeFile(wb, `Phieu_01_${cleanName}_${enterprise.taxCode || 'MST'}.xlsx`);
}

/**
 * Xuất Phiếu 02/TGTSP-CTCN ra định dạng Excel chuẩn
 */
export function exportEstablishment02ToExcel(establishment: IndividualEstablishment02) {
  const wb = XLSX.utils.book_new();

  const nr = establishment.netRevenue || { prevYear: 0, exec9Months: 0, estYear: 0 };
  const ratio = nr.prevYear > 0 ? ((nr.estYear / nr.prevYear) * 100).toFixed(2) : '-';

  const rows: (string | number)[][] = [
    ['UBND TỈNH HƯNG YÊN', '', '', 'Phiếu số 02/TGTSP-CTCN'],
    ['', '', '', `STT cơ sở: ${establishment.establishmentOrder || '...'}`],
    ['PHIẾU THU THẬP THÔNG TIN VỀ HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP CỦA CƠ SỞ CÁ THỂ'],
    [`NĂM ${establishment.surveyYear || '2026'}`],
    ['(Áp dụng cho các cơ sở SXKD cá thể hoạt động trong ngành công nghiệp chế biến, chế tạo)'],
    [''],
    ['1. Tên cơ sở:', establishment.establishmentName || ''],
    ['2. Địa chỉ cơ sở:'],
    ['- Xã, phường:', establishment.communeName || '', 'Mã xã, phường:', establishment.communeCode || ''],
    ['- Địa chỉ (số nhà, đường phố, thôn):', establishment.address || ''],
    ['- Số điện thoại:', establishment.phone || '', 'Email:', establishment.email || ''],
    [''],
    ['3. Ngành SXKD chính:', establishment.mainIndustryName || '', 'Mã ngành:', establishment.mainIndustryCode || ''],
    [''],
    ['4. Số lao động:'],
    ['- Thời điểm 01/01 năm báo cáo:', establishment.laborJan01 || 0, 'người'],
    ['- Dự kiến thời điểm 31/12 năm báo cáo:', establishment.laborDec31Expected || 0, 'người'],
    [''],
    ['5. Doanh thu thuần của hoạt động sản xuất công nghiệp (Đơn vị tính: Triệu đồng):'],
    ['Tên chỉ tiêu', 'Mã số', 'Thực hiện năm trước', 'Thực hiện 9 tháng đầu năm', 'Ước cả năm', '% so sánh'],
    ['A', 'B', '1', '2', '3', '4'],
    ['Doanh thu thuần của hoạt động sản xuất công nghiệp (*)', '01', nr.prevYear || 0, nr.exec9Months || 0, nr.estYear || 0, ratio],
    ['(*) Doanh thu tính trên địa bàn xã/phường được chọn mẫu điều tra.'],
    [''],
    ['Người trả lời phiếu', '', 'Điều tra viên', `Ngày lập: ${establishment.surveyDate || ''}`],
    [`Họ và tên: ${establishment.respondentName || '...'}`, '', `Họ và tên: ${establishment.surveyorName || '...'}`],
    [`Điện thoại: ${establishment.respondentPhone || '...'}`, '', `Điện thoại: ${establishment.surveyorPhone || '...'}`]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Phieu_02_CTCN');

  const cleanName = (establishment.establishmentName || 'Co_so_ca_the').replace(/[/\\?%*:|"<>]/g, '_');
  XLSX.writeFile(wb, `Phieu_02_${cleanName}_STT${establishment.establishmentOrder || 'CS'}.xlsx`);
}

/**
 * Xuất Biểu 03/TH-CN hoặc 04/TH-CN Tổng hợp đầu ra
 */
export function exportIndustrialSummaryToExcel(report: IndustrialSummaryReport) {
  const wb = XLSX.utils.book_new();

  const isHienHanh = report.reportType === '03_HIEN_HANH';
  const bieuso = isHienHanh ? 'Biểu số 03/TH-CN' : 'Biểu số 04/TH-CN';
  const giaLoai = isHienHanh ? '(THEO GIÁ HIỆN HÀNH)' : '(THEO GIÁ SO SÁNH)';

  const rows: (string | number)[][] = [
    ['II. BIỂU TỔNG HỢP ĐẦU RA'],
    [bieuso],
    ['GIÁ TRỊ SẢN PHẨM NGÀNH CÔNG NGHIỆP'],
    [giaLoai],
    [`NĂM ${report.surveyYear || '2026'}`],
    [''],
    ['Tên xã, phường:', report.communeName || '', 'Mã xã, phường:', report.communeCode || ''],
    [''],
    ['Tên chỉ tiêu', 'Mã số', 'Năm báo cáo (triệu đồng)', 'Năm trước năm báo cáo (triệu đồng)', 'Năm báo cáo so với năm trước (%)'],
    ['A', 'B', '1', '2', '3']
  ];

  report.indicators.forEach(ind => {
    const rate = ind.prevYearValue > 0 ? ((ind.currentYearValue / ind.prevYearValue) * 100).toFixed(2) : '-';
    rows.push([ind.name, ind.code, ind.currentYearValue || 0, ind.prevYearValue || 0, rate]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, isHienHanh ? 'Bieu_03_GiaHienHanh' : 'Bieu_04_GiaSoSanh');

  XLSX.writeFile(wb, `${bieuso}_${report.communeName || 'Xa'}_${report.surveyYear || '2026'}.xlsx`);
}

/**
 * Xuất toàn bộ danh sách Doanh nghiệp (Phiếu 01)
 */
export function exportAllEnterprisesListToExcel(list: EnterpriseSurvey01[], title = 'Danh_sach_Doanh_nghiep_Phieu_01') {
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    ['UBND TỈNH HƯNG YÊN - DANH SÁCH DOANH NGHIỆP/HTX SẢN XUẤT CÔNG NGHIỆP (PHIẾU 01/TGTSP-DNCN)'],
    [''],
    [
      'STT', 
      'Mã số thuế', 
      'Tên doanh nghiệp', 
      'Xã/phường', 
      'Mã xã', 
      'Địa chỉ', 
      'Số điện thoại', 
      'Ngành SXKD chính', 
      'Mã ngành', 
      'Lao động 01/01', 
      'Lao động 31/12', 
      'Doanh thu 9 tháng (Tr.đ)', 
      'Ước doanh thu cả năm (Tr.đ)', 
      'Doanh thu năm trước (Tr.đ)',
      'Trạng thái'
    ]
  ];

  list.forEach((item, index) => {
    const rev = item.financialTotal || { exec9Months: 0, estYear: 0, prevYear: 0 };
    rows.push([
      index + 1,
      item.taxCode || '',
      item.enterpriseName || '',
      item.communeName || '',
      item.communeCode || '',
      item.address || '',
      item.phone || '',
      item.mainIndustryName || '',
      item.mainIndustryCode || '',
      item.laborJan01 || 0,
      item.laborDec31Expected || 0,
      rev.exec9Months || 0,
      rev.estYear || 0,
      rev.prevYear || 0,
      item.surveyStatus === 'DA_DUYET' ? 'Đã duyệt' : item.surveyStatus === 'DA_HOAN_THANH' ? 'Đã hoàn thành' : 'Đang nhập'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSach_DN_01');
  XLSX.writeFile(wb, `${title}.xlsx`);
}

/**
 * Xuất toàn bộ danh sách Cơ sở cá thể (Phiếu 02)
 */
export function exportAllEstablishmentsListToExcel(list: IndividualEstablishment02[], title = 'Danh_sach_Co_so_ca_the_Phieu_02') {
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [
    ['UBND TỈNH HƯNG YÊN - DANH SÁCH CƠ SỞ CÁ THỂ SẢN XUẤT CÔNG NGHIỆP (PHIẾU 02/TGTSP-CTCN)'],
    [''],
    [
      'STT Cơ sở', 
      'Tên cơ sở', 
      'Xã/phường', 
      'Mã xã', 
      'Địa chỉ', 
      'Số điện thoại', 
      'Ngành SXKD chính', 
      'Mã ngành', 
      'Lao động 01/01', 
      'Lao động 31/12', 
      'Thực hiện năm trước (Tr.đ)', 
      'Thực hiện 9 tháng (Tr.đ)', 
      'Ước cả năm (Tr.đ)', 
      'Trạng thái'
    ]
  ];

  list.forEach((item, index) => {
    const nr = item.netRevenue || { prevYear: 0, exec9Months: 0, estYear: 0 };
    rows.push([
      item.establishmentOrder || index + 1,
      item.establishmentName || '',
      item.communeName || '',
      item.communeCode || '',
      item.address || '',
      item.phone || '',
      item.mainIndustryName || '',
      item.mainIndustryCode || '',
      item.laborJan01 || 0,
      item.laborDec31Expected || 0,
      nr.prevYear || 0,
      nr.exec9Months || 0,
      nr.estYear || 0,
      item.surveyStatus === 'DA_DUYET' ? 'Đã duyệt' : item.surveyStatus === 'DA_HOAN_THANH' ? 'Đã hoàn thành' : 'Đang nhập'
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSach_CS_02');
  XLSX.writeFile(wb, `${title}.xlsx`);
}
