import { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Clock,
  Coffee,
  Users,
  FileText,
  LogOut,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ShieldCheck,
  AlertCircle,
  Calendar,
  BookOpen,
  Sun,
  Moon,
  Menu,
  X,
  LayoutDashboard,
  FileSpreadsheet,
  BarChart,
  BarChart3,
  Radio,
  FileBarChart,
  Sparkles,
  UserPlus,
  UserCog,
  Activity,
  TrendingUp,
  Sliders,
  Plus,
  Wrench,
  UserCheck,
  Cpu,
  ShieldAlert,
  Zap,
  Scroll,
  Layers,
  Globe,
  DollarSign,
  Download,
  Settings,
  ExternalLink,
  ClipboardList,
  User as UserIcon,
  Lock as LockIcon,
  Eye,
  EyeOff,
  Search
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  auth,
  initAuth, 
  googleSignIn, 
  logout,
  upsertSession,
  deleteSession,
  listenToSessions,
  upsertBreak,
  listenToBreaks,
  signInAnonymouslyIfNeeded,
  saveSpreadsheetConfig,
  listenToSpreadsheetConfig,
  savePersonalPreferences,
  listenToPersonalPreferences,
  logActivityEvent,
  listenToActivityLogs,
  ActivityLogEvent,
  listenToAgentCredentials,
  saveAllAgentCredentialsToFirestore,
  detectDeviceType,
  getUtcDateStr,
  listenToActiveSession,
  getDailyDurationDoc,
  saveDailyDurationDoc
} from './firebase';
import {
  createAndExportRosterToSheet,
  updateRosterInSheet,
  fetchRosterFromSheet,
  appendRowToSheet,
  syncSpecificDayToSheet,
  updateGoogleDocLive,
  fetchAgentCredentialsFromSheet
} from './workspace';
import { CRMContact, SupportTicket, RosterDay, AgentCredential, LiveAgentSession, KBArticle } from './types';
import { INITIAL_CONTACTS, INITIAL_TICKETS, INITIAL_KB_ARTICLES } from './data';
import { parsePastedRoster } from './pastedRoster';

// Modular Sections
import DashboardSection from './components/DashboardSection';
import CrmSection from './components/CrmSection';
import KbSection from './components/KbSection';
import AdminSection from './components/AdminSection';
import RosterSection from './components/RosterSection';
import ReportsSection from './components/ReportsSection';
import SettingsSection from './components/SettingsSection';
import CsTicketFormSection from './components/CsTicketFormSection';
import AuthGatewayModal from './components/AuthGatewayModal';
import GlobalSearchModal from './components/GlobalSearchModal';
import SystemTroubleshooting from './components/SystemTroubleshooting';
import ConfirmationModal from './components/ConfirmationModal';

export const AGENTS_LIST = [
  { name: "Israt Jahan Mim", isMale: false },
  { name: "Nasrin Sultana Shelu", isMale: false },
  { name: "Farzana Farha", isMale: false },
  { name: "Md Rakib Mia", isMale: true },
  { name: "Tanjila Akter", isMale: false },
  { name: "Jakia Afrin", isMale: false },
  { name: "Zakia Sultana", isMale: false },
  { name: "Md. Sumon Islam Bhuyan", isMale: true },
  { name: "Baharul Amin Riham", isMale: true },
  { name: "Rokonuzzaman Kazol", isMale: true },
  { name: "Solayman Khalek", isMale: true },
  { name: "Susmita Ranjon Shaha", isMale: false },
  { name: "Md Lokman Hossain Likhon", isMale: true },
  { name: "Shiekh Nazibul Islam Nemon", isMale: true },
  { name: "Zahir Uddin Miah", isMale: true },
  { name: "Fatema Akter Bithi", isMale: false },
  { name: "Ferdous ara", isMale: false },
  { name: "Woendi Bazi", isMale: false },
  { name: "Badhan Biswas", isMale: true },
  { name: "Shubha Saha", isMale: false },
  { name: "Shahadat Hosain Shakil", isMale: true },
  { name: "Chinmoy Mohanto", isMale: true },
  { name: "Tania Tawhida Azad", isMale: false },
  { name: "Afsana Tabassum Jui", isMale: false },
  { name: "Mr Muzzam Hossen Rony", isMale: true },
  { name: "MD. Towhid Elahi", isMale: true },
  { name: "MD. Rifat Hossain", isMale: true },
  { name: "Md.Masum Billa", isMale: true },
  { name: "Umme Hany Sinthia", isMale: false },
  { name: "Ahfra yesmin luba", isMale: false },
  { name: "Ayisha Siddika Jim", isMale: false },
  { name: "Trisha Saha", isMale: false },
  { name: "Abdullah al saeed", isMale: true },
  { name: "Kazi Iqbal Hossain", isMale: true },
  { name: "Riad Hasan", isMale: true },
  { name: "Ishtiaque Abdul Quyyum", isMale: true },
  { name: "Aminul Islam Rabbi", isMale: true },
  { name: "Shawon Rozario", isMale: true },
  { name: "Sadi MD.Imran", isMale: true },
  { name: "Nusrat Jahan Munia", isMale: false },
  { name: "Nazim Uddin", isMale: true },
  { name: "Mahi Shahriar Khan", isMale: true },
  { name: "Alodi Marak", isMale: false },
  { name: "Asaduzzaman Safi", isMale: true },
  { name: "Shahariar Sabbir", isMale: true }
];

export const getBreakLimitMinutes = (breakType: string): number => {
  const typeLower = breakType.toLowerCase();
  if (typeLower.includes('short') || typeLower.includes('prayer') || typeLower.includes('coffee')) {
    return 15;
  }
  if (typeLower.includes('meal') || typeLower.includes('lunch')) {
    return 30;
  }
  return 0; // 0 represents no active limit (e.g. meetings)
};

export const isBreakOverrun = (breakType: string, durationSeconds: number): boolean => {
  const limitMin = getBreakLimitMinutes(breakType);
  if (limitMin === 0) return false;
  return durationSeconds > limitMin * 60;
};

interface AgentSelectProps {
  value: string;
  onChange: (val: string) => void;
}

function AgentSelect({ value, onChange }: AgentSelectProps) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filtered = AGENTS_LIST.filter(agent => 
    agent.name.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
    setSearch(name);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef} id="agent_searchable_dropdown">
      <div className="relative">
        <input
          type="text"
          placeholder="Search and select agent..."
          value={isOpen ? search : (value || search)}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearch('');
          }}
          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-3 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-[#6A00D1] font-sans placeholder:text-slate-400 focus:ring-1 focus:ring-[#6A00D1]"
          id="agent_login_search_input"
        />
        {(value || search) && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSearch('');
              onChange('');
            }}
            className="absolute right-2.5 top-2.5 text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
            id="agent_login_search_clear"
            title="Clear search and selection"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 divide-y divide-zinc-950 animate-fadeIn">
          {filtered.length > 0 ? (
            filtered.map((agent) => (
              <button
                key={agent.name}
                type="button"
                onClick={() => handleSelect(agent.name)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between hover:bg-zinc-850 cursor-pointer ${
                  value === agent.name ? 'text-amber-500 bg-zinc-800/60 font-bold' : 'text-zinc-300'
                }`}
              >
                <span>{agent.name}</span>
                <span className={`text-[10px] uppercase font-mono ${agent.isMale ? 'text-blue-400' : 'text-pink-400'}`}>
                  {agent.isMale ? 'Male' : 'Female'}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-3 text-xs text-zinc-500 italic text-center">
              No matching agents found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Authentication states
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showAuthWarning, setShowAuthWarning] = useState(false);
  const [isAuthGatewayOpen, setIsAuthGatewayOpen] = useState(false);
  const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);

  // Keyboard shortcut listener for Global Search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsGlobalSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Portal login states & verified server session token
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
  }, []);

  const [isPortalLoggedIn, setIsPortalLoggedIn] = useState<boolean>(false);
  const [agentName, setAgentName] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: 'AGENT' | 'ADMIN' } | null>(null);
  const [userRole, setUserRole] = useState<'AGENT' | 'ADMIN'>('AGENT');

  // Single Session & Daily Duration State
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => {
    return sessionStorage.getItem('csp_session_id') || localStorage.getItem('csp_session_id') || '';
  });
  const [currentDeviceType, setCurrentDeviceType] = useState<'web' | 'mobile'>(() => {
    return (localStorage.getItem('csp_device_type') as 'web' | 'mobile') || detectDeviceType();
  });
  const [accumulatedToday, setAccumulatedToday] = useState<number>(0);
  const [sessionStartTimestamp, setSessionStartTimestamp] = useState<number>(0);
  const [activeDateStr, setActiveDateStr] = useState<string>(() => getUtcDateStr());

  // Verify server session token on initial mount & hydrate session state
  useEffect(() => {
    const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token');
    if (token) {
      fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      })
        .then(res => res.json())
        .then(async (data) => {
          if (data.valid && data.user) {
            setIsPortalLoggedIn(true);
            setCurrentUser(data.user);
            setAgentName(data.user.name);
            setUserRole(data.user.role);

            const devType = data.user.deviceType || detectDeviceType();
            const sessId = data.user.sessionId || '';
            setCurrentDeviceType(devType);
            setCurrentSessionId(sessId);
            localStorage.setItem('csp_device_type', devType);
            if (sessId) {
              sessionStorage.setItem('csp_session_id', sessId);
              localStorage.setItem('csp_session_id', sessId);
            }

            // Hydrate daily accumulated login duration for current agent
            const todayStr = getUtcDateStr();
            setActiveDateStr(todayStr);
            const dailyDoc = await getDailyDurationDoc(data.user.id, todayStr);
            const priorSeconds = dailyDoc?.totalSeconds || 0;
            const nowTs = Date.now();
            setAccumulatedToday(priorSeconds);
            setSessionStartTimestamp(nowTs);

            // Save start timestamp to Firestore for today
            await saveDailyDurationDoc({
              agentId: data.user.id,
              date: todayStr,
              totalSeconds: priorSeconds,
              sessionStartTimestamp: nowTs,
              lastUpdatedISO: new Date().toISOString()
            });
          } else {
            // Invalid or revoked token
            const revMsg = data.message || (data.reason === 'revoked'
              ? "You've been logged out because your account was signed in on another device."
              : '');
            sessionStorage.removeItem('csp_session_token');
            localStorage.removeItem('csp_session_token');
            sessionStorage.removeItem('csp_session_id');
            localStorage.removeItem('csp_session_id');
            localStorage.removeItem('csp_portal_logged_in');
            localStorage.removeItem('csp_user_role');
            setIsPortalLoggedIn(false);
            setCurrentUser(null);
            setUserRole('AGENT');
            if (revMsg) {
              setLoginError(revMsg);
            }
          }
        })
        .catch(() => {
          setIsPortalLoggedIn(false);
          setCurrentUser(null);
        });
    } else {
      setIsPortalLoggedIn(false);
      setCurrentUser(null);
    }
  }, []);

  // 1. Real-time active session listener (Forced Logout Enforcement)
  useEffect(() => {
    if (!isPortalLoggedIn || !currentUser?.id || !currentSessionId) return;

    const unsubscribe = listenToActiveSession(currentUser.id, currentDeviceType, (pointer) => {
      if (pointer && pointer.sessionId && pointer.sessionId !== currentSessionId) {
        // FORCED LOGOUT: Account logged in on another device of the same device type!
        const forcedMsg = `You've been logged out because your account was signed in on another ${
          currentDeviceType === 'mobile' ? 'mobile device' : 'web browser'
        }.`;

        // Flush accumulated duration before clearing session state
        if (sessionStartTimestamp > 0) {
          const elapsed = Math.floor((Date.now() - sessionStartTimestamp) / 1000);
          const finalSecs = accumulatedToday + Math.max(0, elapsed);
          saveDailyDurationDoc({
            agentId: currentUser.id,
            date: activeDateStr,
            totalSeconds: finalSecs,
            sessionStartTimestamp: Date.now(),
            lastUpdatedISO: new Date().toISOString()
          }).catch(() => {});
        }

        sessionStorage.removeItem('csp_session_token');
        localStorage.removeItem('csp_session_token');
        sessionStorage.removeItem('csp_session_id');
        localStorage.removeItem('csp_session_id');
        setIsPortalLoggedIn(false);
        setCurrentUser(null);
        setCurrentSessionId('');
        setLoginError(forcedMsg);
      }
    });

    return () => unsubscribe();
  }, [isPortalLoggedIn, currentUser?.id, currentSessionId, currentDeviceType, sessionStartTimestamp, accumulatedToday, activeDateStr]);

  // 2. Heartbeat (~30s) and timer ticker for daily duration & midnight rollover
  useEffect(() => {
    if (!isPortalLoggedIn || !currentUser?.id) return;

    // Second ticker: compute running shift duration with system clock (Date.now())
    const secondTimer = setInterval(() => {
      if (sessionStartTimestamp > 0) {
        const elapsed = Math.floor((Date.now() - sessionStartTimestamp) / 1000);
        setShiftTimer(accumulatedToday + Math.max(0, elapsed));
      }
    }, 1000);

    // 30s Heartbeat: persist duration to Firestore & handle UTC midnight rollover
    const heartbeatTimer = setInterval(async () => {
      if (!sessionStartTimestamp) return;

      const now = new Date();
      const nowDateStr = getUtcDateStr(now);

      if (nowDateStr === activeDateStr) {
        // Same UTC day: update totalSeconds and reset baseline timestamp
        const elapsed = Math.floor((Date.now() - sessionStartTimestamp) / 1000);
        const newTotal = accumulatedToday + Math.max(0, elapsed);
        const nowTs = Date.now();

        setAccumulatedToday(newTotal);
        setSessionStartTimestamp(nowTs);

        try {
          await saveDailyDurationDoc({
            agentId: currentUser.id,
            date: nowDateStr,
            totalSeconds: newTotal,
            sessionStartTimestamp: nowTs,
            lastUpdatedISO: now.toISOString()
          });
        } catch (e) {
          console.warn("Heartbeat write skipped, will retry next cycle:", e);
        }
      } else {
        // Midnight Rollover: flush remaining elapsed to old day, initialize new day doc
        const elapsedOld = Math.floor((Date.now() - sessionStartTimestamp) / 1000);
        const finalOldTotal = accumulatedToday + Math.max(0, elapsedOld);

        try {
          await saveDailyDurationDoc({
            agentId: currentUser.id,
            date: activeDateStr,
            totalSeconds: finalOldTotal,
            sessionStartTimestamp: Date.now(),
            lastUpdatedISO: now.toISOString()
          });
        } catch (e) {
          console.warn("Rollover old day flush warning:", e);
        }

        const nowTs = Date.now();
        setActiveDateStr(nowDateStr);
        setAccumulatedToday(0);
        setSessionStartTimestamp(nowTs);

        try {
          await saveDailyDurationDoc({
            agentId: currentUser.id,
            date: nowDateStr,
            totalSeconds: 0,
            sessionStartTimestamp: nowTs,
            lastUpdatedISO: now.toISOString()
          });
        } catch (e) {
          console.warn("Rollover new day init warning:", e);
        }
      }
    }, 30000);

    return () => {
      clearInterval(secondTimer);
      clearInterval(heartbeatTimer);
    };
  }, [isPortalLoggedIn, currentUser?.id, sessionStartTimestamp, accumulatedToday, activeDateStr]);

  // 3. Flush duration on page unload / tab close
  useEffect(() => {
    const handleUnload = () => {
      if (isPortalLoggedIn && currentUser?.id && sessionStartTimestamp > 0) {
        const elapsed = Math.floor((Date.now() - sessionStartTimestamp) / 1000);
        const finalTotal = accumulatedToday + Math.max(0, elapsed);
        saveDailyDurationDoc({
          agentId: currentUser.id,
          date: activeDateStr,
          totalSeconds: finalTotal,
          sessionStartTimestamp: Date.now(),
          lastUpdatedISO: new Date().toISOString()
        }).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [isPortalLoggedIn, currentUser?.id, sessionStartTimestamp, accumulatedToday, activeDateStr]);

  // Agent Credentials state (Fetched safely from backend API)
  const [agentCredentials, setAgentCredentials] = useState<AgentCredential[]>([]);

  // Real-time synchronization of user credentials with Backend Server API
  useEffect(() => {
    try {
      localStorage.removeItem('csp_agent_credentials');
    } catch (e) {}

    const unsubscribe = listenToAgentCredentials((fetchedCredentials) => {
      if (fetchedCredentials && fetchedCredentials.length > 0) {
        setAgentCredentials(fetchedCredentials);
      }
    });

    return () => unsubscribe();
  }, []);

  // Login form states
  const [loginRole, setLoginRole] = useState<'AGENT' | 'ADMIN'>('AGENT');
  const [loginAgentId, setLoginAgentId] = useState('');
  const [loginAgentPass, setLoginAgentPass] = useState('');
  const [loginAdminUser, setLoginAdminUser] = useState('');
  const [loginAdminPass, setLoginAdminPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'tickets' | 'cs_ticket_form' | 'crm' | 'reports' | 'kb' | 'roster' | 'system_troubleshooting' | 'admin_portal' | 'settings'>(() => {
    const saved = localStorage.getItem('csp_active_tab');
    if (saved) return saved as any;
    return 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('csp_active_tab', activeTab);
  }, [activeTab]);

  // Active Admin Sub Option state
  const [activeAdminSubOption, setActiveAdminSubOption] = useState<string>(() => {
    return localStorage.getItem('csp_active_admin_sub') || 'dash_exec';
  });

  useEffect(() => {
    localStorage.setItem('csp_active_admin_sub', activeAdminSubOption);
  }, [activeAdminSubOption]);

  // Single sidebar accordion categories expanded state
  const [expandedNavCategories, setExpandedNavCategories] = useState<Record<string, boolean>>({
    'cat_dashboard': true,
    'cat_users': false,
    'cat_roster': false,
    'cat_operations': false,
    'cat_financials': false,
    'cat_tickets': false
  });

  const toggleNavCategory = (catId: string) => {
    setExpandedNavCategories(prev => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  // Collapsible sidebar
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const compactSaved = localStorage.getItem(`csp_${aid}_compact_sidebar`);
    if (compactSaved !== null) {
      return compactSaved === 'true';
    }
    return localStorage.getItem('csp_sidebar_collapsed') === 'true';
  });

  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isExpanded = !isSidebarCollapsed || isSidebarHovered;

  useEffect(() => {
    localStorage.setItem('csp_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Personal Preference States
  const [autoClockIn, setAutoClockIn] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_auto_clock_in`) === 'true';
  });

  const [audioNotifications, setAudioNotifications] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_audio_notifications`) !== 'false';
  });

  const [compactSidebar, setCompactSidebar] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_compact_sidebar`) === 'true';
  });

  const [showWarnings, setShowWarnings] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_show_warnings`) !== 'false';
  });

  const [customAlias, setCustomAlias] = useState<string>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_custom_alias`) || '';
  });

  // Time metrics tracking
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const [isCheckedIn, setIsCheckedIn] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_is_checked_in`) === 'true';
  });

  const [isOnBreak, setIsOnBreak] = useState<boolean>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_is_on_break`) === 'true';
  });

  const [shiftStartTime, setShiftStartTime] = useState<string | null>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_shift_start_time`);
  });

  const [breakStartTime, setBreakStartTime] = useState<string | null>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_break_start_time`);
  });

  const [breakReason, setBreakReason] = useState<string>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_break_reason`) || 'Short Break';
  });

  // Operational states for UI and metrics
  const [agentStatus, setAgentStatus] = useState<'AVAILABLE' | 'ON BREAK' | 'OFFLINE'>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const checkedIn = localStorage.getItem(`csp_${aid}_is_checked_in`) === 'true';
    const onBreak = localStorage.getItem(`csp_${aid}_is_on_break`) === 'true';
    if (!checkedIn) return 'OFFLINE';
    return onBreak ? 'ON BREAK' : 'AVAILABLE';
  });

  const [currentActivity, setCurrentActivity] = useState<string>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    return localStorage.getItem(`csp_${aid}_current_activity`) || 'standby';
  });

  // Individual session counters
  const [shiftTimer, setShiftTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      const isCheckedInNow = localStorage.getItem(`csp_${aid}_is_checked_in`) === 'true';
      const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
      const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
      if (isCheckedInNow && startTs > 0) {
        return accum + Math.floor((Date.now() - startTs) / 1000);
      }
      return Number(localStorage.getItem(`csp_${aid}_timer_shift`) || '0');
    }
    return 0;
  });
  const [shortBreakTimer, setShortBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_short_break`) || '0');
    }
    return 0;
  });
  const [mealBreakTimer, setMealBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_meal_break`) || '0');
    }
    return 0;
  });
  const [prayerBreakTimer, setPrayerBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_prayer_break`) || '0');
    }
    return 0;
  });
  const [meetingTimer, setMeetingTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_meeting`) || '0');
    }
    return 0;
  });

  const [inboundTimer, setInboundTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_inbound`) || '0');
    }
    return 0;
  });
  const [outboundTimer, setOutboundTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_outbound`) || '0');
    }
    return 0;
  });
  const [liveChatTimer, setLiveChatTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_live_chat`) || '0');
    }
    return 0;
  });
  const [irSupportTimer, setIrSupportTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_ir_support`) || '0');
    }
    return 0;
  });

  // Break duration tracking
  const [breakTimer, setBreakTimer] = useState<number>(() => {
    const aid = localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    if (savedDate === todayStr) {
      return Number(localStorage.getItem(`csp_${aid}_timer_break_active`) || '0');
    }
    return 0;
  });

  // Helper to load states dynamically when active agent switches
  const loadAgentLocalState = (agentId: string) => {
    setIsCheckedIn(localStorage.getItem(`csp_${agentId}_is_checked_in`) === 'true');
    setIsOnBreak(localStorage.getItem(`csp_${agentId}_is_on_break`) === 'true');
    setShiftStartTime(localStorage.getItem(`csp_${agentId}_shift_start_time`) || null);
    setBreakStartTime(localStorage.getItem(`csp_${agentId}_break_start_time`) || null);
    setBreakReason(localStorage.getItem(`csp_${agentId}_break_reason`) || 'Short Break');
    setAgentStatus(() => {
      const checkedIn = localStorage.getItem(`csp_${agentId}_is_checked_in`) === 'true';
      const onBreak = localStorage.getItem(`csp_${agentId}_is_on_break`) === 'true';
      if (!checkedIn) return 'OFFLINE';
      return onBreak ? 'ON BREAK' : 'AVAILABLE';
    });
    setCurrentActivity(localStorage.getItem(`csp_${agentId}_current_activity`) || 'standby');

    // Load agent-specific personal preferences
    setAutoClockIn(localStorage.getItem(`csp_${agentId}_auto_clock_in`) === 'true');
    setAudioNotifications(localStorage.getItem(`csp_${agentId}_audio_notifications`) !== 'false');
    const compactVal = localStorage.getItem(`csp_${agentId}_compact_sidebar`) === 'true';
    setCompactSidebar(compactVal);
    setIsSidebarCollapsed(compactVal);
    setShowWarnings(localStorage.getItem(`csp_${agentId}_show_warnings`) !== 'false');
    const aliasVal = localStorage.getItem(`csp_${agentId}_custom_alias`) || '';
    setCustomAlias(aliasVal);
    if (aliasVal.trim()) {
      setAgentName(aliasVal.trim());
    } else {
      // fallback to original name
      const found = AGENTS_LIST.find(a => a.name === localStorage.getItem('csp_agent_name'));
      if (found) {
        setAgentName(found.name);
      }
    }

    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${agentId}_timer_shift_date`);
    if (savedDate === todayStr) {
      const isCheckedInNow = localStorage.getItem(`csp_${agentId}_is_checked_in`) === 'true';
      const startTs = Number(localStorage.getItem(`csp_${agentId}_shift_start_timestamp`) || '0');
      const accum = Number(localStorage.getItem(`csp_${agentId}_accumulated_before`) || '0');
      if (isCheckedInNow && startTs > 0) {
        setShiftTimer(accum + Math.floor((Date.now() - startTs) / 1000));
      } else {
        setShiftTimer(Number(localStorage.getItem(`csp_${agentId}_timer_shift`) || '0'));
      }
      setShortBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_short_break`) || '0'));
      setMealBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_meal_break`) || '0'));
      setPrayerBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_prayer_break`) || '0'));
      setMeetingTimer(Number(localStorage.getItem(`csp_${agentId}_timer_meeting`) || '0'));
      setInboundTimer(Number(localStorage.getItem(`csp_${agentId}_timer_inbound`) || '0'));
      setOutboundTimer(Number(localStorage.getItem(`csp_${agentId}_timer_outbound`) || '0'));
      setLiveChatTimer(Number(localStorage.getItem(`csp_${agentId}_timer_live_chat`) || '0'));
      setIrSupportTimer(Number(localStorage.getItem(`csp_${agentId}_timer_ir_support`) || '0'));
      setBreakTimer(Number(localStorage.getItem(`csp_${agentId}_timer_break_active`) || '0'));
    } else {
      setShiftTimer(0);
      setShortBreakTimer(0);
      setMealBreakTimer(0);
      setPrayerBreakTimer(0);
      setMeetingTimer(0);
      setInboundTimer(0);
      setOutboundTimer(0);
      setLiveChatTimer(0);
      setIrSupportTimer(0);
      setBreakTimer(0);
      localStorage.setItem(`csp_${agentId}_timer_shift_date`, todayStr);
      localStorage.removeItem(`csp_${agentId}_shift_start_timestamp`);
      localStorage.setItem(`csp_${agentId}_accumulated_before`, '0');
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAgentLocalState(currentUser.id);
    }
  }, [currentUser?.id]);

  // Syncing operational local storage parameters
  useEffect(() => {
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    localStorage.setItem(`csp_${aid}_is_checked_in`, String(isCheckedIn));
    localStorage.setItem(`csp_${aid}_is_on_break`, String(isOnBreak));
    localStorage.setItem(`csp_${aid}_shift_start_time`, shiftStartTime || '');
    localStorage.setItem(`csp_${aid}_break_start_time`, breakStartTime || '');
    localStorage.setItem(`csp_${aid}_break_reason`, breakReason);
    localStorage.setItem(`csp_${aid}_current_activity`, currentActivity);

    localStorage.setItem(`csp_${aid}_timer_shift`, String(shiftTimer));
    localStorage.setItem(`csp_${aid}_timer_short_break`, String(shortBreakTimer));
    localStorage.setItem(`csp_${aid}_timer_meal_break`, String(mealBreakTimer));
    localStorage.setItem(`csp_${aid}_timer_prayer_break`, String(prayerBreakTimer));
    localStorage.setItem(`csp_${aid}_timer_meeting`, String(meetingTimer));

    localStorage.setItem(`csp_${aid}_timer_inbound`, String(inboundTimer));
    localStorage.setItem(`csp_${aid}_timer_outbound`, String(outboundTimer));
    localStorage.setItem(`csp_${aid}_timer_live_chat`, String(liveChatTimer));
    localStorage.setItem(`csp_${aid}_timer_ir_support`, String(irSupportTimer));
    localStorage.setItem(`csp_${aid}_timer_break_active`, String(breakTimer));
  }, [
    currentUser, isCheckedIn, isOnBreak, shiftStartTime, breakStartTime, breakReason, currentActivity,
    shiftTimer, shortBreakTimer, mealBreakTimer, prayerBreakTimer, meetingTimer,
    inboundTimer, outboundTimer, liveChatTimer, irSupportTimer, breakTimer
  ]);

  // Human readable timer formatter inside App.tsx
  const formatTime = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatCompactTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const playAudioAlert = (message: string) => {
    if (audioNotifications && typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(message);
        utterance.rate = 1.0;
        utterance.volume = 0.8;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("Speech synthesis failed:", e);
      }
    }
  };

  const updatePreferences = async (newPrefs: {
    isDarkMode?: boolean;
    autoClockIn?: boolean;
    audioNotifications?: boolean;
    defaultBreakReason?: string;
    compactSidebar?: boolean;
    showWarnings?: boolean;
    customAlias?: string;
  }) => {
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';

    if (newPrefs.autoClockIn !== undefined) {
      setAutoClockIn(newPrefs.autoClockIn);
      localStorage.setItem(`csp_${aid}_auto_clock_in`, String(newPrefs.autoClockIn));
    }
    if (newPrefs.audioNotifications !== undefined) {
      setAudioNotifications(newPrefs.audioNotifications);
      localStorage.setItem(`csp_${aid}_audio_notifications`, String(newPrefs.audioNotifications));
    }
    if (newPrefs.defaultBreakReason !== undefined) {
      setBreakReason(newPrefs.defaultBreakReason);
      localStorage.setItem(`csp_${aid}_break_reason`, newPrefs.defaultBreakReason);
    }
    if (newPrefs.compactSidebar !== undefined) {
      setCompactSidebar(newPrefs.compactSidebar);
      setIsSidebarCollapsed(newPrefs.compactSidebar);
      localStorage.setItem(`csp_${aid}_compact_sidebar`, String(newPrefs.compactSidebar));
      localStorage.setItem('csp_sidebar_collapsed', String(newPrefs.compactSidebar));
    }
    if (newPrefs.showWarnings !== undefined) {
      setShowWarnings(newPrefs.showWarnings);
      localStorage.setItem(`csp_${aid}_show_warnings`, String(newPrefs.showWarnings));
    }
    if (newPrefs.customAlias !== undefined) {
      const aliasVal = newPrefs.customAlias;
      setCustomAlias(aliasVal);
      localStorage.setItem(`csp_${aid}_custom_alias`, aliasVal);
      if (aliasVal.trim()) {
        setAgentName(aliasVal.trim());
        localStorage.setItem('csp_agent_name', aliasVal.trim());
      } else {
        const found = AGENTS_LIST.find(a => a.name === (currentUser?.name || localStorage.getItem('csp_agent_name')));
        if (found) {
          setAgentName(found.name);
          localStorage.setItem('csp_agent_name', found.name);
        }
      }
    }

    if (user) {
      try {
        await savePersonalPreferences(aid, {
          autoClockIn: newPrefs.autoClockIn !== undefined ? newPrefs.autoClockIn : autoClockIn,
          audioNotifications: newPrefs.audioNotifications !== undefined ? newPrefs.audioNotifications : audioNotifications,
          defaultBreakReason: newPrefs.defaultBreakReason !== undefined ? newPrefs.defaultBreakReason : breakReason,
          compactSidebar: newPrefs.compactSidebar !== undefined ? newPrefs.compactSidebar : compactSidebar,
          showWarnings: newPrefs.showWarnings !== undefined ? newPrefs.showWarnings : showWarnings,
          customAlias: newPrefs.customAlias !== undefined ? newPrefs.customAlias : customAlias,
        });
      } catch (err) {
        console.error("Failed to sync personal preferences to Firestore:", err);
      }
    }
  };

  const handleHeaderToggleBreak = async (breakType: 'Short Break' | 'Meal Break' | 'Prayer Break' | 'Meeting' | 'Available') => {
    if (!isCheckedIn) return;
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';

    if (breakType === 'Available') {
      setIsOnBreak(false);
      setAgentStatus('AVAILABLE');
      setCurrentActivity('available');
      logActivity(`Agent "${agentName}" returned from break and marked AVAILABLE.`);

      const breakId = localStorage.getItem(`csp_${aid}_current_break_id`);
      const startIso = localStorage.getItem(`csp_${aid}_current_break_start`) || new Date().toISOString();
      const durationSecs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
      if (breakId) {
        try {
          await upsertBreak({
            id: breakId,
            agentId: aid,
            agentName: agentName || 'System Agent',
            startTime: startIso,
            reason: breakReason,
            status: 'completed',
            endTime: new Date().toISOString(),
            duration: durationSecs
          });
        } catch (e) {
          console.error("Failed to update break: ", e);
        }
      }
      localStorage.removeItem(`csp_${aid}_current_break_id`);
      localStorage.removeItem(`csp_${aid}_current_break_start`);
      
      await upsertSessionToFirebase('available', 'available');
    } else {
      setIsOnBreak(true);
      setAgentStatus('ON BREAK');
      setCurrentActivity(breakType);
      logActivity(`Agent "${agentName}" went on: ${breakType}.`);

      const breakId = `${aid}_${Date.now()}`;
      localStorage.setItem(`csp_${aid}_current_break_id`, breakId);
      localStorage.setItem(`csp_${aid}_current_break_start`, new Date().toISOString());

      try {
        await upsertBreak({
          id: breakId,
          agentId: aid,
          agentName: agentName || 'System Agent',
          startTime: new Date().toISOString(),
          reason: breakType,
          status: 'active'
        });
      } catch (e) {
        console.error("Failed to start break: ", e);
      }
      
      let firestoreStatus: 'on_break' | 'available' = 'on_break';
      await upsertSessionToFirebase(breakType, firestoreStatus);
    }
  };

  const getActiveBreakTimerVal = () => {
    const act = currentActivity ? currentActivity.toLowerCase().replace(/[\s_-]+/g, '_') : '';
    if (act === 'short_break') return shortBreakTimer;
    if (act === 'meal_break') return mealBreakTimer;
    if (act === 'prayer_break') return prayerBreakTimer;
    if (act === 'meeting' || act === 'meeting_training' || act === 'meeting_rest') return meetingTimer;
    return 0;
  };

  const handleHeaderCheckIn = async () => {
    const startStr = new Date().toISOString();
    setIsCheckedIn(true);
    setShiftStartTime(startStr);
    setAgentStatus('AVAILABLE');
    setCurrentActivity('available');
    
    // Check if we should keep today's accumulated shift timer
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const todayStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') + '-' + String(new Date().getDate()).padStart(2, '0');
    const savedDate = localStorage.getItem(`csp_${aid}_timer_shift_date`);
    let currentShiftTime = 0;
    if (savedDate === todayStr) {
      currentShiftTime = Number(localStorage.getItem(`csp_${aid}_timer_shift`) || '0');
    } else {
      localStorage.setItem(`csp_${aid}_timer_shift_date`, todayStr);
    }
    
    localStorage.setItem(`csp_${aid}_shift_start_timestamp`, String(Date.now()));
    localStorage.setItem(`csp_${aid}_accumulated_before`, String(currentShiftTime));
    setShiftTimer(currentShiftTime);

    logActivity(`Agent "${agentName}" checked in and clocked duty shift on.`);
    await upsertSessionToFirebase('available', 'available', currentShiftTime);
  };

  const [showHeaderClockOffConfirm, setShowHeaderClockOffConfirm] = useState(false);

  const handleHeaderCheckOut = async () => {
    setShowHeaderClockOffConfirm(true);
  };

  const executeHeaderCheckOut = async () => {
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    setIsCheckedIn(false);
    setShiftStartTime(null);
    setAgentStatus('OFFLINE');
    setCurrentActivity('offline');
    setIsOnBreak(false);

    // Save exact accumulated shift timer
    const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
    const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
    let finalShift = shiftTimer;
    if (startTs > 0) {
      finalShift = accum + Math.floor((Date.now() - startTs) / 1000);
    }
    localStorage.setItem(`csp_${aid}_timer_shift`, String(finalShift));
    localStorage.setItem(`csp_${aid}_accumulated_before`, String(finalShift));
    localStorage.removeItem(`csp_${aid}_shift_start_timestamp`);
    setShiftTimer(finalShift);

    logActivity(`Agent "${agentName}" checked out and clocked duty shift off.`);
    await upsertSessionToFirebase('offline', 'offline', finalShift);
    setShowHeaderClockOffConfirm(false);
  };

  const handleHeaderActivityChange = async (target: string) => {
    if (!isCheckedIn) return;
    if (target === 'Available' || target === 'available') {
      if (isOnBreak) {
        setIsOnBreak(false);
        setAgentStatus('AVAILABLE');
        setCurrentActivity('available');
        logActivity(`Agent "${agentName}" returned from break and marked AVAILABLE.`);
        await upsertSessionToFirebase('available', 'available');
      } else {
        setCurrentActivity('available');
        logActivity(`Agent "${agentName}" changed active target division to: STANDBY`);
        await upsertSessionToFirebase('available', 'available');
      }
    } else {
      if (isOnBreak) {
        setIsOnBreak(false);
        setAgentStatus('AVAILABLE');
      }
      setCurrentActivity(target);
      logActivity(`Agent "${agentName}" changed active target division to: ${target.toUpperCase()}`);
      await upsertSessionToFirebase(target, 'available');
    }
  };

  // Real-time Lists (Firebase synchronized & offline fallback)
  const [liveAgentSessions, setLiveAgentSessions] = useState<LiveAgentSession[]>([]);
  const [liveBreaks, setLiveBreaks] = useState<any[]>([]);

  // Local state directory mock data loading/storing
  const [contacts, setContacts] = useState<CRMContact[]>(() => {
    const saved = localStorage.getItem('csp_contacts');
    return saved ? JSON.parse(saved) : INITIAL_CONTACTS;
  });

  useEffect(() => {
    localStorage.setItem('csp_contacts', JSON.stringify(contacts));
  }, [contacts]);

  const [tickets, setTickets] = useState<SupportTicket[]>(() => {
    const saved = localStorage.getItem('csp_tickets');
    return saved ? JSON.parse(saved) : INITIAL_TICKETS;
  });

  useEffect(() => {
    localStorage.setItem('csp_tickets', JSON.stringify(tickets));
  }, [tickets]);

  const [kbArticles, setKbArticles] = useState<KBArticle[]>(() => {
    const saved = localStorage.getItem('csp_kb_articles');
    if (saved) {
      try {
        let parsed: KBArticle[] = JSON.parse(saved);
        // Exclude old template legacy/demo articles (e.g. Acme SLA onboarding)
        // We preserve PalmPay articles (kb-palmpay-*) and user-created custom articles (kb-[timestamp])
        parsed = parsed.filter(a => {
          if (a.id.startsWith('kb-palmpay-')) return true;
          if (/^kb-\d{10,}/.test(a.id)) return true;
          return false;
        });
        // Dynamically refresh PalmPay template articles to update categories/content
        parsed = parsed.map(a => {
          if (a.id.startsWith('kb-palmpay-')) {
            const fresh = INITIAL_KB_ARTICLES.find(f => f.id === a.id);
            if (fresh) return fresh;
          }
          return a;
        });
        const parsedIds = new Set(parsed.map(a => a.id));
        const missing = INITIAL_KB_ARTICLES.filter(a => !parsedIds.has(a.id));
        if (missing.length > 0) {
          return [...parsed, ...missing];
        }
        return parsed;
      } catch (e) {
        console.error("Error parsing local KB articles, resetting to defaults", e);
        return INITIAL_KB_ARTICLES;
      }
    }
    return INITIAL_KB_ARTICLES;
  });

  useEffect(() => {
    localStorage.setItem('csp_kb_articles', JSON.stringify(kbArticles));
  }, [kbArticles]);

  // Roster Seed parameters
  const [currentRosterYear, setCurrentRosterYear] = useState<number>(2026);
  const [currentRosterMonth, setCurrentRosterMonth] = useState<number>(6); // July (0-indexed)
  const [rosterSeed, setRosterSeed] = useState<number>(() => {
    return Number(localStorage.getItem('csp_roster_seed') || '0');
  });

  const generateMathematicalRoster = (yearNum = 2026, monthNum = 6, seed = 0): RosterDay[] => {
    const numDays = new Date(yearNum, monthNum + 1, 0).getDate();
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    let sortedAgents = [...AGENTS_LIST];
    if (seed > 0) {
      for (let i = sortedAgents.length - 1; i > 0; i--) {
        const j = (seed * 9301 + 49297) % 233280 % (i + 1);
        const temp = sortedAgents[i];
        sortedAgents[i] = sortedAgents[j];
        sortedAgents[j] = temp;
      }
    }

    const allAgentNames = sortedAgents.map(a => a.name);

    const getOffDaysForBlock = (blockIndex: number, seedNum: number): Map<string, number> => {
      let blockAgents = [...sortedAgents];
      const combinedSeed = seedNum + blockIndex * 17 + 101;
      for (let i = blockAgents.length - 1; i > 0; i--) {
        const j = (combinedSeed * 9301 + 49297) % 233280 % (i + 1);
        const temp = blockAgents[i];
        blockAgents[i] = blockAgents[j];
        blockAgents[j] = temp;
      }
      
      const map = new Map<string, number>();
      blockAgents.forEach((agent, index) => {
        map.set(agent.name, index % 7);
      });
      return map;
    };

    const roster: RosterDay[] = [];
    
    for (let day = 1; day <= numDays; day++) {
      const date = new Date(yearNum, monthNum, day);
      const dateStr = `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeekName = daysOfWeek[date.getDay()];
      
      const blockIndex = Math.floor((day - 1) / 7);
      const dayOffset = (day - 1) % 7;
      
      const blockOffMap = getOffDaysForBlock(blockIndex, seed);
      
      const off = allAgentNames.filter(name => blockOffMap.get(name) === dayOffset);
      const activeAgents = allAgentNames.filter(name => blockOffMap.get(name) !== dayOffset);
      
      const activeMales = activeAgents.filter(name => {
        const agentObj = sortedAgents.find(a => a.name === name);
        return agentObj ? agentObj.isMale : false;
      });
      
      const nightIndex = (day * 3 + seed * 11) % activeMales.length;
      const nightShifts = [
        activeMales[nightIndex],
        activeMales[(nightIndex + 1) % activeMales.length]
      ];
      
      const remainingActive = activeAgents.filter(name => !nightShifts.includes(name));
      
      const dayRotateSeed = seed + day * 31;
      let shuffledActive = [...remainingActive];
      for (let i = shuffledActive.length - 1; i > 0; i--) {
        const j = (dayRotateSeed * 9301 + 49297) % 233280 % (i + 1);
        const temp = shuffledActive[i];
        shuffledActive[i] = shuffledActive[j];
        shuffledActive[j] = temp;
      }
      
      const morning = shuffledActive.slice(0, 3);
      const standardDay = shuffledActive.slice(3, 8);
      const afternoon = shuffledActive.slice(8, 16);
      
      const remainingForLateAndEvening = shuffledActive.slice(16);
      const half = Math.floor(remainingForLateAndEvening.length / 2);
      const lateDay = remainingForLateAndEvening.slice(0, half);
      const evening = remainingForLateAndEvening.slice(half);
      
      roster.push({
        id: `roster-${dateStr}`,
        date: dateStr,
        dayOfWeek: dayOfWeekName,
        shifts: {
          morning,
          standardDay,
          lateDay,
          afternoon,
          evening,
          night: nightShifts,
          off
        },
        notes: `Dynamic weekly off-day rotation active. All agents get exactly 1 rest day/week.`,
        isAutoGenerated: true,
      });
    }
    
    return roster;
  };

  const generateAutoRoster = (yearNum = 2026, monthNum = 6, seed = 0): RosterDay[] => {
    if (yearNum === 2026 && monthNum === 6 && seed === 0) {
      return parsePastedRoster(yearNum, monthNum, generateMathematicalRoster);
    }
    return generateMathematicalRoster(yearNum, monthNum, seed);
  };

  const [rosterDays, setRosterDays] = useState<RosterDay[]>(() => {
    try {
      const saved = localStorage.getItem('csp_roster_days');
      const pastedVersionLoaded = localStorage.getItem('csp_pasted_v2_loaded') === 'true';
      if (saved && pastedVersionLoaded) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].shifts && parsed[0].shifts.morning) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error parsing roster days from local storage", e);
    }
    localStorage.setItem('csp_pasted_v2_loaded', 'true');
    return generateAutoRoster(2026, 6, 0);
  });

  useEffect(() => {
    localStorage.setItem('csp_roster_days', JSON.stringify(rosterDays));
  }, [rosterDays]);

  const [connectedSpreadsheetId, setConnectedSpreadsheetId] = useState<string>(() => {
    return localStorage.getItem('csp_roster_spreadsheet_id') || '1uIWNqo9UEV2AENgJuWUPU5mprS2rha4T62eQAFTu360';
  });

  const [connectedSpreadsheetUrl, setConnectedSpreadsheetUrl] = useState<string>(() => {
    return localStorage.getItem('csp_roster_spreadsheet_url') || 'https://docs.google.com/spreadsheets/d/1uIWNqo9UEV2AENgJuWUPU5mprS2rha4T62eQAFTu360/edit';
  });

  useEffect(() => {
    localStorage.setItem('csp_roster_spreadsheet_id', connectedSpreadsheetId);
    localStorage.setItem('csp_roster_spreadsheet_url', connectedSpreadsheetUrl);
  }, [connectedSpreadsheetId, connectedSpreadsheetUrl]);

  // Action / Sync state logs
  const [systemLogs, setSystemLogs] = useState<{ message: string; timestamp: string }[]>(() => {
    const saved = localStorage.getItem('csp_system_logs');
    return saved ? JSON.parse(saved) : [];
  });

  // Firebase Real-time Activity Logs state & tracking refs
  const [activityLogs, setActivityLogs] = useState<ActivityLogEvent[]>([]);
  const lastLoggedStatusRef = useRef<string>('');
  const lastLoggedActivityRef = useRef<string>('');

  const logActivity = (message: string) => {
    const newLog = { message, timestamp: new Date().toLocaleTimeString() };
    setSystemLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 100);
      localStorage.setItem('csp_system_logs', JSON.stringify(updated));
      return updated;
    });
  };

  // Google sheet automatic roster sync when connected
  useEffect(() => {
    const autoFetchRoster = async () => {
      if (connectedSpreadsheetId && token) {
        try {
          const syncedDays = await fetchRosterFromSheet(token, connectedSpreadsheetId);
          if (syncedDays && syncedDays.length > 0) {
            setRosterDays(syncedDays);
            logActivity("Fetched live roster allocations from Google Sheets.");
          }
        } catch (err: any) {
          console.error("Failed to automatically sync roster from Google Sheet", err);
          const errMsg = err?.message || String(err);
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("Request had invalid authentication credentials") || 
                              errMsg.includes("UNAUTHENTICATED") || 
                              errMsg.includes("401");
          if (isAuthError) {
            setToken(null);
            sessionStorage.removeItem('_g_w_token_');
            logActivity("⚠️ Google Sheets API token is invalid or has expired. Gracefully disconnected; please re-authenticate.");
          } else {
            logActivity(`⚠️ Workspace API offline. Using cached Local Storage roster: ${errMsg}`);
          }
        }
      }
    };
    autoFetchRoster();
  }, [connectedSpreadsheetId, token, isPortalLoggedIn]);

  // Standard interval ticking
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Timer trackers for active states
  useEffect(() => {
    let timerInterval: NodeJS.Timeout | null = null;
    if (isCheckedIn) {
      timerInterval = setInterval(() => {
        const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
        const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
        const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
        if (startTs > 0) {
          const newShiftVal = accum + Math.floor((Date.now() - startTs) / 1000);
          setShiftTimer(newShiftVal);
          localStorage.setItem(`csp_${aid}_timer_shift`, String(newShiftVal));
        } else {
          setShiftTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_shift`, String(next));
            return next;
          });
        }

        const act = currentActivity ? currentActivity.toLowerCase().replace(/[\s_-]+/g, '_') : '';
        if (act === 'inbound' || act === 'inbound_call' || act === 'inbound_queue') {
          setInboundTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_inbound`, String(next));
            return next;
          });
        } else if (act === 'outbound' || act === 'outbound_call' || act === 'outbound_campaign') {
          setOutboundTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_outbound`, String(next));
            return next;
          });
        } else if (act === 'live_chat' || act === 'live_chat_queue') {
          setLiveChatTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_live_chat`, String(next));
            return next;
          });
        } else if (act === 'ir_support' || act === 'incident_management') {
          setIrSupportTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_ir_support`, String(next));
            return next;
          });
        } else if (act === 'short_break') {
          setShortBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_short_break`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        } else if (act === 'meal_break') {
          setMealBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_meal_break`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        } else if (act === 'prayer_break') {
          setPrayerBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_prayer_break`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        } else if (act === 'meeting' || act === 'meeting_training' || act === 'meeting_rest') {
          setMeetingTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_meeting`, String(next));
            return next;
          });
          setBreakTimer((prev) => {
            const next = prev + 1;
            localStorage.setItem(`csp_${aid}_timer_break_active`, String(next));
            return next;
          });
        }
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [isCheckedIn, currentActivity, currentUser]);

  // Auth initialization handler
  useEffect(() => {
    const unsubscribe = initAuth(
      (firebaseUser, accessToken) => {
        setUser(firebaseUser);
        if (accessToken) setToken(accessToken);
      },
      () => {
        setUser(null);
        setToken(null);
        if (localStorage.getItem('csp_portal_logged_in') === 'true') {
          signInAnonymouslyIfNeeded();
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // Google Sheets credentials sync logic
  useEffect(() => {
    const autoSyncCredentials = async () => {
      if (token && connectedSpreadsheetId && isPortalLoggedIn) {
        try {
          const fetched = await fetchAgentCredentialsFromSheet(token, connectedSpreadsheetId, AGENTS_LIST);
          if (fetched && fetched.length > 0) {
            setAgentCredentials(fetched);
            logActivity("Successfully fetched agent credentials sheet list from Google Sheets.");
          }
        } catch (err: any) {
          console.error("Failed to fetch agent credentials:", err);
          const errMsg = err?.message || String(err);
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("Request had invalid authentication credentials") || 
                              errMsg.includes("UNAUTHENTICATED") || 
                              errMsg.includes("401");
          if (isAuthError) {
            setToken(null);
            sessionStorage.removeItem('_g_w_token_');
            logActivity("⚠️ Google Sheets API token is invalid or has expired. Gracefully disconnected; please re-authenticate.");
          } else {
            logActivity(`⚠️ Workspace API offline. Using cached Local Storage agent credentials: ${errMsg}`);
          }
        }
      }
    };
    autoSyncCredentials();
  }, [token, connectedSpreadsheetId, isPortalLoggedIn]);

  // Real-time EventSource (SSE) & BroadcastChannel sync across all tabs and browser sessions
  useEffect(() => {
    if (!isPortalLoggedIn) return;

    // Helper to merge incoming session list into liveAgentSessions state
    const mergeSessions = (incomingList: LiveAgentSession[]) => {
      setLiveAgentSessions((prev) => {
        const sessionMap = new Map<string, LiveAgentSession>();
        // Add existing
        prev.forEach((s) => {
          const key = s.agentId || s.id;
          if (key) sessionMap.set(key, s);
        });
        // Merge incoming
        incomingList.forEach((s) => {
          const key = s.agentId || s.id;
          if (key) {
            sessionMap.set(key, { ...sessionMap.get(key), ...s });
          }
        });
        return Array.from(sessionMap.values());
      });
    };

    // 1. Initial fetch from Realtime API backend
    const token = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';
    if (token) {
      fetch('/api/realtime/sessions', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.sessions && Array.isArray(data.sessions)) {
            mergeSessions(data.sessions);
          }
        })
        .catch((err) => console.warn('Failed to fetch initial realtime sessions:', err));
    }

    // 2. Connect SSE EventSource stream
    let eventSource: EventSource | null = null;
    if (token) {
      try {
        eventSource = new EventSource(`/api/realtime/stream?token=${encodeURIComponent(token)}`);
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.sessions && Array.isArray(data.sessions)) {
              mergeSessions(data.sessions);
            } else if (data.payload) {
              mergeSessions([data.payload]);
            }
          } catch (e) {
            console.error('Error parsing SSE event data:', e);
          }
        };
        eventSource.onerror = (err) => {
          console.warn('SSE stream connection warning:', err);
        };
      } catch (e) {
        console.warn('EventSource error:', e);
      }
    }

    // 3. Connect BroadcastChannel for instant local cross-tab communication
    let channel: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      channel = new BroadcastChannel('csp_realtime_clock');
      channel.onmessage = (event) => {
        if (event.data && event.data.session) {
          mergeSessions([event.data.session]);
        }
      };
    }

    return () => {
      if (eventSource) eventSource.close();
      if (channel) channel.close();
    };
  }, [isPortalLoggedIn]);

  // Real-time Firestore sync listeners
  useEffect(() => {
    if (!isPortalLoggedIn || !user) return;

    // Listen to live agent floor statuses
    const unsubscribeSessions = listenToSessions((sessionsList) => {
      setLiveAgentSessions((prev) => {
        const sessionMap = new Map<string, LiveAgentSession>();
        prev.forEach((s) => {
          const key = s.agentId || s.id;
          if (key) sessionMap.set(key, s);
        });
        sessionsList.forEach((s) => {
          const key = s.agentId || s.id;
          if (key) sessionMap.set(key, { ...sessionMap.get(key), ...s });
        });
        return Array.from(sessionMap.values());
      });
    });

    // Listen to live break records
    const unsubscribeBreaks = listenToBreaks((breaksList) => {
      setLiveBreaks(breaksList);
    });

    // Listen to real-time activity transition logs
    const unsubscribeActivityLogs = listenToActivityLogs((logsList) => {
      setActivityLogs(logsList);
    });

    return () => {
      unsubscribeSessions();
      unsubscribeBreaks();
      unsubscribeActivityLogs();
    };
  }, [isPortalLoggedIn, user]);

  // Restore persistent clock-in session on page reload or tab load
  useEffect(() => {
    if (!isPortalLoggedIn) return;
    const aid = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const isClockedInSaved = localStorage.getItem(`csp_${aid}_is_clocked_in`) === 'true';
    const savedClockInTime = localStorage.getItem(`csp_${aid}_clock_in_time`);

    if (isClockedInSaved) {
      setIsCheckedIn(true);
      if (savedClockInTime) {
        setShiftStartTime(savedClockInTime);
      }
      // Calculate current shift timer
      const startTs = Number(localStorage.getItem(`csp_${aid}_shift_start_timestamp`) || '0');
      const accum = Number(localStorage.getItem(`csp_${aid}_accumulated_before`) || '0');
      if (startTs > 0) {
        const elapsed = Math.floor((Date.now() - startTs) / 1000);
        setShiftTimer(accum + elapsed);
      }
      
      // Sync status to real-time server & broadcast
      upsertSessionToFirebase(currentActivity || 'available', isOnBreak ? 'on_break' : 'available');
    }
  }, [isPortalLoggedIn, currentUser?.id]);

  // Synchronize Google spreadsheet ID/URL from Firestore config across all agents
  useEffect(() => {
    if (!isPortalLoggedIn || !user) return;

    const unsubscribe = listenToSpreadsheetConfig((config) => {
      if (config && config.spreadsheetId) {
        setConnectedSpreadsheetId(config.spreadsheetId);
        if (config.spreadsheetUrl) {
          setConnectedSpreadsheetUrl(config.spreadsheetUrl);
        }
      }
    });

    return () => unsubscribe();
  }, [isPortalLoggedIn, user]);

  // Synchronize Personal Preferences from Firestore
  useEffect(() => {
    if (!isPortalLoggedIn || !user || !currentUser) return;

    const unsubscribe = listenToPersonalPreferences(currentUser.id, (prefs) => {
      if (prefs) {
        setAutoClockIn(prefs.autoClockIn);
        setAudioNotifications(prefs.audioNotifications);
        setBreakReason(prefs.defaultBreakReason);
        setCompactSidebar(prefs.compactSidebar);
        setIsSidebarCollapsed(prefs.compactSidebar);
        setShowWarnings(prefs.showWarnings);
        setCustomAlias(prefs.customAlias);
        
        // Write back to local storage
        const aid = currentUser.id;
        localStorage.setItem(`csp_${aid}_is_dark_mode`, String(prefs.isDarkMode));
        localStorage.setItem('theme_preference', prefs.isDarkMode ? 'dark' : 'light');
        localStorage.setItem(`csp_${aid}_auto_clock_in`, String(prefs.autoClockIn));
        localStorage.setItem(`csp_${aid}_audio_notifications`, String(prefs.audioNotifications));
        localStorage.setItem(`csp_${aid}_break_reason`, prefs.defaultBreakReason);
        localStorage.setItem(`csp_${aid}_compact_sidebar`, String(prefs.compactSidebar));
        localStorage.setItem('csp_sidebar_collapsed', String(prefs.compactSidebar));
        localStorage.setItem(`csp_${aid}_show_warnings`, String(prefs.showWarnings));
        localStorage.setItem(`csp_${aid}_custom_alias`, prefs.customAlias);
        if (prefs.customAlias.trim()) {
          setAgentName(prefs.customAlias.trim());
          localStorage.setItem('csp_agent_name', prefs.customAlias.trim());
        }
      }
    });

    return () => unsubscribe();
  }, [isPortalLoggedIn, user, currentUser?.id]);

  // Centralized Firebase real-time status writers
  const upsertSessionToFirebase = async (
    activityName: string, 
    statusName: 'available' | 'on_break' | 'offline',
    sTimer?: number,
    bTimer?: number
  ) => {
    const currentAgentId = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id') || 'agent01';
    const name = agentName || 'System Agent';

    // Retrieve active timer values for the session record
    const finalShiftTimer = sTimer !== undefined ? sTimer : (Number(localStorage.getItem(`csp_${currentAgentId}_timer_shift`) || '0') || shiftTimer);
    const finalBreakTimer = bTimer !== undefined ? bTimer : (Number(localStorage.getItem(`csp_${currentAgentId}_timer_break_active`) || '0') || breakTimer);

    const clockInTime = localStorage.getItem(`csp_${currentAgentId}_clock_in_time`) || localStorage.getItem(`csp_${currentAgentId}_login_time`) || new Date().toISOString();
    const deviceInfo = `${navigator.platform || 'Browser'} (${navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Client'})`;

    const sessionData: LiveAgentSession = {
      id: currentAgentId,
      agentId: currentAgentId,
      name,
      loginTime: localStorage.getItem(`csp_${currentAgentId}_login_time`) || localStorage.getItem('csp_login_time') || new Date().toISOString(),
      clockInTime,
      status: statusName,
      currentActivity: activityName,
      lastActive: new Date().toISOString(),
      shiftTimer: finalShiftTimer,
      breakTimer: finalBreakTimer,
      deviceInfo,
      ipInfo: '127.0.0.1'
    };

    // 1. Post to Express Realtime Server endpoints
    const endpoint = statusName === 'offline' 
      ? '/api/realtime/clock-out' 
      : (statusName === 'available' && activityName === 'available' ? '/api/realtime/clock-in' : '/api/realtime/status-update');

    const reqToken = sessionStorage.getItem('csp_session_token') || localStorage.getItem('csp_session_token') || '';

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${reqToken}`
      },
      body: JSON.stringify({
        token: reqToken,
        agentId: currentAgentId,
        name,
        clockInTime,
        status: statusName,
        currentActivity: activityName,
        shiftTimer: finalShiftTimer,
        breakTimer: finalBreakTimer,
        deviceInfo,
        finalShiftTimer
      })
    }).catch((err) => console.warn('Realtime API sync notice:', err));

    // 2. Broadcast across local browser windows/tabs
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const bc = new BroadcastChannel('csp_realtime_clock');
        bc.postMessage({ session: sessionData });
        bc.close();
      } catch (e) {
        console.warn('BroadcastChannel notice:', e);
      }
    }

    try {
      // Write to Firestore collection instantly
      await upsertSession(sessionData);
    } catch (err) {
      console.error("Firestore real-time write error: ", err);
    }

    // 3. Log Granular Activity Event to Firebase Firestore with second-level precision timestamp
    const prevStatus = lastLoggedStatusRef.current || 'offline';
    const prevActivity = lastLoggedActivityRef.current || 'offline';

    if (prevStatus !== statusName || prevActivity !== activityName) {
      let eventType: 'CLOCK_IN' | 'CLOCK_OUT' | 'BREAK_START' | 'BREAK_END' | 'DUTY_CHANGE' | 'STATUS_UPDATE' = 'STATUS_UPDATE';
      if (statusName === 'offline') {
        eventType = 'CLOCK_OUT';
      } else if (statusName === 'on_break' && prevStatus !== 'on_break') {
        eventType = 'BREAK_START';
      } else if (prevStatus === 'on_break' && statusName === 'available') {
        eventType = 'BREAK_END';
      } else if (prevStatus === 'offline' && statusName === 'available') {
        eventType = 'CLOCK_IN';
      } else if (prevActivity !== activityName) {
        eventType = 'DUTY_CHANGE';
      }

      const now = new Date();
      logActivityEvent({
        agentId: currentAgentId,
        agentName: name,
        eventType,
        previousStatus: prevStatus,
        newStatus: statusName,
        previousActivity: prevActivity,
        newActivity: activityName,
        timestamp: now.toISOString(),
        formattedTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
        shiftTimerSeconds: finalShiftTimer,
        breakTimerSeconds: finalBreakTimer,
        deviceInfo
      });

      lastLoggedStatusRef.current = statusName;
      lastLoggedActivityRef.current = activityName;
    }

    // Sheet log syncing in the background asynchronously so the UI never lags or freezes
    if (token && connectedSpreadsheetId) {
      (async () => {
        try {
          await appendRowToSheet(
            token,
            connectedSpreadsheetId,
            'ShiftLogs',
            [name, activityName, statusName, new Date().toISOString()],
            ['Agent Name', 'Work Category', 'Availability Status', 'Timestamp']
          );
        } catch (err: any) {
          console.error("Sheet append state failure: ", err);
          const errMsg = err?.message || String(err);
          const isAuthError = errMsg.includes("invalid authentication credentials") || 
                              errMsg.includes("Request had invalid authentication credentials") || 
                              errMsg.includes("UNAUTHENTICATED") || 
                              errMsg.includes("401");
          if (isAuthError) {
            setToken(null);
            sessionStorage.removeItem('_g_w_token_');
            logActivity("⚠️ Google Sheets API token is invalid or has expired. Gracefully disconnected; please re-authenticate.");
          } else {
            logActivity(`⚠️ Workspace API offline. Failed to log activity to Google Sheet: ${errMsg}`);
          }
        }
      })();
    }
  };

  // Sign-in with Google trigger
  const handleGoogleSignIn = async () => {
    setIsAuthGatewayOpen(true);
  };

  const handleGoogleSignInSuccess = (loggedInUser: User, accessToken: string) => {
    setUser(loggedInUser);
    setToken(accessToken);
    setShowAuthWarning(false);
    logActivity(`Connected Google Workspace API account: ${loggedInUser.email}`);
  };

  const flushPreviousLocalState = () => {
    setTickets(INITIAL_TICKETS);
    setContacts(INITIAL_CONTACTS);
    setSystemLogs([]);

    localStorage.removeItem('csp_contacts');
    localStorage.removeItem('csp_tickets');
    localStorage.removeItem('csp_system_logs');
  };

  const handlePortalLogout = async () => {
    // Flush current daily duration before logging out
    if (currentUser?.id && sessionStartTimestamp > 0) {
      const elapsed = Math.floor((Date.now() - sessionStartTimestamp) / 1000);
      const finalSecs = accumulatedToday + Math.max(0, elapsed);
      try {
        await saveDailyDurationDoc({
          agentId: currentUser.id,
          date: activeDateStr,
          totalSeconds: finalSecs,
          sessionStartTimestamp: Date.now(),
          lastUpdatedISO: new Date().toISOString()
        });
      } catch (e) {
        console.warn("Failed to flush duration on logout:", e);
      }
    }

    const savedId = currentUser?.id || localStorage.getItem('csp_logged_in_agent_id');
    if (savedId) {
      try {
        await deleteSession(savedId);
      } catch (e) {
        console.error("Error clearing Firebase session: ", e);
      }
    }
    try {
      await logout();
    } catch (e) {
      console.error(e);
    }
    flushPreviousLocalState();
    sessionStorage.removeItem('csp_session_token');
    localStorage.removeItem('csp_session_token');
    sessionStorage.removeItem('csp_session_id');
    localStorage.removeItem('csp_session_id');
    localStorage.removeItem('csp_portal_logged_in');
    localStorage.removeItem('csp_user_role');
    setUser(null);
    setToken(null);
    setCurrentUser(null);
    setCurrentSessionId('');
    setIsPortalLoggedIn(false);
  };

  // Renders the Login Identity Gate if not authenticated
  if (!isPortalLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 font-sans flex flex-col items-center justify-center p-4 relative antialiased select-none transition-colors duration-300">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-[380px] flex flex-col items-center"
          id="unified_login_portal_card"
        >
          {/* Main Title matching exact screenshot */}
          <h1 className="text-2xl sm:text-3xl font-bold text-[#1E293B] dark:text-slate-100 tracking-tight text-center mb-8 font-sans">
            Customer CRM Portal
          </h1>

          {/* Access Switcher (Agent vs Admin) */}
          <div className="w-full bg-white dark:bg-[#0e1526] border border-gray-200 dark:border-slate-800 rounded-lg p-1 mb-6 flex items-center justify-between text-xs shadow-2xs">
            <div className="grid grid-cols-2 gap-1 w-full">
              <button
                type="button"
                onClick={() => {
                  setLoginRole('AGENT');
                  setLoginAgentId('');
                  setLoginAgentPass('');
                  setLoginError('');
                }}
                className={`py-1.5 px-3 rounded-md font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  loginRole === 'AGENT'
                    ? 'bg-[#6A00D1] text-white shadow-2xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 bg-transparent'
                }`}
                id="role_tab_agent"
              >
                <Users className="w-3.5 h-3.5" />
                AGENT ACCESS
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginRole('ADMIN');
                  setLoginAdminUser('');
                  setLoginAdminPass('');
                  setLoginError('');
                }}
                className={`py-1.5 px-3 rounded-md font-semibold text-[11px] transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  loginRole === 'ADMIN'
                    ? 'bg-[#6A00D1] text-white shadow-2xs'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 bg-transparent'
                }`}
                id="role_tab_admin"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                ADMIN ACCESS
              </button>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setLoginError('');
              flushPreviousLocalState();

              const targetRole = loginRole;
              const username = loginRole === 'AGENT' ? loginAgentId : loginAdminUser;
              const password = loginRole === 'AGENT' ? loginAgentPass : loginAdminPass;

              if (!username.trim() || !password.trim()) {
                setLoginError('Username and password are required.');
                return;
              }

              try {
                const deviceType = detectDeviceType();
                const res = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    username: username.trim(),
                    password: password.trim(),
                    role: targetRole,
                    clientDeviceType: deviceType
                  })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                  setLoginError(data.error || 'Invalid credentials.');
                  return;
                }

                sessionStorage.setItem('csp_session_token', data.sessionToken);
                localStorage.setItem('csp_session_token', data.sessionToken);
                if (data.sessionId) {
                  sessionStorage.setItem('csp_session_id', data.sessionId);
                  localStorage.setItem('csp_session_id', data.sessionId);
                  setCurrentSessionId(data.sessionId);
                }
                localStorage.setItem('csp_device_type', data.deviceType || deviceType);
                setCurrentDeviceType(data.deviceType || deviceType);

                localStorage.setItem('csp_agent_name', data.user.name);
                localStorage.setItem('csp_logged_in_agent_id', data.user.id);
                localStorage.setItem('csp_user_role', data.user.role);
                localStorage.setItem('csp_login_time', new Date().toISOString());

                setAgentName(data.user.name);
                setUserRole(data.user.role);
                setCurrentUser(data.user);
                setIsPortalLoggedIn(true);

                // Hydrate daily duration record from Firestore for this agent
                const todayStr = getUtcDateStr();
                setActiveDateStr(todayStr);
                const dailyDoc = await getDailyDurationDoc(data.user.id, todayStr);
                const priorSeconds = dailyDoc?.totalSeconds || 0;
                const nowTs = Date.now();
                setAccumulatedToday(priorSeconds);
                setSessionStartTimestamp(nowTs);

                await saveDailyDurationDoc({
                  agentId: data.user.id,
                  date: todayStr,
                  totalSeconds: priorSeconds,
                  sessionStartTimestamp: nowTs,
                  lastUpdatedISO: new Date().toISOString()
                });

                await signInAnonymouslyIfNeeded();
                setActiveTab('dashboard');
              } catch (err: any) {
                setLoginError('Authentication service unreachable. Please try again.');
              }
            }}
            className="w-full space-y-3"
          >
            {/* Input 1: Username / ID with User Icon */}
            <div className="relative w-full flex items-center">
              <div className="absolute left-3.5 text-gray-400 dark:text-slate-500 pointer-events-none">
                <UserIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                placeholder="Username"
                value={loginRole === 'AGENT' ? loginAgentId : loginAdminUser}
                onChange={(e) => {
                  if (loginRole === 'AGENT') {
                    setLoginAgentId(e.target.value);
                  } else {
                    setLoginAdminUser(e.target.value);
                  }
                  setLoginError('');
                }}
                className="w-full bg-white dark:bg-[#0e1526] border border-gray-200 dark:border-slate-800 rounded-md pl-10 pr-4 py-2.5 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#6A00D1] focus:ring-1 focus:ring-[#6A00D1] transition-all shadow-2xs font-sans"
                id={loginRole === 'AGENT' ? 'agent_login_id' : 'admin_login_user'}
              />
            </div>

            {/* Input 2: Password with Lock Icon & Toggle Eye */}
            <div className="relative w-full flex items-center">
              <div className="absolute left-3.5 text-gray-400 dark:text-slate-500 pointer-events-none">
                <LockIcon className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Please enter password"
                value={loginRole === 'AGENT' ? loginAgentPass : loginAdminPass}
                onChange={(e) => {
                  if (loginRole === 'AGENT') {
                    setLoginAgentPass(e.target.value);
                  } else {
                    setLoginAdminPass(e.target.value);
                  }
                  setLoginError('');
                }}
                className="w-full bg-white dark:bg-[#0e1526] border border-gray-200 dark:border-slate-800 rounded-md pl-10 pr-10 py-2.5 text-sm text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-[#6A00D1] focus:ring-1 focus:ring-[#6A00D1] transition-all shadow-2xs font-sans"
                id={loginRole === 'AGENT' ? 'agent_login_pass' : 'admin_login_pass'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 focus:outline-none cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
            </div>

            {loginError && (
              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400 text-xs py-1 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Login Button matching screenshot */}
            <button
              type="submit"
              className="w-full bg-[#6A00D1] hover:bg-[#5800B0] active:bg-[#4B0098] text-white font-medium py-2.5 px-4 rounded-md text-sm transition-all shadow-sm cursor-pointer mt-1 font-sans"
              id="submit_login_button"
            >
              Login
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-[#0b0f19] text-slate-100 transition-colors duration-300 antialiased selection:bg-[#6A00D1] selection:text-white font-sans">
      
      {/* Sidebar Navigation */}
      <aside 
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
        className={`fixed top-0 bottom-0 left-0 z-45 bg-[#0B1120] text-slate-100 border-r border-slate-800/80 flex flex-col justify-between transition-all duration-300 shadow-xs ${
          isExpanded ? 'w-64' : 'w-16'
        } hidden md:flex shrink-0`}
      >
        
        {/* Sidebar Header */}
        <div className={`p-3.5 border-b border-slate-800/80 flex items-center shrink-0 transition-all duration-300 ${isExpanded ? 'justify-between gap-2.5' : 'justify-center'}`}>
          {isExpanded ? (
            <div className="flex items-center gap-2.5 overflow-hidden animate-fadeIn">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-500">
                <Clock className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
              </div>
              <div className="truncate text-left">
                <span className="font-sans font-bold text-xs block tracking-tight text-white uppercase">Customer CRM Portal</span>
                <span className="text-[10px] text-slate-400 block truncate font-mono">{agentName}</span>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 text-amber-500">
              <Clock className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
            </div>
          )}
          
          {isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSidebarCollapsed(!isSidebarCollapsed);
              }}
              className="p-1.5 rounded-md bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 transition-colors cursor-pointer shrink-0"
              title={isSidebarCollapsed ? "Pin Sidebar" : "Collapse Sidebar"}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* Sidebar Navigation Links */}
        <div className={`flex-1 overflow-y-auto scrollbar-thin transition-all duration-300 ${isExpanded ? 'p-3 space-y-2' : 'px-1 py-3 space-y-2'}`}>
          <nav className="space-y-1.5">
            {userRole === 'ADMIN' ? (
              <>
                {/* Unified Admin Categories in Single Left Sidebar */}
                {[
                  {
                    id: 'cat_dashboard',
                    title: 'Dashboard & Overview',
                    icon: LayoutDashboard,
                    subItems: [
                      { id: 'dash_exec', label: 'Executive Dashboard', icon: BarChart3 },
                      { id: 'dash_mon', label: 'Real-Time Monitoring', icon: Radio, badge: liveAgentSessions.filter(s => s.status !== 'offline').length },
                      { id: 'dash_daily', label: 'Daily Performance Summary', icon: Clock },
                      { id: 'dash_monthly', label: 'Monthly Analytics Report', icon: FileBarChart },
                      { id: 'dash_other', label: 'Quick Actions / Other Options', icon: Sparkles }
                    ]
                  },
                  {
                    id: 'cat_users',
                    title: 'User Management',
                    icon: Users,
                    subItems: [
                      { id: 'user_dash', label: 'Users Dashboard', icon: Users, badge: agentCredentials.length },
                      { id: 'user_add', label: 'Add New User', icon: UserPlus },
                      { id: 'user_edit', label: 'Edit / Manage User Roles', icon: UserCog },
                      { id: 'user_mon', label: 'User Monitoring & Logs', icon: Activity },
                      { id: 'user_daily', label: 'Daily User Activity Report', icon: Calendar },
                      { id: 'user_monthly', label: 'Monthly User Growth Report', icon: TrendingUp },
                      { id: 'user_pref', label: 'User Settings & Preferences', icon: Sliders }
                    ]
                  },
                  {
                    id: 'cat_roster',
                    title: 'Agent Duty Status & Roster',
                    icon: Calendar,
                    subItems: [
                      { id: 'roster_dash', label: 'Roster Dashboard', icon: Calendar, badge: '24/7' },
                      { id: 'roster_add', label: 'Add New Roster / Shift', icon: Plus },
                      { id: 'roster_edit', label: 'Edit Shift Schedule & Assignments', icon: Wrench },
                      { id: 'roster_mon', label: 'Live Duty Status Monitoring', icon: UserCheck },
                      { id: 'roster_daily', label: 'Daily Attendance & Duty Report', icon: Clock },
                      { id: 'roster_monthly', label: 'Monthly Shift Summary Report', icon: FileText },
                      { id: 'roster_pref', label: 'Roster Configurations & Preferences', icon: Settings }
                    ]
                  },
                  {
                    id: 'cat_operations',
                    title: 'System Operations & Monitoring',
                    icon: Cpu,
                    subItems: [
                      { id: 'ops_dash', label: 'Operations Dashboard', icon: Cpu },
                      { id: 'ops_add_rule', label: 'Add System Rule / Threshold', icon: ShieldAlert },
                      { id: 'ops_edit_param', label: 'Edit System Parameters', icon: Wrench },
                      { id: 'ops_health', label: 'System Health Monitoring', icon: Zap },
                      { id: 'ops_daily', label: 'Daily System Audit Report', icon: Scroll },
                      { id: 'ops_monthly', label: 'Monthly Reliability Report', icon: Layers },
                      { id: 'ops_pref', label: 'Gateway & API Preferences', icon: Globe }
                    ]
                  },
                  {
                    id: 'cat_financials',
                    title: 'Financials & Customer Reports',
                    icon: FileSpreadsheet,
                    subItems: [
                      { id: 'fin_dash', label: 'Financial Overview Dashboard', icon: DollarSign },
                      { id: 'fin_add_entry', label: 'Add Entry / Invoice', icon: Plus },
                      { id: 'fin_edit_trans', label: 'Edit Transactions', icon: ClipboardList },
                      { id: 'fin_mon', label: 'Real-Time Revenue Monitoring', icon: TrendingUp },
                      { id: 'fin_daily', label: 'Daily Operational Report', icon: FileSpreadsheet },
                      { id: 'fin_monthly', label: 'Monthly Financial Summary', icon: FileText },
                      { id: 'fin_pref', label: 'Export & Sync Options', icon: Download }
                    ]
                  },
                  {
                    id: 'cat_tickets',
                    title: 'Support Tickets & CRM',
                    icon: FileText,
                    subItems: [
                      { id: 'tickets', label: 'Support Tickets', icon: FileText, badge: tickets.length },
                      { id: 'cs_ticket_form', label: 'CS Ticket Form', icon: ClipboardList },
                      { id: 'crm', label: 'CRM Customer Base', icon: Users, badge: contacts.length },
                      { id: 'kb', label: 'Knowledge Base', icon: BookOpen, badge: kbArticles.length }
                    ]
                  }
                ].map((cat) => {
                  const CatIcon = cat.icon;
                  const isCatExpanded = !!expandedNavCategories[cat.id];
                  const hasActiveSub = cat.subItems.some(sub => 
                    (activeTab === 'admin_portal' && activeAdminSubOption === sub.id) ||
                    (activeTab === sub.id)
                  );

                  return (
                    <div key={cat.id} className="rounded-lg border border-slate-800/80 overflow-hidden bg-slate-900/60">
                      {/* Accordion Category Header */}
                      <button
                        onClick={() => {
                          if (!isExpanded) setIsSidebarCollapsed(false);
                          toggleNavCategory(cat.id);
                        }}
                        title={!isExpanded ? cat.title : undefined}
                        className={`w-full flex items-center justify-between p-2 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          hasActiveSub
                            ? 'bg-[#6A00D1]/20 text-purple-300 border-b border-[#6A00D1]/30 font-bold'
                            : 'hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <CatIcon className={`w-4 h-4 shrink-0 ${hasActiveSub ? 'text-purple-300' : 'text-slate-400'}`} />
                          {isExpanded && <span className="truncate">{cat.title}</span>}
                        </div>
                        {isExpanded && (
                          isCatExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {/* Sub-Items Nested List */}
                      {(isCatExpanded || !isExpanded) && (
                        <div className={`p-1 space-y-1 ${isExpanded ? 'bg-[#0B1120]/90 border-t border-slate-800/60' : ''}`}>
                          {cat.subItems.map((sub) => {
                            const SubIcon = sub.icon;
                            const isSubActive = (activeTab === 'admin_portal' && activeAdminSubOption === sub.id) || (activeTab === sub.id);

                            return (
                              <button
                                key={sub.id}
                                onClick={() => {
                                  if (['tickets', 'cs_ticket_form', 'crm', 'kb'].includes(sub.id)) {
                                    setActiveTab(sub.id as any);
                                  } else {
                                    setActiveTab('admin_portal');
                                    setActiveAdminSubOption(sub.id);
                                  }
                                  setIsMobileSidebarOpen(false);
                                }}
                                title={!isExpanded ? sub.label : undefined}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                                  isSubActive
                                    ? 'bg-[#6A00D1] hover:bg-[#5800B0] text-white font-bold shadow-2xs'
                                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                                }`}
                              >
                                <div className="flex items-center gap-2 truncate">
                                  <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                                  {isExpanded && <span className="truncate">{sub.label}</span>}
                                </div>
                                {isExpanded && sub.badge !== undefined && (
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                                    isSubActive
                                      ? 'bg-white/20 text-white'
                                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                                  }`}>
                                    {sub.badge}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Standalone Settings Item */}
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setIsMobileSidebarOpen(false);
                  }}
                  title={!isExpanded ? 'Settings' : undefined}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-[#6A00D1] hover:bg-[#5800B0] text-white shadow-2xs'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
                    {isExpanded && <span>Settings</span>}
                  </div>
                </button>
              </>
            ) : (
              /* Agent View Navigation */
              [
                { id: 'dashboard', label: 'Performance Overview', icon: LayoutDashboard },
                { id: 'tickets', label: 'Support Tickets', icon: FileText, badge: tickets.length },
                { id: 'cs_ticket_form', label: 'CS Ticket Form', icon: ClipboardList },
                { id: 'crm', label: 'CRM Customer Base', icon: Users, badge: contacts.length },
                { id: 'reports', label: 'Agent Reports', icon: BarChart },
                { id: 'kb', label: 'Knowledge Base', icon: BookOpen, badge: kbArticles.length },
                { id: 'roster', label: 'ALL-DAY ROSTER', icon: Calendar, badge: '24/7' },
                { id: 'settings', label: 'Settings', icon: Settings }
              ].map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                
                const activeClasses = 'bg-[#6A00D1] hover:bg-[#5800B0] text-white font-bold shadow-2xs';
                const inactiveClasses = 'text-slate-300 hover:text-white hover:bg-slate-800/80 border border-transparent';

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as any);
                      setIsMobileSidebarOpen(false);
                    }}
                    title={!isExpanded ? item.label : undefined}
                    className={`w-full flex items-center rounded-lg text-[11px] font-semibold transition-all duration-200 cursor-pointer ${
                      isExpanded ? 'justify-between px-3 py-2' : 'justify-center p-2'
                    } ${isActive ? activeClasses : inactiveClasses}`}
                  >
                    <div className={`flex items-center ${isExpanded ? 'gap-2.5' : 'justify-center'}`}>
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      {isExpanded && <span className="truncate animate-fadeIn">{item.label}</span>}
                    </div>
                    {isExpanded && item.badge !== undefined && (
                      <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full ${
                        isActive 
                          ? 'bg-white/20 text-white'
                          : 'bg-gray-100 border border-gray-200 text-gray-500'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </nav>
        </div>

        {/* Sidebar Footer Controls */}
        <div className={`border-t border-zinc-900 transition-all duration-300 ${isExpanded ? 'p-4 space-y-3' : 'py-4 px-2'}`}>
          <button
            onClick={handlePortalLogout}
            title="Logout"
            className={`flex items-center justify-center bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 hover:border-red-600 text-red-400 font-bold uppercase tracking-wider text-[10px] rounded-xl transition-all duration-300 cursor-pointer shadow-sm ${
              isExpanded ? 'w-full gap-2 py-2.5' : 'w-10 h-10 p-0 mx-auto'
            }`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {isExpanded && <span className="animate-fadeIn">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div 
          onClick={() => setIsMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden animate-fadeIn"
        />
      )}

      {/* Right Main Content Area Wrapper */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto transition-all duration-300 ${
        isSidebarCollapsed ? 'md:ml-16' : 'md:ml-64'
      }`}>

        {/* Mobile Sidebar drawer */}
        <div className={`fixed inset-y-0 left-0 z-50 bg-[#0B1120] border-r border-slate-800 text-slate-100 w-64 p-4 flex flex-col justify-between transform transition-transform duration-300 md:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Clock className="w-5.5 h-5.5 text-amber-500 animate-pulse" />
                <div className="text-left">
                  <span className="font-sans font-bold text-xs block text-white uppercase">CRM ADMIN</span>
                  <span className="text-[10px] text-slate-400 block font-mono">{agentName}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsMobileSidebarOpen(false)}
                className="text-slate-400 hover:text-slate-900 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="space-y-2 overflow-y-auto max-h-[calc(100vh-160px)] pr-1 scrollbar-thin">
              {userRole === 'ADMIN' ? (
                <>
                  {[
                    {
                      id: 'cat_dashboard',
                      title: 'Dashboard & Overview',
                      icon: LayoutDashboard,
                      subItems: [
                        { id: 'dash_exec', label: 'Executive Dashboard', icon: BarChart3 },
                        { id: 'dash_mon', label: 'Real-Time Monitoring', icon: Radio, badge: liveAgentSessions.filter(s => s.status !== 'offline').length },
                        { id: 'dash_daily', label: 'Daily Performance Summary', icon: Clock },
                        { id: 'dash_monthly', label: 'Monthly Analytics Report', icon: FileBarChart },
                        { id: 'dash_other', label: 'Quick Actions / Other Options', icon: Sparkles }
                      ]
                    },
                    {
                      id: 'cat_users',
                      title: 'User Management',
                      icon: Users,
                      subItems: [
                        { id: 'user_dash', label: 'Users Dashboard', icon: Users, badge: agentCredentials.length },
                        { id: 'user_add', label: 'Add New User', icon: UserPlus },
                        { id: 'user_edit', label: 'Edit / Manage User Roles', icon: UserCog },
                        { id: 'user_mon', label: 'User Monitoring & Logs', icon: Activity },
                        { id: 'user_daily', label: 'Daily User Activity Report', icon: Calendar },
                        { id: 'user_monthly', label: 'Monthly User Growth Report', icon: TrendingUp },
                        { id: 'user_pref', label: 'User Settings & Preferences', icon: Sliders }
                      ]
                    },
                    {
                      id: 'cat_roster',
                      title: 'Agent Duty Status & Roster',
                      icon: Calendar,
                      subItems: [
                        { id: 'roster_dash', label: 'Roster Dashboard', icon: Calendar, badge: '24/7' },
                        { id: 'roster_add', label: 'Add New Roster / Shift', icon: Plus },
                        { id: 'roster_edit', label: 'Edit Shift Schedule & Assignments', icon: Wrench },
                        { id: 'roster_mon', label: 'Live Duty Status Monitoring', icon: UserCheck },
                        { id: 'roster_daily', label: 'Daily Attendance & Duty Report', icon: Clock },
                        { id: 'roster_monthly', label: 'Monthly Shift Summary Report', icon: FileText },
                        { id: 'roster_pref', label: 'Roster Configurations & Preferences', icon: Settings }
                      ]
                    },
                    {
                      id: 'cat_operations',
                      title: 'System Operations & Monitoring',
                      icon: Cpu,
                      subItems: [
                        { id: 'ops_dash', label: 'Operations Dashboard', icon: Cpu },
                        { id: 'ops_add_rule', label: 'Add System Rule / Threshold', icon: ShieldAlert },
                        { id: 'ops_edit_param', label: 'Edit System Parameters', icon: Wrench },
                        { id: 'ops_health', label: 'System Health Monitoring', icon: Zap },
                        { id: 'ops_daily', label: 'Daily System Audit Report', icon: Scroll },
                        { id: 'ops_monthly', label: 'Monthly Reliability Report', icon: Layers },
                        { id: 'ops_pref', label: 'Gateway & API Preferences', icon: Globe }
                      ]
                    },
                    {
                      id: 'cat_financials',
                      title: 'Financials & Customer Reports',
                      icon: FileSpreadsheet,
                      subItems: [
                        { id: 'fin_dash', label: 'Financial Overview Dashboard', icon: DollarSign },
                        { id: 'fin_add_entry', label: 'Add Entry / Invoice', icon: Plus },
                        { id: 'fin_edit_trans', label: 'Edit Transactions', icon: ClipboardList },
                        { id: 'fin_mon', label: 'Real-Time Revenue Monitoring', icon: TrendingUp },
                        { id: 'fin_daily', label: 'Daily Operational Report', icon: FileSpreadsheet },
                        { id: 'fin_monthly', label: 'Monthly Financial Summary', icon: FileText },
                        { id: 'fin_pref', label: 'Export & Sync Options', icon: Download }
                      ]
                    },
                    {
                      id: 'cat_tickets',
                      title: 'Support Tickets & CRM',
                      icon: FileText,
                      subItems: [
                        { id: 'tickets', label: 'Support Tickets', icon: FileText, badge: tickets.length },
                        { id: 'cs_ticket_form', label: 'CS Ticket Form', icon: ClipboardList },
                        { id: 'crm', label: 'CRM Customer Base', icon: Users, badge: contacts.length },
                        { id: 'kb', label: 'Knowledge Base', icon: BookOpen, badge: kbArticles.length }
                      ]
                    }
                  ].map((cat) => {
                    const CatIcon = cat.icon;
                    const isCatExpanded = !!expandedNavCategories[cat.id];
                    const hasActiveSub = cat.subItems.some(sub => 
                      (activeTab === 'admin_portal' && activeAdminSubOption === sub.id) ||
                      (activeTab === sub.id)
                    );

                    return (
                      <div key={cat.id} className="rounded-xl border border-slate-800 overflow-hidden bg-[#131b2e]">
                        <button
                          onClick={() => toggleNavCategory(cat.id)}
                          className={`w-full flex items-center justify-between p-2.5 text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                            hasActiveSub
                              ? 'bg-[#6A00D1]/20 text-[#c084fc] border-b border-[#6A00D1]/30'
                              : 'hover:bg-slate-800/80 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CatIcon className={`w-4 h-4 shrink-0 ${hasActiveSub ? 'text-[#c084fc]' : 'text-slate-400'}`} />
                            <span className="truncate">{cat.title}</span>
                          </div>
                          {isCatExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                        </button>

                        {isCatExpanded && (
                          <div className="p-1 space-y-1 bg-[#0e1526] border-t border-slate-800">
                            {cat.subItems.map((sub) => {
                              const SubIcon = sub.icon;
                              const isSubActive = (activeTab === 'admin_portal' && activeAdminSubOption === sub.id) || (activeTab === sub.id);

                              return (
                                <button
                                  key={sub.id}
                                  onClick={() => {
                                    if (['tickets', 'cs_ticket_form', 'crm', 'kb'].includes(sub.id)) {
                                      setActiveTab(sub.id as any);
                                    } else {
                                      setActiveTab('admin_portal');
                                      setActiveAdminSubOption(sub.id);
                                    }
                                    setIsMobileSidebarOpen(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                                    isSubActive
                                      ? 'bg-[#6A00D1] text-white font-bold shadow-xs'
                                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                                    <span className="truncate">{sub.label}</span>
                                  </div>
                                  {sub.badge !== undefined && (
                                    <span className={`text-[8px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                                      isSubActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                                    }`}>
                                      {sub.badge}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    onClick={() => {
                      setActiveTab('settings');
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      activeTab === 'settings'
                        ? 'bg-[#6A00D1] text-white font-bold shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Settings className={`w-4 h-4 shrink-0 ${activeTab === 'settings' ? 'text-white' : 'text-slate-400'}`} />
                      <span>Settings</span>
                    </div>
                  </button>
                </>
              ) : (
                [
                  { id: 'dashboard', label: 'Performance Overview', icon: LayoutDashboard },
                  { id: 'tickets', label: 'Support Tickets', icon: FileText, badge: tickets.length },
                  { id: 'cs_ticket_form', label: 'CS Ticket Form', icon: ClipboardList },
                  { id: 'crm', label: 'CRM Customer Base', icon: Users, badge: contacts.length },
                  { id: 'reports', label: 'Agent Reports', icon: BarChart },
                  { id: 'kb', label: 'Knowledge Base', icon: BookOpen, badge: kbArticles.length },
                  { id: 'roster', label: 'ALL-DAY ROSTER', icon: Calendar, badge: '24/7' },
                  { id: 'settings', label: 'Settings', icon: Settings }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  const activeClasses = 'bg-[#6A00D1] text-white font-bold shadow-xs';
                  const inactiveClasses = 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent';

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as any);
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        isActive ? activeClasses : inactiveClasses
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge !== undefined && (
                        <span className={`font-mono text-[9px] px-1.5 py-0.2 rounded-full border ${
                          isActive
                            ? 'bg-white/20 border-white/30 text-white'
                            : 'bg-slate-100 border-slate-200 text-slate-500'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </nav>
          </div>

          <button
            onClick={handlePortalLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-950/40 hover:bg-red-900/50 border border-red-900/50 text-red-400 font-bold uppercase tracking-wider text-[10px] rounded-xl cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>

        {/* Modern Navigation Header Layout */}
        <header className="bg-[#0e1526] backdrop-blur-md border-b border-slate-800/80 px-4 py-3.5 sticky top-0 z-20 w-full shrink-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 font-sans select-none shadow-xs transition-colors duration-300">
          
          {/* LEFT SIDE BLOCK */}
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <div className="flex flex-wrap items-center gap-3">
              {/* Menu Bar toggle button - visible only on mobile */}
              <button
                onClick={() => {
                  if (window.innerWidth < 768) {
                    setIsMobileSidebarOpen(true);
                  }
                }}
                className="md:hidden p-1.5 rounded-lg bg-[#131b2e] border border-slate-700/80 hover:bg-[#1c273e] text-slate-300 transition-all cursor-pointer"
                title="Toggle Menu"
              >
                <Menu className="w-4 h-4" />
              </button>

              {/* Profile Name & Active Status Dot Badge */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 font-bold uppercase text-xs shrink-0 font-mono hidden sm:flex">
                  {(currentUser?.name || agentName || 'SA').slice(0, 2).toUpperCase()}
                </div>
                <div className="text-left flex flex-col justify-center">
                  <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5 leading-none">
                    <span>{currentUser?.name || agentName || 'System Agent'}</span>
                    <span className="text-[9px] text-slate-400 font-mono">({currentUser?.role || localStorage.getItem('csp_user_role') || 'AGENT'})</span>
                  </div>
                  
                  {/* Status Dot Badge */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2 h-2 rounded-full ${
                      !isCheckedIn 
                        ? 'bg-slate-400 animate-pulse' 
                        : isOnBreak 
                          ? 'bg-amber-500 animate-pulse' 
                          : 'bg-emerald-500 animate-pulse'
                    }`} />
                    <span className="text-[10px] font-bold font-mono tracking-wide uppercase text-slate-400">
                      {!isCheckedIn ? 'Offline' : isOnBreak ? 'On Break' : 'Online'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dropdown containing all Break Categories */}
              {isCheckedIn && !isOnBreak && activeTab !== 'admin_portal' && (
                <div className="relative ml-2">
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) {
                        handleHeaderToggleBreak(e.target.value as any);
                      }
                    }}
                    className="appearance-none bg-[#131b2e] hover:bg-[#1c273e] border border-slate-700/80 pl-8 pr-8 py-1.5 rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 cursor-pointer transition-all"
                  >
                    <option value="" disabled hidden>Take Break...</option>
                    <option value="Short Break">Short Break (15m)</option>
                    <option value="Meal Break">Meal Break (45m)</option>
                    <option value="Prayer Break">Prayer Break (15m)</option>
                    <option value="Meeting">Meeting (60m)</option>
                  </select>
                  <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-400">
                    <Coffee className="w-3.5 h-3.5" />
                  </div>
                  <div className="absolute inset-y-0 right-2.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="w-3 h-3" />
                  </div>
                </div>
              )}
            </div>

            {/* Underneath this block: live ticking running break timer duration & "End Break" button */}
            {isCheckedIn && isOnBreak && activeTab !== 'admin_portal' && (
              <div className="flex items-center gap-3 mt-1 pl-1 text-left">
                <span className="text-xs font-extrabold font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-1 rounded-lg animate-pulse flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.15)] drop-shadow-[0_0_2px_rgba(6,182,212,0.3)]">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{breakReason}: {formatCompactTime(getActiveBreakTimerVal())}</span>
                </span>
                <button
                  onClick={() => handleHeaderToggleBreak('Available')}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#6A00D1] hover:bg-[#5800B0] active:scale-[0.98] text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5 text-white animate-bounce" />
                  <span>End Break</span>
                </button>
              </div>
            )}
          </div>

          {/* RIGHT SIDE BLOCK */}
          <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">
            {/* Department/Work Distribution Category selector dropdown */}
            {activeTab !== 'admin_portal' && (() => {
              const standbyCount = liveAgentSessions.filter(s => s.status === 'available' && (s.currentActivity === 'available' || s.currentActivity === 'STANDBY' || !s.currentActivity)).length;
              const inboundCount = liveAgentSessions.filter(s => s.status === 'available' && s.currentActivity?.toLowerCase().includes('inbound')).length;
              const outboundCount = liveAgentSessions.filter(s => s.status === 'available' && (s.currentActivity?.toLowerCase().includes('outbound') || s.currentActivity?.toLowerCase().includes('bound'))).length;
              const liveChatCount = liveAgentSessions.filter(s => s.status === 'available' && (s.currentActivity?.toLowerCase().includes('live chat') || s.currentActivity?.toLowerCase().includes('chat'))).length;
              const irSupportCount = liveAgentSessions.filter(s => s.status === 'available' && (s.currentActivity?.toLowerCase().includes('ir support') || s.currentActivity?.toLowerCase().includes('ir'))).length;

              return (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider hidden lg:inline">
                    Active Division:
                  </span>
                  <div className="relative">
                    <select
                      value={currentActivity}
                      disabled={!isCheckedIn || isOnBreak}
                      onChange={(e) => handleHeaderActivityChange(e.target.value)}
                      className="appearance-none bg-[#131b2e] hover:bg-[#1c273e] border border-slate-700/80 pl-3.5 pr-8 py-1.5 rounded-lg text-xs font-bold text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="available">STANDBY ({standbyCount})</option>
                      <option value="Inbound Call">INBOUND ({inboundCount})</option>
                      <option value="Outbound Call">OUTBOUND ({outboundCount})</option>
                      <option value="Live Chat">LIVE CHAT ({liveChatCount})</option>
                      <option value="IR Support">IR SUPPORT ({irSupportCount})</option>
                      {['Short Break', 'Meal Break', 'Prayer Break', 'Meeting'].includes(currentActivity) && (
                        <option value={currentActivity}>{currentActivity.toUpperCase()}</option>
                      )}
                      {currentActivity === 'offline' && (
                        <option value="offline">OFFLINE</option>
                      )}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Global Search Button */}
            <button
              onClick={() => setIsGlobalSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#131b2e] border border-slate-700/80 hover:bg-[#1c273e] text-slate-200 rounded-lg text-xs font-medium transition-all cursor-pointer"
              title="Search contacts, tickets, articles (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline text-slate-300">Search...</span>
              <kbd className="hidden md:inline px-1.5 py-0.5 text-[9px] font-mono bg-[#0b0f19] border border-slate-700 rounded text-slate-400">Ctrl K</kbd>
            </button>

            {/* Integrated Clock In / Clock Out action button */}
            <div className="flex items-center gap-2 font-mono">
              {activeTab !== 'admin_portal' && (
                <>
                  {isCheckedIn && (
                    <div className="flex items-center gap-1.5 bg-cyan-500/10 border border-cyan-500/25 px-2.5 py-1.5 rounded-lg text-cyan-500 dark:text-cyan-400 text-[10px] font-extrabold uppercase tracking-wider font-mono shadow-[0_0_10px_rgba(6,182,212,0.15)] drop-shadow-[0_0_2px_rgba(6,182,212,0.3)] animate-pulse">
                      <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Shift: {formatTime(shiftTimer)}</span>
                    </div>
                  )}
                  {isCheckedIn ? (
                    <button
                      onClick={handleHeaderCheckOut}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-[0.98] text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Clock Out</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleHeaderCheckIn}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-[10px] uppercase tracking-wider rounded-lg shadow-xs transition-all cursor-pointer"
                    >
                      <Clock className="w-3.5 h-3.5 text-white animate-pulse" />
                      <span>Clock In</span>
                    </button>
                  )}
                </>
              )}
            </div>

          </div>
        </header>



        {/* Dynamic Inner Workspace Content Tab Switching Router */}
        <main className="flex-1">
          {activeTab === 'dashboard' && (
            <DashboardSection
              agentName={agentName}
              agentId={currentUser?.id || 'agent01'}
              isCheckedIn={isCheckedIn}
              setIsCheckedIn={setIsCheckedIn}
              agentStatus={agentStatus}
              setAgentStatus={setAgentStatus}
              currentActivity={currentActivity}
              setCurrentActivity={setCurrentActivity}
              isOnBreak={isOnBreak}
              setIsOnBreak={setIsOnBreak}
              shiftStartTime={shiftStartTime}
              setShiftStartTime={setShiftStartTime}
              shiftTimer={shiftTimer}
              setShiftTimer={setShiftTimer}
              shortBreakTimer={shortBreakTimer}
              setShortBreakTimer={setShortBreakTimer}
              mealBreakTimer={mealBreakTimer}
              setMealBreakTimer={setMealBreakTimer}
              prayerBreakTimer={prayerBreakTimer}
              setPrayerBreakTimer={setPrayerBreakTimer}
              meetingTimer={meetingTimer}
              setMeetingTimer={setMeetingTimer}
              inboundTimer={inboundTimer}
              setInboundTimer={setInboundTimer}
              outboundTimer={outboundTimer}
              setOutboundTimer={setOutboundTimer}
              liveChatTimer={liveChatTimer}
              setLiveChatTimer={setLiveChatTimer}
              irSupportTimer={irSupportTimer}
              setIrSupportTimer={setIrSupportTimer}
              liveAgentSessions={liveAgentSessions}
              liveBreaks={liveBreaks}
              token={token}
              connectedSpreadsheetId={connectedSpreadsheetId}
              logActivity={logActivity}
              upsertSessionToFirebase={upsertSessionToFirebase}
              isBreakOverrun={isBreakOverrun}
              getBreakLimitMinutes={getBreakLimitMinutes}
            />
          )}

          {activeTab === 'tickets' && (
            <CrmSection
              contacts={contacts}
              setContacts={setContacts}
              tickets={tickets}
              setTickets={setTickets}
              token={token}
              agentName={agentName}
              createSupportDoc={async (tkn, ticket, contact) => {
                // Inline Doc creation wrapper
                const docId = `doc-${Date.now()}`;
                logActivity(`Exported Support Doc for Ticket #${ticket.id}`);
                return { documentId: docId, documentUrl: `https://docs.google.com/document/d/${docId}` };
              }}
              logActivity={logActivity}
              subTabDefault="tickets"
            />
          )}

          {activeTab === 'cs_ticket_form' && (
            <CsTicketFormSection
              tickets={tickets}
              setTickets={setTickets}
              agentName={agentName}
              logActivity={logActivity}
            />
          )}

          {activeTab === 'crm' && (
            <CrmSection
              contacts={contacts}
              setContacts={setContacts}
              tickets={tickets}
              setTickets={setTickets}
              token={token}
              agentName={agentName}
              createSupportDoc={async (tkn, ticket, contact) => {
                const docId = `doc-${Date.now()}`;
                logActivity(`Exported Support Doc for Ticket #${ticket.id}`);
                return { documentId: docId, documentUrl: `https://docs.google.com/document/d/${docId}` };
              }}
              logActivity={logActivity}
              subTabDefault="contacts"
            />
          )}

          {activeTab === 'reports' && (
            <ReportsSection
              contacts={contacts}
              tickets={tickets}
              rosterDays={rosterDays}
              liveAgentSessions={liveAgentSessions}
              liveBreaks={liveBreaks}
              activityLogs={activityLogs}
              logActivity={logActivity}
            />
          )}

          {activeTab === 'kb' && (
            <KbSection
              kbArticles={kbArticles}
              setKbArticles={setKbArticles}
              agentName={agentName}
              logActivity={logActivity}
              userRole={userRole}
            />
          )}

          {activeTab === 'roster' && (
            <RosterSection
              token={token}
              connectedSpreadsheetId={connectedSpreadsheetId}
              agentName={agentName}
              rosterDays={rosterDays}
              setRosterDays={setRosterDays}
              currentRosterYear={currentRosterYear}
              setCurrentRosterYear={setCurrentRosterYear}
              currentRosterMonth={currentRosterMonth}
              setCurrentRosterMonth={setCurrentRosterMonth}
              rosterSeed={rosterSeed}
              setRosterSeed={setRosterSeed}
              generateAutoRoster={generateAutoRoster}
              logActivity={logActivity}
              userRole={userRole}
            />
          )}

          {activeTab === 'admin_portal' && userRole === 'ADMIN' && (
            <AdminSection
              token={token}
              connectedSpreadsheetId={connectedSpreadsheetId}
              connectedSpreadsheetUrl={connectedSpreadsheetUrl}
              setConnectedSpreadsheetId={setConnectedSpreadsheetId}
              setConnectedSpreadsheetUrl={setConnectedSpreadsheetUrl}
              agentCredentials={agentCredentials}
              setAgentCredentials={setAgentCredentials}
              liveAgentSessions={liveAgentSessions}
              setLiveAgentSessions={setLiveAgentSessions}
              liveBreaks={liveBreaks}
              contacts={contacts}
              tickets={tickets}
              rosterDays={rosterDays}
              setRosterDays={setRosterDays}
              systemLogs={systemLogs}
              logActivity={logActivity}
              isBreakOverrun={isBreakOverrun}
              getBreakLimitMinutes={getBreakLimitMinutes}
              userRole={userRole}
              activeSubOption={activeAdminSubOption}
              setActiveSubOption={setActiveAdminSubOption}
              activityLogs={activityLogs}
            />
          )}

          {activeTab === 'admin_portal' && userRole !== 'ADMIN' && (
            <div className="p-8 max-w-2xl mx-auto my-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-500">
                <LockIcon className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Access Restricted (403 Forbidden)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                The Administration Portal requires elevated <span className="font-mono font-bold text-rose-500">ADMIN</span> permissions. Your current account role is <span className="font-mono font-bold text-amber-500">AGENT</span>.
              </p>
              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className="px-5 py-2.5 bg-[#6A00D1] hover:bg-[#5800B0] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  Return to Agent Dashboard
                </button>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <SettingsSection
              token={token}
              isLoggingIn={isLoggingIn}
              handleGoogleSignIn={handleGoogleSignIn}
              connectedSpreadsheetId={connectedSpreadsheetId}
              connectedSpreadsheetUrl={connectedSpreadsheetUrl}
              setConnectedSpreadsheetId={setConnectedSpreadsheetId}
              setConnectedSpreadsheetUrl={setConnectedSpreadsheetUrl}
              saveSpreadsheetConfig={saveSpreadsheetConfig}
              logActivity={logActivity}
              setToken={setToken}
              autoClockIn={autoClockIn}
              audioNotifications={audioNotifications}
              defaultBreakReason={breakReason}
              compactSidebar={compactSidebar}
              showWarnings={showWarnings}
              customAlias={customAlias}
              updatePreferences={updatePreferences}
            />
          )}
        </main>
      </div>

      <GlobalSearchModal
        isOpen={isGlobalSearchOpen}
        onClose={() => setIsGlobalSearchOpen(false)}
        contacts={contacts}
        tickets={tickets}
        kbArticles={kbArticles}
        agentCredentials={agentCredentials}
        onNavigateToTab={(tab, itemId) => {
          if (['tickets', 'cs_ticket_form', 'crm', 'kb', 'roster'].includes(tab)) {
            setActiveTab(tab as any);
          } else {
            setActiveTab('admin_portal');
          }
        }}
      />

      <AuthGatewayModal
        isOpen={isAuthGatewayOpen}
        onClose={() => setIsAuthGatewayOpen(false)}
        onSuccess={handleGoogleSignInSuccess}
      />

      <ConfirmationModal
        isOpen={showHeaderClockOffConfirm}
        title="Clock Off Duty"
        message="Are you sure you want to checkout and clock off? Active timers will halt."
        confirmLabel="Checkout & Clock Off"
        cancelLabel="Cancel"
        isDangerous={true}
        onConfirm={executeHeaderCheckOut}
        onCancel={() => setShowHeaderClockOffConfirm(false)}
      />

    </div>
  );
}
