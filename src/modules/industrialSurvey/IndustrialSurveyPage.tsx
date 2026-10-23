/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Store, Layers, Plus, Search, Filter, Download, 
  Printer, BookOpen, Trash2, Edit3, CheckCircle2, Lock, 
  HelpCircle, RefreshCw, BarChart3, Users, DollarSign, Database, 
  FileSpreadsheet, ArrowLeft, LogOut, CheckCircle, AlertTriangle,
  Compass, LayoutDashboard
} from 'lucide-react';
import { 
  EnterpriseSurvey01, 
  IndividualEstablishment02, 
  IndustrialSummaryReport,
  createDefaultEnterprise01,
  createDefaultEstablishment02
} from '../../types/industrialSurvey';
import { 
  exportEnterprise01ToExcel, 
  exportEstablishment02ToExcel,
  exportAllEnterprisesListToExcel,
  exportAllEstablishmentsListToExcel
} from '../../utils/industrialExcelExport';
import Enterprise01Modal from '../../components/Enterprise01Modal';
import Establishment02Modal from '../../components/Establishment02Modal';
import IndustrialSummaryView from '../../components/IndustrialSummaryView';
import IndustrialGuidelinesModal from '../../components/IndustrialGuidelinesModal';
import CommuneFilterSelect from '../../components/CommuneFilterSelect';
import { OFFICIAL_COMMUNES_CATALOG } from '../../data/communesCatalog';
import { Surveyor } from '../../types/user';
import { db, safeFirestoreWrite, handleFirestoreError, OperationType } from '../../firebase';
import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';

const DEMO_IDS = ['dn_0900123456_01', 'dn_0900654321_02', 'cs_0001_at', 'cs_0002_at'];

export interface IndustrialSurveyPageProps {
  currentUser?: Surveyor | null;
  onSwitchToHousehold?: () => void;
  onLogout?: () => void;
  onNotification?: (type: 'success' | 'error', message: string) => void;
}

export default function IndustrialSurveyPage({
  currentUser,
  onSwitchToHousehold,
  onLogout,
  onNotification
}: IndustrialSurveyPageProps) {
  // Tab hiện tại: DN_01 (Phiếu 01), CS_02 (Phiếu 02), BIEU_TH (Biểu 03 & 04)
  const [activeSubTab, setActiveSubTab] = useState<'DN_01' | 'CS_02' | 'BIEU_TH'>('DN_01');

  // Thông báo nội bộ nếu không truyền onNotification
  const [localNotification, setLocalNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotify = (type: 'success' | 'error', message: string) => {
    if (onNotification) {
      onNotification(type, message);
    }
    setLocalNotification({ type, message });
    setTimeout(() => {
      setLocalNotification(null);
    }, 4000);
  };

  // Dữ liệu danh sách - khởi tạo trống, chỉ giữ logic công thức tính toán
  const [enterprises, setEnterprises] = useState<EnterpriseSurvey01[]>(() => {
    try {
      const cached = localStorage.getItem('cached_enterprises_01');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed.filter((item: any) => !DEMO_IDS.includes(item?.id)) : [];
      }
    } catch (e) {}
    return [];
  });

  const [establishments, setEstablishments] = useState<IndividualEstablishment02[]>(() => {
    try {
      const cached = localStorage.getItem('cached_establishments_02');
      if (cached) {
        const parsed = JSON.parse(cached);
        return Array.isArray(parsed) ? parsed.filter((item: any) => !DEMO_IDS.includes(item?.id)) : [];
      }
    } catch (e) {}
    return [];
  });

  const [summaries, setSummaries] = useState<IndustrialSummaryReport[]>(() => {
    try {
      const cached = localStorage.getItem('cached_industrial_summaries');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return [];
  });

  // Modals state
  const [selectedEnterprise, setSelectedEnterprise] = useState<EnterpriseSurvey01 | null>(null);
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);

  const [selectedEstablishment, setSelectedEstablishment] = useState<IndividualEstablishment02 | null>(null);
  const [isEstablishmentModalOpen, setIsEstablishmentModalOpen] = useState(false);

  const [isGuidelinesOpen, setIsGuidelinesOpen] = useState(false);

  // Bộ lọc
  const [selectedCommune, setSelectedCommune] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Xã đang chọn cho biểu tổng hợp
  const [summaryCommuneCode, setSummaryCommuneCode] = useState<string>('11200');
  const [summaryCommuneName, setSummaryCommuneName] = useState<string>('Ân Thi');

  const [isLoadingFirestore, setIsLoadingFirestore] = useState(false);

  // Đọc dữ liệu từ Firebase Firestore khi khởi động (chỉ lấy dữ liệu thực)
  useEffect(() => {
    const fetchFirestoreData = async () => {
      setIsLoadingFirestore(true);
      try {
        // 1. Enterprises 01
        const entSnap = await getDocs(collection(db, 'enterprises_01'));
        if (!entSnap.empty) {
          const loadedEnts: EnterpriseSurvey01[] = entSnap.docs
            .map(d => ({ ...(d.data() as EnterpriseSurvey01), id: d.id }))
            .filter(d => !DEMO_IDS.includes(d.id));
          setEnterprises(loadedEnts);
          try { localStorage.setItem('cached_enterprises_01', JSON.stringify(loadedEnts)); } catch (e) {}

          entSnap.docs.forEach(async d => {
            if (DEMO_IDS.includes(d.id)) {
              await safeFirestoreWrite(() => deleteDoc(doc(db, 'enterprises_01', d.id)));
            }
          });
        } else {
          setEnterprises([]);
          localStorage.removeItem('cached_enterprises_01');
        }

        // 2. Establishments 02
        const estSnap = await getDocs(collection(db, 'establishments_02'));
        if (!estSnap.empty) {
          const loadedEsts: IndividualEstablishment02[] = estSnap.docs
            .map(d => ({ ...(d.data() as IndividualEstablishment02), id: d.id }))
            .filter(d => !DEMO_IDS.includes(d.id));
          setEstablishments(loadedEsts);
          try { localStorage.setItem('cached_establishments_02', JSON.stringify(loadedEsts)); } catch (e) {}

          estSnap.docs.forEach(async d => {
            if (DEMO_IDS.includes(d.id)) {
              await safeFirestoreWrite(() => deleteDoc(doc(db, 'establishments_02', d.id)));
            }
          });
        } else {
          setEstablishments([]);
          localStorage.removeItem('cached_establishments_02');
        }

        // 3. Summaries
        const sumSnap = await getDocs(collection(db, 'industrial_summaries'));
        if (!sumSnap.empty) {
          const loadedSums: IndustrialSummaryReport[] = sumSnap.docs.map(d => ({ ...(d.data() as IndustrialSummaryReport), id: d.id }));
          setSummaries(loadedSums);
          try { localStorage.setItem('cached_industrial_summaries', JSON.stringify(loadedSums)); } catch (e) {}
        }
      } catch (err: any) {
        console.warn('Lỗi đọc Firestore điều tra công nghiệp, sử dụng offline cache:', err);
      } finally {
        setIsLoadingFirestore(false);
      }
    };

    fetchFirestoreData();
  }, []);

  // LƯU DOANH NGHIỆP 01 (Firebase + Local)
  const handleSaveEnterprise = async (data: EnterpriseSurvey01) => {
    const updated = enterprises.some(e => e.id === data.id)
      ? enterprises.map(e => (e.id === data.id ? data : e))
      : [data, ...enterprises];

    setEnterprises(updated);
    try {
      localStorage.setItem('cached_enterprises_01', JSON.stringify(updated));
    } catch (e) {}

    try {
      await safeFirestoreWrite(() => setDoc(doc(db, 'enterprises_01', data.id), data));
      showNotify('success', `Đã lưu thành công Phiếu 01: [${data.enterpriseCode}] ${data.enterpriseName} lên Firebase!`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `Lưu DN ${data.enterpriseCode}`);
      showNotify('error', `Lỗi đồng bộ Firebase, đã lưu tại bộ nhớ máy.`);
    }
    setIsEnterpriseModalOpen(false);
  };

  // XÓA DOANH NGHIỆP 01
  const handleDeleteEnterprise = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Doanh nghiệp "${name}" không?`)) return;

    const filtered = enterprises.filter(e => e.id !== id);
    setEnterprises(filtered);
    try {
      localStorage.setItem('cached_enterprises_01', JSON.stringify(filtered));
    } catch (e) {}

    try {
      await safeFirestoreWrite(() => deleteDoc(doc(db, 'enterprises_01', id)));
      showNotify('success', `Đã xóa Doanh nghiệp "${name}" khỏi hệ thống.`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `Xóa DN ${id}`);
    }
  };

  // LƯU CƠ SỞ CÁ THỂ 02 (Firebase + Local)
  const handleSaveEstablishment = async (data: IndividualEstablishment02) => {
    const updated = establishments.some(cs => cs.id === data.id)
      ? establishments.map(cs => (cs.id === data.id ? data : cs))
      : [data, ...establishments];

    setEstablishments(updated);
    try {
      localStorage.setItem('cached_establishments_02', JSON.stringify(updated));
    } catch (e) {}

    try {
      await safeFirestoreWrite(() => setDoc(doc(db, 'establishments_02', data.id), data));
      showNotify('success', `Đã lưu thành công Phiếu 02: [${data.establishmentOrder || data.id}] ${data.establishmentName} lên Firebase!`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `Lưu Cơ sở ${data.establishmentOrder || data.id}`);
      showNotify('error', `Lỗi đồng bộ Firebase, đã lưu tại bộ nhớ máy.`);
    }
    setIsEstablishmentModalOpen(false);
  };

  // XÓA CƠ SỞ CÁ THỂ 02
  const handleDeleteEstablishment = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa Cơ sở cá thể "${name}" không?`)) return;

    const filtered = establishments.filter(cs => cs.id !== id);
    setEstablishments(filtered);
    try {
      localStorage.setItem('cached_establishments_02', JSON.stringify(filtered));
    } catch (e) {}

    try {
      await safeFirestoreWrite(() => deleteDoc(doc(db, 'establishments_02', id)));
      showNotify('success', `Đã xóa Cơ sở cá thể "${name}" khỏi hệ thống.`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `Xóa Cơ sở ${id}`);
    }
  };

  // LƯU BIỂU TỔNG HỢP 03/04 (Firebase + Local)
  const handleSaveSummary = async (report: IndustrialSummaryReport) => {
    const updated = summaries.some(s => s.id === report.id)
      ? summaries.map(s => (s.id === report.id ? report : s))
      : [report, ...summaries];

    setSummaries(updated);
    try {
      localStorage.setItem('cached_industrial_summaries', JSON.stringify(updated));
    } catch (e) {}

    try {
      await safeFirestoreWrite(() => setDoc(doc(db, 'industrial_summaries', report.id), report));
      showNotify('success', `Đã lưu ${report.reportTitle} của xã [${report.communeName}] lên Firebase!`);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `Lưu Biểu tổng hợp ${report.id}`);
    }
  };

  // XÓA TOÀN BỘ SỐ LIỆU ĐỂ BẮT ĐẦU NHẬP MỚI
  const handleClearAllData = async () => {
    const confirmed = window.confirm(
      'CẢNH BÁO: Thao tác này sẽ xóa toàn bộ số liệu Doanh nghiệp và Cơ sở cá thể để bắt đầu nhập dữ liệu mới từ đầu. Bạn có chắc chắn không?'
    );
    if (!confirmed) return;

    try {
      for (const ent of enterprises) {
        await safeFirestoreWrite(() => deleteDoc(doc(db, 'enterprises_01', ent.id)));
      }
      for (const cs of establishments) {
        await safeFirestoreWrite(() => deleteDoc(doc(db, 'establishments_02', cs.id)));
      }

      setEnterprises([]);
      setEstablishments([]);
      localStorage.removeItem('cached_enterprises_01');
      localStorage.removeItem('cached_establishments_02');

      showNotify('success', 'Đã xóa sạch số liệu, hệ thống sẵn sàng cho bạn nhập tin theo đúng công thức!');
    } catch (e) {
      showNotify('error', 'Lỗi khi xóa số liệu trên máy chủ.');
    }
  };

  // Thêm mới Phiếu 01
  const handleAddNewEnterprise = () => {
    const defaultCommune = selectedCommune !== 'ALL' 
      ? OFFICIAL_COMMUNES_CATALOG.find(c => c.communeCode === selectedCommune) 
      : OFFICIAL_COMMUNES_CATALOG[0];
    const newEnt = createDefaultEnterprise01(defaultCommune?.communeCode || '11200', defaultCommune?.communeName || 'Ân Thi');
    setSelectedEnterprise(newEnt);
    setIsEnterpriseModalOpen(true);
  };

  // Thêm mới Phiếu 02
  const handleAddNewEstablishment = () => {
    const defaultCommune = selectedCommune !== 'ALL' 
      ? OFFICIAL_COMMUNES_CATALOG.find(c => c.communeCode === selectedCommune) 
      : OFFICIAL_COMMUNES_CATALOG[0];
    const newEst = createDefaultEstablishment02(defaultCommune?.communeCode || '11200', defaultCommune?.communeName || 'Ân Thi');
    setSelectedEstablishment(newEst);
    setIsEstablishmentModalOpen(true);
  };

  // Lọc danh sách Doanh nghiệp
  const filteredEnterprises = useMemo(() => {
    return enterprises.filter(e => {
      if (selectedCommune !== 'ALL' && e.communeCode !== selectedCommune) return false;
      if (selectedStatus !== 'ALL' && e.surveyStatus !== selectedStatus) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = e.enterpriseName?.toLowerCase().includes(q);
        const matchCode = e.enterpriseCode?.toLowerCase().includes(q);
        const matchTax = e.taxCode?.toLowerCase().includes(q);
        const matchCommune = e.communeName?.toLowerCase().includes(q);
        return matchName || matchCode || matchTax || matchCommune;
      }
      return true;
    });
  }, [enterprises, selectedCommune, selectedStatus, searchTerm]);

  // Lọc danh sách Cơ sở cá thể
  const filteredEstablishments = useMemo(() => {
    return establishments.filter(cs => {
      if (selectedCommune !== 'ALL' && cs.communeCode !== selectedCommune) return false;
      if (selectedStatus !== 'ALL' && cs.surveyStatus !== selectedStatus) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchName = cs.establishmentName?.toLowerCase().includes(q);
        const matchOrder = cs.establishmentOrder?.toLowerCase().includes(q);
        const matchIndustry = cs.mainIndustryName?.toLowerCase().includes(q);
        const matchCommune = cs.communeName?.toLowerCase().includes(q);
        return matchName || matchOrder || matchIndustry || matchCommune;
      }
      return true;
    });
  }, [establishments, selectedCommune, selectedStatus, searchTerm]);

  // Thống kê nhanh
  const statsDN = useMemo(() => {
    const total = filteredEnterprises.length;
    const completed = filteredEnterprises.filter(e => e.surveyStatus === 'DA_HOAN_THANH' || e.surveyStatus === 'DA_DUYET').length;
    const totalRev = filteredEnterprises.reduce((sum, e) => sum + (Number(e.financialTotal?.estYear) || 0), 0);
    const totalLabor = filteredEnterprises.reduce((sum, e) => sum + (Number(e.laborDec31Expected) || 0), 0);
    return { total, completed, totalRev, totalLabor };
  }, [filteredEnterprises]);

  const statsCS = useMemo(() => {
    const total = filteredEstablishments.length;
    const completed = filteredEstablishments.filter(cs => cs.surveyStatus === 'DA_HOAN_THANH' || cs.surveyStatus === 'DA_DUYET').length;
    const totalRev = filteredEstablishments.reduce((sum, cs) => sum + (Number(cs.netRevenue?.estYear) || 0), 0);
    const totalLabor = filteredEstablishments.reduce((sum, cs) => sum + (Number(cs.laborDec31Expected) || 0), 0);
    return { total, completed, totalRev, totalLabor };
  }, [filteredEstablishments]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-800 antialiased">
      {/* Toast Notification */}
      {localNotification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-top duration-200 ${
          localNotification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
            : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {localNotification.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{localNotification.message}</span>
        </div>
      )}

      {/* DEDICATED HEADER FOR INDUSTRIAL SURVEY SOFTWARE */}
      <header className="sticky top-0 z-40 bg-linear-to-r from-blue-950 via-indigo-900 to-sky-950 text-white shadow-xl border-b border-indigo-950/60">
        <div className="px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Logo & Main Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-tr from-amber-400 to-amber-200 text-blue-950 flex items-center justify-center font-black text-xl shadow-lg ring-2 ring-white/30 shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-amber-400 text-blue-950 rounded text-[10px] font-black uppercase tracking-wider">
                  Trang Chuyên Dụng
                </span>
                <span className="text-xs text-blue-200 font-semibold">Tỉnh Hưng Yên</span>
              </div>
              <h1 className="text-sm md:text-base font-black uppercase tracking-tight text-white drop-shadow-sm">
                Phần Mềm Nhập Tin & Tổng Hợp Điều Tra Thống Kê Công Nghiệp
              </h1>
              <p className="text-[11px] text-sky-200">
                Phiếu 01/DN-CN (Doanh nghiệp), Phiếu 02/CT-CN (Cơ sở Cá thể) & Biểu tổng hợp GTSP 03, 04/TH-CN
              </p>
            </div>
          </div>

          {/* Quick Actions & User Switcher */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Nút quay lại phần mềm điều tra hộ dân cư */}
            {onSwitchToHousehold && (
              <button
                type="button"
                onClick={onSwitchToHousehold}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-lg border border-teal-400 shadow-md flex items-center gap-1.5 transition-all cursor-pointer hover:shadow-lg"
                title="Chuyển sang phần mềm Nhập tin Phiếu thu nhập Hộ dân cư"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>⇄ Sang Phần mềm Hộ Dân Cư</span>
              </button>
            )}

            {/* Sổ tay quy trình */}
            <button
              type="button"
              onClick={() => setIsGuidelinesOpen(true)}
              className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-blue-950 font-black rounded-lg shadow-md flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Quy trình nghiệp vụ</span>
            </button>

            {/* Thông tin Cán bộ */}
            {currentUser && (
              <div className="px-2.5 py-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 text-white flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="font-semibold text-xs">{currentUser.name || 'Cán bộ điều tra'}</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/40 rounded text-sky-200 font-mono">
                  {currentUser.role}
                </span>
              </div>
            )}

            {/* Đăng xuất */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 bg-rose-900/60 hover:bg-rose-800 text-rose-200 hover:text-white rounded-lg transition-colors cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* TOP WORKSPACE NAVIGATION BAR */}
        <nav className="px-4 bg-blue-900/90 border-t border-blue-800 flex items-center gap-2 overflow-x-auto text-xs py-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('DN_01')}
            className={`px-4 py-2 flex items-center gap-2 font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap border-b-2 ${
              activeSubTab === 'DN_01'
                ? 'bg-white text-blue-950 border-amber-400 shadow-md font-black'
                : 'text-blue-100 hover:bg-blue-800/80 border-transparent'
            }`}
          >
            <Building2 className={`w-4 h-4 ${activeSubTab === 'DN_01' ? 'text-blue-700' : 'text-blue-300'}`} />
            <span>1. Phiếu 01/DN-CN (Doanh nghiệp & HTX)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeSubTab === 'DN_01' ? 'bg-blue-100 text-blue-800' : 'bg-blue-950 text-blue-200'
            }`}>
              {enterprises.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('CS_02')}
            className={`px-4 py-2 flex items-center gap-2 font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap border-b-2 ${
              activeSubTab === 'CS_02'
                ? 'bg-white text-blue-950 border-amber-400 shadow-md font-black'
                : 'text-blue-100 hover:bg-blue-800/80 border-transparent'
            }`}
          >
            <Store className={`w-4 h-4 ${activeSubTab === 'CS_02' ? 'text-emerald-700' : 'text-emerald-300'}`} />
            <span>2. Phiếu 02/CT-CN (Cơ sở Cá thể)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
              activeSubTab === 'CS_02' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-950 text-blue-200'
            }`}>
              {establishments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('BIEU_TH')}
            className={`px-4 py-2 flex items-center gap-2 font-bold rounded-t-lg transition-all cursor-pointer whitespace-nowrap border-b-2 ${
              activeSubTab === 'BIEU_TH'
                ? 'bg-white text-blue-950 border-amber-400 shadow-md font-black'
                : 'text-blue-100 hover:bg-blue-800/80 border-transparent'
            }`}
          >
            <Layers className={`w-4 h-4 ${activeSubTab === 'BIEU_TH' ? 'text-purple-700' : 'text-purple-300'}`} />
            <span>3. Biểu 03 & 04/TH-CN (Tổng hợp GTSP Xã)</span>
          </button>
        </nav>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-5 flex flex-col gap-4">
        {/* NÚT THAO TÁC XÓA DỮ LIỆU ĐỂ BẮT ĐẦU NHẬP MỚI NẾU CÓ */}
        {(enterprises.length > 0 || establishments.length > 0) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-amber-900">
              <Database className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Hệ thống đang lưu trữ <strong>{enterprises.length}</strong> Doanh nghiệp và <strong>{establishments.length}</strong> Cơ sở cá thể. Số liệu lưu tự động trên Firebase Firestore và bộ nhớ máy.
              </span>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 rounded-lg font-bold flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-700" />
              <span>Xóa sạch số liệu để nhập mới</span>
            </button>
          </div>
        )}

        {/* TAB 1: PHIẾU 01/DN-CN (DOANH NGHIỆP) */}
        {activeSubTab === 'DN_01' && (
          <div className="flex flex-col gap-4">
            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Tổng Doanh nghiệp</span>
                <div className="text-xl font-black text-blue-950 mt-0.5">{statsDN.total.toLocaleString()} <span className="text-xs font-normal text-slate-500">DN</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Đã hoàn thành / duyệt</span>
                <div className="text-xl font-black text-emerald-700 mt-0.5">{statsDN.completed.toLocaleString()} <span className="text-xs font-normal text-slate-500">DN</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">DTT toàn bộ ước tính</span>
                <div className="text-xl font-black text-indigo-950 mt-0.5">{statsDN.totalRev.toLocaleString()} <span className="text-xs font-normal text-slate-500">Tr.đ</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Dự kiến số LĐ 31/12</span>
                <div className="text-xl font-black text-purple-950 mt-0.5">{statsDN.totalLabor.toLocaleString()} <span className="text-xs font-normal text-slate-500">người</span></div>
              </div>
            </div>

            {/* FILTER TOOLBAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                {/* Lọc theo xã */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">Lọc theo xã:</span>
                  <CommuneFilterSelect
                    selectedCode={selectedCommune}
                    allowAllOption={true}
                    allOptionLabel="Tất cả các xã/phường (104 xã)"
                    compact={true}
                    className="w-56"
                    placeholder="Lọc & chọn xã..."
                    onSelect={(code) => setSelectedCommune(code || 'ALL')}
                  />
                </div>

                {/* Lọc theo trạng thái */}
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">Trạng thái:</span>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="DA_HOAN_THANH">Đã hoàn thành</option>
                    <option value="DA_DUYET">Đã duyệt</option>
                    <option value="DANG_NHAP">Đang nhập</option>
                    <option value="CHUA_NHAP">Chưa nhập</option>
                  </select>
                </div>

                {/* Tìm kiếm */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm tên DN, MST, mã số..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 w-48 font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAllEnterprisesListToExcel(filteredEnterprises)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất Excel DS</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddNewEnterprise}
                  className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Doanh Nghiệp</span>
                </button>
              </div>
            </div>

            {/* ENTERPRISES TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã DN / MST</th>
                      <th className="py-2.5 px-3">Tên Doanh nghiệp</th>
                      <th className="py-2.5 px-3">Địa bàn Xã / Huyện</th>
                      <th className="py-2.5 px-3">Ngành SXKD chính</th>
                      <th className="py-2.5 px-3 text-right">Lao động 31/12</th>
                      <th className="py-2.5 px-3 text-right">Doanh thu cả năm (Tr.đ)</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      <th className="py-2.5 px-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEnterprises.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <Building2 className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">Chưa có dữ liệu Doanh nghiệp nào</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Nhấn &quot;Thêm Doanh Nghiệp&quot; để nhập tin mới theo đúng biểu mẫu Phiếu 01</p>
                        </td>
                      </tr>
                    ) : (
                      filteredEnterprises.map((ent, idx) => (
                        <tr key={ent.id} className="hover:bg-blue-50/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono">
                            <span className="font-bold text-blue-900 block">{ent.enterpriseCode}</span>
                            <span className="text-[10px] text-slate-400">{ent.taxCode || 'Chưa có MST'}</span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {ent.enterpriseName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="font-semibold text-slate-800 block">
                              [{ent.communeCode}] {ent.communeName}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block max-w-xs">{ent.address}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {ent.mainIndustryName || 'Chưa nhập'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-950">
                            {(Number(ent.laborDec31Expected) || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950">
                            {(Number(ent.financialTotal?.estYear) || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ent.surveyStatus === 'DA_HOAN_THANH'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ent.surveyStatus === 'DA_DUYET'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {ent.surveyStatus === 'DA_HOAN_THANH' ? 'Hoàn thành' : ent.surveyStatus === 'DA_DUYET' ? 'Đã duyệt' : 'Đang nhập'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEnterprise(ent);
                                  setIsEnterpriseModalOpen(true);
                                }}
                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded cursor-pointer"
                                title="Mở chi tiết phiếu 01"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => exportEnterprise01ToExcel(ent)}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded cursor-pointer"
                                title="Xuất phiếu ra Excel"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEnterprise(ent.id, ent.enterpriseName)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                title="Xóa doanh nghiệp"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PHIẾU 02/CT-CN (CƠ SỞ CÁ THỂ) */}
        {activeSubTab === 'CS_02' && (
          <div className="flex flex-col gap-4">
            {/* KPI STATS CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Tổng Cơ sở cá thể</span>
                <div className="text-xl font-black text-emerald-950 mt-0.5">{statsCS.total.toLocaleString()} <span className="text-xs font-normal text-slate-500">cơ sở</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Đã hoàn thành / duyệt</span>
                <div className="text-xl font-black text-emerald-700 mt-0.5">{statsCS.completed.toLocaleString()} <span className="text-xs font-normal text-slate-500">cơ sở</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">DTT SXCN ước cả năm</span>
                <div className="text-xl font-black text-indigo-950 mt-0.5">{statsCS.totalRev.toLocaleString()} <span className="text-xs font-normal text-slate-500">Tr.đ</span></div>
              </div>
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase block">Dự kiến số LĐ 31/12</span>
                <div className="text-xl font-black text-purple-950 mt-0.5">{statsCS.totalLabor.toLocaleString()} <span className="text-xs font-normal text-slate-500">người</span></div>
              </div>
            </div>

            {/* FILTER TOOLBAR */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">Lọc theo xã:</span>
                  <CommuneFilterSelect
                    selectedCode={selectedCommune}
                    allowAllOption={true}
                    allOptionLabel="Tất cả các xã/phường (104 xã)"
                    compact={true}
                    className="w-56"
                    placeholder="Lọc & chọn xã..."
                    onSelect={(code) => setSelectedCommune(code || 'ALL')}
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-700">Trạng thái:</span>
                  <select
                    value={selectedStatus}
                    onChange={e => setSelectedStatus(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-800"
                  >
                    <option value="ALL">Tất cả trạng thái</option>
                    <option value="DA_HOAN_THANH">Đã hoàn thành</option>
                    <option value="DA_DUYET">Đã duyệt</option>
                    <option value="DANG_NHAP">Đang nhập</option>
                    <option value="CHUA_NHAP">Chưa nhập</option>
                  </select>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Tìm tên cơ sở, chủ hộ, mã..."
                    className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 w-48 font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => exportAllEstablishmentsListToExcel(filteredEstablishments)}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Xuất Excel DS</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddNewEstablishment}
                  className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm Cơ Sở Cá Thể</span>
                </button>
              </div>
            </div>

            {/* ESTABLISHMENTS TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã cơ sở</th>
                      <th className="py-2.5 px-3">Tên cơ sở / Chủ hộ</th>
                      <th className="py-2.5 px-3">Địa bàn Xã / Phường</th>
                      <th className="py-2.5 px-3">Sản phẩm SX chính</th>
                      <th className="py-2.5 px-3 text-right">Lao động 31/12</th>
                      <th className="py-2.5 px-3 text-right">DTT cả năm (Tr.đ)</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái</th>
                      <th className="py-2.5 px-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEstablishments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-slate-400">
                          <Store className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">Chưa có dữ liệu Cơ sở cá thể nào</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">Nhấn &quot;Thêm Cơ Sở Cá Thể&quot; để nhập tin mới theo đúng biểu mẫu Phiếu 02</p>
                        </td>
                      </tr>
                    ) : (
                      filteredEstablishments.map((cs, idx) => (
                        <tr key={cs.id} className="hover:bg-emerald-50/40 transition-colors">
                          <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-emerald-900">
                            {cs.establishmentOrder}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-slate-800 block">{cs.establishmentName}</span>
                            <span className="text-[11px] text-slate-500 font-mono">Mã ngành: {cs.mainIndustryCode || 'Chưa có'}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            <span className="font-semibold text-slate-800 block">
                              [{cs.communeCode}] {cs.communeName}
                            </span>
                            <span className="text-[10px] text-slate-400 truncate block max-w-xs">{cs.address}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate">
                            {cs.mainIndustryName || 'Chưa nhập'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-purple-950">
                            {(Number(cs.laborDec31Expected) || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950">
                            {(Number(cs.netRevenue?.estYear) || 0).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              cs.surveyStatus === 'DA_HOAN_THANH'
                                ? 'bg-emerald-100 text-emerald-800'
                                : cs.surveyStatus === 'DA_DUYET'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {cs.surveyStatus === 'DA_HOAN_THANH' ? 'Hoàn thành' : cs.surveyStatus === 'DA_DUYET' ? 'Đã duyệt' : 'Đang nhập'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEstablishment(cs);
                                  setIsEstablishmentModalOpen(true);
                                }}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded cursor-pointer"
                                title="Mở chi tiết phiếu 02"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => exportEstablishment02ToExcel(cs)}
                                className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-100 rounded cursor-pointer"
                                title="Xuất phiếu ra Excel"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteEstablishment(cs.id, cs.establishmentName)}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded cursor-pointer"
                                title="Xóa cơ sở"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BIỂU TỔNG HỢP 03 VÀ 04/TH-CN */}
        {activeSubTab === 'BIEU_TH' && (
          <IndustrialSummaryView
            communeCode={summaryCommuneCode}
            communeName={summaryCommuneName}
            enterprises={enterprises}
            establishments={establishments}
            savedSummaries={summaries}
            onSaveSummary={handleSaveSummary}
            onCommuneChange={(code, name) => {
              setSummaryCommuneCode(code);
              setSummaryCommuneName(name);
            }}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-3 px-4 text-center text-xs text-slate-500">
        <p className="font-semibold text-slate-700">
          HỆ THỐNG ĐIỀU TRA & TỔNG HỢP CÔNG NGHIỆP TỈNH HƯNG YÊN - THEO CÔNG VĂN SỐ 12/UBND & PHƯƠNG ÁN ĐIỀU TRA NĂM 2026
        </p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          Dữ liệu lưu trữ độc lập trên Firebase Firestore và bộ nhớ máy • Tích hợp công thức tính toán tự động
        </p>
      </footer>

      {/* MODAL CHI TIẾT PHIẾU 01 (DOANH NGHIỆP) */}
      <Enterprise01Modal
        isOpen={isEnterpriseModalOpen}
        onClose={() => setIsEnterpriseModalOpen(false)}
        enterprise={selectedEnterprise}
        onSave={handleSaveEnterprise}
        currentUser={currentUser}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
      />

      {/* MODAL CHI TIẾT PHIẾU 02 (CƠ SỞ CÁ THỂ) */}
      <Establishment02Modal
        isOpen={isEstablishmentModalOpen}
        onClose={() => setIsEstablishmentModalOpen(false)}
        establishment={selectedEstablishment}
        onSave={handleSaveEstablishment}
        currentUser={currentUser}
        onOpenGuidelines={() => setIsGuidelinesOpen(true)}
      />

      {/* MODAL HƯỚNG DẪN QUY TRÌNH NGHIỆP VỤ */}
      <IndustrialGuidelinesModal
        isOpen={isGuidelinesOpen}
        onClose={() => setIsGuidelinesOpen(false)}
      />
    </div>
  );
}
