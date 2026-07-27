import React, { useState, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, Users, User, ArrowLeft, ArrowRight, 
  Save, RefreshCw, AlertCircle, Edit, CheckCircle, ChevronDown, 
  ListFilter, ExternalLink, ShieldCheck, Search, ChevronUp, Clock,
  Table, FileSpreadsheet, ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, ZAxis, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { RosterDay } from '../types';
import { updateRosterInSheet, fetchRosterFromSheet } from '../workspace';
import { AGENTS_LIST } from '../App';

interface RosterSectionProps {
  token: string | null;
  connectedSpreadsheetId: string | null;
  agentName: string;
  rosterDays: RosterDay[];
  setRosterDays: React.Dispatch<React.SetStateAction<RosterDay[]>>;
  currentRosterYear: number;
  setCurrentRosterYear: React.Dispatch<React.SetStateAction<number>>;
  currentRosterMonth: number;
  setCurrentRosterMonth: React.Dispatch<React.SetStateAction<number>>;
  rosterSeed: number;
  setRosterSeed: React.Dispatch<React.SetStateAction<number>>;
  generateAutoRoster: (year: number, month: number, seed: number) => RosterDay[];
  logActivity: (message: string) => void;
  userRole: 'AGENT' | 'ADMIN';
}

export default function RosterSection({
  token,
  connectedSpreadsheetId,
  agentName,
  rosterDays,
  setRosterDays,
  currentRosterYear,
  setCurrentRosterYear,
  currentRosterMonth,
  setCurrentRosterMonth,
  rosterSeed,
  setRosterSeed,
  generateAutoRoster,
  logActivity,
  userRole
}: RosterSectionProps) {
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  const [filterMode, setFilterMode] = useState<'Whole Team' | 'My Shift'>('Whole Team');
  const [isSaving, setIsSaving] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [saveError, setSaveError] = useState('');

  // Date filter (defaults to empty so full month is visible on load)
  const [calendarDateFilter, setCalendarDateFilter] = useState<string>('');

  // General Roster Search & Pagination states
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');
  const [rosterPage, setRosterPage] = useState(1);
  const rosterPageSize = 14;

  useEffect(() => {
    setRosterPage(1);
  }, [rosterSearchQuery, calendarDateFilter, currentRosterMonth, currentRosterYear]);

  const filteredRosterDays = rosterDays.filter(day => {
    if (calendarDateFilter && day.date !== calendarDateFilter) return false;
    if (!rosterSearchQuery.trim()) return true;
    const q = rosterSearchQuery.toLowerCase().trim();
    if (day.date.toLowerCase().includes(q) || day.dayOfWeek.toLowerCase().includes(q)) return true;
    return Object.values(day.shifts || {}).some(list =>
      Array.isArray(list) && list.some(name => name.toLowerCase().includes(q))
    );
  });

  const totalRosterPages = Math.ceil(filteredRosterDays.length / rosterPageSize) || 1;
  const paginatedRosterDays = filteredRosterDays.slice((rosterPage - 1) * rosterPageSize, rosterPage * rosterPageSize);

  // Selected date for the Shift Inspector (defaults to today's date)
  const [selectedDayDate, setSelectedDayDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Search filter for Agent Lookup
  const [lookupSearch, setLookupSearch] = useState('');
  const [selectedLookupAgent, setSelectedLookupAgent] = useState<string>('');
  const [lookupDate, setLookupDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });
  const [lookupTab, setLookupTab] = useState<'AGENT' | 'DATE'>('AGENT');

  // State for the Monthly Summary Sheet panel
  const [showMonthlySummarySheet, setShowMonthlySummarySheet] = useState(true);
  const [summarySheetTab, setSummarySheetTab] = useState<'OVERVIEW' | 'SPREADSHEET'>('OVERVIEW');

  // Editing state (direct override form)
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [editingDay, setEditingDay] = useState<RosterDay | null>(null);
  const [editForm, setEditForm] = useState<{
    morning: string[];
    standardDay: string[];
    lateDay: string[];
    afternoon: string[];
    evening: string[];
    night: string[];
    off: string[];
  }>({
    morning: [],
    standardDay: [],
    lateDay: [],
    afternoon: [],
    evening: [],
    night: [],
    off: []
  });

  // Set the default selected day when month/year shifts
  useEffect(() => {
    if (rosterDays.length > 0) {
      const matchFilter = rosterDays.find(d => d.date === calendarDateFilter);
      if (matchFilter) {
        setSelectedDayDate(calendarDateFilter);
      } else {
        const today = new Date();
        const yStr = today.getFullYear();
        const mStr = String(today.getMonth() + 1).padStart(2, '0');
        const dStr = String(today.getDate()).padStart(2, '0');
        const todayFormatted = `${yStr}-${mStr}-${dStr}`;
        const todayMatch = rosterDays.find(d => d.date === todayFormatted);
        if (todayMatch) {
          setSelectedDayDate(todayFormatted);
        } else {
          const activeMatch = rosterDays.find(d => d.date === selectedDayDate);
          if (!activeMatch) {
            setSelectedDayDate(rosterDays[0].date);
          }
        }
      }
    }
  }, [currentRosterMonth, currentRosterYear, rosterDays.length, calendarDateFilter]);

  // Synchronize editing form values when selectedDayDate or rosterDays changes
  const activeDay = rosterDays.find(d => d.date === selectedDayDate);

  useEffect(() => {
    if (activeDay) {
      setEditForm({
        morning: activeDay.shifts?.morning || [],
        standardDay: activeDay.shifts?.standardDay || [],
        lateDay: activeDay.shifts?.lateDay || [],
        afternoon: activeDay.shifts?.afternoon || [],
        evening: activeDay.shifts?.evening || [],
        night: activeDay.shifts?.night || [],
        off: activeDay.shifts?.off || []
      });
    }
  }, [selectedDayDate, rosterDays]);

  // Core Shift specifications and target counts
  const SHIFT_TYPES = [
    { key: 'morning', label: 'Morning Shift', time: '07:00 AM', target: 3 },
    { key: 'standardDay', label: 'Standard Day', time: '08:00 AM', target: 5 },
    { key: 'lateDay', label: 'Late Day Shift', time: '10:00 AM', target: 12 },
    { key: 'afternoon', label: 'Afternoon Shift', time: '02:00 PM', target: 8 },
    { key: 'evening', label: 'Evening Shift', time: '05:00 PM', target: 12 },
    { key: 'night', label: 'Night Shift', time: '11:00 PM', target: 2 }
  ];

  // Helper to resolve spreadsheet URL
  const connectedSpreadsheetUrl = connectedSpreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${connectedSpreadsheetId}/edit`
    : 'https://docs.google.com/spreadsheets/d/1uIWNqo9UEV2AENgJuWUPU5mprS2rha4T62eQAFTu360/edit';

  // Compile active data points for the Recharts coverage grid
  const heatmapData = rosterDays.flatMap((day) => {
    const dayParts = day.date.split('-');
    const dayNum = dayParts[2] || day.date;
    const dayVal = parseInt(dayNum, 10) || 1;

    return SHIFT_TYPES.map((shift, yIndex) => {
      const agents = day.shifts?.[shift.key as keyof typeof day.shifts] || [];
      const count = agents.length;
      const target = shift.target;
      const diff = count - target;

      // Map staffing status to high-contrast colors (reds for under-staffed, greens for optimal/surplus)
      let color = '#ef4444'; // critical red
      let statusText = 'Critical: No Coverage';

      if (count === 0) {
        color = '#dc2626'; // deep/dark red
        statusText = 'Critical Under-staffing (0 Staff)';
      } else if (count < target) {
        if (diff === -1) {
          color = '#f97316'; // orange for minor gaps
          statusText = 'Slightly Under-staffed (-1)';
        } else {
          color = '#f43f5e'; // rose for moderate gaps
          statusText = `Under-staffed (${diff})`;
        }
      } else if (count === target) {
        color = '#10b981'; // bright green for exact target match
        statusText = 'Optimal Coverage (Exact Match)';
      } else {
        color = '#047857'; // emerald green for surplus
        statusText = `Optimal (Surplus +${diff})`;
      }

      return {
        dayLabel: dayNum,
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        shiftLabel: shift.label,
        count,
        target,
        diff,
        color,
        statusText,
        agents,
        x: dayVal,
        y: 5 - yIndex // Inverse so Morning is displayed on top (y=5), Night at the bottom (y=0)
      };
    });
  });

  const daysInMonth = rosterDays.length || 31;
  const dayTicks = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const formatYAxis = (tick: number) => {
    const index = 5 - tick;
    return SHIFT_TYPES[index]?.label || '';
  };

  const renderHeatmapCell = (props: any) => {
    const { cx, cy, payload } = props;
    if (cx === undefined || cy === undefined || !payload) return null;
    return (
      <rect
        x={cx - 8}
        y={cy - 8}
        width={16}
        height={16}
        fill={payload.color}
        rx={3}
        stroke={payload.diff < 0 ? '#fee2e2' : '#ecfdf5'}
        strokeWidth={0.5}
        className="transition-all duration-150 hover:scale-130 hover:opacity-90 cursor-pointer origin-center"
      />
    );
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-zinc-950 text-zinc-100 p-3 rounded-xl border border-zinc-850 shadow-2xl max-w-xs text-[11px] space-y-1.5 text-left leading-relaxed">
          <div className="font-bold border-b border-zinc-800 pb-1 text-purple-400">
            {data.date} ({data.dayOfWeek})
          </div>
          <div>
            <span className="text-zinc-400">Shift Category:</span> <span className="font-semibold text-zinc-100">{data.shiftLabel}</span>
          </div>
          <div>
            <span className="text-zinc-400">Current Staff:</span> <span className="font-bold text-white">{data.count}</span> / {data.target} (Target)
          </div>
          <div>
            <span className="text-zinc-400">Coverage Status:</span>{' '}
            <span className={`font-semibold ${data.diff < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {data.statusText}
            </span>
          </div>
          {data.agents.length > 0 && (
            <div className="pt-1.5 border-t border-zinc-800 mt-1">
              <span className="text-[9px] text-zinc-500 font-bold block mb-0.5 uppercase tracking-wider">Assigned Staff:</span>
              <div className="text-[10px] text-zinc-300 font-mono break-words leading-tight max-h-24 overflow-y-auto">
                {data.agents.join(', ')}
              </div>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Month navigation helpers
  const handlePrevMonth = () => {
    let newMonth = currentRosterMonth - 1;
    let newYear = currentRosterYear;
    if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setCurrentRosterMonth(newMonth);
    setCurrentRosterYear(newYear);
    const generated = generateAutoRoster(newYear, newMonth, rosterSeed);
    setRosterDays(generated);

    if (calendarDateFilter) {
      const parts = calendarDateFilter.split('-');
      if (parts.length === 3) {
        const dayPart = parts[2];
        setCalendarDateFilter(`${newYear}-${String(newMonth + 1).padStart(2, '0')}-${dayPart}`);
      }
    }
  };

  const handleNextMonth = () => {
    let newMonth = currentRosterMonth + 1;
    let newYear = currentRosterYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    }
    setCurrentRosterMonth(newMonth);
    setCurrentRosterYear(newYear);
    const generated = generateAutoRoster(newYear, newMonth, rosterSeed);
    setRosterDays(generated);

    if (calendarDateFilter) {
      const parts = calendarDateFilter.split('-');
      if (parts.length === 3) {
        const dayPart = parts[2];
        setCalendarDateFilter(`${newYear}-${String(newMonth + 1).padStart(2, '0')}-${dayPart}`);
      }
    }
  };

  const handleMonthDropdownChange = (mIndex: number) => {
    setCurrentRosterMonth(mIndex);
    const generated = generateAutoRoster(currentRosterYear, mIndex, rosterSeed);
    setRosterDays(generated);

    if (calendarDateFilter) {
      const parts = calendarDateFilter.split('-');
      if (parts.length === 3) {
        const dayPart = parts[2];
        setCalendarDateFilter(`${currentRosterYear}-${String(mIndex + 1).padStart(2, '0')}-${dayPart}`);
      }
    }
  };

  const handleYearDropdownChange = (yearVal: number) => {
    setCurrentRosterYear(yearVal);
    const generated = generateAutoRoster(yearVal, currentRosterMonth, rosterSeed);
    setRosterDays(generated);

    if (calendarDateFilter) {
      const parts = calendarDateFilter.split('-');
      if (parts.length === 3) {
        const dayPart = parts[2];
        setCalendarDateFilter(`${yearVal}-${String(currentRosterMonth + 1).padStart(2, '0')}-${dayPart}`);
      }
    }
  };

  // Shuffling & seed modifiers
  const handleRegenerate = () => {
    const nextSeed = rosterSeed + 1;
    setRosterSeed(nextSeed);
    localStorage.setItem('csp_roster_seed', String(nextSeed));
    const generated = generateAutoRoster(currentRosterYear, currentRosterMonth, nextSeed);
    setRosterDays(generated);
    logActivity(`Regenerated team schedule with layout seed ${nextSeed}`);
  };

  const handleResetBaseline = () => {
    setRosterSeed(0);
    localStorage.setItem('csp_roster_seed', '0');
    const generated = generateAutoRoster(currentRosterYear, currentRosterMonth, 0);
    setRosterDays(generated);
    logActivity(`Reset schedule configuration baseline to Seed 0`);
  };

  // Google Sheet synchronizers
  const handleSaveToSheet = async () => {
    if (!token || !connectedSpreadsheetId) {
      setSaveError('⚠️ Google spreadsheet is not connected. Connect via Top-Bar Google Auth to sync to the cloud. (Your schedule edits remain cached locally in your browser).');
      return;
    }

    setIsSaving(true);
    setSaveSuccess('');
    setSaveError('');

    try {
      const monthLabel = `${months[currentRosterMonth]} ${currentRosterYear}`;
      await updateRosterInSheet(token, connectedSpreadsheetId, rosterDays, monthLabel);
      setSaveSuccess(`Successfully synchronized monthly roster back to connected spreadsheet!`);
      logActivity(`Synchronized team roster for ${months[currentRosterMonth]} ${currentRosterYear} back to connected sheet.`);
    } catch (err: any) {
      console.warn("Roster sheets save failed:", err);
      setSaveError(`⚠️ Google Sheets synchronization error: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePullFromSheet = async () => {
    if (!token || !connectedSpreadsheetId) {
      setSaveError('⚠️ Google Spreadsheet not connected. Please login and link a sheet.');
      return;
    }
    setIsPulling(true);
    setSaveSuccess('');
    setSaveError('');
    try {
      const syncedDays = await fetchRosterFromSheet(token, connectedSpreadsheetId);
      if (syncedDays && syncedDays.length > 0) {
        setRosterDays(syncedDays);
        logActivity("Manually synchronized team roster from Google Sheet.");
        setSaveSuccess("Successfully synchronized latest roster from Google Sheet!");
      }
    } catch (err: any) {
      console.error(err);
      setSaveError(`Failed to pull roster: ${err.message || err}`);
    } finally {
      setIsPulling(false);
    }
  };

  // Direct edit save handler
  const handleSaveDirectOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDayDate) return;

    const updatedRoster = rosterDays.map(d => {
      if (d.date === selectedDayDate) {
        return {
          ...d,
          shifts: {
            morning: editForm.morning,
            standardDay: editForm.standardDay,
            lateDay: editForm.lateDay,
            afternoon: editForm.afternoon,
            evening: editForm.evening,
            night: editForm.night,
            off: editForm.off
          }
        };
      }
      return d;
    });

    setRosterDays(updatedRoster);
    logActivity(`Manually adjusted shift override parameters for ${selectedDayDate}`);
    setSaveSuccess(`Direct shift edits for ${selectedDayDate} successfully applied!`);
    setShowOverrideForm(false);
  };

  const handleAddAgentToShift = (shiftKey: string, nameToAdd: string) => {
    if (!selectedDayDate || !nameToAdd) return;

    const updatedRoster = rosterDays.map(d => {
      if (d.date === selectedDayDate) {
        const shifts = { ...d.shifts };
        
        // 1. Remove agent from any existing shifts or off duty on this day
        Object.keys(shifts).forEach(key => {
          const arr = shifts[key as keyof typeof shifts] || [];
          if (arr.includes(nameToAdd)) {
            shifts[key as keyof typeof shifts] = arr.filter(n => n !== nameToAdd);
          }
        });

        // 2. Add to target shift
        const targetArr = shifts[shiftKey as keyof typeof shifts] || [];
        if (!targetArr.includes(nameToAdd)) {
          shifts[shiftKey as keyof typeof shifts] = [...targetArr, nameToAdd];
        }

        return { ...d, shifts };
      }
      return d;
    });

    setRosterDays(updatedRoster);
    logActivity(`Manually added agent "${nameToAdd}" to "${shiftKey}" on ${selectedDayDate}`);
    setSaveSuccess(`Successfully added ${nameToAdd} to ${shiftKey} shift!`);
    setSaveError('');
  };

  const handleRemoveAgentFromShift = (shiftKey: string, nameToRemove: string) => {
    if (!selectedDayDate || !nameToRemove) return;

    const updatedRoster = rosterDays.map(d => {
      if (d.date === selectedDayDate) {
        const shifts = { ...d.shifts };
        
        // Remove from current shift
        const targetArr = shifts[shiftKey as keyof typeof shifts] || [];
        shifts[shiftKey as keyof typeof shifts] = targetArr.filter(n => n !== nameToRemove);

        // Auto move to 'off' duty
        const offArr = shifts.off || [];
        if (!offArr.includes(nameToRemove)) {
          shifts.off = [...offArr, nameToRemove];
        }

        return { ...d, shifts };
      }
      return d;
    });

    setRosterDays(updatedRoster);
    logActivity(`Manually removed agent "${nameToRemove}" from "${shiftKey}" on ${selectedDayDate}`);
    setSaveSuccess(`Successfully removed ${nameToRemove} and marked as Off Duty.`);
    setSaveError('');
  };

  const isAgentAssignedOnDate = (names: string[] | undefined) => {
    if (!names) return false;
    return names.some(n => n.toLowerCase().trim() === agentName.toLowerCase().trim());
  };

  // Calculate first day weekday padding for 7-column grid
  const getFirstDayPadding = () => {
    if (rosterDays.length === 0) return 0;
    const firstDateStr = `${currentRosterYear}-${String(currentRosterMonth + 1).padStart(2, '0')}-01`;
    const d = new Date(firstDateStr);
    return isNaN(d.getTime()) ? 0 : d.getDay();
  };

  const paddingDays = getFirstDayPadding();
  const calendarDaysList = Array.from({ length: paddingDays }, (_, i) => null);

  // Dynamic auditor details (shift counts per agent)
  const agentShiftAnalytics = AGENTS_LIST.map(agent => {
    let totalShifts = 0;
    rosterDays.forEach(day => {
      const allShifts = Object.entries(day.shifts || {});
      allShifts.forEach(([key, list]) => {
        if (key !== 'off' && Array.isArray(list) && list.includes(agent.name)) {
          totalShifts++;
        }
      });
    });
    return {
      name: agent.name,
      isMale: agent.isMale,
      shifts: totalShifts,
      hours: totalShifts * 8
    };
  }).sort((a, b) => b.shifts - a.shifts);

  // Calculate day metrics
  const getDayTotalStaffCount = (day: RosterDay) => {
    if (!day.shifts) return 0;
    return Object.entries(day.shifts)
      .filter(([key]) => key !== 'off')
      .reduce((sum, [_, arr]) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  };

  return (
    <div className="p-6 space-y-6 text-left bg-[#080c14] text-slate-100 animate-fadeIn font-sans min-h-screen">
      
      {/* Upper Grid Layout: Left calendar parameters & Right Inspector Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Column: Calendar Header & Grid Matrix */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Main Controls Header Block */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-purple-400 tracking-tight flex items-center gap-2 font-serif uppercase">
                  <CalendarIcon className="w-5 h-5 text-purple-500 animate-pulse" />
                  ALL-DAY ROSTER (24/7)
                </h2>
                <p className="text-xs text-zinc-400">
                  Fair dynamic shuffling & shift auditing for 45 agents across the full month.
                </p>
              </div>

              {/* Year, Month and View Mode Selectors */}
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={currentRosterYear}
                  onChange={(e) => handleYearDropdownChange(Number(e.target.value))}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                  <option value={2028}>2028</option>
                </select>

                <select
                  value={currentRosterMonth}
                  onChange={(e) => handleMonthDropdownChange(Number(e.target.value))}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-medium"
                >
                  {months.map((m, i) => (
                    <option key={m} value={i}>{m}</option>
                  ))}
                </select>

                {/* View Mode Toggle: Grid vs List */}
                <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode('GRID')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      viewMode === 'GRID'
                        ? 'bg-zinc-800 text-purple-400 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-350'
                    }`}
                  >
                    Grid
                  </button>
                  <button
                    onClick={() => setViewMode('LIST')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      viewMode === 'LIST'
                        ? 'bg-zinc-800 text-purple-400 shadow-xs'
                        : 'text-zinc-500 hover:text-zinc-350'
                    }`}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>

            {/* Date Search & Filter Section */}
            <div className="pt-3 border-t border-zinc-800/60 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-purple-500 animate-pulse" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300">
                  Focus Calendar Date:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                <input
                  type="date"
                  value={calendarDateFilter}
                  onChange={(e) => {
                    const selectedVal = e.target.value;
                    setCalendarDateFilter(selectedVal);
                    // Automatically select this day in Shift Inspector if found
                    if (selectedVal) {
                      const matched = rosterDays.find(d => d.date === selectedVal);
                      if (matched) {
                        setSelectedDayDate(selectedVal);
                        // Extract year and month to sync dropdowns
                        const parts = selectedVal.split('-');
                        if (parts.length === 3) {
                          const yVal = parseInt(parts[0], 10);
                          const mIndex = parseInt(parts[1], 10) - 1;
                          if (yVal !== currentRosterYear) {
                            setCurrentRosterYear(yVal);
                          }
                          if (mIndex !== currentRosterMonth) {
                            setCurrentRosterMonth(mIndex);
                          }
                        }
                      }
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono font-semibold cursor-pointer w-full sm:w-44"
                />
                
                {/* Text search fallback for typing day */}
                <input
                  type="text"
                  placeholder="Or type day (e.g. 20)"
                  value={calendarDateFilter.split('-')[2] || ''}
                  onChange={(e) => {
                    const dayInput = e.target.value.trim();
                    if (!dayInput) {
                      setCalendarDateFilter('');
                      return;
                    }
                    const num = parseInt(dayInput, 10);
                    if (!isNaN(num) && num >= 1 && num <= 31) {
                      const padDay = String(num).padStart(2, '0');
                      const yearStr = currentRosterYear;
                      const monthStr = String(currentRosterMonth + 1).padStart(2, '0');
                      const fullDate = `${yearStr}-${monthStr}-${padDay}`;
                      setCalendarDateFilter(fullDate);
                      
                      const matched = rosterDays.find(d => d.date === fullDate);
                      if (matched) {
                        setSelectedDayDate(fullDate);
                      }
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono w-full sm:w-36"
                />

                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    const y = today.getFullYear();
                    const m = String(today.getMonth() + 1).padStart(2, '0');
                    const d = String(today.getDate()).padStart(2, '0');
                    const todayStr = `${y}-${m}-${d}`;
                    setCalendarDateFilter(todayStr);
                    setCurrentRosterYear(y);
                    setCurrentRosterMonth(today.getMonth());
                    setSelectedDayDate(todayStr);
                  }}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-purple-400 hover:text-purple-300 font-mono text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  title="Reset calendar filter to current local date"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCalendarDateFilter('');
                    setRosterSearchQuery('');
                  }}
                  className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-200 font-mono text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                  title="Show all days of the month"
                >
                  Show All
                </button>
              </div>
            </div>

            {/* General Roster Search + Pagination Bar */}
            <div className="pt-3 border-t border-zinc-800/60 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-purple-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search staff member, shift, or date in roster..."
                  value={rosterSearchQuery}
                  onChange={(e) => setRosterSearchQuery(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between sm:justify-end gap-3 font-mono text-xs text-zinc-400">
                <span className="text-[11px]">
                  Showing <strong className="text-zinc-200">{filteredRosterDays.length}</strong> days (Page <strong className="text-purple-400">{rosterPage}</strong> of {totalRosterPages})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setRosterPage(p => Math.max(1, p - 1))}
                    disabled={rosterPage <= 1}
                    className="p-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Previous Page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRosterPage(p => Math.min(totalRosterPages, p + 1))}
                    disabled={rosterPage >= totalRosterPages}
                    className="p-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed transition-all"
                    title="Next Page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Rotation Info Line */}
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Rotation Seed: <span className="text-purple-400 font-bold">{rosterSeed}</span> (Deterministically balanced)</span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-1 border-t border-zinc-800/60">
              <button
                onClick={handleResetBaseline}
                className="px-3.5 py-2 border border-zinc-800 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 font-mono text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Reset Baseline
              </button>
              <button
                onClick={handleRegenerate}
                className="px-3.5 py-2 border border-zinc-800 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-100 font-mono text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-zinc-500" />
                Auto-Shuffle Month
              </button>
              <button
                onClick={handleSaveToSheet}
                disabled={isSaving}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-mono text-[10px] uppercase tracking-wider rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Syncing...' : 'Export Monthly Roster'}
              </button>
            </div>
          </div>

          {/* Alert notifications */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-900/80 text-emerald-400 text-xs rounded-xl flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 shrink-0" />
              {saveSuccess}
            </div>
          )}

          {saveError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/80 text-rose-400 text-xs rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {saveError}
            </div>
          )}

          {/* MONTHLY SHIFT SUMMARY SHEET (AUTO VIEW) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Header */}
            <div className="bg-zinc-950/80 border-b border-zinc-850 px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-purple-500 animate-pulse" />
                <div>
                  <h3 className="font-bold text-sm text-zinc-100 uppercase tracking-wider font-serif">
                    Monthly Shift Auto-Sheet ({months[currentRosterMonth]} {currentRosterYear})
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Real-time automatic spreadsheet tracking overall distribution & duty totals
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
                <div className="flex bg-zinc-900 border border-zinc-800 p-0.5 rounded-lg text-[9px] font-mono">
                  <button
                    type="button"
                    onClick={() => setSummarySheetTab('OVERVIEW')}
                    className={`px-3 py-1 rounded-md font-bold uppercase transition-all cursor-pointer ${
                      summarySheetTab === 'OVERVIEW'
                        ? 'bg-purple-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Metrics Table
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummarySheetTab('SPREADSHEET')}
                    className={`px-3 py-1 rounded-md font-bold uppercase transition-all cursor-pointer ${
                      summarySheetTab === 'SPREADSHEET'
                        ? 'bg-purple-600 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Spreadsheet Grid
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowMonthlySummarySheet(!showMonthlySummarySheet)}
                  className="p-1 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-all cursor-pointer"
                  title={showMonthlySummarySheet ? "Collapse summary sheet" : "Expand summary sheet"}
                >
                  {showMonthlySummarySheet ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Content Area */}
            {showMonthlySummarySheet && (
              <div className="p-5 space-y-4">
                {summarySheetTab === 'OVERVIEW' ? (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Summary table showing dynamic shift targets vs scheduled totals across all <span className="text-purple-400 font-bold">{rosterDays.length} days</span> of {months[currentRosterMonth]}.
                    </p>

                    <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-zinc-950/80 border-b border-zinc-850 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                            <th className="p-3">Shift Category</th>
                            <th className="p-3">Daily Target</th>
                            <th className="p-3">Month Target</th>
                            <th className="p-3">Month Scheduled</th>
                            <th className="p-3">Coverage Health</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900">
                          {(() => {
                            const monthlyTotals = {
                              morning: 0,
                              standardDay: 0,
                              lateDay: 0,
                              afternoon: 0,
                              evening: 0,
                              night: 0,
                              off: 0
                            };

                            rosterDays.forEach(day => {
                              if (day.shifts) {
                                monthlyTotals.morning += day.shifts.morning?.length || 0;
                                monthlyTotals.standardDay += day.shifts.standardDay?.length || 0;
                                monthlyTotals.lateDay += day.shifts.lateDay?.length || 0;
                                monthlyTotals.afternoon += day.shifts.afternoon?.length || 0;
                                monthlyTotals.evening += day.shifts.evening?.length || 0;
                                monthlyTotals.night += day.shifts.night?.length || 0;
                                monthlyTotals.off += day.shifts.off?.length || 0;
                              }
                            });

                            const totalDays = rosterDays.length || 30;

                            return (
                              <>
                                {SHIFT_TYPES.map((st) => {
                                  const actualTotal = monthlyTotals[st.key as keyof typeof monthlyTotals] || 0;
                                  const targetTotal = st.target * totalDays;
                                  const percent = targetTotal > 0 ? Math.round((actualTotal / targetTotal) * 100) : 100;
                                  
                                  let colorClass = 'text-emerald-400 bg-emerald-950/20 border border-emerald-900/40';
                                  let barColor = 'bg-emerald-500';
                                  let statusText = 'Optimal';
                                  if (percent < 90) {
                                    colorClass = 'text-rose-400 bg-rose-950/20 border border-rose-900/40';
                                    barColor = 'bg-rose-500';
                                    statusText = 'Under-staffed';
                                  } else if (percent < 100) {
                                    colorClass = 'text-purple-400 bg-purple-950/20 border border-purple-900/40';
                                    barColor = 'bg-purple-500';
                                    statusText = 'Adequate';
                                  }

                                  return (
                                    <tr key={st.key} className="hover:bg-zinc-900/40 transition-colors">
                                      <td className="p-3 font-medium text-zinc-150">
                                        <div className="flex items-center gap-2">
                                          <span className={`inline-block w-2 h-2 rounded-full ${
                                            st.key === 'morning' ? 'bg-purple-400' :
                                            st.key === 'standardDay' ? 'bg-sky-400' :
                                            st.key === 'lateDay' ? 'bg-indigo-400' :
                                            st.key === 'afternoon' ? 'bg-emerald-400' :
                                            st.key === 'evening' ? 'bg-orange-400' : 'bg-rose-400'
                                          }`} />
                                          <span>{st.label}</span>
                                          <span className="text-[9px] text-zinc-500 font-mono">({st.time})</span>
                                        </div>
                                      </td>
                                      <td className="p-3 font-mono font-bold text-zinc-300">{st.target}</td>
                                      <td className="p-3 font-mono text-zinc-400">{targetTotal}</td>
                                      <td className="p-3 font-mono">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-zinc-200">{actualTotal}</span>
                                          <div className="w-16 bg-zinc-950 h-1.5 rounded-full overflow-hidden hidden sm:block border border-zinc-800">
                                            <div className={`h-full ${barColor}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                                          </div>
                                          <span className="text-[10px] text-zinc-500">({percent}%)</span>
                                        </div>
                                      </td>
                                      <td className="p-3">
                                        <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${colorClass}`}>
                                          {statusText}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}

                                <tr className="bg-zinc-950/20 hover:bg-zinc-900/40 transition-colors">
                                  <td className="p-3 font-medium text-zinc-400">
                                    <div className="flex items-center gap-2">
                                      <span className="inline-block w-2 h-2 rounded-full bg-zinc-600" />
                                      <span>Off Duty / Rest Days</span>
                                      <span className="text-[9px] text-zinc-600 font-mono">(Rest period)</span>
                                    </div>
                                  </td>
                                  <td className="p-3 font-mono text-zinc-500">-</td>
                                  <td className="p-3 font-mono text-zinc-500">-</td>
                                  <td className="p-3 font-mono text-zinc-400">
                                    <span className="font-bold">{monthlyTotals.off}</span> days off total
                                  </td>
                                  <td className="p-3">
                                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase bg-zinc-900 text-zinc-500 border border-zinc-800">
                                      Rest Period
                                    </span>
                                  </td>
                                </tr>
                              </>
                            );
                          })()}
                        </tbody>
                        <tfoot>
                          {(() => {
                            const monthlyTotals = {
                              morning: 0,
                              standardDay: 0,
                              lateDay: 0,
                              afternoon: 0,
                              evening: 0,
                              night: 0
                            };

                            rosterDays.forEach(day => {
                              if (day.shifts) {
                                monthlyTotals.morning += day.shifts.morning?.length || 0;
                                monthlyTotals.standardDay += day.shifts.standardDay?.length || 0;
                                monthlyTotals.lateDay += day.shifts.lateDay?.length || 0;
                                monthlyTotals.afternoon += day.shifts.afternoon?.length || 0;
                                monthlyTotals.evening += day.shifts.evening?.length || 0;
                                monthlyTotals.night += day.shifts.night?.length || 0;
                              }
                            });

                            const totalScheduled = Object.values(monthlyTotals).reduce((sum, count) => sum + count, 0);
                            const dailyTargetSum = SHIFT_TYPES.reduce((sum, st) => sum + st.target, 0);
                            const totalTarget = dailyTargetSum * rosterDays.length;

                            return (
                              <tr className="bg-zinc-950 border-t border-zinc-800 font-bold">
                                <td className="p-3 text-zinc-350 font-serif uppercase text-[10px] tracking-wider">TOTAL SHIFTS</td>
                                <td className="p-3 font-mono text-zinc-300">{dailyTargetSum}/day</td>
                                <td className="p-3 font-mono text-zinc-400">{totalTarget}</td>
                                <td className="p-3 font-mono text-purple-400" colSpan={2}>
                                  {totalScheduled} assignments scheduled
                                </td>
                              </tr>
                            );
                          })()}
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Google Sheets style pivot matrix. Every calendar day mapped to its exact scheduled shift sizes. Click on any row to jump to that day in the main focus views.
                    </p>

                    <div className="overflow-x-auto border border-zinc-800 rounded-xl bg-zinc-950/40 max-h-96">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-zinc-950 z-10 border-b border-zinc-850">
                          <tr className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                            <th className="p-2.5 border-r border-zinc-850 sticky left-0 bg-zinc-950">Day</th>
                            <th className="p-2.5 text-center text-purple-400 border-r border-zinc-850/60">Morning (M)</th>
                            <th className="p-2.5 text-center text-sky-400 border-r border-zinc-850/60">Standard (D)</th>
                            <th className="p-2.5 text-center text-indigo-400 border-r border-zinc-850/60">Late Shift (L)</th>
                            <th className="p-2.5 text-center text-emerald-400 border-r border-zinc-850/60">Afternoon (A)</th>
                            <th className="p-2.5 text-center text-orange-400 border-r border-zinc-850/60">Evening (E)</th>
                            <th className="p-2.5 text-center text-rose-400 border-r border-zinc-850/60">Night (N)</th>
                            <th className="p-2.5 text-center text-zinc-500 border-r border-zinc-850/60">Off</th>
                            <th className="p-2.5 text-center text-emerald-500 font-bold">Total Staff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900/60 font-mono text-center">
                          {rosterDays.map((day) => {
                            const dayNum = parseInt(day.date.split('-')[2], 10);
                            const totalStaff = getDayTotalStaffCount(day);
                            const isSelected = selectedDayDate === day.date;

                            return (
                              <tr 
                                key={day.date} 
                                onClick={() => setSelectedDayDate(day.date)}
                                className={`hover:bg-zinc-900/85 transition-colors cursor-pointer group ${
                                  isSelected ? 'bg-purple-950/20 text-purple-300' : ''
                                }`}
                              >
                                <td className={`p-2 border-r border-zinc-850 text-left font-bold sticky left-0 z-5 transition-colors ${
                                  isSelected ? 'bg-purple-950/30 text-purple-400' : 'bg-zinc-950 text-zinc-300'
                                }`}>
                                  <div className="flex justify-between items-center gap-1.5 px-0.5">
                                    <span>#{dayNum}</span>
                                    <span className="text-[9px] text-zinc-500 font-normal uppercase tracking-tighter">{day.dayOfWeek}</span>
                                  </div>
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-350">
                                  {day.shifts?.morning?.length || 0}
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-350">
                                  {day.shifts?.standardDay?.length || 0}
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-350">
                                  {day.shifts?.lateDay?.length || 0}
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-350">
                                  {day.shifts?.afternoon?.length || 0}
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-350">
                                  {day.shifts?.evening?.length || 0}
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-350">
                                  {day.shifts?.night?.length || 0}
                                </td>
                                <td className="p-2 border-r border-zinc-850/30 text-zinc-500">
                                  {day.shifts?.off?.length || 0}
                                </td>
                                <td className={`p-2 font-bold ${
                                  totalStaff >= 42 ? 'text-emerald-400' : 'text-purple-400'
                                }`}>
                                  {totalStaff}
                                </td>
                              </tr>
                            );
                          })}

                          {/* Summary Totals Row at Bottom of spreadsheet */}
                          {(() => {
                            const monthlyTotals = {
                              morning: 0,
                              standardDay: 0,
                              lateDay: 0,
                              afternoon: 0,
                              evening: 0,
                              night: 0,
                              off: 0
                            };

                            rosterDays.forEach(day => {
                              if (day.shifts) {
                                monthlyTotals.morning += day.shifts.morning?.length || 0;
                                monthlyTotals.standardDay += day.shifts.standardDay?.length || 0;
                                monthlyTotals.lateDay += day.shifts.lateDay?.length || 0;
                                monthlyTotals.afternoon += day.shifts.afternoon?.length || 0;
                                monthlyTotals.evening += day.shifts.evening?.length || 0;
                                monthlyTotals.night += day.shifts.night?.length || 0;
                                monthlyTotals.off += day.shifts.off?.length || 0;
                              }
                            });

                            const totalScheduled = 
                              monthlyTotals.morning + 
                              monthlyTotals.standardDay + 
                              monthlyTotals.lateDay + 
                              monthlyTotals.afternoon + 
                              monthlyTotals.evening + 
                              monthlyTotals.night;

                            return (
                              <tr className="bg-zinc-950 font-bold text-center border-t-2 border-zinc-800 sticky bottom-0 z-10 text-xs">
                                <td className="p-2.5 border-r border-zinc-800 text-left sticky left-0 bg-zinc-950 text-purple-400 uppercase tracking-tight font-serif text-[10px]">
                                  MONTH TOTAL
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-purple-300 font-bold bg-zinc-900/20">
                                  {monthlyTotals.morning}
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-sky-400 font-bold bg-zinc-900/20">
                                  {monthlyTotals.standardDay}
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-indigo-400 font-bold bg-zinc-900/20">
                                  {monthlyTotals.lateDay}
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-emerald-400 font-bold bg-zinc-900/20">
                                  {monthlyTotals.afternoon}
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-orange-400 font-bold bg-zinc-900/20">
                                  {monthlyTotals.evening}
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-rose-400 font-bold bg-zinc-900/20">
                                  {monthlyTotals.night}
                                </td>
                                <td className="p-2.5 border-r border-zinc-850/60 text-zinc-500 font-bold bg-zinc-900/20">
                                  {monthlyTotals.off}
                                </td>
                                <td className="p-2.5 text-emerald-400 font-extrabold text-sm bg-zinc-950">
                                  {totalScheduled}
                                </td>
                              </tr>
                            );
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Calendar Grid View Mode */}
          {viewMode === 'GRID' && (
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              
              {/* Day Headers (Sun - Sat) */}
              <div className="grid grid-cols-7 gap-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-wider py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day Blocks */}
              <div className="grid grid-cols-7 gap-2">
                
                {/* Padding cells */}
                {calendarDaysList.map((_, i) => (
                  <div key={`pad-${i}`} className="aspect-square bg-zinc-950/20 border border-dashed border-zinc-850/40 rounded-xl opacity-30"></div>
                ))}

                {/* Actual day cells */}
                {paginatedRosterDays.map((day) => {
                  const isMyOffDay = isAgentAssignedOnDate(day.shifts?.off);
                  const isMyDay = 
                    isAgentAssignedOnDate(day.shifts?.morning) ||
                    isAgentAssignedOnDate(day.shifts?.standardDay) ||
                    isAgentAssignedOnDate(day.shifts?.lateDay) ||
                    isAgentAssignedOnDate(day.shifts?.afternoon) ||
                    isAgentAssignedOnDate(day.shifts?.evening) ||
                    isAgentAssignedOnDate(day.shifts?.night);

                  const dayNum = day.date.split('-')[2] || day.date;
                  const totalStaff = getDayTotalStaffCount(day);
                  const isSelected = selectedDayDate === day.date;
                  const isFocused = calendarDateFilter && calendarDateFilter === day.date;

                  // Highlighting conditions: My shifts, selected, or filtered matching
                  const isHighlightedByLookup = lookupSearch && Object.values(day.shifts || {}).some(
                    arr => Array.isArray(arr) && arr.some(name => name.toLowerCase().includes(lookupSearch.toLowerCase()))
                  );

                  let borderClass = 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/60';
                  if (isSelected || isFocused) {
                    borderClass = 'border-purple-500 bg-purple-950/20 ring-2 ring-purple-500 shadow-[0_0_15px_rgba(106,0,209,0.2)]';
                  } else if (isHighlightedByLookup) {
                    borderClass = 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500';
                  } else if (isMyDay && filterMode === 'My Shift') {
                    borderClass = 'border-emerald-500 bg-emerald-950/10';
                  }

                  return (
                    <button
                      key={day.date}
                      type="button"
                      onClick={() => setSelectedDayDate(day.date)}
                      className={`min-h-[125px] border rounded-xl p-2.5 flex flex-col justify-between text-left transition-all relative overflow-hidden cursor-pointer group hover:scale-[1.02] ${borderClass} ${isFocused ? 'animate-pulse' : ''}`}
                    >
                      {/* Top bar with day index & day of week badge */}
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-bold text-zinc-100 group-hover:text-purple-400 transition-colors font-mono">{parseInt(dayNum, 10)}</span>
                        <span className="text-[8px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded text-right tracking-tight">{day.dayOfWeek}</span>
                      </div>

                      {/* Content details inside block */}
                      <div className="space-y-1.5 w-full">
                        <div className="flex justify-between items-center text-[8px] font-mono font-semibold tracking-wider text-zinc-400 uppercase">
                          <span>Coverage</span>
                          <span className="font-bold text-emerald-400">{totalStaff} Staff</span>
                        </div>

                        {/* Mini shift breakdown count matrix */}
                        <div className="grid grid-cols-3 gap-1 pt-1.5 border-t border-zinc-800/60 text-[9px] font-mono">
                          <div className="flex justify-between items-center bg-zinc-900/50 px-1 py-0.5 rounded border border-zinc-800/40" title="Morning Shift">
                            <span className="text-purple-400 font-bold">M</span>
                            <span className="text-zinc-200 font-semibold">{day.shifts?.morning?.length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-900/50 px-1 py-0.5 rounded border border-zinc-800/40" title="Standard Day">
                            <span className="text-sky-400 font-bold">D</span>
                            <span className="text-zinc-200 font-semibold">{day.shifts?.standardDay?.length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-900/50 px-1 py-0.5 rounded border border-zinc-800/40" title="Late Day Shift">
                            <span className="text-indigo-400 font-bold">L</span>
                            <span className="text-zinc-200 font-semibold">{day.shifts?.lateDay?.length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-900/50 px-1 py-0.5 rounded border border-zinc-800/40" title="Afternoon Shift">
                            <span className="text-emerald-400 font-bold">A</span>
                            <span className="text-zinc-200 font-semibold">{day.shifts?.afternoon?.length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-900/50 px-1 py-0.5 rounded border border-zinc-800/40" title="Evening Shift">
                            <span className="text-orange-400 font-bold">E</span>
                            <span className="text-zinc-200 font-semibold">{day.shifts?.evening?.length || 0}</span>
                          </div>
                          <div className="flex justify-between items-center bg-zinc-900/50 px-1 py-0.5 rounded border border-zinc-800/40" title="Night Shift">
                            <span className="text-rose-400 font-bold">N</span>
                            <span className="text-zinc-200 font-semibold">{day.shifts?.night?.length || 0}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View Mode */}
          {viewMode === 'LIST' && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3.5 max-h-[580px] overflow-y-auto">
              {paginatedRosterDays.map((day) => {
                  const totalStaff = getDayTotalStaffCount(day);
                  const isSelected = selectedDayDate === day.date;
                  return (
                    <div
                      key={day.date}
                      onClick={() => setSelectedDayDate(day.date)}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${
                        isSelected 
                          ? 'bg-purple-950/20 border-purple-500/80 ring-1 ring-purple-500' 
                          : 'bg-zinc-950/50 border-zinc-850 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-800 flex flex-col justify-center items-center text-center">
                          <span className="text-[9px] font-mono text-zinc-500 leading-none uppercase">{day.dayOfWeek}</span>
                          <span className="text-sm font-bold font-mono text-white mt-0.5">{day.date.split('-')[2]}</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-xs text-zinc-100">{day.date}</h4>
                          <p className="text-[10px] text-zinc-500 font-mono">Shift metrics active across all operational columns</p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-emerald-400 block uppercase tracking-wider">Total Headcount</span>
                        <span className="text-xs font-mono font-bold text-white">{totalStaff} / 45 Staff</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

        </div>

        {/* Right Column: Dynamic Shift Inspector */}
        <div className="space-y-6">
          
          {/* Main Inspector Panel */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            
            {/* Header Title with weekday badge */}
            <div className="flex justify-between items-center border-b border-zinc-850 pb-3">
              <div>
                <h3 className="font-bold text-sm text-zinc-100 tracking-tight font-serif uppercase">
                  Shift Inspector
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Date: <span className="font-mono text-zinc-300 font-semibold">{selectedDayDate}</span>
                </p>
              </div>
              
              <span className="bg-zinc-950 text-purple-400 font-mono text-[10px] font-bold px-2.5 py-1 rounded-lg border border-zinc-800 tracking-wider">
                {activeDay?.dayOfWeek || 'DAY'}
              </span>
            </div>

            {/* SELECT CALENDAR DATE custom card selector */}
            <div className="bg-zinc-950 border border-zinc-850/80 p-3.5 rounded-xl space-y-1.5 text-left">
              <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block font-mono">
                Select Calendar Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedDayDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      setSelectedDayDate(val);
                      // Auto switch year and month state if year/month changed
                      const dateParts = val.split('-');
                      const yr = parseInt(dateParts[0], 10);
                      const mn = parseInt(dateParts[1], 10) - 1;
                      if (!isNaN(yr) && yr !== currentRosterYear) setCurrentRosterYear(yr);
                      if (!isNaN(mn) && mn !== currentRosterMonth) setCurrentRosterMonth(mn);
                    }
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono tracking-tight cursor-pointer"
                />
              </div>
            </div>

            {/* Cloud API Sheet sync feedback */}
            <div className="flex items-center justify-between bg-zinc-950/65 p-3 rounded-xl border border-zinc-850 text-[10px]">
              <div className="flex items-center gap-1.5 font-mono">
                <span className={`w-2 h-2 rounded-full ${token && connectedSpreadsheetId ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className="text-zinc-400 font-bold">
                  {token && connectedSpreadsheetId ? 'Google Sheet Connected' : 'Workspace API Offline'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={connectedSpreadsheetUrl}
                  target="_blank"
                  rel="noreferrer referrerPolicy"
                  className="text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-0.5 font-medium shrink-0"
                >
                  View Sheet
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <button
              onClick={handlePullFromSheet}
              disabled={isPulling}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-950 hover:bg-zinc-850 text-zinc-300 font-mono font-bold text-[10px] uppercase tracking-wider rounded-lg border border-zinc-800 cursor-pointer disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPulling ? 'animate-spin text-purple-400' : 'text-zinc-500'}`} />
              {isPulling ? 'Synchronizing...' : 'Pull Latest From Sheet'}
            </button>

            {/* Shift lists block */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block font-mono border-b border-zinc-850 pb-1">
                Shift-by-Shift Assignments
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                {SHIFT_TYPES.map((shift) => {
                  const namesList = activeDay?.shifts?.[shift.key as keyof typeof activeDay.shifts] || [];
                  const isGenderViolated = shift.key === 'night' && namesList.some(name => {
                    const found = AGENTS_LIST.find(a => a.name === name);
                    return found && !found.isMale;
                  });

                  return (
                    <div key={shift.key} className="bg-zinc-950/40 border border-zinc-850 p-3 rounded-xl space-y-2 flex flex-col justify-between">
                      <div className="space-y-2">
                        {/* Shift Header row */}
                        <div className="flex justify-between items-center text-xs border-b border-zinc-900/60 pb-1.5">
                          <div>
                            <span className="font-bold text-zinc-100">{shift.label}</span>
                            <span className="text-[10px] font-mono text-zinc-500 block">{shift.time}</span>
                          </div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                            namesList.length === shift.target 
                              ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40' 
                              : 'bg-purple-950/30 text-purple-400 border border-purple-900/40'
                          }`}>
                            {namesList.length} assigned
                          </span>
                        </div>

                        {/* Assigned names */}
                        {namesList.length > 0 ? (
                          <div className="space-y-1.5">
                            {namesList.map((name, idx) => {
                              const agentObj = AGENTS_LIST.find(a => a.name === name);
                              return (
                                <div key={`${name}-${idx}`} className="flex justify-between items-center bg-zinc-950 border border-zinc-900 px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-850 transition-colors">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="font-medium text-zinc-200 truncate">{name}</span>
                                    {agentObj && (
                                      <span className={`text-[10px] ${agentObj.isMale ? 'text-blue-400' : 'text-pink-400'} shrink-0`}>
                                        {agentObj.isMale ? '♂' : '♀'}
                                      </span>
                                    )}
                                  </div>
                                  {userRole === 'ADMIN' && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveAgentFromShift(shift.key, name)}
                                      className="text-[10px] font-bold text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/30 transition-all cursor-pointer flex items-center justify-center h-5 w-5 shrink-0"
                                      title={`Remove ${name} from ${shift.label}`}
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-650 italic pl-1 py-1">No personnel assigned to this block.</p>
                        )}

                        {isGenderViolated && (
                          <div className="text-[9px] bg-rose-950/40 border border-rose-900/40 text-rose-400 p-2 rounded-lg flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>Night shift must contain strictly male agents only!</span>
                          </div>
                        )}
                      </div>

                      {/* Add Agent to Shift Dropdown */}
                      {userRole === 'ADMIN' && (
                        <div className="pt-1.5 border-t border-zinc-900/40 mt-2">
                          <select
                            value=""
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val) {
                                handleAddAgentToShift(shift.key, val);
                              }
                            }}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                          >
                            <option value="" disabled>+ Add Agent to Shift...</option>
                            {[...AGENTS_LIST]
                              .sort((a, b) => a.name.localeCompare(b.name))
                              .map((agent) => {
                                const inThisShift = namesList.includes(agent.name);
                                const otherShiftKey = Object.entries(activeDay?.shifts || {}).find(([key, list]) => 
                                  key !== shift.key && key !== 'off' && Array.isArray(list) && list.includes(agent.name)
                                )?.[0];
                                const isOff = activeDay?.shifts?.off?.includes(agent.name);

                                let label = agent.name;
                                if (inThisShift) {
                                  label += " (already assigned here)";
                                } else if (otherShiftKey) {
                                  const matchedShift = SHIFT_TYPES.find(st => st.key === otherShiftKey);
                                  label += ` (assigned on ${matchedShift?.label || otherShiftKey})`;
                                } else if (isOff) {
                                  label += " (currently Off Duty)";
                                }

                                return (
                                  <option 
                                    key={agent.name} 
                                    value={agent.name}
                                    disabled={inThisShift}
                                  >
                                    {label}
                                  </option>
                                );
                              })
                            }
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Off Duty / Rest Period Block */}
                <div className="bg-zinc-950/40 border border-zinc-850 p-3 rounded-xl space-y-2 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                  <div className="flex justify-between items-center text-xs border-b border-zinc-900/60 pb-1.5">
                    <div>
                      <span className="font-bold text-zinc-400">Off Duty / Rest Period</span>
                      <span className="text-[10px] font-mono text-zinc-650 block">No Active Shift (Rest Day)</span>
                    </div>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase bg-zinc-900 text-zinc-400 border border-zinc-800">
                      {(activeDay?.shifts?.off || []).length} off duty
                    </span>
                  </div>

                  {(activeDay?.shifts?.off || []).length > 0 ? (
                    <div className="space-y-1.5">
                      {(activeDay?.shifts?.off || []).map((name, idx) => {
                        const agentObj = AGENTS_LIST.find(a => a.name === name);
                        return (
                          <div key={`${name}-${idx}`} className="flex justify-between items-center bg-zinc-950 border border-zinc-900 px-2.5 py-1.5 rounded-lg text-xs hover:bg-zinc-850 transition-colors">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-medium text-zinc-400 truncate">{name}</span>
                              {agentObj && (
                                <span className={`text-[10px] ${agentObj.isMale ? 'text-blue-500/60' : 'text-pink-500/60'} shrink-0`}>
                                  {agentObj.isMale ? '♂' : '♀'}
                                </span>
                              )}
                            </div>
                            {userRole === 'ADMIN' && (
                              <button
                                type="button"
                                onClick={() => {
                                  // Moving to Off duty is default when unassigned from shift, but we can also unassign them from off-duty (re-assign via shifts)
                                }}
                                className="text-[10px] text-zinc-650 italic select-none"
                                disabled
                              >
                                Off Duty
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-zinc-650 italic pl-1 py-1">No personnel on off duty rest day.</p>
                  )}

                  {/* Add to Off Duty Dropdown */}
                  {userRole === 'ADMIN' && (
                    <div className="pt-1.5 border-t border-zinc-900/40">
                      <select
                        value=""
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val) {
                            handleAddAgentToShift('off', val);
                          }
                        }}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[11px] text-zinc-400 focus:outline-none focus:border-zinc-600 cursor-pointer"
                      >
                        <option value="" disabled>+ Add Agent to Off Duty...</option>
                        {[...AGENTS_LIST]
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map((agent) => {
                            const isOff = activeDay?.shifts?.off?.includes(agent.name);
                            const activeShiftKey = Object.entries(activeDay?.shifts || {}).find(([key, list]) => 
                              key !== 'off' && Array.isArray(list) && list.includes(agent.name)
                            )?.[0];

                            let label = agent.name;
                            if (isOff) {
                              label += " (already off duty)";
                            } else if (activeShiftKey) {
                              const matchedShift = SHIFT_TYPES.find(st => st.key === activeShiftKey);
                              label += ` (assigned on ${matchedShift?.label || activeShiftKey})`;
                            }

                            return (
                              <option 
                                key={agent.name} 
                                value={agent.name}
                                disabled={isOff}
                              >
                                {label}
                              </option>
                            );
                          })
                        }
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DIRECT TEXT OVERRIDE FORM ACCORDION */}
            {userRole === 'ADMIN' && (
              <div className="border border-zinc-850 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowOverrideForm(!showOverrideForm)}
                  className="w-full flex justify-between items-center px-4 py-3 bg-zinc-950 text-left font-mono text-[10px] font-bold text-zinc-400 uppercase tracking-widest hover:text-white transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Edit className="w-3.5 h-3.5 text-purple-400" />
                    Direct Text Override Form
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showOverrideForm ? 'rotate-180 text-white' : 'text-zinc-500'}`} />
                </button>

                {showOverrideForm && (
                  <form onSubmit={handleSaveDirectOverride} className="p-4 bg-zinc-950 border-t border-zinc-850 space-y-4 text-xs text-left animate-slideDown">
                    <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">
                      Modify shift rows manually. Supply comma-separated agent names.
                    </p>

                    {SHIFT_TYPES.map((st) => (
                      <div key={`over-${st.key}`} className="space-y-1">
                        <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
                          {st.label} ({st.time})
                        </label>
                        <input
                          type="text"
                          value={editForm[st.key as keyof typeof editForm]?.join(', ') || ''}
                          onChange={(e) => {
                            const val = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
                            setEditForm({ ...editForm, [st.key]: val });
                          }}
                          placeholder="Agent names comma-separated"
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-sans"
                        />
                      </div>
                    ))}

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider font-mono block">
                        Off Duty / Rest Period
                      </label>
                      <input
                        type="text"
                        value={editForm.off?.join(', ') || ''}
                        onChange={(e) => {
                          const val = e.target.value.split(',').map(n => n.trim()).filter(Boolean);
                          setEditForm({ ...editForm, off: val });
                        }}
                        placeholder="Off duty names comma-separated"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-sans"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-[#6A00D1] hover:bg-[#5800b0] text-white font-bold uppercase tracking-wider rounded-lg text-[10px] transition-all cursor-pointer font-mono"
                    >
                      Save Manual Override
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>

        </div>

      </div>



      {/* Bottom Grid: Agent Lookup & Rotation Balance Auditor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* AGENT & DATE SCHEDULE LOOKUP */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4 text-left">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" />
              <h3 className="font-bold text-xs text-zinc-200 tracking-wide uppercase font-serif">
                Schedule Lookup Hub
              </h3>
            </div>
            
            {/* Tab Swappers */}
            <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-850">
              <button
                type="button"
                onClick={() => setLookupTab('AGENT')}
                className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded-md transition-all cursor-pointer ${
                  lookupTab === 'AGENT' 
                    ? 'bg-indigo-500 text-black' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                By Agent
              </button>
              <button
                type="button"
                onClick={() => setLookupTab('DATE')}
                className={`px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded-md transition-all cursor-pointer ${
                  lookupTab === 'DATE' 
                    ? 'bg-purple-600 text-white' 
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                By Date
              </button>
            </div>
          </div>

          {lookupTab === 'AGENT' ? (
            <div className="space-y-3.5">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Choose any agent to show their complete monthly schedule day-by-day. Type to search or pick from the dropdown list.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Search Text input */}
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block font-mono mb-1">
                    Search Name
                  </label>
                  <input
                    type="text"
                    value={lookupSearch}
                    onChange={(e) => {
                      const typed = e.target.value;
                      setLookupSearch(typed);
                      // If there is an exact case-insensitive match, set selected Lookup Agent
                      const match = AGENTS_LIST.find(a => a.name.toLowerCase() === typed.toLowerCase().trim());
                      if (match) {
                        setSelectedLookupAgent(match.name);
                      }
                    }}
                    placeholder="Type to filter..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-650 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Dropdown Select input */}
                <div>
                  <label className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block font-mono mb-1">
                    Select Agent
                  </label>
                  <select
                    value={selectedLookupAgent}
                    onChange={(e) => {
                      setSelectedLookupAgent(e.target.value);
                      setLookupSearch(e.target.value);
                    }}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Choose Agent --</option>
                    {[...AGENTS_LIST]
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(a => (
                        <option key={a.name} value={a.name}>{a.name}</option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Suggestions from typing search */}
              {lookupSearch && !selectedLookupAgent && (
                <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 max-h-36 overflow-y-auto divide-y divide-zinc-900 text-xs">
                  {AGENTS_LIST.filter(a => a.name.toLowerCase().includes(lookupSearch.toLowerCase())).map(agent => (
                    <button
                      key={agent.name}
                      type="button"
                      onClick={() => {
                        setSelectedLookupAgent(agent.name);
                        setLookupSearch(agent.name);
                      }}
                      className="w-full text-left py-1.5 px-1 hover:bg-zinc-900 text-zinc-300 font-medium transition-colors flex justify-between items-center cursor-pointer"
                    >
                      <span>{agent.name}</span>
                      <span className="text-[10px] text-indigo-400 font-mono">Select</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Show complete monthly roster for the selected agent */}
              {selectedLookupAgent ? (
                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                  <div className="flex justify-between items-center border-b border-zinc-850 pb-2">
                    <div>
                      <h4 className="font-bold text-xs text-indigo-400 font-mono">{selectedLookupAgent}</h4>
                      <p className="text-[10px] text-zinc-500">Monthly Duty Schedule</p>
                    </div>
                    
                    {/* Summary stats */}
                    <div className="text-right">
                      {(() => {
                        const daysOn = rosterDays.filter(day => {
                          return Object.entries(day.shifts || {}).some(([key, list]) => 
                            key !== 'off' && Array.isArray(list) && list.includes(selectedLookupAgent)
                          );
                        }).length;
                        const daysOff = rosterDays.length - daysOn;
                        return (
                          <div className="text-[10px] font-mono text-zinc-400">
                            <span className="text-emerald-400 font-bold">{daysOn} Duty Days</span>
                            <span className="mx-1.5">•</span>
                            <span className="text-zinc-500 font-bold">{daysOff} Rest Days</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Scrollable list of all days in active month */}
                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {rosterDays.map(day => {
                      // Find what shift they are assigned to
                      let assignedShift = 'Off Duty';
                      Object.entries(day.shifts || {}).forEach(([key, list]) => {
                        if (Array.isArray(list) && list.includes(selectedLookupAgent)) {
                          if (key !== 'off') {
                            const match = SHIFT_TYPES.find(st => st.key === key);
                            assignedShift = match ? match.label : key;
                          }
                        }
                      });

                      const getShiftDetails = (shiftName: string) => {
                        if (shiftName.includes('Morning')) return { text: 'Morning Shift', bg: 'bg-purple-950/40 text-purple-400 border border-purple-900/40' };
                        if (shiftName.includes('Standard')) return { text: 'Standard Day', bg: 'bg-sky-950/40 text-sky-400 border border-sky-900/40' };
                        if (shiftName.includes('Late')) return { text: 'Late Day Shift', bg: 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/40' };
                        if (shiftName.includes('Afternoon')) return { text: 'Afternoon Shift', bg: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' };
                        if (shiftName.includes('Evening')) return { text: 'Evening Shift', bg: 'bg-orange-950/40 text-orange-400 border border-orange-900/40' };
                        if (shiftName.includes('Night')) return { text: 'Night Shift', bg: 'bg-rose-950/40 text-rose-400 border border-rose-900/40' };
                        return { text: 'Off Duty / Rest Day', bg: 'bg-zinc-950 border border-zinc-850 text-zinc-400' };
                      };

                      const detail = getShiftDetails(assignedShift);
                      const dayNum = day.date.split('-')[2];

                      return (
                        <div 
                          key={day.date} 
                          className="flex justify-between items-center bg-zinc-900/60 hover:bg-zinc-850 px-2.5 py-1.5 rounded-lg border border-zinc-850/40 text-[11px] transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-6 text-center font-bold font-mono text-zinc-400 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-850">
                              {parseInt(dayNum, 10)}
                            </span>
                            <span className="font-mono text-[10px] text-zinc-500 w-8">{day.dayOfWeek}</span>
                            <span className="text-zinc-400 text-[10px] hidden sm:inline">{day.date}</span>
                          </div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-tight ${detail.bg}`}>
                            {detail.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-zinc-950/40 rounded-xl border border-zinc-850/60 text-center text-zinc-600 text-xs italic">
                  Select an agent above to see their entire month roster.
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3.5">
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                Select any date below to check the complete shift-by-shift coverage on that day.
              </p>

              {/* Date selection input */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={lookupDate}
                  onChange={(e) => setLookupDate(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-purple-500 w-full cursor-pointer"
                />
              </div>

              {/* Render shift rosters for selected date */}
              {(() => {
                const dayMatch = rosterDays.find(d => d.date === lookupDate);
                if (!dayMatch) {
                  return (
                    <div className="p-6 bg-zinc-950/40 rounded-xl border border-zinc-850/60 text-center text-zinc-600 text-xs italic">
                      No roster matches this selected date. Ensure year & month matches the active calendar.
                    </div>
                  );
                }

                const getShiftDetails = (shiftName: string) => {
                  if (shiftName.includes('Morning')) return { text: 'Morning Shift', bg: 'bg-purple-950/40 text-purple-400 border border-purple-900/40' };
                  if (shiftName.includes('Standard')) return { text: 'Standard Day', bg: 'bg-sky-950/40 text-sky-400 border border-sky-900/40' };
                  if (shiftName.includes('Late')) return { text: 'Late Day Shift', bg: 'bg-indigo-950/40 text-indigo-400 border border-indigo-900/40' };
                  if (shiftName.includes('Afternoon')) return { text: 'Afternoon Shift', bg: 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' };
                  if (shiftName.includes('Evening')) return { text: 'Evening Shift', bg: 'bg-orange-950/40 text-orange-400 border border-orange-900/40' };
                  if (shiftName.includes('Night')) return { text: 'Night Shift', bg: 'bg-rose-950/40 text-rose-400 border border-rose-900/40' };
                  return { text: 'Off Duty / Rest Day', bg: 'bg-zinc-950 border border-zinc-850 text-zinc-400' };
                };

                return (
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
                    <div className="border-b border-zinc-850 pb-2 flex justify-between items-center">
                      <div>
                        <h4 className="font-bold text-xs text-purple-400 font-mono">{dayMatch.date}</h4>
                        <p className="text-[10px] text-zinc-500">Day of Week: {dayMatch.dayOfWeek}</p>
                      </div>
                      <span className="bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded text-[10px] font-mono">
                        {getDayTotalStaffCount(dayMatch)} Staff Assigned
                      </span>
                    </div>

                    {/* Show each shift roster */}
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {SHIFT_TYPES.map((st) => {
                        const shiftAgents = dayMatch.shifts?.[st.key as keyof typeof dayMatch.shifts] || [];

                        return (
                          <div key={st.key} className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850/40 text-xs space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-zinc-300 font-mono flex items-center gap-1.5">
                                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                  st.key === 'morning' ? 'bg-purple-400' :
                                  st.key === 'standardDay' ? 'bg-sky-400' :
                                  st.key === 'lateDay' ? 'bg-indigo-400' :
                                  st.key === 'afternoon' ? 'bg-emerald-400' :
                                  st.key === 'evening' ? 'bg-orange-400' : 'bg-rose-400'
                                }`} />
                                {st.label} ({st.time})
                              </span>
                              <span className="text-zinc-500 font-mono">{shiftAgents.length} assigned</span>
                            </div>

                            {shiftAgents.length > 0 ? (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {shiftAgents.map((name, idx) => (
                                  <span 
                                    key={`${name}-${idx}`} 
                                    className="bg-zinc-950 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-300 border border-zinc-850"
                                  >
                                    {name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[10px] text-zinc-650 italic pl-3">No agents scheduled for this shift.</p>
                            )}
                          </div>
                        );
                      })}

                      {/* Also show off duty */}
                      <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850/40 text-xs space-y-1">
                        <div className="flex justify-between items-center text-[10px] font-bold text-zinc-500">
                          <span className="font-mono">Off Duty / Rest Period</span>
                          <span className="font-mono">{(dayMatch.shifts?.off || []).length} off duty</span>
                        </div>
                        {(dayMatch.shifts?.off || []).length > 0 ? (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(dayMatch.shifts?.off || []).map((name, idx) => (
                              <span 
                                key={`${name}-${idx}`} 
                                className="bg-zinc-950 px-2 py-0.5 rounded text-[10px] font-medium text-zinc-500 border border-zinc-900"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-650 italic pl-3">None marked as off duty.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* ROTATION BALANCE AUDITOR */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-xs text-zinc-200 tracking-wide uppercase font-serif">
                Rotation Balance Auditor
              </h3>
            </div>
            <span className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-400 text-[9px] font-mono font-bold px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
              100% Gender Compliant
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            Continuous check confirming shift and rest distribution compliance across the entire team of 45 agents.
          </p>

          <div className="bg-zinc-950 rounded-xl border border-zinc-850 overflow-hidden">
            <div className="grid grid-cols-2 bg-zinc-900 px-3 py-1.5 border-b border-zinc-850 text-[10px] font-mono font-bold text-zinc-500 uppercase tracking-wider">
              <span>Agent Name</span>
              <span className="text-right">Shifts / Hours</span>
            </div>
            <div className="divide-y divide-zinc-900/60 max-h-48 overflow-y-auto text-xs">
              {agentShiftAnalytics.map((analysis) => (
                <div key={analysis.name} className="grid grid-cols-2 px-3 py-2 hover:bg-zinc-900 transition-colors">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-zinc-200 truncate font-medium">{analysis.name}</span>
                    <span className={`text-[10px] ${analysis.isMale ? 'text-blue-400' : 'text-pink-400'} font-bold shrink-0`}>
                      {analysis.isMale ? '♂' : '♀'}
                    </span>
                  </div>
                  <span className="text-right text-zinc-400 font-mono font-semibold">
                    {analysis.shifts} Shifts <span className="text-zinc-500">({analysis.hours} Hrs)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
