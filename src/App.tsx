import { useState, useEffect } from 'react';
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
import { PayrollExportScreen } from './components/PayrollExportScreen';
import { ProfileScreen } from './components/ProfileScreen';
import { InternsManagementScreen } from './components/InternsManagementScreen';
import { AttendanceLogsScreen } from './components/AttendanceLogsScreen';
import { ScreenSwitcherBar } from './components/ScreenSwitcherBar';
import { NavigationDrawer } from './components/NavigationDrawer';

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
  addPayrollRecordInFirestore,
  updatePayrollRecordInFirestore,
} from './services/dbService';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [currentScreen, setCurrentScreen] = useState<ScreenView>('login');
  const [isMobileSimulator, setIsMobileSimulator] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Firestore real-time state
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isAttendanceLoaded, setIsAttendanceLoaded] = useState<boolean>(false);
  const [supervisorReviews, setSupervisorReviews] = useState<InternMonthlyReview[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [finalizedCycles, setFinalizedCycles] = useState<FinalizedPayrollCycle[]>([]);

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
          } else {
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
    if (!currentUser) {
      setIsAttendanceLoaded(false);
      return;
    }

    // For interns, fetch their specific attendance or all if needed
    const unsubAttendance = subscribeToAttendance(
      currentUser.role === 'intern' ? currentUser.id : null,
      (records) => {
        setAttendanceRecords(records);
        setIsAttendanceLoaded(true);
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
    } else {
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
    try {
      await addAttendanceCheckIn(newRecord);
      setAttendanceRecords((prev) => [newRecord, ...prev.filter((r) => r.id !== newRecord.id)]);
    } catch (err) {
      console.error('Error saving check-in to Firestore:', err);
      throw err;
    }
  };

  // Handle Check-out Action in Firestore
  const handleCheckOut = async (recordId: string, checkOutTime: string, note?: string) => {
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

    try {
      await updateAttendanceCheckOut(recordId, checkOutTime, durationStr, totalMinutes, note);
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
    } catch (err) {
      console.error('Error saving check-out to Firestore:', err);
      throw err;
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

    if (!currentUser || currentScreen === 'login') {
      return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
    }

    switch (currentScreen) {
      case 'intern_checkin':
        return (
          <CheckInScreen
            user={currentUser}
            attendanceLogs={attendanceRecords}
            isAttendanceLoaded={isAttendanceLoaded}
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
            supervisorReviews={supervisorReviews}
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
            payrollRecords={payrollRecords}
            monthlyReviews={supervisorReviews}
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
    </div>
  );
}
