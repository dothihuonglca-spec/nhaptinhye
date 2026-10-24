import type { Department, Surveyor } from '../types/user';
import { createDefaultQuestionnaire } from '../types';
import type { Commune, Household, SurveyArea } from '../types';

export interface LocalDataSnapshot {
  communes: Commune[];
  areas: SurveyArea[];
  households: Household[];
  surveyors: Surveyor[];
  departments: Department[];
}

export interface LocalDataBackupDiagnostics {
  topLevelKeys: string[];
  householdFieldPath: string;
  householdFieldType: string;
  householdArrayLength: number;
  householdObjectCount: number;
  householdRecordsWithId: number;
  householdRecordsWithAreaId: number;
  householdRecordsNestedUnderAreas: number;
  householdRecordsNestedUnderRosters: number;
}

export interface SurveyorEntryBackupRecord {
  id: string;
  areaKey?: string;
  questionnaire: NonNullable<Household['questionnaire']>;
  surveyStatus?: Household['surveyStatus'];
  membersCount?: number;
  membersCountEntered?: boolean;
  workingMembersCount?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface SurveyorEntryBackup {
  exportedAt?: string;
  entries: SurveyorEntryBackupRecord[];
}

const DATABASE_NAME = 'survey-local-data';
const STORE_NAME = 'snapshots';
const CURRENT_KEY = 'current';
const PRE_RESTORE_KEY = 'pre-restore';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt này không hỗ trợ IndexedDB để lưu bản kê dung lượng lớn.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không mở được kho dữ liệu cục bộ.'));
  });
}

export async function loadLocalDataSnapshot(): Promise<LocalDataSnapshot | null> {
  return loadSnapshotByKey(CURRENT_KEY);
}

export async function loadPreRestoreSnapshot(): Promise<LocalDataSnapshot | null> {
  return loadSnapshotByKey(PRE_RESTORE_KEY);
}

async function loadSnapshotByKey(key: string): Promise<LocalDataSnapshot | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly')
        .objectStore(STORE_NAME)
        .get(key);
      request.onsuccess = () => resolve((request.result as LocalDataSnapshot | undefined) || null);
      request.onerror = () => reject(request.error || new Error('Không đọc được dữ liệu cục bộ.'));
    });
  } finally {
    database.close();
  }
}

export async function saveLocalDataSnapshot(
  snapshot: LocalDataSnapshot,
  preRestoreSnapshot?: LocalDataSnapshot
): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(snapshot, CURRENT_KEY);
      if (preRestoreSnapshot) store.put(preRestoreSnapshot, PRE_RESTORE_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error('Không lưu được dữ liệu cục bộ.'));
      transaction.onabort = () => reject(transaction.error || new Error('Đã hủy lưu dữ liệu cục bộ.'));
    });
  } finally {
    database.close();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ''): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function number(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function inspectLocalDataBackup(value: unknown): LocalDataBackupDiagnostics {
  const root = isRecord(value) ? value : {};
  const data = isRecord(root.data) ? root.data : {};
  const householdValue = Array.isArray(root.households) ? root.households : data.households;
  const householdFieldPath = Array.isArray(root.households)
    ? 'households'
    : data.households !== undefined
      ? 'data.households'
      : 'households';
  const rootHouseholds = Array.isArray(householdValue) ? householdValue : [];
  const householdRecords = rootHouseholds.filter(isRecord);
  const surveyAreas = recordsFrom(root.surveyAreas) || [];
  const rootAreas = recordsFrom(root.areas);
  const areas = rootAreas?.length ? rootAreas : surveyAreas;
  const rosters = recordsFrom(root.rosters) || [];
  const householdRecordsNestedUnderAreas = areas.reduce((count, area) =>
    count + (Array.isArray(area.households) ? area.households.filter(isRecord).length : 0), 0);
  const householdRecordsNestedUnderRosters = rosters.reduce((count, roster) =>
    count + (Array.isArray(roster.households) ? roster.households.filter(isRecord).length : 0), 0);

  return {
    topLevelKeys: Object.keys(root),
    householdFieldPath,
    householdFieldType: Array.isArray(householdValue)
      ? 'array'
      : householdValue === undefined
        ? 'missing'
        : typeof householdValue,
    householdArrayLength: rootHouseholds.length,
    householdObjectCount: householdRecords.length,
    householdRecordsWithId: householdRecords.filter(record => Boolean(text(record.id).trim())).length,
    householdRecordsWithAreaId: householdRecords.filter(record =>
      Boolean(text(record.areaId).trim() || text(record.areaCode).trim())
    ).length,
    householdRecordsNestedUnderAreas,
    householdRecordsNestedUnderRosters
  };
}

function recordsFrom(value: unknown): Record<string, unknown>[] | null {
  const records = Array.isArray(value)
    ? value
    : isRecord(value)
      ? Object.values(value)
      : null;
  if (!records || records.some(record => !isRecord(record))) return null;
  return records as Record<string, unknown>[];
}

export function parseSurveyorEntryBackup(value: unknown): SurveyorEntryBackup {
  const isRawEntryArray = Array.isArray(value);
  const backup = isRecord(value) ? value : undefined;
  if (!isRawEntryArray && (!backup || backup.format !== 'tnh-entries-backup' || backup.version !== 1)) {
    throw new Error('Đây không phải file backup phiếu ĐTV được hỗ trợ.');
  }
  const rawEntries = isRawEntryArray ? value : backup?.entries;
  if (!Array.isArray(rawEntries) || rawEntries.length === 0) {
    throw new Error('File backup không có danh sách phiếu.');
  }

  const ids = new Set<string>();
  const entries = rawEntries.map((record): SurveyorEntryBackupRecord => {
    if (
      !isRecord(record) ||
      typeof record.id !== 'string' ||
      !record.id ||
      (!isRawEntryArray && (
        typeof record.areaKey !== 'string' ||
        !record.areaKey
      )) ||
      !isRecord(record.questionnaire)
    ) {
      throw new Error('File backup có phiếu thiếu mã hộ, địa bàn hoặc nội dung phiếu.');
    }
    if (ids.has(record.id)) {
      throw new Error('File backup có mã hộ bị lặp; chưa khôi phục dữ liệu nào.');
    }
    ids.add(record.id);

    const validStatuses = [
      'PENDING', 'IN_PROGRESS', 'COMPLETED', 'CHUA_NHAP',
      'DANG_NHAP', 'HOAN_THANH', 'DA_HOAN_THANH', 'DA_DUYET'
    ];
    if (record.surveyStatus !== undefined &&
      (typeof record.surveyStatus !== 'string' || !validStatuses.includes(record.surveyStatus))) {
      throw new Error('File backup có trạng thái phiếu không hợp lệ.');
    }
    for (const field of ['membersCount', 'workingMembersCount'] as const) {
      if (record[field] !== undefined &&
        (typeof record[field] !== 'number' || !Number.isFinite(record[field]))) {
        throw new Error('File backup có số liệu nhân khẩu không hợp lệ.');
      }
    }
    if (record.membersCountEntered !== undefined && typeof record.membersCountEntered !== 'boolean') {
      throw new Error('File backup có trạng thái nhập nhân khẩu không hợp lệ.');
    }

    return {
      id: record.id,
      ...(typeof record.areaKey === 'string' ? { areaKey: record.areaKey } : {}),
      questionnaire: {
        ...createDefaultQuestionnaire(),
        ...record.questionnaire
      },
      ...(typeof record.surveyStatus === 'string'
        ? { surveyStatus: record.surveyStatus as Household['surveyStatus'] }
        : {}),
      ...(typeof record.membersCount === 'number' ? { membersCount: record.membersCount } : {}),
      ...(typeof record.membersCountEntered === 'boolean'
        ? { membersCountEntered: record.membersCountEntered }
        : {}),
      ...(typeof record.workingMembersCount === 'number'
        ? { workingMembersCount: record.workingMembersCount }
        : {}),
      ...(typeof record.updatedAt === 'string' ? { updatedAt: record.updatedAt } : {}),
      ...(typeof record.updatedBy === 'string' ? { updatedBy: record.updatedBy } : {})
    };
  });

  return {
    ...(typeof backup?.exportedAt === 'string' ? { exportedAt: backup.exportedAt } : {}),
    entries
  };
}

export function parseLocalDataBackup(
  value: unknown,
  currentSurveyors: Surveyor[],
  currentDepartments: Department[]
): LocalDataSnapshot {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.communes)) {
    const availableKeys = isRecord(value) ? Object.keys(value).join(', ') : 'không có object JSON ở cấp ngoài';
    throw new Error(
      `Không nhận diện được bản sao lưu cục bộ: cần version 1 và communes là mảng. Các trường cấp ngoài tìm thấy: ${availableKeys || 'không có'}.`
    );
  }

  const communes = value.communes.filter(isRecord).map(raw => ({
    ...raw,
    id: text(raw.id),
    tkcsCode: text(raw.tkcsCode),
    tkcsName: text(raw.tkcsName),
    communeCode: text(raw.communeCode),
    communeName: text(raw.communeName)
  })) as Commune[];
  if (communes.length !== value.communes.length || communes.some(commune =>
    !commune.id || !commune.communeCode || !commune.communeName
  )) {
    throw new Error('Danh sách xã trong file sao lưu thiếu mã hoặc tên xã.');
  }
  const communesByCode = new Map<string, Commune>();
  communes.forEach(commune => {
    if (!communesByCode.has(commune.communeCode)) {
      communesByCode.set(commune.communeCode, commune);
    }
  });

  const data = isRecord(value.data) ? value.data : {};
  const householdValue = Array.isArray(value.households) ? value.households : data.households;
  const rootHouseholds = Array.isArray(householdValue)
    ? householdValue.filter(isRecord)
    : [];
  if (Array.isArray(householdValue) && rootHouseholds.length !== householdValue.length) {
    throw new Error('Danh sách hộ trong file sao lưu không hợp lệ.');
  }

  const areasFromAreas = recordsFrom(value.areas);
  const areasFromSurveyAreas = recordsFrom(value.surveyAreas);
  let areaRecords = areasFromAreas?.length
    ? areasFromAreas
    : areasFromSurveyAreas;
  if (areaRecords === null) {
    const nestedCommuneAreas = value.communes.flatMap(rawCommune => {
      if (!isRecord(rawCommune)) return [];
      const nestedAreas = recordsFrom(rawCommune.areas);
      return (nestedAreas || []).map(area => ({
        ...area,
        communeId: text(area.communeId, text(rawCommune.id)),
        communeCode: text(area.communeCode, text(rawCommune.communeCode))
      }));
    });
    areaRecords = nestedCommuneAreas.length > 0 ? nestedCommuneAreas : null;
  }

  const rosters = recordsFrom(value.rosters) || [];
  if (areaRecords !== null && rosters.length > 0) {
    const rostersByAreaId = new Map<string, Record<string, unknown>>();
    rosters.forEach(roster => {
      const areaId = text(roster.areaId, text(roster.id));
      if (areaId) rostersByAreaId.set(areaId, roster);
    });
    const matchedRosterIds = new Set<string>();
    areaRecords = areaRecords.map(area => {
      const areaId = text(area.id, text(area.areaId));
      const roster = rostersByAreaId.get(areaId);
      if (!roster) return area;
      matchedRosterIds.add(areaId);
      return {
        ...roster,
        ...area,
        households: roster.households ?? area.households
      };
    });
    const additionalRosters = rosters.filter(roster => {
      const areaId = text(roster.areaId, text(roster.id));
      return areaId && !matchedRosterIds.has(areaId);
    });
    areaRecords = [...areaRecords, ...additionalRosters];
  }

  if (areaRecords === null) {
    const nestedAreaCollections = Object.entries(value)
      .filter(([key, child]) => key !== 'communes' && key !== 'households')
      .flatMap(([, child]) => recordsFrom(child) || [])
      .filter(area => Array.isArray(area.households) && Boolean(area.id || area.areaId));
    areaRecords = nestedAreaCollections.length > 0 ? nestedAreaCollections : null;
  }

  if (areaRecords === null && rootHouseholds.length > 0) {
    const groups = new Map<string, Record<string, unknown>>();
    rootHouseholds.forEach(household => {
      const areaId = text(household.areaId);
      const areaCode = text(household.areaCode);
      const communeCode = text(household.communeCode);
      const key = areaId || `${communeCode}_${areaCode}`;
      if (!key) return;
      const group = groups.get(key) || {
        id: areaId || `area-${communeCode}-${areaCode}`,
        communeId: text(household.communeId),
        communeCode,
        code: areaCode,
        name: text(household.areaName),
        households: []
      };
      (group.households as Record<string, unknown>[]).push(household);
      groups.set(key, group);
    });
    areaRecords = Array.from(groups.values());
  }

  if (areaRecords === null) {
    throw new Error(
      `Không tìm thấy danh sách địa bàn trong backup. Các trường cấp ngoài: ${Object.keys(value).join(', ')}.`
    );
  }
  if (areaRecords.some(area =>
    Array.isArray(area.households) && area.households.some(household => !isRecord(household))
  )) {
    throw new Error('Có hộ trong danh sách địa bàn không đúng định dạng.');
  }
  const nestedHouseholds = areaRecords.flatMap(area =>
    Array.isArray(area.households)
      ? area.households.map(household => ({ area, household: household as Record<string, unknown> }))
      : []
  );
  const householdsById = new Map<string, {
    area?: Record<string, unknown>;
    household: Record<string, unknown>;
  }>();
  nestedHouseholds.forEach(({ area, household }) => {
    const id = text(household.id);
    if (id) householdsById.set(id, { area, household });
  });
  rootHouseholds.forEach(household => {
    const id = text(household.id);
    if (!id) return;
    const nested = householdsById.get(id);
    householdsById.set(id, {
      area: nested?.area,
      household: { ...nested?.household, ...household }
    });
  });
  const householdsSource = Array.from(householdsById.values());

  const areas = areaRecords.map(raw => {
    const firstHousehold = Array.isArray(raw.households)
      ? raw.households.find(isRecord)
      : undefined;
    const communeCode = text(raw.communeCode, text(firstHousehold?.communeCode));
    const commune = communesByCode.get(communeCode);
    const id = text(raw.id, text(raw.areaId));
    const code = text(raw.code, text(raw.areaCode, id.split('-').pop() || ''));
    const name = text(raw.name, text(raw.areaName, text(firstHousehold?.areaName, `Địa bàn ${code}`)));
    return {
      id,
      communeId: text(raw.communeId, commune?.id || ''),
      communeCode,
      code,
      name,
      householdCount: number(raw.householdCount, Array.isArray(raw.households) ? raw.households.length : 0)
    };
  });
  if (areas.some(area => !area.id || !area.code || !area.communeId)) {
    throw new Error('Có địa bàn thiếu mã địa bàn hoặc không ghép được với xã trong file sao lưu.');
  }
  const areasById = new Map<string, SurveyArea>();
  const areasByCommuneAndCode = new Map<string, SurveyArea>();
  areas.forEach(area => {
    if (!areasById.has(area.id)) areasById.set(area.id, area);
    const key = `${area.communeId}_${area.code}`;
    if (!areasByCommuneAndCode.has(key)) areasByCommuneAndCode.set(key, area);
    if (area.communeCode) {
      const communeCodeKey = `${area.communeCode}_${area.code}`;
      if (!areasByCommuneAndCode.has(communeCodeKey)) areasByCommuneAndCode.set(communeCodeKey, area);
    }
  });

  const households = householdsSource.map(({ area, household: raw }) => {
    const areaId = text(raw.areaId, area ? text(area.id, text(area.areaId)) : '');
    const communeCode = text(raw.communeCode, text(area?.communeCode));
    const areaData = areasById.get(areaId) ||
      (area ? areasById.get(text(area.id, text(area.areaId))) : undefined) ||
      areasByCommuneAndCode.get(`${communeCode}_${text(raw.areaCode, text(area?.code, text(area?.areaCode)))}`);
    const resolvedCommuneCode = text(communeCode, areaData?.communeCode || '');
    const commune = communesByCode.get(resolvedCommuneCode);
    const sectorCodeValue = number(raw.sectorCode, 1);
    const sectorCode = ([1, 2, 3, 4].includes(sectorCodeValue) ? sectorCodeValue : 1) as Household['sectorCode'];
    const assignedSurveyorId = text(raw.assignedSurveyorId, area ? text(area.ownerId) : '');
    const assignedSurveyorName = text(raw.assignedSurveyorName, area ? text(area.ownerName) : '');
    return {
      ...raw,
      id: text(raw.id),
      communeId: text(raw.communeId, areaData?.communeId || commune?.id || ''),
      tkcsCode: text(raw.tkcsCode, commune?.tkcsCode || ''),
      tkcsName: text(raw.tkcsName, commune?.tkcsName || ''),
      communeCode: resolvedCommuneCode,
      communeName: text(raw.communeName, commune?.communeName || ''),
      areaId: areaData?.id || areaId,
      areaCode: text(raw.areaCode, areaData?.code || ''),
      areaName: text(raw.areaName, areaData?.name || ''),
      sttMau: text(raw.sttMau),
      sampleStatus: text(raw.sampleStatus, 'CHÍNH THỨC'),
      sttGoc: text(raw.sttGoc),
      householdHead: text(raw.householdHead),
      address: text(raw.address),
      phone: text(raw.phone),
      membersCount: number(raw.membersCount),
      workingMembersCount: number(raw.workingMembersCount),
      sectorCode,
      sectorName: text(raw.sectorName),
      note: text(raw.note),
      assignedSurveyorId: assignedSurveyorId || undefined,
      assignedSurveyorName: assignedSurveyorName || undefined
    } as Household;
  });
  if (households.some(household => !household.id || !household.areaId || !household.communeId)) {
    throw new Error('Có hộ thiếu mã hoặc không ghép được với địa bàn trong file sao lưu.');
  }

  if (Array.isArray(value.surveyors) && value.surveyors.some(surveyor =>
    !isRecord(surveyor) || typeof surveyor.id !== 'string' ||
    typeof surveyor.name !== 'string' || !Array.isArray(surveyor.assignedAreas) ||
    !['ADMIN', 'MANAGER', 'SUPERVISOR', 'SURVEYOR'].includes(text(surveyor.role)) ||
    !['ACTIVE', 'LOCKED', 'INACTIVE'].includes(text(surveyor.status))
  )) {
    throw new Error('Danh sách phân quyền ĐTV trong file sao lưu không hợp lệ.');
  }
  if (Array.isArray(value.departments) && value.departments.some(department =>
    !isRecord(department) || typeof department.id !== 'string' || typeof department.name !== 'string'
  )) {
    throw new Error('Danh sách phòng/ban trong file sao lưu không hợp lệ.');
  }

  const importedSurveyors = Array.isArray(value.surveyors)
    ? value.surveyors.filter(isRecord).map(raw => {
      const existing = currentSurveyors.find(surveyor => surveyor.id === raw.id);
      return { ...raw, password: existing?.password } as Surveyor;
    })
    : currentSurveyors;
  currentSurveyors
    .filter(surveyor => surveyor.role === 'ADMIN' && !importedSurveyors.some(item => item.id === surveyor.id))
    .forEach(admin => importedSurveyors.push(admin));
  const departments = Array.isArray(value.departments)
    ? value.departments.filter(isRecord) as unknown as Department[]
    : currentDepartments;

  return { communes, areas, households, surveyors: importedSurveyors, departments };
}

export function serializeLocalDataBackup(
  snapshot: LocalDataSnapshot,
  backupOwner?: Pick<Surveyor, 'id' | 'role'>
): string {
  return JSON.stringify({
    version: 1,
    cachedAt: new Date().toISOString(),
    ...(backupOwner ? { backupOwner } : {}),
    communes: snapshot.communes,
    areas: snapshot.areas,
    households: snapshot.households,
    surveyors: snapshot.surveyors.map(({ password: _password, ...surveyor }) => surveyor),
    departments: snapshot.departments
  }, null, 2);
}
