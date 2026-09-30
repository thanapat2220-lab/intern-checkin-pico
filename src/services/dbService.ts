import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  AttendanceRecord,
  InternMonthlyReview,
  PayrollRecord,
  UserProfile,
  ApprovalLink,
  UserRole,
  FinalizedPayrollCycle,
  AttendanceAuditLog,
  LocationType,
} from '../types';
import { formatMergedNotes } from '../utils/noteUtils';
import { formatMonthYear, formatShortMonth } from '../utils/dateUtils';
import { calculateDurationStr } from '../utils/attendanceLogUtils';

const ATTENDANCE_COLLECTION = 'attendance';
const REVIEWS_COLLECTION = 'monthlyReviews';
const PAYROLL_COLLECTION = 'payroll';
const USERS_COLLECTION = 'users';
const APPROVAL_LINKS_COLLECTION = 'approvalLinks';
const FINALIZED_CYCLES_COLLECTION = 'finalizedPayrollCycles';
const ATTENDANCE_AUDIT_COLLECTION = 'attendance_audit_logs';

const KNOWN_MOCK_ATTENDANCE_IDS = [
  'att-1',
  'att-2',
  'att-3',
  'att-4',
  'att-5',
  'att-6',
  'att-m1',
  'att-m2',
  'att-m3',
];
const KNOWN_MOCK_REVIEW_IDS = ['rev-1', 'rev-2', 'rev-3', 'rev-4', 'rev-intern-01', 'rev-intern-02'];
const KNOWN_MOCK_PAYROLL_IDS = ['pay-1', 'pay-2', 'pay-3', 'pay-4', 'pay-5'];
const KNOWN_MOCK_USER_IDS = [
  'intern-01',
  'intern-02',
  'intern-03',
  'intern-04',
  'intern-05',
  'supervisor-01',
  'admin-01',
];

const MOCK_NAMES = [
  'Sarah Chen',
  'Michael Scott',
  'Jane Doe',
  'Emily Davis',
  'Alex Wong',
  'David Wallace',
  'Amanda Vance',
];

/**
 * Remove all sample/mock demo records from Firestore collections
 * to ensure only real Pico interns and supervisors exist in production.
 */
export async function purgeMockDataFromFirestore(): Promise<void> {
  try {
    // 1. Delete known mock attendance documents
    for (const id of KNOWN_MOCK_ATTENDANCE_IDS) {
      try {
        await deleteDoc(doc(db, ATTENDANCE_COLLECTION, id));
      } catch (_) {}
    }

    // 2. Delete known mock review documents
    for (const id of KNOWN_MOCK_REVIEW_IDS) {
      try {
        await deleteDoc(doc(db, REVIEWS_COLLECTION, id));
      } catch (_) {}
    }

    // 3. Delete known mock payroll documents
    for (const id of KNOWN_MOCK_PAYROLL_IDS) {
      try {
        await deleteDoc(doc(db, PAYROLL_COLLECTION, id));
      } catch (_) {}
    }

    // 4. Delete known mock user profile documents
    for (const id of KNOWN_MOCK_USER_IDS) {
      try {
        await deleteDoc(doc(db, USERS_COLLECTION, id));
      } catch (_) {}
    }

    // 5. Query and delete any documents containing demo names or mock internIds
    try {
      const attSnap = await getDocs(collection(db, ATTENDANCE_COLLECTION));
      for (const d of attSnap.docs) {
        const data = d.data();
        if (
          KNOWN_MOCK_ATTENDANCE_IDS.includes(d.id) ||
          d.id.startsWith('dummy-') ||
          data.internId === 'intern-01' ||
          data.internId === 'intern-02' ||
          data.internId?.startsWith('dummy-')
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch (_) {}

    try {
      const revSnap = await getDocs(collection(db, REVIEWS_COLLECTION));
      for (const d of revSnap.docs) {
        const data = d.data();
        if (
          KNOWN_MOCK_REVIEW_IDS.includes(d.id) ||
          d.id.startsWith('dummy-') ||
          MOCK_NAMES.includes(data.name) ||
          data.internId === 'intern-01' ||
          data.internId === 'intern-02' ||
          data.internId?.startsWith('dummy-')
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch (_) {}

    try {
      const paySnap = await getDocs(collection(db, PAYROLL_COLLECTION));
      for (const d of paySnap.docs) {
        const data = d.data();
        if (
          KNOWN_MOCK_PAYROLL_IDS.includes(d.id) ||
          d.id.startsWith('dummy-') ||
          MOCK_NAMES.includes(data.name) ||
          data.internId?.startsWith('dummy-')
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch (_) {}

    try {
      const userSnap = await getDocs(collection(db, USERS_COLLECTION));
      for (const d of userSnap.docs) {
        const data = d.data();
        if (
          KNOWN_MOCK_USER_IDS.includes(d.id) ||
          d.id.startsWith('dummy-') ||
          (MOCK_NAMES.includes(data.name) && (d.id.startsWith('intern-') || d.id.startsWith('supervisor-') || d.id.startsWith('admin-')))
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch (_) {}
  } catch (error) {
    console.warn('Mock data cleanup notice:', error);
  }
}

// ---------------- USER PROFILES ---------------- //

export function subscribeToUsers(callback: (users: UserProfile[]) => void) {
  const coll = collection(db, USERS_COLLECTION);
  return onSnapshot(
    coll,
    (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        users.push(docSnap.data() as UserProfile);
      });
      callback(users);
    },
    (err) => {
      console.error('Users subscription error:', err);
    }
  );
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

export async function saveUserProfile(user: UserProfile): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, user.id);
    await setDoc(docRef, { ...user, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error('Error saving user profile:', err);
    throw err;
  }
}

/**
 * Create a staff account (Supervisor or Payroll Admin) in Firestore without requiring initial passwords.
 * Used by existing Payroll Admins inside the admin dashboard to securely provision accounts.
 */
export async function createStaffAccount(data: {
  name: string;
  email: string;
  role: 'supervisor' | 'payroll_admin';
  department?: string;
  team?: string;
}): Promise<UserProfile> {
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.name.trim();
  const targetRole: UserRole = data.role === 'payroll_admin' ? 'payroll_admin' : 'supervisor';

  // Check if a user with this email already exists
  const existingSnap = await getDocs(
    query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail))
  );

  if (!existingSnap.empty) {
    const existingDoc = existingSnap.docs[0];
    const existing = existingDoc.data() as UserProfile;
    if (existing.role !== targetRole) {
      await updateDoc(existingDoc.ref, {
        role: targetRole,
        department: data.department?.trim() || existing.department,
        team: data.team?.trim() || existing.team,
        updatedAt: new Date().toISOString(),
      });
      return { ...existing, role: targetRole };
    }
    return existing;
  }

  // Generate a distinct staff document ID
  const prefix = targetRole === 'payroll_admin' ? 'adm' : 'sup';
  const docId = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initials =
    cleanName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || (cleanEmail[0] || 'S').toUpperCase();

  const staffProfile: UserProfile = {
    id: docId,
    name: cleanName,
    email: cleanEmail,
    role: targetRole,
    department: data.department?.trim() || (targetRole === 'payroll_admin' ? 'Finance & Payroll' : 'Operations'),
    team: data.team?.trim() || 'General',
    initials,
    internshipPeriod: 'Full Time',
    dailyRateTHB: 0,
    bankName: '',
    accountNumber: '',
    supervisorId: null,
    supervisorName: null,
    isLightweight: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const userRef = doc(db, USERS_COLLECTION, docId);
  await setDoc(userRef, staffProfile);

  return staffProfile;
}

/**
 * Create a lightweight supervisor record in Firestore without requiring Firebase Auth.
 * Used by Payroll Admins to immediately assign supervisors and generate magic links.
 */
export async function createLightweightSupervisor(data: {
  name: string;
  email: string;
  department?: string;
  team?: string;
}): Promise<UserProfile> {
  return createStaffAccount({ ...data, role: 'supervisor' });
}

/**
 * If a staff member (supervisor or admin) with an existing lightweight record registers with Firebase Auth,
 * link their profile to their new authenticated UID and migrate intern assignments seamlessly.
 */
export async function linkLightweightSupervisorToAuth(
  firebaseUid: string,
  email: string,
  newProfileData?: Partial<UserProfile>
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  // Search for an existing record by email
  const existingSnap = await getDocs(
    query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail))
  );

  let existingProfile: UserProfile | null = null;
  let oldDocId: string | null = null;

  for (const docSnap of existingSnap.docs) {
    if (docSnap.id !== firebaseUid) {
      existingProfile = docSnap.data() as UserProfile;
      oldDocId = docSnap.id;
      break;
    }
  }

  const name = newProfileData?.name || existingProfile?.name || email.split('@')[0];
  const initials =
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || (cleanEmail[0] || 'U').toUpperCase();

  // Determine role: preserve existing admin/supervisor roles or normalize custom 'admin'
  let role: UserRole = 'supervisor';
  const rawExistingRole = existingProfile?.role as string | undefined;
  const rawNewRole = newProfileData?.role as string | undefined;

  if (
    rawExistingRole === 'payroll_admin' ||
    rawExistingRole === 'admin' ||
    rawNewRole === 'payroll_admin' ||
    rawNewRole === 'admin' ||
    cleanEmail === 'thanapat2220@gmail.com'
  ) {
    role = 'payroll_admin';
  } else if (rawExistingRole === 'supervisor' || rawNewRole === 'supervisor') {
    role = 'supervisor';
  } else if (existingProfile?.role) {
    role = existingProfile.role;
  }

  const mergedProfile: UserProfile = {
    id: firebaseUid,
    name,
    email: cleanEmail,
    role,
    department: newProfileData?.department || existingProfile?.department || (role === 'payroll_admin' ? 'Finance & Payroll' : 'Operations'),
    team: newProfileData?.team || existingProfile?.team || 'General',
    avatarUrl: newProfileData?.avatarUrl || existingProfile?.avatarUrl,
    initials,
    internshipPeriod: 'Full Time',
    dailyRateTHB: 0,
    bankName: newProfileData?.bankName || existingProfile?.bankName || '',
    accountNumber: newProfileData?.accountNumber || existingProfile?.accountNumber || '',
    supervisorId: null,
    supervisorName: null,
    isLightweight: false,
    updatedAt: new Date().toISOString(),
  };

  // Save at users/{firebaseUid}
  const targetUserRef = doc(db, USERS_COLLECTION, firebaseUid);
  await setDoc(targetUserRef, mergedProfile, { merge: true });

  // If there was an old lightweight record with a different document ID, migrate references
  if (oldDocId && oldDocId !== firebaseUid) {
    try {
      // 1. Migrate intern assignments
      const internsSnap = await getDocs(
        query(collection(db, USERS_COLLECTION), where('supervisorId', '==', oldDocId))
      );
      for (const d of internsSnap.docs) {
        await updateDoc(d.ref, {
          supervisorId: firebaseUid,
          supervisorName: name,
          updatedAt: new Date().toISOString(),
        });
      }

      // 2. Migrate monthly reviews
      const reviewsSnap = await getDocs(
        query(collection(db, REVIEWS_COLLECTION), where('supervisorId', '==', oldDocId))
      );
      for (const d of reviewsSnap.docs) {
        await updateDoc(d.ref, {
          supervisorId: firebaseUid,
          supervisorName: name,
          updatedAt: new Date().toISOString(),
        });
      }

      // 3. Migrate approval links
      const linksSnap = await getDocs(
        query(collection(db, APPROVAL_LINKS_COLLECTION), where('supervisorId', '==', oldDocId))
      );
      for (const d of linksSnap.docs) {
        await updateDoc(d.ref, {
          supervisorId: firebaseUid,
          supervisorName: name,
        });
      }

      // 4. Delete the old document to avoid duplicate listings
      await deleteDoc(doc(db, USERS_COLLECTION, oldDocId));
    } catch (migErr) {
      console.warn('Notice during supervisor profile migration:', migErr);
    }
  }

  return mergedProfile;
}

/**
 * Assign or update the supervisor for an intern, syncing both the user profile
 * and any existing monthly review documents in Firestore.
 */
export async function assignSupervisorToIntern(
  internId: string,
  supervisorId: string | null,
  supervisorName: string | null
): Promise<void> {
  try {
    // 1. Update user profile document
    const userRef = doc(db, USERS_COLLECTION, internId);
    await updateDoc(userRef, {
      supervisorId: supervisorId || null,
      supervisorName: supervisorName || null,
      updatedAt: new Date().toISOString(),
    });

    // 2. Update monthly review document if it exists
    const revRef = doc(db, REVIEWS_COLLECTION, `rev-${internId}`);
    const revSnap = await getDoc(revRef);
    if (revSnap.exists()) {
      await updateDoc(revRef, {
        supervisorId: supervisorId || null,
        supervisorName: supervisorName || null,
        updatedAt: new Date().toISOString(),
      });
    }

    // 3. Update any payroll records for this intern if they exist
    const paySnap = await getDocs(
      query(collection(db, PAYROLL_COLLECTION), where('internId', '==', internId))
    );
    for (const d of paySnap.docs) {
      await updateDoc(d.ref, {
        supervisorId: supervisorId || null,
        supervisorName: supervisorName || null,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Error assigning supervisor in Firestore:', err);
    throw err;
  }
}

/**
 * Archive an intern from the active roster.
 * Marks the intern's profile as inactive / internship ended without deleting historical data.
 * Deactivates check-in access and removes them from active counts while preserving attendance & payroll audit records.
 */
export async function archiveIntern(internId: string, reason?: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, internId);
    await updateDoc(userRef, {
      status: 'archived',
      isArchived: true,
      archivedAt: new Date().toISOString(),
      archivedReason: reason?.trim() || 'Internship Ended',
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error archiving intern in Firestore:', err);
    throw err;
  }
}

/**
 * Reactivate / Unarchive an intern back to active roster.
 */
export async function reactivateIntern(internId: string): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, internId);
    await updateDoc(userRef, {
      status: 'active',
      isArchived: false,
      archivedAt: null,
      archivedReason: null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error reactivating intern in Firestore:', err);
    throw err;
  }
}

/**
 * Permanently delete an intern record and purge all associated attendance, review, and payroll data.
 * Used when an intern was added by mistake and has no real historical attendance.
 */
export async function deleteInternPermanently(internId: string): Promise<{
  deletedAttendance: number;
  deletedReviews: number;
  deletedPayroll: number;
}> {
  try {
    let deletedAttendance = 0;
    let deletedReviews = 0;
    let deletedPayroll = 0;

    // 1. Delete all attendance records for this intern
    const attSnap = await getDocs(
      query(collection(db, ATTENDANCE_COLLECTION), where('internId', '==', internId))
    );
    for (const d of attSnap.docs) {
      await deleteDoc(d.ref);
      deletedAttendance++;
    }

    // 2. Delete monthly reviews
    const revRef = doc(db, REVIEWS_COLLECTION, `rev-${internId}`);
    const revSnap = await getDoc(revRef);
    if (revSnap.exists()) {
      await deleteDoc(revRef);
      deletedReviews++;
    }
    const moreRevsSnap = await getDocs(
      query(collection(db, REVIEWS_COLLECTION), where('internId', '==', internId))
    );
    for (const d of moreRevsSnap.docs) {
      if (d.id !== `rev-${internId}`) {
        await deleteDoc(d.ref);
        deletedReviews++;
      }
    }

    // 3. Delete payroll records for this intern
    const paySnap = await getDocs(
      query(collection(db, PAYROLL_COLLECTION), where('internId', '==', internId))
    );
    for (const d of paySnap.docs) {
      await deleteDoc(d.ref);
      deletedPayroll++;
    }

    // 4. Delete approval magic links for this intern
    try {
      const linkSnap = await getDocs(
        query(collection(db, APPROVAL_LINKS_COLLECTION), where('internId', '==', internId))
      );
      for (const d of linkSnap.docs) {
        await deleteDoc(d.ref);
      }
    } catch (_) {}

    // 5. Delete the intern's user document
    const userRef = doc(db, USERS_COLLECTION, internId);
    await deleteDoc(userRef);

    return { deletedAttendance, deletedReviews, deletedPayroll };
  } catch (err) {
    console.error('Error permanently deleting intern in Firestore:', err);
    throw err;
  }
}

// ---------------- ATTENDANCE RECORDS ---------------- //

export function subscribeToAttendance(
  internId: string | null,
  callback: (records: AttendanceRecord[]) => void
) {
  const coll = collection(db, ATTENDANCE_COLLECTION);
  let q = query(coll);

  if (internId) {
    q = query(coll, where('internId', '==', internId));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const records: AttendanceRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as AttendanceRecord);
      });
      // Sort desc by date or timestamp
      records.sort((a, b) => b.date - a.date);
      callback(records);
    },
    (err) => {
      console.error('Attendance subscription error:', err);
    }
  );
}

export async function addAttendanceCheckIn(record: AttendanceRecord): Promise<void> {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, record.id);
    await setDoc(docRef, {
      ...record,
      createdAt: new Date().toISOString(),
    });

    // Also update monthly review summary for this intern
    const revRef = doc(db, REVIEWS_COLLECTION, `rev-${record.internId}`);
    const revSnap = await getDoc(revRef);

    if (revSnap.exists()) {
      const revData = revSnap.data() as InternMonthlyReview;
      const updatedRecords = [record, ...(revData.records || []).filter((r) => r.id !== record.id)];
      const officeCount = updatedRecords.filter((r) => r.locationType === 'office').length;
      const outsideCount = updatedRecords.filter((r) => r.locationType === 'outside').length;

      await updateDoc(revRef, {
        daysLogged: updatedRecords.length,
        officeDaysCount: officeCount,
        outsideDaysCount: outsideCount,
        records: updatedRecords,
        updatedAt: new Date().toISOString(),
      });
    } else {
      // Fetch user profile to populate review metadata
      const userRef = doc(db, USERS_COLLECTION, record.internId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

      const newReview: InternMonthlyReview = {
        id: `rev-${record.internId}`,
        internId: record.internId,
        name: userData?.name || 'Intern',
        initials: userData?.initials || 'IN',
        department: userData?.department || 'Engineering',
        avatarUrl: userData?.avatarUrl,
        monthYear: record.monthYear,
        daysLogged: 1,
        officeDaysCount: record.locationType === 'office' ? 1 : 0,
        outsideDaysCount: record.locationType === 'outside' ? 1 : 0,
        status: 'pending',
        records: [record],
        supervisorId: userData?.supervisorId || null,
        supervisorName: userData?.supervisorName || null,
      };

      await setDoc(revRef, {
        ...newReview,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    console.error('Error adding attendance record:', err);
    throw err;
  }
}


export async function updateAttendanceCheckOut(
  recordId: string,
  checkOutTime: string,
  totalDuration: string,
  totalMinutes: number,
  notes?: string
): Promise<void> {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);
    const docSnap = await getDoc(docRef);

    let checkInNote = '';
    let existingNotes = '';
    let locationNote = '';

    if (docSnap.exists()) {
      const existingData = docSnap.data() as AttendanceRecord;
      checkInNote = existingData.checkInNote || '';
      existingNotes = existingData.notes || '';
      locationNote = existingData.locationNote || '';
    }

    // Determine the existing check-in note
    const resolvedCheckInNote =
      checkInNote ||
      (locationNote &&
      locationNote !== 'Bangkok HQ' &&
      locationNote !== 'Outside Office / Traveling' &&
      !locationNote.startsWith('Bangkok HQ -')
        ? locationNote
        : existingNotes && !existingNotes.startsWith('[In]')
        ? existingNotes
        : '');

    const checkOutNote = notes !== undefined ? notes.trim() : '';

    // Merge notes:
    // Both exist: "[In] ... | [Out] ..."
    // Single exists: note without prefix clutter
    // Neither: ""
    const mergedNotes = formatMergedNotes(resolvedCheckInNote, checkOutNote);

    const updatePayload: Record<string, any> = {
      checkOutTime,
      totalDuration,
      totalMinutes,
      status: 'normal',
      updatedAt: new Date().toISOString(),
      notes: mergedNotes,
    };
    if (checkOutNote) {
      updatePayload.checkOutNote = checkOutNote;
    }
    if (resolvedCheckInNote) {
      updatePayload.checkInNote = resolvedCheckInNote;
    }

    await updateDoc(docRef, updatePayload);

    // Also update record inside monthly review document if it exists
    if (docSnap.exists()) {
      const recordData = docSnap.data() as AttendanceRecord;
      if (recordData.internId) {
        const revRef = doc(db, REVIEWS_COLLECTION, `rev-${recordData.internId}`);
        const revSnap = await getDoc(revRef);
        if (revSnap.exists()) {
          const revData = revSnap.data() as InternMonthlyReview;
          const updatedRecords = (revData.records || []).map((r) =>
            r.id === recordId
              ? {
                  ...r,
                  checkOutTime,
                  totalDuration,
                  totalMinutes,
                  status: 'normal' as const,
                  checkInNote: resolvedCheckInNote || r.checkInNote,
                  checkOutNote: checkOutNote || r.checkOutNote,
                  notes: mergedNotes,
                }
              : r
          );
          await updateDoc(revRef, {
            records: updatedRecords,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }
  } catch (err) {
    console.error('Error checking out:', err);
    throw err;
  }
}

// ---------------- MONTHLY REVIEWS (SUPERVISOR PORTAL) ---------------- //

export function subscribeToMonthlyReviews(
  callback: (reviews: InternMonthlyReview[]) => void
) {
  const coll = collection(db, REVIEWS_COLLECTION);
  return onSnapshot(
    coll,
    (snapshot) => {
      const reviews: InternMonthlyReview[] = [];
      snapshot.forEach((docSnap) => {
        reviews.push(docSnap.data() as InternMonthlyReview);
      });
      callback(reviews);
    },
    (err) => {
      console.error('Monthly reviews subscription error:', err);
    }
  );
}

export async function approveReviewInFirestore(reviewId: string): Promise<void> {
  try {
    const docRef = doc(db, REVIEWS_COLLECTION, reviewId);
    await updateDoc(docRef, {
      status: 'approved',
      approvedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error approving review:', err);
    throw err;
  }
}

export async function approveAllReviewsInFirestore(reviewIds: string[]): Promise<void> {
  try {
    for (const id of reviewIds) {
      await approveReviewInFirestore(id);
    }
  } catch (err) {
    console.error('Error bulk approving reviews:', err);
    throw err;
  }
}


// ---------------- PAYROLL COLLECTION (PAYROLL ADMIN) ---------------- //

export function subscribeToPayroll(
  callback: (records: PayrollRecord[]) => void
) {
  const coll = collection(db, PAYROLL_COLLECTION);
  return onSnapshot(
    coll,
    (snapshot) => {
      const records: PayrollRecord[] = [];
      snapshot.forEach((docSnap) => {
        records.push(docSnap.data() as PayrollRecord);
      });
      callback(records);
    },
    (err) => {
      console.error('Payroll subscription error:', err);
    }
  );
}

export async function addPayrollRecordInFirestore(record: PayrollRecord): Promise<void> {
  try {
    const docRef = doc(db, PAYROLL_COLLECTION, record.id);
    await setDoc(docRef, {
      ...record,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error adding payroll record:', err);
    throw err;
  }
}

export async function updatePayrollRecordInFirestore(record: PayrollRecord): Promise<void> {
  try {
    const docRef = doc(db, PAYROLL_COLLECTION, record.id);
    const nowIso = new Date().toISOString();
    await setDoc(
      docRef,
      {
        ...record,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    // Also sync the monthly_reviews collection so the intern's view & attendance log show matching status
    try {
      const revSnap = await getDocs(
        query(
          collection(db, REVIEWS_COLLECTION),
          where('internId', '==', record.internId)
        )
      );
      const matchingRev = revSnap.docs.find(
        (d) => (d.data().monthYear || '').trim().toLowerCase() === (record.monthYear || '').trim().toLowerCase()
      );
      const targetRevStatus = record.status === 'Approved' ? 'approved' : 'pending';
      if (matchingRev) {
        await updateDoc(doc(db, REVIEWS_COLLECTION, matchingRev.id), {
          status: targetRevStatus,
          approvedAt: record.status === 'Approved' ? (record.approvedAt || nowIso) : null,
          approvedBy: record.status === 'Approved' ? (record.approvedBy || 'Payroll Admin') : null,
          approvalMethod: 'manual_paper_signature',
          updatedAt: nowIso,
        });
      }
    } catch (syncErr) {
      console.warn('Notice syncing monthly review from payroll record:', syncErr);
    }
  } catch (err) {
    console.error('Error updating payroll record:', err);
    throw err;
  }
}

// ---------------- NEW MANUAL / PAPER-BASED ADMIN APPROVAL WORKFLOW ---------------- //

/**
 * Approve an intern's monthly attendance after verifying their physically signed
 * Pico Attendance Form. This grants sole approval authority to the Payroll Admin,
 * syncing both the payroll record and the monthly review.
 */
export async function adminApproveInternMonth(
  internId: string,
  monthYear: string,
  adminUser?: { id?: string; name?: string; email?: string }
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const adminName = adminUser?.name || 'Payroll Admin';

    // 1. Update or create PayrollRecord in PAYROLL_COLLECTION
    const paySnap = await getDocs(
      query(
        collection(db, PAYROLL_COLLECTION),
        where('internId', '==', internId)
      )
    );

    const matchingPay = paySnap.docs.find(
      (d) => (d.data().monthYear || '').trim().toLowerCase() === monthYear.trim().toLowerCase()
    );

    if (matchingPay) {
      await updateDoc(doc(db, PAYROLL_COLLECTION, matchingPay.id), {
        status: 'Approved',
        approvedAt: nowIso,
        approvedBy: adminName,
        approvalMethod: 'manual_paper_signature',
        updatedAt: nowIso,
      });
    } else {
      // Build a payroll record dynamically from attendance records
      const attSnap = await getDocs(
        query(
          collection(db, ATTENDANCE_COLLECTION),
          where('internId', '==', internId)
        )
      );

      const monthLogs = attSnap.docs
        .map((d) => d.data() as AttendanceRecord)
        .filter(
          (r) =>
            !r.isDeleted &&
            (r.monthYear || '').trim().toLowerCase() === monthYear.trim().toLowerCase()
        );

      const uniqueDays = new Set(monthLogs.map((r) => r.date)).size;
      const daysWorked = uniqueDays;
      const dailyRate = 400;
      const totalAmountTHB = daysWorked * dailyRate;

      // Fetch user profile for metadata
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, internId));
      const userData = userDoc.exists() ? (userDoc.data() as UserProfile) : null;

      const newPayId = `pay-${internId}-${monthYear.replace(/\s+/g, '-').toLowerCase()}`;
      await setDoc(doc(db, PAYROLL_COLLECTION, newPayId), {
        id: newPayId,
        internId,
        name: userData?.name || 'Intern',
        department: userData?.department || 'General',
        supervisorId: userData?.supervisorId || null,
        supervisorName: userData?.supervisorName || null,
        bankName: userData?.bankName || 'Kasikorn Bank (KBANK)',
        accountNumber: userData?.accountNumber || '',
        daysWorked,
        dailyRateTHB: dailyRate,
        totalAmountTHB,
        status: 'Approved',
        monthYear,
        approvedAt: nowIso,
        approvedBy: adminName,
        approvalMethod: 'manual_paper_signature',
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // 2. Update or create the monthly_reviews doc so the intern sees "Approved"
    const revSnap = await getDocs(
      query(
        collection(db, REVIEWS_COLLECTION),
        where('internId', '==', internId)
      )
    );

    const matchingRev = revSnap.docs.find(
      (d) => (d.data().monthYear || '').trim().toLowerCase() === monthYear.trim().toLowerCase()
    );

    if (matchingRev) {
      await updateDoc(doc(db, REVIEWS_COLLECTION, matchingRev.id), {
        status: 'approved',
        approvedAt: nowIso,
        approvedBy: adminName,
        approvalMethod: 'manual_paper_signature',
        paperSignatureVerified: true,
        updatedAt: nowIso,
      });
    } else {
      const userDoc = await getDoc(doc(db, USERS_COLLECTION, internId));
      const userData = userDoc.exists() ? (userDoc.data() as UserProfile) : null;
      const newRevId = `rev-${internId}-${monthYear.replace(/\s+/g, '-').toLowerCase()}`;
      await setDoc(doc(db, REVIEWS_COLLECTION, newRevId), {
        id: newRevId,
        internId,
        internName: userData?.name || 'Intern',
        department: userData?.department || 'General',
        monthYear,
        status: 'approved',
        approvedAt: nowIso,
        approvedBy: adminName,
        approvalMethod: 'manual_paper_signature',
        paperSignatureVerified: true,
        supervisorId: userData?.supervisorId || null,
        supervisorName: userData?.supervisorName || null,
        totalShifts: 0,
        totalHours: 0,
        missingCheckoutsCount: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  } catch (err) {
    console.error('Error approving intern month by admin:', err);
    throw err;
  }
}

/**
 * Revert an intern's monthly approval status back to Pending.
 */
export async function adminRevokeInternMonthApproval(
  internId: string,
  monthYear: string
): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const paySnap = await getDocs(
      query(collection(db, PAYROLL_COLLECTION), where('internId', '==', internId))
    );
    const matchingPay = paySnap.docs.find(
      (d) => (d.data().monthYear || '').trim().toLowerCase() === monthYear.trim().toLowerCase()
    );
    if (matchingPay) {
      await updateDoc(doc(db, PAYROLL_COLLECTION, matchingPay.id), {
        status: 'Pending',
        approvedAt: null,
        approvedBy: null,
        updatedAt: nowIso,
      });
    }

    const revSnap = await getDocs(
      query(collection(db, REVIEWS_COLLECTION), where('internId', '==', internId))
    );
    const matchingRev = revSnap.docs.find(
      (d) => (d.data().monthYear || '').trim().toLowerCase() === monthYear.trim().toLowerCase()
    );
    if (matchingRev) {
      await updateDoc(doc(db, REVIEWS_COLLECTION, matchingRev.id), {
        status: 'pending',
        approvedAt: null,
        approvedBy: null,
        paperSignatureVerified: false,
        updatedAt: nowIso,
      });
    }
  } catch (err) {
    console.error('Error revoking intern month approval:', err);
    throw err;
  }
}

/**
 * Batch approve multiple interns for a given month
 */
export async function adminApproveAllInternsForMonth(
  internIds: string[],
  monthYear: string,
  adminUser?: { id?: string; name?: string }
): Promise<void> {
  for (const id of internIds) {
    await adminApproveInternMonth(id, monthYear, adminUser);
  }
}

// ---------------- RETIRED MAGIC LINK APPROVALS (LEGACY STUBS) ---------------- //

export function generateSecureApprovalToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let randomPart = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(28);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < bytes.length; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
  } else {
    for (let i = 0; i < 32; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return `appr_${randomPart}`;
}

export function buildApprovalUrl(token: string): string {
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  // Use hash route format `#/approve?token=...` which is resilient in static/SPA hosting & iframes
  return `${origin}${pathname}#/approve?token=${token}`;
}

export async function createApprovalLink(params: {
  internId: string;
  internName: string;
  month: string;
  supervisorId?: string | null;
  supervisorName?: string | null;
  supervisorEmail?: string | null;
}): Promise<{ token: string; linkDoc: ApprovalLink; approvalUrl: string }> {
  try {
    const token = generateSecureApprovalToken();
    const now = new Date();
    // 14 days expiration
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const linkDoc: ApprovalLink = {
      id: token,
      internId: params.internId,
      internName: params.internName,
      month: params.month,
      supervisorId: params.supervisorId || null,
      supervisorName: params.supervisorName || null,
      supervisorEmail: params.supervisorEmail || null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt,
      used: false,
      usedAt: null,
    };

    const docRef = doc(db, APPROVAL_LINKS_COLLECTION, token);
    await setDoc(docRef, linkDoc);

    const approvalUrl = buildApprovalUrl(token);
    return { token, linkDoc, approvalUrl };
  } catch (err) {
    console.error('Error creating approval link in Firestore:', err);
    throw err;
  }
}

export async function getApprovalLinkByToken(token: string): Promise<ApprovalLink | null> {
  try {
    if (!token) return null;
    const docRef = doc(db, APPROVAL_LINKS_COLLECTION, token);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as ApprovalLink;
    }
    return null;
  } catch (err) {
    console.error('Error fetching approval link by token:', err);
    return null;
  }
}

export async function getMonthlyReviewForMagicLink(
  internId: string,
  month?: string
): Promise<InternMonthlyReview | null> {
  try {
    // 1. Try standard review ID
    const directRef = doc(db, REVIEWS_COLLECTION, `rev-${internId}`);
    const directSnap = await getDoc(directRef);
    if (directSnap.exists()) {
      const data = directSnap.data() as InternMonthlyReview;
      return data;
    }

    // 2. Query reviews collection by internId
    const q = query(collection(db, REVIEWS_COLLECTION), where('internId', '==', internId));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      if (month) {
        const found = querySnap.docs.find((d) => (d.data() as InternMonthlyReview).monthYear === month);
        if (found) return found.data() as InternMonthlyReview;
      }
      return querySnap.docs[0].data() as InternMonthlyReview;
    }

    return null;
  } catch (err) {
    console.error('Error fetching review for magic link:', err);
    return null;
  }
}

export async function approveViaMagicLink(token: string, reviewId: string): Promise<void> {
  try {
    const nowIso = new Date().toISOString();

    // 1. Mark review as approved
    const revRef = doc(db, REVIEWS_COLLECTION, reviewId);
    await updateDoc(revRef, {
      status: 'approved',
      approvedAt: nowIso,
      approvedViaMagicLinkToken: token,
      updatedAt: nowIso,
    });

    // 2. Mark approval link as used
    const linkRef = doc(db, APPROVAL_LINKS_COLLECTION, token);
    await updateDoc(linkRef, {
      used: true,
      usedAt: nowIso,
    });
  } catch (err) {
    console.error('Error approving via magic link in Firestore:', err);
    throw err;
  }
}

/**
 * Normalizes monthYear into a document id, e.g. "August 2026" -> "cycle_August_2026"
 */
export function getCycleDocId(monthYear: string): string {
  return `cycle_${monthYear.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/**
 * Real-time subscription to finalized payroll cycles
 */
export function subscribeToFinalizedPayrollCycles(
  callback: (cycles: FinalizedPayrollCycle[]) => void
): () => void {
  try {
    const q = collection(db, FINALIZED_CYCLES_COLLECTION);
    return onSnapshot(
      q,
      (snapshot) => {
        const cycles: FinalizedPayrollCycle[] = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })) as FinalizedPayrollCycle[];
        callback(cycles);
      },
      (error) => {
        console.error('Error listening to finalized payroll cycles:', error);
        callback([]);
      }
    );
  } catch (err) {
    console.error('Error setting up finalized payroll cycles listener:', err);
    return () => {};
  }
}

/**
 * Record a finalized payroll cycle in Firestore.
 * This is an internal audit log of which months have been finalized,
 * by whom, and when, locking the month against accidental modifications.
 */
export async function finalizePayrollCycle(params: {
  monthYear: string;
  user: UserProfile;
  totalInterns: number;
  totalDaysWorked: number;
  totalAmountTHB: number;
  notes?: string;
}): Promise<FinalizedPayrollCycle> {
  const docId = getCycleDocId(params.monthYear);
  const docRef = doc(db, FINALIZED_CYCLES_COLLECTION, docId);

  const cycleData: FinalizedPayrollCycle = {
    id: docId,
    monthYear: params.monthYear,
    finalizedAt: new Date().toISOString(),
    finalizedByUid: params.user.id,
    finalizedByName: params.user.name,
    finalizedByEmail: params.user.email || '',
    totalInterns: params.totalInterns,
    totalDaysWorked: params.totalDaysWorked,
    totalAmountTHB: params.totalAmountTHB,
    status: 'finalized',
    notes: params.notes || 'Finalized and locked for offline accounting processing',
  };

  await setDoc(docRef, cycleData);
  return cycleData;
}

/**
 * Unlock / Re-open a cycle if an administrator explicitly needs to make an adjustment.
 */
export async function unlockPayrollCycle(monthYear: string): Promise<void> {
  const docId = getCycleDocId(monthYear);
  const docRef = doc(db, FINALIZED_CYCLES_COLLECTION, docId);
  await deleteDoc(docRef);
}

// ---------------- ADMIN ATTENDANCE CORRECTIONS & AUDIT TRAIL ---------------- //

/**
 * Sync monthly review and payroll documents after an attendance record
 * is created, updated, or deleted by an admin.
 */
export async function syncAggregatesAfterAttendanceChange(
  internId: string,
  monthYear: string
): Promise<void> {
  try {
    // 1. Fetch all current attendance records for this intern
    const attSnap = await getDocs(
      query(collection(db, ATTENDANCE_COLLECTION), where('internId', '==', internId))
    );
    const allRecords: AttendanceRecord[] = [];
    attSnap.forEach((d) => allRecords.push(d.data() as AttendanceRecord));

    // Sort descending by date
    allRecords.sort((a, b) => b.date - a.date);

    // Records matching this specific monthYear
    const normMonth = monthYear.trim().toLowerCase();
    const monthRecords = allRecords.filter(
      (r) => r.monthYear && r.monthYear.trim().toLowerCase() === normMonth
    );
    const officeCount = monthRecords.filter((r) => r.locationType === 'office').length;
    const outsideCount = monthRecords.filter((r) => r.locationType === 'outside').length;

    // 2. Update monthly review document if it exists or create one
    const revRef = doc(db, REVIEWS_COLLECTION, `rev-${internId}`);
    const revSnap = await getDoc(revRef);

    if (revSnap.exists()) {
      await updateDoc(revRef, {
        records: monthRecords,
        daysLogged: monthRecords.length,
        officeDaysCount: officeCount,
        outsideDaysCount: outsideCount,
        updatedAt: new Date().toISOString(),
      });
    } else if (monthRecords.length > 0) {
      const userRef = doc(db, USERS_COLLECTION, internId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.exists() ? (userSnap.data() as UserProfile) : null;

      const newReview: InternMonthlyReview = {
        id: `rev-${internId}`,
        internId,
        name: userData?.name || 'Intern',
        initials: userData?.initials || 'IN',
        department: userData?.department || 'Engineering',
        avatarUrl: userData?.avatarUrl,
        monthYear,
        daysLogged: monthRecords.length,
        officeDaysCount: officeCount,
        outsideDaysCount: outsideCount,
        status: 'pending',
        records: monthRecords,
        supervisorId: userData?.supervisorId || null,
        supervisorName: userData?.supervisorName || null,
      };
      await setDoc(revRef, { ...newReview, createdAt: new Date().toISOString() });
    }

    // 3. Update any stored payroll documents for this intern and month
    const paySnap = await getDocs(
      query(
        collection(db, PAYROLL_COLLECTION),
        where('internId', '==', internId)
      )
    );
    const uniqueDaysWorked = new Set(monthRecords.map((r) => r.date)).size;

    for (const d of paySnap.docs) {
      const payData = d.data() as PayrollRecord;
      if (payData.monthYear && payData.monthYear.trim().toLowerCase() === normMonth) {
        const rate = payData.dailyRateTHB || 400;
        await updateDoc(d.ref, {
          daysWorked: uniqueDaysWorked,
          totalAmountTHB: uniqueDaysWorked * rate,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    console.error('Error syncing aggregates after attendance change:', err);
  }
}

/**
 * Manually add an attendance record for an intern (Admin Action).
 * Automatically logs audit trail and synchronizes monthly review & payroll.
 */
export async function adminCreateAttendanceRecord(
  params: {
    intern: UserProfile;
    date: Date;
    checkInTime: string;
    checkOutTime: string | null;
    locationType: LocationType;
    locationNote?: string;
    notes?: string;
    reason?: string;
  },
  adminProfile: UserProfile
): Promise<AttendanceRecord> {
  const { intern, date, checkInTime, checkOutTime, locationType, locationNote, notes, reason } = params;

  const monthYear = formatMonthYear(date);
  const dayNum = date.getDate();
  const monthName = formatShortMonth(date);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });

  let totalDuration = '';
  let totalMinutes = 0;
  let status: AttendanceRecord['status'] = 'normal';

  if (checkOutTime) {
    const calc = calculateDurationStr(checkInTime, checkOutTime);
    totalDuration = calc.durationStr;
    totalMinutes = calc.totalMinutes;
  } else {
    status = 'active';
  }

  const recordId = `att_adm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const nowIso = new Date().toISOString();
  const displayLocation = locationNote?.trim() || (locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Field Site');

  const auditEntry: AttendanceAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recordId,
    internId: intern.id,
    internName: intern.name,
    action: 'created_by_admin',
    adminId: adminProfile.id,
    adminName: adminProfile.name,
    adminEmail: adminProfile.email,
    timestamp: nowIso,
    reason: reason?.trim() || 'Manually added attendance shift',
    changesSummary: `Manually added attendance shift for ${monthName} ${dayNum}, ${date.getFullYear()} (${checkInTime} - ${checkOutTime || 'Active'}, ${locationType === 'office' ? 'Office' : 'Outside'})`,
    fieldChanges: [
      { field: 'date', label: 'Shift Date', before: null, after: `${dayOfWeek}, ${monthName} ${dayNum}, ${date.getFullYear()}` },
      { field: 'checkInTime', label: 'Check-in Time', before: null, after: checkInTime },
      { field: 'checkOutTime', label: 'Check-out Time', before: null, after: checkOutTime || 'Active Shift' },
      { field: 'locationType', label: 'Work Location', before: null, after: locationType === 'office' ? 'Office' : 'Outside / Travel' },
      { field: 'notes', label: 'Shift Notes', before: null, after: notes || '—' },
    ],
    snapshotAfter: {
      id: recordId,
      internId: intern.id,
      monthYear,
      date: dayNum,
      checkInTime,
      checkOutTime,
      locationType,
      notes: notes || '',
    },
  };

  const newRecord: AttendanceRecord = {
    id: recordId,
    internId: intern.id,
    monthYear,
    date: dayNum,
    monthName,
    dayOfWeek,
    checkInTime,
    checkOutTime: checkOutTime || null,
    totalDuration,
    totalMinutes,
    status,
    locationType,
    locationNote: displayLocation,
    checkInNote: notes || '',
    checkOutNote: '',
    notes: notes || '',
    coordinates: { lat: 13.7563, lng: 100.5018 },
    createdAt: nowIso,
    updatedAt: nowIso,
    isManuallyAdded: true,
    lastEditedBy: {
      adminId: adminProfile.id,
      adminName: adminProfile.name,
      adminEmail: adminProfile.email,
      editedAt: nowIso,
      action: 'created_by_admin',
      reason: reason?.trim() || 'Manually added by admin',
      summary: auditEntry.changesSummary,
    },
    auditHistory: [auditEntry],
  };

  // 1. Save Attendance Record
  await setDoc(doc(db, ATTENDANCE_COLLECTION, recordId), newRecord);

  // 2. Save Audit Log
  await setDoc(doc(db, ATTENDANCE_AUDIT_COLLECTION, auditEntry.id), auditEntry);

  // 3. Sync aggregates
  await syncAggregatesAfterAttendanceChange(intern.id, monthYear);

  return newRecord;
}

/**
 * Manually update an existing attendance record (Admin Action).
 * Computes diffs, logs audit trail, and synchronizes monthly review & payroll.
 */
export async function adminUpdateAttendanceRecord(
  params: {
    recordId: string;
    checkInTime: string;
    checkOutTime: string | null;
    locationType: LocationType;
    locationNote?: string;
    notes?: string;
    reason?: string;
  },
  adminProfile: UserProfile
): Promise<void> {
  const { recordId, checkInTime, checkOutTime, locationType, locationNote, notes, reason } = params;
  const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    throw new Error('Attendance record not found');
  }

  const existing = docSnap.data() as AttendanceRecord;
  const nowIso = new Date().toISOString();

  // Calculate new duration
  let totalDuration = existing.totalDuration;
  let totalMinutes = existing.totalMinutes;
  let status: AttendanceRecord['status'] = existing.status;

  if (checkInTime && checkOutTime) {
    const calc = calculateDurationStr(checkInTime, checkOutTime);
    totalDuration = calc.durationStr;
    totalMinutes = calc.totalMinutes;
    status = 'normal';
  } else if (!checkOutTime) {
    status = 'active';
    totalDuration = '';
    totalMinutes = 0;
  }

  // Calculate fieldChanges diff
  const fieldChanges: { field: string; label: string; before: any; after: any }[] = [];
  if (existing.checkInTime !== checkInTime) {
    fieldChanges.push({ field: 'checkInTime', label: 'Check-in Time', before: existing.checkInTime, after: checkInTime });
  }
  if ((existing.checkOutTime || null) !== (checkOutTime || null)) {
    fieldChanges.push({ field: 'checkOutTime', label: 'Check-out Time', before: existing.checkOutTime || '—', after: checkOutTime || '—' });
  }
  if (existing.locationType !== locationType) {
    fieldChanges.push({ field: 'locationType', label: 'Work Location', before: existing.locationType, after: locationType });
  }
  if ((existing.notes || '') !== (notes || '')) {
    fieldChanges.push({ field: 'notes', label: 'Notes', before: existing.notes || '—', after: notes || '—' });
  }

  const changesSummary =
    fieldChanges.length > 0
      ? fieldChanges.map((f) => `${f.label}: "${f.before}" → "${f.after}"`).join('; ')
      : 'Admin updated attendance record fields';

  let internName = 'Intern';
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, existing.internId));
    if (userSnap.exists()) {
      internName = (userSnap.data() as UserProfile).name;
    }
  } catch (_) {}

  const auditEntry: AttendanceAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recordId,
    internId: existing.internId,
    internName,
    action: 'edited_by_admin',
    adminId: adminProfile.id,
    adminName: adminProfile.name,
    adminEmail: adminProfile.email,
    timestamp: nowIso,
    reason: reason?.trim() || 'Manual administrative correction',
    changesSummary,
    fieldChanges,
    snapshotBefore: {
      checkInTime: existing.checkInTime,
      checkOutTime: existing.checkOutTime,
      locationType: existing.locationType,
      notes: existing.notes,
      totalDuration: existing.totalDuration,
    },
    snapshotAfter: {
      checkInTime,
      checkOutTime,
      locationType,
      notes: notes || '',
      totalDuration,
    },
  };

  const previousHistory = existing.auditHistory || [];
  const updatedHistory = [auditEntry, ...previousHistory];

  const updatePayload: Partial<AttendanceRecord> = {
    checkInTime,
    checkOutTime: checkOutTime || null,
    locationType,
    locationNote: locationNote || (locationType === 'office' ? 'Bangkok HQ' : (existing.locationNote || 'Outside Office / Field Site')),
    notes: notes || '',
    checkInNote: notes || '',
    checkOutNote: '',
    totalDuration,
    totalMinutes,
    status,
    isManuallyEdited: true,
    lastEditedBy: {
      adminId: adminProfile.id,
      adminName: adminProfile.name,
      adminEmail: adminProfile.email,
      editedAt: nowIso,
      action: 'edited_by_admin',
      reason: reason?.trim() || 'Admin manual correction',
      summary: changesSummary,
    },
    auditHistory: updatedHistory,
    updatedAt: nowIso,
  };

  // 1. Update Attendance Record
  await updateDoc(docRef, updatePayload);

  // 2. Save Audit Log
  await setDoc(doc(db, ATTENDANCE_AUDIT_COLLECTION, auditEntry.id), auditEntry);

  // 3. Sync aggregates
  await syncAggregatesAfterAttendanceChange(existing.internId, existing.monthYear);
}

/**
 * Delete an attendance record entirely (Admin Action).
 * Preserves audit log document with 'deleted_by_admin', snapshot, and reason.
 * Synchronizes monthly reviews and payroll days worked.
 */
export async function adminDeleteAttendanceRecord(
  recordId: string,
  adminProfile: UserProfile,
  reason?: string
): Promise<void> {
  const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return;
  }

  const existing = docSnap.data() as AttendanceRecord;
  const nowIso = new Date().toISOString();

  let internName = 'Intern';
  try {
    const userSnap = await getDoc(doc(db, USERS_COLLECTION, existing.internId));
    if (userSnap.exists()) {
      internName = (userSnap.data() as UserProfile).name;
    }
  } catch (_) {}

  const auditEntry: AttendanceAuditLog = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    recordId,
    internId: existing.internId,
    internName,
    action: 'deleted_by_admin',
    adminId: adminProfile.id,
    adminName: adminProfile.name,
    adminEmail: adminProfile.email,
    timestamp: nowIso,
    reason: reason?.trim() || 'Record removed by admin (mistaken entry or holiday)',
    changesSummary: `Permanently removed shift record for ${existing.monthName} ${existing.date} (${existing.checkInTime} - ${existing.checkOutTime || 'Active'}, ${existing.locationType === 'office' ? 'Office' : 'Outside'})`,
    snapshotBefore: existing,
  };

  // 1. Save Audit Log before deleting record
  await setDoc(doc(db, ATTENDANCE_AUDIT_COLLECTION, auditEntry.id), auditEntry);

  // 2. Delete the attendance document
  await deleteDoc(docRef);

  // 3. Sync aggregates so Days Worked and Payroll decrease appropriately
  await syncAggregatesAfterAttendanceChange(existing.internId, existing.monthYear);
}

/**
 * Subscribe to all Attendance Audit Logs in real time
 */
export function subscribeToAttendanceAuditLogs(
  callback: (logs: AttendanceAuditLog[]) => void
) {
  const coll = collection(db, ATTENDANCE_AUDIT_COLLECTION);
  return onSnapshot(
    coll,
    (snapshot) => {
      const logs: AttendanceAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        logs.push(docSnap.data() as AttendanceAuditLog);
      });
      // Sort newest first
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      callback(logs);
    },
    (err) => {
      console.error('Audit logs subscription error:', err);
    }
  );
}

