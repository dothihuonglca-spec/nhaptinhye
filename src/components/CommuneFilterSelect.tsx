/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check, MapPin, Building } from 'lucide-react';
import { OFFICIAL_COMMUNES_CATALOG, CommuneCatalogItem } from '../data/communesCatalog';

export function removeVietnameseTones(str: string): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

interface CommuneFilterSelectProps {
  selectedCode?: string;
  selectedName?: string;
  onSelect: (communeCode: string, communeName: string, item?: CommuneCatalogItem) => void;
  disabled?: boolean;
  placeholder?: string;
  allowAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  showCodeBadge?: boolean;
  compact?: boolean;
}

export default function CommuneFilterSelect({
  selectedCode,
  selectedName,
  onSelect,
  disabled = false,
  placeholder = 'Gõ tên hoặc mã xã để lọc...',
  allowAllOption = false,
  allOptionLabel = 'Tất cả các xã/phường',
  className = '',
  inputClassName = '',
  showCodeBadge = true,
  compact = false
}: CommuneFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tìm xã hiện tại
  const currentCommune = useMemo(() => {
    if (!selectedCode && !selectedName) return null;
    return OFFICIAL_COMMUNES_CATALOG.find(
      c => (selectedCode && c.communeCode === selectedCode) ||
           (selectedName && c.communeName.toLowerCase() === selectedName.toLowerCase())
    ) || null;
  }, [selectedCode, selectedName]);

  // Lọc danh sách xã theo từ khóa (hỗ trợ gõ không dấu và có dấu, tìm theo mã xã hoặc tên TKCS)
  const filteredCommunes = useMemo(() => {
    if (!searchTerm.trim()) {
      return OFFICIAL_COMMUNES_CATALOG;
    }
    const cleanQuery = removeVietnameseTones(searchTerm);
    const rawQuery = searchTerm.toLowerCase().trim();

    return OFFICIAL_COMMUNES_CATALOG.filter(c => {
      const cleanName = removeVietnameseTones(c.communeName);
      const cleanTkcs = removeVietnameseTones(c.tkcsName || '');
      const codeMatch = c.communeCode.includes(rawQuery);
      const nameMatch = cleanName.includes(cleanQuery) || c.communeName.toLowerCase().includes(rawQuery);
      const tkcsMatch = cleanTkcs.includes(cleanQuery);
      return codeMatch || nameMatch || tkcsMatch;
    });
  }, [searchTerm]);

  // Đóng dropdown khi click ngoài
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string, name: string, item?: CommuneCatalogItem) => {
    onSelect(code, name, item);
    setSearchTerm('');
    setIsOpen(false);
  };

  const displayText = useMemo(() => {
    if (allowAllOption && (selectedCode === 'ALL' || (!selectedCode && !selectedName))) {
      return allOptionLabel;
    }
    if (currentCommune) {
      return `[${currentCommune.communeCode}] ${currentCommune.communeName}`;
    }
    if (selectedName) {
      return selectedCode ? `[${selectedCode}] ${selectedName}` : selectedName;
    }
    return '';
  }, [selectedCode, selectedName, currentCommune, allowAllOption, allOptionLabel]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Box kích hoạt chọn */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={`flex items-center justify-between border rounded-lg cursor-pointer transition-all select-none ${
          disabled
            ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed'
            : isOpen
            ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 text-slate-800'
            : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800'
        } ${compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-xs'} ${inputClassName}`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-1">
          <MapPin className={`w-3.5 h-3.5 shrink-0 ${currentCommune ? 'text-blue-600' : 'text-slate-400'}`} />
          {displayText ? (
            <span className="truncate font-semibold text-slate-800">
              {displayText}
            </span>
          ) : (
            <span className="truncate text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {displayText && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (allowAllOption) {
                  handleSelect('ALL', allOptionLabel);
                } else {
                  handleSelect('', '');
                }
              }}
              title="Xóa lựa chọn"
              className="p-0.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown Menu với ô tìm kiếm lọc */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-300 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col text-xs min-w-[280px] max-w-md animate-in fade-in zoom-in-95 duration-100">
          {/* Thanh tìm kiếm & lọc trực tiếp */}
          <div className="p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Gõ tìm: tên xã, mã xã hoặc huyện..."
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 px-1">
              <span>Danh mục: <strong>{filteredCommunes.length}</strong> xã/phường</span>
              {searchTerm && <span className="text-blue-600 font-medium">Đang lọc</span>}
            </div>
          </div>

          {/* Danh sách xã */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 py-1">
            {allowAllOption && (
              <button
                type="button"
                onClick={() => handleSelect('ALL', allOptionLabel)}
                className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-blue-50 transition-colors ${
                  selectedCode === 'ALL' ? 'bg-blue-50/80 font-bold text-blue-700' : 'text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-slate-500" />
                  <span>{allOptionLabel}</span>
                </div>
                {selectedCode === 'ALL' && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            )}

            {filteredCommunes.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                Không tìm thấy xã/phường nào khớp với &quot;{searchTerm}&quot;
              </div>
            ) : (
              filteredCommunes.map(commune => {
                const isSelected = selectedCode === commune.communeCode ||
                  (!selectedCode && selectedName?.toLowerCase() === commune.communeName.toLowerCase());

                return (
                  <button
                    key={commune.communeCode}
                    type="button"
                    onClick={() => handleSelect(commune.communeCode, commune.communeName, commune)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-blue-50/80 transition-colors ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1 mr-2">
                      <div className="flex items-center gap-1.5">
                        {showCodeBadge && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-200 rounded font-mono font-bold text-[10px] shrink-0">
                            {commune.communeCode}
                          </span>
                        )}
                        <span className="font-semibold text-xs truncate">
                          {commune.communeName}
                        </span>
                      </div>
                      {commune.tkcsName && (
                        <span className="text-[10px] text-slate-400 block ml-0.5 mt-0.5">
                          {commune.tkcsName}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <span className="shrink-0 p-1 bg-blue-100 text-blue-700 rounded-full">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
