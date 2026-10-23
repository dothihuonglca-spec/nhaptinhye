/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Household, SurveyArea, Commune } from '../types';
import { Surveyor } from '../types/user';

export interface AreaJsonPayload {
  type: 'SURVEY_AREA_DATA';
  version: '2.0';
  areaId: string;           // Ghép mã xã với mã địa bàn: [communeCode]_[areaCode]
  communeCode: string;
  communeName: string;
  areaCode: string;
  areaName: string;
  tkcsCode?: string;
  tkcsName?: string;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  exportedAt: string;
  exportedByRole: string;
  exportedByName: string;
  isModifiedOnly: boolean;
  householdsCount: number;
  households: Household[];
}

export interface SurveyWorkPackageEntry {
  surveyorId: string;
  surveyorName: string;
  area: SurveyArea;
  commune: Commune;
  households: Household[];
}

export type SurveyorWorkProfile = Pick<
  Surveyor,
  | 'id'
  | 'code'
  | 'username'
  | 'name'
  | 'role'
  | 'departmentId'
  | 'department'
  | 'position'
  | 'assignedAreas'
  | 'assignedCommunes'
  | 'status'
  | 'mustChangePassword'
  | 'createdAt'
  | 'updatedAt'
>;

export interface SurveyWorkPackage {
  type: 'SURVEY_WORK_PACKAGE';
  version: '1.0';
  purpose: 'ASSIGNMENT' | 'RESULTS';
  exportedAt: string;
  exportedBy: {
    id: string;
    name: string;
    role: Surveyor['role'];
  };
  surveyors?: SurveyorWorkProfile[];
  entries: SurveyWorkPackageEntry[];
}

export interface AreaProgressSnapshot {
  id: string;
  surveyorId: string;
  surveyorName: string;
  areaId: string;
  communeId: string;
  communeCode: string;
  communeName: string;
  areaCode: string;
  areaName: string;
  totalHouseholds: number;
  completedHouseholds: number;
  inProgressHouseholds: number;
  updatedAt: string;
}

export function normalizeSurveyorName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, character => character === 'đ' ? 'd' : 'D')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('vi');
}

export function createSurveyWorkPackage(
  purpose: SurveyWorkPackage['purpose'],
  currentUser: Surveyor,
  entries: SurveyWorkPackageEntry[],
  surveyors: Surveyor[] = []
): SurveyWorkPackage {
  return {
    type: 'SURVEY_WORK_PACKAGE',
    version: '1.0',
    purpose,
    exportedAt: new Date().toISOString(),
    exportedBy: {
      id: currentUser.id,
      name: currentUser.name,
      role: currentUser.role
    },
    surveyors: purpose === 'ASSIGNMENT'
      ? surveyors.map(surveyor => ({
        id: surveyor.id,
        code: surveyor.code,
        username: surveyor.username,
        name: surveyor.name,
        role: surveyor.role,
        departmentId: surveyor.departmentId,
        department: surveyor.department,
        position: surveyor.position,
        assignedAreas: surveyor.assignedAreas,
        assignedCommunes: surveyor.assignedCommunes,
        status: surveyor.status,
        mustChangePassword: surveyor.mustChangePassword,
        createdAt: surveyor.createdAt,
        updatedAt: surveyor.updatedAt
      }))
      : undefined,
    entries
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLegacyAreaResult(data: Record<string, unknown>): SurveyWorkPackage | null {
  if (data.format !== 'tnh-area-package') return null;
  if (data.version !== 1 || data.kind !== 'RESULT') {
    throw new Error('File JSON địa bàn không phải gói kết quả ĐTV hợp lệ.');
  }

  const surveyorId = typeof data.surveyorId === 'string' ? data.surveyorId : '';
  const surveyorName = typeof data.surveyorName === 'string' ? data.surveyorName : '';
  const exportedAt = typeof data.exportedAt === 'string' ? data.exportedAt : '';
  if (!surveyorId || !surveyorName || !exportedAt) {
    throw new Error('File kết quả địa bàn thiếu mã ĐTV, tên ĐTV hoặc thời điểm xuất.');
  }
  if (!Array.isArray(data.households) || data.households.length === 0) {
    throw new Error('File kết quả địa bàn không có danh sách hộ.');
  }

  const households = data.households.map((value): Household => {
    if (!isRecord(value) || typeof value.id !== 'string' || !value.id) {
      throw new Error('File kết quả địa bàn có hộ thiếu mã hộ.');
    }
    const household = value as unknown as Household;
    const sameSurveyorName = normalizeSurveyorName(household.assignedSurveyorName || '') ===
      normalizeSurveyorName(surveyorName);
    if (
      !household.areaId ||
      !household.areaCode ||
      !household.communeId ||
      !household.communeCode ||
      (household.assignedSurveyorId && household.assignedSurveyorId !== surveyorId && !sameSurveyorName)
    ) {
      throw new Error('File kết quả địa bàn có hộ sai địa bàn hoặc không khớp ĐTV xuất file.');
    }
    return {
      ...household,
      assignedSurveyorId: surveyorId,
      assignedSurveyorName: surveyorName
    };
  });

  const firstHousehold = households[0];
  if (households.some(household =>
    household.areaId !== firstHousehold.areaId ||
    household.areaCode !== firstHousehold.areaCode ||
    household.communeId !== firstHousehold.communeId ||
    household.communeCode !== firstHousehold.communeCode
  )) {
    throw new Error('File kết quả địa bàn chứa hộ thuộc nhiều địa bàn hoặc xã.');
  }

  const area: SurveyArea = {
    id: firstHousehold.areaId,
    communeId: firstHousehold.communeId,
    communeCode: firstHousehold.communeCode,
    code: firstHousehold.areaCode,
    name: typeof data.areaName === 'string' ? data.areaName : firstHousehold.areaName,
    householdCount: households.length
  };
  const commune: Commune = {
    id: firstHousehold.communeId,
    communeCode: firstHousehold.communeCode,
    communeName: typeof data.communeName === 'string' ? data.communeName : firstHousehold.communeName,
    tkcsCode: typeof data.tkcsCode === 'string' ? data.tkcsCode : firstHousehold.tkcsCode,
    tkcsName: typeof data.tkcsName === 'string' ? data.tkcsName : firstHousehold.tkcsName
  };

  return {
    type: 'SURVEY_WORK_PACKAGE',
    version: '1.0',
    purpose: 'RESULTS',
    exportedAt,
    exportedBy: { id: surveyorId, name: surveyorName, role: 'SURVEYOR' },
    entries: [{
      surveyorId,
      surveyorName,
      area,
      commune,
      households
    }]
  };
}

export function parseSurveyWorkPackage(text: string): SurveyWorkPackage {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data)) {
    throw new Error('Tệp JSON không chứa gói công việc hợp lệ.');
  }
  const legacyResult = parseLegacyAreaResult(data);
  if (legacyResult) return legacyResult;
  const workPackage = data as Partial<SurveyWorkPackage>;
  const exportedBy = workPackage.exportedBy;
  if (
    workPackage.type !== 'SURVEY_WORK_PACKAGE' ||
    workPackage.version !== '1.0' ||
    !['ASSIGNMENT', 'RESULTS'].includes(workPackage.purpose || '') ||
    !Array.isArray(workPackage.entries) ||
    workPackage.entries.length === 0
  ) {
    throw new Error('Sai định dạng gói công việc hoặc gói không có địa bàn.');
  }
  if (
    !exportedBy?.id ||
    !exportedBy.name ||
    !['ADMIN', 'MANAGER', 'SUPERVISOR', 'SURVEYOR'].includes(exportedBy.role) ||
    (workPackage.purpose === 'ASSIGNMENT' && exportedBy.role === 'SURVEYOR') ||
    (workPackage.purpose === 'RESULTS' && exportedBy.role !== 'SURVEYOR')
  ) {
    throw new Error('Gói JSON thiếu thông tin hoặc sai vai trò người xuất.');
  }

  workPackage.entries.forEach(entry => {
    if (
      !entry?.surveyorId ||
      !entry.surveyorName ||
      !entry.area?.id ||
      !entry.commune?.id ||
      !Array.isArray(entry.households) ||
      entry.households.some(household => !household || typeof household.id !== 'string')
    ) {
      throw new Error('Gói JSON có địa bàn thiếu mã phân công hoặc danh sách hộ.');
    }
    if (workPackage.purpose === 'RESULTS' && entry.surveyorId !== exportedBy.id) {
      throw new Error('Gói kết quả có mã ĐTV không khớp với người xuất file.');
    }
  });
  if (workPackage.purpose === 'ASSIGNMENT' && workPackage.surveyors !== undefined) {
    if (!Array.isArray(workPackage.surveyors) || workPackage.surveyors.some(profile =>
      !profile?.id ||
      typeof profile.name !== 'string' ||
      typeof profile.code !== 'string' ||
      typeof profile.username !== 'string' ||
      profile.role !== 'SURVEYOR' ||
      !['ACTIVE', 'LOCKED', 'INACTIVE'].includes(profile.status) ||
      !Array.isArray(profile.assignedAreas)
    )) {
      throw new Error('Gói phân công có thông tin tài khoản hoặc phân quyền ĐTV không hợp lệ.');
    }
  }
  return workPackage as SurveyWorkPackage;
}

export function createAreaProgressSnapshot(
  surveyorId: string,
  surveyorName: string,
  area: SurveyArea,
  commune: Commune,
  households: Household[]
): AreaProgressSnapshot {
  const areaHouseholds = households
    .filter(h =>
      h.areaId === area.id ||
      (h.areaCode === area.code && (
        h.communeId === area.communeId ||
        h.communeCode === commune.communeCode
      ))
    )
    .filter(h => (h.sampleStatus || 'CHÍNH THỨC') !== 'DỰ PHÒNG')
    .slice(0, 10);
  const completedHouseholds = areaHouseholds.filter(h =>
    h.surveyStatus === 'DA_HOAN_THANH' || h.surveyStatus === 'DA_DUYET'
  ).length;
  const inProgressHouseholds = areaHouseholds.filter(h =>
    h.surveyStatus === 'DANG_NHAP'
  ).length;

  return {
    id: `${encodeURIComponent(surveyorId)}_${encodeURIComponent(area.id)}`,
    surveyorId,
    surveyorName,
    areaId: area.id,
    communeId: commune.id,
    communeCode: commune.communeCode,
    communeName: commune.communeName,
    areaCode: area.code,
    areaName: area.name,
    totalHouseholds: areaHouseholds.length,
    completedHouseholds,
    inProgressHouseholds,
    updatedAt: new Date().toISOString()
  };
}

export function isAreaAssigned(
  area: Pick<SurveyArea, 'id' | 'code' | 'communeCode'> & { communeId?: string },
  assignedAreas: string[]
): boolean {
  if (assignedAreas.includes('ALL')) return true;

  const areaKeys = [
    area.id,
    area.code,
    `${area.communeId}_${area.code}`,
    area.communeId,
    area.communeCode
  ];

  return areaKeys.some(key => key !== undefined && assignedAreas.includes(key));
}

/**
 * Tạo tên file chuẩn theo ID địa bàn: [Mã_xã]_[Mã_địa_bàn].json
 */
export function getAreaFileName(communeCode: string, areaCode: string): string {
  const cCode = (communeCode || '00000').trim();
  const aCode = (areaCode || '001').trim();
  return `${cCode}_${aCode}.json`;
}

/**
 * Kiểm tra xem một hộ có dữ liệu mới làm hoặc mới sửa hay không
 */
export function isHouseholdModified(h: Household): boolean {
  if (h.surveyStatus && h.surveyStatus !== 'CHUA_NHAP' && h.surveyStatus !== 'PENDING') return true;
  if (h.questionnaire) {
    const q = h.questionnaire;
    if (q.muc1_has || q.muc2_has || q.muc3_has || q.muc4_has || q.muc5_has || q.muc6_has || q.muc7_has) return true;
    if ((q.muc1_rows && q.muc1_rows.length > 0) || (q.muc2_cayTrongRows && q.muc2_cayTrongRows.length > 0) || (q.muc6_rows && q.muc6_rows.length > 0)) return true;
  }
  if (h.updatedAt) return true;
  if (h.note && h.note.trim().length > 0) return true;
  return false;
}

/**
 * Xuất file JSON dữ liệu của 1 địa bàn
 */
export function createAreaJson(
  area: { id: string; code: string; name: string; communeId?: string; communeCode?: string },
  allHouseholds: Household[],
  communes: Commune[],
  currentUser: Surveyor,
  modifiedOnly = false,
  assignedSurveyor?: Surveyor
): { fileName: string; count: number; content: string } {
  // Tìm thông tin xã
  const comm = communes.find(c => 
    c.id === area.communeId || 
    (Boolean(c.communeCode) && (c.communeCode === area.communeCode || c.communeCode === area.communeId))
  );
  const communeCode = (comm?.communeCode || area.communeCode || '11992').trim();
  const communeName = (comm?.communeName || 'Xã').trim();
  const areaCode = (area.code || '001').trim();
  const areaName = (area.name || `Địa bàn ${areaCode}`).trim();
  const areaId = `${communeCode}_${areaCode}`;

  // Lọc các hộ thuộc địa bàn này
  let areaHhs = allHouseholds.filter(h => 
    (h.areaId && h.areaId === area.id) ||
    (h.areaCode && h.areaCode === area.code && (
      !area.communeId ||
      h.communeId === area.communeId ||
      h.communeId === communeCode ||
      h.communeCode === communeCode ||
      (!h.communeId && !h.communeCode)
    )) ||
    (h.communeCode && h.communeCode === communeCode && h.areaCode === areaCode)
  );

  if (assignedSurveyor) {
    const hasAreaAssignment = isAreaAssigned(area, assignedSurveyor.assignedAreas || []);
    areaHhs = areaHhs.filter(h => {
      const matchesSurveyor = h.assignedSurveyorId
        ? h.assignedSurveyorId === assignedSurveyor.id
        : !h.assignedSurveyorName || h.assignedSurveyorName === assignedSurveyor.name;
      return hasAreaAssignment || matchesSurveyor;
    });
  }

  // Nếu chỉ xuất những dữ liệu mới làm hoặc mới sửa
  if (modifiedOnly) {
    areaHhs = areaHhs.filter(isHouseholdModified);
  }

  const payload: AreaJsonPayload = {
    type: 'SURVEY_AREA_DATA',
    version: '2.0',
    areaId,
    communeCode,
    communeName,
    areaCode,
    areaName,
    tkcsCode: comm?.tkcsCode || '',
    tkcsName: comm?.tkcsName || '',
    assignedSurveyorId: assignedSurveyor?.id || (currentUser.role === 'SURVEYOR' ? currentUser.id : undefined),
    assignedSurveyorName: assignedSurveyor?.name || (currentUser.role === 'SURVEYOR' ? currentUser.name : undefined),
    exportedAt: new Date().toISOString(),
    exportedByRole: currentUser.role,
    exportedByName: currentUser.name,
    isModifiedOnly: modifiedOnly,
    householdsCount: areaHhs.length,
    households: areaHhs
  };

  const fileName = getAreaFileName(communeCode, areaCode);
  const content = JSON.stringify(payload, null, 2);

  return { fileName, count: areaHhs.length, content };
}

/**
 * Xuất file JSON dữ liệu của 1 địa bàn
 */
export function exportSingleAreaJson(
  area: { id: string; code: string; name: string; communeId?: string; communeCode?: string },
  allHouseholds: Household[],
  communes: Commune[],
  currentUser: Surveyor,
  modifiedOnly = false,
  assignedSurveyor?: Surveyor
): { fileName: string; count: number; content: string } {
  const result = createAreaJson(
    area,
    allHouseholds,
    communes,
    currentUser,
    modifiedOnly,
    assignedSurveyor
  );

  // Trigger download
  const blob = new Blob([result.content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', result.fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return result;
}

/**
 * Xử lý nhập file JSON địa bàn và hợp nhất vào danh sách hộ hiện tại
 */
export function mergeImportedAreaData(
  jsonText: string,
  existingHouseholds: Household[]
): {
  success: boolean;
  message: string;
  mergedHouseholds: Household[];
  updatedCount: number;
  newCount: number;
  areaId: string;
  areaName: string;
} {
  try {
    const data = JSON.parse(jsonText);
    const householdsToImport: Household[] = Array.isArray(data) 
      ? data 
      : Array.isArray(data.households) 
      ? data.households 
      : [];

    if (householdsToImport.length === 0) {
      return {
        success: false,
        message: 'File JSON không chứa danh sách hộ điều tra hợp lệ.',
        mergedHouseholds: existingHouseholds,
        updatedCount: 0,
        newCount: 0,
        areaId: '',
        areaName: ''
      };
    }

    const areaId = data.areaId || (data.communeCode ? `${data.communeCode}_${data.areaCode}` : 'UNKNOWN');
    const areaName = data.areaName || `Địa bàn ${data.areaCode || ''}`;

    let updatedCount = 0;
    let newCount = 0;

    const existingMap = new Map<string, Household>();
    existingHouseholds.forEach(h => {
      existingMap.set(h.id, h);
    });

    // Helper secondary key: communeCode + areaCode + sttMau
    const getSecondaryKey = (h: any) => `${h.communeCode || h.communeId || ''}_${h.areaCode || h.areaId || ''}_${h.sttMau || ''}`;
    const secondaryMap = new Map<string, Household>();
    existingHouseholds.forEach(h => {
      const sk = getSecondaryKey(h);
      if (sk) secondaryMap.set(sk, h);
    });

    householdsToImport.forEach(importH => {
      // Tìm xem hộ đã có trong danh sách chưa (ưu tiên ID, sau đó key phụ)
      let match = existingMap.get(importH.id);
      if (!match) {
        const sk = getSecondaryKey(importH);
        match = secondaryMap.get(sk);
      }

      if (match) {
        // Cập nhật các trường dữ liệu điều tra
        const updatedH: Household = {
          ...match,
          ...importH,
          id: match.id, // Giữ nguyên ID chuẩn
          updatedAt: importH.updatedAt || new Date().toISOString()
        };
        existingMap.set(match.id, updatedH);
        updatedCount++;
      } else {
        // Hộ mới hoàn toàn
        const newH: Household = {
          ...importH,
          id: importH.id || `hh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          updatedAt: importH.updatedAt || new Date().toISOString()
        };
        existingMap.set(newH.id, newH);
        newCount++;
      }
    });

    const mergedList = Array.from(existingMap.values());

    return {
      success: true,
      message: `Đã nạp thành công ${areaName}: cập nhật ${updatedCount} hộ, thêm mới ${newCount} hộ.`,
      mergedHouseholds: mergedList,
      updatedCount,
      newCount,
      areaId,
      areaName
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi đọc file JSON: ' + (err?.message || 'Định dạng không hợp lệ'),
      mergedHouseholds: existingHouseholds,
      updatedCount: 0,
      newCount: 0,
      areaId: '',
      areaName: ''
    };
  }
}
