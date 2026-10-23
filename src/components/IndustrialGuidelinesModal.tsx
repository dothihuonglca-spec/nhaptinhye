/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, BookOpen, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function IndustrialGuidelinesModal({ isOpen, onClose }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-6 py-4 flex items-center justify-between shadow-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase tracking-tight">
                GIẢI THÍCH NỘI DUNG VÀ CÁCH GHI PHIẾU
              </h2>
              <p className="text-xs text-sky-200">
                Phương án điều tra, thu thập thông tin Tổng GTSP Công nghiệp - UBND Tỉnh Hưng Yên
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-800 text-xs leading-relaxed bg-slate-50/50">
          
          {/* PHIẾU SỐ 01 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-blue-100 pb-2">
              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 font-black rounded text-[11px]">
                PHIẾU 01/TGTSP-DNCN
              </span>
              <h3 className="font-bold text-sm text-blue-950">
                Phiếu thu thập thông tin về hoạt động sản xuất công nghiệp của Doanh nghiệp/HTX
              </h3>
            </div>

            <div className="space-y-3 pl-2">
              <p className="font-bold text-slate-900">
                Cách ghi phiếu: <span className="font-normal text-slate-600">STT Doanh nghiệp: Phần này ĐTV ghi theo mã số doanh nghiệp.</span>
              </p>

              <div>
                <h4 className="font-black text-slate-800 uppercase text-[11px] text-blue-900">I. THÔNG TIN CHUNG</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 mt-1">
                  <li><strong>Câu 1. Tên doanh nghiệp:</strong> Ghi đầy đủ các thông tin tên doanh nghiệp theo đăng ký kinh doanh.</li>
                  <li><strong>Câu 2. Địa chỉ doanh nghiệp:</strong> Ghi đầy đủ các thông tin định danh, số điện thoại, email.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-800 uppercase text-[11px] text-blue-900">II. NGÀNH HOẠT ĐỘNG CỦA DOANH NGHIỆP</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 mt-1">
                  <li><strong>Câu 1. Ngành SXKD chính:</strong> Ghi rõ ngành sản xuất kinh doanh chính của doanh nghiệp.</li>
                  <li><strong>Câu 2. Ngành SXKD khác:</strong> Ghi rõ ngành sản xuất kinh doanh khác của doanh nghiệp.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-800 uppercase text-[11px] text-blue-900">III. THÔNG TIN VỀ LAO ĐỘNG</h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-700 mt-1">
                  <li><strong>Câu 1. Thời điểm 01/01 năm báo cáo:</strong> Ghi số lao động thường xuyên của doanh nghiệp 01/01 năm báo cáo.</li>
                  <li><strong>Câu 2. Dự kiến thời điểm 31/12 năm báo cáo:</strong> Ước tính số lao động thường xuyên của doanh nghiệp dự kiến tại thời điểm 31/12 năm báo cáo.</li>
                </ul>
              </div>

              <div>
                <h4 className="font-black text-slate-800 uppercase text-[11px] text-blue-900">IV. THÔNG TIN VỀ KẾT QUẢ SẢN XUẤT KINH DOANH</h4>
                <div className="space-y-2 mt-1">
                  <p><strong>Câu 1:</strong> Doanh nghiệp có cơ sở SXKD ngoài xã/phường không? Tích dấu “X” vào ô trả lời thích hợp.</p>
                  <p><strong>Câu 2. Thông tin về địa điểm SXKD:</strong> Ghi thông tin về địa điểm sản xuất kinh doanh bao gồm trụ sở chính và các chi nhánh trực thuộc.</p>
                  
                  <div className="bg-sky-50 p-3.5 rounded-xl border border-sky-200 space-y-2">
                    <p className="font-bold text-sky-950">Câu 3. Sản xuất, tiêu thụ của doanh nghiệp:</p>
                    <p>- <strong>Cột A: Tên sản phẩm:</strong> Liệt kê tên các sản phẩm chính do doanh nghiệp sản xuất.</p>
                    <p>- <strong>Cột B: Mã sản phẩm:</strong> Ghi theo Danh mục sản phẩm công nghiệp theo hoạt động Việt Nam.</p>
                    <p>- <strong>Cột C: Đơn vị tính:</strong> Ghi đơn vị tính của sản phẩm đã liệt kê ở cột A.</p>
                    <p>- <strong>Cột 1: Sản phẩm sản xuất trong 9 tháng đầu năm:</strong> Ghi khối lượng sản phẩm sản xuất trong 9 tháng đầu năm báo cáo cho từng loại sản phẩm, không gồm sản phẩm dở dang. Bao gồm cả sản phẩm nhận gia công cho các cơ sở kinh tế khác bằng nguyên vật liệu của cơ sở khác.</p>
                    <p>- <strong>Cột 2 & Cột 3: Tiêu thụ trong 9 tháng đầu năm:</strong> Ghi khối lượng và giá trị của sản phẩm xuất kho tiêu thụ trong kỳ. Xuất kho tiêu thụ bao gồm: xuất bán, xuất làm quà biếu/tặng, gửi triển lãm hội chợ, xuất cho bộ phận có hạch toán riêng... <em>Lưu ý: Không bao gồm khối lượng sản phẩm xuất kho để tiếp tục chế biến trong dây chuyền sản xuất nội bộ của doanh nghiệp.</em></p>
                    <p>- <strong>Cột 3: Giá trị sản phẩm:</strong> Tính trên hoá đơn xuất hàng (không gồm thuế GTGT, tiêu thụ đặc biệt, xuất khẩu). Nếu không tính trực tiếp được, có thể tính gián tiếp bằng: <code>Cột 2 × Giá bán bình quân</code>.</p>
                    <p>- <strong>Cột 4: Dự tính sản phẩm sản xuất cả năm báo cáo:</strong> Ghi khối lượng sản phẩm dự tính sản xuất cả năm.</p>
                    <p>- <strong>Cột 5 & Cột 6:</strong> Ước tính số lượng và giá trị tiêu thụ cả năm.</p>
                    <p>- <strong>Cột 7:</strong> Sản phẩm sản xuất của năm trước năm báo cáo.</p>
                  </div>

                  <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-200 space-y-2">
                    <p className="font-bold text-indigo-950">Câu 4. Kết quả sản xuất kinh doanh (Doanh thu thuần):</p>
                    <p className="bg-white p-2 rounded-lg font-bold text-indigo-900 border border-indigo-200">
                      Tổng doanh thu thuần bán hàng & CCDV = Tổng doanh thu bán hàng hóa, thành phẩm & CCDV - Các khoản giảm trừ doanh thu
                    </p>
                    <p>Chia theo ngành hoạt động: Ngành chính (mã 02) và các ngành khác (mã 03, mã 04) của năm trước, 9 tháng đầu năm và ước cả năm.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PHIẾU SỐ 02 */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-emerald-100 pb-2">
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 font-black rounded text-[11px]">
                PHIẾU 02/TGTSP-CTCN
              </span>
              <h3 className="font-bold text-sm text-emerald-950">
                Phiếu thu thập thông tin về hoạt động sản xuất công nghiệp của Cơ sở cá thể
              </h3>
            </div>

            <div className="space-y-2 pl-2 text-slate-700">
              <p><strong>STT cơ sở:</strong> Phần này cán bộ thống kê theo dõi và ghi mã (4 chữ số).</p>
              <p><strong>Câu 1:</strong> Ghi đầy đủ các thông tin: Tên cơ sở, số điện thoại.</p>
              <p><strong>Câu 2:</strong> Ghi rõ địa chỉ của cơ sở sản xuất đang hoạt động (xã/phường, thôn xóm).</p>
              <p><strong>Câu 3:</strong> Ghi rõ ngành sản xuất kinh doanh chính (kèm mã ngành 5 chữ số).</p>
              <p><strong>Câu 4:</strong> Số lao động của cơ sở, ghi rõ tại 2 thời điểm: 01/01 năm báo cáo và 31/12 năm báo cáo.</p>
              <p><strong>Câu 5:</strong> Thu thập thông tin doanh thu của cơ sở sản xuất công nghiệp năm trước năm điều tra, 9 tháng đầu năm điều tra và ước cả năm điều tra (tính trên địa bàn xã/phường được chọn mẫu điều tra).</p>
            </div>
          </div>

        </div>

        {/* FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-3 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs cursor-pointer shadow-sm"
          >
            Đã hiểu, quay lại biểu mẫu
          </button>
        </div>

      </div>
    </div>
  );
}
