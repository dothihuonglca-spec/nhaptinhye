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
import { Department, Surveyor } from '../types/user';
import { 
  createAreaJson,
  createSurveyWorkPackage,
  parseSurveyWorkPackage,
  isAreaAssigned,
  SurveyWorkPackage
} from '../utils/areaDataTransfer';

interface AreaDataTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: Surveyor;
  surveyors: Surveyor[];
  departments: Department[];
  communes: Commune[];
  areas: SurveyArea[];
  households: Household[];
  onApplyWorkPackage: (workPackage: SurveyWorkPackage) => Promise<{
    updatedCount: number;
    newCount: number;
    areaCount: number;
    progressSynced: boolean;
  }>;
  showNotification: (type: 'success' | 'error', msg: string) => void;
  initialMode?: 'export' | 'import';
}

export default function AreaDataTransferModal({
  isOpen,
  onClose,
  currentUser,
  surveyors,
  departments,
  communes,
  areas,
  households,
  onApplyWorkPackage,
  showNotification,
  initialMode = 'export'
}: AreaDataTransferModalProps) {
  const canManageData = currentUser.role !== 'SURVEYOR';
  const canSelectSurveyors = currentUser.role !== 'SURVEYOR';
  const [activeTab, setActiveTab] = useState<'export' | 'import'>(initialMode);
  
  // Export State
  const [selectedSurveyorId, setSelectedSurveyorId] = useState<string>(
    canSelectSurveyors ? '' : currentUser.id
  );
  const [selectedCommuneId, setSelectedCommuneId] = useState<string>('ALL');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState(false);

  // Import State
  const [importedFiles, setImportedFiles] = useState<{ file: File; text: string }[]>([]);
  const [importResults, setImportResults] = useState<{
    fileName: string;
    updatedCount: number;
    newCount: number;
    areaCount: number;
    success: boolean;
    message: string;
  }[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  if (!isOpen) return null;

  const getAreasForSurveyor = (surveyor: Surveyor): SurveyArea[] => {
    const directAssignedAreaIds = new Set(
      households
        .filter(h => h.assignedSurveyorId === surveyor.id)
        .flatMap(h => areas
          .filter(area =>
            area.id === h.areaId ||
            (area.code === h.areaCode && (
              area.communeId === h.communeId ||
              area.communeCode === h.communeCode
            ))
          )
          .map(area => area.id)
        )
    );
    return areas.filter(area =>
      isAreaAssigned(area, surveyor.assignedAreas || []) ||
      directAssignedAreaIds.has(area.id)
    );
  };

  const supervisorDepartment = departments.find(d =>
    d.id === currentUser.departmentId || d.name === currentUser.department
  );
  const supervisorAreaKeys = currentUser.assignedAreas || [];
  const departmentAreaKeys = supervisorDepartment?.assignedAreaCodes || [];
  const supervisorCommuneKeys = currentUser.assignedCommunes || [];
  const hasSupervisorAreaScope = supervisorAreaKeys.length > 0 && !supervisorAreaKeys.includes('ALL');
  const hasDepartmentAreaScope = departmentAreaKeys.length > 0 && !departmentAreaKeys.includes('ALL');
  const hasSupervisorCommuneScope = supervisorCommuneKeys.length > 0 && !supervisorCommuneKeys.includes('ALL');
  const hasSupervisorScope = hasSupervisorAreaScope || hasDepartmentAreaScope || hasSupervisorCommuneScope;

  const supervisorAllowedAreas = currentUser.role !== 'SUPERVISOR' || !hasSupervisorScope
    ? areas
    : areas.filter(area => {
      const areaCommune = communes.find(c =>
        c.id === area.communeId || c.communeCode === area.communeCode
      );
      const matchesCommune = hasSupervisorCommuneScope && (
        supervisorCommuneKeys.includes(area.communeId) ||
        Boolean(area.communeCode && supervisorCommuneKeys.includes(area.communeCode)) ||
        Boolean(areaCommune && supervisorCommuneKeys.includes(areaCommune.id))
      );
      return matchesCommune ||
        (hasSupervisorAreaScope && isAreaAssigned(area, supervisorAreaKeys)) ||
        (hasDepartmentAreaScope && isAreaAssigned(area, departmentAreaKeys));
    });

  const permittedAreas = currentUser.role === 'SUPERVISOR'
    ? supervisorAllowedAreas
    : currentUser.role === 'MANAGER'
      ? areas.filter(area => isAreaAssigned(area, currentUser.assignedAreas || []))
      : areas;
  const eligibleSurveyors = currentUser.role === 'SURVEYOR'
    ? [currentUser]
    : surveyors.filter(s =>
      s.role === 'SURVEYOR' &&
      getAreasForSurveyor(s).some(area =>
        permittedAreas.some(allowed => allowed.id === area.id)
      )
    );
  const selectedSurveyors = !canSelectSurveyors
    ? [currentUser]
    : selectedSurveyorId
      ? eligibleSurveyors.filter(s => s.id === selectedSurveyorId)
      : eligibleSurveyors;

  const targetAreas = currentUser.role === 'ADMIN'
    ? (selectedSurveyorId
      ? selectedSurveyors.flatMap(getAreasForSurveyor)
      : areas)
    : canSelectSurveyors
      ? selectedSurveyors.flatMap(getAreasForSurveyor)
      : getAreasForSurveyor(currentUser);

  const communeFilteredAreas = targetAreas.filter(area => {
    if (selectedCommuneId === 'ALL') return true;
    const selectedCommune = communes.find(c =>
      c.id === selectedCommuneId || c.communeCode === selectedCommuneId
    );
    return area.communeId === selectedCommuneId ||
      Boolean(selectedCommune && area.communeCode === selectedCommune.communeCode);
  });
  const availableAreas = Array.from(
    new Map(communeFilteredAreas.map(area => [area.id, area])).values()
  ).filter(area =>
    permittedAreas.some(allowed => allowed.id === area.id)
  );

  const handleExecuteExport = async () => {
    const selectedAreaList = selectedAreaId === 'ALL'
      ? availableAreas
      : availableAreas.filter(a => a.id === selectedAreaId);
    if (selectedAreaList.length === 0 || selectedSurveyors.length === 0) {
      showNotification('error', 'Không tìm thấy ĐTV hoặc địa bàn được phân quyền để xuất.');
      return;
    }

    setIsExporting(true);
    try {
      const entries = selectedSurveyors.flatMap(surveyor =>
        getAreasForSurveyor(surveyor)
          .filter(area =>
            selectedAreaList.some(selected => selected.id === area.id) &&
            permittedAreas.some(allowed => allowed.id === area.id)
          )
          .map(area => {
            const commune = communes.find(c =>
              c.id === area.communeId || c.communeCode === area.communeCode
            );
            if (!commune) {
              throw new Error(`Không tìm thấy thông tin xã của địa bàn ${area.code} (${area.name}).`);
            }
            const areaJson = createAreaJson(
              area,
              households,
              communes,
              currentUser,
              false,
              surveyor
            );
            const payload = JSON.parse(areaJson.content) as { households: Household[] };
            return {
              surveyorId: surveyor.id,
              surveyorName: surveyor.name,
              area,
              commune,
              households: payload.households.map(household => ({
                ...household,
                assignedSurveyorId: surveyor.id,
                assignedSurveyorName: surveyor.name
              }))
            };
          })
      );
      if (entries.length === 0) {
        showNotification('error', 'Không có địa bàn nào trong phạm vi phân quyền để xuất.');
        return;
      }

      const assignedSurveyors = selectedSurveyors.filter(surveyor =>
        entries.some(entry => entry.surveyorId === surveyor.id)
      );
      const workPackage = createSurveyWorkPackage(
        currentUser.role === 'SURVEYOR' ? 'RESULTS' : 'ASSIGNMENT',
        currentUser,
        entries,
        assignedSurveyors
      );
      const blob = new Blob([JSON.stringify(workPackage, null, 2)], {
        type: 'application/json;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentUser.role === 'SURVEYOR' ? 'Ket_Qua_DTV' : 'Phan_Cong_DTV'}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      const householdCount = entries.reduce((total, entry) => total + entry.households.length, 0);
      showNotification('success', `Đã xuất 1 file JSON gồm ${entries.length} địa bàn và ${householdCount} hộ.`);
      onClose();
    } catch (err) {
      showNotification('error', `Lỗi khi xuất file JSON: ${err instanceof Error ? err.message : String(err)}`);
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
  const handleExecuteImport = async () => {
    if (importedFiles.length === 0) {
      showNotification('error', 'Vui lòng chọn ít nhất 1 file JSON để nạp.');
      return;
    }

    setIsProcessingImport(true);
    const results: typeof importResults = [];

    try {
      for (const { file, text } of importedFiles) {
        const workPackage = parseSurveyWorkPackage(text);
        const expectedPurpose = currentUser.role === 'SURVEYOR' ? 'ASSIGNMENT' : 'RESULTS';
        if (workPackage.purpose !== expectedPurpose) {
          throw new Error(
            currentUser.role === 'SURVEYOR'
              ? 'Điều tra viên chỉ nhập được gói phân công do Admin xuất.'
              : 'Tài khoản quản lý chỉ nhập được gói kết quả do ĐTV xuất.'
          );
        }
        const counts = await onApplyWorkPackage(workPackage);
        results.push({
          fileName: file.name,
          updatedCount: counts.updatedCount,
          newCount: counts.newCount,
          areaCount: counts.areaCount,
          success: counts.progressSynced,
          message: `Đã cập nhật ${counts.updatedCount} hộ, thêm ${counts.newCount} hộ từ ${counts.areaCount} địa bàn.` +
            (counts.progressSynced ? '' : ' Dữ liệu đã lưu cục bộ nhưng chưa đồng bộ số đếm tiến độ lên Firebase.')
        });
      }
      setImportResults(results);
      const failedProgressSync = results.some(result => !result.success);
      showNotification(
        failedProgressSync ? 'error' : 'success',
        failedProgressSync
          ? `Đã lưu gói JSON trên máy này; không đồng bộ được tiến độ Firebase cho ${results.filter(result => !result.success).length} gói.`
          : `Đã nhập thành công ${results.length} gói JSON trên máy này.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setImportResults([{
        fileName: importedFiles[0]?.file.name || 'Gói JSON',
        updatedCount: 0,
        newCount: 0,
        areaCount: 0,
        success: false,
        message
      }]);
      showNotification('error', `Không thể nhập gói JSON: ${message}`);
    } finally {
      setIsProcessingImport(false);
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
                {canManageData ? 'GIAO NHẬN DỮ LIỆU ĐỊA BÀN (JSON)' : 'DỮ LIỆU ĐỊA BÀN - ĐIỀU TRA VIÊN'}
              </h3>
              <p className="text-[11px] text-sky-200">
                {canManageData
                  ? 'Xuất gói phân công cho ĐTV hoặc nhập gói kết quả ĐTV gửi về'
                  : 'Nhập gói phân công từ Admin hoặc xuất kết quả gửi Admin'
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
            <span>{canManageData ? '1. Xuất gói phân công' : '1. Xuất kết quả gửi Admin'}</span>
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
            <span>{canManageData ? '2. Nhập kết quả từ ĐTV' : '2. Nhập gói phân công'}</span>
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
                  <span>Một định dạng thống nhất cho giao và nhận dữ liệu:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Hệ thống dùng <strong className="text-sky-800">một file JSON</strong> cho toàn bộ gói phân công hoặc kết quả. Gói phân công có bảng kê và quyền theo từng ĐTV; gói kết quả chỉ cập nhật phiếu của các hộ đã có trong danh sách.
                </p>
              </div>

              {/* Lựa chọn ĐTV (Dành cho Admin) */}
              {canSelectSurveyors && (
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <UserCheck className="w-3.5 h-3.5 text-sky-700" />
                    <span>Chọn Điều tra viên cần xuất dữ liệu:</span>
                  </label>
                  <select
                    value={selectedSurveyorId}
                    onChange={e => {
                      setSelectedSurveyorId(e.target.value);
                      setSelectedAreaId('ALL');
                    }}
                    className="border border-slate-300 rounded p-2 bg-white font-bold text-slate-800 focus:outline-sky-600"
                  >
                    <option value="">-- Tất cả Điều tra viên --</option>
                    {eligibleSurveyors.map(s => (
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

              {/* Preview số lượng */}
              <div className="text-[11px] text-slate-500 bg-white p-2.5 rounded border border-slate-200">
                Phạm vi gói: <strong>{selectedSurveyors.length} ĐTV</strong>,{' '}
                <strong>{selectedAreaId === 'ALL' ? availableAreas.length : 1} địa bàn</strong>.
              </div>

              {/* Nút hành động */}
              <button
                type="button"
                onClick={handleExecuteExport}
                disabled={isExporting || availableAreas.length === 0 || selectedSurveyors.length === 0}
                className="w-full py-2.5 bg-sky-700 hover:bg-sky-600 disabled:bg-slate-300 text-white rounded-lg font-extrabold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
              >
                {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>
                  {canManageData ? 'TẢI 1 FILE JSON GÓI PHÂN CÔNG' : 'TẢI 1 FILE JSON KẾT QUẢ CỦA TÔI'}
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
                    {canManageData ? 'Nhập gói kết quả JSON do ĐTV gửi:' : 'Nhập gói phân công JSON do Admin gửi:'}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  {canManageData
                    ? 'Chọn file kết quả do ĐTV xuất. Ứng dụng chỉ cập nhật nội dung phiếu và trạng thái, giữ nguyên bảng kê/phân công gốc trên máy Admin.'
                    : 'Chọn file phân công từ Admin. Ứng dụng chỉ nạp địa bàn dành cho tài khoản đang đăng nhập và lưu dữ liệu trên máy này.'
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
                    multiple={canManageData}
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
                  {canManageData ? 'NHẬP KẾT QUẢ VÀO MÁY ADMIN' : 'NẠP GÓI PHÂN CÔNG VÀO MÁY'}
                </span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            Bảng kê và phiếu lưu trên máy này; Firebase chỉ nhận các số đếm tiến độ.
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
