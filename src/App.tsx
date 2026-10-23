/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  FileSpreadsheet, Upload, Download, Printer, Plus, PlusCircle, Trash2, Edit3, 
  Save, Database, Layers, Home, Users, BarChart3, Settings, CheckCircle2, 
  AlertCircle, RefreshCw, Filter, Search, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight,
  Check, Cloud, FileText, Loader2, TableProperties, MapPin, Building2, Hash, BookOpen, Copy, 
  Shield, ShieldCheck, Lock, Unlock, Eye, EyeOff, CheckSquare, Square, UserCheck, ShieldAlert, AlertTriangle, X,
  LogOut, LogIn, KeyRound, User, TrendingUp, ExternalLink, RotateCcw
} from 'lucide-react';
import { db } from './firebase';
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

import { FullQuestionnaire, createDefaultQuestionnaire } from './types/questionnaire';
import { calculateFullIncome } from './utils/incomeCalculator';
import QuestionnaireModal from './components/QuestionnaireModal';
import CatalogModal from './components/CatalogModal';
import SurveyorManagement from './components/SurveyorManagement';
import { SurveyorProgressView } from './components/SurveyorProgressView';
import ExcelHeaderConfigModal from './components/ExcelHeaderConfigModal';
import { IncomeMacroControl } from './components/IncomeMacroControl';
import { ReplaceHouseholdModal } from './components/ReplaceHouseholdModal';
import IndustrialSurveyModule from './components/IndustrialSurveyModule';
import AreaDataTransferModal from './components/AreaDataTransferModal';
import { IndustrialSurveyPage } from './modules/industrialSurvey';
import bannerImg from './assets/images/background-ngoai-troi-dep_042633251.jpg';
import { OFFICIAL_COMMUNES_CATALOG } from './data/communesCatalog';
import { 
  Surveyor, UserRole, SurveyStatus, Department, ROLE_LABELS, SURVEY_STATUS_LABELS 
} from './types/user';
import { 
  OFFICIAL_PERSONNEL_LIST, INITIAL_DEFAULT_PASSWORD, OFFICIAL_5_DEPARTMENTS 
} from './constants/officialPersonnel';
import { 
  CATALOG_TRONG_TROT, 
  CATALOG_CHAN_NUOI, 
  CATALOG_LAM_NGHIEP, 
  CATALOG_THUY_SAN,
  CATALOG_PHI_NONG_NGHIEP,
  CATALOG_CONG_VIEC,
  CATALOG_THU_KHAC,
  CatalogItem 
} from './constants/catalogs';
import {
  AreaProgressSnapshot,
  createAreaProgressSnapshot,
  parseSurveyWorkPackage,
  normalizeSurveyorName,
  SurveyWorkPackage,
  isAreaAssigned
} from './utils/areaDataTransfer';
import {
  loadPreRestoreSnapshot,
  loadLocalDataSnapshot,
  inspectLocalDataBackup,
  parseSurveyorEntryBackup,
  parseLocalDataBackup,
  saveLocalDataSnapshot,
  serializeLocalDataBackup
} from './utils/localDataBackup';

// Tài khoản Quản trị viên Master thực tế + 58 cán bộ chính thức theo danh sách chuẩn từ ảnh
export const DEFAULT_SURVEYORS: Surveyor[] = [
  {
    id: 'admin',
    code: 'ADMIN',
    username: 'admin',
    name: 'Quản trị viên hệ thống',
    departmentId: 'pb_tkth',
    department: 'Phòng Thống kê Tổng hợp',
    position: 'Quản trị viên / Giám sát xã',
    phone: '',
    email: 'thanhtraqtm@gmail.com',
    password: '',
    role: 'ADMIN',
    assignedAreas: ['ALL'],
    status: 'ACTIVE',
    mustChangePassword: false,
    note: 'Tài khoản quản trị viên tối cao, toàn quyền hệ thống và phân quyền',
    createdAt: new Date().toISOString()
  },
  ...OFFICIAL_PERSONNEL_LIST
];

export interface Household {
  id: string;
  communeId: string;
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  communeName: string;
  areaId: string;
  areaCode: string; // 001, 002, 003...
  areaName: string; // Tên sheet trong file Excel
  sheetName?: string; // Tên sheet gốc
  sttMau: string;
  sampleStatus: string;
  sttGoc: string;
  householdHead: string;
  address: string;
  phone: string;
  membersCount: number;
  workingMembersCount: number;
  membersCountEntered?: boolean;
  sectorCode: 1 | 2 | 3 | 4;
  sectorName: string;
  note: string;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  surveyStatus?: SurveyStatus;
  updatedBy?: string;
  updatedAt?: string;
  questionnaire?: FullQuestionnaire;
}

export interface SurveyArea {
  id: string;
  communeId: string;
  communeCode?: string;
  code: string; // 001, 002...
  name: string; // Tên sheet
  householdCount?: number;
}

export interface Commune {
  id: string;
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  communeName: string;
  fileName?: string;
  // Bảng kê trong xã (hộ)
  bkNongLamThuySan?: number;
  bkCongNghiepXayDung?: number;
  bkThuongMaiDichVu?: number;
  bkThuKhacLuong?: number;
  bkTongSo?: number;
  // Tỷ trọng %
  ttNongLamThuySan?: number;
  ttCongNghiepXayDung?: number;
  ttThuongMaiDichVu?: number;
  ttThuKhacLuong?: number;
  ttTongSo?: number;
  // Mẫu chính thức
  mauNongLamThuySan?: number;
  mauCongNghiepXayDung?: number;
  mauThuongMaiDichVu?: number;
  mauThuKhacLuong?: number;
  mauTongSo?: number;
  mauDuPhong?: number;
  targetTotalHH?: number;
  targetOfficialHH?: number;
  sectorTargets?: {
    s1: number;
    s2: number;
    s3: number;
    s4: number;
  };
}

const SECTOR_NAMES = {
  1: "Nông, lâm thủy sản",
  2: "Công nghiệp xây dựng",
  3: "Thương mại dịch vụ",
  4: "Nguồn thu khác / Lương"
};

function householdCompositeKey(household: Pick<Household, 'communeCode' | 'areaCode' | 'sttMau'>): string {
  return `${household.communeCode}_${household.areaCode}_${household.sttMau}`;
}

export default function App() {
  // Chế độ phân hệ phần mềm riêng biệt:
  // 'industrial': Phần mềm Nhập tin & Tổng hợp Điều tra Công nghiệp (DN & Cá thể)
  // 'household': Phần mềm Quản lý Nhập tin Phiếu thu nhập Hộ dân cư
  const [appMode, setAppMode] = useState<'household' | 'industrial'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlMode = urlParams.get('mode') || urlParams.get('app');
      if (urlMode === 'industrial') return 'industrial';
      if (urlMode === 'household') return 'household';
      const saved = localStorage.getItem('preferred_app_mode');
      if (saved === 'industrial' || saved === 'household') return saved;
    } catch (e) {}
    return 'household'; // Mặc định mở Trang Quản lý Thống kê Thu nhập Hộ gia đình
  });

  const [activeTab, setActiveTab] = useState<'industrial_survey' | 'import' | 'entry' | 'surveyor_progress' | 'tnh' | 'macro_control' | 'database' | 'catalog' | 'surveyors'>('entry');
  
  const [communes, setCommunes] = useState<Commune[]>(() => {
    try {
      const cached = localStorage.getItem('cached_communes');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = new Map<string, Commune>();
          const keyById = new Map<string, string>();
          const keyByCode = new Map<string, string>();
          OFFICIAL_COMMUNES_CATALOG.forEach(commune =>
            {
              const key = commune.communeCode || commune.id;
              merged.set(key, commune);
              keyById.set(commune.id, key);
              if (commune.communeCode) keyByCode.set(commune.communeCode, key);
            }
          );
          parsed.forEach((commune: Commune) => {
            const existingKey = keyById.get(commune.id) ||
              (commune.communeCode ? keyByCode.get(commune.communeCode) : undefined);
            const key = existingKey || commune.communeCode || commune.id;
            merged.set(key, { ...merged.get(key), ...commune });
            keyById.set(commune.id, key);
            if (commune.communeCode) keyByCode.set(commune.communeCode, key);
          });
          return Array.from(merged.values());
        }
      }
    } catch (e) {}
    return OFFICIAL_COMMUNES_CATALOG;
  });
  const [areas, setAreas] = useState<SurveyArea[]>(() => {
    try {
      const cached = localStorage.getItem('cached_areas');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [households, setHouseholds] = useState<Household[]>(() => {
    try {
      const cached = localStorage.getItem('cached_households');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [surveyors, setSurveyors] = useState<Surveyor[]>(() => {
    try {
      const cached = localStorage.getItem('cached_surveyors');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = new Map<string, Surveyor>();
          [DEFAULT_SURVEYORS[0], ...OFFICIAL_PERSONNEL_LIST].forEach(surveyor =>
            merged.set(surveyor.id, surveyor)
          );
          parsed.forEach((surveyor: Surveyor) => merged.set(surveyor.id, surveyor));
          return Array.from(merged.values());
        }
      }
    } catch (e) {}
    return [DEFAULT_SURVEYORS[0], ...OFFICIAL_PERSONNEL_LIST];
  });
  const [departments, setDepartments] = useState<Department[]>(() => {
    try {
      const cached = localStorage.getItem('cached_departments');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = new Map<string, Department>();
          OFFICIAL_5_DEPARTMENTS.forEach(department => merged.set(department.id, department));
          parsed.forEach((department: Department) => merged.set(department.id, department));
          return Array.from(merged.values());
        }
      }
    } catch (e) {}
    return OFFICIAL_5_DEPARTMENTS;
  });

  const [currentSurveyorId, setCurrentSurveyorId] = useState<string>('admin');
  const [loading, setLoading] = useState<boolean>(false);
  const [localDataReady, setLocalDataReady] = useState<boolean>(false);
  const [cloudProgress, setCloudProgress] = useState<AreaProgressSnapshot[]>([]);
  
  // Real Login & Authentication States
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState<boolean>(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [loginInfo, setLoginInfo] = useState<string>('');

  // Change password form state
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [changePasswordError, setChangePasswordError] = useState<string>('');
  const [isSavingPassword, setIsSavingPassword] = useState<boolean>(false);

  // TNH Scope Mode states
  const [tnhScopeMode, setTnhScopeMode] = useState<'COMMUNE_QUICK' | 'COMMUNE_SECTOR' | 'TKCS_SECTOR' | 'PROVINCE_SECTOR'>('COMMUNE_QUICK');
  const [tnhSelectedCommuneId, setTnhSelectedCommuneId] = useState<string>('ALL');
  const [tnhSelectedTkcs, setTnhSelectedTkcs] = useState<string>('ALL');
  const [tnhSurveyorOnlyMine, setTnhSurveyorOnlyMine] = useState<boolean>(true);
  const [tnhPivotMode, setTnhPivotMode] = useState<boolean>(false);

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgressText, setUploadProgressText] = useState<string>('');
  
  const [selectedTkcs, setSelectedTkcs] = useState<string>('ALL');
  const [selectedCommuneId, setSelectedCommuneId] = useState<string>('ALL');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('ALL');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  
  // Surveyor, Status, and Sector filters
  const [selectedSurveyorFilter, setSelectedSurveyorFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');
  const [onlyMyHouseholds, setOnlyMyHouseholds] = useState<boolean>(false);
  
  // Batch selection in Household list
  const [selectedHouseholdIds, setSelectedHouseholdIds] = useState<string[]>([]);
  const [batchAssignSurveyorId, setBatchAssignSurveyorId] = useState<string>('');
  const [showReserveHouseholds, setShowReserveHouseholds] = useState<boolean>(false);
  const [isDuyetDiaBanModalOpen, setIsDuyetDiaBanModalOpen] = useState<boolean>(false);
  const [isDataTransferModalOpen, setIsDataTransferModalOpen] = useState<boolean>(false);
  const [dataTransferMode, setDataTransferMode] = useState<'export' | 'import'>('export');

  // Pagination state for Household Table
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(50);

  const handleResetFilters = () => {
    setSelectedTkcs('ALL');
    setTnhSelectedTkcs('ALL');
    setSelectedCommuneId('ALL');
    setTnhSelectedCommuneId('ALL');
    setSelectedAreaId('ALL');
    setSelectedSurveyorFilter('ALL');
    setSelectedStatusFilter('ALL');
    setSelectedSectorFilter('ALL');
    setSearchKeyword('');
    setOnlyMyHouseholds(false);
    setSelectedHouseholdIds([]);
    setCurrentPage(1);
  };

  // Upload Report Modal for skipped / invalid sheets
  const [uploadReport, setUploadReport] = useState<{
    validCount: number;
    totalHouseholds: number;
    skippedSheets: { sheetName: string; reason: string }[];
  } | null>(null);

  // Duplicate Commune Confirmation Modal state
  const [pendingDuplicateCommune, setPendingDuplicateCommune] = useState<{
    existingCommune: Commune;
    newCommuneData: Commune;
    duplicateReason: 'BOTH' | 'NAME' | 'CODE';
    tempAreas: SurveyArea[];
    tempHouseholds: Household[];
    skippedSheets: { sheetName: string; reason: string }[];
    totalParsed: number;
  } | null>(null);

  // Deletion modals & loading states
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState<boolean>(false);
  const [communeToDelete, setCommuneToDelete] = useState<Commune | null>(null);
  const [areaToDelete, setAreaToDelete] = useState<SurveyArea | null>(null);
  const [householdToDelete, setHouseholdToDelete] = useState<Household | null>(null);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState<boolean>(false);
  const [isResetQuestionnaireModalOpen, setIsResetQuestionnaireModalOpen] = useState<boolean>(false);
  const [resetTargetType, setResetTargetType] = useState<'all_system_surveyed' | 'commune_surveyed' | 'area' | 'selected' | 'all_filtered'>('all_system_surveyed');
  const [resetCommuneId, setResetCommuneId] = useState<string>('ALL');
  const [resetAreaId, setResetAreaId] = useState<string>('ALL');
  const [isResettingQuestionnaire, setIsResettingQuestionnaire] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteProgressText, setDeleteProgressText] = useState<string>('');

  // Thay thế hộ mẫu bằng hộ dự phòng cùng địa bàn
  const [householdToReplace, setHouseholdToReplace] = useState<Household | null>(null);
  const [selectedBackupHouseholdId, setSelectedBackupHouseholdId] = useState<string>('');
  const [replaceReason, setReplaceReason] = useState<string>('Vắng mặt dài ngày / Đi khỏi địa phương');
  const [customReplaceReason, setCustomReplaceReason] = useState<string>('');
  const [isReplacingHousehold, setIsReplacingHousehold] = useState<boolean>(false);

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  
  // 4 fields start blank for user to freely define
  const [formTkcsCode, setFormTkcsCode] = useState('');
  const [formTkcsName, setFormTkcsName] = useState('');
  const [formCommuneCode, setFormCommuneCode] = useState('');
  const [formCommuneName, setFormCommuneName] = useState('');

  // States for Commune Catalog selection & filtering in Tab 1
  const [isHeaderConfigModalOpen, setIsHeaderConfigModalOpen] = useState<boolean>(false);
  const [headerConfigInitialMode, setHeaderConfigInitialMode] = useState<'HOUSEHOLDS' | 'COMMUNE_LIST'>('COMMUNE_LIST');
  const [selectedCatalogCommuneId, setSelectedCatalogCommuneId] = useState<string>('AUTO');
  const [isDragOverDropzone, setIsDragOverDropzone] = useState<boolean>(false);
  const [editingCommune, setEditingCommune] = useState<Commune | null>(null);
  const [isAddCommuneModalOpen, setIsAddCommuneModalOpen] = useState<boolean>(false);
  const [newCommuneForm, setNewCommuneForm] = useState<{
    communeCode: string;
    communeName: string;
    tkcsCode: string;
    tkcsName: string;
  }>({ communeCode: '', communeName: '', tkcsCode: '', tkcsName: '' });

  const [activeHouseholdForm, setActiveHouseholdForm] = useState<Household | null>(null);
  const [isGlobalCatalogOpen, setIsGlobalCatalogOpen] = useState(false);
  const [catalogExplorerTab, setCatalogExplorerTab] = useState<'muc2' | 'muc3' | 'muc4' | 'muc5' | 'muc6' | 'muc1' | 'muc7'>('muc2');
  const [catalogSearchTerm, setCatalogSearchTerm] = useState('');

  useEffect(() => {
    let cancelled = false;
    const initializeLocalData = async () => {
      try {
        const snapshot = await loadLocalDataSnapshot();
        if (cancelled) return;
        if (snapshot) {
          setCommunes(snapshot.communes);
          setAreas(snapshot.areas);
          setHouseholds(snapshot.households);
          setSurveyors(snapshot.surveyors);
          setDepartments(snapshot.departments);
        } else {
          await saveLocalDataSnapshot({ communes, areas, households, surveyors, departments });
        }
        localStorage.removeItem('cached_households');
      } catch (err) {
        console.error('Không thể mở kho dữ liệu cục bộ:', err);
        if (!cancelled) {
          setNotification({
            type: 'error',
            message: 'Không mở được kho dữ liệu cục bộ. Hãy dùng trình duyệt hỗ trợ IndexedDB và không xóa dữ liệu trang web.'
          });
        }
      } finally {
        if (!cancelled) {
          setLocalDataReady(true);
          setLoading(false);
        }
      }
    };
    void initializeLocalData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!localDataReady) return;
    void saveLocalDataSnapshot({ communes, areas, households, surveyors, departments })
      .catch(err => {
        console.error('Không thể lưu dữ liệu nghiệp vụ trên thiết bị:', err);
        setNotification({
          type: 'error',
          message: 'Không lưu được dữ liệu vào kho cục bộ của trình duyệt. Hãy xuất bản sao lưu và kiểm tra dung lượng thiết bị.'
        });
      });
    try {
      localStorage.setItem('cached_communes', JSON.stringify(communes));
      localStorage.setItem('cached_areas', JSON.stringify(areas));
      localStorage.setItem('cached_surveyors', JSON.stringify(surveyors));
      localStorage.setItem('cached_departments', JSON.stringify(departments));
    } catch (err) {
      console.error('Không thể cập nhật bộ nhớ đệm tương thích:', err);
    }
  }, [localDataReady, communes, areas, households, surveyors, departments]);

  useEffect(() => {
    const areaCounts = new Map<string, { official: number; reserve: number }>();
    households.forEach(household => {
      const areaId = household.areaId || 'UNKNOWN';
      const counts = areaCounts.get(areaId) || { official: 0, reserve: 0 };
      if (household.sampleStatus === 'CHÍNH THỨC' || !household.sampleStatus) counts.official++;
      if ((household.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG')) counts.reserve++;
      areaCounts.set(areaId, counts);
    });

    const areasNeedingRepair = new Set(
      Array.from(areaCounts.entries())
        .filter(([, counts]) => counts.official < 10 && counts.reserve > 4)
        .map(([areaId]) => areaId)
    );
    if (areasNeedingRepair.size === 0) return;

    const areaIndexes = new Map<string, number>();
    let hasRepair = false;
    const repairedHouseholds = households.map(household => {
      const areaId = household.areaId || 'UNKNOWN';
      const index = areaIndexes.get(areaId) || 0;
      areaIndexes.set(areaId, index + 1);
      if (!areasNeedingRepair.has(areaId)) return household;

      const sampleNumber = Number(household.sttMau) || index + 1;
      const address = (household.address || '').toUpperCase();
      const isUrbanNeighborhood = address.includes('TDP') || address.includes('TỔ DÂN PHỐ');
      if (sampleNumber <= 10 && isUrbanNeighborhood &&
        (household.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG')) {
        hasRepair = true;
        return { ...household, sampleStatus: 'CHÍNH THỨC' };
      }
      return household;
    });

    if (hasRepair) setHouseholds(repairedHouseholds);
  }, [households]);

  useEffect(() => {
    if (!isLoggedIn || activeTab !== 'surveyor_progress') return;
    const unsubscribe = onSnapshot(collection(db, 'areaProgress'), snapshot => {
      const progress = snapshot.docs.map(document => document.data() as AreaProgressSnapshot)
        .filter(item =>
          typeof item.id === 'string' &&
          typeof item.areaId === 'string' &&
          typeof item.totalHouseholds === 'number' &&
          typeof item.completedHouseholds === 'number' &&
          typeof item.inProgressHouseholds === 'number'
        );
      setCloudProgress(progress);
    }, err => {
      console.error('Không thể đọc số đếm tiến độ từ Firebase:', err);
      setNotification({
        type: 'error',
        message: 'Không tải được tiến độ từ Firebase. Dữ liệu bảng kê và phiếu cục bộ vẫn được giữ nguyên.'
      });
    });
    return () => unsubscribe();
  }, [activeTab, isLoggedIn]);

  const currentUser: Surveyor = useMemo(() => {
    const found = surveyors.find(s => s.id === currentSurveyorId);
    return found || surveyors[0] || DEFAULT_SURVEYORS[0];
  }, [surveyors, currentSurveyorId]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Tự động đồng bộ và khôi phục tên địa bàn (tên sheet), mã/tên xã, TKCS cho các hộ gia đình từ danh mục (Tối ưu O(1) tốc độ cao)
  useEffect(() => {
    if (households.length > 0) {
      const comByCode = new Map<string, Commune>();
      const comById = new Map<string, Commune>();
      const comByName = new Map<string, Commune>();
      communes.forEach(c => {
        if (c.communeCode) comByCode.set(c.communeCode.trim().toLowerCase(), c);
        if (c.id) comById.set(c.id, c);
        if (c.communeName) comByName.set(c.communeName.trim().toLowerCase(), c);
      });

      const areaById = new Map<string, SurveyArea>();
      const areaByCommuneAndCode = new Map<string, SurveyArea>();
      areas.forEach(a => {
        if (a.id) areaById.set(a.id, a);
        if (a.code) {
          if (a.communeId) areaByCommuneAndCode.set(`${a.communeId}_${a.code}`, a);
          if ((a as any).communeCode) areaByCommuneAndCode.set(`${(a as any).communeCode}_${a.code}`, a);
        }
      });

      let hasHealed = false;
      const healedHouseholds = households.map(h => {
        let updated = { ...h };
        let changed = false;

        // 1. Đồng bộ xã & TKCS từ danh mục communes (O(1))
        const matchedCommune = 
          (h.communeCode ? comByCode.get(h.communeCode.trim().toLowerCase()) : null) ||
          (h.communeId ? comById.get(h.communeId) : null) ||
          (h.communeName ? comByName.get(h.communeName.trim().toLowerCase()) : null);

        if (matchedCommune) {
          if (updated.communeId !== matchedCommune.id) {
            updated.communeId = matchedCommune.id;
            changed = true;
          }
          if (updated.communeCode !== matchedCommune.communeCode) {
            updated.communeCode = matchedCommune.communeCode;
            changed = true;
          }
          if (!updated.communeName || updated.communeName === 'Xã/Phường') {
            updated.communeName = matchedCommune.communeName;
            changed = true;
          }
          if (!updated.tkcsCode || updated.tkcsCode.startsWith('TKCS-') || updated.tkcsCode === 'TKCS') {
            updated.tkcsCode = matchedCommune.tkcsCode;
            changed = true;
          }
          if (!updated.tkcsName || updated.tkcsName === 'TKCS') {
            updated.tkcsName = matchedCommune.tkcsName;
            changed = true;
          }
        }

        // 2. Khôi phục tên địa bàn (Lấy chính xác tên sheet làm tên địa bàn, loại bỏ 001 hoặc mã số thô)
        const exactSheet = ((updated as any).sheetName || '').trim();
        const curName = (updated.areaName || '').trim();
        const isCurNameBad = !curName || curName === '001' || curName === updated.areaCode || curName === 'Địa bàn' || curName === '---' || curName.startsWith('Địa bàn 001');

        if (exactSheet && exactSheet !== '001' && exactSheet !== 'Địa bàn' && exactSheet !== '---' && !exactSheet.startsWith('Địa bàn 001')) {
          if (updated.areaName !== exactSheet) {
            updated.areaName = exactSheet;
            changed = true;
          }
        } else if (isCurNameBad) {
          const matchedArea = (updated.areaId ? areaById.get(updated.areaId) : null) || 
            areaByCommuneAndCode.get(`${updated.communeId}_${updated.areaCode}`) ||
            (updated.communeCode ? areaByCommuneAndCode.get(`${updated.communeCode}_${updated.areaCode}`) : null);

          if (matchedArea?.name && matchedArea.name.trim() && matchedArea.name !== '001' && matchedArea.name !== matchedArea.code && matchedArea.name !== 'Địa bàn' && !matchedArea.name.startsWith('Địa bàn 001')) {
            updated.areaName = matchedArea.name.trim();
            updated.sheetName = matchedArea.name.trim();
            changed = true;
          }
        }

        if (changed) {
          hasHealed = true;
          return updated;
        }
        return h;
      });

      if (hasHealed) {
        setHouseholds(healedHouseholds);
        setTimeout(() => {
          try { localStorage.setItem('cached_households', JSON.stringify(healedHouseholds)); } catch (e) {}
        }, 100);
      }

      // Tự động khôi phục hoặc cập nhật danh mục areas từ tên sheet của households
      if (areas.length === 0) {
        const areaMap = new Map<string, SurveyArea>();
        households.forEach(h => {
          const aCode = h.areaCode || '001';
          const cId = h.communeId || (h.communeCode ? `c-${h.communeCode}` : 'commune-default');
          const key = `${cId}-${aCode}`;
          const sheetNameVal = ((h as any).sheetName && (h as any).sheetName.trim() && (h as any).sheetName !== '001' && (h as any).sheetName !== 'Địa bàn')
            ? (h as any).sheetName.trim()
            : (h.areaName && h.areaName.trim() && h.areaName !== '001' && h.areaName !== 'Địa bàn' && h.areaName !== aCode)
            ? h.areaName.trim()
            : `Địa bàn ${aCode}`;

          if (!areaMap.has(key)) {
            areaMap.set(key, {
              id: h.areaId || `area-${cId}-${aCode}`,
              communeId: cId,
              code: aCode,
              name: sheetNameVal,
              householdCount: 1
            });
          } else {
            const item = areaMap.get(key)!;
            item.householdCount = (item.householdCount || 0) + 1;
            if ((!item.name || item.name === '001' || item.name === item.code || item.name === 'Địa bàn' || item.name.startsWith('Địa bàn ')) && sheetNameVal !== `Địa bàn ${aCode}`) {
              item.name = sheetNameVal;
            }
          }
        });
        const reconstructed = Array.from(areaMap.values());
        if (reconstructed.length > 0) {
          setAreas(reconstructed);
          setTimeout(() => {
            try { localStorage.setItem('cached_areas', JSON.stringify(reconstructed)); } catch (e) {}
          }, 100);
        }
      } else {
        // Index households by area key for O(1) area name resolution
        const hhSheetByAreaKey = new Map<string, string>();
        households.forEach(h => {
          const sName = ((h as any).sheetName || h.areaName || '').trim();
          if (sName && sName !== '001' && sName !== 'Địa bàn' && sName !== '---' && !sName.startsWith('Địa bàn 001')) {
            if (h.areaId && !hhSheetByAreaKey.has(h.areaId)) hhSheetByAreaKey.set(h.areaId, sName);
            const cCodeKey = `${h.communeCode || h.communeId}_${h.areaCode}`;
            if (!hhSheetByAreaKey.has(cCodeKey)) hhSheetByAreaKey.set(cCodeKey, sName);
          }
        });

        let needUpdateAreas = false;
        const cleanedAreas = areas.map(a => {
          const isBadName = !a.name || a.name === '001' || a.name === a.code || a.name === 'Địa bàn' || a.name.startsWith('Địa bàn 001');
          if (isBadName) {
            const resolvedName = hhSheetByAreaKey.get(a.id) || hhSheetByAreaKey.get(`${a.communeId}_${a.code}`) || (a.communeCode ? hhSheetByAreaKey.get(`${a.communeCode}_${a.code}`) : null);
            if (resolvedName && resolvedName !== a.name) {
              needUpdateAreas = true;
              return { ...a, name: resolvedName };
            }
          }
          return a;
        });

        if (needUpdateAreas) {
          setAreas(cleanedAreas);
          setTimeout(() => {
            try { localStorage.setItem('cached_areas', JSON.stringify(cleanedAreas)); } catch (e) {}
          }, 100);
        }
      }

      // Tự động làm sạch các tài khoản điều tra viên nếu có gán nhầm mã 001
      const hasBadSurveyor = surveyors.some(s => s.assignedAreas?.includes('001'));
      if (hasBadSurveyor && areas.length > 0) {
        const matchingArea001 = areas.find(a => a.code === '001');
        const cleanedSurveyors = surveyors.map(s => {
          if (s.assignedAreas?.includes('001')) {
            const newAreas = s.assignedAreas.filter(x => x !== '001');
            if (matchingArea001) newAreas.push(matchingArea001.id);
            return {
              ...s,
              assignedAreas: Array.from(new Set(newAreas))
            };
          }
          return s;
        });
        setSurveyors(cleanedSurveyors);
        setTimeout(() => {
          try { localStorage.setItem('cached_surveyors', JSON.stringify(cleanedSurveyors)); } catch (e) {}
        }, 100);
      }
    }
  }, [areas, communes, households]);

  // Tự động đồng bộ chọn xã theo danh mục xã vừa nạp hoặc đã có
  useEffect(() => {
    if (communes.length > 0) {
      if (selectedCatalogCommuneId === 'AUTO' || !communes.some(c => c.id === selectedCatalogCommuneId)) {
        const target = selectedCommuneId !== 'ALL' 
          ? (communes.find(c => c.id === selectedCommuneId) || communes[0]) 
          : communes[0];
        setSelectedCatalogCommuneId(target.id);
        setFormCommuneCode(target.communeCode);
        setFormCommuneName(target.communeName);
        setFormTkcsCode(target.tkcsCode);
        setFormTkcsName(target.tkcsName);
      }
    }
  }, [communes, selectedCommuneId]);

  const handleSelectCommuneFromCatalog = (cId: string) => {
    setSelectedCatalogCommuneId(cId);
    if (cId === 'CUSTOM') {
      return;
    }
    const found = communes.find(c => c.id === cId);
    if (found) {
      setFormCommuneCode(found.communeCode);
      setFormCommuneName(found.communeName);
      setFormTkcsCode(found.tkcsCode);
      setFormTkcsName(found.tkcsName);
      // Vào trực tiếp xã đó và địa bàn đó
      setSelectedCommuneId(found.id);
      setSelectedTkcs(found.tkcsCode || 'ALL');
      
      const communeAreas = areas.filter(a => a.communeId === found.id || (Boolean(found.communeCode) && (a as any).communeCode === found.communeCode));
      if (communeAreas.length > 0) {
        setSelectedAreaId(communeAreas[0].id);
      } else {
        setSelectedAreaId('ALL');
      }

      showNotification('success', `Đã vào trực tiếp Thống kê cơ sở: "${found.tkcsName || found.tkcsCode}" — Xã [${found.communeCode}] ${found.communeName}.`);
    }
  };

  // Danh sách các tổ TKCS duy nhất từ danh mục xã để lọc
  const uniqueTkcsList = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    communes.forEach(c => {
      if (c.tkcsCode) {
        map.set(c.tkcsCode, { code: c.tkcsCode, name: c.tkcsName || c.tkcsCode });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [communes]);

  // Map ánh xạ nhanh Điều tra viên phụ trách theo Địa bàn để liên kết chặt chẽ với cột Người nhập/ĐTV
  const areaSurveyorMap = useMemo(() => {
    const map = new Map<string, Surveyor>();
    surveyors.forEach(s => {
      if (s.role === 'SURVEYOR' && s.assignedAreas && !s.assignedAreas.includes('ALL')) {
        s.assignedAreas.forEach(aKey => {
          map.set(aKey, s);
        });
      }
    });
    return map;
  }, [surveyors]);

  const surveyorAreaAccessKeys = useMemo(() => {
    const assignedAreas = currentUser.assignedAreas || [];
    const keys = new Set(assignedAreas);
    if (currentUser.role !== 'SURVEYOR' || keys.has('ALL')) return keys;
    areas.forEach(area => {
      if (isAreaAssigned(area, assignedAreas)) {
        keys.add(area.id);
        keys.add(area.code);
        keys.add(`${area.communeId}_${area.code}`);
        if (area.communeCode) keys.add(`${area.communeCode}_${area.code}`);
      }
    });
    return keys;
  }, [areas, currentUser]);

  const isHouseholdInSurveyorArea = (household: Household) =>
    surveyorAreaAccessKeys.has('ALL') ||
    surveyorAreaAccessKeys.has(household.areaId) ||
    surveyorAreaAccessKeys.has(household.areaCode) ||
    surveyorAreaAccessKeys.has(`${household.communeId}_${household.areaCode}`) ||
    surveyorAreaAccessKeys.has(`${household.communeCode}_${household.areaCode}`);

  const myAssignedHouseholdCount = useMemo(() => {
    if (currentUser.role !== 'SURVEYOR') return 0;
    return households.filter(household =>
      household.assignedSurveyorId === currentUser.id || isHouseholdInSurveyorArea(household)
    ).length;
  }, [currentUser, households, surveyorAreaAccessKeys]);

  // Bộ lọc thông minh được phân quyền theo vai trò (Chỉ hiện địa bàn/xã mà tài khoản phụ trách)
  const availableFilterCommunes = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN') return communes;

    if (currentUser.role === 'SUPERVISOR') {
      const myCommunes = currentUser.assignedCommunes || [];
      const myAreas = currentUser.assignedAreas || [];
      const myDept = departments.find(d => d.id === currentUser.departmentId || d.name === currentUser.department);
      const deptAreas = myDept?.assignedAreaCodes || [];

      const hasCommuneRule = myCommunes.length > 0 && !myCommunes.includes('ALL');
      const hasAreaRule = myAreas.length > 0 && !myAreas.includes('ALL');
      const hasDeptAreaRule = deptAreas.length > 0 && !deptAreas.includes('ALL');

      if (hasCommuneRule || hasAreaRule || hasDeptAreaRule) {
        return communes.filter(c => {
          if (hasCommuneRule && (myCommunes.includes(c.id) || myCommunes.includes(c.communeCode))) return true;
          if (hasAreaRule) {
            const hasA = areas.some(a => (a.communeId === c.id || (a as any).communeCode === c.communeCode) && (myAreas.includes(a.id) || myAreas.includes(a.code) || myAreas.includes(`${a.communeId}_${a.code}`)));
            if (hasA) return true;
          }
          if (hasDeptAreaRule) {
            const hasA = areas.some(a => (a.communeId === c.id || (a as any).communeCode === c.communeCode) && (deptAreas.includes(a.id) || deptAreas.includes(a.code) || deptAreas.includes(`${a.communeId}_${a.code}`)));
            if (hasA) return true;
          }
          return false;
        });
      }
      return communes;
    }

    if (currentUser.role === 'SURVEYOR') {
      if (!currentUser.assignedAreas?.includes('ALL')) {
        const myAssigned = new Set(currentUser.assignedAreas || []);
        const myAssignedCommunes = new Set<string>();

        // Lấy các xã từ địa bàn phân công
        areas.forEach(a => {
          if (
            myAssigned.has(a.id) || 
            myAssigned.has(a.code) || 
            myAssigned.has(`${a.communeId}_${a.code}`) ||
            ((a as any).communeCode && myAssigned.has((a as any).communeCode))
          ) {
            myAssignedCommunes.add(a.communeId);
            if ((a as any).communeCode) myAssignedCommunes.add((a as any).communeCode);
          }
        });

        // Bổ sung các xã từ hộ gia đình phân công trực tiếp cho ĐTV
        households.forEach(h => {
          if (h.assignedSurveyorId === currentUser.id || (h.assignedSurveyorName && h.assignedSurveyorName === currentUser.name)) {
            if (h.communeId) myAssignedCommunes.add(h.communeId);
            if (h.communeCode) myAssignedCommunes.add(h.communeCode);
          }
        });

        const matched = communes.filter(c => myAssignedCommunes.has(c.id) || myAssignedCommunes.has(c.communeCode));
        return matched.length > 0 ? matched : [];
      }
    }
    return communes;
  }, [communes, areas, households, currentUser]);

  const availableFilterTkcs = useMemo(() => {
    const comms = availableFilterCommunes;
    const tkcsCodes = new Set(comms.map(c => c.tkcsCode));
    return uniqueTkcsList.filter(tk => tkcsCodes.has(tk.code));
  }, [uniqueTkcsList, availableFilterCommunes]);

  const availableFilterAreas = useMemo(() => {
    let result = areas;
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SURVEYOR') {
        if (!currentUser.assignedAreas?.includes('ALL')) {
          const myAssigned = new Set(currentUser.assignedAreas || []);
          const myDirectHhAreaIds = new Set(
            households
              .filter(h => h.assignedSurveyorId === currentUser.id || (h.assignedSurveyorName && h.assignedSurveyorName === currentUser.name))
              .map(h => h.areaId || h.areaCode)
          );

          result = areas.filter(a => 
            myAssigned.has(a.id) || 
            myAssigned.has(a.code) || 
            myAssigned.has(`${a.communeId}_${a.code}`) ||
            myDirectHhAreaIds.has(a.id) ||
            myDirectHhAreaIds.has(a.code)
          );
        }
      } else if (currentUser.role === 'SUPERVISOR') {
        const myCommunes = currentUser.assignedCommunes || [];
        const myAreas = currentUser.assignedAreas || [];
        const myDept = departments.find(d => d.id === currentUser.departmentId || d.name === currentUser.department);
        const deptAreas = myDept?.assignedAreaCodes || [];

        const hasCommuneRule = myCommunes.length > 0 && !myCommunes.includes('ALL');
        const hasAreaRule = myAreas.length > 0 && !myAreas.includes('ALL');
        const hasDeptAreaRule = deptAreas.length > 0 && !deptAreas.includes('ALL');

        if (hasCommuneRule || hasAreaRule || hasDeptAreaRule) {
          result = areas.filter(a => {
            if (hasCommuneRule && (myCommunes.includes(a.communeId) || ((a as any).communeCode && myCommunes.includes((a as any).communeCode)))) return true;
            if (hasAreaRule && (myAreas.includes(a.id) || myAreas.includes(a.code) || myAreas.includes(`${a.communeId}_${a.code}`))) return true;
            if (hasDeptAreaRule && (deptAreas.includes(a.id) || deptAreas.includes(a.code) || deptAreas.includes(`${a.communeId}_${a.code}`))) return true;
            return false;
          });
        }
      }
    }

    const activeCommune = selectedCommuneId !== 'ALL' 
      ? communes.find(c => c.id === selectedCommuneId) 
      : null;

    // Áp dụng bộ lọc Xã và TKCS hiện tại
    return result.filter(a => {
      if (selectedCommuneId !== 'ALL') {
        return a.communeId === selectedCommuneId || (Boolean(activeCommune?.communeCode) && (a as any).communeCode === activeCommune?.communeCode);
      }
      if (selectedTkcs !== 'ALL') {
        const comm = communes.find(c => c.id === a.communeId || c.communeCode === (a as any).communeCode);
        return comm?.tkcsCode === selectedTkcs;
      }
      return true;
    });
  }, [areas, currentUser, selectedCommuneId, selectedTkcs, communes, households]);

  // Bảo vệ điều hướng: Điều tra viên không được mở các chức năng hệ thống
  useEffect(() => {
    if (currentUser.role === 'SURVEYOR') {
      if (activeTab === 'import' || activeTab === 'database' || activeTab === 'surveyors' || activeTab === 'surveyor_progress' || activeTab === 'macro_control') {
        setActiveTab('entry');
      }
    } else if (currentUser.role === 'SUPERVISOR') {
      if (activeTab === 'import' || activeTab === 'database' || activeTab === 'macro_control') {
        setActiveTab('entry');
      }
    }
  }, [currentUser.role, activeTab]);

  // Lọc danh sách xã theo Bộ lọc dùng chung (TKCS, Xã và từ khóa tìm kiếm)
  const filteredCommunesForImport = useMemo(() => {
    return communes.filter(c => {
      const matchTkcs = selectedTkcs === 'ALL' || c.tkcsCode === selectedTkcs;
      const matchCommune = selectedCommuneId === 'ALL' || c.id === selectedCommuneId || (Boolean(c.communeCode) && selectedCommuneId === c.communeCode);
      const q = searchKeyword.trim().toLowerCase();
      const matchSearch = !q || 
        c.communeCode.toLowerCase().includes(q) || 
        c.communeName.toLowerCase().includes(q) || 
        (c.tkcsCode && c.tkcsCode.toLowerCase().includes(q)) ||
        (c.tkcsName && c.tkcsName.toLowerCase().includes(q));
      return matchTkcs && matchCommune && matchSearch;
    });
  }, [communes, selectedTkcs, selectedCommuneId, searchKeyword]);

  // Link trực tiếp từ Danh mục xã sang Tổng hợp nhanh số liệu điều tra (Tab 3)
  const handleViewCommuneTNH = (c: Commune) => {
    setTnhScopeMode('COMMUNE_QUICK');
    setTnhSelectedCommuneId(c.id);
    setTnhSelectedTkcs(c.tkcsCode || 'ALL');
    setSelectedCommuneId(c.id);
    setSelectedTkcs(c.tkcsCode || 'ALL');
    setActiveTab('tnh');
    showNotification('success', `Đã liên kết số liệu và mở Tổng hợp nhanh cho [${c.communeCode}] ${c.communeName}.`);
  };

  // Link trực tiếp từ Danh mục xã sang Tải bảng kê hộ (Tab 1)
  const handleLoadHouseholdsForCommune = (c: Commune) => {
    handleSelectCommuneFromCatalog(c.id);
    setActiveTab('import');
    showNotification('success', `Đã chọn xã [${c.communeCode}] ${c.communeName}. Sẵn sàng tải file bảng kê.`);
  };

  // Link trực tiếp từ Tiến độ Điều tra viên sang Nhập tin hộ (Tab 2)
  const handleNavigateToHouseholdEntryFromProgress = (surveyorNameOrId: string, areaId?: string, communeId?: string) => {
    if (communeId && communeId !== 'ALL') {
      setSelectedCommuneId(communeId);
      const matchedCom = communes.find(c => c.id === communeId || c.communeCode === communeId);
      if (matchedCom?.tkcsCode) {
        setSelectedTkcs(matchedCom.tkcsCode);
        setTnhSelectedTkcs(matchedCom.tkcsCode);
      }
      setTnhSelectedCommuneId(communeId);
    }
    if (areaId && areaId !== 'ALL') {
      setSelectedAreaId(areaId);
    } else {
      setSelectedAreaId('ALL');
    }
    if (surveyorNameOrId && surveyorNameOrId !== '---' && surveyorNameOrId !== 'Chưa phân công điều tra viên') {
      setSelectedSurveyorFilter(surveyorNameOrId);
    }
    setCurrentPage(1);
    setActiveTab('entry');
    showNotification('success', `Đã liên kết số liệu sang phần Nhập tin hộ ${surveyorNameOrId ? `cho: "${surveyorNameOrId}"` : ''}.`);
  };

  const handleSaveEditedCommune = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCommune) return;
    const cCode = editingCommune.communeCode.trim();
    const cName = editingCommune.communeName.trim();
    if (!cCode || !cName) {
      showNotification('error', 'Vui lòng nhập đầy đủ Mã xã và Tên xã.');
      return;
    }

    const conflict = communes.find(c => c.id !== editingCommune.id && c.communeCode && c.communeCode.trim().toLowerCase() === cCode.toLowerCase());
    if (conflict) {
      showNotification('error', `Mã xã [${cCode}] đã trùng với xã "${conflict.communeName}". Vui lòng chọn mã khác.`);
      return;
    }

    try {
      const updated: Commune = {
        ...editingCommune,
        communeCode: cCode,
        communeName: cName,
        tkcsCode: (editingCommune.tkcsCode || 'TKCS-01').trim(),
        tkcsName: (editingCommune.tkcsName || 'Thống kê cơ sở').trim(),
      };

      setCommunes(prev => prev.map(c => c.id === updated.id ? updated : c));
      setHouseholds(prev => prev.map(h => h.communeId === updated.id ? {
        ...h,
        communeCode: updated.communeCode,
        communeName: updated.communeName,
        tkcsCode: updated.tkcsCode,
        tkcsName: updated.tkcsName
      } : h));

      setEditingCommune(null);
      showNotification('success', `Đã cập nhật xã [${updated.communeCode}] ${updated.communeName} trên máy này.`);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Lỗi cập nhật thông tin xã trên máy này.');
    }
  };

  const handleCreateNewCommuneDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    const cCode = newCommuneForm.communeCode.trim();
    const cName = newCommuneForm.communeName.trim();
    if (!cCode || !cName) {
      showNotification('error', 'Vui lòng nhập đầy đủ Mã xã và Tên xã.');
      return;
    }

    const conflict = communes.find(c => c.communeCode && c.communeCode.trim().toLowerCase() === cCode.toLowerCase());
    if (conflict) {
      showNotification('error', `Mã xã [${cCode}] đã tồn tại trong Danh mục xã. Vui lòng chọn mã khác.`);
      return;
    }

    const newCommune: Commune = {
      id: 'commune-' + Date.now(),
      communeCode: cCode,
      communeName: cName,
      tkcsCode: (newCommuneForm.tkcsCode || 'TKCS-01').trim(),
      tkcsName: (newCommuneForm.tkcsName || 'Thống kê cơ sở').trim(),
    };

    try {
      setCommunes(prev => [...prev, newCommune]);
      setSelectedCatalogCommuneId(newCommune.id);
      setFormCommuneCode(newCommune.communeCode);
      setFormCommuneName(newCommune.communeName);
      setFormTkcsCode(newCommune.tkcsCode);
      setFormTkcsName(newCommune.tkcsName);
      setIsAddCommuneModalOpen(false);
      setNewCommuneForm({ communeCode: '', communeName: '', tkcsCode: '', tkcsName: '' });
      showNotification('success', `Đã thêm xã [${newCommune.communeCode}] ${newCommune.communeName} vào danh mục trên máy này.`);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Lỗi lưu xã mới trên máy này.');
    }
  };

  const handleFinalizeCommuneListImport = async (communesList: Commune[]) => {
    try {
      const map = new Map<string, Commune>();
      communes.forEach(c => map.set(c.communeCode || c.id, c));
      communesList.forEach(c => map.set(c.communeCode || c.id, c));
      const merged = Array.from(map.values());

      setCommunes(merged);
      try { localStorage.setItem('cached_communes', JSON.stringify(merged)); } catch (e) {}

      if (communesList.length > 0) {
        setSelectedCatalogCommuneId(communesList[0].id);
        setFormCommuneCode(communesList[0].communeCode);
        setFormCommuneName(communesList[0].communeName);
        setFormTkcsCode(communesList[0].tkcsCode);
        setFormTkcsName(communesList[0].tkcsName);
      }

      showNotification('success', `Đã lưu ${communesList.length} xã vào danh mục trên máy này.`);
    } catch (err) {
      console.error(err);
      showNotification('error', 'Lỗi lưu danh mục xã trên máy này.');
    }
  };

  // Update Commune/TKCS metadata for all households in the database
  // Update Commune/TKCS metadata for selected commune without creating duplicate codes
  const handleUpdateCommuneMetadata = async () => {
    if (!formCommuneName.trim() && !formCommuneCode.trim() && !formTkcsCode.trim() && !formTkcsName.trim()) {
      showNotification('error', 'Vui lòng nhập ít nhất một thông tin Tên/Mã xã hoặc Tên/Mã TKCS.');
      return;
    }

    // Determine target commune to update
    let targetCommune: Commune | undefined;
    if (selectedCommuneId !== 'ALL') {
      targetCommune = communes.find(c => c.id === selectedCommuneId);
    } else if (communes.length === 1) {
      targetCommune = communes[0];
    } else {
      showNotification('error', 'Hệ thống có nhiều xã. Vui lòng chọn một Xã cụ thể tại ô lọc trên thanh công cụ trước khi bấm Cập nhật.');
      return;
    }

    if (!targetCommune) {
      showNotification('error', 'Không tìm thấy xã để cập nhật.');
      return;
    }

    const updatedCommuneName = formCommuneName.trim() || targetCommune.communeName;
    const updatedCommuneCode = formCommuneCode.trim() || targetCommune.communeCode;
    const updatedTkcsCode = formTkcsCode.trim() || targetCommune.tkcsCode;
    const updatedTkcsName = formTkcsName.trim() || targetCommune.tkcsName;

    // Kiểm tra không để trùng mã xã với xã khác
    const codeConflict = communes.find(c => 
      c.id !== targetCommune!.id && 
      c.communeCode && 
      c.communeCode.trim().toLowerCase() === updatedCommuneCode.trim().toLowerCase()
    );

    if (codeConflict) {
      showNotification('error', `Mã xã [${updatedCommuneCode}] đã trùng với xã "${codeConflict.communeName}". Vui lòng chọn mã khác để không bị trùng nhau!`);
      return;
    }

    try {
      const targetId = targetCommune.id;

      // Update local state immediately for this commune only
      setHouseholds(prev => prev.map(h => {
        if (h.communeId !== targetId) return h;
        return {
          ...h,
          communeName: updatedCommuneName,
          communeCode: updatedCommuneCode,
          tkcsCode: updatedTkcsCode,
          tkcsName: updatedTkcsName
        };
      }));

      setCommunes(prev => prev.map(c => {
        if (c.id !== targetId) return c;
        return {
          ...c,
          communeName: updatedCommuneName,
          communeCode: updatedCommuneCode,
          tkcsCode: updatedTkcsCode,
          tkcsName: updatedTkcsName
        };
      }));

      showNotification('success', `Đã cập nhật thông tin xã [${updatedCommuneCode}] ${updatedCommuneName} thành công.`);

    } catch (err) {
      console.error(err);
      showNotification('error', 'Có lỗi khi cập nhật thông tin.');
    }
  };

  // Save imported data to state and local browser storage.
  const executeFinalizeImport = async (
    communeData: Commune,
    areasData: SurveyArea[],
    householdsData: Household[],
    skippedSheetsList: { sheetName: string; reason: string }[],
    totalCount: number,
    isOverwrite: boolean,
    oldCommuneIdsToRemove: string[] = []
  ) => {
    setUploadProgressText(`Đang lưu cục bộ ${totalCount} hộ từ ${areasData.length} địa bàn...`);

    // Ensure all matching old commune IDs by ID, code, or name are collected if isOverwrite
    const allIdsToRemove = new Set(oldCommuneIdsToRemove);
    if (isOverwrite) {
      communes.forEach(c => {
        if (
          allIdsToRemove.has(c.id) ||
          (communeData.id && c.id === communeData.id) ||
          (communeData.communeCode && c.communeCode && c.communeCode.trim().toLowerCase() === communeData.communeCode.trim().toLowerCase()) ||
          (communeData.communeName && c.communeName && c.communeName.trim().toLowerCase() === communeData.communeName.trim().toLowerCase())
        ) {
          allIdsToRemove.add(c.id);
        }
      });
    }

    const preparedAreasData: SurveyArea[] = areasData.map(a => ({
      ...a,
      communeCode: a.communeCode || communeData.communeCode
    }));

    // Update state; a shared effect persists each collection locally.
    setCommunes(prev => {
      let next: Commune[];
      if (isOverwrite) {
        next = prev.filter(c => !allIdsToRemove.has(c.id)).concat([communeData]);
      } else {
        next = [...prev, communeData];
      }
      try { localStorage.setItem('cached_communes', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    setAreas(prev => {
      let next: SurveyArea[];
      if (isOverwrite) {
        next = prev.filter(a => 
          !allIdsToRemove.has(a.communeId) && 
          a.communeId !== communeData.id &&
          (!communeData.communeCode || !a.communeCode || a.communeCode !== communeData.communeCode)
        ).concat(preparedAreasData);
      } else {
        next = [...prev, ...preparedAreasData];
      }
      try { localStorage.setItem('cached_areas', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    setHouseholds(prev => {
      let next: Household[];
      if (isOverwrite) {
        next = prev.filter(h => {
          if (allIdsToRemove.has(h.communeId)) return false;
          if (h.communeId === communeData.id) return false;
          if (communeData.communeCode && h.communeCode && h.communeCode.trim().toLowerCase() === communeData.communeCode.trim().toLowerCase()) return false;
          if (communeData.communeName && h.communeName && h.communeName.trim().toLowerCase() === communeData.communeName.trim().toLowerCase()) return false;
          return true;
        }).concat(householdsData);
      } else {
        next = [...prev, ...householdsData];
      }
      try { localStorage.setItem('cached_households', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    setSelectedCommuneId(communeData.id);
    setSelectedAreaId('ALL');
    setCurrentPage(1);
    setIsUploading(false);

    if (skippedSheetsList.length > 0) {
      setUploadReport({
        validCount: areasData.length,
        totalHouseholds: totalCount,
        skippedSheets: skippedSheetsList
      });
      showNotification('success', isOverwrite 
        ? `Đã ghi đè cục bộ xã [${communeData.communeCode}] ${communeData.communeName}: ${totalCount} hộ (${areasData.length} địa bàn).`
        : `Đã nạp cục bộ ${totalCount} hộ (${areasData.length} địa bàn).`
      );
    } else {
      showNotification('success', isOverwrite 
        ? `Đã ghi đè cục bộ dữ liệu xã [${communeData.communeCode}] ${communeData.communeName} (${areasData.length} địa bàn, ${totalCount} hộ).`
        : `Đã nhập cục bộ ${totalCount} hộ.`
      );
    }
  };

  const handleConfirmOverwriteCommune = async () => {
    if (!pendingDuplicateCommune) return;
    const { existingCommune, newCommuneData, tempAreas, tempHouseholds, skippedSheets, totalParsed } = pendingDuplicateCommune;

    const targetCommuneId = existingCommune.id;

    // Re-bind areas and households to targetCommuneId
    const reboundAreas: SurveyArea[] = tempAreas.map(a => ({
      ...a,
      id: 'area-' + targetCommuneId + '-' + a.code,
      communeId: targetCommuneId
    }));

    const reboundHouseholds: Household[] = tempHouseholds.map((h, idx) => ({
      ...h,
      id: 'hh-' + targetCommuneId + '-' + (h.areaCode || '001') + '-' + (idx + 1),
      communeId: targetCommuneId,
      areaId: 'area-' + targetCommuneId + '-' + (h.areaCode || '001'),
      communeCode: newCommuneData.communeCode,
      communeName: newCommuneData.communeName,
      tkcsCode: newCommuneData.tkcsCode || existingCommune.tkcsCode,
      tkcsName: newCommuneData.tkcsName || existingCommune.tkcsName
    }));

    // Find all duplicate communes sharing this communeCode to clean them up simultaneously
    const matchingDuplicateCommunes = communes.filter(c => 
      c.id === targetCommuneId ||
      (c.communeCode && newCommuneData.communeCode && c.communeCode.trim().toLowerCase() === newCommuneData.communeCode.trim().toLowerCase())
    );
    const oldCommuneIdsToRemove = matchingDuplicateCommunes.map(c => c.id);

    const updatedCommune: Commune = {
      ...existingCommune,
      id: targetCommuneId,
      communeCode: newCommuneData.communeCode,
      communeName: newCommuneData.communeName,
      tkcsCode: newCommuneData.tkcsCode || existingCommune.tkcsCode,
      tkcsName: newCommuneData.tkcsName || existingCommune.tkcsName,
      fileName: newCommuneData.fileName
    };

    setPendingDuplicateCommune(null);
    await executeFinalizeImport(
      updatedCommune,
      reboundAreas,
      reboundHouseholds,
      skippedSheets,
      totalParsed,
      true,
      oldCommuneIdsToRemove
    );
  };

  const handleCancelDuplicateCommune = () => {
    setPendingDuplicateCommune(null);
    showNotification('error', 'Đã hủy thao tác nạp file. Không ghi đè và không tạo thêm xã trùng mã.');
  };

  // Group communes to detect duplicates for warning banner (trùng mã xã)
  const duplicateCommunesDetected = useMemo(() => {
    const dupIds = new Set<string>();
    for (let i = 0; i < communes.length; i++) {
      for (let j = i + 1; j < communes.length; j++) {
        const c1 = communes[i];
        const c2 = communes[j];
        const sameCode = Boolean(c1.communeCode && c2.communeCode && c1.communeCode.trim().toLowerCase() === c2.communeCode.trim().toLowerCase());
        if (sameCode) {
          dupIds.add(c1.id);
          dupIds.add(c2.id);
        }
      }
    }
    return Array.from(dupIds).map(id => communes.find(c => c.id === id)!).filter(Boolean);
  }, [communes]);

  // One-click deduplication for existing duplicate communes & redundant households
  const handleDeduplicateCommunes = async () => {
    setIsDeleting(true);
    setDeleteProgressText('Đang kiểm tra và dọn dẹp các bản ghi xã trùng lặp...');

    // Connected components clustering: communes sharing the same communeCode
    const visited = new Set<string>();
    const groups: Commune[][] = [];

    communes.forEach(c => {
      if (visited.has(c.id)) return;
      const group: Commune[] = [c];
      visited.add(c.id);

      let added = true;
      while (added) {
        added = false;
        communes.forEach(other => {
          if (visited.has(other.id)) return;
          const matches = group.some(g => {
            return Boolean(g.communeCode && other.communeCode && g.communeCode.trim().toLowerCase() === other.communeCode.trim().toLowerCase());
          });
          if (matches) {
            group.push(other);
            visited.add(other.id);
            added = true;
          }
        });
      }
      groups.push(group);
    });

    let duplicateCount = 0;
    const keptCommunes: Commune[] = [];
    const communesToRemoveIds: string[] = [];
    const areasToRemoveIds: string[] = [];
    const householdsToRemoveIds: string[] = [];

    const nextHouseholds = [...households];
    const nextAreas = [...areas];

    groups.forEach(group => {
      if (group.length === 1) {
        keptCommunes.push(group[0]);
        return;
      }

      duplicateCount += (group.length - 1);
      const sorted = [...group].sort((a, b) => {
        const countA = households.filter(h => h.communeId === a.id).length;
        const countB = households.filter(h => h.communeId === b.id).length;
        return countB - countA;
      });

      const primaryCommune = sorted[0];
      keptCommunes.push(primaryCommune);

      const secondaryCommunes = sorted.slice(1);
      const secondaryIds = secondaryCommunes.map(c => c.id);
      communesToRemoveIds.push(...secondaryIds);

      // Re-assign or deduplicate areas
      const groupAreas = nextAreas.filter(a => a.communeId === primaryCommune.id || secondaryIds.includes(a.communeId));
      const seenAreaCodes = new Set<string>();
      groupAreas.forEach(a => {
        if (seenAreaCodes.has(a.code)) {
          areasToRemoveIds.push(a.id);
        } else {
          seenAreaCodes.add(a.code);
          a.communeId = primaryCommune.id;
        }
      });

      // Deduplicate households: Keep 1 household per (areaCode + sttMau + headName)
      const groupHouseholds = nextHouseholds.filter(h => h.communeId === primaryCommune.id || secondaryIds.includes(h.communeId));
      const seenHhKeys = new Set<string>();
      groupHouseholds.forEach(h => {
        const hhKey = `${h.areaCode || '001'}_${h.sttMau || ''}_${(h.householdHead || '').trim().toLowerCase()}`;
        if (seenHhKeys.has(hhKey)) {
          householdsToRemoveIds.push(h.id);
        } else {
          seenHhKeys.add(hhKey);
          h.communeId = primaryCommune.id;
          h.communeCode = primaryCommune.communeCode;
          h.communeName = primaryCommune.communeName;
        }
      });
    });

    const finalAreas = nextAreas.filter(a => !areasToRemoveIds.includes(a.id));
    const finalHouseholds = nextHouseholds.filter(h => !householdsToRemoveIds.includes(h.id));

    setCommunes(keptCommunes);
    setAreas(finalAreas);
    setHouseholds(finalHouseholds);

    try { localStorage.setItem('cached_communes', JSON.stringify(keptCommunes)); } catch (e) {}
    try { localStorage.setItem('cached_areas', JSON.stringify(finalAreas)); } catch (e) {}
    try { localStorage.setItem('cached_households', JSON.stringify(finalHouseholds)); } catch (e) {}

    showNotification('success', `Đã dọn dẹp thành công ${duplicateCount} bản ghi xã trùng lặp và loại bỏ ${householdsToRemoveIds.length} hộ dư thừa!`);
    setIsDeleting(false);
    setDeleteProgressText('');

  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setUploadProgressText('Đang đọc file Excel...');

    try {
      const file = files[0];
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      setUploadProgressText(`Đã đọc xong file. Đang kiểm tra và xử lý ${workbook.SheetNames.length} sheet...`);

      const newCommuneId = 'commune-' + Date.now();
      const existingCodes = communes.map(c => c.communeCode).filter(Boolean);
      let nextCodeNum = 1;
      while (existingCodes.includes(String(nextCodeNum).padStart(2, '0')) || existingCodes.includes(String(nextCodeNum))) {
        nextCodeNum++;
      }
      const defaultAutoCode = String(nextCodeNum).padStart(2, '0');

      const communeNameFinal = formCommuneName.trim() || file.name.replace(/\.[^/.]+$/, "").replace(/[_]/g, " ");
      const communeCodeFinal = formCommuneCode.trim() || defaultAutoCode;
      const tkcsCodeFinal = formTkcsCode.trim() || 'TKCS-01';
      const tkcsNameFinal = formTkcsName.trim() || 'TKCS';

      const tempAreas: SurveyArea[] = [];
      const tempHouseholds: Household[] = [];
      const skippedSheets: { sheetName: string; reason: string }[] = [];

      let validAreaIndex = 0;
      let totalParsed = 0;

      let firstDetectedCommuneName = '';
      let firstDetectedCommuneCode = '';

      workbook.SheetNames.forEach((sheetName) => {
        const sheetNameClean = sheetName.trim();
        const worksheet = workbook.Sheets[sheetName];
        
        if (!worksheet) {
          skippedSheets.push({ 
            sheetName: sheetNameClean, 
            reason: 'Sheet hoàn toàn không có dữ liệu (trống)' 
          });
          return;
        }

        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!rows || rows.length < 2) {
          skippedSheets.push({ 
            sheetName: sheetNameClean, 
            reason: 'Sheet bị trống hoặc có dưới 2 dòng dữ liệu' 
          });
          return;
        }

        // 1. Quét thông tin địa bàn, xã, tỉnh ở các dòng đầu (dòng 1 đến 5)
        let headerRowIdx = -1;
        let detectedAreaName = '';
        let detectedAreaCode = '';
        let detectedCommuneName = '';
        let detectedCommuneCode = '';
        let detectedProvinceName = '';

        for (let r = 0; r < Math.min(15, rows.length); r++) {
          const row = rows[r] || [];
          row.forEach((cellVal: any) => {
            const str = String(cellVal || '').trim();
            if (/Xã\/phường:\s*([^\n\r_]+)/i.test(str)) {
              const m = str.match(/Xã\/phường:\s*([^\n\r_]+)/i);
              if (m && m[1]) detectedCommuneName = m[1].trim();
            } else if (/Xã:\s*([^\n\r_]+)/i.test(str)) {
              const m = str.match(/Xã:\s*([^\n\r_]+)/i);
              if (m && m[1]) detectedCommuneName = m[1].trim();
            } else if (/Phường:\s*([^\n\r_]+)/i.test(str)) {
              const m = str.match(/Phường:\s*([^\n\r_]+)/i);
              if (m && m[1]) detectedCommuneName = m[1].trim();
            }

            if (/Mã xã:\s*([0-9]+)/i.test(str)) {
              const m = str.match(/Mã xã:\s*([0-9]+)/i);
              if (m && m[1]) detectedCommuneCode = m[1].trim();
            }

            if (/Tên địa bàn:\s*([^\n\r_]+)/i.test(str)) {
              const m = str.match(/Tên địa bàn:\s*[_]*([^\n\r_]+)/i);
              if (m && m[1]) detectedAreaName = m[1].replace(/[_]/g, ' ').trim();
            }

            if (/Mã địa bàn:\s*([0-9]+)/i.test(str)) {
              const m = str.match(/Mã địa bàn:\s*([0-9]+)/i);
              if (m && m[1]) detectedAreaCode = m[1].trim().padStart(3, '0');
            }

            if (/Tỉnh:\s*([^\n\r_]+)/i.test(str)) {
              const m = str.match(/Tỉnh:\s*([^\n\r_]+)/i);
              if (m && m[1]) detectedProvinceName = m[1].trim();
            }
          });

          // 2. Tìm dòng tiêu đề cột chính (Header Row)
          const rowText = row.map(c => String(c).toLowerCase().trim()).join(' ');
          if (
            (rowText.includes('họ và tên') || rowText.includes('chủ hộ') || rowText.includes('họ tên')) &&
            (rowText.includes('địa chỉ') || rowText.includes('nhân kh') || rowText.includes('nhân khẩu') || rowText.includes('nguồn thu') || rowText.includes('stt') || rowText.includes('trạng thái'))
          ) {
            headerRowIdx = r;
          }
        }

        if (!firstDetectedCommuneName && detectedCommuneName) firstDetectedCommuneName = detectedCommuneName;
        if (!firstDetectedCommuneCode && detectedCommuneCode) firstDetectedCommuneCode = detectedCommuneCode;

        // Cấu hình vị trí cột mặc định
        let colIdx = {
          sttMau: -1,
          status: -1,
          sttGoc: -1,
          name: -1,
          address: -1,
          members: -1,
          sector: -1,
          note: -1
        };

        if (headerRowIdx >= 0) {
          const headerRow = rows[headerRowIdx] || [];
          headerRow.forEach((cellVal: any, cIdx: number) => {
            const text = String(cellVal || '').toLowerCase().trim();
            if (text.includes('gốc') || text.includes('mã hộ')) {
              if (colIdx.sttGoc === -1) colIdx.sttGoc = cIdx;
            } else if (
              text === 'stt' || text === 'tt' || text.startsWith('stt') || text.startsWith('tt') ||
              text.includes('stt mẫu') || text.includes('thứ tự') || text.includes('số tt') || text.includes('số thứ tự')
            ) {
              if (colIdx.sttMau === -1) colIdx.sttMau = cIdx;
            } else if (text.includes('họ và tên') || text.includes('chủ hộ') || text === 'họ tên' || text.includes('tên chủ hộ')) {
              if (colIdx.name === -1) colIdx.name = cIdx;
            } else if (text.includes('địa chỉ') || text.includes('thôn') || text.includes('xóm') || text.includes('tổ') || text.includes('đội')) {
              if (colIdx.address === -1) colIdx.address = cIdx;
            } else if (
              (text.includes('nhân khẩu') || text.includes('nhân kh') || text.includes('số người') || 
               text.includes('thành viên') || text.includes('số khẩu') || text.includes('số tv') || 
               text.includes('số nk') || text === 'khẩu' || text === 'nk' ||
               (text.includes('thường trú') && !text.includes('địa chỉ') && !text.includes('nơi'))) &&
              !text.includes('thứ tự') && !text.includes('stt')
            ) {
              if (colIdx.members === -1) colIdx.members = cIdx;
            } else if (
              (text.includes('phân loại ngành') || text.includes('nguồn thu') || text.includes('thu nhập lớn nhất') || 
               text.includes('ngành kinh tế') || text.includes('mã ngành') || text.includes('mã nguồn thu') || 
               text.includes('nhóm ngành') || text.includes('loại ngành') ||
               (text.includes('ngành') && !text.includes('doanh nghiệp'))) &&
              !text.includes('tổng thu nhập') && !text.includes('tổng thu') && !text.includes('bình quân') && !text.includes('tnbq')
            ) {
              if (colIdx.sector === -1) colIdx.sector = cIdx;
            } else if (
              text.includes('trạng thái') || 
              text.includes('loại mẫu') || 
              text.includes('phân loại mẫu') || 
              text.includes('mẫu điều tra') || 
              text.includes('chính thức') || 
              text.includes('dự phòng') ||
              text === 'mẫu' ||
              text === 'loại' ||
              text.includes('hộ mẫu') ||
              text.includes('mẫu hộ')
            ) {
              if (colIdx.status === -1) colIdx.status = cIdx;
            } else if (text.includes('ghi chú') || text.includes('sđt') || text.includes('điện thoại')) {
              if (colIdx.note === -1) colIdx.note = cIdx;
            }
          });
        }

        // 3. Xác định dòng bắt đầu dữ liệu hộ (Bỏ qua dòng 7 là dòng Ký hiệu cột A, B, C, 1, 2, 3...)
        let startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
        for (let checkR = startRow; checkR < Math.min(startRow + 4, rows.length); checkR++) {
          const rowCells = (rows[checkR] || []).map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          const rText = rowCells.join(' ');
          
          // Kiểm tra xem dòng có phải là dòng ký hiệu mã cột (Ví dụ: ["A", "B", "C", "1", "2", "3"] hoặc chứa chữ KÝ HIỆU, hoặc dòng 7 index 6)
          const isColumnCodeRow = (rowCells.length > 0 && rowCells.every(cell => 
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
             '(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)', '(H)', '(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)'].includes(cell)
          )) || rText.includes('KÝ HIỆU') || rText.includes('KY HIEU') || checkR === 6;

          if (isColumnCodeRow || rText === 'A B C 1 2 3 4' || rText === 'A B C D E 1 2 3 4' || rText === 'A B C D E F G H I') {
            startRow = checkR + 1;
          }
        }

        // Tên địa bàn lấy chính xác 100% theo tên sheet
        const areaNameFinal = sheetNameClean;
        let sheetHouseholdCount = 0;
        const sheetHouseholds: Household[] = [];

        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          // Bỏ qua dòng 7 nếu là dòng Ký hiệu cột theo mẫu bảng kê chuẩn
          if (r === 6) {
            const rCells = row.map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
            const isSym = rCells.some(c => c.includes('KÝ HIỆU') || c.includes('KY HIEU') || c === 'A' || c === 'B' || c === '(A)' || c === '(1)' || c === '1');
            if (isSym) continue;
          }

          // Bỏ qua dòng trống hoàn toàn
          const rowStringAll = row.map(c => String(c || '').trim()).join(' ');
          if (!rowStringAll) continue;

          // Bỏ qua phần ghi chú hướng dẫn ở cuối bảng
          const lowerAll = rowStringAll.toLowerCase();
          if (
            lowerAll.includes('hướng dẫn') ||
            lowerAll.includes('mã nguồn thu') ||
            lowerAll.includes('1: nông lâm') ||
            lowerAll.includes('2: công nghiệp') ||
            lowerAll.includes('tổng số hộ mẫu') ||
            lowerAll.includes('bảng kê hộ mẫu')
          ) {
            continue;
          }

          // Phân tích thông minh các ô trong dòng dữ liệu hộ
          let rawName = colIdx.name >= 0 ? String(row[colIdx.name] || '').trim() : '';

          // Nếu colIdx.name không chuẩn hoặc chứa số/từ khóa tiêu đề, tự tìm ô tên chủ hộ hợp lệ
          if (!rawName || rawName.length < 2 || /^\d+$/.test(rawName) || rawName.startsWith('(') || rawName.toUpperCase().includes('CHÍNH THỨC') || rawName.toUpperCase().includes('DỰ PHÒNG')) {
            for (let c = 0; c < row.length; c++) {
              const cand = String(row[c] || '').trim();
              if (
                cand.length >= 2 &&
                !/^\d+$/.test(cand) &&
                !cand.startsWith('(') &&
                !cand.toUpperCase().includes('CHÍNH THỨC') &&
                !cand.toUpperCase().includes('DỰ PHÒNG') &&
                !cand.toLowerCase().includes('bảng kê') &&
                !cand.toLowerCase().includes('điều tra') &&
                !cand.toLowerCase().includes('họ và tên') &&
                !cand.toLowerCase().includes('stt') &&
                !cand.toLowerCase().includes('xã/phường') &&
                !cand.toLowerCase().includes('tỉnh:')
              ) {
                // Ưu tiên ô có cấu trúc giống tên người (2 từ trở lên và không chứa từ chỉ địa chỉ)
                const wordCount = cand.split(/\s+/).length;
                if (wordCount >= 2 && !cand.toLowerCase().startsWith('xóm') && !cand.toLowerCase().startsWith('thôn') && !cand.toLowerCase().startsWith('tổ')) {
                  rawName = cand;
                  break;
                }
              }
            }
          }

          if (!rawName || rawName.length < 2 || rawName.startsWith('(')) continue;
          const upperName = rawName.toUpperCase();
          if (
            upperName.startsWith('(') || 
            upperName === 'A' || upperName === 'B' || upperName === 'C' || 
            upperName === 'D' || upperName === 'E' || upperName === '1' || upperName === '2' || 
            upperName === '3' || upperName === '4' || upperName.includes('(A)') || 
            upperName.includes('(B)') || upperName.includes('(1)') || upperName.includes('(2)')
          ) {
            continue;
          }

          const lowerName = rawName.toLowerCase();
          if (
            lowerName.includes('họ và tên') ||
            lowerName.includes('bảng kê') ||
            lowerName.includes('điều tra') ||
            lowerName.includes('tổng số') ||
            lowerName.includes('ubnd') ||
            lowerName.includes('cộng hòa') ||
            lowerName.includes('địa bàn:') ||
            lowerName.includes('xã/phường:') ||
            lowerName.includes('tỉnh:')
          ) {
            continue;
          }

          sheetHouseholdCount++;

          // Tự động phân loại mẫu: CHÍNH THỨC hoặc DỰ PHÒNG
          let statusVal: 'CHÍNH THỨC' | 'DỰ PHÒNG' = 'CHÍNH THỨC';
          
          // 1. Ưu tiên hàng đầu: Lấy từ cột Trạng thái mẫu nếu có trong file
          if (colIdx.status >= 0 && row[colIdx.status] !== undefined && row[colIdx.status] !== null) {
            const sCell = String(row[colIdx.status] || '').trim().toUpperCase();
            if (sCell.includes('CHÍNH THỨC') || sCell.includes('CHINH THUC') || sCell === 'CT' || sCell === '1') {
              statusVal = 'CHÍNH THỨC';
            } else if (
              sCell.includes('DỰ PHÒNG') || 
              sCell.includes('DU PHONG') || 
              sCell === 'DP' || 
              (!sCell.includes('TDP') && /(^|\s+)DP(\s*|\d+|$)/i.test(sCell)) || 
              sCell === '2' || 
              sCell.includes('DỰ')
            ) {
              statusVal = 'DỰ PHÒNG';
            }
          } else {
            // 2. Nếu không có cột trạng thái mẫu: tìm trong các ô khác nhưng TUYỆT ĐỐI LOẠI TRỪ cột địa chỉ, tên, STT để tránh nhầm chữ "TDP" (Tổ dân phố)
            let foundStatus = false;
            for (let c = 0; c < row.length; c++) {
              if (c === colIdx.address || c === colIdx.name || c === colIdx.sttMau || c === colIdx.sttGoc) continue;
              const cellStr = String(row[c] || '').trim().toUpperCase();
              if (!cellStr) continue;
              if (cellStr.includes('CHÍNH THỨC') || cellStr.includes('CHINH THUC') || cellStr === 'CT') {
                statusVal = 'CHÍNH THỨC';
                foundStatus = true;
                break;
              } else if (cellStr.includes('DỰ PHÒNG') || cellStr.includes('DU PHONG')) {
                statusVal = 'DỰ PHÒNG';
                foundStatus = true;
                break;
              } else if (!cellStr.includes('TDP') && !cellStr.includes('TỔ DÂN PHỐ') && /(^|\s+)DP(\s*|\d+|$)/i.test(cellStr)) {
                statusVal = 'DỰ PHÒNG';
                foundStatus = true;
                break;
              }
            }

            // 3. Quy ước chuẩn Tổng cục Thống kê: trong 1 địa bàn thường có 14 hộ
            // 10 hộ đầu (sheetHouseholdCount <= 10) là CHÍNH THỨC, 4 hộ tiếp theo (> 10) là DỰ PHÒNG
            if (!foundStatus) {
              if (sheetHouseholdCount > 10) {
                statusVal = 'DỰ PHÒNG';
              } else {
                statusVal = 'CHÍNH THỨC';
              }
            }
          }

          // STT mẫu & STT gốc
          let sttMauVal = colIdx.sttMau >= 0 ? String(row[colIdx.sttMau] || '').trim() : '';
          if (!sttMauVal || !/^\d+$/.test(sttMauVal)) {
            // Tự tìm ô chứa số STT ở các cột đầu
            for (let c = 0; c < Math.min(row.length, 4); c++) {
              const val = String(row[c] || '').trim();
              if (/^\d+$/.test(val)) {
                sttMauVal = val;
                break;
              }
            }
          }
          if (!sttMauVal || !/^\d+$/.test(sttMauVal)) {
            sttMauVal = String(sheetHouseholdCount);
          }

          let sttGocVal = colIdx.sttGoc >= 0 ? String(row[colIdx.sttGoc] || '').trim() : '';
          if (!sttGocVal || !/^\d+$/.test(sttGocVal)) {
            sttGocVal = sttMauVal;
          }

          // Địa chỉ của hộ
          let addressVal = colIdx.address >= 0 ? String(row[colIdx.address] || '').trim() : '';
          if (!addressVal || addressVal === rawName || /^\d+$/.test(addressVal)) {
            // Tự tìm ô địa chỉ (chứa xóm, thôn, tổ, đội, x7...)
            for (let c = 0; c < row.length; c++) {
              const cand = String(row[c] || '').trim();
              const candLower = cand.toLowerCase();
              if (
                candLower.includes('thôn') || candLower.includes('xóm') || candLower.includes('tổ') ||
                candLower.includes('đội') || candLower.includes('số') || candLower.startsWith('x')
              ) {
                addressVal = cand;
                break;
              }
            }
          }
          if (!addressVal || addressVal === rawName) {
            addressVal = areaNameFinal;
          }

          // Số nhân khẩu thực tế - Tuyệt đối không lấy nhầm sang STT Mẫu hay STT Gốc
          let membersVal = colIdx.members >= 0 && colIdx.members !== colIdx.sttMau && colIdx.members !== colIdx.sttGoc 
            ? Number(row[colIdx.members]) 
            : NaN;
          if (isNaN(membersVal) || membersVal <= 0 || membersVal > 25 || String(membersVal) === sttMauVal || String(membersVal) === sttGocVal) {
            // Tự tìm ô số nhân khẩu hợp lệ (loại trừ STT, Họ tên, Địa chỉ, STT gốc)
            let foundMem = false;
            for (let c = 0; c < row.length; c++) {
              if (c === colIdx.sttMau || c === colIdx.sttGoc || c === colIdx.name || c === colIdx.address || c === 0) continue;
              const num = Number(row[c]);
              if (!isNaN(num) && num >= 1 && num <= 15 && String(num) !== sttMauVal && String(num) !== sttGocVal) {
                membersVal = num;
                foundMem = true;
                break;
              }
            }
            if (!foundMem) {
              membersVal = 0; // Để 0 theo đúng thực tế nếu không có trong file, không tự gán bừa
            }
          }

          // Nguồn thu nhập lớn nhất (1-4)
          let sectorVal: 1 | 2 | 3 | 4 = 2;
          const explicitMatch = rowStringAll.match(/Loại\s*([1-4])/i);
          if (explicitMatch) {
            sectorVal = Number(explicitMatch[1]) as 1 | 2 | 3 | 4;
          } else if (colIdx.sector >= 0 && row[colIdx.sector] !== undefined) {
            const rawSector = String(row[colIdx.sector] || '').trim();
            const sectorMatch = rawSector.match(/^[1-4]$/);
            if (sectorMatch) {
              sectorVal = Number(sectorMatch[0]) as 1 | 2 | 3 | 4;
            } else if (rawSector.toLowerCase().includes('nông') || rawSector.toLowerCase().includes('lâm') || rawSector.toLowerCase().includes('thủy sản')) {
              sectorVal = 1;
            } else if (rawSector.toLowerCase().includes('công nghiệp') || rawSector.toLowerCase().includes('xây dựng')) {
              sectorVal = 2;
            } else if (rawSector.toLowerCase().includes('thương mại') || rawSector.toLowerCase().includes('dịch vụ')) {
              sectorVal = 3;
            } else if (rawSector.toLowerCase().includes('khác') || rawSector.toLowerCase().includes('lương') || rawSector.toLowerCase().includes('trợ cấp')) {
              sectorVal = 4;
            }
          } else {
            // Quét qua các ô thuộc dòng (loại trừ các cột STT, Họ tên, Địa chỉ, Nhân khẩu)
            for (let c = 0; c < row.length; c++) {
              if (c === colIdx.sttMau || c === colIdx.sttGoc || c === colIdx.name || c === colIdx.address || c === colIdx.members) continue;
              const strC = String(row[c] || '').trim();
              if (/^[1-4]$/.test(strC)) {
                sectorVal = Number(strC) as 1 | 2 | 3 | 4;
                break;
              } else if (strC.toLowerCase().includes('nông') || strC.toLowerCase().includes('lâm') || strC.toLowerCase().includes('trồng')) {
                sectorVal = 1; break;
              } else if (strC.toLowerCase().includes('công nghiệp') || strC.toLowerCase().includes('xây dựng')) {
                sectorVal = 2; break;
              } else if (strC.toLowerCase().includes('thương mại') || strC.toLowerCase().includes('dịch vụ')) {
                sectorVal = 3; break;
              } else if (strC.toLowerCase().includes('thu khác') || strC.toLowerCase().includes('tiền lương') || strC.toLowerCase().includes('trợ cấp')) {
                sectorVal = 4; break;
              }
            }
          }

          // Ghi chú & SĐT
          let noteVal = colIdx.note >= 0 ? String(row[colIdx.note] || '').trim() : '';
          let phoneVal = '';
          const phoneMatch = (rowStringAll).match(/0\d{8,10}/);
          if (phoneMatch) {
            phoneVal = phoneMatch[0];
          }

          const tempHh: any = {
            communeId: newCommuneId,
            tkcsCode: tkcsCodeFinal,
            tkcsName: tkcsNameFinal,
            communeCode: communeCodeFinal || detectedCommuneCode || '01',
            communeName: communeNameFinal || detectedCommuneName || 'Xã/Phường',
            areaName: areaNameFinal,
            sheetName: areaNameFinal,
            sttMau: sttMauVal,
            sampleStatus: statusVal,
            sttGoc: sttGocVal,
            householdHead: rawName,
            address: addressVal,
            phone: phoneVal,
            membersCount: membersVal,
            workingMembersCount: 0,
            membersCountEntered: false,
            sectorCode: sectorVal as 1 | 2 | 3 | 4,
            sectorName: SECTOR_NAMES[sectorVal as 1 | 2 | 3 | 4] || 'Công nghiệp xây dựng',
            note: noteVal,
            surveyStatus: 'CHUA_NHAP',
            assignedSurveyorId: '',
            assignedSurveyorName: '',
            questionnaire: createDefaultQuestionnaire()
          };
          sheetHouseholds.push(tempHh);
        }

        // Kiểm tra xem sheet có dòng hộ hợp lệ không
        if (sheetHouseholdCount === 0) {
          skippedSheets.push({
            sheetName: sheetNameClean,
            reason: 'Không tìm thấy dòng hộ hợp lệ (Sheet ghi chú, hướng dẫn hoặc sai mẫu bảng kê)'
          });
          return;
        }

        // Địa bàn hợp lệ -> Đánh mã địa bàn chuẩn liên tục từ 001 đến hết tính từ trái qua phải
        validAreaIndex++;
        const areaCode = String(validAreaIndex).padStart(3, '0');
        const areaId = 'area-' + newCommuneId + '-' + areaCode;

        const finalizedHouseholds: Household[] = sheetHouseholds.map((h, hIdx) => ({
          ...h,
          id: 'hh-' + newCommuneId + '-' + areaCode + '-' + (hIdx + 1),
          areaId: areaId,
          areaCode: areaCode,
          areaName: areaNameFinal,
          sheetName: areaNameFinal
        }));

        tempHouseholds.push(...finalizedHouseholds);
        totalParsed += finalizedHouseholds.length;

        const newArea: SurveyArea = {
          id: areaId,
          communeId: newCommuneId,
          communeCode: communeCodeFinal || detectedCommuneCode || '',
          code: areaCode,
          name: areaNameFinal,
          householdCount: finalizedHouseholds.length
        };
        tempAreas.push(newArea);
      });

      if (totalParsed === 0) {
        setIsUploading(false);
        showNotification('error', `Không tìm thấy dòng hộ gia đình hợp lệ nào trong ${workbook.SheetNames.length} sheet. Vui lòng kiểm tra lại cấu trúc file Excel.`);
        e.target.value = '';
        return;
      }

      // Xác định chính xác Mã & Tên Xã cuối cùng (Ưu tiên form người dùng đã chọn/nhập -> phát hiện từ file -> tên file)
      const resolvedCommuneName = formCommuneName.trim() || firstDetectedCommuneName || communeNameFinal;
      const resolvedCommuneCode = formCommuneCode.trim() || firstDetectedCommuneCode || communeCodeFinal;
      const resolvedTkcsCode = formTkcsCode.trim() || tkcsCodeFinal;
      const resolvedTkcsName = formTkcsName.trim() || tkcsNameFinal;

      // Cập nhật lên form cấu hình
      if (!formCommuneName.trim() && resolvedCommuneName) setFormCommuneName(resolvedCommuneName);
      if (!formCommuneCode.trim() && resolvedCommuneCode) setFormCommuneCode(resolvedCommuneCode);

      // Tìm xã tương ứng trong Danh mục xã (theo ID đã chọn hoặc Mã xã)
      const existingCommune = communes.find(c => 
        (selectedCatalogCommuneId && selectedCatalogCommuneId !== 'CUSTOM' && c.id === selectedCatalogCommuneId) ||
        Boolean(c.communeCode && resolvedCommuneCode && c.communeCode.trim().toLowerCase() === resolvedCommuneCode.trim().toLowerCase())
      );

      const targetCommuneId = existingCommune ? existingCommune.id : newCommuneId;
      const targetCommune: Commune = existingCommune ? {
        ...existingCommune,
        communeCode: resolvedCommuneCode,
        communeName: resolvedCommuneName,
        tkcsCode: resolvedTkcsCode || existingCommune.tkcsCode,
        tkcsName: resolvedTkcsName || existingCommune.tkcsName,
        fileName: file.name
      } : {
        id: targetCommuneId,
        communeCode: resolvedCommuneCode,
        communeName: resolvedCommuneName,
        tkcsCode: resolvedTkcsCode,
        tkcsName: resolvedTkcsName,
        fileName: file.name
      };

      // Gắn chính xác ID địa bàn và hộ theo targetCommuneId
      const finalizedAreas: SurveyArea[] = tempAreas.map(a => ({
        ...a,
        id: 'area-' + targetCommuneId + '-' + a.code,
        communeId: targetCommuneId
      }));

      const finalizedHouseholds: Household[] = tempHouseholds.map((h, idx) => ({
        ...h,
        id: 'hh-' + targetCommuneId + '-' + (h.areaCode || '001') + '-' + (idx + 1),
        communeId: targetCommuneId,
        areaId: 'area-' + targetCommuneId + '-' + (h.areaCode || '001'),
        communeCode: targetCommune.communeCode,
        communeName: targetCommune.communeName,
        tkcsCode: targetCommune.tkcsCode,
        tkcsName: targetCommune.tkcsName,
        areaName: h.areaName || '',
        sheetName: (h as any).sheetName || h.areaName || ''
      }));

      // Ghi đè / cập nhật trực tiếp danh sách hộ cho xã này
      await executeFinalizeImport(
        targetCommune,
        finalizedAreas,
        finalizedHouseholds,
        skippedSheets,
        totalParsed,
        true,
        existingCommune ? [existingCommune.id] : []
      );

      // Hiển thị toàn bộ các hộ vừa nạp thuộc xã này, không giới hạn địa bàn đơn lẻ
      setSelectedCommuneId(targetCommuneId);
      setSelectedTkcs(targetCommune.tkcsCode || 'ALL');
      setSelectedAreaId('ALL');
      setCurrentPage(1);

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      showNotification('error', 'Lỗi khi đọc file Excel. Vui lòng kiểm tra lại định dạng file.');
    }
    e.target.value = '';
  };

  // Nạp bảng kê trực tiếp cho từng xã từ danh sách lưới
  const handleUploadForCommune = async (commune: Commune, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    setIsUploading(true);
    setUploadProgressText(`Đang đọc file bảng kê cho [${commune.communeCode}] ${commune.communeName}...`);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      const tempAreas: SurveyArea[] = [];
      const tempHouseholds: Household[] = [];
      const skippedSheets: { sheetName: string; reason: string }[] = [];
      let validAreaIndex = 0;
      let totalParsed = 0;

      workbook.SheetNames.forEach((sheetName) => {
        const sheetNameClean = sheetName.trim();
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) return;

        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        if (!rows || rows.length < 2) return;

        let headerRowIdx = -1;
        let detectedAreaName = '';

        for (let r = 0; r < Math.min(15, rows.length); r++) {
          const row = rows[r] || [];
          row.forEach((cellVal: any) => {
            const str = String(cellVal || '').trim();
            if (/Tên địa bàn:\s*([^\n\r_]+)/i.test(str)) {
              const m = str.match(/Tên địa bàn:\s*[_]*([^\n\r_]+)/i);
              if (m && m[1]) detectedAreaName = m[1].replace(/[_]/g, ' ').trim();
            }
          });
          const rowText = row.map(c => String(c).toLowerCase().trim()).join(' ');
          if (
            (rowText.includes('họ và tên') || rowText.includes('chủ hộ') || rowText.includes('họ tên')) &&
            (rowText.includes('địa chỉ') || rowText.includes('nhân kh') || rowText.includes('nhân khẩu') || rowText.includes('nguồn thu') || rowText.includes('stt') || rowText.includes('trạng thái'))
          ) {
            headerRowIdx = r;
          }
        }

        const areaNameFinal = sheetNameClean;
        const colIdx = {
          sttMau: -1,
          sampleStatus: -1,
          sttGoc: -1,
          headName: -1,
          address: -1,
          phone: -1,
          members: -1,
          sector: -1,
          note: -1
        };

        if (headerRowIdx !== -1) {
          const headerRow = rows[headerRowIdx] || [];
          headerRow.forEach((val: any, idx: number) => {
            const h = String(val || '').toLowerCase().trim();
            if (
              h.includes('chính thức') || 
              h.includes('dự phòng') || 
              h.includes('loại mẫu') || 
              h.includes('phân loại mẫu') || 
              h.includes('mẫu điều tra') || 
              h === 'mẫu' || 
              h === 'loại' ||
              h.includes('trạng thái') ||
              h.includes('hộ mẫu') ||
              h.includes('mẫu hộ')
            ) {
              colIdx.sampleStatus = idx;
            } else if (h.includes('stt gốc') || h.includes('mã hộ') || (h.includes('gốc') && h.includes('stt'))) {
              colIdx.sttGoc = idx;
            } else if (
              h === 'stt' || h === 'tt' || h.startsWith('stt') || h.startsWith('tt') ||
              h.includes('stt mẫu') || h.includes('thứ tự') || h.includes('số tt') || h.includes('số thứ tự')
            ) {
              if (colIdx.sttMau === -1) colIdx.sttMau = idx;
            } else if (h.includes('họ và tên') || h.includes('họ tên') || h.includes('chủ hộ') || h.includes('tên chủ hộ')) {
              colIdx.headName = idx;
            } else if (h.includes('địa chỉ') || h.includes('thôn') || h.includes('xóm') || h.includes('tổ') || h.includes('đội')) {
              colIdx.address = idx;
            } else if (h.includes('điện thoại') || h.includes('sđt') || h.includes('liên hệ')) {
              colIdx.phone = idx;
            } else if (
              (h.includes('nhân khẩu') || h.includes('số người') || h.includes('thành viên') || 
               h.includes('số nk') || h.includes('số khẩu') || h.includes('số tv') || h === 'khẩu' || h === 'nk' ||
               (h.includes('thường trú') && !h.includes('địa chỉ') && !h.includes('nơi'))) &&
              !h.includes('thứ tự') && !h.includes('stt')
            ) {
              colIdx.members = idx;
            } else if (
              (h.includes('phân loại ngành') || h.includes('nguồn thu') || h.includes('thu nhập lớn nhất') || 
               h.includes('ngành kinh tế') || h.includes('mã ngành') || 
               h.includes('mã nguồn thu') || h.includes('nhóm ngành') || h.includes('loại ngành') ||
               (h.includes('ngành') && !h.includes('doanh nghiệp'))) &&
              !h.includes('tổng thu nhập') && !h.includes('tổng thu') && !h.includes('bình quân') && !h.includes('tnbq')
            ) {
              colIdx.sector = idx;
            } else if (h.includes('ghi chú') || h.includes('note')) {
              colIdx.note = idx;
            }
          });
        }

        // Bỏ qua dòng 7 là dòng Ký hiệu (A, B, C, 1, 2, 3...)
        let startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;
        for (let checkR = startRow; checkR < Math.min(startRow + 4, rows.length); checkR++) {
          const rowCells = (rows[checkR] || []).map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
          const rText = rowCells.join(' ');
          const isColumnCodeRow = (rowCells.length > 0 && rowCells.every(cell => 
            ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
             '(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)', '(H)', '(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)'].includes(cell)
          )) || rText.includes('KÝ HIỆU') || rText.includes('KY HIEU') || checkR === 6;

          if (isColumnCodeRow) {
            startRow = checkR + 1;
          }
        }

        const sheetHouseholds: any[] = [];
        let sheetHouseholdCount = 0;

        for (let r = startRow; r < rows.length; r++) {
          const row = rows[r] || [];
          if (!row || row.length === 0) continue;

          // Bỏ qua dòng 7 nếu là dòng Ký hiệu cột theo mẫu bảng kê chuẩn
          if (r === 6) {
            const rCells = row.map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
            const isSym = rCells.some(c => c.includes('KÝ HIỆU') || c.includes('KY HIEU') || c === 'A' || c === 'B' || c === '(A)' || c === '(1)' || c === '1');
            if (isSym) continue;
          }

          let rawName = colIdx.headName >= 0 ? String(row[colIdx.headName] || '').trim() : '';
          if (!rawName || /^\d+$/.test(rawName)) {
            for (let c = 0; c < Math.min(row.length, 8); c++) {
              const cand = String(row[c] || '').trim();
              if (
                cand.length >= 2 &&
                !/^\d+$/.test(cand) &&
                !cand.toUpperCase().includes('CHÍNH THỨC') &&
                !cand.toUpperCase().includes('DỰ PHÒNG') &&
                !cand.toLowerCase().includes('bảng kê') &&
                !cand.toLowerCase().includes('điều tra') &&
                !cand.toLowerCase().includes('họ và tên') &&
                !cand.toLowerCase().includes('stt') &&
                !cand.toLowerCase().includes('xã/phường') &&
                !cand.toLowerCase().includes('tỉnh:')
              ) {
                const wordCount = cand.split(/\s+/).length;
                if (wordCount >= 2 && !cand.toLowerCase().startsWith('xóm') && !cand.toLowerCase().startsWith('thôn') && !cand.toLowerCase().startsWith('tổ')) {
                  rawName = cand;
                  break;
                }
              }
            }
          }

          if (!rawName || rawName.length < 2 || rawName.startsWith('(')) continue;
          const upperName = rawName.toUpperCase();
          if (
            upperName.startsWith('(') || 
            upperName === 'A' || upperName === 'B' || upperName === 'C' || 
            upperName === 'D' || upperName === 'E' || upperName === '1' || upperName === '2' || 
            upperName === '3' || upperName === '4' || upperName.includes('(A)') || 
            upperName.includes('(B)') || upperName.includes('(1)') || upperName.includes('(2)')
          ) {
            continue;
          }

          const lowerName = rawName.toLowerCase();
          if (
            lowerName.includes('họ và tên') ||
            lowerName.includes('bảng kê') ||
            lowerName.includes('điều tra') ||
            lowerName.includes('tổng số') ||
            lowerName.includes('ubnd') ||
            lowerName.includes('cộng hòa') ||
            lowerName.includes('địa bàn:') ||
            lowerName.includes('xã/phường:') ||
            lowerName.includes('tỉnh:')
          ) {
            continue;
          }

          sheetHouseholdCount++;

          let statusVal: 'CHÍNH THỨC' | 'DỰ PHÒNG' = 'CHÍNH THỨC';
          
          // 1. Ưu tiên hàng đầu: Lấy từ cột Trạng thái mẫu nếu có trong file
          if (colIdx.sampleStatus >= 0 && row[colIdx.sampleStatus] !== undefined && row[colIdx.sampleStatus] !== null) {
            const sCell = String(row[colIdx.sampleStatus] || '').trim().toUpperCase();
            if (sCell.includes('CHÍNH THỨC') || sCell.includes('CHINH THUC') || sCell === 'CT' || sCell === '1') {
              statusVal = 'CHÍNH THỨC';
            } else if (
              sCell.includes('DỰ PHÒNG') || 
              sCell.includes('DU PHONG') || 
              sCell === 'DP' || 
              (!sCell.includes('TDP') && /(^|\s+)DP(\s*|\d+|$)/i.test(sCell)) || 
              sCell === '2' || 
              sCell.includes('DỰ')
            ) {
              statusVal = 'DỰ PHÒNG';
            }
          } else {
            // 2. Nếu không có cột trạng thái mẫu: tìm trong các ô khác nhưng TUYỆT ĐỐI LOẠI TRỪ cột địa chỉ, tên, STT để tránh nhầm chữ "TDP" (Tổ dân phố)
            let foundStatus = false;
            for (let c = 0; c < row.length; c++) {
              if (c === colIdx.address || c === colIdx.headName || c === colIdx.sttMau || c === colIdx.sttGoc) continue;
              const cellStr = String(row[c] || '').trim().toUpperCase();
              if (!cellStr) continue;
              if (cellStr.includes('CHÍNH THỨC') || cellStr.includes('CHINH THUC') || cellStr === 'CT') {
                statusVal = 'CHÍNH THỨC';
                foundStatus = true;
                break;
              } else if (cellStr.includes('DỰ PHÒNG') || cellStr.includes('DU PHONG')) {
                statusVal = 'DỰ PHÒNG';
                foundStatus = true;
                break;
              } else if (!cellStr.includes('TDP') && !cellStr.includes('TỔ DÂN PHỐ') && /(^|\s+)DP(\s*|\d+|$)/i.test(cellStr)) {
                statusVal = 'DỰ PHÒNG';
                foundStatus = true;
                break;
              }
            }

            // 3. Quy ước chuẩn Tổng cục Thống kê: trong 1 địa bàn gồm 14 hộ
            // 10 hộ đầu (sheetHouseholdCount <= 10) là CHÍNH THỨC, 4 hộ tiếp theo (> 10) là DỰ PHÒNG
            if (!foundStatus) {
              if (sheetHouseholdCount > 10) {
                statusVal = 'DỰ PHÒNG';
              } else {
                statusVal = 'CHÍNH THỨC';
              }
            }
          }

          let sttMauVal = colIdx.sttMau >= 0 ? String(row[colIdx.sttMau] || '').trim() : '';
          if (!sttMauVal || !/^\d+$/.test(sttMauVal)) {
            for (let c = 0; c < Math.min(row.length, 4); c++) {
              const val = String(row[c] || '').trim();
              if (/^\d+$/.test(val)) {
                sttMauVal = val;
                break;
              }
            }
          }
          if (!sttMauVal || !/^\d+$/.test(sttMauVal)) sttMauVal = String(sheetHouseholdCount);

          let sttGocVal = colIdx.sttGoc >= 0 ? String(row[colIdx.sttGoc] || '').trim() : '';
          if (!sttGocVal || !/^\d+$/.test(sttGocVal)) sttGocVal = sttMauVal;

          let addressVal = colIdx.address >= 0 ? String(row[colIdx.address] || '').trim() : '';
          if (!addressVal || addressVal === rawName || /^\d+$/.test(addressVal)) {
            for (let c = 0; c < row.length; c++) {
              const cand = String(row[c] || '').trim();
              const candLower = cand.toLowerCase();
              if (
                candLower.includes('thôn') || candLower.includes('xóm') || candLower.includes('tổ') ||
                candLower.includes('đội') || candLower.includes('số') || candLower.startsWith('x')
              ) {
                addressVal = cand;
                break;
              }
            }
          }
          if (!addressVal || addressVal === rawName) addressVal = areaNameFinal;

          let membersVal = colIdx.members >= 0 && colIdx.members !== colIdx.sttMau && colIdx.members !== colIdx.sttGoc 
            ? Number(row[colIdx.members]) 
            : NaN;
          if (isNaN(membersVal) || membersVal <= 0 || membersVal > 25 || String(membersVal) === sttMauVal || String(membersVal) === sttGocVal) {
            let foundMem = false;
            for (let c = 0; c < row.length; c++) {
              if (c === colIdx.sttMau || c === colIdx.sttGoc || c === colIdx.headName || c === colIdx.address || c === 0) continue;
              const num = Number(row[c]);
              if (!isNaN(num) && num >= 1 && num <= 15 && String(num) !== sttMauVal && String(num) !== sttGocVal) {
                membersVal = num;
                foundMem = true;
                break;
              }
            }
            if (!foundMem) {
              membersVal = 0; // Để 0 theo đúng thực tế nếu không có trong file, không tự gán bừa
            }
          }

          let sectorVal: 1 | 2 | 3 | 4 = 2;
          const fullRowText = row.map((c: any) => String(c || '').trim()).join(' ');
          const explicitMatch2 = fullRowText.match(/Loại\s*([1-4])/i);
          if (explicitMatch2) {
            sectorVal = Number(explicitMatch2[1]) as 1 | 2 | 3 | 4;
          } else if (colIdx.sector >= 0 && row[colIdx.sector] !== undefined) {
            const rawSec = String(row[colIdx.sector] || '').trim();
            const num = Number(rawSec);
            if ([1, 2, 3, 4].includes(num)) {
              sectorVal = num as 1 | 2 | 3 | 4;
            } else if (rawSec.toLowerCase().includes('nông') || rawSec.toLowerCase().includes('lâm') || rawSec.toLowerCase().includes('thủy sản')) {
              sectorVal = 1;
            } else if (rawSec.toLowerCase().includes('công nghiệp') || rawSec.toLowerCase().includes('xây dựng')) {
              sectorVal = 2;
            } else if (rawSec.toLowerCase().includes('thương mại') || rawSec.toLowerCase().includes('dịch vụ')) {
              sectorVal = 3;
            } else if (rawSec.toLowerCase().includes('khác') || rawSec.toLowerCase().includes('lương')) {
              sectorVal = 4;
            }
          } else {
            for (let c = 0; c < row.length; c++) {
              if (c === colIdx.sttMau || c === colIdx.sttGoc || c === colIdx.headName || c === colIdx.address || c === colIdx.members) continue;
              const cellStr = String(row[c] || '').trim();
              if (/^[1-4]$/.test(cellStr)) {
                sectorVal = Number(cellStr) as 1 | 2 | 3 | 4;
                break;
              } else if (cellStr.toLowerCase().includes('nông') || cellStr.toLowerCase().includes('lâm')) {
                sectorVal = 1; break;
              } else if (cellStr.toLowerCase().includes('thương mại') || cellStr.toLowerCase().includes('dịch vụ')) {
                sectorVal = 3; break;
              } else if (cellStr.toLowerCase().includes('thu khác') || cellStr.toLowerCase().includes('tiền lương')) {
                sectorVal = 4; break;
              }
            }
          }

          let phoneVal = colIdx.phone >= 0 ? String(row[colIdx.phone] || '').trim() : '';
          let noteVal = colIdx.note >= 0 ? String(row[colIdx.note] || '').trim() : '';

          const tempHh: any = {
            communeCode: commune.communeCode,
            communeName: commune.communeName,
            tkcsCode: commune.tkcsCode || '',
            tkcsName: commune.tkcsName || '',
            areaName: areaNameFinal,
            sheetName: areaNameFinal,
            sttMau: sttMauVal,
            sampleStatus: statusVal,
            sttGoc: sttGocVal,
            householdHead: rawName,
            address: addressVal,
            phone: phoneVal,
            membersCount: membersVal,
            workingMembersCount: 0,
            membersCountEntered: false,
            sectorCode: sectorVal as 1 | 2 | 3 | 4,
            sectorName: SECTOR_NAMES[sectorVal as 1 | 2 | 3 | 4] || 'Công nghiệp xây dựng',
            note: noteVal,
            surveyStatus: 'CHUA_NHAP',
            assignedSurveyorId: '',
            assignedSurveyorName: '',
            questionnaire: createDefaultQuestionnaire()
          };
          sheetHouseholds.push(tempHh);
        }

        if (sheetHouseholdCount === 0) return;

        validAreaIndex++;
        const areaCode = String(validAreaIndex).padStart(3, '0');
        const areaId = 'area-' + commune.id + '-' + areaCode;

        const finalizedHouseholds: Household[] = sheetHouseholds.map((h, hIdx) => ({
          ...h,
          id: 'hh-' + commune.id + '-' + areaCode + '-' + (hIdx + 1),
          areaId: areaId,
          areaCode: areaCode,
          areaName: areaNameFinal,
          sheetName: areaNameFinal
        }));

        tempHouseholds.push(...finalizedHouseholds);
        totalParsed += finalizedHouseholds.length;

        const newArea: SurveyArea = {
          id: areaId,
          communeId: commune.id,
          communeCode: commune.communeCode,
          code: areaCode,
          name: areaNameFinal,
          householdCount: finalizedHouseholds.length
        };
        tempAreas.push(newArea);
      });

      if (totalParsed === 0) {
        setIsUploading(false);
        showNotification('error', `Không tìm thấy dòng hộ gia đình hợp lệ nào trong ${workbook.SheetNames.length} sheet.`);
        return;
      }

      const updatedCommune: Commune = {
        ...commune,
        fileName: file.name
      };

      await executeFinalizeImport(
        updatedCommune,
        tempAreas,
        tempHouseholds,
        skippedSheets,
        totalParsed,
        true,
        [commune.id]
      );

      // Hiển thị toàn bộ các hộ vừa nạp thuộc xã này, không lọc theo địa bàn đơn lẻ
      setSelectedCommuneId(commune.id);
      setSelectedTkcs(commune.tkcsCode || 'ALL');
      setSelectedAreaId('ALL');
      setCurrentPage(1);

      showNotification('success', `Đã nạp thành công ${totalParsed} hộ cho [${commune.communeCode}] ${commune.communeName} (${tempAreas.length} địa bàn).`);

    } catch (err) {
      console.error(err);
      setIsUploading(false);
      showNotification('error', 'Lỗi khi đọc file Excel.');
    }
    e.target.value = '';
  };

  const currentCommune = useMemo(() => {
    if (selectedCommuneId !== 'ALL') {
      return communes.find(c => c.id === selectedCommuneId || c.communeCode === selectedCommuneId) || communes[0];
    }
    return communes[0];
  }, [communes, selectedCommuneId]);

  const filteredHouseholds = useMemo(() => {
    const communeByIdOrCode = new Map<string, Commune>();
    communes.forEach(commune => {
      communeByIdOrCode.set(commune.id, commune);
      if (commune.communeCode) communeByIdOrCode.set(commune.communeCode, commune);
    });
    const supervisorCommuneKeys = new Set<string>();
    if (currentUser.role === 'SUPERVISOR' && currentUser.assignedCommunes &&
      !currentUser.assignedCommunes.includes('ALL')) {
      const assigned = new Set(currentUser.assignedCommunes);
      communes.forEach(commune => {
        if (assigned.has(commune.id) || assigned.has(commune.communeCode)) {
          supervisorCommuneKeys.add(commune.id);
          supervisorCommuneKeys.add(commune.communeCode);
        }
      });
    }

    // Đối tượng xã đang chọn nếu có
    const selCommune = selectedCommuneId !== 'ALL'
      ? (communes.find(c => c.id === selectedCommuneId || c.communeCode === selectedCommuneId) || null)
      : null;

    // Đối tượng địa bàn đang chọn nếu có
    const selArea = selectedAreaId !== 'ALL'
      ? (areas.find(a => a.id === selectedAreaId || a.code === selectedAreaId) || null)
      : null;

    return households.filter(h => {
      // 1. Lọc theo TKCS (Chỉ áp dụng khi chưa lọc cụ thể theo Xã)
      if (selectedTkcs !== 'ALL' && selectedCommuneId === 'ALL') {
        const commOfH = communeByIdOrCode.get(h.communeId) ||
          (h.communeCode ? communeByIdOrCode.get(h.communeCode) : undefined);
        const effectiveTkcs = (h.tkcsCode && !h.tkcsCode.startsWith('TKCS-') && h.tkcsCode !== 'TKCS') 
          ? h.tkcsCode 
          : (commOfH?.tkcsCode || h.tkcsCode || '');
        const matchTkcs = effectiveTkcs === selectedTkcs || (commOfH && commOfH.tkcsCode === selectedTkcs);
        if (!matchTkcs) return false;
      }

      // 2. Lọc theo Xã / Phường (Hỗ trợ linh hoạt cả communeId, communeCode và tên xã)
      if (selectedCommuneId !== 'ALL') {
        const selCode = selCommune?.communeCode || selectedCommuneId;
        const matchesCommune = h.communeId === selectedCommuneId ||
          (Boolean(h.communeCode) && (h.communeCode === selCode || (Boolean(selCommune) && h.communeCode === selCommune?.communeCode))) ||
          (Boolean(selCommune) && (h.communeId === selCommune?.id || h.communeId === selCommune?.communeCode)) ||
          (Boolean(selCommune?.communeName) && Boolean(h.communeName) && h.communeName.trim().toLowerCase() === selCommune!.communeName.trim().toLowerCase());
        if (!matchesCommune) return false;
      }

      // 3. Lọc theo Địa bàn (Hỗ trợ cả areaId, areaCode và tên địa bàn/sheet)
      if (selectedAreaId !== 'ALL') {
        const targetAreaCode = selArea?.code || selectedAreaId;
        const matchesArea = h.areaId === selectedAreaId ||
          h.areaCode === targetAreaCode ||
          (Boolean(selArea) && (
            h.areaId === selArea?.id || 
            h.areaCode === selArea?.code ||
            (Boolean(selArea?.name) && Boolean(h.areaName) && h.areaName.trim().toLowerCase() === selArea!.name.trim().toLowerCase()) ||
            (Boolean(selArea?.name) && Boolean((h as any).sheetName) && (h as any).sheetName.trim().toLowerCase() === selArea!.name.trim().toLowerCase())
          ));
        if (!matchesArea) return false;
      }
      
      // 4. Role-based access control (chỉ áp dụng khi không phải ADMIN)
      if (currentUser && currentUser.role !== 'ADMIN') {
        if (currentUser.role === 'SURVEYOR') {
          // Nếu hộ đã được gán cho ĐTV khác -> Không hiển thị (tránh lẫn tên người khác)
          if (h.assignedSurveyorId && h.assignedSurveyorId !== currentUser.id) return false;
          const isDirect = h.assignedSurveyorId === currentUser.id;
          const isAreaMatch = isHouseholdInSurveyorArea(h);
          if (!isDirect && !isAreaMatch) return false;
        } else if (currentUser.role === 'SUPERVISOR') {
          if (currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL')) {
            const matchesCommune = supervisorCommuneKeys.has(h.communeId) ||
              supervisorCommuneKeys.has(h.communeCode);
            if (!matchesCommune) return false;
          }
        }
      }

      // 5. Lọc theo người nhập / ĐTV (Liên kết thông minh qua ID, Tên và Phân công địa bàn)
      if (selectedSurveyorFilter !== 'ALL') {
        const areaSurv = areaSurveyorMap.get(h.areaId) || areaSurveyorMap.get(h.areaCode) || areaSurveyorMap.get(`${h.communeId}_${h.areaCode}`);
        const effectiveName = h.assignedSurveyorName || areaSurv?.name || '';
        const effectiveId = h.assignedSurveyorId || areaSurv?.id || '';

        if (selectedSurveyorFilter === 'UNASSIGNED') {
          if (effectiveName || effectiveId) return false;
        } else {
          const isMatch = 
            h.assignedSurveyorId === selectedSurveyorFilter ||
            h.assignedSurveyorName === selectedSurveyorFilter ||
            effectiveId === selectedSurveyorFilter ||
            effectiveName === selectedSurveyorFilter;
          if (!isMatch) return false;
        }
      }

      // 6. Lọc theo trạng thái phiếu
      if (selectedStatusFilter !== 'ALL') {
        const status = h.surveyStatus || 'CHUA_NHAP';
        if (status !== selectedStatusFilter) return false;
      }

      // 7. Lọc theo ngành kinh tế (1-4)
      if (selectedSectorFilter !== 'ALL') {
        const secCode = String(h.sectorCode || '');
        const secFilter = String(selectedSectorFilter);
        if (secCode !== secFilter) {
          const sName = (h.sectorName || '').toLowerCase();
          if (secFilter === '1' && (sName.includes('nông') || sName.includes('thủy sản'))) {
            // match
          } else if (secFilter === '2' && (sName.includes('công nghiệp') || sName.includes('xây dựng'))) {
            // match
          } else if (secFilter === '3' && (sName.includes('thương mại') || sName.includes('dịch vụ'))) {
            // match
          } else if (secFilter === '4' && (sName.includes('khác') || sName.includes('lương'))) {
            // match
          } else {
            return false;
          }
        }
      }

      // 8. Tìm kiếm từ khóa đa trường
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase().trim();
        const head = (h.householdHead || '').toLowerCase();
        const addr = (h.address || '').toLowerCase();
        const note = (h.note || '').toLowerCase();
        const area = (h.areaName || '').toLowerCase();
        const sName = (h.assignedSurveyorName || '').toLowerCase();
        const sttM = String(h.sttMau || '').toLowerCase();
        const sttG = String(h.sttGoc || '').toLowerCase();
        if (!head.includes(kw) && !addr.includes(kw) && !note.includes(kw) && !area.includes(kw) && !sName.includes(kw) && !sttM.includes(kw) && !sttG.includes(kw)) {
          return false;
        }
      }

      // 9. Lọc chỉ hộ tôi phụ trách
      if (onlyMyHouseholds && currentUser) {
        const isMine = h.assignedSurveyorId === currentUser.id || isHouseholdInSurveyorArea(h);
        if (!isMine) return false;
      }

      // 10. Mặc định ẩn hộ dự phòng khỏi danh sách (chỉ hiện khi cần thay mẫu ấn vào hoặc khi bật hiển thị)
      if (!showReserveHouseholds) {
        const status = (h.sampleStatus || '').toUpperCase();
        const isReserve = status.includes('DỰ PHÒNG') || status.includes('DP') || h.sttMau === 'DP';
        if (isReserve) return false;
      }

      return true;
    });
  }, [
    households, 
    communes, 
    areas, 
    areaSurveyorMap,
    selectedTkcs, 
    selectedCommuneId, 
    selectedAreaId, 
    searchKeyword, 
    onlyMyHouseholds, 
    selectedSurveyorFilter, 
    selectedStatusFilter, 
    selectedSectorFilter, 
    showReserveHouseholds,
    currentUser
  ]);

  const calculateHouseholdTotalIncome = (h: Household) => {
    return calculateFullIncome(h.questionnaire);
  };

  // Kiểm tra hộ đã được điều tra thực tế (có phiếu nhập tin, trạng thái đã nhập/hoàn thành/đã duyệt, hoặc có thu nhập > 0)
  const isHouseholdSurveyed = (h: Household): boolean => {
    if (!h) return false;
    if (h.surveyStatus === 'DA_HOAN_THANH' || h.surveyStatus === 'DA_DUYET' || h.surveyStatus === 'DANG_NHAP') return true;
    if (h.questionnaire && (
      h.questionnaire.muc1_has || 
      h.questionnaire.muc2_has || 
      h.questionnaire.muc3_has || 
      h.questionnaire.muc4_has || 
      h.questionnaire.muc5_has || 
      h.questionnaire.muc6_has || 
      h.questionnaire.muc7_has || 
      (h.questionnaire.muc1_rows && h.questionnaire.muc1_rows.length > 0)
    )) return true;
    const inc = calculateHouseholdTotalIncome(h);
    if (inc.total > 0) return true;
    return false;
  };

  useEffect(() => {
    if (currentUser.role !== 'SURVEYOR' || !isLoggedIn) return;

    const syncProgress = () => {
      const assignedAreas = areas.filter(area =>
        isAreaAssigned(area, currentUser.assignedAreas || []) ||
        households.some(h =>
          h.assignedSurveyorId === currentUser.id &&
          (h.areaId === area.id ||
            (h.areaCode === area.code && (
              h.communeId === area.communeId ||
              h.communeCode === area.communeCode
            )))
        )
      );
      const snapshots = assignedAreas.map(area => {
        const commune = communes.find(c =>
          c.id === area.communeId || c.communeCode === area.communeCode
        );
        if (!commune) return null;
        const assignedHouseholds = households.filter(h =>
          h.areaId === area.id ||
          (h.areaCode === area.code && (
            h.communeId === area.communeId ||
            h.communeCode === commune.communeCode
          ))
        ).filter(h =>
          h.assignedSurveyorId
            ? h.assignedSurveyorId === currentUser.id
            : !h.assignedSurveyorName || h.assignedSurveyorName === currentUser.name
        );
        return createAreaProgressSnapshot(
          currentUser.id,
          currentUser.name,
          area,
          commune,
          assignedHouseholds
        );
      }).filter((item): item is AreaProgressSnapshot => item !== null);

      Promise.all(snapshots.map(snapshot =>
        setDoc(doc(db, 'areaProgress', snapshot.id), snapshot)
      )).catch(err => {
        console.error('Không thể đồng bộ số đếm tiến độ lên Firebase:', err);
        setNotification({
          type: 'error',
          message: 'Không đồng bộ được tiến độ lên Firebase. Phiếu vẫn được lưu trên máy này.'
        });
      });
    };

    const timer = window.setTimeout(syncProgress, 400);
    window.addEventListener('online', syncProgress);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', syncProgress);
    };
  }, [areas, communes, households, currentUser, isLoggedIn]);

  // Danh sách xã thuộc phạm vi Tổng hợp nhanh đang xem
  const tnhScopeCommunes = useMemo(() => {
    if (activeTab !== 'tnh') return [];
    let result = communes;
    if (tnhScopeMode === 'COMMUNE_QUICK' || tnhScopeMode === 'COMMUNE_SECTOR') {
      if (tnhSelectedCommuneId !== 'ALL') {
        const found = communes.find(c => c.id === tnhSelectedCommuneId || c.communeCode === tnhSelectedCommuneId);
        result = found ? [found] : communes;
      } else if (selectedCommuneId !== 'ALL') {
        const found = communes.find(c => c.id === selectedCommuneId || c.communeCode === selectedCommuneId);
        result = found ? [found] : communes;
      }
    } else if (tnhScopeMode === 'TKCS_SECTOR') {
      if (tnhSelectedTkcs !== 'ALL') {
        result = communes.filter(c => c.tkcsCode === tnhSelectedTkcs);
      } else if (selectedTkcs !== 'ALL') {
        result = communes.filter(c => c.tkcsCode === selectedTkcs);
      }
    }

    // STRICT ROLE-BASED ACCESS CONTROL FOR TNH SCOPE
    if (currentUser) {
      if (currentUser.role === 'SUPERVISOR' && currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL')) {
        result = result.filter(c => currentUser.assignedCommunes?.includes(c.id) || currentUser.assignedCommunes?.includes(c.communeCode));
      } else if (currentUser.role === 'SURVEYOR') {
        const myAssignedCommuneCodes = new Set(
          households
            .filter(h => h.assignedSurveyorId === currentUser.id || currentUser.assignedAreas.includes('ALL') || currentUser.assignedAreas.includes(h.areaCode))
            .map(h => h.communeCode)
        );
        if (myAssignedCommuneCodes.size > 0) {
          result = result.filter(c => myAssignedCommuneCodes.has(c.communeCode));
        }
      }
    }

    return result;
  }, [activeTab, communes, households, tnhScopeMode, tnhSelectedCommuneId, selectedCommuneId, tnhSelectedTkcs, selectedTkcs, currentUser]);

  // Hộ gia đình thuộc phạm vi Tổng hợp nhanh đang xem
  const tnhScopeHouseholds = useMemo(() => {
    if (activeTab !== 'tnh') return [];
    let list = households;
    if (tnhScopeMode === 'COMMUNE_QUICK' || tnhScopeMode === 'COMMUNE_SECTOR') {
      if (tnhSelectedCommuneId !== 'ALL') {
        const target = communes.find(c => c.id === tnhSelectedCommuneId || c.communeCode === tnhSelectedCommuneId);
        list = list.filter(h => h.communeId === tnhSelectedCommuneId || (Boolean(target?.communeCode) && h.communeCode === target?.communeCode));
      } else if (selectedCommuneId !== 'ALL') {
        const target = communes.find(c => c.id === selectedCommuneId || c.communeCode === selectedCommuneId);
        list = list.filter(h => h.communeId === selectedCommuneId || (Boolean(target?.communeCode) && h.communeCode === target?.communeCode));
      }
    } else if (tnhScopeMode === 'TKCS_SECTOR') {
      if (tnhSelectedTkcs !== 'ALL') {
        const matchingCommuneCodes = new Set(communes.filter(c => c.tkcsCode === tnhSelectedTkcs).map(c => c.communeCode));
        const matchingCommuneIds = new Set(communes.filter(c => c.tkcsCode === tnhSelectedTkcs).map(c => c.id));
        list = list.filter(h => h.tkcsCode === tnhSelectedTkcs || matchingCommuneCodes.has(h.communeCode) || matchingCommuneIds.has(h.communeId));
      }
    }

    // Nếu người dùng chọn Địa bàn cụ thể ở bộ lọc thì tổng hợp đúng theo địa bàn đó
    if (selectedAreaId !== 'ALL') {
      list = list.filter(h => h.areaId === selectedAreaId || h.areaCode === selectedAreaId);
    }

    // STRICT ROLE-BASED ACCESS CONTROL FOR TNH HOUSEHOLDS
    if (currentUser) {
      if (currentUser.role === 'SUPERVISOR') {
        if (currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL')) {
          list = list.filter(h => currentUser.assignedCommunes?.includes(h.communeId) || (Boolean(h.communeCode) && currentUser.assignedCommunes?.includes(h.communeCode)));
        }
      } else if (currentUser.role === 'SURVEYOR') {
        list = list.filter(household => {
          if (household.assignedSurveyorId && household.assignedSurveyorId !== currentUser.id) return false;
          return household.assignedSurveyorId === currentUser.id || isHouseholdInSurveyorArea(household);
        });
      }
    }

    return list;
  }, [activeTab, households, communes, tnhScopeMode, tnhSelectedCommuneId, selectedCommuneId, tnhSelectedTkcs, selectedTkcs, selectedAreaId, currentUser, surveyorAreaAccessKeys]);

  // Tính toán Tổng hợp nhanh kết nối chuẩn xác Danh mục Xã / TKCS và Phiếu điều tra thực tế
  const tnhSummary = useMemo(() => {
    const list = tnhScopeHouseholds;
    const officialList = list.filter(h => h.sampleStatus === 'CHÍNH THỨC' || !h.sampleStatus);
    const totalSurveyHH = officialList.length;

    // Tổng hợp số liệu bảng kê & mẫu từ danh mục các xã trong phạm vi
    let totalBkS1 = 0, totalBkS2 = 0, totalBkS3 = 0, totalBkS4 = 0, totalBkAll = 0;
    let totalMauS1 = 0, totalMauS2 = 0, totalMauS3 = 0, totalMauS4 = 0, totalMauAll = 0;

    tnhScopeCommunes.forEach(c => {
      const oc = OFFICIAL_COMMUNES_CATALOG.find(item => item.communeCode === c.communeCode || item.id === c.id);
      const s1 = c.bkNongLamThuySan ?? oc?.bkNongLamThuySan ?? 0;
      const s2 = c.bkCongNghiepXayDung ?? oc?.bkCongNghiepXayDung ?? 0;
      const s3 = c.bkThuongMaiDichVu ?? oc?.bkThuongMaiDichVu ?? 0;
      const s4 = c.bkThuKhacLuong ?? oc?.bkThuKhacLuong ?? 0;
      const tot = c.bkTongSo ?? oc?.bkTongSo ?? (s1 + s2 + s3 + s4);

      totalBkS1 += s1;
      totalBkS2 += s2;
      totalBkS3 += s3;
      totalBkS4 += s4;
      totalBkAll += tot;

      const m1 = c.mauNongLamThuySan ?? oc?.mauNongLamThuySan ?? 0;
      const m2 = c.mauCongNghiepXayDung ?? oc?.mauCongNghiepXayDung ?? 0;
      const m3 = c.mauThuongMaiDichVu ?? oc?.mauThuongMaiDichVu ?? 0;
      const m4 = c.mauThuKhacLuong ?? oc?.mauThuKhacLuong ?? 0;
      const mTot = c.mauTongSo ?? oc?.mauTongSo ?? (m1 + m2 + m3 + m4);

      totalMauS1 += m1;
      totalMauS2 += m2;
      totalMauS3 += m3;
      totalMauS4 += m4;
      totalMauAll += mTot;
    });

    // Nếu là 1 xã đơn lẻ và có tỷ trọng % định sẵn trong danh mục thì ưu tiên lấy chính xác
    const isSingleCommune = tnhScopeCommunes.length === 1;
    const singleCommune = isSingleCommune ? tnhScopeCommunes[0] : null;
    const singleCatalog = singleCommune ? OFFICIAL_COMMUNES_CATALOG.find(item => item.communeCode === singleCommune.communeCode || item.id === singleCommune.id) : null;

    const sectors = [1, 2, 3, 4] as const;

    const sectorData = sectors.map(code => {
      let bkCount = 0;
      let mauAlloc = 0;
      let percent = 0;

      if (code === 1) {
        bkCount = totalBkS1;
        mauAlloc = totalMauS1;
        percent = isSingleCommune && singleCommune 
          ? (singleCommune.ttNongLamThuySan ?? singleCatalog?.ttNongLamThuySan ?? (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0))
          : (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0);
      } else if (code === 2) {
        bkCount = totalBkS2;
        mauAlloc = totalMauS2;
        percent = isSingleCommune && singleCommune 
          ? (singleCommune.ttCongNghiepXayDung ?? singleCatalog?.ttCongNghiepXayDung ?? (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0))
          : (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0);
      } else if (code === 3) {
        bkCount = totalBkS3;
        mauAlloc = totalMauS3;
        percent = isSingleCommune && singleCommune 
          ? (singleCommune.ttThuongMaiDichVu ?? singleCatalog?.ttThuongMaiDichVu ?? (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0))
          : (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0);
      } else if (code === 4) {
        bkCount = totalBkS4;
        mauAlloc = totalMauS4;
        percent = isSingleCommune && singleCommune 
          ? (singleCommune.ttThuKhacLuong ?? singleCatalog?.ttThuKhacLuong ?? (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0))
          : (totalBkAll > 0 ? Number(((bkCount / totalBkAll) * 100).toFixed(2)) : 0);
      }

      // KẾT QUẢ ĐIỀU TRA THỰC TẾ:
      // "Có bao nhiêu tổng hợp đến đó ví dụ trong 1 địa bàn điều tra được 5 hộ tổng 15 nhân khẩu thì lúc tính Thu nhập Bình quân bạn chỉ chia cho 15 người"
      const allSectorList = officialList.filter(h => Number(h.sectorCode) === code);
      const surveyedSectorList = allSectorList.filter(h => isHouseholdSurveyed(h));
      
      // Tổng hợp đúng các hộ đã điều tra
      const sList = surveyedSectorList;
      const surveyCount = sList.length;
      let groupIncome = 0;
      let groupMembers = 0;

      sList.forEach(h => {
        const inc = calculateHouseholdTotalIncome(h).total;
        groupIncome += inc;
        groupMembers += (Number(h.membersCount) || 1);
      });

      // TNBQ đầu người / tháng theo loại hộ (= Tổng TN nhóm / Tổng số nhân khẩu nhóm đã điều tra / 12) (Nghìn đồng)
      // CHIA ĐÚNG CHO TỔNG SỐ NHÂN KHẨU THỰC TẾ CỦA CÁC HỘ ĐÃ ĐIỀU TRA
      const perCapitaMonth = groupMembers > 0 ? (groupIncome / groupMembers / 12) : 0;
      
      // Suy rộng TNBQ = Tỉ trọng cơ cấu (%) * Thu nhập bình quân đầu người / tháng theo loại hộ
      const extrapolatedIncomeYear = (percent / 100) * perCapitaMonth;

      return {
        code,
        name: SECTOR_NAMES[code],
        bkCount,
        percent,
        mauAlloc,
        totalSampleInSector: allSectorList.length,
        surveyCount,
        groupMembers,
        groupIncome,
        extrapolatedIncomeYear: Math.round(extrapolatedIncomeYear),
        perCapitaMonth: Math.round(perCapitaMonth),
        growthRate: 100.0,
        sList
      };
    });

    // Suy rộng TNBQ toàn xã / TKCS = Tổng cộng (Suy rộng của 4 loại hộ)
    const overallExtrapolated = sectorData.reduce((acc, s) => acc + s.extrapolatedIncomeYear, 0);
    const totalSurveyedHH = sectorData.reduce((sum, s) => sum + s.surveyCount, 0);
    const totalMembers = sectorData.reduce((sum, s) => sum + s.groupMembers, 0);
    const totalIncomeAll = sectorData.reduce((acc, s) => acc + s.groupIncome, 0);
    // Thu nhập bình quân trực tiếp: chia đúng cho tổng số nhân khẩu các hộ đã điều tra
    const overallDirectPerCapita = totalMembers > 0 ? Math.round(totalIncomeAll / totalMembers / 12) : 0;

    return {
      totalBkHH: totalBkAll,
      totalAllocMau: totalMauAll,
      totalHH: totalSurveyHH,
      totalSurveyedHH,
      totalIncomeAll,
      totalMembers,
      sectorData,
      overallExtrapolated,
      overallPerCapitaMonth: overallExtrapolated > 0 ? overallExtrapolated : overallDirectPerCapita,
      overallDirectPerCapita,
      officialList,
      scopeCommunesCount: tnhScopeCommunes.length
    };
  }, [tnhScopeCommunes, tnhScopeHouseholds]);

  // Tổng hợp nhanh số liệu cho từng xã trong danh mục đầy đủ 19 cột để link trực tiếp (Tối ưu O(N) với Map)
  const communesTnhOverview = useMemo(() => {
    if (activeTab !== 'tnh' && activeTab !== 'database') return [];
    const hhByCommune = new Map<string, Household[]>();
    households.forEach(h => {
      if (h.communeId) {
        if (!hhByCommune.has(h.communeId)) hhByCommune.set(h.communeId, []);
        hhByCommune.get(h.communeId)!.push(h);
      }
      if (h.communeCode) {
        if (!hhByCommune.has(h.communeCode)) hhByCommune.set(h.communeCode, []);
        hhByCommune.get(h.communeCode)!.push(h);
      }
    });

    const areasByCommune = new Map<string, SurveyArea[]>();
    areas.forEach(a => {
      if (a.communeId) {
        if (!areasByCommune.has(a.communeId)) areasByCommune.set(a.communeId, []);
        areasByCommune.get(a.communeId)!.push(a);
      }
      if ((a as any).communeCode) {
        if (!areasByCommune.has((a as any).communeCode)) areasByCommune.set((a as any).communeCode, []);
        areasByCommune.get((a as any).communeCode)!.push(a);
      }
    });

    return communes.map((c, idx) => {
      const oc = OFFICIAL_COMMUNES_CATALOG.find(item => item.communeCode === c.communeCode || item.id === c.id);
      const mergedCommune: Commune = {
        ...oc,
        ...c,
        tkcsCode: oc?.tkcsCode || c.tkcsCode,
        tkcsName: oc?.tkcsName || c.tkcsName,
        bkNongLamThuySan: c.bkNongLamThuySan ?? oc?.bkNongLamThuySan ?? 0,
        bkCongNghiepXayDung: c.bkCongNghiepXayDung ?? oc?.bkCongNghiepXayDung ?? 0,
        bkThuongMaiDichVu: c.bkThuongMaiDichVu ?? oc?.bkThuongMaiDichVu ?? 0,
        bkThuKhacLuong: c.bkThuKhacLuong ?? oc?.bkThuKhacLuong ?? 0,
        bkTongSo: c.bkTongSo ?? oc?.bkTongSo ?? 0,
        ttNongLamThuySan: c.ttNongLamThuySan ?? oc?.ttNongLamThuySan ?? 0,
        ttCongNghiepXayDung: c.ttCongNghiepXayDung ?? oc?.ttCongNghiepXayDung ?? 0,
        ttThuongMaiDichVu: c.ttThuongMaiDichVu ?? oc?.ttThuongMaiDichVu ?? 0,
        ttThuKhacLuong: c.ttThuKhacLuong ?? oc?.ttThuKhacLuong ?? 0,
        ttTongSo: c.ttTongSo ?? oc?.ttTongSo ?? 0,
        mauNongLamThuySan: c.mauNongLamThuySan ?? oc?.mauNongLamThuySan ?? 0,
        mauCongNghiepXayDung: c.mauCongNghiepXayDung ?? oc?.mauCongNghiepXayDung ?? 0,
        mauThuongMaiDichVu: c.mauThuongMaiDichVu ?? oc?.mauThuongMaiDichVu ?? 0,
        mauThuKhacLuong: c.mauThuKhacLuong ?? oc?.mauThuKhacLuong ?? 0,
        mauTongSo: c.mauTongSo ?? oc?.mauTongSo ?? 0,
        mauDuPhong: c.mauDuPhong ?? 0,
      };

      const cHouseholds = hhByCommune.get(c.id) || (c.communeCode ? hhByCommune.get(c.communeCode) : null) || [];
      const officialHHs = cHouseholds.filter(h => h.sampleStatus === 'CHÍNH THỨC' || !h.sampleStatus);
      const totalHH = cHouseholds.length;
      const officialCount = officialHHs.length;

      const cAreas = areasByCommune.get(c.id) || (c.communeCode ? areasByCommune.get(c.communeCode) : null) || [];

      // Tính tổng thu nhập và tổng nhân khẩu CHỈ của các hộ đã điều tra
      let totalIncome = 0;
      let totalMembers = 0;
      let surveyedCount = 0;
      let s1 = 0, s2 = 0, s3 = 0, s4 = 0;

      officialHHs.forEach(h => {
        const sec = Number(h.sectorCode);
        if (sec === 1) s1++;
        else if (sec === 2) s2++;
        else if (sec === 3) s3++;
        else if (sec === 4) s4++;

        if (isHouseholdSurveyed(h)) {
          surveyedCount++;
          totalIncome += calculateHouseholdTotalIncome(h).total;
          totalMembers += (Number(h.membersCount) || 1);
        }
      });

      // TNBQ / tháng: chia đúng cho tổng nhân khẩu của các hộ đã điều tra
      const perCapitaMonth = totalMembers > 0 ? Math.round(totalIncome / totalMembers / 12) : 0;

      return {
        commune: mergedCommune,
        stt: idx + 1,
        areasCount: cAreas.length,
        totalHH,
        officialCount,
        backupCount: totalHH - officialCount,
        surveyedCount,
        totalIncome,
        totalMembers,
        perCapitaMonth,
        sectors: { s1, s2, s3, s4 }
      };
    });
  }, [activeTab, communes, households, areas]);

  const filteredCommunesTnhOverview = useMemo(() => {
    if (activeTab !== 'tnh') return [];
    return communesTnhOverview.filter(item => {
      // STRICT ROLE-BASED ACCESS CONTROL
      if (currentUser) {
        if (currentUser.role === 'SUPERVISOR') {
          // SUPERVISOR can strictly only see their assigned communes
          if (currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL')) {
            const matchesCommune = currentUser.assignedCommunes.includes(item.commune.id) || 
                                   currentUser.assignedCommunes.includes(item.commune.communeCode);
            if (!matchesCommune) return false;
          }
        } else if (currentUser.role === 'SURVEYOR') {
          // SURVEYOR can strictly only see communes that contain their assigned areas
          if (!currentUser.assignedAreas.includes('ALL')) {
            const hasMyAreas = areas.some(a => 
              (a.communeId === item.commune.id || (a as any).communeCode === item.commune.communeCode) &&
              (currentUser.assignedAreas.includes('ALL') || 
               currentUser.assignedAreas.includes(a.id) || 
               currentUser.assignedAreas.includes(a.code) || 
               currentUser.assignedAreas.includes(`${a.communeId}_${a.code}`))
            );
            if (!hasMyAreas) return false;
          }
        }
      }

      if (selectedTkcs !== 'ALL' && item.commune.tkcsCode !== selectedTkcs) return false;
      if (selectedCommuneId !== 'ALL' && item.commune.id !== selectedCommuneId && item.commune.communeCode !== selectedCommuneId) return false;
      if (searchKeyword.trim()) {
        const q = searchKeyword.toLowerCase().trim();
        const matchName = item.commune.communeName.toLowerCase().includes(q);
        const matchCode = item.commune.communeCode.toLowerCase().includes(q);
        const matchTkcs = item.commune.tkcsName?.toLowerCase().includes(q) || item.commune.tkcsCode.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchTkcs) return false;
      }
      return true;
    });
  }, [activeTab, communesTnhOverview, selectedTkcs, selectedCommuneId, searchKeyword, currentUser, areas]);

  const handleSaveQuestionnaire = async (updatedHousehold: any) => {
    if (!updatedHousehold) return;
    setHouseholds(prev => {
      const next = prev.map(h => h.id === updatedHousehold.id ? updatedHousehold : h);
      try { localStorage.setItem('cached_households', JSON.stringify(next)); } catch (e) {}
      return next;
    });
    setActiveHouseholdForm(null);
    showNotification('success', `Đã lưu phiếu Phụ lục II của hộ "${updatedHousehold.householdHead}" thành công.`);
  };

  const handleExportLocalBackup = () => {
    try {
      const snapshot = { communes, areas, households, surveyors, departments };
      downloadLocalBackup(snapshot, `Sao_Luu_Bang_Ke_${new Date().toISOString().slice(0, 10)}.json`);
      showNotification('success', `Đã xuất bản sao lưu cục bộ gồm ${communes.length} xã, ${areas.length} địa bàn và ${households.length} hộ.`);
    } catch (err) {
      showNotification('error', `Không thể xuất bản sao lưu: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportSurveyorBackup = () => {
    try {
      const assignedAreas = areas.filter(area =>
        isAreaAssigned(area, currentUser.assignedAreas || []) ||
        households.some(household =>
          household.assignedSurveyorId === currentUser.id &&
          (household.areaId === area.id ||
            (household.areaCode === area.code &&
              (household.communeId === area.communeId || household.communeCode === area.communeCode)))
        )
      );
      const assignedHouseholds = households.filter(household =>
        household.assignedSurveyorId === currentUser.id &&
        assignedAreas.some(area =>
          household.areaId === area.id ||
          (household.areaCode === area.code &&
            (household.communeId === area.communeId || household.communeCode === area.communeCode))
        )
      );
      const assignedCommunes = communes.filter(commune =>
        assignedAreas.some(area =>
          area.communeId === commune.id || area.communeCode === commune.communeCode
        )
      );
      if (assignedAreas.length === 0 || assignedHouseholds.length === 0) {
        showNotification('error', 'Không có hộ thuộc phân công của tài khoản này để sao lưu. Hãy nạp gói phân công trước.');
        return;
      }

      const snapshot = {
        communes: assignedCommunes,
        areas: assignedAreas,
        households: assignedHouseholds,
        surveyors: [currentUser],
        departments: []
      };
      downloadLocalBackup(
        snapshot,
        `Sao_Luu_DTV_${currentUser.code}_${new Date().toISOString().slice(0, 10)}.json`,
        { id: currentUser.id, role: 'SURVEYOR' }
      );
      showNotification(
        'success',
        `Đã sao lưu riêng ${assignedAreas.length} địa bàn và ${assignedHouseholds.length} hộ của tài khoản ${currentUser.name}.`
      );
    } catch (err) {
      showNotification('error', `Không thể xuất bản sao lưu ĐTV: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleExportPreRestoreBackup = async () => {
    try {
      const snapshot = await loadPreRestoreSnapshot();
      if (!snapshot) {
        showNotification('error', 'Chưa có bản sao lưu trước lần khôi phục nào trên thiết bị này.');
        return;
      }
      downloadLocalBackup(snapshot, `Sao_Luu_Truoc_Khoi_Phu_${new Date().toISOString().slice(0, 10)}.json`);
      showNotification('success', `Đã tải bản dự phòng gồm ${snapshot.households.length} hộ.`);
    } catch (err) {
      showNotification('error', `Không thể tải bản dự phòng: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const downloadLocalBackup = (snapshot: {
    communes: Commune[];
    areas: SurveyArea[];
    households: Household[];
    surveyors: Surveyor[];
    departments: Department[];
  }, fileName: string, backupOwner?: Pick<Surveyor, 'id' | 'role'>) => {
    const blob = new Blob([serializeLocalDataBackup(snapshot, backupOwner)], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleRestoreLocalBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (currentUser.role !== 'ADMIN' && currentUser.role !== 'SURVEYOR') {
      showNotification('error', 'Chỉ Admin hoặc ĐTV mới được khôi phục backup phù hợp với tài khoản.');
      event.target.value = '';
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('File backup không có cấu trúc JSON hợp lệ.');
      }
      const backupOwner = (parsed as { backupOwner?: unknown }).backupOwner;
      if (currentUser.role === 'SURVEYOR') {
        if (
          !backupOwner ||
          typeof backupOwner !== 'object' ||
          (backupOwner as { id?: unknown }).id !== currentUser.id ||
          (backupOwner as { role?: unknown }).role !== 'SURVEYOR'
        ) {
          throw new Error('ĐTV chỉ khôi phục được backup cá nhân do chính tài khoản của mình xuất.');
        }
      }
      const restored = parseLocalDataBackup(parsed, surveyors, departments);
      if (restored.households.length === 0 || restored.areas.length === 0) {
        const diagnostics = inspectLocalDataBackup(parsed);
        throw new Error(
          `Sau khi đọc file, hệ thống nhận được ${restored.communes.length} xã, ` +
          `${restored.areas.length} địa bàn và ${restored.households.length} hộ. ` +
          `Trường ${diagnostics.householdFieldPath}: ${diagnostics.householdFieldType}; ` +
          `${diagnostics.householdArrayLength} phần tử, ${diagnostics.householdObjectCount} bản ghi object, ` +
          `${diagnostics.householdRecordsWithId} bản ghi có mã hộ, ` +
          `${diagnostics.householdRecordsWithAreaId} bản ghi có mã địa bàn, ` +
          `${diagnostics.householdRecordsNestedUnderAreas} hộ nằm trong địa bàn, ` +
          `${diagnostics.householdRecordsNestedUnderRosters} hộ trong rosters. ` +
          'Cần có ít nhất 1 địa bàn và 1 hộ; dữ liệu hiện tại chưa bị thay đổi.'
        );
      }
      if (currentUser.role === 'SURVEYOR') {
        const assignedAreaKeys = currentUser.assignedAreas || [];
        const directlyAssignedAreaKeys = new Set<string>();
        restored.households.forEach(household => {
          const matchesCurrentSurveyor =
            household.assignedSurveyorId === currentUser.id ||
            normalizeSurveyorName(household.assignedSurveyorName || '') ===
              normalizeSurveyorName(currentUser.name);
          if (!matchesCurrentSurveyor) return;
          directlyAssignedAreaKeys.add(household.areaId);
          directlyAssignedAreaKeys.add(`${household.communeId}_${household.areaCode}`);
          directlyAssignedAreaKeys.add(`${household.communeCode}_${household.areaCode}`);
        });
        const areaById = new Map(restored.areas.map(area => [area.id, area]));
        const hasOutOfScopeArea = restored.areas.some(area =>
          !isAreaAssigned(area, assignedAreaKeys) &&
          !directlyAssignedAreaKeys.has(area.id) &&
          !directlyAssignedAreaKeys.has(`${area.communeId}_${area.code}`) &&
          !directlyAssignedAreaKeys.has(`${area.communeCode}_${area.code}`)
        );
        const hasOutOfScopeHousehold = restored.households.some(household => {
          const area = areaById.get(household.areaId);
          const isDirectlyAssigned =
            household.assignedSurveyorId === currentUser.id ||
            normalizeSurveyorName(household.assignedSurveyorName || '') ===
              normalizeSurveyorName(currentUser.name);
          return !isDirectlyAssigned && !(area && isAreaAssigned(area, assignedAreaKeys));
        });
        if (hasOutOfScopeArea || hasOutOfScopeHousehold) {
          throw new Error('Backup có địa bàn hoặc hộ ngoài phạm vi của ĐTV đang đăng nhập; dữ liệu hiện tại chưa bị thay đổi.');
        }
      }
      const confirmed = window.confirm(
        `Khôi phục ${file.name}?\n\n` +
        `Trong file: ${restored.communes.length} xã, ${restored.areas.length} địa bàn, ${restored.households.length} hộ.\n` +
        `Hiện tại: ${communes.length} xã, ${areas.length} địa bàn, ${households.length} hộ.\n\n` +
        `Dữ liệu hiện tại sẽ được lưu thành bản dự phòng cục bộ trước khi thay thế.`
      );
      if (!confirmed) return;

      const snapshotToRestore = currentUser.role === 'SURVEYOR'
        ? { ...restored, surveyors, departments }
        : restored;
      await saveLocalDataSnapshot(
        snapshotToRestore,
        { communes, areas, households, surveyors, departments }
      );
      setCommunes(snapshotToRestore.communes);
      setAreas(snapshotToRestore.areas);
      setHouseholds(snapshotToRestore.households);
      setSurveyors(snapshotToRestore.surveyors);
      setDepartments(snapshotToRestore.departments);
      setSelectedCommuneId('ALL');
      setSelectedAreaId('ALL');
      setCurrentPage(1);
      showNotification(
        'success',
        `Đã khôi phục ${snapshotToRestore.communes.length} xã, ${snapshotToRestore.areas.length} địa bàn và ${snapshotToRestore.households.length} hộ trên máy này.`
      );
    } catch (err) {
      showNotification('error', `Không thể khôi phục bản sao lưu: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      event.target.value = '';
    }
  };

  const handleRestoreSurveyorEntryBackup = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (currentUser.role !== 'SURVEYOR') {
      showNotification('error', 'Chức năng này chỉ dành cho ĐTV để khôi phục phiếu của mình.');
      event.target.value = '';
      return;
    }

    try {
      const parsed: unknown = JSON.parse(await file.text());
      const backup = parseSurveyorEntryBackup(parsed);
      const householdsById = new Map(households.map(household => [household.id, household]));
      const areaById = new Map(areas.map(area => [area.id, area]));
      const allowedAreaKeys = new Set(currentUser.assignedAreas || []);
      const eligibleEntries = new Map<string, typeof backup.entries[number]>();
      let unmatchedCount = 0;
      let outOfScopeCount = 0;

      backup.entries.forEach(entry => {
        const household = householdsById.get(entry.id);
        if (!household) {
          unmatchedCount++;
          return;
        }

        const area = areaById.get(household.areaId) ||
          areas.find(item =>
            item.code === household.areaCode &&
            (item.communeId === household.communeId || item.communeCode === household.communeCode)
          );
        const isAssignedToUser = household.assignedSurveyorId
          ? household.assignedSurveyorId === currentUser.id
          : Boolean(area && isAreaAssigned(area, Array.from(allowedAreaKeys)));
        const expectedAreaKeys = [
          household.areaId,
          area?.id,
          `${household.communeCode}${household.areaCode}`,
          `${household.communeCode}_${household.areaCode}`,
          `${household.communeId}_${household.areaCode}`,
          `${household.communeCode}-${household.areaCode}`
        ].filter((key): key is string => Boolean(key));
        if (!isAssignedToUser || !expectedAreaKeys.includes(entry.areaKey)) {
          outOfScopeCount++;
          return;
        }
        eligibleEntries.set(entry.id, entry);
      });

      if (eligibleEntries.size === 0) {
        throw new Error(
          `Không tìm thấy phiếu nào khớp với hộ được giao trên máy này (${unmatchedCount} mã hộ không có trong bảng kê, ${outOfScopeCount} bản ghi ngoài phạm vi hoặc sai mã địa bàn). Hãy nạp đúng gói phân công trước.`
        );
      }

      const skippedCount = backup.entries.length - eligibleEntries.size;
      const confirmed = window.confirm(
        `Khôi phục ${eligibleEntries.size}/${backup.entries.length} phiếu từ ${file.name}?\n\n` +
        `${unmatchedCount} mã hộ không có trong bảng kê hiện tại; ${outOfScopeCount} bản ghi không khớp địa bàn được giao. ` +
        `Các hộ ngoài phạm vi sẽ không bị thay đổi.`
      );
      if (!confirmed) return;

      const restoredAt = backup.exportedAt || new Date().toISOString();
      const nextHouseholds = households.map(household => {
        const entry = eligibleEntries.get(household.id);
        if (!entry) return household;
        return {
          ...household,
          ...(entry.membersCount !== undefined ? { membersCount: entry.membersCount } : {}),
          ...(entry.membersCountEntered !== undefined
            ? { membersCountEntered: entry.membersCountEntered }
            : {}),
          ...(entry.workingMembersCount !== undefined
            ? { workingMembersCount: entry.workingMembersCount }
            : {}),
          questionnaire: {
            ...household.questionnaire,
            ...entry.questionnaire
          },
          surveyStatus: entry.surveyStatus ||
            (household.surveyStatus && household.surveyStatus !== 'CHUA_NHAP'
              ? household.surveyStatus
              : 'DANG_NHAP'),
          updatedAt: entry.updatedAt || restoredAt,
          updatedBy: entry.updatedBy || currentUser.name
        };
      });

      await saveLocalDataSnapshot({
        communes,
        areas,
        households: nextHouseholds,
        surveyors,
        departments
      });
      setHouseholds(nextHouseholds);
      setCurrentPage(1);
      showNotification(
        'success',
        `Đã khôi phục ${eligibleEntries.size} phiếu của ${currentUser.name} vào bộ nhớ cục bộ.` +
          (skippedCount ? ` Bỏ qua ${skippedCount} bản ghi không khớp.` : '')
      );
    } catch (err) {
      showNotification(
        'error',
        `Không thể khôi phục backup phiếu ĐTV: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      event.target.value = '';
    }
  };

  const handleApplyWorkPackage = async (workPackage: SurveyWorkPackage) => {
    if (workPackage.purpose === 'ASSIGNMENT') {
      if (currentUser.role !== 'SURVEYOR') {
        throw new Error('Chỉ tài khoản điều tra viên mới được nạp gói phân công.');
      }
      const entries = workPackage.entries.filter(entry => entry.surveyorId === currentUser.id);
      if (entries.length === 0) {
        throw new Error('Gói JSON không có địa bàn được phân công cho tài khoản đang đăng nhập.');
      }
      const importedProfile = workPackage.surveyors?.find(profile => profile.id === currentUser.id);
      if (importedProfile && importedProfile.status !== 'ACTIVE') {
        throw new Error('Tài khoản trong gói phân công đang bị khóa hoặc ngừng hoạt động.');
      }

      const nextCommunes = [...communes];
      const nextAreas = [...areas];
      const nextHouseholds = [...households];
      const householdIndexById = new Map(nextHouseholds.map((household, index) => [household.id, index]));
      const householdIndexByCompositeKey = new Map<string, number>();
      nextHouseholds.forEach((household, index) => {
        const key = householdCompositeKey(household);
        if (!householdIndexByCompositeKey.has(key)) householdIndexByCompositeKey.set(key, index);
      });
      const assignedAreaIds = new Set(currentUser.assignedAreas || []);
      let assignmentUpdatedCount = 0;
      let assignmentNewCount = 0;

      entries.forEach(entry => {
        const communeIndex = nextCommunes.findIndex(commune =>
          commune.id === entry.commune.id ||
          (commune.communeCode && commune.communeCode === entry.commune.communeCode)
        );
        const commune = communeIndex >= 0
          ? { ...nextCommunes[communeIndex], ...entry.commune, id: nextCommunes[communeIndex].id }
          : entry.commune;
        if (communeIndex >= 0) nextCommunes[communeIndex] = commune;
        else nextCommunes.push(commune);

        const areaIndex = nextAreas.findIndex(area =>
          area.id === entry.area.id ||
          (area.code === entry.area.code && (
            area.communeId === commune.id ||
            area.communeCode === commune.communeCode
          ))
        );
        const area = areaIndex >= 0
          ? { ...nextAreas[areaIndex], ...entry.area, id: nextAreas[areaIndex].id, communeId: commune.id }
          : { ...entry.area, communeId: commune.id };
        if (areaIndex >= 0) nextAreas[areaIndex] = area;
        else nextAreas.push(area);
        assignedAreaIds.add(area.id);

        entry.households.forEach(incoming => {
          if (incoming.assignedSurveyorId && incoming.assignedSurveyorId !== currentUser.id) {
            throw new Error(`Hộ ${incoming.sttMau || incoming.id} trong gói đang được phân công cho ĐTV khác.`);
          }
          const belongsToEntry = incoming.areaId === entry.area.id ||
            (incoming.areaCode === entry.area.code && (
              incoming.communeId === entry.commune.id ||
              incoming.communeCode === entry.commune.communeCode
            ));
          if (!belongsToEntry) {
            throw new Error(`Hộ ${incoming.sttMau || incoming.id} không thuộc địa bàn ${entry.area.code}.`);
          }

          const householdIndex = householdIndexById.get(incoming.id) ??
            householdIndexByCompositeKey.get(householdCompositeKey(incoming)) ??
            -1;
          const existing = householdIndex >= 0 ? nextHouseholds[householdIndex] : undefined;
          const household: Household = {
            ...existing,
            ...incoming,
            id: existing?.id || incoming.id,
            communeId: commune.id,
            areaId: area.id,
            assignedSurveyorId: currentUser.id,
            assignedSurveyorName: currentUser.name,
            questionnaire: existing?.questionnaire || incoming.questionnaire,
            surveyStatus: existing?.surveyStatus || incoming.surveyStatus,
            updatedAt: existing?.updatedAt || incoming.updatedAt,
            updatedBy: existing?.updatedBy || incoming.updatedBy
          };
          if (householdIndex >= 0) {
            nextHouseholds[householdIndex] = household;
            assignmentUpdatedCount++;
          } else {
            nextHouseholds.push(household);
            assignmentNewCount++;
          }
          householdIndexById.set(household.id, householdIndex >= 0 ? householdIndex : nextHouseholds.length - 1);
          const finalIndex = householdIndex >= 0 ? householdIndex : nextHouseholds.length - 1;
          householdIndexByCompositeKey.set(householdCompositeKey(household), finalIndex);
        });
      });

      const updatedSurveyor = {
        ...currentUser,
        ...(importedProfile || {}),
        password: currentUser.password,
        mustChangePassword: currentUser.mustChangePassword,
        assignedAreas: Array.from(assignedAreaIds)
      };
      const nextSurveyors = surveyors.map(surveyor =>
        surveyor.id === currentUser.id ? updatedSurveyor : surveyor
      );
      setCommunes(nextCommunes);
      setAreas(nextAreas);
      setHouseholds(nextHouseholds);
      setSurveyors(nextSurveyors);
      localStorage.setItem('cached_communes', JSON.stringify(nextCommunes));
      localStorage.setItem('cached_areas', JSON.stringify(nextAreas));
      localStorage.setItem('cached_surveyors', JSON.stringify(nextSurveyors));
      return {
        updatedCount: assignmentUpdatedCount,
        newCount: assignmentNewCount,
        areaCount: entries.length,
        progressSynced: true
      };
    }

    if (currentUser.role === 'SURVEYOR') {
      throw new Error('Điều tra viên không được nạp gói kết quả.');
    }

    const nextHouseholds = [...households];
    const householdIndexById = new Map(nextHouseholds.map((household, index) => [household.id, index]));
    const householdIndexByCompositeKey = new Map<string, number>();
    nextHouseholds.forEach((household, index) => {
      const key = householdCompositeKey(household);
      if (!householdIndexByCompositeKey.has(key)) householdIndexByCompositeKey.set(key, index);
    });
    const processedAreas: { area: SurveyArea; commune: Commune; surveyorId: string; surveyorName: string }[] = [];
    let updatedCount = 0;
    const userDepartment = departments.find(department =>
      department.id === currentUser.departmentId || department.name === currentUser.department
    );
    for (const entry of workPackage.entries) {
      const exactSurveyor = surveyors.find(surveyor =>
        surveyor.id === entry.surveyorId && surveyor.role === 'SURVEYOR'
      );
      const nameMatches = surveyors.filter(surveyor =>
        surveyor.role === 'SURVEYOR' &&
        normalizeSurveyorName(surveyor.name) === normalizeSurveyorName(entry.surveyorName)
      );
      const resolvedSurveyor = exactSurveyor ||
        (nameMatches.length === 1 ? nameMatches[0] : undefined);
      if (!resolvedSurveyor) {
        throw new Error(
          nameMatches.length > 1
            ? `Tên ĐTV "${entry.surveyorName}" trùng với nhiều tài khoản. Hãy sửa danh sách ĐTV để mỗi người có tên riêng rồi nhập lại.`
            : `Không tìm thấy ĐTV "${entry.surveyorName}" trong danh sách máy quản lý. Kiểm tra mã tài khoản hoặc tên ĐTV trong file và hệ thống.`
        );
      }
      const resolvedSurveyorId = resolvedSurveyor.id;
      const resolvedSurveyorName = resolvedSurveyor.name;
      const localArea = areas.find(area =>
        area.id === entry.area.id ||
        (area.code === entry.area.code && (
          area.communeId === entry.commune.id ||
          area.communeCode === entry.commune.communeCode
        ))
      );
      const localCommune = communes.find(commune =>
        commune.id === entry.commune.id ||
        commune.communeCode === entry.commune.communeCode
      );
      if (!localArea || !localCommune) {
        throw new Error(`Không tìm thấy địa bàn ${entry.area.code} trong bảng kê máy quản lý. Hãy nạp đúng gói phân công gốc trước.`);
      }
      if (currentUser.role !== 'ADMIN') {
        const assignedAreaKeys = [
          ...(currentUser.assignedAreas || []),
          ...(userDepartment?.assignedAreaCodes || [])
        ];
        const assignedCommuneKeys = currentUser.assignedCommunes || [];
        const hasSupervisorScope = currentUser.role === 'SUPERVISOR' && (
          (currentUser.assignedAreas || []).some(key => key !== 'ALL') ||
          (userDepartment?.assignedAreaCodes || []).some(key => key !== 'ALL') ||
          assignedCommuneKeys.some(key => key !== 'ALL')
        );
        const isAllowed = currentUser.role === 'SUPERVISOR' && !hasSupervisorScope
          ? true
          : isAreaAssigned(localArea, assignedAreaKeys) ||
            (currentUser.role === 'SUPERVISOR' && (
              assignedCommuneKeys.includes(localCommune.id) ||
              assignedCommuneKeys.includes(localCommune.communeCode)
            ));
        if (!isAllowed) {
          throw new Error(`Tài khoản hiện tại không có quyền nạp kết quả địa bàn ${localArea.code}.`);
        }
      }
      for (const incoming of entry.households) {
        const hasSurveyData =
          incoming.surveyStatus === 'DANG_NHAP' ||
          incoming.surveyStatus === 'DA_HOAN_THANH' ||
          incoming.surveyStatus === 'DA_DUYET' ||
          Boolean(incoming.questionnaire && (
            incoming.questionnaire.muc1_has ||
            incoming.questionnaire.muc2_has ||
            incoming.questionnaire.muc3_has ||
            incoming.questionnaire.muc4_has ||
            incoming.questionnaire.muc5_has ||
            incoming.questionnaire.muc6_has ||
            incoming.questionnaire.muc7_has ||
            incoming.questionnaire.muc1_rows?.length ||
            incoming.questionnaire.muc2_cayTrongRows?.length ||
            incoming.questionnaire.muc6_rows?.length
          )) ||
          Boolean(incoming.note?.trim());
        if (!hasSurveyData) continue;
        const belongsToEntry = incoming.areaId === entry.area.id ||
          (incoming.areaCode === entry.area.code && (
            incoming.communeId === entry.commune.id ||
            incoming.communeCode === entry.commune.communeCode
          ));
        if (!belongsToEntry) {
          throw new Error(`Hộ ${incoming.sttMau || incoming.id} không thuộc địa bàn ${entry.area.code} trong gói kết quả.`);
        }

        const householdIndex = householdIndexById.get(incoming.id) ??
          householdIndexByCompositeKey.get(householdCompositeKey(incoming)) ??
          -1;
        if (householdIndex < 0) {
          throw new Error(`Không khớp được hộ ${incoming.sttMau || incoming.id} trong bảng kê địa bàn ${localArea.code}.`);
        }
        const existing = nextHouseholds[householdIndex];
        if (
          existing.areaId !== localArea.id &&
          !(existing.areaCode === localArea.code && (
            existing.communeId === localCommune.id ||
            existing.communeCode === localCommune.communeCode
          ))
        ) {
          throw new Error(`Hộ ${incoming.sttMau || incoming.id} khớp với một địa bàn khác trong bảng kê.`);
        }
        const existingNameMatches = normalizeSurveyorName(existing.assignedSurveyorName || '') ===
          normalizeSurveyorName(resolvedSurveyorName);
        const incomingNameMatches = normalizeSurveyorName(incoming.assignedSurveyorName || '') ===
          normalizeSurveyorName(resolvedSurveyorName);
        if (
          (existing.assignedSurveyorId && existing.assignedSurveyorId !== resolvedSurveyorId && !existingNameMatches) ||
          (!existing.assignedSurveyorId && existing.assignedSurveyorName && !existingNameMatches) ||
          (incoming.assignedSurveyorId && incoming.assignedSurveyorId !== entry.surveyorId && !incomingNameMatches)
        ) {
          throw new Error(`Hộ ${existing.sttMau || existing.id} đang thuộc ĐTV khác với gói kết quả.`);
        }
        const incomingTime = Date.parse(incoming.updatedAt || workPackage.exportedAt);
        const existingTime = Date.parse(existing.updatedAt || '');
        if (Number.isFinite(existingTime) && Number.isFinite(incomingTime) && incomingTime < existingTime) {
          continue;
        }
        nextHouseholds[householdIndex] = {
          ...existing,
          assignedSurveyorId: resolvedSurveyorId,
          assignedSurveyorName: resolvedSurveyorName,
          surveyStatus: incoming.surveyStatus || existing.surveyStatus,
          questionnaire: incoming.questionnaire || existing.questionnaire,
          updatedAt: incoming.updatedAt || workPackage.exportedAt,
          updatedBy: incoming.updatedBy || resolvedSurveyorName,
          note: incoming.note || existing.note
        };
        householdIndexById.set(existing.id, householdIndex);
        householdIndexById.set(incoming.id, householdIndex);
        householdIndexByCompositeKey.set(householdCompositeKey(existing), householdIndex);
        updatedCount++;
      }
      processedAreas.push({
        area: localArea,
        commune: localCommune,
        surveyorId: resolvedSurveyorId,
        surveyorName: resolvedSurveyorName
      });
    }

    setHouseholds(nextHouseholds);
    let progressSynced = true;
    try {
      const householdsByArea = new Map<string, Household[]>();
      nextHouseholds.forEach(household => {
        const keys = new Set([
          household.areaId,
          `${household.communeId}_${household.areaCode}`,
          `${household.communeCode}_${household.areaCode}`
        ].filter(Boolean));
        keys.forEach(key => {
          const areaHouseholds = householdsByArea.get(key) || [];
          areaHouseholds.push(household);
          householdsByArea.set(key, areaHouseholds);
        });
      });
      const snapshots = processedAreas.map(item => createAreaProgressSnapshot(
        item.surveyorId,
        item.surveyorName,
        item.area,
        item.commune,
        (householdsByArea.get(item.area.id) ||
          householdsByArea.get(`${item.commune.id}_${item.area.code}`) ||
          householdsByArea.get(`${item.commune.communeCode}_${item.area.code}`) ||
          []).filter(h =>
          h.assignedSurveyorId
            ? h.assignedSurveyorId === item.surveyorId
            : !h.assignedSurveyorName || h.assignedSurveyorName === item.surveyorName
        )
      ));
      await Promise.all(snapshots.map(snapshot =>
        setDoc(doc(db, 'areaProgress', snapshot.id), snapshot)
      ));
    } catch (err) {
      console.error('Không thể đồng bộ số đếm tiến độ lên Firebase:', err);
      progressSynced = false;
    }
    return {
      updatedCount,
      newCount: 0,
      areaCount: processedAreas.length,
      progressSynced
    };
  };

  const handleSaveSurveyor = async (surveyor: Surveyor) => {
    setSurveyors(prev => {
      const idx = prev.findIndex(s => s.id === surveyor.id);
      const next = idx >= 0 ? prev.map(s => s.id === surveyor.id ? surveyor : s) : [...prev, surveyor];
      try { localStorage.setItem('cached_surveyors', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleDeleteSurveyor = async (id: string) => {
    setSurveyors(prev => {
      const next = prev.filter(s => s.id !== id);
      try { localStorage.setItem('cached_surveyors', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleSaveDepartment = async (dept: Department) => {
    setDepartments(prev => {
      const idx = prev.findIndex(d => d.id === dept.id);
      const next = idx >= 0 ? prev.map(d => d.id === dept.id ? dept : d) : [...prev, dept];
      try { localStorage.setItem('cached_departments', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleDeleteDepartment = async (id: string) => {
    setDepartments(prev => {
      const next = prev.filter(d => d.id !== id);
      try { localStorage.setItem('cached_departments', JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const handleBatchAssignDepartmentArea = async (departmentId: string, areaCodes: string[]) => {
    const targetDept = departments.find(d => d.id === departmentId);
    if (!targetDept) return;
    const updated: Department = {
      ...targetDept,
      assignedAreaCodes: areaCodes,
      updatedAt: new Date().toISOString()
    };
    await handleSaveDepartment(updated);
  };

  const handleBatchAssignArea = async (surveyorId: string, areaIdOrCode: string | string[], communeIdsOrCodes?: string[], scopeAreaIds?: string[]) => {
    const targetSurveyor = surveyors.find(s => s.id === surveyorId);
    if (!targetSurveyor) return;

    const selectedAreaIds = Array.isArray(areaIdOrCode) ? areaIdOrCode : (areaIdOrCode ? [areaIdOrCode] : []);
    const scopeIds = scopeAreaIds || areas.map(a => a.id);
    const targetCommuneSet = new Set<string>(communeIdsOrCodes || []);

    const targetAreas = areas.filter(a => selectedAreaIds.includes(a.id) || selectedAreaIds.includes(a.code) || selectedAreaIds.includes(`${a.communeId}_${a.code}`));
    const targetAreaIds = new Set(targetAreas.map(a => a.id));
    const targetAreaKeys = new Set(targetAreas.map(a => `${a.communeId}_${a.code}`));
    targetAreas.forEach(a => {
      if (a.communeId) targetCommuneSet.add(a.communeId);
      if ((a as any).communeCode) targetCommuneSet.add((a as any).communeCode);
    });

    const updatedHouseholds = households.map(h => {
      const inScope = scopeIds.includes(h.areaId) || scopeIds.includes(h.areaCode) || scopeIds.includes(`${h.communeId}_${h.areaCode}`);
      const isSelectedMatch = targetAreaIds.has(h.areaId) || 
        targetAreaKeys.has(`${h.communeId}_${h.areaCode}`) ||
        selectedAreaIds.includes(h.areaId) ||
        selectedAreaIds.includes(h.areaCode);

      if (inScope) {
        if (isSelectedMatch) {
          return {
            ...h,
            assignedSurveyorId: targetSurveyor.id,
            assignedSurveyorName: targetSurveyor.name
          };
        } else if (h.assignedSurveyorId === targetSurveyor.id) {
          return {
            ...h,
            assignedSurveyorId: '',
            assignedSurveyorName: ''
          };
        }
      }
      return h;
    });

    setHouseholds(updatedHouseholds);
    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}

    let currentAssigned = (targetSurveyor.assignedAreas || []).filter(item => item !== '001' && item !== 'ALL');
    const newAssignedSet = new Set(currentAssigned);
    scopeIds.forEach(id => {
      newAssignedSet.delete(id);
      const ar = areas.find(a => a.id === id);
      if (ar) {
        newAssignedSet.delete(ar.code);
        newAssignedSet.delete(`${ar.communeId}_${ar.code}`);
        if ((ar as any).communeCode) {
          newAssignedSet.delete(`${(ar as any).communeCode}_${ar.code}`);
        }
      }
    });
    selectedAreaIds.forEach(id => newAssignedSet.add(id));

    const updatedSurveyor: Surveyor = {
      ...targetSurveyor,
      assignedAreas: Array.from(newAssignedSet),
      assignedCommunes: targetCommuneSet.size > 0 ? Array.from(targetCommuneSet) : targetSurveyor.assignedCommunes,
      updatedAt: new Date().toISOString()
    };
    await handleSaveSurveyor(updatedSurveyor);

  };

  const handleBatchImportAssignments = async (assignments: { surveyorId: string; areaIds: string[]; communeIds: string[] }[]) => {
    if (assignments.length === 0) return;

    let updatedHouseholds = [...households];
    const updatedSurveyorsMap = new Map<string, Surveyor>();
    surveyors.forEach(s => updatedSurveyorsMap.set(s.id, { ...s }));

    assignments.forEach(({ surveyorId, areaIds, communeIds }) => {
      const surv = updatedSurveyorsMap.get(surveyorId);
      if (!surv) return;

      const targetCommuneSet = new Set(communeIds);
      const targetAreas = areas.filter(a => 
        areaIds.includes(a.id) || 
        areaIds.includes(a.code) || 
        areaIds.includes(`${a.communeId}_${a.code}`) ||
        targetCommuneSet.has(a.communeId) || 
        (Boolean((a as any).communeCode) && targetCommuneSet.has((a as any).communeCode))
      );
      const targetAreaIds = new Set(targetAreas.map(a => a.id));
      const targetAreaKeys = new Set(targetAreas.map(a => `${a.communeId}_${a.code}`));
      targetAreas.forEach(a => {
        if (a.communeId) targetCommuneSet.add(a.communeId);
        if ((a as any).communeCode) targetCommuneSet.add((a as any).communeCode);
      });

      updatedHouseholds = updatedHouseholds.map(h => {
        const isMatch = targetAreaIds.has(h.areaId) || 
          targetAreaKeys.has(`${h.communeId}_${h.areaCode}`) ||
          areaIds.includes(h.areaId) ||
          (targetCommuneSet.size > 0 && (targetCommuneSet.has(h.communeId) || (Boolean(h.communeCode) && targetCommuneSet.has(h.communeCode)))) ||
          targetAreas.some(a => 
            (a.id === h.areaId) || 
            (a.code === h.areaCode && (a.communeId === h.communeId || (a as any).communeCode === h.communeCode))
          );
        if (isMatch) {
          return {
            ...h,
            assignedSurveyorId: surv.id,
            assignedSurveyorName: surv.name
          };
        }
        return h;
      });

      const newAssignedIds = targetAreas.length > 0 ? targetAreas.map(a => a.id) : areaIds;
      const prevAreas = (surv.assignedAreas || []).filter(item => item !== '001');
      surv.assignedAreas = Array.from(new Set([...prevAreas, ...newAssignedIds]));

      const prevCommunes = (surv.assignedCommunes || []);
      surv.assignedCommunes = Array.from(new Set([...prevCommunes, ...Array.from(targetCommuneSet)]));
      surv.updatedAt = new Date().toISOString();
      updatedSurveyorsMap.set(surveyorId, surv);
    });

    setHouseholds(updatedHouseholds);
    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}

    // Save all updated surveyors
    for (const surv of updatedSurveyorsMap.values()) {
      await handleSaveSurveyor(surv);
    }
  };

  const handleUnassignArea = async (surveyorId: string, areaIdOrCode: string) => {
    const targetSurveyor = surveyors.find(s => s.id === surveyorId);
    if (!targetSurveyor) return;

    const targetArea = areas.find(a => a.id === areaIdOrCode || a.code === areaIdOrCode || `${a.communeId}_${a.code}` === areaIdOrCode);

    const updatedHouseholds = households.map(h => {
      const isMatch = targetArea
        ? (h.areaId === targetArea.id || (h.areaCode === targetArea.code && (h.communeId === targetArea.communeId || (h as any).communeCode === targetArea.communeCode)))
        : (h.areaId === areaIdOrCode || h.areaCode === areaIdOrCode);
      if (isMatch && h.assignedSurveyorId === surveyorId) {
        return {
          ...h,
          assignedSurveyorId: '',
          assignedSurveyorName: ''
        };
      }
      return h;
    });

    setHouseholds(updatedHouseholds);
    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}

    const remainingAreas = (targetSurveyor.assignedAreas || []).filter(item => 
      item !== areaIdOrCode && 
      item !== targetArea?.id && 
      item !== targetArea?.code &&
      item !== `${targetArea?.communeId}_${targetArea?.code}`
    );

    const updatedSurveyor: Surveyor = {
      ...targetSurveyor,
      assignedAreas: remainingAreas,
      updatedAt: new Date().toISOString()
    };
    await handleSaveSurveyor(updatedSurveyor);

  };

  const handleBatchAssignSelected = async () => {
    if (selectedHouseholdIds.length === 0) {
      showNotification('error', 'Vui lòng chọn ít nhất một hộ để phân công.');
      return;
    }
    if (!batchAssignSurveyorId) {
      showNotification('error', 'Vui lòng chọn Điều tra viên để phân công.');
      return;
    }
    const targetSurveyor = surveyors.find(s => s.id === batchAssignSurveyorId);
    if (!targetSurveyor) return;

    const count = selectedHouseholdIds.length;
    const updatedHouseholds = households.map(h => {
      if (selectedHouseholdIds.includes(h.id)) {
        return {
          ...h,
          assignedSurveyorId: targetSurveyor.id,
          assignedSurveyorName: targetSurveyor.name
        };
      }
      return h;
    });

    setHouseholds(updatedHouseholds);
    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}
    setSelectedHouseholdIds([]);
    showNotification('success', `Đã phân công ${count} hộ cho ${targetSurveyor.name} thành công.`);
  };

  const handleBatchSetStatus = async (status: SurveyStatus) => {
    if (selectedHouseholdIds.length === 0) {
      showNotification('error', 'Vui lòng chọn ít nhất một hộ.');
      return;
    }

    const count = selectedHouseholdIds.length;
    const updatedHouseholds = households.map(h => {
      if (selectedHouseholdIds.includes(h.id)) {
        return {
          ...h,
          surveyStatus: status
        };
      }
      return h;
    });

    setHouseholds(updatedHouseholds);
    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}
    setSelectedHouseholdIds([]);
    showNotification('success', `Đã chuyển trạng thái ${count} hộ sang: ${SURVEY_STATUS_LABELS[status].label}`);
  };

  // Xác nhận thay thế hộ mẫu bằng hộ dự phòng thuộc cùng địa bàn
  const handleConfirmReplacement = async (
    original: Household,
    replacement: Household,
    options: {
      reason: string;
      customNote: string;
      keepSttMau: boolean;
      transferSurveyor: boolean;
    }
  ) => {
    const timestamp = new Date().toISOString();
    const reasonFull = options.customNote ? `${options.reason} (${options.customNote})` : options.reason;

    // 1. Cập nhật hộ dự phòng -> Thành hộ chính thức
    const updatedReplacement: Household = {
      ...replacement,
      sampleStatus: 'CHÍNH THỨC',
      sttMau: options.keepSttMau ? original.sttMau : replacement.sttMau,
      assignedSurveyorId: options.transferSurveyor && original.assignedSurveyorId ? original.assignedSurveyorId : (replacement.assignedSurveyorId || ''),
      assignedSurveyorName: options.transferSurveyor && original.assignedSurveyorName ? original.assignedSurveyorName : (replacement.assignedSurveyorName || ''),
      note: (replacement.note ? `${replacement.note} | ` : '') + `[Thay thế cho hộ mẫu: ${original.householdHead} (Gốc: ${original.sttGoc}) - Lý do: ${reasonFull}]`,
      updatedAt: timestamp
    };

    // 2. Cập nhật hộ mẫu cũ -> Đánh dấu ĐÃ THAY THẾ
    const updatedOriginal: Household = {
      ...original,
      sampleStatus: 'ĐÃ THAY THẾ',
      note: (original.note ? `${original.note} | ` : '') + `[Đã thay bằng hộ dự phòng: ${replacement.householdHead} (Gốc: ${replacement.sttGoc}) - Lý do: ${reasonFull}]`,
      updatedAt: timestamp
    };

    setHouseholds(prev => {
      const next = prev.map(h => {
        if (h.id === original.id) return updatedOriginal;
        if (h.id === replacement.id) return updatedReplacement;
        return h;
      });
      try { localStorage.setItem('cached_households', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    setHouseholdToReplace(null);

    showNotification('success', `Đã thay thế thành công hộ mẫu "${original.householdHead}" bằng hộ dự phòng "${replacement.householdHead}" của địa bàn [${original.areaCode}].`);
  };

  // Thêm nhanh hộ dự phòng mới cho địa bàn
  const handleAddNewReserveHousehold = async (newHhData: any): Promise<Household | null> => {
    const newId = 'hh-' + newHhData.communeId + '-' + newHhData.areaCode + '-' + Date.now();
    const newHousehold: Household = {
      id: newId,
      communeId: newHhData.communeId,
      communeCode: newHhData.communeCode,
      communeName: newHhData.communeName,
      tkcsCode: newHhData.tkcsCode || '',
      tkcsName: newHhData.tkcsName || '',
      areaId: newHhData.areaId,
      areaCode: newHhData.areaCode,
      areaName: newHhData.areaName,
      sttMau: 'DP',
      sttGoc: 'DP-' + String(households.filter(h => h.areaCode === newHhData.areaCode).length + 1),
      sampleStatus: 'DỰ PHÒNG',
      householdHead: newHhData.householdHead,
      address: newHhData.address,
      phone: newHhData.phone || '',
      membersCount: newHhData.membersCount || 4,
      workingMembersCount: 0,
      membersCountEntered: false,
      sectorCode: newHhData.sectorCode || 2,
      sectorName: SECTOR_NAMES[newHhData.sectorCode as 1 | 2 | 3 | 4] || 'Công nghiệp xây dựng',
      note: newHhData.note || '[Hộ dự phòng]',
      surveyStatus: 'CHUA_NHAP',
      assignedSurveyorId: '',
      assignedSurveyorName: '',
      questionnaire: createDefaultQuestionnaire()
    };

    setHouseholds(prev => {
      const next = [...prev, newHousehold];
      try { localStorage.setItem('cached_households', JSON.stringify(next)); } catch (e) {}
      return next;
    });

    showNotification('success', `Đã thêm hộ dự phòng "${newHousehold.householdHead}" cho địa bàn [${newHousehold.areaCode}].`);
    return newHousehold;
  };

  const handleImportAssignmentBeforeLogin = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const workPackage = parseSurveyWorkPackage(await file.text());
      if (workPackage.purpose !== 'ASSIGNMENT') {
        throw new Error('Chỉ có thể nạp gói phân công trước khi đăng nhập.');
      }
      const profiles = workPackage.surveyors || [];
      const identifier = loginIdentifier.trim().toLowerCase();
      const profile = profiles.find(item =>
        item.id.toLowerCase() === identifier ||
        item.code.toLowerCase() === identifier ||
        item.username.toLowerCase() === identifier
      ) || (profiles.length === 1 ? profiles[0] : undefined);
      if (!profile) {
        throw new Error('Không xác định được tài khoản trong gói. Hãy nhập tên đăng nhập trước hoặc yêu cầu Admin xuất đúng gói ĐTV.');
      }
      if (profile.status !== 'ACTIVE') {
        throw new Error('Tài khoản trong gói đang bị khóa hoặc ngừng hoạt động.');
      }
      const entries = workPackage.entries.filter(entry => entry.surveyorId === profile.id);
      if (entries.length === 0) {
        throw new Error('Gói JSON không có địa bàn được giao cho tài khoản này.');
      }

      const existingUser = surveyors.find(item => item.id === profile.id);
      if (existingUser?.status === 'LOCKED' || existingUser?.status === 'INACTIVE') {
        throw new Error('Tài khoản hiện có trên máy đang bị khóa hoặc ngừng hoạt động.');
      }
      const assignedAreas = Array.from(new Set([
        ...(existingUser?.assignedAreas || []),
        ...entries.map(entry => entry.area.id)
      ]));
      const importedUser: Surveyor = {
        ...(existingUser || {}),
        ...profile,
        id: profile.id,
        role: 'SURVEYOR',
        status: existingUser?.status || profile.status,
        assignedAreas,
        password: existingUser?.password,
        mustChangePassword: existingUser?.mustChangePassword ?? true
      };
      const nextSurveyors = existingUser
        ? surveyors.map(item => item.id === profile.id ? importedUser : item)
        : [...surveyors, importedUser];
      setSurveyors(nextSurveyors);
      localStorage.setItem('cached_surveyors', JSON.stringify(nextSurveyors));
      setLoginIdentifier(profile.username || profile.code);
      setLoginError('');
      setLoginInfo(existingUser
        ? `Đã nạp phân quyền và ${entries.length} địa bàn cho ${profile.name}. Hãy đăng nhập bằng mật khẩu hiện có.`
        : `Đã tạo tài khoản ${profile.name}. Mật khẩu khởi tạo: ${INITIAL_DEFAULT_PASSWORD}; hệ thống sẽ yêu cầu đổi mật khẩu sau khi đăng nhập.`
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLoginInfo('');
      setLoginError(`Không nạp được gói phân công: ${message}`);
    }
  };

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoginError('');
    setLoginInfo('');

    const idInput = loginIdentifier.trim();
    const pwInput = loginPassword.trim();

    if (!idInput) {
      setLoginError('Vui lòng nhập Tên đăng nhập hoặc Mã tài khoản.');
      return;
    }

    if (!pwInput) {
      setLoginError('Vui lòng nhập Mật khẩu.');
      return;
    }

    // Tài khoản và phân quyền được quản lý cục bộ trên thiết bị.
    const user = surveyors.find(s => 
      s.code.toLowerCase() === idInput.toLowerCase() ||
      (s.username && s.username.toLowerCase() === idInput.toLowerCase()) ||
      (s.email && s.email.toLowerCase() === idInput.toLowerCase()) ||
      s.id.toLowerCase() === idInput.toLowerCase() ||
      (s.phone && s.phone === idInput)
    );

    if (!user) {
      setLoginError('Tài khoản không tồn tại. Vui lòng kiểm tra lại Tên đăng nhập / Mã tài khoản.');
      return;
    }

    if (user.status === 'LOCKED') {
      setLoginError('Tài khoản này đang bị khóa. Vui lòng liên hệ Quản trị viên hệ thống.');
      return;
    }

    const expectedPassword = user.password || (user.id === 'admin' ? 'admin' : INITIAL_DEFAULT_PASSWORD);
    if (pwInput !== expectedPassword) {
      setLoginError('Mật khẩu không chính xác. Vui lòng thử lại.');
      return;
    }

    // Login success
    handleResetFilters();
    setCurrentSurveyorId(user.id);
    setIsLoggedIn(true);
    try {
      localStorage.setItem('is_user_authenticated', 'true');
      localStorage.setItem('active_surveyor_id', user.id);
    } catch (e) {}
    
    setLoginIdentifier('');
    setLoginPassword('');
    setShowLoginModal(false);

    if (user.mustChangePassword) {
      setShowChangePasswordModal(true);
      showNotification('success', `Đăng nhập thành công! Vui lòng thiết lập mật khẩu mới cho tài khoản ${user.name}.`);
    } else {
      showNotification('success', `Đăng nhập thành công! Xin chào ${user.name} (${ROLE_LABELS[user.role]?.label || user.role}).`);
    }

    if (user.role === 'SURVEYOR') {
      setActiveTab('entry');
    }
  };

  const handleLogout = () => {
    handleResetFilters();
    setIsLoggedIn(false);
    try { 
      localStorage.setItem('is_user_authenticated', 'false');
      localStorage.removeItem('active_surveyor_id');
    } catch (e) {}
    showNotification('success', 'Đã đăng xuất khỏi tài khoản.');
  };

  const handleChangeMyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setChangePasswordError('');

    if (!currentPasswordInput) {
      setChangePasswordError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    const expectedCurrentPassword = currentUser.password || (currentUser.id === 'admin' ? 'admin' : INITIAL_DEFAULT_PASSWORD);
    if (currentPasswordInput !== expectedCurrentPassword) {
      setChangePasswordError('Mật khẩu hiện tại không chính xác.');
      return;
    }

    if (!newPasswordInput || newPasswordInput.trim().length < 4) {
      setChangePasswordError('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }

    if (newPasswordInput.trim() !== confirmPasswordInput.trim()) {
      setChangePasswordError('Mật khẩu xác nhận không khớp với mật khẩu mới.');
      return;
    }

    try {
      setIsSavingPassword(true);
      const updatedUser: Surveyor = {
        ...currentUser,
        password: newPasswordInput.trim(),
        mustChangePassword: false,
        lastPasswordChange: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await handleSaveSurveyor(updatedUser);
      showNotification('success', 'Đã đổi mật khẩu và lưu cục bộ trên máy này.');
      setShowChangePasswordModal(false);
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
    } catch (err: any) {
      setChangePasswordError('Lỗi khi lưu mật khẩu: ' + err.message);
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Xóa bảng kê cục bộ để nạp lại dữ liệu từ file Excel.
  const handleClearAllData = async () => {
    setIsDeleting(true);
    setDeleteProgressText('Đang xóa toàn bộ dữ liệu hệ thống...');

    // Clear local storage and state immediately
    localStorage.removeItem('cached_households');
    localStorage.removeItem('cached_communes');
    localStorage.removeItem('cached_areas');

    setHouseholds([]);
    setAreas([]);
    setCommunes([]);
    setSelectedHouseholdIds([]);
    setUploadReport(null);
    setSelectedCommuneId('ALL');
    setSelectedAreaId('ALL');
    setSelectedTkcs('ALL');
    setCurrentPage(1);

    setIsClearAllModalOpen(false);
    showNotification('success', 'Đã xóa toàn bộ dữ liệu thành công! Bạn có thể tải file Excel mới ngay bây giờ.');
    setActiveTab('import');
    setIsDeleting(false);
    setDeleteProgressText('');

  };

  // 2. Delete single commune and its related areas and households
  const handleDeleteCommune = async (communeId: string) => {
    setIsDeleting(true);
    setDeleteProgressText('Đang xóa dữ liệu xã...');

    const targetCommune = communes.find(c => c.id === communeId);
    const communeName = targetCommune ? targetCommune.communeName : communeId;

    const remainingCommunes = communes.filter(c => c.id !== communeId);
    const matchingAreas = areas.filter(a => a.communeId === communeId);
    const remainingAreas = areas.filter(a => a.communeId !== communeId);
    const matchingHouseholds = households.filter(h => h.communeId === communeId);
    const remainingHouseholds = households.filter(h => h.communeId !== communeId);

    // Update state & local storage immediately
    setCommunes(remainingCommunes);
    setAreas(remainingAreas);
    setHouseholds(remainingHouseholds);

    try {
      if (remainingCommunes.length > 0) localStorage.setItem('cached_communes', JSON.stringify(remainingCommunes));
      else localStorage.removeItem('cached_communes');

      if (remainingAreas.length > 0) localStorage.setItem('cached_areas', JSON.stringify(remainingAreas));
      else localStorage.removeItem('cached_areas');

      if (remainingHouseholds.length > 0) localStorage.setItem('cached_households', JSON.stringify(remainingHouseholds));
      else localStorage.removeItem('cached_households');
    } catch (e) {}

    if (selectedCommuneId === communeId) setSelectedCommuneId('ALL');
    setCommuneToDelete(null);
    showNotification('success', `Đã xóa xã "${communeName}" và toàn bộ ${matchingHouseholds.length} hộ liên quan.`);
    setIsDeleting(false);
    setDeleteProgressText('');

  };

  // 3. Delete single area and its related households
  const handleDeleteArea = async (area: SurveyArea) => {
    setIsDeleting(true);
    setDeleteProgressText(`Đang xóa địa bàn ${area.code}...`);

    const remainingAreas = areas.filter(a => a.id !== area.id);
    const matchingHouseholds = households.filter(h => h.areaId === area.id || h.areaCode === area.code);
    const remainingHouseholds = households.filter(h => h.areaId !== area.id && h.areaCode !== area.code);

    setAreas(remainingAreas);
    setHouseholds(remainingHouseholds);

    try {
      if (remainingAreas.length > 0) localStorage.setItem('cached_areas', JSON.stringify(remainingAreas));
      else localStorage.removeItem('cached_areas');

      if (remainingHouseholds.length > 0) localStorage.setItem('cached_households', JSON.stringify(remainingHouseholds));
      else localStorage.removeItem('cached_households');
    } catch (e) {}

    if (selectedAreaId === area.id || selectedAreaId === area.code) setSelectedAreaId('ALL');
    setAreaToDelete(null);
    showNotification('success', `Đã xóa địa bàn "${area.name}" (Mã ${area.code}) cùng ${matchingHouseholds.length} hộ liên quan.`);
    setIsDeleting(false);
    setDeleteProgressText('');

  };

  // 4. Delete single household
  const handleDeleteSingleHousehold = async (household: Household) => {
    setHouseholds(prev => {
      const next = prev.filter(h => h.id !== household.id);
      try {
        if (next.length > 0) localStorage.setItem('cached_households', JSON.stringify(next));
        else localStorage.removeItem('cached_households');
      } catch (e) {}
      return next;
    });
    setSelectedHouseholdIds(prev => prev.filter(id => id !== household.id));
    setHouseholdToDelete(null);
    showNotification('success', `Đã xóa hộ "${household.householdHead}" thành công.`);
  };

  // 5. Delete batch selected households
  const handleDeleteBatchSelected = async () => {
    if (selectedHouseholdIds.length === 0) return;
    const count = selectedHouseholdIds.length;
    setIsDeleting(true);
    setDeleteProgressText(`Đang xóa ${count} hộ gia đình đã chọn...`);

    const idsToDelete = [...selectedHouseholdIds];
    const remainingHouseholds = households.filter(h => !idsToDelete.includes(h.id));
    setHouseholds(remainingHouseholds);
    try {
      if (remainingHouseholds.length > 0) localStorage.setItem('cached_households', JSON.stringify(remainingHouseholds));
      else localStorage.removeItem('cached_households');
    } catch (e) {}

    setSelectedHouseholdIds([]);
    setIsBatchDeleteModalOpen(false);
    showNotification('success', `Đã xóa thành công ${count} hộ gia đình đã chọn.`);
    setIsDeleting(false);
    setDeleteProgressText('');

  };

  // Xóa trắng (reset) phiếu điều tra của 1 hộ đơn lẻ
  const handleResetSingleHousehold = async (targetH: Household) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa trắng phiếu của hộ "${targetH.householdHead}" (đưa về trạng thái chưa nhập ban đầu) không?`)) {
      return;
    }
    const updatedH: Household = {
      ...targetH,
      surveyStatus: 'CHUA_NHAP',
      questionnaire: createDefaultQuestionnaire(),
      updatedBy: currentUser.name,
      updatedAt: new Date().toISOString()
    };
    setHouseholds(prev => {
      const next = prev.map(item => item.id === targetH.id ? updatedH : item);
      try { localStorage.setItem('cached_households', JSON.stringify(next)); } catch (e) {}
      return next;
    });
    showNotification('success', `Đã xóa trắng thành công phiếu của hộ "${targetH.householdHead}".`);
  };

  // Thay đổi trực tiếp phân loại ngành (1-4) của hộ ngay trên bảng
  const handleQuickChangeSector = async (householdId: string, newSectorCode: 1 | 2 | 3 | 4) => {
    const newSectorName = SECTOR_NAMES[newSectorCode] || 'Công nghiệp xây dựng';
    setHouseholds(prev => {
      const next = prev.map(item => {
        if (item.id === householdId) {
          return {
            ...item,
            sectorCode: newSectorCode,
            sectorName: newSectorName,
            updatedAt: new Date().toISOString()
          };
        }
        return item;
      });
      try {
        localStorage.setItem('cached_households', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    showNotification('success', `Đã cập nhật hộ sang ngành [${newSectorCode}] ${newSectorName}.`);
  };



  const handleResetQuestionnaires = async () => {
    setIsResettingQuestionnaire(true);
    let targetIds: string[] = [];

    if (resetTargetType === 'all_system_surveyed') {
      targetIds = households.filter(h => isHouseholdSurveyed(h) || h.surveyStatus !== 'CHUA_NHAP').map(h => h.id);
      if (targetIds.length === 0) {
        targetIds = households.filter(h => h.questionnaire && (
          h.questionnaire.muc1_has || h.questionnaire.muc2_has || h.questionnaire.muc3_has ||
          h.questionnaire.muc4_has || h.questionnaire.muc5_has || h.questionnaire.muc6_has || h.questionnaire.muc7_has
        )).map(h => h.id);
      }
    } else if (resetTargetType === 'commune_surveyed') {
      const targetCommune = communes.find(c => c.id === selectedCommuneId || c.communeCode === selectedCommuneId);
      targetIds = households.filter(h => {
        const matchComm = h.communeId === selectedCommuneId || (targetCommune && (h.communeCode === targetCommune.communeCode || h.communeId === targetCommune.id));
        return matchComm && (isHouseholdSurveyed(h) || h.surveyStatus !== 'CHUA_NHAP');
      }).map(h => h.id);
    } else if (resetTargetType === 'area') {
      const targetCommune = communes.find(c => c.id === resetCommuneId || c.communeCode === resetCommuneId);
      const targetArea = areas.find(a => a.id === resetAreaId || a.code === resetAreaId);
      const matching = households.filter(h => {
        if (resetCommuneId !== 'ALL') {
          const matchComm = h.communeId === resetCommuneId || (targetCommune && (h.communeCode === targetCommune.communeCode || h.communeId === targetCommune.id));
          if (!matchComm) return false;
        }
        if (resetAreaId !== 'ALL') {
          const matchArea = h.areaId === resetAreaId || h.areaCode === resetAreaId || (targetArea && (h.areaCode === targetArea.code || h.areaName === targetArea.name));
          if (!matchArea) return false;
        }
        return true;
      });
      targetIds = matching.map(h => h.id);
    } else if (resetTargetType === 'selected') {
      targetIds = [...selectedHouseholdIds];
    } else if (resetTargetType === 'all_filtered') {
      targetIds = filteredHouseholds.map(h => h.id);
    }

    if (targetIds.length === 0) {
      showNotification('error', 'Không tìm thấy hộ nào phù hợp để xóa trắng phiếu.');
      setIsResettingQuestionnaire(false);
      return;
    }

    const updatedHouseholds = households.map(h => {
      if (targetIds.includes(h.id)) {
        return {
          ...h,
          surveyStatus: 'CHUA_NHAP' as SurveyStatus,
          questionnaire: createDefaultQuestionnaire(),
          updatedBy: currentUser.name,
          updatedAt: new Date().toISOString()
        };
      }
      return h;
    });

    setHouseholds(updatedHouseholds);
    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}
    setSelectedHouseholdIds([]);
    setIsResetQuestionnaireModalOpen(false);
    setIsResettingQuestionnaire(false);
    showNotification('success', `Đã xóa trắng (reset) thành công phiếu điều tra của ${targetIds.length} hộ!`);
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [
      ['DANH SÁCH BẢNG KÊ HỘ MẪU ĐIỀU TRA THU NHẬP CẤP XÃ', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [`Xã/phường: ${currentCommune?.communeName || formCommuneName || '---'}`, `Mã xã: ${currentCommune?.communeCode || formCommuneCode || '---'}`, `TKCS: ${currentCommune?.tkcsName || formTkcsName || '---'}`, '', '', '', '', '', '', '', '', '', '', '', '', ''],
      [],
      [
        'STT Mẫu', 'Mã TKCS', 'Tên TKCS', 'Mã Xã', 'Tên Xã', 'Mã ĐB', 'Tên Địa bàn',
        'Trạng thái', 'STT gốc', 'Họ và tên chủ hộ', 'Địa chỉ của hộ', 'Số nhân khẩu',
        'Nguồn thu (1-4)', 'Phân loại ngành', 'Ghi chú (SĐT)', 'Tổng thu nhập (1.000 đ)'
      ]
    ];

    filteredHouseholds.forEach(h => {
      const inc = calculateHouseholdTotalIncome(h);
      const cObj = communes.find(c => c.id === h.communeId || c.communeCode === h.communeCode);
      const aObj = areas.find(a => 
        (h.areaId && a.id === h.areaId) || 
        (h.areaCode && a.code === h.areaCode && (!h.communeId || !a.communeId || a.communeId === h.communeId)) ||
        (h.areaCode && a.code === h.areaCode)
      );

      const rTkcsCode = h.tkcsCode || cObj?.tkcsCode || formTkcsCode || '';
      const rTkcsName = h.tkcsName || cObj?.tkcsName || formTkcsName || '';
      const rCommuneCode = h.communeCode || cObj?.communeCode || formCommuneCode || '';
      const rCommuneName = h.communeName || cObj?.communeName || formCommuneName || '';
      const rAreaCode = h.areaCode || aObj?.code || '001';
      const rAreaName = (h.areaName && h.areaName.trim() && h.areaName !== 'Địa bàn')
        ? h.areaName.trim()
        : (aObj?.name && aObj.name.trim() && aObj.name !== 'Địa bàn')
        ? aObj.name.trim()
        : ((h as any).sheetName || (h.areaCode ? `Địa bàn ${h.areaCode}` : '---'));

      wsData.push([
        h.sttMau,
        rTkcsCode,
        rTkcsName,
        rCommuneCode,
        rCommuneName,
        rAreaCode,
        rAreaName,
        SURVEY_STATUS_LABELS[h.surveyStatus || 'CHUA_NHAP']?.label || 'Tin chưa nhập',
        h.sttGoc,
        h.householdHead,
        h.address,
        h.membersCount,
        h.sectorCode,
        h.sectorName,
        h.note,
        inc.total
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Bang_Ke_Ho_Mau");
    XLSX.writeFile(wb, `Danh_Sach_Bang_Ke_Ho_Mau_${currentCommune?.communeName || 'ToanXa'}.xlsx`);
    showNotification('success', 'Đã xuất file Excel danh sách Bảng kê Hộ mẫu.');
  };

  const handleExportEnteredQuestionnairesExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Sheet Bảng kê Hộ mẫu
    const wsDataBk: any[][] = [
      ['DANH SÁCH BẢNG KÊ HỘ MẪU ĐÃ NHẬP TIN THU NHẬP HỘ GIA ĐÌNH'],
      [],
      [
        'STT Mẫu', 'Mã TKCS', 'Tên TKCS', 'Mã Xã', 'Tên Xã', 'Mã ĐB', 'Tên Địa bàn',
        'Trạng thái', 'STT gốc', 'Họ và tên chủ hộ', 'Địa chỉ', 'Số nhân khẩu',
        'Phân loại ngành', 'Tổng thu nhập (1.000đ)', 'TNBQ/người/tháng (1.000đ)'
      ]
    ];

    const exportList = filteredHouseholds.filter(h => h.surveyStatus === 'DA_HOAN_THANH' || h.surveyStatus === 'DA_DUYET' || h.surveyStatus === 'DANG_NHAP' || Boolean(h.questionnaire));
    const listToExport = exportList.length > 0 ? exportList : filteredHouseholds;

    listToExport.forEach(h => {
      const inc = calculateHouseholdTotalIncome(h);
      const perCapitaMonth = h.membersCount > 0 ? Math.round((inc.total / h.membersCount / 12) * 10) / 10 : 0;
      const cObj = communes.find(c => c.id === h.communeId || c.communeCode === h.communeCode);
      const aObj = areas.find(a => 
        (h.areaId && a.id === h.areaId) || 
        (h.areaCode && a.code === h.areaCode && (!h.communeId || !a.communeId || a.communeId === h.communeId)) ||
        (h.areaCode && a.code === h.areaCode)
      );

      const rTkcsCode = h.tkcsCode || cObj?.tkcsCode || formTkcsCode || '';
      const rTkcsName = h.tkcsName || cObj?.tkcsName || formTkcsName || '';
      const rCommuneCode = h.communeCode || cObj?.communeCode || formCommuneCode || '';
      const rCommuneName = h.communeName || cObj?.communeName || formCommuneName || '';
      const rAreaCode = h.areaCode || aObj?.code || '001';
      const rAreaName = (h.areaName && h.areaName.trim() && h.areaName !== 'Địa bàn')
        ? h.areaName.trim()
        : (aObj?.name && aObj.name.trim() && aObj.name !== 'Địa bàn')
        ? aObj.name.trim()
        : ((h as any).sheetName || (h.areaCode ? `Địa bàn ${h.areaCode}` : '---'));

      wsDataBk.push([
        h.sttMau,
        rTkcsCode,
        rTkcsName,
        rCommuneCode,
        rCommuneName,
        rAreaCode,
        rAreaName,
        SURVEY_STATUS_LABELS[h.surveyStatus || 'CHUA_NHAP']?.label || 'Tin chưa nhập',
        h.sttGoc,
        h.householdHead,
        h.address,
        h.membersCount,
        h.sectorName,
        inc.total,
        perCapitaMonth
      ]);
    });

    const wsBk = XLSX.utils.aoa_to_sheet(wsDataBk);
    XLSX.utils.book_append_sheet(wb, wsBk, "Bang_Ke_Ho_Mau");

    // 2. Sheet Chi tiết Nội dung Phiếu Nhập
    const wsDataPhieu: any[][] = [
      ['NỘI DUNG CHI TIẾT PHIẾU ĐIỀU TRA THU NHẬP HỘ GIA ĐÌNH (PHỤ LỤC II)'],
      [],
      [
        'STT', 
        'Mã TKCS', 
        'Tên TKCS', 
        'Mã Xã', 
        'Tên Xã', 
        'Mã ĐB', 
        'Tên Địa bàn', 
        'STT Mẫu', 
        'STT Gốc',
        'Họ và tên chủ hộ', 
        'Địa chỉ của hộ',
        'Trạng thái nhập tin', 
        'Số nhân khẩu',
        'Phân loại ngành',
        'Mục 1: Tiền lương & công (1.000đ)',
        'Mục 2: Trồng trọt (1.000đ)',
        'Mục 3: Chăn nuôi (1.000đ)',
        'Mục 4: Lâm nghiệp (1.000đ)',
        'Mục 5: Thủy sản (1.000đ)',
        'Mục 6: Phi nông nghiệp (1.000đ)',
        'Mục 7: Thu khác (1.000đ)',
        'TỔNG THU NHẬP HỘ (1.000đ)',
        'TNBQ/NGƯỜI/THÁNG (1.000đ)'
      ]
    ];

    listToExport.forEach((h, idx) => {
      const inc = calculateHouseholdTotalIncome(h);
      const perCapitaMonth = h.membersCount > 0 ? Math.round((inc.total / h.membersCount / 12) * 10) / 10 : 0;
      const cObj = communes.find(c => c.id === h.communeId || c.communeCode === h.communeCode);
      const aObj = areas.find(a => 
        (h.areaId && a.id === h.areaId) || 
        (h.areaCode && a.code === h.areaCode && (!h.communeId || !a.communeId || a.communeId === h.communeId)) ||
        (h.areaCode && a.code === h.areaCode)
      );

      const rTkcsCode = h.tkcsCode || cObj?.tkcsCode || formTkcsCode || '';
      const rTkcsName = h.tkcsName || cObj?.tkcsName || formTkcsName || '';
      const rCommuneCode = h.communeCode || cObj?.communeCode || formCommuneCode || '';
      const rCommuneName = h.communeName || cObj?.communeName || formCommuneName || '';
      const rAreaCode = h.areaCode || aObj?.code || '001';
      const rAreaName = (h.areaName && h.areaName.trim() && h.areaName !== 'Địa bàn')
        ? h.areaName.trim()
        : (aObj?.name && aObj.name.trim() && aObj.name !== 'Địa bàn')
        ? aObj.name.trim()
        : ((h as any).sheetName || (h.areaCode ? `Địa bàn ${h.areaCode}` : '---'));

      wsDataPhieu.push([
        idx + 1,
        rTkcsCode,
        rTkcsName,
        rCommuneCode,
        rCommuneName,
        rAreaCode,
        rAreaName,
        h.sttMau,
        h.sttGoc,
        h.householdHead,
        h.address || '',
        SURVEY_STATUS_LABELS[h.surveyStatus || 'CHUA_NHAP']?.label || 'Tin chưa nhập',
        h.membersCount,
        h.sectorName || '',
        inc.muc1,
        inc.muc2,
        inc.muc3,
        inc.muc4,
        inc.muc5,
        inc.muc6,
        inc.muc7,
        inc.total,
        perCapitaMonth
      ]);
    });

    const wsPhieu = XLSX.utils.aoa_to_sheet(wsDataPhieu);
    XLSX.utils.book_append_sheet(wb, wsPhieu, "Chi_Tiet_Phieu_Da_Nhap");

    XLSX.writeFile(wb, `Noi_Dung_Phieu_Nhap_${currentCommune?.communeName || 'DanhSachHo'}.xlsx`);
    showNotification('success', `Đã xuất ${listToExport.length} phiếu hộ ra file Excel theo đúng nội dung phiếu nhập.`);
  };

  const handleExportExcelTNH = () => {
    const wb = XLSX.utils.book_new();
    const scopeText = tnhScopeMode === 'COMMUNE_QUICK' || tnhScopeMode === 'COMMUNE_SECTOR'
      ? (communes.find(c => c.id === tnhSelectedCommuneId)?.communeName || 'ToanXa')
      : tnhScopeMode === 'TKCS_SECTOR'
      ? `TKCS_${tnhSelectedTkcs}`
      : 'ToanTinh';

    const wsData: any[][] = [];
    
    // Title
    wsData.push([`TỔNG HỢP NHANH SỐ LIỆU THU NHẬP (${scopeText.toUpperCase()})`]);
    wsData.push([]);
    
    // Upper Summary Table Headers
    wsData.push([
      'STT', 'Mã loại', 'Tên nhóm ngành nguồn thu lớn nhất', 'Tổng số hộ trong bảng kê',
      'Tỷ trọng cơ cấu (%)', 'Chỉ tiêu phân bổ mẫu chính thức', 'Số hộ điều tra thực tế',
      'TNBQ đầu người/tháng theo loại hộ (=G/F/12) (1.000 đ)',
      'Suy rộng TNBQ (= Tỷ trọng % * TNBQ theo loại hộ) (1.000 đ)'
    ]);

    // Sector rows
    tnhSummary.sectorData.forEach((s, idx) => {
      wsData.push([
        idx + 1,
        s.code,
        s.name,
        s.bkCount,
        `${s.percent}%`,
        s.mauAlloc,
        s.surveyCount,
        s.perCapitaMonth,
        s.extrapolatedIncomeYear
      ]);
    });

    // Total Row
    wsData.push([
      '', 'TỔNG', 'TOÀN BỘ PHẠM VI BÁO CÁO', tnhSummary.totalBkHH, '100%', tnhSummary.totalAllocMau,
      tnhSummary.totalHH, tnhSummary.overallDirectPerCapita, tnhSummary.overallExtrapolated
    ]);

    wsData.push([]);
    wsData.push([]);
    wsData.push(['STT', 'Xã/phường', 'Địa bàn điều tra', 'STT Mẫu', 'Họ và tên chủ hộ', 'Tổng số thành viên (Người)', 'Tổng thu nhập (1.000đ)']);

    // Lower Sector Breakdown Sections
    const groupLabels = [
      { code: 1, label: 'I. Hộ NLTS (Nông, lâm thủy sản)' },
      { code: 2, label: 'II. Hộ CNXD (Công nghiệp xây dựng)' },
      { code: 3, label: 'III. Hộ TMDV (Thương mại dịch vụ)' },
      { code: 4, label: 'IV. Hộ Nguồn thu khác / Lương' }
    ];

    groupLabels.forEach(grp => {
      const sData = tnhSummary.sectorData.find(s => s.code === grp.code);
      if (!sData) return;

      wsData.push([
        grp.label, '', '', '', '', `Tổng nhân khẩu: ${sData.groupMembers}`, `Tổng TN: ${sData.groupIncome.toLocaleString()} | TNBQ/người/tháng (=G/F/12): ${sData.perCapitaMonth}`
      ]);

      sData.sList.forEach((h, idx) => {
        const inc = calculateHouseholdTotalIncome(h).total;
        wsData.push([
          idx + 1,
          h.communeName || formCommuneName || '---',
          h.areaName || 'Địa bàn',
          h.sttMau,
          h.householdHead,
          h.membersCount,
          inc
        ]);
      });
      wsData.push([]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "TongHopNhanh");
    XLSX.writeFile(wb, `Tong_Hop_Nhanh_${scopeText}.xlsx`);
    showNotification('success', `Đã xuất Báo cáo Tổng hợp nhanh [${scopeText}] ra file Excel.`);
  };

  // Reusable Household Table component with Sticky Header & Pagination
  function renderHouseholdTable(showEntryButton: boolean = true, customMaxHeight: string = 'max-h-[70vh]') {
    const totalItems = filteredHouseholds.length;
    const actualPageSize = pageSize === -1 ? totalItems : pageSize;
    const totalPages = Math.max(1, Math.ceil(totalItems / (actualPageSize || 1)));
    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    const paginatedHouseholds = pageSize === -1 
      ? filteredHouseholds 
      : filteredHouseholds.slice((validPage - 1) * actualPageSize, validPage * actualPageSize);

    const isAllSelected = paginatedHouseholds.length > 0 && paginatedHouseholds.every(h => selectedHouseholdIds.includes(h.id));

    const handleToggleSelectAll = () => {
      if (isAllSelected) {
        setSelectedHouseholdIds(prev => prev.filter(id => !paginatedHouseholds.some(h => h.id === id)));
      } else {
        const idsToAdd = paginatedHouseholds.map(h => h.id);
        setSelectedHouseholdIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
      }
    };

    const handleToggleSelectRow = (id: string) => {
      setSelectedHouseholdIds(prev => 
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      );
    };

    const startIdx = totalItems === 0 ? 0 : (validPage - 1) * (actualPageSize || 1) + 1;
    const endIdx = pageSize === -1 ? totalItems : Math.min(validPage * actualPageSize, totalItems);

    // Tính toán tổng hợp nhanh theo phạm vi đang lọc: "Có bao nhiêu tổng hợp đến đó, chia đúng số nhân khẩu thực tế điều tra"
    const surveyedInFilter = filteredHouseholds.filter(h => isHouseholdSurveyed(h));
    const surveyedCount = surveyedInFilter.length;
    let surveyedMembers = 0;
    let surveyedIncome = 0;
    surveyedInFilter.forEach(h => {
      surveyedMembers += (Number(h.membersCount) || 1);
      surveyedIncome += calculateHouseholdTotalIncome(h).total;
    });
    const perCapitaFilteredMonth = surveyedMembers > 0 ? Math.round(surveyedIncome / surveyedMembers / 12) : 0;

    const s1Filtered = filteredHouseholds.filter(h => Number(h.sectorCode) === 1).length;
    const s2Filtered = filteredHouseholds.filter(h => Number(h.sectorCode) === 2).length;
    const s3Filtered = filteredHouseholds.filter(h => Number(h.sectorCode) === 3).length;
    const s4Filtered = filteredHouseholds.filter(h => Number(h.sectorCode) === 4).length;

    return (
      <div className="flex flex-col w-full">
        {/* Thanh tiêu đề kết hợp tóm tắt kết quả tổng hợp nhanh */}
        <div className="bg-[#f0f9fa] border-t border-x border-slate-300 px-3.5 py-2 rounded-t flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2.5 text-slate-800 font-medium">
            <span className="font-extrabold flex items-center gap-1.5 text-teal-950 pr-2.5 border-r border-slate-300">
              <FileText className="w-4 h-4 text-teal-700" />
              <span>Danh sách Bảng kê Hộ mẫu</span>
            </span>
            <span className="font-bold flex items-center gap-1 text-teal-900">
              <BarChart3 className="w-3.5 h-3.5 text-teal-700" />
              <span>Tổng hợp:</span>
            </span>
            <span>Tổng số: <strong className="text-slate-900 font-bold">{totalItems} hộ</strong></span>
            <span className="text-slate-300">|</span>
            <span>Đã điều tra: <strong className="text-teal-800 font-bold">{surveyedCount} hộ</strong></span>
            <span className="text-slate-300">|</span>
            <span>Tổng nhân khẩu: <strong className="text-slate-900 font-bold">{surveyedMembers} người</strong></span>
            <span className="text-slate-300">|</span>
            <span>Tổng thu nhập: <strong className="text-teal-900 font-bold">{surveyedIncome.toLocaleString()} (1000đ)</strong></span>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1 font-bold">
              <span className="text-slate-600 text-[11px]">Ngành:</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 text-[11px]" title="1. Nông, lâm thủy sản">1: {s1Filtered}</span>
              <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded border border-blue-300 text-[11px]" title="2. Công nghiệp xây dựng">2: {s2Filtered}</span>
              <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300 text-[11px]" title="3. Thương mại dịch vụ">3: {s3Filtered}</span>
              <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded border border-purple-300 text-[11px]" title="4. Nguồn thu khác / Lương">4: {s4Filtered}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-extrabold text-teal-950 text-xs">
              TNBQ: {perCapitaFilteredMonth > 0 ? `${perCapitaFilteredMonth.toLocaleString()} đ/người/tháng` : '0 đ'} 
            </span>
          </div>
        </div>

        {/* Scrollable Container with Sticky Thead */}
        <div className={`overflow-x-auto overflow-y-auto ${customMaxHeight} border border-slate-300 shadow-xs bg-white relative`}>
          <table className="w-full border-collapse text-xs text-slate-800 whitespace-nowrap">
            <thead className="sticky top-0 z-20 bg-[#058da0] shadow-xs">
              <tr className="bg-[#058da0] text-white text-center font-bold">
                {showEntryButton && (
                  <th className="border border-[#047484] px-2 py-2.5 w-10 text-center bg-[#058da0] text-white font-semibold sticky top-0">
                    <input 
                      type="checkbox" 
                      checked={isAllSelected} 
                      onChange={handleToggleSelectAll}
                      className="rounded text-teal-600 w-4 h-4 cursor-pointer"
                      title="Tích tất cả các hộ trên trang này"
                    />
                  </th>
                )}
                <th className="border border-[#047484] px-2 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">STT Mẫu</th>
                <th className="border border-[#047484] px-2.5 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">Mã TKCS</th>
                <th className="border border-[#047484] px-3 py-2.5 bg-[#058da0] text-white font-semibold text-left sticky top-0">Tên TKCS</th>
                <th className="border border-[#047484] px-2.5 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">Mã Xã</th>
                <th className="border border-[#047484] px-3 py-2.5 bg-[#058da0] text-white font-semibold text-left sticky top-0">Tên Xã</th>
                <th className="border border-[#047484] px-3 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">Mã ĐB</th>
                <th className="border border-[#047484] px-4 py-2.5 bg-[#058da0] text-white font-semibold text-left sticky top-0">Tên Địa bàn</th>
                <th className="border border-[#047484] px-2.5 py-2.5 bg-[#058da0] text-white font-semibold text-left sticky top-0">Người nhập / ĐTV</th>
                <th className="border border-[#047484] px-2.5 py-2.5 bg-[#058da0] text-white font-semibold text-center sticky top-0">Trạng thái phiếu</th>
                <th className="border border-[#047484] px-2 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">Mẫu</th>
                <th className="border border-[#047484] px-2 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">STT gốc</th>
                <th className="border border-[#047484] px-3 py-2.5 text-left bg-[#058da0] text-white font-semibold sticky top-0">Họ và tên chủ hộ</th>
                <th className="border border-[#047484] px-3 py-2.5 text-left bg-[#058da0] text-white font-semibold sticky top-0">Địa chỉ của hộ</th>
                <th className="border border-[#047484] px-2 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">Nhân khẩu</th>
                <th className="border border-[#047484] px-1 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0 w-12 max-w-[50px] text-center" title="Nguồn thu">Nguồn thu</th>
                <th className="border border-[#047484] px-3 py-2.5 text-left bg-[#058da0] text-white font-semibold sticky top-0">Phân loại ngành</th>
                <th className="border border-[#047484] px-3 py-2.5 text-right bg-[#058da0] text-white font-semibold sticky top-0">Tổng TN (1000đ)</th>
                {showEntryButton && <th className="border border-[#047484] px-3 py-2.5 bg-[#058da0] text-white font-semibold sticky top-0">Thao tác</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedHouseholds.map((h, idx) => {
                const inc = calculateHouseholdTotalIncome(h);
                const hCommune = communes.find(c => c.id === h.communeId || (Boolean(h.communeCode) && c.communeCode === h.communeCode));
                const tkcsCodeDisplay = h.tkcsCode || hCommune?.tkcsCode || '';
                const tkcsNameDisplay = h.tkcsName || hCommune?.tkcsName || '';
                const communeCodeDisplay = h.communeCode || hCommune?.communeCode || '';
                const communeNameDisplay = h.communeName || hCommune?.communeName || '';
                const matchedArea = areas.find(a => 
                  (h.areaId && a.id === h.areaId) || 
                  (h.areaCode && a.code === h.areaCode && (!h.communeId || !a.communeId || a.communeId === h.communeId)) ||
                  (h.areaCode && a.code === h.areaCode)
                );
                const areaCodeDisplay = h.areaCode || matchedArea?.code || '001';
                // Tên địa bàn: ưu tiên tên sheet gốc từ bảng kê, kế tiếp tên đã lưu, kế tiếp tên địa bàn khớp trong danh mục, loại bỏ 001
                const areaNameDisplay = ((h as any).sheetName && (h as any).sheetName.trim() && (h as any).sheetName !== '001' && (h as any).sheetName !== 'Địa bàn')
                  ? (h as any).sheetName.trim()
                  : (h.areaName && h.areaName.trim() && h.areaName !== '001' && h.areaName !== 'Địa bàn' && h.areaName !== h.areaCode && !h.areaName.startsWith('Địa bàn 001')) 
                  ? h.areaName.trim() 
                  : (matchedArea?.name && matchedArea.name.trim() && matchedArea.name !== '001' && matchedArea.name !== matchedArea.code && matchedArea.name !== 'Địa bàn' && !matchedArea.name.startsWith('Địa bàn 001'))
                  ? matchedArea.name.trim()
                  : (matchedArea?.name && matchedArea.name.trim() && matchedArea.name !== '001' && !matchedArea.name.startsWith('Địa bàn 001'))
                  ? matchedArea.name.trim()
                  : (h.areaCode ? `Địa bàn ${h.areaCode}` : '---');
                const isRowSelected = selectedHouseholdIds.includes(h.id);
                const status = h.surveyStatus || 'CHUA_NHAP';
                const isLocked = status === 'DA_DUYET' && currentUser?.role !== 'ADMIN';

                return (
                  <tr 
                    key={h.id} 
                    className={`transition-colors ${isRowSelected ? 'bg-sky-100 font-semibold' : 'odd:bg-white even:bg-[#f2fafb] hover:bg-[#e6f6f8]'}`}
                  >
                    {showEntryButton && (
                      <td className="border border-slate-300 p-2 text-center">
                        <input 
                          type="checkbox" 
                          checked={isRowSelected} 
                          onChange={() => handleToggleSelectRow(h.id)}
                          className="rounded text-sky-600 w-4 h-4 cursor-pointer"
                          title={`Tích chọn hộ: ${h.householdHead}`}
                        />
                      </td>
                    )}
                    <td className="border border-slate-300 p-2 text-center text-slate-800 font-medium">{h.sttMau}</td>
                    <td className="border border-slate-300 p-2 text-center text-slate-800 font-medium">{tkcsCodeDisplay}</td>
                    <td className="border border-slate-300 p-2 text-slate-800">{tkcsNameDisplay}</td>
                    <td className="border border-slate-300 p-2 text-center text-slate-800 font-medium">{communeCodeDisplay}</td>
                    <td className="border border-slate-300 p-2 text-slate-800">{communeNameDisplay}</td>
                    <td className="border border-slate-300 p-2 text-center text-slate-800 font-medium">
                      {areaCodeDisplay}
                    </td>
                    <td className="border border-slate-300 p-2 text-slate-800">
                      {areaNameDisplay}
                    </td>

                    {/* Surveyor Assignment Column - Interactive Link with Progress Tab */}
                    <td className="border border-slate-300 p-2 text-left text-slate-800">
                      {(() => {
                        const areaSurv = areaSurveyorMap.get(h.areaId) || areaSurveyorMap.get(h.areaCode) || areaSurveyorMap.get(`${h.communeId}_${h.areaCode}`);
                        const effectiveSurveyorName = h.assignedSurveyorName || areaSurv?.name || '';
                        
                        if (!effectiveSurveyorName) {
                          return <span className="text-slate-400 italic text-[11px]">Chưa phân công</span>;
                        }

                        return (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (selectedSurveyorFilter === effectiveSurveyorName) {
                                  setSelectedSurveyorFilter('ALL');
                                  showNotification('success', 'Đã hủy lọc theo ĐTV.');
                                } else {
                                  setSelectedSurveyorFilter(effectiveSurveyorName);
                                  setCurrentPage(1);
                                  showNotification('success', `Đã lọc danh sách theo Người nhập / ĐTV: "${effectiveSurveyorName}".`);
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center gap-1 border shadow-2xs ${
                                selectedSurveyorFilter === effectiveSurveyorName
                                  ? 'bg-purple-700 text-white border-purple-800 font-bold'
                                  : 'bg-purple-50 hover:bg-purple-100 text-purple-950 border-purple-200'
                              }`}
                              title={`Bấm để ${selectedSurveyorFilter === effectiveSurveyorName ? 'bỏ lọc' : 'lọc danh sách'} theo ĐTV "${effectiveSurveyorName}"`}
                            >
                              <UserCheck className={`w-3 h-3 ${selectedSurveyorFilter === effectiveSurveyorName ? 'text-white' : 'text-purple-700'}`} />
                              <span>{effectiveSurveyorName}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('surveyor_progress');
                                showNotification('success', `Đã chuyển sang xem Tiến độ của ĐTV: "${effectiveSurveyorName}".`);
                              }}
                              className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 rounded transition-colors cursor-pointer"
                              title={`Xem chi tiết tiến độ hoàn thành của "${effectiveSurveyorName}" tại Tab 3: Tiến độ ĐTV`}
                            >
                              <TrendingUp className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}
                    </td>

                    {/* Survey Status Column - Plain Text */}
                    <td className="border border-slate-300 p-2 text-center text-slate-800 font-medium">
                      {SURVEY_STATUS_LABELS[status]?.label || 'Chưa nhập tin'}
                    </td>

                    {/* Sample Status Column */}
                    <td className="border border-slate-300 p-1.5 text-center">
                      {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR') ? (
                        <select
                          value={(h.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG') ? 'DỰ PHÒNG' : 'CHÍNH THỨC'}
                          disabled={isLocked}
                          onChange={(e) => {
                            const newStatus = e.target.value as 'CHÍNH THỨC' | 'DỰ PHÒNG';
                            setHouseholds(prev => {
                              const updated = prev.map(item => item.id === h.id ? { ...item, sampleStatus: newStatus } : item);
                              try { localStorage.setItem('cached_households', JSON.stringify(updated)); } catch (err) {}
                              return updated;
                            });
                            showNotification('success', `Đã chuyển hộ "${h.householdHead}" sang [${newStatus}]`);
                          }}
                          className={`font-bold text-xs py-1 px-1.5 rounded border text-center cursor-pointer transition-colors shadow-2xs ${
                            (h.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG')
                              ? 'bg-purple-50 text-purple-800 border-purple-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          }`}
                          title="Click để đổi trạng thái Chính thức / Dự phòng"
                        >
                          <option value="CHÍNH THỨC">Chính thức</option>
                          <option value="DỰ PHÒNG">Dự phòng</option>
                        </select>
                      ) : (
                        <span className={`font-semibold text-xs ${
                          (h.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG') || (h.sampleStatus || '').toUpperCase().includes('DP')
                            ? 'text-purple-700'
                            : (h.sampleStatus || '').toUpperCase().includes('ĐÃ THAY')
                            ? 'text-amber-700'
                            : (h.sampleStatus || '').toUpperCase().includes('THAY')
                            ? 'text-emerald-700'
                            : 'text-slate-800'
                        }`}>
                          {h.sampleStatus || 'Chính thức'}
                        </span>
                      )}
                    </td>
                    <td className="border border-slate-300 p-2 text-center text-slate-600">{h.sttGoc}</td>
                    <td className="border border-slate-300 p-2 font-semibold text-slate-900">{h.householdHead}</td>
                    <td className="border border-slate-300 p-2 text-slate-600">{h.address}</td>
                    {/* Số nhân khẩu của hộ */}
                    <td className="border border-slate-300 p-2 text-center font-bold text-slate-800">
                      {h.membersCount || 0}
                    </td>
                    <td className="border border-slate-300 px-1 py-1 text-center w-14 max-w-[55px]">
                      <select
                        value={h.sectorCode || 2}
                        disabled={isLocked}
                        onChange={(e) => handleQuickChangeSector(h.id, Number(e.target.value) as 1 | 2 | 3 | 4)}
                        className={`w-full font-bold text-xs py-1 rounded border text-center cursor-pointer transition-colors shadow-2xs ${
                          Number(h.sectorCode) === 1
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-400 font-bold'
                            : Number(h.sectorCode) === 2
                            ? 'bg-blue-50 text-blue-800 border-blue-400 font-bold'
                            : Number(h.sectorCode) === 3
                            ? 'bg-amber-50 text-amber-800 border-amber-400 font-bold'
                            : 'bg-purple-50 text-purple-800 border-purple-400 font-bold'
                        }`}
                        title={`Ngành ${h.sectorCode} (${h.sectorName}) - Nhấp để thay đổi`}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                        <option value={4}>4</option>
                      </select>
                    </td>
                    <td className="border border-slate-300 p-1 text-slate-800 min-w-[170px]">
                      <select
                        value={h.sectorCode || 2}
                        disabled={isLocked}
                        onChange={(e) => handleQuickChangeSector(h.id, Number(e.target.value) as 1 | 2 | 3 | 4)}
                        className={`w-full text-xs py-1 px-1.5 rounded font-medium border cursor-pointer transition-colors shadow-2xs ${
                          Number(h.sectorCode) === 1
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                            : Number(h.sectorCode) === 2
                            ? 'bg-blue-50 text-blue-900 border-blue-300'
                            : Number(h.sectorCode) === 3
                            ? 'bg-amber-50 text-amber-900 border-amber-300'
                            : 'bg-purple-50 text-purple-900 border-purple-300'
                        }`}
                        title={`Thay đổi phân loại ngành cho hộ "${h.householdHead}"`}
                      >
                        <option value={1}>1. Nông, lâm thủy sản</option>
                        <option value={2}>2. Công nghiệp xây dựng</option>
                        <option value={3}>3. Thương mại dịch vụ</option>
                        <option value={4}>4. Nguồn thu khác / Lương</option>
                      </select>
                    </td>
                    <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">{inc.total.toLocaleString()}</td>
                    {showEntryButton && (
                      <td className="border border-slate-300 p-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Nút Nhập tin phiếu: biểu tượng kèm tooltip hover */}
                          <button 
                            onClick={() => setActiveHouseholdForm(h)}
                            className={`p-1.5 text-white rounded font-bold flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105 transition-all ${
                              isLocked 
                                ? 'bg-slate-700 hover:bg-slate-600' 
                                : status === 'DA_HOAN_THANH'
                                ? 'bg-emerald-700 hover:bg-emerald-600'
                                : 'bg-sky-700 hover:bg-sky-600'
                            }`}
                            title={isLocked ? 'Xem phiếu' : 'Nhập tin phiếu'}
                            aria-label={isLocked ? 'Xem phiếu' : 'Nhập tin phiếu'}
                          >
                            {isLocked ? <Eye className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          </button>

                          {/* Nút Thay hộ mẫu: biểu tượng kèm tooltip hover */}
                          <button
                            type="button"
                            onClick={() => setHouseholdToReplace(h)}
                            className={`p-1.5 text-white rounded font-bold flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105 transition-all ${
                              (h.sampleStatus || '').toUpperCase().includes('ĐÃ THAY')
                                ? 'bg-slate-600 hover:bg-slate-500'
                                : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
                            }`}
                            title={
                              (h.sampleStatus || '').toUpperCase().includes('ĐÃ THAY')
                                ? 'Thay hộ mẫu (Đã thay thế)'
                                : 'Thay hộ mẫu'
                            }
                            aria-label="Thay hộ mẫu"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>

                          {/* Nút Xóa trắng / Reset phiếu của riêng hộ này */}
                          <button
                            type="button"
                            onClick={() => handleResetSingleHousehold(h)}
                            className="p-1.5 text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300 cursor-pointer shadow-2xs hover:scale-105 transition-all"
                            title={`Xóa trắng (reset) phiếu của hộ "${h.householdHead}" về trạng thái ban đầu`}
                            aria-label="Xóa trắng phiếu hộ này"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Duyệt & Khóa phiếu: biểu tượng kèm tooltip hover */}
                          {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR') && (
                            <button
                              type="button"
                              onClick={async () => {
                                const nextStatus: SurveyStatus = status === 'DA_DUYET' ? 'DA_HOAN_THANH' : 'DA_DUYET';
                                const updatedH: Household = { ...h, surveyStatus: nextStatus };
                                setHouseholds(prev => {
                                  const next = prev.map(item => item.id === h.id ? updatedH : item);
                                  try { localStorage.setItem('cached_households', JSON.stringify(next)); } catch (e) {}
                                  return next;
                                });
                                showNotification('success', `Đã ${nextStatus === 'DA_DUYET' ? 'Duyệt & Khóa' : 'Mở khóa'} phiếu hộ ${h.householdHead}`);
                              }}
                              className={`p-1.5 rounded border cursor-pointer hover:scale-105 transition-all ${
                                status === 'DA_DUYET' 
                                  ? 'bg-purple-100 text-purple-800 border-purple-300 hover:bg-purple-200' 
                                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                              }`}
                              title={status === 'DA_DUYET' ? 'Đã duyệt - Bấm để Mở khóa' : 'Duyệt phiếu hộ này'}
                              aria-label={status === 'DA_DUYET' ? 'Mở khóa' : 'Duyệt'}
                            >
                              {status === 'DA_DUYET' ? <Lock className="w-3.5 h-3.5 text-purple-800" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                          )}

                          {currentUser?.role === 'ADMIN' && (
                            <button
                              type="button"
                              onClick={() => setHouseholdToDelete(h)}
                              className="p-1.5 text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 rounded border border-rose-200 cursor-pointer transition-colors hover:scale-105"
                              title={`Xóa hộ "${h.householdHead}"`}
                              aria-label="Xóa hộ"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedHouseholds.length === 0 && (
                <tr>
                  <td colSpan={showEntryButton ? 19 : 18} className="text-center py-10 text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                      <span className="font-bold text-slate-700">Không tìm thấy hộ gia đình nào theo tiêu chí lọc hiện tại.</span>
                      {households.length > 0 && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="mt-2 px-3 py-1.5 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white rounded font-bold cursor-pointer shadow-xs flex items-center gap-1.5 transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Đặt lại bộ lọc để xem toàn bộ {households.length} hộ</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Viewport Footer Controls */}
        <div className="bg-slate-100 border-x border-b border-slate-300 px-4 py-2.5 rounded-b flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-600 font-medium">
              Hiển thị <strong>{startIdx}</strong> - <strong>{endIdx}</strong> trong tổng số <strong className="text-sky-900">{totalItems}</strong> hộ
            </span>

            <div className="flex items-center gap-1.5 ml-2 border-l border-slate-300 pl-3">
              <span className="text-slate-600">Số dòng/trang:</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 font-bold text-slate-800 cursor-pointer"
              >
                <option value={25}>25 hộ</option>
                <option value={50}>50 hộ</option>
                <option value={100}>100 hộ</option>
                <option value={200}>200 hộ</option>
                <option value={500}>500 hộ</option>
                <option value={-1}>Tất cả ({totalItems} hộ)</option>
              </select>
            </div>
          </div>

          {pageSize !== -1 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(1)}
                disabled={validPage <= 1}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang đầu tiên"
              >
                <ChevronsLeft className="w-4 h-4 text-slate-700" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={validPage <= 1}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang trước"
              >
                <ChevronLeft className="w-4 h-4 text-slate-700" />
              </button>

              <div className="flex items-center gap-1 px-2">
                <span className="text-slate-600">Trang</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={validPage}
                  onChange={e => {
                    const p = parseInt(e.target.value, 10);
                    if (!isNaN(p)) setCurrentPage(Math.min(Math.max(1, p), totalPages));
                  }}
                  className="w-12 text-center bg-white border border-slate-300 rounded py-0.5 font-bold text-sky-900"
                />
                <span className="text-slate-600">/ {totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={validPage >= totalPages}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang kế tiếp"
              >
                <ChevronRight className="w-4 h-4 text-slate-700" />
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage(totalPages)}
                disabled={validPage >= totalPages}
                className="p-1 rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title="Trang cuối cùng"
              >
                <ChevronsRight className="w-4 h-4 text-slate-700" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    if (!localDataReady) {
      return (
        <div className="min-h-screen bg-sky-950 text-white flex items-center justify-center text-sm font-semibold">
          Đang mở dữ liệu cục bộ trên thiết bị...
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-linear-to-b from-sky-900 via-sky-850 to-slate-900 text-slate-900 flex flex-col items-center justify-center p-4 selection:bg-sky-200">
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg border flex items-center gap-3 text-xs font-medium transition-all ${
            notification.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
          {/* Rural Countryside Picture Header Banner */}
          <div className="h-32 w-full relative overflow-hidden border-b border-sky-900">
            <img 
              src={bannerImg} 
              alt="Nông thôn Việt Nam" 
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = '/background-ngoai-troi-dep_042633251.jpg';
              }}
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-linear-to-t from-sky-950 via-sky-950/60 to-transparent"></div>
            <div className="absolute inset-x-0 bottom-2 px-4 text-center">
              <h1 className="text-base font-black uppercase tracking-tight text-white drop-shadow-md">
                Hệ thống Quản lý Nhập tin 
              </h1>
              <p className="text-xs text-sky-200 font-medium drop-shadow-sm mt-0.5">
                Nhập tin phiếu thu nhập hộ dân cư tỉnh Hưng Yên
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="p-6 flex flex-col gap-4">
            <div>
              <label className="block font-bold text-slate-800 mb-1 text-xs">
                Tên đăng nhập / Mã tài khoản
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  value={loginIdentifier}
                  onChange={e => setLoginIdentifier(e.target.value)}
                  placeholder="Nhập tên đăng nhập hoặc mã tài khoản..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pl-9 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden text-xs"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 mb-1 text-xs">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showLoginPassword ? "text" : "password"}
                  required
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 pl-9 pr-10 text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-sky-600 focus:outline-hidden text-xs"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <label className="flex items-center justify-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>Nạp gói phân công JSON từ Admin</span>
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportAssignmentBeforeLogin}
              />
            </label>

            {loginInfo && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-semibold">
                {loginInfo}
              </div>
            )}

            {loginError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Thêm mt-[0.5cm] để đẩy nút đăng nhập xuống thêm 0.5cm */}
            <button
              type="submit"
              className="w-full mt-[0.5cm] py-2.5 bg-sky-800 hover:bg-sky-700 active:bg-sky-900 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>Đăng nhập hệ thống</span>
            </button>

            <div className="mt-[1.5cm] pt-3 border-t border-slate-200 text-slate-600 text-[11px] leading-relaxed flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-slate-800 font-bold">
                {/* Đã xóa 2 biểu tượng theo yêu cầu trước */}
              </div>
              <p className="text-slate-500 font-medium leading-normal">
                
              </p>
            </div>
          </form>
        </div>

        <p className="text-xs text-sky-300/80 mt-6">
          Hệ thống Quản lý Thống kê Thu nhập Hộ gia đình © 2026
        </p>
      </div>
    );
  }

  // TRANG RIÊNG BIỆT: PHẦN MỀM ĐIỀU TRA & TỔNG HỢP CÔNG NGHIỆP (DN, CÁ THỂ & BIỂU 03, 04)
  if (appMode === 'industrial') {
    return (
      <IndustrialSurveyPage
        currentUser={currentUser}
        onSwitchToHousehold={() => {
          setAppMode('household');
          try {
            localStorage.setItem('preferred_app_mode', 'household');
            const url = new URL(window.location.href);
            url.searchParams.set('mode', 'household');
            window.history.replaceState({}, '', url.toString());
          } catch (e) {}
        }}
        onLogout={handleLogout}
        onNotification={showNotification}
      />
    );
  }

  return (
    <div className="min-h-screen bg-sky-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-sky-200">
      
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded shadow-lg border flex items-center gap-3 text-xs font-medium transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Upload Progress Modal / Overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full p-6 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 text-sky-600 animate-spin" />
            <div>
              <h3 className="font-bold text-slate-900 text-base uppercase">Đang xử lý file Excel bảng kê</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">{uploadProgressText}</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden mt-2">
              <div className="bg-sky-600 h-2.5 rounded-full animate-pulse w-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* PINNED STICKY TOP CONTAINER (HEADER + TABS + FILTER TOOLBAR) */}
      <div className="sticky top-0 z-40 shadow-md flex flex-col w-full bg-white">
        {/* Header Banner - Full Width Photo Banner */}
        <header className="relative w-full text-white border-b border-indigo-950 shadow-md overflow-hidden bg-[#01159d]">
          {/* Full-width sunny countryside image */}
          <img 
            src={bannerImg} 
            alt="Nông thôn Việt Nam" 
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/background-ngoai-troi-dep_042633251.jpg';
            }}
            className="absolute inset-0 w-full h-full object-cover object-center brightness-110 saturate-110" 
          />

          <div className="relative z-10 w-full px-3 md:px-5 py-3 md:py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 bg-[#01159d]/85 backdrop-blur-md px-4 py-2 rounded-xl border border-white/30 shadow-xl">
              <div className="bg-indigo-800/80 p-2 rounded-lg border border-white/30 shrink-0 shadow-inner">
                <FileSpreadsheet className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-base md:text-lg font-black tracking-tight text-white uppercase flex items-center gap-2 drop-shadow-sm">
                  <span>Phần mềm Nhập tin & Tổng hợp Nhanh Hộ gia đình</span>
                </h1>
                <p className="text-xs text-amber-300 font-extrabold drop-shadow-xs mt-0.5">
                  Phiếu thu thập thông tin về thu nhập của hộ dân cư (Phụ lục II)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Nút mở sang Web 2 Điều Tra Công Nghiệp 
              <a
                href="/industrial.html"
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-linear-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-blue-950 font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all text-xs cursor-pointer hover:scale-102"
                title="Mở Trang Web Điều Tra Công Nghiệp trong Tab mới độc lập"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Mở Web 2 (Công Nghiệp) Tab Mới</span>
                <ExternalLink className="w-3 h-3 ml-0.5" />
              </a>
              */}

              {/* Logged in User Profile & Actions */}
              <div className="flex items-center gap-2 bg-[#01159d]/90 backdrop-blur-md border border-white/30 rounded-xl px-3.5 py-2 text-xs shadow-xl">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-black text-white">{currentUser.name || 'Admin'}</span>

                <button
                  type="button"
                  onClick={() => {
                    setCurrentPasswordInput('');
                    setNewPasswordInput('');
                    setConfirmPasswordInput('');
                    setChangePasswordError('');
                    setShowChangePasswordModal(true);
                  }}
                  className="p-1 hover:bg-sky-800 rounded text-amber-300 hover:text-white cursor-pointer transition-colors ml-1"
                  title="Đổi mật khẩu tài khoản"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="p-1 hover:bg-rose-900/80 rounded text-rose-300 hover:text-white cursor-pointer transition-colors"
                  title="Đăng xuất khỏi hệ thống"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Navigation Tabs Bar - Teal Blue Background Bar Below Banner */}
        <nav 
          style={{ backgroundColor: '#207f8b' }}
          className="px-3 md:px-5 pt-1.5 border-t border-teal-600 border-b border-teal-800 flex items-center gap-1.5 overflow-x-auto text-xs w-full shadow-md z-20"
        >
          {/* NÚT CHUYỂN SANG TRANG RIÊNG BIỆT: ĐIỀU TRA CÔNG NGHIỆP TỈNH HƯNG YÊN */}
          {/*
          <button 
            type="button"
            onClick={() => {
              setAppMode('industrial');
              try {
                localStorage.setItem('preferred_app_mode', 'industrial');
                const url = new URL(window.location.href);
                url.searchParams.set('mode', 'industrial');
                window.history.replaceState({}, '', url.toString());
              } catch (e) {}
            }}
            className="px-4 py-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold bg-linear-to-r from-blue-900 to-indigo-900 hover:from-blue-800 hover:to-indigo-800 text-amber-300 hover:text-white border-t-2 border-x border-blue-500 shadow-md ring-1 ring-amber-400/30"
            title="Mở giao diện Trang riêng biệt độc lập cho Phiếu 01, 02 và Biểu 03, 04"
          >
            <Building2 className="w-4 h-4 text-amber-300" />
            <span className="font-black text-amber-300 hover:text-white">
              ★ Trang Điều Tra Công Nghiệp (DN & Cá Thể)
            </span>
          </button>
          */}

          {currentUser.role === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('import')}
              className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
                activeTab === 'import' 
                  ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                  : 'text-white hover:bg-teal-700/80 border-transparent'
              }`}
            >
              <Upload className={`w-4 h-4 ${activeTab === 'import' ? 'text-teal-800' : 'text-teal-100'}`} />
              <span className={activeTab === 'import' ? 'text-teal-950 font-black' : 'text-white'}>1. Tải bảng kê</span>
            </button>
          )}

          {/* Tab 2: Nhập tin hộ - Dành cho Điều tra viên và Cán bộ quản lý/giám sát */}
          <button 
            onClick={() => setActiveTab('entry')}
            className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
              activeTab === 'entry' 
                ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                : 'text-white hover:bg-teal-700/80 border-transparent'
            }`}
          >
            <FileText className={`w-4 h-4 ${activeTab === 'entry' ? 'text-teal-800' : 'text-teal-100'}`} />
            <span className={activeTab === 'entry' ? 'text-teal-950 font-black' : 'text-white'}>2. Nhập tin hộ</span>
          </button>

          {currentUser.role !== 'SURVEYOR' && (
            <button 
              onClick={() => setActiveTab('surveyor_progress')}
              className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
                activeTab === 'surveyor_progress' 
                  ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                  : 'text-white hover:bg-teal-700/80 border-transparent'
              }`}
            >
              <UserCheck className={`w-4 h-4 ${activeTab === 'surveyor_progress' ? 'text-teal-800' : 'text-emerald-300'}`} />
              <span className={activeTab === 'surveyor_progress' ? 'text-teal-950 font-black' : 'text-white'}>3. Tiến độ ĐTV</span>
            </button>
          )}

          <button 
            onClick={() => setActiveTab('tnh')}
            className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
              activeTab === 'tnh' 
                ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                : 'text-white hover:bg-teal-700/80 border-transparent'
            }`}
          >
            <BarChart3 className={`w-4 h-4 ${activeTab === 'tnh' ? 'text-teal-800' : 'text-teal-100'}`} />
            <span className={activeTab === 'tnh' ? 'text-teal-950 font-black' : 'text-white'}>4. Tổng hợp nhanh</span>
          </button>

          {currentUser.role === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('macro_control')}
              className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
                activeTab === 'macro_control' 
                  ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                  : 'text-white hover:bg-teal-700/80 border-transparent'
              }`}
            >
              <TrendingUp className={`w-4 h-4 ${activeTab === 'macro_control' ? 'text-teal-800' : 'text-amber-300'}`} />
              <span className={activeTab === 'macro_control' ? 'text-teal-950 font-black' : 'text-white'}>5. Kiểm soát TNBQ</span>
            </button>
          )}

          {currentUser.role === 'ADMIN' && (
            <button 
              onClick={() => setActiveTab('database')}
              className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
                activeTab === 'database' 
                  ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                  : 'text-white hover:bg-teal-700/80 border-transparent'
              }`}
            >
              <Database className={`w-4 h-4 ${activeTab === 'database' ? 'text-teal-800' : 'text-teal-100'}`} />
              <span className={activeTab === 'database' ? 'text-teal-950 font-black' : 'text-white'}>6. Quản lý danh mục xã</span>
            </button>
          )}

          <button 
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
              activeTab === 'catalog' 
                ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                : 'text-white hover:bg-teal-700/80 border-transparent'
            }`}
          >
            <BookOpen className={`w-4 h-4 ${activeTab === 'catalog' ? 'text-teal-800' : 'text-amber-200'}`} />
            <span className={activeTab === 'catalog' ? 'text-teal-950 font-black' : 'text-white'}>7. Danh mục tra cứu</span>
          </button>

          {(currentUser.role === 'ADMIN' || currentUser.role === 'SUPERVISOR') && (
            <button 
              onClick={() => setActiveTab('surveyors')}
              className={`px-3.5 py-2 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap rounded-t-md font-bold ${
                activeTab === 'surveyors' 
                  ? 'bg-white text-teal-950 shadow-md border-t-2 border-x border-slate-300 border-t-amber-500 font-black' 
                  : 'text-white hover:bg-teal-700/80 border-transparent'
              }`}
            >
              <Building2 className={`w-4 h-4 ${activeTab === 'surveyors' ? 'text-teal-800' : 'text-emerald-200'}`} />
              <span className={activeTab === 'surveyors' ? 'text-teal-950 font-black' : 'text-white'}>
                {currentUser.role === 'SUPERVISOR' ? '8. Phân quyền phòng' : '8. Hệ thống'}
              </span>
            </button>
          )}
        </nav>

        {/* Filter Toolbar - Bộ lọc dùng chung phân cấp chuẩn hóa gọn gàng, bằng nhau */}
        <div className="bg-white border-b border-slate-300 px-3 md:px-5 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs w-full">
          <div className="flex flex-wrap items-center gap-2">
            {/* 1. TKCS */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">TKCS:</span>
              <select 
                value={selectedTkcs} 
                onChange={e => {
                  const val = e.target.value;
                  setSelectedTkcs(val);
                  setTnhSelectedTkcs(val);
                  if (val === 'ALL') {
                    // Khi chọn Tất cả TKCS -> reset Xã và Địa bàn về Tất cả
                    setSelectedCommuneId('ALL');
                    setTnhSelectedCommuneId('ALL');
                    setSelectedAreaId('ALL');
                  } else {
                    const currentObj = availableFilterCommunes.find(c => c.id === selectedCommuneId);
                    if (currentObj && currentObj.tkcsCode !== val) {
                      setSelectedCommuneId('ALL');
                      setTnhSelectedCommuneId('ALL');
                      setSelectedAreaId('ALL');
                    }
                  }
                  setCurrentPage(1);
                }}
                className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
              >
                <option value="ALL">Tất cả</option>
                {availableFilterTkcs.map(tk => (
                  <option key={tk.code} value={tk.code}>
                    [{tk.code}] {tk.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Xã / Phường */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Xã:</span>
              <select 
                value={selectedCommuneId} 
                onChange={e => {
                  const val = e.target.value;
                  setSelectedCommuneId(val);
                  setTnhSelectedCommuneId(val);
                  setSelectedAreaId('ALL');
                  if (val === 'ALL') {
                    // Khi chọn Tất cả Xã -> reset TKCS về Tất cả để người dùng xem toàn bộ 104 xã và tất cả hộ
                    setSelectedTkcs('ALL');
                    setTnhSelectedTkcs('ALL');
                  } else {
                    const comm = availableFilterCommunes.find(c => c.id === val);
                    if (comm?.tkcsCode) {
                      setSelectedTkcs(comm.tkcsCode);
                      setTnhSelectedTkcs(comm.tkcsCode);
                    }
                  }
                  setCurrentPage(1);
                }}
                className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
              >
                <option value="ALL">Tất cả</option>
                {availableFilterCommunes
                  .filter(c => selectedTkcs === 'ALL' || c.tkcsCode === selectedTkcs)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      [{c.communeCode}] {c.communeName}
                    </option>
                  ))}
              </select>
            </div>

            {/* 3. Địa bàn điều tra (Ẩn ở trang Tải bảng kê để giao diện gọn gàng) */}
            {activeTab !== 'import' && (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Địa bàn:</span>
                <select 
                  value={selectedAreaId} 
                  onChange={e => {
                    setSelectedAreaId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tất cả</option>
                  {availableFilterAreas.map(a => (
                    <option key={a.id} value={a.id}>
                      ĐB {a.code} - {a.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 4. Ngành (1-4) (Ẩn ở trang Tải bảng kê) */}
            {activeTab !== 'import' && (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">Ngành:</span>
                <select 
                  value={selectedSectorFilter} 
                  onChange={e => {
                    setSelectedSectorFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="1">1. Nông, lâm thủy sản</option>
                  <option value="2">2. Công nghiệp xây dựng</option>
                  <option value="3">3. Thương mại dịch vụ</option>
                  <option value="4">4. Nguồn thu khác / Lương</option>
                </select>
              </div>
            )}

            {/* 5. Người nhập / ĐTV */}
            {activeTab !== 'import' && (
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-700">ĐTV:</span>
                <select 
                  value={selectedSurveyorFilter} 
                  onChange={e => {
                    setSelectedSurveyorFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className={`h-8 w-36 bg-white border rounded px-2 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs ${
                    selectedSurveyorFilter !== 'ALL'
                      ? 'border-purple-600 text-purple-950 bg-purple-50 font-bold'
                      : 'border-slate-300 text-slate-800'
                  }`}
                >
                  <option value="ALL">Tất cả ĐTV</option>
                  <option value="UNASSIGNED">-- Chưa phân công --</option>
                  {surveyors
                    .filter(s => s.role === 'SURVEYOR' || s.role === 'SUPERVISOR')
                    .map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* 5. Tìm kiếm (Ẩn ở trang Tải bảng kê theo yêu cầu) */}
            {activeTab !== 'import' && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 h-8 shadow-2xs">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Tìm chủ hộ, xã, ĐB..." 
                  value={searchKeyword}
                  onChange={e => {
                    setSearchKeyword(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="bg-transparent border-none text-xs focus:outline-none w-36 font-medium text-slate-800"
                />
                {searchKeyword && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchKeyword('');
                      setCurrentPage(1);
                    }}
                    className="text-slate-400 hover:text-slate-600 font-bold px-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}

            {/* Nút Tải bảng kê nhanh trực tiếp ngay trên thanh lọc khi ở Tab Tải bảng kê */}
            {activeTab === 'import' && (
              (() => {
                const curCom = communes.find(c => c.id === selectedCommuneId || (Boolean(c.communeCode) && selectedCommuneId === c.communeCode));
                if (!curCom) {
                  return (
                    <button
                      type="button"
                      onClick={() => showNotification('error', 'Vui lòng chọn Xã cụ thể trong danh sách hoặc bộ lọc để tải bảng kê.')}
                      className="h-8 px-3.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="Chọn xã ở ô chọn phía trước rồi bấm tải bảng kê"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Tải bảng kê</span>
                    </button>
                  );
                }
                const hasData = households.some(h => h.communeId === curCom.id || (Boolean(curCom.communeCode) && (h as any).communeCode === curCom.communeCode));
                return (
                  <label className="h-8 px-3.5 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{hasData ? `Tải lại bảng kê [${curCom.communeCode}]` : `Tải bảng kê [${curCom.communeCode}]`}</span>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      onChange={(e) => handleUploadForCommune(curCom, e)} 
                      className="hidden" 
                    />
                  </label>
                );
              })()
            )}

            {(selectedTkcs !== 'ALL' || selectedCommuneId !== 'ALL' || selectedAreaId !== 'ALL' || selectedSectorFilter !== 'ALL' || selectedSurveyorFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || searchKeyword.trim() !== '' || onlyMyHouseholds) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="h-8 px-2.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer shadow-xs transition-colors"
                title="Xóa toàn bộ bộ lọc để xem toàn bộ danh sách"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Bỏ lọc</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {activeTab !== 'import' && (
              <span className="text-slate-600 font-medium text-xs hidden lg:inline mr-1">
                Hiển thị: <strong className="text-sky-800 font-bold">{filteredHouseholds.length}</strong> / {households.length} hộ
              </span>
            )}

            {currentUser.role === 'ADMIN' && (
              <>
                <button
                  type="button"
                  onClick={handleExportLocalBackup}
                  className="h-8 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Tải bản sao lưu đầy đủ dữ liệu cục bộ về thiết bị"
                >
                  <Database className="w-4 h-4" />
                  <span>Sao lưu JSON</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportPreRestoreBackup}
                  className="h-8 px-3 bg-slate-600 hover:bg-slate-500 text-white rounded border border-slate-500 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Tải bản sao lưu được giữ lại trước lần khôi phục gần nhất"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải backup cũ</span>
                </button>
                <label
                  className="h-8 px-3 bg-amber-700 hover:bg-amber-600 text-white rounded border border-amber-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Khôi phục toàn bộ dữ liệu từ file backup JSON trên thiết bị"
                >
                  <Upload className="w-4 h-4" />
                  <span>Khôi phục backup JSON</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleRestoreLocalBackup}
                  />
                </label>
              </>
            )}
            {currentUser.role === 'SURVEYOR' && (
              <>
                <button
                  type="button"
                  onClick={handleExportSurveyorBackup}
                  className="h-8 px-3 bg-slate-700 hover:bg-slate-600 text-white rounded border border-slate-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Tải backup chỉ gồm địa bàn và hộ được giao cho tài khoản ĐTV này"
                >
                  <Database className="w-4 h-4" />
                  <span>Sao lưu của tôi</span>
                </button>
                <label
                  className="h-8 px-3 bg-amber-700 hover:bg-amber-600 text-white rounded border border-amber-600 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Khôi phục backup cá nhân đã xuất bằng chính tài khoản ĐTV này"
                >
                  <Upload className="w-4 h-4" />
                  <span>Khôi phục backup của tôi</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleRestoreLocalBackup}
                  />
                </label>
                <label
                  className="h-8 px-3 bg-teal-800 hover:bg-teal-700 text-white rounded border border-teal-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  title="Nạp file backup.json chỉ chứa phiếu, ghép vào các hộ đã được giao cho tài khoản này"
                >
                  <Upload className="w-4 h-4" />
                  <span>Khôi phục phiếu backup.json</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={handleRestoreSurveyorEntryBackup}
                  />
                </label>
              </>
            )}

            <button 
              onClick={handleExportEnteredQuestionnairesExcel} 
              className="h-8 px-3.5 bg-teal-800 hover:bg-teal-700 active:bg-teal-900 text-xs font-bold rounded border border-teal-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
              title="Xuất file Excel đầy đủ nội dung thông tin các phiếu đã nhập tin"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel Phiếu Đã Nhập</span>
            </button>

            {/* TRAO ĐỔI DỮ LIỆU ĐỊA BÀN (JSON) THEO ID ĐỊA BÀN [MãXã]_[MãĐB].json */}
            {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR') ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDataTransferMode('export');
                    setIsDataTransferModalOpen(true);
                  }}
                  className="h-8 px-3.5 bg-sky-800 hover:bg-sky-700 active:bg-sky-900 text-xs font-bold rounded border border-sky-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Xuất file JSON [MãXã]_[MãĐB].json dữ liệu bảng kê phân quyền cho từng Điều tra viên"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Xuất Data Bảng Kê Cho ĐTV (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataTransferMode('import');
                    setIsDataTransferModalOpen(true);
                  }}
                  className="h-8 px-3.5 bg-emerald-800 hover:bg-emerald-700 active:bg-emerald-900 text-xs font-bold rounded border border-emerald-700 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Nhập và tổng hợp các file JSON do Điều tra viên gửi về"
                >
                  <Upload className="w-4 h-4 text-emerald-200" />
                  <span>Tổng Hợp Data Từ ĐTV (.json)</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDataTransferMode('import');
                    setIsDataTransferModalOpen(true);
                  }}
                  className="h-8 px-3.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-xs font-bold rounded border border-emerald-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Nạp file JSON do Admin gửi để nhận danh sách hộ địa bàn phụ trách"
                >
                  <Upload className="w-4 h-4 text-white" />
                  <span>Nhập Data Địa Bàn (.json)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setDataTransferMode('export');
                    setIsDataTransferModalOpen(true);
                  }}
                  className="h-8 px-3.5 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-xs font-bold rounded border border-sky-600 text-white flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="Xuất dữ liệu địa bàn đã hoàn thành / mới sửa để gửi Admin"
                >
                  <Download className="w-4 h-4 text-amber-300" />
                  <span>Xuất Data Mới Làm Gửi Admin (.json)</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Full Screen Width */}
      <main className="flex-1 w-full px-3 md:px-5 py-3 flex flex-col gap-4">

        {/* TAB ĐIỀU TRA CÔNG NGHIỆP: PHIẾU 01, PHIẾU 02, BIỂU 03 & 04 (UBND TỈNH HƯNG YÊN) */}
        {activeTab === 'industrial_survey' && (
          <div className="bg-white p-6 rounded-2xl border border-blue-200 shadow-lg text-center flex flex-col items-center justify-center gap-3 my-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center shadow-inner">
              <Building2 className="w-8 h-8 text-blue-700" />
            </div>
            <h2 className="text-base font-black text-blue-950 uppercase">
              Phần Mềm Điều Tra Công Nghiệp (DN & Cá Thể) Đã Được Tách Thành Trang Riêng Biệt
            </h2>
            <p className="text-xs text-slate-600 max-w-xl">
              Để phục vụ nhập tin nhanh, thuận tiện và không sót chỉ tiêu, hệ thống đã đóng gói riêng thành 1 trang độc lập với đầy đủ chức năng Phiếu 01, Phiếu 02 và Biểu 03, 04.
            </p>
            <button
              type="button"
              onClick={() => {
                setAppMode('industrial');
                try {
                  localStorage.setItem('preferred_app_mode', 'industrial');
                  const url = new URL(window.location.href);
                  url.searchParams.set('mode', 'industrial');
                  window.history.replaceState({}, '', url.toString());
                } catch (e) {}
              }}
              className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 hover:scale-102"
            >
              <Building2 className="w-4 h-4 text-amber-300" />
              <span>Mở Ngay Trang Riêng Biệt Điều Tra Công Nghiệp</span>
            </button>
          </div>
        )}

        {/* TAB 1: IMPORT FILE EXCEL & CONFIG */}
        {activeTab === 'import' && (
          <div className="flex flex-col gap-3 w-full">
            {/* KHỐI QUY TRÌNH HƯỚNG DẪN & THAO TÁC TẢI BẢNG KÊ TRỰC TIẾP */}
            {(() => {
              const currentCommune = communes.find(c => c.id === selectedCommuneId || (Boolean(c.communeCode) && selectedCommuneId === c.communeCode));
              const currentCommuneHhs = currentCommune ? households.filter(h => h.communeId === currentCommune.id || (Boolean(currentCommune.communeCode) && (h as any).communeCode === currentCommune.communeCode)) : [];
              const currentCommuneAreas = currentCommune ? areas.filter(a => a.communeId === currentCommune.id || (Boolean(currentCommune.communeCode) && (a as any).communeCode === currentCommune.communeCode)) : [];
              const hasLoadedData = currentCommuneHhs.length > 0;

              return (
                <div className="bg-gradient-to-r from-sky-50 via-teal-50 to-white border border-sky-300 rounded-lg p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#058da0] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                      <Upload className="w-5 h-5 text-cyan-100" />
                    </div>
                    <div>
                      <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                        {currentCommune ? (
                          <>
                            <span className="text-[#047484]">Xã đang chọn: [{currentCommune.communeCode}] {currentCommune.communeName}</span>
                            <span className="text-slate-500 font-medium text-xs">({currentCommune.tkcsName || currentCommune.tkcsCode})</span>
                          </>
                        ) : selectedTkcs !== 'ALL' ? (
                          <>
                            <span>Đang lọc TKCS: [{selectedTkcs}]</span>
                            <span className="text-amber-700 font-semibold text-xs ml-1">• Chọn Xã ở thanh lọc phía trên để bấm Tải bảng kê</span>
                          </>
                        ) : (
                          <span>Quy trình: 1. Chọn TKCS ➔ 2. Chọn Xã ➔ 3. Bấm "Tải bảng kê"</span>
                        )}
                      </div>
                      <div className="text-slate-600 text-xs mt-0.5">
                        {currentCommune ? (
                          hasLoadedData ? (
                            <span className="text-emerald-700 font-semibold">
                              ✓ Trạng thái: Đã tải lên <strong className="font-bold">{currentCommuneHhs.length} hộ</strong> ({currentCommuneAreas.length} địa bàn). Bảng phía dưới đang hiển thị danh sách để bạn quan sát.
                            </span>
                          ) : (
                            <span className="text-amber-800 font-medium">
                              ℹ Trạng thái: Xã này chưa nạp bảng kê. Bấm nút <strong>"Tải bảng kê [{currentCommune.communeCode}]"</strong> để chọn file Excel (.xlsx).
                            </span>
                          )
                        ) : (
                          <span>
                            Bấm chọn Xã ở nút lọc phía trên rồi bấm nút Tải bảng kê
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {currentCommune ? (
                      <>
                        <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#058da0] hover:bg-[#047484] text-white rounded text-xs font-bold cursor-pointer transition-all shadow-xs hover:scale-102 active:scale-95">
                          <Upload className="w-4 h-4" />
                          <span>{hasLoadedData ? `Tải lại bảng kê [${currentCommune.communeCode}]` : `Tải bảng kê [${currentCommune.communeCode}]`}</span>
                          <input 
                            type="file" 
                            accept=".xlsx, .xls" 
                            onChange={(e) => handleUploadForCommune(currentCommune, e)} 
                            className="hidden" 
                          />
                        </label>

                        {hasLoadedData && (
                          <button
                            type="button"
                            onClick={() => setActiveTab('entry')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-bold cursor-pointer transition-all shadow-xs active:scale-95"
                            title="Chuyển sang trang nhập tin phiếu hộ để bắt đầu nhập liệu"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Vào Nhập tin hộ</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCommuneId('ALL');
                            setCurrentPage(1);
                          }}
                          className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-semibold cursor-pointer transition-colors"
                          title="Bỏ chọn xã hiện tại để xem tất cả hộ đã tải lên"
                        >
                          Xem tất cả hộ
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => showNotification('error', 'Vui lòng chọn một Xã cụ thể từ ô Xã ở thanh lọc phía trên để tải bảng kê.')}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-200 text-slate-600 rounded text-xs font-bold cursor-pointer hover:bg-slate-300 transition-colors"
                      >
                        <Upload className="w-4 h-4 text-slate-500" />
                        <span>Tải bảng kê</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* BẢNG DANH SÁCH HỘ ĐÃ TẢI LÊN ĐỂ QUAN SÁT (Giữ lại danh sách hộ để quan sát theo đúng yêu cầu) */}
            <div className="bg-white rounded border border-slate-300 shadow-sm p-3.5 flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#058da0]" />
                    <span>Danh sách hộ điều tra đã tải lên: {filteredHouseholds.length} / {households.length} hộ</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {selectedCommuneId !== 'ALL' 
                      ? `Đang quan sát danh sách hộ của xã đã chọn. Để nhập tin phiếu chi tiết, bạn chuyển sang tab "2. Nhập tin hộ".`
                      : `Tổng cộng ${households.length} hộ đã được tải lên hệ thống. Chọn Xã ở trên để lọc riêng từng xã.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {households.length > 0 && (
                    <>
                      <button 
                        onClick={handleExportExcel}
                        className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        title="Xuất file Excel danh sách bảng kê hộ mẫu"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Xuất Excel Bảng Kê</span>
                      </button>
                      <button 
                        onClick={() => setIsClearAllModalOpen(true)}
                        className="px-2.5 py-1 bg-rose-700 hover:bg-rose-600 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                        title="Xóa toàn bộ dữ liệu hộ điều tra đã nạp"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa dữ liệu hộ</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Hiển thị bảng hộ để người dùng quan sát */}
              {renderHouseholdTable(false, "max-h-[620px]")}
            </div>
          </div>
        )}

        {/* TAB 2: NHẬP TIN PHIẾU HỘ (PHỤ LỤC II) */}
        {activeTab === 'entry' && (
          <div className="bg-white rounded border border-slate-300 shadow-sm p-4 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div>
                <h2 className="font-bold text-slate-800 text-sm uppercase flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-800" />
                  <span>Danh sách Bảng kê Hộ mẫu & Nhập tin: {filteredHouseholds.length} / {households.length} hộ</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Phân công điều tra viên, theo dõi tiến độ nhập, bấm "Thay hộ mẫu" để thay thế hộ dự phòng cùng địa bàn hoặc "Nhập tin phiếu" tại từng hộ.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleExportExcel}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Xuất file Excel danh sách bảng kê hộ mẫu"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Excel Bảng Kê</span>
                </button>

                {currentUser?.role !== 'SURVEYOR' && (
                  <button
                    type="button"
                    onClick={() => setIsResetQuestionnaireModalOpen(true)}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Xóa trắng / Reset dữ liệu phiếu điều tra theo địa bàn hoặc hộ (do nhập thử)"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Xóa trắng phiếu (Reset)</span>
                  </button>
                )}

                {(selectedTkcs !== 'ALL' || selectedCommuneId !== 'ALL' || selectedAreaId !== 'ALL' || selectedSectorFilter !== 'ALL' || selectedSurveyorFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || searchKeyword.trim() !== '' || onlyMyHouseholds) && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Bỏ toàn bộ các tiêu chí lọc để hiển thị danh sách đầy đủ toàn bộ hộ"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{currentUser?.role === 'SURVEYOR' ? `Hiện tất cả ${filteredHouseholds.length} hộ phụ trách` : `Hiện tất cả ${households.length} hộ`}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Advanced Filters for Surveyor & Survey Status */}
            <div className="bg-slate-50 border border-slate-200 rounded p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {currentUser?.role === 'SURVEYOR' && (
                  <button
                    type="button"
                    onClick={() => setOnlyMyHouseholds(!onlyMyHouseholds)}
                    className={`h-8 px-3 rounded font-bold cursor-pointer transition-all flex items-center gap-1.5 border ${
                      onlyMyHouseholds 
                        ? 'bg-sky-800 text-white border-sky-900 shadow-2xs' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <span>📌 Chỉ hộ tôi phụ trách</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${onlyMyHouseholds ? 'bg-sky-900 text-sky-100' : 'bg-slate-200 text-slate-700'}`}>
                      {myAssignedHouseholdCount}
                    </span>
                  </button>
                )}

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Người nhập:</span>
                  <select
                    value={selectedSurveyorFilter}
                    onChange={e => setSelectedSurveyorFilter(e.target.value)}
                    className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="UNASSIGNED">Chưa phân công</option>
                    {surveyors.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.code} - {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Trạng thái:</span>
                  <select
                    value={selectedStatusFilter}
                    onChange={e => setSelectedStatusFilter(e.target.value)}
                    className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="CHUA_NHAP">Chưa nhập</option>
                    <option value="DANG_NHAP">Đang nhập</option>
                    <option value="DA_HOAN_THANH">Đã nhập</option>
                    <option value="DA_DUYET">Đã duyệt</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Ngành:</span>
                  <select
                    value={selectedSectorFilter}
                    onChange={e => setSelectedSectorFilter(e.target.value)}
                    className="h-8 w-36 bg-white border border-slate-300 rounded px-2 text-slate-800 font-semibold text-xs focus:outline-none focus:ring-1 focus:ring-sky-600 cursor-pointer shadow-2xs"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="1">1. Nông, lâm thủy sản</option>
                    <option value="2">2. Công nghiệp xây dựng</option>
                    <option value="3">3. Thương mại dịch vụ</option>
                    <option value="4">4. Nguồn thu khác / Lương</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReserveHouseholds(!showReserveHouseholds)}
                  className={`h-8 px-2.5 rounded font-bold cursor-pointer transition-all flex items-center gap-1 border text-xs ${
                    showReserveHouseholds 
                      ? 'bg-purple-800 text-white border-purple-900 shadow-2xs' 
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Mặc định ẩn hộ dự phòng. Bấm để hiển thị cả hộ dự phòng"
                >
                  <span>{showReserveHouseholds ? 'Hiện hộ dự phòng' : 'Ẩn hộ dự phòng'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">
                  Đã chọn: <strong className="text-sky-900">{selectedHouseholdIds.length}</strong> hộ
                </span>

                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR') && (
                  <button
                    type="button"
                    onClick={() => setIsDuyetDiaBanModalOpen(true)}
                    className="h-8 px-3 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Duyệt địa bàn: Tích tất cả hoặc tích chọn từng hộ để duyệt và khóa"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Duyệt địa bàn</span>
                  </button>
                )}
              </div>
            </div>

            {/* Batch Action Toolbar when rows are selected */}
            {selectedHouseholdIds.length > 0 && (
              <div className="bg-sky-100/90 border border-sky-300 rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-sky-800" />
                  <span className="font-bold text-sky-950">
                    Thao tác hàng loạt cho {selectedHouseholdIds.length} hộ đã chọn:
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR') && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-700 font-medium">Gán ĐTV:</span>
                      <select
                        value={batchAssignSurveyorId}
                        onChange={e => setBatchAssignSurveyorId(e.target.value)}
                        className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-900"
                      >
                        <option value="">-- Chọn ĐTV --</option>
                        {surveyors.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleBatchAssignSelected}
                        className="px-2.5 py-1 bg-sky-800 hover:bg-sky-700 text-white rounded font-bold cursor-pointer"
                      >
                        Gán ngay
                      </button>
                    </div>
                  )}

                  {(currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPERVISOR') && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleBatchSetStatus('DA_DUYET')}
                        className="px-2.5 py-1 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                        title="Duyệt và khóa không cho sửa"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Duyệt & Khóa {selectedHouseholdIds.length} hộ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleBatchSetStatus('DA_HOAN_THANH')}
                        className="px-2.5 py-1 bg-indigo-700 hover:bg-indigo-600 text-white rounded font-bold flex items-center gap-1 cursor-pointer"
                        title="Mở khóa để cho phép sửa"
                      >
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Mở khóa {selectedHouseholdIds.length} hộ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsBatchDeleteModalOpen(true)}
                        className="px-2.5 py-1 bg-rose-750 hover:bg-rose-700 bg-rose-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                        title="Xóa các hộ đã chọn"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa {selectedHouseholdIds.length} hộ đã chọn</span>
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedHouseholdIds([])}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-semibold cursor-pointer"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
            )}

            {renderHouseholdTable(true)}
          </div>
        )}

        {/* TAB 3: TIẾN ĐỘ NHẬP TIN THEO TỪNG ĐIỀU TRA VIÊN ĐÃ PHÂN CÔNG */}
        {activeTab === 'surveyor_progress' && (
          <SurveyorProgressView
            surveyors={surveyors}
            households={households}
            areas={areas}
            communes={communes}
            currentUser={currentUser}
            cloudProgress={cloudProgress}
            onOpenHouseholdForm={(hh) => {
              setActiveHouseholdForm(hh);
            }}
            onNavigateToHouseholdEntry={handleNavigateToHouseholdEntryFromProgress}
            showNotification={showNotification}
          />
        )}

        {/* TAB 4: TỔNG HỢP NHANH (TNH) */}
        {activeTab === 'tnh' && (
          <div className="bg-white rounded border border-slate-300 shadow-sm flex flex-col gap-4 p-4 md:p-5">
            {/* Header gọn gàng với nút Xuất Excel & Thông tin phạm vi */}
            <div className="bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-300 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2 uppercase tracking-wide">
                  <BarChart3 className="w-5 h-5 text-sky-800" />
                  <span>TỔNG HỢP NHANH SỐ LIỆU ĐIỀU TRA THU NHẬP</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Dữ liệu tự động liên kết theo Bộ lọc dùng chung hoặc khi bấm chọn trực tiếp vào TKCS / Xã ở Bảng 1 bên dưới.
                </p>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button 
                  onClick={handleExportExcelTNH}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Xuất kết quả Tổng hợp nhanh ra file Excel"
                >
                  <Download className="w-4 h-4" />
                  <span>Xuất Báo cáo Excel TNH</span>
                </button>
              </div>
            </div>



            {/* BẢNG 1: DANH MỤC XÃ & CHỈ TIÊU MẪU ĐIỀU TRA (19 CỘT THEO QUY CHUẨN) */}
            <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex flex-col">
              <div className="bg-[#058da0] text-white px-4 py-2.5 flex items-center justify-between gap-3 border-b border-[#047484]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-white/20 rounded text-amber-300 border border-white/30">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-xs md:text-sm uppercase tracking-wide flex items-center gap-2">
                      <span>Bảng 1: Danh mục Xã & Chỉ tiêu Mẫu Điều tra</span>
                      <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-xs font-black">
                        {filteredCommunesTnhOverview.length} xã
                      </span>
                    </h3>
                  </div>
                </div>

                <p className="text-[11px] text-cyan-100 hidden sm:block">
                  Bấm vào <strong className="text-amber-300">Tên/Mã TKCS</strong> để xem TKCS, hoặc bấm <strong className="text-white">Tên/Mã Xã</strong> để xem xã
                </p>
              </div>

              {/* Table with all 19 columns + live linking */}
              <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                <table className="w-full border-collapse text-xs text-slate-800 text-center whitespace-nowrap">
                  <thead className="sticky top-0 bg-[#058da0] text-white z-10 select-none shadow-sm">
                    {/* Header Level 1 */}
                    <tr className="bg-[#058da0] text-white font-bold text-[11px] uppercase tracking-wider">
                      <th rowSpan={2} className="border border-[#047484] px-2 py-2 w-10 text-center">STT</th>
                      <th rowSpan={2} className="border border-[#047484] px-3 py-2 text-left min-w-[150px] bg-[#046c7c] text-amber-200">
                        Tên TKCS
                      </th>
                      <th rowSpan={2} className="border border-[#047484] px-2 py-2 w-16 text-center bg-[#046c7c] text-amber-200">
                        Mã TKCS
                      </th>
                      <th rowSpan={2} className="border border-[#047484] px-3 py-2 text-left min-w-[160px] bg-[#047a8c] text-cyan-100">
                        Tên Xã, Phường
                      </th>
                      <th rowSpan={2} className="border border-[#047484] px-2 py-2 w-16 text-center bg-[#047a8c] text-cyan-100">
                        Mã Xã
                      </th>
                      
                      {/* Group: Bảng kê trong xã */}
                      <th colSpan={5} className="border border-[#047484] py-1 bg-[#047484] text-amber-200">
                        Bảng kê trong xã
                      </th>
                      
                      {/* Group: Tỷ trọng */}
                      <th colSpan={4} className="border border-[#047484] py-1 bg-[#046c7c] text-cyan-100">
                        Tỷ trọng cơ cấu %
                      </th>
                      
                      {/* Group: Mẫu chính thức */}
                      <th colSpan={5} className="border border-[#047484] py-1 bg-[#047484] text-emerald-200">
                        Mẫu chính thức
                      </th>
                      
                      {/* Mẫu dự phòng */}
                      <th rowSpan={2} className="border border-[#047484] px-2 py-2 w-14 bg-[#046c7c] text-amber-300">Mẫu DP</th>
                      
                      {/* Group: Kết quả thực tế & Tổng hợp nhanh */}
                      <th colSpan={3} className="border border-[#047484] py-1 bg-[#035b69] text-emerald-100 font-bold">
                        Liên kết Tổng hợp nhanh
                      </th>
                    </tr>
                    
                    {/* Header Level 2 */}
                    <tr className="bg-[#047484] text-white font-semibold text-[10px]">
                      {/* Bảng kê (5 cột) */}
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[55px]">NLTS</th>
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[55px]">CNXD</th>
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[55px]">TMDV</th>
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[55px]">Khác</th>
                      <th className="border border-[#035b69] px-2.5 py-1.5 min-w-[65px] bg-[#035b69] text-amber-300 font-bold">Tổng BK</th>
                      
                      {/* Tỷ trọng (4 cột) */}
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">% NLTS</th>
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">% CNXD</th>
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">% TMDV</th>
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">% Khác</th>
                      
                      {/* Mẫu chính thức (5 cột) */}
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">Mẫu 1</th>
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">Mẫu 2</th>
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">Mẫu 3</th>
                      <th className="border border-[#035b69] px-1.5 py-1.5 min-w-[50px]">Mẫu 4</th>
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[65px] bg-[#035b69] text-emerald-300 font-bold">Tổng Mẫu</th>
                      
                      {/* Liên kết TNH (3 cột) */}
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[70px] bg-[#035b69] text-white font-bold">Hộ thực tế</th>
                      <th className="border border-[#035b69] px-2.5 py-1.5 min-w-[110px] bg-[#035b69] text-emerald-200 font-bold text-right">TNBQ/tháng</th>
                      <th className="border border-[#035b69] px-2 py-1.5 min-w-[130px] bg-[#035b69] text-white font-bold text-center">Liên kết bảng dưới</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {filteredCommunesTnhOverview.map((item, idx) => {
                      const c = item.commune;
                      const isCommuneSelected = (tnhScopeMode === 'COMMUNE_QUICK' || tnhScopeMode === 'COMMUNE_SECTOR') && (tnhSelectedCommuneId === c.id || tnhSelectedCommuneId === c.communeCode);
                      const isTkcsSelected = tnhScopeMode === 'TKCS_SECTOR' && (tnhSelectedTkcs === c.tkcsCode);

                      return (
                        <tr 
                          key={c.id || c.communeCode} 
                          onClick={() => {
                            setTnhScopeMode('COMMUNE_SECTOR');
                            setTnhSelectedCommuneId(c.id);
                            setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                            setSelectedCommuneId(c.id);
                            showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho xã [${c.communeCode}] ${c.communeName}`);
                          }}
                          className={`transition-colors cursor-pointer hover:bg-[#e6f6f8] ${
                            isCommuneSelected 
                              ? 'bg-sky-100 font-bold border-l-4 border-l-sky-800' 
                              : isTkcsSelected
                              ? 'bg-amber-100/60 font-semibold border-l-2 border-l-amber-600'
                              : idx % 2 === 1 ? 'bg-[#f2fafb]' : 'bg-white'
                          }`}
                        >
                          <td className="p-2 border border-slate-300 text-center text-slate-500">
                            {idx + 1}
                          </td>

                          {/* Tên & Mã TKCS - Bấm để chọn toàn bộ TKCS */}
                          <td 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTnhScopeMode('TKCS_SECTOR');
                              setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                              setTnhSelectedCommuneId('ALL');
                              setSelectedTkcs(c.tkcsCode || 'ALL');
                              showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho TKCS [${c.tkcsCode}] ${c.tkcsName || ''}`);
                            }}
                            className="p-2 border border-slate-300 text-left font-bold text-slate-900 cursor-pointer"
                            title={`Bấm vào đây để chọn TKCS [${c.tkcsCode}] ${c.tkcsName || ''} link xuống bảng dưới`}
                          >
                            <span className={isTkcsSelected ? 'text-amber-950 font-black' : ''}>{c.tkcsName || c.tkcsCode}</span>
                          </td>
                          <td 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTnhScopeMode('TKCS_SECTOR');
                              setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                              setTnhSelectedCommuneId('ALL');
                              setSelectedTkcs(c.tkcsCode || 'ALL');
                              showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho TKCS [${c.tkcsCode}] ${c.tkcsName || ''}`);
                            }}
                            className="p-2 border border-slate-300 text-center font-mono text-slate-700 cursor-pointer"
                            title={`Bấm chọn TKCS [${c.tkcsCode}]`}
                          >
                            {c.tkcsCode}
                          </td>

                          {/* Tên & Mã Xã - Bấm để chọn Xã này */}
                          <td 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTnhScopeMode('COMMUNE_SECTOR');
                              setTnhSelectedCommuneId(c.id);
                              setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                              setSelectedCommuneId(c.id);
                              showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho xã [${c.communeCode}] ${c.communeName}`);
                            }}
                            className="p-2 border border-slate-300 text-left font-bold text-slate-900 cursor-pointer"
                            title={`Bấm vào đây để chọn xã [${c.communeCode}] ${c.communeName} link xuống bảng dưới`}
                          >
                            <span className={isCommuneSelected ? 'text-sky-950 font-black' : ''}>{c.communeName}</span>
                          </td>
                          <td 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTnhScopeMode('COMMUNE_SECTOR');
                              setTnhSelectedCommuneId(c.id);
                              setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                              setSelectedCommuneId(c.id);
                              showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho xã [${c.communeCode}] ${c.communeName}`);
                            }}
                            className="p-2 border border-slate-300 text-center font-mono text-slate-700 cursor-pointer"
                            title={`Bấm chọn xã [${c.communeCode}]`}
                          >
                            {c.communeCode}
                          </td>

                          {/* Bảng kê trong xã (Hộ) */}
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.bkNongLamThuySan ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.bkCongNghiepXayDung ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.bkThuongMaiDichVu ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.bkThuKhacLuong ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-slate-900">
                            {c.bkTongSo ?? '---'}
                          </td>

                          {/* Tỷ trọng cơ cấu (%) */}
                          <td className="p-2 border border-slate-300 text-center text-slate-600">{c.ttNongLamThuySan !== undefined ? `${c.ttNongLamThuySan}%` : '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-600">{c.ttCongNghiepXayDung !== undefined ? `${c.ttCongNghiepXayDung}%` : '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-600">{c.ttThuongMaiDichVu !== undefined ? `${c.ttThuongMaiDichVu}%` : '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-600">{c.ttThuKhacLuong !== undefined ? `${c.ttThuKhacLuong}%` : '---'}</td>

                          {/* Mẫu chính thức */}
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.mauNongLamThuySan ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.mauCongNghiepXayDung ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.mauThuongMaiDichVu ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center text-slate-700">{c.mauThuKhacLuong ?? '---'}</td>
                          <td className="p-2 border border-slate-300 text-center font-bold text-slate-900">
                            {c.mauTongSo ?? '---'}
                          </td>

                          {/* Mẫu dự phòng */}
                          <td className="p-2 border border-slate-300 text-center text-slate-700">
                            {c.mauDuPhong ?? '---'}
                          </td>

                          {/* Kết quả điều tra thực tế & Liên kết TNH */}
                          <td className="p-2 border border-slate-300 text-center font-medium text-slate-800">
                            {item.surveyedCount > 0 ? (
                              <span>{item.surveyedCount} hộ ({item.totalMembers} ng)</span>
                            ) : item.totalHH > 0 ? (
                              <span className="text-slate-400">0/{item.totalHH} hộ</span>
                            ) : (
                              <span className="text-slate-400 italic">Chưa nạp</span>
                            )}
                          </td>
                          <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">
                            {item.perCapitaMonth > 0 ? `${item.perCapitaMonth.toLocaleString()} đ` : '---'}
                          </td>
                          <td className="p-2 border border-slate-300 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setTnhScopeMode('COMMUNE_SECTOR');
                                  setTnhSelectedCommuneId(c.id);
                                  setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                                  setSelectedCommuneId(c.id);
                                  showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho xã [${c.communeCode}] ${c.communeName}`);
                                }}
                                className={`px-2 py-1 rounded text-[11px] font-bold cursor-pointer transition-all shadow-2xs ${
                                  isCommuneSelected 
                                    ? 'bg-sky-800 text-white ring-2 ring-sky-400' 
                                    : 'bg-sky-700 hover:bg-sky-600 text-white'
                                }`}
                                title="Xem Tổng hợp nhanh cho riêng xã này ở bảng dưới"
                              >
                                {isCommuneSelected ? '✓ Đang xem Xã' : 'Xem Xã'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setTnhScopeMode('TKCS_SECTOR');
                                  setTnhSelectedTkcs(c.tkcsCode || 'ALL');
                                  setTnhSelectedCommuneId('ALL');
                                  setSelectedTkcs(c.tkcsCode || 'ALL');
                                  showNotification('success', `Đã liên kết số liệu Tổng hợp nhanh cho TKCS [${c.tkcsCode}] ${c.tkcsName || ''}`);
                                }}
                                className={`px-1.5 py-1 rounded text-[11px] font-bold cursor-pointer transition-all border ${
                                  isTkcsSelected
                                    ? 'bg-amber-600 text-white border-amber-700 ring-2 ring-amber-300'
                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                }`}
                                title="Xem Tổng hợp nhanh cho TKCS này ở bảng dưới"
                              >
                                {isTkcsSelected ? '✓ Xem TKCS' : 'Xem TKCS'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredCommunesTnhOverview.length === 0 && (
                      <tr>
                        <td colSpan={23} className="p-6 text-center text-slate-400 italic">
                          Không tìm thấy đơn vị xã nào phù hợp với bộ lọc tìm kiếm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BẢNG 2: TỔNG HỢP NHANH SỐ LIỆU ĐƯỢC LINK TRỰC TIẾP TỪ BẢNG TRÊN */}
            <div className="bg-white border-2 border-[#058da0] rounded-lg shadow-md overflow-hidden flex flex-col">
              {/* Header của Bảng Tổng hợp nhanh */}
              <div className="bg-[#058da0] text-white px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#047484]">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-400 text-slate-950 rounded font-black text-xs">
                    BẢNG 2
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm md:text-base uppercase tracking-wide flex items-center gap-2">
                      <span>Bảng Tổng Hợp Nhanh Thu Nhập Bình Quân Đầu Người</span>
                    </h3>
                    <p className="text-xs text-amber-300 font-bold mt-0.5 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span>
                        {selectedAreaId !== 'ALL' ? (
                          (() => {
                            const a = areas.find(item => item.id === selectedAreaId || item.code === selectedAreaId);
                            const c = communes.find(item => item.id === a?.communeId || item.communeCode === (a as any)?.communeCode);
                            return `📍 Đang liên kết ĐỊA BÀN: [${a?.code || selectedAreaId}] ${a?.name || 'Địa bàn'} - Xã [${c?.communeCode || '---'}] ${c?.communeName || ''} - Đã điều tra ${tnhSummary.totalSurveyedHH} hộ, ${tnhSummary.totalMembers} nhân khẩu`;
                          })()
                        ) : tnhScopeMode === 'COMMUNE_SECTOR' || tnhScopeMode === 'COMMUNE_QUICK' ? (
                          tnhSelectedCommuneId !== 'ALL' ? (
                            (() => {
                              const c = communes.find(item => item.id === tnhSelectedCommuneId || item.communeCode === tnhSelectedCommuneId);
                              return `📍 Đang liên kết đơn vị XÃ: [${c?.communeCode || '---'}] ${c?.communeName || '---'} - TKCS [${c?.tkcsCode || '---'}] ${c?.tkcsName || ''}`;
                            })()
                          ) : (
                            '📍 Đang liên kết: Toàn bộ 104 Xã / Phường'
                          )
                        ) : tnhScopeMode === 'TKCS_SECTOR' ? (
                          tnhSelectedTkcs !== 'ALL' ? (
                            (() => {
                              const matchingCommunes = communes.filter(c => c.tkcsCode === tnhSelectedTkcs);
                              const tkName = matchingCommunes[0]?.tkcsName || 'Thống kê cơ sở';
                              const cNames = matchingCommunes.map(c => c.communeName).join(', ');
                              return `📍 Đang liên kết THỐNG KÊ CƠ SỞ: [${tnhSelectedTkcs}] ${tkName} - Gồm ${matchingCommunes.length} xã: ${cNames}`;
                            })()
                          ) : (
                            '📍 Đang liên kết: Toàn bộ Thống kê cơ sở'
                          )
                        ) : (
                          '📍 Đang liên kết: Toàn Tỉnh'
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTnhPivotMode(!tnhPivotMode)}
                    className={`px-3 py-1.5 rounded font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${
                      tnhPivotMode 
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-200' 
                        : 'bg-teal-800 hover:bg-teal-700 text-white border border-teal-600'
                    }`}
                  >
                    <span>{tnhPivotMode ? '📊 Dạng Chuẩn Theo Nhóm Ngành' : '🔄 Dạng Pivot (Hàng ngang là các xã)'}</span>
                  </button>

                  <span className="bg-teal-800 px-3 py-1.5 rounded border border-teal-600 text-xs font-bold text-white">
                    Phạm vi: <strong className="text-amber-300">{tnhScopeCommunes.length} xã</strong> | Mẫu: <strong className="text-emerald-300">{tnhSummary.totalAllocMau} hộ</strong> | Đã điều tra: <strong className="text-amber-300">{tnhSummary.totalSurveyedHH} hộ - {tnhSummary.totalMembers} người</strong>
                  </span>
                </div>
              </div>

              {/* Table Body / Pivot or 2-Column Split View */}
              {tnhPivotMode ? (
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto p-4">
                  <table className="w-full border-collapse text-xs text-slate-800 whitespace-nowrap">
                    <thead>
                      <tr className="bg-[#058da0] text-white text-center font-bold text-[11px]">
                        <th className="border border-[#047484] p-2.5 w-12 bg-[#058da0]">STT</th>
                        <th className="border border-[#047484] p-2.5 text-left min-w-[160px] bg-[#047484]">Tên Xã / Phường</th>
                        <th className="border border-[#047484] p-2.5 w-20 bg-[#047484]">Mã xã</th>
                        <th className="border border-[#047484] p-2.5 w-28 bg-[#047484] text-amber-200">Tổng BK (Hộ)</th>
                        <th className="border border-[#047484] p-2.5 w-28 bg-[#047484] text-emerald-200">Mẫu (Hộ)</th>
                        <th className="border border-[#047484] p-2.5 w-28 bg-[#058da0] text-white">Đã điều tra</th>
                        <th className="border border-[#047484] p-2.5 w-32 bg-[#035b69] text-cyan-100">TNBQ NLTS (đ/tháng)</th>
                        <th className="border border-[#047484] p-2.5 w-32 bg-[#035b69] text-cyan-100">TNBQ CNXD (đ/tháng)</th>
                        <th className="border border-[#047484] p-2.5 w-32 bg-[#035b69] text-cyan-100">TNBQ TMDV (đ/tháng)</th>
                        <th className="border border-[#047484] p-2.5 w-32 bg-[#035b69] text-cyan-100">TNBQ Khác (đ/tháng)</th>
                        <th className="border border-[#047484] p-2.5 w-36 bg-[#02444e] text-amber-300 font-black">Suy rộng TNBQ (đ)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tnhScopeCommunes.map((c, idx) => {
                        const oc = OFFICIAL_COMMUNES_CATALOG.find(item => item.communeCode === c.communeCode || item.id === c.id);
                        const bkTot = c.bkTongSo ?? oc?.bkTongSo ?? 0;
                        const mauTot = c.mauTongSo ?? oc?.mauTongSo ?? 0;

                        const cHouseholds = households.filter(h => h.communeId === c.id || h.communeCode === c.communeCode);
                        const officialC = cHouseholds.filter(h => h.sampleStatus === 'CHÍNH THỨC' || !h.sampleStatus);
                        const surveyedC = officialC.filter(h => isHouseholdSurveyed(h));

                        const getSectorPerCapita = (sCode: number) => {
                          const sList = surveyedC.filter(h => Number(h.sectorCode) === sCode);
                          let inc = 0, mem = 0;
                          sList.forEach(h => {
                            inc += calculateHouseholdTotalIncome(h).total;
                            mem += (Number(h.membersCount) || 1);
                          });
                          return mem > 0 ? Math.round(inc / mem / 12) : 0;
                        };

                        const p1 = getSectorPerCapita(1);
                        const p2 = getSectorPerCapita(2);
                        const p3 = getSectorPerCapita(3);
                        const p4 = getSectorPerCapita(4);

                        const tt1 = c.ttNongLamThuySan ?? oc?.ttNongLamThuySan ?? 25;
                        const tt2 = c.ttCongNghiepXayDung ?? oc?.ttCongNghiepXayDung ?? 25;
                        const tt3 = c.ttThuongMaiDichVu ?? oc?.ttThuongMaiDichVu ?? 25;
                        const tt4 = c.ttThuKhacLuong ?? oc?.ttThuKhacLuong ?? 25;

                        const sumW = (tt1 + tt2 + tt3 + tt4) || 100;
                        const extYear = Math.round(((tt1 * p1 + tt2 * p2 + tt3 * p3 + tt4 * p4) / sumW));

                        return (
                          <tr key={c.id || c.communeCode} className="odd:bg-white even:bg-[#f2fafb] hover:bg-[#e6f6f8] transition-colors">
                            <td className="border border-slate-300 p-2.5 text-center text-slate-500">{idx + 1}</td>
                            <td className="border border-slate-300 p-2.5 font-bold text-slate-900">{c.communeName}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-mono text-slate-700">{c.communeCode}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-bold text-slate-900">{bkTot.toLocaleString()}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-bold text-slate-900">{mauTot}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-medium text-slate-800">
                              {surveyedC.length > 0 ? `${surveyedC.length} hộ` : <span className="text-slate-400 italic">0 hộ</span>}
                            </td>
                            <td className="border border-slate-300 p-2.5 text-right font-medium text-slate-800">{p1 > 0 ? `${p1.toLocaleString()} đ` : '---'}</td>
                            <td className="border border-slate-300 p-2.5 text-right font-medium text-slate-800">{p2 > 0 ? `${p2.toLocaleString()} đ` : '---'}</td>
                            <td className="border border-slate-300 p-2.5 text-right font-medium text-slate-800">{p3 > 0 ? `${p3.toLocaleString()} đ` : '---'}</td>
                            <td className="border border-slate-300 p-2.5 text-right font-medium text-slate-800">{p4 > 0 ? `${p4.toLocaleString()} đ` : '---'}</td>
                            <td className="border border-slate-300 p-2.5 text-right font-black text-slate-900 text-sm bg-amber-50">{extYear > 0 ? `${extYear.toLocaleString()} đ` : '0 đ'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 p-4 items-stretch">
                  {/* Left: Summary Table */}
                  <div className="lg:col-span-8 border border-slate-300 rounded-lg shadow-inner bg-white flex flex-col justify-between">
                    <table className="w-full border-collapse text-xs text-slate-800">
                      <thead>
                        <tr className="bg-[#058da0] text-white text-center font-bold text-[11px]">
                          <th className="border border-[#047484] p-2.5 w-10 bg-[#058da0]">STT</th>
                          <th className="border border-[#047484] p-2.5 w-14 bg-[#058da0]">Mã</th>
                          <th className="border border-[#047484] p-2.5 text-left bg-[#058da0]">Tên nhóm ngành nguồn thu lớn nhất</th>
                          <th className="border border-[#047484] p-2.5 w-24 bg-[#047484] text-amber-200">
                            Tổng số hộ
                          </th>
                          <th className="border border-[#047484] p-2.5 w-20 bg-[#047484] text-cyan-100">
                            Tỷ trọng
                          </th>
                          <th className="border border-[#047484] p-2.5 w-24 bg-[#047484] text-emerald-200">
                            Mẫu phân bổ
                          </th>
                          <th className="border border-[#047484] p-2.5 w-24 bg-[#058da0] text-white">
                            Hộ ĐT
                          </th>
                          <th className="border border-[#047484] p-2.5 w-28 bg-[#035b69] text-emerald-100">
                            TNBQ/tháng
                          </th>
                          <th className="border border-[#047484] p-2.5 w-32 bg-[#02444e] text-amber-300 font-black">
                            Suy rộng
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tnhSummary.sectorData.map((s, idx) => (
                          <tr key={s.code} className="odd:bg-white even:bg-[#f2fafb] hover:bg-[#e6f6f8] transition-colors">
                            <td className="border border-slate-300 p-2.5 text-center text-slate-500">{idx + 1}</td>
                            <td className="border border-slate-300 p-2.5 text-center font-bold text-slate-900">{s.code}</td>
                            <td className="border border-slate-300 p-2.5 font-bold text-slate-800">{s.name}</td>
                            
                            {/* 1. Tổng số hộ */}
                            <td className="border border-slate-300 p-2.5 text-center font-bold text-slate-900">
                              {s.bkCount.toLocaleString()}
                            </td>

                            {/* 2. Tỷ trọng cơ cấu */}
                            <td className="border border-slate-300 p-2.5 text-center font-bold text-slate-900">
                              {s.percent}%
                            </td>

                            {/* 3. Mẫu chính thức phân bổ */}
                            <td className="border border-slate-300 p-2.5 text-center font-bold text-slate-900">
                              {s.mauAlloc}
                            </td>

                            {/* Số hộ điều tra thực tế */}
                            <td className="border border-slate-300 p-2.5 text-center text-slate-800 font-medium">
                              {s.surveyCount > 0 ? (
                                <span>{s.surveyCount} hộ ({s.groupMembers} ng)</span>
                              ) : (
                                <span className="text-slate-400 italic">Chưa nạp</span>
                              )}
                            </td>

                            {/* TNBQ đầu người/tháng theo loại hộ */}
                            <td className="border border-slate-300 p-2.5 text-right font-bold text-slate-900">
                              {s.perCapitaMonth > 0 ? `${s.perCapitaMonth.toLocaleString()} đ` : '0 đ'}
                            </td>

                            {/* 4. Suy rộng TNBQ = Tỉ trọng cơ cấu * TNBQ đầu người/tháng theo loại hộ */}
                            <td className="border border-slate-300 p-2.5 text-right font-black text-slate-900 text-sm">
                              {s.extrapolatedIncomeYear > 0 ? `${s.extrapolatedIncomeYear.toLocaleString()} đ` : '0 đ'}
                            </td>
                          </tr>
                        ))}

                        {/* Dòng TỔNG TOÀN XÃ / TOÀN TKCS */}
                        <tr className="bg-sky-100 font-black text-slate-900 border-t-2 border-sky-800">
                          <td className="border border-slate-300 p-3 text-center" colSpan={3}>
                            <div className="flex items-center justify-between">
                              <span className="uppercase text-sky-950">TỔNG TOÀN BỘ PHẠM VI ĐANG XEM</span>
                              <span className="text-xs bg-sky-800 text-white px-2 py-0.5 rounded font-bold">
                                {tnhScopeCommunes.length} Xã
                              </span>
                            </div>
                          </td>
                          <td className="border border-slate-300 p-3 text-center text-slate-950 text-sm font-black bg-amber-100/60">
                            {tnhSummary.totalBkHH.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 p-3 text-center text-cyan-950 font-black bg-cyan-100/60">
                            100.0%
                          </td>
                          <td className="border border-slate-300 p-3 text-center text-emerald-950 text-sm font-black bg-emerald-100/60">
                            {tnhSummary.totalAllocMau.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 p-3 text-center text-slate-900 font-black">
                            {tnhSummary.totalSurveyedHH} / {tnhSummary.totalHH} hộ ({tnhSummary.totalMembers} ng)
                          </td>
                          <td className="border border-slate-300 p-3 text-right text-emerald-950 font-black bg-emerald-100/40" title={`${tnhSummary.totalMembers} nhân khẩu thực tế điều tra`}>
                            {tnhSummary.overallDirectPerCapita.toLocaleString()} đ
                          </td>
                          <td className="border border-slate-300 p-3 text-right text-rose-950 text-base font-black bg-amber-200/80 shadow-inner">
                            {tnhSummary.overallExtrapolated.toLocaleString()} đ
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Right: Visual Column Chart Panel */}
                  <div className="lg:col-span-4 bg-slate-50 border border-slate-300 rounded-lg p-4 flex flex-col justify-between shadow-inner h-full">
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
                        <h4 className="font-extrabold text-slate-800 text-xs uppercase flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-teal-700" />
                          <span>Biểu đồ TNBQ & Suy Rộng</span>
                        </h4>
                        <span className="text-[11px] bg-teal-100 text-teal-950 font-bold px-2 py-0.5 rounded">
                          {tnhScopeCommunes.length} Xã
                        </span>
                      </div>

                      {/* Column Chart Visual Container */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col gap-3">
                        <div className="flex items-center justify-center gap-4 text-xs font-semibold text-slate-700 border-b border-slate-100 pb-2">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-teal-600 rounded-xs inline-block"></span> TNBQ/tháng</span>
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-xs inline-block"></span> Suy rộng (năm)</span>
                        </div>

                        <div className="flex items-end justify-between gap-1.5 h-44 pt-6 px-1 border-b border-slate-200">
                          {(() => {
                            const maxExt = Math.max(...tnhSummary.sectorData.map(item => item.extrapolatedIncomeYear), 1);
                            const maxTnbq = Math.max(...tnhSummary.sectorData.map(item => item.perCapitaMonth), 1);

                            return tnhSummary.sectorData.map((s) => {
                              const tnbqHeight = s.perCapitaMonth > 0 ? Math.max(6, Math.round((s.perCapitaMonth / maxTnbq) * 100)) : 0;
                              const extHeight = s.extrapolatedIncomeYear > 0 ? Math.max(6, Math.round((s.extrapolatedIncomeYear / maxExt) * 100)) : 0;
                              const shortName = s.code === 1 ? 'Nông lâm' : s.code === 2 ? 'Công nghiệp' : s.code === 3 ? 'Thương mại' : 'Khác';

                              return (
                                <div key={s.code} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                                  <div className="flex items-end justify-center gap-0.5 w-full h-full">
                                    {/* TNBQ Column */}
                                    <div 
                                      className="w-2.5 bg-teal-600 rounded-t transition-all duration-500 group-hover:bg-teal-500 relative flex flex-col items-center"
                                      style={{ height: `${tnbqHeight}%` }}
                                      title={`${s.name} - TNBQ: ${s.perCapitaMonth.toLocaleString()} đ/tháng`}
                                    >
                                      {s.perCapitaMonth > 0 && (
                                        <span className="absolute -top-5 text-[9px] font-bold text-teal-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                          {Math.round(s.perCapitaMonth / 1000)}k
                                        </span>
                                      )}
                                    </div>

                                    {/* Suy rộng Column */}
                                    <div 
                                      className="w-2.5 bg-amber-500 rounded-t transition-all duration-500 group-hover:bg-amber-400 relative flex flex-col items-center"
                                      style={{ height: `${extHeight}%` }}
                                      title={`${s.name} - Suy rộng: ${s.extrapolatedIncomeYear.toLocaleString()} đ/năm`}
                                    >
                                      {s.extrapolatedIncomeYear > 0 && (
                                        <span className="absolute -top-5 text-[9px] font-bold text-amber-800 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                          {Math.round(s.extrapolatedIncomeYear / 1000000)}tr
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-800 text-center mt-1 leading-tight whitespace-normal w-full" title={s.name}>
                                    {s.code}. {shortName}
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Formula Legend Box matching drawing notes */}

            {/* Lower Sector Breakdown Tables matching image (Sections I, II, III, IV) */}
            {tnhScopeMode !== 'COMMUNE_QUICK' ? (
              <div className="flex flex-col gap-6 mt-2">
                {[
                  { code: 1, label: 'I. Hộ NLTS' },
                  { code: 2, label: 'II. Hộ CNXD' },
                  { code: 3, label: 'III. Hộ TMDV' },
                  { code: 4, label: 'IV. Hộ Nguồn thu khác / Lương' }
                ].map(grp => {
                  const sData = tnhSummary.sectorData.find(s => s.code === grp.code);
                  if (!sData) return null;

                  return (
                    <div key={grp.code} className="border border-slate-300 rounded overflow-hidden shadow-2xs">
                      {/* Yellow Group Header Row matching Image */}
                      <div className="bg-amber-300 text-slate-900 p-2.5 font-bold text-xs flex flex-wrap items-center justify-between border-b border-amber-400 gap-2">
                        <span className="text-sm font-black text-amber-950 uppercase">
                          {grp.label} (Bảng kê: {sData.bkCount} hộ | Mẫu: {sData.mauAlloc} hộ | Đã điều tra: {sData.surveyCount} hộ)
                        </span>
                        <div className="flex flex-wrap items-center gap-3 text-amber-950">
                          <span>Tổng số thành viên của hộ: <strong className="text-rose-950 font-black">{sData.groupMembers} người</strong></span>
                          <span>|</span>
                          <span>Tổng thu nhập: <strong className="text-emerald-950 font-black">{sData.groupIncome.toLocaleString()} Nghìn đồng</strong></span>
                          <span>|</span>
                          <span className="bg-white px-2.5 py-1 rounded border border-amber-500 font-extrabold text-emerald-950 shadow-2xs">
                            TNBQ đầu người/tháng theo loại hộ: {sData.perCapitaMonth.toLocaleString()} Nghìn đồng
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-xs text-slate-800 whitespace-nowrap">
                          <thead>
                            <tr className="bg-slate-100 font-bold text-slate-800 text-center border-b border-slate-300">
                              <th className="border border-slate-300 p-2 w-12">STT</th>
                              <th className="border border-slate-300 p-2 text-left">Xã/phường</th>
                              <th className="border border-slate-300 p-2 text-left">Địa bàn điều tra</th>
                              <th className="border border-slate-300 p-2 w-20">STT Mẫu</th>
                              <th className="border border-slate-300 p-2 text-left">Họ và tên chủ hộ</th>
                              <th className="border border-slate-300 p-2 w-32 text-center bg-rose-50 text-rose-900 font-bold">Tổng số thành viên của hộ</th>
                              <th className="border border-slate-300 p-2 w-40 text-right bg-amber-50 text-amber-900 font-bold">Tổng thu nhập (1000đ)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sData.sList.map((h, idx) => {
                              const inc = calculateHouseholdTotalIncome(h).total;
                              return (
                                <tr key={h.id} className="odd:bg-white even:bg-[#f2fafb] hover:bg-[#e6f6f8] transition-colors border-b border-slate-200">
                                  <td className="border border-slate-300 p-2 text-center text-slate-500">{idx + 1}</td>
                                  <td className="border border-slate-300 p-2 font-bold text-slate-900">{h.communeName || formCommuneName || '---'}</td>
                                  <td className="border border-slate-300 p-2 font-medium text-slate-800">{h.areaName || 'Địa bàn'}</td>
                                  <td className="border border-slate-300 p-2 text-center text-slate-800">{h.sttMau}</td>
                                  <td className="border border-slate-300 p-2 font-bold text-slate-900">{h.householdHead}</td>
                                  <td className="border border-slate-300 p-2 text-center text-slate-800">{h.membersCount}</td>
                                  <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">{inc.toLocaleString()}</td>
                                </tr>
                              );
                            })}
                            {sData.sList.length === 0 && (
                              <tr>
                                <td colSpan={7} className="text-center py-4 text-slate-400 italic">
                                  Chưa có hộ gia đình nào thuộc nhóm ngành này.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Quick list for Mode 1 */
              <div className="border border-slate-300 rounded p-3 bg-slate-50/50 mt-2">
                <h3 className="font-semibold text-slate-800 text-xs mb-2">Chi tiết danh sách các hộ trong báo cáo tổng hợp nhanh</h3>
                {renderHouseholdTable(false)}
              </div>
            )}

          </div>
        )}

        {/* TAB 4: KIỂM SOÁT THU NHẬP BÌNH QUÂN TOÀN TỈNH & 104 XÃ (DÀNH RIÊNG ADMIN) */}
        {activeTab === 'macro_control' && currentUser.role === 'ADMIN' && (
          <IncomeMacroControl
            communes={communes}
            households={households}
            areas={areas}
            currentUser={currentUser}
            onNavigateToCommune={(communeCode) => {
              setTnhScopeMode('COMMUNE_QUICK');
              setTnhSelectedCommuneId(communeCode);
              setSelectedCommuneId(communeCode);
              setActiveTab('tnh');
              showNotification('success', `Đã chuyển đến Tổng hợp nhanh xã [${communeCode}]`);
            }}
            showNotification={showNotification}
          />
        )}

        {/* TAB 5: QUẢN LÝ DANH MỤC XÃ & DỮ LIỆU */}
        {activeTab === 'database' && (
          <div className="bg-white rounded border border-slate-300 shadow-sm p-6 flex flex-col gap-6">
            <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800 text-base flex items-center gap-2">
                  <Database className="w-5 h-5 text-sky-700" />
                  <span>Quản lý danh mục Xã, Địa bàn & Dữ liệu lưu trữ</span>
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Quản lý danh mục xã, địa bàn trên máy này; dữ liệu nghiệp vụ chỉ được lưu cục bộ. Firebase chỉ nhận số đếm tiến độ.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsHeaderConfigModalOpen(true)}
                  className="px-3.5 py-2 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Tải file Excel lên với cấu hình tiêu đề dòng và cột"
                >
                  <Upload className="w-4 h-4" />
                  <span>Tải file lên</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setNewCommuneForm({
                      communeCode: String(communes.length + 1).padStart(2, '0'),
                      communeName: '',
                      tkcsCode: 'TKCS-01',
                      tkcsName: 'Thống kê cơ sở'
                    });
                    setIsAddCommuneModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Thêm mới một xã vào danh mục"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm xã mới</span>
                </button>

                <button 
                  onClick={() => setIsClearAllModalOpen(true)}
                  className="px-3.5 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                  title="Xóa toàn bộ hộ, địa bàn và xã để tải lại file Excel mới từ đầu"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xóa toàn bộ dữ liệu</span>
                </button>
              </div>
            </div>

            {/* Cảnh báo xã trùng lặp trong Tab 4 */}
            {duplicateCommunesDetected.length > 0 && (
              <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-extrabold text-amber-950 text-xs uppercase">
                      Cảnh báo: Phát hiện {duplicateCommunesDetected.length} xã có Mã xã trùng nhau trên hệ thống!
                    </h4>
                    <p className="text-xs text-amber-900 mt-0.5">
                      Các xã trùng: {duplicateCommunesDetected.map(c => `[${c.communeCode}] ${c.communeName}`).join(', ')}.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDeduplicateCommunes}
                  disabled={isDeleting}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isDeleting ? 'animate-spin' : ''}`} />
                  <span>Hợp nhất mã xã trùng</span>
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Communes Table */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#058da0] text-white px-3.5 py-2 rounded-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-cyan-200" />
                    <span className="font-extrabold text-white text-xs uppercase tracking-wide">
                      Danh sách xã trên hệ thống ({communes.length} xã)
                    </span>
                  </div>
                  <span className="text-[11px] text-cyan-100 font-medium">
                    Liên kết trực tiếp TNH & Bảng kê
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-300 rounded-b shadow-2xs max-h-[500px] overflow-y-auto">
                  <table className="w-full border-collapse text-xs text-slate-800">
                    <thead className="sticky top-0 z-10 bg-[#058da0]">
                      <tr className="bg-[#058da0] text-white text-center font-bold">
                        <th className="border border-[#047484] p-2 w-14">Mã xã</th>
                        <th className="border border-[#047484] p-2 text-left">Tên xã</th>
                        <th className="border border-[#047484] p-2 text-left">TKCS</th>
                        <th className="border border-[#047484] p-2 text-center w-14">Số ĐB</th>
                        <th className="border border-[#047484] p-2 text-center w-16">Số hộ</th>
                        <th className="border border-[#047484] p-2 text-right w-24">TNBQ/tháng</th>
                        <th className="border border-[#047484] p-2 text-center w-36">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communes.map(c => {
                        const overviewItem = communesTnhOverview.find(o => o.commune.id === c.id);
                        const hhCount = overviewItem ? overviewItem.totalHH : households.filter(h => h.communeId === c.id).length;
                        const areasCount = overviewItem ? overviewItem.areasCount : areas.filter(a => a.communeId === c.id).length;
                        const perCapita = overviewItem ? overviewItem.perCapitaMonth : 0;
                        const isDup = duplicateCommunesDetected.some(dup => dup.id === c.id);
                        return (
                          <tr key={c.id} className={`transition-colors odd:bg-white even:bg-[#f2fafb] hover:bg-[#e6f6f8] ${isDup ? 'bg-amber-100/60' : ''}`}>
                            <td className="border border-slate-300 p-2 text-center font-mono text-slate-700">{c.communeCode}</td>
                            <td className="border border-slate-300 p-2 font-bold text-slate-900">
                              <span>{c.communeName}</span>
                              {isDup && (
                                <span className="ml-1.5 px-1 py-0.2 bg-amber-100 text-amber-900 rounded text-[10px]">
                                  Trùng lặp
                                </span>
                              )}
                            </td>
                            <td className="border border-slate-300 p-2 text-left font-medium">
                              <span className="font-bold text-slate-800 block">{c.tkcsName || 'TKCS'}</span>
                              <span className="text-[10px] text-slate-500 font-semibold">[{c.tkcsCode}]</span>
                            </td>
                            <td className="border border-slate-300 p-2 text-center text-slate-700">{areasCount}</td>
                            <td className="border border-slate-300 p-2 text-center text-slate-800">{hhCount} hộ</td>
                            <td className="border border-slate-300 p-2 text-right font-bold text-slate-900">
                              {perCapita > 0 ? `${perCapita.toLocaleString()} đ` : '---'}
                            </td>
                            <td className="border border-slate-300 p-2 text-center">
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleViewCommuneTNH(c)}
                                  className="px-2 py-1 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 rounded font-black text-[10px] flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                                  title={`Xem Bảng Tổng hợp nhanh số liệu cho xã ${c.communeName}`}
                                >
                                  <BarChart3 className="w-3 h-3 text-slate-950" />
                                  <span>TNH</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLoadHouseholdsForCommune(c)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-bold text-[10px] flex items-center gap-0.5 cursor-pointer transition-colors shadow-2xs"
                                  title={`Tải file bảng kê hộ cho xã ${c.communeName}`}
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Tải hộ</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedCommuneId(c.id);
                                    setSelectedTkcs(c.tkcsCode || 'ALL');
                                    setActiveTab('entry');
                                  }}
                                  className="px-1.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded border border-sky-200 font-bold text-[10px] cursor-pointer"
                                  title={`Xem các hộ thuộc xã ${c.communeName} ở Tab 2`}
                                >
                                  Hộ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingCommune(c)}
                                  className="p-1 text-sky-700 hover:bg-sky-100 rounded cursor-pointer"
                                  title={`Sửa thông tin xã ${c.communeName}`}
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCommuneToDelete(c)}
                                  className="p-1 text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                  title={`Xóa xã ${c.communeName}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {communes.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                            Chưa có xã nào. Hãy bấm "Tải file lên (Cấu hình dòng & cột)" hoặc sang Tab 1 để tải file Excel.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Areas Table */}
              <div className="flex flex-col gap-2">
                <div className="bg-[#058da0] text-white px-3.5 py-2 rounded-t flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-cyan-200" />
                    <span className="font-extrabold text-white text-xs uppercase tracking-wide">
                      Danh sách địa bàn điều tra ({areas.length} địa bàn)
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-300 rounded-b max-h-[500px] overflow-y-auto shadow-2xs">
                  <table className="w-full border-collapse text-xs text-slate-800">
                    <thead className="sticky top-0 z-10 bg-[#058da0]">
                      <tr className="bg-[#058da0] text-white text-center font-bold">
                        <th className="border border-[#047484] p-2 w-16">Mã ĐB</th>
                        <th className="border border-[#047484] p-2 text-left">Tên địa bàn</th>
                        <th className="border border-[#047484] p-2 w-20">Số hộ</th>
                        <th className="border border-[#047484] p-2 text-center w-24">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {areas.map(a => {
                        const hhCount = a.householdCount || households.filter(h => h.areaId === a.id || h.areaCode === a.code).length;
                        const aNameDisplay = (a.name && a.name.trim() && a.name !== 'Địa bàn')
                          ? a.name.trim()
                          : (households.find(h => (h.areaId === a.id || h.areaCode === a.code) && h.areaName && h.areaName !== 'Địa bàn')?.areaName)
                          || `Địa bàn ${a.code}`;
                        return (
                          <tr key={a.id} className="hover:bg-sky-50 transition-colors">
                            <td className="border border-slate-300 p-2 text-center font-black text-emerald-800 bg-emerald-50/50">{a.code}</td>
                            <td className="border border-slate-300 p-2 font-bold text-slate-900">{aNameDisplay}</td>
                            <td className="border border-slate-300 p-2 text-center font-semibold text-slate-700">
                              {hhCount} hộ
                            </td>
                            <td className="border border-slate-300 p-2 text-center">
                              <button
                                type="button"
                                onClick={() => setAreaToDelete(a)}
                                className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 hover:text-rose-900 rounded border border-rose-200 font-bold text-[11px] flex items-center gap-1 mx-auto cursor-pointer transition-colors"
                                title={`Xóa địa bàn ${a.name} (Mã ${a.code}) và toàn bộ hộ thuộc địa bàn`}
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Xóa ĐB</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {areas.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                            Chưa có địa bàn nào.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SỔ TAY TRA CỨU DANH MỤC CHUẨN (PHỤ LỤC II) */}
        {activeTab === 'catalog' && (
          <div className="flex flex-col gap-4">
            
            {/* Banner & Intro */}
            <div className="bg-white p-4 rounded border border-slate-300 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="bg-amber-100 p-2 rounded text-amber-800 border border-amber-300">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900 uppercase">
                      Sổ tay Tra cứu Toàn bộ Danh mục Chuẩn (Phụ lục II)
                    </h2>
                    <p className="text-xs text-slate-600">
                      Tích hợp sẵn đầy đủ vào code theo đúng chuẩn 13 trang biểu mẫu điều tra thu nhập hộ nông thôn mới.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsGlobalCatalogOpen(true)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Search className="w-4 h-4" />
                  <span>Mở Sổ tay dạng Popup</span>
                </button>
              </div>
            </div>

            {/* Catalog Sub-tabs & Search */}
            <div className="bg-white p-3 rounded border border-slate-300 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => { setCatalogExplorerTab('muc2'); setCatalogSearchTerm(''); }}
                  className={`px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${catalogExplorerTab === 'muc2' ? 'bg-sky-800 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  1. Trồng trọt (63 loại)
                </button>
                <button
                  onClick={() => { setCatalogExplorerTab('muc3'); setCatalogSearchTerm(''); }}
                  className={`px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${catalogExplorerTab === 'muc3' ? 'bg-sky-800 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  2. Chăn nuôi (26 loại)
                </button>
                <button
                  onClick={() => { setCatalogExplorerTab('muc4'); setCatalogSearchTerm(''); }}
                  className={`px-3 py-1.5 rounded font-bold cursor-pointer transition-colors ${catalogExplorerTab === 'muc4' ? 'bg-sky-800 text-white shadow-xs' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                >
                  3. Lâm nghiệp (14 loại)
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-sky-50 border border-slate-300 rounded px-2.5 py-1 w-full md:w-72 shadow-2xs">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Tìm theo mã, tên hoặc nhóm..."
                  value={catalogSearchTerm}
                  onChange={e => setCatalogSearchTerm(e.target.value)}
                  className="w-full bg-transparent border-none text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Catalog Table */}
            {(() => {
              let currentList: CatalogItem[] = [];
              let tabTitle = '';
              let guideNote = '';

              switch (catalogExplorerTab) {
                case 'muc2':
                  currentList = CATALOG_TRONG_TROT;
                  tabTitle = 'MỤC 2: CÁC NGUỒN THU TỪ HOẠT ĐỘNG TRỒNG TRỌT (Trang 2 & 3 Phụ lục II)';
                  guideNote = 'Bao gồm 63 mục cây trồng lương thực, cây công nghiệp, cây ăn quả, giống, sản phẩm phụ và dịch vụ. Nhập thông tin 8 cột theo bảng kê: Bán ra (C1), Để lại dùng (C2), Giống (C4), Vật tư BVTV (C5), Chi khác (C6) -> Tự động tính Thu nhập C8 = C3 - C7.';
                  break;
                case 'muc3':
                  currentList = CATALOG_CHAN_NUOI;
                  tabTitle = 'MỤC 3: CÁC NGUỒN THU TỪ HOẠT ĐỘNG CHĂN NUÔI (Trang 4, 5 & 6 Phụ lục II)';
                  guideNote = 'Bao gồm 26 mục gia súc, gia cầm, chăn nuôi khác, sản phẩm không qua giết mổ, giống, sản phẩm phụ, dịch vụ và săn bắt. Chi phí gồm giống (C4), thức ăn/thuốc (C5), chi khác (C6).';
                  break;
                case 'muc4':
                  currentList = CATALOG_LAM_NGHIEP;
                  tabTitle = 'MỤC 4: CÁC NGUỒN THU TỪ HOẠT ĐỘNG LÂM NGHIỆP (Trang 7 & 8 Phụ lục II)';
                  guideNote = 'Bao gồm 14 mục khai thác gỗ, củi, trẩu, sở, quế, hồi, tre nứa, dịch vụ bảo vệ và quản lý rừng.';
                  break;
                case 'muc5':
                  currentList = CATALOG_THUY_SAN;
                  tabTitle = 'MỤC 5: CÁC NGUỒN THU TỪ HOẠT ĐỘNG THỦY SẢN (Trang 9 & 10 Phụ lục II)';
                  guideNote = 'Bao gồm nuôi trồng cá, tôm, cua ốc; đánh bắt thủy hải sản tự nhiên; sản xuất giống thủy sản.';
                  break;
                case 'muc6':
                  currentList = CATALOG_PHI_NONG_NGHIEP;
                  tabTitle = 'MỤC 6: SẢN XUẤT KINH DOANH PHI NÔNG, LÂM, THỦY SẢN & DỊCH VỤ (Trang 11 Phụ lục II)';
                  guideNote = 'Bao gồm 27 ngành nghề thực tế phổ biến tại nông thôn: xay xát, mộc, may mặc, gò hàn, thợ xây, cửa hàng tạp hóa, bán buôn nông sản, quán ăn, sửa xe máy, vận tải...';
                  break;
                case 'muc1':
                  currentList = CATALOG_CONG_VIEC;
                  tabTitle = 'MỤC 1: THU NHẬP TỪ TIỀN LƯƠNG, TIỀN CÔNG (Trang 1 Phụ lục II)';
                  guideNote = 'Danh mục các công việc chính thường gặp của thành viên hộ: công nhân nhà máy, thợ xây, lái xe, thợ mộc, cán bộ xã, giáo viên, nhân viên y tế... Thu nhập gồm Cột 1 (Lương, công) và Cột 2 (Lương hưu, trợ cấp).';
                  break;
                case 'muc7':
                  currentList = CATALOG_THU_KHAC;
                  tabTitle = 'MỤC 7: CÁC NGUỒN THU NHẬP KHÁC (Trang 12 Phụ lục II)';
                  guideNote = 'Bao gồm kiều hối, quà biếu tặng người thân, trợ cấp người có công / bảo trợ xã hội, cứu trợ bão lũ, học bổng, tiền cho thuê nhà đất / máy móc, lãi tiền gửi tiết kiệm, trúng xổ số...';
                  break;
              }

              const filtered = currentList.filter(item =>
                item.name.toLowerCase().includes(catalogSearchTerm.toLowerCase().trim()) ||
                item.category.toLowerCase().includes(catalogSearchTerm.toLowerCase().trim()) ||
                String(item.id).includes(catalogSearchTerm.trim())
              );

              return (
                <div className="bg-white p-4 rounded border border-slate-300 shadow-xs flex flex-col gap-3">
                  <div className="border-b border-slate-200 pb-2">
                    <h3 className="font-extrabold text-sky-900 text-sm">{tabTitle}</h3>
                    <p className="text-xs text-slate-600 mt-1">{guideNote}</p>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600">
                    <span>Tổng số: <strong className="text-slate-900">{filtered.length}</strong> / {currentList.length} mục</span>
                    <span className="text-[11px] italic text-slate-500">Mẹo: Khi nhập phiếu hộ, bạn có thể bấm nút "Tra cứu danh mục" để chọn trực tiếp không cần gõ tay.</span>
                  </div>

                  <div className="overflow-x-auto border border-slate-300 rounded">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#058da0] text-white text-center font-bold">
                          <th className="p-2 border border-[#047484] w-16">Mã tra cứu</th>
                          <th className="p-2 border border-[#047484] text-left min-w-[200px]">Tên sản phẩm / Nguồn thu / Ngành nghề</th>
                          <th className="p-2 border border-[#047484] text-left min-w-[200px]">Nhóm phân loại Phụ lục II</th>
                          <th className="p-2 border border-[#047484] w-28 text-center">Sao chép</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(item => (
                          <tr key={item.id} className="hover:bg-sky-50 odd:bg-slate-50/60">
                            <td className="p-2 border border-slate-300 text-center font-black text-sky-900 bg-sky-50">
                              #{item.id}
                            </td>
                            <td className="p-2 border border-slate-300 font-bold text-slate-900">
                              {item.name}
                            </td>
                            <td className="p-2 border border-slate-300 text-slate-700 font-medium">
                              <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                {item.category}
                              </span>
                            </td>
                            <td className="p-2 border border-slate-300 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(item.name);
                                  showNotification('success', `Đã sao chép: "${item.name}"`);
                                }}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-semibold text-[11px] flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                title="Sao chép tên"
                              >
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {filtered.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                              Không tìm thấy danh mục nào phù hợp với từ khóa "{catalogSearchTerm}".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* TAB 6: QUẢN LÝ 5 PHÒNG BAN, NGƯỜI NHẬP PHIẾU & PHÂN QUYỀN */}
        {activeTab === 'surveyors' && (
          <SurveyorManagement
            surveyors={surveyors}
            departments={departments}
            areas={areas}
            communes={communes}
            households={households}
            currentUser={currentUser}
            onSaveSurveyor={handleSaveSurveyor}
            onDeleteSurveyor={handleDeleteSurveyor}
            onSaveDepartment={handleSaveDepartment}
            onDeleteDepartment={handleDeleteDepartment}
            onBatchAssignArea={handleBatchAssignArea}
            onUnassignArea={handleUnassignArea}
            onBatchImportAssignments={handleBatchImportAssignments}
            onBatchAssignDepartmentArea={handleBatchAssignDepartmentArea}
            onSelectActiveUser={(s) => {
              handleResetFilters();
              setCurrentSurveyorId(s.id);
              try { localStorage.setItem('active_surveyor_id', s.id); } catch (e) {}
              showNotification('success', `Đang thao tác với vai trò: ${s.name} (${ROLE_LABELS[s.role]?.label || s.role})`);
            }}
            showNotification={showNotification}
          />
        )}

      </main>

      {/* CHANGE PASSWORD MODAL (Bao gồm cả chế độ Bắt buộc đổi mật khẩu khi đăng nhập lần đầu / sau khi Admin reset) */}
      {(showChangePasswordModal || (isLoggedIn && currentUser?.mustChangePassword)) && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className={`p-4 flex items-center justify-between text-white ${currentUser?.mustChangePassword ? 'bg-amber-800' : 'bg-sky-800'}`}>
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-300" />
                <h3 className="font-bold text-sm">
                  {currentUser?.mustChangePassword ? 'YÊU CẦU ĐỔI MẬT KHẨU BẮT BUỘC' : 'Đổi mật khẩu tài khoản'}
                </h3>
              </div>
              {!currentUser?.mustChangePassword && (
                <button
                  type="button"
                  onClick={() => setShowChangePasswordModal(false)}
                  className="text-white hover:bg-sky-900 p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleChangeMyPassword} className="p-5 flex flex-col gap-4 text-slate-700">
              {currentUser?.mustChangePassword ? (
                <div className="bg-amber-50 border border-amber-300 rounded p-3 text-amber-950 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-900">
                    <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Bảo mật hệ thống: Thiết lập mật khẩu mới</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-tight">
                    Tài khoản của bạn đăng nhập lần đầu hoặc vừa được Quản trị viên reset. Vui lòng tạo mật khẩu mới để tiếp tục nhập liệu và quản lý phiếu.
                  </p>
                </div>
              ) : (
                <div className="bg-sky-50 border border-sky-200 rounded p-2.5">
                  <span className="font-bold text-sky-950">Tài khoản: </span>
                  <span className="font-extrabold text-sky-900">{currentUser.name} ({currentUser.code})</span>
                  <span className="block text-[11px] text-slate-500 mt-0.5">Vai trò: {ROLE_LABELS[currentUser.role]?.label || currentUser.role}</span>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-800 mb-1">
                  Mật khẩu hiện tại (hoặc mật khẩu tạm do Admin cấp) *
                </label>
                <input
                  type="password"
                  required
                  value={currentPasswordInput}
                  onChange={e => setCurrentPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại..."
                  className="w-full border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-sky-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPasswordInput}
                  onChange={e => setNewPasswordInput(e.target.value)}
                  placeholder="Nhập mật khẩu mới (tối thiểu 4 ký tự)..."
                  className="w-full border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-sky-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Xác nhận mật khẩu mới *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmPasswordInput}
                  onChange={e => setConfirmPasswordInput(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full border border-slate-300 rounded p-2 text-slate-900 font-medium focus:ring-1 focus:ring-sky-600 focus:outline-hidden"
                />
              </div>

              {changePasswordError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{changePasswordError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                {!currentUser?.mustChangePassword && (
                  <button
                    type="button"
                    onClick={() => setShowChangePasswordModal(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-4 py-2 bg-sky-800 hover:bg-sky-700 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  {isSavingPassword ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Xác nhận & Lưu mật khẩu mới</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CẤU HÌNH TIÊU ĐỀ DÒNG VÀ CỘT NẠP DỮ LIỆU EXCEL */}
      <ExcelHeaderConfigModal
        isOpen={isHeaderConfigModalOpen}
        onClose={() => setIsHeaderConfigModalOpen(false)}
        existingCommunes={communes}
        onFinalizeHouseholdImport={executeFinalizeImport}
        onFinalizeCommuneListImport={handleFinalizeCommuneListImport}
        defaultCommuneCode={formCommuneCode}
        defaultCommuneName={formCommuneName}
        defaultTkcsCode={formTkcsCode}
        defaultTkcsName={formTkcsName}
        initialImportMode={headerConfigInitialMode}
      />

      {/* MODAL SỬA THÔNG TIN XÃ TRONG DANH MỤC */}
      {editingCommune && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-sky-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-sky-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-sky-200" />
                <h3 className="font-extrabold text-sm uppercase">Sửa thông tin Xã trong Danh mục</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingCommune(null)}
                className="text-white hover:bg-sky-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedCommune} className="p-5 flex flex-col gap-3.5">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Mã Xã <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  required
                  value={editingCommune.communeCode}
                  onChange={e => setEditingCommune({ ...editingCommune, communeCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tên Xã <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  required
                  value={editingCommune.communeName}
                  onChange={e => setEditingCommune({ ...editingCommune, communeName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Mã TKCS</label>
                <input
                  type="text"
                  value={editingCommune.tkcsCode}
                  onChange={e => setEditingCommune({ ...editingCommune, tkcsCode: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tên TKCS</label>
                <input
                  type="text"
                  value={editingCommune.tkcsName}
                  onChange={e => setEditingCommune({ ...editingCommune, tkcsName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setEditingCommune(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-800 hover:bg-sky-700 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Lưu thay đổi trên máy này</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL THÊM XÃ THỦ CÔNG VÀO DANH MỤC */}
      {isAddCommuneModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl border border-emerald-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-emerald-800 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-200" />
                <h3 className="font-extrabold text-sm uppercase">Thêm Xã mới vào Danh mục</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddCommuneModalOpen(false)}
                className="text-white hover:bg-emerald-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCommuneDirect} className="p-5 flex flex-col gap-3.5">
              <div>
                <label className="block font-bold text-slate-800 mb-1">Mã Xã <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  required
                  value={newCommuneForm.communeCode}
                  onChange={e => setNewCommuneForm({ ...newCommuneForm, communeCode: e.target.value })}
                  placeholder="Ví dụ: 01, 02..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tên Xã <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  required
                  value={newCommuneForm.communeName}
                  onChange={e => setNewCommuneForm({ ...newCommuneForm, communeName: e.target.value })}
                  placeholder="Nhập tên xã/phường..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-900 font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Mã TKCS</label>
                <input
                  type="text"
                  value={newCommuneForm.tkcsCode}
                  onChange={e => setNewCommuneForm({ ...newCommuneForm, tkcsCode: e.target.value })}
                  placeholder="TKCS-01..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-800 mb-1">Tên TKCS</label>
                <input
                  type="text"
                  value={newCommuneForm.tkcsName}
                  onChange={e => setNewCommuneForm({ ...newCommuneForm, tkcsName: e.target.value })}
                  placeholder="Tên tổ thống kê cơ sở..."
                  className="w-full bg-slate-50 border border-slate-300 rounded p-2 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setIsAddCommuneModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm xã & Lưu trên máy này</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CẢNH BÁO TRÙNG MÃ XÃ VÀ XÁC NHẬN GHI ĐÈ DỮ LIỆU */}
      {pendingDuplicateCommune && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-amber-400 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            {/* Header */}
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Cảnh báo trùng mã xã
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCancelDuplicateCommune}
                className="text-white hover:bg-amber-700 p-1 rounded cursor-pointer transition-colors"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 flex flex-col gap-4 text-slate-700">
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-950 font-medium">
                <p className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    Mã Xã [{pendingDuplicateCommune.newCommuneData.communeCode}] của file nạp đã TRÙNG KHỚP với mã của xã "{pendingDuplicateCommune.existingCommune.communeName}" đang có trên hệ thống!
                  </span>
                </p>
                <p className="text-[12px] text-amber-900 mt-2 font-bold">
                  Bạn có muốn GHI ĐÈ dữ liệu vào xã cũ không?
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  - Nếu chọn <strong>"Ghi đè vào xã đó"</strong>: Toàn bộ danh sách hộ và địa bàn cũ của xã này sẽ được xóa và thay thế bằng dữ liệu mới từ file Excel vừa nạp.<br />
                  - Nếu không muốn ghi đè: Bấm <strong>"Hủy bỏ"</strong> để không nạp file, không làm trùng lặp xã.
                </p>
              </div>

              {/* Comparison table */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Existing Commune */}
                <div className="p-3 rounded-lg border border-slate-300 bg-slate-50 flex flex-col gap-1.5">
                  <span className="font-bold text-slate-800 text-[11px] uppercase flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-slate-600" />
                    <span>Xã cũ đang lưu ({pendingDuplicateCommune.existingCommune.communeName})</span>
                  </span>
                  <div className="mt-1 space-y-1 text-slate-700">
                    <div>Mã xã: <strong className="text-slate-950 bg-slate-200 px-1 py-0.5 rounded">{pendingDuplicateCommune.existingCommune.communeCode}</strong></div>
                    <div>Tên xã: <strong className="text-slate-950">{pendingDuplicateCommune.existingCommune.communeName}</strong></div>
                    <div>TKCS: <span className="font-medium text-slate-700">{pendingDuplicateCommune.existingCommune.tkcsCode} - {pendingDuplicateCommune.existingCommune.tkcsName}</span></div>
                    <div className="pt-1 border-t border-slate-200 text-slate-600 text-[11px]">
                      Dữ liệu hiện có: <strong className="text-emerald-700">{households.filter(h => h.communeId === pendingDuplicateCommune.existingCommune.id).length} hộ</strong> ({areas.filter(a => a.communeId === pendingDuplicateCommune.existingCommune.id).length} địa bàn)
                    </div>
                  </div>
                </div>

                {/* New Incoming Commune */}
                <div className="p-3 rounded-lg border border-sky-300 bg-sky-50 flex flex-col gap-1.5">
                  <span className="font-bold text-sky-950 text-[11px] uppercase flex items-center gap-1">
                    <Upload className="w-3.5 h-3.5 text-sky-700" />
                    <span>Dữ liệu mới từ file Excel</span>
                  </span>
                  <div className="mt-1 space-y-1 text-slate-700">
                    <div>Mã xã: <strong className="text-sky-950 bg-sky-200 px-1 py-0.5 rounded">{pendingDuplicateCommune.newCommuneData.communeCode}</strong></div>
                    <div>Tên xã: <strong className="text-sky-950">{pendingDuplicateCommune.newCommuneData.communeName}</strong></div>
                    <div>TKCS: <span className="font-medium text-slate-700">{pendingDuplicateCommune.newCommuneData.tkcsCode} - {pendingDuplicateCommune.newCommuneData.tkcsName}</span></div>
                    <div className="pt-1 border-t border-sky-200 text-slate-600 text-[11px]">
                      Dữ liệu file mới: <strong className="text-sky-800">{pendingDuplicateCommune.totalParsed} hộ</strong> ({pendingDuplicateCommune.tempAreas.length} địa bàn)
                    </div>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={handleCancelDuplicateCommune}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer transition-colors"
                >
                  Hủy bỏ (Không nạp)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmOverwriteCommune}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-extrabold cursor-pointer shadow-xs transition-colors flex items-center justify-center gap-1.5"
                  title="Xóa dữ liệu cũ của xã này và nạp toàn bộ danh sách hộ mới từ file Excel"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Ghi đè vào xã đó</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXCEL IMPORT REPORT MODAL (THÔNG BÁO ĐỊA BÀN TRỐNG / KHÔNG ĐÚNG MẪU ĐÃ LOẠI BỎ) */}
      {uploadReport && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-xl w-full p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5 text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-sm uppercase">Kết quả kiểm tra & Nhận diện Địa bàn</h3>
              </div>
              <button
                type="button"
                onClick={() => setUploadReport(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs text-slate-700">
              <div className="bg-emerald-50 border border-emerald-300 rounded p-3 text-emerald-950 font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Đã nhận diện thành công <strong>{uploadReport.validCount}</strong> địa bàn hợp lệ với tổng số <strong>{uploadReport.totalHouseholds}</strong> hộ gia đình.
                </span>
              </div>

              {uploadReport.skippedSheets.length > 0 && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    <span>Đã tự động loại bỏ {uploadReport.skippedSheets.length} sheet không đúng mẫu hoặc bị trống:</span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-rose-200 rounded bg-rose-50/50 divide-y divide-rose-100">
                    {uploadReport.skippedSheets.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900">Sheet: "{item.sheetName || 'Không tên'}"</span>
                          <p className="text-[11px] text-rose-700 mt-0.5 font-medium">{item.reason}</p>
                        </div>
                        <span className="px-1.5 py-0.5 bg-rose-200 text-rose-800 rounded font-black text-[10px] shrink-0">
                          Bỏ qua
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500 italic">
                    Hệ thống chỉ nạp các sheet có danh sách hộ thực tế và đánh số thứ tự địa bàn liên tục từ 001 đến hết các sheet hợp lệ.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
              <button
                type="button"
                onClick={() => setUploadReport(null)}
                className="px-4 py-2 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs cursor-pointer shadow-xs"
              >
                Đã hiểu & Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL PHỤ LỤC II QUESTIONNAIRE MODAL (ĐẦY ĐỦ 13 TRANG BIỂU MẪU & TRA CỨU DANH MỤC) */}
      {activeHouseholdForm && (
        <QuestionnaireModal
          household={activeHouseholdForm}
          isOpen={!!activeHouseholdForm}
          onClose={() => setActiveHouseholdForm(null)}
          onSave={handleSaveQuestionnaire}
          currentUser={currentUser}
          allSurveyors={surveyors}
        />
      )}

      {/* MODAL THAY THẾ HỘ MẪU ĐIỀU TRA BẰNG HỘ DỰ PHÒNG CÙNG ĐỊA BÀN */}
      {householdToReplace && (
        <ReplaceHouseholdModal
          isOpen={!!householdToReplace}
          onClose={() => setHouseholdToReplace(null)}
          householdToReplace={householdToReplace}
          allHouseholds={households}
          areas={areas}
          onConfirmReplacement={handleConfirmReplacement}
          onAddNewReserveHousehold={handleAddNewReserveHousehold}
        />
      )}

      {/* SỔ TAY TRA CỨU DANH MỤC GLOBAL MODAL */}
      {isGlobalCatalogOpen && (
        <CatalogModal
          isOpen={isGlobalCatalogOpen}
          onClose={() => setIsGlobalCatalogOpen(false)}
        />
      )}

      {/* MODAL TRAO ĐỔI DỮ LIỆU ĐỊA BÀN (JSON): XUẤT DATA BẢNG KÊ & TỔNG HỢP DATA */}
      {isDataTransferModalOpen && (
        <AreaDataTransferModal
          isOpen={isDataTransferModalOpen}
          onClose={() => setIsDataTransferModalOpen(false)}
          currentUser={currentUser}
          surveyors={surveyors}
          departments={departments}
          communes={communes}
          areas={areas}
          households={households}
          onApplyWorkPackage={handleApplyWorkPackage}
          showNotification={showNotification}
          initialMode={dataTransferMode}
        />
      )}

      {/* MODAL DUYỆT ĐỊA BÀN: HỖ TRỢ TÍCH TẤT CẢ VÀ TÍCH CHỌN HỘ */}
      {isDuyetDiaBanModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="bg-purple-800 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-purple-200" />
                <h3 className="font-bold text-sm uppercase">Duyệt Địa bàn Điều tra</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsDuyetDiaBanModalOpen(false)}
                className="text-white hover:bg-purple-900 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-slate-700">
              <div className="bg-purple-50 border border-purple-200 rounded p-3 text-purple-950 font-medium">
                <p className="font-bold text-purple-900 mb-1">Chức năng Duyệt địa bàn:</p>
                <p className="text-slate-700">
                  Bạn có thể <strong>Tích tất cả các hộ</strong> trong địa bàn đang lọc ({filteredHouseholds.length} hộ) hoặc <strong>Tích chọn từng hộ</strong> trên danh sách để thực hiện Duyệt & Khóa phiếu.
                </p>
                <div className="mt-2 pt-2 border-t border-purple-200 flex items-center justify-between text-xs">
                  <span>Phạm vi hiển thị: <strong>{filteredHouseholds.length} hộ</strong></span>
                  <span>Đã tích chọn: <strong className="text-purple-800 font-bold">{selectedHouseholdIds.length} hộ</strong></span>
                </div>
              </div>

              {/* Chức năng tích tất cả và bỏ tích */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = filteredHouseholds.map(h => h.id);
                    setSelectedHouseholdIds(allIds);
                    showNotification('success', `Đã tích chọn tất cả ${allIds.length} hộ trong danh sách.`);
                  }}
                  className="flex-1 py-2 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white rounded font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>Tích tất cả ({filteredHouseholds.length} hộ)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedHouseholdIds([]);
                    showNotification('success', 'Đã bỏ tích chọn tất cả các hộ.');
                  }}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-semibold cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>

              {/* Thao tác Duyệt */}
              <div className="flex flex-col gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={async () => {
                    const count = filteredHouseholds.length;
                    if (count === 0) {
                      showNotification('error', 'Không có hộ nào trong danh sách để duyệt.');
                      return;
                    }
                    const targetIds = new Set(filteredHouseholds.map(h => h.id));
                    const updatedHouseholds = households.map(h => {
                      if (targetIds.has(h.id)) {
                        return { ...h, surveyStatus: 'DA_DUYET' as SurveyStatus };
                      }
                      return h;
                    });
                    setHouseholds(updatedHouseholds);
                    try { localStorage.setItem('cached_households', JSON.stringify(updatedHouseholds)); } catch (e) {}
                    setSelectedHouseholdIds([]);
                    setIsDuyetDiaBanModalOpen(false);
                    showNotification('success', `Đã Duyệt & Khóa thành công toàn bộ ${count} hộ của địa bàn!`);
                  }}
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-600 active:bg-purple-800 text-white rounded font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Lock className="w-4 h-4" />
                  <span>Duyệt & Khóa toàn bộ địa bàn ({filteredHouseholds.length} hộ)</span>
                </button>

                {selectedHouseholdIds.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleBatchSetStatus('DA_DUYET');
                      setIsDuyetDiaBanModalOpen(false);
                    }}
                    className="w-full py-2 bg-indigo-700 hover:bg-indigo-600 text-white rounded font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <CheckSquare className="w-4 h-4" />
                    <span>Duyệt {selectedHouseholdIds.length} hộ đã tích chọn</span>
                  </button>
                )}

                {selectedHouseholdIds.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await handleBatchSetStatus('DA_HOAN_THANH');
                      setIsDuyetDiaBanModalOpen(false);
                    }}
                    className="w-full py-2 bg-slate-600 hover:bg-slate-500 text-white rounded font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Mở khóa {selectedHouseholdIds.length} hộ đã tích chọn</span>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-slate-500 text-[11px]">
                <span>Bạn cũng có thể tích chọn từng hộ trực tiếp trên bảng danh sách</span>
                <button
                  type="button"
                  onClick={() => setIsDuyetDiaBanModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: XÁC NHẬN XÓA TOÀN BỘ DỮ LIỆU ĐỂ UP LẠI */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="bg-rose-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm uppercase">Xác nhận xóa toàn bộ dữ liệu</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="text-white hover:bg-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-4 text-slate-700">
              <div className="bg-rose-50 border border-rose-200 rounded p-3 text-rose-950 font-medium">
                <p className="font-bold text-rose-800 mb-1">Cảnh báo: Hành động này sẽ xóa sạch:</p>
                <ul className="list-disc list-inside space-y-1 text-rose-900">
                  <li>Toàn bộ <strong>{households.length}</strong> hộ gia đình đã nạp.</li>
                  <li>Toàn bộ <strong>{areas.length}</strong> địa bàn điều tra.</li>
                  <li>Toàn bộ <strong>{communes.length}</strong> xã đã tạo.</li>
                </ul>
              </div>
              
              <p className="text-slate-600">
                Bảng kê xã, địa bàn và hộ sẽ được xóa khỏi máy này để bạn tải file Excel mới. Dữ liệu tiến độ trên Firebase không bị xóa.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsClearAllModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Xác nhận xóa sạch để nạp lại</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: XÁC NHẬN XÓA 1 XÃ */}
      {communeToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-rose-700 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Xác nhận xóa Xã</h3>
              </div>
              <button
                type="button"
                onClick={() => setCommuneToDelete(null)}
                className="text-white hover:bg-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-slate-700">
              <p>
                Bạn có chắc chắn muốn xóa xã <strong className="text-rose-700 font-bold">"{communeToDelete.communeName}"</strong> (Mã: {communeToDelete.communeCode})?
              </p>
              <p className="text-slate-500 text-[11px]">
                Toàn bộ địa bàn và hộ thuộc xã này sẽ bị xóa khỏi máy này.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setCommuneToDelete(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCommune(communeToDelete.id)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận xóa xã
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: XÁC NHẬN XÓA 1 ĐỊA BÀN */}
      {areaToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-rose-700 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Xác nhận xóa Địa bàn</h3>
              </div>
              <button
                type="button"
                onClick={() => setAreaToDelete(null)}
                className="text-white hover:bg-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-slate-700">
              <p>
                Bạn có chắc chắn muốn xóa địa bàn <strong className="text-rose-700 font-bold">"{areaToDelete.name}"</strong> (Mã: {areaToDelete.code})?
              </p>
              <p className="text-slate-500 text-[11px]">
                Toàn bộ hộ thuộc địa bàn này sẽ bị xóa khỏi máy này.
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setAreaToDelete(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteArea(areaToDelete)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận xóa địa bàn
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: XÁC NHẬN XÓA 1 HỘ GIA ĐÌNH */}
      {householdToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-rose-700 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Xác nhận xóa Hộ gia đình</h3>
              </div>
              <button
                type="button"
                onClick={() => setHouseholdToDelete(null)}
                className="text-white hover:bg-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-slate-700">
              <p>
                Bạn có chắc chắn muốn xóa hộ <strong className="text-rose-700 font-bold">"{householdToDelete.householdHead}"</strong> (Địa chỉ: {householdToDelete.address || householdToDelete.areaName}) khỏi máy này?
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setHouseholdToDelete(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteSingleHousehold(householdToDelete)}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận xóa hộ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: XÁC NHẬN XÓA HÀNG LOẠT HỘ ĐÃ CHỌN */}
      {isBatchDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden text-xs">
            <div className="bg-rose-700 text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-rose-200" />
                <h3 className="font-bold text-sm">Xác nhận xóa Hộ đã chọn</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBatchDeleteModalOpen(false)}
                className="text-white hover:bg-rose-800 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-3 text-slate-700">
              <p>
                Bạn có chắc chắn muốn xóa <strong className="text-rose-700 font-bold">{selectedHouseholdIds.length}</strong> hộ gia đình đã được tích chọn khỏi máy này?
              </p>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setIsBatchDeleteModalOpen(false)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBatchSelected}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded font-bold cursor-pointer shadow-xs"
                >
                  Xác nhận xóa {selectedHouseholdIds.length} hộ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETING PROGRESS OVERLAY */}
      {isDeleting && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-md w-full p-6 flex flex-col items-center gap-4 text-center">
            <Loader2 className="w-10 h-10 text-rose-600 animate-spin" />
            <div>
              <h3 className="font-bold text-slate-900 text-base uppercase text-rose-800">Đang xử lý xóa dữ liệu cục bộ</h3>
              <p className="text-xs text-slate-600 mt-2 font-medium">{deleteProgressText}</p>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mt-2">
              <div className="bg-rose-600 h-2 rounded-full animate-pulse w-full"></div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: XÓA TRẮNG / RESET PHIẾU ĐIỀU TRA THEO ĐỊA BÀN HOẶC HỘ */}
      {isResetQuestionnaireModalOpen && (() => {
        const allSurveyedList = households.filter(h => isHouseholdSurveyed(h) || h.surveyStatus !== 'CHUA_NHAP');
        const currentCommuneSurveyedList = selectedCommuneId !== 'ALL' 
          ? allSurveyedList.filter(h => h.communeId === selectedCommuneId || (Boolean(currentCommune?.communeCode) && h.communeCode === currentCommune?.communeCode))
          : [];

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-2xl w-full overflow-hidden text-xs max-h-[92vh] flex flex-col">
              <div className="bg-amber-600 text-white p-3.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-amber-200" />
                  <h3 className="font-bold text-sm">Xóa trắng / Reset Phiếu điều tra (Hộ nhập thử)</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetQuestionnaireModalOpen(false)}
                  className="text-white hover:bg-amber-700 p-1 rounded cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 flex flex-col gap-3.5 text-slate-700 overflow-y-auto">
                <p className="text-slate-600 leading-relaxed">
                  Tính năng này giúp xóa trắng nội dung phiếu (đưa về trạng thái chưa nhập ban đầu) cho các hộ do nhập thử nghiệm. Vui lòng chọn phạm vi cần reset:
                </p>

                {/* VỊ TRÍ CÁC HỘ ĐANG CÓ SỐ LIỆU ĐIỀU TRA ĐỂ QUAN SÁT RÕ RÀNG */}
                {allSurveyedList.length > 0 ? (
                  <div className="border border-amber-300 bg-amber-50/60 rounded p-2.5 flex flex-col gap-2">
                    <div className="font-bold text-amber-950 flex flex-wrap items-center justify-between gap-1">
                      <span>📍 Danh sách {allSurveyedList.length} hộ đang có số liệu điều tra trong hệ thống:</span>
                      <span className="text-[11px] text-amber-800 font-medium">Bấm "Xóa" từng hộ hoặc chọn radio bên dưới để xóa hàng loạt</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto border border-amber-200 rounded bg-white shadow-2xs">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-amber-100 text-amber-900 sticky top-0 font-bold">
                          <tr>
                            <th className="p-1 border border-amber-200 text-center w-8">STT</th>
                            <th className="p-1 border border-amber-200 text-left">Xã / Phường</th>
                            <th className="p-1 border border-amber-200 text-left">Địa bàn (Tên sheet)</th>
                            <th className="p-1 border border-amber-200 text-center w-14">STT Mẫu</th>
                            <th className="p-1 border border-amber-200 text-left">Họ tên chủ hộ</th>
                            <th className="p-1 border border-amber-200 text-center w-20">Trạng thái</th>
                            <th className="p-1 border border-amber-200 text-center w-14">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allSurveyedList.map((h, i) => (
                            <tr key={h.id} className="hover:bg-amber-50/80 transition-colors">
                              <td className="p-1 border border-amber-100 text-center text-slate-500">{i + 1}</td>
                              <td className="p-1 border border-amber-100 font-semibold text-slate-800">{h.communeName || h.communeCode}</td>
                              <td className="p-1 border border-amber-100 text-[#047484] font-medium">{(h as any).sheetName || h.areaName || `ĐB ${h.areaCode}`}</td>
                              <td className="p-1 border border-amber-100 text-center font-bold text-slate-700">{h.sttMau}</td>
                              <td className="p-1 border border-amber-100 font-bold text-slate-900">{h.householdHead}</td>
                              <td className="p-1 border border-amber-100 text-center">
                                <span className="px-1 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 font-semibold border border-amber-200">
                                  {h.surveyStatus}
                                </span>
                              </td>
                              <td className="p-1 border border-amber-100 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleResetSingleHousehold(h)}
                                  className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                                  title="Xóa trắng phiếu của hộ này"
                                >
                                  Xóa
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded p-2.5 text-center font-bold text-xs flex items-center justify-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Hệ thống hiện tại không còn hộ nào có dữ liệu nhập tin (0 hộ).</span>
                  </div>
                )}

                <div className="flex flex-col gap-2.5 pt-1">
                  {/* Tùy chọn 1: Xóa trắng toàn bộ hệ thống */}
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 bg-amber-50/80 hover:bg-amber-100/70 p-2 rounded border border-amber-200 transition-colors">
                    <input
                      type="radio"
                      name="resetTargetType"
                      value="all_system_surveyed"
                      checked={resetTargetType === 'all_system_surveyed'}
                      onChange={() => setResetTargetType('all_system_surveyed')}
                      className="cursor-pointer"
                    />
                    <span>Xóa trắng TOÀN BỘ các hộ đã nhập tin trong toàn hệ thống ({allSurveyedList.length} hộ)</span>
                  </label>

                  {/* Tùy chọn 2: Xóa trắng các hộ trong xã đang chọn */}
                  {selectedCommuneId !== 'ALL' && (
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 bg-sky-50/80 hover:bg-sky-100/70 p-2 rounded border border-sky-200 transition-colors">
                      <input
                        type="radio"
                        name="resetTargetType"
                        value="commune_surveyed"
                        checked={resetTargetType === 'commune_surveyed'}
                        onChange={() => setResetTargetType('commune_surveyed')}
                        className="cursor-pointer"
                      />
                      <span>Xóa trắng các hộ đã nhập tin của Xã [{currentCommune?.communeCode}] {currentCommune?.communeName} ({currentCommuneSurveyedList.length} hộ)</span>
                    </label>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mt-0.5">
                    <input
                      type="radio"
                      name="resetTargetType"
                      value="area"
                      checked={resetTargetType === 'area'}
                      onChange={() => setResetTargetType('area')}
                      className="cursor-pointer"
                    />
                    <span>Reset theo Địa bàn cụ thể</span>
                  </label>

                  {resetTargetType === 'area' && (
                    <div className="pl-6 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1">Xã:</span>
                        <select
                          value={resetCommuneId}
                          onChange={e => {
                            setResetCommuneId(e.target.value);
                            setResetAreaId('ALL');
                          }}
                          className="w-full bg-white border border-slate-300 rounded p-1.5 font-semibold text-slate-800 text-xs"
                        >
                          <option value="ALL">-- Tất cả các xã --</option>
                          {communes.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.communeCode} - {c.communeName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <span className="block text-[11px] font-semibold text-slate-600 mb-1">Địa bàn:</span>
                        <select
                          value={resetAreaId}
                          onChange={e => setResetAreaId(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded p-1.5 font-semibold text-slate-800 text-xs"
                        >
                          <option value="ALL">-- Tất cả địa bàn trong xã --</option>
                          {areas
                            .filter(a => resetCommuneId === 'ALL' || a.communeId === resetCommuneId)
                            .map(a => (
                              <option key={a.id} value={a.id}>
                                ĐB {a.code} - {a.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mt-0.5">
                    <input
                      type="radio"
                      name="resetTargetType"
                      value="selected"
                      checked={resetTargetType === 'selected'}
                      onChange={() => setResetTargetType('selected')}
                      className="cursor-pointer"
                    />
                    <span>Reset các hộ đang được tích chọn trên bảng ({selectedHouseholdIds.length} hộ)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 mt-0.5">
                    <input
                      type="radio"
                      name="resetTargetType"
                      value="all_filtered"
                      checked={resetTargetType === 'all_filtered'}
                      onChange={() => setResetTargetType('all_filtered')}
                      className="cursor-pointer"
                    />
                    <span>Reset toàn bộ danh sách hộ đang hiển thị ({filteredHouseholds.length} hộ)</span>
                  </label>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-amber-900 text-[11px]">
                  ⚠️ <strong>Lưu ý:</strong> Hành động này sẽ xóa toàn bộ số liệu thu nhập đã nhập trong các biểu mẫu Phụ lục II của các hộ được chọn và đưa trạng thái về "Chưa nhập". Dữ liệu không thể khôi phục sau khi reset.
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 mt-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsResetQuestionnaireModalOpen(false)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded font-bold cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleResetQuestionnaires}
                    disabled={isResettingQuestionnaire}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    {isResettingQuestionnaire && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Xác nhận xóa trắng phiếu</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <footer className="bg-sky-900 text-sky-200 py-3 text-center text-xs border-t border-sky-950 mt-auto">
        <p>Hệ thống Quản lý Thống kê Thu nhập Hộ gia đình © 2026 - Phiếu thu thập thông tin Phụ lục II</p>
      </footer>
    </div>
  );
}
