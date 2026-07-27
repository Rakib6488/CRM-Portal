import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Coffee, ShieldAlert, BookOpen, Clock, LogOut, CheckCircle, 
  MapPin, StickyNote, RefreshCw, Send, AlertTriangle, HelpCircle,
  Phone, PhoneCall, MessageSquare, AlertCircle
} from 'lucide-react';
import { LiveAgentSession } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface DashboardSectionProps {
  agentName: string;
  agentId: string;
  isCheckedIn: boolean;
  setIsCheckedIn: React.Dispatch<React.SetStateAction<boolean>>;
  agentStatus: 'AVAILABLE' | 'ON BREAK' | 'OFFLINE';
  setAgentStatus: React.Dispatch<React.SetStateAction<'AVAILABLE' | 'ON BREAK' | 'OFFLINE'>>;
  currentActivity: string;
  setCurrentActivity: React.Dispatch<React.SetStateAction<string>>;
  isOnBreak: boolean;
  setIsOnBreak: React.Dispatch<React.SetStateAction<boolean>>;
  shiftStartTime: string | null;
  setShiftStartTime: React.Dispatch<React.SetStateAction<string | null>>;
  
  // Timers
  shiftTimer: number;
  setShiftTimer: React.Dispatch<React.SetStateAction<number>>;
  shortBreakTimer: number;
  setShortBreakTimer: React.Dispatch<React.SetStateAction<number>>;
  mealBreakTimer: number;
  setMealBreakTimer: React.Dispatch<React.SetStateAction<number>>;
  prayerBreakTimer: number;
  setPrayerBreakTimer: React.Dispatch<React.SetStateAction<number>>;
  meetingTimer: number;
  setMeetingTimer: React.Dispatch<React.SetStateAction<number>>;
  
  // Work Distribution Timers
  inboundTimer: number;
  setInboundTimer: React.Dispatch<React.SetStateAction<number>>;
  outboundTimer: number;
  setOutboundTimer: React.Dispatch<React.SetStateAction<number>>;
  liveChatTimer: number;
  setLiveChatTimer: React.Dispatch<React.SetStateAction<number>>;
  irSupportTimer: number;
  setIrSupportTimer: React.Dispatch<React.SetStateAction<number>>;

  // Real-time Lists
  liveAgentSessions: LiveAgentSession[];
  liveBreaks?: any[];
  
  token: string | null;
  connectedSpreadsheetId: string | null;
  logActivity: (message: string) => void;
  upsertSessionToFirebase: (activityName: string, statusName: 'available' | 'on_break' | 'offline') => Promise<void>;
  isBreakOverrun: (breakType: string, durationSeconds: number) => boolean;
  getBreakLimitMinutes: (breakType: string) => number;
}

export default function DashboardSection({
  agentName,
  agentId,
  isCheckedIn,
  setIsCheckedIn,
  agentStatus,
  setAgentStatus,
  currentActivity,
  setCurrentActivity,
  isOnBreak,
  setIsOnBreak,
  shiftStartTime,
  setShiftStartTime,
  
  shiftTimer,
  setShiftTimer,
  shortBreakTimer,
  setShortBreakTimer,
  mealBreakTimer,
  setMealBreakTimer,
  prayerBreakTimer,
  setPrayerBreakTimer,
  meetingTimer,
  setMeetingTimer,
  
  inboundTimer,
  setInboundTimer,
  outboundTimer,
  setOutboundTimer,
  liveChatTimer,
  setLiveChatTimer,
  irSupportTimer,
  setIrSupportTimer,

  liveAgentSessions,
  liveBreaks = [],
  
  token,
  connectedSpreadsheetId,
  logActivity,
  upsertSessionToFirebase,
  isBreakOverrun,
  getBreakLimitMinutes
}: DashboardSectionProps) {
  // Private notes storage (with agent isolation)
  const [privateNotes, setPrivateNotes] = useState(() => {
    const saved = localStorage.getItem(`csp_private_notes_${agentId}`);
    return saved || 'Use this persistent private scratchpad to write notes, customer info, or call details. This pad is fully isolated to your login session.';
  });

  const [savingNotes, setSavingNotes] = useState(false);

  // Force live ticker re-renders every second for active timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem(`csp_private_notes_${agentId}`);
    setPrivateNotes(saved || 'Use this persistent private scratchpad to write notes, customer info, or call details. This pad is fully isolated to your login session.');
  }, [agentId]);

  // Save private notes helper
  const handleSaveNotes = (val: string) => {
    setPrivateNotes(val);
    setSavingNotes(true);
    localStorage.setItem(`csp_private_notes_${agentId}`, val);
    setTimeout(() => setSavingNotes(false), 400);
  };

  // Human readable timer formatter
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Action handlers
  const handleCheckIn = async () => {
    const startStr = new Date().toISOString();
    setIsCheckedIn(true);
    setShiftStartTime(startStr);
    setAgentStatus('AVAILABLE');
    setCurrentActivity('available');
    setShiftTimer(0);
    logActivity(`Agent "${agentName}" checked in and clocked duty shift on.`);
    
    // Write directly to Firestore status collection
    await upsertSessionToFirebase('available', 'available');
  };

  const [showClockOffConfirm, setShowClockOffConfirm] = useState(false);

  const handleCheckOut = async () => {
    setShowClockOffConfirm(true);
  };

  const executeCheckOut = async () => {
    setIsCheckedIn(false);
    setShiftStartTime(null);
    setAgentStatus('OFFLINE');
    setCurrentActivity('offline');
    setIsOnBreak(false);
    logActivity(`Agent "${agentName}" checked out and clocked duty shift off.`);
    
    // Write directly to Firestore status collection
    await upsertSessionToFirebase('offline', 'offline');
    setShowClockOffConfirm(false);
  };

  const handleToggleBreak = async (breakType: 'Short Break' | 'Meal Break' | 'Prayer Break' | 'Meeting' | 'Available') => {
    if (!isCheckedIn) return;

    if (breakType === 'Available') {
      setIsOnBreak(false);
      setAgentStatus('AVAILABLE');
      setCurrentActivity('available');
      logActivity(`Agent "${agentName}" returned from break and marked AVAILABLE.`);
      
      await upsertSessionToFirebase('available', 'available');
    } else {
      setIsOnBreak(true);
      setAgentStatus('ON BREAK');
      setCurrentActivity(breakType);
      logActivity(`Agent "${agentName}" went on: ${breakType}.`);
      
      let firestoreStatus: 'on_break' | 'available' = 'on_break';
      await upsertSessionToFirebase(breakType, firestoreStatus);
    }
  };

  // Change active distribution target activity (Inbound, Outbound, Live Chat, IR Support, etc.)
  const handleSetDistributionTarget = async (target: string) => {
    if (!isCheckedIn || isOnBreak) return;
    setCurrentActivity(target);
    logActivity(`Agent "${agentName}" changed active target division to: ${target.toUpperCase()}`);
    
    await upsertSessionToFirebase(target, 'available');
  };

  const handleBreakCardClick = (type: 'Short Break' | 'Meal Break' | 'Prayer Break' | 'Meeting') => {
    if (!isCheckedIn) return;
    if (isOnBreak) {
      if (currentActivity === type) {
        handleToggleBreak('Available');
      }
    } else {
      handleToggleBreak(type);
    }
  };

  return (
    <div className="p-3.5 sm:p-4 space-y-3.5 text-left bg-[#F3F4F6] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 animate-fadeIn font-sans">
      
      {/* WORK DISTRIBUTION */}
      <div className="space-y-2 text-left bg-white dark:bg-slate-900/60 dark:backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 shadow-xs">
        <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">
          Work Distribution
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {[
            { 
              id: 'Inbound Call', 
              label: 'INBOUND', 
              timer: inboundTimer,
              colorClass: 'border-t-emerald-500',
              iconColor: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/5',
              icon: Phone
            },
            { 
              id: 'Outbound Call', 
              label: 'OUTBOUND', 
              timer: outboundTimer,
              colorClass: 'border-t-blue-500',
              iconColor: 'text-blue-500 border-blue-500/30 bg-blue-500/10 dark:bg-blue-500/5',
              icon: PhoneCall
            },
            { 
              id: 'Live Chat', 
              label: 'LIVE CHAT', 
              timer: liveChatTimer,
              colorClass: 'border-t-purple-500',
              iconColor: 'text-purple-500 border-purple-500/30 bg-purple-500/10 dark:bg-purple-500/5',
              icon: MessageSquare
            },
            { 
              id: 'IR Support', 
              label: 'IR SUPPORT', 
              timer: irSupportTimer,
              colorClass: 'border-t-red-500',
              iconColor: 'text-red-500 border-red-500/30 bg-red-500/10 dark:bg-red-500/5',
              icon: AlertCircle
            }
          ].map(channel => {
            const isCurrent = currentActivity === channel.id;
            const IconComponent = channel.icon;
            
            return (
              <button
                key={channel.id}
                onClick={() => handleSetDistributionTarget(channel.id)}
                disabled={!isCheckedIn || isOnBreak}
                className={`group relative overflow-hidden p-3 rounded-lg border transition-all text-left flex items-center justify-between cursor-pointer ${
                  isCurrent 
                    ? 'border-[#6A00D1]/50 bg-[#6A00D1]/5 dark:bg-[#6A00D1]/10 shadow-[0_0_10px_rgba(106,0,209,0.12)] ring-1 ring-[#6A00D1]/30' 
                    : 'border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 hover:bg-slate-100/70 dark:hover:bg-slate-900/60 disabled:opacity-40'
                }`}
                style={{ contentVisibility: 'auto' }}
              >
                <div className="space-y-0.5">
                  <span className={`text-[9px] font-bold tracking-widest block font-sans uppercase ${isCurrent ? 'text-[#6A00D1] dark:text-purple-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {channel.label}
                  </span>
                  <span className={`text-base sm:text-lg font-bold font-mono tracking-tight block ${isCurrent ? 'text-[#6A00D1] dark:text-purple-300' : 'text-slate-400 dark:text-slate-500'}`}>
                    {formatTime(channel.timer)}
                  </span>
                </div>
                
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${isCurrent ? 'text-[#6A00D1] border-[#6A00D1]/30 bg-[#6A00D1]/10' : channel.iconColor}`}>
                  <IconComponent className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* BREAK UTILIZATION */}
      <div className="space-y-2 text-left bg-white dark:bg-slate-900/60 dark:backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-slate-100 dark:border-slate-800/50 pb-2">
          <h3 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest font-sans">
            Break Utilization
          </h3>
          <div className="text-[11px] font-medium font-sans text-slate-500 dark:text-slate-400 flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950/40 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800/80">
            <span>Total Break:</span>
            <span className="font-bold font-mono text-[#6A00D1] dark:text-purple-300 text-xs">
              {formatTime(shortBreakTimer + mealBreakTimer + prayerBreakTimer + meetingTimer)}
            </span>
            <span className="text-slate-400 dark:text-slate-600 font-mono text-[10px]">/ 01:00:00</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-0.5">
          {[
            {
              id: 'Short Break',
              label: 'SHORT BREAK',
              timer: shortBreakTimer,
              limitText: '15m limit',
              colorClass: 'border-t-[#6A00D1]',
              timerColor: 'text-slate-500 dark:text-slate-400',
              activeTimerColor: 'text-[#6A00D1] dark:text-purple-300 font-bold animate-pulse'
            },
            {
              id: 'Meal Break',
              label: 'MEAL BREAK',
              timer: mealBreakTimer,
              limitText: '45m limit',
              colorClass: 'border-t-yellow-500',
              timerColor: 'text-slate-500 dark:text-slate-400',
              activeTimerColor: 'text-yellow-600 dark:text-yellow-400 font-bold animate-pulse'
            },
            {
              id: 'Prayer Break',
              label: 'PRAYER BREAK',
              timer: prayerBreakTimer,
              limitText: '15m limit',
              colorClass: 'border-t-indigo-500',
              timerColor: 'text-slate-500 dark:text-slate-400',
              activeTimerColor: 'text-indigo-600 dark:text-indigo-400 font-bold animate-pulse'
            },
            {
              id: 'Meeting',
              label: 'MEETING / REST',
              timer: meetingTimer,
              limitText: '60m limit',
              colorClass: 'border-t-emerald-500',
              timerColor: 'text-slate-500 dark:text-slate-400',
              activeTimerColor: 'text-emerald-600 dark:text-emerald-400 font-bold animate-pulse'
            }
          ].map(brk => {
            const isCurrent = currentActivity === brk.id;
            
            return (
              <button
                key={brk.id}
                onClick={() => handleBreakCardClick(brk.id as any)}
                disabled={!isCheckedIn || (isOnBreak && currentActivity !== brk.id)}
                className={`group relative overflow-hidden p-3 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/60 backdrop-blur-md border-t-[2.5px] ${brk.colorClass} transition-all text-left flex flex-col justify-between cursor-pointer ${
                  isCurrent 
                    ? 'ring-1 ring-[#6A00D1]/30 bg-[#6A00D1]/5 dark:bg-[#6A00D1]/10 shadow-[0_0_10px_rgba(106,0,209,0.12)]' 
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-900/40 disabled:opacity-40'
                }`}
                style={{ contentVisibility: 'auto' }}
              >
                <span className={`text-[9px] font-bold tracking-widest block font-sans mb-1 uppercase ${isCurrent ? 'text-[#6A00D1] dark:text-purple-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {brk.label}
                </span>
                
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-base sm:text-lg font-bold font-mono tracking-tight ${isCurrent ? brk.activeTimerColor : brk.timerColor}`}>
                    {formatTime(brk.timer)}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500">
                    / {brk.limitText}
                  </span>
                </div>

                {isCurrent && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#6A00D1]/10 text-[#6A00D1] dark:text-purple-300 text-[8px] font-bold font-mono px-1.5 py-0.2 rounded-md uppercase tracking-wider animate-pulse">
                    ACTIVE
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ACTIVE BREAK STATUS OVERLAY BANNER */}
      {isOnBreak && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5 text-left">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <p className="text-xs text-amber-800 dark:text-amber-400 font-sans leading-relaxed">
              You are currently registered on <strong className="uppercase font-mono">{currentActivity}</strong>. Active floor status is marked as <strong className="text-red-500 font-bold">ON BREAK</strong>.
            </p>
          </div>
          <button
            onClick={() => handleToggleBreak('Available')}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Resume Available Status
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* Real-time Live Boards (col-span-8) */}
        <div className="lg:col-span-8 space-y-3.5">
          {/* Live Break Board */}
          <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-xs">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 font-sans border-b border-slate-100 dark:border-slate-800/50 pb-2">
              <Coffee className="w-4 h-4 text-amber-500 animate-pulse" />
              Live Break Board (Active Floor)
            </h4>

            {liveAgentSessions.filter(s => s.status === 'on_break').length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {liveAgentSessions.filter(s => s.status === 'on_break').map((sess, idx) => {
                  const activeBrk = liveBreaks?.find((b: any) => (b.agentId === sess.agentId || b.agentId === sess.id) && b.status === 'active');
                  const durationSec = activeBrk?.startTime
                    ? Math.floor((Date.now() - new Date(activeBrk.startTime).getTime()) / 1000)
                    : Math.floor((Date.now() - new Date(sess.lastActive).getTime()) / 1000);
                  const over = isBreakOverrun(sess.currentActivity, durationSec);

                  return (
                    <div 
                      key={idx} 
                      className={`border rounded-lg p-2.5 flex justify-between items-center transition-all ${
                        over 
                          ? 'border-red-400 bg-red-500/10 animate-pulse text-red-600 dark:text-red-400' 
                          : 'border-slate-200 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-950/40 text-slate-750 dark:text-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5 text-left">
                        <span className="text-xs font-bold font-sans block truncate text-slate-850 dark:text-slate-200">{sess.name}</span>
                        <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block uppercase">{sess.currentActivity.replace('_', ' ')}</span>
                      </div>

                      <div className="text-right space-y-0.5 font-mono shrink-0">
                        <span className="text-xs font-bold block">{formatTime(durationSec)}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500 block uppercase">
                          {over ? 'LIMIT OVERRUN 🚨' : 'COMPLIANT'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3.5 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 dark:text-slate-500 text-xs italic font-serif">
                No floor agents currently on breaks.
              </div>
            )}
          </div>

          {/* Logged-in Agents Status Board */}
          <div className="bg-white dark:bg-slate-900/60 dark:backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-xs">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 font-sans border-b border-slate-100 dark:border-slate-800/50 pb-2">
              <CheckCircle className="w-4 h-4 text-emerald-500 animate-pulse" />
              Online Personnel & Floor Agents Directory
            </h4>

            {liveAgentSessions.filter(s => s.status !== 'offline').length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {liveAgentSessions.filter(s => s.status !== 'offline').map((sess, idx) => (
                  <div key={idx} className="border border-slate-200 dark:border-slate-800/50 bg-slate-55/50 dark:bg-slate-950/40 rounded-lg p-2.5 flex items-center justify-between">
                    <div className="space-y-0.5 text-left">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans block truncate">{sess.name}</span>
                      <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 block uppercase">ID: {sess.agentId || sess.id}</span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                        sess.status === 'on_break'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                          : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'
                      }`}>
                        {sess.status === 'on_break' ? sess.currentActivity : 'On Duty'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3.5 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 dark:text-slate-500 text-xs italic font-serif">
                No floor agents currently logged in online.
              </div>
            )}
          </div>
        </div>

        {/* Private Scratchpad (col-span-4) with full agent isolation */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900/60 dark:backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-xl p-3.5 space-y-2.5 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800/50 pb-2">
            <h4 className="font-bold text-xs text-slate-800 dark:text-slate-100 flex items-center gap-1.5 font-sans">
              <StickyNote className="w-4 h-4 text-[#6A00D1]" />
              Isolated Personal Scratchpad
            </h4>
            {savingNotes && (
              <span className="text-[9px] font-mono text-emerald-500 font-semibold animate-pulse uppercase">SAVED</span>
            )}
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500 text-left leading-snug font-sans">
            Your notes are secured offline in your browser's partition and isolated from other agents.
          </p>

          <textarea
            value={privateNotes}
            onChange={(e) => handleSaveNotes(e.target.value)}
            rows={6}
            className="w-full bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[#6A00D1] focus:ring-1 focus:ring-[#6A00D1] font-sans leading-relaxed shadow-xs"
            placeholder="Write scratch details here..."
          />
        </div>
      </div>

      <ConfirmationModal
        isOpen={showClockOffConfirm}
        title="Clock Off Duty"
        message="Are you sure you want to checkout and clock off? Active timers will halt."
        confirmLabel="Checkout & Clock Off"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={executeCheckOut}
        onCancel={() => setShowClockOffConfirm(false)}
      />
    </div>
  );
}
