export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
  leaderName?: string;
  leaderPhone?: string;
  assignedAreaCodes?: string[];
  colorTheme?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type UserRole = 'ADMIN' | 'MANAGER' | 'SUPERVISOR' | 'SURVEYOR';

export interface Surveyor {
  id: string;
  code: string;
  username: string;
  name: string;
  stt?: number;
  departmentId?: string;
  department?: string;
  position?: string;
  phone?: string;
  email?: string;
  password?: string;
  role: UserRole;
  assignedAreas: string[];
  assignedCommunes?: string[];
  status: 'ACTIVE' | 'LOCKED' | 'INACTIVE';
  mustChangePassword: boolean;
  note?: string;
  lastPasswordChange?: string;
  createdAt: string;
  updatedAt?: string;
}

export const ROLE_LABELS: Record<UserRole, { label: string; color: string; desc: string }> = {
  ADMIN: { 
    label: 'Quản trị viên', 
    color: 'bg-rose-50 text-rose-700 border-rose-300', 
    desc: 'Toàn quyền cấu hình, tài khoản và duyệt dữ liệu' 
  },
  MANAGER: { 
    label: 'Quản lý', 
    color: 'bg-indigo-50 text-indigo-700 border-indigo-300', 
    desc: 'Quản lý theo dõi tiến độ, kiểm soát và duyệt' 
  },
  SUPERVISOR: { 
    label: 'Giám sát viên', 
    color: 'bg-amber-50 text-amber-700 border-amber-300', 
    desc: 'Giám sát, quản lý và phân quyền địa bàn cho các Điều tra viên (ĐTV) trong phòng' 
  },
  SURVEYOR: { 
    label: 'Điều tra viên', 
    color: 'bg-sky-50 text-sky-700 border-sky-300', 
    desc: 'Trực tiếp thu thập và nhập tin phiếu điều tra' 
  }
};

export type SurveyStatus = 
  | 'PENDING' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CHUA_NHAP' 
  | 'DANG_NHAP' 
  | 'HOAN_THANH' 
  | 'DA_HOAN_THANH' 
  | 'DA_DUYET';

export const SURVEY_STATUS_LABELS: Record<string, { label: string }> = {
  PENDING: { label: 'Chờ điều tra' },
  IN_PROGRESS: { label: 'Đang điều tra' },
  COMPLETED: { label: 'Hoàn thành' },
  CHUA_NHAP: { label: 'Chưa nhập' },
  DANG_NHAP: { label: 'Đang nhập' },
  HOAN_THANH: { label: 'Hoàn thành' },
  DA_HOAN_THANH: { label: 'Đã hoàn thành' },
  DA_DUYET: { label: 'Đã duyệt' }
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'manager' | 'supervisor' | 'surveyor';
  departmentId: string;
  assignedAreaCodes: string[]; // VD: ['TKO01', 'TKO02'] hoặc ['ALL']
  updatedAt: string;
}
