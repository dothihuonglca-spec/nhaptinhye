/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  X, Save, Download, Printer, HelpCircle, CheckCircle2, 
  ShieldCheck, Lock, Store
} from 'lucide-react';
import { 
  IndividualEstablishment02, 
  createDefaultEstablishment02 
} from '../types/industrialSurvey';
import { exportEstablishment02ToExcel } from '../utils/industrialExcelExport';
import { OFFICIAL_COMMUNES_CATALOG } from '../data/communesCatalog';
import CommuneFilterSelect from './CommuneFilterSelect';
import { Surveyor } from '../types/user';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  establishment: IndividualEstablishment02 | null;
  onSave: (data: IndividualEstablishment02) => void;
  currentUser?: Surveyor | null;
  onOpenGuidelines?: () => void;
}

export default function Establishment02Modal({
  isOpen,
  onClose,
  establishment,
  onSave,
  currentUser,
  onOpenGuidelines
}: Props) {
  const [form, setForm] = useState<IndividualEstablishment02>(() => {
    return establishment ? JSON.parse(JSON.stringify(establishment)) : createDefaultEstablishment02();
  });

  useEffect(() => {
    if (establishment) {
      setForm(JSON.parse(JSON.stringify(establishment)));
    } else {
      setForm(createDefaultEstablishment02());
    }
  }, [establishment, isOpen]);

  if (!isOpen) return null;

  const isLocked = form.surveyStatus === 'DA_DUYET' && currentUser?.role !== 'ADMIN';

  const handleChange = (field: keyof IndividualEstablishment02, value: any) => {
    if (isLocked) return;
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCommuneChange = (communeName: string) => {
    if (isLocked) return;
    const found = OFFICIAL_COMMUNES_CATALOG.find(c => c.communeName.toLowerCase() === communeName.toLowerCase() || c.communeCode === communeName);
    if (found) {
      setForm(prev => ({ ...prev, communeName: found.communeName, communeCode: found.communeCode }));
    } else {
      setForm(prev => ({ ...prev, communeName }));
    }
  };

  // Cập nhật doanh thu thuần (Câu 5)
  const handleRevenueChange = (field: 'prevYear' | 'exec9Months' | 'estYear', val: number) => {
    if (isLocked) return;
    setForm(prev => {
      const nr = { ...prev.netRevenue, [field]: val };
      const prevVal = field === 'prevYear' ? val : nr.prevYear;
      const estVal = field === 'estYear' ? val : nr.estYear;
      nr.comparePercent = prevVal > 0 ? Number(((estVal / prevVal) * 100).toFixed(2)) : 0;
      return { ...prev, netRevenue: nr };
    });
  };

  const handleSubmit = (status: 'DANG_NHAP' | 'DA_HOAN_THANH' | 'DA_DUYET') => {
    const toSave: IndividualEstablishment02 = {
      ...form,
      surveyStatus: status,
      updatedAt: new Date().toISOString(),
      updatedBy: currentUser?.name || 'Điều tra viên'
    };
    onSave(toSave);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[96vh] overflow-hidden border border-slate-200">
        
        {/* HEADER MODAL */}
        <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-sky-900 text-white px-5 py-3.5 flex items-center justify-between shadow-md shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded text-emerald-200">
                UBND TỈNH HƯNG YÊN
              </span>
              <span className="text-xs font-semibold text-emerald-100">
                Phiếu số: <strong>02/TGTSP-CTCN</strong>
              </span>
              {form.surveyStatus === 'DA_DUYET' && (
                <span className="text-[11px] bg-emerald-500 text-white font-bold px-2 py-0.5 rounded flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Đã duyệt
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black tracking-tight mt-0.5">
              PHIẾU THU THẬP THÔNG TIN VỀ HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP CỦA CƠ SỞ CÁ THỂ NĂM {form.surveyYear || '2026'}
            </h2>
            <p className="text-[11px] text-emerald-200 italic">
              (Áp dụng cho các cơ sở SXKD cá thể hoạt động trong ngành công nghiệp chế biến, chế tạo)
            </p>
          </div>

          <div className="flex items-center gap-2">
            {onOpenGuidelines && (
              <button
                type="button"
                onClick={onOpenGuidelines}
                className="px-3 py-1.5 bg-emerald-800/80 hover:bg-emerald-700 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Xem hướng dẫn cách ghi phiếu trang 9"
              >
                <HelpCircle className="w-4 h-4 text-amber-300" />
                <span>Cách ghi phiếu</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => exportEstablishment02ToExcel(form)}
              className="px-3 py-1.5 bg-teal-700 hover:bg-teal-600 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Xuất phiếu 02 ra file Excel chuẩn"
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-slate-800 text-xs bg-slate-50/50">
          
          {/* PHẦN ĐẦU: STT CƠ SỞ & CĂN CỨ */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-7 space-y-2">
              <div className="flex items-center gap-3">
                <label className="font-bold text-slate-700 whitespace-nowrap">STT cơ sở:</label>
                <input
                  type="text"
                  disabled={isLocked}
                  maxLength={4}
                  value={form.establishmentOrder || ''}
                  onChange={e => handleChange('establishmentOrder', e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0001"
                  className="px-3 py-1.5 bg-emerald-50 border-2 border-emerald-300 focus:border-emerald-500 rounded-lg font-mono text-sm tracking-widest font-black text-slate-900 w-28 text-center shadow-inner"
                />
                <span className="text-[11px] text-slate-500 italic">(4 chữ số do cán bộ thống kê theo dõi)</span>
              </div>
              <div className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                Thực hiện theo Quyết định số…..../QĐ-UBND ngày.../…/2026 của UBND tỉnh Hưng Yên về việc Ban hành Phương án điều tra, thu thập thông tin phục vụ biên soạn chỉ tiêu Tổng giá trị sản phẩm trên địa bàn xã, phường tỉnh Hưng Yên.
              </div>
            </div>

            <div className="md:col-span-5 bg-teal-50/70 border border-teal-100 rounded-xl p-3 text-[11px] text-teal-900 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-teal-950">
                <ShieldCheck className="w-4 h-4 text-teal-600" /> Lưu ý quy định Thống kê:
              </p>
              <p>- Nghĩa vụ cung cấp thông tin được quy định theo Luật thống kê;</p>
              <p>- Thông tin cung cấp theo phiếu này chỉ nhằm phục vụ công tác thống kê và được bảo mật theo Luật định.</p>
            </div>
          </div>

          {/* CÂU 1 & CÂU 2: TÊN VÀ ĐỊA CHỈ CƠ SỞ */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm uppercase text-emerald-900 border-b border-emerald-100 pb-2 flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-600" />
              <span>THÔNG TIN ĐỊNH DANH CƠ SỞ CÁ THỂ</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5">
              <div className="md:col-span-12">
                <label className="font-bold text-slate-700 block mb-1">
                  1. Tên cơ sở: <span className="text-rose-600 font-bold">*</span>
                  <span className="text-[11px] text-slate-500 font-normal italic ml-2">(Tên hộ kinh doanh / chủ cơ sở cá thể)</span>
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.establishmentName || ''}
                  onChange={e => handleChange('establishmentName', e.target.value)}
                  placeholder="Xưởng mộc Nguyễn Văn A, Cơ sở bánh đậu xanh B..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-lg font-bold text-slate-900 text-sm"
                />
              </div>

              <div className="md:col-span-12 font-bold text-slate-700 mt-1">
                2. Địa chỉ cơ sở:
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
                <label className="font-medium text-slate-600 block mb-1">- Địa chỉ (số nhà, đường phố, thôn):</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.address || ''}
                  onChange={e => handleChange('address', e.target.value)}
                  placeholder="Thôn, xóm, số nhà..."
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
                  placeholder="09xx.xxx.xxx"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-medium"
                />
              </div>

              <div className="md:col-span-8">
                <label className="font-medium text-slate-600 block mb-1">Email:</label>
                <input
                  type="email"
                  disabled={isLocked}
                  value={form.email || ''}
                  onChange={e => handleChange('email', e.target.value)}
                  placeholder="chucoso@gmail.com"
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* CÂU 3: NGÀNH SXKD CHÍNH */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-black text-sm uppercase text-emerald-900 border-b border-emerald-100 pb-2">
              3. NGÀNH SXKD CHÍNH
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-9">
                <label className="font-bold text-slate-700 block mb-1">
                  Tên ngành SXKD chính: <span className="text-rose-600 font-bold">*</span>
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={form.mainIndustryName || ''}
                  onChange={e => handleChange('mainIndustryName', e.target.value)}
                  placeholder="Gia công cơ khí, xay xát, làm mộc, may gia công..."
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
                  placeholder="VD: 16290"
                  className="w-full px-3 py-1.5 bg-amber-50/50 border border-amber-300 font-mono font-bold tracking-widest text-center rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* CÂU 4: SỐ LAO ĐỘNG */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-black text-sm uppercase text-emerald-900 border-b border-emerald-100 pb-2">
              4. SỐ LAO ĐỘNG CỦA CƠ SỞ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between gap-4">
                <label className="font-bold text-slate-700">
                  - Thời điểm 01/01 năm báo cáo:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={isLocked}
                    value={form.laborJan01 || 0}
                    onChange={e => handleChange('laborJan01', Number(e.target.value))}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-right text-sm"
                  />
                  <span className="font-bold text-slate-500">người</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <label className="font-bold text-slate-700">
                  - Dự kiến thời điểm 31/12 năm báo cáo:
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    disabled={isLocked}
                    value={form.laborDec31Expected || 0}
                    onChange={e => handleChange('laborDec31Expected', Number(e.target.value))}
                    className="w-24 px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-black text-right text-sm"
                  />
                  <span className="font-bold text-slate-500">người</span>
                </div>
              </div>
            </div>
          </div>

          {/* CÂU 5: DOANH THU THUẦN CỦA HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <div>
              <h3 className="font-black text-sm uppercase text-emerald-900 border-b border-emerald-100 pb-2">
                5. DOANH THU THUẦN CỦA HOẠT ĐỘNG SẢN XUẤT CÔNG NGHIỆP
              </h3>
              <p className="text-[11px] text-slate-500 italic mt-1">
                (Đơn vị tính: Triệu đồng. (*) Doanh thu tính trên địa bàn xã/phường được chọn mẫu điều tra)
              </p>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 text-center">
                  <tr>
                    <th rowSpan={2} className="p-2.5 border-r border-slate-200 min-w-64 text-left">
                      Tên chỉ tiêu (A)
                    </th>
                    <th rowSpan={2} className="p-2.5 border-r border-slate-200 w-16">
                      Mã số (B)
                    </th>
                    <th rowSpan={2} className="p-2.5 border-r border-slate-200 w-36">
                      Thực hiện năm trước năm báo cáo (1)
                    </th>
                    <th colSpan={2} className="p-2 border-r border-slate-200 bg-emerald-50">
                      Năm báo cáo
                    </th>
                    <th rowSpan={2} className="p-2.5 w-24">
                      % so sánh
                    </th>
                  </tr>
                  <tr className="border-t border-slate-200">
                    <th className="p-1 border-r border-slate-200 w-36 bg-emerald-50 text-[11px]">
                      Thực hiện 9 tháng đầu năm (2)
                    </th>
                    <th className="p-1 border-r border-slate-200 w-36 bg-emerald-50 text-[11px]">
                      Ước cả năm (3)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-emerald-50/50 font-bold text-slate-900">
                    <td className="p-3 border-r border-slate-200">
                      Doanh thu thuần của hoạt động sản xuất công nghiệp (*)
                    </td>
                    <td className="p-3 text-center border-r border-slate-200 font-mono text-sm">
                      01
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="number"
                        min={0}
                        disabled={isLocked}
                        value={form.netRevenue?.prevYear || 0}
                        onChange={e => handleRevenueChange('prevYear', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-right font-black text-slate-900"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="number"
                        min={0}
                        disabled={isLocked}
                        value={form.netRevenue?.exec9Months || 0}
                        onChange={e => handleRevenueChange('exec9Months', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-300 rounded text-right font-black text-emerald-950"
                      />
                    </td>
                    <td className="p-2 border-r border-slate-200">
                      <input
                        type="number"
                        min={0}
                        disabled={isLocked}
                        value={form.netRevenue?.estYear || 0}
                        onChange={e => handleRevenueChange('estYear', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-400 rounded text-right font-black text-emerald-950"
                      />
                    </td>
                    <td className="p-3 text-center font-black text-emerald-700 bg-emerald-100/50">
                      {form.netRevenue?.comparePercent ? `${form.netRevenue.comparePercent}%` : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KÝ TÊN VÀ XÁC NHẬN */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  placeholder="Họ tên chủ cơ sở..."
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
          </div>

        </div>

        {/* FOOTER MODAL */}
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
                  <span>Lưu tạm</span>
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
                <span>Duyệt phiếu</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
