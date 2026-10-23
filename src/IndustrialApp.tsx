/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Building2, ArrowLeft, ExternalLink, ShieldCheck, 
  UserCheck, Lock, LogIn, AlertCircle, CheckCircle2 
} from 'lucide-react';
import IndustrialSurveyPage from './modules/industrialSurvey/IndustrialSurveyPage';
import { Surveyor } from './types/user';
import { OFFICIAL_PERSONNEL_LIST } from './constants/officialPersonnel';

const DEFAULT_ADMIN_USER: Surveyor = {
  id: 'admin_cn',
  code: 'ADMIN_CN',
  name: 'Quản trị viên Thống kê Công nghiệp',
  username: 'admin',
  role: 'ADMIN',
  assignedCommunes: ['ALL'],
  assignedAreas: ['ALL'],
  department: 'Phòng Thống kê Công nghiệp & Xây dựng',
  departmentId: 'pb_cnxd',
  phone: '0912.345.678',
  status: 'ACTIVE',
  mustChangePassword: false,
  createdAt: new Date().toISOString()
};

export default function IndustrialApp() {
  const [currentUser, setCurrentUser] = useState<Surveyor | null>(() => {
    try {
      const saved = localStorage.getItem('industrial_user');
      if (saved) return JSON.parse(saved);
      // Kiểm tra user từ hệ thống chung
      const mainUser = localStorage.getItem('current_user');
      if (mainUser) return JSON.parse(mainUser);
    } catch (e) {}
    return DEFAULT_ADMIN_USER; // Mặc định đăng nhập sẵn để người dùng vào việc ngay lập tức
  });

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Đổi title trang web
  useEffect(() => {
    document.title = 'Phần Mềm Điều Tra & Tổng Hợp Thống Kê Công Nghiệp - Tỉnh Hưng Yên';
  }, []);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSwitchToHousehold = () => {
    // Chuyển hướng sang website / trang Hộ dân cư
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', 'household');
      url.searchParams.delete('app');
      url.searchParams.delete('page');
      // Nếu đang ở industrial.html thì chuyển sang index.html
      if (url.pathname.includes('industrial.html')) {
        url.pathname = url.pathname.replace('industrial.html', 'index.html');
      }
      localStorage.setItem('preferred_app_mode', 'household');
      window.location.href = url.toString();
    } catch (e) {
      window.location.href = '/?mode=household';
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('industrial_user');
    setCurrentUser(null);
    showNotification('success', 'Đã đăng xuất.');
  };

  const handleQuickLogin = (user: Surveyor = DEFAULT_ADMIN_USER) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('industrial_user', JSON.stringify(user));
    } catch (e) {}
    showNotification('success', `Đăng nhập thành công với quyền ${user.name}`);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-linear-to-b from-blue-950 via-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center p-4">
        {notification && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-xl border flex items-center gap-2 text-xs font-semibold ${
            notification.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}>
            {notification.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="bg-white text-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-100 text-blue-800 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Building2 className="w-8 h-8" />
            </div>
            <h1 className="text-lg font-black uppercase text-blue-950">
              Điều Tra Thống Kê Công Nghiệp
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Website Nhập tin Phiếu 01 (DN), Phiếu 02 (Cá thể) & Biểu 03, 04/TH-CN
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => handleQuickLogin(DEFAULT_ADMIN_USER)}
              className="w-full py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
            >
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span>Vào Làm Việc Ngay (Quyền Quản Trị Viên)</span>
            </button>

            <div className="border-t border-slate-200 pt-3">
              <label className="text-[11px] font-bold text-slate-600 block mb-1">
                Hoặc chọn tài khoản Cán bộ / Điều tra viên:
              </label>
              <select
                onChange={(e) => {
                  const found = OFFICIAL_PERSONNEL_LIST.find(p => p.id === e.target.value);
                  if (found) handleQuickLogin(found);
                }}
                defaultValue=""
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700"
              >
                <option value="" disabled>-- Chọn cán bộ điều tra --</option>
                {OFFICIAL_PERSONNEL_LIST.slice(0, 15).map(p => (
                  <option key={p.id} value={p.id}>[{p.role}] {p.name}</option>
                ))}
              </select>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleSwitchToHousehold}
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Quay lại Website Khảo sát Hộ dân cư</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Banner Switching Links */}
      <div className="bg-slate-900 text-white px-4 py-1.5 flex flex-wrap items-center justify-between text-[11px] border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="font-bold text-sky-300 uppercase tracking-wide">
            Hệ Thống Web 2: Điều Tra Thống Kê Công Nghiệp (DN & Cá Thể)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSwitchToHousehold}
            className="text-amber-300 hover:text-white font-bold inline-flex items-center gap-1 hover:underline cursor-pointer"
            title="Chuyển sang Website 1"
          >
            <span>⇄ Chuyển sang Website 1: Nhập tin Hộ Dân Cư</span>
          </button>
          <a
            href="/?mode=household"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white inline-flex items-center gap-1 text-[10px]"
          >
            <span>Mở Web 1 trong Tab mới</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Main Page Component */}
      <IndustrialSurveyPage
        currentUser={currentUser}
        onSwitchToHousehold={handleSwitchToHousehold}
        onLogout={handleLogout}
        onNotification={showNotification}
      />
    </div>
  );
}
