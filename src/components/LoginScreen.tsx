import React, { useState } from 'react';
import { UserProfile, UserRole } from '../types';
import { loginWithEmail, registerNewUser } from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (profile: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('intern');
  const [department, setDepartment] = useState('');
  const [team, setTeam] = useState('');
  const [bankName, setBankName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isInvalidCredError, setIsInvalidCredError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsInvalidCredError(false);
    setIsLoading(true);

    try {
      if (isRegisterMode) {
        if (!email || !password) {
          throw new Error('Please provide email and password.');
        }
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        const newProfile = await registerNewUser(email, password, {
          name: fullName || email.split('@')[0],
          role,
          department,
          team,
          dailyRateTHB: role === 'intern' ? 400 : 0,
          bankName,
          accountNumber: '',
        });
        onLoginSuccess(newProfile);
      } else {
        const profile = await loginWithEmail(email, password);
        onLoginSuccess(profile);
      }
    } catch (err: any) {
      console.error('Auth error:', err);
      let msg = err.message || 'Authentication failed.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        msg = 'Invalid credentials or account does not exist yet.';
        setIsInvalidCredError(true);
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak. Must be at least 6 characters.';
      } else if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password sign-in is not enabled in the Firebase console.';
      }
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#414446] min-h-screen flex items-center justify-center p-4 font-sans text-[#041b3c]">
      <main className="w-full max-w-[460px] flex flex-col gap-5 my-8">
        {/* Logo Area */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-14 h-14 bg-[#003d9b] rounded-2xl flex items-center justify-center text-white shadow-lg ring-4 ring-white/10">
            <span
              className="material-symbols-outlined text-[32px] filled"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              how_to_reg
            </span>
          </div>
          <h1 className="text-[26px] font-black text-white text-center tracking-tight">
            Intern Check-in
          </h1>
          <span className="text-xs text-[#c3c6d6] font-medium bg-white/10 px-3 py-0.5 rounded-full">
            Firebase Authentication & Cloud Firestore
          </span>
        </div>

        {/* Auth Card */}
        <div className="bg-white rounded-2xl border border-[#c3c6d6] p-6 md:p-8 flex flex-col gap-5 shadow-2xl">
          <div className="flex justify-between items-center border-b border-[#c3c6d6]/60 pb-3">
            <div>
              <h2 className="text-[20px] font-bold text-[#041b3c]">
                {isRegisterMode ? 'Create Account' : 'Sign In'}
              </h2>
              <p className="text-xs text-[#585f6a] mt-0.5">
                {isRegisterMode
                  ? 'Register as an intern, supervisor, or payroll admin'
                  : 'Enter your credentials to continue'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setErrorMsg(null);
              }}
              className="text-xs font-semibold text-[#003d9b] hover:text-[#0052cc] bg-[#f1f3ff] hover:bg-[#e0e8ff] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              {isRegisterMode ? 'Sign In Instead' : 'Register New'}
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 bg-[#ffdad6] text-[#ba1a1a] rounded-xl text-xs flex flex-col gap-2 border border-[#ba1a1a]/20 animate-fade-in">
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0">error</span>
                <span className="leading-snug">{errorMsg}</span>
              </div>
              {isInvalidCredError && !isRegisterMode && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegisterMode(true);
                    setErrorMsg(null);
                    setIsInvalidCredError(false);
                  }}
                  className="mt-1 bg-white text-[#ba1a1a] hover:bg-[#fff0ef] font-bold text-[11px] py-1.5 px-3 rounded-lg border border-[#ba1a1a]/30 transition-colors w-fit flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">person_add</span>
                  <span>Register this email as a new account instead</span>
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {isRegisterMode && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-[#041b3c] uppercase tracking-wider">
                    Full Name
                  </label>
                  <input
                    className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg px-3 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                    placeholder="e.g. Thanapat S."
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isRegisterMode}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-[#041b3c] uppercase tracking-wider">
                      Account Role
                    </label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg px-3 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] outline-none"
                    >
                      <option value="intern">Intern</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="payroll_admin">Payroll Admin</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-bold text-[#041b3c] uppercase tracking-wider">
                      Department
                    </label>
                    <input
                      className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg px-3 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                      placeholder="e.g. Engineering, Marketing, Operations..."
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </div>

                {role === 'intern' && (
                  <div className="grid grid-cols-2 gap-2.5 p-2.5 bg-[#f1f3ff] rounded-lg border border-[#c3c6d6]/60">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#585f6a] uppercase">
                        Daily Rate (THB)
                      </label>
                      <div className="w-full bg-[#e6edfa] border border-[#c3c6d6] rounded-md px-2.5 py-1.5 text-xs text-[#003d9b] font-medium flex items-center justify-between cursor-not-allowed select-none">
                        <span>400 THB/day</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#585f6a]">
                          Standard Rate
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-[#585f6a] uppercase">
                        Bank Name
                      </label>
                      <input
                        className="w-full bg-white border border-[#c3c6d6] rounded-md px-2.5 py-1.5 text-xs text-[#041b3c] focus:border-[#003d9b] outline-none"
                        placeholder="e.g. Kasikorn, SCB, Bangkok Bank..."
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-[#041b3c] uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737685] text-[18px]">
                  mail
                </span>
                <input
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg pl-9 pr-3 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                  placeholder="name@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-[#041b3c] uppercase tracking-wider">
                  Password
                </label>
                {!isRegisterMode && (
                  <span className="text-[11px] text-[#585f6a]">
                    Secured by Firebase
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#737685] text-[18px]">
                  lock
                </span>
                <input
                  className="w-full bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg pl-9 pr-3 py-2 text-xs text-[#041b3c] focus:border-[#003d9b] focus:ring-1 focus:ring-[#003d9b] outline-none"
                  placeholder="••••••••"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              className="w-full bg-[#003d9b] hover:bg-[#0052cc] text-white font-semibold text-xs py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 transition-all mt-1 cursor-pointer shadow-sm disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Connecting to Firebase...</span>
                </span>
              ) : (
                <>
                  <span>{isRegisterMode ? 'Complete Registration' : 'Sign in to Account'}</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Database Status Callout */}
        <div className="bg-[#dae0ee] border-l-4 border-[#003d9b] rounded-r-xl p-3.5 flex items-center gap-3 shadow-xs">
          <span className="material-symbols-outlined text-[#003d9b] text-[20px] shrink-0">
            cloud_done
          </span>
          <p className="text-xs text-[#041b3c] font-medium leading-snug">
            Real Firestore database active. Check-ins, reviews, and payroll changes synchronize live in real time.
          </p>
        </div>
      </main>
    </div>
  );
};

