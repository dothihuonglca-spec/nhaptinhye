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
export function exportSingleAreaJson(
  area: { id: string; code: string; name: string; communeId?: string; communeCode?: string },
  allHouseholds: Household[],
  communes: Commune[],
  currentUser: Surveyor,
  modifiedOnly = false
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
    (h.areaCode && h.areaCode === area.code && (!h.communeId || !area.communeId || h.communeId === area.communeId)) ||
    (h.communeCode && h.communeCode === communeCode && h.areaCode === areaCode)
  );

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
    assignedSurveyorId: currentUser.role === 'SURVEYOR' ? currentUser.id : undefined,
    assignedSurveyorName: currentUser.role === 'SURVEYOR' ? currentUser.name : undefined,
    exportedAt: new Date().toISOString(),
    exportedByRole: currentUser.role,
    exportedByName: currentUser.name,
    isModifiedOnly: modifiedOnly,
    householdsCount: areaHhs.length,
    households: areaHhs
  };

  const fileName = getAreaFileName(communeCode, areaCode);
  const content = JSON.stringify(payload, null, 2);

  // Trigger download
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { fileName, count: areaHhs.length, content };
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
