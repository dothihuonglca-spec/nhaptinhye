/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Save, X, Plus, Trash2, BookOpen, Check, Calculator, ChevronRight, 
  Printer, Lock, Unlock, ShieldAlert, CheckCircle2, UserCheck, AlertTriangle, RotateCcw 
} from 'lucide-react';
import { FullQuestionnaire, ProductionRow, NonAgriRow, SalaryRow } from '../types/questionnaire';
import { calculateFullIncome, calcProductionRowIncome, calcNonAgriRowIncome } from '../utils/incomeCalculator';
import CatalogModal, { CatalogSectionType } from './CatalogModal';
import { CatalogItem } from '../constants/catalogs';
import { Surveyor, SurveyStatus, SURVEY_STATUS_LABELS } from '../types/user';

interface QuestionnaireModalProps {
  household: any;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedData: any) => void;
  currentUser?: Surveyor | null;
  allSurveyors?: Surveyor[];
}

export default function QuestionnaireModal({ 
  household, 
  isOpen, 
  onClose, 
  onSave,
  currentUser,
  allSurveyors = []
}: QuestionnaireModalProps) {
  // Xóa trắng Tổng số nhân khẩu & Số người làm việc để người dùng bắt buộc tự gõ
  // CHỈ giữ lại số nếu người dùng đã thực sự tự gõ và bấm lưu trước đó (membersCountEntered === true)
  const isUserManuallyEntered = Boolean((household as any)?.membersCountEntered);
  const [form, setForm] = useState<any>(() => ({
    ...(household || {}),
    membersCount: isUserManuallyEntered && household?.membersCount && Number(household.membersCount) > 0 ? household.membersCount : '',
    workingMembersCount: isUserManuallyEntered && household?.workingMembersCount !== undefined && household?.workingMembersCount !== null && household?.workingMembersCount !== '' ? household.workingMembersCount : ''
  }));
  const [validationWarning, setValidationWarning] = useState<string | null>(null);
  const [validationAlertModal, setValidationAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    field: 'membersCount' | 'workingMembersCount';
  } | null>(null);

  // Tự động đồng bộ lại form khi chuyển sang hộ khác hoặc mở phiếu mới
  useEffect(() => {
    if (household) {
      const isManual = Boolean((household as any)?.membersCountEntered);
      setForm({
        ...household,
        membersCount: isManual && household.membersCount && Number(household.membersCount) > 0 ? household.membersCount : '',
        workingMembersCount: isManual && household.workingMembersCount !== undefined && household.workingMembersCount !== null && household.workingMembersCount !== '' ? household.workingMembersCount : ''
      });
      setValidationWarning(null);
      setValidationAlertModal(null);
    }
  }, [household?.id]);

  const [activeTab, setActiveTab] = useState<'muc1' | 'muc2' | 'muc3' | 'muc4' | 'muc5' | 'muc6' | 'muc7' | 'tonghop'>('muc1');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [catalogSection, setCatalogSection] = useState<CatalogSectionType>('muc2');

  // Đảm bảo không render modal khi chưa mở hoặc chưa chọn hộ (đặt sau toàn bộ hooks)
  if (!isOpen || !household) return null;

  const defaultSurveyorName = form.assignedSurveyorName || (currentUser?.role === 'SURVEYOR' ? currentUser.name : '');

  const q: FullQuestionnaire = form.questionnaire || {
    muc1_has: false,
    muc1_rows: form.householdHead ? [{ id: '1', name: form.householdHead, job: '', col1_luong: 0, col2_troCap: 0 }] : [],
    muc2_has: false, muc2_cayTrongRows: [], muc2_giong: { col1: 0, col2: 0, col4: 0, col5: 0, col6: 0 }, muc2_sanPhamPhu: { col1: 0, col2: 0, col6: 0 }, muc2_dichVu: { col3: 0, col6: 0 }, muc2_denBu: 0,
    muc3_has: false, muc3_giaSucRows: [], muc3_giaCamRows: [], muc3_khacRows: [], muc3_khongGietMoRows: [], muc3_giongRows: [], muc3_sanPhamPhu: { col1: 0, col2: 0, col6: 0 }, muc3_dichVu: { col3: 0, col6: 0 }, muc3_sanBat: { col3: 0, col6: 0 }, muc3_denBu: 0,
    muc4_has: false, muc4_khaiThacRows: [], muc4_uomGiong: { col1: 0, col2: 0, col4: 0, col5: 0, col6: 0 }, muc4_trongRung: { col1: 0, col2: 0, col4: 0, col5: 0, col6: 0 }, muc4_dichVu: { col3: 0, col6: 0 }, muc4_denBu: 0,
    muc5_has: false, muc5_nuoiTrongRows: [], muc5_danhBatRows: [], muc5_sanXuatGiongRows: [], muc5_denBu: 0,
    muc6_has: false, muc6_rows: [],
    muc7_has: false, muc7_1_1: 0, muc7_1_2: 0, muc7_1_3: 0, muc7_2_1: 0, muc7_2_2: 0, muc7_3: 0,
    surveyorDate: new Date().toLocaleDateString('vi-VN'), 
    surveyorName: defaultSurveyorName
  };

  const currentStatus: SurveyStatus = form.surveyStatus || 'CHUA_NHAP';
  const isApproved = currentStatus === 'DA_DUYET';
  const isAdmin = currentUser?.role === 'ADMIN';
  const isLocked = isApproved && !isAdmin;

  const updateQ = (updater: (prev: FullQuestionnaire) => FullQuestionnaire) => {
    if (isLocked) return;
    const nextQ = updater({ ...q });
    setForm({ ...form, questionnaire: nextQ });
  };

  const scrollToAndFocus = (fieldId: string) => {
    setTimeout(() => {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }, 150);
  };

  const handleSaveWithStatus = (newStatus?: SurveyStatus) => {
    if (isLocked) return;

    // 1. Kiểm tra Tổng số nhân khẩu: Bắt buộc người dùng phải tự gõ số nguyên > 0
    const rawMem = form.membersCount;
    if (rawMem === '' || rawMem === null || rawMem === undefined || isNaN(Number(rawMem)) || Number(rawMem) <= 0) {
      const msg = 'Vui lòng nhập Tổng số nhân khẩu của hộ (lớn hơn 0)';
      setValidationWarning(msg);
      setValidationAlertModal({
        isOpen: true,
        title: 'Chưa nhập Tổng số nhân khẩu',
        message: 'Vui lòng nhập "Tổng số nhân khẩu" thực tế của hộ (lớn hơn 0) trước khi bấm Lưu và hoàn thành.',
        field: 'membersCount'
      });
      scrollToAndFocus('input-members-count');
      return;
    }

    // 2. Kiểm tra Số người làm việc: Bắt buộc người dùng phải tự gõ số nguyên >= 0
    const rawWork = form.workingMembersCount;
    if (rawWork === '' || rawWork === null || rawWork === undefined || isNaN(Number(rawWork)) || Number(rawWork) < 0) {
      const msg = 'Vui lòng nhập Số người làm việc của hộ (từ 0 trở lên)';
      setValidationWarning(msg);
      setValidationAlertModal({
        isOpen: true,
        title: 'Chưa nhập Số người làm việc',
        message: 'Vui lòng nhập "Số người làm việc" thực tế của hộ (từ 0 trở lên) trước khi bấm Lưu và hoàn thành.',
        field: 'workingMembersCount'
      });
      scrollToAndFocus('input-working-members-count');
      return;
    }

    const memVal = Math.round(Number(rawMem));
    const workVal = Math.round(Number(rawWork));

    // 3. Kiểm tra logic: Số người làm việc không được vượt quá Tổng số nhân khẩu
    if (workVal > memVal) {
      const msg = `Số người làm việc (${workVal}) không được lớn hơn Tổng số nhân khẩu (${memVal})`;
      setValidationWarning(msg);
      setValidationAlertModal({
        isOpen: true,
        title: 'Cảnh báo số người làm việc',
        message: `Số người làm việc (${workVal} người) không được lớn hơn Tổng số nhân khẩu (${memVal} người). Vui lòng kiểm tra lại trước khi lưu.`,
        field: 'workingMembersCount'
      });
      scrollToAndFocus('input-working-members-count');
      return;
    }

    // Xóa cảnh báo nếu tất cả hợp lệ
    setValidationWarning(null);
    setValidationAlertModal(null);

    const finalStatus = newStatus || form.surveyStatus || 'DANG_NHAP';
    const assignedSurveyor = allSurveyors.find(s => s.id === form.assignedSurveyorId);

    const payload = {
      ...form,
      membersCount: memVal,
      workingMembersCount: workVal,
      membersCountEntered: true,
      surveyStatus: finalStatus,
      assignedSurveyorName: assignedSurveyor ? assignedSurveyor.name : form.assignedSurveyorName,
      updatedBy: currentUser?.name || 'Hệ thống',
      updatedAt: new Date().toISOString(),
      questionnaire: {
        ...q,
        surveyorName: q.surveyorName || form.assignedSurveyorName || currentUser?.name || ''
      }
    };
    onSave(payload);
  };

  const income = calculateFullIncome(q);

  const openCatalogFor = (sec: CatalogSectionType) => {
    setCatalogSection(sec);
    setIsCatalogOpen(true);
  };

  const handleSelectFromCatalog = (item: CatalogItem, section: CatalogSectionType) => {
    if (section === 'muc1') {
      updateQ(prev => {
        const rows = [...(prev.muc1_rows || [])];
        if (rows.length > 0) {
          rows[rows.length - 1].job = item.name;
        } else {
          rows.push({ id: String(Date.now()), name: '', job: item.name, col1_luong: 0, col2_troCap: 0 });
        }
        return { ...prev, muc1_rows: rows };
      });
      return;
    }

    if (section === 'muc6') {
      const newNonAgriRow: NonAgriRow = {
        id: String(Date.now()),
        name: item.name,
        col1_ban: 0,
        col2_tuDung: 0,
        col4_nguyenLieu: 0,
        col5_nangLuong: 0,
        col6_chiKhac: 0
      };
      updateQ(prev => ({
        ...prev,
        muc6_has: true,
        muc6_rows: [...(prev.muc6_rows || []), newNonAgriRow]
      }));
      return;
    }

    const newRow: ProductionRow = {
      id: String(Date.now()),
      name: item.name,
      catalogId: item.id,
      col1_ban: 0,
      col2_tuDung: 0,
      col4_giong: 0,
      col5_vatTu: 0,
      col6_chiKhac: 0
    };

    updateQ(prev => {
      if (section === 'muc2') {
        return { ...prev, muc2_has: true, muc2_cayTrongRows: [...(prev.muc2_cayTrongRows || []), newRow] };
      }
      if (section === 'muc3') {
        const cat = item.category.toLowerCase();
        if (cat.includes('gia cầm')) {
          return { ...prev, muc3_has: true, muc3_giaCamRows: [...(prev.muc3_giaCamRows || []), newRow] };
        } else if (cat.includes('giết mổ')) {
          return { ...prev, muc3_has: true, muc3_khongGietMoRows: [...(prev.muc3_khongGietMoRows || []), newRow] };
        } else if (cat.includes('giống')) {
          return { ...prev, muc3_has: true, muc3_giongRows: [...(prev.muc3_giongRows || []), newRow] };
        } else if (cat.includes('khác')) {
          return { ...prev, muc3_has: true, muc3_khacRows: [...(prev.muc3_khacRows || []), newRow] };
        } else {
          return { ...prev, muc3_has: true, muc3_giaSucRows: [...(prev.muc3_giaSucRows || []), newRow] };
        }
      }
      if (section === 'muc4') {
        return { ...prev, muc4_has: true, muc4_khaiThacRows: [...(prev.muc4_khaiThacRows || []), newRow] };
      }
      if (section === 'muc5') {
        if (item.category.includes('Đánh bắt')) {
          return { ...prev, muc5_has: true, muc5_danhBatRows: [...(prev.muc5_danhBatRows || []), newRow] };
        } else if (item.category.includes('giống')) {
          return { ...prev, muc5_has: true, muc5_sanXuatGiongRows: [...(prev.muc5_sanXuatGiongRows || []), newRow] };
        } else {
          return { ...prev, muc5_has: true, muc5_nuoiTrongRows: [...(prev.muc5_nuoiTrongRows || []), newRow] };
        }
      }
      return prev;
    });
  };

  const renderProductionTable = (
    title: string,
    rows: ProductionRow[],
    onUpdateRows: (newRows: ProductionRow[]) => void,
    sectionType: 'muc2' | 'muc3' | 'muc4' | 'muc5'
  ) => (
    <div className="flex flex-col gap-2 border border-slate-300 rounded p-3 bg-white">
      <div className="flex items-center justify-between">
        <h5 className="font-bold text-slate-800 text-xs uppercase">{title}</h5>
        <div className="flex items-center gap-1.5">
          <button 
            type="button"
            onClick={() => openCatalogFor(sectionType)}
            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <BookOpen className="w-3.5 h-3.5" /> Tra cứu danh mục
          </button>
          <button 
            type="button"
            onClick={() => {
              onUpdateRows([...rows, {
                id: String(Date.now()),
                name: '',
                col1_ban: 0,
                col2_tuDung: 0,
                col4_giong: 0,
                col5_vatTu: 0,
                col6_chiKhac: 0
              }]);
            }}
            className="px-2.5 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm dòng
          </button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-300 rounded">
        <table className="w-full border-collapse text-xs whitespace-nowrap">
          <thead>
            <tr className="bg-sky-800 text-white text-center font-bold">
              <th rowSpan={2} className="border border-sky-900 p-1 w-10">STT</th>
              <th rowSpan={2} className="border border-sky-900 p-1 text-left min-w-[160px]">Tên nguồn thu / Sản phẩm</th>
              <th colSpan={3} className="border border-sky-900 p-1 bg-sky-700">Tổng thu (1000đ)</th>
              <th colSpan={4} className="border border-sky-900 p-1 bg-sky-900">Chi phí (1000đ)</th>
              <th rowSpan={2} className="border border-sky-900 p-1 bg-emerald-800 w-28 text-right">Thu nhập (1000đ)</th>
              <th rowSpan={2} className="border border-sky-900 p-1 w-10">Xóa</th>
            </tr>
            <tr className="bg-sky-800 text-white text-center font-semibold text-[11px]">
              <th className="border border-sky-900 p-1 w-24">1. Bán ra</th>
              <th className="border border-sky-900 p-1 w-24">2. Để lại dùng</th>
              <th className="border border-sky-900 p-1 w-24 bg-sky-600 font-bold">3=1+2</th>
              <th className="border border-sky-900 p-1 w-24">4. Giống</th>
              <th className="border border-sky-900 p-1 w-24">5. Vật tư/T.ăn</th>
              <th className="border border-sky-900 p-1 w-24">6. Chi khác</th>
              <th className="border border-sky-900 p-1 w-24 bg-sky-950 font-bold">7=4+5+6</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const col3 = (Number(r.col1_ban) || 0) + (Number(r.col2_tuDung) || 0);
              const col7 = (Number(r.col4_giong) || 0) + (Number(r.col5_vatTu) || 0) + (Number(r.col6_chiKhac) || 0);
              const col8 = Math.max(0, col3 - col7);
              return (
                <tr key={r.id} className="hover:bg-sky-50">
                  <td className="border border-slate-300 p-1 text-center font-bold bg-slate-50">{idx + 1}</td>
                  <td className="border border-slate-300 p-1">
                    <input 
                      type="text" 
                      value={r.name} 
                      placeholder="Chọn từ danh mục hoặc nhập..."
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const next = [...rows];
                        next[idx].name = e.target.value;
                        onUpdateRows(next);
                      }}
                      className="w-full p-1 bg-sky-50/50 border border-slate-200 rounded font-medium" 
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input 
                      type="number" 
                      value={r.col1_ban === 0 ? '' : r.col1_ban} 
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const next = [...rows];
                        next[idx].col1_ban = e.target.value === '' ? 0 : Number(e.target.value);
                        onUpdateRows(next);
                      }}
                      className="w-full p-1 border rounded text-right font-medium" 
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input 
                      type="number" 
                      value={r.col2_tuDung === 0 ? '' : r.col2_tuDung} 
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const next = [...rows];
                        next[idx].col2_tuDung = e.target.value === '' ? 0 : Number(e.target.value);
                        onUpdateRows(next);
                      }}
                      className="w-full p-1 border rounded text-right font-medium" 
                    />
                  </td>
                  <td className="border border-slate-300 p-1 text-right font-bold text-sky-900 bg-sky-50">{col3.toLocaleString()}</td>
                  <td className="border border-slate-300 p-1">
                    <input 
                      type="number" 
                      value={r.col4_giong === 0 ? '' : r.col4_giong} 
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const next = [...rows];
                        next[idx].col4_giong = e.target.value === '' ? 0 : Number(e.target.value);
                        onUpdateRows(next);
                      }}
                      className="w-full p-1 border rounded text-right font-medium" 
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input 
                      type="number" 
                      value={r.col5_vatTu === 0 ? '' : r.col5_vatTu} 
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const next = [...rows];
                        next[idx].col5_vatTu = e.target.value === '' ? 0 : Number(e.target.value);
                        onUpdateRows(next);
                      }}
                      className="w-full p-1 border rounded text-right font-medium" 
                    />
                  </td>
                  <td className="border border-slate-300 p-1">
                    <input 
                      type="number" 
                      value={r.col6_chiKhac === 0 ? '' : r.col6_chiKhac} 
                      onFocus={e => e.target.select()}
                      onChange={e => {
                        const next = [...rows];
                        next[idx].col6_chiKhac = e.target.value === '' ? 0 : Number(e.target.value);
                        onUpdateRows(next);
                      }}
                      className="w-full p-1 border rounded text-right font-medium" 
                    />
                  </td>
                  <td className="border border-slate-300 p-1 text-right font-bold text-slate-800 bg-slate-100">{col7.toLocaleString()}</td>
                  <td className="border border-slate-300 p-1 text-right font-black text-emerald-800 bg-emerald-50">{col8.toLocaleString()}</td>
                  <td className="border border-slate-300 p-1 text-center">
                    <button 
                      type="button" 
                      onClick={() => onUpdateRows(rows.filter((_, i) => i !== idx))}
                      className="text-rose-600 hover:text-rose-800"
                    >
                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-4 text-slate-400 italic">
                  Chưa có dòng nào. Bấm "Tra cứu danh mục" hoặc "Thêm dòng" để nhập sản phẩm.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const handleKeyDownNavigation = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.target instanceof HTMLElement) {
      const tagName = e.target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'select' || tagName === 'textarea') {
        e.preventDefault();

        const container = e.currentTarget;
        const allInputs = Array.from(
          container.querySelectorAll<HTMLElement>(
            'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
          )
        ).filter(el => el.offsetWidth > 0 && el.offsetHeight > 0);

        const currentIndex = allInputs.indexOf(e.target);
        if (currentIndex >= 0 && currentIndex < allInputs.length - 1) {
          const nextElem = allInputs[currentIndex + 1];
          nextElem.focus();
          if (nextElem instanceof HTMLInputElement) {
            nextElem.select();
          }
        }
      }
    }
  };

  return (
    <div 
      onKeyDown={handleKeyDownNavigation}
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-1 md:p-3 overflow-hidden"
    >
      <div className="bg-white rounded-lg border border-slate-300 shadow-2xl w-full max-w-[98vw] flex flex-col h-[96vh] max-h-[96vh] overflow-hidden text-xs">
        
        {/* Top Header */}
        <div className="bg-sky-800 text-white p-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[11px] font-semibold text-sky-200 uppercase tracking-wide">Phụ lục II: Phiếu thu thập thông tin về thu nhập của hộ dân cư</span>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base">{form.householdHead} - Hộ {form.sttMau} - ĐB: {form.areaCode} {form.areaName}</h3>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${
                  isApproved 
                    ? 'bg-purple-100 text-purple-900 border-purple-300' 
                    : form.surveyStatus === 'DA_HOAN_THANH'
                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                    : form.surveyStatus === 'DANG_NHAP'
                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                    : 'bg-slate-100 text-slate-800 border-slate-300'
                }`}>
                  {isApproved ? <Lock className="w-3 h-3" /> : form.surveyStatus === 'DA_HOAN_THANH' ? <CheckCircle2 className="w-3 h-3" /> : null}
                  <span>{SURVEY_STATUS_LABELS[currentStatus]?.label || 'Chưa nhập'}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs text-white"
            >
              <Printer className="w-4 h-4" />
              <span>In Phiếu</span>
            </button>
            <button 
              type="button"
              onClick={() => openCatalogFor('muc2')}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs text-white"
            >
              <BookOpen className="w-4 h-4" />
              <span>Sổ tay Danh mục</span>
            </button>
            {!isLocked && (
              <button 
                type="button"
                onClick={() => handleSaveWithStatus('DANG_NHAP')}
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs text-white"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Phiếu Hộ</span>
              </button>
            )}
            <button 
              type="button"
              onClick={onClose}
              className="p-1 hover:bg-sky-700 rounded cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lock Warning Banner */}
        {isLocked && (
          <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-xs font-bold shadow-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Phiếu này đã được Tổ trưởng / Quản trị viên duyệt và khóa. Bạn đang ở chế độ xem an toàn.</span>
            </div>
            <span className="text-[11px] bg-amber-700/60 px-2 py-0.5 rounded">Cần quyền Admin để mở khóa</span>
          </div>
        )}

        {/* Validation Warning Alert Banner (Hiện khi người dùng chưa nhập nhân khẩu/người làm việc) */}
        {validationWarning && (
          <div className="bg-rose-600 text-white px-4 py-2.5 flex items-center justify-between text-xs font-bold shadow-md animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 text-amber-200 animate-bounce" />
              <span>{validationWarning}</span>
            </div>
            <button
              type="button"
              onClick={() => setValidationWarning(null)}
              className="text-white hover:text-rose-200 p-1 font-bold cursor-pointer rounded hover:bg-rose-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* General Info bar (Page 1 header) */}
        <div className="bg-sky-50 px-4 py-2.5 border-b border-sky-200 grid grid-cols-2 md:grid-cols-7 gap-2.5 text-slate-800 items-end">
          <div>
            <span className="text-[10px] text-slate-500 block">Xã/phường:</span>
            <strong className="truncate block font-bold">[{form.communeCode || '01'}] {form.communeName || 'Xã'}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Địa bàn:</span>
            <strong className="truncate block font-bold">ĐB {form.areaCode} - {form.areaName}</strong>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Địa chỉ hộ:</span>
            <input 
              type="text" 
              disabled={isLocked}
              value={form.address || ''} 
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-medium disabled:bg-slate-100"
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Số điện thoại:</span>
            <input 
              type="text" 
              disabled={isLocked}
              value={form.phone || ''} 
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="0912345678"
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-medium disabled:bg-slate-100"
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-700 block font-bold flex items-center gap-1" title="Bắt buộc: Nhập tổng số nhân khẩu thực tế của hộ">
                <span>Nhập tổng số nhân khẩu:</span>
                <span className="text-rose-600 font-black">*</span>
              </span>
              {(!form.membersCount || Number(form.membersCount) <= 0) && (
                <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1 rounded animate-pulse">
                  Chưa nhập
                </span>
              )}
            </div>
            <input 
              id="input-members-count"
              type="number" 
              disabled={isLocked}
              value={form.membersCount !== undefined && form.membersCount !== null ? form.membersCount : ''} 
              onChange={e => {
                const val = e.target.value;
                setForm((prev: any) => ({ ...prev, membersCount: val === '' ? '' : parseInt(val, 10) }));
                if (validationWarning) setValidationWarning(null);
              }}
              min="1"
              placeholder="Nhập tổng số nhân khẩu..."
              className={`w-full bg-white border rounded px-1.5 py-0.5 text-xs font-bold text-center disabled:bg-slate-100 text-sky-950 focus:outline-none transition-all ${
                (!form.membersCount || Number(form.membersCount) <= 0)
                  ? 'border-rose-500 ring-2 ring-rose-300 bg-rose-50/60 placeholder:text-rose-400'
                  : 'border-slate-300 focus:border-sky-600'
              }`}
            />
          </div>
          <div className="relative">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-slate-700 block font-bold flex items-center gap-1" title="Bắt buộc: Nhập số người làm việc thực tế của hộ (tối thiểu 0)">
                <span>Nhập số người làm việc:</span>
                <span className="text-rose-600 font-black">*</span>
              </span>
              {(form.workingMembersCount === '' || form.workingMembersCount === null || form.workingMembersCount === undefined) && (
                <span className="text-[9px] bg-rose-100 text-rose-700 font-bold px-1 rounded animate-pulse">
                  Chưa nhập
                </span>
              )}
            </div>
            <input 
              id="input-working-members-count"
              type="number" 
              disabled={isLocked}
              value={form.workingMembersCount !== undefined && form.workingMembersCount !== null ? form.workingMembersCount : ''} 
              onChange={e => {
                const val = e.target.value;
                setForm((prev: any) => ({ ...prev, workingMembersCount: val === '' ? '' : parseInt(val, 10) }));
                if (validationWarning) setValidationWarning(null);
              }}
              min="0"
              placeholder="Nhập số người làm việc..."
              className={`w-full bg-white border rounded px-1.5 py-0.5 text-xs font-bold text-center disabled:bg-slate-100 text-sky-950 focus:outline-none transition-all ${
                (form.workingMembersCount === '' || form.workingMembersCount === null || form.workingMembersCount === undefined)
                  ? 'border-rose-500 ring-2 ring-rose-300 bg-rose-50/60 placeholder:text-rose-400'
                  : 'border-slate-300 focus:border-sky-600'
              }`}
            />
          </div>
          <div>
            <span className="text-[10px] text-slate-500 block">Người nhập / ĐTV:</span>
            <select
              disabled={isLocked}
              value={form.assignedSurveyorId || ''}
              onChange={e => {
                const s = allSurveyors.find(item => item.id === e.target.value);
                setForm({
                  ...form,
                  assignedSurveyorId: e.target.value,
                  assignedSurveyorName: s ? s.name : ''
                });
                if (s && !q.surveyorName) {
                  updateQ(prev => ({ ...prev, surveyorName: s.name }));
                }
              }}
              className="w-full bg-white border border-slate-300 rounded px-1.5 py-1 text-xs font-bold text-sky-950 disabled:bg-slate-100"
            >
              <option value="">-- Chưa phân công --</option>
              {allSurveyors.map(s => (
                <option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-300 px-3 flex items-center gap-1 overflow-x-auto font-bold text-[11px]">
          <button 
            onClick={() => setActiveTab('muc1')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc1' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 1: Lương, công
          </button>
          <button 
            onClick={() => setActiveTab('muc2')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc2' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 2: Trồng trọt
          </button>
          <button 
            onClick={() => setActiveTab('muc3')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc3' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 3: Chăn nuôi
          </button>
          <button 
            onClick={() => setActiveTab('muc4')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc4' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 4: Lâm nghiệp
          </button>
          <button 
            onClick={() => setActiveTab('muc5')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc5' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 5: Thủy sản
          </button>
          <button 
            onClick={() => setActiveTab('muc6')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc6' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 6: Phi nông
          </button>
          <button 
            onClick={() => setActiveTab('muc7')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors ${activeTab === 'muc7' ? 'border-sky-700 text-sky-800 bg-white' : 'border-transparent text-slate-600 hover:bg-slate-200'}`}
          >
            Mục 7: Thu khác
          </button>
          <button 
            onClick={() => setActiveTab('tonghop')} 
            className={`py-2 px-3 border-b-2 cursor-pointer transition-colors bg-emerald-50 text-emerald-900 border-emerald-600 font-extrabold`}
          >
            ★ Biểu tổng hợp hộ: {income.total.toLocaleString()} (1000đ)
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4 bg-slate-50">

          {/* MỤC 1: LƯƠNG, TIỀN CÔNG (Trang 1) */}
          {activeTab === 'muc1' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 1: THU NHẬP TỪ TIỀN LƯƠNG, TIỀN CÔNG</h4>
                  <p className="text-xs text-slate-600">Câu 1: Trong 12 tháng qua có ai trong hộ nhận tiền lương, tiền công hoặc lương hưu, trợ cấp thôi việc một lần không?</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input 
                      type="radio" 
                      name="muc1_has" 
                      checked={q.muc1_has} 
                      onChange={() => updateQ(prev => ({ ...prev, muc1_has: true }))} 
                    />
                    <span>1. Có</span>
                  </label>
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input 
                      type="radio" 
                      name="muc1_has" 
                      checked={!q.muc1_has} 
                      onChange={() => updateQ(prev => ({ ...prev, muc1_has: false }))} 
                    />
                    <span>2. Không</span>
                  </label>
                </div>
              </div>

              {q.muc1_has && (
                <div className="bg-white p-3 rounded border border-slate-300 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Danh sách thành viên hưởng lương, trợ cấp (1000đ)</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => openCatalogFor('muc1')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Tra cứu nghề nghiệp
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateQ(prev => ({
                          ...prev,
                          muc1_rows: [...(prev.muc1_rows || []), { id: String(Date.now()), name: '', job: '', col1_luong: 0, col2_troCap: 0 }]
                        }))}
                        className="px-2.5 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm thành viên
                      </button>
                    </div>
                  </div>

                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-sky-800 text-white text-center font-bold">
                        <th className="p-1.5 border border-sky-900 w-12">Mã TV</th>
                        <th className="p-1.5 border border-sky-900 text-left min-w-[140px]">Họ tên</th>
                        <th className="p-1.5 border border-sky-900 text-left min-w-[160px]">Mô tả công việc chính</th>
                        <th className="p-1.5 border border-sky-900 w-36">1. Tiền lương, tiền công</th>
                        <th className="p-1.5 border border-sky-900 w-36">2. Lương hưu, trợ cấp</th>
                        <th className="p-1.5 border border-sky-900 w-32 bg-sky-900 font-extrabold text-right">Tổng (1000đ)</th>
                        <th className="p-1.5 border border-sky-900 w-10">Xóa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(q.muc1_rows || []).map((r, idx) => (
                        <tr key={r.id} className="hover:bg-sky-50">
                          <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                          <td className="p-1.5 border border-slate-300">
                            <input 
                              type="text" 
                              value={r.name} 
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const next = [...q.muc1_rows];
                                next[idx].name = e.target.value;
                                updateQ(prev => ({ ...prev, muc1_rows: next }));
                              }}
                              className="w-full p-1 border rounded font-medium" 
                            />
                          </td>
                          <td className="p-1.5 border border-slate-300">
                            <input 
                              type="text" 
                              value={r.job} 
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const next = [...q.muc1_rows];
                                next[idx].job = e.target.value;
                                updateQ(prev => ({ ...prev, muc1_rows: next }));
                              }}
                              className="w-full p-1 border rounded font-medium" 
                            />
                          </td>
                          <td className="p-1.5 border border-slate-300">
                            <input 
                              type="number" 
                              value={r.col1_luong === 0 ? '' : r.col1_luong} 
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const next = [...q.muc1_rows];
                                next[idx].col1_luong = e.target.value === '' ? 0 : Number(e.target.value);
                                updateQ(prev => ({ ...prev, muc1_rows: next }));
                              }}
                              className="w-full p-1 border rounded text-right font-medium" 
                            />
                          </td>
                          <td className="p-1.5 border border-slate-300">
                            <input 
                              type="number" 
                              value={r.col2_troCap === 0 ? '' : r.col2_troCap} 
                              onFocus={e => e.target.select()}
                              onChange={e => {
                                const next = [...q.muc1_rows];
                                next[idx].col2_troCap = e.target.value === '' ? 0 : Number(e.target.value);
                                updateQ(prev => ({ ...prev, muc1_rows: next }));
                              }}
                              className="w-full p-1 border rounded text-right font-medium" 
                            />
                          </td>
                          <td className="p-1.5 border border-slate-300 text-right font-bold text-sky-900 bg-sky-50">
                            {((Number(r.col1_luong) || 0) + (Number(r.col2_troCap) || 0)).toLocaleString()}
                          </td>
                          <td className="p-1.5 border border-slate-300 text-center">
                            <button 
                              type="button"
                              onClick={() => updateQ(prev => ({ ...prev, muc1_rows: prev.muc1_rows.filter((_, i) => i !== idx) }))}
                              className="text-rose-600 hover:text-rose-800"
                            >
                              <Trash2 className="w-3.5 h-3.5 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-sky-100 font-black text-sky-950">
                        <td colSpan={3} className="p-2 border border-slate-300 text-center">TỔNG SỐ CÂU 2</td>
                        <td className="p-2 border border-slate-300 text-right">
                          {(q.muc1_rows || []).reduce((s, r) => s + (Number(r.col1_luong) || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-2 border border-slate-300 text-right">
                          {(q.muc1_rows || []).reduce((s, r) => s + (Number(r.col2_troCap) || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-2 border border-slate-300 text-right text-sm text-emerald-800 font-extrabold">
                          {income.muc1.toLocaleString()} (1000đ)
                        </td>
                        <td className="p-2 border border-slate-300"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* MỤC 2: TRỒNG TRỌT (Trang 2 & 3) */}
          {activeTab === 'muc2' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 2: THU NHẬP TỪ TRỒNG TRỌT</h4>
                  <p className="text-xs text-slate-600">Câu 1: Trong 12 tháng qua hộ có phát sinh thu nhập - chi phí từ hoạt động trồng trọt không?</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input 
                      type="radio" 
                      name="muc2_has" 
                      checked={q.muc2_has} 
                      onChange={() => updateQ(prev => ({ ...prev, muc2_has: true }))} 
                    />
                    <span>1. Có</span>
                  </label>
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input 
                      type="radio" 
                      name="muc2_has" 
                      checked={!q.muc2_has} 
                      onChange={() => updateQ(prev => ({ ...prev, muc2_has: false }))} 
                    />
                    <span>2. Không</span>
                  </label>
                </div>
              </div>

              {q.muc2_has && (
                <div className="flex flex-col gap-3">
                  {renderProductionTable(
                    "1. Cây trồng các loại",
                    q.muc2_cayTrongRows || [],
                    rows => updateQ(prev => ({ ...prev, muc2_cayTrongRows: rows })),
                    'muc2'
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded border border-slate-300 flex flex-col gap-2">
                      <h5 className="font-bold text-slate-800 text-xs uppercase">2. Nhân giống và chăm sóc giống</h5>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-600">Thu bán:</label>
                          <input type="number" value={q.muc2_giong?.col1 === 0 ? '' : q.muc2_giong?.col1 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_giong: { ...prev.muc2_giong, col1: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Tự dùng:</label>
                          <input type="number" value={q.muc2_giong?.col2 === 0 ? '' : q.muc2_giong?.col2 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_giong: { ...prev.muc2_giong, col2: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Tổng chi phí:</label>
                          <input type="number" value={((q.muc2_giong?.col4 || 0) + (q.muc2_giong?.col5 || 0) + (q.muc2_giong?.col6 || 0)) === 0 ? '' : ((q.muc2_giong?.col4 || 0) + (q.muc2_giong?.col5 || 0) + (q.muc2_giong?.col6 || 0))} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_giong: { ...prev.muc2_giong, col4: e.target.value === '' ? 0 : Number(e.target.value), col5: 0, col6: 0 } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded border border-slate-300 flex flex-col gap-2">
                      <h5 className="font-bold text-slate-800 text-xs uppercase">3. Sản phẩm phụ và thu nhặt từ trồng trọt</h5>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-600">Thu bán:</label>
                          <input type="number" value={q.muc2_sanPhamPhu?.col1 === 0 ? '' : q.muc2_sanPhamPhu?.col1 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_sanPhamPhu: { ...prev.muc2_sanPhamPhu, col1: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Tự dùng:</label>
                          <input type="number" value={q.muc2_sanPhamPhu?.col2 === 0 ? '' : q.muc2_sanPhamPhu?.col2 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_sanPhamPhu: { ...prev.muc2_sanPhamPhu, col2: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Chi khác:</label>
                          <input type="number" value={q.muc2_sanPhamPhu?.col6 === 0 ? '' : q.muc2_sanPhamPhu?.col6 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_sanPhamPhu: { ...prev.muc2_sanPhamPhu, col6: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded border border-slate-300 flex flex-col gap-2">
                      <h5 className="font-bold text-slate-800 text-xs uppercase">4. Dịch vụ trồng trọt</h5>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-600">Doanh thu dịch vụ:</label>
                          <input type="number" value={q.muc2_dichVu?.col3 === 0 ? '' : q.muc2_dichVu?.col3 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_dichVu: { ...prev.muc2_dichVu, col3: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-600">Chi phí dịch vụ:</label>
                          <input type="number" value={q.muc2_dichVu?.col6 === 0 ? '' : q.muc2_dichVu?.col6 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_dichVu: { ...prev.muc2_dichVu, col6: e.target.value === '' ? 0 : Number(e.target.value) } }))} className="w-full p-1 border rounded text-right font-medium" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-white p-3 rounded border border-slate-300 flex flex-col gap-2">
                      <h5 className="font-bold text-slate-800 text-xs uppercase">5. Tiền đền bù / hỗ trợ thiệt hại dịch bệnh, thiên tai</h5>
                      <div>
                        <label className="text-[11px] text-slate-600">Số tiền nhận được:</label>
                        <input type="number" value={q.muc2_denBu === 0 ? '' : q.muc2_denBu || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc2_denBu: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1 border rounded text-right font-bold text-emerald-800" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-100 p-2.5 rounded border border-emerald-300 flex justify-between items-center font-bold text-emerald-950">
                    <span>TỔNG THU NHẬP MỤC 2:</span>
                    <span className="text-sm font-black">{income.muc2.toLocaleString()} (1000đ)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MỤC 3: CHĂN NUÔI (Trang 4, 5 & 6) */}
          {activeTab === 'muc3' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 3: THU NHẬP TỪ CHĂN NUÔI</h4>
                  <p className="text-xs text-slate-600">Câu 1: Trong 12 tháng qua hộ có phát sinh thu nhập - chi phí từ chăn nuôi, gia súc, gia cầm, săn bắt không?</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc3_has" checked={q.muc3_has} onChange={() => updateQ(prev => ({ ...prev, muc3_has: true }))} />
                    <span>1. Có</span>
                  </label>
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc3_has" checked={!q.muc3_has} onChange={() => updateQ(prev => ({ ...prev, muc3_has: false }))} />
                    <span>2. Không</span>
                  </label>
                </div>
              </div>

              {q.muc3_has && (
                <div className="flex flex-col gap-3">
                  {renderProductionTable("1. Gia súc", q.muc3_giaSucRows || [], rows => updateQ(prev => ({ ...prev, muc3_giaSucRows: rows })), 'muc3')}
                  {renderProductionTable("2. Gia cầm", q.muc3_giaCamRows || [], rows => updateQ(prev => ({ ...prev, muc3_giaCamRows: rows })), 'muc3')}
                  {renderProductionTable("3. Chăn nuôi khác", q.muc3_khacRows || [], rows => updateQ(prev => ({ ...prev, muc3_khacRows: rows })), 'muc3')}
                  {renderProductionTable("4. Sản phẩm không qua giết mổ", q.muc3_khongGietMoRows || [], rows => updateQ(prev => ({ ...prev, muc3_khongGietMoRows: rows })), 'muc3')}
                  
                  <div className="bg-emerald-100 p-2.5 rounded border border-emerald-300 flex justify-between items-center font-bold text-emerald-950">
                    <span>TỔNG THU NHẬP MỤC 3:</span>
                    <span className="text-sm font-black">{income.muc3.toLocaleString()} (1000đ)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MỤC 4: LÂM NGHIỆP (Trang 7 & 8) */}
          {activeTab === 'muc4' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 4: THU NHẬP TỪ LÂM NGHIỆP</h4>
                  <p className="text-xs text-slate-600">Khai thác gỗ, thu nhặt lâm sản, ươm giống, trồng rừng, dịch vụ lâm nghiệp...</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc4_has" checked={q.muc4_has} onChange={() => updateQ(prev => ({ ...prev, muc4_has: true }))} />
                    <span>1. Có</span>
                  </label>
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc4_has" checked={!q.muc4_has} onChange={() => updateQ(prev => ({ ...prev, muc4_has: false }))} />
                    <span>2. Không</span>
                  </label>
                </div>
              </div>

              {q.muc4_has && (
                <div className="flex flex-col gap-3">
                  {renderProductionTable("1. Khai thác, thu nhặt lâm sản", q.muc4_khaiThacRows || [], rows => updateQ(prev => ({ ...prev, muc4_khaiThacRows: rows })), 'muc4')}
                  <div className="bg-emerald-100 p-2.5 rounded border border-emerald-300 flex justify-between items-center font-bold text-emerald-950">
                    <span>TỔNG THU NHẬP MỤC 4:</span>
                    <span className="text-sm font-black">{income.muc4.toLocaleString()} (1000đ)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MỤC 5: THỦY SẢN (Trang 9 & 10) */}
          {activeTab === 'muc5' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 5: THU NHẬP TỪ THỦY SẢN</h4>
                  <p className="text-xs text-slate-600">Nuôi trồng thủy sản, đánh bắt thủy hải sản, sản xuất giống...</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc5_has" checked={q.muc5_has} onChange={() => updateQ(prev => ({ ...prev, muc5_has: true }))} />
                    <span>1. Có</span>
                  </label>
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc5_has" checked={!q.muc5_has} onChange={() => updateQ(prev => ({ ...prev, muc5_has: false }))} />
                    <span>2. Không</span>
                  </label>
                </div>
              </div>

              {q.muc5_has && (
                <div className="flex flex-col gap-3">
                  {renderProductionTable("1. Nuôi trồng thủy sản", q.muc5_nuoiTrongRows || [], rows => updateQ(prev => ({ ...prev, muc5_nuoiTrongRows: rows })), 'muc5')}
                  {renderProductionTable("2. Đánh bắt thủy sản", q.muc5_danhBatRows || [], rows => updateQ(prev => ({ ...prev, muc5_danhBatRows: rows })), 'muc5')}
                  <div className="bg-emerald-100 p-2.5 rounded border border-emerald-300 flex justify-between items-center font-bold text-emerald-950">
                    <span>TỔNG THU NHẬP MỤC 5:</span>
                    <span className="text-sm font-black">{income.muc5.toLocaleString()} (1000đ)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MỤC 6: PHI NÔNG NGHIỆP HOẶC CHẾ BIẾN (Trang 11) */}
          {activeTab === 'muc6' && (
            <div className="flex flex-col gap-3">
              <div className="bg-white p-3 rounded border border-slate-300 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 6: SXKD PHI NÔNG NGHIỆP, DỊCH VỤ HOẶC CHẾ BIẾN</h4>
                  <p className="text-xs text-slate-600">Thương mại, buôn bán, tiểu thủ công nghiệp, dịch vụ sửa chữa, vận tải, ăn uống...</p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc6_has" checked={q.muc6_has} onChange={() => updateQ(prev => ({ ...prev, muc6_has: true }))} />
                    <span>1. Có</span>
                  </label>
                  <label className="flex items-center gap-1 font-bold text-xs cursor-pointer">
                    <input type="radio" name="muc6_has" checked={!q.muc6_has} onChange={() => updateQ(prev => ({ ...prev, muc6_has: false }))} />
                    <span>2. Không</span>
                  </label>
                </div>
              </div>

              {q.muc6_has && (
                <div className="bg-white p-3 rounded border border-slate-300 flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-800">Danh sách hoạt động SXKD phi nông nghiệp</span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button"
                        onClick={() => openCatalogFor('muc6')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <BookOpen className="w-3.5 h-3.5" /> Tra cứu ngành nghề
                      </button>
                      <button 
                        type="button"
                        onClick={() => updateQ(prev => ({
                          ...prev,
                          muc6_rows: [...(prev.muc6_rows || []), { id: String(Date.now()), name: '', col1_ban: 0, col2_tuDung: 0, col4_nguyenLieu: 0, col5_nangLuong: 0, col6_chiKhac: 0 }]
                        }))}
                        className="px-2.5 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" /> Thêm hoạt động
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-sky-800 text-white text-center font-bold">
                          <th className="p-1 border border-sky-900 w-10">STT</th>
                          <th className="p-1 border border-sky-900 text-left min-w-[160px]">Mô tả hoạt động kinh doanh</th>
                          <th className="p-1 border border-sky-900 w-24">1. Bán ra</th>
                          <th className="p-1 border border-sky-900 w-24">2. Để lại dùng</th>
                          <th className="p-1 border border-sky-900 w-24 bg-sky-700 font-bold">3=1+2</th>
                          <th className="p-1 border border-sky-900 w-24">4. NVL, hàng</th>
                          <th className="p-1 border border-sky-900 w-24">5. Năng lượng</th>
                          <th className="p-1 border border-sky-900 w-24">6. Chi khác</th>
                          <th className="p-1 border border-sky-900 w-24 bg-sky-900 font-bold">7=4+5+6</th>
                          <th className="p-1 border border-sky-900 w-28 bg-emerald-800 text-right">Thu nhập (1000đ)</th>
                          <th className="p-1 border border-sky-900 w-10">Xóa</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(q.muc6_rows || []).map((r, idx) => {
                          const col3 = (Number(r.col1_ban) || 0) + (Number(r.col2_tuDung) || 0);
                          const col7 = (Number(r.col4_nguyenLieu) || 0) + (Number(r.col5_nangLuong) || 0) + (Number(r.col6_chiKhac) || 0);
                          const col8 = Math.max(0, col3 - col7);
                          return (
                            <tr key={r.id} className="hover:bg-sky-50">
                              <td className="p-1 border border-slate-300 text-center font-bold bg-slate-50">{idx + 1}</td>
                              <td className="p-1 border border-slate-300">
                                <input 
                                  type="text" 
                                  value={r.name} 
                                  placeholder="Ví dụ: Bán hàng tạp hóa, thợ may..."
                                  onFocus={e => e.target.select()}
                                  onChange={e => {
                                    const next = [...q.muc6_rows];
                                    next[idx].name = e.target.value;
                                    updateQ(prev => ({ ...prev, muc6_rows: next }));
                                  }}
                                  className="w-full p-1 border rounded font-medium" 
                                />
                              </td>
                              <td className="p-1 border border-slate-300">
                                <input type="number" value={r.col1_ban === 0 ? '' : r.col1_ban} onFocus={e => e.target.select()} onChange={e => {
                                  const next = [...q.muc6_rows];
                                  next[idx].col1_ban = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateQ(prev => ({ ...prev, muc6_rows: next }));
                                }} className="w-full p-1 border rounded text-right font-medium" />
                              </td>
                              <td className="p-1 border border-slate-300">
                                <input type="number" value={r.col2_tuDung === 0 ? '' : r.col2_tuDung} onFocus={e => e.target.select()} onChange={e => {
                                  const next = [...q.muc6_rows];
                                  next[idx].col2_tuDung = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateQ(prev => ({ ...prev, muc6_rows: next }));
                                }} className="w-full p-1 border rounded text-right font-medium" />
                              </td>
                              <td className="p-1 border border-slate-300 text-right font-bold text-sky-900 bg-sky-50">{col3.toLocaleString()}</td>
                              <td className="p-1 border border-slate-300">
                                <input type="number" value={r.col4_nguyenLieu === 0 ? '' : r.col4_nguyenLieu} onFocus={e => e.target.select()} onChange={e => {
                                  const next = [...q.muc6_rows];
                                  next[idx].col4_nguyenLieu = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateQ(prev => ({ ...prev, muc6_rows: next }));
                                }} className="w-full p-1 border rounded text-right font-medium" />
                              </td>
                              <td className="p-1 border border-slate-300">
                                <input type="number" value={r.col5_nangLuong === 0 ? '' : r.col5_nangLuong} onFocus={e => e.target.select()} onChange={e => {
                                  const next = [...q.muc6_rows];
                                  next[idx].col5_nangLuong = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateQ(prev => ({ ...prev, muc6_rows: next }));
                                }} className="w-full p-1 border rounded text-right font-medium" />
                              </td>
                              <td className="p-1 border border-slate-300">
                                <input type="number" value={r.col6_chiKhac === 0 ? '' : r.col6_chiKhac} onFocus={e => e.target.select()} onChange={e => {
                                  const next = [...q.muc6_rows];
                                  next[idx].col6_chiKhac = e.target.value === '' ? 0 : Number(e.target.value);
                                  updateQ(prev => ({ ...prev, muc6_rows: next }));
                                }} className="w-full p-1 border rounded text-right font-medium" />
                              </td>
                              <td className="p-1 border border-slate-300 text-right font-bold text-slate-800 bg-slate-100">{col7.toLocaleString()}</td>
                              <td className="p-1 border border-slate-300 text-right font-black text-emerald-800 bg-emerald-50">{col8.toLocaleString()}</td>
                              <td className="p-1 border border-slate-300 text-center">
                                <button type="button" onClick={() => updateQ(prev => ({ ...prev, muc6_rows: prev.muc6_rows.filter((_, i) => i !== idx) }))} className="text-rose-600 hover:text-rose-800">
                                  <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-emerald-100 p-2.5 rounded border border-emerald-300 flex justify-between items-center font-bold text-emerald-950 mt-2">
                    <span>TỔNG THU NHẬP MỤC 6:</span>
                    <span className="text-sm font-black">{income.muc6.toLocaleString()} (1000đ)</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MỤC 7: THU NHẬP KHÁC (Trang 12) */}
          {activeTab === 'muc7' && (
            <div className="bg-white p-4 rounded border border-slate-300 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-sm uppercase">MỤC 7: THU NHẬP KHÁC (1000đ)</h4>
                <button 
                  type="button"
                  onClick={() => openCatalogFor('muc7')}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Tra cứu nguồn thu khác & trợ cấp
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 rounded border border-slate-200 bg-slate-50 flex flex-col gap-2">
                  <strong className="text-sky-900 block text-xs">1. Thu nhập từ các nguồn hỗ trợ bên ngoài hộ:</strong>
                  <div>
                    <label className="text-slate-600 text-[11px] block">1.1 Tiền, hiện vật người ngoài biếu/tặng/mừng/giúp:</label>
                    <input type="number" value={q.muc7_1_1 === 0 ? '' : q.muc7_1_1 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc7_1_1: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1.5 border rounded text-right font-medium bg-white" />
                  </div>
                  <div>
                    <label className="text-slate-600 text-[11px] block">1.2 Trợ cấp xã hội:</label>
                    <input type="number" value={q.muc7_1_2 === 0 ? '' : q.muc7_1_2 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc7_1_2: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1.5 border rounded text-right font-medium bg-white" />
                  </div>
                  <div>
                    <label className="text-slate-600 text-[11px] block">1.3 Học bổng, thưởng giáo dục, trợ giúp y tế:</label>
                    <input type="number" value={q.muc7_1_3 === 0 ? '' : q.muc7_1_3 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc7_1_3: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1.5 border rounded text-right font-medium bg-white" />
                  </div>
                </div>

                <div className="p-3 rounded border border-slate-200 bg-slate-50 flex flex-col gap-2">
                  <strong className="text-sky-900 block text-xs">2. Thu nhập từ sở hữu tài sản & Khác:</strong>
                  <div>
                    <label className="text-slate-600 text-[11px] block">2.1 Cho thuê tài sản, đất đai, nhà ở:</label>
                    <input type="number" value={q.muc7_2_1 === 0 ? '' : q.muc7_2_1 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc7_2_1: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1.5 border rounded text-right font-medium bg-white" />
                  </div>
                  <div>
                    <label className="text-slate-600 text-[11px] block">2.2 Lãi đầu tư, tín dụng, tiết kiệm, cổ phần, cho vay:</label>
                    <input type="number" value={q.muc7_2_2 === 0 ? '' : q.muc7_2_2 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc7_2_2: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1.5 border rounded text-right font-medium bg-white" />
                  </div>
                  <div>
                    <label className="text-slate-600 text-[11px] block">3. Thu nhập khác:</label>
                    <input type="number" value={q.muc7_3 === 0 ? '' : q.muc7_3 || ''} onFocus={e => e.target.select()} onChange={e => updateQ(prev => ({ ...prev, muc7_3: e.target.value === '' ? 0 : Number(e.target.value) }))} className="w-full p-1.5 border rounded text-right font-medium bg-white" />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-100 p-2.5 rounded border border-emerald-300 flex justify-between items-center font-bold text-emerald-950">
                <span>TỔNG THU NHẬP MỤC 7:</span>
                <span className="text-sm font-black">{income.muc7.toLocaleString()} (1000đ)</span>
              </div>
            </div>
          )}

          {/* BIỂU TỔNG HỢP THU NHẬP CỦA HỘ (Trang 13) */}
          {activeTab === 'tonghop' && (
            <div className="bg-white p-5 rounded border border-slate-300 flex flex-col gap-4">
              <div className="text-center border-b pb-3">
                <h3 className="font-black text-slate-900 text-base uppercase">BIỂU TỔNG HỢP THU NHẬP CỦA HỘ NĂM 2026</h3>
                <p className="text-xs text-slate-600 mt-1">Đơn vị tính: 1000đ</p>
              </div>

              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-sky-800 text-white font-bold">
                      <th className="p-2 border border-sky-900 text-left">Nguồn thu</th>
                      <th className="p-2 border border-sky-900 w-44 text-right">Tổng thu nhập (1000đ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-2 border border-slate-300 font-medium">1. Thu nhập từ tiền lương, tiền công</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc1.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2 border border-slate-300 font-medium">2. Thu nhập từ trồng trọt</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc2.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-300 font-medium">3. Thu nhập từ chăn nuôi</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc3.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2 border border-slate-300 font-medium">4. Thu nhập từ lâm nghiệp</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc4.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-300 font-medium">5. Thu nhập từ thủy sản</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc5.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-slate-50/50">
                      <td className="p-2 border border-slate-300 font-medium">6. Thu nhập từ sản xuất kinh doanh phi nông nghiệp</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc6.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="p-2 border border-slate-300 font-medium">7. Thu nhập khác</td>
                      <td className="p-2 border border-slate-300 text-right font-bold text-slate-900">{income.muc7.toLocaleString()}</td>
                    </tr>
                    <tr className="bg-emerald-100 font-black text-emerald-950 text-sm">
                      <td className="p-2.5 border border-slate-300 uppercase">TỔNG THU NHẬP HỘ</td>
                      <td className="p-2.5 border border-slate-300 text-right text-base text-emerald-900">{income.total.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Bảng chỉ tiêu nhân khẩu và thu nhập bình quân của hộ */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-2xs">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-slate-800 flex-1">
                  <div className={`p-2 rounded border transition-colors ${(!form.membersCount || Number(form.membersCount) <= 0) ? 'bg-rose-50 border-rose-300' : 'bg-white border-amber-200'}`}>
                    <span className="text-slate-500 block text-[11px] font-medium flex items-center justify-between">
                      <span>Tổng nhân khẩu:</span>
                      {(!form.membersCount || Number(form.membersCount) <= 0) && (
                        <span className="text-[10px] text-rose-600 font-black">Chưa nhập *</span>
                      )}
                    </span>
                    <strong className={`text-sm font-black ${(!form.membersCount || Number(form.membersCount) <= 0) ? 'text-rose-700' : 'text-slate-900'}`}>
                      {form.membersCount && Number(form.membersCount) > 0 ? `${form.membersCount} người` : 'Chưa nhập số nhân khẩu'}
                    </strong>
                  </div>
                  <div className={`p-2 rounded border transition-colors ${(form.workingMembersCount === '' || form.workingMembersCount === null || form.workingMembersCount === undefined) ? 'bg-rose-50 border-rose-300' : 'bg-white border-amber-200'}`}>
                    <span className="text-slate-500 block text-[11px] font-medium flex items-center justify-between">
                      <span>Số người làm việc:</span>
                      {(form.workingMembersCount === '' || form.workingMembersCount === null || form.workingMembersCount === undefined) && (
                        <span className="text-[10px] text-rose-600 font-black">Chưa nhập *</span>
                      )}
                    </span>
                    <strong className={`text-sm font-black ${(form.workingMembersCount === '' || form.workingMembersCount === null || form.workingMembersCount === undefined) ? 'text-rose-700' : 'text-slate-900'}`}>
                      {form.workingMembersCount !== '' && form.workingMembersCount !== null && form.workingMembersCount !== undefined ? `${form.workingMembersCount} người` : 'Chưa nhập số người làm việc'}
                    </strong>
                  </div>
                  <div className="bg-white p-2 rounded border border-amber-200 col-span-2 md:col-span-1">
                    <span className="text-slate-500 block text-[11px] font-medium">Tổng thu nhập hộ:</span>
                    <strong className="text-sm font-black text-emerald-900">{income.total.toLocaleString()} (1000đ)</strong>
                  </div>
                </div>

                <div className="bg-emerald-800 text-white p-2.5 rounded-lg border border-emerald-900 shadow-xs md:min-w-[220px] text-right">
                  <span className="text-emerald-200 block text-[10px] font-bold uppercase">
                    TNBQ 1 người / tháng:
                  </span>
                  <strong className="text-base font-black text-amber-300 block mt-0.5">
                    {Number(form.membersCount) > 0 
                      ? `${Math.round(income.total / Number(form.membersCount) / 12).toLocaleString()} đ/người/tháng` 
                      : 'Chờ nhập số nhân khẩu'}
                  </strong>
                </div>
              </div>

              {/* Signature section */}
              <div className="flex justify-between items-center pt-4 text-xs text-slate-700">
                <div></div>
                <div className="text-center font-medium">
                  <div className="flex items-center gap-1 mb-1">
                    <span>Ngày khảo sát:</span>
                    <input 
                      type="text" 
                      value={q.surveyorDate || ''} 
                      onChange={e => updateQ(prev => ({ ...prev, surveyorDate: e.target.value }))}
                      className="border-b border-slate-400 bg-transparent text-center px-1 font-bold w-32" 
                    />
                  </div>
                  <p className="font-bold text-slate-900 mt-2">Điều tra viên</p>
                  <p className="text-[10px] text-slate-500 italic mt-6">Ký, ghi rõ họ tên</p>
                  <input 
                    type="text" 
                    placeholder="Nhập họ tên điều tra viên..." 
                    value={q.surveyorName || ''} 
                    onChange={e => updateQ(prev => ({ ...prev, surveyorName: e.target.value }))}
                    className="border border-slate-300 rounded p-1 text-center font-bold text-xs mt-2 w-48"
                  />
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="bg-slate-100 p-3 border-t border-slate-300 flex flex-col gap-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-700">Tổng thu nhập hộ:</span>
              <span className="font-black text-emerald-800 text-sm bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                {income.total.toLocaleString()} (1000đ)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded font-bold cursor-pointer"
              >
                Đóng
              </button>

              {!isLocked ? (
                <>
                  <button 
                    type="button" 
                    onClick={() => handleSaveWithStatus('DANG_NHAP')}
                    className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Lưu dữ liệu và đánh dấu đang điều tra dở"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Nháp</span>
                  </button>

                  <button 
                    type="button" 
                    onClick={() => handleSaveWithStatus('DA_HOAN_THANH')}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Lưu dữ liệu và đánh dấu đã điều tra hoàn tất"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Lưu & Hoàn Thành</span>
                  </button>

                  {isAdmin && (
                    <button 
                      type="button" 
                      onClick={() => handleSaveWithStatus('DA_DUYET')}
                      className="px-4 py-1.5 bg-purple-700 hover:bg-purple-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Duyệt kết quả và khóa không cho sửa đổi"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Duyệt & Khóa Phiếu</span>
                    </button>
                  )}
                </>
              ) : (
                isAdmin && (
                  <button 
                    type="button" 
                    onClick={() => handleSaveWithStatus('DA_HOAN_THANH')}
                    className="px-4 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                    title="Mở khóa để cho phép điều tra viên cập nhật lại"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Mở Khóa Phiếu</span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

      </div>

      {/* POPUP CẢNH BÁO KHI CHƯA NHẬP NHÂN KHẨU / SỐ NGƯỜI LÀM VIỆC */}
      {validationAlertModal && validationAlertModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border-2 border-rose-500 scale-100 animate-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
                <AlertTriangle className="w-5 h-5 text-amber-300 animate-bounce" />
              </div>
              <h3 className="font-black text-sm uppercase tracking-wide">
                {validationAlertModal.title}
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 leading-relaxed font-semibold">
                {validationAlertModal.message}
              </div>
              <button
                type="button"
                onClick={() => {
                  const fieldToFocus = validationAlertModal.field === 'membersCount' ? 'input-members-count' : 'input-working-members-count';
                  setValidationAlertModal(null);
                  scrollToAndFocus(fieldToFocus);
                }}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-black rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg transition-all"
              >
                <span>Về màn hình nhập Nhân khẩu</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog modal for quick lookup and selection */}
      <CatalogModal 
        isOpen={isCatalogOpen} 
        onClose={() => setIsCatalogOpen(false)} 
        onSelect={handleSelectFromCatalog} 
        initialTab={catalogSection}
      />
    </div>
  );
}
