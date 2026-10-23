/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Users, UserPlus, Shield, ShieldCheck, Check, Save, 
  X, Search, UserCheck, RefreshCw,
  Download, Upload, FileSpreadsheet, CheckSquare, Square,
  MapPin, AlertCircle, Trash2, Edit3, KeyRound
} from 'lucide-react';
import { Surveyor, UserRole, Department, ROLE_LABELS } from '../types/user';
import { 
  exportPermissionExcelTemplate, 
  parsePermissionExcelFile, 
  ParsedPermissionResult 
} from '../utils/permissionExcelHelper';
import { OFFICIAL_COMMUNES_CATALOG } from '../data/communesCatalog';

interface SurveyArea {
  id: string;
  communeId: string;
  code: string;
  name: string;
  [key: string]: any;
}

interface Household {
  id: string;
  areaCode: string;
  areaName: string;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  surveyStatus?: string;
  sampleStatus?: string;
  [key: string]: any;
}

interface CommuneItem {
  id: string;
  communeCode: string;
  communeName: string;
  tkcsCode?: string;
  tkcsName?: string;
  [key: string]: any;
}

interface SurveyorManagementProps {
  surveyors: Surveyor[];
  departments: Department[];
  areas: SurveyArea[];
  communes?: CommuneItem[];
  households: Household[];
  currentUser: Surveyor;
  onSaveSurveyor: (surveyor: Surveyor) => Promise<void>;
  onDeleteSurveyor: (id: string) => Promise<void>;
  onSaveDepartment?: (department: Department) => Promise<void>;
  onDeleteDepartment?: (id: string) => Promise<void>;
  onBatchAssignArea: (surveyorId: string, areaCode: string | string[], communeIdsOrCodes?: string[], scopeAreaIds?: string[]) => Promise<void>;
  onUnassignArea?: (surveyorId: string, areaIdOrCode: string) => Promise<void>;
  onBatchImportAssignments?: (assignments: { surveyorId: string; areaIds: string[]; communeIds: string[] }[]) => Promise<void>;
  onBatchAssignDepartmentArea?: (departmentId: string, areaCodes: string[]) => Promise<void>;
  onSelectActiveUser?: (surveyor: Surveyor) => void;
  showNotification: (type: 'success' | 'error', msg: string) => void;
}

export default function SurveyorManagement({
  surveyors,
  departments,
  areas,
  communes = [],
  households,
  currentUser,
  onSaveSurveyor,
  onDeleteSurveyor,
  onBatchAssignArea,
  onBatchImportAssignments,
  showNotification,
}: SurveyorManagementProps) {
  // State phân quyền Split-View 2 cột
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [personSearch, setPersonSearch] = useState<string>('');
  const [personRoleFilter, setPersonRoleFilter] = useState<string>('ALL');
  const [checkedAreaIds, setCheckedAreaIds] = useState<Set<string>>(new Set());

  // Bộ lọc từng nấc
  // Nấc 1: Lọc TKCS -> chỉ hiện các xã thuộc TKCS đó
  const [rightTkcsFilter, setRightTkcsFilter] = useState<string>('ALL');
  // Nấc 2: Cấp Xã / Phường -> chỉ hiện các địa bàn thuộc đúng xã đó
  const [rightCommuneFilter, setRightCommuneFilter] = useState<string>('ALL');
  // Nấc 3: Tìm kiếm mã/tên địa bàn
  const [rightAreaSearch, setRightAreaSearch] = useState<string>('');
  // Checkbox: Chỉ hiện địa bàn chưa giao
  const [rightOnlyUnassigned, setRightOnlyUnassigned] = useState<boolean>(false);

  // Trạng thái thao tác
  const [isSavingPermissions, setIsSavingPermissions] = useState<boolean>(false);
  const [isImportingExcel, setIsImportingExcel] = useState<boolean>(false);
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal thêm/sửa cán bộ nhanh
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSurveyor, setEditingSurveyor] = useState<Surveyor | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('123456');
  const [formRole, setFormRole] = useState<UserRole>('SURVEYOR');
  const [formDeptId, setFormDeptId] = useState<string>(departments[0]?.id || 'pb_01');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [surveyorToDelete, setSurveyorToDelete] = useState<Surveyor | null>(null);

  // 1. Phạm vi xã & địa bàn được phép thao tác (nếu là GSV thì chỉ xem phần được giao)
  const allowedSupervisorCommunes = useMemo(() => {
    if (!currentUser || currentUser.role !== 'SUPERVISOR') return communes;
    if (currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL') && currentUser.assignedCommunes.length > 0) {
      return communes.filter(c => 
        currentUser.assignedCommunes?.includes(c.id) || 
        currentUser.assignedCommunes?.includes(c.communeCode)
      );
    }
    if (currentUser.assignedAreas && !currentUser.assignedAreas.includes('ALL') && currentUser.assignedAreas.length > 0) {
      const commIds = new Set(areas.filter(a => 
        currentUser.assignedAreas?.includes(a.id) || 
        currentUser.assignedAreas?.includes(a.code) || 
        currentUser.assignedAreas?.includes(`${a.communeId}_${a.code}`)
      ).map(a => a.communeId));
      return communes.filter(c => commIds.has(c.id) || commIds.has(c.communeCode));
    }
    return communes;
  }, [communes, areas, currentUser]);

  const allowedSupervisorAreas = useMemo(() => {
    if (!currentUser || currentUser.role !== 'SUPERVISOR') return areas;
    const commIds = new Set(allowedSupervisorCommunes.map(c => c.id));
    const commCodes = new Set(allowedSupervisorCommunes.map(c => c.communeCode));
    return areas.filter(a => 
      commIds.has(a.communeId) || 
      commCodes.has((a as any).communeCode)
    );
  }, [areas, allowedSupervisorCommunes, currentUser]);

  // 2. Tra cứu TKCS
  const getCommuneTkcs = useCallback((c: CommuneItem) => {
    if (c.tkcsCode && c.tkcsName) {
      return { code: c.tkcsCode, name: c.tkcsName };
    }
    const found = OFFICIAL_COMMUNES_CATALOG.find(cat => cat.communeCode === c.communeCode || cat.id === c.id);
    return {
      code: c.tkcsCode || found?.tkcsCode || 'TK001',
      name: c.tkcsName || found?.tkcsName || 'Tổ TKCS Phố Hiến'
    };
  }, []);

  const uniqueTkcsList = useMemo(() => {
    const map = new Map<string, string>();
    allowedSupervisorCommunes.forEach(c => {
      const tk = getCommuneTkcs(c);
      map.set(tk.code, `${tk.code} - ${tk.name}`);
    });
    return Array.from(map.entries()).map(([code, label]) => ({ code, label }));
  }, [allowedSupervisorCommunes, getCommuneTkcs]);

  const communeLookupMap = useMemo(() => {
    const map = new Map<string, CommuneItem>();
    communes.forEach(c => {
      map.set(c.id, c);
      if (c.communeCode) map.set(c.communeCode, c);
    });
    return map;
  }, [communes]);

  // 3. Phân tầng xã theo TKCS: Khi chọn TKCS thì CHỈ hiện các xã thuộc TKCS đó
  const cascadingCommunes = useMemo(() => {
    if (rightTkcsFilter === 'ALL') {
      return allowedSupervisorCommunes;
    }
    return allowedSupervisorCommunes.filter(c => getCommuneTkcs(c).code === rightTkcsFilter);
  }, [rightTkcsFilter, allowedSupervisorCommunes, getCommuneTkcs]);

  // Handler khi đổi TKCS: Tự động reset Xã nếu xã hiện tại không thuộc TKCS mới
  const handleRightTkcsChange = (tkCode: string) => {
    setRightTkcsFilter(tkCode);
    if (tkCode === 'ALL') {
      setRightCommuneFilter('ALL');
    } else {
      const commsInTk = allowedSupervisorCommunes.filter(c => getCommuneTkcs(c).code === tkCode);
      const isMatch = commsInTk.some(c => c.id === rightCommuneFilter || c.communeCode === rightCommuneFilter);
      if (!isMatch) {
        setRightCommuneFilter('ALL');
      }
    }
  };

  // 4. Danh sách Địa bàn: Lọc theo xã thì CHỈ HIỆN ĐỊA BÀN THUỘC ĐÚNG XÃ ĐÓ
  const visibleAreas = useMemo(() => {
    return allowedSupervisorAreas.filter(a => {
      // 1. Lọc theo TKCS
      if (rightTkcsFilter !== 'ALL') {
        const comm = communeLookupMap.get(a.communeId) || allowedSupervisorCommunes.find(c => c.communeCode === (a as any).communeCode || c.id === a.communeId);
        if (!comm || getCommuneTkcs(comm).code !== rightTkcsFilter) return false;
      }

      // 2. Lọc theo Xã / Phường: CHỈ HIỆN ĐỊA BÀN THUỘC ĐÚNG XÃ NÀY
      if (rightCommuneFilter !== 'ALL') {
        const isMatch = a.communeId === rightCommuneFilter || 
          (a as any).communeCode === rightCommuneFilter || 
          communeLookupMap.get(a.communeId)?.id === rightCommuneFilter ||
          communeLookupMap.get(a.communeId)?.communeCode === rightCommuneFilter;
        if (!isMatch) return false;
      }

      // 3. Tìm theo từ khóa (Mã hoặc tên địa bàn, thôn xóm)
      if (rightAreaSearch.trim()) {
        const q = rightAreaSearch.toLowerCase().trim();
        const codeMatch = (a.code || '').toLowerCase().includes(q);
        const nameMatch = (a.name || '').toLowerCase().includes(q);
        const comm = communeLookupMap.get(a.communeId);
        const commMatch = comm && comm.communeName.toLowerCase().includes(q);
        if (!codeMatch && !nameMatch && !commMatch) return false;
      }

      // 4. Chỉ hiển thị địa bàn chưa giao
      if (rightOnlyUnassigned) {
        const isAssigned = surveyors.some(s => 
          (s.assignedAreas || []).includes(a.id) || (s.assignedAreas || []).includes(a.code)
        ) || households.some(h => !!h.assignedSurveyorId && (h.areaId === a.id || h.areaCode === a.code));
        if (isAssigned) return false;
      }

      return true;
    });
  }, [allowedSupervisorAreas, rightTkcsFilter, rightCommuneFilter, rightAreaSearch, rightOnlyUnassigned, communeLookupMap, allowedSupervisorCommunes, getCommuneTkcs, surveyors, households]);

  // 5. Thống kê số hộ mẫu theo địa bàn
  const areaStatsMap = useMemo(() => {
    const map = new Map<string, { total: number; official: number; reserve: number; completed: number }>();
    households.forEach(h => {
      const key = h.areaId || h.areaCode;
      const curr = map.get(key) || { total: 0, official: 0, reserve: 0, completed: 0 };
      curr.total += 1;
      if (h.sampleStatus === 'CHÍNH THỨC' || !h.sampleStatus) curr.official += 1;
      if ((h.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG')) curr.reserve += 1;
      if (h.surveyStatus === 'DA_HOAN_THANH' || h.surveyStatus === 'DA_DUYET') curr.completed += 1;
      map.set(key, curr);
      if (h.areaCode && h.areaCode !== key) {
        map.set(h.areaCode, curr);
      }
    });
    return map;
  }, [households]);

  // 6. Danh sách cán bộ ở cột bên trái
  const filteredPersonnel = useMemo(() => {
    return surveyors.filter(s => {
      if (currentUser.role === 'SUPERVISOR') {
        const myDeptId = (currentUser.departmentId || '').trim().toLowerCase();
        const myDeptName = (currentUser.department || '').trim().toLowerCase();
        const sDeptId = (s.departmentId || '').trim().toLowerCase();
        const sDeptName = (s.department || '').trim().toLowerCase();
        const matchDept = (myDeptId && sDeptId === myDeptId) || 
                          (myDeptName && sDeptName === myDeptName) ||
                          (myDeptId && sDeptId.includes(myDeptId)) ||
                          (myDeptName && sDeptName.includes(myDeptName)) ||
                          (s.id === currentUser.id);
        if (!matchDept) return false;
      }

      if (personRoleFilter !== 'ALL' && s.role !== personRoleFilter) {
        return false;
      }

      if (!personSearch.trim()) return true;
      const q = personSearch.toLowerCase().trim();
      const nameMatch = s.name.toLowerCase().includes(q);
      const codeMatch = s.code.toLowerCase().includes(q);
      const deptMatch = (s.department || '').toLowerCase().includes(q);
      const roleMatch = (ROLE_LABELS[s.role]?.label || s.role).toLowerCase().includes(q);
      return nameMatch || codeMatch || deptMatch || roleMatch;
    });
  }, [surveyors, personSearch, personRoleFilter, currentUser]);

  const selectedPerson = useMemo(() => {
    return surveyors.find(s => s.id === selectedPersonId) || null;
  }, [surveyors, selectedPersonId]);

  // 7. Chọn cán bộ: nạp đúng các địa bàn thực tế người đó đang phụ trách (KHÔNG tự động tích hết)
  const handleSelectPerson = useCallback((s: Surveyor) => {
    setSelectedPersonId(s.id);
    const sAssignedSet = new Set((s.assignedAreas || []).filter(item => item !== '001' && item !== 'ALL'));
    const initialChecked = new Set<string>();

    allowedSupervisorAreas.forEach(a => {
      // Chỉ khớp nếu trùng a.id hoặc trùng tổ hợp xã_mãĐB cụ thể, KHÔNG so sánh a.code đơn lẻ
      const isDirectlyAssigned = sAssignedSet.has(a.id) || 
        sAssignedSet.has(`${a.communeId}_${a.code}`) ||
        (Boolean((a as any).communeCode) && sAssignedSet.has(`${(a as any).communeCode}_${a.code}`));

      const hasAssignedHouseholds = households.some(h => 
        h.assignedSurveyorId === s.id && (
          h.areaId === a.id || 
          (h.areaCode === a.code && (h.communeId === a.communeId || (h as any).communeCode === (a as any).communeCode || h.communeId === (a as any).communeCode))
        )
      );

      if (isDirectlyAssigned || hasAssignedHouseholds) {
        initialChecked.add(a.id);
      }
    });

    setCheckedAreaIds(initialChecked);
  }, [allowedSupervisorAreas, households]);

  // Tự động chọn người đầu tiên nếu chưa chọn ai
  useEffect(() => {
    if (!selectedPersonId && filteredPersonnel.length > 0) {
      handleSelectPerson(filteredPersonnel[0]);
    }
  }, [filteredPersonnel, selectedPersonId, handleSelectPerson]);

  // 8. Thao tác chọn địa bàn
  const handleToggleArea = (areaId: string) => {
    setCheckedAreaIds(prev => {
      const next = new Set(prev);
      if (next.has(areaId)) {
        next.delete(areaId);
      } else {
        next.add(areaId);
      }
      return next;
    });
  };

  const handleCheckAllVisible = () => {
    setCheckedAreaIds(prev => {
      const next = new Set(prev);
      visibleAreas.forEach(a => next.add(a.id));
      return next;
    });
  };

  const handleUncheckAllVisible = () => {
    setCheckedAreaIds(prev => {
      const next = new Set(prev);
      visibleAreas.forEach(a => next.delete(a.id));
      return next;
    });
  };

  // 9. Lưu phân quyền cho cán bộ đang chọn
  const handleSavePermissions = async () => {
    if (!selectedPersonId) return;
    const targetSurv = surveyors.find(s => s.id === selectedPersonId);
    if (!targetSurv) return;

    try {
      setIsSavingPermissions(true);
      const selectedIds = Array.from(checkedAreaIds);

      const commIds = new Set<string>();
      areas.filter(a => selectedIds.includes(a.id)).forEach(a => {
        if (a.communeId) commIds.add(a.communeId);
        if ((a as any).communeCode) commIds.add((a as any).communeCode);
      });

      await onBatchAssignArea(
        targetSurv.id,
        selectedIds,
        Array.from(commIds),
        allowedSupervisorAreas.map(a => a.id)
      );

      showNotification('success', `Đã lưu phân quyền cho ${targetSurv.name} (${selectedIds.length} địa bàn) thành công!`);
    } catch (err: any) {
      showNotification('error', 'Lỗi khi lưu phân quyền: ' + (err.message || String(err)));
    } finally {
      setIsSavingPermissions(false);
    }
  };

  // 10. Tra cứu xem địa bàn đang được phân công cho ai
  const getAreaAssignment = useCallback((a: SurveyArea) => {
    const hhWithSurveyor = households.find(h => (h.areaId === a.id || h.areaCode === a.code) && Boolean(h.assignedSurveyorId));
    if (hhWithSurveyor && hhWithSurveyor.assignedSurveyorId) {
      const surv = surveyors.find(s => s.id === hhWithSurveyor.assignedSurveyorId);
      return {
        surveyorId: hhWithSurveyor.assignedSurveyorId,
        surveyorName: surv?.name || hhWithSurveyor.assignedSurveyorName || 'Cán bộ khác'
      };
    }

    const assignedSurv = surveyors.find(s => 
      (s.assignedAreas || []).includes(a.id) || 
      (s.assignedAreas || []).includes(a.code) ||
      (s.assignedAreas || []).includes(`${a.communeId}_${a.code}`)
    );
    if (assignedSurv) {
      return {
        surveyorId: assignedSurv.id,
        surveyorName: assignedSurv.name
      };
    }

    return null;
  }, [households, surveyors]);

  // 11. XUẤT MẪU PHÂN QUYỀN (EXCEL)
  // Các cột chuẩn: STT, Mã TKCS, Tên TKCS, Mã xã, Tên xã, Mã địa bàn, Tên địa bàn, Tên Người nhập / ĐTV, Tổng số hộ
  const handleExportTemplate = () => {
    try {
      exportPermissionExcelTemplate(communes, areas, surveyors, households as any);
      showNotification('success', 'Đã tải xuống file mẫu Excel phân công và phân quyền thành công.');
    } catch (err: any) {
      showNotification('error', 'Lỗi khi xuất file mẫu Excel: ' + (err.message || String(err)));
    }
  };

  // 12. TẢI LÊN EXCEL PHÂN QUYỀN
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsImportingExcel(true);
      const result: ParsedPermissionResult = await parsePermissionExcelFile(file, communes, areas, surveyors);
      if (result.assignments.length === 0) {
        showNotification('error', 'Không tìm thấy dữ liệu phân công hợp lệ trong file Excel.');
        return;
      }
      if (onBatchImportAssignments) {
        const importPayload = result.assignments.map(a => ({
          surveyorId: a.surveyor.id,
          areaIds: a.areaIds,
          communeIds: a.communeIds
        }));
        await onBatchImportAssignments(importPayload);
      }
      let msg = `Đã phân công thành công từ Excel cho ${result.assignments.length} cán bộ (${result.validRows} địa bàn).`;
      if (result.warnings.length > 0) {
        msg += ` (Có ${result.warnings.length} dòng cảnh báo không khớp cán bộ/xã).`;
      }
      showNotification('success', msg);
    } catch (err: any) {
      showNotification('error', 'Lỗi khi đọc file Excel: ' + (err.message || String(err)));
    } finally {
      setIsImportingExcel(false);
      if (excelFileInputRef.current) {
        excelFileInputRef.current.value = '';
      }
    }
  };

  // 13. Mở modal thêm/sửa cán bộ
  const openAddModal = () => {
    const count = surveyors.length + 1;
    const nextCode = `DTV${count < 10 ? '0' + count : count}`;
    setEditingSurveyor(null);
    setFormCode(nextCode);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormPassword('123456');
    setFormRole('SURVEYOR');
    setFormDeptId(departments[0]?.id || 'pb_01');
    setIsModalOpen(true);
  };

  const openEditModal = (s: Surveyor) => {
    setEditingSurveyor(s);
    setFormCode(s.code);
    setFormName(s.name);
    setFormPhone(s.phone || '');
    setFormEmail(s.email || '');
    setFormPassword(s.password || '123456');
    setFormRole(s.role);
    setFormDeptId(s.departmentId || departments[0]?.id || 'pb_01');
    setIsModalOpen(true);
  };

  const handleSaveSurveyorModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      showNotification('error', 'Vui lòng nhập Mã tài khoản và Họ tên cán bộ.');
      return;
    }

    try {
      setIsSubmittingForm(true);
      const matchedDept = departments.find(d => d.id === formDeptId);
      const newSurveyor: Surveyor = {
        id: editingSurveyor ? editingSurveyor.id : 'dtv_' + Date.now(),
        code: formCode.trim().toUpperCase(),
        username: editingSurveyor?.username || formCode.trim().toLowerCase(),
        name: formName.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        password: formPassword.trim() || (editingSurveyor?.password || '123456'),
        role: formRole,
        departmentId: formDeptId,
        department: matchedDept ? matchedDept.name : formDeptId,
        position: formRole === 'SUPERVISOR' ? 'Giám sát viên' : 'Điều tra viên',
        assignedAreas: editingSurveyor?.assignedAreas || [],
        assignedCommunes: editingSurveyor?.assignedCommunes,
        status: editingSurveyor?.status || 'ACTIVE',
        mustChangePassword: editingSurveyor?.mustChangePassword ?? false,
        createdAt: editingSurveyor ? editingSurveyor.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await onSaveSurveyor(newSurveyor);
      setIsModalOpen(false);
      showNotification('success', `Đã lưu cán bộ "${newSurveyor.name}" (${newSurveyor.code}) thành công.`);
      if (!selectedPersonId) {
        handleSelectPerson(newSurveyor);
      }
    } catch (err: any) {
      showNotification('error', 'Lỗi khi lưu tài khoản: ' + err.message);
    } finally {
      setIsSubmittingForm(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 font-sans text-slate-800">
      {/* 1. TOP BAR: TIÊU ĐỀ & CÁC NÚT TẢI MẪU EXCEL, TẢI LÊN EXCEL */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-sky-800 text-white rounded-lg shadow-xs shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
          </div>
          <div>
            <h2 className="font-black text-sky-950 text-sm md:text-base flex items-center gap-2">
              <span>Phân Quyền Địa Bàn Điều Tra Cho Cán Bộ / ĐTV</span>
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-bold">
                Trực quan 2 cột
              </span>
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span>{surveyors.length} Cán bộ / ĐTV</span>
              <span>•</span>
              <span>{allowedSupervisorAreas.length} Địa bàn</span>
              <span>•</span>
              <span>{allowedSupervisorCommunes.length} Xã / Phường</span>
            </div>
          </div>
        </div>

        {/* CÁC NÚT THAO TÁC EXCEL VÀ THÊM MỚI */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Nút Xuất mẫu Excel */}
          <button
            type="button"
            onClick={handleExportTemplate}
            className="px-3 py-1.5 bg-white border border-emerald-600 text-emerald-800 hover:bg-emerald-50 active:bg-emerald-100 rounded-md font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            title="Tải file mẫu Excel phân quyền chuẩn (STT, Mã TKCS, Tên TKCS, Mã xã, Tên xã, Mã ĐB, Tên ĐB, Tên Người nhập/ĐTV, Tổng số hộ)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-700" />
            <span>Tải mẫu Excel</span>
          </button>

          {/* Nút Tải lên Excel */}
          <label
            className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-white rounded-md font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
            title="Chọn file Excel phân quyền đã điền để tải lên hệ thống"
          >
            {isImportingExcel ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            <span>{isImportingExcel ? 'Đang đọc...' : 'Tải lên Excel phân quyền'}</span>
            <input
              ref={excelFileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImportExcelFile}
              disabled={isImportingExcel}
              className="hidden"
            />
          </label>

          {/* Nút Cấp tài khoản cán bộ mới */}
          <button
            type="button"
            onClick={openAddModal}
            className="px-3.5 py-1.5 bg-sky-800 hover:bg-sky-700 active:bg-sky-900 text-white rounded-md font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5 text-sky-200" />
            <span>+ Cấp Tài Khoản Mới</span>
          </button>
        </div>
      </div>

      {/* 2. SPLIT-VIEW 2 CỘT CHÍNH: CỘT TRÁI CÁN BỘ / CỘT PHẢI PHÂN QUYỀN ĐỊA BÀN */}
      <div className="flex flex-col lg:flex-row gap-3 items-start w-full">
        {/* CỘT BÊN TRÁI: DANH SÁCH CÁN BỘ / ĐTV */}
        <div className="w-full lg:w-80 xl:w-96 bg-white rounded-lg border border-slate-300 shadow-xs flex flex-col shrink-0 overflow-hidden">
          {/* Header Cột Trái */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Users className="w-4 h-4 text-sky-700" />
                <span>1. Chọn Cán Bộ / ĐTV</span>
              </h4>
              <span className="text-[11px] font-bold text-sky-900 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                {filteredPersonnel.length} người
              </span>
            </div>

            {/* Ô tìm kiếm cán bộ */}
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Tìm tên, mã, phòng ban..."
                value={personSearch}
                onChange={e => setPersonSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-sky-500 focus:border-sky-500"
              />
              {personSearch && (
                <button
                  type="button"
                  onClick={() => setPersonSearch('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Bộ lọc nhanh vai trò cán bộ */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setPersonRoleFilter('ALL')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                  personRoleFilter === 'ALL'
                    ? 'bg-sky-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Tất cả
              </button>
              <button
                type="button"
                onClick={() => setPersonRoleFilter('SURVEYOR')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                  personRoleFilter === 'SURVEYOR'
                    ? 'bg-sky-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Điều tra viên
              </button>
              <button
                type="button"
                onClick={() => setPersonRoleFilter('SUPERVISOR')}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                  personRoleFilter === 'SUPERVISOR'
                    ? 'bg-sky-800 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Giám sát viên
              </button>
            </div>
          </div>

          {/* Danh sách cán bộ */}
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredPersonnel.map(s => {
              const isSelected = selectedPersonId === s.id;
              const roleConfig = ROLE_LABELS[s.role] || ROLE_LABELS.SURVEYOR;
              
              // Đếm số địa bàn cán bộ này thực tế đang phụ trách
              const sAssignedSet = new Set((s.assignedAreas || []).filter(item => item !== '001' && item !== 'ALL'));
              const assignedCount = allowedSupervisorAreas.filter(a => 
                sAssignedSet.has(a.id) || 
                sAssignedSet.has(`${a.communeId}_${a.code}`) ||
                (Boolean((a as any).communeCode) && sAssignedSet.has(`${(a as any).communeCode}_${a.code}`))
              ).length;

              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectPerson(s)}
                  className={`p-3 cursor-pointer transition-all flex flex-col gap-1 text-xs border-l-4 ${
                    isSelected 
                      ? 'bg-sky-50/90 border-l-sky-700 ring-1 ring-sky-300 font-semibold' 
                      : 'border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono font-bold text-sky-950 bg-sky-100/70 px-1.5 py-0.5 rounded text-[10px] shrink-0">
                        {s.code}
                      </span>
                      <span className={`font-bold truncate ${isSelected ? 'text-sky-950' : 'text-slate-900'}`}>
                        {s.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        s.role === 'ADMIN' ? 'bg-rose-100 text-rose-800' :
                        s.role === 'SUPERVISOR' ? 'bg-amber-100 text-amber-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {roleConfig.label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(s);
                        }}
                        className="text-slate-400 hover:text-sky-700 p-0.5"
                        title="Chỉnh sửa thông tin cán bộ"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate max-w-[180px]" title={s.department}>
                      {s.department || '---'}
                    </span>
                    <span className={`font-bold ${assignedCount > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {assignedCount > 0 ? `Đã giao: ${assignedCount} ĐB` : 'Chưa có ĐB'}
                    </span>
                  </div>
                </div>
              );
            })}

            {filteredPersonnel.length === 0 && (
              <div className="p-8 text-center text-slate-400 italic text-xs">
                Không tìm thấy cán bộ nào phù hợp với từ khóa.
              </div>
            )}
          </div>
        </div>

        {/* CỘT BÊN PHẢI: PHÂN QUYỀN ĐỊA BÀN PHỤ TRÁCH (LỌC THEO TỪNG NẤC CHUẨN) */}
        <div className="flex-1 bg-white rounded-lg border border-slate-300 shadow-xs flex flex-col overflow-hidden w-full">
          {selectedPerson ? (
            <>
              {/* Header Cột Phải: Thông tin cán bộ & Nút Lưu */}
              <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sky-950 bg-sky-100 px-2 py-0.5 rounded text-xs border border-sky-300">
                      {selectedPerson.code}
                    </span>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {selectedPerson.name}
                    </h4>
                    <span className="text-[11px] text-slate-500 font-medium">
                      ({selectedPerson.department || 'Ban Quản trị'})
                    </span>
                  </div>
                  <div className="text-slate-600 text-[11px] mt-1 flex items-center gap-2">
                    <span>Vai trò: <strong className="text-slate-800">{ROLE_LABELS[selectedPerson.role]?.label || selectedPerson.role}</strong></span>
                    <span>•</span>
                    <span>
                      Đang chọn phân quyền: <strong className="text-emerald-700 font-bold">{checkedAreaIds.size} địa bàn</strong>
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSelectPerson(selectedPerson)}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                    title="Tải lại các địa bàn đã phân công trước đó của cán bộ này"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tải lại</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    disabled={isSavingPermissions}
                    className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Lưu các địa bàn đã chọn cho cán bộ này"
                  >
                    {isSavingPermissions ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Lưu Phân Quyền ({checkedAreaIds.size} ĐB)</span>
                  </button>
                </div>
              </div>

              {/* BỘ LỌC THEO TỪNG NẤC LỌC:
                  NẤC 1: LỌC TKCS -> CHỈ HIỆN CÁC XÃ THUỘC TKCS ĐÓ
                  NẤC 2: LỌC XÃ -> CHỈ HIỆN CÁC ĐỊA BÀN THUỘC ĐÚNG XÃ ĐÓ
              */}
              <div className="p-3 bg-sky-50/60 border-b border-sky-200 flex flex-wrap items-center gap-3 text-xs">
                {/* Nấc 1: Lọc theo Tổ TKCS */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sky-950 shrink-0">1. Lọc TKCS:</span>
                  <select
                    value={rightTkcsFilter}
                    onChange={e => handleRightTkcsChange(e.target.value)}
                    className="bg-white border border-sky-400 rounded px-2.5 py-1.5 font-bold text-slate-900 focus:outline-sky-500 shadow-2xs"
                    title="Lọc danh sách theo Tổ Thống kê cơ sở"
                  >
                    <option value="ALL">-- Tất cả {uniqueTkcsList.length} Tổ TKCS --</option>
                    {uniqueTkcsList.map(t => (
                      <option key={t.code} value={t.code}>
                        [{t.code}] {t.label.split(' - ')[1] || t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nấc 2: Lọc theo Xã / Phường - CHỈ HIỆN PHẦN XÃ THUỘC TKCS ĐÃ CHỌN */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sky-950 shrink-0">2. Cấp Xã / Phường:</span>
                  <select
                    value={rightCommuneFilter}
                    onChange={e => setRightCommuneFilter(e.target.value)}
                    className="bg-white border border-sky-500 rounded px-2.5 py-1.5 font-bold text-slate-900 focus:outline-sky-500 shadow-2xs max-w-xs"
                    title="Lọc theo xã: chỉ hiện các xã thuộc TKCS và chỉ hiện địa bàn của đúng xã này"
                  >
                    <option value="ALL">-- Tất cả ({cascadingCommunes.length} Xã thuộc TKCS này) --</option>
                    {cascadingCommunes.map(c => (
                      <option key={c.id} value={c.id}>
                        [{c.communeCode}] {c.communeName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Nấc 3: Tìm kiếm theo từ khóa mã/tên địa bàn */}
                <div className="relative flex-1 min-w-[160px] max-w-xs">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Tìm mã ĐB (001, 002...), tên địa bàn..."
                    value={rightAreaSearch}
                    onChange={e => setRightAreaSearch(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white focus:outline-sky-500"
                  />
                  {rightAreaSearch && (
                    <button
                      type="button"
                      onClick={() => setRightAreaSearch('')}
                      className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Checkbox: Chỉ hiện địa bàn chưa giao */}
                <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-slate-700 text-[11px] bg-white px-2.5 py-1.5 rounded border border-slate-300 shadow-2xs hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={rightOnlyUnassigned}
                    onChange={e => setRightOnlyUnassigned(e.target.checked)}
                    className="rounded text-sky-700 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Chỉ hiện địa bàn chưa giao</span>
                </label>
              </div>

              {/* Thanh công cụ thao tác chọn có chủ đích (Không tự động chọn hết) */}
              <div className="px-3.5 py-2 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">
                    Hiển thị: <strong className="text-slate-900 font-bold">{visibleAreas.length}</strong> địa bàn
                  </span>
                  <span>•</span>
                  <span className="text-slate-600">
                    Đang chọn cho cán bộ này: <strong className="text-emerald-700 font-bold">{visibleAreas.filter(a => checkedAreaIds.has(a.id)).length}</strong> / {visibleAreas.length} ĐB hiển thị
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCheckAllVisible}
                    disabled={visibleAreas.length === 0}
                    className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-300 rounded font-bold text-[11px] cursor-pointer transition-colors"
                    title="Tích chọn tất cả các địa bàn đang hiển thị trong bộ lọc này"
                  >
                    + Chọn các ĐB đang hiển thị ({visibleAreas.length})
                  </button>

                  <button
                    type="button"
                    onClick={handleUncheckAllVisible}
                    disabled={visibleAreas.length === 0}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded font-bold text-[11px] cursor-pointer transition-colors"
                    title="Bỏ chọn các địa bàn đang hiển thị trong bộ lọc này"
                  >
                    - Bỏ chọn các ĐB đang hiển thị
                  </button>

                  <button
                    type="button"
                    onClick={() => setCheckedAreaIds(new Set())}
                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded font-bold text-[11px] cursor-pointer transition-colors"
                    title="Xóa trắng toàn bộ phân công của cán bộ này"
                  >
                    Xóa trắng phân công
                  </button>
                </div>
              </div>

              {/* BẢNG LƯỚI ĐỊA BÀN PHÂN QUYỀN (CHỈ HIỆN ĐỊA BÀN CỦA XÃ / TKCS ĐÃ LỌC) */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full border-collapse text-xs">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-[#058da0] text-white text-center font-bold shadow-xs">
                      <th className="border border-[#047484] p-2.5 w-12 text-center">
                        <input
                          type="checkbox"
                          checked={visibleAreas.length > 0 && visibleAreas.every(a => checkedAreaIds.has(a.id))}
                          onChange={() => {
                            const allVisibleSelected = visibleAreas.length > 0 && visibleAreas.every(a => checkedAreaIds.has(a.id));
                            if (allVisibleSelected) {
                              handleUncheckAllVisible();
                            } else {
                              handleCheckAllVisible();
                            }
                          }}
                          className="rounded text-sky-700 w-4 h-4 cursor-pointer"
                          title="Tích / Bỏ chọn toàn bộ các địa bàn đang hiển thị"
                        />
                      </th>
                      <th className="border border-[#047484] p-2.5 w-12 text-center">STT</th>
                      <th className="border border-[#047484] p-2.5 text-center w-20">Mã ĐB</th>
                      <th className="border border-[#047484] p-2.5 text-left min-w-[180px]">Tên địa bàn điều tra</th>
                      <th className="border border-[#047484] p-2.5 text-left min-w-[150px]">Xã / Phường</th>
                      <th className="border border-[#047484] p-2.5 text-left min-w-[140px]">Tổ TKCS</th>
                      <th className="border border-[#047484] p-2.5 text-center w-28">Số hộ mẫu</th>
                      <th className="border border-[#047484] p-2.5 text-left min-w-[200px]">Trạng thái phụ trách</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {visibleAreas.map((a, idx) => {
                      const isChecked = checkedAreaIds.has(a.id);
                      const commObj = communeLookupMap.get(a.communeId) || allowedSupervisorCommunes.find(c => c.communeCode === (a as any).communeCode);
                      const tkObj = commObj ? getCommuneTkcs(commObj) : { code: 'TK001', name: 'Tổ TKCS' };
                      const stats = areaStatsMap.get(a.id) || areaStatsMap.get(a.code) || { total: 0, official: 0, reserve: 0, completed: 0 };
                      const assignment = getAreaAssignment(a);
                      const isAssignedToOther = assignment && assignment.surveyorId !== selectedPerson.id;

                      return (
                        <tr
                          key={a.id}
                          onClick={() => handleToggleArea(a.id)}
                          className={`transition-colors cursor-pointer ${
                            isChecked 
                              ? 'bg-sky-50 font-semibold' 
                              : 'hover:bg-slate-50 odd:bg-white even:bg-slate-50/40'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td 
                            className="border-r border-slate-200 p-2.5 text-center"
                            onClick={e => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleArea(a.id)}
                              className="rounded text-sky-700 w-4 h-4 cursor-pointer"
                            />
                          </td>

                          {/* 2. STT */}
                          <td className="border-r border-slate-200 p-2.5 text-center text-slate-500 font-medium">
                            {idx + 1}
                          </td>

                          {/* 3. Mã ĐB */}
                          <td className="border-r border-slate-200 p-2.5 text-center font-mono font-bold text-sky-950">
                            {a.code}
                          </td>

                          {/* 4. Tên địa bàn */}
                          <td className="border-r border-slate-200 p-2.5 text-slate-900 text-left font-bold">
                            {a.name || `Địa bàn ${a.code}`}
                          </td>

                          {/* 5. Xã / Phường */}
                          <td className="border-r border-slate-200 p-2.5 text-slate-800 text-left">
                            {commObj ? `[${commObj.communeCode}] ${commObj.communeName}` : (a.communeId || '---')}
                          </td>

                          {/* 6. Tổ TKCS */}
                          <td className="border-r border-slate-200 p-2.5 text-slate-600 text-left text-[11px]">
                            {tkObj.name}
                          </td>

                          {/* 7. Số hộ mẫu / Hoàn thành */}
                          <td className="border-r border-slate-200 p-2.5 text-center text-slate-700">
                            {stats.total > 0 ? (
                              <span className={stats.completed === stats.total ? 'text-emerald-700 font-bold' : 'font-medium'}>
                                {stats.completed}/{stats.total} hộ
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>

                          {/* 8. Trạng thái phụ trách */}
                          <td className="p-2.5 text-left">
                            {isChecked ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                <Check className="w-3.5 h-3.5 text-emerald-700" />
                                <span>Đang chọn phân cho: {selectedPerson.name}</span>
                              </span>
                            ) : isAssignedToOther ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                <span>Đang giao: {assignment.surveyorName}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">
                                Chưa phân công
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {visibleAreas.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-10 text-center text-slate-400 italic text-xs">
                          Không tìm thấy địa bàn nào phù hợp với bộ lọc xã / TKCS hoặc từ khóa hiện tại.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
              <UserCheck className="w-10 h-10 text-slate-300" />
              <span className="font-bold text-slate-700 text-sm">
                Vui lòng chọn một Cán bộ / Điều tra viên ở danh sách bên trái
              </span>
              <span className="text-xs text-slate-400">
                Hệ thống sẽ nạp danh sách địa bàn phụ trách để bạn tiến hành phân quyền theo từng nấc lọc.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* MODAL THÊM / CHỈNH SỬA TÀI KHOẢN CÁN BỘ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden text-xs">
            <div className="bg-sky-800 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-200" />
                <h3 className="font-bold text-sm">
                  {editingSurveyor ? `Cập nhật tài khoản: ${editingSurveyor.name}` : 'Thêm mới Cán bộ / Điều tra viên'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-sky-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSurveyorModal} className="p-4 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Tên đăng nhập / Mã ĐTV *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder="VD: DTV01, DTV02..."
                    className="w-full border border-slate-300 rounded p-2 font-bold text-sky-900 uppercase font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Họ và tên cán bộ *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="Nhập họ và tên..."
                    className="w-full border border-slate-300 rounded p-2 font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Vai trò hệ thống</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value as UserRole)}
                    className="w-full border border-slate-300 rounded p-2 font-bold text-slate-900"
                  >
                    <option value="SURVEYOR">Điều tra viên (SURVEYOR)</option>
                    <option value="SUPERVISOR">Giám sát viên (SUPERVISOR)</option>
                    <option value="ADMIN">Quản trị viên (ADMIN)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Phòng Ban Phụ Trách</label>
                  <select
                    value={formDeptId}
                    onChange={e => setFormDeptId(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 font-bold text-slate-900"
                  >
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-800 mb-1">Số điện thoại</label>
                  <input
                    type="text"
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    placeholder="098..."
                    className="w-full border border-slate-300 rounded p-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">Mật khẩu</label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={e => setFormPassword(e.target.value)}
                    placeholder="123456"
                    className="w-full border border-slate-300 rounded p-2 font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 mt-2">
                {editingSurveyor && currentUser.role === 'ADMIN' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSurveyorToDelete(editingSurveyor);
                      setIsModalOpen(false);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa tài khoản</span>
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingForm}
                    className="px-4 py-1.5 bg-sky-800 hover:bg-sky-700 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {isSubmittingForm ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    <span>Lưu Cán Bộ</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL XÁC NHẬN XÓA CÁN BỘ */}
      {surveyorToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full flex flex-col overflow-hidden text-xs">
            <div className="bg-rose-700 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Xác nhận xóa cán bộ</h3>
              </div>
              <button
                type="button"
                onClick={() => setSurveyorToDelete(null)}
                className="text-white hover:bg-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <p className="text-slate-700 text-sm">
                Bạn có chắc chắn muốn xóa tài khoản <strong className="text-rose-700 font-bold">{surveyorToDelete.name}</strong> ({surveyorToDelete.code})?
              </p>
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setSurveyorToDelete(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const target = surveyorToDelete;
                    setSurveyorToDelete(null);
                    await onDeleteSurveyor(target.id);
                    showNotification('success', `Đã xóa cán bộ ${target.name} thành công.`);
                  }}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
