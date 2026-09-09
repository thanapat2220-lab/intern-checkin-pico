import React, { useState, useEffect } from 'react';
import {
  AttendanceRecord,
  InternMonthlyReview,
  PayrollRecord,
  ScreenView,
  UserProfile,
  FinalizedPayrollCycle,
} from './types';
import { CheckInScreen } from './components/CheckInScreen';
import { AttendanceHistoryScreen } from './components/AttendanceHistoryScreen';
import { LoginScreen } from './components/LoginScreen';
import { SupervisorPortalScreen } from './components/SupervisorPortalScreen';
import { PayrollExportScreen } from './components/PayrollExportScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { InternsManagementScreen } from './components/InternsManagementScreen';
import { AttendanceLogsScreen } from './components/AttendanceLogsScreen';
import { PublicApprovalScreen } from './components/PublicApprovalScreen';
import { ScreenSwitcherBar } from './components/ScreenSwitcherBar';
import { NavigationDrawer } from './components/NavigationDrawer';
import { DetailReviewModal } from './components/DetailReviewModal';
import { calculateDurationStr } from './utils/attendanceLogUtils';
import { formatMergedNotes } from './utils/noteUtils';

// Firebase services
import { listenToAuthState, logoutFromFirebase } from './services/authService';
import {
  purgeMockDataFromFirestore,
  subscribeToAttendance,
  subscribeToMonthlyReviews,
  subscribeToPayroll,
  subscribeToUsers,
  subscribeToFinalizedPayrollCycles,
  assignSupervisorToIntern,
  addAttendanceCheckIn,
  updateAttendanceCheckOut,
  approveReviewInFirestore,
  approveAllReviewsInFirestore,
  addPayrollRecordInFirestore,
  updatePayrollRecordInFirestore,
} from './services/dbService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenView>('login');
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [isMobileSimulator, setIsMobileSimulator] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Firestore real-time state
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [supervisorReviews, setSupervisorReviews] = useState<InternMonthlyReview[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [finalizedCycles, setFinalizedCycles] = useState<FinalizedPayrollCycle[]>([]);

  // Modals state
  const [detailModalTarget, setDetailModalTarget] = useState<InternMonthlyReview | null>(null);

  // Check for Magic Link token in URL search / hash
  useEffect(() => {
    const checkTokenFromUrl = () => {
      const searchParams = new URLSearchParams(window.location.search);
      let token = searchParams.get('token');

      if (!token && window.location.hash.includes('token=')) {
        const hashQuery = window.location.hash.includes('?')
          ? window.location.hash.split('?')[1]
          : window.location.hash.split('#')[1];
        const hashParams = new URLSearchParams(hashQuery);
        token = hashParams.get('token');
      }

      if (token || window.location.hash.includes('/approve') || window.location.hash.includes('#approve')) {
        setPublicToken(token);
        setCurrentScreen('public_approval');
      }
    };

    checkTokenFromUrl();
    window.addEventListener('hashchange', checkTokenFromUrl);
    return () => window.removeEventListener('hashchange', checkTokenFromUrl);
  }, []);

  // 1. Purge legacy mock data from Firestore & listen to Firebase Auth
  useEffect(() => {
    // Purge any mock/sample demo data from Firestore
    purgeMockDataFromFirestore().catch(console.error);

    // Listen to Firebase Auth state
    const unsubscribeAuth = listenToAuthState((firebaseUser, profile) => {
      setAuthLoading(false);
      if (firebaseUser && profile) {
        setCurrentUser(profile);
        // Direct to appropriate screen on login if currently on login screen
        if (currentScreen === 'login') {
          if (profile.role === 'intern') {
            setCurrentScreen('intern_checkin');
          } else if (profile.role === 'supervisor') {
            setCurrentScreen('supervisor_portal');
          } else if (profile.role === 'payroll_admin') {
            setCurrentScreen('payroll_admin');
          }
        }
      } else {
        setCurrentUser(null);
        setCurrentScreen('login');
      }
    });

    return () => unsubscribeAuth();
  }, [currentScreen]);

  // 2. Real-time Firestore Subscriptions for data
  useEffect(() => {
    if (!currentUser) return;

    // For interns, fetch their specific attendance or all if needed
    const unsubAttendance = subscribeToAttendance(
      currentUser.role === 'intern' ? currentUser.id : null,
      (records) => {
        setAttendanceRecords(records);
      }
    );

    // Monthly reviews subscription for supervisor & intern status
    const unsubReviews = subscribeToMonthlyReviews((reviews) => {
      setSupervisorReviews(reviews);
    });

    // Payroll subscription
    const unsubPayroll = subscribeToPayroll((records) => {
      setPayrollRecords(records);
    });

    // Users subscription for Admin Intern Management & Supervisor directories
    const unsubUsers = subscribeToUsers((users) => {
      setAllUsers(users);
    });

    // Finalized payroll cycles subscription (audit trail)
    const unsubCycles = subscribeToFinalizedPayrollCycles((cycles) => {
      setFinalizedCycles(cycles);
    });

    return () => {
      unsubAttendance();
      unsubReviews();
      unsubPayroll();
      unsubUsers();
      unsubCycles();
    };
  }, [currentUser]);

  // Handle Login Success from LoginScreen
  const handleLoginSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    if (profile.role === 'intern') {
      setCurrentScreen('intern_checkin');
    } else if (profile.role === 'supervisor') {
      setCurrentScreen('supervisor_portal');
    } else if (profile.role === 'payroll_admin') {
      setCurrentScreen('payroll_admin');
    }
  };

  // Handle Logout via Firebase
  const handleLogout = async () => {
    try {
      await logoutFromFirebase();
      setCurrentUser(null);
      setCurrentScreen('login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  // Handle Check-in Action in Firestore
  const handleCheckIn = async (newRecord: AttendanceRecord) => {
    // Optimistically update local attendance records immediately
    setAttendanceRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
    try {
      await addAttendanceCheckIn(newRecord);
    } catch (err) {
      console.error('Error saving check-in to Firestore:', err);
    }
  };

  // Handle Check-out Action in Firestore
  const handleCheckOut = async (recordId: string, checkOutTime: string, note?: string) => {
    try {
      const targetRecord = attendanceRecords.find((r) => r.id === recordId);
      const checkInTime = targetRecord?.checkInTime || '09:00 AM';
      const { durationStr, totalMinutes } = calculateDurationStr(checkInTime, checkOutTime);
      
      const checkInNote =
        targetRecord?.checkInNote ||
        (targetRecord?.locationNote &&
        targetRecord.locationNote !== 'Bangkok HQ' &&
        targetRecord.locationNote !== 'Outside Office / Traveling' &&
        !targetRecord.locationNote.startsWith('Bangkok HQ -')
          ? targetRecord.locationNote
          : targetRecord?.notes && !targetRecord.notes.startsWith('[In]')
          ? targetRecord.notes
          : '');
      const checkOutNote = note !== undefined ? note.trim() : '';
      const mergedNotes = formatMergedNotes(checkInNote, checkOutNote);

      // Optimistically update local attendance records immediately
      setAttendanceRecords((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? {
                ...r,
                checkOutTime,
                totalDuration: durationStr,
                totalMinutes,
                status: 'normal',
                checkInNote: checkInNote || r.checkInNote,
                checkOutNote: checkOutNote || r.checkOutNote,
                notes: mergedNotes,
              }
            : r
        )
      );
      await updateAttendanceCheckOut(recordId, checkOutTime, durationStr, totalMinutes, note);
    } catch (err) {
      console.error('Error saving check-out to Firestore:', err);
    }
  };

  // Handle manual supervisor check-out confirmation for missing check-outs
  const handleSupervisorConfirmCheckOut = async (recordId: string, checkOutTime: string, note?: string) => {
    await handleCheckOut(recordId, checkOutTime, note);
    // Also update detail modal target in-place so supervisor sees immediate confirmation
    setDetailModalTarget((prev) => {
      if (!prev) return null;
      const targetRec = (prev.records || []).find((r) => r.id === recordId);
      const checkInTime = targetRec?.checkInTime || '09:00 AM';
      const { durationStr, totalMinutes } = calculateDurationStr(checkInTime, checkOutTime);
      const checkInNote =
        targetRec?.checkInNote ||
        (targetRec?.locationNote &&
        targetRec.locationNote !== 'Bangkok HQ' &&
        targetRec.locationNote !== 'Outside Office / Traveling' &&
        !targetRec.locationNote.startsWith('Bangkok HQ -')
          ? targetRec.locationNote
          : targetRec?.notes && !targetRec.notes.startsWith('[In]')
          ? targetRec.notes
          : '');
      const checkOutNote = note !== undefined ? note.trim() : '';
      const mergedNotes = formatMergedNotes(checkInNote, checkOutNote);

      const updatedRecords = (prev.records || []).map((r) =>
        r.id === recordId
          ? {
              ...r,
              checkOutTime,
              totalDuration: durationStr,
              totalMinutes,
              status: 'normal' as const,
              checkInNote: checkInNote || r.checkInNote,
              checkOutNote: checkOutNote || r.checkOutNote,
              notes: mergedNotes,
            }
          : r
      );
      return {
        ...prev,
        records: updatedRecords,
      };
    });
  };

  // Handle Supervisor Approvals in Firestore
  const handleApproveReview = async (reviewId: string) => {
    try {
      await approveReviewInFirestore(reviewId);
    } catch (err) {
      console.error('Error approving review in Firestore:', err);
    }
  };

  const handleApproveAll = async () => {
    try {
      const ids = supervisorReviews.map((r) => r.id);
      await approveAllReviewsInFirestore(ids);
    } catch (err) {
      console.error('Error bulk approving reviews in Firestore:', err);
    }
  };

  // Handle Payroll Record Updates in Firestore
  const handleUpdatePayrollRecord = async (updated: PayrollRecord) => {
    try {
      await updatePayrollRecordInFirestore(updated);
    } catch (err) {
      console.error('Error updating payroll in Firestore:', err);
    }
  };

  const handleAddNewPayrollRecord = async (newRec: PayrollRecord) => {
    try {
      await addPayrollRecordInFirestore(newRec);
    } catch (err) {
      console.error('Error adding payroll record to Firestore:', err);
    }
  };

  // Handle Supervisor Assignment for an Intern
  const handleAssignSupervisor = async (
    internId: string,
    supervisorId: string | null,
    supervisorName: string | null
  ) => {
    try {
      await assignSupervisorToIntern(internId, supervisorId, supervisorName);
    } catch (err) {
      console.error('Error assigning supervisor:', err);
      throw err;
    }
  };

  // Intern approval status for history screen
  const userReview = currentUser
    ? supervisorReviews.find((r) => r.internId === currentUser.id)
    : undefined;

  // Render Screen Content
  const renderScreenContent = () => {
    if (authLoading) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <div className="w-10 h-10 border-4 border-[#0052cc] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-[#041b3c]">Connecting to Firebase...</p>
        </div>
      );
    }

    if (currentScreen === 'public_approval') {
      return (
        <PublicApprovalScreen
          token={publicToken}
          onGoToLogin={() => {
            setPublicToken(null);
            window.location.hash = '';
            if (currentUser) {
              if (currentUser.role === 'intern') setCurrentScreen('intern_checkin');
              else if (currentUser.role === 'supervisor') setCurrentScreen('supervisor_portal');
              else setCurrentScreen('admin_interns');
            } else {
              setCurrentScreen('login');
            }
          }}
        />
      );
    }

    if (!currentUser || currentScreen === 'login') {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    switch (currentScreen) {
      case 'intern_checkin':
        return (
          <CheckInScreen
            user={currentUser}
            attendanceLogs={attendanceRecords}
            onCheckIn={handleCheckIn}
            onCheckOut={handleCheckOut}
            onNavigate={(tab) => {
              if (tab === 'checkin') setCurrentScreen('intern_checkin');
              if (tab === 'history') setCurrentScreen('intern_history');
              if (tab === 'profile') setCurrentScreen('intern_profile');
            }}
            onOpenMenu={() => setIsDrawerOpen(true)}
          />
        );

      case 'intern_history':
        return (
          <AttendanceHistoryScreen
            user={currentUser}
            attendanceLogs={attendanceRecords}
            onBack={() => setCurrentScreen('intern_checkin')}
            onCheckOut={handleCheckOut}
            onNavigate={(tab) => {
              if (tab === 'checkin') setCurrentScreen('intern_checkin');
              if (tab === 'history') setCurrentScreen('intern_history');
              if (tab === 'profile') setCurrentScreen('intern_profile');
            }}
            approvalStatus={userReview?.status || 'pending'}
          />
        );

      case 'intern_profile':
        return (
          <ProfileScreen
            user={currentUser}
            onBack={() => setCurrentScreen('intern_checkin')}
            onLogout={handleLogout}
            onNavigate={(tab) => {
              if (tab === 'checkin') setCurrentScreen('intern_checkin');
              if (tab === 'history') setCurrentScreen('intern_history');
              if (tab === 'profile') setCurrentScreen('intern_profile');
            }}
          />
        );

      case 'supervisor_portal':
        return (
          <SupervisorPortalScreen
            user={currentUser}
            reviews={supervisorReviews}
            onApproveReview={handleApproveReview}
            onApproveAll={handleApproveAll}
            onOpenDetailReview={(rev) => setDetailModalTarget(rev)}
            onLogout={handleLogout}
            onSwitchScreen={setCurrentScreen}
          />
        );

      case 'payroll_admin':
        return (
          <PayrollExportScreen
            user={currentUser}
            payrollRecords={payrollRecords}
            attendanceRecords={attendanceRecords}
            allUsers={allUsers}
            finalizedCycles={finalizedCycles}
            onUpdateRecord={handleUpdatePayrollRecord}
            onAddNewRecord={handleAddNewPayrollRecord}
            onLogout={handleLogout}
            onSwitchScreen={setCurrentScreen}
          />
        );

      case 'admin_interns':
        return (
          <InternsManagementScreen
            user={currentUser}
            allUsers={allUsers}
            attendanceRecords={attendanceRecords}
            onAssignSupervisor={handleAssignSupervisor}
            onLogout={handleLogout}
            onSwitchScreen={setCurrentScreen}
          />
        );

      case 'attendance_logs':
        return (
          <AttendanceLogsScreen
            user={currentUser}
            attendanceRecords={attendanceRecords}
            allUsers={allUsers}
            onLogout={handleLogout}
            onSwitchScreen={setCurrentScreen}
          />
        );

      default:
        return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }
  };

  const isMobileLike =
    currentScreen === 'intern_checkin' ||
    currentScreen === 'intern_history' ||
    currentScreen === 'intern_profile' ||
    currentScreen === 'login';

  return (
    <div className="min-h-screen bg-[#F4F5F7] flex flex-col">
      {/* Top Prototype Navigation Bar */}
      <ScreenSwitcherBar
        currentScreen={currentScreen}
        onSelectScreen={setCurrentScreen}
        currentUser={currentUser}
        onLogout={handleLogout}
        isMobileSimulator={isMobileSimulator}
        onToggleMobileSimulator={() => setIsMobileSimulator(!isMobileSimulator)}
      />

      {/* Main Screen Content Container */}
      <div className="flex-1 flex flex-col">
        {isMobileSimulator && isMobileLike ? (
          <div className="flex-1 flex items-center justify-center p-4 md:p-8 bg-[#2d3748]">
            {/* Phone Frame Device Wrapper */}
            <div className="w-full max-w-[420px] h-[860px] bg-white rounded-[44px] shadow-[0_25px_60px_rgba(0,0,0,0.5)] border-[8px] border-[#1a202c] overflow-hidden flex flex-col relative">
              {/* Phone Speaker Notch */}
              <div className="w-32 h-5 bg-[#1a202c] rounded-b-2xl mx-auto absolute top-0 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
                <div className="w-10 h-1 bg-[#4a5568] rounded-full" />
              </div>
              <div className="flex-1 overflow-y-auto relative">
                {renderScreenContent()}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col">{renderScreenContent()}</div>
        )}
      </div>

      {/* Side Navigation Drawer */}
      {currentUser && (
        <NavigationDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          user={currentUser}
          onSelectScreen={setCurrentScreen}
          onLogout={handleLogout}
        />
      )}

      {/* Detail Timecard Review Modal */}
      {detailModalTarget && (
        <DetailReviewModal
          review={detailModalTarget}
          onClose={() => setDetailModalTarget(null)}
          onApprove={handleApproveReview}
          onConfirmCheckOut={handleSupervisorConfirmCheckOut}
        />
      )}
    </div>
  );
}
