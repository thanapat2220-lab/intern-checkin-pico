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
import { linkLightweightSupervisorToAuth } from './dbService';

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
        callback(firebaseUser, userSnap.data() as UserProfile);
      } else {
        // Check if there was an existing lightweight supervisor profile matching this email
        try {
          const linkedProfile = await linkLightweightSupervisorToAuth(
            firebaseUser.uid,
            firebaseUser.email || '',
            {
              name: firebaseUser.displayName || undefined,
            }
          );
          callback(firebaseUser, linkedProfile);
        } catch (linkErr) {
          console.warn('Fallback standard profile creation:', linkErr);
          const initials = firebaseUser.displayName
            ? firebaseUser.displayName
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)
            : (firebaseUser.email?.[0] || 'U').toUpperCase();

          const newProfile: UserProfile = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            email: firebaseUser.email || '',
            role: 'intern',
            department: 'Engineering',
            team: 'General',
            initials,
            internshipPeriod: 'Jul 1 - Dec 31',
            dailyRateTHB: 400,
            bankName: 'Kasikorn',
            accountNumber: '',
            supervisorId: null,
            supervisorName: null,
          };

          await setDoc(userRef, newProfile);
          callback(firebaseUser, newProfile);
        }
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
    return snap.data() as UserProfile;
  }

  // Link or create
  const profile = await linkLightweightSupervisorToAuth(
    userCredential.user.uid,
    email,
    {}
  );
  return profile;
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
 */
export async function registerNewUser(
  email: string,
  pass: string,
  profileData: Partial<UserProfile>
): Promise<UserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const uid = userCredential.user.uid;

  // If registering as a supervisor or if a lightweight supervisor record exists
  if (profileData.role === 'supervisor') {
    const linkedSupervisor = await linkLightweightSupervisorToAuth(
      uid,
      email,
      profileData
    );
    return linkedSupervisor;
  }

  const role: UserRole = profileData.role || 'intern';

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
    email,
    role,
    department: profileData.department || (role === 'intern' ? 'Engineering' : 'Internal Operations'),
    team: profileData.team || (role === 'intern' ? 'Frontend' : 'General'),
    avatarUrl: profileData.avatarUrl,
    initials,
    internshipPeriod: profileData.internshipPeriod || (role === 'intern' ? 'Jul 1 - Dec 31' : 'Full Time'),
    dailyRateTHB: profileData.dailyRateTHB !== undefined ? profileData.dailyRateTHB : (role === 'intern' ? 400 : 0),
    bankName: profileData.bankName || 'Kasikorn',
    accountNumber: profileData.accountNumber || '',
    supervisorId: role === 'intern' ? (profileData.supervisorId || null) : null,
    supervisorName: role === 'intern' ? (profileData.supervisorName || null) : null,
  };

  const userRef = doc(db, USERS_COLLECTION, uid);
  await setDoc(userRef, fullProfile);

  return fullProfile;
}

/**
 * Sign out of Firebase Auth
 */
export async function logoutFromFirebase(): Promise<void> {
  await signOut(auth);
}

