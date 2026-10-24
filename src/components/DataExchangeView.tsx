/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ArrowRightLeft, Database, Download, FileJson, FileSpreadsheet, Cloud, Upload, UserCheck, Layers
} from 'lucide-react';
import type { Surveyor } from '../types/user';

export type ExchangeAction =
  | { type: 'export-package' }
  | { type: 'import-package' }
  | { type: 'import-any' };

interface Props {
  currentUser: Surveyor;
  householdCount: number;
  areaCount: number;
  communeCount: number;
  onOpenTransfer: (action: ExchangeAction) => void;
  onExportLocalBackup: () => void;
  onExportPreRestoreBackup: () => void;
  onRestoreLocalBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportSurveyorBackup: () => void;
  onRestoreSurveyorEntryBackup: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportEnteredExcel: () => void;
  onGoToProgress?: () => void;
}

interface CardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accent: string;
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({ icon, title, desc, accent, children }) => (
  <section className={`bg-white rounded-lg border border-slate-300 shadow-sm overflow-hidden flex flex-col`}>
    <header className={`px-4 py-2.5 border-b border-slate-200 flex items-center gap-2 ${accent}`}>
      {icon}
      <h3 className="font-extrabold text-sm uppercase">{title}</h3>
    </header>
    <div className="p-4 flex flex-col gap-3 text-xs text-slate-600">
      <p className="leading-relaxed">{desc}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  </section>
);

const btn = 'w-full min-h-10 px-3.5 py-2 text-white rounded border text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors text-left';

const ActionButton: React.FC<{
  onClick: () => void; color: string; icon: React.ReactNode; label: string; sub?: string;
}> = ({ onClick, color, icon, label, sub }) => (
  <button type="button" onClick={onClick} className={`${btn} ${color}`}>
    <span className="shrink-0">{icon}</span>
    <span className="flex flex-col">
      <span>{label}</span>
      {sub && <span className="text-[10px] font-medium opacity-80">{sub}</span>}
    </span>
  </button>
);

const FileButton: React.FC<{
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; color: string; icon: React.ReactNode; label: string; sub?: string;
}> = ({ onChange, color, icon, label, sub }) => (
  <label className={`${btn} ${color}`}>
    <span className="shrink-0">{icon}</span>
    <span className="flex flex-col">
      <span>{label}</span>
      {sub && <span className="text-[10px] font-medium opacity-80">{sub}</span>}
    </span>
    <input type="file" accept=".json,application/json" className="hidden" onChange={onChange} />
  </label>
);

export const DataExchangeView: React.FC<Props> = ({
  currentUser, householdCount, areaCount, communeCount, onOpenTransfer,
  onExportLocalBackup, onExportPreRestoreBackup, onRestoreLocalBackup,
  onExportSurveyorBackup, onRestoreSurveyorEntryBackup, onExportEnteredExcel, onGoToProgress
}) => {
  const isAdmin = currentUser.role === 'ADMIN';
  const isSurveyor = currentUser.role === 'SURVEYOR';
  const canManage = !isSurveyor;

  return (
    <div className="flex flex-col gap-4 w-full pb-10">
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold text-slate-800 text-sm md:text-base uppercase flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-teal-700" />
            <span>Xuất nhập dữ liệu</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Toàn bộ chức năng xuất, nhập, sao lưu và khôi phục dữ liệu tập trung tại một nơi.
          </p>
        </div>
        <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-1.5">
          Trên máy này: <strong>{communeCount}</strong> xã • <strong>{areaCount}</strong> địa bàn • <strong>{householdCount}</strong> hộ
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* GIAO NHẬN JSON ĐTV */}
        <Card
          icon={<FileJson className="w-5 h-5 text-sky-700" />}
          accent="bg-sky-50 text-sky-900"
          title="Giao nhận JSON ĐTV"
          desc={canManage
            ? 'Xuất gói bảng kê phân công cho ĐTV, và nhận kết quả ĐTV gửi về bằng một trong hai cách đọc bên dưới.'
            : 'Nạp gói phân công do Admin gửi và xuất kết quả mới làm để gửi lại Admin.'}
        >
          {canManage ? (
            <>
              <ActionButton
                onClick={() => onOpenTransfer({ type: 'export-package' })}
                color="bg-sky-800 hover:bg-sky-700 border-sky-700"
                icon={<Download className="w-4 h-4 text-amber-300" />}
                label="Xuất Data Bảng Kê Cho ĐTV (.json)"
                sub="Gói phân công bảng kê và quyền theo từng ĐTV"
              />
              <ActionButton
                onClick={() => onOpenTransfer({ type: 'import-package' })}
                color="bg-emerald-800 hover:bg-emerald-700 border-emerald-700"
                icon={<UserCheck className="w-4 h-4 text-emerald-200" />}
                label="Đọc trực tiếp JSON do ĐTV xuất ra"
                sub="Gói kết quả chuẩn ĐTV bấm xuất từ ứng dụng; chọn được nhiều file"
              />
              <ActionButton
                onClick={() => onOpenTransfer({ type: 'import-any' })}
                color="bg-teal-700 hover:bg-teal-600 border-teal-600"
                icon={<Layers className="w-4 h-4 text-teal-100" />}
                label="Đọc file JSON nhiều định dạng khác nhau"
                sub="backup.json, sao lưu phiếu của ĐTV, danh sách hộ/phiếu rời: tự nhận dạng"
              />
            </>
          ) : (
            <>
              <ActionButton
                onClick={() => onOpenTransfer({ type: 'import-package' })}
                color="bg-emerald-700 hover:bg-emerald-600 border-emerald-600"
                icon={<Upload className="w-4 h-4" />}
                label="Nhập Data Địa Bàn (.json)"
                sub="Nạp file Admin gửi để nhận danh sách hộ phụ trách"
              />
              <ActionButton
                onClick={() => onOpenTransfer({ type: 'export-package' })}
                color="bg-sky-700 hover:bg-sky-600 border-sky-600"
                icon={<Download className="w-4 h-4 text-amber-300" />}
                label="Xuất Data Mới Làm Gửi Admin (.json)"
                sub="Địa bàn đã hoàn thành hoặc mới sửa"
              />
            </>
          )}
        </Card>

        {/* SAO LƯU / KHÔI PHỤC */}
        <Card
          icon={<Database className="w-5 h-5 text-slate-700" />}
          accent="bg-slate-100 text-slate-900"
          title="Sao lưu & khôi phục"
          desc={isAdmin
            ? 'Sao lưu đầy đủ dữ liệu trên máy Admin ra file JSON và khôi phục khi cần.'
            : canManage
              ? 'Sao lưu và khôi phục dữ liệu trong phạm vi tài khoản.'
              : 'Sao lưu chỉ gồm địa bàn và hộ được giao cho tài khoản ĐTV này.'}
        >
          {isAdmin && (
            <>
              <ActionButton
                onClick={onExportLocalBackup}
                color="bg-slate-700 hover:bg-slate-600 border-slate-600"
                icon={<Database className="w-4 h-4" />}
                label="Sao lưu JSON"
                sub="Tải bản sao lưu đầy đủ dữ liệu cục bộ về thiết bị"
              />
              <ActionButton
                onClick={onExportPreRestoreBackup}
                color="bg-slate-600 hover:bg-slate-500 border-slate-500"
                icon={<Download className="w-4 h-4" />}
                label="Tải backup cũ"
                sub="Bản sao lưu được giữ lại trước lần khôi phục gần nhất"
              />
              <FileButton
                onChange={onRestoreLocalBackup}
                color="bg-amber-700 hover:bg-amber-600 border-amber-600"
                icon={<Upload className="w-4 h-4" />}
                label="Khôi phục backup JSON"
                sub="Khôi phục toàn bộ dữ liệu từ file backup trên thiết bị"
              />
            </>
          )}
          {isSurveyor && (
            <>
              <ActionButton
                onClick={onExportSurveyorBackup}
                color="bg-slate-700 hover:bg-slate-600 border-slate-600"
                icon={<Database className="w-4 h-4" />}
                label="Sao lưu của tôi"
                sub="Chỉ gồm địa bàn và hộ được giao cho tài khoản này"
              />
              <FileButton
                onChange={onRestoreLocalBackup}
                color="bg-amber-700 hover:bg-amber-600 border-amber-600"
                icon={<Upload className="w-4 h-4" />}
                label="Khôi phục backup của tôi"
                sub="Backup cá nhân đã xuất bằng chính tài khoản này"
              />
              <FileButton
                onChange={onRestoreSurveyorEntryBackup}
                color="bg-teal-800 hover:bg-teal-700 border-teal-700"
                icon={<Upload className="w-4 h-4" />}
                label="Khôi phục phiếu backup.json"
                sub="File chỉ chứa phiếu, ghép vào các hộ đã giao cho tài khoản này"
              />
            </>
          )}
          {!isAdmin && !isSurveyor && (
            <div className="text-slate-500 italic">Tài khoản này không có chức năng sao lưu toàn bộ dữ liệu.</div>
          )}
        </Card>

        {/* EXCEL */}
        <Card
          icon={<FileSpreadsheet className="w-5 h-5 text-teal-700" />}
          accent="bg-teal-50 text-teal-900"
          title="Xuất Excel"
          desc="Xuất file Excel đầy đủ nội dung thông tin các phiếu đã nhập tin."
        >
          <ActionButton
            onClick={onExportEnteredExcel}
            color="bg-teal-800 hover:bg-teal-700 border-teal-700"
            icon={<FileSpreadsheet className="w-4 h-4" />}
            label="Xuất Excel Phiếu Đã Nhập"
          />
        </Card>

        {/* FIREBASE */}
        {canManage && onGoToProgress && (
          <Card
            icon={<Cloud className="w-5 h-5 text-sky-700" />}
            accent="bg-sky-50 text-sky-900"
            title="Kiểm tra tiến độ Firebase"
            desc="Firebase chỉ nhận số đếm tiến độ do ĐTV đồng bộ; phiếu chi tiết nằm ở file JSON. Xem địa bàn nào Firebase đã có mà máy Admin chưa nạp."
          >
            <ActionButton
              onClick={onGoToProgress}
              color="bg-sky-700 hover:bg-sky-600 border-sky-600"
              icon={<Cloud className="w-4 h-4" />}
              label="Mở đối chiếu Firebase ↔ máy Admin"
              sub="Tab Tiến độ ĐTV"
            />
          </Card>
        )}
      </div>
    </div>
  );
};

export default DataExchangeView;
