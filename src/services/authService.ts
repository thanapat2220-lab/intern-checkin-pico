import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { cleanFirestoreData } from './dbService';

const USERS_COLLECTION = 'users';

/**
 * Listen to Firebase Auth state
 */
export function listenToAuthState(
  callback: (user: User | null, profile: UserProfile | null) => void
) {
  return onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      // Fetch Firestore profile
      const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const rawData = userSnap.data() as UserProfile & { role?: string };
        let role: UserRole = (rawData.role as UserRole) || 'intern';
        // Normalize custom 'admin' to 'payroll_admin'
        if ((rawData.role as string) === 'admin') {
          role = 'payroll_admin';
        }
        // Ensure designated administrator account retains Payroll Admin
        if (
          rawData.email?.toLowerCase() === 'thanapat2220@gmail.com' ||
          firebaseUser.email?.toLowerCase() === 'thanapat2220@gmail.com'
        ) {
          role = 'payroll_admin';
        }
        callback(firebaseUser, { ...rawData, role });
      } else {
        const cleanEmail = (firebaseUser.email || '').trim().toLowerCase();
        const initials = firebaseUser.displayName
          ? firebaseUser.displayName
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : (cleanEmail[0] || 'U').toUpperCase();

        const newProfile: UserProfile = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || cleanEmail.split('@')[0] || 'User',
          email: cleanEmail,
          role: cleanEmail === 'thanapat2220@gmail.com' ? 'payroll_admin' : 'intern',
          department: 'Engineering',
          team: 'General',
          initials,
          internshipPeriod: 'Jul 1 - Dec 31',
          dailyRateTHB: 400,
          bankName: 'Kasikorn Bank (KBANK)',
          accountNumber: '',
          supervisorId: null,
          supervisorName: null,
        };

        await setDoc(userRef, cleanFirestoreData(newProfile));
        callback(firebaseUser, newProfile);
      }
    } else {
      callback(null, null);
    }
  });
}

/**
 * Log in with Email and Password
 */
export async function loginWithEmail(email: string, pass: string): Promise<UserProfile> {
  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const userRef = doc(db, USERS_COLLECTION, userCredential.user.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const rawData = snap.data() as UserProfile & { role?: string };
    let role: UserRole = (rawData.role as UserRole) || 'intern';
    if ((rawData.role as string) === 'admin') {
      role = 'payroll_admin';
    }
    if (
      rawData.email?.toLowerCase() === 'thanapat2220@gmail.com' ||
      email.trim().toLowerCase() === 'thanapat2220@gmail.com'
    ) {
      role = 'payroll_admin';
    }
    return { ...rawData, role };
  }

  const cleanEmail = email.trim().toLowerCase();
  const initials = (cleanEmail[0] || 'U').toUpperCase();
  const fallbackProfile: UserProfile = {
    id: userCredential.user.uid,
    name: userCredential.user.displayName || cleanEmail.split('@')[0] || 'User',
    email: cleanEmail,
    role: cleanEmail === 'thanapat2220@gmail.com' ? 'payroll_admin' : 'intern',
    department: 'Engineering',
    team: 'General',
    initials,
    internshipPeriod: 'Jul 1 - Dec 31',
    dailyRateTHB: 400,
    bankName: 'Kasikorn Bank (KBANK)',
    accountNumber: '',
    supervisorId: null,
    supervisorName: null,
  };
  await setDoc(userRef, cleanFirestoreData(fallbackProfile));
  return fallbackProfile;
}

/**
 * Quick login or auto-create demo user accounts seamlessly
 */
export async function loginOrCreateUser(
  email: string,
  pass: string,
  profileData?: Partial<UserProfile>
): Promise<UserProfile> {
  try {
    return await loginWithEmail(email, pass);
  } catch (err: any) {
    if (
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/user-not-found' ||
      err.code === 'auth/wrong-password'
    ) {
      try {
        // Try creating the user if not exists
        return await registerNewUser(email, pass, profileData || {});
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          // If already exists but password differed, throw the original error
          throw err;
        }
        throw createErr;
      }
    }
    throw err;
  }
}

/**
 * Register a new user with full details and role
 * Every new registration must create a user document with role: "intern", full stop — zero exceptions.
 */
export async function registerNewUser(
  email: string,
  pass: string,
  profileData: Partial<UserProfile>
): Promise<UserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = userCredential.user.uid;
  const cleanEmail = email.trim().toLowerCase();

  // Every new registration strictly creates role: 'intern' (zero exceptions based on email matching any other collection or record)
  const role: UserRole = 'intern';

  const initials = profileData.name
    ? profileData.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (email[0] || 'U').toUpperCase();

  const fullProfile: UserProfile = {
    id: uid,
    name: profileData.name || email.split('@')[0],
    email: cleanEmail,
    role,
    department: profileData.department || (role === 'intern' ? 'Engineering' : 'Finance & Payroll'),
    team: profileData.team || (role === 'intern' ? 'Intern Team' : 'General'),
    avatarUrl: profileData.avatarUrl,
    initials,
    internshipPeriod: profileData.internshipPeriod || (role === 'intern' ? 'Jul 1 - Dec 31' : 'Full Time'),
    dailyRateTHB: role === 'intern' ? 400 : 0,
    bankName: profileData.bankName || 'Kasikorn Bank (KBANK)',
    accountNumber: profileData.accountNumber || '',
    supervisorId: role === 'intern' ? (profileData.supervisorId || null) : null,
    supervisorName: role === 'intern' ? (profileData.supervisorName || null) : null,
  };

  const userRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userRef, cleanFirestoreData(fullProfile));

  return fullProfile;
}

/**
 * Sign out of Firebase Auth
 */
export async function logoutFromFirebase(): Promise<void> {
  await signOut(auth);
}

