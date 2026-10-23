/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Download, Upload, FileJson, X, CheckCircle2, AlertCircle, 
  Send, Database, ArrowRight, UserCheck, MapPin, RefreshCw, Layers
} from 'lucide-react';
import { Household, SurveyArea, Commune } from '../types';
import { Surveyor } from '../types/user';
import { 
  exportSingleAreaJson, 
  mergeImportedAreaData, 
  getAreaFileName,
  isHouseholdModified 
} from '../utils/areaDataTransfer';

interface AreaDataTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Surveyor;
  surveyors: Surveyor[];
  communes: Commune[];
  areas: SurveyArea[];
  households: Household[];
  onUpdateHouseholds: (updated: Household[]) => void;
  showNotification: (type: 'success' | 'error', msg: string) => void;
  initialMode?: 'export' | 'import';
}

export default function AreaDataTransferModal({
  isOpen,
  onClose,
  currentUser,
  surveyors,
  communes,
  areas,
  households,
  onUpdateHouseholds,
  showNotification,
  initialMode = 'export'
}: AreaDataTransferModalProps) {
  const isAdmin = currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR';
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialMode);
  
  // Export State
  const [selectedSurveyorId, setSelectedSurveyorId] = useState<string>(
    isAdmin ? (surveyors.find(s => s.role === 'SURVEYOR')?.id || '') : currentUser.id
  );
  const [selectedCommuneId, setSelectedCommuneId] = useState<string>('ALL');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [modifiedOnly, setModifiedOnly] = useState<boolean>(!isAdmin); // ĐTV mặc định chỉ xuất hộ mới làm/mới sửa
  const [isExporting, setIsExporting] = useState(false);

  // Import State
  const [importedFiles, setImportedFiles] = useState<{ file: File; text: string }[]>([]);
  const [importResults, setImportResults] = useState<{
    fileName: string;
    areaId: string;
    areaName: string;
    updatedCount: number;
    newCount: number;
    success: boolean;
    message: string;
  }[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  if (!isOpen) return null;

  // Lọc các địa bàn khả dụng để xuất
  const availableAreas = areas.filter(a => {
    // Nếu là ĐTV: chỉ xuất địa bàn mình được phân công
    if (!isAdmin) {
      const assignedList = currentUser.assignedAreas || [];
      const isAssigned = assignedList.includes(a.id) || 
        assignedList.includes(a.code) || 
        assignedList.includes(`${a.communeId}_${a.code}`);
      if (!isAssigned) return false;
    } else if (selectedSurveyorId) {
      const targetSurv = surveyors.find(s => s.id === selectedSurveyorId);
      if (targetSurv) {
        const assignedList = targetSurv.assignedAreas || [];
        const isAssigned = assignedList.includes(a.id) || 
          assignedList.includes(a.code) || 
          assignedList.includes(`${a.communeId}_${a.code}`);
        if (!isAssigned) return false;
      }
    }

    if (selectedCommuneId !== 'ALL' && a.communeId !== selectedCommuneId) {
      const c = communes.find(cm => cm.id === selectedCommuneId);
      if (!c || (a as any).communeCode !== c.communeCode) return false;
    }

    return true;
  });

  // Thực hiện xuất file
  const handleExecuteExport = () => {
    if (availableAreas.length === 0) {
      showNotification('error', 'Không tìm thấy địa bàn nào phù hợp để xuất.');
      return;
    }

    const areasToExport = selectedAreaId === 'ALL'
      ? availableAreas
      : availableAreas.filter(a => a.id === selectedAreaId || a.code === selectedAreaId);

    if (areasToExport.length === 0) {
      showNotification('error', 'Vui lòng chọn địa bàn cần xuất.');
      return;
    }

    setIsExporting(true);
    let totalExportedHhs = 0;
    try {
      areasToExport.forEach(area => {
        const res = exportSingleAreaJson(
          area,
          households,
          communes,
          currentUser,
          modifiedOnly
        );
        totalExportedHhs += res.count;
      });

      const scopeText = modifiedOnly ? 'dữ liệu mới làm/mới sửa' : 'toàn bộ bảng kê';
      showNotification(
        'success',
        `Đã xuất thành công ${areasToExport.length} file địa bàn (${totalExportedHhs} hộ, ${scopeText}) theo định dạng chuẩn [MãXã]_[MãĐB].json!`
      );
      onClose();
    } catch (err: any) {
      showNotification('error', 'Lỗi khi xuất file: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // Chọn file JSON để nạp
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const readFiles: { file: File; text: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const text = await file.text();
        readFiles.push({ file, text });
      } catch (err) {
        console.error("Lỗi đọc file:", file.name, err);
      }
    }
    setImportedFiles(readFiles);
    setImportResults([]);
  };

  // Thực hiện tổng hợp / nạp các file JSON
  const handleExecuteImport = () => {
    if (importedFiles.length === 0) {
      showNotification('error', 'Vui lòng chọn ít nhất 1 file JSON để nạp.');
      return;
    }

    setIsProcessingImport(true);
    let currentHhs = [...households];
    const results: typeof importResults = [];

    importedFiles.forEach(({ file, text }) => {
      const res = mergeImportedAreaData(text, currentHhs);
      if (res.success) {
        currentHhs = res.mergedHouseholds;
        results.push({
          fileName: file.name,
          areaId: res.areaId,
          areaName: res.areaName,
          updatedCount: res.updatedCount,
          newCount: res.newCount,
          success: true,
          message: res.message
        });
      } else {
        results.push({
          fileName: file.name,
          areaId: '',
          areaName: '',
          updatedCount: 0,
          newCount: 0,
          success: false,
          message: res.message
        });
      }
    });

    setImportResults(results);
    onUpdateHouseholds(currentHhs);
    setIsProcessingImport(false);

    const successCount = results.filter(r => r.success).length;
    if (successCount > 0) {
      showNotification('success', `Đã tổng hợp thành công ${successCount}/${importedFiles.length} file địa bàn vào bộ nhớ máy!`);
    } else {
      showNotification('error', 'Không thể nạp dữ liệu từ các file đã chọn.');
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-2xl w-full overflow-hidden text-xs flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-sky-800 text-white p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-700/80 rounded-lg">
              <FileJson className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm tracking-wide">
                {isAdmin ? 'TRAO ĐỔI & TỔNG HỢP DỮ LIỆU ĐỊA BÀN (JSON)' : 'QUẢN LÝ DỮ LIỆU ĐỊA BÀN - ĐIỀU TRA VIÊN'}
              </h3>
              <p className="text-[11px] text-sky-200">
                {isAdmin 
                  ? 'Xuất dữ liệu bảng kê cho từng ĐTV hoặc nạp file JSON từ ĐTV gửi về để tổng hợp'
                  : 'Nạp file địa bàn từ Admin để làm việc hoặc xuất dữ liệu mới hoàn thành để gửi Admin'
                }
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-sky-700 rounded transition-colors text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-100 font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-sky-700 bg-white text-sky-900 font-extrabold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Download className="w-4 h-4 text-sky-700" />
            <span>{isAdmin ? '1. Xuất Data Bảng Kê Cho ĐTV' : '1. Xuất Data Mới Làm Gửi Admin'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-2.5 px-4 flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-emerald-700 bg-white text-emerald-900 font-extrabold shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Upload className="w-4 h-4 text-emerald-700" />
            <span>{isAdmin ? '2. Tổng Hợp Data (Từ ĐTV Gửi Về)' : '2. Nhập Data Địa Bàn (Từ Admin Gửi)'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4 bg-slate-50">

          {/* TAB 1: XUẤT DATA */}
          {activeTab === 'export' && (
            <div className="flex flex-col gap-3.5">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-slate-700">
                <div className="font-bold text-sky-900 mb-1 flex items-center gap-1.5">
                  <Database className="w-4 h-4 text-sky-700" />
                  <span>Quy ước đặt tên file ID địa bàn chuẩn:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  File xuất ra sẽ tự động đặt tên theo cấu trúc <strong className="text-sky-800">[Mã xã]_[Mã địa bàn].json</strong> (ví dụ: <code className="bg-white px-1.5 py-0.5 rounded border border-sky-300 font-mono text-sky-900">11992_001.json</code>).
                  Dữ liệu được lưu trữ trực tiếp trên file, giúp thao tác độc lập, mượt mà và không giới hạn lưu lượng mạng.
                </p>
              </div>

              {/* Lựa chọn ĐTV (Dành cho Admin) */}
              {isAdmin && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-sky-700" />
                    <span>Chọn Điều tra viên cần xuất dữ liệu:</span>
                  </label>
                  <select
                    value={selectedSurveyorId}
                    onChange={e => setSelectedSurveyorId(e.target.value)}
                    className="border border-slate-300 rounded p-2 bg-white font-bold text-slate-800 focus:outline-sky-600"
                  >
                    <option value="">-- Tất cả Điều tra viên --</option>
                    {surveyors.filter(s => s.role === 'SURVEYOR').map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.code} - {s.username}) - Phụ trách: {(s.assignedAreas || []).length} địa bàn
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Lựa chọn Địa bàn cụ thể */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-700" />
                    <span>Lọc theo Xã / Phường:</span>
                  </label>
                  <select
                    value={selectedCommuneId}
                    onChange={e => {
                      setSelectedCommuneId(e.target.value);
                      setSelectedAreaId('ALL');
                    }}
                    className="border border-slate-300 rounded p-2 bg-white font-semibold text-slate-800 focus:outline-sky-600"
                  >
                    <option value="ALL">-- Toàn bộ Xã / Phường --</option>
                    {communes.map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.communeCode}] {c.communeName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-sky-700" />
                    <span>Chọn Địa bàn xuất file:</span>
                  </label>
                  <select
                    value={selectedAreaId}
                    onChange={e => setSelectedAreaId(e.target.value)}
                    className="border border-slate-300 rounded p-2 bg-white font-semibold text-slate-800 focus:outline-sky-600"
                  >
                    <option value="ALL">-- Toàn bộ địa bàn khả dụng ({availableAreas.length} địa bàn) --</option>
                    {availableAreas.map(a => (
                      <option key={a.id} value={a.id}>
                        Địa bàn [{a.code}] - {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Tùy chọn: Chỉ xuất những dữ liệu mới làm hoặc mới sửa */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="chkModifiedOnly"
                  checked={modifiedOnly}
                  onChange={e => setModifiedOnly(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-sky-600 cursor-pointer"
                />
                <label htmlFor="chkModifiedOnly" className="cursor-pointer">
                  <strong className="text-amber-900 block text-xs">
                    Chỉ xuất những dữ liệu hộ mới làm hoặc mới sửa
                  </strong>
                  <span className="text-[11px] text-amber-800 block mt-0.5">
                    (Khuyến nghị cho ĐTV: Hệ thống chỉ trích xuất những hộ đã nhập tin, đã có kết quả thu nhập hoặc có sửa đổi để gửi Admin tổng hợp, giúp file gọn nhẹ và tối ưu tốc độ).
                  </span>
                </label>
              </div>

              {/* Preview số lượng */}
              <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200">
                <span>Số địa bàn sẽ xuất: <strong>{selectedAreaId === 'ALL' ? availableAreas.length : 1}</strong> địa bàn. </span>
                {modifiedOnly && <span className="text-amber-700 font-bold ml-1">(Chỉ lọc các hộ đã điều tra/chỉnh sửa).</span>}
              </div>

              {/* Nút hành động */}
              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={isExporting || availableAreas.length === 0}
                className="w-full py-2.5 bg-sky-700 hover:bg-sky-600 disabled:bg-slate-300 text-white rounded-lg font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>
                  {isAdmin ? 'TẢI FILE JSON BẢNG KÊ ĐỊA BÀN ĐỂ GỬI ĐTV' : 'TẢI FILE DATA ĐỊA BÀN HOÀN THÀNH ĐỂ GỬI ADMIN'}
                </span>
              </button>
            </div>
          )}

          {/* TAB 2: NHẬP / TỔNG HỢP DATA */}
          {activeTab === 'import' && (
            <div className="flex flex-col gap-3.5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-slate-700">
                <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                  <Upload className="w-4 h-4 text-emerald-700" />
                  <span>
                    {isAdmin ? 'Tổng hợp dữ liệu từ các file do ĐTV gửi về:' : 'Nạp dữ liệu địa bàn do Admin gửi:'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {isAdmin 
                    ? 'Bạn có thể chọn 1 hoặc nhiều file JSON có tên [MãXã]_[MãĐB].json do các Điều tra viên gửi. Hệ thống sẽ tự động cập nhật kết quả khảo sát của từng hộ vào cơ sở dữ liệu tổng hợp.'
                    : 'Chọn file JSON do Quản trị viên gửi cho bạn để nạp danh sách hộ và địa bàn vào máy bắt đầu điều tra.'
                  }
                </p>
              </div>

              {/* File Input */}
              <div className="border-2 border-dashed border-emerald-300 bg-white rounded-xl p-5 text-center flex flex-col items-center justify-center gap-2">
                <FileJson className="w-8 h-8 text-emerald-600" />
                <span className="font-bold text-slate-700 text-xs">
                  {importedFiles.length > 0 
                    ? `Đã chọn ${importedFiles.length} file JSON sẵn sàng tổng hợp` 
                    : 'Bấm vào đây để chọn file (.json) địa bàn'
                  }
                </span>
                <label className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold cursor-pointer text-xs flex items-center gap-1.5 shadow-xs transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Chọn file JSON</span>
                  <input
                    type="file"
                    accept=".json"
                    multiple={isAdmin}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Danh sách file đã chọn */}
              {importedFiles.length > 0 && (
                <div className="bg-white rounded border border-slate-200 p-2.5 max-h-40 overflow-y-auto">
                  <div className="font-bold text-slate-800 mb-1.5 text-xs">Danh sách file đã chọn ({importedFiles.length} file):</div>
                  <div className="flex flex-col gap-1">
                    {importedFiles.map((f, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                        <span className="font-mono text-sky-800 font-bold">{f.file.name}</span>
                        <span className="text-slate-500">{(f.file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Kết quả sau khi nạp */}
              {importResults.length > 0 && (
                <div className="bg-white rounded border border-emerald-200 p-2.5 max-h-44 overflow-y-auto flex flex-col gap-1.5">
                  <div className="font-bold text-emerald-900 text-xs">Kết quả tổng hợp dữ liệu:</div>
                  {importResults.map((res, idx) => (
                    <div 
                      key={idx} 
                      className={`p-2 rounded border text-[11px] flex items-center justify-between ${
                        res.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                      }`}
                    >
                      <div>
                        <strong className="block font-mono">{res.fileName}</strong>
                        <span>{res.message}</span>
                      </div>
                      {res.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Nút hành động Import */}
              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={isProcessingImport || importedFiles.length === 0}
                className="w-full py-2.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 text-white rounded-lg font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {isProcessingImport ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                <span>
                  {isAdmin ? 'TIẾN HÀNH TỔNG HỢP VÀO CƠ SỞ DỮ LIỆU' : 'NẠP DỮ LIỆU ĐỊA BÀN VÀO MÁY'}
                </span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Dữ liệu được lưu trữ trực tiếp trên thiết bị (Local Storage), siêu tốc độ và bảo mật.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded cursor-pointer transition-colors shadow-2xs"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}
