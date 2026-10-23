/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, 
  Settings, Table, Layers, Building2, Eye, ShieldAlert, 
  ArrowRight, RefreshCw, Sparkles, Check
} from 'lucide-react';

export interface ColumnMappingConfig {
  headerRowIdx: number;       // 0-based index of header row
  dataStartRowIdx: number;    // 0-based index of data start row
  colName: number;            // Họ tên chủ hộ
  colSttMau: number;          // STT mẫu
  colStatus: number;          // Trạng thái mẫu (Chính thức / Dự phòng)
  colSttGoc: number;          // STT gốc
  colAddress: number;         // Địa chỉ
  colMembers: number;         // Số nhân khẩu
  colSector: number;          // Ngành/Nguồn thu (1-4)
  colNote: number;            // Ghi chú / SĐT
  // For Commune list import mode
  colCommuneCode: number;
  colCommuneName: number;
  colTkcsCode: number;
  colTkcsName: number;
}

export interface ExcelHeaderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingCommunes: { id: string; communeCode: string; communeName: string; tkcsCode: string; tkcsName: string }[];
  onFinalizeHouseholdImport: (
    communeData: any,
    areasData: any[],
    householdsData: any[],
    skippedSheets: any[],
    totalParsed: number,
    isOverwrite: boolean,
    oldCommuneIdsToRemove: string[]
  ) => Promise<void>;
  onFinalizeCommuneListImport?: (
    communesList: { id: string; communeCode: string; communeName: string; tkcsCode: string; tkcsName: string }[]
  ) => Promise<void>;
  defaultCommuneCode?: string;
  defaultCommuneName?: string;
  defaultTkcsCode?: string;
  defaultTkcsName?: string;
  initialImportMode?: 'HOUSEHOLDS' | 'COMMUNE_LIST';
}

const DEFAULT_MAPPING: ColumnMappingConfig = {
  headerRowIdx: 7, // 0-based row 8
  dataStartRowIdx: 9, // 0-based row 10
  colName: -1,
  colSttMau: -1,
  colStatus: -1,
  colSttGoc: -1,
  colAddress: -1,
  colMembers: -1,
  colSector: -1,
  colNote: -1,
  colCommuneCode: -1,
  colCommuneName: -1,
  colTkcsCode: -1,
  colTkcsName: -1,
};

const SECTOR_NAMES: Record<number, string> = {
  1: "Nông, lâm thủy sản",
  2: "Công nghiệp xây dựng",
  3: "Thương mại dịch vụ",
  4: "Nguồn thu khác / Lương"
};

export default function ExcelHeaderConfigModal({
  isOpen,
  onClose,
  existingCommunes,
  onFinalizeHouseholdImport,
  onFinalizeCommuneListImport,
  defaultCommuneCode = '',
  defaultCommuneName = '',
  defaultTkcsCode = '',
  defaultTkcsName = '',
  initialImportMode = 'HOUSEHOLDS',
}: ExcelHeaderConfigModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetRawRows, setSheetRawRows] = useState<any[][]>([]);
  const [importMode, setImportMode] = useState<'HOUSEHOLDS' | 'COMMUNE_LIST'>(initialImportMode);

  useEffect(() => {
    if (isOpen) {
      setImportMode(initialImportMode || 'HOUSEHOLDS');
    }
  }, [isOpen, initialImportMode]);

  // Metadata form
  const [communeCode, setCommuneCode] = useState(defaultCommuneCode);
  const [communeName, setCommuneName] = useState(defaultCommuneName);
  const [tkcsCode, setTkcsCode] = useState(defaultTkcsCode || 'TKCS-01');
  const [tkcsName, setTkcsName] = useState(defaultTkcsName || 'Thống kê cơ sở');

  // Column mapping state
  const [mapping, setMapping] = useState<ColumnMappingConfig>(DEFAULT_MAPPING);
  const [applyToAllSheets, setApplyToAllSheets] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Duplicate check modal state inside config
  const [duplicateWarning, setDuplicateWarning] = useState<{
    existing: any;
    incoming: any;
  } | null>(null);

  // Auto detect columns whenever selected sheet or raw rows change
  useEffect(() => {
    if (!sheetRawRows || sheetRawRows.length === 0) return;

    // Scan top 15 rows to find best header row
    let bestHeaderIdx = -1;
    let detectedComName = '';
    let detectedComCode = '';
    let detectedTkcs = '';

    for (let r = 0; r < Math.min(15, sheetRawRows.length); r++) {
      const row = sheetRawRows[r] || [];
      const rowText = row.map(c => String(c || '').toLowerCase().trim()).join(' ');

      row.forEach((cell: any) => {
        const str = String(cell || '').trim();
        if (/Xã\/phường:\s*([^\n\r_]+)/i.test(str)) {
          const m = str.match(/Xã\/phường:\s*([^\n\r_]+)/i);
          if (m && m[1]) detectedComName = m[1].trim();
        } else if (/Xã:\s*([^\n\r_]+)/i.test(str)) {
          const m = str.match(/Xã:\s*([^\n\r_]+)/i);
          if (m && m[1]) detectedComName = m[1].trim();
        }
        if (/Mã xã:\s*([0-9]+)/i.test(str)) {
          const m = str.match(/Mã xã:\s*([0-9]+)/i);
          if (m && m[1]) detectedComCode = m[1].trim();
        }
        if (/TKCS:\s*([^\n\r_]+)/i.test(str)) {
          const m = str.match(/TKCS:\s*([^\n\r_]+)/i);
          if (m && m[1]) detectedTkcs = m[1].trim();
        }
      });

      if (
        (rowText.includes('họ và tên') || rowText.includes('chủ hộ') || rowText.includes('họ tên')) &&
        (rowText.includes('địa chỉ') || rowText.includes('nhân khẩu') || rowText.includes('stt') || rowText.includes('nguồn thu'))
      ) {
        bestHeaderIdx = r;
      }
    }

    if (detectedComName && !communeName) setCommuneName(detectedComName);
    if (detectedComCode && !communeCode) setCommuneCode(detectedComCode);
    if (detectedTkcs && !tkcsCode) setTkcsCode(detectedTkcs);

    const headerIdx = bestHeaderIdx >= 0 ? bestHeaderIdx : 7;
    const headerRow = sheetRawRows[headerIdx] || [];

    // Detect column indexes
    let colName = -1;
    let colSttMau = -1;
    let colStatus = -1;
    let colSttGoc = -1;
    let colAddress = -1;
    let colMembers = -1;
    let colSector = -1;
    let colNote = -1;
    let colCommuneCode = -1;
    let colCommuneName = -1;
    let colTkcsCode = -1;
    let colTkcsName = -1;

    headerRow.forEach((cellVal: any, cIdx: number) => {
      const text = String(cellVal || '').toLowerCase().trim();
      if (text.includes('gốc') || text.includes('mã hộ')) {
        if (colSttGoc === -1) colSttGoc = cIdx;
      } else if (
        text === 'stt' || text === 'tt' || text.startsWith('stt') || text.startsWith('tt') ||
        text.includes('stt mẫu') || text.includes('thứ tự') || text.includes('số tt') || text.includes('số thứ tự')
      ) {
        if (colSttMau === -1) colSttMau = cIdx;
      } else if (text.includes('họ và tên') || text.includes('chủ hộ') || text === 'họ tên' || text.includes('tên chủ hộ')) {
        if (colName === -1) colName = cIdx;
      } else if (text.includes('địa chỉ') || text.includes('thôn') || text.includes('xóm') || text.includes('tổ') || text.includes('đội')) {
        if (colAddress === -1) colAddress = cIdx;
      } else if (
        (text.includes('nhân khẩu') || text.includes('nhân kh') || text.includes('số người') || 
         text.includes('thành viên') || text.includes('số khẩu') || text.includes('số tv') || 
         text.includes('số nk') || text === 'khẩu' || text === 'nk' ||
         (text.includes('thường trú') && !text.includes('địa chỉ') && !text.includes('nơi'))) &&
        !text.includes('thứ tự') && !text.includes('stt')
      ) {
        if (colMembers === -1) colMembers = cIdx;
      } else if (
        (text.includes('phân loại ngành') || text.includes('nguồn thu') || text.includes('thu nhập lớn nhất') || 
         text.includes('ngành kinh tế') || text.includes('mã ngành') || 
         text.includes('mã nguồn thu') || text.includes('nhóm ngành') || text.includes('loại ngành') ||
         (text.includes('ngành') && !text.includes('doanh nghiệp'))) &&
        !text.includes('tổng thu nhập') && !text.includes('tổng thu') && !text.includes('bình quân') && !text.includes('tnbq')
      ) {
        if (colSector === -1) colSector = cIdx;
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
        if (colStatus === -1) colStatus = cIdx;
      } else if (text.includes('ghi chú') || text.includes('sđt') || text.includes('điện thoại')) {
        if (colNote === -1) colNote = cIdx;
      }

      // Commune mode detection
      if (text.includes('mã xã') || text === 'mã xã') colCommuneCode = cIdx;
      if (text.includes('tên xã') || text === 'tên xã') colCommuneName = cIdx;
      if (text.includes('mã tkcs') || text.includes('mã tổ')) colTkcsCode = cIdx;
      if (text.includes('tên tkcs') || text.includes('tổ thống kê')) colTkcsName = cIdx;
    });

    // Detect data start row (skip code row like A, B, C or 1, 2, 3 or row 7)
    let dataStart = headerIdx + 1;
    for (let r = dataStart; r < Math.min(dataStart + 4, sheetRawRows.length); r++) {
      const rowCells = (sheetRawRows[r] || []).map((c: any) => String(c).trim().toUpperCase()).filter(Boolean);
      const isCodeRow = (rowCells.length > 0 && rowCells.every(c => 
        ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
         '(A)', '(B)', '(C)', '(D)', '(E)', '(F)', '(G)', '(H)', '(1)', '(2)', '(3)', '(4)', '(5)', '(6)', '(7)', '(8)'].includes(c)
      )) || r === 6;
      if (isCodeRow) {
        dataStart = r + 1;
      }
    }

    setMapping({
      headerRowIdx: headerIdx,
      dataStartRowIdx: dataStart,
      colName,
      colSttMau,
      colStatus,
      colSttGoc,
      colAddress,
      colMembers,
      colSector,
      colNote,
      colCommuneCode,
      colCommuneName,
      colTkcsCode,
      colTkcsName,
    });
  }, [sheetRawRows]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    setFile(selected);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          loadSheetData(wb, firstSheet);
        }

        // Auto extract commune from filename if not yet set
        if (!communeName) {
          const nameClean = selected.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' ');
          setCommuneName(nameClean);
        }
      } catch (err) {
        console.error("Error reading excel workbook:", err);
      }
    };
    reader.readAsArrayBuffer(selected);
  };

  const loadSheetData = (wb: XLSX.WorkBook, sName: string) => {
    const ws = wb.Sheets[sName];
    if (!ws) {
      setSheetRawRows([]);
      return;
    }
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    setSheetRawRows(rows || []);
  };

  const handleSelectSheet = (name: string) => {
    setSelectedSheet(name);
    if (workbook) {
      loadSheetData(workbook, name);
    }
  };

  // Convert column index to Excel column letter (0 -> A, 1 -> B, ...)
  const colToLetter = (colIdx: number) => {
    if (colIdx < 0) return '---';
    let temp = '';
    let num = colIdx;
    while (num >= 0) {
      temp = String.fromCharCode((num % 26) + 65) + temp;
      num = Math.floor(num / 26) - 1;
    }
    return temp;
  };

  // Maximum columns across raw rows
  const maxCols = useMemo(() => {
    let m = 0;
    sheetRawRows.slice(0, 30).forEach(r => {
      if (r && r.length > m) m = r.length;
    });
    return Math.max(m, 10);
  }, [sheetRawRows]);

  // Column options for select dropdowns
  const columnOptions = useMemo(() => {
    const opts = [{ value: -1, label: '-- Không chọn / Tự động nhận diện --' }];
    const headerRow = sheetRawRows[mapping.headerRowIdx] || [];
    for (let c = 0; c < maxCols; c++) {
      const letter = colToLetter(c);
      const text = String(headerRow[c] || '').trim();
      opts.push({
        value: c,
        label: `Cột ${letter}: ${text ? `"${text.substring(0, 30)}"` : '(Trống)'}`
      });
    }
    return opts;
  }, [sheetRawRows, mapping.headerRowIdx, maxCols]);

  // Live preview parsed sample records
  const sampleParsedHouseholds = useMemo(() => {
    if (importMode !== 'HOUSEHOLDS') return [];
    if (!sheetRawRows || sheetRawRows.length <= mapping.dataStartRowIdx) return [];

    const samples: any[] = [];
    const limit = Math.min(sheetRawRows.length, mapping.dataStartRowIdx + 8);

    for (let r = mapping.dataStartRowIdx; r < limit; r++) {
      const row = sheetRawRows[r];
      if (!row || row.length === 0) continue;

      let name = mapping.colName >= 0 ? String(row[mapping.colName] || '').trim() : '';
      if (!name) {
        // Fallback search
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c] || '').trim();
          if (val.length >= 2 && !/^\d+$/.test(val) && !val.includes('Tổng') && !val.includes('Bảng')) {
            name = val;
            break;
          }
        }
      }

      let stt = mapping.colSttMau >= 0 ? String(row[mapping.colSttMau] || '').trim() : '';
      let addr = mapping.colAddress >= 0 ? String(row[mapping.colAddress] || '').trim() : '';
      let members = mapping.colMembers >= 0 && mapping.colMembers !== mapping.colSttMau && mapping.colMembers !== mapping.colSttGoc
        ? Number(row[mapping.colMembers])
        : NaN;
      if (isNaN(members) || members <= 0 || members > 25 || String(members) === stt) {
        members = 0; // Để 0 theo đúng thực tế nếu không có, không tự gán bừa
      }
      let sector = mapping.colSector >= 0 ? Number(row[mapping.colSector]) : 2;
      let status = 'CHÍNH THỨC';
      if (mapping.colStatus >= 0) {
        const sStr = String(row[mapping.colStatus] || '').trim().toUpperCase();
        if (sStr.includes('CHÍNH THỨC') || sStr.includes('CHINH THUC') || sStr === 'CT' || sStr === '1') {
          status = 'CHÍNH THỨC';
        } else if (
          sStr.includes('DỰ PHÒNG') || 
          sStr.includes('DU PHONG') || 
          sStr === 'DP' || 
          (!sStr.includes('TDP') && /(^|\s+)DP(\s*|\d+|$)/i.test(sStr)) || 
          sStr === '2' || 
          sStr.includes('DỰ')
        ) {
          status = 'DỰ PHÒNG';
        }
      } else {
        if (samples.length >= 10) {
          status = 'DỰ PHÒNG';
        } else {
          status = 'CHÍNH THỨC';
        }
      }

      if (name) {
        samples.push({
          rowIdx: r + 1,
          name,
          stt: stt || String(samples.length + 1),
          status,
          addr: addr || selectedSheet,
          members: isNaN(members) || members <= 0 ? 3 : members,
          sector: [1, 2, 3, 4].includes(sector) ? sector : 2
        });
      }
    }
    return samples;
  }, [sheetRawRows, mapping, importMode, selectedSheet]);

  // Execute import and save the data to local storage via the parent callbacks.
  const handleSaveAndSync = async (forceOverwrite = false) => {
    if (!workbook || !file) return;

    const resolvedCommuneCode = (communeCode.trim() || '01');
    const resolvedCommuneName = (communeName.trim() || file.name.replace(/\.[^/.]+$/, '').replace(/[_]/g, ' '));
    const resolvedTkcsCode = (tkcsCode.trim() || 'TKCS-01');
    const resolvedTkcsName = (tkcsName.trim() || 'Thống kê cơ sở');

    // 1. Kiểm tra xem mã xã có bị trùng không (Rule: kiểm soát ngay từ bước đầu)
    if (!forceOverwrite) {
      const matchCode = existingCommunes.find(c => 
        Boolean(c.communeCode && c.communeCode.trim().toLowerCase() === resolvedCommuneCode.toLowerCase())
      );
      if (matchCode) {
        setDuplicateWarning({
          existing: matchCode,
          incoming: {
            communeCode: resolvedCommuneCode,
            communeName: resolvedCommuneName,
            tkcsCode: resolvedTkcsCode,
            tkcsName: resolvedTkcsName,
          }
        });
        return;
      }
    }

    setIsProcessing(true);

    try {
      if (importMode === 'COMMUNE_LIST') {
        // Direct list of communes
        const communesToAdd: any[] = [];
        const startR = mapping.dataStartRowIdx;
        for (let r = startR; r < sheetRawRows.length; r++) {
          const row = sheetRawRows[r];
          if (!row || row.length === 0) continue;

          const cCode = mapping.colCommuneCode >= 0 ? String(row[mapping.colCommuneCode] || '').trim() : '';
          const cName = mapping.colCommuneName >= 0 ? String(row[mapping.colCommuneName] || '').trim() : '';
          const tCode = mapping.colTkcsCode >= 0 ? String(row[mapping.colTkcsCode] || '').trim() : 'TKCS-01';
          const tName = mapping.colTkcsName >= 0 ? String(row[mapping.colTkcsName] || '').trim() : 'Thống kê cơ sở';

          if (cCode || cName) {
            communesToAdd.push({
              id: 'commune-' + (cCode || `gen-${Date.now()}-${r}`),
              communeCode: cCode || String(r + 1).padStart(2, '0'),
              communeName: cName || `Xã ${r + 1}`,
              tkcsCode: tCode,
              tkcsName: tName,
              fileName: file.name
            });
          }
        }

        if (onFinalizeCommuneListImport && communesToAdd.length > 0) {
          await onFinalizeCommuneListImport(communesToAdd);
        }
        setIsProcessing(false);
        onClose();
        return;
      }

      // Default: Households import with survey areas and commune metadata
      const newCommuneId = 'commune-' + Date.now();
      const targetSheets = applyToAllSheets ? workbook.SheetNames : [selectedSheet];

      const tempHouseholds: any[] = [];
      const tempAreas: any[] = [];
      const skippedSheets: any[] = [];
      let totalParsed = 0;
      let validAreaIndex = 0;

      targetSheets.forEach(sName => {
        const ws = workbook.Sheets[sName];
        if (!ws) return;

        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        if (!rows || rows.length <= mapping.dataStartRowIdx) {
          skippedSheets.push({ sheetName: sName, reason: 'Sheet không có đủ dòng dữ liệu' });
          return;
        }

        const sheetHouseholds: any[] = [];
        let sheetCount = 0;

        for (let r = mapping.dataStartRowIdx; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length === 0) continue;

          // Check if row is purely note or instructions
          const rowText = row.map(c => String(c || '').trim()).join(' ').toLowerCase();
          if (!rowText || rowText.includes('hướng dẫn') || rowText.includes('tổng số hộ mẫu') || rowText.includes('bảng kê hộ mẫu')) {
            continue;
          }

          // Bỏ qua dòng 7 nếu là dòng Ký hiệu cột theo mẫu bảng kê chuẩn
          if (r === 6) {
            const rCells = row.map(c => String(c || '').trim().toUpperCase()).filter(Boolean);
            const isSym = rCells.some(c => c.includes('KÝ HIỆU') || c.includes('KY HIEU') || c === 'A' || c === 'B' || c === '(A)' || c === '(1)' || c === '1');
            if (isSym) continue;
          }

          let rawName = mapping.colName >= 0 ? String(row[mapping.colName] || '').trim() : '';
          if (!rawName || /^\d+$/.test(rawName) || rawName.includes('(')) {
            // Find person name
            for (let c = 0; c < row.length; c++) {
              const val = String(row[c] || '').trim();
              if (val.length >= 2 && !/^\d+$/.test(val) && !val.includes('(') && !val.includes('Bảng')) {
                const words = val.split(/\s+/).length;
                if (words >= 2 && !val.toLowerCase().startsWith('thôn') && !val.toLowerCase().startsWith('xóm')) {
                  rawName = val;
                  break;
                }
              }
            }
          }

          if (!rawName || rawName.length < 2) continue;

          sheetCount++;

          // STT
          let sttVal = mapping.colSttMau >= 0 ? String(row[mapping.colSttMau] || '').trim() : '';
          if (!sttVal || !/^\d+$/.test(sttVal)) sttVal = String(sheetCount);

          let sttGocVal = mapping.colSttGoc >= 0 ? String(row[mapping.colSttGoc] || '').trim() : sttVal;

          // Status
          let statusVal: 'CHÍNH THỨC' | 'DỰ PHÒNG' = 'CHÍNH THỨC';
          if (mapping.colStatus >= 0) {
            const sVal = String(row[mapping.colStatus] || '').trim().toUpperCase();
            if (sVal.includes('CHÍNH THỨC') || sVal.includes('CHINH THUC') || sVal === 'CT' || sVal === '1') {
              statusVal = 'CHÍNH THỨC';
            } else if (
              sVal.includes('DỰ PHÒNG') || 
              sVal.includes('DU PHONG') || 
              sVal === 'DP' || 
              (!sVal.includes('TDP') && /(^|\s+)DP(\s*|\d+|$)/i.test(sVal)) || 
              sVal === '2' || 
              sVal.includes('DỰ')
            ) {
              statusVal = 'DỰ PHÒNG';
            }
          } else {
            if (sheetCount > 10) {
              statusVal = 'DỰ PHÒNG';
            } else {
              statusVal = 'CHÍNH THỨC';
            }
          }

          // Address
          let addrVal = mapping.colAddress >= 0 ? String(row[mapping.colAddress] || '').trim() : '';
          if (!addrVal) addrVal = sName;

          // Members - Tuyệt đối không lấy nhầm sang STT Mẫu hay STT Gốc
          let memVal = mapping.colMembers >= 0 && mapping.colMembers !== mapping.colSttMau && mapping.colMembers !== mapping.colSttGoc
            ? Number(row[mapping.colMembers])
            : NaN;
          if (isNaN(memVal) || memVal <= 0 || memVal > 25 || String(memVal) === sttVal || (sttGocVal && String(memVal) === sttGocVal)) {
            let found = false;
            for (let c = 0; c < row.length; c++) {
              if (c === mapping.colSttMau || c === mapping.colSttGoc || c === mapping.colName || c === mapping.colAddress || c === 0) continue;
              const n = Number(row[c]);
              if (!isNaN(n) && n >= 1 && n <= 15 && String(n) !== sttVal && String(n) !== sttGocVal) {
                memVal = n;
                found = true;
                break;
              }
            }
            if (!found) {
              memVal = 0; // Để 0 theo đúng thực tế nếu không có, không tự gán bừa
            }
          }

          // Sector
          let secVal: 1 | 2 | 3 | 4 = 2;
          const explicitMatch = rowText.match(/Loại\s*([1-4])/i);
          if (explicitMatch) {
            secVal = Number(explicitMatch[1]) as any;
          } else if (mapping.colSector >= 0 && row[mapping.colSector] !== undefined) {
            const rawSec = String(row[mapping.colSector] || '').trim();
            const num = Number(rawSec);
            if ([1, 2, 3, 4].includes(num)) {
              secVal = num as any;
            } else if (rawSec.toLowerCase().includes('nông') || rawSec.toLowerCase().includes('lâm') || rawSec.toLowerCase().includes('thủy sản')) {
              secVal = 1;
            } else if (rawSec.toLowerCase().includes('công nghiệp') || rawSec.toLowerCase().includes('xây dựng')) {
              secVal = 2;
            } else if (rawSec.toLowerCase().includes('thương mại') || rawSec.toLowerCase().includes('dịch vụ')) {
              secVal = 3;
            } else if (rawSec.toLowerCase().includes('khác') || rawSec.toLowerCase().includes('lương')) {
              secVal = 4;
            }
          } else {
            for (let c = 0; c < row.length; c++) {
              if (c === mapping.colSttMau || c === mapping.colSttGoc || c === mapping.colName || c === mapping.colAddress || c === mapping.colMembers) continue;
              const cellStr = String(row[c] || '').trim();
              if (/^[1-4]$/.test(cellStr)) {
                secVal = Number(cellStr) as any;
                break;
              } else if (cellStr.toLowerCase().includes('nông') || cellStr.toLowerCase().includes('lâm')) {
                secVal = 1; break;
              } else if (cellStr.toLowerCase().includes('thương mại') || cellStr.toLowerCase().includes('dịch vụ')) {
                secVal = 3; break;
              } else if (cellStr.toLowerCase().includes('thu khác') || cellStr.toLowerCase().includes('tiền lương')) {
                secVal = 4; break;
              }
            }
          }

          // Note & Phone
          let noteVal = mapping.colNote >= 0 ? String(row[mapping.colNote] || '').trim() : '';
          const phoneMatch = rowText.match(/0\d{8,10}/);

          sheetHouseholds.push({
            communeId: newCommuneId,
            tkcsCode: resolvedTkcsCode,
            tkcsName: resolvedTkcsName,
            communeCode: resolvedCommuneCode,
            communeName: resolvedCommuneName,
            areaName: sName,
            sheetName: sName,
            sttMau: sttVal,
            sampleStatus: statusVal,
            sttGoc: sttGocVal,
            householdHead: rawName,
            address: addrVal,
            phone: phoneMatch ? phoneMatch[0] : '',
            membersCount: memVal,
            workingMembersCount: 0,
            membersCountEntered: false,
            sectorCode: secVal,
            sectorName: SECTOR_NAMES[secVal],
            note: noteVal,
            surveyStatus: 'CHUA_NHAP',
            assignedSurveyorId: '',
            assignedSurveyorName: '',
            questionnaire: {}
          });
        }

        if (sheetCount === 0) {
          skippedSheets.push({ sheetName: sName, reason: 'Không tìm thấy dòng hộ hợp lệ' });
          return;
        }

        validAreaIndex++;
        const areaCode = String(validAreaIndex).padStart(3, '0');
        const areaId = 'area-' + newCommuneId + '-' + areaCode;

        const finalized = sheetHouseholds.map((h, idx) => ({
          ...h,
          id: 'hh-' + newCommuneId + '-' + areaCode + '-' + (idx + 1),
          areaId,
          areaCode
        }));

        tempHouseholds.push(...finalized);
        totalParsed += finalized.length;

        tempAreas.push({
          id: areaId,
          communeId: newCommuneId,
          communeCode: resolvedCommuneCode,
          code: areaCode,
          name: sName,
          householdCount: finalized.length
        });
      });

      const communeRecord = {
        id: newCommuneId,
        communeCode: resolvedCommuneCode,
        communeName: resolvedCommuneName,
        tkcsCode: resolvedTkcsCode,
        tkcsName: resolvedTkcsName,
        fileName: file.name
      };

      const oldToRemove = forceOverwrite && duplicateWarning ? [duplicateWarning.existing.id] : [];

      await onFinalizeHouseholdImport(
        communeRecord,
        tempAreas,
        tempHouseholds,
        skippedSheets,
        totalParsed,
        forceOverwrite,
        oldToRemove
      );

      setIsProcessing(false);
      onClose();
    } catch (err) {
      console.error("Error finalizing excel import:", err);
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-2 md:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-6xl w-full flex flex-col max-h-[94vh] overflow-hidden text-xs">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-800 to-sky-900 text-white p-4 flex items-center justify-between border-b border-sky-950">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-700/80 rounded-lg border border-sky-600/50 shadow-xs">
              <Settings className="w-5 h-5 text-sky-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm md:text-base uppercase tracking-wide">
                  Cấu hình Tiêu đề Dòng và Cột nạp dữ liệu Excel
                </span>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded text-[10px] font-bold">
                  Lưu cục bộ
                </span>
              </div>
              <p className="text-[11px] text-sky-200 mt-0.5">
                Chủ động chọn dòng tiêu đề, dòng bắt đầu dữ liệu và gán các cột tương ứng, lưu cố định vào Danh mục xã.
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-sky-200 hover:text-white hover:bg-sky-700 rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar: File Picker, Sheet Selector & Mode */}
        <div className="bg-slate-100 p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* File input button */}
            <label className="px-3 py-1.5 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white rounded font-bold cursor-pointer flex items-center gap-1.5 shadow-xs transition-colors">
              <Upload className="w-4 h-4" />
              <span>{file ? 'Đổi file Excel khác' : 'Chọn file Excel (.xlsx, .xls)'}</span>
              <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
            </label>

            {file && (
              <span className="text-slate-700 font-semibold flex items-center gap-1.5 bg-white px-2.5 py-1 rounded border border-slate-300">
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span className="truncate max-w-[200px]" title={file.name}>{file.name}</span>
                <span className="text-slate-400 text-[10px]">({(file.size / 1024).toFixed(0)} KB)</span>
              </span>
            )}

            {/* Sheet selector */}
            {sheetNames.length > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-600 font-medium">Sheet xem trước:</span>
                <select 
                  value={selectedSheet} 
                  onChange={e => handleSelectSheet(e.target.value)}
                  className="bg-white border border-slate-300 rounded px-2 py-1 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-600"
                >
                  {sheetNames.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-medium">Kiểu dữ liệu:</span>
            <div className="bg-slate-200 p-0.5 rounded-lg flex items-center">
              <button 
                type="button"
                onClick={() => setImportMode('HOUSEHOLDS')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  importMode === 'HOUSEHOLDS' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bảng kê danh sách hộ
              </button>
              <button 
                type="button"
                onClick={() => setImportMode('COMMUNE_LIST')}
                className={`px-2.5 py-1 rounded font-bold transition-all cursor-pointer ${
                  importMode === 'COMMUNE_LIST' ? 'bg-white text-sky-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                File Danh mục Xã
              </button>
            </div>
          </div>
        </div>

        {/* Main Body: Configuration & Preview */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-slate-50">
          
          {!file ? (
            <div className="border-2 border-dashed border-sky-300 bg-sky-50/50 rounded-xl p-10 text-center flex flex-col items-center justify-center gap-3 my-auto">
              <div className="w-14 h-14 bg-sky-100 rounded-full flex items-center justify-center text-sky-700">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-base font-extrabold text-slate-800">
                Vui lòng chọn file Excel để bắt đầu cấu hình tiêu đề dòng và cột
              </h3>
              <p className="text-slate-600 max-w-md text-xs">
                Hệ thống sẽ hiển thị bảng xem trước nguyên bản của sheet Excel, cho phép bạn chọn chính xác dòng tiêu đề, dòng bắt đầu dữ liệu và gán từng cột tương ứng theo mẫu điều tra.
              </p>
              <label className="mt-2 px-5 py-2.5 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white rounded-lg font-extrabold cursor-pointer flex items-center gap-2 shadow-sm transition-colors text-xs">
                <Upload className="w-4 h-4" />
                <span>Chọn file Excel (.xlsx, .xls)</span>
                <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
              </label>
            </div>
          ) : (
            <>
              {/* Commune & TKCS Identification Bar */}
              <div className="bg-white p-3.5 rounded-lg border border-sky-200 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="font-bold text-sky-950 uppercase flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-sky-700" />
                    <span>Thông tin Xã và TKCS lưu vào Danh mục xã</span>
                  </span>
                  <span className="text-[11px] text-slate-500 italic">
                    (Tự động nhận diện từ các dòng đầu của file hoặc bạn có thể chỉnh sửa tự do)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mã xã <span className="text-rose-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={communeCode} 
                      onChange={e => setCommuneCode(e.target.value)} 
                      placeholder="Mã xã (ví dụ: 01, 02...)" 
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tên xã <span className="text-rose-600">*</span>
                    </label>
                    <input 
                      type="text" 
                      value={communeName} 
                      onChange={e => setCommuneName(e.target.value)} 
                      placeholder="Tên xã/phường..." 
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Mã TKCS
                    </label>
                    <input 
                      type="text" 
                      value={tkcsCode} 
                      onChange={e => setTkcsCode(e.target.value)} 
                      placeholder="Mã TKCS..." 
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Tên TKCS
                    </label>
                    <input 
                      type="text" 
                      value={tkcsName} 
                      onChange={e => setTkcsName(e.target.value)} 
                      placeholder="Tên tổ TKCS..." 
                      className="w-full bg-slate-50 border border-slate-300 rounded p-1.5 font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                  </div>
                </div>
              </div>

              {/* Row & Column Configuration Settings */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* 1. Row Configuration (Tiêu đề dòng) */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-sky-700" />
                      <span>1. Cấu hình Tiêu đề Dòng</span>
                    </span>
                    <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">
                      Dòng Excel
                    </span>
                  </div>

                  <div className="flex flex-col gap-2.5">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Dòng chứa tiêu đề cột (Header Row):</label>
                        <span className="text-sky-800 font-extrabold bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                          Dòng {mapping.headerRowIdx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min={1} 
                          max={sheetRawRows.length || 100}
                          value={mapping.headerRowIdx + 1} 
                          onChange={e => {
                            const val = Math.max(1, parseInt(e.target.value) || 1) - 1;
                            setMapping(prev => ({
                              ...prev,
                              headerRowIdx: val,
                              dataStartRowIdx: Math.max(prev.dataStartRowIdx, val + 1)
                            }));
                          }}
                          className="w-20 bg-slate-50 border border-slate-300 rounded p-1 font-bold text-center focus:bg-white"
                        />
                        <span className="text-slate-500 text-[11px]">(Hoặc bấm "Chọn làm tiêu đề" ở bảng bên dưới)</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="font-bold text-slate-700">Dòng bắt đầu dữ liệu (Data Start):</label>
                        <span className="text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Dòng {mapping.dataStartRowIdx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          min={mapping.headerRowIdx + 2} 
                          max={sheetRawRows.length || 100}
                          value={mapping.dataStartRowIdx + 1} 
                          onChange={e => {
                            const val = Math.max(mapping.headerRowIdx + 1, (parseInt(e.target.value) || (mapping.headerRowIdx + 2)) - 1);
                            setMapping(prev => ({ ...prev, dataStartRowIdx: val }));
                          }}
                          className="w-20 bg-slate-50 border border-slate-300 rounded p-1 font-bold text-center focus:bg-white"
                        />
                        <span className="text-slate-500 text-[11px]">Bỏ qua các dòng chú thích/ký hiệu cột</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input 
                          type="checkbox" 
                          checked={applyToAllSheets} 
                          onChange={e => setApplyToAllSheets(e.target.checked)}
                          className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                        />
                        <span>Áp dụng cấu hình cho tất cả {sheetNames.length} Sheet</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. Column Mapping (Tiêu đề cột) */}
                <div className="bg-white p-3.5 rounded-lg border border-slate-300 shadow-xs flex flex-col gap-3 lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900 uppercase flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-600" />
                      <span>2. Cấu hình Tiêu đề Cột (Ánh xạ các cột tương ứng)</span>
                    </span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">
                      Cột A, B, C...
                    </span>
                  </div>

                  {importMode === 'HOUSEHOLDS' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {/* Cột Họ tên chủ hộ */}
                      <div className="p-2 rounded bg-sky-50/50 border border-sky-200">
                        <label className="block font-bold text-sky-950 mb-1">
                          Họ và tên chủ hộ <span className="text-rose-600">*</span>
                        </label>
                        <select
                          value={mapping.colName}
                          onChange={e => setMapping({ ...mapping, colName: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-bold text-slate-900 focus:outline-none"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cột STT Mẫu */}
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">
                          STT Mẫu (1, 2, 3...)
                        </label>
                        <select
                          value={mapping.colSttMau}
                          onChange={e => setMapping({ ...mapping, colSttMau: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-medium text-slate-800 focus:outline-none"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cột Loại mẫu */}
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Loại mẫu (Chính thức/Dự phòng)
                        </label>
                        <select
                          value={mapping.colStatus}
                          onChange={e => setMapping({ ...mapping, colStatus: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-medium text-slate-800 focus:outline-none"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cột Địa chỉ */}
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Địa chỉ (Thôn, xóm, tổ...)
                        </label>
                        <select
                          value={mapping.colAddress}
                          onChange={e => setMapping({ ...mapping, colAddress: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-medium text-slate-800 focus:outline-none"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cột Số nhân khẩu */}
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Số nhân khẩu / thành viên
                        </label>
                        <select
                          value={mapping.colMembers}
                          onChange={e => setMapping({ ...mapping, colMembers: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-medium text-slate-800 focus:outline-none"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Cột Ngành kinh tế / Nguồn thu lớn nhất */}
                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">
                          Nguồn thu lớn nhất (Mã 1-4)
                        </label>
                        <select
                          value={mapping.colSector}
                          onChange={e => setMapping({ ...mapping, colSector: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-medium text-slate-800 focus:outline-none"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    /* Commune List mapping mode */
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                      <div className="p-2 rounded bg-sky-50 border border-sky-200">
                        <label className="block font-bold text-sky-950 mb-1">Cột Mã xã <span className="text-rose-600">*</span></label>
                        <select
                          value={mapping.colCommuneCode}
                          onChange={e => setMapping({ ...mapping, colCommuneCode: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-bold text-slate-900"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="p-2 rounded bg-sky-50 border border-sky-200">
                        <label className="block font-bold text-sky-950 mb-1">Cột Tên xã <span className="text-rose-600">*</span></label>
                        <select
                          value={mapping.colCommuneName}
                          onChange={e => setMapping({ ...mapping, colCommuneName: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1 font-bold text-slate-900"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">Cột Mã TKCS</label>
                        <select
                          value={mapping.colTkcsCode}
                          onChange={e => setMapping({ ...mapping, colTkcsCode: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="p-2 rounded bg-slate-50 border border-slate-200">
                        <label className="block font-semibold text-slate-800 mb-1">Cột Tên TKCS</label>
                        <select
                          value={mapping.colTkcsName}
                          onChange={e => setMapping({ ...mapping, colTkcsName: parseInt(e.target.value) })}
                          className="w-full bg-white border border-slate-300 rounded p-1"
                        >
                          {columnOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Interactive Visual Sheet Preview Table */}
              <div className="bg-white rounded-lg border border-slate-300 shadow-xs flex flex-col gap-2 p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-sky-700" />
                    <span className="font-bold text-slate-800 text-xs uppercase">
                      Bảng xem trước trực quan Sheet: "{selectedSheet}"
                    </span>
                    <span className="text-slate-500 text-[11px]">
                      (Hiển thị 20 dòng đầu)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-sky-900 font-bold">
                      <span className="w-3 h-3 bg-sky-200 border border-sky-400 rounded-xs inline-block"></span>
                      <span>Dòng tiêu đề ({mapping.headerRowIdx + 1})</span>
                    </span>
                    <span className="flex items-center gap-1 text-emerald-900 font-bold">
                      <span className="w-3 h-3 bg-emerald-100 border border-emerald-400 rounded-xs inline-block"></span>
                      <span>Dòng dữ liệu ({mapping.dataStartRowIdx + 1}+)</span>
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-72 overflow-y-auto border border-slate-200 rounded">
                  <table className="w-full border-collapse text-xs whitespace-nowrap">
                    <thead>
                      <tr className="bg-slate-200 text-slate-700 font-bold text-center">
                        <th className="border border-slate-300 p-1.5 w-16 sticky left-0 bg-slate-200 z-10">Dòng</th>
                        <th className="border border-slate-300 p-1.5 w-28 text-center sticky left-16 bg-slate-200 z-10">Hành động</th>
                        {Array.from({ length: maxCols }).map((_, cIdx) => {
                          const letter = colToLetter(cIdx);
                          const isNameCol = mapping.colName === cIdx;
                          const isSttCol = mapping.colSttMau === cIdx;
                          const isAddrCol = mapping.colAddress === cIdx;
                          const isMemCol = mapping.colMembers === cIdx;
                          const isSecCol = mapping.colSector === cIdx;
                          return (
                            <th 
                              key={cIdx} 
                              className={`border border-slate-300 p-1.5 text-center min-w-[120px] ${
                                isNameCol ? 'bg-sky-700 text-white' :
                                isSttCol || isAddrCol || isMemCol || isSecCol ? 'bg-sky-100 text-sky-950 font-bold' :
                                'text-slate-700'
                              }`}
                            >
                              <div>Cột {letter}</div>
                              {isNameCol && <div className="text-[10px] bg-sky-900 px-1 rounded mt-0.5 font-black">[Họ tên chủ hộ]</div>}
                              {isSttCol && <div className="text-[10px] bg-amber-600 text-white px-1 rounded mt-0.5">[STT Mẫu]</div>}
                              {isAddrCol && <div className="text-[10px] bg-emerald-700 text-white px-1 rounded mt-0.5">[Địa chỉ]</div>}
                              {isMemCol && <div className="text-[10px] bg-rose-700 text-white px-1 rounded mt-0.5">[Nhân khẩu]</div>}
                              {isSecCol && <div className="text-[10px] bg-indigo-700 text-white px-1 rounded mt-0.5">[Nguồn thu]</div>}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sheetRawRows.slice(0, 22).map((row, rIdx) => {
                        const isHeader = rIdx === mapping.headerRowIdx;
                        const isData = rIdx >= mapping.dataStartRowIdx;
                        return (
                          <tr 
                            key={rIdx} 
                            className={`border-b border-slate-200 transition-colors ${
                              isHeader ? 'bg-sky-100 font-extrabold text-sky-950' :
                              isData ? 'hover:bg-emerald-50/70 odd:bg-slate-50/40' :
                              'hover:bg-slate-100 text-slate-500'
                            }`}
                          >
                            <td className="border border-slate-300 p-1.5 text-center font-bold sticky left-0 bg-slate-100 z-10">
                              {rIdx + 1}
                            </td>
                            <td className="border border-slate-300 p-1 text-center sticky left-16 bg-white z-10">
                              <div className="flex items-center justify-center gap-1">
                                {isHeader ? (
                                  <span className="px-1.5 py-0.5 bg-sky-800 text-white rounded font-bold text-[10px]">
                                    Tiêu đề
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setMapping(prev => ({ 
                                      ...prev, 
                                      headerRowIdx: rIdx, 
                                      dataStartRowIdx: Math.max(prev.dataStartRowIdx, rIdx + 1) 
                                    }))}
                                    className="px-1 py-0.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded border border-sky-300 text-[10px] cursor-pointer"
                                    title="Đặt dòng này làm dòng tiêu đề"
                                  >
                                    Đặt tiêu đề
                                  </button>
                                )}
                                {isData ? (
                                  <span className="px-1 py-0.5 bg-emerald-100 text-emerald-900 rounded font-bold text-[10px]">
                                    Dữ liệu
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setMapping(prev => ({ ...prev, dataStartRowIdx: rIdx }))}
                                    className="px-1 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded border border-emerald-300 text-[10px] cursor-pointer"
                                    title="Đặt dòng này làm dòng bắt đầu dữ liệu"
                                  >
                                    Bắt đầu
                                  </button>
                                )}
                              </div>
                            </td>
                            {Array.from({ length: maxCols }).map((_, cIdx) => {
                              const cellVal = row ? row[cIdx] : '';
                              const isNameCol = mapping.colName === cIdx;
                              return (
                                <td 
                                  key={cIdx} 
                                  className={`border border-slate-300 p-1.5 ${
                                    isNameCol ? 'font-bold text-sky-950 bg-sky-50/50' : ''
                                  }`}
                                >
                                  {cellVal !== undefined && cellVal !== null ? String(cellVal) : ''}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sample Parsed Preview */}
              {sampleParsedHouseholds.length > 0 && (
                <div className="bg-emerald-50/70 border border-emerald-300 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-950 text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      <span>Kết quả nhận diện thử nghiệm mẫu từ Sheet "{selectedSheet}" ({sampleParsedHouseholds.length} hộ mẫu đầu tiên):</span>
                    </span>
                    <span className="text-[11px] text-emerald-800 font-bold">
                      Đã khớp đúng cấu hình dòng & cột
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs bg-white rounded border border-emerald-200">
                      <thead>
                        <tr className="bg-emerald-800 text-white font-bold text-center">
                          <th className="border border-emerald-900 p-1.5">STT</th>
                          <th className="border border-emerald-900 p-1.5 text-left">Họ và tên chủ hộ</th>
                          <th className="border border-emerald-900 p-1.5">Loại mẫu</th>
                          <th className="border border-emerald-900 p-1.5 text-left">Địa chỉ</th>
                          <th className="border border-emerald-900 p-1.5">Số nhân khẩu</th>
                          <th className="border border-emerald-900 p-1.5 text-left">Nguồn thu lớn nhất</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sampleParsedHouseholds.map((s, idx) => (
                          <tr key={idx} className="hover:bg-emerald-50/50 border-b border-emerald-100">
                            <td className="border border-slate-200 p-1.5 text-center font-bold text-slate-700">{s.stt}</td>
                            <td className="border border-slate-200 p-1.5 font-bold text-slate-900">{s.name}</td>
                            <td className="border border-slate-200 p-1.5 text-center">
                              <span className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                                s.status === 'CHÍNH THỨC' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="border border-slate-200 p-1.5 text-slate-700">{s.addr}</td>
                            <td className="border border-slate-200 p-1.5 text-center font-bold text-rose-800">{s.members} người</td>
                            <td className="border border-slate-200 p-1.5 text-slate-800 font-medium">
                              Nhóm {s.sector} - {SECTOR_NAMES[s.sector]}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Footer Action Bar */}
        <div className="bg-slate-100 p-3.5 border-t border-slate-300 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-slate-600 text-[11px] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>
              Dữ liệu sẽ được lưu vào danh mục xã, bảng kê và phiếu trên máy này.
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold cursor-pointer transition-colors"
            >
              Đóng
            </button>

            <button
              type="button"
              disabled={!file || isProcessing || (importMode === 'HOUSEHOLDS' && mapping.colName === -1)}
              onClick={() => handleSaveAndSync(false)}
              className="px-5 py-2 bg-gradient-to-r from-sky-700 to-sky-800 hover:from-sky-600 hover:to-sky-700 active:from-sky-900 active:to-sky-900 text-white rounded-lg font-extrabold cursor-pointer shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý và lưu cục bộ...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Lưu vào danh mục xã trên máy này</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>

      {/* Duplicate Commune Warning & Overwrite Modal */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-amber-400 shadow-2xl max-w-lg w-full overflow-hidden text-xs">
            <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 className="font-extrabold text-sm uppercase">Cảnh báo: Mã xã đã tồn tại!</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setDuplicateWarning(null)}
                className="text-white hover:bg-amber-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 flex flex-col gap-3.5 text-slate-700">
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-950 font-medium">
                <p className="font-extrabold text-amber-900 flex items-center gap-1.5 text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Mã xã [{duplicateWarning.incoming.communeCode}] đã trùng với xã "{duplicateWarning.existing.communeName}" đang lưu trên hệ thống!</span>
                </p>
                <p className="text-[12px] text-amber-900 mt-2 font-bold">
                  Bạn có muốn GHI ĐÈ vào xã này không?
                </p>
                <p className="text-[11px] text-amber-800 mt-1">
                  - <strong>Ghi đè</strong>: Xóa dữ liệu hộ và địa bàn cũ của xã này trên máy, thay thế bằng dữ liệu mới.<br />
                  - <strong>Hủy bỏ</strong>: Giữ nguyên dữ liệu hiện tại, không làm trùng xã.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded bg-slate-100 border border-slate-300">
                  <span className="font-bold text-slate-800 block text-[11px]">Xã hiện tại trên hệ thống:</span>
                  <div className="mt-1 font-semibold text-slate-900">Mã: {duplicateWarning.existing.communeCode}</div>
                  <div className="text-slate-700 font-bold">{duplicateWarning.existing.communeName}</div>
                </div>

                <div className="p-2.5 rounded bg-sky-50 border border-sky-300">
                  <span className="font-bold text-sky-950 block text-[11px]">Dữ liệu mới cấu hình:</span>
                  <div className="mt-1 font-semibold text-sky-900">Mã: {duplicateWarning.incoming.communeCode}</div>
                  <div className="text-sky-950 font-bold">{duplicateWarning.incoming.communeName}</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 mt-1">
                <button
                  type="button"
                  onClick={() => setDuplicateWarning(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-bold cursor-pointer"
                >
                  Hủy bỏ (Không nạp)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDuplicateWarning(null);
                    handleSaveAndSync(true); // Force overwrite!
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-extrabold cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Xác nhận Ghi đè</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
