/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
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
  normalizeSurveyorName,
  SurveyWorkPackage,
  type IncompleteHouseholdInfo
} from '../utils/areaDataTransfer';
import { parseSurveyorEntryBackup } from '../utils/localDataBackup';

function hasJsonRecords(value: unknown): boolean {
  if (Array.isArray(value)) return true;
  if (typeof value !== 'object' || value === null) return false;
  return Object.values(value).every(item =>
    typeof item === 'object' && item !== null && !Array.isArray(item)
  );
}

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
    replacedCount?: number;
    areaCount: number;
    progressSynced: boolean;
    skippedCount?: number;
    partialCount?: number;
    incompleteHouseholds?: IncompleteHouseholdInfo[];
    problems?: string[];
  }>;
  onApplySurveyorBackup: (backup: ReturnType<typeof parseSurveyorEntryBackup>) => Promise<{
    updatedCount: number;
    newCount: number;
    replacedCount?: number;
    areaCount: number;
    progressSynced: boolean;
    skippedCount?: number;
  }>;
  showNotification: (type: 'success' | 'error', msg: string) => void;
  initialMode?: 'export' | 'import';
  /** 'package' = chỉ đọc gói JSON do ĐTV xuất trực tiếp từ ứng dụng; 'auto' = tự nhận nhiều dạng file JSON */
  importKind?: 'auto' | 'package';
  /** Khóa chế độ (ẩn thanh chuyển Xuất/Nhập) khi mở từ tab Xuất nhập dữ liệu */
  lockMode?: boolean;
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
  onApplySurveyorBackup,
  showNotification,
  initialMode = 'export',
  importKind = 'auto',
  lockMode = false
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
  // Hộ chính thức chưa hoàn thành / còn thiếu thông tin và các lỗi theo địa bàn của lần nạp vừa rồi
  const [incompleteList, setIncompleteList] = useState<IncompleteHouseholdInfo[]>([]);
  const [problemList, setProblemList] = useState<string[]>([]);
  const [isProcessingImport, setIsProcessingImport] = useState(false);

  const areasBySurveyorId = useMemo(() => {
    const areaById = new Map(areas.map(area => [area.id, area]));
    const areaByCommuneAndCode = new Map<string, SurveyArea>();
    areas.forEach(area => {
      areaByCommuneAndCode.set(`${area.communeId}_${area.code}`, area);
      if (area.communeCode) {
        areaByCommuneAndCode.set(`${area.communeCode}_${area.code}`, area);
      }
    });
    const eligibleSurveyorIds = new Set(
      surveyors.filter(surveyor => surveyor.role === 'SURVEYOR').map(surveyor => surveyor.id)
    );
    const surveyorNameCounts = new Map<string, number>();
    surveyors.filter(surveyor => surveyor.role === 'SURVEYOR').forEach(surveyor => {
      const normalizedName = normalizeSurveyorName(surveyor.name);
      surveyorNameCounts.set(normalizedName, (surveyorNameCounts.get(normalizedName) || 0) + 1);
    });
    const uniqueSurveyorIdByName = new Map<string, string>();
    surveyors.filter(surveyor => surveyor.role === 'SURVEYOR').forEach(surveyor => {
      const normalizedName = normalizeSurveyorName(surveyor.name);
      if (surveyorNameCounts.get(normalizedName) === 1) {
        uniqueSurveyorIdByName.set(normalizedName, surveyor.id);
      }
    });
    const directAreaIdsBySurveyor = new Map<string, Set<string>>();
    households.forEach(household => {
      const ids = new Set<string>();
      if (household.assignedSurveyorId && eligibleSurveyorIds.has(household.assignedSurveyorId)) {
        ids.add(household.assignedSurveyorId);
      }
      if (household.assignedSurveyorName) {
        const normalizedName = normalizeSurveyorName(household.assignedSurveyorName);
        const matchingSurveyorId = uniqueSurveyorIdByName.get(normalizedName);
        if (matchingSurveyorId) ids.add(matchingSurveyorId);
      }
      if (ids.size === 0) return;

      const area = areaById.get(household.areaId) ||
        areaByCommuneAndCode.get(`${household.communeId}_${household.areaCode}`) ||
        areaByCommuneAndCode.get(`${household.communeCode}_${household.areaCode}`);
      if (!area) return;
      ids.forEach(id => {
        const directAreaIds = directAreaIdsBySurveyor.get(id) || new Set<string>();
        directAreaIds.add(area.id);
        directAreaIdsBySurveyor.set(id, directAreaIds);
      });
    });

    return new Map(surveyors.filter(surveyor => surveyor.role === 'SURVEYOR').map(surveyor => {
      const departmentAreaKeys = departments.find(item =>
        item.id === surveyor.departmentId || item.name === surveyor.department
      )?.assignedAreaCodes || [];
      const assignedCommunes = new Set(surveyor.assignedCommunes || []);
      const directAreaIds = directAreaIdsBySurveyor.get(surveyor.id) || new Set<string>();
      const assignedAreas = areas.filter(area =>
        isAreaAssigned(area, [...(surveyor.assignedAreas || []), ...departmentAreaKeys]) ||
        directAreaIds.has(area.id) ||
        assignedCommunes.has(area.communeId) ||
        Boolean(area.communeCode && assignedCommunes.has(area.communeCode))
      );
      return [surveyor.id, assignedAreas] as const;
    }));
  }, [areas, departments, households, surveyors]);

  if (!isOpen) return null;

  const getAreasForSurveyor = (surveyor: Surveyor): SurveyArea[] => {
    return areasBySurveyorId.get(surveyor.id) || [];
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
      (currentUser.role === 'ADMIN' || getAreasForSurveyor(s).some(area =>
        permittedAreas.some(allowed => allowed.id === area.id)
      ))
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
      const selectedSurveyor = selectedSurveyors[0];
      const assignedCount = selectedSurveyor
        ? getAreasForSurveyor(selectedSurveyor).filter(area =>
          permittedAreas.some(allowed => allowed.id === area.id)
        ).length
        : 0;
      showNotification(
        'error',
        selectedSurveyor && assignedCount === 0
          ? `ĐTV ${selectedSurveyor.name} chưa được phân công địa bàn. Đổi vai trò sang ĐTV chưa tự cấp địa bàn; hãy gán địa bàn cho tài khoản trước khi xuất.`
          : 'Không tìm thấy địa bàn trong phạm vi được phép xuất.'
      );
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
            if (payload.households.length === 0) {
              throw new Error(
                `Địa bàn ${area.code} (${area.name}) không có hộ trong file xuất. ` +
                'Hãy kiểm tra phân công hoặc khôi phục đúng bảng kê trước khi gửi gói cho ĐTV.'
              );
            }
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
    setIncompleteList([]);
    setProblemList([]);
  };

  // Tải danh sách hộ chưa hoàn thành / thiếu thông tin ra file CSV (mở được bằng Excel)
  const handleDownloadIncompleteList = () => {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Xã/Phường', 'Địa bàn', 'STT mẫu', 'Chủ hộ', 'ĐTV', 'Tình trạng', 'Nội dung còn thiếu'];
    const lines = [header.map(esc).join(',')];
    incompleteList.forEach(h => {
      lines.push([h.communeName, h.areaCode, h.sttMau, h.householdHead, h.surveyorName, h.status, h.reasons.join('; ')].map(esc).join(','));
    });
    problemList.forEach(p => lines.push(['', '', '', '', '', 'Không nạp được', p].map(esc).join(',')));
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Ho_chua_hoan_thanh_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Gom danh sách hộ chưa hoàn thành theo địa bàn để hiển thị
  const incompleteByArea = useMemo(() => {
    const map = new Map<string, IncompleteHouseholdInfo[]>();
    incompleteList.forEach(h => {
      const key = `${h.communeName} - ĐB ${h.areaCode} (ĐTV: ${h.surveyorName})`;
      const list = map.get(key) || [];
      list.push(h);
      map.set(key, list);
    });
    return Array.from(map.entries());
  }, [incompleteList]);

  // Thực hiện tổng hợp / nạp các file JSON
  const handleExecuteImport = async () => {
    if (importedFiles.length === 0) {
      showNotification('error', 'Vui lòng chọn ít nhất 1 file JSON để nạp.');
      return;
    }

    setIsProcessingImport(true);
    const results: typeof importResults = [];
    const allIncomplete: IncompleteHouseholdInfo[] = [];
    const allProblems: string[] = [];

    try {
      for (const { file, text } of importedFiles) {
        try {
          const parsed: unknown = JSON.parse(text);
          const backupObject = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? parsed as Record<string, unknown>
            : undefined;
          const indexedDbEntries = backupObject?.thongke_entries_v2 &&
            typeof backupObject.thongke_entries_v2 === 'object' &&
            !Array.isArray(backupObject.thongke_entries_v2)
            ? (backupObject.thongke_entries_v2 as Record<string, unknown>).entries
            : undefined;
          const isSurveyorBackup = importKind === 'auto' && (Array.isArray(parsed) ||
            (backupObject?.type !== 'SURVEY_WORK_PACKAGE' && Boolean(
              backupObject?.format === 'tnh-entries-backup' ||
              hasJsonRecords(indexedDbEntries) ||
              ['entries', 'households', 'records', 'results', 'surveys', 'areas', 'surveyAreas', 'rosters']
                .some(key => hasJsonRecords(backupObject?.[key])) ||
              (typeof backupObject?.data === 'object' && backupObject.data !== null &&
                ['entries', 'households', 'records', 'results', 'surveys', 'areas', 'surveyAreas', 'rosters']
                  .some(key => hasJsonRecords((backupObject.data as Record<string, unknown>)[key])))
            )));
          if (currentUser.role === 'ADMIN' && isSurveyorBackup) {
            const backup = parseSurveyorEntryBackup(parsed);
            const counts = await onApplySurveyorBackup(backup);
            results.push({
              fileName: file.name,
              updatedCount: counts.updatedCount,
              newCount: counts.newCount,
              areaCount: counts.areaCount,
              success: counts.progressSynced,
              message: `Đã cập nhật ${counts.updatedCount} phiếu hoàn thành từ ${counts.areaCount} địa bàn.` +
                (counts.newCount ? ` Thêm ${counts.newCount} hộ thay thế mới.` : '') +
                (counts.replacedCount ? ` Đồng bộ ${counts.replacedCount} thay đổi hộ thay thế.` : '') +
                (counts.skippedCount ? ` Bỏ qua ${counts.skippedCount} phiếu chưa đạt điều kiện hoặc không khớp.` : '') +
                (counts.progressSynced ? '' : ' Dữ liệu đã lưu cục bộ nhưng chưa đồng bộ số đếm tiến độ lên Firebase.')
            });
            continue;
          }
          let workPackage: SurveyWorkPackage;
          try {
            workPackage = parseSurveyWorkPackage(text);
          } catch (parseErr) {
            const reason = parseErr instanceof Error ? parseErr.message : String(parseErr);
            throw new Error(
              importKind === 'package'
                ? `${reason} Nếu đây là file backup hoặc file JSON dạng khác, hãy dùng nút "Đọc file JSON nhiều định dạng".`
                : reason
            );
          }
          const expectedPurpose = currentUser.role === 'SURVEYOR' ? 'ASSIGNMENT' : 'RESULTS';
          if (workPackage.purpose !== expectedPurpose) {
            throw new Error(
              currentUser.role === 'SURVEYOR'
                ? 'Điều tra viên chỉ nhập được gói phân công do Admin xuất.'
                : 'Tài khoản quản lý chỉ nhập được gói kết quả do ĐTV xuất.'
            );
          }
          const counts = await onApplyWorkPackage(workPackage);
          const replacedCount = counts.replacedCount || 0;
          const partialCount = counts.partialCount || 0;
          if (counts.incompleteHouseholds) allIncomplete.push(...counts.incompleteHouseholds);
          if (counts.problems) allProblems.push(...counts.problems.map(p => `${file.name}: ${p}`));
          const hasImportedRecords = counts.updatedCount + counts.newCount + replacedCount + partialCount > 0;
          results.push({
            fileName: file.name,
            updatedCount: counts.updatedCount,
            newCount: counts.newCount,
            areaCount: counts.areaCount,
            success: counts.progressSynced && hasImportedRecords,
            message: hasImportedRecords
              ? `Đã cập nhật ${counts.updatedCount} hộ hoàn thành, thêm ${counts.newCount} hộ từ ${counts.areaCount} địa bàn.` +
              (partialCount ? ` Nạp thêm ${partialCount} hộ đang nhập dở.` : '') +
              (counts.incompleteHouseholds?.length ? ` Có ${counts.incompleteHouseholds.length} hộ chưa hoàn thành hoặc còn thiếu thông tin (xem danh sách bên dưới).` : '') +
              (counts.problems?.length ? ` Có ${counts.problems.length} hộ/địa bàn không nạp được (xem bên dưới).` : '') +
              (replacedCount ? ` Đồng bộ ${replacedCount} thay đổi hộ thay thế (hộ dự phòng vào mẫu / hộ mẫu cũ đã thay).` : '') +
              (counts.skippedCount ? ` Bỏ qua ${counts.skippedCount} phiếu chưa hoàn thành hoặc thiếu nội dung.` : '') +
              (counts.progressSynced ? '' : ' Dữ liệu đã lưu cục bộ nhưng chưa đồng bộ số đếm tiến độ lên Firebase.')
              : 'Không có phiếu hoàn thành đủ nội dung để cập nhật.'
          });
        } catch (fileErr) {
          // Một file lỗi không làm mất kết quả của các file đã nạp trước đó
          results.push({
            fileName: file.name,
            updatedCount: 0,
            newCount: 0,
            areaCount: 0,
            success: false,
            message: fileErr instanceof Error ? fileErr.message : String(fileErr)
          });
        }
      }
      setImportResults(results);
      setIncompleteList(allIncomplete);
      setProblemList(allProblems);
      const failed = results.filter(result => !result.success);
      showNotification(
        failed.length > 0 ? 'error' : 'success',
        failed.length > 0
          ? `${results.length - failed.length}/${results.length} file nạp thành công; ${failed.length} file lỗi hoặc chưa đồng bộ Firebase (xem chi tiết trong hộp thoại).`
          : `Đã nhập thành công ${results.length} file JSON trên máy này.`
      );
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
                {activeTab === 'import' && lockMode && canManageData
                  ? (importKind === 'package' ? 'ĐỌC TRỰC TIẾP JSON ĐTV XUẤT RA' : 'ĐỌC FILE JSON NHIỀU ĐỊNH DẠNG')
                  : canManageData ? 'GIAO NHẬN DỮ LIỆU ĐỊA BÀN (JSON)' : 'DỮ LIỆU ĐỊA BÀN - ĐIỀU TRA VIÊN'}
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
        {!lockMode && <div className="flex border-b border-slate-200 bg-slate-100 font-bold">
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
        </div>}

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
                        {s.name} ({s.code} - {s.username}) - Phụ trách: {getAreasForSurveyor(s).length} địa bàn
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {canSelectSurveyors && selectedSurveyorId &&
                selectedSurveyors.length > 0 &&
                getAreasForSurveyor(selectedSurveyors[0]).length === 0 && (
                  <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">
                    Tài khoản này đã có vai trò ĐTV nhưng chưa có địa bàn được giao. Đổi vai trò không tự tạo phân quyền địa bàn; hãy vào <strong>Quản lý cán bộ</strong> để gán địa bàn trước khi xuất.
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
                    ? (importKind === 'package'
                      ? 'Chỉ nhận file gói kết quả do ĐTV bấm "Xuất kết quả gửi Admin" trong ứng dụng (định dạng SURVEY_WORK_PACKAGE). Có thể chọn nhiều file cùng lúc. Chỉ phiếu hoàn thành đủ nội dung mới được ghép vào bảng kê của Admin.'
                      : 'Tự nhận dạng nhiều kiểu file: backup.json, bản sao lưu phiếu của ĐTV, danh sách hộ/phiếu rời, gói kết quả. Chỉ phiếu có nội dung và trạng thái hoàn thành mới được ghép theo mã hộ, gắn xã/địa bàn/ĐTV từ bảng kê Admin và đồng bộ số đếm lên Firebase.')
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

              {/* Danh sách hộ chưa hoàn thành / còn thiếu thông tin và lỗi theo địa bàn */}
              {(incompleteList.length > 0 || problemList.length > 0) && (
                <div className="bg-amber-50 rounded border border-amber-300 p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-bold text-amber-950 text-xs">
                      {incompleteList.length > 0 && <>Hộ chưa hoàn thành hoặc còn thiếu thông tin: {incompleteList.length} hộ</>}
                      {incompleteList.length > 0 && problemList.length > 0 && ' • '}
                      {problemList.length > 0 && <span className="text-rose-800">Không nạp được: {problemList.length}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadIncompleteList}
                      className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer shrink-0"
                    >
                      Tải danh sách (CSV)
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto flex flex-col gap-2">
                    {incompleteByArea.map(([areaLabel, list]) => (
                      <div key={areaLabel} className="bg-white border border-amber-200 rounded p-1.5">
                        <div className="font-bold text-[11px] text-slate-800">{areaLabel} - {list.length} hộ</div>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {list.map((h, i) => (
                            <li key={`${h.sttMau}-${i}`} className="text-[11px] text-slate-700 leading-snug">
                              <b>STT {h.sttMau}</b> {h.householdHead || '(chưa có tên)'} — <span className="font-semibold text-amber-800">{h.status}</span>: {h.reasons.join('; ')}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                    {problemList.length > 0 && (
                      <div className="bg-rose-50 border border-rose-200 rounded p-1.5">
                        <div className="font-bold text-[11px] text-rose-900">Hộ/địa bàn không nạp được:</div>
                        <ul className="mt-1 flex flex-col gap-0.5">
                          {problemList.map((p, i) => (
                            <li key={i} className="text-[11px] text-rose-900 leading-snug">{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
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
                  {canManageData ? 'CẬP NHẬT PHIẾU HOÀN THÀNH VÀO ADMIN' : 'NẠP GÓI PHÂN CÔNG VÀO MÁY'}
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
