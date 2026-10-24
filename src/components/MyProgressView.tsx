/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock, Circle, FileText, MapPin, Target } from 'lucide-react';
import type { Commune, Household, SurveyArea } from '../types';
import type { Surveyor } from '../types/user';
import {
  getAreaProgressKey,
  isCompletedSurveyStatus,
  isInProgressSurveyStatus,
  normalizeSurveyorName,
  selectOfficialHouseholds
} from '../utils/areaDataTransfer';

export interface MyAreaProgress {
  key: string;
  areaId: string;
  communeId: string;
  communeCode: string;
  communeName: string;
  areaCode: string;
  areaName: string;
  total: number;
  done: number;
  doing: number;
  todo: number;
  households: Household[];
}

export interface MyProgressTotals {
  total: number;
  done: number;
  doing: number;
  todo: number;
  rate: number;
  areaCount: number;
  areaDone: number;
}

/** Tiến độ của RIÊNG ĐTV đang đăng nhập, tính từ dữ liệu trên máy (10 hộ chính thức/địa bàn). */
export function computeMyProgress(
  currentUser: Surveyor,
  households: Household[],
  areas: SurveyArea[],
  communes: Commune[]
): { rows: MyAreaProgress[]; totals: MyProgressTotals } {
  const myName = normalizeSurveyorName(currentUser.name || '');
  const communeByAny = new Map<string, Commune>();
  communes.forEach(c => {
    if (c.id) communeByAny.set(c.id, c);
    if (c.communeCode) communeByAny.set(c.communeCode, c);
  });
  const areaById = new Map(areas.map(a => [a.id, a]));

  const mine = households.filter(h =>
    h.assignedSurveyorId
      ? h.assignedSurveyorId === currentUser.id
      : Boolean(h.assignedSurveyorName) && normalizeSurveyorName(h.assignedSurveyorName || '') === myName
  );

  const groups = new Map<string, Household[]>();
  mine.forEach(h => {
    const commune = communeByAny.get(h.communeId) || communeByAny.get(h.communeCode);
    const key = getAreaProgressKey(commune?.communeCode || h.communeCode, h.areaCode) || `id:${h.areaId}`;
    const list = groups.get(key) || [];
    list.push(h);
    groups.set(key, list);
  });

  const rows: MyAreaProgress[] = Array.from(groups.entries()).map(([key, list]) => {
    const official = selectOfficialHouseholds(list);
    const sample = official[0] || list[0];
    const commune = communeByAny.get(sample.communeId) || communeByAny.get(sample.communeCode);
    const area = areaById.get(sample.areaId);
    const done = official.filter(h => isCompletedSurveyStatus(h.surveyStatus)).length;
    const doing = official.filter(h => !isCompletedSurveyStatus(h.surveyStatus) && isInProgressSurveyStatus(h.surveyStatus)).length;
    return {
      key,
      areaId: sample.areaId,
      communeId: commune?.id || sample.communeId,
      communeCode: commune?.communeCode || sample.communeCode || '',
      communeName: commune?.communeName || sample.communeName || '',
      areaCode: area?.code || sample.areaCode,
      areaName: (area?.name || sample.areaName || sample.sheetName || '').trim(),
      total: official.length,
      done,
      doing,
      todo: Math.max(0, official.length - done - doing),
      households: official
    };
  }).filter(row => row.total > 0)
    .sort((a, b) =>
      a.communeCode.localeCompare(b.communeCode, 'vi', { numeric: true }) ||
      a.areaCode.localeCompare(b.areaCode, 'vi', { numeric: true })
    );

  const total = rows.reduce((n, r) => n + r.total, 0);
  const done = rows.reduce((n, r) => n + r.done, 0);
  const doing = rows.reduce((n, r) => n + r.doing, 0);
  return {
    rows,
    totals: {
      total,
      done,
      doing,
      todo: Math.max(0, total - done - doing),
      rate: total > 0 ? Math.round((done / total) * 100) : 0,
      areaCount: rows.length,
      areaDone: rows.filter(r => r.total > 0 && r.done >= r.total).length
    }
  };
}

function StatusBadge({ household }: { household: Household }) {
  if (isCompletedSurveyStatus(household.surveyStatus)) {
    return <span className="px-2 py-0.5 rounded border bg-emerald-50 text-emerald-800 border-emerald-300 font-bold inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Đã xong</span>;
  }
  if (isInProgressSurveyStatus(household.surveyStatus)) {
    return <span className="px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-300 font-bold inline-flex items-center gap-1"><Clock className="w-3 h-3" />Đang nhập</span>;
  }
  return <span className="px-2 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-300 font-bold inline-flex items-center gap-1"><Circle className="w-3 h-3" />Chưa nhập</span>;
}

/** Thanh tiến độ gọn đặt đầu trang Nhập tin để ĐTV vừa làm vừa nhìn. */
export const MyProgressStrip: React.FC<{
  currentUser: Surveyor;
  households: Household[];
  areas: SurveyArea[];
  communes: Commune[];
  onOpenDetail?: () => void;
}> = ({ currentUser, households, areas, communes, onOpenDetail }) => {
  const { totals } = useMemo(
    () => computeMyProgress(currentUser, households, areas, communes),
    [currentUser, households, areas, communes]
  );
  if (totals.total === 0) return null;
  return (
    <div className="bg-white rounded-lg border border-teal-300 shadow-sm px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <div className="font-extrabold text-teal-900 flex items-center gap-1.5">
        <Target className="w-4 h-4" /> Tiến độ của tôi
      </div>
      <div className="flex-1 min-w-[200px] flex items-center gap-2">
        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-600" style={{ width: `${totals.rate}%` }} />
        </div>
        <strong className="text-emerald-800 w-10 text-right">{totals.rate}%</strong>
      </div>
      <span>Đã xong <strong className="text-emerald-700">{totals.done}</strong>/{totals.total} hộ</span>
      <span>Đang nhập <strong className="text-amber-700">{totals.doing}</strong></span>
      <span>Còn lại <strong className="text-rose-700">{totals.todo}</strong></span>
      {onOpenDetail && (
        <button type="button" onClick={onOpenDetail}
          className="px-2.5 py-1 bg-teal-700 hover:bg-teal-600 text-white rounded font-bold cursor-pointer">
          Xem chi tiết
        </button>
      )}
    </div>
  );
};

interface Props {
  currentUser: Surveyor;
  households: Household[];
  areas: SurveyArea[];
  communes: Commune[];
  onGoToEntry: (areaId: string, communeId: string) => void;
}

export const MyProgressView: React.FC<Props> = ({ currentUser, households, areas, communes, onGoToEntry }) => {
  const { rows, totals } = useMemo(
    () => computeMyProgress(currentUser, households, areas, communes),
    [currentUser, households, areas, communes]
  );
  const [onlyRemaining, setOnlyRemaining] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4 w-full pb-10 text-xs">
      <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 flex flex-col gap-3">
        <div>
          <h2 className="font-extrabold text-slate-800 text-sm md:text-base uppercase flex items-center gap-2">
            <Target className="w-5 h-5 text-teal-700" />
            <span>Tiến độ của tôi - {currentUser.name}</span>
          </h2>
          <p className="text-slate-500 mt-0.5">
            Chỉ gồm các địa bàn và hộ được giao cho tài khoản của bạn (10 hộ chính thức mỗi địa bàn), tính từ dữ liệu trên máy này.
          </p>
        </div>

        {totals.total === 0 ? (
          <div className="rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            Chưa có hộ nào được giao cho tài khoản này trên máy. Hãy nạp gói phân công JSON do Admin gửi ở tab "Xuất nhập dữ liệu".
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
              <div className="rounded border border-slate-300 bg-slate-50 p-3">
                <div className="text-slate-500">Tổng số hộ</div>
                <div className="text-2xl font-black text-slate-800">{totals.total}</div>
              </div>
              <div className="rounded border border-emerald-300 bg-emerald-50 p-3">
                <div className="text-emerald-700">Đã xong</div>
                <div className="text-2xl font-black text-emerald-800">{totals.done}</div>
              </div>
              <div className="rounded border border-amber-300 bg-amber-50 p-3">
                <div className="text-amber-700">Đang nhập</div>
                <div className="text-2xl font-black text-amber-800">{totals.doing}</div>
              </div>
              <div className="rounded border border-rose-300 bg-rose-50 p-3">
                <div className="text-rose-700">Chưa nhập</div>
                <div className="text-2xl font-black text-rose-800">{totals.todo}</div>
              </div>
              <div className="rounded border border-teal-300 bg-teal-50 p-3">
                <div className="text-teal-700">Địa bàn xong</div>
                <div className="text-2xl font-black text-teal-800">{totals.areaDone}/{totals.areaCount}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden flex">
                <div className="h-full bg-emerald-600" style={{ width: `${(totals.done / totals.total) * 100}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${(totals.doing / totals.total) * 100}%` }} />
              </div>
              <strong className="text-lg text-emerald-800 w-14 text-right">{totals.rate}%</strong>
            </div>
          </>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between">
          <h3 className="font-extrabold text-slate-700 uppercase">Theo từng địa bàn ({rows.length})</h3>
          <label className="flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={onlyRemaining} onChange={e => setOnlyRemaining(e.target.checked)} />
            Chỉ hiện hộ chưa xong
          </label>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {rows.map(row => {
          const rate = Math.round((row.done / row.total) * 100);
          const finished = row.done >= row.total;
          const open = openKey === row.key;
          const shown = onlyRemaining
            ? row.households.filter(h => !isCompletedSurveyStatus(h.surveyStatus))
            : row.households;
          return (
            <div key={row.key} className={`bg-white rounded-lg border shadow-sm ${finished ? 'border-emerald-400' : 'border-slate-300'}`}>
              <div className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="min-w-[200px] flex-1">
                  <div className="font-extrabold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-teal-700" />
                    [{row.communeCode}] {row.communeName} - Địa bàn {row.areaCode}
                    {finished && <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px]">HOÀN THÀNH</span>}
                  </div>
                  {row.areaName && <div className="text-slate-500">{row.areaName}</div>}
                </div>
                <div className="flex-1 min-w-[180px] flex items-center gap-2">
                  <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden flex">
                    <div className="h-full bg-emerald-600" style={{ width: `${(row.done / row.total) * 100}%` }} />
                    <div className="h-full bg-amber-400" style={{ width: `${(row.doing / row.total) * 100}%` }} />
                  </div>
                  <strong className="w-10 text-right">{rate}%</strong>
                </div>
                <div className="font-bold">
                  <span className="text-emerald-700">{row.done}</span> xong •{' '}
                  <span className="text-amber-700">{row.doing}</span> đang •{' '}
                  <span className="text-rose-700">{row.todo}</span> chưa / {row.total}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpenKey(open ? null : row.key)}
                    className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded font-bold cursor-pointer">
                    {open ? 'Ẩn hộ' : 'Xem hộ'}
                  </button>
                  <button type="button" onClick={() => onGoToEntry(row.areaId, row.communeId)}
                    className="px-2.5 py-1 bg-teal-700 hover:bg-teal-600 text-white rounded font-bold cursor-pointer flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" /> Nhập tin
                  </button>
                </div>
              </div>
              {open && (
                <div className="border-t border-slate-200 overflow-x-auto">
                  {shown.length === 0 ? (
                    <div className="p-3 text-emerald-700 font-bold">Tất cả hộ trong địa bàn này đã xong.</div>
                  ) : (
                    <table className="w-full border-collapse min-w-[520px]">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="p-2 border-b border-slate-300 text-left w-16">STT mẫu</th>
                          <th className="p-2 border-b border-slate-300 text-left">Chủ hộ</th>
                          <th className="p-2 border-b border-slate-300 text-left">Địa chỉ</th>
                          <th className="p-2 border-b border-slate-300 text-left w-28">Trạng thái</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map(h => (
                          <tr key={h.id} className="hover:bg-slate-50">
                            <td className="p-2 border-b border-slate-200 font-bold">{h.sttMau}</td>
                            <td className="p-2 border-b border-slate-200">{h.householdHead}</td>
                            <td className="p-2 border-b border-slate-200 text-slate-600">{h.address || '---'}</td>
                            <td className="p-2 border-b border-slate-200"><StatusBadge household={h} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyProgressView;
