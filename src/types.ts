export type UserRole = 'intern' | 'supervisor' | 'payroll_admin';

export type ScreenView = 
  | 'login'
  | 'intern_checkin'
  | 'intern_history'
  | 'intern_profile'
  | 'supervisor_portal'
  | 'payroll_admin'
  | 'admin_interns'
  | 'public_approval';

export type LocationType = 'office' | 'outside';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  team: string;
  avatarUrl?: string;
  initials: string;
  internshipPeriod: string;
  dailyRateTHB: number;
  bankName: string;
  accountNumber: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
  isLightweight?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AttendanceRecord {
  id: string;
  internId: string;
  monthYear: string; // e.g., 'October 2023'
  date: number; // 24
  monthName: string; // 'OCT'
  dayOfWeek: string; // 'Tuesday'
  checkInTime: string; // '09:15 AM'
  checkOutTime: string | null; // '05:45 PM' or null if currently checked in
  totalDuration: string; // '8h 30m'
  totalMinutes: number; // 510
  status: 'normal' | 'late' | 'pending';
  flagLabel?: string; // 'Late Arrival' if applicable
  locationType: LocationType; // 'office' | 'outside'
  locationNote?: string; // e.g. 'Client site - Chiang Mai'
  coordinates: {
    lat: number;
    lng: number;
  };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InternMonthlyReview {
  id: string;
  internId: string;
  name: string;
  initials: string;
  department: string;
  avatarUrl?: string;
  monthYear: string;
  daysLogged: number;
  officeDaysCount?: number;
  outsideDaysCount?: number;
  status: 'pending' | 'approved';
  records: AttendanceRecord[];
  approvedAt?: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
}

export interface PayrollRecord {
  id: string;
  internId: string;
  name: string;
  department: string;
  team: string;
  internshipPeriod: string;
  dailyRateTHB: number;
  daysWorked: number;
  totalAmountTHB: number;
  bankName: string;
  accountNumber: string;
  status: 'Approved' | 'Pending' | 'Paid';
  monthYear: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
}

export interface ApprovalLink {
  id: string; // Secure token ID
  internId: string;
  internName: string;
  month: string; // e.g. 'October 2023'
  supervisorId?: string | null;
  supervisorName?: string | null;
  supervisorEmail?: string | null;
  createdAt: string;
  expiresAt: string; // 14 days from creation
  used: boolean;
  usedAt?: string | null;
}

