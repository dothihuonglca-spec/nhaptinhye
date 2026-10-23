import * as XLSX from 'xlsx';

export interface CommuneItem {
  id: string;
  communeCode: string;
  communeName: string;
  tkcsCode?: string;
  tkcsName?: string;
  [key: string]: any;
}

export interface SurveyAreaItem {
  id: string;
  communeId: string;
  communeCode?: string;
  code: string;
  name: string;
  householdCount?: number;
  [key: string]: any;
}

export interface SurveyorItem {
  id: string;
  code: string;
  username: string;
  name: string;
  role: string;
  department?: string;
  departmentId?: string;
  position?: string;
  assignedAreas?: string[];
  assignedCommunes?: string[];
  [key: string]: any;
}

export interface HouseholdItem {
  id: string;
  communeId: string;
  communeCode?: string;
  areaId: string;
  areaCode: string;
  assignedSurveyorId?: string;
  assignedSurveyorName?: string;
  [key: string]: any;
}

export interface ParsedSurveyorAssignment {
  surveyor: SurveyorItem;
  areaIds: string[];
  areaLabels: string[];
  communeIds: string[];
  communeNames: string[];
  rowCount: number;
}

export interface ParsedPermissionResult {
  totalRows: number;
  validRows: number;
  assignments: ParsedSurveyorAssignment[];
  warnings: string[];
}

/**
 * Xuất file mẫu Excel phân công / phân quyền địa bàn
 */
export function exportPermissionExcelTemplate(
  communes: CommuneItem[],
  areas: SurveyAreaItem[],
  surveyors: SurveyorItem[],
  households: HouseholdItem[]
) {
  const wb = XLSX.utils.book_new();

  // Helper map households to area count
  const areaHhCountMap = new Map<string, number>();
  const areaSurveyorMap = new Map<string, { id: string; name: string }>();
  households.forEach(h => {
    const key = `${h.communeId}_${h.areaCode}`;
    areaHhCountMap.set(key, (areaHhCountMap.get(key) || 0) + 1);
    areaHhCountMap.set(h.areaId, (areaHhCountMap.get(h.areaId) || 0) + 1);
    if (h.assignedSurveyorId) {
      areaSurveyorMap.set(key, { id: h.assignedSurveyorId, name: h.assignedSurveyorName || '' });
      areaSurveyorMap.set(h.areaId, { id: h.assignedSurveyorId, name: h.assignedSurveyorName || '' });
    }
  });

  // 1. Sheet Phân công địa bàn (9 cột chuẩn theo đúng ảnh người dùng cung cấp)
  const sheetData: any[][] = [
    [
      'STT',
      'Mã TKCS',
      'Tên TKCS',
      'Mã xã',
      'Tên xã',
      'Mã địa bàn',
      'Tên địa bàn',
      'Tên Người nhập / ĐTV',
      'Tổng số hộ'
    ]
  ];

  let stt = 1;

  // Lặp qua danh sách xã & địa bàn để điền sẵn vào mẫu
  communes.forEach(commune => {
    const commAreas = areas.filter(
      a => a.communeId === commune.id || (Boolean(commune.communeCode) && a.communeCode === commune.communeCode)
    );

    commAreas.forEach(a => {
      const key = `${a.communeId}_${a.code}`;
      const hhCount = areaHhCountMap.get(a.id) || areaHhCountMap.get(key) || a.householdCount || 10;
      
      // Tìm cán bộ đang được phân công nếu có
      let assignedSurveyor: SurveyorItem | undefined;
      const curAssign = areaSurveyorMap.get(a.id) || areaSurveyorMap.get(key);
      if (curAssign) {
        assignedSurveyor = surveyors.find(s => s.id === curAssign.id);
      }
      if (!assignedSurveyor) {
        assignedSurveyor = surveyors.find(s => 
          s.assignedAreas?.includes(a.id) || 
          s.assignedAreas?.includes(key) ||
          (Boolean((a as any).communeCode) && s.assignedAreas?.includes(`${(a as any).communeCode}_${a.code}`))
        );
      }

      sheetData.push([
        stt++,
        commune.tkcsCode || 'TK001',
        commune.tkcsName || 'TKCS',
        commune.communeCode,
        commune.communeName,
        a.code,
        a.name || `${commune.communeCode}-${a.code}`,
        assignedSurveyor ? assignedSurveyor.name : '',
        hhCount
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 6 },  // STT
    { wch: 12 }, // Mã TKCS
    { wch: 22 }, // Tên TKCS
    { wch: 12 }, // Mã xã
    { wch: 22 }, // Tên xã
    { wch: 14 }, // Mã địa bàn
    { wch: 20 }, // Tên địa bàn
    { wch: 26 }, // Tên Người nhập / ĐTV
    { wch: 14 }  // Tổng số hộ
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'PhanCong_DiaBan');

  // 2. Sheet Danh mục cán bộ để tra cứu nhanh khi điền tên ĐTV
  const staffData: any[][] = [
    [
      'STT',
      'Mã cán bộ (Code)',
      'Họ và tên cán bộ (Điền vào cột Tên Người nhập / ĐTV)',
      'Phòng ban phụ trách',
      'Vai trò hệ thống'
    ]
  ];

  surveyors.forEach((s, idx) => {
    staffData.push([
      idx + 1,
      s.code,
      s.name,
      s.department || '',
      s.role === 'SUPERVISOR' ? 'Giám sát viên' : s.role === 'ADMIN' ? 'Quản trị viên' : 'Điều tra viên'
    ]);
  });

  const wsStaff = XLSX.utils.aoa_to_sheet(staffData);
  wsStaff['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 32 },
    { wch: 26 },
    { wch: 20 }
  ];
  XLSX.utils.book_append_sheet(wb, wsStaff, 'DanhSach_CanBo');

  const fileName = `Mau_Phan_Quyen_Dia_Ban_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

/**
 * Đọc và phân tích file Excel phân quyền do người dùng tải lên
 */
export async function parsePermissionExcelFile(
  file: File,
  communes: CommuneItem[],
  areas: SurveyAreaItem[],
  surveyors: SurveyorItem[]
): Promise<ParsedPermissionResult> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: 'array' });

  // Đọc sheet đầu tiên hoặc sheet tên 'PhanCong_DiaBan'
  const sheetName = wb.SheetNames.includes('PhanCong_DiaBan') 
    ? 'PhanCong_DiaBan' 
    : wb.SheetNames[0];

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error('Không tìm thấy bảng tính dữ liệu trong file Excel.');
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
  if (rawRows.length === 0) {
    throw new Error('File Excel rỗng, không có dữ liệu phân công.');
  }

  const warnings: string[] = [];
  let validRows = 0;

  // Map theo surveyorId -> ParsedSurveyorAssignment
  const assignmentMap = new Map<string, ParsedSurveyorAssignment>();

  rawRows.forEach((row, rowIndex) => {
    const rowNum = rowIndex + 2; // Dòng 1 là tiêu đề

    // Lấy thông tin cán bộ (Ưu tiên cột "Tên Người nhập / ĐTV" theo đúng mẫu người dùng)
    const rawName = String(
      row['Tên Người nhập / ĐTV'] ||
      row['Tên Người nhập'] ||
      row['Người nhập'] ||
      row['Họ và tên cán bộ'] ||
      row['Họ và tên'] ||
      row['Tên cán bộ'] ||
      row['ĐTV'] ||
      row['Name'] ||
      ''
    ).trim();

    const rawCode = String(row['Mã cán bộ / ĐTV'] || row['Mã cán bộ'] || row['Mã ĐTV'] || row['Code'] || '').trim();
    const rawUsername = String(row['Tên đăng nhập cán bộ'] || row['Tên đăng nhập'] || row['Username'] || row['Email'] || '').trim();

    if (!rawCode && !rawUsername && !rawName) {
      // Dòng trống không gán cán bộ -> bỏ qua
      return;
    }

    // Tìm cán bộ trong hệ thống theo tên, mã hoặc tên đăng nhập
    const matchedSurveyor = surveyors.find(s => {
      if (rawName && s.name && s.name.trim().toLowerCase() === rawName.trim().toLowerCase()) return true;
      if (rawCode && s.code && s.code.toLowerCase() === rawCode.toLowerCase()) return true;
      if (rawUsername && s.username && s.username.toLowerCase() === rawUsername.toLowerCase()) return true;
      if (rawName && s.code && s.code.toLowerCase() === rawName.toLowerCase()) return true;
      if (rawName && s.username && s.username.toLowerCase() === rawName.toLowerCase()) return true;
      return false;
    });

    if (!matchedSurveyor) {
      warnings.push(`Dòng ${rowNum}: Không tìm thấy cán bộ "${rawName || rawCode || rawUsername}" trong danh sách tài khoản.`);
      return;
    }

    // Lấy thông tin xã
    const rawCommuneCode = String(row['Mã xã'] || row['Mã xã / phường'] || row['Mã Xã'] || row['CommuneCode'] || '').trim();
    const rawCommuneName = String(row['Tên xã'] || row['Tên xã / phường'] || row['Tên Xã'] || row['CommuneName'] || '').trim();

    const matchedCommune = communes.find(c => {
      if (rawCommuneCode && (c.communeCode === rawCommuneCode || c.id === rawCommuneCode)) return true;
      if (rawCommuneName && c.communeName && c.communeName.trim().toLowerCase() === rawCommuneName.trim().toLowerCase()) return true;
      return false;
    });

    // Lấy thông tin địa bàn (Hỗ trợ "Mã địa bàn" hoặc "Mã địa b...")
    const rawAreaCode = String(row['Mã địa bàn'] || row['Mã địa b'] || row['Mã ĐB'] || row['AreaCode'] || '').trim();
    const rawAreaName = String(row['Tên địa bàn'] || row['Tên ĐB'] || row['AreaName'] || '').trim();

    let matchedAreas: SurveyAreaItem[] = [];

    if (matchedCommune) {
      if (!rawAreaCode || rawAreaCode.toUpperCase() === 'ALL' || rawAreaCode.toLowerCase() === 'toàn xã' || rawAreaCode.toLowerCase() === 'tất cả') {
        // Gán toàn bộ địa bàn của xã này
        matchedAreas = areas.filter(a => a.communeId === matchedCommune.id || a.communeCode === matchedCommune.communeCode);
      } else {
        // Chuẩn hóa mã địa bàn (vd "1" -> "001")
        const normCode = rawAreaCode.padStart(3, '0');
        matchedAreas = areas.filter(a => 
          (a.communeId === matchedCommune.id || a.communeCode === matchedCommune.communeCode) &&
          (a.code === rawAreaCode || a.code === normCode || a.id === rawAreaCode || (rawAreaName && a.name === rawAreaName))
        );
      }
    } else if (rawAreaCode) {
      // Tìm theo area code trực tiếp
      const normCode = rawAreaCode.padStart(3, '0');
      matchedAreas = areas.filter(a => a.code === rawAreaCode || a.code === normCode || a.id === rawAreaCode);
    }

    // Khởi tạo hoặc lấy assignment của cán bộ
    let assignObj = assignmentMap.get(matchedSurveyor.id);
    if (!assignObj) {
      assignObj = {
        surveyor: matchedSurveyor,
        areaIds: [],
        areaLabels: [],
        communeIds: [],
        communeNames: [],
        rowCount: 0
      };
      assignmentMap.set(matchedSurveyor.id, assignObj);
    }

    if (matchedCommune) {
      if (!assignObj.communeIds.includes(matchedCommune.id)) {
        assignObj.communeIds.push(matchedCommune.id);
        assignObj.communeNames.push(matchedCommune.communeName);
      }
      if (matchedCommune.communeCode && !assignObj.communeIds.includes(matchedCommune.communeCode)) {
        assignObj.communeIds.push(matchedCommune.communeCode);
      }
    }

    if (matchedAreas.length > 0) {
      matchedAreas.forEach(a => {
        if (!assignObj!.areaIds.includes(a.id)) {
          assignObj!.areaIds.push(a.id);
          assignObj!.areaLabels.push(`ĐB ${a.code} (${matchedCommune ? matchedCommune.communeName : a.communeId})`);
        }
      });
      validRows++;
      assignObj.rowCount++;
    } else if (matchedCommune) {
      // Nếu không tìm thấy area cụ thể nhưng có xã, vẫn hợp lệ cho cấp xã
      validRows++;
      assignObj.rowCount++;
    } else {
      warnings.push(`Dòng ${rowNum}: Cán bộ "${matchedSurveyor.name}" có mã xã "${rawCommuneCode}" hoặc địa bàn "${rawAreaCode}" không khớp trong hệ thống.`);
    }
  });

  return {
    totalRows: rawRows.length,
    validRows,
    assignments: Array.from(assignmentMap.values()),
    warnings
  };
}
