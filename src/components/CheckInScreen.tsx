import React, { useState, useEffect } from 'react';
import { AttendanceRecord, LocationType, UserProfile } from '../types';
import { OFFICE_COORDINATES } from '../data/mockData';

interface CheckInScreenProps {
  user: UserProfile;
  attendanceLogs: AttendanceRecord[];
  onCheckIn: (record: AttendanceRecord) => void;
  onCheckOut: (recordId: string, checkOutTime: string) => void;
  onNavigate: (tab: 'checkin' | 'history' | 'profile') => void;
  onOpenMenu: () => void;
}

export const CheckInScreen: React.FC<CheckInScreenProps> = ({
  user,
  attendanceLogs,
  onCheckIn,
  onCheckOut,
  onNavigate,
  onOpenMenu,
}) => {
  // Check if user is currently checked in today
  const todayLog = attendanceLogs[0];
  const isCheckedIn = todayLog && !todayLog.checkOutTime;

  const [currentTime, setCurrentTime] = useState<string>('09:15 AM');
  const [currentDateStr, setCurrentDateStr] = useState<string>('October 24, 2023');
  const [locationType, setLocationType] = useState<LocationType>('office');
  const [locationNote, setLocationNote] = useState<string>('');
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: OFFICE_COORDINATES.lat,
    lng: OFFICE_COORDINATES.lng,
  });
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Update clock & fetch initial device GPS coordinates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      const dateStr = now.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      setCurrentTime(timeStr);
      setCurrentDateStr(dateStr);
    };

    updateTime();
    const interval = setInterval(updateTime, 10000);

    // Capture real GPS coordinates if geolocation available
    if ('geolocation' in navigator) {
      setIsLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsLocating(false);
        },
        (error) => {
          console.log('GPS Geolocation note:', error.message);
          setIsLocating(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }

    return () => clearInterval(interval);
  }, []);

  const handleToggleCheckIn = () => {
    if (isCheckedIn && todayLog) {
      // Check Out
      onCheckOut(todayLog.id, currentTime);
      setToastMessage('Successfully checked out at ' + currentTime);
      setTimeout(() => setToastMessage(null), 3500);
    } else {
      // Check In
      const newLog: AttendanceRecord = {
        id: `att-${Date.now()}`,
        internId: user.id,
        monthYear: 'October 2023',
        date: new Date().getDate() || 24,
        monthName: 'OCT',
        dayOfWeek: new Date().toLocaleDateString('en-US', { weekday: 'long' }) || 'Tuesday',
        checkInTime: currentTime,
        checkOutTime: null,
        totalDuration: 'Active',
        totalMinutes: 0,
        status: 'normal',
        locationType: locationType,
        locationNote: locationNote.trim() || (locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Traveling'),
        coordinates: { ...coords },
        notes: locationNote.trim() ? locationNote.trim() : undefined,
      };

      onCheckIn(newLog);
      setToastMessage(
        locationType === 'office'
          ? `Checked in at ${currentTime} (Office)`
          : `Checked in at ${currentTime} (Outside / Traveling)`
      );
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  return (
    <div className="bg-[#f9f9ff] text-[#041b3c] min-h-screen flex flex-col pt-16 pb-24 overflow-x-hidden antialiased font-sans relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-[#041b3c] text-white px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-bounce border border-[#c3c6d6]">
          <span className="material-symbols-outlined text-[#10B981] text-[20px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-40 bg-[#f9f9ff] border-b border-[#c3c6d6] flex justify-between items-center px-6 h-16 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <button
          onClick={onOpenMenu}
          className="text-[#434654] hover:bg-[#e8edff] transition-colors p-2 rounded-full cursor-pointer active:opacity-80 flex items-center justify-center"
          title="Menu & Switch Screens"
          aria-label="Open Navigation Menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="text-[20px] font-semibold text-[#003d9b] tracking-tight">Intern Check-in</h1>
        <button
          onClick={() => onNavigate('profile')}
          className="w-10 h-10 rounded-full overflow-hidden border border-[#c3c6d6] bg-[#e8edff] flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-[#0052cc] transition-all"
          title="View Profile"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
          ) : (
            <span className="material-symbols-outlined text-[#585f6a]">person</span>
          )}
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 py-4 flex flex-col items-center justify-start gap-5 max-w-md mx-auto w-full">
        {/* Work Location Type Selector (Before Check-in) */}
        {!isCheckedIn && (
          <div className="w-full bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-sm">
            <label className="block text-[12px] font-bold text-[#041b3c] uppercase tracking-wider mb-2.5">
              Work Location Type
            </label>
            
            <div className="grid grid-cols-2 gap-2.5">
              {/* Option 1: At Office */}
              <button
                type="button"
                onClick={() => setLocationType('office')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  locationType === 'office'
                    ? 'bg-[#e0e8ff] border-[#003d9b] text-[#003d9b] font-semibold shadow-xs ring-1 ring-[#003d9b]'
                    : 'bg-[#f9f9ff] border-[#c3c6d6] text-[#434654] hover:bg-[#f1f3ff]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">corporate_fare</span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">At Office</div>
                  <div className="text-[10px] opacity-75 font-normal">HQ / Main Office</div>
                </div>
              </button>

              {/* Option 2: Outside Office / Traveling */}
              <button
                type="button"
                onClick={() => setLocationType('outside')}
                className={`p-3 rounded-lg border text-left flex items-center gap-2.5 transition-all cursor-pointer ${
                  locationType === 'outside'
                    ? 'bg-[#dae0ee] border-[#041b3c] text-[#041b3c] font-semibold shadow-xs ring-1 ring-[#041b3c]'
                    : 'bg-[#f9f9ff] border-[#c3c6d6] text-[#434654] hover:bg-[#f1f3ff]'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">travel_explore</span>
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold">Outside / Traveling</div>
                  <div className="text-[10px] opacity-75 font-normal">Client, Field, Other</div>
                </div>
              </button>
            </div>

            {/* Optional Location Note */}
            <div className="mt-3">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[11px] font-medium text-[#434654]">
                  Location / Note <span className="text-[#737685] font-normal">(Optional)</span>
                </label>
                {locationType === 'outside' && (
                  <span className="text-[10px] text-[#003d9b] font-medium">e.g. Chiang Mai, Client site</span>
                )}
              </div>
              <input
                type="text"
                value={locationNote}
                onChange={(e) => setLocationNote(e.target.value)}
                placeholder={
                  locationType === 'outside'
                    ? 'e.g. Client site - Chiang Mai, WFH, Rayong plant...'
                    : 'e.g. Bangkok HQ - 14th Floor, Innovation Lab...'
                }
                className="w-full px-3 py-2 text-[13px] bg-[#f9f9ff] border border-[#c3c6d6] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#003d9b] focus:border-[#003d9b] text-[#041b3c] placeholder:text-[#8d9199]"
              />
            </div>
          </div>
        )}

        {/* If already checked in today, show current active location status */}
        {isCheckedIn && todayLog && (
          <div className="w-full bg-[#e0e8ff]/70 border border-[#003d9b]/30 rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#003d9b] text-white flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">
                  {todayLog.locationType === 'office' ? 'corporate_fare' : 'travel_explore'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-[#041b3c]">Current Shift</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      todayLog.locationType === 'office'
                        ? 'bg-[#0052cc] text-white'
                        : 'bg-[#585f6a] text-white'
                    }`}
                  >
                    {todayLog.locationType === 'office' ? 'Office' : 'Outside'}
                  </span>
                </div>
                <p className="text-[12px] text-[#434654] mt-0.5 font-medium">
                  {todayLog.locationNote || (todayLog.locationType === 'office' ? 'Bangkok HQ' : 'Outside Office / Traveling')}
                </p>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#003d9b]">Clocked In</span>
          </div>
        )}

        {/* Check-in / Check-out Button Area */}
        <div className="relative w-full flex justify-center items-center py-4">
          {/* Decorative outer pulsing rings */}
          <div
            className={`absolute inset-0 m-auto w-60 h-60 rounded-full border pulse-ring transition-colors ${
              isCheckedIn ? 'border-[#ba1a1a]/30' : 'border-[#0052cc]/20'
            }`}
          />
          <div
            className={`absolute inset-0 m-auto w-52 h-52 rounded-full border transition-colors ${
              isCheckedIn ? 'border-[#ba1a1a]/40' : 'border-[#0052cc]/40'
            }`}
          />

          {/* Main Button */}
          <button
            onClick={handleToggleCheckIn}
            id="checkInBtn"
            className={`checkin-button relative z-10 w-44 h-44 rounded-full text-white flex flex-col items-center justify-center gap-1.5 group cursor-pointer transition-all duration-300 ${
              isCheckedIn
                ? 'bg-[#ba1a1a] shadow-[0_8px_32px_rgba(186,26,26,0.35)] hover:bg-[#9f1515]'
                : 'bg-[#0052cc] shadow-[0_8px_32px_rgba(0,82,204,0.35)] hover:bg-[#0040a2]'
            }`}
          >
            <div className="absolute inset-0 rounded-full bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            <span
              className="material-symbols-outlined text-white transition-transform group-hover:scale-110 duration-200"
              style={{ fontSize: '44px' }}
            >
              {isCheckedIn ? 'logout' : 'fingerprint'}
            </span>
            <span className="text-[19px] font-semibold tracking-wide">
              {isCheckedIn ? 'Check Out' : 'Check In'}
            </span>
            <span className="text-[11px] opacity-80 font-normal">
              {isCheckedIn ? 'Tap to end shift' : 'Tap to record entry'}
            </span>
          </button>
        </div>

        {/* GPS Coordinates & Live Location Card */}
        <div className="w-full bg-white border border-[#c3c6d6] rounded-xl p-4 relative overflow-hidden shadow-sm">
          <div className="absolute inset-0 opacity-30 bg-map-pattern pointer-events-none" />
          
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#e0e8ff] text-[#003d9b] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">location_on</span>
                </div>
                <h2 className="text-[14px] font-semibold text-[#041b3c]">GPS Coordinates Captured</h2>
              </div>

              {/* Informational badge */}
              <div className="px-2.5 py-0.5 rounded-full bg-[#f1f3ff] text-[#003d9b] border border-[#c3c6d6]/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span className="text-[11px] font-medium">GPS Active</span>
              </div>
            </div>

            <div className="pl-9 flex flex-col gap-1 border-l-2 border-[#e0e8ff] ml-3 py-0.5">
              <p className="text-[13px] text-[#434654] flex items-center gap-1.5 font-mono">
                <span className="material-symbols-outlined text-[15px] opacity-70">my_location</span>
                {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                {isLocating && <span className="text-[10px] text-[#737685]">(updating...)</span>}
              </p>
              <p className="text-[13px] text-[#585f6a] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] opacity-70">schedule</span>
                {currentDateStr} • {currentTime}
              </p>
            </div>
          </div>
        </div>

        {/* Daily Summary Card */}
        <div className="w-full bg-white border border-[#c3c6d6] rounded-xl p-4 shadow-sm">
          <h3 className="text-[11px] font-semibold text-[#585f6a] uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            Daily Summary
          </h3>
          <div className="flex justify-between items-center bg-[#f9f9ff] p-3 rounded-lg border border-[#e8edff]">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-[#434654]">Check-in</span>
              <span className="text-[15px] font-semibold text-[#041b3c]">
                {todayLog?.checkInTime || '--:--'}
              </span>
            </div>
            <div className="h-7 w-px bg-[#c3c6d6]" />
            <div className="flex flex-col gap-0.5 text-right">
              <span className="text-[11px] font-medium text-[#434654]">Check-out</span>
              <span
                className={`text-[15px] font-semibold ${
                  todayLog?.checkOutTime ? 'text-[#041b3c]' : 'text-[#585f6a]'
                }`}
              >
                {todayLog?.checkOutTime || '--:--'}
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* BottomNavBar */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 px-4 bg-white border-t border-[#c3c6d6] z-40">
        {/* Active Tab: Home */}
        <button
          onClick={() => onNavigate('checkin')}
          className="flex flex-col items-center justify-center bg-[#0052cc] text-white rounded-full px-5 py-1.5 active:scale-95 duration-100 cursor-pointer shadow-sm"
        >
          <span className="material-symbols-outlined filled" style={{ fontVariationSettings: "'FILL' 1" }}>
            home
          </span>
          <span className="text-[12px] font-semibold mt-0.5">Home</span>
        </button>

        {/* Inactive Tab: History */}
        <button
          onClick={() => onNavigate('history')}
          className="flex flex-col items-center justify-center text-[#434654] hover:bg-[#f1f3ff] rounded-full px-5 py-1.5 transition-all active:scale-95 duration-100 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            history
          </span>
          <span className="text-[12px] font-semibold mt-0.5">History</span>
        </button>

        {/* Inactive Tab: Profile */}
        <button
          onClick={() => onNavigate('profile')}
          className="flex flex-col items-center justify-center text-[#434654] hover:bg-[#f1f3ff] rounded-full px-5 py-1.5 transition-all active:scale-95 duration-100 cursor-pointer"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 0" }}>
            person
          </span>
          <span className="text-[12px] font-semibold mt-0.5">Profile</span>
        </button>
      </nav>
    </div>
  );
};
