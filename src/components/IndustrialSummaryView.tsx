/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Download, RefreshCw, Save, CheckCircle2, 
  Layers, Calculator, Building, MapPin, Printer 
} from 'lucide-react';
import { 
  IndustrialSummaryReport, 
  createDefaultSummaryReport, 
  EnterpriseSurvey01, 
  IndividualEstablishment02 
} from '../types/industrialSurvey';
import { exportIndustrialSummaryToExcel } from '../utils/industrialExcelExport';
import { OFFICIAL_COMMUNES_CATALOG } from '../data/communesCatalog';
import CommuneFilterSelect from './CommuneFilterSelect';

interface Props {
  communeCode: string;
  communeName: string;
  surveyYear?: string;
  enterprises: EnterpriseSurvey01[];
  establishments: IndividualEstablishment02[];
  savedSummaries: IndustrialSummaryReport[];
  onSaveSummary: (report: IndustrialSummaryReport) => void;
  onCommuneChange: (code: string, name: string) => void;
}

export default function IndustrialSummaryView({
  communeCode,
  communeName,
  surveyYear = '2026',
  enterprises,
  establishments,
  savedSummaries,
  onSaveSummary,
  onCommuneChange
}: Props) {
  const [activeBiêu, setActiveBiêu] = useState<'03_HIEN_HANH' | '04_SO_SANH'>('03_HIEN_HANH');

  // Lọc dữ liệu của xã/phường hiện tại
  const communeEnterprises = useMemo(() => {
    return enterprises.filter(e => e.communeCode === communeCode || e.communeName?.toLowerCase() === communeName?.toLowerCase());
  }, [enterprises, communeCode, communeName]);

  const communeEstablishments = useMemo(() => {
    return establishments.filter(e => e.communeCode === communeCode || e.communeName?.toLowerCase() === communeName?.toLowerCase());
  }, [establishments, communeCode, communeName]);

  // Tổng hợp giá trị ngành C (Chế biến, chế tạo) từ Phiếu 01 & Phiếu 02
  const aggregatedIndustryC = useMemo(() => {
    // Phiếu 01: Doanh thu ước cả năm & năm trước
    const dnC_Current = communeEnterprises.reduce((sum, e) => sum + (Number(e.financialTotal?.estYear) || 0), 0);
    const dnC_Prev = communeEnterprises.reduce((sum, e) => sum + (Number(e.financialTotal?.prevYear) || 0), 0);

    // Phiếu 02: Cơ sở cá thể ước cả năm & năm trước
    const csC_Current = communeEstablishments.reduce((sum, cs) => sum + (Number(cs.netRevenue?.estYear) || 0), 0);
    const csC_Prev = communeEstablishments.reduce((sum, cs) => sum + (Number(cs.netRevenue?.prevYear) || 0), 0);

    return {
      current: dnC_Current + csC_Current,
      prev: dnC_Prev + csC_Prev,
      dnCurrent: dnC_Current,
      csCurrent: csC_Current,
      dnPrev: dnC_Prev,
      csPrev: csC_Prev
    };
  }, [communeEnterprises, communeEstablishments]);

  // State báo cáo hiện tại
  const [report, setReport] = useState<IndustrialSummaryReport>(() => {
    const existing = savedSummaries.find(s => s.communeCode === communeCode && s.reportType === activeBiêu);
    if (existing) return JSON.parse(JSON.stringify(existing));
    const init = createDefaultSummaryReport(communeCode, communeName, activeBiêu);
    // Điền ngành C
    const indC = init.indicators.find(i => i.code === '03');
    if (indC) {
      indC.currentYearValue = aggregatedIndustryC.current;
      indC.prevYearValue = aggregatedIndustryC.prev;
      indC.growthRatePercent = indC.prevYearValue > 0 ? Number(((indC.currentYearValue / indC.prevYearValue) * 100).toFixed(2)) : 0;
    }
    // Tính tổng 01
    const total01 = init.indicators.find(i => i.code === '01');
    if (total01) {
      total01.currentYearValue = indC?.currentYearValue || 0;
      total01.prevYearValue = indC?.prevYearValue || 0;
      total01.growthRatePercent = total01.prevYearValue > 0 ? Number(((total01.currentYearValue / total01.prevYearValue) * 100).toFixed(2)) : 0;
    }
    return init;
  });

  // Khi đổi xã hoặc đổi biểu -> nạp dữ liệu tương ứng
  useEffect(() => {
    const existing = savedSummaries.find(s => s.communeCode === communeCode && s.reportType === activeBiêu);
    if (existing) {
      setReport(JSON.parse(JSON.stringify(existing)));
    } else {
      const init = createDefaultSummaryReport(communeCode, communeName, activeBiêu);
      const indC = init.indicators.find(i => i.code === '03');
      if (indC) {
        indC.currentYearValue = aggregatedIndustryC.current;
        indC.prevYearValue = aggregatedIndustryC.prev;
        indC.growthRatePercent = indC.prevYearValue > 0 ? Number(((indC.currentYearValue / indC.prevYearValue) * 100).toFixed(2)) : 0;
      }
      const total01 = init.indicators.find(i => i.code === '01');
      if (total01) {
        total01.currentYearValue = indC?.currentYearValue || 0;
        total01.prevYearValue = indC?.prevYearValue || 0;
        total01.growthRatePercent = total01.prevYearValue > 0 ? Number(((total01.currentYearValue / total01.prevYearValue) * 100).toFixed(2)) : 0;
      }
      setReport(init);
    }
  }, [communeCode, communeName, activeBiêu, savedSummaries]);

  // Cập nhật giá trị chỉ tiêu và tự động tính tổng mã 01
  const handleValueChange = (code: string, field: 'currentYearValue' | 'prevYearValue', value: number) => {
    setReport(prev => {
      const nextIndicators = prev.indicators.map(ind => {
        if (ind.code === code) {
          const updated = { ...ind, [field]: value };
          const c = field === 'currentYearValue' ? value : updated.currentYearValue;
          const p = field === 'prevYearValue' ? value : updated.prevYearValue;
          updated.growthRatePercent = p > 0 ? Number(((c / p) * 100).toFixed(2)) : 0;
          return updated;
        }
        return ind;
      });

      // Tự động tính Tổng 01 = 02 + 03 + 04 + 05
      const sumCurrent = nextIndicators.filter(i => i.code !== '01').reduce((s, i) => s + (Number(i.currentYearValue) || 0), 0);
      const sumPrev = nextIndicators.filter(i => i.code !== '01').reduce((s, i) => s + (Number(i.prevYearValue) || 0), 0);
      const sumGrowth = sumPrev > 0 ? Number(((sumCurrent / sumPrev) * 100).toFixed(2)) : 0;

      const finalIndicators = nextIndicators.map(i => {
        if (i.code === '01') {
          return {
            ...i,
            currentYearValue: sumCurrent,
            prevYearValue: sumPrev,
            growthRatePercent: sumGrowth
          };
        }
        return i;
      });

      return {
        ...prev,
        indicators: finalIndicators
      };
    });
  };

  // Đồng bộ lại từ các phiếu 01 và 02 của xã
  const handleSyncFromSurveys = () => {
    handleValueChange('03', 'currentYearValue', aggregatedIndustryC.current);
    handleValueChange('03', 'prevYearValue', aggregatedIndustryC.prev);
  };

  // Lưu biểu tổng hợp lên Firebase
  const handleSave = () => {
    const toSave: IndustrialSummaryReport = {
      ...report,
      communeCode,
      communeName,
      surveyYear,
      reportType: activeBiêu,
      updatedAt: new Date().toISOString()
    };
    onSaveSummary(toSave);
  };

  const isHienHanh = activeBiêu === '03_HIEN_HANH';

  return (
    <div className="space-y-6">
      
      {/* THANH CHỌN BIỂU VÀ ĐỊA BÀN */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Tab chọn Biểu 03 hoặc Biểu 04 */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveBiêu('03_HIEN_HANH')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              isHienHanh 
                ? 'bg-blue-900 text-white shadow-sm' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Biểu số 03/TH-CN (Giá hiện hành)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveBiêu('04_SO_SANH')}
            className={`px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
              !isHienHanh 
                ? 'bg-indigo-900 text-white shadow-sm' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Biểu số 04/TH-CN (Giá so sánh)</span>
          </button>
        </div>

        {/* Chọn Xã/Phường tổng hợp */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-700 whitespace-nowrap">Địa bàn tổng hợp:</span>
          </div>
          <CommuneFilterSelect
            selectedCode={communeCode}
            selectedName={communeName}
            className="w-64"
            placeholder="Lọc & chọn xã/phường..."
            onSelect={(code, name) => {
              if (code && name) {
                onCommuneChange(code, name);
              }
            }}
          />
        </div>

      </div>

      {/* THÔNG TIN NGUỒN DỮ LIỆU TỰ ĐỘNG CỦA XÃ */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-sky-50 border border-blue-200 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-blue-800 uppercase block">
            Phiếu 01: Doanh nghiệp/HTX đã nhập ({communeEnterprises.length} DN)
          </span>
          <div className="text-xl font-black text-blue-950 mt-1">
            {aggregatedIndustryC.dnCurrent.toLocaleString()} <span className="text-xs font-normal text-slate-500">Tr.đ</span>
          </div>
          <span className="text-[11px] text-slate-500">Năm trước: {aggregatedIndustryC.dnPrev.toLocaleString()} Tr.đ</span>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4 rounded-2xl">
          <span className="text-[11px] font-bold text-emerald-800 uppercase block">
            Phiếu 02: Cơ sở cá thể đã nhập ({communeEstablishments.length} CS)
          </span>
          <div className="text-xl font-black text-emerald-950 mt-1">
            {aggregatedIndustryC.csCurrent.toLocaleString()} <span className="text-xs font-normal text-slate-500">Tr.đ</span>
          </div>
          <span className="text-[11px] text-slate-500">Năm trước: {aggregatedIndustryC.csPrev.toLocaleString()} Tr.đ</span>
        </div>

        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-4 rounded-2xl flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-bold text-indigo-800 uppercase block">
              Tổng ngành C (Chế biến, chế tạo) xã
            </span>
            <div className="text-xl font-black text-indigo-950 mt-1">
              {aggregatedIndustryC.current.toLocaleString()} <span className="text-xs font-normal text-slate-500">Tr.đ</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncFromSurveys}
            className="mt-2 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Đồng bộ số liệu vào Mã 03
          </button>
        </div>
      </div>

      {/* BIỂU MẪU CHÍNH TỔNG HỢP ĐẦU RA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* HEADER BIỂU */}
        <div className="bg-slate-900 text-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              II. BIỂU TỔNG HỢP ĐẦU RA
            </span>
            <h2 className="text-base sm:text-lg font-black text-white mt-0.5">
              {isHienHanh ? 'Biểu số 03/TH-CN: GIÁ TRỊ SẢN PHẨM NGÀNH CÔNG NGHIỆP (THEO GIÁ HIỆN HÀNH)' : 'Biểu số 04/TH-CN: GIÁ TRỊ SẢN PHẨM NGÀNH CÔNG NGHIỆP (THEO GIÁ SO SÁNH)'}
            </h2>
            <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
              <span>NĂM {surveyYear}</span>
              <span>•</span>
              <span>Xã/phường: <strong className="text-white">{communeName}</strong></span>
              <span>•</span>
              <span>Mã xã: <strong className="text-amber-300">{communeCode}</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => exportIndustrialSummaryToExcel(report)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Excel Biểu mẫu</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>In Biểu</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Save className="w-4 h-4" />
              <span>Lưu Firebase</span>
            </button>
          </div>
        </div>

        {/* BẢNG CHỈ TIÊU */}
        <div className="overflow-x-auto p-4 sm:p-6">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300 text-center">
              <tr>
                <th className="p-3 border-r border-slate-200 text-left min-w-80">
                  Tên chỉ tiêu (A)
                </th>
                <th className="p-3 border-r border-slate-200 w-20">
                  Mã số (B)
                </th>
                <th className="p-3 border-r border-slate-200 w-48">
                  Năm báo cáo (triệu đồng) (1)
                </th>
                <th className="p-3 border-r border-slate-200 w-48">
                  Năm trước năm báo cáo (triệu đồng) (2)
                </th>
                <th className="p-3 w-36">
                  Năm báo cáo so với năm trước (%) (3)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {report.indicators?.map(ind => {
                const isTotal = ind.code === '01';
                return (
                  <tr 
                    key={ind.code} 
                    className={`transition-colors ${
                      isTotal 
                        ? 'bg-blue-50/80 font-black text-blue-950 text-sm' 
                        : 'hover:bg-slate-50/80 font-medium text-slate-900'
                    }`}
                  >
                    <td className={`p-3 border-r border-slate-200 ${!isTotal ? 'pl-8' : ''}`}>
                      {isTotal ? (
                        <span>{ind.name}</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>{ind.name}</span>
                          {ind.code === '03' && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                              Tự tổng hợp từ Phiếu 01 & 02
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="p-3 text-center border-r border-slate-200 font-mono font-bold">
                      {ind.code}
                    </td>

                    <td className="p-2 border-r border-slate-200">
                      {isTotal ? (
                        <div className="text-right px-3 py-1.5 font-black text-blue-950">
                          {ind.currentYearValue.toLocaleString()}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={ind.currentYearValue || 0}
                          onChange={e => handleValueChange(ind.code, 'currentYearValue', Number(e.target.value))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-bold text-slate-900 focus:border-blue-500"
                        />
                      )}
                    </td>

                    <td className="p-2 border-r border-slate-200">
                      {isTotal ? (
                        <div className="text-right px-3 py-1.5 font-black text-blue-950">
                          {ind.prevYearValue.toLocaleString()}
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          value={ind.prevYearValue || 0}
                          onChange={e => handleValueChange(ind.code, 'prevYearValue', Number(e.target.value))}
                          className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-right font-bold text-slate-900 focus:border-blue-500"
                        />
                      )}
                    </td>

                    <td className="p-3 text-center font-black bg-slate-50/50">
                      <span className={`px-2 py-1 rounded-md text-xs ${
                        (ind.growthRatePercent || 0) >= 100 
                          ? 'text-emerald-700 bg-emerald-100/60' 
                          : (ind.growthRatePercent || 0) > 0 
                          ? 'text-amber-700 bg-amber-100/60' 
                          : 'text-slate-500'
                      }`}>
                        {ind.growthRatePercent ? `${ind.growthRatePercent}%` : '-'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* GHI CHÚ CHÂN BẢNG */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>* Mã số 01 = Mã số 02 + 03 + 04 + 05 (Tự động cộng dồn toàn diện).</span>
          <span>* Cột 3 (%) = (Cột 1 / Cột 2) × 100%. Đơn vị tính: Triệu đồng.</span>
        </div>

      </div>

    </div>
  );
}
