/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import type { Commune, Household } from '../types';
import {
  ALL_TKCS,
  buildPivotRows,
  exportPivotToExcel,
  getTkcsOptions
} from '../utils/summaryPivotExport';

interface PivotExportPanelProps {
  households: Household[];
  communes: Commune[];
  showNotification: (type: 'success' | 'error', message: string) => void;
  /** Giá trị TKCS khởi tạo (VD đang lọc ở màn hình cha) */
  defaultTkcs?: string;
  className?: string;
}

/**
 * Bộ lọc + nút xuất Excel dạng PivotTable (Tổ TKCS -> Xã/Phường) có cột suy rộng.
 * Chọn "Tất cả" để xuất đủ 104 xã/phường, hoặc chọn 1 Tổ TKCS.
 */
export const PivotExportPanel: React.FC<PivotExportPanelProps> = ({
  households,
  communes,
  showNotification,
  defaultTkcs = ALL_TKCS,
  className = ''
}) => {
  const tkcsOptions = useMemo(() => getTkcsOptions(), []);
  const [tkcs, setTkcs] = useState<string>(defaultTkcs);
  const totalCommunes = tkcsOptions.reduce((a, t) => a + t.communeCount, 0);

  const handleExport = () => {
    try {
      const result = buildPivotRows(households, communes, tkcs);
      const fileName = exportPivotToExcel(result, tkcs);
      showNotification(
        'success',
        `Đã xuất ${result.scopeLabel} (${result.total.validHouseholds} hộ hợp lệ) ra file ${fileName}`
      );
    } catch (e: any) {
      console.error(e);
      showNotification('error', 'Không xuất được file Excel: ' + (e?.message || e));
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="font-bold text-xs whitespace-nowrap">Xuất tổng hợp theo:</span>
      <select
        value={tkcs}
        onChange={e => setTkcs(e.target.value)}
        className="h-9 bg-white text-slate-900 border border-slate-300 rounded px-2.5 text-xs font-medium focus:outline-none focus:border-teal-600 cursor-pointer max-w-[260px]"
      >
        <option value={ALL_TKCS}>Tất cả {totalCommunes} xã/phường ({tkcsOptions.length} TKCS)</option>
        {tkcsOptions.map(t => (
          <option key={t.code} value={t.code}>
            {t.code} - {t.name} ({t.communeCount} xã)
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleExport}
        className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
        title="Xuất Excel dạng PivotTable: Tổ TKCS → Xã/Phường, có cột suy rộng"
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span>Xuất Excel (dạng Pivot + suy rộng)</span>
      </button>
    </div>
  );
};

export default PivotExportPanel;
