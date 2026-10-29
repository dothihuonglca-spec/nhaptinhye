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

export function getAreaProgressKey(communeCode: string | undefined, areaCode: string | undefined): string {
  const normalizedCommuneCode = communeCode?.trim() || '';
  const normalizedAreaCode = areaCode?.trim() || '';
  return normalizedCommuneCode && normalizedAreaCode
    ? `${normalizedCommuneCode}_${normalizedAreaCode}`
    : '';
}

export function isOfficialSurveyHousehold(household: Pick<Household, 'sampleStatus' | 'sttMau'>): boolean {
  const status = (household.sampleStatus || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .trim();
  if (status.includes('CHINH THUC')) return true;
  if (
    household.sttMau?.trim().toUpperCase() === 'DP' ||
    status.includes('DU PHONG') ||
    status.includes('RESERVE') ||
    status === 'DP' ||
    status.includes('DA THAY THE')
  ) {
    return false;
  }
  return true;
}

/** Một hộ chính thức chưa hoàn thành hoặc còn thiếu thông tin khi Admin nạp file kết quả của ĐTV. */
export interface IncompleteHouseholdInfo {
  communeName: string;
  areaCode: string;
  sttMau: string;
  householdHead: string;
  surveyorName: string;
  /** Chưa nhập | Đang nhập dở | Thiếu thông tin / số liệu chưa hợp lệ */
  status: string;
  reasons: string[];
}

/** Số hộ chính thức chuẩn của mỗi địa bàn. */
export const OFFICIAL_HOUSEHOLDS_PER_AREA = 10;

const COMPLETED_SURVEY_STATUSES = ['DA_HOAN_THANH', 'DA_DUYET', 'COMPLETED', 'HOAN_THANH'];
const IN_PROGRESS_SURVEY_STATUSES = ['DANG_NHAP', 'IN_PROGRESS'];

/** MỘT định nghĩa duy nhất cho "hộ đã hoàn thành" – dùng cho ghi Firebase, bảng tiến độ và danh sách hộ. */
export function isCompletedSurveyStatus(status?: string): boolean {
  return COMPLETED_SURVEY_STATUSES.includes(status || '');
}

/** MỘT định nghĩa duy nhất cho "hộ đang nhập". */
export function isInProgressSurveyStatus(status?: string): boolean {
  return IN_PROGRESS_SURVEY_STATUSES.includes(status || '');
}

/**
 * Chọn đúng 10 hộ chính thức của một địa bàn, KẾT QUẢ GIỐNG NHAU trên mọi máy:
 * - chỉ lấy hộ chính thức;
 * - các hộ trùng STT mẫu (trừ STT trống/"DP") chỉ giữ 1 hộ: ưu tiên hộ đã hoàn thành > đang nhập > chưa nhập, rồi hộ cập nhật mới hơn;
 * - sắp theo STT mẫu tăng dần rồi mới cắt lấy 10 hộ (không phụ thuộc thứ tự mảng trên từng máy).
 */
export function selectOfficialHouseholds<T extends Household>(households: T[]): T[] {
  const rank = (h: T) => isCompletedSurveyStatus(h.surveyStatus) ? 2 : isInProgressSurveyStatus(h.surveyStatus) ? 1 : 0;
  const time = (h: T) => {
    const t = Date.parse(h.updatedAt || '');
    return Number.isFinite(t) ? t : 0;
  };
  const best = new Map<string, T>();
  households.filter(isOfficialSurveyHousehold).forEach(h => {
    const stt = (h.sttMau || '').trim().toUpperCase();
    const key = stt && stt !== 'DP'
      ? `stt:${/^\d+$/.test(stt) ? String(Number(stt)) : stt}`
      : `id:${h.id}`;
    const current = best.get(key);
    if (!current || rank(h) > rank(current) || (rank(h) === rank(current) && time(h) > time(current))) {
      best.set(key, h);
    }
  });
  const sttNumber = (h: T) => /^\d+$/.test((h.sttMau || '').trim()) ? Number(h.sttMau) : Number.MAX_SAFE_INTEGER;
  return Array.from(best.values())
    .sort((a, b) =>
      sttNumber(a) - sttNumber(b) ||
      (a.sttMau || '').localeCompare(b.sttMau || '', 'vi', { numeric: true }) ||
      a.id.localeCompare(b.id)
    )
    .slice(0, OFFICIAL_HOUSEHOLDS_PER_AREA);
}

/**
 * Chọn MỘT bản ghi tiến độ trên Firebase cho một địa bàn (không cộng dồn):
 * - nếu biết ĐTV đang được giao địa bàn → chỉ nhận bản ghi của ĐTV đó (bỏ bản ghi cũ của ĐTV đã bị đổi);
 * - nếu chưa biết ai được giao → lấy bản ghi mới nhất.
 */
export function pickAreaCloudSnapshot(
  snapshots: AreaProgressSnapshot[],
  assignedSurveyorIds: Set<string>
): AreaProgressSnapshot | null {
  const time = (snapshot: AreaProgressSnapshot) => {
    const t = Date.parse(snapshot.updatedAt || '');
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
  };
  const latest = (list: AreaProgressSnapshot[]) =>
    list.reduce<AreaProgressSnapshot | null>((best, item) => (!best || time(item) >= time(best) ? item : best), null);
  if (snapshots.length === 0) return null;
  if (assignedSurveyorIds.size > 0) {
    return latest(snapshots.filter(item => assignedSurveyorIds.has(item.surveyorId)));
  }
  return latest(snapshots);
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
      entry.households.length === 0 ||
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
  const areaCode = area.code.trim();
  const communeCode = (commune.communeCode || commune.id).trim();
  const areaProgressKey = getAreaProgressKey(communeCode, areaCode);
  const areaHouseholds = selectOfficialHouseholds(
    households.filter(h => {
      const householdCommuneCode = h.communeCode?.trim() || (h.communeId === commune.id ? communeCode : '');
      return getAreaProgressKey(householdCommuneCode, h.areaCode) === areaProgressKey;
    })
  );
  const completedHouseholds = areaHouseholds.filter(h => isCompletedSurveyStatus(h.surveyStatus)).length;
  const inProgressHouseholds = areaHouseholds.filter(h => isInProgressSurveyStatus(h.surveyStatus)).length;

  return {
    id: `${encodeURIComponent(surveyorId)}_${encodeURIComponent(areaProgressKey)}`,
    surveyorId: surveyorId || '',
    surveyorName: surveyorName || '',
    areaId: area.id || '',
    communeId: commune.id || '',
    communeCode: commune.communeCode || communeCode,
    communeName: commune.communeName || '',
    areaCode,
    areaName: area.name || '',
    totalHouseholds: areaHouseholds.length,
    completedHouseholds,
    inProgressHouseholds,
    updatedAt: new Date().toISOString()
  };
}

export function getAreaAssignmentKeys(
  area: Pick<SurveyArea, 'id' | 'code' | 'communeCode'> & { communeId?: string }
): string[] {
  return [
    area.id,
    `${area.communeId}_${area.code}`,
    `${area.communeCode}_${area.code}`,
    `${area.communeCode}${area.code}`,
    `${area.communeId}${area.code}`
  ].filter((key): key is string => Boolean(key?.trim())).map(key => key.trim());
}

export function isAreaAssigned(
  area: Pick<SurveyArea, 'id' | 'code' | 'communeCode'> & { communeId?: string },
  assignedAreas: string[]
): boolean {
  if (assignedAreas.some(key => key.trim() === 'ALL')) return true;
  const assignedKeys = new Set(assignedAreas.map(key => key.trim()));
  return getAreaAssignmentKeys(area).some(key => assignedKeys.has(key));
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

// ---------------------------------------------------------------------------
// Đối chiếu tiến độ Firebase với dữ liệu trên máy Admin
// ---------------------------------------------------------------------------

export type CloudReconcileStatus =
  | 'MISSING_COMMUNE'   // Xã chưa có trong danh mục trên máy Admin
  | 'MISSING_AREA'      // Có xã nhưng chưa tải bảng kê/địa bàn này về máy
  | 'BEHIND'            // Có địa bàn nhưng máy Admin ít phiếu hoàn thành hơn Firebase
  | 'SURVEYOR_MISMATCH' // Firebase có bản ghi nhưng không khớp ĐTV đang được phân công
  | 'IN_SYNC';          // Máy Admin đã đủ so với Firebase

export interface CloudReconcileItem {
  key: string;
  status: CloudReconcileStatus;
  snapshot: AreaProgressSnapshot;
  localCompleted: number;
  localTotal: number;
}

export const CLOUD_RECONCILE_LABELS: Record<CloudReconcileStatus, string> = {
  MISSING_COMMUNE: 'Chưa có xã trong danh mục máy Admin',
  MISSING_AREA: 'Chưa tải bảng kê/địa bàn về máy Admin',
  BEHIND: 'Máy Admin thiếu phiếu so với Firebase',
  SURVEYOR_MISMATCH: 'Lệch ĐTV phụ trách',
  IN_SYNC: 'Đã khớp'
};

/**
 * So từng bản ghi tiến độ trên Firebase với địa bàn/hộ đang có trên máy Admin.
 * Mỗi (xã, địa bàn) chỉ trả về một dòng: bản ghi Firebase mới nhất.
 */
export function reconcileCloudProgress(
  cloudProgress: AreaProgressSnapshot[],
  communes: Commune[],
  areas: SurveyArea[],
  households: Household[],
  surveyors: Surveyor[]
): CloudReconcileItem[] {
  const time = (s: AreaProgressSnapshot) => {
    const t = Date.parse(s.updatedAt || '');
    return Number.isFinite(t) ? t : Number.NEGATIVE_INFINITY;
  };

  const communeByAny = new Map<string, Commune>();
  communes.forEach(c => {
    if (c.id) communeByAny.set(c.id.trim(), c);
    if (c.communeCode) communeByAny.set(c.communeCode.trim(), c);
  });
  const resolveCode = (communeId?: string, communeCode?: string) =>
    (communeByAny.get((communeCode || '').trim()) || communeByAny.get((communeId || '').trim()))?.communeCode?.trim() ||
    (communeCode || '').trim();

  const localAreaKeys = new Set<string>();
  areas.forEach(a => {
    const key = getAreaProgressKey(resolveCode(a.communeId, a.communeCode), a.code);
    if (key) localAreaKeys.add(key);
  });
  const householdsByKey = new Map<string, Household[]>();
  households.forEach(h => {
    const key = getAreaProgressKey(resolveCode(h.communeId, h.communeCode), h.areaCode);
    if (!key) return;
    localAreaKeys.add(key);
    const list = householdsByKey.get(key) || [];
    list.push(h);
    householdsByKey.set(key, list);
  });

  // Mỗi địa bàn giữ lại bản ghi Firebase mới nhất; gom thêm danh sách ĐTV có bản ghi
  const latestByKey = new Map<string, AreaProgressSnapshot>();
  const allByKey = new Map<string, AreaProgressSnapshot[]>();
  cloudProgress.forEach(snapshot => {
    const key = getAreaProgressKey(snapshot.communeCode, snapshot.areaCode) || `id:${snapshot.areaId}`;
    const list = allByKey.get(key) || [];
    list.push(snapshot);
    allByKey.set(key, list);
    const best = latestByKey.get(key);
    if (!best || time(snapshot) >= time(best)) latestByKey.set(key, snapshot);
  });

  // ĐTV được phân công theo từng địa bàn (từ quyền địa bàn + hộ đã gán)
  const surveyorIdsByKey = new Map<string, Set<string>>();
  const addOwner = (key: string, id: string) => {
    if (!key || !id) return;
    const set = surveyorIdsByKey.get(key) || new Set<string>();
    set.add(id);
    surveyorIdsByKey.set(key, set);
  };
  areas.forEach(area => {
    const key = getAreaProgressKey(resolveCode(area.communeId, area.communeCode), area.code);
    surveyors.forEach(s => {
      if (s.role !== 'SURVEYOR') return;
      if (isAreaAssigned({ ...area, communeId: area.communeId }, s.assignedAreas || [])) addOwner(key, s.id);
    });
  });
  householdsByKey.forEach((list, key) => {
    list.forEach(h => h.assignedSurveyorId && addOwner(key, h.assignedSurveyorId));
  });

  const result: CloudReconcileItem[] = [];
  latestByKey.forEach((snapshot, key) => {
    const official = selectOfficialHouseholds(householdsByKey.get(key) || []);
    const localCompleted = official.filter(h => isCompletedSurveyStatus(h.surveyStatus)).length;
    const localTotal = official.length;
    const communeCode = (snapshot.communeCode || '').trim();
    const hasCommune = communeByAny.has(communeCode) || communeByAny.has((snapshot.communeId || '').trim());

    let status: CloudReconcileStatus;
    if (!localAreaKeys.has(key)) {
      status = hasCommune ? 'MISSING_AREA' : 'MISSING_COMMUNE';
    } else if (localTotal === 0) {
      status = 'MISSING_AREA';
    } else if (localCompleted < snapshot.completedHouseholds) {
      status = 'BEHIND';
    } else {
      const owners = surveyorIdsByKey.get(key);
      const anyOwnerMatches = !owners || owners.size === 0 ||
        (allByKey.get(key) || []).some(s => owners.has(s.surveyorId));
      status = anyOwnerMatches ? 'IN_SYNC' : 'SURVEYOR_MISMATCH';
    }
    result.push({ key, status, snapshot, localCompleted, localTotal });
  });

  const order: Record<CloudReconcileStatus, number> = {
    MISSING_COMMUNE: 0, MISSING_AREA: 1, BEHIND: 2, SURVEYOR_MISMATCH: 3, IN_SYNC: 4
  };
  return result.sort((a, b) =>
    order[a.status] - order[b.status] ||
    a.snapshot.communeCode.localeCompare(b.snapshot.communeCode, 'vi', { numeric: true }) ||
    a.snapshot.areaCode.localeCompare(b.snapshot.areaCode, 'vi', { numeric: true })
  );
}

// ---------------------------------------------------------------------------
// Hộ thay thế (hộ dự phòng được chuyển thành hộ chính thức) khi nạp JSON của ĐTV
// ---------------------------------------------------------------------------

function foldText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'D')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Hộ mẫu cũ đã bị thay (sampleStatus = "ĐÃ THAY THẾ"). */
export function isReplacedSampleStatus(sampleStatus?: string): boolean {
  return foldText(sampleStatus).includes('DA THAY THE');
}

/** Hộ được ghi rõ là chính thức. */
export function isOfficialSampleStatus(sampleStatus?: string): boolean {
  return foldText(sampleStatus).includes('CHINH THUC');
}

/**
 * Ghi chú do app tự thêm khi thay thế: "[Thay thế cho hộ mẫu: TÊN (Gốc: STT_GỐC) - Lý do: ...]".
 * Có ghi chú này nghĩa là hộ đó là hộ dự phòng đã được đưa vào thay một hộ mẫu.
 */
export function parseReplacementNote(note?: string): { originalHead: string; originalSttGoc: string } | null {
  const match = (note || '').match(/\[Thay thế cho hộ mẫu:\s*(.+?)\s*\(Gốc:\s*([^)]*)\)/i);
  if (!match) return null;
  return { originalHead: match[1].trim(), originalSttGoc: match[2].trim() };
}

/** Hộ dự phòng đã thay vào vị trí hộ chính thức. */
export function isReplacementHousehold(h: Pick<Household, 'sampleStatus' | 'note'>): boolean {
  return isOfficialSampleStatus(h.sampleStatus) && parseReplacementNote(h.note) !== null;
}

export function sameHouseholdName(a?: string, b?: string): boolean {
  return foldText(a) !== '' && foldText(a) === foldText(b);
}

/**
 * Tìm hộ trong cùng địa bàn theo (STT gốc, tên chủ hộ). Chỉ trả về khi duy nhất,
 * không lệ thuộc STT mẫu (hộ thay thế có thể mang lại STT mẫu của hộ bị thay).
 */
export function findHouseholdBySourceKey<T extends Household>(
  list: T[],
  isInArea: (household: T) => boolean,
  sttGoc?: string,
  householdHead?: string
): number {
  const goc = (sttGoc || '').trim();
  if (!goc || !householdHead?.trim()) return -1;
  const found: number[] = [];
  list.forEach((household, index) => {
    if (
      isInArea(household) &&
      (household.sttGoc || '').trim() === goc &&
      sameHouseholdName(household.householdHead, householdHead)
    ) found.push(index);
  });
  return found.length === 1 ? found[0] : -1;
}

/**
 * Đánh dấu hộ mẫu gốc của một hộ thay thế là "ĐÃ THAY THẾ" (nếu còn là hộ chính thức).
 * Trả về chỉ số hộ đã đổi, hoặc -1 nếu không tìm thấy / đã được đánh dấu từ trước.
 */
export function markOriginalAsReplaced<T extends Household>(
  list: T[],
  isInArea: (household: T) => boolean,
  replacement: Pick<Household, 'householdHead' | 'sttGoc' | 'note' | 'updatedAt'>,
  fallbackTime: string
): number {
  const info = parseReplacementNote(replacement.note);
  if (!info) return -1;
  let index = findHouseholdBySourceKey(list, isInArea, info.originalSttGoc, info.originalHead);
  if (index < 0) {
    // Dự phòng: chỉ khớp theo STT gốc khi duy nhất trong địa bàn
    const bySttGoc = list
      .map((household, i) => ({ household, i }))
      .filter(({ household }) => isInArea(household) && (household.sttGoc || '').trim() === info.originalSttGoc);
    if (bySttGoc.length === 1) index = bySttGoc[0].i;
  }
  if (index < 0) return -1;
  const original = list[index];
  if (isReplacedSampleStatus(original.sampleStatus)) return -1;
  list[index] = {
    ...original,
    sampleStatus: 'ĐÃ THAY THẾ',
    note: (original.note ? `${original.note} | ` : '') +
      `[Đã thay bằng hộ dự phòng: ${replacement.householdHead} (Gốc: ${replacement.sttGoc || ''})]`,
    updatedAt: replacement.updatedAt || fallbackTime
  };
  return index;
}
