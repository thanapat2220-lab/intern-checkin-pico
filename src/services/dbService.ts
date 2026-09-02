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
import { AttendanceRecord, InternMonthlyReview, PayrollRecord, UserProfile, ApprovalLink } from '../types';

const ATTENDANCE_COLLECTION = 'attendance';
const REVIEWS_COLLECTION = 'monthlyReviews';
const PAYROLL_COLLECTION = 'payroll';
const USERS_COLLECTION = 'users';
const APPROVAL_LINKS_COLLECTION = 'approvalLinks';

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
          data.internId === 'intern-01' ||
          data.internId === 'intern-02'
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
          MOCK_NAMES.includes(data.name) ||
          data.internId === 'intern-01' ||
          data.internId === 'intern-02'
        ) {
          await deleteDoc(d.ref);
        }
      }
    } catch (_) {}

    try {
      const paySnap = await getDocs(collection(db, PAYROLL_COLLECTION));
      for (const d of paySnap.docs) {
        const data = d.data();
        if (KNOWN_MOCK_PAYROLL_IDS.includes(d.id) || MOCK_NAMES.includes(data.name)) {
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
 * Create a lightweight supervisor record in Firestore without requiring Firebase Auth.
 * Used by Payroll Admins to immediately assign supervisors and generate magic links.
 */
export async function createLightweightSupervisor(data: {
  name: string;
  email: string;
  department?: string;
  team?: string;
}): Promise<UserProfile> {
  const cleanEmail = data.email.trim().toLowerCase();
  const cleanName = data.name.trim();

  // Check if a user with this email already exists
  const existingSnap = await getDocs(
    query(collection(db, USERS_COLLECTION), where('email', '==', cleanEmail))
  );

  if (!existingSnap.empty) {
    const existing = existingSnap.docs[0].data() as UserProfile;
    return existing;
  }

  // Generate a distinct supervisor document ID
  const docId = `sup_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const initials =
    cleanName
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .join('')
      .toUpperCase()
      .slice(0, 2) || (cleanEmail[0] || 'S').toUpperCase();

  const supervisorProfile: UserProfile = {
    id: docId,
    name: cleanName,
    email: cleanEmail,
    role: 'supervisor',
    department: data.department?.trim() || 'Operations',
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
  await setDoc(userRef, supervisorProfile);

  return supervisorProfile;
}

/**
 * If a supervisor with an existing lightweight record registers with Firebase Auth,
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

  const mergedProfile: UserProfile = {
    id: firebaseUid,
    name,
    email: cleanEmail,
    role: 'supervisor',
    department: newProfileData?.department || existingProfile?.department || 'Operations',
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
  totalMinutes: number
): Promise<void> {
  try {
    const docRef = doc(db, ATTENDANCE_COLLECTION, recordId);
    await updateDoc(docRef, {
      checkOutTime,
      totalDuration,
      totalMinutes,
      updatedAt: new Date().toISOString(),
    });
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
    await updateDoc(docRef, {
      ...record,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error updating payroll record:', err);
    throw err;
  }
}

// ---------------- MAGIC LINK APPROVALS ---------------- //

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

