export type UserRole = 'intern' | 'supervisor' | 'payroll_admin';

export type ScreenView = 
  | 'login'
  | 'intern_checkin'
  | 'intern_history'
  | 'intern_profile'
  | 'payroll_admin'
  | 'admin_interns'
  | 'attendance_logs';

export type LocationType = 'office' | 'outside';
export type AttendanceAction = 'check_in' | 'check_out' | 'paired_day';

export type AttendanceAuditAction = 'created_by_admin' | 'edited_by_admin' | 'deleted_by_admin';

export interface AttendanceAuditLog {
  id: string;
  recordId: string;
  internId: string;
  internName: string;
  action: AttendanceAuditAction;
  adminId: string;
  adminName: string;
  adminEmail: string;
  timestamp: string; // ISO string
  reason?: string;
  changesSummary?: string;
  fieldChanges?: {
    field: string;
    label: string;
    before: any;
    after: any;
  }[];
  snapshotBefore?: Partial<AttendanceRecord>;
  snapshotAfter?: Partial<AttendanceRecord>;
}

export interface AttendanceAdminEditMeta {
  adminId: string;
  adminName: string;
  adminEmail: string;
  editedAt: string;
  action: AttendanceAuditAction;
  reason?: string;
  summary?: string;
}

export interface RawAttendanceLogEntry {
  id: string; // unique entry id (e.g. record-id-in, record-id-out, record-id)
  recordId: string;
  internId: string;
  internName: string;
  internDepartment: string;
  internTeam?: string;
  internAvatarUrl?: string;
  internInitials: string;
  dateStr: string; // YYYY-MM-DD
  displayDate: string; // e.g. "Sep 4, 2026"
  dayOfWeek: string;
  time: string; // "09:15 AM" or checkInTime
  checkInTime: string; // e.g. "09:15 AM"
  checkOutTime: string | null; // e.g. "06:15 PM" or null if missing/active
  timestamp: number; // epoch ms for accurate sorting and range filters
  checkInTimestamp?: number;
  checkOutTimestamp?: number;
  action: AttendanceAction; // 'check_in' | 'check_out' | 'paired_day'
  locationType: LocationType; // 'office' | 'outside'
  locationNote: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  duration?: string;
  status: 'completed' | 'active' | 'missing_checkout';
  isIrregular: boolean;
  irregularityType?: 'unclosed_session' | 'consecutive_checkin' | 'missing_checkin' | 'missing_note' | 'abnormal_time';
  irregularityReason?: string;
  isLate?: boolean;
  flagLabel?: string;
  checkInNote?: string;
  checkOutNote?: string;
  notes?: string;
  monthYear: string;
  isManuallyAdded?: boolean;
  isManuallyEdited?: boolean;
  lastEditedBy?: AttendanceAdminEditMeta;
  auditHistory?: AttendanceAuditLog[];
}

export type InternAccountStatus = 'active' | 'archived';

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
  status?: InternAccountStatus;
  isArchived?: boolean;
  archivedAt?: string | null;
  archivedReason?: string | null;
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
  status: 'normal' | 'late' | 'pending' | 'missing_checkout' | 'active';
  flagLabel?: string; // 'Late Arrival' if applicable
  locationType: LocationType; // 'office' | 'outside'
  locationNote?: string; // e.g. 'Client site - Chiang Mai'
  checkInNote?: string;
  checkOutNote?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  isManuallyAdded?: boolean;
  isManuallyEdited?: boolean;
  isDeleted?: boolean;
  lastEditedBy?: AttendanceAdminEditMeta;
  auditHistory?: AttendanceAuditLog[];
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
  approvedBy?: string;
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
  approvedAt?: string | null;
  approvedBy?: string | null;
  updatedAt?: string;
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

export interface FinalizedPayrollCycle {
  id: string; // e.g. 'cycle-August_2026'
  monthYear: string; // e.g. 'August 2026'
  finalizedAt: string; // ISO timestamp
  finalizedByUid: string;
  finalizedByName: string;
  finalizedByEmail?: string;
  totalInterns: number;
  totalDaysWorked: number;
  totalAmountTHB: number;
  status: 'finalized';
  notes?: string;
}

