/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import IndustrialApp from './IndustrialApp.tsx';
import './index.css';

// Kiểm tra xem người dùng đang mở Website 1 (Hộ dân cư) hay Website 2 (Công nghiệp):
// Hỗ trợ cả qua đường dẫn file /industrial.html, URL path /industrial, /cong-nghiep, query param ?app=industrial hoặc hash #industrial
const searchParams = new URLSearchParams(window.location.search);
const isIndustrialSite =
  window.location.pathname.includes('industrial') ||
  window.location.pathname.includes('cong-nghiep') ||
  searchParams.get('app') === 'industrial' ||
  searchParams.get('page') === 'industrial' ||
  searchParams.get('mode') === 'industrial' ||
  window.location.hash.toLowerCase().includes('industrial') ||
  window.location.hash.toLowerCase().includes('cong-nghiep');

createRoot(document.getElementById('root')!).render(
  isIndustrialSite ? <IndustrialApp /> : <App />
);
