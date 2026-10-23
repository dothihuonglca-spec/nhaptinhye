/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Search, X, BookOpen, Layers } from 'lucide-react';
import { 
  CATALOG_TRONG_TROT, 
  CATALOG_CHAN_NUOI, 
  CATALOG_LAM_NGHIEP, 
  CATALOG_THUY_SAN,
  CATALOG_PHI_NONG_NGHIEP,
  CATALOG_CONG_VIEC,
  CATALOG_THU_KHAC,
  CatalogItem 
} from '../constants/catalogs';

export type CatalogSectionType = 'muc1' | 'muc2' | 'muc3' | 'muc4' | 'muc5' | 'muc6' | 'muc7';

interface CatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (item: CatalogItem, section: CatalogSectionType) => void;
  initialTab?: CatalogSectionType;
}

export default function CatalogModal({ isOpen, onClose, onSelect, initialTab = 'muc2' }: CatalogModalProps) {
  const [activeTab, setActiveTab] = useState<CatalogSectionType>(initialTab);
  const [keyword, setKeyword] = useState('');

  if (!isOpen) return null;

  const getList = (): { list: CatalogItem[]; title: string } => {
    switch (activeTab) {
      case 'muc1': return { list: CATALOG_CONG_VIEC, title: 'Danh mục Nghề nghiệp & Công việc chính (Mục 1 - Lương công)' };
      case 'muc2': return { list: CATALOG_TRONG_TROT, title: 'Danh mục Trồng trọt (63 loại - Trang 3 Phụ lục II)' };
      case 'muc3': return { list: CATALOG_CHAN_NUOI, title: 'Danh mục Chăn nuôi (26 loại - Trang 6 Phụ lục II)' };
      case 'muc4': return { list: CATALOG_LAM_NGHIEP, title: 'Danh mục Lâm nghiệp (14 loại - Trang 8 Phụ lục II)' };
      case 'muc5': return { list: CATALOG_THUY_SAN, title: 'Danh mục Thủy sản (9 loại - Trang 9, 10 Phụ lục II)' };
      case 'muc6': return { list: CATALOG_PHI_NONG_NGHIEP, title: 'Danh mục Ngành nghề SXKD Phi Nông nghiệp & Dịch vụ (Mục 6 - Trang 11)' };
      case 'muc7': return { list: CATALOG_THU_KHAC, title: 'Danh mục Các Nguồn thu khác & Trợ cấp (Mục 7 - Trang 12)' };
    }
  };

  const { list, title } = getList();
  const filtered = list.filter(item => 
    item.name.toLowerCase().includes(keyword.toLowerCase().trim()) ||
    item.category.toLowerCase().includes(keyword.toLowerCase().trim()) ||
    String(item.id).includes(keyword.trim())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-white rounded-lg border border-slate-300 shadow-2xl max-w-5xl w-full flex flex-col max-h-[88vh] overflow-hidden text-xs">
        
        {/* Header */}
        <div className="bg-[#058da0] text-white p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan-200" />
            <div>
              <span className="font-bold text-sm uppercase block">Sổ tay tra cứu Danh mục Phụ lục II</span>
              <span className="text-[11px] text-cyan-100">Đầy đủ các danh mục chuẩn theo Quy trình điều tra thu nhập hộ</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/20 rounded cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab selector */}
        <div className="bg-slate-100 border-b border-slate-300 p-2 flex flex-wrap gap-1.5 items-center justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            <button 
              onClick={() => { setActiveTab('muc2'); setKeyword(''); }}
              className={`px-2.5 py-1.5 rounded font-bold cursor-pointer transition-colors ${activeTab === 'muc2' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50'}`}
            >
              1. Trồng trọt (63 loại)
            </button>
            <button 
              onClick={() => { setActiveTab('muc3'); setKeyword(''); }}
              className={`px-2.5 py-1.5 rounded font-bold cursor-pointer transition-colors ${activeTab === 'muc3' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50'}`}
            >
              2. Chăn nuôi (26 loại)
            </button>
            <button 
              onClick={() => { setActiveTab('muc4'); setKeyword(''); }}
              className={`px-2.5 py-1.5 rounded font-bold cursor-pointer transition-colors ${activeTab === 'muc4' ? 'bg-sky-700 text-white' : 'bg-white text-slate-700 border hover:bg-slate-50'}`}
            >
              3. Lâm nghiệp (14 loại)
            </button>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded px-2.5 py-1 w-64 shadow-2xs">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="Tìm theo mã, tên hoặc nhóm..." 
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="w-full bg-transparent border-none text-xs focus:outline-none"
            />
          </div>
        </div>

        {/* Content table */}
        <div className="p-4 overflow-y-auto flex-1 bg-slate-50">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-slate-800 uppercase text-[11px]">{title}</p>
            <span className="text-slate-500 font-medium">Tìm thấy {filtered.length} kết quả</span>
          </div>
          <div className="border border-slate-300 rounded overflow-hidden bg-white shadow-xs">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#058da0] text-white text-center font-bold">
                  <th className="p-2 border border-[#047484] w-16">Mã tra cứu</th>
                  <th className="p-2 border border-[#047484] text-left">Tên sản phẩm / Nguồn thu / Ngành nghề</th>
                  <th className="p-2 border border-[#047484] text-left">Nhóm phân loại theo phụ lục</th>
                  {onSelect && <th className="p-2 border border-[#047484] w-24">Hành động</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} className="hover:bg-sky-50 odd:bg-slate-50/50">
                    <td className="p-2 border border-slate-300 text-center font-extrabold text-sky-900 bg-sky-50">{item.id}</td>
                    <td className="p-2 border border-slate-300 font-bold text-slate-900">{item.name}</td>
                    <td className="p-2 border border-slate-300 text-slate-600 font-medium">{item.category}</td>
                    {onSelect && (
                      <td className="p-2 border border-slate-300 text-center">
                        <button 
                          onClick={() => {
                            onSelect(item, activeTab);
                            onClose();
                          }}
                          className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white rounded font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          Chọn nhập
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-100 p-2.5 border-t border-slate-300 flex justify-between items-center text-slate-600">
          <span>Tổng số: <strong>{filtered.length}</strong> mục tra cứu</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-slate-300 hover:bg-slate-400 text-slate-800 rounded font-bold cursor-pointer">
            Đóng sổ tay
          </button>
        </div>

      </div>
    </div>
  );
}
