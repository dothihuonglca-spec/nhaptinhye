/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import type { 
  Commune, 
  Household, 
  SurveyArea 
} from '../App';
import type { Surveyor } from '../types/user';
import { 
  OFFICIAL_COMMUNES_CATALOG, 
  COMMUNE_POPULATION_MAP, 
  PROVINCE_TOTAL_POPULATION 
} from '../data/communesCatalog';
import { calculateFullIncome } from '../utils/incomeCalculator';
import { 
  FileSpreadsheet, 
  Search, 
  Eye, 
  RefreshCw, 
  ArrowUpRight, 
  CheckCircle2, 
  AlertCircle,
  SlidersHorizontal,
  Building,
  TrendingUp,
  Users,
  Coins
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface IncomeMacroControlProps {
  communes: Commune[];
  households: Household[];
  areas: SurveyArea[];
  currentUser: Surveyor;
  onNavigateToCommune?: (communeCode: string) => void;
  showNotification: (type: 'success' | 'error', message: string) => void;
}

export const IncomeMacroControl: React.FC<IncomeMacroControlProps> = ({
  communes,
  households,
  currentUser,
  onNavigateToCommune,
  showNotification,
}) => {
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedTkcsFilter, setSelectedTkcsFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'ALL' | 'SURVEYED' | 'NOT_SURVEYED'>('ALL');
  const [sortBy, setSortBy] = useState<'stt' | 'name' | 'population' | 'incomeYear' | 'totalFund'>('stt');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Helper check household surveyed
  const isHouseholdSurveyed = (h: Household) => {
    return h.surveyStatus === 'DA_HOAN_THANH' || 
           h.surveyStatus === 'DA_DUYET' || 
           h.surveyStatus === 'DANG_NHAP' || 
           (Boolean(h.questionnaire) && calculateFullIncome(h.questionnaire).total > 0);
  };

  // Build TKCS list
  const tkcsList = useMemo(() => {
    const map = new Map<string, string>();
    OFFICIAL_COMMUNES_CATALOG.forEach(c => {
      if (c.tkcsCode && c.tkcsName) {
        map.set(c.tkcsCode, c.tkcsName);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, []);

  // Compute Macro Data for all 104 communes
  const macroRows = useMemo(() => {
    return OFFICIAL_COMMUNES_CATALOG.map((cat, index) => {
      const cCommune = communes.find(c => c.communeCode === cat.communeCode || c.id === cat.id);
      
      const communeCode = cat.communeCode;
      const communeName = cat.communeName;
      const tkcsCode = cat.tkcsCode || cCommune?.tkcsCode || '';
      const tkcsName = cat.tkcsName || cCommune?.tkcsName || '';
      const population = COMMUNE_POPULATION_MAP[communeCode] || cat.population || 25000;

      // Structure % (Tỷ trọng cơ cấu)
      const rawTt1 = cCommune?.ttNongLamThuySan ?? cat.ttNongLamThuySan ?? 0;
      const rawTt2 = cCommune?.ttCongNghiepXayDung ?? cat.ttCongNghiepXayDung ?? 0;
      const rawTt3 = cCommune?.ttThuongMaiDichVu ?? cat.ttThuongMaiDichVu ?? 0;
      const rawTt4 = cCommune?.ttThuKhacLuong ?? cat.ttThuKhacLuong ?? 0;

      // Actual households for this commune
      const cHouseholds = households.filter(h => h.communeCode === communeCode || (Boolean(cCommune?.id) && h.communeId === cCommune?.id));
      const officialHHs = cHouseholds.filter(h => h.sampleStatus === 'CHÍNH THỨC' || !h.sampleStatus);
      const surveyedHHs = officialHHs.filter(h => isHouseholdSurveyed(h));

      const hasAnySurvey = surveyedHHs.length > 0;

      // Structure % (Tỷ trọng cơ cấu từ danh mục / bảng kê chính thức của từng xã)
      const tt1 = rawTt1 > 0 ? Number((rawTt1 / 100).toFixed(4)) : 0;
      const tt2 = rawTt2 > 0 ? Number((rawTt2 / 100).toFixed(4)) : 0;
      const tt3 = rawTt3 > 0 ? Number((rawTt3 / 100).toFixed(4)) : 0;
      const tt4 = rawTt4 > 0 ? Number((rawTt4 / 100).toFixed(4)) : 0;

      // Group Year Incomes (Nghìn đồng/năm)
      let groupYearS1: number | null = null;
      let groupYearS2: number | null = null;
      let groupYearS3: number | null = null;
      let groupYearS4: number | null = null;

      const s1List = surveyedHHs.filter(h => Number(h.sectorCode) === 1);
      const s2List = surveyedHHs.filter(h => Number(h.sectorCode) === 2);
      const s3List = surveyedHHs.filter(h => Number(h.sectorCode) === 3);
      const s4List = surveyedHHs.filter(h => Number(h.sectorCode) === 4);

      if (s1List.length > 0) {
        const s1Income = s1List.reduce((acc, h) => acc + calculateFullIncome(h.questionnaire).total, 0);
        const s1Mem = s1List.reduce((acc, h) => acc + (Number(h.membersCount) || 1), 0);
        if (s1Mem > 0) groupYearS1 = Math.round(s1Income / s1Mem);
      }

      if (s2List.length > 0) {
        const s2Income = s2List.reduce((acc, h) => acc + calculateFullIncome(h.questionnaire).total, 0);
        const s2Mem = s2List.reduce((acc, h) => acc + (Number(h.membersCount) || 1), 0);
        if (s2Mem > 0) groupYearS2 = Math.round(s2Income / s2Mem);
      }

      if (s3List.length > 0) {
        const s3Income = s3List.reduce((acc, h) => acc + calculateFullIncome(h.questionnaire).total, 0);
        const s3Mem = s3List.reduce((acc, h) => acc + (Number(h.membersCount) || 1), 0);
        if (s3Mem > 0) groupYearS3 = Math.round(s3Income / s3Mem);
      }

      if (s4List.length > 0) {
        const s4Income = s4List.reduce((acc, h) => acc + calculateFullIncome(h.questionnaire).total, 0);
        const s4Mem = s4List.reduce((acc, h) => acc + (Number(h.membersCount) || 1), 0);
        if (s4Mem > 0) groupYearS4 = Math.round(s4Income / s4Mem);
      }

      // Per Capita Income Year & Month (Formula-based, dynamic)
      let perCapitaYear = 0;
      let perCapitaMonth = 0;

      let sumProducts = 0;
      let sumWeights = 0;

      if (tt1 > 0 && groupYearS1 !== null) { sumProducts += tt1 * groupYearS1; sumWeights += tt1; }
      if (tt2 > 0 && groupYearS2 !== null) { sumProducts += tt2 * groupYearS2; sumWeights += tt2; }
      if (tt3 > 0 && groupYearS3 !== null) { sumProducts += tt3 * groupYearS3; sumWeights += tt3; }
      if (tt4 > 0 && groupYearS4 !== null) { sumProducts += tt4 * groupYearS4; sumWeights += tt4; }

      if (sumWeights > 0) {
        // Mathematically sound and precise weighted extrapolation formula
        perCapitaYear = Number((sumProducts / sumWeights).toFixed(2));
        perCapitaMonth = Number((perCapitaYear / 12).toFixed(2));
      }

      // Macro Local Funds:
      // Q = O * D (Nghìn đồng/năm)
      const totalLocalIncomeYear = Math.round(perCapitaYear * population);
      // R = P * D (Nghìn đồng/tháng)
      const totalLocalIncomeMonth = Math.round(perCapitaMonth * population);

      return {
        stt: index + 1,
        communeCode,
        communeName,
        tkcsCode,
        tkcsName,
        population,
        // Tỷ trọng
        tt1,
        tt2,
        tt3,
        tt4,
        rawTt1,
        rawTt2,
        rawTt3,
        rawTt4,
        // Suy rộng 4 nhóm năm
        groupYearS1,
        groupYearS2,
        groupYearS3,
        groupYearS4,
        // Bình quân đầu người
        perCapitaYear,
        perCapitaMonth,
        targetMonthBenchmark: perCapitaMonth,
        // Tổng thu nhập địa phương
        totalLocalIncomeYear,
        totalLocalIncomeMonth,
        // Điều tra thực tế
        surveyedCount: surveyedHHs.length,
        totalSample: officialHHs.length,
        hasSurveyData: surveyedHHs.length > 0
      };
    });
  }, [communes, households]);

  // Province Totals (Dòng Toàn Tỉnh)
  const provinceSummary = useMemo(() => {
    const totalPop = PROVINCE_TOTAL_POPULATION; // 3,256,389
    const totalYearFund = macroRows.reduce((acc, r) => acc + r.totalLocalIncomeYear, 0);
    const totalMonthFund = macroRows.reduce((acc, r) => acc + r.totalLocalIncomeMonth, 0);
    
    const avgYear = totalPop > 0 ? Number((totalYearFund / totalPop).toFixed(2)) : 0;
    const avgMonth = totalPop > 0 ? Number((totalMonthFund / totalPop).toFixed(2)) : 0;
    const totalSurveyedHHs = macroRows.reduce((acc, r) => acc + r.surveyedCount, 0);
    const totalSampleHHs = macroRows.reduce((acc, r) => acc + r.totalSample, 0);

    return {
      totalPop,
      totalYearFund,
      totalMonthFund,
      avgYear,
      avgMonth,
      targetMonth: avgMonth,
      totalSurveyedHHs,
      totalSampleHHs,
      surveyedCommunesCount: macroRows.filter(r => r.hasSurveyData).length
    };
  }, [macroRows]);

  // Filter & Sort
  const filteredRows = useMemo(() => {
    return macroRows
      .filter(r => {
        if (selectedTkcsFilter !== 'ALL' && r.tkcsCode !== selectedTkcsFilter) return false;
        if (selectedStatusFilter === 'SURVEYED' && !r.hasSurveyData) return false;
        if (selectedStatusFilter === 'NOT_SURVEYED' && r.hasSurveyData) return false;
        if (searchKeyword.trim()) {
          const kw = searchKeyword.toLowerCase().trim();
          const matchName = r.communeName.toLowerCase().includes(kw);
          const matchCode = r.communeCode.toLowerCase().includes(kw);
          const matchTkcs = r.tkcsName.toLowerCase().includes(kw);
          if (!matchName && !matchCode && !matchTkcs) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortBy === 'stt') diff = a.stt - b.stt;
        else if (sortBy === 'name') diff = a.communeName.localeCompare(b.communeName, 'vi');
        else if (sortBy === 'population') diff = a.population - b.population;
        else if (sortBy === 'incomeYear') diff = a.perCapitaYear - b.perCapitaYear;
        else if (sortBy === 'totalFund') diff = a.totalLocalIncomeYear - b.totalLocalIncomeYear;
        return sortAsc ? diff : -diff;
      });
  }, [macroRows, selectedTkcsFilter, selectedStatusFilter, searchKeyword, sortBy, sortAsc]);

  // Handle Export Excel
  const handleExportExcel = () => {
    try {
      // Header Structure
      const headers = [
        ["BẢNG KIỂM SOÁT VÀ SUY RỘNG THU NHẬP BÌNH QUÂN ĐỊA PHƯƠNG TOÀN TỈNH"],
        [`(Dành riêng cho Quản trị viên - Ngày xuất: ${new Date().toLocaleDateString('vi-VN')})`],
        [""],
        [
          "STT",
          "Tên Xã, Phường",
          "Mã xã, phường",
          "Dân số (Người)",
          "Thu nhập bình quân đầu người/tháng (Nghìn đồng)",
          "Tỷ trọng cơ cấu (%)", "", "", "",
          "Suy rộng TNBQ xã / năm (Nghìn đồng)", "", "", "",
          "Thu nhập bình quân đầu người năm (Nghìn đồng)",
          "Thu nhập bình quân đầu người (Nghìn đồng) Tháng",
          "Thu nhập địa phương (Nghìn đồng)", ""
        ],
        [
          "",
          "",
          "",
          "",
          "",
          "Nông, lâm thủy sản",
          "Công nghiệp xây dựng",
          "Thương mại dịch vụ",
          "Nguồn thu khác / Lương",
          "Nông, lâm thủy sản",
          "Công nghiệp xây dựng",
          "Thương mại dịch vụ",
          "Nguồn thu khác / Lương",
          "=G*K+H*L+I*M+J*N",
          "=O/12",
          "Năm (=O*D)",
          "Tháng (=P*D)"
        ],
        [
          "A", "B", "C", "D", "1",
          "G", "H", "I", "J",
          "K", "L", "M", "N",
          "O", "P", "Q", "R"
        ],
        // Dòng Toàn Tỉnh
        [
          "",
          "Toàn tỉnh",
          "",
          provinceSummary.totalPop,
          provinceSummary.targetMonth,
          "", "", "", "",
          "", "", "", "",
          provinceSummary.avgYear,
          provinceSummary.avgMonth,
          provinceSummary.totalYearFund,
          provinceSummary.totalMonthFund
        ]
      ];

      // Rows
      macroRows.forEach(r => {
        headers.push([
          r.stt,
          r.communeName,
          r.communeCode,
          r.population,
          r.targetMonthBenchmark,
          r.tt1 !== null ? r.tt1 : "",
          r.tt2 !== null ? r.tt2 : "",
          r.tt3 !== null ? r.tt3 : "",
          r.tt4 !== null ? r.tt4 : "",
          r.groupYearS1 !== null ? r.groupYearS1 : "",
          r.groupYearS2 !== null ? r.groupYearS2 : "",
          r.groupYearS3 !== null ? r.groupYearS3 : "",
          r.groupYearS4 !== null ? r.groupYearS4 : "",
          r.perCapitaYear,
          r.perCapitaMonth,
          r.totalLocalIncomeYear,
          r.totalLocalIncomeMonth
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(headers);
      
      // Merge cells for headers
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
        // Multi-level column headers
        { s: { r: 3, c: 0 }, e: { r: 4, c: 0 } },
        { s: { r: 3, c: 1 }, e: { r: 4, c: 1 } },
        { s: { r: 3, c: 2 }, e: { r: 4, c: 2 } },
        { s: { r: 3, c: 3 }, e: { r: 4, c: 3 } },
        { s: { r: 3, c: 4 }, e: { r: 4, c: 4 } },
        { s: { r: 3, c: 5 }, e: { r: 3, c: 8 } },
        { s: { r: 3, c: 9 }, e: { r: 3, c: 12 } },
        { s: { r: 3, c: 13 }, e: { r: 4, c: 13 } },
        { s: { r: 3, c: 14 }, e: { r: 4, c: 14 } },
        { s: { r: 3, c: 15 }, e: { r: 3, c: 16 } }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "KiemSoatThuNhap");
      XLSX.writeFile(wb, `Kiem_Soat_Thu_Nhap_Toan_Tinh_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showNotification('success', 'Đã xuất file Excel kiểm soát thu nhập thành công!');
    } catch (e: any) {
      console.error(e);
      showNotification('error', 'Lỗi khi xuất file Excel: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-3 md:p-5 w-full animate-in fade-in duration-200">
      
      {/* HEADER & EXECUTIVE KPI SUMMARY BANNER */}
      <div className="bg-gradient-to-r from-teal-800 via-sky-800 to-teal-900 rounded-xl p-4 md:p-5 text-white shadow-lg border border-teal-600/40">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-teal-800/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider">
                ADMIN ONLY
              </span>
              <h2 className="text-lg md:text-xl font-black text-white flex items-center gap-2">
                <Building className="w-5 h-5 text-teal-400" />
                BIỂU KIỂM SOÁT & SUY RỘNG THU NHẬP ĐỊA PHƯƠNG TOÀN TỈNH
              </h2>
            </div>
            <p className="text-xs text-teal-200 mt-1">
              Liên kết đồng bộ 104 Xã/Phường • Dân số toàn tỉnh 3,256,389 người • Suy rộng quỹ thu nhập
            </p>
          </div>

          {/* Action Buttons: Neat, vibrant, equal height */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-md font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel chuẩn biểu</span>
            </button>
          </div>
        </div>

        {/* 4 KPI CARDS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
          <div className="bg-white/10 backdrop-blur-xs rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-teal-300 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Dân số toàn tỉnh</span>
              <span className="text-[10px] bg-teal-800/80 px-1.5 py-0.2 rounded text-teal-100">104 xã/phường</span>
            </div>
            <div className="text-xl md:text-2xl font-black text-white">
              {provinceSummary.totalPop.toLocaleString('vi-VN')} <span className="text-xs font-normal text-teal-200">người</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-amber-300 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> TNBQ Toàn Tỉnh (Tháng)</span>
              <span className="text-[10px] bg-amber-800/80 px-1.5 py-0.2 rounded text-amber-100">Chuẩn điều tra</span>
            </div>
            <div className="text-xl md:text-2xl font-black text-amber-300">
              {provinceSummary.avgMonth.toLocaleString('vi-VN')} <span className="text-xs font-normal text-amber-100">nghìn đ/người/tháng</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-sky-300 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Tổng Thu Nhập Địa Phương Năm </span>
              <span className="text-[10px] bg-sky-800/80 px-1.5 py-0.2 rounded text-sky-100">Quy mô năm</span>
            </div>
            <div className="text-xl md:text-2xl font-black text-sky-200">
              {(provinceSummary.totalYearFund / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-sky-200">tỷ đồng/năm</span>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-xs rounded-lg p-3 border border-white/10">
            <div className="flex items-center justify-between text-purple-300 text-xs font-semibold mb-1">
              <span className="flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Tổng Thu Nhập Địa Phương Tháng </span>
              <span className="text-[10px] bg-purple-800/80 px-1.5 py-0.2 rounded text-purple-100">Quy mô tháng</span>
            </div>
            <div className="text-xl md:text-2xl font-black text-purple-200">
              {(provinceSummary.totalMonthFund / 1000000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} <span className="text-xs font-normal text-purple-200">tỷ đồng/tháng</span>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR: EQUAL HEIGHTS, CLEAN, VIBRANT */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* TKCS Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">Tổ TKCS:</span>
            <select
              value={selectedTkcsFilter}
              onChange={e => setSelectedTkcsFilter(e.target.value)}
              className="h-9 bg-slate-50 border border-slate-300 rounded px-2.5 font-medium text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              <option value="ALL">-- Tất cả {tkcsList.length} Tổ TKCS --</option>
              {tkcsList.map(tk => (
                <option key={tk.code} value={tk.code}>{tk.code} - {tk.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">Tiến độ:</span>
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value as any)}
              className="h-9 bg-slate-50 border border-slate-300 rounded px-2.5 font-medium text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              <option value="ALL">Tất cả ({macroRows.length} xã)</option>
              <option value="SURVEYED">Đã có phiếu điều tra ({provinceSummary.surveyedCommunesCount} xã)</option>
              <option value="NOT_SURVEYED">Chưa có phiếu điều tra ({macroRows.length - provinceSummary.surveyedCommunesCount} xã)</option>
            </select>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-9 bg-slate-50 border border-slate-300 rounded px-2.5 font-medium text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              <option value="stt">Theo STT Danh mục</option>
              <option value="name">Tên Xã / Phường (A-Z)</option>
              <option value="population">Dân số</option>
              <option value="incomeYear">TNBQ Năm</option>
              <option value="totalFund">Tổng quỹ thu nhập</option>
            </select>
            <button
              type="button"
              onClick={() => setSortAsc(!sortAsc)}
              className="h-9 px-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-bold text-slate-700 cursor-pointer"
              title="Đảo chiều sắp xếp"
            >
              {sortAsc ? '▲ Tăng' : '▼ Giảm'}
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px] md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchKeyword}
            onChange={e => setSearchKeyword(e.target.value)}
            placeholder="Tìm tên xã, mã xã..."
            className="h-9 w-full pl-8 pr-3 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      {/* MACRO TABLE - EXACT REPLICA OF THE IMAGE */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[750px]">
          <table className="w-full text-[11px] border-collapse min-w-[1500px]">
            <thead className="sticky top-0 z-20 bg-slate-100 text-slate-900 select-none shadow-xs">
              
              {/* HEADER TIER 1 */}
              <tr className="border-b border-slate-300 font-black text-center bg-slate-200">
                <th rowSpan={2} className="p-2 border border-slate-300 w-12 bg-slate-200">STT</th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-left min-w-[160px] bg-slate-200">Tên Xã, Phường</th>
                <th rowSpan={2} className="p-2 border border-slate-300 w-20 bg-slate-200">Mã xã, phường</th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-right w-24 bg-slate-200">Dân số (Người)</th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-right w-28 bg-slate-200 leading-tight">
                  Thu nhập bình quân đầu người/tháng (Nghìn đồng)
                </th>
                <th colSpan={4} className="p-2 border border-slate-300 bg-emerald-50 text-emerald-950">
                  Tỷ trọng cơ cấu (%)
                </th>
                <th colSpan={4} className="p-2 border border-slate-300 bg-sky-50 text-sky-950">
                  Suy rộng TNBQ xã / năm (Nghìn đồng)
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-right w-28 bg-amber-50 text-amber-950 leading-tight">
                  Thu nhập bình quân đầu người năm (Nghìn đồng)
                  <span className="block font-normal text-[9px] text-amber-800 mt-0.5">=G*K+H*L+I*M+J*N</span>
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 text-right w-24 bg-amber-100 text-amber-950 leading-tight">
                  Thu nhập bình quân đầu người (Nghìn đồng) Tháng
                  <span className="block font-normal text-[9px] text-amber-800 mt-0.5">=O/12</span>
                </th>
                <th colSpan={2} className="p-2 border border-slate-300 bg-purple-50 text-purple-950">
                  Thu nhập địa phương (Nghìn đồng)
                </th>
                <th rowSpan={2} className="p-2 border border-slate-300 w-20 bg-slate-200 text-center">Thao tác</th>
              </tr>

              {/* HEADER TIER 2 */}
              <tr className="border-b border-slate-300 font-bold text-center">
                {/* 4 columns: Tỷ trọng cơ cấu */}
                <th className="p-1.5 border border-slate-300 bg-emerald-50 text-emerald-900 w-16">Nông, lâm thủy sản</th>
                <th className="p-1.5 border border-slate-300 bg-emerald-50 text-emerald-900 w-16">Công nghiệp xây dựng</th>
                <th className="p-1.5 border border-slate-300 bg-emerald-50 text-emerald-900 w-16">Thương mại dịch vụ</th>
                <th className="p-1.5 border border-slate-300 bg-emerald-50 text-emerald-900 w-16">Nguồn thu khác / Lương</th>

                {/* 4 columns: Suy rộng TNBQ nhóm năm */}
                <th className="p-1.5 border border-slate-300 bg-sky-50 text-sky-900 w-20">Nông, lâm thủy sản</th>
                <th className="p-1.5 border border-slate-300 bg-sky-50 text-sky-900 w-20">Công nghiệp xây dựng</th>
                <th className="p-1.5 border border-slate-300 bg-sky-50 text-sky-900 w-20">Thương mại dịch vụ</th>
                <th className="p-1.5 border border-slate-300 bg-sky-50 text-sky-900 w-20">Nguồn thu khác / Lương</th>

                {/* 2 columns: Thu nhập địa phương */}
                <th className="p-1.5 border border-slate-300 bg-purple-50 text-purple-900 w-32 text-right">Năm (=O*D)</th>
                <th className="p-1.5 border border-slate-300 bg-purple-50 text-purple-900 w-28 text-right">Tháng (=P*D)</th>
              </tr>

              {/* COLUMN INDEX ROW (A, B, C, D, 1, G, H, I, J, K, L, M, N, O, P, Q, R) */}
              <tr className="bg-slate-300 text-slate-700 font-extrabold text-[10px] text-center border-b border-slate-400">
                <td className="p-1 border border-slate-400">A</td>
                <td className="p-1 border border-slate-400 text-left">B</td>
                <td className="p-1 border border-slate-400">C</td>
                <td className="p-1 border border-slate-400 text-right">D</td>
                <td className="p-1 border border-slate-400 text-right">1</td>
                <td className="p-1 border border-slate-400">G</td>
                <td className="p-1 border border-slate-400">H</td>
                <td className="p-1 border border-slate-400">I</td>
                <td className="p-1 border border-slate-400">J</td>
                <td className="p-1 border border-slate-400">K</td>
                <td className="p-1 border border-slate-400">L</td>
                <td className="p-1 border border-slate-400">M</td>
                <td className="p-1 border border-slate-400">N</td>
                <td className="p-1 border border-slate-400 text-right">O</td>
                <td className="p-1 border border-slate-400 text-right">P</td>
                <td className="p-1 border border-slate-400 text-right">Q</td>
                <td className="p-1 border border-slate-400 text-right">R</td>
                <td className="p-1 border border-slate-400 text-center">-</td>
              </tr>
            </thead>

            <tbody>
              {/* DÒNG TOÀN TỈNH - NỔI BẬT NỀN VÀNG ĐẬM Y HỆT HÌNH */}
              <tr className="bg-amber-200 hover:bg-amber-300 font-black text-slate-950 border-b-2 border-amber-500 sticky top-[76px] z-10 shadow-xs">
                <td className="p-2 border border-amber-400 text-center font-black">-</td>
                <td className="p-2 border border-amber-400 text-left uppercase text-xs tracking-wider">
                  TOÀN TỈNH
                </td>
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-right text-xs">
                  {provinceSummary.totalPop.toLocaleString('vi-VN')}
                </td>
                <td className="p-2 border border-amber-400 text-right bg-amber-300 text-xs">
                  {provinceSummary.targetMonth.toLocaleString('vi-VN')}
                </td>
                
                {/* 4 blank cells for structure */}
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-center">-</td>

                {/* 4 blank cells for group */}
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-center">-</td>
                <td className="p-2 border border-amber-400 text-center">-</td>

                {/* TNBQ Năm */}
                <td className="p-2 border border-amber-400 text-right bg-amber-300 text-xs">
                  {provinceSummary.avgYear.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                </td>

                {/* TNBQ Tháng */}
                <td className="p-2 border border-amber-400 text-right bg-amber-400 text-xs">
                  {provinceSummary.avgMonth.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                </td>

                {/* Quỹ Năm */}
                <td className="p-2 border border-amber-400 text-right text-xs">
                  {provinceSummary.totalYearFund.toLocaleString('vi-VN')}
                </td>

                {/* Quỹ Tháng */}
                <td className="p-2 border border-amber-400 text-right text-xs">
                  {provinceSummary.totalMonthFund.toLocaleString('vi-VN')}
                </td>

                <td className="p-2 border border-amber-400 text-center">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-800 text-white font-bold">
                    Tổng
                  </span>
                </td>
              </tr>

              {/* 104 XÃ / PHƯỜNG */}
              {filteredRows.map((r, idx) => {
                const isHighlight = r.communeCode === '12127'; // Phường Thượng Hồng highlighted in screenshot
                
                return (
                  <tr 
                    key={r.communeCode} 
                    className={`border-b border-slate-200 transition-colors ${
                      isHighlight 
                        ? 'bg-rose-50 hover:bg-rose-100 text-rose-950 font-bold' 
                        : idx % 2 === 0 
                          ? 'bg-white hover:bg-slate-50' 
                          : 'bg-slate-50/50 hover:bg-slate-100/70'
                    }`}
                  >
                    <td className="p-1.5 border border-slate-300 text-center font-medium text-slate-500">
                      {r.stt}
                    </td>
                    <td className="p-1.5 border border-slate-300 font-semibold text-slate-900">
                      <div className="flex items-center justify-between gap-1">
                        <span>{r.communeName}</span>
                        {r.hasSurveyData && (
                          <span className="px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold" title={`Đã có ${r.surveyedCount}/${r.totalSample} phiếu điều tra`}>
                            {r.surveyedCount} hộ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono font-bold text-slate-700">
                      {r.communeCode}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-medium text-slate-800">
                      {r.population.toLocaleString('vi-VN')}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-bold text-slate-900 bg-slate-100/50">
                      {r.targetMonthBenchmark.toLocaleString('vi-VN')}
                    </td>

                    {/* Tỷ trọng 4 nhóm */}
                    <td className="p-1.5 border border-slate-300 text-center font-mono text-slate-700">
                      {r.tt1 !== null && r.tt1 > 0 ? r.tt1.toFixed(2) : '-'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono text-slate-700">
                      {r.tt2 !== null && r.tt2 > 0 ? r.tt2.toFixed(2) : '-'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono text-slate-700">
                      {r.tt3 !== null && r.tt3 > 0 ? r.tt3.toFixed(2) : '-'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-center font-mono text-slate-700">
                      {r.tt4 !== null && r.tt4 > 0 ? r.tt4.toFixed(2) : '-'}
                    </td>

                    {/* Suy rộng 4 nhóm năm */}
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-slate-800">
                      {r.groupYearS1 !== null ? r.groupYearS1.toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-slate-800">
                      {r.groupYearS2 !== null ? r.groupYearS2.toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-slate-800">
                      {r.groupYearS3 !== null ? r.groupYearS3.toLocaleString('vi-VN') : '-'}
                    </td>
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-slate-800">
                      {r.groupYearS4 !== null ? r.groupYearS4.toLocaleString('vi-VN') : '-'}
                    </td>

                    {/* TNBQ Năm */}
                    <td className="p-1.5 border border-slate-300 text-right font-bold text-amber-950 bg-amber-50/60 font-mono">
                      {r.perCapitaYear.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* TNBQ Tháng */}
                    <td className="p-1.5 border border-slate-300 text-right font-black text-amber-900 bg-amber-100/60 font-mono">
                      {r.perCapitaMonth.toLocaleString('vi-VN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Tổng Thu Nhập Địa Phương Năm */}
                    <td className="p-1.5 border border-slate-300 text-right font-mono text-slate-900">
                      {r.totalLocalIncomeYear.toLocaleString('vi-VN')}
                    </td>

                    {/* Tổng Thu Nhập Địa Phương Tháng */}
                    <td className="p-1.5 border border-slate-300 text-right font-mono font-bold text-slate-900">
                      {r.totalLocalIncomeMonth.toLocaleString('vi-VN')}
                    </td>

                    {/* Thao tác */}
                    <td className="p-1.5 border border-slate-300 text-center">
                      <button
                        type="button"
                        onClick={() => onNavigateToCommune && onNavigateToCommune(r.communeCode)}
                        className="p-1 text-teal-700 hover:text-white hover:bg-teal-700 rounded transition-all cursor-pointer font-bold inline-flex items-center gap-0.5 text-[10px]"
                        title="Xem chi tiết mẫu điều tra xã"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER BAR */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 font-medium">
          <div>
            Hiển thị <span className="font-bold text-slate-900">{filteredRows.length}</span> / {macroRows.length} xã/phường
            {selectedTkcsFilter !== 'ALL' && ` (Lọc theo Tổ: ${selectedTkcsFilter})`}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Đã có dữ liệu điều tra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> Chưa có dữ liệu điều tra
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};
