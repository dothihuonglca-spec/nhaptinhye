/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import type { Commune, Household, SurveyArea } from '../App';
import type { Surveyor } from '../types/user';
import type { AreaProgressSnapshot } from '../utils/areaDataTransfer';
import { 
  Users, CheckCircle2, Clock, AlertCircle, Search, 
  FileSpreadsheet, FileText, Filter, Eye, ChevronRight, MapPin, 
  UserCheck, ExternalLink, RefreshCw, BarChart3, TrendingUp,
  Building, Phone, ArrowUpRight, X, LayoutGrid, ListTree
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface SurveyorProgressViewProps {
  surveyors: Surveyor[];
  households: Household[];
  areas: SurveyArea[];
  communes: Commune[];
  currentUser: Surveyor;
  cloudProgress: AreaProgressSnapshot[];
  onOpenHouseholdForm?: (household: Household) => void;
  onNavigateToHouseholdEntry?: (surveyorNameOrId: string, areaId?: string, communeId?: string) => void;
  showNotification: (type: 'success' | 'error', msg: string) => void;
}

interface AreaProgressItem {
  id: string;
  area: SurveyArea;
  commune?: Commune;
  tkcsCode: string;
  tkcsName: string;
  communeCode: string;
  communeName: string;
  areaCode: string;
  areaName: string;
  assignedSurveyorName: string;
  totalHouseholds: number;
  completedHouseholds: number;
  inProgressHouseholds: number;
  unenteredHouseholds: number;
  completionRate: number;
  householdsList: Household[];
}

type ProgressNoticeType = 'areas' | 'completedAreas' | 'assigned' | 'completed' | 'inProgress' | 'notEntered';

interface ProgressNotice {
  title: string;
  type: ProgressNoticeType;
}

export const SurveyorProgressView: React.FC<SurveyorProgressViewProps> = ({
  surveyors,
  households,
  areas,
  communes,
  currentUser,
  cloudProgress,
  onOpenHouseholdForm,
  onNavigateToHouseholdEntry,
  showNotification
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [tkcsFilter, setTkcsFilter] = useState('ALL');
  const [communeFilter, setCommuneFilter] = useState('ALL');
  const [progressStatusFilter, setProgressStatusFilter] = useState<'ALL' | 'DONE' | 'DOING' | 'NOT_STARTED'>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped'>('grid');
  const [selectedAreaDetail, setSelectedAreaDetail] = useState<AreaProgressItem | null>(null);
  const [progressNotice, setProgressNotice] = useState<ProgressNotice | null>(null);

  // Danh sách xã được phép truy cập theo phân quyền
  const allowedCommunes = useMemo(() => {
    if (!currentUser || currentUser.role === 'ADMIN') return communes;

    if (currentUser.role === 'SUPERVISOR') {
      if (currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL') && currentUser.assignedCommunes.length > 0) {
        return communes.filter(c => 
          currentUser.assignedCommunes?.includes(c.id) || 
          currentUser.assignedCommunes?.includes(c.communeCode)
        );
      }
      return communes;
    }

    if (currentUser.role === 'SURVEYOR') {
      if (!currentUser.assignedAreas?.includes('ALL')) {
        const myAssigned = new Set(currentUser.assignedAreas || []);
        const myCommuneIds = new Set<string>();

        areas.forEach(a => {
          if (
            myAssigned.has(a.id) || 
            myAssigned.has(a.code) || 
            myAssigned.has(`${a.communeId}_${a.code}`) ||
            ((a as any).communeCode && myAssigned.has((a as any).communeCode))
          ) {
            myCommuneIds.add(a.communeId);
            if ((a as any).communeCode) myCommuneIds.add((a as any).communeCode);
          }
        });

        households.forEach(h => {
          if (h.assignedSurveyorId === currentUser.id || (h.assignedSurveyorName && h.assignedSurveyorName === currentUser.name)) {
            if (h.communeId) myCommuneIds.add(h.communeId);
            if (h.communeCode) myCommuneIds.add(h.communeCode);
          }
        });

        const res = communes.filter(c => myCommuneIds.has(c.id) || myCommuneIds.has(c.communeCode));
        return res.length > 0 ? res : communes;
      }
    }
    return communes;
  }, [communes, areas, households, currentUser]);

  // Danh sách TKCS duy nhất
  const uniqueTkcsList = useMemo(() => {
    const map = new Map<string, string>();
    allowedCommunes.forEach(c => {
      if (c.tkcsCode) {
        map.set(c.tkcsCode, c.tkcsName || c.tkcsCode);
      }
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [allowedCommunes]);

  // Danh sách xã thuộc TKCS đã lọc
  const filteredCommunesForFilter = useMemo(() => {
    if (tkcsFilter === 'ALL') return allowedCommunes;
    return allowedCommunes.filter(c => c.tkcsCode === tkcsFilter);
  }, [allowedCommunes, tkcsFilter]);

  // Hàm lấy tên địa bàn chuẩn (ưu tiên tên sheet từ bảng kê, loại bỏ 001)
  const getAreaDisplayName = (areaIdOrCode: string, communeIdOrCode?: string) => {
    const matchedArea = areas.find(a => 
      a.id === areaIdOrCode || 
      (a.code === areaIdOrCode && (!communeIdOrCode || a.communeId === communeIdOrCode || (a as any).communeCode === communeIdOrCode))
    ) || areas.find(a => a.code === areaIdOrCode);

    const matchedH = households.find(h => 
      (h.areaId === areaIdOrCode || h.areaCode === areaIdOrCode || (matchedArea && (h.areaId === matchedArea.id || h.areaCode === matchedArea.code))) &&
      (!communeIdOrCode || h.communeId === communeIdOrCode || (h as any).communeCode === communeIdOrCode) &&
      Boolean((h as any).sheetName || h.areaName) &&
      (h as any).sheetName !== '001' && h.areaName !== '001' &&
      (h as any).sheetName !== (matchedArea?.code || areaIdOrCode) && h.areaName !== (matchedArea?.code || areaIdOrCode) &&
      (h as any).sheetName !== 'Địa bàn' && h.areaName !== 'Địa bàn' && h.areaName !== '---' &&
      !(h as any).sheetName?.startsWith('Địa bàn 001') && !h.areaName?.startsWith('Địa bàn 001')
    );

    const rawName = ((matchedH as any)?.sheetName && (matchedH as any).sheetName.trim() && (matchedH as any).sheetName !== '001' && (matchedH as any).sheetName !== 'Địa bàn' && !(matchedH as any).sheetName.startsWith('Địa bàn 001'))
      ? (matchedH as any).sheetName.trim()
      : (matchedArea?.name && matchedArea.name.trim() && matchedArea.name !== '001' && matchedArea.name !== matchedArea.code && matchedArea.name !== 'Địa bàn' && !matchedArea.name.startsWith('Địa bàn 001'))
      ? matchedArea.name.trim()
      : (matchedH?.areaName && matchedH.areaName.trim() && matchedH.areaName !== '001' && matchedH.areaName !== 'Địa bàn' && matchedH.areaName !== matchedH.areaCode && !matchedH.areaName.startsWith('Địa bàn 001'))
      ? matchedH.areaName.trim()
      : (matchedArea?.name && matchedArea.name.trim() && matchedArea.name !== '001' && !matchedArea.name.startsWith('Địa bàn 001'))
      ? matchedArea.name.trim()
      : `Địa bàn ${matchedArea?.code || areaIdOrCode}`;

    return rawName;
  };

  // Xây dựng danh sách tiến độ theo từng Địa bàn (Area) - Chỉ tính 10 hộ chính thức mỗi địa bàn (Tối ưu O(N) hiệu năng cao không bị đơ)
  const areaProgressList: AreaProgressItem[] = useMemo(() => {
    let effectiveAreas = [...areas];
    if (effectiveAreas.length === 0 && households.length > 0) {
      const areaMap = new Map<string, SurveyArea>();
      households.forEach(h => {
        const aCode = h.areaCode || '001';
        const cId = h.communeId || (h.communeCode ? `c-${h.communeCode}` : 'commune-default');
        const key = `${cId}-${aCode}`;
        if (!areaMap.has(key)) {
          areaMap.set(key, {
            id: h.areaId || `area-${cId}-${aCode}`,
            communeId: cId,
            communeCode: h.communeCode,
            code: aCode,
            name: (h as any).sheetName || h.areaName || `Địa bàn ${aCode}`
          });
        }
      });
      effectiveAreas = Array.from(areaMap.values());
    }

    // Phân quyền: Điều tra viên chỉ thấy địa bàn mình phụ trách, Giám sát viên thấy địa bàn xã phụ trách
    if (currentUser && currentUser.role !== 'ADMIN') {
      if (currentUser.role === 'SURVEYOR') {
        if (!currentUser.assignedAreas?.includes('ALL')) {
          const myAssigned = new Set(currentUser.assignedAreas || []);
          const myDirectHhAreaIds = new Set(
            households
              .filter(h => h.assignedSurveyorId === currentUser.id || (h.assignedSurveyorName && h.assignedSurveyorName === currentUser.name))
              .map(h => h.areaId || h.areaCode)
          );

          effectiveAreas = effectiveAreas.filter(a => 
            myAssigned.has(a.id) || 
            myAssigned.has(a.code) || 
            myAssigned.has(`${a.communeId}_${a.code}`) ||
            myDirectHhAreaIds.has(a.id) ||
            myDirectHhAreaIds.has(a.code)
          );
        }
      } else if (currentUser.role === 'SUPERVISOR') {
        if (currentUser.assignedCommunes && !currentUser.assignedCommunes.includes('ALL') && currentUser.assignedCommunes.length > 0) {
          effectiveAreas = effectiveAreas.filter(a => 
            currentUser.assignedCommunes?.includes(a.communeId) || 
            ((a as any).communeCode && currentUser.assignedCommunes?.includes((a as any).communeCode))
          );
        }
      }
    }

    // Pre-index households and communes for O(1) lightning fast lookups
    const hhByAreaId = new Map<string, Household[]>();
    const hhByCommuneAndAreaCode = new Map<string, Household[]>();
    const hhByAreaCode = new Map<string, Household[]>();

    households.forEach(h => {
      if (h.areaId) {
        if (!hhByAreaId.has(h.areaId)) hhByAreaId.set(h.areaId, []);
        hhByAreaId.get(h.areaId)!.push(h);
      }
      if (h.areaCode) {
        if (!hhByAreaCode.has(h.areaCode)) hhByAreaCode.set(h.areaCode, []);
        hhByAreaCode.get(h.areaCode)!.push(h);

        const cKey = `${h.communeId || h.communeCode || 'default'}_${h.areaCode}`;
        if (!hhByCommuneAndAreaCode.has(cKey)) hhByCommuneAndAreaCode.set(cKey, []);
        hhByCommuneAndAreaCode.get(cKey)!.push(h);
      }
    });

    const communeMap = new Map<string, Commune>();
    communes.forEach(c => {
      if (c.id) communeMap.set(c.id, c);
      if (c.communeCode) communeMap.set(c.communeCode, c);
    });

    return effectiveAreas.map(area => {
      const commune = communeMap.get(area.communeId) || communeMap.get((area as any).communeCode);
      
      const cKey = `${area.communeId || commune?.id || 'default'}_${area.code}`;
      let allAreaHHs = hhByCommuneAndAreaCode.get(cKey) || hhByAreaId.get(area.id) || hhByAreaCode.get(area.code) || [];

      if (allAreaHHs.length === 0) {
        allAreaHHs = households.filter(h => {
          if (h.areaId === area.id) return true;
          if (h.areaCode === area.code && (h.communeId === area.communeId || (h as any).communeCode === area.communeCode || (commune && (h.communeId === commune.id || h.communeCode === commune.communeCode)))) return true;
          return false;
        });
      }

      // Chỉ tính tối đa 10 hộ chính thức mỗi địa bàn (bỏ qua hộ dự phòng để tính tiến độ chuẩn 10 hộ/địa bàn)
      const officialHHs = allAreaHHs.filter(h => (h.sampleStatus || 'CHÍNH THỨC') !== 'DỰ PHÒNG').slice(0, 10);
      const assignedHHs = officialHHs.length > 0 ? officialHHs : allAreaHHs.slice(0, 10);

      const localTotalHouseholds = assignedHHs.length;
      const localCompletedHouseholds = assignedHHs.filter(h =>
        h.surveyStatus === 'DA_DUYET' ||
        h.surveyStatus === 'DA_HOAN_THANH' ||
        h.surveyStatus === 'COMPLETED' ||
        h.surveyStatus === 'HOAN_THANH'
      ).length;
      const localInProgressHouseholds = assignedHHs.filter(h =>
        h.surveyStatus === 'DANG_NHAP' || h.surveyStatus === 'IN_PROGRESS'
      ).length;

      // Tìm tên người nhập / ĐTV phụ trách địa bàn này
      const surveyorSet = new Set<string>();
      assignedHHs.forEach(h => {
        if (h.assignedSurveyorName) surveyorSet.add(h.assignedSurveyorName);
      });
      surveyors.forEach(s => {
        if (s.role === 'SURVEYOR' && s.assignedAreas && !s.assignedAreas.includes('ALL')) {
          if (
            s.assignedAreas.includes(area.id) || 
            s.assignedAreas.includes(area.code) || 
            s.assignedAreas.includes(`${area.communeId}_${area.code}`) ||
            (commune && s.assignedAreas.includes(`${commune.communeCode}_${area.code}`))
          ) {
            surveyorSet.add(s.name);
          }
        }
      });

      const remoteProgress = cloudProgress.filter(item =>
        item.areaId === area.id ||
        (item.areaCode === area.code && (
          item.communeId === area.communeId ||
          item.communeCode === area.communeCode
        ))
      );
      remoteProgress.forEach(item => surveyorSet.add(item.surveyorName));
      const totalHouseholds = Math.max(
        localTotalHouseholds,
        ...remoteProgress.map(item => item.totalHouseholds),
        0
      );
      const doneTotal = Math.min(totalHouseholds, Math.max(
        localCompletedHouseholds,
        remoteProgress.reduce((total, item) => total + item.completedHouseholds, 0)
      ));
      const inProgressHouseholds = Math.min(
        totalHouseholds - doneTotal,
        Math.max(
          localInProgressHouseholds,
          remoteProgress.reduce((total, item) => total + item.inProgressHouseholds, 0)
        )
      );
      const unenteredHouseholds = Math.max(0, totalHouseholds - doneTotal - inProgressHouseholds);
      const completionRate = totalHouseholds > 0 ? Math.round((doneTotal / totalHouseholds) * 100) : 0;

      const surveyorNamesStr = surveyorSet.size > 0 ? Array.from(surveyorSet).join(', ') : '---';
      
      const areaNameFinal = 
        (area.name && area.name.trim() && area.name !== '001' && area.name !== '001' && area.name !== 'Địa bàn' && !area.name.startsWith('Địa bàn 001'))
          ? area.name.trim()
          : (allAreaHHs.find(h => (h as any).sheetName && (h as any).sheetName.trim() && (h as any).sheetName !== '001' && (h as any).sheetName !== 'Địa bàn' && !(h as any).sheetName.startsWith('Địa bàn 001')) as any)?.sheetName?.trim()
          || (allAreaHHs.find(h => h.areaName && h.areaName.trim() && h.areaName !== '001' && h.areaName !== 'Địa bàn' && h.areaName !== h.areaCode && !h.areaName.startsWith('Địa bàn 001')) as any)?.areaName?.trim()
          || `Địa bàn ${area.code}`;

      return {
        id: area.id,
        area,
        commune,
        tkcsCode: commune?.tkcsCode || '---',
        tkcsName: commune?.tkcsName || '---',
        communeCode: commune?.communeCode || area.communeCode || '---',
        communeName: commune?.communeName || area.name || '---',
        areaCode: area.code,
        areaName: areaNameFinal,
        assignedSurveyorName: surveyorNamesStr,
        totalHouseholds,
        completedHouseholds: doneTotal,
        inProgressHouseholds,
        unenteredHouseholds: Math.max(0, unenteredHouseholds),
        completionRate,
        householdsList: assignedHHs
      };
    });
  }, [areas, communes, households, surveyors, currentUser, cloudProgress]);

  // Lọc danh sách theo bộ lọc
  const filteredProgressList = useMemo(() => {
    return areaProgressList.filter(item => {
      // 1. Lọc theo TKCS
      if (tkcsFilter !== 'ALL' && item.tkcsCode !== tkcsFilter) return false;

      // 2. Lọc theo Xã
      if (communeFilter !== 'ALL' && item.commune?.id !== communeFilter && item.commune?.communeCode !== communeFilter && item.area.communeId !== communeFilter) return false;

      // 3. Lọc theo trạng thái tiến độ
      if (progressStatusFilter === 'DONE' && item.completionRate < 100) return false;
      if (progressStatusFilter === 'DOING' && (item.completionRate === 0 || item.completionRate >= 100)) return false;
      if (progressStatusFilter === 'NOT_STARTED' && item.completionRate > 0) return false;

      // 4. Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const kw = searchTerm.toLowerCase().trim();
        const matchAreaName = item.areaName.toLowerCase().includes(kw);
        const matchAreaCode = item.areaCode.toLowerCase().includes(kw);
        const matchCommune = item.communeName.toLowerCase().includes(kw) || item.communeCode.toLowerCase().includes(kw);
        const matchTkcs = item.tkcsCode.toLowerCase().includes(kw) || item.tkcsName.toLowerCase().includes(kw);
        const matchSurveyor = item.assignedSurveyorName.toLowerCase().includes(kw);
        if (!matchAreaName && !matchAreaCode && !matchCommune && !matchTkcs && !matchSurveyor) return false;
      }

      return true;
    });
  }, [areaProgressList, tkcsFilter, communeFilter, progressStatusFilter, searchTerm]);

  // Nhóm danh sách theo điều tra viên (dùng cho chế độ Dạng Nhóm)
  const groupedBySurveyorList = useMemo(() => {
    const map = new Map<string, AreaProgressItem[]>();
    filteredProgressList.forEach(item => {
      const surveyorKey = item.assignedSurveyorName !== '---' ? item.assignedSurveyorName : 'Chưa phân công điều tra viên';
      if (!map.has(surveyorKey)) {
        map.set(surveyorKey, []);
      }
      map.get(surveyorKey)!.push(item);
    });
    return Array.from(map.entries()).map(([surveyorName, items]) => ({
      surveyorName,
      items,
      totalHouseholds: items.reduce((acc, i) => acc + i.totalHouseholds, 0),
      completedHouseholds: items.reduce((acc, i) => acc + i.completedHouseholds, 0),
      unenteredHouseholds: items.reduce((acc, i) => acc + i.unenteredHouseholds, 0),
      avgRate: items.length > 0 ? Math.round(items.reduce((acc, i) => acc + i.completionRate, 0) / items.length) : 0
    }));
  }, [filteredProgressList]);

  // Thống kê KPI tổng hợp
  const progressKPI = useMemo(() => {
    const totalAreas = filteredProgressList.length;
    const activeAreas = filteredProgressList.filter(item => item.totalHouseholds > 0).length;
    const totalAssigned = filteredProgressList.reduce((acc, item) => acc + item.totalHouseholds, 0);
    const totalDone = filteredProgressList.reduce((acc, item) => acc + item.completedHouseholds, 0);
    const totalDoing = filteredProgressList.reduce((acc, item) => acc + item.inProgressHouseholds, 0);
    const totalWaiting = filteredProgressList.reduce((acc, item) => acc + item.unenteredHouseholds, 0);
    const overallRate = totalAssigned > 0 ? Math.round((totalDone / totalAssigned) * 100) : 0;
    const areas100Percent = filteredProgressList.filter(item => item.totalHouseholds > 0 && item.completionRate === 100).length;

    return {
      totalAreas,
      activeAreas,
      totalAssigned,
      totalDone,
      totalDoing,
      totalWaiting,
      overallRate,
      areas100Percent
    };
  }, [filteredProgressList]);

  const progressNoticeAreas = useMemo(() => {
    if (progressNotice?.type === 'areas') return filteredProgressList;
    if (progressNotice?.type === 'completedAreas') {
      return filteredProgressList.filter(item =>
        item.totalHouseholds > 0 && item.completionRate === 100
      );
    }
    return [];
  }, [filteredProgressList, progressNotice]);

  const progressNoticeHouseholds = useMemo(() => {
    if (!progressNotice || progressNotice.type === 'areas' || progressNotice.type === 'completedAreas') return [];
    const matchingHouseholds = filteredProgressList.flatMap(item =>
      item.householdsList
        .filter(household => {
          const isComplete =
            household.surveyStatus === 'DA_HOAN_THANH' ||
            household.surveyStatus === 'DA_DUYET' ||
            household.surveyStatus === 'COMPLETED' ||
            household.surveyStatus === 'HOAN_THANH';
          const isInProgress =
            household.surveyStatus === 'DANG_NHAP' ||
            household.surveyStatus === 'IN_PROGRESS';
          if (progressNotice.type === 'assigned') return true;
          if (progressNotice.type === 'completed') return isComplete;
          if (progressNotice.type === 'inProgress') return isInProgress;
          return !isComplete && !isInProgress;
        })
        .map(household => ({ household, area: item }))
    );
    const uniqueHouseholds = new Map<string, (typeof matchingHouseholds)[number]>();
    matchingHouseholds.forEach(item => {
      if (!uniqueHouseholds.has(item.household.id)) {
        uniqueHouseholds.set(item.household.id, item);
      }
    });
    return Array.from(uniqueHouseholds.values());
  }, [filteredProgressList, progressNotice]);

  // Xuất file Excel báo cáo tiến độ
  const handleExportExcelProgress = () => {
    try {
      const wb = XLSX.utils.book_new();
      const wsData: any[][] = [
        ['BÁO CÁO TIẾN ĐỘ NHẬP TIN ĐIỀU TRA THU NHẬP (THEO ĐỊA BÀN & XÃ)'],
        [`Ngày xuất báo cáo: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN')}`],
        [],
        [
          'STT', 
          'Mã TKCS', 
          'Tên TKCS', 
          'Mã xã', 
          'Tên xã', 
          'Mã địa bàn', 
          'Tên địa bàn', 
          'Tên Người nhập / ĐTV', 
          'Tổng số hộ', 
          'Đã nhập', 
          'Chưa nhập', 
          'Tiến độ (%)'
        ]
      ];

      filteredProgressList.forEach((item, index) => {
        wsData.push([
          index + 1,
          item.tkcsCode,
          item.tkcsName,
          item.communeCode,
          item.communeName,
          item.areaCode,
          item.areaName,
          item.assignedSurveyorName,
          item.totalHouseholds,
          item.completedHouseholds,
          item.unenteredHouseholds,
          `${item.completionRate}%`
        ]);
      });

      // Dòng tổng cộng
      wsData.push([]);
      wsData.push([
        'TỔNG CỘNG',
        '',
        '',
        '',
        '',
        '',
        '',
        `${filteredProgressList.length} địa bàn`,
        progressKPI.totalAssigned,
        progressKPI.totalDone,
        progressKPI.totalWaiting,
        `${progressKPI.overallRate}%`
      ]);

      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'TienDoDiaBan');
      XLSX.writeFile(wb, `Bao_Cao_Tien_Do_Theo_Dia_Ban_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showNotification('success', 'Đã xuất file Excel báo cáo tiến độ địa bàn thành công!');
    } catch (e: any) {
      showNotification('error', 'Lỗi xuất Excel: ' + e.message);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full pb-10">
      
      {/* BANNER & KPI CARDS */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 flex flex-col gap-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="font-extrabold text-slate-800 text-sm md:text-base uppercase flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-teal-700" />
              <span>Tiến độ Nhập tin theo từng Địa bàn & Xã (Quy chuẩn 10 hộ chính thức/địa bàn)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Thống kê trực quan tiến độ thực hiện điều tra thu nhập, theo dõi số hộ đã nhập, chưa nhập và phân công điều tra viên tự động.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportExcelProgress}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất dữ liệu Excel</span>
            </button>
          </div>
        </div>

        {/* KPI Mini Cards */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => setProgressNotice({ title: 'Danh sách địa bàn', type: 'areas' })}
            className="text-left bg-sky-50 border border-sky-200 hover:border-sky-400 hover:bg-sky-100 rounded p-2.5 flex flex-col cursor-pointer transition-colors"
            title="Bấm để xem các địa bàn trong phạm vi đang lọc"
          >
            <span className="text-[11px] text-sky-800 font-bold uppercase">Tổng địa bàn</span>
            <span className="text-base font-black text-sky-950 mt-0.5">{progressKPI.totalAreas}</span>
          </button>
          <button
            type="button"
            onClick={() => setProgressNotice({ title: 'Địa bàn đã hoàn thành 100%', type: 'completedAreas' })}
            className="text-left bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 rounded p-2.5 flex flex-col cursor-pointer transition-colors"
            title="Bấm để xem danh sách địa bàn đã hoàn thành 100%"
          >
            <span className="text-[11px] text-emerald-800 font-bold uppercase">Đã hoàn thành 100%</span>
            <span className="text-base font-black text-emerald-950 mt-0.5">{progressKPI.areas100Percent} địa bàn</span>
          </button>
          <button
            type="button"
            onClick={() => setProgressNotice({ title: 'Danh sách hộ được giao', type: 'assigned' })}
            className="text-left bg-teal-50 border border-teal-200 hover:border-teal-400 hover:bg-teal-100 rounded p-2.5 flex flex-col cursor-pointer transition-colors"
            title="Bấm để xem danh sách hộ trong các địa bàn đang lọc"
          >
            <span className="text-[11px] text-teal-800 font-bold uppercase">Tổng số hộ giao</span>
            <span className="text-base font-black text-teal-950 mt-0.5">{progressKPI.totalAssigned.toLocaleString()} hộ</span>
          </button>
          <button
            type="button"
            onClick={() => setProgressNotice({ title: 'Danh sách hộ đã hoàn thành', type: 'completed' })}
            className="text-left bg-emerald-50 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 rounded p-2.5 flex flex-col cursor-pointer transition-colors"
            title="Bấm để xem danh sách hộ đã hoàn thành hoặc được duyệt"
          >
            <span className="text-[11px] text-emerald-800 font-bold uppercase">Đã hoàn thành</span>
            <span className="text-base font-black text-emerald-800 mt-0.5">{progressKPI.totalDone.toLocaleString()} hộ</span>
          </button>
          <button
            type="button"
            onClick={() => setProgressNotice({ title: 'Danh sách hộ đang nhập', type: 'inProgress' })}
            className="text-left bg-amber-50 border border-amber-200 hover:border-amber-400 hover:bg-amber-100 rounded p-2.5 flex flex-col cursor-pointer transition-colors"
            title="Bấm để xem danh sách hộ đang nhập"
          >
            <span className="text-[11px] text-amber-800 font-bold uppercase">Đang nhập</span>
            <span className="text-base font-black text-amber-800 mt-0.5">{progressKPI.totalDoing.toLocaleString()} hộ</span>
          </button>
          <button
            type="button"
            onClick={() => setProgressNotice({ title: 'Danh sách hộ chưa nhập', type: 'notEntered' })}
            className="text-left bg-rose-50 border border-rose-200 hover:border-rose-400 hover:bg-rose-100 rounded p-2.5 flex flex-col cursor-pointer transition-colors"
            title="Bấm để xem danh sách hộ chưa nhập"
          >
            <span className="text-[11px] text-rose-800 font-bold uppercase">Chưa nhập</span>
            <span className="text-base font-black text-rose-800 mt-0.5">{progressKPI.totalWaiting.toLocaleString()} hộ ({progressKPI.overallRate}% xong)</span>
          </button>
        </div>
      </div>

      {/* TOOLBAR BỘ LỌC TẬP TRUNG & CHUYỂN ĐỔI DẠNG HIỂN THỊ */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-2xs p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lọc TKCS */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">Tổ TKCS:</span>
            <select
              value={tkcsFilter}
              onChange={e => {
                setTkcsFilter(e.target.value);
                setCommuneFilter('ALL');
              }}
              className="h-8 bg-slate-50 border border-slate-300 rounded px-2.5 font-medium text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              <option value="ALL">-- Tất cả {uniqueTkcsList.length} Tổ TKCS --</option>
              {uniqueTkcsList.map(tk => (
                <option key={tk.code} value={tk.code}>{tk.code} - {tk.name}</option>
              ))}
            </select>
          </div>

          {/* Lọc Xã */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">Xã/Phường:</span>
            <select
              value={communeFilter}
              onChange={e => setCommuneFilter(e.target.value)}
              className="h-8 bg-slate-50 border border-slate-300 rounded px-2.5 font-medium text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              <option value="ALL">-- Tất cả xã ({filteredCommunesForFilter.length} xã) --</option>
              {filteredCommunesForFilter.map(c => (
                <option key={c.id} value={c.id}>[{c.communeCode}] {c.communeName}</option>
              ))}
            </select>
          </div>

          {/* Lọc Trạng thái tiến độ */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-700 whitespace-nowrap">Tiến độ:</span>
            <select
              value={progressStatusFilter}
              onChange={e => setProgressStatusFilter(e.target.value as any)}
              className="h-8 bg-slate-50 border border-slate-300 rounded px-2.5 font-medium text-slate-800 focus:outline-none focus:border-teal-600 cursor-pointer"
            >
              <option value="ALL">Tất cả tiến độ</option>
              <option value="DONE">✓ Đã hoàn thành 100%</option>
              <option value="DOING">⏳ Đang nhập (1% - 99%)</option>
              <option value="NOT_STARTED">⚠️ Chưa nhập hộ nào (0%)</option>
            </select>
          </div>
        </div>

        {/* Ô tìm kiếm */}
        <div className="relative min-w-[200px] md:w-56">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm tên địa bàn, mã xã, tên ĐTV..."
            className="h-8 w-full pl-8 pr-3 bg-slate-50 border border-slate-300 rounded text-xs focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      {/* THANH CHUYỂN ĐỔI CHẾ ĐỘ XEM: DẠNG LƯỚI / DẠNG NHÓM THEO ĐTV */}
      <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-300 shadow-2xs text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-3.5 py-1.5 rounded font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              viewMode === 'grid'
                ? 'bg-teal-700 text-white shadow-xs scale-102'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>1. Danh sách Dạng Lưới Chi Tiết</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`px-3.5 py-1.5 rounded font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
              viewMode === 'grouped'
                ? 'bg-teal-700 text-white shadow-xs scale-102'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ListTree className="w-4 h-4" />
            <span>2. Danh sách Dạng Nhóm (Theo Điều tra viên)</span>
          </button>
        </div>

        <div className="text-slate-600 font-semibold">
          Đang hiển thị <span className="font-bold text-teal-800">{filteredProgressList.length}</span> địa bàn ({progressKPI.totalAssigned} hộ)
        </div>
      </div>

      {/* ---------------- CHẾ ĐỘ 1: DẠNG LƯỚI CHI TIẾT ---------------- */}
      {viewMode === 'grid' && (
        <div className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
            <table className="w-full text-xs border-collapse">
              <thead className="sticky top-0 z-20 bg-[#058da0] text-white shadow-xs select-none">
                <tr className="text-center font-bold">
                  <th className="border border-[#047484] p-2.5 w-12 bg-[#058da0]">STT</th>
                  <th className="border border-[#047484] p-2.5 w-24 bg-[#058da0]">Mã TKCS</th>
                  <th className="border border-[#047484] p-2.5 text-left min-w-[150px] bg-[#058da0]">Tên TKCS</th>
                  <th className="border border-[#047484] p-2.5 w-20 bg-[#058da0]">Mã xã</th>
                  <th className="border border-[#047484] p-2.5 text-left min-w-[160px] bg-[#058da0]">Tên xã</th>
                  <th className="border border-[#047484] p-2.5 w-20 bg-[#058da0]">Mã địa bàn</th>
                  <th className="border border-[#047484] p-2.5 text-left min-w-[180px] bg-[#058da0]">Tên địa bàn</th>
                  <th className="border border-[#047484] p-2.5 text-left min-w-[160px] bg-[#058da0]">Tên Người nhập / ĐTV</th>
                  <th className="border border-[#047484] p-2.5 w-20 bg-[#058da0]">Tổng số hộ</th>
                  <th className="border border-[#047484] p-2.5 w-20 bg-[#058da0] text-emerald-200">Đã nhập</th>
                  <th className="border border-[#047484] p-2.5 w-20 bg-[#058da0] text-rose-200">Chưa nhập</th>
                  <th className="border border-[#047484] p-2.5 min-w-[140px] bg-[#058da0]">Tiến độ (%)</th>
                  <th className="border border-[#047484] p-2.5 w-20 bg-[#058da0]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                {filteredProgressList.map((item, idx) => {
                  const isComplete = item.totalHouseholds > 0 && item.completionRate === 100;
                  const hasNoHH = item.totalHouseholds === 0;

                  return (
                    <tr 
                      key={item.id}
                      className={`hover:bg-[#e6f6f8] transition-colors ${
                        idx % 2 === 1 ? 'bg-[#f7fcfe]' : 'bg-white'
                      }`}
                    >
                      <td className="p-2 border border-slate-300 text-center text-slate-500 font-normal">
                        {idx + 1}
                      </td>

                      <td className="p-2 border border-slate-300 text-center font-mono font-bold text-slate-700">
                        {item.tkcsCode}
                      </td>

                      <td className="p-2 border border-slate-300 text-left font-semibold text-slate-900">
                        {item.tkcsName}
                      </td>

                      <td className="p-2 border border-slate-300 text-center font-mono font-bold text-sky-900">
                        {item.communeCode}
                      </td>

                      <td className="p-2 border border-slate-300 text-left font-bold text-sky-950">
                        {item.communeName}
                      </td>

                      <td className="p-2 border border-slate-300 text-center font-mono font-bold text-emerald-900">
                        {item.areaCode}
                      </td>

                      <td className="p-2 border border-slate-300 text-left font-bold text-slate-900">
                        {item.areaName}
                      </td>

                      <td className="p-2 border border-slate-300 text-left text-slate-800">
                        {item.assignedSurveyorName !== '---' ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToHouseholdEntry?.(item.assignedSurveyorName, item.area.id, item.commune?.id)}
                            className="px-2 py-1 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 border border-purple-300 hover:border-purple-500 text-purple-900 font-bold rounded text-[11px] cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs group"
                            title={`Bấm vào đây để liên kết sang phần "Nhập tin hộ" và lọc toàn bộ hộ của ĐTV [${item.assignedSurveyorName}]`}
                          >
                            <UserCheck className="w-3.5 h-3.5 text-purple-700 group-hover:scale-110 transition-transform" />
                            <span className="underline decoration-purple-400 group-hover:decoration-purple-900">{item.assignedSurveyorName}</span>
                            <ExternalLink className="w-3 h-3 text-purple-500 shrink-0" />
                          </button>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Chưa phân công</span>
                        )}
                      </td>

                      {/* Tổng số hộ */}
                      <td className="p-2 border border-slate-300 text-center font-bold text-slate-900">
                        {item.totalHouseholds}
                      </td>

                      {/* Đã nhập */}
                      <td className="p-2 border border-slate-300 text-center font-bold text-emerald-700 bg-emerald-50/50">
                        {item.completedHouseholds}
                      </td>

                      {/* Chưa nhập */}
                      <td className="p-2 border border-slate-300 text-center font-bold text-rose-700 bg-rose-50/40">
                        {item.unenteredHouseholds}
                      </td>

                      {/* Tiến độ (%) */}
                      <td className="p-2 border border-slate-300">
                        {hasNoHH ? (
                          <span className="text-slate-400 italic text-[11px]">Không có hộ</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                              <div 
                                className={`h-2.5 rounded-full transition-all duration-300 ${
                                  isComplete 
                                    ? 'bg-emerald-600' 
                                    : item.completionRate >= 50 
                                    ? 'bg-sky-600' 
                                    : item.completionRate > 0 
                                    ? 'bg-amber-500' 
                                    : 'bg-slate-300'
                                }`}
                                style={{ width: `${item.completionRate}%` }}
                              />
                            </div>
                            <span className={`w-10 text-right font-bold text-[11px] ${
                              isComplete 
                                ? 'text-emerald-700 font-black' 
                                : item.completionRate >= 50 
                                ? 'text-sky-700' 
                                : item.completionRate > 0 
                                ? 'text-amber-700' 
                                : 'text-slate-500'
                            }`}>
                              {item.completionRate}%
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Thao tác */}
                      <td className="p-2 border border-slate-300 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedAreaDetail(item)}
                          disabled={item.totalHouseholds === 0}
                          className={`px-2 py-1 rounded text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition-all cursor-pointer shadow-2xs ${
                            item.totalHouseholds > 0
                              ? 'bg-[#058da0] hover:bg-[#047484] text-white active:scale-95'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                          title="Xem danh sách chi tiết các hộ của địa bàn này"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Xem</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {filteredProgressList.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-slate-400 italic">
                      Không tìm thấy địa bàn nào phù hợp với bộ lọc tìm kiếm.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------- CHẾ ĐỘ 2: DẠNG NHÓM THEO ĐIỀU TRA VIÊN ---------------- */}
      {viewMode === 'grouped' && (
        <div className="flex flex-col gap-4">
          {groupedBySurveyorList.map((group, groupIdx) => (
            <div key={group.surveyorName} className="bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden">
              
              {/* Header của Nhóm ĐTV */}
              <div className="bg-[#026c7c] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-300" />
                  <span className="font-extrabold text-sm">
                    Nhóm #{groupIdx + 1}: Điều tra viên / Người nhập: <span className="text-amber-300 font-black">{group.surveyorName}</span>
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold flex-wrap">
                  <span>Số địa bàn: <strong className="text-white">{group.items.length}</strong></span>
                  <span>Tổng hộ: <strong className="text-white">{group.totalHouseholds}</strong></span>
                  <span className="text-emerald-200">Đã xong: <strong>{group.completedHouseholds}</strong></span>
                  <span className="text-rose-200">Chưa nhập: <strong>{group.unenteredHouseholds}</strong></span>
                  <span className="px-2 py-0.5 bg-emerald-700/80 rounded text-emerald-100 font-bold">
                    Tiến độ: {group.totalHouseholds > 0 ? Math.round((group.completedHouseholds / group.totalHouseholds) * 100) : 0}%
                  </span>
                  {group.surveyorName !== 'Chưa phân công điều tra viên' && (
                    <button
                      type="button"
                      onClick={() => onNavigateToHouseholdEntry?.(group.surveyorName)}
                      className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-all hover:scale-102"
                      title={`Bấm để chuyển sang phần "Nhập tin hộ" lọc toàn bộ ${group.totalHouseholds} hộ của ĐTV [${group.surveyorName}]`}
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-900" />
                      <span>Mở {group.totalHouseholds} hộ ở Nhập tin hộ</span>
                      <ExternalLink className="w-3 h-3 text-slate-900" />
                    </button>
                  )}
                </div>
              </div>

              {/* Bảng chi tiết các địa bàn trong nhóm này */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <tr className="text-center">
                      <th className="border-r border-slate-300 p-2 w-12">STT</th>
                      <th className="border-r border-slate-300 p-2 w-24">Mã TKCS</th>
                      <th className="border-r border-slate-300 p-2 text-left min-w-[140px]">Tên TKCS</th>
                      <th className="border-r border-slate-300 p-2 w-20">Mã xã</th>
                      <th className="border-r border-slate-300 p-2 text-left min-w-[150px]">Tên xã</th>
                      <th className="border-r border-slate-300 p-2 w-20">Mã địa bàn</th>
                      <th className="border-r border-slate-300 p-2 text-left min-w-[160px]">Tên địa bàn</th>
                      <th className="border-r border-slate-300 p-2 text-left min-w-[150px]">Tên Người nhập</th>
                      <th className="border-r border-slate-300 p-2 w-20">Tổng số hộ</th>
                      <th className="border-r border-slate-300 p-2 w-20 text-emerald-800">Đã nhập</th>
                      <th className="border-r border-slate-300 p-2 w-20 text-rose-800">Chưa nhập</th>
                      <th className="border-r border-slate-300 p-2 min-w-[130px]">Tiến độ (%)</th>
                      <th className="p-2 w-20">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium text-slate-800">
                    {group.items.map((item, itemIdx) => {
                      const isComplete = item.totalHouseholds > 0 && item.completionRate === 100;
                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2 border-r border-slate-200 text-center text-slate-500">{itemIdx + 1}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-slate-700">{item.tkcsCode}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-semibold text-slate-900">{item.tkcsName}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-sky-900">{item.communeCode}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-bold text-sky-950">{item.communeName}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-mono font-bold text-emerald-900">{item.areaCode}</td>
                          <td className="p-2 border-r border-slate-200 text-left font-bold text-slate-900">{item.areaName}</td>
                          <td className="p-2 border-r border-slate-200 text-left text-slate-800 font-semibold">
                            {item.assignedSurveyorName !== '---' ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToHouseholdEntry?.(item.assignedSurveyorName, item.area.id, item.commune?.id)}
                                className="text-left font-bold text-purple-900 hover:text-purple-950 underline decoration-purple-300 hover:decoration-purple-800 cursor-pointer flex items-center gap-1"
                                title={`Bấm để liên kết sang Nhập tin hộ cho ĐTV [${item.assignedSurveyorName}]`}
                              >
                                <span>{item.assignedSurveyorName}</span>
                                <ExternalLink className="w-3 h-3 text-purple-600 shrink-0" />
                              </button>
                            ) : (
                              <span className="text-slate-400 italic font-normal">Chưa phân công</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold">{item.totalHouseholds}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold text-emerald-700 bg-emerald-50/40">{item.completedHouseholds}</td>
                          <td className="p-2 border-r border-slate-200 text-center font-bold text-rose-700 bg-rose-50/40">{item.unenteredHouseholds}</td>
                          <td className="p-2 border-r border-slate-200">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-2 rounded-full ${isComplete ? 'bg-emerald-600' : 'bg-sky-600'}`}
                                  style={{ width: `${item.completionRate}%` }}
                                />
                              </div>
                              <span className="w-9 text-right font-bold text-[11px]">{item.completionRate}%</span>
                            </div>
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => setSelectedAreaDetail(item)}
                              className="px-2 py-1 bg-[#058da0] hover:bg-[#047484] text-white rounded text-[11px] font-bold cursor-pointer transition-colors shadow-2xs flex items-center justify-center gap-1 mx-auto"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Xem</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          ))}

          {groupedBySurveyorList.length === 0 && (
            <div className="bg-white rounded-lg border border-slate-300 p-8 text-center text-slate-400 italic">
              Không có dữ liệu tiến độ nhóm theo điều tra viên.
            </div>
          )}
        </div>
      )}

      {/* MODAL CHI TIẾT DANH SÁCH HỘ CỦA ĐỊA BÀN ĐƯỢC CHỌN */}
      {selectedAreaDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-in fade-in duration-150">
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-4xl w-full max-h-[88vh] flex flex-col text-xs overflow-hidden">
            
            {/* Header Modal */}
            <div className="bg-[#058da0] text-white p-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="font-bold text-sm">
                    Chi tiết danh sách hộ • Xã {selectedAreaDetail.communeName} • Địa bàn: {selectedAreaDetail.areaName} (ĐB {selectedAreaDetail.areaCode})
                  </h3>
                  <p className="text-[11px] text-teal-100">
                    Người nhập / ĐTV: {selectedAreaDetail.assignedSurveyorName} • Tổng số: {selectedAreaDetail.totalHouseholds} hộ • Đã xong: {selectedAreaDetail.completedHouseholds} • Chưa nhập: {selectedAreaDetail.unenteredHouseholds} ({selectedAreaDetail.completionRate}%)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const sName = selectedAreaDetail.assignedSurveyorName !== '---' ? selectedAreaDetail.assignedSurveyorName : '';
                    const aId = selectedAreaDetail.area.id;
                    const cId = selectedAreaDetail.commune?.id;
                    setSelectedAreaDetail(null);
                    onNavigateToHouseholdEntry?.(sName, aId, cId);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-teal-50 text-teal-900 font-bold rounded text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  title="Chuyển sang tab Nhập tin hộ và lọc toàn bộ hộ của địa bàn này"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-teal-700" />
                  <span>Mở ở Nhập tin hộ</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAreaDetail(null)}
                  className="text-white hover:bg-[#047484] p-1.5 rounded cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body: Danh sách hộ */}
            <div className="p-3.5 overflow-y-auto flex-1 flex flex-col gap-3">
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0">
                    <tr className="border-b border-slate-300 text-center">
                      <th className="p-2 border-r border-slate-200 w-10">STT</th>
                      <th className="p-2 border-r border-slate-200 text-left min-w-[120px]">Xã / Phường</th>
                      <th className="p-2 border-r border-slate-200 text-left min-w-[130px]">Địa bàn (Tên sheet)</th>
                      <th className="p-2 border-r border-slate-200 w-16">STT Mẫu</th>
                      <th className="p-2 border-r border-slate-200 text-left min-w-[140px]">Họ và tên chủ hộ</th>
                      <th className="p-2 border-r border-slate-200 text-left min-w-[150px]">Địa chỉ</th>
                      <th className="p-2 border-r border-slate-200 w-14">Nhân khẩu</th>
                      <th className="p-2 border-r border-slate-200 w-24">Trạng thái phiếu</th>
                      <th className="p-2 w-20">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedAreaDetail.householdsList.map((h, i) => {
                      const isDone = h.surveyStatus === 'DA_HOAN_THANH' || h.surveyStatus === 'DA_DUYET';
                      const isDoing = h.surveyStatus === 'DANG_NHAP';
                      const areaName = (h as any).sheetName || h.areaName || `ĐB ${h.areaCode}`;

                      return (
                        <tr key={h.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-1.5 text-center text-slate-500 border-r border-slate-200">{i + 1}</td>
                          <td className="p-1.5 text-left font-semibold text-slate-800 border-r border-slate-200">{h.communeName || h.communeCode}</td>
                          <td className="p-1.5 text-left font-medium text-sky-800 border-r border-slate-200">
                            ĐB {h.areaCode} - {areaName}
                          </td>
                          <td className="p-1.5 text-center font-bold text-slate-800 border-r border-slate-200">{h.sttMau}</td>
                          <td className="p-1.5 text-left font-bold text-slate-900 border-r border-slate-200">{h.householdHead}</td>
                          <td className="p-1.5 text-left text-slate-600 border-r border-slate-200">{h.address || '---'}</td>
                          <td className="p-1.5 text-center font-semibold text-slate-800 border-r border-slate-200">{h.membersCount}</td>
                          <td className="p-1.5 text-center border-r border-slate-200">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              h.surveyStatus === 'DA_DUYET'
                                ? 'bg-purple-100 text-purple-900 border border-purple-300'
                                : isDone
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : isDoing
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}>
                              {h.surveyStatus === 'DA_DUYET' 
                                ? 'Đã duyệt' 
                                : isDone 
                                ? 'Đã xong' 
                                : isDoing 
                                ? 'Đang nhập' 
                                : 'Chưa nhập'}
                            </span>
                          </td>
                          <td className="p-1.5 text-center">
                            {onOpenHouseholdForm && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAreaDetail(null);
                                  onOpenHouseholdForm(h);
                                }}
                                className="px-2 py-0.5 bg-sky-700 hover:bg-sky-600 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-2xs"
                                title="Mở phiếu điều tra của hộ này để nhập tin / xem phiếu"
                              >
                                Vào phiếu
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-600 font-medium">
                Đang hiển thị {selectedAreaDetail.householdsList.length} hộ gia đình thuộc địa bàn này.
              </span>
              <button
                type="button"
                onClick={() => setSelectedAreaDetail(null)}
                className="px-4 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded font-bold cursor-pointer transition-colors"
              >
                Đóng
              </button>
            </div>

          </div>
        </div>
      )}

      {progressNotice && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label={progressNotice.title}
        >
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-5xl w-full max-h-[88vh] flex flex-col text-xs overflow-hidden">
            <div className="bg-[#058da0] text-white p-3.5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">{progressNotice.title}</h3>
                <p className="text-[11px] text-teal-100 mt-0.5">
                  {progressNotice.type === 'areas' || progressNotice.type === 'completedAreas'
                    ? `${progressNoticeAreas.length} địa bàn trong phạm vi đang lọc`
                    : `${progressNoticeHouseholds.length} hộ có thông tin chi tiết trên máy này`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProgressNotice(null)}
                className="text-white hover:bg-[#047484] p-1.5 rounded cursor-pointer transition-colors"
                aria-label="Đóng danh sách tiến độ"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 overflow-auto flex-1">
              {(progressNotice.type === 'areas' || progressNotice.type === 'completedAreas') ? (
                progressNoticeAreas.length > 0 ? (
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0">
                      <tr className="text-left">
                        <th className="p-2 border border-slate-200">TKCS / Xã</th>
                        <th className="p-2 border border-slate-200">Địa bàn</th>
                        <th className="p-2 border border-slate-200">ĐTV</th>
                        <th className="p-2 border border-slate-200 text-center">Hoàn thành</th>
                        <th className="p-2 border border-slate-200 text-center">Tiến độ</th>
                        <th className="p-2 border border-slate-200 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressNoticeAreas.map(item => (
                        <tr key={item.id} className="hover:bg-sky-50">
                          <td className="p-2 border border-slate-200">
                            {item.tkcsCode} • [{item.communeCode}] {item.communeName}
                          </td>
                          <td className="p-2 border border-slate-200">
                            {item.areaName} ({item.areaCode})
                          </td>
                          <td className="p-2 border border-slate-200">{item.assignedSurveyorName}</td>
                          <td className="p-2 border border-slate-200 text-center">
                            {item.completedHouseholds}/{item.totalHouseholds}
                          </td>
                          <td className="p-2 border border-slate-200 text-center font-bold text-emerald-700">
                            {item.completionRate}%
                          </td>
                          <td className="p-2 border border-slate-200 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setProgressNotice(null);
                                setSelectedAreaDetail(item);
                              }}
                              className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold cursor-pointer"
                            >
                              Xem hộ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-slate-500 py-8">Không có địa bàn phù hợp với thông báo này.</p>
                )
              ) : progressNoticeHouseholds.length > 0 ? (
                <>
                  <p className="text-[11px] text-slate-600 mb-2">
                    Danh sách hộ lấy từ bảng kê cục bộ. Firebase chỉ lưu số đếm tiến độ, không lưu thông tin từng hộ.
                  </p>
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold sticky top-0">
                      <tr className="text-left">
                        <th className="p-2 border border-slate-200">Xã</th>
                        <th className="p-2 border border-slate-200">Địa bàn</th>
                        <th className="p-2 border border-slate-200">STT mẫu</th>
                        <th className="p-2 border border-slate-200">Chủ hộ</th>
                        <th className="p-2 border border-slate-200">ĐTV</th>
                        <th className="p-2 border border-slate-200">Trạng thái</th>
                        <th className="p-2 border border-slate-200">Cập nhật</th>
                        <th className="p-2 border border-slate-200 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progressNoticeHouseholds.map(({ household, area }) => {
                        const isComplete =
                          household.surveyStatus === 'DA_HOAN_THANH' ||
                          household.surveyStatus === 'DA_DUYET' ||
                          household.surveyStatus === 'COMPLETED' ||
                          household.surveyStatus === 'HOAN_THANH';
                        const isInProgress =
                          household.surveyStatus === 'DANG_NHAP' ||
                          household.surveyStatus === 'IN_PROGRESS';
                        const statusLabel = household.surveyStatus === 'DA_DUYET'
                          ? 'Đã duyệt'
                          : isComplete
                            ? 'Đã hoàn thành'
                            : isInProgress
                              ? 'Đang nhập'
                              : 'Chưa nhập';
                        return (
                          <tr key={household.id} className="hover:bg-sky-50">
                            <td className="p-2 border border-slate-200">
                              [{household.communeCode}] {household.communeName}
                            </td>
                            <td className="p-2 border border-slate-200">
                              {area.areaName} ({area.areaCode})
                            </td>
                            <td className="p-2 border border-slate-200 text-center">{household.sttMau}</td>
                            <td className="p-2 border border-slate-200 font-semibold">{household.householdHead}</td>
                            <td className="p-2 border border-slate-200">{household.assignedSurveyorName || area.assignedSurveyorName}</td>
                            <td className="p-2 border border-slate-200">{statusLabel}</td>
                            <td className="p-2 border border-slate-200">
                              {household.updatedAt ? new Date(household.updatedAt).toLocaleString('vi-VN') : '—'}
                            </td>
                            <td className="p-2 border border-slate-200 text-center">
                              {onOpenHouseholdForm && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProgressNotice(null);
                                    onOpenHouseholdForm(household);
                                  }}
                                  className="px-2 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold cursor-pointer"
                                >
                                  Mở phiếu
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              ) : (
                <p className="text-center text-slate-500 py-8">
                  Không có hộ chi tiết cục bộ phù hợp. Nếu tiến độ đến từ Firebase, hãy nạp file kết quả ĐTV trên máy Admin để có danh sách từng hộ.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
