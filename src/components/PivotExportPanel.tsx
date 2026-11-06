/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useRef, useState } from 'react';
import { FileSpreadsheet, ClipboardCheck, Upload, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { Commune, Household } from '../types';
import {
  ALL_COMMUNES,
  ALL_TKCS,
  buildPivotRows,
  exportPivotToExcel,
  getCommuneOptions,
  getTkcsOptions
} from '../utils/summaryPivotExport';
import {
  collectRedoHouseholds,
  exportRedoFiles,
  mergeParsedRedoFiles,
  parseRedoWorkbook,
  previewRedoImport,
  type RedoImportPreview
} from '../utils/redoPhieuExchange';

interface PivotExportPanelProps {
  households: Household[];
  communes: Commune[];
  showNotification: (type: 'success' | 'error', message: string) => void;
  /** Giá trị TKCS khởi tạo (VD đang lọc ở màn hình cha) */
  defaultTkcs?: string;
  /** Admin nhập file xã đã sửa: App ghi các hộ đã cập nhật vào hệ thống. Không truyền thì ẩn chức năng nhập. */
  onApplyRedoImport?: (changed: Household[]) => void;
  className?: string;
}

type CheckLevel = 'ALL' | 'ERROR_ONLY';

const money = (v: number) => Math.round(v).toLocaleString('vi-VN');

/**
 * Bộ lọc (TKCS -> Xã) + nút xuất Excel dạng PivotTable có cột suy rộng,
 * kèm xuất "Phiếu cần làm lại" gửi xã và nhập lại file xã đã sửa.
 */
export const PivotExportPanel: React.FC<PivotExportPanelProps> = ({
  households,
  communes,
  showNotification,
  defaultTkcs = ALL_TKCS,
  onApplyRedoImport,
  className = ''
}) => {
  const tkcsOptions = useMemo(() => getTkcsOptions(), []);
  const [tkcs, setTkcs] = useState<string>(defaultTkcs);
  const [communeCode, setCommuneCode] = useState<string>(ALL_COMMUNES);
  const [checkLevel, setCheckLevel] = useState<CheckLevel>('ALL');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RedoImportPreview | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCommunes = tkcsOptions.reduce((a, t) => a + t.communeCount, 0);
  const communeOptions = useMemo(() => getCommuneOptions(tkcs), [tkcs]);

  const handleTkcsChange = (value: string) => {
    setTkcs(value);
    setCommuneCode(ALL_COMMUNES); // đổi TKCS thì bỏ chọn xã để tránh xã không thuộc TKCS
  };

  const handleExport = () => {
    try {
      const result = buildPivotRows(households, communes, tkcs, communeCode);
      const fileName = exportPivotToExcel(result, tkcs, communeCode);
      showNotification(
        'success',
        `Đã xuất ${result.scopeLabel} (${result.total.validHouseholds} hộ hợp lệ) ra file ${fileName}`
      );
    } catch (e: any) {
      console.error(e);
      showNotification('error', 'Không xuất được file Excel: ' + (e?.message || e));
    }
  };

  // ---------- Xuất phiếu cần làm lại ----------
  const handleExportRedo = async () => {
    if (busy) return;
    try {
      const items = collectRedoHouseholds(households, communes, {
        tkcsCode: tkcs,
        communeCode,
        includeSuspect: checkLevel === 'ALL'
      });
      if (items.length === 0) {
        showNotification('success', 'Không có phiếu nào cần làm lại trong phạm vi đã chọn (chỉ xét hộ đã hoàn thành/đã duyệt).');
        return;
      }
      const communeCount = new Set(items.map(i => i.communeCode)).size;
      if (communeCount > 1) {
        const ok = window.confirm(
          `Có ${items.length} hộ cần làm lại ở ${communeCount} xã.\n` +
          `Hệ thống sẽ tải về ${communeCount} file (mỗi xã 1 file). Trình duyệt có thể hỏi quyền tải nhiều file, hãy chọn Cho phép.\n\nTiếp tục?`
        );
        if (!ok) return;
      }
      setBusy(true);
      const result = await exportRedoFiles(items);
      const errors = items.filter(i => i.level === 'LOI').length;
      showNotification(
        'success',
        `Đã xuất ${result.files.length} file cho ${result.totalHouseholds} hộ cần làm lại (${errors} hộ lỗi, ${result.totalHouseholds - errors} hộ nghi vấn) thuộc ${result.totalAreas} địa bàn.`
      );
    } catch (e: any) {
      console.error(e);
      showNotification('error', 'Không xuất được phiếu cần làm lại: ' + (e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  // ---------- Nhập file xã đã sửa ----------
  const handleFilesPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    try {
      setBusy(true);
      const parsedList = [];
      for (const f of files) {
        parsedList.push(parseRedoWorkbook(await f.arrayBuffer(), f.name));
      }
      const result = previewRedoImport(mergeParsedRedoFiles(parsedList), households, communes);
      setPreview(result);
    } catch (err: any) {
      console.error(err);
      showNotification('error', 'Không đọc được file: ' + (err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  const handleApply = () => {
    if (!preview || !onApplyRedoImport) return;
    const changed = preview.items.filter(i => i.status === 'UPDATE' && i.next).map(i => i.next!);
    if (changed.length === 0) return;
    onApplyRedoImport(changed);
    showNotification(
      'success',
      `Đã cập nhật ${changed.length} hộ từ file xã sửa lại.` +
      (preview.error > 0 ? ` ${preview.error} hộ bị bỏ qua do lỗi.` : '')
    );
    setPreview(null);
  };

  const selectCls =
    'h-9 bg-white text-slate-900 border border-slate-300 rounded px-2.5 text-xs font-medium focus:outline-none focus:border-teal-600 cursor-pointer max-w-[260px]';

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-xs whitespace-nowrap">Xuất tổng hợp theo:</span>
        <select value={tkcs} onChange={e => handleTkcsChange(e.target.value)} className={selectCls}>
          <option value={ALL_TKCS}>Tất cả {totalCommunes} xã/phường ({tkcsOptions.length} TKCS)</option>
          {tkcsOptions.map(t => (
            <option key={t.code} value={t.code}>
              {t.code} - {t.name} ({t.communeCount} xã)
            </option>
          ))}
        </select>
        <select
          value={communeCode}
          onChange={e => setCommuneCode(e.target.value)}
          className={selectCls}
          title="Lọc theo xã/phường. Danh sách xã thay đổi theo TKCS đã chọn."
        >
          <option value={ALL_COMMUNES}>Tất cả xã ({communeOptions.length})</option>
          {communeOptions.map(c => (
            <option key={c.code} value={c.code}>
              {c.code} - {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleExport}
          className="h-9 px-3.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
          title="Xuất Excel dạng PivotTable: Tổ TKCS → Xã/Phường, có cột suy rộng. Theo TKCS và xã đã chọn."
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Xuất Excel (dạng Pivot + suy rộng)</span>
        </button>
      </div>

      {onApplyRedoImport && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-xs whitespace-nowrap">Phiếu cần làm lại:</span>
          <select
            value={checkLevel}
            onChange={e => setCheckLevel(e.target.value as CheckLevel)}
            className={selectCls}
            title="Lỗi = hộ đang bị loại khỏi bình quân. Nghi vấn = số liệu lệch, cần xã đối chiếu phiếu giấy."
          >
            <option value="ALL">Lỗi + nghi vấn</option>
            <option value="ERROR_ONLY">Chỉ lỗi (hộ bị loại khỏi bình quân)</option>
          </select>
          <button
            type="button"
            onClick={handleExportRedo}
            disabled={busy}
            className="h-9 px-3.5 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-60 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            title="Quét nội dung phiếu, xuất mỗi xã 1 file Excel gồm các hộ cần làm lại (theo TKCS và xã đã chọn) để gửi xã cập nhật"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Xuất phiếu cần làm lại</span>
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="h-9 px-3.5 bg-sky-700 hover:bg-sky-600 active:bg-sky-800 disabled:opacity-60 text-white rounded text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
            title="Chọn file Excel xã đã sửa (chọn được nhiều file). Hệ thống kiểm tra rồi mới cập nhật vào đúng hộ, đúng địa bàn."
          >
            <Upload className="w-4 h-4" />
            <span>Nhập file xã đã sửa</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            multiple
            className="hidden"
            onChange={handleFilesPicked}
          />
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 text-slate-800">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm">Kiểm tra file xã đã sửa trước khi cập nhật</h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-bold text-emerald-700">{preview.update} hộ sẽ cập nhật</span>
                  {' • '}{preview.noChange} hộ không thay đổi
                  {' • '}<span className={preview.error > 0 ? 'font-bold text-rose-700' : ''}>{preview.error} hộ lỗi (bị bỏ qua)</span>
                  {' • '}Hộ lỗi không ảnh hưởng các hộ khác. Nên bấm "Sao lưu" ở menu Trao đổi dữ liệu trước khi cập nhật.
                </p>
              </div>
              <button type="button" onClick={() => setPreview(null)} className="p-1.5 rounded hover:bg-slate-100 cursor-pointer" title="Đóng">
                <X className="w-4 h-4" />
              </button>
            </div>

            {preview.fileErrors.length > 0 && (
              <div className="mx-4 mt-3 p-2.5 rounded border border-rose-300 bg-rose-50 text-xs text-rose-800 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>{preview.fileErrors.map((m, i) => <div key={i}>{m}</div>)}</div>
              </div>
            )}

            <div className="overflow-auto p-4">
              <table className="w-full text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100">
                  <tr className="text-left">
                    <th className="p-2 border border-slate-300">Kết quả</th>
                    <th className="p-2 border border-slate-300">ID địa bàn</th>
                    <th className="p-2 border border-slate-300">Xã / Địa bàn</th>
                    <th className="p-2 border border-slate-300">STT</th>
                    <th className="p-2 border border-slate-300">Chủ hộ</th>
                    <th className="p-2 border border-slate-300 text-right">Nhân khẩu</th>
                    <th className="p-2 border border-slate-300 text-right">Tổng thu nhập (1.000đ)</th>
                    <th className="p-2 border border-slate-300">Hợp lệ</th>
                    <th className="p-2 border border-slate-300 text-right">Dòng sửa</th>
                    <th className="p-2 border border-slate-300">Ghi chú / vấn đề</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((it, i) => (
                    <tr key={i} className={it.status === 'ERROR' ? 'bg-rose-50' : it.status === 'UPDATE' ? 'bg-emerald-50/50' : ''}>
                      <td className="p-2 border border-slate-300 whitespace-nowrap font-bold">
                        {it.status === 'ERROR' && <span className="text-rose-700">Lỗi - bỏ qua</span>}
                        {it.status === 'UPDATE' && <span className="text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Cập nhật</span>}
                        {it.status === 'NO_CHANGE' && <span className="text-slate-500">Không đổi</span>}
                      </td>
                      <td className="p-2 border border-slate-300 font-mono">{it.idDiaBan}</td>
                      <td className="p-2 border border-slate-300">{it.communeName}{it.areaName ? ` / ${it.areaName}` : ''}</td>
                      <td className="p-2 border border-slate-300">{it.stt}</td>
                      <td className="p-2 border border-slate-300">{it.chuHo}</td>
                      <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                        {it.status === 'ERROR' ? '' : it.membersBefore === it.membersAfter ? it.membersAfter : `${it.membersBefore} → ${it.membersAfter}`}
                      </td>
                      <td className="p-2 border border-slate-300 text-right whitespace-nowrap">
                        {it.status === 'ERROR' ? '' : `${money(it.incomeBefore)} → ${money(it.incomeAfter)}`}
                      </td>
                      <td className="p-2 border border-slate-300 whitespace-nowrap">
                        {it.status === 'ERROR' ? '' : `${it.validBefore ? 'Có' : 'Không'} → `}
                        {it.status === 'ERROR' ? '' : <span className={it.validAfter ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>{it.validAfter ? 'Có' : 'Không'}</span>}
                      </td>
                      <td className="p-2 border border-slate-300 text-right">{it.status === 'ERROR' ? '' : it.changedLines}</td>
                      <td className="p-2 border border-slate-300 min-w-[260px]">
                        {it.errors.map((m, k) => <div key={'e' + k} className="text-rose-700">{m}</div>)}
                        {it.status !== 'ERROR' && it.remainingIssues.map((m, k) => <div key={'r' + k} className="text-amber-700">Vẫn còn lỗi: {m}</div>)}
                        {it.xaNote && <div className="text-slate-600">Xã ghi chú: {it.xaNote}</div>}
                      </td>
                    </tr>
                  ))}
                  {preview.items.length === 0 && (
                    <tr><td colSpan={10} className="p-4 text-center text-slate-500">Không đọc được hộ nào trong file.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setPreview(null)} className="h-9 px-4 rounded border border-slate-300 text-xs font-bold hover:bg-slate-50 cursor-pointer">
                Hủy
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={preview.update === 0}
                className="h-9 px-4 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold cursor-pointer"
              >
                Cập nhật {preview.update} hộ vào hệ thống
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PivotExportPanel;
