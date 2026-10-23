/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, Save, Download, Printer, Plus, Trash2, HelpCircle, Building2, 
  CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, FileSpreadsheet, Lock
} from 'lucide-react';
import { 
  EnterpriseSurvey01, 
  createDefaultEnterprise01, 
  LocationRow, 
  EnterpriseProductRow 
} from '../types/industrialSurvey';
import { exportEnterprise01ToExcel } from '../utils/industrialExcelExport';
import { OFFICIAL_COMMUNES_CATALOG } from '../data/communesCatalog';
import CommuneFilterSelect from './CommuneFilterSelect';
import { Surveyor } from '../types/user';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  enterprise: EnterpriseSurvey01 | null;
  onSave: (data: EnterpriseSurvey01) => void;
  currentUser?: Surveyor | null;
  onOpenGuidelines?: () => void;
}

export default function Enterprise01Modal({
  isOpen,
  onClose,
  enterprise,
  onSave,
  currentUser,
  onOpenGuidelines
}: Props) {
  const [form, setForm] = useState<EnterpriseSurvey01>(() => {
    return enterprise ? JSON.parse(JSON.stringify(enterprise)) : createDefaultEnterprise01();
  });

  useEffect(() => {
    if (enterprise) {
      setForm(JSON.parse(JSON.stringify(enterprise)));
    } else {
      setForm(createDefaultEnterprise01());
    }
  }, [enterprise, isOpen]);

  if (!isOpen) return null;

  const isLocked = form.surveyStatus === 'DA_DUYET' && currentUser?.role !== 'ADMIN';

  // Cập nhật trường cơ bản
  const handleChange = (field: keyof EnterpriseSurvey01, value: any) => {
    if (isLocked) return;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // Cập nhật Xã/Phường -> tự động cập nhật mã xã
  const handleCommuneChange = (communeName: string) => {
    if (isLocked) return;
    const found = OFFICIAL_COMMUNES_CATALOG.find(c => c.communeName.toLowerCase() === communeName.toLowerCase() || c.communeCode === communeName);
    if (found) {
      setForm(prev => ({ ...prev, communeName: found.communeName, communeCode: found.communeCode }));
    } else {
      setForm(prev => ({ ...prev, communeName }));
    }
  };

  // Quản lý địa điểm SXKD (Câu 2)
  const handleAddLocation = () => {
    if (isLocked) return;
    const newLoc: LocationRow = {
      id: 'loc_' + Date.now(),
      stt: (form.locations?.length || 0) + 1,
      name: `Địa điểm ${(form.locations?.length || 0)}`,
      address: '',
      mainIndustry: '',
      industryCodeLevel2: '',
      laborJan01: 0,
      laborDec31Expected: 0
    };
    setForm(prev => ({ ...prev, locations: [...(prev.locations || []), newLoc] }));
  };

  const handleUpdateLocation = (index: number, field: keyof LocationRow, val: any) => {
    if (isLocked) return;
    setForm(prev => {
      const locs = [...(prev.locations || [])];
      locs[index] = { ...locs[index], [field]: val };

      // LOGIC CÔNG THỨC: Nếu có các địa điểm bên ngoài, tự động tính tổng lao động toàn doanh nghiệp
      let labor01 = prev.laborJan01;
      let labor12 = prev.laborDec31Expected;
      if (prev.hasExternalLocations) {
        labor01 = locs.reduce((sum, l) => sum + (Number(l.laborJan01) || 0), 0);
        labor12 = locs.reduce((sum, l) => sum + (Number(l.laborDec31Expected) || 0), 0);
      }

      return { ...prev, locations: locs, laborJan01: labor01, laborDec31Expected: labor12 };
    });
  };

  const handleRemoveLocation = (index: number) => {
    if (isLocked || index === 0) return; // Không xóa trụ sở chính
    setForm(prev => {
      const remainingLocs = prev.locations.filter((_, idx) => idx !== index);
      let labor01 = prev.laborJan01;
      let labor12 = prev.laborDec31Expected;
      if (prev.hasExternalLocations) {
        labor01 = remainingLocs.reduce((sum, l) => sum + (Number(l.laborJan01) || 0), 0);
        labor12 = remainingLocs.reduce((sum, l) => sum + (Number(l.laborDec31Expected) || 0), 0);
      }
      return {
        ...prev,
        locations: remainingLocs,
        laborJan01: labor01,
        laborDec31Expected: labor12
      };
    });
  };

  // Quản lý sản phẩm (Câu 3)
  const handleAddProduct = () => {
    if (isLocked) return;
    const newProd: EnterpriseProductRow = {
      id: 'prod_' + Date.now(),
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
    };
    setForm(prev => ({ ...prev, products: [...(prev.products || []), newProd] }));
  };

  const handleUpdateProduct = (index: number, field: keyof EnterpriseProductRow, val: any) => {
    if (isLocked) return;
    setForm(prev => {
      const prods = [...(prev.products || [])];
      prods[index] = { ...prods[index], [field]: val };
      return { ...prev, products: prods };
    });
  };

  const handleRemoveProduct = (index: number) => {
    if (isLocked) return;
    setForm(prev => ({
      ...prev,
      products: prev.products.filter((_, idx) => idx !== index)
    }));
  };

  // Cập nhật kết quả tài chính (Câu 4) - TỰ ĐỘNG TÍNH TOÁN THEO CÔNG THỨC
  const handleFinancialChange = (
    section: 'financialTotal' | 'financialMainIndustry' | 'financialOther1' | 'financialOther2',
    field: 'exec9Months' | 'estYear' | 'prevYear',
    value: number
  ) => {
    if (isLocked) return;
    setForm(prev => {
      const current = prev[section] || { exec9Months: 0, estYear: 0, prevYear: 0, comparePercent: 0 };
      const updated = { ...current, [field]: value };
      const prevVal = field === 'prevYear' ? value : updated.prevYear;
      const estVal = field === 'estYear' ? value : updated.estYear;
      // Công thức: % so sánh = (Ước cả năm / Năm trước) * 100
      updated.comparePercent = prevVal > 0 ? Number(((estVal / prevVal) * 100).toFixed(2)) : 0;
      
      const newForm = { ...prev, [section]: updated };

      // LOGIC CÔNG THỨC: Khi nhập các ngành chi tiết (02, 03, 04), tự động cộng dồn Mã 01 (Tổng doanh thu)
      if (section !== 'financialTotal') {
        const m = section === 'financialMainIndustry' ? updated : newForm.financialMainIndustry;
        const o1 = section === 'financialOther1' ? updated : newForm.financialOther1;
        const o2 = section === 'financialOther2' ? updated : newForm.financialOther2;

        const sumExec9 = (m?.exec9Months || 0) + (o1?.exec9Months || 0) + (o2?.exec9Months || 0);
        const sumEst = (m?.estYear || 0) + (o1?.estYear || 0) + (o2?.estYear || 0);
        const sumPrev = (m?.prevYear || 0) + (o1?.prevYear || 0) + (o2?.prevYear || 0);
        const sumRatio = sumPrev > 0 ? Number(((sumEst / sumPrev) * 100).toFixed(2)) : 0;

        newForm.financialTotal = {
          code: '01',
          title: 'Tổng doanh thu bán hàng và cung cấp dịch vụ',
          exec9Months: sumExec9,
          estYear: sumEst,
          prevYear: sumPrev,
          comparePercent: sumRatio
        };
      }

      return newForm;
    });
  };

  // Đồng bộ giá trị sản phẩm tiêu thụ ở Mục 3 sang Ngành SXKD chính (Mã 02)
  const syncProductValuesToMainIndustry = () => {
    if (isLocked) return;
    const sum9 = form.products?.reduce((s, p) => s + (Number(p.sales9MonthsValue) || 0), 0) || 0;
    const sumYear = form.products?.reduce((s, p) => s + (Number(p.salesYearValueEst) || 0), 0) || 0;
    const prevYearVal = form.financialMainIndustry?.prevYear || 0;
    const ratio = prevYearVal > 0 ? Number(((sumYear / prevYearVal) * 100).toFixed(2)) : 0;

    setForm(prev => {
      const updatedMain = {
        code: '02',
        title: 'Ngành SXKD chính',
        exec9Months: sum9,
        estYear: sumYear,
        prevYear: prevYearVal,
        comparePercent: ratio
      };

      const o1 = prev.financialOther1;
      const o2 = prev.financialOther2;
      const sumExec9 = sum9 + (o1?.exec9Months || 0) + (o2?.exec9Months || 0);
      const sumEst = sumYear + (o1?.estYear || 0) + (o2?.estYear || 0);
      const sumPrev = prevYearVal + (o1?.prevYear || 0) + (o2?.prevYear || 0);
      const totalRatio = sumPrev > 0 ? Number(((sumEst / sumPrev) * 100).toFixed(2)) : 0;

      return {
        ...prev,
        financialMainIndustry: updatedMain,
        financialTotal: {
          code: '01',
          title: 'Tổng doanh thu bán hàng và cung cấp dịch vụ',
          exec9Months: sumExec9,
          estYear: sumEst,
          prevYear: sumPrev,
          comparePercent: totalRatio
        }
      };
    });
  };

  // Tự động tính toán tổng tài chính từ các ngành
  const autoSumFinancialTotal = () => {
    if (isLocked) return;
    const m = form.financialMainIndustry;
    const o1 = form.financialOther1;
    const o2 = form.financialOther2;

    const exec9 = (m?.exec9Months || 0) + (o1?.exec9Months || 0) + (o2?.exec9Months || 0);
    const est = (m?.estYear || 0) + (o1?.estYear || 0) + (o2?.estYear || 0);
    const prev = (m?.prevYear || 0) + (o1?.prevYear || 0) + (o2?.prevYear || 0);
    const ratio = prev > 0 ? Number(((est / prev) * 100).toFixed(2)) : 0;

    setForm(p => ({
      ...p,
      financialTotal: {
        code: '01',
        title: 'Tổng doanh thu bán hàng và cung cấp dịch vụ',
        exec9Months: exec9,
        estYear: est,
        prevYear: prev,
        comparePercent: ratio
      }
    }));
  };

  // Lưu dữ liệu
  const handleSubmit = (status: 'DANG_NHAP' | 'DA_HOAN_THANH' | 'DA_DUYET') => {
    const toSave: EnterpriseSurvey01 = {
      ...form,
      surveyStatus: status,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Điều tra viên'
    };
    onSave(toSave);
  };

  // Tính tổng sản phẩm
  const totalProdSales9MonthsVal = form.products?.reduce((s, p) => s + (Number(p.sales9MonthsValue) || 0), 0) || 0;
  const totalProdSalesYearVal = form.products?.reduce((s, p) => s + (Number(p.salesYearValueEst) || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-slate-200">
        
        {/* HEADER MODAL */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-sky-900 text-white px-5 py-3.5 flex items-center justify-between shadow-md shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-sky-200">
                UBND TỈNH HƯNG YÊN
              </span>
              <span className="text-xs font-semibold text-sky-100">
                Phiếu số: <strong>01/TGTSP-DNCN</strong>
              </span>
              {form.surveyStatus === 'DA_DUYET' && (
                <span className="text-[11px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Đã duyệt
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
              PHIẾU THU THẬP THÔNG TIN VỀ HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP CỦA DOANH NGHIỆP/HTX NĂM {form.surveyYear || '2026'}
            </h2>
            <p className="text-[11px] text-sky-200 italic">
              (Áp dụng cho các doanh nghiệp/HTX hoạt động trong ngành công nghiệp chế biến, chế tạo)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenGuidelines && (
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="px-3 py-1.5 bg-sky-700/80 hover:bg-sky-600 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Xem hướng dẫn cách ghi phiếu trang 7-9"
              >
                <HelpCircle className="w-4 h-4 text-amber-300" />
                <span>Cách ghi phiếu</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => exportEnterprise01ToExcel(form)}
              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Xuất phiếu 01 ra file Excel chuẩn"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-slate-800 text-xs bg-slate-50/50">
          
          {/* PHẦN ĐẦU: MÃ SỐ THUẾ & CĂN CỨ PHÁP LÝ */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center gap-3">
                <label className="font-bold text-slate-700 whitespace-nowrap">Mã số thuế:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  maxLength={14}
                  value={form.taxCode || ''}
                  onChange={e => handleChange('taxCode', e.target.value.replace(/[^0-9-]/g, ''))}
                  placeholder="Ví dụ: 0900123456"
                  className="px-3 py-1.5 bg-amber-50 border-2 border-amber-300 focus:border-amber-500 rounded-lg font-mono text-sm tracking-widest font-black text-slate-900 w-48 shadow-inner"
                />
                <span className="text-[11px] text-slate-500 italic">(10 - 13 chữ số)</span>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                Thực hiện theo Quyết định số…..../QĐ-UBND ngày.../…/2026 của UBND tỉnh Hưng Yên về việc Ban hành Phương án điều tra, thu thập thông tin phục vụ biên soạn chỉ tiêu Tổng giá trị sản phẩm trên địa bàn xã, phường tỉnh Hưng Yên.
              </div>
            </div>

            <div className="md:col-span-5 bg-sky-50/70 border border-sky-100 rounded-xl p-3 text-[11px] text-sky-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-sky-950">
                <ShieldCheck className="w-4 h-4 text-sky-600" /> Quy định Luật Thống kê:
              </p>
              <p>- Nghĩa vụ cung cấp thông tin được quy định theo Luật thống kê;</p>
              <p>- Thông tin cung cấp theo phiếu này chỉ nhằm phục vụ công tác thống kê và được bảo mật theo Luật định.</p>
            </div>
          </div>

          {/* I. THÔNG TIN CHUNG */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm uppercase text-blue-900 border-b border-blue-100 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[11px]">I</span>
              <span>THÔNG TIN CHUNG</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-12">
                <label className="font-bold text-slate-700 block mb-1">
                  1. Tên doanh nghiệp: <span className="text-rose-600 font-bold">*</span>
                  <span className="text-[11px] text-slate-500 font-normal italic ml-2">(Ghi đầy đủ theo đăng ký kinh doanh)</span>
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.enterpriseName || ''}
                  onChange={e => handleChange('enterpriseName', e.target.value)}
                  placeholder="CÔNG TY TNHH / CỔ PHẦN..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-500 rounded-lg font-bold text-slate-900 text-sm"
                />
              </div>

              <div className="md:col-span-12 font-bold text-slate-700 mt-1">
                2. Địa chỉ doanh nghiệp:
              </div>

              <div className="md:col-span-5">
                <label className="font-medium text-slate-700 block mb-1">
                  - Xã, phường (Chọn theo bộ lọc danh mục):
                </label>
                <CommuneFilterSelect
                  selectedCode={form.communeCode}
                  selectedName={form.communeName}
                  disabled={isLocked}
                  placeholder="Gõ tên hoặc mã xã để lọc và chọn..."
                  onSelect={(code, name) => {
                    setForm(prev => ({ ...prev, communeCode: code, communeName: name }));
                  }}
                />
              </div>

              <div className="md:col-span-2">
                <label className="font-medium text-slate-700 block mb-1">Mã xã, phường:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  maxLength={5}
                  value={form.communeCode || ''}
                  onChange={e => handleChange('communeCode', e.target.value)}
                  placeholder="11200"
                  className="w-full px-2.5 py-2 bg-amber-50/70 border border-amber-300 font-mono font-bold text-center rounded-lg text-amber-950"
                />
              </div>

              <div className="md:col-span-5">
                <label className="font-medium text-slate-600 block mb-1">- Địa chỉ (số nhà, đường phố/thôn):</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.address || ''}
                  onChange={e => handleChange('address', e.target.value)}
                  placeholder="Thôn/Số nhà, đường phố..."
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="md:col-span-4">
                <label className="font-medium text-slate-600 block mb-1">- Số điện thoại:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.phone || ''}
                  onChange={e => handleChange('phone', e.target.value)}
                  placeholder="02213.xxx.xxx / 09xx.xxx.xxx"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="md:col-span-8">
                <label className="font-medium text-slate-600 block mb-1">Email:</label>
                <input
                  type="email"
                  disabled={isLocked}
                  value={form.email || ''}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="doanhnghiep@hungyen.vn"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* II. NGÀNH HOẠT ĐỘNG CỦA DOANH NGHIỆP */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm uppercase text-blue-900 border-b border-blue-100 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[11px]">II</span>
              <span>NGÀNH HOẠT ĐỘNG CỦA DOANH NGHIỆP</span>
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="md:col-span-9">
                  <label className="font-bold text-slate-700 block mb-1">
                    1. Ngành SXKD chính: <span className="text-rose-600 font-bold">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={form.mainIndustryName || ''}
                    onChange={e => handleChange('mainIndustryName', e.target.value)}
                    placeholder="Sản xuất sản phẩm từ plastic, chế biến thực phẩm, may mặc..."
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="font-bold text-slate-700 block mb-1">Mã ngành (5 ô mã):</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    maxLength={5}
                    value={form.mainIndustryCode || ''}
                    onChange={e => handleChange('mainIndustryCode', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="VD: 22200"
                    className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 font-mono font-bold tracking-widest text-center rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">2. Ngành SXKD khác:</label>
                <div className="space-y-2 pl-2 border-l-2 border-blue-200">
                  {/* Ngành khác 1 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-9">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={form.otherIndustries?.[0]?.name || ''}
                        onChange={e => {
                          const list = [...(form.otherIndustries || [])];
                          list[0] = { ...list[0], id: '1', name: e.target.value, code: list[0]?.code || '' };
                          handleChange('otherIndustries', list);
                        }}
                        placeholder="- Ngành khác 1..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        disabled={isLocked}
                        maxLength={5}
                        value={form.otherIndustries?.[0]?.code || ''}
                        onChange={e => {
                          const list = [...(form.otherIndustries || [])];
                          list[0] = { ...list[0], id: '1', name: list[0]?.name || '', code: e.target.value.replace(/[^0-9]/g, '') };
                          handleChange('otherIndustries', list);
                        }}
                        placeholder="Mã ngành..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 font-mono text-center rounded-lg"
                      />
                    </div>
                  </div>

                  {/* Ngành khác 2 */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                    <div className="md:col-span-9">
                      <input
                        type="text"
                        disabled={isLocked}
                        value={form.otherIndustries?.[1]?.name || ''}
                        onChange={e => {
                          const list = [...(form.otherIndustries || [])];
                          list[1] = { ...list[1], id: '2', name: e.target.value, code: list[1]?.code || '' };
                          handleChange('otherIndustries', list);
                        }}
                        placeholder="- Ngành khác 2..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <input
                        type="text"
                        disabled={isLocked}
                        maxLength={5}
                        value={form.otherIndustries?.[1]?.code || ''}
                        onChange={e => {
                          const list = [...(form.otherIndustries || [])];
                          list[1] = { ...list[1], id: '2', name: list[1]?.name || '', code: e.target.value.replace(/[^0-9]/g, '') };
                          handleChange('otherIndustries', list);
                        }}
                        placeholder="Mã ngành..."
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 font-mono text-center rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* III. THÔNG TIN VỀ LAO ĐỘNG */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm uppercase text-blue-900 border-b border-blue-100 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[11px]">III</span>
              <span>THÔNG TIN VỀ LAO ĐỘNG</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <label className="font-bold text-slate-700">
                  1. Thời điểm 01/01 năm báo cáo:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={isLocked}
                    value={form.laborJan01 || 0}
                    onChange={e => handleChange('laborJan01', Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-right text-sm"
                  />
                  <span className="font-bold text-slate-500">người</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="font-bold text-slate-700">
                  2. Dự kiến thời điểm 31/12 năm báo cáo:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={isLocked}
                    value={form.laborDec31Expected || 0}
                    onChange={e => handleChange('laborDec31Expected', Number(e.target.value))}
                    className="w-28 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-right text-sm"
                  />
                  <span className="font-bold text-slate-500">người</span>
                </div>
              </div>
            </div>
          </div>

          {/* IV. THÔNG TIN VỀ KẾT QUẢ SẢN XUẤT KINH DOANH */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-6">
            <h3 className="font-black text-sm uppercase text-blue-900 border-b border-blue-100 pb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-900 text-white flex items-center justify-center text-[11px]">IV</span>
              <span>THÔNG TIN VỀ KẾT QUẢ SẢN XUẤT KINH DOANH</span>
            </h3>

            {/* Câu 1: Cơ sở ngoài xã/phường */}
            <div className="bg-sky-50/60 p-4 rounded-xl border border-sky-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-black text-sm text-sky-950 block">
                  1. Doanh nghiệp có cơ sở SXKD ngoài xã/phường không?
                </span>
                <span className="text-[11px] text-slate-500">
                  (Nếu CÓ chuyển sang câu 2; Nếu KHÔNG chuyển sang câu 3)
                </span>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 font-bold cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="hasExternalLocations"
                    disabled={isLocked}
                    checked={form.hasExternalLocations === true}
                    onChange={() => handleChange('hasExternalLocations', true)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>Có → Chuyển sang câu 2</span>
                </label>
                <label className="flex items-center gap-2 font-bold cursor-pointer text-slate-800">
                  <input
                    type="radio"
                    name="hasExternalLocations"
                    disabled={isLocked}
                    checked={form.hasExternalLocations === false}
                    onChange={() => handleChange('hasExternalLocations', false)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>Không → Chuyển sang câu 3</span>
                </label>
              </div>
            </div>

            {/* Câu 2: Địa điểm SXKD (nếu Có cơ sở ngoài xã/phường) */}
            {form.hasExternalLocations && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <span>2. Thông tin về địa điểm SXKD:</span>
                  </h4>
                  {!isLocked && (
                    <button
                      type="button"
                      onClick={handleAddLocation}
                      className="px-2.5 py-1 bg-blue-100 text-blue-800 hover:bg-blue-200 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Thêm địa điểm
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center">
                      <tr>
                        <th className="p-2 border-r border-slate-200 w-12">STT</th>
                        <th className="p-2 border-r border-slate-200 min-w-44">Tên địa điểm SXKD</th>
                        <th className="p-2 border-r border-slate-200 min-w-40">Địa chỉ địa điểm SXKD (Ghi xã/phường)</th>
                        <th className="p-2 border-r border-slate-200 min-w-44">Ngành SXKD chính</th>
                        <th className="p-2 border-r border-slate-200 w-24">Mã ngành cấp 2</th>
                        <th className="p-2 border-r border-slate-200 w-28">Số LĐ 01/01</th>
                        <th className="p-2 border-r border-slate-200 w-28">Dự kiến số LĐ 31/12</th>
                        {!isLocked && <th className="p-2 w-10">Xóa</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {form.locations?.map((loc, idx) => (
                        <tr key={loc.id || idx} className="hover:bg-slate-50/80">
                          <td className="p-2 text-center font-bold text-slate-600 border-r border-slate-200">
                            {idx + 1}
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              disabled={isLocked || idx === 0}
                              value={loc.name}
                              onChange={e => handleUpdateLocation(idx, 'name', e.target.value)}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-medium"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={loc.address}
                              onChange={e => handleUpdateLocation(idx, 'address', e.target.value)}
                              placeholder="Xã/phường..."
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              disabled={isLocked}
                              value={loc.mainIndustry}
                              onChange={e => handleUpdateLocation(idx, 'mainIndustry', e.target.value)}
                              placeholder="Ngành chính..."
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="text"
                              disabled={isLocked}
                              maxLength={2}
                              value={loc.industryCodeLevel2}
                              onChange={e => handleUpdateLocation(idx, 'industryCodeLevel2', e.target.value.replace(/[^0-9]/g, ''))}
                              placeholder="22"
                              className="w-full px-1 py-1 bg-white border border-slate-200 rounded text-xs text-center font-mono font-bold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              disabled={isLocked}
                              value={loc.laborJan01 || 0}
                              onChange={e => handleUpdateLocation(idx, 'laborJan01', Number(e.target.value))}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-semibold"
                            />
                          </td>
                          <td className="p-1.5 border-r border-slate-200">
                            <input
                              type="number"
                              min={0}
                              disabled={isLocked}
                              value={loc.laborDec31Expected || 0}
                              onChange={e => handleUpdateLocation(idx, 'laborDec31Expected', Number(e.target.value))}
                              className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs text-right font-semibold"
                            />
                          </td>
                          {!isLocked && (
                            <td className="p-1.5 text-center">
                              {idx > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveLocation(idx)}
                                  className="text-rose-600 hover:text-rose-800 p-1"
                                  title="Xóa dòng"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Câu 3: Sản xuất, tiêu thụ của doanh nghiệp */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>3. Sản xuất, tiêu thụ của doanh nghiệp:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 italic">
                    (Giá trị tính theo Triệu đồng. Không gồm thuế GTGT, TTĐB, xuất khẩu)
                  </span>
                </div>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={handleAddProduct}
                    className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm sản phẩm
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center">
                    <tr>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 min-w-40">Tên sản phẩm<br/><span className="text-[10px] text-slate-400 font-normal">A</span></th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 w-24">Mã SP<br/><span className="text-[10px] text-slate-400 font-normal">B</span></th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 w-20">ĐVT<br/><span className="text-[10px] text-slate-400 font-normal">C</span></th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 w-28">Sản xuất 9 tháng<br/><span className="text-[10px] text-slate-400 font-normal">1</span></th>
                      <th colSpan={2} className="p-2 border-r border-slate-200 bg-sky-50">Tiêu thụ trong 9 tháng đầu năm</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 w-28">Ước SX cả năm<br/><span className="text-[10px] text-slate-400 font-normal">4</span></th>
                      <th colSpan={2} className="p-2 border-r border-slate-200 bg-indigo-50">Ước tiêu thụ cả năm báo cáo</th>
                      <th rowSpan={2} className="p-2 border-r border-slate-200 w-28">Sản xuất năm trước<br/><span className="text-[10px] text-slate-400 font-normal">7</span></th>
                      {!isLocked && <th rowSpan={2} className="p-2 w-10">Xóa</th>}
                    </tr>
                    <tr className="border-t border-slate-200">
                      <th className="p-1 border-r border-slate-200 w-24 bg-sky-50 text-[11px]">Số lượng (2)</th>
                      <th className="p-1 border-r border-slate-200 w-28 bg-sky-50 text-[11px]">Giá trị Tr.đ (3)</th>
                      <th className="p-1 border-r border-slate-200 w-24 bg-indigo-50 text-[11px]">Số lượng (5)</th>
                      <th className="p-1 border-r border-slate-200 w-28 bg-indigo-50 text-[11px]">Giá trị Tr.đ (6)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {form.products?.map((prod, idx) => (
                      <tr key={prod.id || idx} className="hover:bg-slate-50">
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={prod.productName}
                            onChange={e => handleUpdateProduct(idx, 'productName', e.target.value)}
                            placeholder="Tên sản phẩm..."
                            className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={prod.productCode}
                            onChange={e => handleUpdateProduct(idx, 'productCode', e.target.value)}
                            placeholder="Mã SP"
                            className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-center font-mono"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={prod.unit}
                            onChange={e => handleUpdateProduct(idx, 'unit', e.target.value)}
                            placeholder="Cái, tấn..."
                            className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-center"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.prod9Months || 0}
                            onChange={e => handleUpdateProduct(idx, 'prod9Months', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200 bg-sky-50/40">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.sales9MonthsQty || 0}
                            onChange={e => handleUpdateProduct(idx, 'sales9MonthsQty', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-sky-200 rounded text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200 bg-sky-50/40">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.sales9MonthsValue || 0}
                            onChange={e => handleUpdateProduct(idx, 'sales9MonthsValue', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-sky-300 rounded text-xs text-right font-bold text-sky-900"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.prodYearEst || 0}
                            onChange={e => handleUpdateProduct(idx, 'prodYearEst', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200 bg-indigo-50/40">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.salesYearQtyEst || 0}
                            onChange={e => handleUpdateProduct(idx, 'salesYearQtyEst', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-indigo-200 rounded text-xs text-right font-medium"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200 bg-indigo-50/40">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.salesYearValueEst || 0}
                            onChange={e => handleUpdateProduct(idx, 'salesYearValueEst', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-indigo-300 rounded text-xs text-right font-bold text-indigo-900"
                          />
                        </td>
                        <td className="p-1.5 border-r border-slate-200">
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={prod.prodPrevYear || 0}
                            onChange={e => handleUpdateProduct(idx, 'prodPrevYear', Number(e.target.value))}
                            className="w-full px-1.5 py-1 bg-white border border-slate-200 rounded text-xs text-right font-medium"
                          />
                        </td>
                        {!isLocked && (
                          <td className="p-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveProduct(idx)}
                              className="text-rose-600 hover:text-rose-800 p-1"
                              title="Xóa dòng"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    
                    {/* Dòng tổng cộng sản phẩm */}
                    <tr className="bg-emerald-50/70 font-bold text-slate-800 border-t-2 border-emerald-300">
                      <td colSpan={5} className="p-2 text-right border-r border-slate-200 text-xs">
                        TỔNG CỘNG GIÁ TRỊ TIÊU THỤ (TRIỆU ĐỒNG):
                      </td>
                      <td className="p-2 text-right border-r border-slate-200 text-emerald-900 font-black">
                        {totalProdSales9MonthsVal.toLocaleString()}
                      </td>
                      <td colSpan={2} className="p-2 border-r border-slate-200"></td>
                      <td className="p-2 text-right border-r border-slate-200 text-indigo-900 font-black">
                        {totalProdSalesYearVal.toLocaleString()}
                      </td>
                      <td colSpan={2} className="p-2"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Câu 4: Kết quả sản xuất kinh doanh */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-xs uppercase flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-900 text-white flex items-center justify-center text-[11px]">4</span>
                    <span>4. Kết quả sản xuất kinh doanh:</span>
                  </h4>
                  <span className="text-[11px] text-slate-500 italic">
                    (Đơn vị tính: Triệu đồng. % so sánh = [Ước cả năm / Năm trước] × 100)
                  </span>
                </div>
                {!isLocked && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={syncProductValuesToMainIndustry}
                      className="px-2.5 py-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 rounded font-bold text-[11px] cursor-pointer flex items-center gap-1"
                      title="Lấy tổng giá trị tiêu thụ sản phẩm (Mục 3) áp vào Ngành SXKD chính (Mã 02)"
                    >
                      <span>Lấy giá trị từ Mục 3 sang Mã 02</span>
                    </button>
                    <button
                      type="button"
                      onClick={autoSumFinancialTotal}
                      className="px-2.5 py-1 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 rounded font-bold text-[11px] cursor-pointer"
                      title="Tự động cộng Tổng doanh thu từ các ngành"
                    >
                      Tự động tính Mã 01 = (02 + 03 + 04)
                    </button>
                  </div>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center">
                    <tr>
                      <th className="p-2.5 border-r border-slate-200 min-w-64 text-left">Chỉ tiêu (A)</th>
                      <th className="p-2.5 border-r border-slate-200 w-16">Mã số (B)</th>
                      <th className="p-2.5 border-r border-slate-200 w-36">Thực hiện 9 tháng (1)</th>
                      <th className="p-2.5 border-r border-slate-200 w-36">Ước cả năm (2)</th>
                      <th className="p-2.5 border-r border-slate-200 w-36">Năm trước năm BC (3)</th>
                      <th className="p-2.5 w-24">% so sánh (4)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    
                    {/* Mã 01: Tổng doanh thu */}
                    <tr className="bg-blue-50/60 font-black text-blue-950">
                      <td className="p-2.5 border-r border-slate-200">
                        Tổng doanh thu bán hàng và cung cấp dịch vụ
                      </td>
                      <td className="p-2.5 text-center border-r border-slate-200 font-mono text-sm">
                        01
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialTotal?.exec9Months || 0}
                          onChange={e => handleFinancialChange('financialTotal', 'exec9Months', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-blue-300 rounded text-right font-black text-blue-900"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialTotal?.estYear || 0}
                          onChange={e => handleFinancialChange('financialTotal', 'estYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-blue-300 rounded text-right font-black text-blue-900"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialTotal?.prevYear || 0}
                          onChange={e => handleFinancialChange('financialTotal', 'prevYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-blue-300 rounded text-right font-black text-blue-900"
                        />
                      </td>
                      <td className="p-2.5 text-center font-black text-indigo-700 bg-indigo-50/50">
                        {form.financialTotal?.comparePercent ? `${form.financialTotal.comparePercent}%` : '-'}
                      </td>
                    </tr>

                    {/* Dòng phân loại: Chia theo ngành hoạt động */}
                    <tr className="bg-slate-100 font-bold text-slate-600 text-[11px]">
                      <td colSpan={6} className="p-1.5 pl-3">
                        Chia theo ngành hoạt động:
                      </td>
                    </tr>

                    {/* Mã 02: Ngành SXKD chính */}
                    <tr className="hover:bg-slate-50 font-semibold">
                      <td className="p-2.5 border-r border-slate-200 pl-6">
                        - Ngành SXKD chính: <span className="text-slate-500 font-normal">({form.mainIndustryName || 'Chưa nhập tên ngành'})</span>
                      </td>
                      <td className="p-2.5 text-center border-r border-slate-200 font-mono">
                        02
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialMainIndustry?.exec9Months || 0}
                          onChange={e => handleFinancialChange('financialMainIndustry', 'exec9Months', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialMainIndustry?.estYear || 0}
                          onChange={e => handleFinancialChange('financialMainIndustry', 'estYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialMainIndustry?.prevYear || 0}
                          onChange={e => handleFinancialChange('financialMainIndustry', 'prevYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700">
                        {form.financialMainIndustry?.comparePercent ? `${form.financialMainIndustry.comparePercent}%` : '-'}
                      </td>
                    </tr>

                    {/* Mã 03: Ngành SXKD khác 1 */}
                    <tr className="hover:bg-slate-50 font-semibold">
                      <td className="p-2.5 border-r border-slate-200 pl-6">
                        - Ngành khác 1: <span className="text-slate-500 font-normal">({form.otherIndustries?.[0]?.name || '...'})</span>
                      </td>
                      <td className="p-2.5 text-center border-r border-slate-200 font-mono">
                        03
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialOther1?.exec9Months || 0}
                          onChange={e => handleFinancialChange('financialOther1', 'exec9Months', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialOther1?.estYear || 0}
                          onChange={e => handleFinancialChange('financialOther1', 'estYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialOther1?.prevYear || 0}
                          onChange={e => handleFinancialChange('financialOther1', 'prevYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700">
                        {form.financialOther1?.comparePercent ? `${form.financialOther1.comparePercent}%` : '-'}
                      </td>
                    </tr>

                    {/* Mã 04: Ngành SXKD khác 2 */}
                    <tr className="hover:bg-slate-50 font-semibold">
                      <td className="p-2.5 border-r border-slate-200 pl-6">
                        - Ngành khác 2: <span className="text-slate-500 font-normal">({form.otherIndustries?.[1]?.name || '...'})</span>
                      </td>
                      <td className="p-2.5 text-center border-r border-slate-200 font-mono">
                        04
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialOther2?.exec9Months || 0}
                          onChange={e => handleFinancialChange('financialOther2', 'exec9Months', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialOther2?.estYear || 0}
                          onChange={e => handleFinancialChange('financialOther2', 'estYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r border-slate-200">
                        <input
                          type="number"
                          min={0}
                          disabled={isLocked}
                          value={form.financialOther2?.prevYear || 0}
                          onChange={e => handleFinancialChange('financialOther2', 'prevYear', Number(e.target.value))}
                          className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-right font-bold"
                        />
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-700">
                        {form.financialOther2?.comparePercent ? `${form.financialOther2.comparePercent}%` : '-'}
                      </td>
                    </tr>

                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* PHẦN KÝ TÊN VÀ XÁC NHẬN */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Người trả lời phiếu */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 block text-xs uppercase text-center border-b border-slate-200 pb-1">
                Người trả lời phiếu
              </span>
              <div>
                <label className="text-[11px] text-slate-600 block">Họ và tên:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.respondentName || ''}
                  onChange={e => handleChange('respondentName', e.target.value)}
                  placeholder="Họ tên người đại diện..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block">Điện thoại:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.respondentPhone || ''}
                  onChange={e => handleChange('respondentPhone', e.target.value)}
                  placeholder="09xx..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Điều tra viên */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 block text-xs uppercase text-center border-b border-slate-200 pb-1">
                Điều tra viên
              </span>
              <div>
                <label className="text-[11px] text-slate-600 block">Họ và tên:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.surveyorName || (currentUser?.name || '')}
                  onChange={e => handleChange('surveyorName', e.target.value)}
                  placeholder="Họ tên điều tra viên..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-600 block">Điện thoại:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.surveyorPhone || ''}
                  onChange={e => handleChange('surveyorPhone', e.target.value)}
                  placeholder="09xx..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            {/* Giám đốc / Ngày ký */}
            <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="font-bold text-slate-800 block text-xs uppercase text-center border-b border-slate-200 pb-1">
                  Giám đốc (Ký, đóng dấu)
                </span>
                <div className="mt-2">
                  <label className="text-[11px] text-slate-600 block">Ngày lập phiếu:</label>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={form.surveyDate || ''}
                    onChange={e => handleChange('surveyDate', e.target.value)}
                    placeholder="VD: 15/09/2026"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-center"
                  />
                </div>
              </div>
              <div className="text-center pt-2">
                <span className="text-[11px] text-slate-400 italic">
                  (Ký tên và đóng dấu đỏ của Doanh nghiệp/HTX)
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-bold">Trạng thái phiếu:</span>
            <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] border ${
              form.surveyStatus === 'DA_DUYET' 
                ? 'bg-purple-100 text-purple-800 border-purple-200' 
                : form.surveyStatus === 'DA_HOAN_THANH'
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                : form.surveyStatus === 'DANG_NHAP'
                ? 'bg-amber-100 text-amber-800 border-amber-200'
                : 'bg-slate-200 text-slate-700 border-slate-300'
            }`}>
              {form.surveyStatus === 'DA_DUYET' ? 'Đã duyệt' : form.surveyStatus === 'DA_HOAN_THANH' ? 'Đã hoàn thành' : form.surveyStatus === 'DANG_NHAP' ? 'Đang nhập' : 'Chưa nhập'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border border-slate-300 cursor-pointer"
            >
              Đóng
            </button>

            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={() => handleSubmit('DANG_NHAP')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu tạm (Đang nhập)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSubmit('DA_HOAN_THANH')}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Hoàn thành & Lưu Firebase</span>
                </button>
              </>
            )}

            {currentUser?.role === 'ADMIN' && form.surveyStatus !== 'DA_DUYET' && (
              <button
                type="button"
                onClick={() => handleSubmit('DA_DUYET')}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Lock className="w-4 h-4" />
                <span>Duyệt & Khóa phiếu</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
