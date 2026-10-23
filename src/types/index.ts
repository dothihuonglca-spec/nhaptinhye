/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SurveyStatus } from './user';
import { FullQuestionnaire } from './questionnaire';

export * from './user';
export * from './questionnaire';
export * from './industrialSurvey';

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
}
