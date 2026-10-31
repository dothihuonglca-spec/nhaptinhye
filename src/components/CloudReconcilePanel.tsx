/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, CloudOff, Download, RefreshCw, Cloud } from 'lucide-react';
import * as XLSX from 'xlsx';
import type { Commune, Household, SurveyArea } from '../types';
import type { Surveyor } from '../types/user';
import {
  CLOUD_RECONCILE_LABELS,
  reconcileCloudProgress,
  type AreaProgressSnapshot,
  type CloudReconcileStatus
} from '../utils/areaDataTransfer';

export interface CloudStatus {
  state: 'idle' | 'loading' | 'ok' | 'error';
  code?: string;
  message?: string;
  fromCache?: boolean;
  lastSyncAt?: string;
  docCount?: number;
  ignoredCount?: number;
}

interface Props {
  cloudProgress: AreaProgressSnapshot[];
  cloudStatus: CloudStatus;
  onReloadCloud: () => void;
  onResyncProgress?: () => void;
  resyncingProgress?: boolean;
  communes: Commune[];
  areas: SurveyArea[];
  households: Household[];
  surveyors: Surveyor[];
  onOpenJsonImport?: () => void;
  onOpenImportTab?: () => void;
  showNotification: (type: 'success' | 'error', msg: string) => void;
}

const STATUS_STYLE: Record<CloudReconcileStatus, string> = {
  MISSING_COMMUNE: 'bg-rose-100 text-rose-800 border-rose-300',
  MISSING_AREA: 'bg-orange-100 text-orange-800 border-orange-300',
  BEHIND: 'bg-amber-100 text-amber-800 border-amber-300',
  SURVEYOR_MISMATCH: 'bg-purple-100 text-purple-800 border-purple-300',
  IN_SYNC: 'bg-emerald-100 text-emerald-800 border-emerald-300'
};

const STATUS_HINT: Record<CloudReconcileStatus, string> = {
  MISSING_COMMUNE: 'Thêm xã vào danh mục (tab Quản lý danh mục xã) rồi tải bảng kê.',
  MISSING_AREA: 'Tải bảng kê xã này ở tab "1. Tải bảng kê", hoặc nạp file JSON của ĐTV.',
  BEHIND: 'Nạp file JSON kết quả của ĐTV (tab "Xuất nhập dữ liệu") để có phiếu chi tiết.',
  SURVEYOR_MISMATCH: 'Kiểm tra lại phân công ĐTV của địa bàn này ở tab Hệ thống.',
  IN_SYNC: ''
};

function describeCloudError(code?: string): string {
  switch (code) {
    case 'permission-denied':
      return 'Firebase từ chối quyền đọc (permission-denied). Hãy công bố (Publish) file firestore.rules lên đúng dự án Firebase nhaptin-66e34.';
    case 'unavailable':
      return 'Không kết nối được tới Firebase (unavailable). Kiểm tra mạng, VPN hoặc tường lửa chặn firestore.googleapis.com.';
    case 'resource-exhausted':
      return 'Firebase đã hết hạn mức đọc/ghi trong ngày (resource-exhausted). Thử lại sau khi hạn mức được làm mới.';
    case 'failed-precondition':
      return 'Cơ sở dữ liệu Firestore chưa được tạo hoặc sai chế độ (failed-precondition). Vào Firebase Console > Firestore Database để tạo.';
    case 'not-found':
      return 'Không tìm thấy cơ sở dữ liệu Firestore của dự án (not-found). Kiểm tra firebase-applet-config.json.';
    case 'unauthenticated':
      return 'Chưa xác thực với Firebase (unauthenticated).';
    default:
      return 'Lỗi không xác định khi đọc Firebase.';
  }
}

function formatTime(iso?: string): string {
  if (!iso) return '---';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '---';
  return d.toLocaleString('vi-VN', { hour12: false });
}

export const CloudReconcilePanel: React.FC<Props> = ({
  cloudProgress, cloudStatus, onReloadCloud, onResyncProgress, resyncingProgress, communes, areas, households, surveyors,
  onOpenJsonImport, onOpenImportTab, showNotification
}) => {
  const [filter, setFilter] = useState<'PROBLEM' | 'ALL' | CloudReconcileStatus>('PROBLEM');
  const [expanded, setExpanded] = useState(true);

  const items = useMemo(
    () => reconcileCloudProgress(cloudProgress, communes, areas, households, surveyors),
    [cloudProgress, communes, areas, households, surveyors]
  );

  const counts = useMemo(() => {
    const c: Record<CloudReconcileStatus, number> = {
      MISSING_COMMUNE: 0, MISSING_AREA: 0, BEHIND: 0, SURVEYOR_MISMATCH: 0, IN_SYNC: 0
    };
    items.forEach(i => { c[i.status]++; });
    return c;
  }, [items]);

  const problemCount = items.length - counts.IN_SYNC;
  const visible = items.filter(i =>
    filter === 'ALL' ? true : filter === 'PROBLEM' ? i.status !== 'IN_SYNC' : i.status === filter
  );

  const handleExport = () => {
    try {
      const rows = [
        ['Trạng thái', 'Mã xã', 'Tên xã', 'Mã địa bàn', 'Tên địa bàn', 'ĐTV (Firebase)',
          'Hộ trên Firebase', 'Hoàn thành (Firebase)', 'Đang nhập (Firebase)',
          'Hộ trên máy Admin', 'Hoàn thành (máy Admin)', 'Cập nhật Firebase lúc', 'Cần làm'],
        ...visible.map(i => [
          CLOUD_RECONCILE_LABELS[i.status], i.snapshot.communeCode, i.snapshot.communeName,
          i.snapshot.areaCode, i.snapshot.areaName, i.snapshot.surveyorName,
          i.snapshot.totalHouseholds, i.snapshot.completedHouseholds, i.snapshot.inProgressHouseholds,
          i.localTotal, i.localCompleted, formatTime(i.snapshot.updatedAt), STATUS_HINT[i.status]
        ])
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'DoiChieuFirebase');
      XLSX.writeFile(wb, `Doi_Chieu_Firebase_May_Admin_${new Date().toISOString().slice(0, 10)}.xlsx`);
      showNotification('success', `Đã xuất ${visible.length} dòng đối chiếu Firebase ↔ máy Admin.`);
    } catch (err) {
      showNotification('error', `Không xuất được file đối chiếu: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const statusBar = (() => {
    if (cloudStatus.state === 'error') {
      return (
        <div className="flex items-start gap-2 rounded border border-rose-300 bg-rose-50 p-2.5 text-rose-900">
          <CloudOff className="w-4 h-4 mt-0.5 shrink-0" />
          <div className="flex-1">
            <div className="font-bold">Không tải được tiến độ từ Firebase</div>
            <div>{describeCloudError(cloudStatus.code)}</div>
            {cloudStatus.message && <div className="text-[10px] font-mono opacity-70 mt-0.5 break-all">{cloudStatus.code}: {cloudStatus.message}</div>}
          </div>
        </div>
      );
    }
    if (cloudStatus.state === 'loading' || cloudStatus.state === 'idle') {
      return (
        <div className="flex items-center gap-2 rounded border border-sky-300 bg-sky-50 p-2.5 text-sky-900">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span className="font-bold">Đang tải tiến độ từ Firebase...</span>
        </div>
      );
    }
    return (
      <div className={`flex items-start gap-2 rounded border p-2.5 ${
        cloudStatus.fromCache ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'
      }`}>
        {cloudStatus.fromCache ? <CloudOff className="w-4 h-4 mt-0.5 shrink-0" /> : <Cloud className="w-4 h-4 mt-0.5 shrink-0" />}
        <div>
          <div className="font-bold">
            {cloudStatus.fromCache
              ? 'Đang xem dữ liệu bộ nhớ đệm, CHƯA chạm được máy chủ Firebase'
              : `Đã kết nối Firebase: ${cloudStatus.docCount ?? cloudProgress.length} bản ghi tiến độ`}
          </div>
          <div>
            Đồng bộ lúc {formatTime(cloudStatus.lastSyncAt)}
            {cloudStatus.ignoredCount ? ` • ${cloudStatus.ignoredCount} bản ghi sai định dạng bị bỏ qua` : ''}
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 flex flex-col gap-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-extrabold text-slate-800 uppercase text-sm flex items-center gap-2">
          <Cloud className="w-4 h-4 text-sky-700" />
          Đối chiếu Firebase ↔ máy Admin
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReloadCloud}
            className="h-8 px-3 bg-sky-700 hover:bg-sky-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cloudStatus.state === 'loading' ? 'animate-spin' : ''}`} />
            <span>Tải lại từ Firebase</span>
          </button>
          {onResyncProgress && (
            <button
              type="button"
              onClick={onResyncProgress}
              disabled={resyncingProgress}
              title="Gửi lại số đếm tiến độ các địa bàn đã có phiếu từ máy này lên Firebase (dùng sau khi nạp file ĐTV mà chưa đồng bộ được)"
              className="h-8 px-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resyncingProgress ? 'animate-spin' : ''}`} />
              <span>{resyncingProgress ? 'Đang gửi...' : 'Gửi lại tiến độ lên Firebase'}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="h-8 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded font-bold cursor-pointer"
          >
            {expanded ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>
      </div>

      {statusBar}

      {cloudStatus.state === 'ok' && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFilter('PROBLEM')}
            className={`px-2.5 py-1 rounded border font-bold cursor-pointer ${filter === 'PROBLEM' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}>
            Cần xử lý: {problemCount}
          </button>
          {(['MISSING_COMMUNE', 'MISSING_AREA', 'BEHIND', 'SURVEYOR_MISMATCH', 'IN_SYNC'] as CloudReconcileStatus[]).map(s => (
            <button key={s} type="button" onClick={() => setFilter(s)}
              className={`px-2.5 py-1 rounded border font-bold cursor-pointer ${STATUS_STYLE[s]} ${filter === s ? 'ring-2 ring-slate-700' : ''}`}>
              {CLOUD_RECONCILE_LABELS[s]}: {counts[s]}
            </button>
          ))}
          <button type="button" onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 rounded border font-bold cursor-pointer ${filter === 'ALL' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'}`}>
            Tất cả: {items.length}
          </button>
        </div>
      )}

      {expanded && cloudStatus.state === 'ok' && (
        <>
          {problemCount > 0 && (
            <div className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2.5 text-amber-900">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                Có <strong>{problemCount}</strong> địa bàn ĐTV đã đẩy tiến độ lên Firebase nhưng máy Admin chưa có đủ dữ liệu.
                Các địa bàn này trước đây không hiện trong bảng tiến độ vì máy Admin chưa có bảng kê của chúng.
                <div className="flex gap-2 mt-1.5">
                  {onOpenImportTab && (
                    <button type="button" onClick={onOpenImportTab}
                      className="px-2.5 py-1 bg-white border border-amber-400 rounded font-bold cursor-pointer hover:bg-amber-100">
                      Đi tới Tải bảng kê
                    </button>
                  )}
                  {onOpenJsonImport && (
                    <button type="button" onClick={onOpenJsonImport}
                      className="px-2.5 py-1 bg-white border border-amber-400 rounded font-bold cursor-pointer hover:bg-amber-100">
                      Nạp JSON của ĐTV
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
          {problemCount === 0 && items.length > 0 && (
            <div className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 p-2.5 text-emerald-900 font-bold">
              <CheckCircle2 className="w-4 h-4" /> Máy Admin đã có đủ mọi địa bàn đang có trên Firebase.
            </div>
          )}
          {items.length === 0 && (
            <div className="text-slate-500">Firebase chưa có bản ghi tiến độ nào (ĐTV chưa đồng bộ).</div>
          )}

          {visible.length > 0 && (
            <>
              <div className="overflow-x-auto max-h-96 overflow-y-auto border border-slate-300 rounded">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700">
                    <tr>
                      {['Trạng thái', 'Xã', 'Địa bàn', 'ĐTV (Firebase)', 'Firebase (xong/tổng)', 'Máy Admin (xong/tổng)', 'Cập nhật lúc', 'Cần làm'].map(h => (
                        <th key={h} className="p-2 border border-slate-300 text-left font-bold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(i => (
                      <tr key={i.key} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-300">
                          <span className={`px-2 py-0.5 rounded border font-bold whitespace-nowrap ${STATUS_STYLE[i.status]}`}>
                            {CLOUD_RECONCILE_LABELS[i.status]}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300">[{i.snapshot.communeCode}] {i.snapshot.communeName}</td>
                        <td className="p-2 border border-slate-300">{i.snapshot.areaCode} - {i.snapshot.areaName}</td>
                        <td className="p-2 border border-slate-300">{i.snapshot.surveyorName || '---'}</td>
                        <td className="p-2 border border-slate-300 text-center font-bold">{i.snapshot.completedHouseholds}/{i.snapshot.totalHouseholds}</td>
                        <td className="p-2 border border-slate-300 text-center font-bold">{i.localCompleted}/{i.localTotal}</td>
                        <td className="p-2 border border-slate-300 whitespace-nowrap">{formatTime(i.snapshot.updatedAt)}</td>
                        <td className="p-2 border border-slate-300 text-slate-600">{STATUS_HINT[i.status] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <button type="button" onClick={handleExport}
                  className="h-8 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded font-bold flex items-center gap-1.5 cursor-pointer">
                  <Download className="w-3.5 h-3.5" />
                  <span>Xuất danh sách đối chiếu ({visible.length}) ra Excel</span>
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default CloudReconcilePanel;
