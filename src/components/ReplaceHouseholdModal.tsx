import React, { useState, useMemo } from 'react';
import { 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  UserCheck, 
  Home, 
  Layers, 
  FileText, 
  PlusCircle, 
  Search,
  UserPlus
} from 'lucide-react';
import { Household, SurveyArea } from '../App';

interface ReplaceHouseholdModalProps {
  isOpen: boolean;
  onClose: () => void;
  householdToReplace: Household | null;
  allHouseholds: Household[];
  areas: SurveyArea[];
  onConfirmReplacement: (
    original: Household,
    replacement: Household,
    options: {
      reason: string;
      customNote: string;
      keepSttMau: boolean;
      transferSurveyor: boolean;
    }
  ) => Promise<void>;
  onAddNewReserveHousehold?: (
    newHousehold: {
      householdHead: string;
      address: string;
      membersCount: number;
      sectorCode: 1 | 2 | 3 | 4;
      phone: string;
      note: string;
      communeId: string;
      communeCode: string;
      communeName: string;
      tkcsCode: string;
      tkcsName: string;
      areaId: string;
      areaCode: string;
      areaName: string;
    }
  ) => Promise<Household | null>;
}

const DEFAULT_REASONS = [
  'Chuyển đi nơi khác / Không còn thường trú tại địa bàn',
  'Vắng mặt kéo dài trong toàn bộ thời gian điều tra',
  'Từ chối cung cấp thông tin thu nhập',
  'Chủ hộ qua đời / Hộ đã giải thể hoàn toàn',
  'Địa chỉ không có thực hoặc không thể tiếp cận',
  'Lý do bất khả kháng khác (nhập bên dưới)'
];

export const ReplaceHouseholdModal: React.FC<ReplaceHouseholdModalProps> = ({
  isOpen,
  onClose,
  householdToReplace,
  allHouseholds,
  areas,
  onConfirmReplacement,
  onAddNewReserveHousehold
}) => {
  const [selectedReserveId, setSelectedReserveId] = useState<string>('');
  const [selectedReason, setSelectedReason] = useState<string>(DEFAULT_REASONS[0]);
  const [customNote, setCustomNote] = useState<string>('');
  const [keepSttMau, setKeepSttMau] = useState<boolean>(true);
  const [transferSurveyor, setTransferSurveyor] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showAllInArea, setShowAllInArea] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick add reserve household mode
  const [isAddingNewReserve, setIsAddingNewReserve] = useState<boolean>(false);
  const [newHeadName, setNewHeadName] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newMembers, setNewMembers] = useState<number>(4);
  const [newSector, setNewSector] = useState<1 | 2 | 3 | 4>(2);
  const [newPhone, setNewPhone] = useState<string>('');
  const [newNote, setNewNote] = useState<string>('');

  // Identify area name
  const matchedArea = useMemo(() => {
    if (!householdToReplace) return undefined;
    return areas.find(a => 
      (householdToReplace.areaId && a.id === householdToReplace.areaId) ||
      (householdToReplace.areaCode && a.code === householdToReplace.areaCode && (!householdToReplace.communeId || !a.communeId || a.communeId === householdToReplace.communeId)) ||
      (householdToReplace.areaCode && a.code === householdToReplace.areaCode)
    );
  }, [areas, householdToReplace]);

  const areaNameDisplay = (householdToReplace?.areaName && householdToReplace.areaName.trim() && householdToReplace.areaName !== 'Địa bàn')
    ? householdToReplace.areaName.trim()
    : (matchedArea?.name && matchedArea.name.trim() && matchedArea.name !== 'Địa bàn')
    ? matchedArea.name.trim()
    : ((householdToReplace as any)?.sheetName || (householdToReplace?.areaCode ? `Địa bàn ${householdToReplace.areaCode}` : '---'));

  // Get all households in the SAME enumeration area
  const sameAreaHouseholds = useMemo(() => {
    if (!householdToReplace) return [];
    return allHouseholds.filter(h => {
      if (h.id === householdToReplace.id) return false;
      const sameArea = (h.areaId && householdToReplace.areaId && h.areaId === householdToReplace.areaId) ||
        (Boolean(h.areaCode) && Boolean(householdToReplace.areaCode) && h.areaCode === householdToReplace.areaCode && (
          !h.communeId || !householdToReplace.communeId || h.communeId === householdToReplace.communeId ||
          !h.communeCode || !householdToReplace.communeCode || h.communeCode === householdToReplace.communeCode
        )) ||
        (Boolean(h.areaName) && Boolean(householdToReplace.areaName) && h.areaName !== 'Địa bàn' && householdToReplace.areaName !== 'Địa bàn' && h.areaName.trim().toLowerCase() === householdToReplace.areaName.trim().toLowerCase() && (
          !h.communeId || !householdToReplace.communeId || h.communeId === householdToReplace.communeId
        )) ||
        (Boolean((h as any).sheetName) && Boolean((householdToReplace as any).sheetName) && (h as any).sheetName.trim().toLowerCase() === (householdToReplace as any).sheetName.trim().toLowerCase());
      return sameArea;
    });
  }, [allHouseholds, householdToReplace]);

  // Pure reserve households in the same area - ĐÚNG 4 HỘ DỰ PHÒNG CỦA ĐỊA BÀN NÀY
  const candidateReserveHouseholds = useMemo(() => {
    if (!householdToReplace) return [];
    const rawReserves = sameAreaHouseholds.filter(h => {
      const status = (h.sampleStatus || '').toUpperCase();
      const isReserve = status.includes('DỰ PHÒNG') || status.includes('DP') || status === 'RESERVE' || h.sttMau === 'DP';
      return isReserve;
    });

    const list = [...rawReserves];

    // Đảm bảo hiển thị đúng 4 hộ dự phòng của địa bàn này
    if (list.length < 4) {
      const needed = 4 - list.length;
      for (let i = 1; i <= needed; i++) {
        const slotNum = list.length + 1;
        const synthId = `synth-dp-${householdToReplace.areaCode || '001'}-${slotNum}`;
        list.push({
          id: synthId,
          communeId: householdToReplace.communeId,
          communeCode: householdToReplace.communeCode,
          communeName: householdToReplace.communeName,
          tkcsCode: householdToReplace.tkcsCode,
          tkcsName: householdToReplace.tkcsName,
          areaId: householdToReplace.areaId,
          areaCode: householdToReplace.areaCode,
          areaName: areaNameDisplay,
          sttMau: 'DP',
          sttGoc: `DP-0${slotNum}`,
          sampleStatus: 'DỰ PHÒNG',
          householdHead: `Hộ dự phòng ${slotNum} (${areaNameDisplay})`,
          address: areaNameDisplay,
          phone: '',
          membersCount: 4,
          workingMembersCount: 2,
          membersCountEntered: false,
          sectorCode: 2,
          sectorName: 'Công nghiệp & xây dựng',
          note: `[Hộ dự phòng số ${slotNum} của địa bàn ${householdToReplace.areaCode}]`,
          surveyStatus: 'CHUA_NHAP',
          assignedSurveyorId: householdToReplace.assignedSurveyorId || '',
          assignedSurveyorName: householdToReplace.assignedSurveyorName || '',
          questionnaire: undefined as any
        });
      }
    }

    return list.slice(0, 4);
  }, [sameAreaHouseholds, householdToReplace, areaNameDisplay]);

  // Households to display based on toggle
  const availableCandidates = useMemo(() => {
    const source = (showAllInArea) 
      ? sameAreaHouseholds 
      : candidateReserveHouseholds;

    if (!searchTerm.trim()) return source;
    const term = searchTerm.toLowerCase().trim();
    return source.filter(h => 
      h.householdHead?.toLowerCase().includes(term) ||
      h.sttGoc?.includes(term) ||
      h.address?.toLowerCase().includes(term) ||
      h.phone?.includes(term)
    );
  }, [candidateReserveHouseholds, sameAreaHouseholds, showAllInArea, searchTerm]);

  // Tự động chọn hộ dự phòng đầu tiên nếu chưa chọn
  React.useEffect(() => {
    if (!selectedReserveId && candidateReserveHouseholds.length > 0) {
      setSelectedReserveId(candidateReserveHouseholds[0].id);
    }
  }, [candidateReserveHouseholds, selectedReserveId]);

  // Selected reserve household object
  const selectedReserveHousehold = useMemo(() => {
    return candidateReserveHouseholds.find(h => h.id === selectedReserveId) || sameAreaHouseholds.find(h => h.id === selectedReserveId);
  }, [candidateReserveHouseholds, sameAreaHouseholds, selectedReserveId]);

  // Return null AFTER all hooks have executed to comply with React 19 Rules of Hooks
  if (!isOpen || !householdToReplace) return null;

  const handleConfirm = async () => {
    if (!selectedReserveHousehold || !householdToReplace) return;
    setIsSubmitting(true);
    try {
      let targetHh = selectedReserveHousehold;
      if (targetHh.id.startsWith('synth-dp-') && onAddNewReserveHousehold) {
        const created = await onAddNewReserveHousehold({
          householdHead: targetHh.householdHead,
          address: targetHh.address,
          membersCount: targetHh.membersCount,
          sectorCode: targetHh.sectorCode as any,
          phone: targetHh.phone,
          note: targetHh.note,
          communeId: targetHh.communeId,
          communeCode: targetHh.communeCode,
          communeName: targetHh.communeName,
          tkcsCode: targetHh.tkcsCode,
          tkcsName: targetHh.tkcsName,
          areaId: targetHh.areaId,
          areaCode: targetHh.areaCode,
          areaName: targetHh.areaName
        });
        if (created) targetHh = created;
      }

      await onConfirmReplacement(householdToReplace, targetHh, {
        reason: selectedReason,
        customNote,
        keepSttMau,
        transferSurveyor
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddReserve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeadName.trim() || !onAddNewReserveHousehold) return;
    setIsSubmitting(true);
    try {
      const created = await onAddNewReserveHousehold({
        householdHead: newHeadName.trim(),
        address: newAddress.trim() || areaNameDisplay,
        membersCount: Number(newMembers) || 4,
        sectorCode: newSector,
        phone: newPhone.trim(),
        note: newNote.trim() ? `[Hộ dự phòng] ${newNote.trim()}` : '[Hộ dự phòng bổ sung]',
        communeId: householdToReplace.communeId,
        communeCode: householdToReplace.communeCode,
        communeName: householdToReplace.communeName,
        tkcsCode: householdToReplace.tkcsCode,
        tkcsName: householdToReplace.tkcsName,
        areaId: householdToReplace.areaId,
        areaCode: householdToReplace.areaCode,
        areaName: areaNameDisplay
      });

      if (created) {
        setSelectedReserveId(created.id);
        setIsAddingNewReserve(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-amber-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-950/60 rounded-lg border border-amber-400/30">
              <RefreshCw className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="font-black text-sm sm:text-base uppercase tracking-tight flex items-center gap-2">
                <span>Thay thế Hộ Mẫu Điều tra bằng Hộ Dự phòng</span>
              </h2>
              <p className="text-xs text-amber-200 mt-0.5 font-medium">
                Cùng địa bàn [Mã {householdToReplace.areaCode}] - {areaNameDisplay} (Xã/Phường: {householdToReplace.communeName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-amber-200 hover:text-white hover:bg-amber-800/80 transition-colors cursor-pointer"
            title="Đóng cửa sổ"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* SECTION 1: Target household being replaced */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-3.5 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <span className="font-extrabold text-amber-950 uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>1. Thông tin Hộ mẫu cần thay thế</span>
              </span>
              <span className="px-2 py-0.5 rounded font-black text-[10px] bg-amber-200 text-amber-900 border border-amber-300">
                {householdToReplace.sampleStatus || 'Chính thức'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-slate-800">
              <div>
                <span className="text-slate-500 block text-[11px]">Họ và tên chủ hộ:</span>
                <strong className="text-slate-900 font-bold text-sm block">{householdToReplace.householdHead}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">STT Mẫu / Gốc:</span>
                <strong className="text-slate-900 font-bold">Mẫu {householdToReplace.sttMau} (Gốc: {householdToReplace.sttGoc})</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Địa bàn điều tra:</span>
                <strong className="text-slate-900 font-bold">[{householdToReplace.areaCode}] {areaNameDisplay}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">ĐTV phụ trách:</span>
                <strong className="text-slate-900 font-bold">{householdToReplace.assignedSurveyorName || 'Chưa phân công'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Địa chỉ:</span>
                <span className="text-slate-700">{householdToReplace.address || '---'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Nhân khẩu:</span>
                <span className="text-slate-700 font-semibold">{householdToReplace.membersCount} người</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Ngành kinh tế:</span>
                <span className="text-slate-700 font-semibold">{householdToReplace.sectorName}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px]">Điện thoại:</span>
                <span className="text-slate-700">{householdToReplace.phone || '---'}</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Reason for replacement */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-3.5 flex flex-col gap-2.5">
            <span className="font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-sky-700" />
              <span>2. Lý do thay thế hộ mẫu</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Chọn lý do theo quy định điều tra:
                </label>
                <select
                  value={selectedReason}
                  onChange={e => setSelectedReason(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-2xs"
                >
                  {DEFAULT_REASONS.map((r, idx) => (
                    <option key={idx} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Ghi chú bổ sung:
                </label>
                <input
                  type="text"
                  value={customNote}
                  onChange={e => setCustomNote(e.target.value)}
                  placeholder="Ví dụ: Đã đến 3 lần ngày 05-08/10 nhưng hộ vắng nhà..."
                  className="w-full bg-white border border-slate-300 rounded p-2 text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-2xs"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: Select reserve household in SAME area */}
          <div className="bg-white border border-slate-300 rounded-lg p-3.5 flex flex-col gap-3 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div>
                <span className="font-extrabold text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-700" />
                  <span>3. Danh sách đúng 4 hộ dự phòng của địa bàn [{householdToReplace.areaCode}] để thay thế</span>
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Hiển thị đúng 4 hộ dự phòng của địa bàn [{householdToReplace.areaCode}] {areaNameDisplay}. Bạn có thể bấm chọn 1 trong 4 hộ bên dưới.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNewReserve(!isAddingNewReserve)}
                  className="px-2.5 py-1 bg-teal-800 hover:bg-teal-700 text-white rounded font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs text-xs"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isAddingNewReserve ? 'Ẩn form thêm' : '+ Thêm hộ dự phòng mới'}</span>
                </button>
              </div>
            </div>

            {/* Quick add reserve form if toggled */}
            {isAddingNewReserve && (
              <form onSubmit={handleQuickAddReserve} className="bg-teal-50/80 border border-teal-300 rounded-lg p-3 flex flex-col gap-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-teal-200 pb-1.5">
                  <span className="font-bold text-teal-950 flex items-center gap-1">
                    <UserPlus className="w-4 h-4 text-teal-700" />
                    <span>Thêm nhanh hộ dự phòng mới cho địa bàn [{householdToReplace.areaCode}]</span>
                  </span>
                  <span className="text-[11px] text-teal-700 font-medium">Tự động gắn vào địa bàn {areaNameDisplay}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Họ và tên chủ hộ: *</label>
                    <input
                      type="text"
                      required
                      value={newHeadName}
                      onChange={e => setNewHeadName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full bg-white border border-teal-300 rounded p-1.5 font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Địa chỉ:</label>
                    <input
                      type="text"
                      value={newAddress}
                      onChange={e => setNewAddress(e.target.value)}
                      placeholder={areaNameDisplay}
                      className="w-full bg-white border border-teal-300 rounded p-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Số nhân khẩu:</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={newMembers}
                      onChange={e => setNewMembers(Number(e.target.value) || 1)}
                      className="w-full bg-white border border-teal-300 rounded p-1.5 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Ngành thu nhập chính:</label>
                    <select
                      value={newSector}
                      onChange={e => setNewSector(Number(e.target.value) as any)}
                      className="w-full bg-white border border-teal-300 rounded p-1.5 text-slate-900 font-bold focus:outline-none focus:ring-1 focus:ring-teal-600 cursor-pointer"
                    >
                      <option value={1}>1. Nông, lâm nghiệp & thủy sản</option>
                      <option value={2}>2. Công nghiệp & xây dựng</option>
                      <option value={3}>3. Thương mại & dịch vụ</option>
                      <option value={4}>4. Nguồn thu khác / Lương hưu</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Điện thoại liên hệ:</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="0987..."
                      className="w-full bg-white border border-teal-300 rounded p-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-0.5">Ghi chú:</label>
                    <input
                      type="text"
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Hộ dự phòng số 1..."
                      className="w-full bg-white border border-teal-300 rounded p-1.5 text-slate-900 focus:outline-none focus:ring-1 focus:ring-teal-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingNewReserve(false)}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded font-bold cursor-pointer"
                  >
                    Hủy thêm
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newHeadName.trim()}
                    className="px-3.5 py-1 bg-teal-800 hover:bg-teal-700 text-white rounded font-bold cursor-pointer transition-colors shadow-2xs"
                  >
                    {isSubmitting ? 'Đang thêm...' : 'Lưu hộ & Chọn thay ngay'}
                  </button>
                </div>
              </form>
            )}

            {/* Filter bar for reserve list */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên chủ hộ, STT gốc, địa chỉ..."
                  className="w-full bg-white border border-slate-300 rounded pl-8 pr-3 py-1.5 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer select-none text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={showAllInArea}
                    onChange={e => setShowAllInArea(e.target.checked)}
                    className="rounded text-sky-600 cursor-pointer"
                  />
                  <span>Hiện cả các hộ khác trong địa bàn: {sameAreaHouseholds.length} hộ</span>
                </label>
              </div>
            </div>

            {/* Candidate Table */}
            <div className="overflow-x-auto border border-slate-300 rounded max-h-56 overflow-y-auto">
              <table className="w-full border-collapse text-left whitespace-nowrap">
                <thead className="sticky top-0 bg-[#058da0] text-white font-bold text-[11px] shadow-2xs">
                  <tr>
                    <th className="p-2 border border-[#047484] text-center w-12">Chọn</th>
                    <th className="p-2 border border-[#047484] text-center w-16">STT Gốc</th>
                    <th className="p-2 border border-[#047484] text-center w-16">Mẫu</th>
                    <th className="p-2 border border-[#047484]">Họ và tên chủ hộ</th>
                    <th className="p-2 border border-[#047484]">Địa chỉ</th>
                    <th className="p-2 border border-[#047484] text-center">Khẩu</th>
                    <th className="p-2 border border-[#047484]">Ngành kinh tế</th>
                    <th className="p-2 border border-[#047484]">Ghi chú / SĐT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {availableCandidates.map(hh => {
                    const isSelected = selectedReserveId === hh.id;
                    const isReserve = (hh.sampleStatus || '').toUpperCase().includes('DỰ PHÒNG') || (hh.sampleStatus || '').toUpperCase().includes('DP');

                    return (
                      <tr
                        key={hh.id}
                        onClick={() => setSelectedReserveId(hh.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-amber-100/90 font-bold text-amber-950' 
                            : isReserve 
                            ? 'hover:bg-purple-50/70 bg-purple-50/20' 
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="p-2 border border-slate-300 text-center">
                          <input
                            type="radio"
                            name="selectedReserveHousehold"
                            checked={isSelected}
                            onChange={() => setSelectedReserveId(hh.id)}
                            className="rounded-full text-amber-600 focus:ring-amber-500 cursor-pointer w-4 h-4"
                          />
                        </td>
                        <td className="p-2 border border-slate-300 text-center text-slate-700">
                          {hh.sttGoc || '---'}
                        </td>
                        <td className="p-2 border border-slate-300 text-center">
                          <span className={`font-semibold text-xs ${
                            isReserve 
                              ? 'text-purple-700' 
                              : 'text-slate-700'
                          }`}>
                            {hh.sampleStatus || 'Dự phòng'}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-300 font-bold text-slate-900">
                          {hh.householdHead}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-700">
                          {hh.address || areaNameDisplay}
                        </td>
                        <td className="p-2 border border-slate-300 text-center font-bold text-slate-800">
                          {hh.membersCount}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-800">
                          {hh.sectorName}
                        </td>
                        <td className="p-2 border border-slate-300 text-slate-600">
                          {hh.phone ? `${hh.phone} ${hh.note ? `(${hh.note})` : ''}` : hh.note || '---'}
                        </td>
                      </tr>
                    );
                  })}

                  {availableCandidates.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                        Không tìm thấy hộ dự phòng nào phù hợp trong địa bàn [{householdToReplace.areaCode}]. 
                        Bạn có thể bấm "+ Thêm hộ dự phòng mới" ở trên để bổ sung ngay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {selectedReserveHousehold && (
              <div className="bg-emerald-50 border border-emerald-300 rounded p-2.5 flex items-center justify-between text-emerald-950 font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Đã chọn hộ thay thế: <strong>{selectedReserveHousehold.householdHead}</strong> (STT Gốc: {selectedReserveHousehold.sttGoc}, {selectedReserveHousehold.membersCount} nhân khẩu)
                  </span>
                </div>
                <span className="text-xs text-emerald-700 underline cursor-pointer" onClick={() => setSelectedReserveId('')}>
                  Bỏ chọn
                </span>
              </div>
            )}
          </div>

          {/* SECTION 4: Options */}
          <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-semibold">
              <input
                type="checkbox"
                checked={keepSttMau}
                onChange={e => setKeepSttMau(e.target.checked)}
                className="rounded text-amber-600 w-4 h-4 cursor-pointer"
              />
              <span>Giữ nguyên STT Mẫu ({householdToReplace.sttMau}) cho hộ dự phòng được chọn</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-semibold">
              <input
                type="checkbox"
                checked={transferSurveyor}
                onChange={e => setTransferSurveyor(e.target.checked)}
                className="rounded text-amber-600 w-4 h-4 cursor-pointer"
              />
              <span>Chuyển ĐTV ({householdToReplace.assignedSurveyorName || 'Hiện tại'}) sang phụ trách hộ mới</span>
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-300 px-5 py-3 flex items-center justify-between shrink-0">
          <div className="text-slate-600 text-[11px]">
            Hộ cũ sẽ được ghi nhận trạng thái "ĐÃ THAY THẾ" và lưu vết lý do minh bạch.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-200 text-slate-700 rounded font-bold cursor-pointer transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isSubmitting || !selectedReserveId}
              className={`px-5 py-2 text-white rounded font-bold flex items-center gap-2 cursor-pointer transition-colors shadow-sm ${
                !selectedReserveId || isSubmitting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'Đang thực hiện thay...' : 'Xác nhận thay hộ mẫu'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
